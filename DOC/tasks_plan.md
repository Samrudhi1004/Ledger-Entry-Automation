# Implementation Plan: Shift Duration, Cycle Time & Downtime Logic

This plan outlines the steps to implement dynamic 8/12 hour shifts, operation cycle times, and automated mathematical target & downtime calculations based on the provided screenshots and requirements.

## 1. Shift Configuration & Dynamic Reports (8hr vs 12hr)
**Goal:** Allow the admin to set the plant shift duration to 8 or 12 hours, and dynamically adjust the live reports, inspection reports, and downloaded PDFs/Excel sheets to show either 1 to 8 hours or 1 to 12 hours.

**Proposed Changes:**
- **Backend Models (`machines/models.py`)**: Add `shift_duration_hours` (default 8) and break times (`lunch_break_mins`, `short_break_mins`) to the `Plant` model. This gives the admin control at the plant level.
- **Frontend Reports (`OfficialFormF02Modal.jsx`, `DailyProductionReportsPage.jsx`, `AnalyticsPage.jsx`)**: 
  - Fetch the plant's `shift_duration_hours`.
  - Replace the hardcoded `[1, 2, 3, 4, 5, 6, 7, 8]` array with a dynamic array `Array.from({length: shiftDuration}, (_, i) => i + 1)`.
  - Update the table headers and rendering loops to show up to 12 columns if a 12-hour shift is configured.
  - Dynamically restrict shift options to `A, B, C` (for 8 hr) or just `A, B` (for 12 hr).

## 2. Operation Cycle Time Configuration
**Goal:** Provide an option to set the "Cycle Time" per operation where process/product parameters are configured, and display it in the mobile app.

**Proposed Changes:**
- **Backend Models (`parts/models.py`)**: Add `cycle_time_mins` (DecimalField) to the `InspectionTemplate` model, which acts as the Operation master.
- **Frontend (`ParametersPage.jsx` or similar configuration page)**: Add an input field for "Cycle Time (minutes)" so admins/supervisors can define how long an operation takes.
- **Mobile App (`operation_select_screen.dart` / API Services)**: Expose `cycle_time_mins` in the DRF serializers and fetch it in Flutter. Update the UI to display "Cycle Time: X mins" on the operation card.

## 3. Mathematical Logic for Target & Downtime Reports
**Goal:** Automate the calculation of Production Target and Total Downtime based on cycle time and shift hours.

**Proposed Changes:**
- **Target Calculation**: `Available Time = (shift_duration_hours * 60) - (lunch_break_mins + short_break_mins)`.
  `Target = Available Time / cycle_time_mins`.
  This will automatically populate the `production_target` field in the Daily Production Report.
- **Total Downtime Calculation**: `Total Downtime = (Target - Produced) * cycle_time_mins`.
- **Backend / Frontend Integration**: Update `DowntimeReport` save logic and the `DowntimeReportsPage.jsx` to reflect this new mathematical total.

> [!IMPORTANT]  
> **User Review Required: Open Questions**
> 1. **Downtime Total vs Breakdown**: The new formula defines `Total Downtime = (Target - Produced) * cycle time`. Currently, the Downtime Report has breakdown fields (No Load, No Operator, Setting, etc.) that sum up to the total. If we change the Total to be mathematically calculated, should supervisors still fill in the breakdown fields so that they match the calculated Total? Or do we remove the breakdown fields entirely?
> 2. **Mobile App Display**: In the mobile app, where exactly should the cycle time be displayed? Just on the operation select screen, or also during the inspection checklist?
> 3. **Shift Times**: If it's a 12-hour shift, is there only a Lunch and Short break, or should we allow configuring multiple breaks? I propose storing `total_break_mins` to keep it flexible.
