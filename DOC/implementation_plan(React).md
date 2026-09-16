# React Supervisor Dashboard — Implementation Plan

## Overview

A **Vite + React** web dashboard for supervisors to monitor factory floor inspections in real-time.
It connects to the Django backend via **REST APIs** (JWT auth) and **WebSocket** (live events).

The dashboard is for **supervisors and quality engineers** only — operators use the Flutter mobile app.

---

## What the Dashboard Needs to Do

Based on the backend APIs built so far:

| Section | What it shows | Backend API |
|---|---|---|
| **Login** | JWT login form | `POST /api/users/login/` |
| **Live Feed** | Active inspections, progress, OOC alerts | `GET /api/dashboard/live/?plant=` + WebSocket `ws/dashboard/<plant_id>/` |
| **Pending Reviews** | Inspections awaiting supervisor approval | `GET /api/inspections/pending/` |
| **Approve / Reject** | Supervisor action with remark | `POST /api/inspections/<session_id>/review/` |
| **Shift Summary** | Today's pass rate, total, rejected, OOC count | `GET /api/dashboard/shift-summary/` |
| **OOC Trend Chart** | 7-day daily OOC trend line chart | `GET /api/analytics/ooc-trend/?days=7` |
| **Inspection Report** | Filter by date range + machine, get stats | `GET /api/analytics/report/` |
| **Session Detail** | Full measurement list for one session | `GET /api/inspections/<session_id>/` |
| **Machine Performance** | Pass rate + OOC rate per machine | `GET /api/analytics/machine/<id>/performance/` |

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | **Vite + React 18** | Fast, modern, light |
| Language | **JavaScript (JSX)** | No TypeScript overhead for now |
| Styling | **Vanilla CSS** (custom design system) | No Tailwind, as per guidelines |
| Charts | **Recharts** | Lightweight, React-native charts |
| HTTP | **Axios** | JWT interceptor support |
| WebSocket | **Native browser WebSocket** | No extra library needed |
| Routing | **React Router v6** | Standard SPA routing |
| State | **React Context + useState/useEffect** | Simple, no Redux needed |
| Icons | **Lucide React** | Clean, modern icon set |

---

## Folder Structure

```
dashboard/
├── public/
└── src/
    ├── api/
    │   ├── axios.js          ← Axios instance with JWT interceptor
    │   ├── auth.js           ← login, logout, refresh token
    │   ├── inspections.js    ← all inspection endpoints
    │   ├── dashboard.js      ← live status, shift summary
    │   └── analytics.js      ← reports, ooc-trend, machine perf
    ├── context/
    │   ├── AuthContext.jsx   ← user, token, login/logout
    │   └── WebSocketContext.jsx ← WS connection, live events
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.jsx
    │   │   ├── Header.jsx
    │   │   └── Layout.jsx
    │   ├── cards/
    │   │   ├── StatCard.jsx        ← reusable KPI card
    │   │   └── AlertBanner.jsx     ← OOC / critical fail banner
    │   ├── charts/
    │   │   ├── OOCTrendChart.jsx   ← 7-day line chart
    │   │   └── ShiftDonutChart.jsx ← approved/rejected/pending donut
    │   └── common/
    │       ├── LoadingSpinner.jsx
    │       ├── Badge.jsx           ← status badge (ok/out_of_spec)
    │       └── Modal.jsx
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── DashboardPage.jsx       ← main live feed + shift KPIs
    │   ├── PendingReviewPage.jsx   ← list + approve/reject
    │   ├── SessionDetailPage.jsx   ← full measurement table
    │   ├── AnalyticsPage.jsx       ← reports + charts
    │   └── MachineDetailPage.jsx   ← per-machine performance
    ├── hooks/
    │   ├── useLiveFeed.js    ← polls /dashboard/live/ + WS events
    │   └── useShiftSummary.js
    ├── utils/
    │   └── formatters.js     ← date, percentage, status label helpers
    ├── App.jsx
    ├── main.jsx
    └── index.css             ← full design system (dark mode, tokens)
```

---

## Pages — Detailed Design

### 1. Login Page
- Dark, premium card form (username + password)
- Calls `POST /api/users/login/` → stores JWT in localStorage
- Redirects to Dashboard on success

### 2. Dashboard Page (Main)
**Top Row — 5 KPI Stat Cards:**
- Total Inspections Today
- ✅ Approved
- ❌ Rejected
- ⏳ Pending Review
- 🔴 OOC Count (with red glow if > 0)

**Middle Row:**
- Left: **Live Inspection Feed** — card per active session, shows machine, part, operator, progress bar, OOC badge. WebSocket updates in real-time.
- Right: **7-Day OOC Trend** — Recharts line chart

**Bottom Row:**
- **Shift Donut Chart** — approved/rejected/pending breakdown
- **Recent Alerts** — list of latest OOC/critical fail events from WebSocket

### 3. Pending Review Page
- Table of all `pending_review` sessions
- Columns: Session ID, Part, Machine, Operator, Shift, Has OOC, Started At
- Click row → opens **Review Modal** (shows session summary + Approve/Reject + Remark input)
- On action → calls `POST /api/inspections/<session_id>/review/`

### 4. Session Detail Page
- Full measurement table from MongoDB
- Columns: Parameter, Nominal, Upper Limit, Lower Limit, Measured, Deviation, Status (ok / out_of_spec badge), Method (voice/manual)
- OOC rows highlighted in red
- Header shows: Part, Machine, Operator, Inspection Type, Shift, Status

### 5. Analytics Page
- Date range picker + Machine filter
- Calls `/api/analytics/report/` → shows stats table
- Recharts Bar chart: total / approved / rejected per day (from OOC trend data)
- Parameter OOC Rate table (worst parameters by failure rate)

### 6. Machine Detail Page
- Per-machine performance (30-day): pass rate, OOC rate, total inspections
- Gauge-style display for pass rate

---

## Design System (index.css)

**Color Palette (dark mode first):**
```
--bg-primary:    #0a0e1a   (deep navy)
--bg-surface:    #111827   (dark card)
--bg-elevated:   #1a2235   (slightly lighter card)
--accent-blue:   #3b82f6   (primary actions)
--accent-green:  #10b981   (approved / ok)
--accent-red:    #ef4444   (rejected / OOC / alert)
--accent-yellow: #f59e0b   (pending / warning)
--text-primary:  #f1f5f9
--text-muted:    #64748b
--border:        #1e293b
```

**Effects:**
- Glassmorphism cards: `backdrop-filter: blur(12px)` with semi-transparent backgrounds
- Glow on OOC alerts: `box-shadow: 0 0 20px rgba(239,68,68,0.4)`
- Smooth transitions on all interactive elements
- Animated progress bars on live sessions
- Number counters that animate on load

---

## Build Order

```
Step 1: Vite project scaffold + install deps
Step 2: index.css — full design system
Step 3: api/ layer — Axios + all endpoint modules
Step 4: AuthContext + LoginPage
Step 5: Layout (Sidebar + Header)
Step 6: DashboardPage — stat cards + live feed + OOC trend chart
Step 7: WebSocketContext — connect to ws/dashboard/<plant_id>/
Step 8: PendingReviewPage + Review Modal
Step 9: SessionDetailPage — full measurement table
Step 10: AnalyticsPage — charts + report
Step 11: MachineDetailPage
Step 12: Polish — animations, responsive, error states
```

---

## Open Questions

> [!IMPORTANT]
> **Backend URL** — What is your Django dev server URL? Default is `http://127.0.0.1:8000`. Should I use that?

> [!IMPORTANT]
> **Where to scaffold?** — The `dashboard/` folder at `e:\Liha_Tech_Project1\Ledger_entry_automation\dashboard\` is currently empty. Should I create the Vite project there?

> [!NOTE]
> **Plant ID** — For the WebSocket and live feed, the supervisor needs to select a plant. Should the plant be auto-selected based on their profile, or should there be a plant selector dropdown?

> [!NOTE]
> **Shift selector** — The shift summary API takes a shift param (A/B/C). Should there be a shift tab/toggle on the dashboard, or default to the current shift based on time of day?
