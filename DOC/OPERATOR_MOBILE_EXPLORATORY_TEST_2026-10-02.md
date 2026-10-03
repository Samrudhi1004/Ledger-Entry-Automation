# Operator Mobile Exploratory Test

Date: 2026-10-02
Environment: Local Flutter Web (`http://localhost:5174/`) with local Django backend
Role: Operator (existing signed-in test session: John)
Status: Exploratory pass completed; follow-up fixes recommended

## Test log

| ID | Area | Action | Expected | Observed | Status |
|---|---|---|---|---|---|
| SETUP-01 | Startup | Open mobile app | App loads to operator home | Operator home loaded; active part shown as `FBT00222` | PASS |
| AUTH-01 | Authentication | Sign in as `operator` | Operator lands on home | Login succeeded and displayed John Operator / active part `FBT00222` | PASS |
| MACHINE-01 | Machine selection | Open Machine and search `CNC` | Results filter to matching machine | List filtered from 4 ready machines to CNC-01 only | PASS |
| FLOW-01 | Inspection setup | Select CNC-01 → FBT00222 → Operation 10 | Operator reaches hourly-slot screen | Part and operation loaded; Slot 1 active and later slots locked | PASS |
| ENTRY-01 | Measurement entry | Open Slot 1 and submit empty value | Empty input is rejected with clear feedback | Submit produced no visible validation message and remained on the same form | FINDING |
| ENTRY-02 | Measurement entry | Submit `105.10` for Total Length | Value is accepted and marked within spec | Recorded as `105.1 mm`; green within-spec state displayed | PASS |
| ENTRY-03 | Measurement entry | Submit `30` for O.D. (allowed 25.30–25.50) | Out-of-spec result is clearly flagged | Red critical state displayed with allowed range and notification badge | PASS |
| RESUME-01 | Resume Entry | Leave partial inspection and open Resume Entry | Previous inspection resumes at the saved state | Resume card appeared and reopened the same part/operation | PASS |
| PROGRESS-01 | Progress display | Compare Resume card and operation slot summary | Counts should be consistent | Home showed `2 of 18 params`, while operation header showed `0/12 done` after two parameter attempts | FINDING |
| REPORT-01 | Daily report | Open Daily Production Report | Report loads with station and shift details | Report loaded with CNC-01, Shift I, target 63, and editable production fields | PASS |
| REPORT-02 | Daily report validation | Set Incorrect Jobs to 1 while Jobs Completed remains 0; submit | Totals mismatch is blocked with explanation | Inline validation explained `Jobs Completed (0) must equal Correct Jobs (0) + Incorrect Jobs (1)` | PASS |
| ALERT-01 | Notifications | Open notification bell after critical result | Supervisor alerts are visible | One unread “1st Piece Setup Authorized” alert opened successfully | PASS |
| MSG-01 | Messages | Open messages, search `Sarah`, open conversation | Search and conversation view work | Search filtered to Sarah Inspector and conversation opened without sending a message | PASS |
| JH-01 | JH Inspection | Open JH Inspection and switch Shift I/II | Shift control changes active state | Shift II selected successfully; labels are rendered in Hindi | PASS |
| DOC-01 | Document Control | Open Documents and Change Requests tabs | Available controlled documents/requests are listed | Both tabs showed “No records found” in the local environment | DATA GAP |
| TASK-01 | Tasks | Open Tasks tab | Assigned tasks are listed | Task list loaded with completed sample tasks and due dates | PASS |
| PROFILE-01 | Account & Profile | Open About, Edit Details, Change Password | Profile dialogs open without saving changes | Profile loaded; both dialogs opened and were dismissed | PASS |

## Findings

1. **ENTRY-01 — Empty measurement submission has no visible validation feedback.** Repro: open Machine → CNC-01 → FBT00222 → Operation 10 → Slot 1 → Submit with the measurement blank. The app stays on the form but does not show a required-field message. This is a usability/validation finding.
2. **PROGRESS-01 — Inspection progress counts are inconsistent.** After recording one in-spec and one out-of-spec parameter, the home Resume card displayed `2 of 18 params`, while the operation screen displayed `0/12 done`. Confirm whether these counters represent different scopes or whether one is stale.
3. **DOC-01 — Document Control has no local records.** Documents and DCR queues both display an empty state. Confirm whether seed data is intentionally absent or whether the operator should have access to approved SOPs/work instructions before deployment.
4. Flutter Web DevTools showed discarded `flutter/lifecycle` channel messages. These were runtime warnings only during this pass; no user-visible failure was tied to them.

## Notes

- This is an exploratory run; any records submitted during the test must be treated as test data.
- Each additional scenario will be added to the test log with reproduction details.
