from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from common.dcr_numbers import next_dcr_number


class DCRNumberTests(SimpleTestCase):
    @patch('common.dcr_numbers.connection')
    def test_locks_prefix_and_uses_highest_existing_suffix(self, connection):
        model = MagicMock()
        model._meta.label_lower = 'documents.change'
        model.objects.filter.return_value.aggregate.return_value = {'maximum': 9}
        cursor = connection.cursor.return_value.__enter__.return_value

        number = next_dcr_number(model, 'DCR-2026-', 3)

        self.assertEqual(number, 'DCR-2026-010')
        cursor.execute.assert_called_once_with(
            'SELECT pg_advisory_xact_lock(hashtext(%s))',
            ['documents.change:DCR-2026-'],
        )
