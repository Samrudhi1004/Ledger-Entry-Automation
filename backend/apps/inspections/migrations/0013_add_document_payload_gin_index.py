# Generated 2026-09-08 — MongoDB → PostgreSQL migration: GIN index on document_payload

from django.db import migrations


class Migration(migrations.Migration):
    """
    Adds a PostgreSQL GIN index on the 'measurements' key inside document_payload.
    This accelerates JSONB array element queries used in analytics views
    (e.g. jsonb_array_elements(document_payload->'measurements')).
    """

    dependencies = [
        ('inspections', '0012_add_document_payload_setup_approval'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS idx_inspection_session_doc_measurements
                ON inspection_sessions
                USING GIN ((document_payload -> 'measurements'));
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS idx_inspection_session_doc_measurements;
            """,
        ),
    ]
