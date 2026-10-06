"""Concurrency-safe DCR number generation for PostgreSQL."""

from django.db import connection
from django.db.models import IntegerField, Max
from django.db.models.functions import Cast, Substr


def next_dcr_number(model, prefix, width):
    """Return the next suffix while serializing generators for this prefix."""
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT pg_advisory_xact_lock(hashtext(%s))',
            [f'{model._meta.label_lower}:{prefix}'],
        )

    current = model.objects.filter(dcr_number__startswith=prefix).aggregate(
        maximum=Max(Cast(Substr('dcr_number', len(prefix) + 1), IntegerField()))
    )['maximum'] or 0
    return f'{prefix}{current + 1:0{width}d}'
