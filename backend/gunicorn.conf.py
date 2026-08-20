# gunicorn.conf.py — Render production configuration
import multiprocessing

# ── Workers ────────────────────────────────────────────────────────────────
# UvicornWorker is required for Django Channels / ASGI
worker_class = "uvicorn.workers.UvicornWorker"

# 1 worker on Render Free (512 MB RAM).  Increase to 2 on paid plans.
workers = 1

# ── Timeouts ───────────────────────────────────────────────────────────────
# Whisper-tiny cold-downloads from HuggingFace in ~16 s on Render.
# Give workers 120 s to finish startup before gunicorn kills them.
timeout = 120

# Graceful shutdown window
graceful_timeout = 30

# Keep-alive for idle connections
keepalive = 5

# ── Binding ────────────────────────────────────────────────────────────────
bind = "0.0.0.0:10000"

# ── Logging ────────────────────────────────────────────────────────────────
accesslog = "-"
errorlog = "-"
loglevel = "info"
