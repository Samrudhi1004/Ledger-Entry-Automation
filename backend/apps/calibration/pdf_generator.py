from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


MONTHS = ('JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC')


def _text(value):
    return escape(str(value or '').replace(' · ', ' - '))


def _day(value, year, month):
    return value.day if value and value.year == year and value.month == month else ''


def _company_block(company):
    company = company or {}
    address = ', '.join(filter(None, (company.get('address'), company.get('location'))))
    contact = ' | '.join(filter(None, (company.get('phone'), company.get('contact_email'))))
    lines = [f"<b>{_text(company.get('name') or 'Company details not configured')}</b>"]
    if address:
        lines.append(_text(address))
    if contact:
        lines.append(_text(contact))
    if company.get('gstin'):
        lines.append(f"GSTIN: {_text(company['gstin'])}")
    return '<br/>'.join(lines)


def generate_calibration_plan_pdf(year, rows, company=None):
    output = BytesIO()
    page_width, _ = landscape(A4)
    usable_width = page_width - 12 * mm
    body = ParagraphStyle(
        'CalibrationPlanBody', fontName='Helvetica', fontSize=6,
        leading=7, textColor=colors.black, alignment=1, wordWrap='CJK',
    )
    body_left = ParagraphStyle('CalibrationPlanBodyLeft', parent=body, alignment=0)
    heading = ParagraphStyle(
        'CalibrationPlanHeading', parent=body, fontName='Helvetica-Bold', fontSize=11, leading=13,
    )
    header = ParagraphStyle(
        'CalibrationPlanHeader', parent=body, fontName='Helvetica-Bold', fontSize=6.5, leading=7.5,
    )

    document = SimpleDocTemplate(
        output, pagesize=landscape(A4), leftMargin=6 * mm, rightMargin=6 * mm,
        topMargin=4 * mm, bottomMargin=4 * mm,
    )
    story = []
    document_header = Table([[
        Paragraph(_company_block(company), body),
        Paragraph(f'Measuring Instrument Calibration Plan {year}', heading),
        Paragraph('<b>FORMAT NO: QA/FR/54<br/>REV: 00</b>', body),
    ]], colWidths=[usable_width * 0.16, usable_width * 0.68, usable_width * 0.16], rowHeights=[18 * mm])
    document_header.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.8, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
    ]))
    story.append(document_header)

    table_data = [
        [
            Paragraph('SR.<br/>NO.', header), Paragraph('DESCRIPTION', header),
            Paragraph('EQUIPMENT<br/>ID', header),
            Paragraph('PLAN VS<br/>ACTUAL', header), Paragraph('MONTH', header),
            '', '', '', '', '', '', '', '', '', '', '',
            Paragraph('REMARKS', header),
        ],
        ['', '', '', ''] + [Paragraph(f"{month}<br/>'{str(year)[-2:]}", header) for month in MONTHS] + [''],
    ]
    table_style = [
        ('GRID', (0, 0), (-1, -1), 0.55, colors.black),
        ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor('#EEF2F7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('SPAN', (0, 0), (0, 1)), ('SPAN', (1, 0), (1, 1)),
        ('SPAN', (2, 0), (2, 1)), ('SPAN', (3, 0), (3, 1)),
        ('SPAN', (4, 0), (15, 0)), ('SPAN', (16, 0), (16, 1)),
    ]

    if not rows:
        table_data.append([Paragraph('No equipment scheduled for this year.', body)] + [''] * 16)
        table_style.append(('SPAN', (0, 2), (-1, 2)))
    else:
        for index, row in enumerate(rows, 1):
            start = len(table_data)
            planned = [_day(row['planned_date'], year, month) for month in range(1, 13)]
            actual = [_day(row['actual_date'], year, month) for month in range(1, 13)]
            remarks = ' · '.join(filter(None, (row['plan_remarks'], row['record_remarks'])))
            table_data.extend([
                [
                    Paragraph(str(index), body), Paragraph(_text(row['equipment_name']), body),
                    Paragraph(_text(row['equipment_id']), body),
                    Paragraph('Plan', body), *planned, Paragraph(_text(remarks), body_left),
                ],
                ['', '', '', Paragraph('Actual', body), *actual, ''],
            ])
            table_style.extend([
                ('SPAN', (0, start), (0, start + 1)), ('SPAN', (1, start), (1, start + 1)),
                ('SPAN', (2, start), (2, start + 1)), ('SPAN', (16, start), (16, start + 1)),
                ('NOSPLIT', (0, start), (-1, start + 1)),
            ])
            for month, day in enumerate(planned, 4):
                if day:
                    table_style.extend([
                        ('BACKGROUND', (month, start), (month, start), colors.HexColor('#D9D9D9')),
                        ('FONTNAME', (month, start), (month, start), 'Helvetica-Bold'),
                    ])
            actual_fill = '#F4CCCC' if row['result'] == 'Rejected' else '#B7E1CD'
            for month, day in enumerate(actual, 4):
                if day:
                    table_style.extend([
                        ('BACKGROUND', (month, start + 1), (month, start + 1), colors.HexColor(actual_fill)),
                        ('FONTNAME', (month, start + 1), (month, start + 1), 'Helvetica-Bold'),
                    ])

    plan_table = Table(
        table_data,
        colWidths=[10 * mm, 38 * mm, 32 * mm, 18 * mm] + [11 * mm] * 12 + [55 * mm],
        repeatRows=2,
    )
    plan_table.setStyle(TableStyle(table_style))
    story.extend([plan_table, Spacer(1, 4 * mm)])

    signatures = Table(
        [[Paragraph('<b>Prepared By</b>', body), Paragraph('<b>Verified By</b>', body)]],
        colWidths=[usable_width / 2, usable_width / 2], rowHeights=[18 * mm],
    )
    signatures.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.8, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(signatures)
    document.build(story)
    return output.getvalue()


def generate_history_card_pdf(equipment, records, company=None, report_links=None):
    output = BytesIO()
    page_width, _ = landscape(A4)
    usable_width = page_width - 12 * mm
    body = ParagraphStyle(
        'HistoryCardBody', fontName='Helvetica', fontSize=6.5,
        leading=8, textColor=colors.black, alignment=1, wordWrap='CJK',
    )
    body_left = ParagraphStyle('HistoryCardBodyLeft', parent=body, alignment=0)
    label = ParagraphStyle(
        'HistoryCardLabel', parent=body, fontName='Helvetica-Bold', alignment=0,
    )
    heading = ParagraphStyle(
        'HistoryCardHeading', parent=body, fontName='Helvetica-Bold', fontSize=13, leading=15,
    )
    column_header = ParagraphStyle(
        'HistoryCardColumnHeader', parent=body, fontName='Helvetica-Bold', fontSize=7, leading=8,
    )

    def value(item):
        return _text(item) or '-'

    def formatted_date(item):
        return item.strftime('%d %b %Y') if item else '-'

    document = SimpleDocTemplate(
        output, pagesize=landscape(A4), leftMargin=6 * mm, rightMargin=6 * mm,
        topMargin=4 * mm, bottomMargin=4 * mm,
    )
    story = []
    document_header = Table([[
        Paragraph(_company_block(company), body),
        Paragraph('INSTRUMENT HISTORY CARD', heading),
        Paragraph('<b>FORMAT NO: QA/FR/10<br/>REV: 00</b>', body),
    ]], colWidths=[usable_width * 0.2, usable_width * 0.6, usable_width * 0.2], rowHeights=[13 * mm])
    document_header.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.8, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
    ]))
    story.append(document_header)

    detail_rows = [
        ('Equipment', equipment.equipment_name, 'Equipment ID', equipment.equipment_id),
        ('Type', equipment.equipment_type, 'History Card No.', equipment.history_card_number),
        (
            'Make / Model',
            ' / '.join(filter(None, [equipment.manufacturer, equipment.model_number])),
            'Equipment State', equipment.get_state_display(),
        ),
        ('Range / Size', equipment.range_size, 'Least Count', equipment.least_count),
        (
            'Calibration Frequency', f'{equipment.calibration_frequency_days} days',
            'Acceptance Criteria', equipment.acceptance_criteria,
        ),
        (
            'Department / Location', ' / '.join(filter(None, [equipment.department, equipment.location])),
            'Last / Next Calibration',
            f'{formatted_date(equipment.last_calibration_date)} / {formatted_date(equipment.next_calibration_date)}',
        ),
    ]
    details = Table([
        [
            Paragraph(value(left_label), label), Paragraph(value(left_value), body_left),
            Paragraph(value(right_label), label), Paragraph(value(right_value), body_left),
        ]
        for left_label, left_value, right_label, right_value in detail_rows
    ], colWidths=[36 * mm, 106.5 * mm, 36 * mm, 106.5 * mm])
    details.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.55, colors.black),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#D9D9D9')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#D9D9D9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.extend([details, Spacer(1, 1 * mm)])

    history_data = [[
        Paragraph('DATE', column_header), Paragraph('CALIBRATION AGENCY', column_header),
        Paragraph('CERTIFICATE NO. / EVIDENCE', column_header),
        Paragraph('DETAILS OF CALIBRATION', column_header), Paragraph('RESULT / DISPOSITION', column_header),
        Paragraph('NEXT DUE', column_header), Paragraph('REMARKS', column_header),
    ]]
    if not records:
        history_data.append([Paragraph('No calibration results have been recorded yet.', body)] + [''] * 6)
    else:
        for record in records:
            certificate_parts = [_text(record.certificate_number)] if record.certificate_number else []
            link = (report_links or {}).get(record.pk)
            if record.report_file_name and link:
                certificate_parts.append(f'<link href="{_text(link)}" color="#0B57D0"><u>View Certificate</u></link>')
            detail_parts = [
                record.calibration_details,
                f'Traceability: {record.traceability_certificate_number}'
                if record.traceability_certificate_number else '',
            ]
            result = record.get_result_display()
            if record.disposition:
                result = f'{result} - {record.get_disposition_display()}'
            history_data.append([
                Paragraph(formatted_date(record.calibration_date), body),
                Paragraph(value(record.calibration_agency), body_left),
                Paragraph('<br/>'.join(certificate_parts) or '-', body_left),
                Paragraph(value(' - '.join(filter(None, detail_parts))), body_left),
                Paragraph(value(result), body),
                Paragraph(formatted_date(record.next_due_date), body),
                Paragraph(value(record.remarks), body_left),
            ])

    history_style = [
        ('GRID', (0, 0), (-1, -1), 0.55, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF2F7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    if not records:
        history_style.append(('SPAN', (0, 1), (-1, 1)))
    else:
        for row_index, record in enumerate(records, 1):
            fill = '#F4CCCC' if record.result == 'rejected' else '#B7E1CD'
            history_style.extend([
                ('BACKGROUND', (4, row_index), (4, row_index), colors.HexColor(fill)),
                ('FONTNAME', (4, row_index), (4, row_index), 'Helvetica-Bold'),
            ])

    history = Table(
        history_data,
        colWidths=[22 * mm, 38 * mm, 48 * mm, 70 * mm, 32 * mm, 27 * mm, 48 * mm],
        repeatRows=1,
    )
    history.setStyle(TableStyle(history_style))
    story.append(history)
    document.build(story)
    return output.getvalue()
