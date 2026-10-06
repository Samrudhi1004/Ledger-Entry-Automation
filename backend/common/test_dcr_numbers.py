from contextlib import nullcontext
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from common.dcr_numbers import next_dcr_number


class DCRNumberTests(SimpleTestCase):
    @patch('common.dcr_numbers.apps.get_model')
    @patch('common.dcr_numbers.transaction.atomic')
    @patch('common.dcr_numbers.connection')
    def test_persists_prefix_and_acquires_lock_before_incrementing(self, connection, atomic, get_model):
        model = MagicMock()
        model._meta.label_lower = 'documents.change'
        sequence_model = MagicMock()
        sequence = MagicMock(next_value=9)
        sequence_model.objects.select_for_update.return_value.get_or_create.return_value = (sequence, False)
        get_model.return_value = sequence_model
        atomic.return_value = nullcontext()

        events = []
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.execute.side_effect = lambda *args: events.append('lock')
        sequence_model.objects.select_for_update.return_value.get_or_create.side_effect = (
            lambda **kwargs: (events.append('sequence'), (sequence, False))[1]
        )
        sequence.save.side_effect = lambda **kwargs: events.append('save')

        number = next_dcr_number(model, 'DCR-2026-', 3)

        self.assertEqual(number, 'DCR-2026-009')
        self.assertEqual(events, ['lock', 'sequence', 'save'])
        get_model.assert_called_once_with('document_control', 'DCRNumberSequence')
        sequence_model.objects.select_for_update.return_value.get_or_create.assert_called_once_with(
            prefix='DCR-2026-',
        )
        cursor.execute.assert_called_once_with(
            'SELECT pg_advisory_xact_lock(hashtext(%s))',
            ['documents.change:DCR-2026-'],
        )
