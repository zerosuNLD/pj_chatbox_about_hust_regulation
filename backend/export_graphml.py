#!/usr/bin/env python3
"""Export rich GraphML from GraphRAG relationships with descriptions and direction."""
"""
Cách chạy:  python export_graphml.py > output/rich_graph.graphml
"""


import pandas as pd
import sys
from xml.sax.saxutils import escape

rels = pd.read_parquet("output/relationships.parquet")

print('<?xml version="1.0" encoding="UTF-8"?>')
print('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"')
print('         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
print('         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns')
print('         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">')

# Attribute definitions
print('  <key id="d_weight" for="edge" attr.name="weight" attr.type="double"/>')
print('  <key id="d_description" for="edge" attr.name="description" attr.type="string"/>')
print('  <key id="d_type" for="node" attr.name="type" attr.type="string"/>')
print('  <key id="d_description" for="node" attr.name="description" attr.type="string"/>')

# Collect all nodes with their types from entities
entities = pd.read_parquet("output/entities.parquet")
entity_map = dict(zip(entities["title"], entities["type"]))
entity_desc = dict(zip(entities["title"], entities["description"]))

print('  <graph id="G" edgedefault="directed">')

# Nodes with type and description
for _, row in entities.iterrows():
    title = escape(str(row["title"]))
    etype = escape(str(row["type"]))
    desc = escape(str(row.get("description", ""))[:200])
    print(f'    <node id="{title}">')
    print(f'      <data key="d_type">{etype}</data>')
    print(f'      <data key="d_description">{desc}</data>')
    print(f'    </node>')

# Edges with description and weight
for _, row in rels.iterrows():
    src = escape(str(row["source"]))
    tgt = escape(str(row["target"]))
    desc = escape(str(row.get("description", ""))[:500])
    weight = row.get("weight", 1.0)
    print(f'    <edge source="{src}" target="{tgt}">')
    print(f'      <data key="d_weight">{weight}</data>')
    print(f'      <data key="d_description">{desc}</data>')
    print(f'    </edge>')

print('  </graph>')
print('</graphml>')
