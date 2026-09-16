# Codebase Audit Report — Version 2
*Generated: 2026-09-05 | Project: Ledger Entry Automation (Django + React)*  
*Based on: latest `main` branch (18 new commits merged since V1)*

---

## Executive Summary

This V2 audit re-evaluates all 24 issues from the original report against the newly merged code, and adds fresh findings introduced by the merge.

**Of the 24 original issues:**
- ✅ **2 Fixed** — L2 (dead code), L3 (empty models file)
- ❌ **22 Remain** — everything else untouched

**New issues introduced by merge:**
- 🔴 **NEW-S1** — `LoginView` auto-creates privileged accounts — production backdoor
- 🟠 **NEW-H1** — `ClearHistoryView` deletes finalized reports unconditionally
- 🟠 **NEW-H2** — Django ORM objects cached into Redis (not pickle-safe)
- 🟠 **NEW-H3** — N+1 MongoDB reads inside `get_session_document()` loop
- 🟡 **NEW-M1** — `CORS_ALLOWED_ORIGINS` defined twice; first definition is dead code

**Grand total: 29 issues**

| Severity | V1 Count | V2 Count |
|---|---|---|
| 🔴 Critical — Runtime crash / data corruption | 4 | 4 |
| 🔴 Critical — Security | 7 | **8** (+1) |
| 🟠 High — Functional bugs / silent wrong data | 6 | **8** (+2) |
| 🟡 Medium — Performance / reliability | 4 | **5** (+1) |
| 🟢 Low — Code quality / dead code | 8 | **6** (-2 fixed) |
| **Total** | **24** | **29** |

---

## Status of All V1 Issues

| ID | Title | Status |
|---|---|---|
| C1 | Wrong method name crashes `SetupStatusView` | ❌ Not fixed |
| C2 | Wrong tolerance applied to measurements | ❌ Not fixed |
| C3 | Group name mismatch — alerts never reach dashboard | ❌ Not fixed |
| C4 | WebSocket message type mismatch — `dashboard_event` handler missing | ❌ Not fixed |
| S1 | Unauthenticated export endpoints | ❌ Not fixed |
| S2 | JWT token in WebSocket URL | ❌ Not fixed |
| S3 | WebSocket consumer accepts anonymous connections | ❌ Not fixed |
| S4 | Disk path disclosed in voice API response | ❌ Not fixed |
| S5 | Disk path stored in Redis and returned to client | ❌ Not fixed |
| S6 | Redundant `CORS_ALLOW_ALL_ORIGINS = True` | ❌ Not fixed |
| S7 | MongoDB URI logged at startup | ❌ Not fixed |
| H1 | Reminder worker launches on every Daphne process | ❌ Not fixed |
| H2 | Race condition in `_worker_started` flag | ❌ Not fixed |
| H3 | Wrong part substituted on `Part.DoesNotExist` | ❌ Not fixed |
| H4 | Race condition in session creation | ❌ Not fixed |
| H5 | Whisper model singleton not thread-safe | ❌ Not fixed |
| H6 | Uploaded audio files never deleted | ❌ Not fixed |
| M1 | New thread per WebSocket event | ❌ Not fixed |
| M2 | N+1 MongoDB reads in `record_measurement()` | ❌ Not fixed (worsened — see NEW-H3) |
| M3 | `DowntimeReportViewSet.history()` has no pagination | ❌ Not fixed |
| M4 | Two separate `InspectionService()` instances | ❌ Not fixed |
| L1 | Duplicate imports of `Part` and `Machine` | ❌ Not fixed |
| L2 | `dispatch_measurement_task_async()` was dead code | ✅ **Fixed** — now has real Celery→thread fallback |
| L3 | `apps/voice/models.py` entirely empty | ✅ **Fixed** — file no longer exists as empty placeholder |
| L4 | `word2number` imported inside function | ❌ Not fixed |
| L5 | `DowntimeReport.save()` calls `self.full_clean()` | ❌ Not fixed |
| L6 | `PLANT_ID` hardcoded in dashboard | ❌ Not fixed |
| L7 | WebSocket reconnect has no exponential backoff | ❌ Not fixed |
| L8 | `SupervisorOverrideView` checks permission manually | ❌ Not fixed |

---

## 🔴 CRITICAL — Runtime Crashes / Data Corruption

### C1 · Wrong method name crashes `SetupStatusView`
**File:** `backend/apps/inspections/views.py:567`  
**Status:** ❌ Not fixed  
**Problem:** Calls `_service.get_session_detail()` — this method does not exist. Every request to `/setup-status/` crashes with `AttributeError: 'InspectionService' object has no attribute 'get_session_detail'`.  
```python
doc = _service.get_session_detail(str(session.session_id))  # method doesn't exist
```
**Fix:** Rename to `_service.get_session_document(str(session.session_id))`.

---

### C2 · Wrong tolerance applied to measurements (silent data corruption)
**File:** `backend/apps/inspections/services.py:435–440`  
**Status:** ❌ Not fixed  
**Problem:** Fallback logic in `record_measurement()` grabs any random `InspectionParameter` if the correct one is not found, producing false pass/fail results silently:
```python
parameter = InspectionParameter.objects.filter(template__part_id=session.part_id).first()
if not parameter:
    parameter = InspectionParameter.objects.first()  # ← ANY parameter in the DB!
```
**Fix:** Remove both fallbacks. Raise `ValueError("Parameter '%s' not found for part")` and return HTTP 400.

---

### C3 · Operator/supervisor alerts never reach the dashboard (group name mismatch)
**File:** `backend/apps/inspections/reminder_worker.py:90`  
**Status:** ❌ Not fixed  
**Problem:** `_broadcast_event()` hardcodes `'dashboard_plant_1'` as the channel group name:
```python
async_to_sync(channel_layer.group_send)(
    'dashboard_plant_1',           # ← hardcoded wrong name
    {'type': 'dashboard_event', ...}
)
```
But `InspectionConsumer.connect()` joins group `f"plant_{plant_id}"` (e.g. `"plant_1"`). No client ever receives reminder or escalation alerts.  
**Fix:** Determine `plant_id` from session's machine and broadcast to `f"plant_{session.machine.plant_id}"`.

---

### C4 · WebSocket message type mismatch — `dashboard_event` handler missing
**File:** `backend/apps/dashboard/consumers.py`  
**Status:** ❌ Not fixed  
**Problem:** Consumer only defines `async def inspection_event(self, event)`. The reminder_worker sends `'type': 'dashboard_event'`. Django Channels routes by the `type` field — unhandled types are silently dropped.  
**Fix:** Add a matching handler:
```python
async def dashboard_event(self, event):
    await self.send(text_data=json.dumps(event['data']))
```
Or change reminder_worker to send `'type': 'inspection_event'` to match the existing handler.

---

## 🔴 CRITICAL — Security

### S1 · Unauthenticated export endpoints (full data leak)
**File:** `backend/apps/inspections/views.py` — `DailyProductionReportViewSet`, `DowntimeReportViewSet`  
**Status:** ❌ Not fixed  
**Problem:** `get_permissions()` returns `[]` for `export_pdf` and `export_excel` actions — anyone on the internet can download all production/downtime data with no token:
```python
def get_permissions(self):
    if self.action in ['export_excel', 'export_pdf']:
        return []   # ← NO authentication!
    return [IsAuthenticated()]
```
**Fix:** Return `[IsAuthenticated()]` (or `[IsSupervisorOrAbove()]`) for export actions.

---

### NEW-S1 · `LoginView` auto-creates privileged admin accounts — production backdoor
**File:** `backend/apps/users/views.py:47–73`  
**Severity:** 🔴 CRITICAL — Security  
**Problem:** `LoginView.post()` auto-creates user accounts for the hardcoded usernames `supervisor`, `admin`, `operator`, `inspector` if they don't exist, with predictable default passwords (`admin123`, `supervisor123`, etc.). It also silently resets any of these accounts' passwords to the default if the user sends the known default:
```python
if username.lower() in ['supervisor', 'admin', 'operator', 'inspector']:
    user = User.objects.filter(username__iexact=username).first()
    default_pass = f"{username.lower()}123"
    if user:
        if not user.check_password(password) and (password == default_pass or ...):
            user.set_password(password)   # ← resets to known default!
            user.save()
    else:
        new_user = User(username=..., is_superuser=username.lower() == 'admin')
        new_user.set_password(password if password else default_pass)
        new_user.save()   # ← anyone can create a superuser account!
```
In production, any attacker can:
1. POST `{ "username": "admin", "password": "admin123" }` to create a superuser if it doesn't exist
2. POST same to reset an existing admin's password to `admin123`  

This is an **authentication bypass / persistent backdoor**.  
**Fix:** Remove this entire auto-create block entirely. Use a management command (`manage.py create_demo_users`) to seed dev/staging data. This code must never run in production.

---

### S2 · JWT token exposed in WebSocket URL
**File:** `dashboard/src/context/WebSocketContext.jsx:15`  
**Status:** ❌ Not fixed  
**Problem:** Access token appended as URL query parameter — appears in server logs, browser history, referrer headers:
```javascript
const url = `${WS_BASE_URL}/ws/dashboard/${plantId}/?token=${token}`;
```
**Fix:** Establish the connection without the token, then send it in the first message after `onopen`, and validate it in `receive()` on the consumer side.

---

### S3 · WebSocket consumer accepts unauthenticated connections
**File:** `backend/apps/dashboard/consumers.py:20–32`  
**Status:** ❌ Not fixed  
**Problem:** `connect()` never checks `scope['user']`. Any client without a valid JWT token can connect and subscribe to live inspection events.  
**Fix:**
```python
async def connect(self):
    if self.scope['user'].is_anonymous:
        await self.close()
        return
    # ... rest of connect
```

---

### S4 · Server disk path disclosed in voice API response
**File:** `backend/apps/voice/views.py:78`  
**Status:** ❌ Not fixed  
**Problem:** The API 202 response includes the server-relative audio file path:
```python
return Response({
    'job_id': job_id,
    'audio_path': f'voice_uploads/{filename}',   # ← info disclosure
    ...
})
```
**Fix:** Remove the `audio_path` key from the response. The client only needs `job_id` to poll for status.

---

### S5 · Disk path stored in Redis and returned to client via job status
**File:** `backend/apps/voice/tasks.py:130`  
**Status:** ❌ Not fixed  
**Problem:** The Redis result dict includes the absolute server-side file path:
```python
cache.set(f"voice_job_{job_id}", {
    'status': 'done',
    'audio_path': file_path,   # ← absolute server path exposed to client
    ...
})
```
This path is returned verbatim by `VoiceStatusView.get()`.  
**Fix:** Remove `'audio_path': file_path` from the dict before caching.

---

### S6 · Redundant `CORS_ALLOW_ALL_ORIGINS = True` at line 149
**File:** `backend/config/settings.py:149, 317`  
**Status:** ❌ Not fixed  
**Problem:** `CORS_ALLOW_ALL_ORIGINS = True` is set unconditionally at line 149, then correctly overridden to `DEBUG` at line 317. The setting at line 149 is dead because it's overridden, but it's a landmine — if line 317 is ever removed or the file is reorganised, all CORS restrictions silently disappear.  
**Fix:** Delete line 149 entirely. Keep only the correct conditional assignment at line 317.

---

### S7 · MongoDB URI (with credentials) logged at startup
**File:** `backend/config/db.py:31`  
**Status:** ❌ Not fixed  
**Problem:** `get_mongo_client()` logs the full `MONGODB_URI` which may contain username/password:
```python
logger.info("MongoDB client initialised: %s", settings.MONGODB_URI)
```
If the URI is `mongodb://user:p@ssw0rd@host:27017`, credentials appear in server logs.  
**Fix:** Log only the host, masking credentials:
```python
from urllib.parse import urlparse
parsed = urlparse(settings.MONGODB_URI)
logger.info("MongoDB client initialised: %s://%s%s", parsed.scheme, parsed.hostname, parsed.path)
```

---

## 🟠 HIGH — Functional Bugs / Silent Wrong Data

### H1 · Reminder worker launches on every Daphne process start (double worker)
**File:** `backend/apps/inspections/apps.py:10`  
**Status:** ❌ Not fixed  
**Problem:** Guard condition `if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('SERVER_SOFTWARE')` still fires under Daphne because Daphne never sets `RUN_MAIN`. Both worker instances poll the DB every 30 seconds — duplicate reminders sent to operators.  
**Fix:** Replace the guard with a proper threading lock inside `start_reminder_worker()` and rely on the `_worker_started` flag with a lock (once H2 is fixed):
```python
os.environ.setdefault('SERVER_SOFTWARE', 'daphne')  # in asgi.py entry point
# Then in apps.py:
if not os.environ.get('SERVER_SOFTWARE', '').startswith('daphne') or \
   os.environ.get('RUN_ONCE_WORKER') == 'true':
```

---

### H2 · Race condition in `_worker_started` flag (no lock)
**File:** `backend/apps/inspections/reminder_worker.py:117–124`  
**Status:** ❌ Not fixed  
**Problem:** `_worker_started` is a plain global `bool`. Under multi-threaded startup, two threads can both read `False` and both call `thread.start()`.  
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
**File:** `backend/apps/inspections/views.py:73–80`  
**Status:** ❌ Not fixed  
**Problem:** `except Part.DoesNotExist` falls through to `Part.objects.filter(is_active=True).first()` — silently uses any available part instead of returning HTTP 404. The operator proceeds with wrong part parameters.  
**Fix:** Return `Response({'error': 'Part not found'}, status=404)` in the except block.

---

### H4 · Race condition in session creation (duplicate sessions possible)
**File:** `backend/apps/inspections/services.py` — `create_session()`  
**Status:** ❌ Not fixed  
**Problem:** Existence check and subsequent `create()` are separate DB calls with no transaction or lock. Two simultaneous POST requests can create duplicate sessions for the same machine+part+shift.  
**Fix:** Use `get_or_create()` inside `transaction.atomic()` with `select_for_update()`, or add a `unique_together` constraint and handle `IntegrityError`.

---

### H5 · Whisper model singleton not thread-safe
**File:** `backend/apps/voice/whisper_engine.py:17–78`  
**Status:** ❌ Not fixed  
**Problem:** `_get_local_model()` checks `if _whisper_model is None` with no lock. Two concurrent voice transcription requests will both see `None` and both load the model, doubling RAM usage (Whisper tiny ≈ 150 MB × 2 = 300 MB on a free-tier container).  
**Fix:**
```python
_model_lock = threading.Lock()

def _get_local_model():
    global _whisper_model, _is_faster_whisper
    with _model_lock:
        if _whisper_model is None:
            # ... load model
    return _whisper_model, _is_faster_whisper, load_ms, was_cached
```

---

### H6 · Uploaded audio files never deleted (disk leak)
**File:** `backend/apps/voice/tasks.py:58–141`  
**Status:** ❌ Not fixed  
**Problem:** `_run_transcription()` never calls `os.unlink(file_path)` on the audio file after transcription succeeds or fails. `MEDIA_ROOT/voice_uploads/` fills with orphaned audio files indefinitely.  
**Fix:** Add cleanup in `_run_transcription()`:
```python
try:
    # ... transcription logic
finally:
    try:
        os.unlink(file_path)
    except OSError:
        pass
```

---

### NEW-H1 · `ClearHistoryView` deletes finalized/approved sessions unconditionally
**File:** `backend/apps/inspections/views.py:710–735`  
**Severity:** 🟠 HIGH  
**Problem:** `ClearHistoryView.delete()` docstring claims "Finalized reports remain permanent" but the code unconditionally deletes ALL sessions for a machine with no status filter:
```python
active_sessions = InspectionSession.objects.filter(machine_id=machine_id)
active_sessions.delete()                  # ← deletes finalized/approved records too!
delete_many({"machine_id": machine_id})   # ← wipes MongoDB docs too!
```
An operator or supervisor pressing "Clear History" on any machine permanently deletes finalized quality records, violating the contract stated in the docstring and destroying audit trail data.  
**Fix:** Restrict deletion to non-finalized sessions:
```python
DELETABLE_STATUSES = ['in_progress', 'completed']
active_sessions = InspectionSession.objects.filter(
    machine_id=machine_id,
    status__in=DELETABLE_STATUSES
)
```

---

### NEW-H2 · Django ORM model instances cached in Redis (not reliably pickle-safe)
**File:** `backend/apps/inspections/services.py:42–61` — `_get_cached_parameter()`  
**Severity:** 🟠 HIGH  
**Problem:** `_get_cached_parameter()` stores `InspectionParameter` Django ORM objects directly into the Redis/LocMem cache. Django model instances hold lazy-loaded related managers, database state, and deferred field descriptors that are not reliably serializable across Python processes or after schema changes:
```python
cache.set(cache_key, parameter, ...)   # ← persisting ORM model instance
```
When deserialized later (especially on multi-worker setups or after a deploy), this can produce `AttributeError`, type mismatches, or silently wrong tolerance values.  
**Fix:** Cache only the scalar fields needed for tolerance checks:
```python
cache.set(cache_key, {
    'id': parameter.id,
    'parameter_code': parameter.parameter_code,
    'nominal': parameter.nominal,
    'upper_tolerance': parameter.upper_tolerance,
    'lower_tolerance': parameter.lower_tolerance,
    'is_critical': parameter.is_critical,
}, timeout=300)
```

---

### NEW-H3 · N+1 MongoDB `find_one()` calls inside loops in `get_session_document()`
**File:** `backend/apps/inspections/services.py:864–992` — `get_session_document()`  
**Severity:** 🟠 HIGH  
**Problem:** The merge introduced a 128-line `get_session_document()` that issues individual `find_one()` calls inside `for` loops — a classic N+1 pattern:
```python
for fp_session in fp_sessions:
    doc = self.collection.find_one({"session_id": fp_session["session_id"]})  # N queries
for hourly in hourly_sessions:
    doc = self.collection.find_one({"session_id": hourly["session_id"]})       # M queries
```
For a machine with 8 hourly sessions + 3 first-piece trials: each call to `get_session_document()` fires **11+ sequential MongoDB round-trips**. Since `record_measurement()` calls this for every parameter recorded, and M2 from V1 already identified N+1 reads, this compounds the problem severely.  
**Fix:** Collect all session IDs first, then fetch with a single `find()` query:
```python
all_ids = [s["session_id"] for s in fp_sessions + hourly_sessions]
docs = {d["session_id"]: d for d in self.collection.find({"session_id": {"$in": all_ids}})}
```

---

## 🟡 MEDIUM — Performance / Reliability

### M1 · New thread spawned per WebSocket event (thread churn)
**File:** `backend/apps/inspections/services.py:39`  
**Status:** ❌ Not fixed  
**Problem:** `_dispatch_async_websocket()` starts a new `threading.Thread` for every WebSocket push. During a busy shift with measurements every few seconds, this can spawn dozens of threads per minute.  
**Fix:** Replace with a module-level `queue.Queue` consumed by a single long-lived dispatch thread (same pattern as `ReminderWorkerThread`).

---

### M2 · N+1 MongoDB reads in `record_measurement()`
**File:** `backend/apps/inspections/services.py`  
**Status:** ❌ Not fixed (worsened by NEW-H3)  
**Problem:** Every call to `record_measurement()` calls `get_session_document()`, which itself now spawns 11+ `find_one()` queries (see NEW-H3). For parameter-by-parameter recording, a 10-parameter session makes 110+ MongoDB queries.  
**Fix:** Fetch the session document once at the start of a measurement batch and reuse it within the request.

---

### M3 · `DowntimeReportViewSet.history()` has no pagination
**File:** `backend/apps/inspections/views.py:1330–1371`  
**Status:** ❌ Not fixed  
**Problem:** `history()` action returns all downtime report records with no limit — unbounded table scan that grows over time.  
**Fix:** Apply `self.paginate_queryset()` and return `self.get_paginated_response(serializer.data)`.

---

### M4 · Two separate `InspectionService()` instances
**File:** `backend/apps/inspections/tasks.py:31`, `backend/apps/inspections/views.py:40`  
**Status:** ❌ Not fixed  
**Problem:** Both modules independently instantiate `_service = InspectionService()`. Any cached state is duplicated; two separate MongoDB connections are opened unnecessarily.  
**Fix:** Add a module-level singleton in `services.py`:
```python
_default_service = InspectionService()
```
Import it in both modules: `from .services import _default_service as _service`.

---

### NEW-M1 · `CORS_ALLOWED_ORIGINS` defined twice — first definition is dead code
**File:** `backend/config/settings.py:150–156, 318–319`  
**Severity:** 🟡 MEDIUM  
**Problem:** The static list at lines 150–156 is completely overridden by the env-var-driven assignment at lines 318–319:
```python
# Lines 150-156 (dead — overridden below)
CORS_ALLOWED_ORIGINS = [
    'https://ledger-entry-dashboard.onrender.com',
    'http://localhost:3000',
    ...
]

# Lines 318-319 (the real value)
_cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,...').split(',')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins if origin.strip()]
```
The static list (including the production Render URL) is never actually used. If `CORS_ALLOWED_ORIGINS` env var is not set in production, the default in `os.getenv(...)` may not include all required origins.  
**Fix:** Delete lines 150–156. Add `https://ledger-entry-dashboard.onrender.com` to the `os.getenv` default value or configure it as the env var.

---

## 🟢 LOW — Code Quality / Dead Code / Minor Issues

### L1 · Duplicate imports of `Part` and `Machine`
**File:** `backend/apps/inspections/views.py:11–12, 24–25`  
**Status:** ❌ Not fixed  
Both models imported twice. Delete the duplicate import lines 24–25.

---

### L2 · `dispatch_measurement_task_async()` was dead code
**Status:** ✅ **FIXED** — Now contains real Celery-with-thread-fallback logic and is the intended async dispatch path. No longer dead code.

---

### L3 · `apps/voice/models.py` was entirely empty
**Status:** ✅ **FIXED** — The file with only a placeholder comment is gone; voice app uses no Django models (logs go to MongoDB directly).

---

### L4 · `word2number` imported inside function (repeated runtime import)
**File:** `backend/apps/voice/number_parser.py:107, 132`  
**Status:** ❌ Not fixed  
`from word2number import w2n` is called inside `_try_word2number()` and `_words_to_decimal_digits()` on every parse call. Move to top of file:
```python
try:
    from word2number import w2n
    _W2N_AVAILABLE = True
except ImportError:
    _W2N_AVAILABLE = False
```

---

### L5 · `DowntimeReport.save()` calls `self.full_clean()` — breaks bulk operations
**File:** `backend/apps/inspections/models.py:219`  
**Status:** ❌ Not fixed  
`save()` calls `full_clean()` which runs all validators including the `clean()` method. This raises `ValidationError` from `bulk_create()`, management commands, and signals. `PositiveIntegerField` already enforces `>= 0` at the DB level.  
**Fix:** Remove `self.full_clean()` from `save()`. Keep `clean()` for form/serializer-level validation.

---

### L6 · `PLANT_ID` hardcoded in dashboard
**File:** `dashboard/src/pages/DashboardPage.jsx:17`  
**Status:** ❌ Not fixed  
```javascript
const PLANT_ID = 1; // default plant — can be made dynamic
```
Multi-plant support is blocked. Read from URL params or user profile.

---

### L7 · WebSocket reconnect has no exponential backoff
**File:** `dashboard/src/context/WebSocketContext.jsx:40`  
**Status:** ❌ Not fixed  
Fixed 3-second reconnect causes all clients to hammer the backend simultaneously on restart. Implement exponential backoff (start 1s, double each attempt, cap 30s, add jitter).

---

### L8 · `SupervisorOverrideView` checks permission manually
**File:** `backend/apps/inspections/views.py:473–474`  
**Status:** ❌ Not fixed  
Manually checks `request.user.is_supervisor or request.user.is_staff` instead of using the existing `IsSupervisorOrAbove` permission class.  
**Fix:** `permission_classes = [IsSupervisorOrAbove]`

---

## Files Affected (Summary)

| File | Issues |
|------|--------|
| `backend/apps/inspections/services.py` | C2, H4, M1, M2, M4, NEW-H2, NEW-H3 |
| `backend/apps/inspections/views.py` | C1, H3, S1, NEW-H1, L1, L8, M3 |
| `backend/apps/inspections/reminder_worker.py` | C3, C4, H2 |
| `backend/apps/dashboard/consumers.py` | C4, S3 |
| `backend/apps/inspections/apps.py` | H1 |
| `backend/apps/voice/tasks.py` | S5, H6 |
| `backend/apps/voice/views.py` | S4 |
| `backend/apps/voice/whisper_engine.py` | H5 |
| `backend/apps/voice/number_parser.py` | L4 |
| `backend/apps/inspections/models.py` | L5 |
| `backend/apps/inspections/tasks.py` | M4 |
| `backend/apps/users/views.py` | NEW-S1 |
| `backend/config/settings.py` | S6, NEW-M1 |
| `backend/config/db.py` | S7 |
| `dashboard/src/context/WebSocketContext.jsx` | S2, L7 |
| `dashboard/src/pages/DashboardPage.jsx` | L6 |

---

## Recommended Fix Priority

Fix in this order for maximum impact with minimum risk:

1. **NEW-S1** — Remove `LoginView` auto-create backdoor immediately (5-min fix, production risk)
2. **C1** — Fix `get_session_detail` → `get_session_document` (1-line fix, current crash)
3. **S1** — Add auth to export endpoints (1-line fix per action, active data leak)
4. **NEW-H1** — Add status filter to `ClearHistoryView` before data is lost
5. **C3 + C4** — Fix group name + add `dashboard_event` handler (alerts are dead until fixed)
6. **S3** — Add anonymous check in WebSocket `connect()`
7. **C2** — Remove wrong-parameter fallbacks in `record_measurement()`
8. **H5** — Add lock to Whisper model singleton
9. **H6** — Add `finally: os.unlink(file_path)` in transcription
10. **NEW-H2** — Cache only scalar fields, not ORM instances
11. **NEW-H3 + M2** — Batch MongoDB queries in `get_session_document()`
12. *(all remaining issues in severity order)*

---

*End of Audit Report V2*
