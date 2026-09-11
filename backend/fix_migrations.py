"""
Fix migration inconsistencies by manually updating the django_migrations table.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection

def fix_migration_history():
    """Manually insert missing migration records."""
    with connection.cursor() as cursor:
        # Check if machines.0006_merge_20260908_1305 exists
        cursor.execute(
            "SELECT COUNT(*) FROM django_migrations WHERE app = %s AND name = %s",
            ['machines', '0006_merge_20260908_1305']
        )
        exists = cursor.fetchone()[0]

        if exists == 0:
            print("Inserting machines.0006_merge_20260908_1305 into migration history...")
            cursor.execute(
                "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
                ['machines', '0006_merge_20260908_1305']
            )
            print("[OK] Successfully inserted machines.0006_merge_20260908_1305")
        else:
            print("[OK] machines.0006_merge_20260908_1305 already exists")

        # Check if calibration.0007 and 0008 exist
        cursor.execute(
            "SELECT COUNT(*) FROM django_migrations WHERE app = %s AND name = %s",
            ['calibration', '0007_calibration_workflow']
        )
        cal_07_exists = cursor.fetchone()[0]

        if cal_07_exists == 0:
            print("Inserting calibration.0007_calibration_workflow...")
            cursor.execute(
                "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
                ['calibration', '0007_calibration_workflow']
            )
            print("[OK] Successfully inserted calibration.0007_calibration_workflow")

        cursor.execute(
            "SELECT COUNT(*) FROM django_migrations WHERE app = %s AND name = %s",
            ['calibration', '0008_backfill_history_card_numbers']
        )
        cal_08_exists = cursor.fetchone()[0]

        if cal_08_exists == 0:
            print("Inserting calibration.0008_backfill_history_card_numbers...")
            cursor.execute(
                "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
                ['calibration', '0008_backfill_history_card_numbers']
            )
            print("[OK] Successfully inserted calibration.0008_backfill_history_card_numbers")

    print("\n[OK] Migration history fixed successfully!")

if __name__ == '__main__':
    fix_migration_history()
