"""Concurrency-safe, persistent DCR number generation for PostgreSQL."""

from django.apps import apps
from django.db import connection, transaction
from django.db.models import F


def next_dcr_number(model, prefix, width):
    """Reserve and return the next number; issued values survive DCR deletion."""
    sequence_model = apps.get_model('document_control', 'DCRNumberSequence')
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT pg_advisory_xact_lock(hashtext(%s))',
                [f'{model._meta.label_lower}:{prefix}'],
            )

        sequence, _ = sequence_model.objects.select_for_update().get_or_create(
            prefix=prefix,
        )
        current = sequence.next_value
        sequence.next_value = F('next_value') + 1
        sequence.save(update_fields=['next_value'])
    return f'{prefix}{current:0{width}d}'
