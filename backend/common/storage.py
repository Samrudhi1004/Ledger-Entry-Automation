"""Cloudinary-backed Django storage for durable user uploads."""

from pathlib import PurePosixPath
from urllib.request import urlopen
from uuid import uuid4

import cloudinary.api
import cloudinary.uploader
from cloudinary.utils import cloudinary_url, private_download_url
from django.core.files.storage import Storage


class CloudinaryMediaStorage(Storage):
    """Store images, videos, and raw documents with one Django backend."""

    _IMAGE_EXTENSIONS = {
        '.avif', '.bmp', '.gif', '.heic', '.ico', '.jpeg', '.jpg',
        '.png', '.svg', '.tif', '.tiff', '.webp',
    }
    _VIDEO_EXTENSIONS = {'.avi', '.m4v', '.mov', '.mp4', '.webm'}
    _PREFIX = 'cloudinary/'

    @classmethod
    def _resource_type(cls, name):
        extension = PurePosixPath(name).suffix.lower()
        if extension in cls._IMAGE_EXTENSIONS:
            return 'image'
        if extension in cls._VIDEO_EXTENSIONS:
            return 'video'
        return 'raw'

    @classmethod
    def _asset(cls, name):
        if name.startswith(cls._PREFIX):
            resource_type, encoded = name[len(cls._PREFIX):].split('/', 1)
            public_id, separator, file_format = encoded.rpartition('~')
            if not separator:
                public_id, file_format = encoded, ''
            if resource_type == 'raw' and file_format and public_id.lower().endswith(f'.{file_format.lower()}'):
                public_id = public_id[:-(len(file_format) + 1)]
            return resource_type, public_id, file_format

        resource_type = cls._resource_type(name)
        path = PurePosixPath(name)
        file_format = path.suffix.lstrip('.').lower()
        public_id = path.with_suffix('').as_posix()
        return resource_type, public_id, file_format

    def _save(self, name, content):
        path = PurePosixPath(str(name).replace('\\', '/'))
        resource_type = self._resource_type(path.name)
        file_format = path.suffix.lstrip('.').lower()
        folder = path.parent.as_posix()
        public_id = uuid4().hex
        if folder != '.':
            public_id = f'{folder}/{public_id}'
        result = cloudinary.uploader.upload(
            content,
            public_id=public_id,
            resource_type=resource_type,
            overwrite=False,
        )
        actual_public_id = result['public_id']
        actual_format = result.get('format') or file_format
        if resource_type == 'raw' and actual_format and actual_public_id.lower().endswith(f'.{actual_format.lower()}'):
            actual_public_id = actual_public_id[:-(len(actual_format) + 1)]
        return f'{self._PREFIX}{resource_type}/{actual_public_id}~{actual_format}'

    def get_available_name(self, name, max_length=None):
        # _save assigns a UUID, so checking Cloudinary first only wastes an API call.
        return name

    def _open(self, name, mode='rb'):
        if mode not in ('r', 'rb'):
            raise ValueError('Cloudinary storage is read-only after upload.')
        response = urlopen(self.url(name), timeout=30)
        try:
            response.name = PurePosixPath(name).name
        except (AttributeError, TypeError):
            pass
        return response

    def delete(self, name):
        resource_type, public_id, _ = self._asset(name)
        cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)

    def exists(self, name):
        resource_type, public_id, _ = self._asset(name)
        try:
            cloudinary.api.resource(public_id, resource_type=resource_type)
            return True
        except Exception:
            return False

    def size(self, name):
        resource_type, public_id, _ = self._asset(name)
        return cloudinary.api.resource(public_id, resource_type=resource_type)['bytes']

    def url(self, name):
        resource_type, public_id, file_format = self._asset(name)
        if resource_type == 'raw' and file_format:
            return private_download_url(
                public_id,
                format=file_format,
                resource_type='raw',
                type='upload',
                attachment=False,
                secure=True,
            )

        options = {'resource_type': resource_type, 'secure': True}
        if file_format:
            options['format'] = file_format
        return cloudinary_url(public_id, **options)[0]
