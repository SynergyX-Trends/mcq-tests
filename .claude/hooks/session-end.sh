#!/bin/bash
# Project-local session end hook
# Tracks lessons.md entries into failures.json and auto-promotes repeated mistakes
# to warning gates in gates.json after 3 occurrences.
# Runs out-of-band — adds ZERO tokens to Claude's context window.

PROJECT_DIR="$(pwd)"
FAILURES_FILE="$PROJECT_DIR/.claude/failures.json"
GATES_FILE="$PROJECT_DIR/.claude/gates.json"

[ ! -f "$GATES_FILE" ] && exit 0
[ ! -f "$FAILURES_FILE" ] && echo '{"failures":{}}' > "$FAILURES_FILE"

python3 << PYEOF
import json, re, os, sys

project_dir   = os.environ.get("PWD", os.getcwd())
failures_file = os.path.join(project_dir, ".claude", "failures.json")
gates_file    = os.path.join(project_dir, ".claude", "gates.json")
lessons_file  = os.path.join(project_dir, ".claude", "lessons.md")

if not os.path.exists(lessons_file):
    sys.exit(0)

try:
    with open(failures_file) as f:
        data = json.load(f)
except:
    data = {"failures": {}}

try:
    with open(gates_file) as f:
        gates = json.load(f)
except:
    sys.exit(0)

changed = False
try:
    with open(lessons_file) as f:
        lines = f.readlines()
except:
    sys.exit(0)

for line in lines:
    m = re.match(r'\[([^\]]+)\]\s*\|\s*(.+?)\s*\|\s*(.+)', line.strip())
    if not m:
        continue
    lesson_date, mistake, rule = m.groups()
    key = re.sub(r'[^a-z0-9 ]', '', rule.lower()).strip()[:50]
    if not key:
        continue
    if key not in data["failures"]:
        data["failures"][key] = {"count": 0, "rule": rule.strip(), "mistake": mistake.strip(), "promoted": False}
    data["failures"][key]["count"] += 1
    changed = True

    # Auto-promote to warning gate after 3 occurrences
    if data["failures"][key]["count"] >= 3 and not data["failures"][key]["promoted"]:
        gate_name = "auto-" + key.replace(" ", "-")[:30]
        existing = [g for g in gates.get("gates", []) if g.get("name") == gate_name]
        if not existing:
            gates["gates"].append({
                "name": gate_name,
                "tool": "*",
                "pattern": "",
                "level": "warn",
                "message": "Repeated mistake (3x): " + rule.strip()[:80],
                "enabled": True,
                "auto": True
            })
            data["failures"][key]["promoted"] = True

if changed:
    with open(failures_file, 'w') as f:
        json.dump(data, f, indent=2)
    with open(gates_file, 'w') as f:
        json.dump(gates, f, indent=2)

PYEOF

exit 0
