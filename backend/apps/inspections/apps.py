import os
from django.apps import AppConfig


class InspectionsConfig(AppConfig):
    name = 'apps.inspections'

    def ready(self):
        # Avoid running worker twice during Django autoreload
        if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('SERVER_SOFTWARE'):
            try:
                from .reminder_worker import start_reminder_worker
                start_reminder_worker()
            except Exception as e:
                print(f"Failed to start reminder worker: {e}")
