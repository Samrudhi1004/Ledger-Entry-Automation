"""
Dual Notification Engine for Document Control (Form DKI/MR/F/05).
Creates in-app DCRNotification records and asynchronously dispatches
formatted HTML transactional emails via Mailjet.
"""

import logging
import threading
from django.conf import settings
from django.core.mail import send_mail
from django.utils.html import escape
from ..models import DCRNotification

logger = logging.getLogger('apps.document_control')


def _send_async_email(subject, text_message, html_message, recipient_list):
    """Dispatches email in a daemon thread so the API response is never blocked."""
    def _worker():
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')
        valid_recipients = [r for r in recipient_list if r and '@' in r]
        if not valid_recipients:
            return
        try:
            send_mail(
                subject=subject,
                message=text_message,
                from_email=from_email,
                recipient_list=valid_recipients,
                fail_silently=True,
                html_message=html_message
            )
            logger.info("DCR Email sent to %s with subject '%s'", valid_recipients, subject)
        except Exception as e:
            logger.error("Failed to send DCR email to %s: %s", valid_recipients, str(e))

    threading.Thread(target=_worker, daemon=True).start()


def _render_email_template(header_title, badge_text, badge_color, intro_text, details, action_url, action_text="Open DCR"):
    """Builds a consistent, branded HTML email template for Document Control."""
    details_html = ""
    for label, val in details.items():
        if val:
            details_html += f"""
            <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #475569; font-size: 13px; width: 35%; border-bottom: 1px solid #f1f5f9;">{escape(str(label))}</td>
                <td style="padding: 8px 12px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9;">{escape(str(val))}</td>
            </tr>
            """

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: 'Segoe UI', Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <!-- Header -->
            <tr>
                <td style="background-color: #0f172a; padding: 24px 28px; text-align: left;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700;">Document Control System • DKI/MR/F/05</div>
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 6px;">{escape(header_title)}</div>
                </td>
            </tr>
            <!-- Content -->
            <tr>
                <td style="padding: 28px;">
                    <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: {badge_color}15; color: {badge_color}; font-size: 12px; font-weight: 700; margin-bottom: 16px;">
                        {escape(badge_text)}
                    </div>
                    <p style="font-size: 15px; line-height: 1.5; color: #334155; margin-top: 0; margin-bottom: 20px;">
                        {escape(intro_text)}
                    </p>

                    <!-- Details Table -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                        {details_html}
                    </table>

                    <!-- CTA Button -->
                    {f'<div style="text-align: center; margin-top: 24px;"><a href="{action_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);">{action_text} &rarr;</a></div>' if action_url else ''}
                </td>
            </tr>
            <!-- Footer -->
            <tr>
                <td style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                    This is an automated notification from the Document Control Management System.<br>
                    Please log into the portal to review and manage all change requests.
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def notify_dcr_submitted(dcr):
    """
    Called when a DCR is submitted.
    Notifies assigned CFT Reviewer and Calibrator (if assigned).
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    action_url = f"{frontend_url}/document-control"
    req_name = f"{dcr.raised_by.first_name} {dcr.raised_by.last_name}".strip() or dcr.raised_by.username

    recipients = []
    if dcr.assigned_cft_reviewer:
        recipients.append(dcr.assigned_cft_reviewer)
    if dcr.assigned_calibrator and dcr.assigned_calibrator != dcr.assigned_cft_reviewer:
        recipients.append(dcr.assigned_calibrator)

    for user in recipients:
        # 1. In-App Notification
        DCRNotification.objects.create(
            dcr=dcr,
            recipient=user,
            title=f"DCR {dcr.dcr_number} assigned for your review",
            message=f"{req_name} raised a Change Request for document {dcr.document.document_number} ({dcr.document.title}).",
            action_type=DCRNotification.ActionType.REVIEW_REQUESTED,
            action_url=action_url,
        )

        # 2. Email Notification
        if user.email:
            subject = f"[Action Required] DCR {dcr.dcr_number}: Review Assigned ({dcr.document.document_number})"
            intro = f"Hello {user.first_name or user.username}, a new Document Change Request has been raised and assigned to you for CFT / Calibrator review."
            details = {
                "DCR Number": dcr.dcr_number,
                "Document Code": dcr.document.document_number,
                "Document Title": dcr.document.title,
                "Current Revision": dcr.document.revision,
                "Document Level": dcr.document.get_doc_level_display(),
                "Raised By": req_name,
                "Date of Receipt": str(dcr.date_of_receipt),
                "Basis for Change": dcr.basis_for_change,
            }
            html = _render_email_template(
                header_title="DCR Assigned For Review",
                badge_text="Action Required • Review Pending",
                badge_color="#d97706",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Open DCR for Review"
            )
            text = f"DCR {dcr.dcr_number} has been assigned to you for review.\nDocument: {dcr.document.document_number} — {dcr.document.title}\nRaised by: {req_name}\nLink: {action_url}"
            _send_async_email(subject, text, html, [user.email])


def notify_dcr_reviewed(dcr):
    """
    Called when the CFT Reviewer submits their review.
    Notifies assigned Approver (Admin / MR).
    """
    approver = dcr.assigned_approver
    if not approver:
        return

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    action_url = f"{frontend_url}/document-control"
    rev_name = f"{dcr.reviewed_by.first_name} {dcr.reviewed_by.last_name}".strip() if dcr.reviewed_by else "CFT Reviewer"

    # 1. In-App Notification
    DCRNotification.objects.create(
        dcr=dcr,
        recipient=approver,
        title=f"DCR {dcr.dcr_number} reviewed — awaiting your approval",
        message=f"{rev_name} completed the CFT review for {dcr.document.document_number}. Ready for final authorization.",
        action_type=DCRNotification.ActionType.APPROVAL_REQUESTED,
        action_url=action_url,
    )

    # 2. Email Notification
    if approver.email:
        subject = f"[Action Required] DCR {dcr.dcr_number}: Ready for Approval ({dcr.document.document_number})"
        intro = f"Hello {approver.first_name or approver.username}, the Cross-Functional Team review for DCR {dcr.dcr_number} is complete. It is now awaiting your final approval as Management Representative."
        details = {
            "DCR Number": dcr.dcr_number,
            "Document Code": dcr.document.document_number,
            "Document Title": dcr.document.title,
            "Reviewed By": rev_name,
            "Review Remark": dcr.review_remark,
            "Implementation Date": str(dcr.implementation_date or 'Immediate'),
            "CFT Remarks": dcr.cft_remarks or "—",
            "Calibrator Remarks": dcr.calibrator_remarks or "—",
        }
        html = _render_email_template(
            header_title="DCR Ready For Final Approval",
            badge_text="Action Required • Final Approval",
            badge_color="#4f46e5",
            intro_text=intro,
            details=details,
            action_url=action_url,
            action_text="Authorize / Approve DCR"
        )
        text = f"DCR {dcr.dcr_number} has been reviewed and is ready for your approval.\nDocument: {dcr.document.document_number}\nLink: {action_url}"
        _send_async_email(subject, text, html, [approver.email])


def notify_dcr_rejected(dcr, stage, rejected_by, reason):
    """
    Called when a DCR is rejected at either review stage or approval stage.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    action_url = f"{frontend_url}/document-control"
    rej_name = f"{rejected_by.first_name} {rejected_by.last_name}".strip() if rejected_by else "Reviewer"

    recipients = [dcr.raised_by]
    if stage == 'approval' and dcr.assigned_cft_reviewer and dcr.assigned_cft_reviewer != dcr.raised_by:
        recipients.append(dcr.assigned_cft_reviewer)

    stage_label = "CFT Review" if stage == 'review' else "Final Management Approval"

    for user in recipients:
        DCRNotification.objects.create(
            dcr=dcr,
            recipient=user,
            title=f"DCR {dcr.dcr_number} was rejected at {stage_label}",
            message=f"Rejected by {rej_name}. Reason: {reason}",
            action_type=DCRNotification.ActionType.DCR_REJECTED,
            action_url=action_url,
        )

        if user.email:
            subject = f"[Update] DCR {dcr.dcr_number} Rejected: {dcr.document.document_number}"
            intro = f"Hello {user.first_name or user.username}, Document Change Request {dcr.dcr_number} for '{dcr.document.title}' was rejected during {stage_label}."
            details = {
                "DCR Number": dcr.dcr_number,
                "Document Code": dcr.document.document_number,
                "Document Title": dcr.document.title,
                "Rejected Stage": stage_label,
                "Rejected By": rej_name,
                "Rejection Reason": reason,
            }
            html = _render_email_template(
                header_title="DCR Rejected",
                badge_text="Status: Rejected",
                badge_color="#dc2626",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="View DCR Details"
            )
            text = f"DCR {dcr.dcr_number} was rejected.\nStage: {stage_label}\nBy: {rej_name}\nReason: {reason}"
            _send_async_email(subject, text, html, [user.email])


def notify_dcr_approved(dcr):
    """
    Called when the Approver (Admin / MR) approves the DCR.
    Unlocks revision upload for the requestor.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    action_url = f"{frontend_url}/document-control"
    app_name = f"{dcr.approved_by.first_name} {dcr.approved_by.last_name}".strip() if dcr.approved_by else "Admin"

    recipients = [dcr.raised_by]
    if dcr.assigned_cft_reviewer and dcr.assigned_cft_reviewer != dcr.raised_by:
        recipients.append(dcr.assigned_cft_reviewer)

    for user in recipients:
        DCRNotification.objects.create(
            dcr=dcr,
            recipient=user,
            title=f"DCR {dcr.dcr_number} Approved! Ready for revision upload",
            message=f"Approved by {app_name}. The new document revision can now be uploaded and published.",
            action_type=DCRNotification.ActionType.DCR_APPROVED,
            action_url=action_url,
        )

        if user.email:
            subject = f"[Approved] DCR {dcr.dcr_number} Approved: {dcr.document.document_number}"
            intro = f"Hello {user.first_name or user.username}, Document Change Request {dcr.dcr_number} for '{dcr.document.title}' has been officially approved. The new document revision can now be uploaded."
            details = {
                "DCR Number": dcr.dcr_number,
                "Document Code": dcr.document.document_number,
                "Document Title": dcr.document.title,
                "Approved By": app_name,
                "Date of Approval": str(dcr.date_of_approval.date()) if dcr.date_of_approval else "Today",
                "Management Remarks": dcr.mr_remarks or "Approved as requested.",
            }
            html = _render_email_template(
                header_title="DCR Approved",
                badge_text="Status: Approved",
                badge_color="#059669",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Upload Revised Document"
            )
            text = f"DCR {dcr.dcr_number} for document {dcr.document.document_number} has been approved.\nApproved by: {app_name}\nLink: {action_url}"
            _send_async_email(subject, text, html, [user.email])
