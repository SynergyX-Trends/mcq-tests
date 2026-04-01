#!/bin/bash
# Project-local session start hook
# Fires ONCE at SessionStart — not on every prompt.
# Register under "SessionStart" in settings.json, NOT "UserPromptSubmit".
#
# If CLAUDE.md or primer.md are in default/placeholder state,
# Claude is instructed to initialize them before doing anything else.

PROJECT_DIR="$(pwd)"
PRIMER="$PROJECT_DIR/.claude/primer.md"
CLAUDE_MD="$PROJECT_DIR/.claude/CLAUDE.md"
CONFIG="$PROJECT_DIR/.claude/config.sh"

[ -f "$CONFIG" ] && source "$CONFIG"

# --- Default state detection ---

CLAUDE_DEFAULT=false
PRIMER_DEFAULT=false

if [ -f "$CLAUDE_MD" ]; then
  if grep -qE '\[PROJECT NAME\]|\[Brief one-line description\]|\[Label\]|/path/to/your/project' "$CLAUDE_MD" 2>/dev/null; then
    CLAUDE_DEFAULT=true
  fi
fi

if [ -f "$PRIMER" ]; then
  if grep -qE '\[PROJECT NAME\]|\[One sentence\. Single next action only\.\]|nothing yet' "$PRIMER" 2>/dev/null; then
    PRIMER_DEFAULT=true
  fi
fi

# --- If either file is uninitialized, block and prompt ---

if [ "$CLAUDE_DEFAULT" = "true" ] || [ "$PRIMER_DEFAULT" = "true" ]; then
  echo "## INITIALIZATION REQUIRED — Do not proceed with any task until complete."
  echo ""
  echo "The following files contain unfilled placeholders and must be initialized first:"
  echo ""

  if [ "$CLAUDE_DEFAULT" = "true" ]; then
    echo "### CLAUDE.md needs setup"
    echo "Fill in all [placeholder] values:"
    echo "- [PROJECT NAME] — name of this project"
    echo "- Root path — absolute path to project root"
    echo "- [Brief one-line description] — what this project does"
    echo "- [Label] / key file paths — important files Claude should know about"
    echo "- Skills Used — any custom skills active in this project"
    echo ""
  fi

  if [ "$PRIMER_DEFAULT" = "true" ]; then
    echo "### primer.md needs setup"
    echo "Fill in:"
    echo "- [PROJECT NAME] — same name as CLAUDE.md"
    echo "- Exact Next Step — the single next action for this project right now"
    echo "- Open Blockers — anything currently blocked (or write 'none')"
    echo ""
  fi

  echo "### Instructions for Claude"
  echo "1. Ask the user the questions needed to fill in the missing values."
  echo "2. Write the completed files to disk."
  echo "3. Confirm both files are saved."
  echo "4. Only then proceed with the user's actual task."
  echo ""
  echo "---"
  echo ""
fi

# --- Inject primer (even if partial — Claude will fix it) ---

if [ -f "$PRIMER" ]; then
  echo "## Project State (primer.md)"
  cat "$PRIMER"
  echo ""
fi

# --- Git context (opt-in) ---

if [ "${GIT_CONTEXT:-false}" = "true" ]; then
  if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "## Git Status"
    echo "**Branch:** $(git branch --show-current 2>/dev/null)"
    MODIFIED=$(git status --short 2>/dev/null)
    if [ -n "$MODIFIED" ]; then
      echo "**Modified files:**"
      echo "$MODIFIED"
    fi
    echo ""
  fi
fi

exit 0
