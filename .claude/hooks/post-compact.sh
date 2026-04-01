#!/bin/bash
# Project-local post-compact hook
# Re-injects ONLY the primer after context compaction.
# Gates are interceptors — they don't belong in Claude's context window.

PROJECT_DIR="$(pwd)"
PRIMER="$PROJECT_DIR/.claude/primer.md"

echo "## Post-Compaction Re-injection"
echo ""

if [ -f "$PRIMER" ]; then
  echo "### Project State (re-injected after /compact)"
  cat "$PRIMER"
  echo ""
fi

exit 0
