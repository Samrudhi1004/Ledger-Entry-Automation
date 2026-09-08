# Codebase Audit Report
*Generated: 2026-09-05 | Project: Ledger Entry Automation (Django + React)*

---

## Summary

A full deep-dive audit of the backend (Django/Daphne) and frontend (React/Vite) codebase found **24 issues** across all major files, ranging from runtime crashes and silent data corruption to security holes and dead code.

| Severity | Count |
|---|---|
| 🔴 Critical — Runtime crash / data corruption | 4 |
| 🔴 Critical — Security | 7 |
| 🟠 High — Functional bugs / silent wrong data | 6 |
| 🟡 Medium — Performance / reliability | 4 |
| 🟢 Low — Code quality / dead code | 8 |

---

## 🔴 CRITICAL — Runtime Crashes / Data Corruption

### C1 · Wrong method name crashes `SetupStatusView`
**File:** `backend/apps/inspections/views.py:567`  
**Problem:** Calls `_service.get_session_detail()` — this method does not exist on `InspectionService`. The correct name is `get_session_document()`. Every request to the `/setup-status/` endpoint crashes with `AttributeError`.  
**Fix:** Rename the call to `get_session_document()`.

---

### C2 · Wrong tolerance applied to measurements (silent data corruption)
**File:** `backend/apps/inspections/services.py:436–438`  
**Problem:** In `record_measurement()`, if the `parameter_code` is not found for the session's part/template, the code falls back silently:
```python
parameter = InspectionParameter.objects.filter(template__part_id=session.part_id).first()
if not parameter:
    parameter = InspectionParameter.objects.first()   # ← ANY parameter!
```
This applies wrong tolerances from a completely different parameter/part, producing false pass/fail results with no error raised.  
**Fix:** Remove both fallbacks. Raise `ValueError("Parameter not found")` and let the view return HTTP 400.

---

### C3 · Operator/supervisor alerts never reach the dashboard (group name mismatch)
**File:** `backend/apps/inspections/reminder_worker.py:90`  
**Problem:** `_broadcast_event()` hardcodes group name `'dashboard_plant_1'`, but `InspectionConsumer.connect()` joins group `f"plant_{plant_id}"` (e.g. `"plant_1"`). No client is ever in `'dashboard_plant_1'`, so all reminder and escalation alerts are silently dropped.  
**Fix:** Derive plant_id from the session and broadcast to `f"plant_{session.machine.plant_id}"`.

---

### C4 · WebSocket message type mismatch — dashboard_event handler missing
**File:** `backend/apps/dashboard/consumers.py`  
**Problem:** Consumer only handles type `inspection_event`. The reminder_worker sends type `dashboard_event`. Channels routes by type — unhandled types are silently discarded.  
**Fix:** Add a `dashboard_event(self, event)` handler to the consumer, or change the reminder_worker to send type `inspection.event` matching the existing handler.

---

## 🔴 CRITICAL — Security

### S1 · Unauthenticated export endpoints (full data leak)
**File:** `backend/apps/inspections/views.py` — `DailyProductionReportViewSet`, `DowntimeReportViewSet`  
**Problem:** `get_permissions()` returns an empty list `[]` for `export_pdf` and `export_excel` actions, completely bypassing authentication. Anyone on the internet can download all production and downtime data.
```python
def get_permissions(self):
    if self.action in ['export_excel', 'export_pdf']:
        return []   # ← NO authentication!
    return [IsAuthenticated()]
```
**Fix:** Return `[IsAuthenticated()]` (or `[IsSupervisorOrAbove()]`) for export actions.

---

### S2 · JWT token exposed in WebSocket URL
**File:** `dashboard/src/context/WebSocketContext.jsx`  
**Problem:** Access token is appended as a URL query parameter:
```javascript
const url = `${WS_BASE_URL}/ws/dashboard/${plantId}/?token=${token}`;
```
Token appears in server access logs, browser history, reverse proxies, and referrer headers.  
**Fix:** Send the token in the first WebSocket message after connection opens, or use the `Sec-WebSocket-Protocol` header; parse it on the backend from `scope['headers']` or the first message.

---

### S3 · WebSocket consumer accepts unauthenticated connections
**File:** `backend/apps/dashboard/consumers.py`  
**Problem:** `AuthMiddlewareStack` (in `asgi.py`) sets `scope['user']`, but the consumer's `connect()` method never checks it. Any client without a valid token can subscribe to live inspection events.  
**Fix:** Add at the top of `connect()`:
```python
if self.scope['user'].is_anonymous:
    await self.close()
    return
```

---

### S4 · Server disk path disclosed in voice API response
**File:** `backend/apps/voice/views.py`  
**Problem:** API response includes the full server-side filesystem path of the uploaded audio file (`audio_path`).  
**Fix:** Remove `audio_path` from the response payload.

---

### S5 · Disk path stored in Redis and returned to client via job status
**File:** `backend/apps/voice/tasks.py:130`  
**Problem:** The Redis job cache result stores `audio_path`:
```python
cache.set(f"voice_job_{job_id}", {
    'status': 'done',
    'audio_path': file_path,   # ← path disclosure
    ...
}, ...)
```
This path is then returned to the client via the job status endpoint.  
**Fix:** Remove `audio_path` from the dict before caching.

---

### S6 · Redundant `CORS_ALLOW_ALL_ORIGINS = True` (misleading)
**File:** `backend/config/settings.py:149`  
**Problem:** `CORS_ALLOW_ALL_ORIGINS = True` is set unconditionally at line 149, then correctly overridden to `DEBUG` at line 317. The early `True` is dead but dangerous — it will become active if the override line is ever removed.  
**Fix:** Delete the redundant line 149.

---

### S7 · MongoDB URI (with credentials) logged at startup
**File:** `backend/config/db.py`  
**Problem:** `get_mongo_client()` logs `settings.MONGODB_URI`, which exposes credentials in server logs if the URI contains a username/password (`mongodb://user:pass@host`).  
**Fix:** Log only the host/port portion. Mask anything before `@`.

---

## 🟠 HIGH — Functional Bugs / Silent Wrong Data

### H1 · Reminder worker launches on every Daphne process start (double worker)
**File:** `backend/apps/inspections/apps.py`  
**Problem:** The guard condition is:
```python
if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('SERVER_SOFTWARE'):
```
Daphne never sets `RUN_MAIN`, so `not SERVER_SOFTWARE` is always `True` under Daphne, and the worker launches on every process startup (including the reloader child process). Results in duplicate polling in development.  
**Fix:** Use `RUN_MAIN` only for `runserver`. For Daphne, guard with a file-based PID lock or use `os.getenv('SERVER_SOFTWARE', '').startswith('daphne')` to skip the guard and let the lock in `start_reminder_worker()` handle it.

---

### H2 · Race condition in `_worker_started` flag (no lock)
**File:** `backend/apps/inspections/reminder_worker.py:117–124`  
**Problem:** `_worker_started` is a plain global boolean. Two threads (e.g. startup + a hot-reload) reading simultaneously both see `False` and both call `thread.start()`.  
**Fix:**
```python
_worker_lock = threading.Lock()
_worker_started = False

def start_reminder_worker():
    global _worker_started
    with _worker_lock:
        if not _worker_started:
            thread = ReminderWorkerThread(interval_seconds=30)
            thread.start()
            _worker_started = True
```

---

### H3 · Wrong part substituted on `Part.DoesNotExist` (silent)
**File:** `backend/apps/inspections/views.py:73`  
**Problem:** The `except Part.DoesNotExist` block falls through to `Part.objects.filter(is_active=True).first()` — it silently substitutes any available active part instead of returning 404.  
**Fix:** Return `Response({'error': 'Part not found'}, status=404)` in the except block.

---

### H4 · Race condition in session creation (duplicate sessions possible)
**File:** `backend/apps/inspections/services.py` — `create_session()`  
**Problem:** The existence check and subsequent `create()` are not atomic. Two simultaneous requests for the same session can both pass the check and create duplicate records.  
**Fix:** Use `get_or_create()` inside `transaction.atomic()` with `select_for_update()`, or add a unique constraint and handle `IntegrityError`.

---

### H5 · Whisper model singleton not thread-safe
**File:** `backend/apps/voice/whisper_engine.py`  
**Problem:** `_get_local_model()` checks `if _whisper_model is None` without a lock. Two concurrent voice transcription requests can both see `None` and both load the model, doubling memory usage or crashing on low-RAM systems.  
**Fix:**
```python
_model_lock = threading.Lock()

def _get_local_model():
    global _whisper_model
    with _model_lock:
        if _whisper_model is None:
            ...load model...
    return _whisper_model
```

---

### H6 · Uploaded audio files never deleted (disk leak)
**File:** `backend/apps/voice/views.py` / `tasks.py`  
**Problem:** After transcription (success or failure), the temporary audio file is never removed. Over time, `MEDIA_ROOT` fills with orphaned audio files.  
**Fix:** In `_run_transcription()` (tasks.py), wrap transcription in try/finally and call `os.unlink(file_path)` in the `finally` block.

---

## 🟡 MEDIUM — Performance / Reliability

### M1 · New thread spawned per WebSocket event (thread churn)
**File:** `backend/apps/inspections/services.py:39`  
**Problem:** `_dispatch_async_websocket()` creates a new `threading.Thread` for every single WebSocket push:
```python
threading.Thread(target=_send, daemon=True).start()
```
On busy systems with rapid measurements, this spawns tens of threads per second with no upper bound.  
**Fix:** Replace with a single long-running dispatch thread consuming from a `queue.Queue`. Pattern already exists in `ReminderWorkerThread`.

---

### M2 · N+1 MongoDB reads in `record_measurement()`
**File:** `backend/apps/inspections/services.py:458`  
**Problem:** `get_session_document()` calls `find_one()` for every single measurement. When recording multiple parameters, each triggers a full MongoDB document fetch.  
**Fix:** Fetch the document once at the start of the measurement batch and pass it as a parameter, or cache the document for the duration of a request.

---

### M3 · `DowntimeReportViewSet.history()` has no pagination
**File:** `backend/apps/inspections/views.py`  
**Problem:** The `history()` action returns all downtime report records — a full table scan that grows unbounded.  
**Fix:** Apply `self.paginate_queryset()` or limit to a recent window (e.g. `[:100]` with appropriate ordering).

---

### M4 · Two separate `InspectionService()` instances
**File:** `backend/apps/inspections/tasks.py:31`, `backend/apps/inspections/views.py:40`  
**Problem:** Both files independently construct `_service = InspectionService()`. Any cached state or connection held by the service is duplicated unnecessarily.  
**Fix:** Add a module-level singleton in `services.py`:
```python
# services.py (bottom of file)
_default_service = InspectionService()
```
Then import it: `from .services import _default_service as _service`.

---

## 🟢 LOW — Code Quality / Dead Code / Minor Issues

### L1 · Duplicate imports of `Part` and `Machine`
**File:** `backend/apps/inspections/views.py:11–12, 24–25`  
Both models imported twice. Delete lines 24–25.

---

### L2 · `dispatch_measurement_task_async()` is dead code
**File:** `backend/apps/inspections/tasks.py:110–149`  
Never called from `views.py` — views call `process_measurement_in_background()` directly via a thread. Remove or clearly document as "intended Celery entry point".

---

### L3 · `apps/voice/models.py` is entirely empty
**File:** `backend/apps/voice/models.py`  
Only contains a placeholder comment. No models are defined. If voice models are needed, add them; otherwise remove the file.

---

### L4 · `word2number` imported inside function (repeated runtime import)
**File:** `backend/apps/voice/number_parser.py`  
`from word2number import w2n` is called inside each method instead of at module level. Move to top of file.

---

### L5 · `DowntimeReport.save()` calls `self.full_clean()` — breaks bulk operations
**File:** `backend/apps/inspections/models.py:218`  
`save()` calls `full_clean()` which raises `ValidationError` in `bulk_create()`, signals, and admin actions. `PositiveIntegerField` already enforces >= 0 at the DB level.  
Remove `self.full_clean()` from `save()`; keep `clean()` for form/serializer validation.

---

### L6 · `PLANT_ID` hardcoded in dashboard
**File:** `dashboard/src/pages/DashboardPage.jsx`  
`const PLANT_ID = 1;` hardcoded at top — blocks multi-plant support. Read from URL params or user profile instead.

---

### L7 · WebSocket reconnect has no exponential backoff
**File:** `dashboard/src/context/WebSocketContext.jsx`  
Fixed 3-second reconnect interval. On backend restart, every client reconnects simultaneously. Implement exponential backoff (start 1s, double each attempt, cap 30s).

---

### L8 · `SupervisorOverrideView` checks permission manually
**File:** `backend/apps/inspections/views.py`  
Manually checks `request.user.is_supervisor` instead of using the existing `IsSupervisorOrAbove` permission class. Replace with `permission_classes = [IsSupervisorOrAbove]`.

---

## Files Affected (Summary)

| File | Issues |
|------|--------|
| `backend/apps/inspections/services.py` | C2, H4, M1, M2, M4 |
| `backend/apps/inspections/views.py` | C1, H3, S1, L1, L2, L8, M3 |
| `backend/apps/inspections/reminder_worker.py` | C3, H2 |
| `backend/apps/dashboard/consumers.py` | C4, S3 |
| `backend/apps/inspections/apps.py` | H1 |
| `backend/apps/voice/tasks.py` | S5, H6 |
| `backend/apps/voice/views.py` | S4 |
| `backend/apps/voice/whisper_engine.py` | H5 |
| `backend/apps/voice/number_parser.py` | L4 |
| `backend/apps/voice/models.py` | L3 |
| `backend/apps/inspections/models.py` | L5 |
| `backend/apps/inspections/tasks.py` | L2, M4 |
| `backend/config/settings.py` | S6 |
| `backend/config/db.py` | S7 |
| `dashboard/src/context/WebSocketContext.jsx` | S2, L7 |
| `dashboard/src/pages/DashboardPage.jsx` | L6 |

---

*End of Audit Report*
