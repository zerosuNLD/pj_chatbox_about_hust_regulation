#!/usr/bin/env python3
"""
Complete GraphRAG setup → index pipeline for HUST training data.
Works on any machine including Google Colab.
Usage:
    python3 graphrag_workflow.py --data /path/to/book.txt
    
    Or export env vars first:
    export DEEPSEEK_API_KEY=sk-xxx
    export GRAPHRAG_API_KEY=cf_xxx  # Cloudflare API key
    export DATA_FILE=/path/to/book.txt
    python3 graphrag_workflow.py
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import textwrap


def run(cmd: str, check: bool = True) -> str:
    """Run a shell command and return stdout."""
    print(f"\n  $ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=False, text=True)
    if check and result.returncode != 0:
        print(f"  ❌ Command failed (exit code {result.returncode})")
        sys.exit(result.returncode)
    return result.stdout or ""


def main():
    parser = argparse.ArgumentParser(description="GraphRAG end-to-end workflow")
    parser.add_argument("--data", "-d", default=os.environ.get("DATA_FILE", ""),
                        help="Path to input text file (or set DATA_FILE env)")
    parser.add_argument("--work-dir", default="graphrag_project",
                        help="Working directory (default: graphrag_project)")
    parser.add_argument("--deepseek-key", default=os.environ.get("DEEPSEEK_API_KEY", ""),
                        help="DeepSeek API key (or set DEEPSEEK_API_KEY env)")
    parser.add_argument("--cloudflare-key", default=os.environ.get("GRAPHRAG_API_KEY", ""),
                        help="Cloudflare API key (or set GRAPHRAG_API_KEY env)")
    args = parser.parse_args()

    # ── Validation ──────────────────────────────────────────────
    if not args.data:
        print("❌  Missing input data. Use --data /path/to/book.txt or set DATA_FILE env.")
        sys.exit(1)
    if not os.path.isfile(args.data):
        print(f"❌  File not found: {args.data}")
        sys.exit(1)
    if not args.deepseek_key:
        print("❌  Missing DEEPSEEK_API_KEY. Use --deepseek-key or set env var.")
        sys.exit(1)
    if not args.cloudflare_key:
        print("❌  Missing GRAPHRAG_API_KEY. Use --cloudflare-key or set env var.")
        sys.exit(1)

    work_dir = os.path.abspath(args.work_dir)
    T = lambda msg: print(f"\n{'='*60}\n  {msg}\n{'='*60}")

    # ── 1. Install GraphRAG ─────────────────────────────────────
    T("1/7  Install GraphRAG")
    run("pip install -q graphrag")

    # ── 2. Create project directory ─────────────────────────────
    T("2/7  Initialize GraphRAG project")
    os.makedirs(work_dir, exist_ok=True)
    os.chdir(work_dir)
    run("python3 -m graphrag init --root .")

    # ── 3. Copy input data ──────────────────────────────────────
    T("3/7  Copy input data")
    os.makedirs("input", exist_ok=True)
    shutil.copy2(args.data, "input/")

    # ── 4. Write settings.yaml ──────────────────────────────────
    T("4/7  Configure settings.yaml")
    settings = textwrap.dedent("""\
    ### This config file contains required core defaults for HUST training regulations

    completion_models:
      default_completion_model:
        model_provider: openai
        model: deepseek-v4-flash
        auth_method: api_key
        api_key: ${DEEPSEEK_API_KEY}
        api_base: https://api.deepseek.com/v1
        temperature: 0
        retry:
          type: exponential_backoff

    embedding_models:
      default_embedding_model:
        model_provider: openai
        model: "@cf/baai/bge-m3"
        auth_method: api_key
        api_key: ${GRAPHRAG_API_KEY}
        api_base: https://api.cloudflare.com/client/v4/accounts/1476e402101a2033be35350d2a2db2df/ai/v1
        retry:
          type: exponential_backoff

    input:
      type: text

    chunking:
      type: tokens
      size: 800
      overlap: 100
      encoding_model: o200k_base

    input_storage:
      type: file
      base_dir: "input"

    output_storage:
      type: file
      base_dir: "output"

    reporting:
      type: file
      base_dir: "logs"

    cache:
      type: json
      storage:
        type: file
        base_dir: "cache"

    vector_store:
      type: lancedb
      db_uri: output/lancedb

    embed_text:
      embedding_model_id: default_embedding_model

    extract_graph:
      completion_model_id: default_completion_model
      prompt: "prompts/extract_graph.txt"
      entity_types: [organization,regulation,program,course,person,credit,degree,condition,deadline]
      max_gleanings: 1

    summarize_descriptions:
      completion_model_id: default_completion_model
      prompt: "prompts/summarize_descriptions.txt"
      max_length: 500

    extract_graph_nlp:
      text_analyzer:
        extractor_type: cfg

    cluster_graph:
      max_cluster_size: 10

    extract_claims:
      enabled: false
      completion_model_id: default_completion_model
      prompt: "prompts/extract_claims.txt"
      description: "Any claims or facts that could be relevant to information discovery."
      max_gleanings: 1

    community_reports:
      completion_model_id: default_completion_model
      graph_prompt: "prompts/community_report_graph.txt"
      text_prompt: "prompts/community_report_text.txt"
      max_length: 2000
      max_input_length: 8000

    snapshots:
      graphml: false
      embeddings: false

    local_search:
      completion_model_id: default_completion_model
      embedding_model_id: default_embedding_model
      prompt: "prompts/local_search_system_prompt.txt"

    global_search:
      completion_model_id: default_completion_model
      map_prompt: "prompts/global_search_map_system_prompt.txt"
      reduce_prompt: "prompts/global_search_reduce_system_prompt.txt"
      knowledge_prompt: "prompts/global_search_knowledge_system_prompt.txt"

    drift_search:
      completion_model_id: default_completion_model
      embedding_model_id: default_embedding_model
      prompt: "prompts/drift_search_system_prompt.txt"
      reduce_prompt: "prompts/drift_search_reduce_prompt.txt"

    basic_search:
      completion_model_id: default_completion_model
      embedding_model_id: default_embedding_model
      prompt: "prompts/basic_search_system_prompt.txt"
    """)
    with open("settings.yaml", "w") as f:
        f.write(settings)

    # ── 5. Write .env with API keys ─────────────────────────────
    T("5/7  Set API keys")
    with open(".env", "w") as f:
        f.write(f"DEEPSEEK_API_KEY={args.deepseek_key}\n")
        f.write(f"GRAPHRAG_API_KEY={args.cloudflare_key}\n")

    # ── 6. Patch GraphRAG for DeepSeek compatibility ────────────
    T("6/7  Patch GraphRAG community_reports_extractor")
    import importlib.util
    spec = importlib.util.find_spec("graphrag.index.operations.summarize_communities.community_reports_extractor")
    if spec is None or spec.origin is None:
        print("❌  Could not find graphrag module. Install check:")
        run("python3 -m pip show graphrag", check=False)
        sys.exit(1)
    target = spec.origin
    with open(target) as f:
        content = f.read()

    content = content.replace(
        "import logging\nimport traceback",
        "import json\nimport logging\nimport traceback",
    )

    old = """            response = await self._model.completion_async(
                messages=prompt,
                response_format=CommunityReportResponse,  # A model is required when using json mode
            )

            output = response.formatted_response  # type: ignore"""

    new = """            response = await self._model.completion_async(
                messages=prompt,
            )

            # Parse JSON manually since DeepSeek doesn't support response_format
            raw_text = response.content
            # Strip markdown code fences if present
            raw_text = raw_text.strip()
            if raw_text.startswith("```"):
                lines = raw_text.split("\\n", 1)
                raw_text = lines[1] if len(lines) > 1 else raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()
            output = CommunityReportResponse.model_validate_json(raw_text)"""

    if old in content:
        content = content.replace(old, new)
        print("  ✅ Patch applied")
    else:
        print("  ⚠️  Could not find original code - may already be patched (skipping)")

    with open(target, "w") as f:
        f.write(content)
    print(f"  Patched: {target}")

    # ── 7. Run indexing ─────────────────────────────────────────
    T("7/7  Run GraphRAG indexing (this will take several minutes)")
    # Create writable temp dir for LanceDB
    tmp_dir = os.path.join(work_dir, ".tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    os.environ["TMPDIR"] = tmp_dir

    result = subprocess.run(
        f"cd {work_dir} && TMPDIR={tmp_dir} DEEPSEEK_API_KEY={args.deepseek_key} GRAPHRAG_API_KEY={args.cloudflare_key} python3 -m graphrag index",
        shell=True, capture_output=False, text=True, timeout=1800
    )

    # ── Summary ──────────────────────────────────────────────────
    T("✅  WORKFLOW COMPLETE")
    print(f"  Project:     {work_dir}")
    print(f"  Input data:  {args.data}")
    print(f"  Output:      {work_dir}/output/")

    import glob
    output_files = glob.glob(os.path.join(work_dir, "output", "*.parquet"))
    print(f"  Files:       {len(output_files)} parquet files")
    for f in sorted(output_files):
        size = os.path.getsize(f) / 1024
        print(f"    - {os.path.basename(f):35s} {size:.0f} KB")

    lancedb_dir = os.path.join(work_dir, "output", "lancedb")
    if os.path.isdir(lancedb_dir):
        indices = os.listdir(lancedb_dir)
        print(f"  Vector DB:   {len(indices)} LanceDB indices: {', '.join(indices)}")

    print()
    if result.returncode == 0:
        print("  🎉  Knowledge graph built successfully!")
    else:
        print("  ⚠️  Pipeline ended with errors — check logs/ for details")


if __name__ == "__main__":
    main()
