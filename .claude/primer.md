# Active Project: Sylvi MCQ Tests

## Completed This Session

- Added department selection flow (picker screen → filtered test grid)
- Created `data/departments.json` as department registry
- Moved all test files into `data/tech/` and `data/crm/` folders
- Updated `index.html`: department picker first, then tests grid with "Change Department" button
- Updated `app.js`: reads `dept` from URL, includes in localStorage key, payload, attemptId, back-links, header
- Added department badge to `test.html` screenGate
- CRM `tests.json` populated with 20 days of test metadata (question files still to be added)
- Fixed `code.gs` bug: `parseIncoming_()` was missing `department` field — confirmed fix needed, user to re-deploy

## Exact Next Step

Add CRM question JSON files (`data/crm/day_01.json` … `day_20.json`) matching the existing schema, then commit all changes.

## Open Blockers

- Apps Script re-deploy needed after adding `department` to `parseIncoming_()` in `code.gs`
- CRM question JSON files not yet created (metadata in tests.json is ready)
- All frontend changes are uncommitted
