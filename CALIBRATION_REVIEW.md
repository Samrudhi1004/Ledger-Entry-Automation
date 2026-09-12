# Calibration module review

Reviewed: 9 September 2026. Scope: calibration dashboard, equipment registry and editing, plan, result/repair/scrap workflow, history/certificates, report code, validation, and shared UI only where calibration uses it.

## Review status and evidence

This is a report, not an implementation. Existing application changes were left intact. No equipment, plans, results, or account settings were intentionally changed in the running application.

- Current local source, including the recent uncommitted calibration changes, reviewed.
- Backend: `manage.py test apps.calibration --keepdb` — **19 tests passed**.
- Frontend: `node --test src/utils/calibrationData.test.js` — **2 tests passed**.
- Targeted lint for calibration page, views, fields, and utility — **passed**.
- Additional isolated probes used mocked database queries, without saving records. They reproduced incorrect plan/result matching, future registration dates being accepted, arbitrary history card numbers being accepted, and date overflow exceptions.
- Browser authentication at `http://localhost:5173` failed with “No active account found with the given credentials.” A direct request to the configured local backend (`127.0.0.1:8000`) independently returned the same HTTP 401. The user reports that Chrome login works; the exact working URL is still needed to resolve the environment/account mismatch.
- Consequently, authenticated desktop/mobile interaction, visual contrast measurements, printed-page rendering, and end-to-end submissions are **not browser-verified in this review**. UI recommendations below are grounded in the current components, CSS, and the screenshots supplied in this conversation. A passing test suite does not establish that these untested workflows are correct.

## Changes to apply first

### 1. P1 — Match calibration results to the correct plan entry

**Evidence:** [views.py:66](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:66).

`_calibration_plan_rows` selects the nearest available actual date for each plan row rather than using the result's recorded planned date or a plan-entry relationship. An isolated example with January and September plans and only a September result returned:

| Planned date | Actual date shown | Result shown |
|---|---|---|
| 2026-01-01 | 2026-09-01 | Accepted |
| 2026-09-01 | none | Planned |

This makes reports and unresolved-plan filters misleading. The PDF's month filter is applied before matching, so changing export filters can also change which plan receives a result.

**Apply:** associate a result explicitly with its plan entry; preserve the scheduled-date snapshot. Define how rejection and subsequent recalibration attempts belong to the same cycle. Match results before applying presentation filters. Verify multi-cycle, rejected-then-accepted, and year-boundary examples.

### 2. P1 — Stop recreating removed or rescheduled plan entries on page load

**Evidence:** [views.py:303](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:303), [views.py:364](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:364).

Every plan GET recreates an active instrument's next-due entry if missing. Remove that entry and reopen the plan: it is recreated. Reschedule it and the original date can be recreated alongside the new date. Merely viewing a report changes the database. PDF GET uses a different path and does not perform this repair.

**Apply:** keep initial scheduling in registration and accepted-result transactions. Repair legacy missing entries once through a controlled migration/repair operation. Preserve deliberate removal/rescheduling, or replace removal with an explicit cancellation state if audit history is required. Do not reconstruct plans during reads.

This issue was introduced by the earlier read-time backfill change and needs correction.

### 3. P1 — Keep equipment due dates, plans, and recorded results consistent

**Evidence:** [serializers.py:47](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/serializers.py:47), [views.py:151](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:151), [views.py:181](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:181).

Editing equipment recalculates its due date without updating its unresolved plan. Editing a plan does not update the equipment's due date. Recording a result takes the equipment's next due date, irrespective of which manually scheduled plan is being fulfilled. Dashboard reminders and the annual plan can therefore disagree, and the result can record the wrong scheduled date.

**Apply:** define one scheduling rule and one controlled reschedule operation. Update only unresolved schedule state, preserve completed history, and let users record a result against the applicable plan. Restrict edits to last-calibration dates once recorded history exists, or provide an audited correction flow.

### 4. P1 — Validate calibration chronology and supported date ranges

**Evidence:** [serializers.py:47](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/serializers.py:47), [serializers.py:68](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/serializers.py:68), [views.py:203](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:203), [calibrationData.js:133](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/utils/calibrationData.js:133).

Isolated probes confirmed that registration accepts a last-calibration date in 2099, and the result serializer accepts an old date without checking equipment history. The result handler then replaces the current last-calibration/due dates, so an old entry can roll current state backward. Frequency `2147483647` causes Python `OverflowError` and JavaScript `RangeError` instead of a usable validation message. Calculated dates can also fall outside the plan's supported years 2000–2100.

**Apply:** reject future last-calibration dates; validate chronology against the instrument's latest result; handle legitimate historical imports separately; validate frequency and the resulting date in both layers. Return field errors rather than exceptions.

## Workflow, identity, and reporting defects

### 5. P2 — Keep history card numbers generated, stable, and consistent

**Evidence:** [CalibrationPage.jsx:165](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:165), [CalibrationFields.jsx:1](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/components/calibration/CalibrationFields.jsx:1), [serializers.py:43](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/serializers.py:43), [models.py:46](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/models.py:46).

The popup preview is read-only, but the edit form still allows manual history-card changes and the API accepts a client-supplied value. Changing the equipment ID in the edit form also rewrites the card number. Whitespace is trimmed from the equipment ID by the API, but the client builds the preview from untrimmed input. Existing blank cards have no backfill; the model's generated value is not persisted by saves whose `update_fields` omit it.

**Apply:** normalize the equipment ID before previewing it. Generate and validate the authoritative number on the backend, return it after saving, display it read-only everywhere, and preserve it after issuance. Backfill only missing legacy values and check for existing collisions.

### 6. P2 — Finish duplicate-ID validation in all entry paths

**Evidence:** [CalibrationPage.jsx:116](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:116), [CalibrationPage.jsx:179](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:179), [serializers.py:22](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/serializers.py:22), [models.py:14](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/models.py:14).

The edit form's client check does not exclude the equipment being edited, so restoring its own ID triggers a false duplicate warning. Direct loading of `/calibration/equipment/new` skips fetching equipment, so immediate checking is absent there. Backend case-insensitive validation exists, but the database unique field is case-sensitive on PostgreSQL; concurrent registrations with different casing can both pass validation. This concurrency risk was identified in code, not exercised against live data.

**Apply:** normalize once, exclude the current record, use one registration entry path, and enforce normalized uniqueness in the database. Convert race-related uniqueness failures into a clear field error. Reuse existing equipment instead of allowing accidental duplicates.

### 7. P2 — Close the plan editor after a successful save

**Evidence:** [CalibrationPage.jsx:378](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:378).

`savePlanEntry` sets `submitting=true`, then calls `closePlanEditor` after saving. That callback returns early while submitting. The successful save leaves the dialog open, with the success notice behind it. Clicking Save again can produce a duplicate error.

**Apply:** explicitly clear the plan form and close the editor in the success path; retain the submitting guard only for user cancellation. Verify successful add and edit both close once.

### 8. P2 — Synchronize navigation, plan year, and temporary notices

**Evidence:** [CalibrationPage.jsx:77](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:77), [CalibrationPage.jsx:93](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:93), [CalibrationPage.jsx:116](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:116).

The query-string year is read only when the component first mounts. Calibration routes reuse the same component type, so registration navigating to `?year=2027` can retain 2026 in state. The three-second notice timer exists, but navigation to a tab with no success state does not clear the previous message immediately. Loading is never set true again for subsequent year/view changes, leaving stale content visible while requests run.

**Apply:** derive/synchronize the selected year from the URL, reset view-specific state on route changes, clear notices when leaving their owning view, and show loading or refreshing feedback during subsequent fetches. Test registration across a year boundary and switching tabs before the notice expires.

### 9. P2 — Make Print include the entire filtered annual plan

**Evidence:** [CalibrationViews.jsx:473](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/components/calibration/CalibrationViews.jsx:473), [CalibrationViews.jsx:516](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/components/calibration/CalibrationViews.jsx:516).

Both the interactive table and print sheet render `visibleRows`, which contains only the current 20-row page. Print therefore omits other matching equipment. PDF generation receives the full filtered dataset and can disagree with Print. This is a source-confirmed omission; physical print layout was not rendered in this review.

**Apply:** render all filtered entries for printing, or make Print use the generated PDF. Verify a plan with at least 21 entries and a multi-page history card.

### 10. P2 — Correct compliance calculations and calendar meaning

**Evidence:** [views.py:394](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:394), [serializers.py:16](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/serializers.py:16), [CalibrationViews.jsx:94](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/components/calibration/CalibrationViews.jsx:94).

Compliance counts distinct instruments with any on-time result rather than completed due cycles. An instrument with January completed and June missed still contributes once to each side, potentially showing 100%. Numerator and denominator are queried independently, allowing mismatches when plans are removed or changed. Clicking the metric filters by the latest result without the summary's year restriction. The yearly calendar counts only each instrument's current next-due date, not its actual plan entries, so completed and multiple scheduled cycles disappear from that overview.

**Apply:** define the metric at the plan-cycle level and use the same dataset for counts and drilldowns. Build the calendar from plan entries or rename it explicitly as a next-due overview. Distinguish “no due plans” from demonstrated 100% compliance.

### 11. P2 — Make certificate deep links dismissible

**Evidence:** [CalibrationPage.jsx:348](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:348).

For a history URL with `?certificate=...`, closing the preview sets it to null, which causes the auto-open effect to run again with the same query parameter. The certificate can immediately reopen. A download failure has no dedicated retry/loading state.

**Apply:** consume the certificate query parameter once, remove it on close, and expose a loading/error state with an explicit retry.

### 12. P2 — Separate successful writes from failed refreshes; protect result transitions

**Evidence:** [CalibrationPage.jsx:240](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:240), [CalibrationPage.jsx:292](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/pages/CalibrationPage.jsx:292), [views.py:160](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:160), [views.py:225](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/backend/apps/calibration/views.py:225).

Several handlers combine saving and refreshing in one try/catch. A successful result followed by a failed refresh is shown as a save failure; retrying can create another result. On the backend, lifecycle checks occur before the transaction and without a row lock. Concurrent result/disposition requests can overwrite state based on stale reads. These are code-identified failure/concurrency risks, not live destructive tests.

**Apply:** acknowledge the saved response separately and offer “Retry refresh.” Lock and revalidate the instrument inside the result/disposition transaction. Add an idempotency mechanism for result submissions, and verify double-submit, retry, and competing repair/scrap scenarios in a test database.

## UI and user-experience recommendations

These are improvements grounded in source/screenshots, pending authenticated browser verification. The UI/UX review guidance was used specifically for field-level feedback, focus, recovery, and responsive layout.

1. **Simplify Equipment Management's table.** Its minimum width is 1460px, with History Card, location, dates, status, and actions all presented at once ([index.css:1636](D:/LIHATECH/mech-tech/Ledger-Entry-Automation/dashboard/src/index.css:1636)). Keep Equipment, Next Due, Status, and Actions prominent; move secondary fields into details or optional columns. Add pagination to this table, which currently renders all equipment even though dashboard lists are paginated. Keep necessary scrolling inside the table and important actions readily accessible.

2. **Put errors beside the relevant input.** The form currently uses one top-level string and `apiErrorMessage` retains only the first API error. Preserve a map of field errors, add `aria-invalid`/`aria-describedby`, focus the first invalid field, show the duplicate warning beside Equipment ID, and mirror backend text-length limits. Retain the summary alert for submission failures.

3. **Use one registration popup workflow.** The old `/calibration/equipment/new` page still renders a standalone form. Redirect that route into the same popup experience, preserve the generated read-only history number, and offer “Save and add another” for batch entry. Keep a clear link to the new instrument's applicable plan year instead of forcing an unexpected context change after every entry.

4. **Protect form drafts and improve keyboard use.** Escape or a backdrop click closes the registration modal and clears all entered data. Confirm dismissal only when the draft is dirty. The shared modal initially focuses its first button, which is Close; focus Equipment ID for registration. The Accepted/Rejected custom radio buttons should support expected arrow-key navigation or use native radios. Verify focus restoration after navigation and save.

5. **Make notifications actionable without interrupting work.** The dashboard automatically opens the notification dialog when its fingerprint changes; polling can trigger it while the user is working. Prefer a badge/banner and user-opened list. Rejection/repair notifications currently navigate to a history view with no result/disposition action; provide a direct action for that equipment. Add a visible last-refreshed indicator and retry when polling fails instead of silently ignoring the failure.

6. **Separate schedule management from the print preview.** The annual plan displays two full tables at once, adding width and visual repetition. Use a “Plan / Report preview” switch, clearer priority among Add Plan, Print, and Download, and an empty state that distinguishes no scheduled equipment from filters hiding records. Give a useful next action in each case.

7. **Make the result form sufficient for the decision.** Show the instrument's acceptance criteria and planned date alongside Accepted/Rejected. The current result form only displays name, type, department/location, and frequency guidance. Decide which evidence fields your process actually requires, then mark those clearly and validate them consistently; currently acceptance is possible without details, agency, certificate, or evidence.

## Suggested implementation order

1. Correct plan/result relationships and remove read-time writes; synchronize rescheduling.
2. Add date/chronology validation and stable generated identity; enforce normalized ID uniqueness.
3. Fix save dialogs, route/year state, certificate closing, and refresh/retry handling.
4. Align compliance, calendar, printing, and PDF filtering.
5. Apply the focused UI improvements and verify the complete workflow in the correct authenticated environment.

## Regression scenarios required before sign-off

- Register an instrument due next year; verify the correct year, matching card number, cleared form, and notice timing/tab scope.
- Duplicate ID with whitespace/case differences, editing the current ID, and simultaneous registration attempts.
- Reschedule/remove an unresolved plan; reload and export; verify intentional changes survive and dates remain consistent.
- Multiple cycles per year, rejected then repaired/accepted, and calibration around New Year; verify exact plan/result linkage and compliance.
- Future/old dates, extreme frequencies, long field values, stale requests, and failed refresh after successful save.
- Save/close plan dialogs; open/close certificate deep links; verify keyboard interaction and dirty-draft cancellation.
- More than 20 annual entries, filtered Print versus PDF, long history and long remarks; verify every intended entry is included.
- Authenticated UI at desktop, tablet, and narrow mobile widths; inspect overflow, focus, controls, error text, and readable reports.

No fixes were applied as part of this review. The previously passing tests should be extended with these behavioral cases before considering the module ready.
