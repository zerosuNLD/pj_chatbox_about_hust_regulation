"""GraphRAG tools for smolagents — local, global, and naive search over HUST knowledge graph.

Refactored to mirror GraphRAG's official LocalSearch / GlobalSearch patterns:
  • local_search_hybrid  → LocalSearch-style context (pipe-separated entity / relationship /
                           community tables matching LocalContextBuilder output) + naive passages
  • global_search_hybrid → GlobalSearch-style map-reduce (importance-scored analyst findings
                           matching _reduce_response context format) + naive passages
  • naive_search         → pure FAISS cosine-similarity search (unchanged)
"""

import os
import re
import pickle
from collections.abc import Iterable
from typing import Any

import numpy as np
import networkx as nx
import pandas as pd
import faiss
from sentence_transformers import SentenceTransformer

# ── Paths ──────────────────────────────────────────────────────────────────────
OUTPUT_DIR      = "output"
INPUT_FILE      = "input/book.txt"
NAIVE_INDEX_DIR = "output/naive_index"
NAIVE_INDEX_FILE  = f"{NAIVE_INDEX_DIR}/index.faiss"
NAIVE_CHUNKS_FILE = f"{NAIVE_INDEX_DIR}/chunks.pkl"
NAIVE_MODEL_NAME  = "sentence-transformers/all-MiniLM-L6-v2"
GRAPH_CACHE_FILE  = f"{OUTPUT_DIR}/graph_cache.pkl"

# Column delimiter used by GraphRAG's LocalContextBuilder
COL_SEP = "|"

# ── Lazy globals ───────────────────────────────────────────────────────────────
_G: nx.Graph | None                       = None
_reports_df: pd.DataFrame | None         = None
_entity_word_index: dict[str, set[str]] | None = None   # word → {entity_titles}
_naive_index: faiss.Index | None          = None
_naive_chunks: list[str] | None           = None
_naive_model: SentenceTransformer | None  = None
_naive_gpu_res                            = None
_use_gpu: bool                            = False

# FAISS GPU support is optional (requires faiss built with GPU)
try:
    _faiss_has_gpu = hasattr(faiss, "StandardGpuResources") and hasattr(
        faiss, "index_cpu_to_gpu"
    )
except Exception:
    _faiss_has_gpu = False


def _detect_gpu() -> bool:
    """Check if CUDA is available for sentence-transformers."""
    try:
        import torch
        if torch.cuda.is_available():
            print(f"  CUDA GPU detected: {torch.cuda.get_device_name(0)}")
            return True
    except ImportError:
        pass
    return False


if _faiss_has_gpu:
    def _move_index_to_gpu(index: faiss.Index) -> faiss.Index:
        global _naive_gpu_res
        if _naive_gpu_res is None:
            _naive_gpu_res = faiss.StandardGpuResources()
        print("  Moving FAISS index to GPU...")
        return faiss.index_cpu_to_gpu(_naive_gpu_res, 0, index)
else:
    def _move_index_to_gpu(index: faiss.Index) -> faiss.Index:
        return index


# ══════════════════════════════════════════════════════════════════════════════
#  Graph loading  (unchanged)
# ══════════════════════════════════════════════════════════════════════════════

def _ensure_loaded() -> None:
    global _G, _reports_df, _entity_word_index
    if _G is not None:
        return

    # 1. Try pickle cache first (instant load)
    if os.path.exists(GRAPH_CACHE_FILE):
        print("Loading graph from cache...")
        with open(GRAPH_CACHE_FILE, "rb") as f:
            _G, _reports_df, _entity_word_index = pickle.load(f)
        print(f"  Graph loaded: {_G.number_of_nodes()} nodes, {_G.number_of_edges()} edges")
        return

    # 2. Build from parquet (first time only)
    print("Building graph from parquet (first time)...")
    entities_df  = pd.read_parquet(f"{OUTPUT_DIR}/entities.parquet")
    rels_df      = pd.read_parquet(f"{OUTPUT_DIR}/relationships.parquet")
    _reports_df  = pd.read_parquet(f"{OUTPUT_DIR}/community_reports.parquet")

    from collections import defaultdict
    _entity_word_index = defaultdict(set)

    _G = nx.Graph()
    for _, row in entities_df.iterrows():
        title = row["title"]
        _G.add_node(
            title,
            type=row["type"],
            description=row["description"],
            frequency=int(row["frequency"]),
            degree=int(row["degree"]),
            entity_id=row["id"],
        )
        # Index every word in title + description for O(1) candidate lookup
        text = f"{title} {row['description']}".lower()
        for word in set(text.split()):
            _entity_word_index[word].add(title)

    _entity_word_index = dict(_entity_word_index)

    for _, row in rels_df.iterrows():
        _G.add_edge(
            row["source"],
            row["target"],
            weight=row["weight"],
            description=row["description"],
            relation_id=row["id"],
        )

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(GRAPH_CACHE_FILE, "wb") as f:
        pickle.dump((_G, _reports_df, _entity_word_index), f)
    print(f"  Graph cached: {_G.number_of_nodes()} nodes, {_G.number_of_edges()} edges")


# ══════════════════════════════════════════════════════════════════════════════
#  Naive FAISS helpers  (unchanged)
# ══════════════════════════════════════════════════════════════════════════════

def _naive_search_raw(query: str, top_k: int = 5) -> list[tuple[str, float]]:
    """Internal: return list of (chunk_text, score) from FAISS cosine search."""
    _ensure_naive_index()
    global _naive_model, _use_gpu
    if _naive_model is None:
        device = "cuda" if _use_gpu else "cpu"
        print(f"  Loading model {NAIVE_MODEL_NAME} on {device}...")
        _naive_model = SentenceTransformer(NAIVE_MODEL_NAME, device=device)
    q_vec = _naive_model.encode([query], normalize_embeddings=True)
    scores, indices = _naive_index.search(q_vec.astype(np.float32), top_k)
    results = []
    for idx, score in zip(indices[0], scores[0]):
        if idx >= 0:
            results.append((_naive_chunks[idx][:600], float(score)))
    return results


def _format_naive_section(query: str) -> str:
    """Build the 'Additional from Naive Search' appendix (hybrid augmentation)."""
    results = _naive_search_raw(query)
    if not results:
        return ""
    lines = ["", "---", "### Additional from Naive Search", ""]
    for rank, (chunk, score) in enumerate(results):
        lines.append(f"Naive #{rank + 1} (similarity: {score:.4f})")
        lines.append(chunk)
        lines.append("")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
#  Context-building helpers
#  (new private helpers extracted from the two main search functions)
# ══════════════════════════════════════════════════════════════════════════════

def _score_and_rank_entities(qw: set[str]) -> list[tuple[int, str, dict]]:
    """Keyword-score all candidate entities and return sorted [(score, name, attrs)].

    Uses the pre-built word index for O(1) candidate lookup rather than
    scanning all nodes — same optimisation as the original implementation.
    Falls back to all nodes only when the index returns nothing.
    """
    candidates: set[str] = set()
    for w in qw:
        candidates |= _entity_word_index.get(w, set())

    matched: list[tuple[int, str, dict]] = []
    if candidates:
        for node in candidates:
            data = _G.nodes[node]
            title_hits = sum(3 for w in qw if w in node.lower())
            desc_hits  = sum(1 for w in qw if w in data.get("description", "").lower())
            score = title_hits + desc_hits
            if score > 0:
                matched.append((score, node, data))

    if not matched:                                      # full-scan fallback
        matched = [(0, n, d) for n, d in _G.nodes(data=True)]

    matched.sort(key=lambda x: -x[0])
    return matched


def _build_entity_table(nodes_data: dict[str, dict]) -> list[str]:
    """Pipe-separated entity table matching GraphRAG LocalContextBuilder format.

    Header: id | entity | type | description | rank
    Sorted by frequency (descending) to surface most important entities first.
    """
    lines = [
        "## Entities",
        COL_SEP.join(["id", "entity", "type", "description", "rank"]),
    ]
    for name, d in sorted(nodes_data.items(), key=lambda x: -x[1].get("frequency", 0)):
        lines.append(COL_SEP.join([
            str(d.get("entity_id", "")),
            name,
            d.get("type", "UNKNOWN"),
            d.get("description", "")[:300].replace(COL_SEP, " "),
            str(d.get("degree", 0)),
        ]))
    return lines


def _build_relationship_table(edges: list[dict[str, Any]]) -> list[str]:
    """Pipe-separated relationship table matching GraphRAG LocalContextBuilder format.

    Header: id | source | target | description | weight
    Sorted by weight descending, capped at 15 rows.
    """
    lines = [
        "## Relationships",
        COL_SEP.join(["id", "source", "target", "description", "weight"]),
    ]
    for i, e in enumerate(sorted(edges, key=lambda x: -x["weight"])[:15]):
        lines.append(COL_SEP.join([
            str(i),
            e["source"],
            e["target"],
            e["desc"][:300].replace(COL_SEP, " "),
            f"{e['weight']:.2f}",
        ]))
    return lines


def _get_related_community_reports(
    entity_names: Iterable[str],
    qw: set[str],
    top_k: int = 3,
) -> list[dict]:
    """Return top-k community reports related to the given entities and keywords.

    Used by local_search_hybrid to replicate the community context section that
    GraphRAG's LocalContextBuilder appends alongside entity/relationship tables.
    """
    if _reports_df is None:
        return []
    entity_set = {n.lower() for n in entity_names}
    scored: list[tuple[int, dict]] = []
    for _, row in _reports_df.iterrows():
        text = f"{row['title']} {row['summary']} {row.get('full_content', '')}".lower()
        entity_score = sum(2 for e in entity_set if e in text)
        kw_score     = sum(1 for w in qw     if w in text)
        total = entity_score + kw_score
        if total > 0:
            scored.append((total, row.to_dict()))
    scored.sort(key=lambda x: -x[0])
    return [r for _, r in scored[:top_k]]


def _map_community_reports(qw: set[str]) -> list[dict[str, Any]]:
    """Map phase: score every community report and return importance-scored records.

    Mirrors GlobalSearch._map_response_single_batch() — each community report
    becomes a key-point dict {"answer": <text>, "score": <0-10>} equivalent to
    what the LLM would return from the MAP_SYSTEM_PROMPT.

    Records with score == 0 are dropped here (matching the reduce-phase filter
    `if point["score"] > 0` in GlobalSearch._reduce_response).
    """
    results: list[dict[str, Any]] = []
    for _, row in _reports_df.iterrows():
        text       = f"{row['title']} {row['summary']} {row.get('full_content', '')}".lower()
        kw_hits    = sum(1 for w in qw if w in text)
        title_bonus = sum(2 for w in qw if w in row["title"].lower())
        # Normalise to 0-10 (matching the score range in MAP_SYSTEM_PROMPT)
        importance = min(10, kw_hits + title_bonus)
        if importance == 0:
            continue                                     # filter score == 0

        # Build "answer" text  →  mirrors the "description" field in map response points
        findings = row.get("findings", [])
        kf_lines: list[str] = []
        if isinstance(findings, list):
            for f in findings[:3]:
                txt = f.get("summary", str(f)) if isinstance(f, dict) else str(f)
                kf_lines.append(f"  - {txt[:200]}")

        answer_parts = [
            f"**{row['title']}** (Level {row['level']})",
            f"Summary: {row['summary'][:400]}",
        ]
        if kf_lines:
            answer_parts.append("Key findings:\n" + "\n".join(kf_lines))

        results.append({
            "answer": "\n".join(answer_parts),
            "score":  importance,
        })
    return results


# ══════════════════════════════════════════════════════════════════════════════
#  Main search functions
# ══════════════════════════════════════════════════════════════════════════════

def local_search_hybrid(query: str, top_k: int = 10) -> str:
    """LocalSearch-style graph context + naive passage augmentation.

    Mirrors GraphRAG LocalSearch / LocalContextBuilder:
      1. Seed entity selection via keyword scoring (word-index O(1) lookup)
      2. BFS neighbourhood expansion up to top_k entities
      3. Format pipe-separated tables  →  Entities / Relationships / Community Reports
         (matching the column names and delimiter used by LocalContextBuilder)
      4. Append top-5 naive RAG chunks  (hybrid augmentation)

    Best for: specific factual questions (e.g. "graduation conditions").

    Args:
        query: The user's question in natural language.
        top_k: Max entities to include (default 10).
    """
    _ensure_loaded()
    qw = set(query.lower().split())

    # ── 1. Seed entity selection ───────────────────────────────────────────────
    matched = _score_and_rank_entities(qw)
    seeds = matched[:5]

    # ── 2. BFS neighbourhood expansion ────────────────────────────────────────
    visited: set[str]         = set()
    nodes_data: dict[str, dict] = {}
    edges: list[dict[str, Any]] = []

    for _, n, d in seeds:
        if n not in visited:
            visited.add(n)
            nodes_data[n] = d

    for n in list(nodes_data.keys()):
        for nb in _G.neighbors(n):
            if len(nodes_data) >= top_k:
                break
            if nb not in visited:
                visited.add(nb)
                nodes_data[nb] = _G.nodes[nb]
            ed = _G.get_edge_data(n, nb, default={})
            edges.append({
                "source": n,
                "target": nb,
                "desc":   ed.get("description", ""),
                "weight": ed.get("weight", 0),
            })

    # ── 3. Format LocalContextBuilder-style pipe-separated tables ─────────────
    lines: list[str] = [f"# LOCAL SEARCH CONTEXT: '{query}'", ""]

    lines.extend(_build_entity_table(nodes_data))
    lines.append("")
    lines.extend(_build_relationship_table(edges))
    lines.append("")

    # Community context  →  LocalContextBuilder also appends community summaries
    related = _get_related_community_reports(nodes_data.keys(), qw)
    if related:
        lines.append("## Community Reports")
        lines.append(COL_SEP.join(["id", "title", "level", "summary"]))
        for row in related:
            lines.append(COL_SEP.join([
                str(row.get("id", "")),
                row["title"].replace(COL_SEP, " "),
                str(row.get("level", "")),
                row["summary"][:400].replace(COL_SEP, " "),
            ]))
            findings = row.get("findings", [])
            if isinstance(findings, list) and findings:
                for f in findings[:3]:
                    txt = f.get("summary", str(f)) if isinstance(f, dict) else str(f)
                    lines.append(f"  - {txt[:200]}")
        lines.append("")

    # ── 4. Hybrid augmentation — append naive RAG passages ────────────────────
    naive_part = _format_naive_section(query)
    if naive_part:
        lines.append(naive_part)

    return "\n".join(lines)


def global_search_hybrid(query: str, top_k: int = 5) -> str:
    """GlobalSearch-style map-reduce over community reports + naive passage augmentation.

    Mirrors the GraphRAG GlobalSearch two-step pipeline:

    Map   — _map_community_reports() scores every community report for relevance
             (importance 0-10), dropping score == 0 entries.
             Equivalent to GlobalSearch._map_response_single_batch() running in
             parallel across context batches and returning
             {"points": [{"description": ..., "score": ...}]}.

    Reduce — sort by importance descending, keep top-k, format each entry as:
               ----Analyst N----
               Importance Score: X
               <answer text>
             This is exactly the `text_data` string fed to REDUCE_SYSTEM_PROMPT
             inside GlobalSearch._reduce_response().

    Hybrid — append top-5 naive RAG chunks for additional passage coverage.

    Best for: broad thematic questions (e.g. "training regulations overview").

    Args:
        query: The user's question in natural language.
        top_k: Max community reports after reduce step (default 5).
    """
    _ensure_loaded()
    qw = set(query.lower().split())

    # ── Map phase: score all community reports ─────────────────────────────────
    map_responses = _map_community_reports(qw)

    # ── Reduce phase: sort descending, keep top-k ──────────────────────────────
    # Mirrors GlobalSearch._reduce_response():
    #   filtered_key_points = sorted(filtered_key_points, key=lambda x: x["score"], reverse=True)
    map_responses.sort(key=lambda x: -x["score"])
    top_responses = map_responses[:top_k]

    lines: list[str] = [f"# GLOBAL SEARCH CONTEXT: '{query}'", ""]

    if not top_responses:
        # Mirrors the NO_DATA_ANSWER path when all scores == 0
        lines.append(
            "No relevant community reports found for this query. "
            "Consider enabling `allow_general_knowledge` to use general knowledge."
        )
    else:
        lines.append("## Analyst Findings")
        lines.append("*(Reports ranked by relevance — importance score 1–10)*")
        lines.append("")
        # Format exactly as GlobalSearch._reduce_response() builds `text_data`:
        #   "----Analyst {N}----\nImportance Score: {score}\n{answer}"
        for i, point in enumerate(top_responses):
            lines.append(f"----Analyst {i + 1}----")
            lines.append(f"Importance Score: {point['score']}")
            lines.append(point["answer"])
            lines.append("")

    # ── Hybrid augmentation — append naive RAG passages ───────────────────────
    naive_part = _format_naive_section(query)
    if naive_part:
        lines.append(naive_part)

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
#  Naive Search — FAISS + cosine similarity  (unchanged)
# ══════════════════════════════════════════════════════════════════════════════

def _chunk_text(text: str, chunk_size: int = 200, overlap: int = 30) -> list[str]:
    """Split text into overlapping chunks by word count (sentence-aware)."""
    sentences = re.split(r"(?<=[.?!])\s+", text.replace("\n", " "))
    sentences = [s.strip() for s in sentences if s.strip()]
    chunks: list[str] = []
    buffer: list[str] = []
    buf_words = 0
    for s in sentences:
        sw = len(s.split())
        if buf_words + sw > chunk_size and buffer:
            chunks.append(" ".join(buffer))
            # Keep last `overlap` words as overlap
            overlap_words: list[str] = []
            ow = 0
            for b in reversed(buffer):
                bw = len(b.split())
                if ow + bw >= overlap:
                    overlap_words.insert(0, b)
                    break
                overlap_words.insert(0, b)
                ow += bw
            buffer = overlap_words
            buf_words = sum(len(b.split()) for b in buffer)
        buffer.append(s)
        buf_words += sw
    if buffer:
        chunks.append(" ".join(buffer))
    return chunks


def _ensure_naive_index() -> None:
    """Load or build the FAISS index from book.txt chunks."""
    global _naive_index, _naive_chunks, _naive_model, _use_gpu
    if _naive_index is not None:
        return

    if os.path.exists(NAIVE_INDEX_FILE) and os.path.exists(NAIVE_CHUNKS_FILE):
        print("Loading cached FAISS index...")
        cpu_index = faiss.read_index(NAIVE_INDEX_FILE)
        with open(NAIVE_CHUNKS_FILE, "rb") as f:
            _naive_chunks = pickle.load(f)
        print(f"  {len(_naive_chunks)} chunks, dim={cpu_index.d}")
        try:
            import torch
            _use_gpu = torch.cuda.is_available()
            if _use_gpu:
                print(f"  GPU detected: {torch.cuda.get_device_name(0)}")
        except ImportError:
            _use_gpu = False
        _naive_index = _move_index_to_gpu(cpu_index) if _use_gpu else cpu_index
        return

    try:
        import torch
        _use_gpu = torch.cuda.is_available()
        if _use_gpu:
            print(f"  GPU detected: {torch.cuda.get_device_name(0)}")
    except ImportError:
        _use_gpu = False
    device = "cuda" if _use_gpu else "cpu"

    print("Building FAISS index from book.txt...")
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw = f.read()
    _naive_chunks = _chunk_text(raw)
    print(f"  Chunked into {len(_naive_chunks)} pieces")
    print(f"  Loading model {NAIVE_MODEL_NAME} on {device}...")
    _naive_model = SentenceTransformer(NAIVE_MODEL_NAME, device=device)
    print("  Computing embeddings...")
    embeddings = _naive_model.encode(
        _naive_chunks, show_progress_bar=True, normalize_embeddings=True
    )
    dim = embeddings.shape[1]
    cpu_index = faiss.IndexFlatIP(dim)
    cpu_index.add(embeddings.astype(np.float32))
    _naive_index = _move_index_to_gpu(cpu_index) if _use_gpu else cpu_index
    os.makedirs(NAIVE_INDEX_DIR, exist_ok=True)
    faiss.write_index(cpu_index, NAIVE_INDEX_FILE)
    with open(NAIVE_CHUNKS_FILE, "wb") as f:
        pickle.dump(_naive_chunks, f)
    print(f"  Saved: {len(_naive_chunks)} chunks x {dim}d on {device}")


def naive_search(query: str, top_k: int = 5) -> str:
    """Search by cosine similarity via FAISS (no graph, no community reports)."""
    _ensure_naive_index()
    global _naive_model
    if _naive_model is None:
        print(f"  Loading model {NAIVE_MODEL_NAME}...")
        _naive_model = SentenceTransformer(NAIVE_MODEL_NAME)
    q_vec = _naive_model.encode([query], normalize_embeddings=True)
    scores, indices = _naive_index.search(q_vec.astype(np.float32), top_k)

    lines = [f"## Naive Search (cosine similarity): '{query}'", ""]
    for rank, (idx, score) in enumerate(zip(indices[0], scores[0])):
        if idx < 0:
            continue
        chunk = _naive_chunks[idx]
        lines.append(f"---\n### Result #{rank + 1}  (score: {score:.4f})")
        lines.append(chunk[:600])
        if len(chunk) > 600:
            lines.append("...(truncated)")
        lines.append("")
    return "\n".join(lines)


def warmup() -> None:
    """Pre-load heavy resources at startup so the first request is fast."""
    import time
    t0 = time.time()
    print("Warming up GraphRAG resources...")
    _ensure_loaded()
    _ensure_naive_index()
    print(f"Warmup complete in {time.time() - t0:.1f}s")