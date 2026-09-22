"""
Notification Engine for Initial Document Control Lifecycle.
Dispatches in-app notifications and async transactional emails for:
  - Document Review Requested
  - Document Approval Requested
  - Document Approved
  - Document Rejected
"""

import logging
from django.conf import settings
from ..models import DCRNotification
from .dcr_mailer import _send_async_email, _render_email_template

logger = logging.getLogger('apps.document_control')


def notify_doc_review_requested(doc):
    """Notify assigned reviewer when document is submitted for review."""
    if not doc.reviewed_by:
        return

    reviewer = doc.reviewed_by
    title = f"Review Requested: {doc.document_number}"
    msg = f"You have been assigned to review controlled document {doc.document_number} : {doc.title}."

    DCRNotification.objects.create(
        document=doc,
        recipient=reviewer,
        title=title,
        message=msg,
        action_type=DCRNotification.ActionType.DOC_REVIEW_REQUESTED,
        action_url=f"/document-control/documents?preview={doc.id}"
    )

    if reviewer.email:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        action_url = f"{frontend_url}/document-control/documents?preview={doc.id}"
        details = {
            "Doc Number": doc.document_number,
            "Description": doc.title,
            "Level": doc.doc_level,
            "Revision": doc.revision,
            "Prepared by": f"{doc.uploaded_by.first_name} {doc.uploaded_by.last_name}".strip() or doc.uploaded_by.username,
        }
        html = _render_email_template(
            header_title="Controlled Document Review",
            badge_text="REVIEW REQUIRED",
            badge_color="#2563eb",
            intro_text=f"A new quality document has been submitted and assigned to you for review.",
            details=details,
            action_url=action_url,
            action_text="Open Document Register"
        )
        _send_async_email(f"[Document Control] Review Required: {doc.document_number}", msg, html, [reviewer.email])


def notify_doc_approval_requested(doc):
    """Notify assigned approver when document is reviewed and awaiting sign-off."""
    if not doc.approved_by:
        return

    approver = doc.approved_by
    title = f"Approval Requested: {doc.document_number}"
    msg = f"Document {doc.document_number} : {doc.title} has been reviewed and requires your final approval."

    DCRNotification.objects.create(
        document=doc,
        recipient=approver,
        title=title,
        message=msg,
        action_type=DCRNotification.ActionType.DOC_APPROVAL_REQUESTED,
        action_url=f"/document-control/documents?preview={doc.id}"
    )

    if approver.email:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        action_url = f"{frontend_url}/document-control/documents?preview={doc.id}"
        reviewed_by_name = f"{doc.reviewed_by.first_name} {doc.reviewed_by.last_name}".strip() if doc.reviewed_by else "System"
        details = {
            "Doc Number": doc.document_number,
            "Description": doc.title,
            "Level": doc.doc_level,
            "Revision": doc.revision,
            "Reviewed by": reviewed_by_name,
            "Effective from": str(doc.effective_date or 'Immediate'),
        }
        html = _render_email_template(
            header_title="Controlled Document Approval",
            badge_text="APPROVAL REQUIRED",
            badge_color="#7c3aed",
            intro_text=f"This document has undergone preliminary review and is now submitted for your final authorization.",
            details=details,
            action_url=action_url,
            action_text="Review & Authorize"
        )
        _send_async_email(f"[Document Control] Approval Required: {doc.document_number}", msg, html, [approver.email])


def notify_doc_approved(doc):
    """Notify uploader and reviewer that document has been approved and is effective."""
    recipients = []
    if doc.uploaded_by:
        recipients.append(doc.uploaded_by)
    if doc.reviewed_by and doc.reviewed_by != doc.uploaded_by:
        recipients.append(doc.reviewed_by)

    title = f"Document Approved: {doc.document_number}"
    msg = f"Controlled document {doc.document_number} : {doc.title} (Rev {doc.revision}) has been approved and is now active."

    for user in recipients:
        DCRNotification.objects.create(
            document=doc,
            recipient=user,
            title=title,
            message=msg,
            action_type=DCRNotification.ActionType.DOC_APPROVED,
            action_url=f"/document-control/documents?preview={doc.id}"
        )

    emails = [u.email for u in recipients if u.email]
    if emails:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        action_url = f"{frontend_url}/document-control/documents?preview={doc.id}"
        approved_by_name = f"{doc.approved_by.first_name} {doc.approved_by.last_name}".strip() if doc.approved_by else "System"
        details = {
            "Doc Number": doc.document_number,
            "Description": doc.title,
            "Level": doc.doc_level,
            "Revision": doc.revision,
            "Approved by": approved_by_name,
            "Effective Date": str(doc.effective_date or 'Immediate'),
        }
        html = _render_email_template(
            header_title="Document Approved & Released",
            badge_text="APPROVED & ACTIVE",
            badge_color="#059669",
            intro_text=f"The controlled document has been officially approved and published to the active Quality Register.",
            details=details,
            action_url=action_url,
            action_text="View in Register"
        )
        _send_async_email(f"[Document Control] Document Approved: {doc.document_number}", msg, html, emails)


def notify_doc_rejected(doc, reason=""):
    """Notify uploader that document was rejected with reasons."""
    if not doc.uploaded_by:
        return

    uploader = doc.uploaded_by
    title = f"Document Rejected: {doc.document_number}"
    msg = f"Controlled document {doc.document_number} : {doc.title} was rejected. Reason: {reason or 'No reason provided'}"

    DCRNotification.objects.create(
        document=doc,
        recipient=uploader,
        title=title,
        message=msg,
        action_type=DCRNotification.ActionType.DOC_REJECTED,
        action_url=f"/document-control/documents?preview={doc.id}"
    )

    if uploader.email:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        action_url = f"{frontend_url}/document-control/documents?preview={doc.id}"
        details = {
            "Doc Number": doc.document_number,
            "Description": doc.title,
            "Revision": doc.revision,
            "Rejection Reason": reason or "Please consult the quality department for details.",
        }
        html = _render_email_template(
            header_title="Document Change Rejected",
            badge_text="REJECTED",
            badge_color="#dc2626",
            intro_text="The submitted document could not be approved at this time.",
            details=details,
            action_url=action_url,
            action_text="View Document"
        )
        _send_async_email(f"[Document Control] Document Rejected: {doc.document_number}", msg, html, [uploader.email])
