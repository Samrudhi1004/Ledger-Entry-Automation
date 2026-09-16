# Voice-Driven Machine Inspection & Ledger Automation — Backend Implementation Plan

## Overview

A Django REST API backend for a factory floor quality inspection system where operators use voice input (Whisper Local → API) to record measurements against part tolerances. Results are validated in real-time and pushed to a supervisor dashboard via WebSocket.

## Confirmed Tech Stack

| Layer | Technology |
|---|---|
| Framework | Django 6.0.7 + Django REST Framework |
| Auth | JWT (djangorestframework-simplejwt) |
| Structured DB | PostgreSQL (Users, Machines, Parts, Templates) |
| Document DB | MongoDB via PyMongo (Inspection Records, Voice Logs) |
| Speech-to-Text | Whisper Local (`openai-whisper`) → Whisper API (later) |
| Number Parser | `word2number` + custom Regex |
| Realtime | Django Channels + Redis (WebSocket) |
| Background Tasks | Celery + Redis (optional, for notifications) |
| CORS | django-cors-headers |

---

## Build Order (Dependency-First)

```
Phase 1: Foundation        → requirements, settings, db config
Phase 2: users/            → models, JWT, roles
Phase 3: machines/         → factory, plant, machine
Phase 4: parts/            → part number, inspection template, parameters, tolerances
Phase 5: inspections/      → inspection record, validation engine, status
Phase 6: voice/            → audio upload, Whisper STT, number parser
Phase 7: dashboard/        → WebSocket consumers, live feed
Phase 8: analytics/        → reports, trends, OOC alerts
```

---

## Phase 1 — Foundation

### [MODIFY] requirements.txt
Add all new dependencies:
```
# Database
psycopg2-binary          # PostgreSQL (already exists)
pymongo                  # MongoDB direct driver
python-dotenv            # env vars (already exists)

# Auth
djangorestframework-simplejwt  # (already exists)

# Speech-to-Text
openai-whisper           # Whisper Local
ffmpeg-python            # audio preprocessing

# Number Parsing
word2number              # "point five two" → 0.52

# Realtime
channels                 # Django Channels
channels-redis           # Redis channel layer
daphne                   # ASGI server

# Utilities
Pillow                   # image handling (optional)
```

### [MODIFY] config/settings.py
- Load env vars via `python-dotenv`
- Add PostgreSQL as `default` database
- Add MongoDB connection via PyMongo (custom db connector, NOT in DATABASES)
- Add `channels` to INSTALLED_APPS
- Add `CHANNEL_LAYERS` config (Redis)
- Add `SIMPLE_JWT` config (access=60min, refresh=7days)
- Add `CORS_ALLOWED_ORIGINS`
- Add `REST_FRAMEWORK` default auth classes

### [MODIFY] config/asgi.py
- Wrap Django with `ProtocolTypeRouter` for HTTP + WebSocket

### [NEW] config/db.py
- `get_mongo_db()` — returns PyMongo database connection (singleton pattern)

### [MODIFY] .env
Add:
```
DB_NAME=inspection_db
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432

MONGODB_URI=mongodb://localhost:27017
MONGODB_NAME=voice_inspection_db

REDIS_URL=redis://localhost:6379

WHISPER_MODEL=base   # options: tiny, base, small, medium, large
WHISPER_BACKEND=local  # local | api
OPENAI_API_KEY=       # for later when switching to API
```

---

## Phase 2 — `apps/users/`

### [MODIFY] apps/users/models.py
```python
class User(AbstractUser):
    ROLES = [Operator, Supervisor, Admin, QualityEngineer]
    role        = CharField(choices=ROLES)
    employee_id = CharField(unique=True)
    plant       = ForeignKey(Plant)   # assigned plant
    phone       = CharField()
    is_active   = BooleanField()
```

### [NEW] apps/users/serializers.py
- `UserRegistrationSerializer`
- `UserLoginSerializer`
- `UserProfileSerializer`
- `TokenRefreshSerializer`

### [NEW] apps/users/views.py
- `RegisterView`         → POST /api/users/register/
- `LoginView`            → POST /api/users/login/  (returns JWT pair)
- `LogoutView`           → POST /api/users/logout/
- `ProfileView`          → GET/PUT /api/users/me/
- `UserListView`         → GET /api/users/ (Admin only)

### [NEW] apps/users/permissions.py
- `IsOperator`, `IsSupervisor`, `IsAdmin`, `IsQualityEngineer`

### [NEW] apps/users/urls.py

---

## Phase 3 — `apps/machines/`

### [MODIFY] apps/machines/models.py
```python
class Factory(Model):
    name, code, location, is_active

class Plant(Model):
    factory (FK), name, code, is_active

class Machine(Model):
    plant (FK), name, machine_code
    machine_type, manufacturer, model_number
    status: [Active, Maintenance, Inactive]
    qr_code (for scan-to-select on Flutter)
```

### [NEW] apps/machines/serializers.py
- `FactorySerializer`, `PlantSerializer`, `MachineSerializer`

### [NEW] apps/machines/views.py
- `FactoryListView`      → GET /api/machines/factories/
- `PlantListView`        → GET /api/machines/plants/?factory=
- `MachineListView`      → GET /api/machines/?plant=
- `MachineDetailView`    → GET /api/machines/<id>/
- `MachineByQRView`      → GET /api/machines/scan/<qr_code>/

### [NEW] apps/machines/urls.py

---

## Phase 4 — `apps/parts/`

This is the most critical app — it holds the **inspection template** (what parameters to measure and their tolerances).

### [MODIFY] apps/parts/models.py
```python
class Part(Model):
    part_number (unique), part_name, description
    machine (FK), is_active

class InspectionTemplate(Model):
    part (FK), version, created_by, is_active
    inspection_types: [first_piece, hourly, final]

class InspectionParameter(Model):
    template (FK)
    parameter_name          # e.g. "Bore Diameter"
    parameter_code          # e.g. "BD-01"
    unit                    # mm, inch, degrees
    nominal_value           # e.g. 25.00
    upper_tolerance         # e.g. +0.02
    lower_tolerance         # e.g. -0.02
    upper_limit             # nominal + upper_tolerance
    lower_limit             # nominal + lower_tolerance
    measurement_type        # [dimensional, visual, weight]
    is_critical             # bool — triggers alert if OOC
    sequence_order          # display order
```

### [NEW] apps/parts/serializers.py
- `PartSerializer`
- `InspectionTemplateSerializer`
- `InspectionParameterSerializer`

### [NEW] apps/parts/views.py
- `PartListView`             → GET /api/parts/?machine=
- `PartDetailView`           → GET /api/parts/<part_number>/
- `TemplateByPartView`       → GET /api/parts/<part_number>/template/
- `ParameterListView`        → GET /api/parts/templates/<id>/parameters/

### [NEW] apps/parts/urls.py

---

## Phase 5 — `apps/inspections/`

Core business logic — validation engine lives here.

### MongoDB Collection: `inspection_records`
```json
{
  "_id": ObjectId,
  "inspection_session_id": "uuid",
  "part_number": "PN-001",
  "machine_code": "MCH-01",
  "operator_id": 5,
  "supervisor_id": 3,
  "inspection_type": "first_piece",
  "shift": "A",
  "status": "pending|approved|rejected",
  "started_at": ISODate,
  "completed_at": ISODate,
  "measurements": [
    {
      "parameter_code": "BD-01",
      "parameter_name": "Bore Diameter",
      "nominal": 25.00,
      "upper_limit": 25.02,
      "lower_limit": 24.98,
      "measured_value": 25.01,
      "unit": "mm",
      "status": "ok|out_of_spec",
      "voice_raw_text": "twenty five point zero one",
      "voice_audio_file": "path/to/file.wav",
      "recorded_at": ISODate,
      "method": "voice|manual"
    }
  ],
  "supervisor_remark": "",
  "approved_at": null
}
```

### [MODIFY] apps/inspections/models.py (PostgreSQL — lightweight index only)
```python
class InspectionSession(Model):
    session_id (UUID, unique)   # links to MongoDB doc
    part (FK), machine (FK)
    operator (FK User), supervisor (FK User)
    inspection_type, shift
    status: [in_progress, pending_review, approved, rejected]
    started_at, completed_at
    has_ooc_parameters (bool)   # quick flag
```

### [NEW] apps/inspections/services.py — Validation Engine
```python
class ToleranceValidator:
    def validate(measured_value, parameter) → ValidationResult
    # Returns: status, deviation, is_critical_fail

class InspectionService:
    def create_session(...)
    def record_measurement(session_id, parameter_code, value, voice_text)
    def complete_session(session_id)
    def get_session_document(session_id)  # from MongoDB
```

### [NEW] apps/inspections/views.py
- `StartInspectionView`      → POST /api/inspections/start/
- `RecordMeasurementView`    → POST /api/inspections/<session_id>/measure/
- `CompleteInspectionView`   → POST /api/inspections/<session_id>/complete/
- `SessionDetailView`        → GET  /api/inspections/<session_id>/
- `PendingReviewView`        → GET  /api/inspections/pending/ (Supervisor)
- `ApproveRejectView`        → POST /api/inspections/<session_id>/review/

### [NEW] apps/inspections/urls.py

---

## Phase 6 — `apps/voice/`

### [NEW] apps/voice/whisper_engine.py
```python
class WhisperEngine:
    backend = settings.WHISPER_BACKEND  # 'local' | 'api'

    def transcribe(audio_file_path) → str:
        if backend == 'local':
            # use openai-whisper model loaded at startup
        elif backend == 'api':
            # call openai.Audio.transcribe()
```

### [NEW] apps/voice/number_parser.py
```python
class NumberParser:
    def parse(text: str) → float | None:
        # Step 1: Try direct float regex  "25.01" → 25.01
        # Step 2: word2number              "twenty five" → 25
        # Step 3: Handle "point X"         "point five" → 0.5
        # Step 4: Handle negative          "minus 3" → -3.0
        # Step 5: Handle units             "25.5 mm" → 25.5
        # Returns None if unparseable → triggers "Ask Again"
```

### [MODIFY] apps/voice/views.py
- `VoiceUploadView` → POST /api/voice/transcribe/
  - Accepts: audio file (WAV/M4A/MP3)
  - Returns: `{ raw_text, parsed_value, confidence }`

### [NEW] apps/voice/urls.py

---

## Phase 7 — `apps/dashboard/`

### [NEW] apps/dashboard/consumers.py
```python
class InspectionConsumer(AsyncWebsocketConsumer):
    # Group: "plant_{plant_id}"
    # Events:
    #   - measurement_recorded
    #   - out_of_spec_alert
    #   - session_completed
    #   - supervisor_action
```

### [NEW] apps/dashboard/routing.py
```python
websocket_urlpatterns = [
    path("ws/dashboard/<plant_id>/", InspectionConsumer.as_asgi())
]
```

### [NEW] apps/dashboard/views.py
- `LiveStatusView`   → GET /api/dashboard/live/?plant=
- `ShiftSummaryView` → GET /api/dashboard/shift-summary/

---

## Phase 8 — `apps/analytics/`

### [NEW] apps/analytics/views.py
- `InspectionReportView`     → GET /api/analytics/report/?from=&to=&machine=
- `OOCTrendView`             → GET /api/analytics/ooc-trend/
- `MachinePerformanceView`   → GET /api/analytics/machine/<id>/performance/
- `OperatorStatsView`        → GET /api/analytics/operator/<id>/stats/
- `ExportReportView`         → GET /api/analytics/export/ (CSV/PDF)

---

## Verification Plan

### After each phase:
- Run `python manage.py check` — no errors
- Run `python manage.py makemigrations && migrate`
- Test endpoints with `curl` or Postman

### Full integration test:
1. Register operator → Login → get JWT
2. Select machine → load template
3. POST audio file → get parsed value
4. POST measurement → validate tolerance
5. WebSocket client connects → receives live update
6. Supervisor approves → record updated in MongoDB

---

## Open Questions

> [!IMPORTANT]
> **Shift system** — Does your factory run 2 shifts or 3? (A/B or A/B/C) — affects inspection session model

> [!IMPORTANT]
> **Report format** — Do supervisors need PDF export of inspection sheets? Or just on-screen?

> [!NOTE]
> **Whisper model size** — `base` model recommended to start (fast, runs on CPU). Can upgrade to `small` or `medium` for better accuracy with accented speech.

> [!NOTE]
> **`common/` folder** — Currently in backend but not in your target structure. Should it be kept as shared utilities (e.g., base models, pagination)?
