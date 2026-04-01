# Project Memory — Sylvi MCQ Tests

## Project Overview
Internal MCQ induction test platform for Sylvi employees. Static site hosted on GitHub Pages. Submissions go to Google Sheets via Apps Script.

---

## Architecture

- **Frontend:** Pure HTML/CSS/JS — no framework, no build step
- **Data:** JSON files in `data/{dept}/` folders
- **Submission:** URL-encoded POST to Google Apps Script (`code.gs`)
- **Scoring:** Apps Script fetches question JSON from GitHub Pages URL to score server-side

---

## Department System

- `data/departments.json` — master list of `[{ id, label }]`. Adding a new department = add entry here + create `data/{id}/tests.json` folder.
- Each department folder contains `tests.json` (metadata array) and individual question JSON files.
- `index.html` shows a department picker first, then the filtered test grid.
- `dept` travels as a URL param (`?testId=day_01&dept=tech`) through the entire flow.

---

## Submission Payload Fields

`employeeId`, `fullName`, `department`, `testId`, `startedAt`, `submittedAt`, `timeTakenSeconds`, `answers` (JSON string), `marked` (JSON string), `userAgent`, `source`

---

## Known Bugs / Watch-outs

- **`parseIncoming_()` in `code.gs`** must explicitly map every payload field in its return object. Fields not listed there will be `undefined` → empty string in the sheet, even if `appendRow` references them. This caused `department` to be blank until fixed.
- Apps Script requires a **new deployment version** after any `doPost` change — saving the script is not enough.
- `getTestJson_()` in `code.gs` fetches from `TEST_JSON_BASE_URL` (GitHub Pages). CRM question files must be pushed to GitHub before submissions can be scored.

---

## File Naming Convention

| Department | tests.json location | Question files |
|------------|---------------------|----------------|
| Tech | `data/tech/tests.json` | `data/tech/day_01.json` … `day_20.json` |
| CRM | `data/crm/tests.json` | `data/crm/day_01.json` … `day_20.json` |
| New dept | `data/{id}/tests.json` | `data/{id}/{testId}.json` |

---

## localStorage Key Format

`mcq:{dept}:{testId}:{IDENTITY}` — changed from old format `mcq:{testId}:{IDENTITY}`. Existing in-progress attempts under the old key will not be found (acceptable for internal tool).
