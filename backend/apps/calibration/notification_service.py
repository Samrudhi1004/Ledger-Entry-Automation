from datetime import timedelta
from html import escape

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.users.models import User

from .models import CalibrationEmailLog, CalibrationEquipment


def _access_emails(permission, excluding=None):
    return [user.email for user in User.objects.filter(is_active=True).exclude(email='')
            if user.has_access(permission) and not (excluding and user.has_access(excluding))]


def _calibrator_emails():
    return _access_emails('calibration.manage', excluding='roles.manage')


def _admin_emails():
    return [user.email for user in User.objects.filter(is_active=True).exclude(email='')
            if user.has_access('roles.manage') and user.has_access('calibration.view')]


def _unique_emails(*email_lists):
    emails = []
    seen = set()
    for email_list in email_lists:
        for email in email_list:
            if email.casefold() not in seen:
                seen.add(email.casefold())
                emails.append(email)
    return emails


def _send_once(key, subject, body, recipients, html_message=None):
    if not recipients:
        return False
    try:
        with transaction.atomic():
            CalibrationEmailLog.objects.create(key=key)
    except IntegrityError:
        return False

    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            recipients,
            fail_silently=False,
            html_message=html_message,
        )
    except Exception:
        CalibrationEmailLog.objects.filter(key=key).delete()
        raise
    return True


def _next_month(today):
    return (today.replace(day=28) + timedelta(days=4)).replace(day=1)


def _next_month_equipment(today):
    target_month = _next_month(today)
    return target_month, list(
        CalibrationEquipment.objects.filter(
            next_calibration_date__year=target_month.year,
            next_calibration_date__month=target_month.month,
        ).exclude(state=CalibrationEquipment.State.SCRAPPED).order_by('next_calibration_date', 'equipment_id')
    )


def _calibration_alerts(today):
    due_cutoff = today + timedelta(days=10)
    return list(
        CalibrationEquipment.objects.filter(
            Q(
                state=CalibrationEquipment.State.ACTIVE,
                next_calibration_date__lte=due_cutoff,
            )
            | Q(state=CalibrationEquipment.State.REPAIR)
        ).order_by('next_calibration_date', 'equipment_id')
    )


def _equipment_line(item, today):
    if item.state == CalibrationEquipment.State.REPAIR:
        status = 'UNDER REPAIR'
    elif item.next_calibration_date < today:
        status = f'OVERDUE by {(today - item.next_calibration_date).days} days'
    else:
        status = f'DUE on {item.next_calibration_date:%d %b %Y}'
    return f"{item.equipment_id} : {item.equipment_name} : {status} : Department: {item.department or '-'} : Location: {item.location or '-'}"


def _equipment_rows_html(equipment, today):
    rows = []
    for item in equipment:
        under_repair = item.state == CalibrationEquipment.State.REPAIR
        overdue = item.next_calibration_date < today and not under_repair
        if under_repair:
            status = 'UNDER REPAIR'
            status_color = '#b54708'
            status_background = '#fffaeb'
        elif overdue:
            status = f'OVERDUE by {(today - item.next_calibration_date).days} days'
            status_color = '#b42318'
            status_background = '#fef3f2'
        else:
            status = f'DUE on {item.next_calibration_date:%d %b %Y}'
            status_color = '#175cd3'
            status_background = '#eff8ff'
        rows.append(
            '<tr>'
            f'<td style="padding:12px;border-top:1px solid #e4e7ec;font-weight:700;color:#101828;">{escape(str(item.equipment_id))}<br>'
            f'<span style="font-weight:400;color:#667085;">{escape(str(item.equipment_name))}</span></td>'
            f'<td style="padding:12px;border-top:1px solid #e4e7ec;color:#344054;">{item.next_calibration_date:%d %b %Y}</td>'
            f'<td style="padding:12px;border-top:1px solid #e4e7ec;"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:{status_background};color:{status_color};font-weight:700;font-size:12px;">{escape(status)}</span></td>'
            f'<td style="padding:12px;border-top:1px solid #e4e7ec;color:#344054;">{escape(str(item.department or "-"))}</td>'
            f'<td style="padding:12px;border-top:1px solid #e4e7ec;color:#344054;">{escape(str(item.location or "-"))}</td>'
            '</tr>'
        )
    return ''.join(rows)


def _equipment_table_html(equipment, today, empty_message):
    if not equipment:
        return f'<p style="margin:0;color:#667085;">{escape(empty_message)}</p>'
    return (
        '<div style="overflow-x:auto;">'
        '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;">'
        '<thead><tr style="background:#f8fafc;text-align:left;">'
        '<th style="padding:10px 12px;color:#475467;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Equipment</th>'
        '<th style="padding:10px 12px;color:#475467;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Due date</th>'
        '<th style="padding:10px 12px;color:#475467;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Status</th>'
        '<th style="padding:10px 12px;color:#475467;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Department</th>'
        '<th style="padding:10px 12px;color:#475467;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Location</th>'
        '</tr></thead>'
        f'<tbody>{_equipment_rows_html(equipment, today)}</tbody>'
        '</table></div>'
    )


def _schedule_email_content(today):
    target_month, next_equipment = _next_month_equipment(today)
    month_label = target_month.strftime('%B %Y')
    next_lines = '\n'.join(_equipment_line(item, today) for item in next_equipment)
    body = (
        f'Calibration notification for {today:%d %B %Y}\n\n'
        f'NEXT MONTH CALIBRATION LIST : {month_label}\n'
        f'Equipment due next month: {len(next_equipment)}\n'
        f'{next_lines or "No equipment is scheduled for calibration next month."}\n\n'
        'DECISION RULES\n'
        '• Non-scrapped equipment whose next calibration date falls in the next calendar month is included.\n'
        '• This schedule email is sent to calibrators on the 25th of the previous month.'
    )
    html_message = _schedule_email_html(
        today,
        month_label,
        next_equipment,
    )
    return f'[Calibration] Next Month Schedule : {month_label}', body, html_message, next_equipment


def _schedule_email_html(today, month_label, next_equipment):
    return f'''
<!doctype html>
<html>
  <body style="margin:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#101828;">
    <div style="padding:28px 12px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #eaecf0;border-radius:14px;overflow:hidden;">
        <div style="padding:28px 32px;background:#101828;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;font-weight:700;">Calibration control</div>
          <h1 style="margin:8px 0 6px;font-size:26px;line-height:1.2;color:#ffffff;">Next Month Schedule</h1>
          <p style="margin:0;color:#d0d5dd;font-size:14px;">Prepared {today:%d %B %Y} for the calibrator team</p>
        </div>
        <div style="padding:24px 32px;">
          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:10px 0;margin:0 -10px 24px;">
            <tr>
              <td style="width:50%;padding:16px;background:#f8fafc;border:1px solid #eaecf0;border-radius:10px;">
                <div style="font-size:12px;color:#667085;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Due next month</div>
                <div style="margin-top:5px;font-size:28px;line-height:1;font-weight:700;color:#101828;">{len(next_equipment)}</div>
                <div style="margin-top:6px;color:#667085;font-size:13px;">{escape(month_label)}</div>
              </td>
              <td style="width:50%;padding:16px;background:#fff8f0;border:1px solid #fedf89;border-radius:10px;">
                <div style="font-size:12px;color:#175cd3;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Recipients</div>
                <div style="margin-top:5px;font-size:20px;line-height:1.2;font-weight:700;color:#101828;">Calibrators</div>
                <div style="margin-top:6px;color:#667085;font-size:13px;">Sent on the 25th</div>
              </td>
            </tr>
          </table>

          <h2 style="margin:0 0 6px;font-size:18px;color:#101828;">Next Month Calibration List  -  {escape(month_label)}</h2>
          <p style="margin:0 0 14px;color:#667085;font-size:13px;">Non-scrapped equipment scheduled for calibration in the next calendar month.</p>
          {_equipment_table_html(next_equipment, today, 'No equipment is scheduled for calibration next month.')}

          <div style="margin-top:28px;padding:16px 18px;background:#f8fafc;border-left:4px solid #2e90fa;border-radius:6px;">
            <div style="margin-bottom:8px;font-size:14px;font-weight:700;color:#101828;">Decision rules</div>
            <div style="font-size:13px;line-height:1.65;color:#475467;">
              <strong>Included:</strong> non-scrapped equipment whose next calibration date falls in the next calendar month.<br>
              <strong>Delivery:</strong> sent to active calibrators on the 25th of the previous month.
            </div>
          </div>
        </div>
        <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eaecf0;color:#667085;font-size:12px;line-height:1.5;">
          This is an automated calibration notification. Please update the calibration record after the equipment is reviewed.
        </div>
      </div>
    </div>
  </body>
</html>
'''


def _alert_email_content(today):
    alerts = _calibration_alerts(today)
    alert_lines = '\n'.join(_equipment_line(item, today) for item in alerts)
    body = (
        f'Calibration alert for {today:%d %B %Y}\n\n'
        f'EQUIPMENT REQUIRING ATTENTION\n'
        f'Equipment requiring attention: {len(alerts)}\n'
        f'{alert_lines or "No calibration alerts today."}\n\n'
        'ALERT RULES\n'
        '• Active equipment due within the next 10 days or already overdue.\n'
        '• Equipment currently under repair.'
    )
    html_message = f'''
<!doctype html>
<html>
  <body style="margin:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#101828;">
    <div style="padding:28px 12px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #eaecf0;border-radius:14px;overflow:hidden;">
        <div style="padding:28px 32px;background:#b42318;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#fecdca;font-weight:700;">Calibration alert</div>
          <h1 style="margin:8px 0 6px;font-size:26px;line-height:1.2;color:#ffffff;">Action required</h1>
          <p style="margin:0;color:#fef3f2;font-size:14px;">Prepared {today:%d %B %Y} for admins and calibrators</p>
        </div>
        <div style="padding:24px 32px;">
          <div style="margin-bottom:22px;padding:16px;background:#fef3f2;border:1px solid #fecdca;border-radius:10px;">
            <div style="font-size:12px;color:#b42318;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Equipment requiring attention</div>
            <div style="margin-top:5px;font-size:28px;line-height:1;font-weight:700;color:#101828;">{len(alerts)}</div>
            <div style="margin-top:6px;color:#667085;font-size:13px;">Due within 10 days, overdue, or under repair</div>
          </div>
          <h2 style="margin:0 0 6px;font-size:18px;color:#101828;">Alert Equipment</h2>
          <p style="margin:0 0 14px;color:#667085;font-size:13px;">Review these records and update the calibration status after action is taken.</p>
          {_equipment_table_html(alerts, today, 'No calibration alerts today.')}
          <div style="margin-top:28px;padding:16px 18px;background:#fffaeb;border-left:4px solid #f79009;border-radius:6px;">
            <div style="margin-bottom:8px;font-size:14px;font-weight:700;color:#101828;">Alert rules</div>
            <div style="font-size:13px;line-height:1.65;color:#475467;">
              <strong>Due soon or overdue:</strong> active equipment due within the next 10 days or past its calibration date.<br>
              <strong>Under repair:</strong> equipment with the Under Repair status is included regardless of due date.<br>
              <strong>Recipients:</strong> sent to all active admins and calibrators with email addresses.
            </div>
          </div>
        </div>
        <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eaecf0;color:#667085;font-size:12px;line-height:1.5;">
          This is an automated calibration alert. Please review the listed equipment.
        </div>
      </div>
    </div>
  </body>
</html>
'''
    return f'[Calibration Alert] Action Required : {len(alerts)} equipment', body, html_message, alerts


def _send_monthly_due_list(today, recipients):
    if today.day < 25:
        return False
    target_month, next_equipment = _next_month_equipment(today)
    subject, body, html_message, _ = _schedule_email_content(today)
    if not next_equipment:
        return False
    return _send_once(
        f'monthly-due-list:{target_month:%Y-%m}',
        subject,
        body,
        recipients,
        html_message,
    )


def _send_calibration_alerts(today, recipients):
    if not _calibration_alerts(today):
        return False
    subject, body, html_message, _ = _alert_email_content(today)
    return _send_once(
        f'calibration-alert:{today:%Y-%m-%d}',
        subject,
        body,
        recipients,
        html_message,
    )


def check_calibration_email_notifications(today=None):
    today = today or timezone.localdate()
    calibrator_recipients = _calibrator_emails()
    if calibrator_recipients:
        _send_monthly_due_list(today, calibrator_recipients)
    alert_recipients = _unique_emails(_admin_emails(), calibrator_recipients)
    if alert_recipients:
        _send_calibration_alerts(today, alert_recipients)
