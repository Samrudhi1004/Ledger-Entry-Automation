"""
Django settings for Voice-Driven Machine Inspection & Ledger Automation System.
"""

from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

# ─── Base Directory ────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / '.env')


# ─── Security ─────────────────────────────────────────────────
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-insecure-key')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,10.0.2.2,ledger-entry-backend.onrender.com').split(',')


# ─── Installed Apps ───────────────────────────────────────────
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',

    # Local apps
    'apps.users',
    'apps.machines',
    'apps.parts',
    'apps.inspections',
    'apps.voice',
    'apps.dashboard',
    'apps.analytics',
    'apps.calibration',
    'apps.tasks',
]

# ─── Middleware ────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',          # CORS — must be before CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ─── ASGI / WSGI ──────────────────────────────────────────────
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'


import dj_database_url

# ─── Databases ────────────────────────────────────────────────
# PostgreSQL — Structured data (Users, Machines, Parts, Templates)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=True
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'inspection_db'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }

# MongoDB — Document data (Inspection Records, Voice Logs)
# Connection managed via config/db.py using PyMongo
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_NAME = os.getenv('MONGODB_NAME', 'voice_inspection_db')


# ─── Custom User Model ────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'


# ─── Django REST Framework ────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}


# ─── JWT Configuration ────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=int(os.getenv('JWT_ACCESS_TOKEN_LIFETIME', 60))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_LIFETIME', 90))),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}


# ─── CORS ─────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True


USE_REDIS = os.getenv('USE_REDIS', 'false').lower() == 'true'

if USE_REDIS:
    import socket
    try:
        s = socket.create_connection(('127.0.0.1', 6379), timeout=0.5)
        s.close()
    except Exception:
        USE_REDIS = False

if USE_REDIS:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [os.getenv('REDIS_URL', 'redis://localhost:6379')],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }


# ─── Cache (Redis in production, local memory in development) ─
# Redis cache eliminates repeated heavy DB/MongoDB calculations.
# Uses the same USE_REDIS flag and REDIS_URL already defined above,
# so local development (USE_REDIS=false) works without any Redis setup.
if USE_REDIS:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': os.getenv('REDIS_URL', 'redis://localhost:6379'),
            'TIMEOUT': 300,  # 5 minutes — default for analytics data
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'TIMEOUT': 300,
        }
    }


# ─── Celery ───────────────────────────────────────────────────
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'


# ─── Whisper STT ──────────────────────────────────────────────
WHISPER_MODEL   = os.getenv('WHISPER_MODEL', 'tiny')
WHISPER_BACKEND = os.getenv('WHISPER_BACKEND', 'local')
OPENAI_API_KEY  = os.getenv('OPENAI_API_KEY', '')

# Point HuggingFace cache at the .hf_cache folder baked into the build
# artifact by build.sh.  This makes Faster-Whisper load from disk (~500 ms)
# instead of re-downloading from HuggingFace on every Render cold start (~15 s).
# Override via HF_HOME env var on Render if you mount a persistent disk instead.
_HF_HOME_DEFAULT = str(BASE_DIR / '.hf_cache')
os.environ.setdefault('HF_HOME', os.getenv('HF_HOME', _HF_HOME_DEFAULT))


# ─── Password Validation ──────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ─── Internationalisation ─────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True


# ─── Static & Media Files ─────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# ─── Default Primary Key ──────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ─── File Upload ──────────────────────────────────────────────
# Max audio file upload: 25 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024


# ─── Essential Logging Configuration ───────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'console_fmt': {
            'format': '[%(asctime)s] [%(levelname)s] %(name)s: %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'console_fmt',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.server': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'apps.voice': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'apps.inspections': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

CORS_ALLOW_ALL_ORIGINS = DEBUG
_cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:5173,https://ledger-entry-backend.onrender.com').split(',')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins if origin.strip()]

