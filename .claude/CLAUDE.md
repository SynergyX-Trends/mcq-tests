# PROJECT-SPECIFIC: Sylvi MCQ Tests

## PREFERENCES

- One clear next action per response, not a list
- Flag anything uncertain with [UNCLEAR]
- Remind me to commit at session end

## AGENT RULES

- If session-start output says "INITIALIZATION REQUIRED": ask the user for missing project details, write both files to disk, confirm saved — then and only then proceed
- primer.md is injected at session start — do not re-read it unless asked
- Keep primer.md under 30 lines
- After completing any task, update ./.claude/primer.md with: active project state, what's been completed, exact next step, open blockers
- Before closing, check for uncommitted changes and remind me to commit
- When context reaches 70%, rewrite ./.claude/primer.md and tell me to run /compact

## PROJECT STRUCTURE

- **Root:** /Applications/MAMP/htdocs/mcq-tests/
- **Hosted:** GitHub Pages (static site, no backend)
- **This project:** Internal MCQ induction tests for Sylvi employees, filterable by department (Tech / CRM)
- **Skills Used:** none

## KEY FILES

- Landing page: `index.html`
- Test runner: `pages/test.html`
- App logic: `assets/app.js`
- Styles: `assets/app.css`
- Department registry: `data/departments.json`
- Tech tests metadata: `data/tech/tests.json`
- CRM tests metadata: `data/crm/tests.json`
- Apps Script (Google Sheets): `code.gs`

## DATA STRUCTURE

```
data/
  departments.json        ← [{ id, label }] — add new dept here
  tech/
    tests.json            ← test metadata for tech
    day_01.json … day_20.json
  crm/
    tests.json            ← test metadata for crm
    day_01.json … day_20.json  (question files to be added)
```

## SUBMISSION FLOW

- Frontend POSTs URL-encoded payload to Google Apps Script
- Payload fields: employeeId, fullName, department, testId, startedAt, submittedAt, timeTakenSeconds, answers (JSON), marked (JSON), userAgent, source
- Apps Script scores against authoritative JSON fetched from GitHub Pages URL, writes to "Response Score" sheet
- `code.gs` `parseIncoming_()` must map all payload fields — common bug: missing field in return object causes silent empty value in sheet

## WORKFLOW

- Enter plan mode for any non-trivial task (3+ steps)
- Commit at logical checkpoints
- Never mark task complete without proof
