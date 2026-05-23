"""GraphRAG tools for smolagents — local, global, and naive search over HUST knowledge graph."""

import os
import re
import pickle
import numpy as np
import networkx as nx
import pandas as pd
import faiss
from sentence_transformers import SentenceTransformer

# ── Paths ──
OUTPUT_DIR = "output"
INPUT_FILE = "input/book.txt"
NAIVE_INDEX_DIR = "output/naive_index"
NAIVE_INDEX_FILE = f"{NAIVE_INDEX_DIR}/index.faiss"
NAIVE_CHUNKS_FILE = f"{NAIVE_INDEX_DIR}/chunks.pkl"
NAIVE_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
GRAPH_CACHE_FILE = f"{OUTPUT_DIR}/graph_cache.pkl"

# ── Lazy globals ──
_G: nx.Graph | None = None
_reports_df: pd.DataFrame | None = None
_entity_word_index: dict[str, set[str]] | None = None  # word → {entity_titles}
_naive_index: faiss.Index | None = None
_naive_chunks: list[str] | None = None
_naive_model: SentenceTransformer | None = None
_naive_gpu_res = None
_use_gpu: bool = False

# FAISS GPU support is optional (requires faiss built with GPU)
try:
    _faiss_has_gpu = hasattr(faiss, 'StandardGpuResources')
    if _faiss_has_gpu:
        _faiss_has_gpu = hasattr(faiss, 'index_cpu_to_gpu')
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


def _ensure_loaded():
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
    entities_df = pd.read_parquet(f"{OUTPUT_DIR}/entities.parquet")
    rels_df = pd.read_parquet(f"{OUTPUT_DIR}/relationships.parquet")
    _reports_df = pd.read_parquet(f"{OUTPUT_DIR}/community_reports.parquet")

    # Build entity word index for fast lookup: word → {entity_titles}
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
        # Index every word in title + description
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

    # 3. Save cache for next time
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(GRAPH_CACHE_FILE, "wb") as f:
        pickle.dump((_G, _reports_df, _entity_word_index), f)
    print(f"  Graph cached: {_G.number_of_nodes()} nodes, {_G.number_of_edges()} edges")


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
    """Build the 'Additional from Naive Search' appendix."""
    results = _naive_search_raw(query)
    if not results:
        return ""
    lines = ["", "---", "### Additional from Naive Search", ""]
    for rank, (chunk, score) in enumerate(results):
        lines.append(f"Naive #{rank+1} (similarity: {score:.4f})")
        lines.append(chunk)
        lines.append("")
    return "\n".join(lines)


# ─── Original searches (internal helpers, NOT @tool) ───

# (local_search, global_search, naive_search are defined below as plain functions)


def local_search_hybrid(query: str, top_k: int = 10) -> str:
    """Search knowledge graph entities/relationships and append relevant raw passages.
    Combines graph-based local search (entities + BFS neighbors) with semantic
    passage retrieval for richer context.
    Best for: specific factual questions (e.g. "graduation conditions").

    Args:
        query: The user's question in natural language.
        top_k: Max related entities (default 10).
    """
    _ensure_loaded()
    G = _G
    q = query.lower()
    qw = set(q.split())

    # Use keyword index for O(1) candidate lookup instead of scanning all 573 nodes
    candidates: set[str] = set()
    for w in qw:
        candidates |= _entity_word_index.get(w, set())

    matched = []
    if candidates:
        for node in candidates:
            data = G.nodes[node]
            score = sum(3 for w in qw if w in node.lower())
            score += sum(1 for w in qw if w in data.get("description", "").lower())
            if score > 0:
                matched.append((score, node, data))
    if not matched:
        # Fallback: search all nodes only when index returns nothing
        for node, data in G.nodes(data=True):
            matched.append((0, node, data))
    matched.sort(key=lambda x: -x[0])
    seeds = matched[:5]

    visited, nodes, edges = set(), {}, []
    for _, n, d in seeds:
        if n not in visited:
            visited.add(n)
            nodes[n] = d
    for n in list(nodes.keys())[:5]:
        for nb in G.neighbors(n):
            if len(nodes) >= top_k:
                break
            if nb not in visited:
                visited.add(nb)
                nodes[nb] = G.nodes[nb]
            ed = G.get_edge_data(n, nb)
            edges.append({
                "source": n, "target": nb,
                "desc": ed.get("description", ""),
                "weight": ed.get("weight", 0),
            })

    lines = [f"## Local Search (hybrid): '{query}'", f"Found {len(nodes)} entities\n"]
    lines.append("### Entities")
    for name, d in sorted(nodes.items(), key=lambda x: -x[1].get("frequency", 0)):
        lines.append(f"- **{name}** [{d.get('type', 'N/A')}]")
        lines.append(f"  {d.get('description', '')[:200]}")
    lines.append("\n### Relationships")
    for e in sorted(edges, key=lambda x: -x["weight"])[:10]:
        lines.append(f"- {e['source']} --> {e['target']}")
        lines.append(f"  {e['desc'][:200]}")

    # Append naive search results
    naive_part = _format_naive_section(query)
    if naive_part:
        lines.append(naive_part)
    return "\n".join(lines)


def global_search_hybrid(query: str, top_k: int = 5) -> str:
    """Search community reports and append relevant raw passages.
    Combines graph-based global search (community summaries) with semantic
    passage retrieval for richer context.
    Best for: broad thematic questions (e.g. "training regulations overview").

    Args:
        query: The user's question in natural language.
        top_k: Max community reports (default 5).
    """
    _ensure_loaded()
    q = query.lower()
    qw = set(q.split())
    scored = []
    for _, row in _reports_df.iterrows():
        text = f"{row['title']} {row['summary']} {row['full_content']}".lower()
        score = sum(1 for w in qw if w in text)
        if score > 0:
            scored.append((score, row))
    if not scored:
        scored = [(0, row) for _, row in _reports_df.iterrows()]
    scored.sort(key=lambda x: -x[0])

    lines = [f"## Global Search (hybrid): '{query}'", f"Found {len(scored)} reports\n"]
    for score, row in scored[:top_k]:
        lines.append(f"---\n### {row['title']}")
        lines.append(f"**Rank**: {row['rank']} | **Level**: {row['level']}\n")
        lines.append(f"**Summary**: {row['summary'][:500]}")
        findings = row.get("findings", [])
        if isinstance(findings, list) and findings:
            lines.append("\n**Key Findings:**")
            for f in findings[:5]:
                txt = f.get("summary", str(f)) if isinstance(f, dict) else str(f)
                lines.append(f"- {txt[:200]}")
        lines.append("")

    # Append naive search results
    naive_part = _format_naive_section(query)
    if naive_part:
        lines.append(naive_part)
    return "\n".join(lines)


# ═══════════════════════════════════════════════════
#  Naive Search — FAISS + cosine similarity
#  No graph, just chunk → embed → similarity
# ═══════════════════════════════════════════════════

def _chunk_text(text: str, chunk_size: int = 200, overlap: int = 30) -> list[str]:
    """Split text into overlapping chunks by word count (sentence-aware)."""
    import re
    # Split by sentence boundaries first
    sentences = re.split(r'(?<=[.?!])\s+', text.replace('\n', ' '))
    sentences = [s.strip() for s in sentences if s.strip()]
    chunks = []
    buffer = []
    buf_words = 0
    for s in sentences:
        sw = len(s.split())
        if buf_words + sw > chunk_size and buffer:
            chunks.append(' '.join(buffer))
            # Keep last `overlap` words as overlap
            overlap_words = []
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
        chunks.append(' '.join(buffer))
    return chunks


def _ensure_naive_index():
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
        # Detect GPU for sentence-transformers
        _use_gpu = _faiss_has_gpu
        try:
            import torch
            _use_gpu = torch.cuda.is_available()
            if _use_gpu:
                print(f"  GPU detected: {torch.cuda.get_device_name(0)}")
        except ImportError:
            _use_gpu = False
        _naive_index = _move_index_to_gpu(cpu_index) if _use_gpu else cpu_index
        return

    _use_gpu = _faiss_has_gpu
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
    """(internal) Search by cosine similarity via FAISS."""
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


def warmup():
    """Pre-load heavy resources (graph cache, FAISS index, embeddings model)
    at startup so the first request is fast."""
    import time
    t0 = time.time()
    print("Warming up GraphRAG resources...")
    _ensure_loaded()
    _ensure_naive_index()
    print(f"Warmup complete in {time.time()-t0:.1f}s")
