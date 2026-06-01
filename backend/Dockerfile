# =============================================================================
# HUST Q&A — Backend Dockerfile
# Base: python:3.11-slim
# =============================================================================

FROM python:3.11-slim

# Avoid interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# ── System deps ───────────────────────────────────────────────────────────────
# libgomp1: required by faiss-cpu for OpenMP threading
# curl: used by docker-compose healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy requirements first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Pre-download SentenceTransformer model ────────────────────────────────────
# This bakes the model into the image so no internet access is needed at runtime
RUN python3 -c "\
from sentence_transformers import SentenceTransformer; \
print('Downloading all-MiniLM-L6-v2...'); \
SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); \
print('Model downloaded successfully.')"

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# Ensure entrypoint is executable
RUN chmod +x entrypoint.sh

# ── Expose port ───────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Entrypoint ────────────────────────────────────────────────────────────────
ENTRYPOINT ["bash", "entrypoint.sh"]
