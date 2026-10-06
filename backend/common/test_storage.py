from unittest.mock import MagicMock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from common.storage import CloudinaryMediaStorage


class CloudinaryMediaStorageTests(SimpleTestCase):
    def setUp(self):
        self.storage = CloudinaryMediaStorage()

    @patch('common.storage.cloudinary.uploader.upload')
    def test_routes_images_and_documents_to_durable_asset_types(self, upload):
        upload.side_effect = [
            {'public_id': 'profiles/photo', 'format': 'png'},
            {'public_id': 'task_attachments/report.pdf', 'format': 'pdf'},
        ]

        with patch('common.storage.cloudinary.api.resource') as resource:
            image_name = self.storage.save(
                'profiles/avatar.png',
                SimpleUploadedFile('avatar.png', b'png', content_type='image/png'),
            )
            document_name = self.storage.save(
                'task_attachments/report.pdf',
                SimpleUploadedFile('report.pdf', b'pdf', content_type='application/pdf'),
            )

        resource.assert_not_called()

        self.assertEqual(image_name, 'cloudinary/image/profiles/photo~png')
        self.assertEqual(document_name, 'cloudinary/raw/task_attachments/report.pdf~pdf')
        self.assertEqual(upload.call_args_list[0].kwargs['resource_type'], 'image')
        self.assertEqual(upload.call_args_list[1].kwargs['resource_type'], 'raw')

    @patch('common.storage.urlopen')
    @patch('common.storage.private_download_url', return_value='https://files.example/report.pdf')
    def test_raw_documents_can_be_opened_by_existing_download_views(self, _, open_url):
        response = MagicMock()
        response.read.return_value = b'report contents'
        response.__enter__.return_value = response
        open_url.return_value = response

        file = self.storage.open('cloudinary/raw/control_plans/report.pdf~pdf')

        self.assertEqual(file.read(), b'report contents')
