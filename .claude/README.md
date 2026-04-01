# .claude/ — Project Recall Stack

This directory provides **project-local memory and rules** for Claude Code. It auto-loads when you open Claude Code inside this project folder.

## Files

| File            | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `CLAUDE.md`     | Project rules, structure, preferences — read by Claude on every session |
| `primer.md`     | Auto-updating project state: last action, next step, open blockers      |
| `gates.json`    | Pre-action safety gates — blocks or warns on dangerous patterns         |
| `config.sh`     | Opt-in flags for hooks (e.g. GIT_CONTEXT=true)                          |
| `lessons.md`    | Mistake log — entries auto-promote to warning gates after 3 occurrences |
| `failures.json` | Auto-generated: tracks lesson frequency, managed by session-end.sh      |
| `settings.json` | Hook registrations for Claude Code                                      |
| `hooks/`        | Shell scripts that fire at session start/end and before/after actions   |
| `skills/`       | Custom slash-command skills for this project                            |

## How It Works

1. **Auto-load:** Claude Code reads `.claude/CLAUDE.md` automatically when you `cd` into this project.
2. **Initialization guard:** On first session, `session-start.sh` detects unfilled placeholders in `CLAUDE.md` and `primer.md` and prompts Claude to initialize them before doing anything else.
3. **State persistence:** After every task Claude rewrites `primer.md` — so if you close mid-session, state is never lost.
4. **Safety gates:** `gates.json` + `hooks/pre-action-gate.sh` intercept tool calls matching dangerous patterns before they execute.
5. **Context recovery:** After `/compact`, `hooks/post-compact.sh` re-injects the primer so Claude doesn't lose context.
6. **Self-learning:** Log mistakes in `lessons.md`. After 3 occurrences of the same mistake, `session-end.sh` auto-adds a warning gate.
7. **Skills:** Drop a folder with a `SKILL.md` inside `skills/` and it becomes a `/skill-name` slash command.

## Hook Trigger Map

| Hook                 | Trigger        | Adds tokens? |
| -------------------- | -------------- | ------------ |
| `session-start.sh`   | SessionStart   | Yes (once)   |
| `pre-action-gate.sh` | PreToolUse     | No           |
| `session-end.sh`     | PostToolUse    | No           |
| `post-compact.sh`    | After /compact | Yes (once)   |

## Global vs. Project-Local

| Layer         | Path         | Scope                        |
| ------------- | ------------ | ---------------------------- |
| Global        | `~/.claude/` | All projects on this machine |
| Project-local | `./.claude/` | This project only            |

Project-local rules and gates **override** globals where they conflict.

## Customising for a New Project

See `IMPLEMENTATION_GUIDE.md` in the project root.
