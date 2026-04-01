#!/bin/bash
# Project-local pre-action gate
# Checks project gates.json first, then falls back to global ~/.claude/gates.json
# Runs out-of-band — adds ZERO tokens to Claude's context window.
# Exit 0 = allow, Exit 2 = block

PROJECT_DIR="$(pwd)"
PROJECT_GATES="$PROJECT_DIR/.claude/gates.json"
GLOBAL_GATES="$HOME/.claude/gates.json"

INPUT=$(cat)

check_gates() {
  local gates_file="$1"
  [ ! -f "$gates_file" ] && return

  RESULT=$(echo "$INPUT" | python3 -c "
import json, sys, re, os

try:
    hook_input = json.load(sys.stdin)
except:
    sys.exit(0)

tool       = hook_input.get('tool_name', '')
tool_input = json.dumps(hook_input.get('tool_input', {}))

with open('$gates_file') as f:
    gates = json.load(f)

for gate in gates.get('gates', []):
    if not gate.get('enabled', True):
        continue
    tool_pattern = gate.get('tool', '*')
    if tool_pattern != '*' and tool_pattern != tool:
        if not re.search(tool_pattern, tool):
            continue
    input_pattern = gate.get('pattern', '')
    if input_pattern and not re.search(input_pattern, tool_input, re.IGNORECASE):
        continue
    level   = gate.get('level', 'warn')
    message = gate.get('message', 'Blocked by gate')
    if level == 'block':
        print(f'BLOCK|{message}')
    elif level == 'warn':
        print(f'WARN|{message}')
    sys.exit(0)
" 2>/dev/null)

  ACTION=$(echo "$RESULT" | cut -d'|' -f1)
  MESSAGE=$(echo "$RESULT" | cut -d'|' -f2-)

  if [ "$ACTION" = "BLOCK" ]; then
    echo "GATE BLOCKED: $MESSAGE" >&2
    exit 2
  elif [ "$ACTION" = "WARN" ]; then
    echo "GATE WARNING: $MESSAGE" >&2
  fi
}

check_gates "$PROJECT_GATES"
check_gates "$GLOBAL_GATES"

exit 0
