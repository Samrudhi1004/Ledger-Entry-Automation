"""
Dual Notification Engine for Master Parameters & Quality Sign-Off Governance.
Creates in-app DCRNotification records and asynchronously dispatches
formatted HTML transactional emails without blocking the HTTP request thread.
Strictly zero emojis.
"""

import logging
import threading
from django.conf import settings
from django.core.mail import send_mail
from django.utils.html import escape
from apps.document_control.models import DCRNotification

logger = logging.getLogger('apps.parts')


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
            logger.info("Parameters Email sent to %s with subject '%s'", valid_recipients, subject)
        except Exception as e:
            logger.error("Failed to send Parameters email to %s: %s", valid_recipients, str(e))

    threading.Thread(target=_worker, daemon=True).start()


def _render_template_email(header_title, badge_text, badge_color, intro_text, details, action_url, action_text="Open Operation Specification"):
    """Builds a consistent, professional, zero-emoji HTML email template for Master Parameters."""
    details_html = ""
    for label, val in details.items():
        if val is not None and str(val).strip() != '':
            details_html += f"""
            <tr>
                <td style="padding: 10px 14px; font-weight: 600; color: #475569; font-size: 13px; width: 35%; border-bottom: 1px solid #f1f5f9;">{escape(str(label))}</td>
                <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9;">{escape(str(val))}</td>
            </tr>
            """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="620" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
            <td style="background-color: #0f172a; padding: 26px 32px; text-align: left;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #94a3b8; font-weight: 700;">Quality Assurance System • Specification Sign-Off</div>
                <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 6px; letter-spacing: -0.2px;">{escape(header_title)}</div>
            </td>
        </tr>
        <!-- Body -->
        <tr>
            <td style="padding: 32px;">
                <div style="display: inline-block; padding: 5px 14px; border-radius: 16px; background-color: {badge_color}18; color: {badge_color}; font-size: 12px; font-weight: 700; border: 1px solid {badge_color}35; margin-bottom: 18px;">
                    {escape(badge_text)}
                </div>
                <p style="font-size: 14.5px; line-height: 1.6; color: #334155; margin-top: 0; margin-bottom: 22px;">
                    {escape(intro_text)}
                </p>

                <!-- Details Table -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                    {details_html}
                </table>

                <!-- CTA Button -->
                {f'<div style="text-align: center; margin-top: 28px; margin-bottom: 10px;"><a href="{action_url}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 28px; font-size: 13.5px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);">{action_text} &rarr;</a></div>' if action_url else ''}
            </td>
        </tr>
        <!-- Footer -->
        <tr>
            <td style="background-color: #f1f5f9; padding: 18px 32px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
                This is an automated notification from the Factory Quality Governance System.<br>
                Please log into the web dashboard to review, approve, or manage parameter specifications.
            </td>
        </tr>
    </table>
</body>
</html>
"""


def _get_user_display_name(user):
    if not user:
        return "Unknown"
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.username


def notify_template_submitted(template, submitter_notes=None):
    """
    Triggered when an operation inspection template is submitted for review from the popup.
    Sends in-app notifications and emails to:
    1. Assigned Reviewer (Action Required)
    2. Assigned Approver (Advance Notice)
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    part = template.part
    machine = getattr(part, 'machine', None)
    machine_code = machine.machine_code if machine else 'N/A'
    op_name = template.name or template.get_inspection_type_display()
    creator_name = _get_user_display_name(template.created_by)

    # Count parameters
    product_count = template.parameters.count()
    process_count = template.process_parameters.count()
    total_count = product_count + process_count

    action_url = f"{frontend_url}/parameters?part={part.id}&operation={template.id}"
    if machine:
        action_url += f"&machine={machine.id}"

    details = {
        "Part Number": part.part_number,
        "Part Name": getattr(part, 'part_name', '') or getattr(part, 'name', ''),
        "Machine Code": machine_code,
        "Operation": f"{op_name} (v{template.version})",
        "Configured Parameters": f"{total_count} total ({product_count} Product, {process_count} Process)",
        "Submitted By": creator_name,
        "Submission Notes": submitter_notes or "Submitted for Quality sign-off.",
    }

    # 1. Notify Assigned Reviewer
    reviewer = template.assigned_reviewer
    if reviewer:
        rev_name = _get_user_display_name(reviewer)
        DCRNotification.objects.create(
            recipient=reviewer,
            title=f"Review Assigned: {part.part_number} : {op_name}",
            message=f"{creator_name} submitted master parameters ({total_count} items) for your review.",
            action_type=DCRNotification.ActionType.REVIEW_REQUESTED,
            action_url=action_url,
        )

        if reviewer.email:
            subject = f"[Action Required] Review Assigned: Operation Specification for Part {part.part_number}"
            intro = f"Hello {rev_name}, master parameter specifications for {part.part_number} ({op_name}) have been submitted and assigned to you for verification and review."
            html = _render_template_email(
                header_title="Operation Sheet Review Assigned",
                badge_text="Action Required: Review Pending",
                badge_color="#d97706",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Open Operation Sheet to Review"
            )
            text = f"Review Assigned for Part {part.part_number} ({op_name})\nSubmitted By: {creator_name}\nParameters: {total_count}\nLink: {action_url}"
            _send_async_email(subject, text, html, [reviewer.email])

    # 2. Notify Assigned Approver (Advance notice)
    approver = template.assigned_approver
    if approver and approver != reviewer:
        app_name = _get_user_display_name(approver)
        DCRNotification.objects.create(
            recipient=approver,
            title=f"Specification Submitted: {part.part_number} : {op_name}",
            message=f"{creator_name} submitted specifications for review. Final approval will be requested after review.",
            action_type=DCRNotification.ActionType.GENERAL,
            action_url=action_url,
        )

        if approver.email:
            subject = f"[Notice] Operation Specification Submitted: Part {part.part_number} ({op_name})"
            intro = f"Hello {app_name}, master parameter specifications for {part.part_number} ({op_name}) have been submitted and are currently undergoing reviewer verification prior to your final sign-off."
            html = _render_template_email(
                header_title="Operation Sheet Submitted (Pending Review)",
                badge_text="Status: Under Review",
                badge_color="#0284c7",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="View Operation Sheet"
            )
            text = f"Specification Submitted for Part {part.part_number} ({op_name})\nReviewer Assigned: {_get_user_display_name(reviewer)}\nLink: {action_url}"
            _send_async_email(subject, text, html, [approver.email])


def notify_template_reviewed(template, reviewer_user, action, remarks=""):
    """
    Triggered when a reviewer submits recommendation or rejection.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    part = template.part
    machine = getattr(part, 'machine', None)
    op_name = template.name or template.get_inspection_type_display()
    rev_name = _get_user_display_name(reviewer_user)

    action_url = f"{frontend_url}/parameters?part={part.id}&operation={template.id}"
    if machine:
        action_url += f"&machine={machine.id}"

    product_count = template.parameters.count()
    process_count = template.process_parameters.count()

    details = {
        "Part Number": part.part_number,
        "Operation": f"{op_name} (v{template.version})",
        "Parameters": f"{product_count + process_count} total ({product_count} Product, {process_count} Process)",
        "Reviewed By": rev_name,
        "Review Decision": "Recommended for Final Approval" if action == 'recommend' else "Rejected / Revisions Requested",
        "Reviewer Remarks": remarks or "Verified without remarks.",
    }

    if action == 'recommend':
        # 1. Notify Assigned Approver (Action Required)
        approver = template.assigned_approver
        if approver:
            app_name = _get_user_display_name(approver)
            DCRNotification.objects.create(
                recipient=approver,
                title=f"Ready for Final Sign-Off: {part.part_number} : {op_name}",
                message=f"{rev_name} completed the review and recommended this specification for final approval.",
                action_type=DCRNotification.ActionType.APPROVAL_REQUESTED,
                action_url=action_url,
            )

            if approver.email:
                subject = f"[Action Required] Final Sign-Off: Operation Specification for Part {part.part_number}"
                intro = f"Hello {app_name}, {rev_name} has verified and recommended the master parameters for {part.part_number} ({op_name}). The sheet is now awaiting your final authorization to go live."
                html = _render_template_email(
                    header_title="Specification Ready For Sign-Off",
                    badge_text="Action Required: Final Approval",
                    badge_color="#4f46e5",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="Authorize / Approve Specification"
                )
                text = f"Operation specification {part.part_number} ({op_name}) recommended by {rev_name}.\nAwaiting your final approval: {action_url}"
                _send_async_email(subject, text, html, [approver.email])

        # 2. Notify Creator
        creator = template.created_by
        if creator and creator != reviewer_user:
            DCRNotification.objects.create(
                recipient=creator,
                title=f"Review Recommended: {part.part_number} : {op_name}",
                message=f"{rev_name} recommended your specification. It is now awaiting final sign-off.",
                action_type=DCRNotification.ActionType.GENERAL,
                action_url=action_url,
            )
            if creator.email:
                subject = f"[Update] Specification Recommended: Part {part.part_number}"
                intro = f"Hello {_get_user_display_name(creator)}, your operation specification for {part.part_number} has been recommended by {rev_name} and passed to the final approver."
                html = _render_template_email(
                    header_title="Specification Recommended",
                    badge_text="Status: Reviewed",
                    badge_color="#10b981",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="View Specification"
                )
                text = f"Specification for {part.part_number} recommended by {rev_name}.\nLink: {action_url}"
                _send_async_email(subject, text, html, [creator.email])

    elif action == 'reject':
        # Notify Creator of rejection
        creator = template.created_by
        if creator:
            DCRNotification.objects.create(
                recipient=creator,
                title=f"Revisions Requested: {part.part_number} : {op_name}",
                message=f"Reviewer {rev_name} returned the specification for corrections: {remarks}",
                action_type=DCRNotification.ActionType.DCR_REJECTED,
                action_url=action_url,
            )
            if creator.email:
                subject = f"[Correction Required] Specification Returned: Part {part.part_number}"
                intro = f"Hello {_get_user_display_name(creator)}, reviewer {rev_name} returned the specification for {part.part_number} ({op_name}) back to draft for adjustments."
                html = _render_template_email(
                    header_title="Specification Returned for Revision",
                    badge_text="Status: Revision Requested",
                    badge_color="#dc2626",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="Open Specification to Revise"
                )
                text = f"Specification for {part.part_number} returned by {rev_name}.\nReason: {remarks}\nLink: {action_url}"
                _send_async_email(subject, text, html, [creator.email])


def notify_template_approved(template, approver_user, action, remarks=""):
    """
    Triggered when an approver signs off (publishes) or rejects the template.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    part = template.part
    machine = getattr(part, 'machine', None)
    op_name = template.name or template.get_inspection_type_display()
    app_name = _get_user_display_name(approver_user)

    action_url = f"{frontend_url}/parameters?part={part.id}&operation={template.id}"
    if machine:
        action_url += f"&machine={machine.id}"

    product_count = template.parameters.count()
    process_count = template.process_parameters.count()

    details = {
        "Part Number": part.part_number,
        "Operation": f"{op_name} (v{template.version})",
        "Parameters": f"{product_count + process_count} total ({product_count} Product, {process_count} Process)",
        "Authorized By": app_name,
        "Approval Decision": "Approved & Live on Shop Floor" if action == 'approve' else "Rejected at Final Authorization",
        "Sign-Off Comments": remarks or "Approved for production run.",
    }

    recipients = []
    if template.created_by:
        recipients.append(template.created_by)
    if template.assigned_reviewer and template.assigned_reviewer not in recipients:
        recipients.append(template.assigned_reviewer)

    if action == 'approve':
        for user in recipients:
            DCRNotification.objects.create(
                recipient=user,
                title=f"Specification Live: {part.part_number} : {op_name}",
                message=f"Approved by {app_name}. Master parameters are now locked and live on shop floor mobile checklists.",
                action_type=DCRNotification.ActionType.DOC_APPROVED,
                action_url=action_url,
            )

            if user.email:
                subject = f"[Approved & Live] Operation Specification Authorized: Part {part.part_number}"
                intro = f"Hello {_get_user_display_name(user)}, master parameter specifications for {part.part_number} ({op_name}) have been authorized by {app_name}. The sheet is now active on mobile operator devices."
                html = _render_template_email(
                    header_title="Operation Sheet Approved & Live",
                    badge_text="Status: Live & Locked (Form DKI/MR/F/05 Applies)",
                    badge_color="#059669",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="View Live Specification"
                )
                text = f"Specification for {part.part_number} ({op_name}) approved by {app_name}.\nLink: {action_url}"
                _send_async_email(subject, text, html, [user.email])

    elif action == 'reject':
        for user in recipients:
            DCRNotification.objects.create(
                recipient=user,
                title=f"Rejected at Final Sign-Off: {part.part_number} : {op_name}",
                message=f"Rejected by final approver {app_name}. Reason: {remarks}",
                action_type=DCRNotification.ActionType.DOC_REJECTED,
                action_url=action_url,
            )

            if user.email:
                subject = f"[Notice] Operation Specification Rejected by Approver: Part {part.part_number}"
                intro = f"Hello {_get_user_display_name(user)}, master parameter specifications for {part.part_number} ({op_name}) were rejected during final approval by {app_name}."
                html = _render_template_email(
                    header_title="Specification Rejected at Sign-Off",
                    badge_text="Status: Rejected",
                    badge_color="#dc2626",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="Open Specification"
                )
                text = f"Specification for {part.part_number} rejected by {app_name}.\nReason: {remarks}\nLink: {action_url}"
                _send_async_email(subject, text, html, [user.email])


def notify_template_dcr_event(dcr, event_type, actor_user, remarks=""):
    """
    Triggered when a Template DCR (Form DKI/MR/F/05) is raised, reviewed, approved, or rejected.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    template = dcr.template
    part = template.part
    machine = getattr(part, 'machine', None)
    actor_name = _get_user_display_name(actor_user)

    action_url = f"{frontend_url}/parameters?part={part.id}&operation={template.id}&tab=dcr"
    if machine:
        action_url += f"&machine={machine.id}"

    details = {
        "DCR Number": dcr.dcr_number,
        "Form Reference": dcr.form_doc_no,
        "Part Number": part.part_number,
        "Operation": template.name or template.get_inspection_type_display(),
        "Change Type": dcr.get_change_type_display(),
        "Parameter Affected": f"{dcr.parameter_code} : {dcr.parameter_name}",
        "Basis for Change": dcr.basis_for_change,
        "Action By": actor_name,
        "Remarks": remarks or "-",
    }

    if event_type == 'submitted':
        # Notify DCR assigned reviewer & approver
        targets = []
        if dcr.assigned_reviewer:
            targets.append((dcr.assigned_reviewer, 'reviewer'))
        if dcr.assigned_approver and dcr.assigned_approver != dcr.assigned_reviewer:
            targets.append((dcr.assigned_approver, 'approver'))

        for user, role in targets:
            DCRNotification.objects.create(
                recipient=user,
                title=f"DCR {dcr.dcr_number} Raised: {part.part_number}",
                message=f"{actor_name} raised a Change Request ({dcr.get_change_type_display()}) for parameter {dcr.parameter_code}.",
                action_type=DCRNotification.ActionType.REVIEW_REQUESTED if role == 'reviewer' else DCRNotification.ActionType.GENERAL,
                action_url=action_url,
            )
            if user.email:
                subject = f"[Action Required] DCR {dcr.dcr_number}: Review Assigned for Part {part.part_number}"
                intro = f"Hello {_get_user_display_name(user)}, a Document Change Request ({dcr.form_doc_no}) has been initiated for locked parameters of Part {part.part_number}."
                html = _render_template_email(
                    header_title=f"DCR {dcr.dcr_number} Raised",
                    badge_text="Form DKI/MR/F/05 • Review Pending",
                    badge_color="#d97706",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="Open DCR for Review"
                )
                _send_async_email(subject, f"DCR {dcr.dcr_number} raised for {part.part_number}\nLink: {action_url}", html, [user.email])

    elif event_type == 'reviewed':
        if dcr.assigned_approver:
            approver = dcr.assigned_approver
            DCRNotification.objects.create(
                recipient=approver,
                title=f"DCR {dcr.dcr_number} Reviewed: Ready for Approval",
                message=f"{actor_name} reviewed DCR {dcr.dcr_number} for {part.part_number}. Ready for final sign-off.",
                action_type=DCRNotification.ActionType.APPROVAL_REQUESTED,
                action_url=action_url,
            )
            if approver.email:
                subject = f"[Action Required] DCR {dcr.dcr_number}: Ready for Approval ({part.part_number})"
                intro = f"Hello {_get_user_display_name(approver)}, DCR {dcr.dcr_number} has been reviewed and recommended by {actor_name}."
                html = _render_template_email(
                    header_title=f"DCR {dcr.dcr_number} Reviewed",
                    badge_text="Form DKI/MR/F/05 • Approval Pending",
                    badge_color="#4f46e5",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="Authorize DCR"
                )
                _send_async_email(subject, f"DCR {dcr.dcr_number} reviewed by {actor_name}\nLink: {action_url}", html, [approver.email])

    elif event_type == 'approved':
        # Notify requestor and reviewer
        notify_users = [dcr.raised_by]
        if dcr.assigned_reviewer and dcr.assigned_reviewer != dcr.raised_by:
            notify_users.append(dcr.assigned_reviewer)

        for user in notify_users:
            DCRNotification.objects.create(
                recipient=user,
                title=f"DCR {dcr.dcr_number} Approved & Implemented",
                message=f"Approved by {actor_name}. Parameters have been updated automatically in the master database.",
                action_type=DCRNotification.ActionType.DCR_APPROVED,
                action_url=action_url,
            )
            if user.email:
                subject = f"[Approved] DCR {dcr.dcr_number} Approved: Part {part.part_number}"
                intro = f"Hello {_get_user_display_name(user)}, DCR {dcr.dcr_number} for {part.part_number} has been approved by {actor_name} and changes have taken effect immediately."
                html = _render_template_email(
                    header_title=f"DCR {dcr.dcr_number} Approved",
                    badge_text="Form DKI/MR/F/05 • Approved & Implemented",
                    badge_color="#059669",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="View Updated Parameters"
                )
                _send_async_email(subject, f"DCR {dcr.dcr_number} approved by {actor_name}\nLink: {action_url}", html, [user.email])


# ─────────────────────────────────────────────────────────────────────────────
# Engineering Drawing Sign-Off Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_drawing_submitted(drawing, submitter_notes=''):
    """Notifies designated Reviewer and Approver when an Engineering Drawing is submitted."""
    actor_name = _get_user_display_name(drawing.created_by) if drawing.created_by else 'Engineering Supervisor'
    part_str = f"{drawing.part.part_number} : {drawing.part.part_name}" if drawing.part else "General Engineering Print"
    action_url = "/development/drawings"

    details = {
        "Drawing Number": drawing.drawing_number,
        "Drawing Title": drawing.title,
        "Drawing Type": drawing.get_doc_type_display(),
        "Revision": drawing.current_revision,
        "Linked Part": part_str,
        "Submitted By": actor_name,
        "Engineering Notes": submitter_notes or "Initial submission for formal engineering sign-off.",
    }

    targets = []
    if drawing.assigned_reviewer:
        targets.append((drawing.assigned_reviewer, 'reviewer'))
    if drawing.assigned_approver and drawing.assigned_approver != drawing.assigned_reviewer:
        targets.append((drawing.assigned_approver, 'approver'))

    for user, role in targets:
        DCRNotification.objects.create(
            recipient=user,
            title=f"Drawing {drawing.drawing_number} Submitted for Review",
            message=f"{actor_name} submitted drawing {drawing.drawing_number} ({drawing.current_revision}) for verification.",
            action_type=DCRNotification.ActionType.REVIEW_REQUESTED if role == 'reviewer' else DCRNotification.ActionType.GENERAL,
            action_url=action_url,
        )
        if user.email:
            subject = f"[Action Required] Drawing {drawing.drawing_number}: Review Assigned ({drawing.current_revision})"
            intro = f"Hello {_get_user_display_name(user)}, Engineering Drawing {drawing.drawing_number} ({drawing.title}) has been submitted by {actor_name} for verification."
            html = _render_template_email(
                header_title=f"Drawing {drawing.drawing_number} Submitted",
                badge_text="Engineering Drawing : Review Pending",
                badge_color="#d97706",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Open Drawings Repository"
            )
            _send_async_email(subject, f"Drawing {drawing.drawing_number} submitted for review.\nLink: {action_url}", html, [user.email])


def notify_drawing_reviewed(drawing, reviewer_user, action, comments=''):
    """Notifies Approver or Submitter when an Engineering Drawing is reviewed."""
    actor_name = _get_user_display_name(reviewer_user)
    part_str = f"{drawing.part.part_number} : {drawing.part.part_name}" if drawing.part else "General Engineering Print"
    action_url = "/development/drawings"

    details = {
        "Drawing Number": drawing.drawing_number,
        "Drawing Title": drawing.title,
        "Revision": drawing.current_revision,
        "Linked Part": part_str,
        "Reviewed By": actor_name,
        "Review Decision": "Recommended for Approval" if action == 'recommend' else "Rejected / Returned to Draft",
        "Review Comments": comments or "-",
    }

    if action == 'recommend' and drawing.assigned_approver:
        approver = drawing.assigned_approver
        DCRNotification.objects.create(
            recipient=approver,
            title=f"Drawing {drawing.drawing_number} Ready for Final Approval",
            message=f"{actor_name} verified and recommended drawing {drawing.drawing_number} ({drawing.current_revision}).",
            action_type=DCRNotification.ActionType.APPROVAL_REQUESTED,
            action_url=action_url,
        )
        if approver.email:
            subject = f"[Action Required] Drawing {drawing.drawing_number}: Ready for Final Approval ({drawing.current_revision})"
            intro = f"Hello {_get_user_display_name(approver)}, Drawing {drawing.drawing_number} has been verified and recommended by {actor_name} and is awaiting final authorization."
            html = _render_template_email(
                header_title=f"Drawing {drawing.drawing_number} Verified",
                badge_text="Engineering Drawing : Final Approval Pending",
                badge_color="#2563eb",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Review & Authorize Drawing"
            )
            _send_async_email(subject, f"Drawing {drawing.drawing_number} ready for approval.\nLink: {action_url}", html, [approver.email])

    elif action == 'reject' and drawing.created_by:
        submitter = drawing.created_by
        DCRNotification.objects.create(
            recipient=submitter,
            title=f"Drawing {drawing.drawing_number} Returned for Revision",
            message=f"{actor_name} rejected drawing {drawing.drawing_number} during review: {comments or 'Revisions requested.'}",
            action_type=DCRNotification.ActionType.DCR_REJECTED,
            action_url=action_url,
        )
        if submitter.email:
            subject = f"[Action Required] Drawing {drawing.drawing_number}: Returned for Revision"
            intro = f"Hello {_get_user_display_name(submitter)}, Drawing {drawing.drawing_number} was reviewed by {actor_name} and returned for revision."
            html = _render_template_email(
                header_title=f"Drawing {drawing.drawing_number} Returned",
                badge_text="Engineering Drawing : Revision Required",
                badge_color="#dc2626",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Open Drawing Details"
            )
            _send_async_email(subject, f"Drawing {drawing.drawing_number} returned for revision.\nLink: {action_url}", html, [submitter.email])


def notify_drawing_approved(drawing, approver_user, action, comments=''):
    """Notifies Submitter and Reviewer when an Engineering Drawing is approved or rejected."""
    actor_name = _get_user_display_name(approver_user)
    part_str = f"{drawing.part.part_number} : {drawing.part.part_name}" if drawing.part else "General Engineering Print"
    action_url = "/development/drawings"

    details = {
        "Drawing Number": drawing.drawing_number,
        "Drawing Title": drawing.title,
        "Revision": drawing.current_revision,
        "Linked Part": part_str,
        "Authorized By": actor_name,
        "Decision": "Approved & Released" if action == 'approve' else "Rejected",
        "Approval Remarks": comments or "-",
    }

    notify_users = []
    if drawing.created_by:
        notify_users.append(drawing.created_by)
    if drawing.assigned_reviewer and drawing.assigned_reviewer != drawing.created_by:
        notify_users.append(drawing.assigned_reviewer)

    for user in notify_users:
        if action == 'approve':
            DCRNotification.objects.create(
                recipient=user,
                title=f"Drawing {drawing.drawing_number} Approved & Released",
                message=f"Drawing {drawing.drawing_number} ({drawing.current_revision}) was approved by {actor_name}. Active revision locked.",
                action_type=DCRNotification.ActionType.DCR_APPROVED,
                action_url=action_url,
            )
            if user.email:
                subject = f"[Approved] Drawing {drawing.drawing_number} Approved: Rev {drawing.current_revision}"
                intro = f"Hello {_get_user_display_name(user)}, Engineering Drawing {drawing.drawing_number} has been officially approved and released by {actor_name}."
                html = _render_template_email(
                    header_title=f"Drawing {drawing.drawing_number} Approved",
                    badge_text="Engineering Drawing : Approved & Released",
                    badge_color="#15803d",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="View Released Drawing"
                )
                _send_async_email(subject, f"Drawing {drawing.drawing_number} approved by {actor_name}.\nLink: {action_url}", html, [user.email])
        else:
            DCRNotification.objects.create(
                recipient=user,
                title=f"Drawing {drawing.drawing_number} Rejected by Approver",
                message=f"Drawing {drawing.drawing_number} was rejected by {actor_name}: {comments or 'Rejected during final approval.'}",
                action_type=DCRNotification.ActionType.DCR_REJECTED,
                action_url=action_url,
            )


# ─────────────────────────────────────────────────────────────────────────────
# Process Control Plan Sign-Off Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_control_plan_submitted(control_plan, submitter_notes=''):
    """Notifies designated Reviewer and Approver when a Process Control Plan is submitted."""
    actor_name = _get_user_display_name(control_plan.created_by) if control_plan.created_by else 'Process Engineer'
    part_str = f"{control_plan.part.part_number} : {control_plan.part.part_name}" if control_plan.part else "General Manufacturing Control Plan"
    action_url = "/development/control-plans"

    details = {
        "Control Plan Number": control_plan.control_plan_number,
        "Title": control_plan.title,
        "Phase": control_plan.get_phase_display(),
        "Revision": control_plan.current_revision,
        "Linked Part": part_str,
        "Submitted By": actor_name,
        "Submission Notes": submitter_notes or "Initial submission for formal control plan review.",
    }

    targets = []
    if control_plan.assigned_reviewer:
        targets.append((control_plan.assigned_reviewer, 'reviewer'))
    if control_plan.assigned_approver and control_plan.assigned_approver != control_plan.assigned_reviewer:
        targets.append((control_plan.assigned_approver, 'approver'))

    for user, role in targets:
        DCRNotification.objects.create(
            recipient=user,
            title=f"Control Plan {control_plan.control_plan_number} Submitted for Review",
            message=f"{actor_name} submitted Control Plan {control_plan.control_plan_number} ({control_plan.current_revision}) for verification.",
            action_type=DCRNotification.ActionType.REVIEW_REQUESTED if role == 'reviewer' else DCRNotification.ActionType.GENERAL,
            action_url=action_url,
        )
        if user.email:
            subject = f"[Action Required] Control Plan {control_plan.control_plan_number}: Review Assigned ({control_plan.current_revision})"
            intro = f"Hello {_get_user_display_name(user)}, Process Control Plan {control_plan.control_plan_number} ({control_plan.title}) has been submitted by {actor_name} for verification."
            html = _render_template_email(
                header_title=f"Control Plan {control_plan.control_plan_number} Submitted",
                badge_text="Process Control Plan : Review Pending",
                badge_color="#d97706",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Open Control Plans Hub"
            )
            _send_async_email(subject, f"Control Plan {control_plan.control_plan_number} submitted for review.\nLink: {action_url}", html, [user.email])


def notify_control_plan_reviewed(control_plan, reviewer_user, action, comments=''):
    """Notifies Approver or Submitter when a Process Control Plan is reviewed."""
    actor_name = _get_user_display_name(reviewer_user)
    part_str = f"{control_plan.part.part_number} : {control_plan.part.part_name}" if control_plan.part else "General Manufacturing Control Plan"
    action_url = "/development/control-plans"

    details = {
        "Control Plan Number": control_plan.control_plan_number,
        "Title": control_plan.title,
        "Phase": control_plan.get_phase_display(),
        "Revision": control_plan.current_revision,
        "Linked Part": part_str,
        "Reviewed By": actor_name,
        "Review Decision": "Recommended for Approval" if action == 'recommend' else "Rejected / Returned to Draft",
        "Review Comments": comments or "-",
    }

    if action == 'recommend' and control_plan.assigned_approver:
        approver = control_plan.assigned_approver
        DCRNotification.objects.create(
            recipient=approver,
            title=f"Control Plan {control_plan.control_plan_number} Ready for Approval",
            message=f"{actor_name} verified and recommended Control Plan {control_plan.control_plan_number} ({control_plan.current_revision}).",
            action_type=DCRNotification.ActionType.APPROVAL_REQUESTED,
            action_url=action_url,
        )
        if approver.email:
            subject = f"[Action Required] Control Plan {control_plan.control_plan_number}: Ready for Approval ({control_plan.current_revision})"
            intro = f"Hello {_get_user_display_name(approver)}, Control Plan {control_plan.control_plan_number} has been verified and recommended by {actor_name} and is awaiting final authorization."
            html = _render_template_email(
                header_title=f"Control Plan {control_plan.control_plan_number} Verified",
                badge_text="Process Control Plan : Final Approval Pending",
                badge_color="#2563eb",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Authorize Control Plan"
            )
            _send_async_email(subject, f"Control Plan {control_plan.control_plan_number} ready for approval.\nLink: {action_url}", html, [approver.email])

    elif action == 'reject' and control_plan.created_by:
        submitter = control_plan.created_by
        DCRNotification.objects.create(
            recipient=submitter,
            title=f"Control Plan {control_plan.control_plan_number} Returned for Revision",
            message=f"{actor_name} rejected Control Plan {control_plan.control_plan_number} during review: {comments or 'Revisions requested.'}",
            action_type=DCRNotification.ActionType.DCR_REJECTED,
            action_url=action_url,
        )
        if submitter.email:
            subject = f"[Action Required] Control Plan {control_plan.control_plan_number}: Returned for Revision"
            intro = f"Hello {_get_user_display_name(submitter)}, Control Plan {control_plan.control_plan_number} was reviewed by {actor_name} and returned for revision."
            html = _render_template_email(
                header_title=f"Control Plan {control_plan.control_plan_number} Returned",
                badge_text="Process Control Plan : Revision Required",
                badge_color="#dc2626",
                intro_text=intro,
                details=details,
                action_url=action_url,
                action_text="Open Control Plan Details"
            )
            _send_async_email(subject, f"Control Plan {control_plan.control_plan_number} returned for revision.\nLink: {action_url}", html, [submitter.email])


def notify_control_plan_approved(control_plan, approver_user, action, comments=''):
    """Notifies Submitter and Reviewer when a Process Control Plan is approved or rejected."""
    actor_name = _get_user_display_name(approver_user)
    part_str = f"{control_plan.part.part_number} : {control_plan.part.part_name}" if control_plan.part else "General Manufacturing Control Plan"
    action_url = "/development/control-plans"

    details = {
        "Control Plan Number": control_plan.control_plan_number,
        "Title": control_plan.title,
        "Phase": control_plan.get_phase_display(),
        "Revision": control_plan.current_revision,
        "Linked Part": part_str,
        "Authorized By": actor_name,
        "Decision": "Approved & Released" if action == 'approve' else "Rejected",
        "Approval Remarks": comments or "-",
    }

    notify_users = []
    if control_plan.created_by:
        notify_users.append(control_plan.created_by)
    if control_plan.assigned_reviewer and control_plan.assigned_reviewer != control_plan.created_by:
        notify_users.append(control_plan.assigned_reviewer)

    for user in notify_users:
        if action == 'approve':
            DCRNotification.objects.create(
                recipient=user,
                title=f"Control Plan {control_plan.control_plan_number} Approved & Released",
                message=f"Control Plan {control_plan.control_plan_number} ({control_plan.current_revision}) was approved by {actor_name}. Active revision locked.",
                action_type=DCRNotification.ActionType.DCR_APPROVED,
                action_url=action_url,
            )
            if user.email:
                subject = f"[Approved] Control Plan {control_plan.control_plan_number} Approved: Rev {control_plan.current_revision}"
                intro = f"Hello {_get_user_display_name(user)}, Process Control Plan {control_plan.control_plan_number} has been officially approved and released by {actor_name}."
                html = _render_template_email(
                    header_title=f"Control Plan {control_plan.control_plan_number} Approved",
                    badge_text="Process Control Plan : Approved & Released",
                    badge_color="#15803d",
                    intro_text=intro,
                    details=details,
                    action_url=action_url,
                    action_text="View Released Control Plan"
                )
                _send_async_email(subject, f"Control Plan {control_plan.control_plan_number} approved by {actor_name}.\nLink: {action_url}", html, [user.email])
        else:
            DCRNotification.objects.create(
                recipient=user,
                title=f"Control Plan {control_plan.control_plan_number} Rejected by Approver",
                message=f"Control Plan {control_plan.control_plan_number} was rejected by {actor_name}: {comments or 'Rejected during final approval.'}",
                action_type=DCRNotification.ActionType.DCR_REJECTED,
                action_url=action_url,
            )
