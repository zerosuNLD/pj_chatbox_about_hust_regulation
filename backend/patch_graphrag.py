#!/usr/bin/env python3
"""Patch GraphRAG community_reports_extractor to work without response_format (for DeepSeek compatibility)."""

import sys

target = "/home/duy/miniconda3/lib/python3.13/site-packages/graphrag/index/operations/summarize_communities/community_reports_extractor.py"

with open(target, "r") as f:
    content = f.read()

# Add json import
content = content.replace(
    "import logging\nimport traceback",
    "import json\nimport logging\nimport traceback",
)

# Replace the response_format call with manual JSON parsing
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
    print("PATCH: Replaced response_format call")
else:
    print("WARNING: Could not find response_format call - may already be patched")

with open(target, "w") as f:
    f.write(content)

print("Patch applied successfully.")

# Verify
with open(target, "r") as f:
    verify = f.read()
ok = "response_format=CommunityReportResponse" not in verify and "model_validate_json" in verify
print(f"VERIFY: {'OK' if ok else 'FAILED'}")
sys.exit(0 if ok else 1)
