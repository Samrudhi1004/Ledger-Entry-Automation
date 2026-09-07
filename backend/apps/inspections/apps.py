import os
from django.apps import AppConfig


class InspectionsConfig(AppConfig):
    name = 'apps.inspections'

    def ready(self):
        # H1 FIX (step 2/3): Start the reminder worker only in the right process.
        #
        # Old broken guard:
        #   RUN_MAIN == 'true'           → only set by Django dev autoreloader
        #   not SERVER_SOFTWARE          → was never set → always True in production!
        #   Result: worker started on EVERY Daphne process → duplicate alerts.
        #
        # New guard:
        #   SERVER_SOFTWARE == 'daphne'  → set explicitly in asgi.py entry point
        #   RUN_MAIN == 'true'           → dev reloader (runserver) — still works locally
        #
        # The threading.Lock inside start_reminder_worker() (H2 fix) provides
        # the final safety net against simultaneous starts within one process.
        server_sw   = os.environ.get('SERVER_SOFTWARE', '')
        is_daphne   = server_sw.lower().startswith('daphne')
        is_dev_main = os.environ.get('RUN_MAIN') == 'true'

        if is_daphne or is_dev_main:
            try:
                from .reminder_worker import start_reminder_worker
                start_reminder_worker()
            except Exception as e:
                print(f"Failed to start reminder worker: {e}")

