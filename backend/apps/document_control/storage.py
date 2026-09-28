"""Helpers for delivering files stored in Cloudinary."""

import os

try:
    from cloudinary.utils import private_download_url
except ImportError:  # pragma: no cover - Cloudinary is required in deployment
    private_download_url = None


def document_delivery_url(document):
    """Return a browser-readable URL for a stored document file."""
    if not document.cloudinary_url or not document.cloudinary_public_id:
        return document.cloudinary_url

    # Images already use a public image delivery URL. Raw files (PDF, DOCX,
    # XLSX, etc.) require Cloudinary's signed download endpoint in this cloud.
    if document.file_type and document.file_type.startswith('image/'):
        return document.cloudinary_url
    if private_download_url is None:
        return document.cloudinary_url

    extension = os.path.splitext(document.file_name or '')[1].lstrip('.').lower()
    if not extension:
        return document.cloudinary_url

    try:
        return private_download_url(
            document.cloudinary_public_id,
            format=extension,
            resource_type='raw',
            type='upload',
            attachment=False,
        )
    except Exception:
        return document.cloudinary_url
