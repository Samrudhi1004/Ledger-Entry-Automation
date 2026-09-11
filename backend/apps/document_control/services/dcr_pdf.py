"""
Server-side PDF Generator for Document Change Request (Form DKI/MR/F/05).
Generates an industrial standard document change record matching Form DKI/MR/F/05
with dynamic Company Logo & Name and editable Header references.
"""

import io
import os
import urllib.request
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from apps.machines.models import Factory


def generate_dcr_pdf(dcr):
    """
    Builds and returns a PDF byte buffer exactly matching Form DKI/MR/F/05.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    company_title_style = ParagraphStyle(
        'CompanyTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=1, # Center
        textColor=colors.HexColor('#0f172a')
    )
    company_sub_style = ParagraphStyle(
        'CompanySubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor('#475569')
    )
    dcr_banner_style = ParagraphStyle(
        'DCRBanner',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=1,
        textColor=colors.HexColor('#0f172a')
    )
    meta_hdr_style = ParagraphStyle(
        'MetaHdr',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    bold_label = ParagraphStyle(
        'BoldLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )
    val_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    val_muted = ParagraphStyle(
        'ValMuted',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#64748b')
    )
    stamp_verified = ParagraphStyle(
        'StampVerified',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#16a34a')
    )
    stamp_approved = ParagraphStyle(
        'StampApproved',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1d4ed8')
    )

    elements = []

    # Get active factory details
    factory = Factory.objects.filter(is_active=True).first()
    company_name = factory.name if factory else "Mantri Metallics Pvt. Ltd."
    logo_url = factory.logo_url if factory else ""

    # Prepare Logo element
    logo_elem = None
    if logo_url:
        try:
            if logo_url.startswith('http://') or logo_url.startswith('https://'):
                req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=3) as response:
                    img_data = io.BytesIO(response.read())
                    logo_elem = RLImage(img_data, width=50, height=40)
            elif os.path.exists(logo_url):
                logo_elem = RLImage(logo_url, width=50, height=40)
        except Exception:
            logo_elem = None

    if not logo_elem:
        # Crisp corporate emblem fallback
        logo_elem = Paragraph(
            f"<font size=14 color='#1e293b'><b>[ {company_name[:2].upper()} ]</b></font><br/><font size=6 color='#64748b'>QUALITY</font>",
            ParagraphStyle('LogoFallback', alignment=1, leading=11)
        )

    # Header Top Table: Logo | Company Name | Doc Meta
    form_doc_no = getattr(dcr, 'form_doc_no', None) or 'DKI/MR/F/05'
    issue_no_date = getattr(dcr, 'issue_no_date', None) or '01/01.04.2018'
    rev_no_date = getattr(dcr, 'rev_no_date', None) or '01/01.04.2018'

    top_header_data = [
        [
            logo_elem,
            Paragraph(f"<b>{company_name.upper()}</b><br/><font size=8 color='#475569'>Quality Management System</font>", company_title_style),
            Paragraph(f"<b>Doc No:</b> {form_doc_no}<br/><b>Issue No/Date:</b> {issue_no_date}<br/><b>Rev No/Date:</b> {rev_no_date}", meta_hdr_style)
        ]
    ]
    top_header_table = Table(top_header_data, colWidths=[95, 300, 140])
    top_header_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,0), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(top_header_table)

    # Banner Table: DOCUMENT CHANGE REQUEST NOTE
    banner_data = [[Paragraph("DOCUMENT CHANGE REQUEST NOTE", dcr_banner_style)]]
    banner_table = Table(banner_data, colWidths=[535])
    banner_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
    ]))
    elements.append(banner_table)

    # Form Main Body Rows
    req_user = dcr.raised_by
    req_name = f"{req_user.first_name} {req_user.last_name}".strip() or req_user.username
    req_role = getattr(req_user, 'role', 'Supervisor').replace('_', ' ').title()
    receipt_date = str(dcr.date_of_receipt) if dcr.date_of_receipt else timezone.now().strftime("%Y-%m-%d")

    # Row 1: Raised by | Date of receipt of change
    row1_data = [
        [
            Paragraph(f"<b>Raised by:</b> {req_name} ({req_role})", bold_label),
            Paragraph(f"<b>Date of receipt of change:</b> {receipt_date}", bold_label)
        ]
    ]
    row1_table = Table(row1_data, colWidths=[335, 200])
    row1_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(row1_table)

    # Row 2: Document Description
    doc_ref = f"{dcr.document.document_number} — {dcr.document.title} (Rev: {dcr.document.revision})"
    desc_content = f"<b>Document Description :</b><br/>{doc_ref}<br/>{dcr.document_description or 'No document description provided.'}"
    row2_data = [[Paragraph(desc_content.replace('\n', '<br/>'), val_style)]]
    row2_table = Table(row2_data, colWidths=[535])
    row2_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(row2_table)

    # Row 3: Basis for Change
    basis_content = f"<b>Basis for Change:</b><br/>{dcr.basis_for_change or 'No basis for change provided.'}"
    row3_data = [[Paragraph(basis_content.replace('\n', '<br/>'), val_style)]]
    row3_table = Table(row3_data, colWidths=[535])
    row3_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(row3_table)

    # Row 4: Change Review Remark | Change Approved By | Date of review
    app_user = dcr.approved_by or dcr.assigned_approver
    app_name = f"{app_user.first_name} {app_user.last_name}".strip() if app_user else "Admin / MR"
    review_date_str = str(dcr.date_of_review.date()) if dcr.date_of_review else "—"
    review_remark_text = dcr.review_remark or dcr.cft_remarks or "Pending CFT review"

    row4_data = [
        [
            Paragraph(f"<b>Change Review Remark:</b><br/>{review_remark_text}", val_style),
            Paragraph(f"<b>Change Approved By:</b><br/>{app_name}", val_style),
            Paragraph(f"<b>Date of review:</b><br/>{review_date_str}", val_style),
        ]
    ]
    row4_table = Table(row4_data, colWidths=[240, 165, 130])
    row4_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(row4_table)

    # Row 5: Change to be implemented from
    imp_date_str = str(dcr.implementation_date) if dcr.implementation_date else "Upon Management Representative Authorization"
    row5_data = [[Paragraph(f"<b>Change to be implemented from :</b> {imp_date_str}", bold_label)]]
    row5_table = Table(row5_data, colWidths=[535])
    row5_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(row5_table)

    # Row 6: Change implemented with updated documents
    if dcr.implemented_revision:
        imp_doc_text = f"Revised Document: {dcr.implemented_revision.document_number} (Rev: {dcr.implemented_revision.revision}) — Notes: {dcr.implemented_notes or 'All master copies updated and distributed to floor.'}"
    else:
        imp_doc_text = dcr.implemented_notes or "Pending final release & obsolete document retrieval."
    
    row6_data = [[Paragraph(f"<b>Change implemented with updated documents :</b><br/>{imp_doc_text}", val_style)]]
    row6_table = Table(row6_data, colWidths=[535])
    row6_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(row6_table)

    # Row 7: REVIEWED BY Banner
    revby_data = [[Paragraph("<b>REVIEWED BY:</b>", bold_label)]]
    revby_table = Table(revby_data, colWidths=[535])
    revby_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(revby_table)

    # Row 8: CFT | Management Representative
    cft_user = dcr.reviewed_by or dcr.assigned_cft_reviewer
    cft_name = f"{cft_user.first_name} {cft_user.last_name}".strip() if cft_user else "CFT Reviewer"
    cft_role = getattr(cft_user, 'role', 'Supervisor').replace('_', ' ').title() if cft_user else "CFT"
    
    if dcr.reviewed_by or dcr.status in ['reviewed', 'awaiting_approval', 'approved', 'implemented']:
        cft_stamp_box = (
            f"<font color='#15803d'><b>[ REVIEWED & VERIFIED ]</b></font><br/>"
            f"<b>Name:</b> {cft_name} ({cft_role})<br/>"
            f"<b>Date:</b> {review_date_str}<br/>"
            f"<b>Remarks:</b> {dcr.cft_remarks or 'Technical feasibility approved.'}"
        )
    else:
        cft_stamp_box = f"<b>Assigned Reviewer:</b> {cft_name} ({cft_role})<br/><font color='#64748b'><i>Awaiting CFT Review</i></font>"

    mr_user = dcr.approved_by or dcr.assigned_approver
    mr_name = f"{mr_user.first_name} {mr_user.last_name}".strip() if mr_user else "Admin (MR)"
    mr_date_str = str(dcr.date_of_approval.date()) if dcr.date_of_approval else "—"

    if dcr.approved_by or dcr.status in ['approved', 'implemented']:
        mr_stamp_box = (
            f"<font color='#1d4ed8'><b>[ APPROVED - MR ]</b></font><br/>"
            f"<b>Name:</b> {mr_name}<br/>"
            f"<b>Date:</b> {mr_date_str}<br/>"
            f"<b>MR Remarks:</b> {dcr.mr_remarks or 'Approved for implementation.'}"
        )
    elif dcr.status == 'rejected':
        mr_stamp_box = (
            f"<font color='#dc2626'><b>[ REJECTED ]</b></font><br/>"
            f"<b>Reason:</b> {dcr.rejection_reason or 'Does not meet specification.'}"
        )
    else:
        mr_stamp_box = f"<b>MR Approver:</b> {mr_name}<br/><font color='#64748b'><i>Awaiting MR Authorization</i></font>"

    row8_data = [
        [
            Paragraph(f"<b>CFT :</b><br/><br/>{cft_stamp_box}", val_style),
            Paragraph(f"<b>Management Representative:</b><br/><br/>{mr_stamp_box}", val_style),
        ]
    ]
    row8_table = Table(row8_data, colWidths=[267.5, 267.5])
    row8_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor('#000000')),
        ('INNERGRID', (0,0), (-1,-1), 0.8, colors.HexColor('#000000')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(KeepTogether([row8_table]))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
