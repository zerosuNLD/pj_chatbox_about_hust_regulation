#!/bin/bash
# =============================================================================
# HUST Q&A Backend — Docker Entrypoint
# =============================================================================
# Runs on container startup:
#   1. Generate input/book.txt from dieu_*.txt (if missing)
#   2. Build FAISS naive search index (if missing, ~30-60s, no API needed)
#   3. Start FastAPI server
# =============================================================================

set -e

echo ""
echo "========================================================"
echo "   🎓 HUST Q&A Backend — Starting Up"
echo "========================================================"

# ── Step 1: Generate book.txt from dieu_*.txt if needed ──────────────────────
if [ ! -f "input/book.txt" ]; then
    echo ""
    echo "📚 [1/3] Generating input/book.txt from regulation files..."
    cat input/dieu_*.txt > input/book.txt
    SIZE=$(wc -c < input/book.txt)
    echo "   ✅ Done: ${SIZE} bytes written to input/book.txt"
else
    echo "📚 [1/3] input/book.txt already exists — skipping."
fi

# ── Step 2: Build FAISS naive index if needed ─────────────────────────────────
if [ ! -f "output/naive_index/index.faiss" ]; then
    echo ""
    echo "🔍 [2/3] Building FAISS search index (first-time setup, ~30-60 seconds)..."
    echo "   No API key needed — uses local sentence-transformers model."
    python3 -c "
from graphrag_tools import _ensure_naive_index
_ensure_naive_index()
print('   ✅ FAISS index built and saved to output/naive_index/')
"
else
    echo "🔍 [2/3] FAISS index already exists — skipping."
fi

# ── Step 3: Start FastAPI server ─────────────────────────────────────────────
echo ""
echo "🚀 [3/3] Starting FastAPI server on http://0.0.0.0:8000"
echo "========================================================"
echo ""
exec python3 server.py
