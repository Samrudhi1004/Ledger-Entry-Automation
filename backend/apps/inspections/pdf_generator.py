import os
from datetime import datetime
from django.conf import settings
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_first_piece_pdf(session, doc_data: dict) -> str:
    media_pdf_dir = os.path.join(settings.MEDIA_ROOT, 'pdf_reports')
    os.makedirs(media_pdf_dir, exist_ok=True)

    file_name = f"FirstPiece_Report_{session.session_id}.pdf"
    file_path = os.path.join(media_pdf_dir, file_name)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=landscape(A4),
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    # Styles
    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=12, alignment=1)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=10, alignment=1)
    doc_ref_style = ParagraphStyle('DocRef', fontName='Helvetica-Bold', fontSize=7, alignment=2)
    mmpl_style = ParagraphStyle('MMPL', fontName='Helvetica-Bold', fontSize=16, textColor=colors.white, alignment=1)
    
    cell_style = ParagraphStyle('Cell', fontName='Helvetica', fontSize=7, alignment=1)
    cell_left = ParagraphStyle('CellLeft', fontName='Helvetica', fontSize=7, alignment=0)
    bold_cell = ParagraphStyle('BoldCell', fontName='Helvetica-Bold', fontSize=7, alignment=1)
    red_cell = ParagraphStyle('RedCell', fontName='Helvetica-Bold', fontSize=7, textColor=colors.red, alignment=1)
    header_style = ParagraphStyle('Header', fontName='Helvetica-Bold', fontSize=7, alignment=1, textColor=colors.HexColor('#6B7280'))

    elements = []

    # 1. TOP HEADER (MMPL | Title | Doc Ref)
    header_data = [
        [
            Paragraph("MMPL", mmpl_style),
            [Paragraph("MANTRI METALLICS PVT. LTD.", title_style), Paragraph("1ST PIECE CUM IN-PROCESS INSPECTION REPORT — PROCESS NO. 10", subtitle_style)],
            Paragraph("DOC REF: MMPL/PRD/F02<br/>REV: 02 (15.8.2013)<br/>PAGE 1 OF 1", doc_ref_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[100, 550, 150])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(header_table)

    # 2. META INFO (Process, Part, Operator, Machine, Date, Status)
    inspector_name = session.finalized_by.get_full_name() if session.finalized_by else (session.supervisor.get_full_name() if session.supervisor else "Quality Inspector")
    operator_name = session.operator.get_full_name() if session.operator else "Operator User"
    final_time_str = session.finalized_at.strftime(f"%d %b %Y | Shift {session.shift or 'A'}") if session.finalized_at else datetime.now().strftime(f"%d %b %Y | Shift {session.shift or 'A'}")
    status_label = "PASSED" if session.status in ['finalized_passed', 'approved'] or session.is_setup_approved else ("COMPLETED" if session.status == 'completed' else "PENDING REVIEW")

    meta_data = [
        [
            Paragraph("PROCESS NO: <font name='Helvetica-Bold'>10.</font>", cell_left),
            Paragraph(f"PART NAME & NO: <font name='Helvetica-Bold'>{session.part.part_number} ({session.part.part_name})</font>", cell_left),
            Paragraph(f"OPERATOR: <font name='Helvetica-Bold'>{operator_name}</font>", cell_left)
        ],
        [
            Paragraph(f"MACHINE NO: <font name='Helvetica-Bold'>{session.machine.machine_code}</font>", cell_left),
            Paragraph(f"DATE & SHIFT: <font name='Helvetica-Bold'>{final_time_str}</font>", cell_left),
            Paragraph(f"STATUS: <font name='Helvetica-Bold'>{status_label}</font>", cell_left)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[150, 450, 200])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#6B7280')),
    ]))
    elements.append(meta_table)

    # 3. MEASUREMENTS TABLE
    param_summary = doc_data.get('parameter_summary') or []
    proc_param_summary = doc_data.get('process_parameter_summary') or []
    measurements = doc_data.get('measurements') or []

    is_setup = session.inspection_type == 'first_piece'

    meas_map = {m.get('parameter_code'): m for m in measurements if m.get('parameter_code')}

    if is_setup:
        # 11-column Setup Approval layout (No hourly columns)
        table_data = [
            [
                Paragraph("P.NO", header_style), Paragraph("NO", header_style), Paragraph("PARAMETER NAME & DESCRIPTION", header_style),
                Paragraph("CLASS", header_style), Paragraph("SPECIFICATION", header_style), Paragraph("EVALUATION TECHNIQUE", header_style),
                Paragraph("SAMPLE FREQ", header_style), Paragraph("1ST #1", header_style), Paragraph("1ST #2", header_style), Paragraph("1ST #3", header_style),
                Paragraph("REMA", header_style)
            ],
            # Section 1 Subheader
            [
                Paragraph("SECTION 1: PRODUCT PARAMETERS (QUALITY CHARACTERISTICS & DIMENSIONS)", ParagraphStyle('SecHead', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
                "", "", "", "", "", "", "", "", "", ""
            ]
        ]

        # Add Product Parameters
        for idx, p in enumerate(param_summary, 1):
            code = p.get('parameter_code', str(idx).zfill(2))
            m_info = meas_map.get(code, p)
            val = m_info.get('measured_value')
            
            nom = float(p.get('nominal', 0))
            ll = p.get('lower_limit')
            ul = p.get('upper_limit')
            unit = p.get('unit', 'mm')
            
            if ll is not None and ul is not None:
                spec = f"{nom} {unit} [{float(ll):.2f} to {float(ul):.2f}]"
            else:
                spec = f"{nom} {unit}"

            status = m_info.get('status', 'ok')
            val_str = f"{float(val):.3f}" if val is not None else "—"
            val_para = Paragraph(val_str, red_cell if status == 'out_of_spec' else bold_cell)

            is_crit = p.get('is_critical', False)
            class_str = "CRITICAL" if is_crit else "—"
            method_str = p.get('measurement_technique') or p.get('evaluation_technique') or p.get('gauge_used') or "VERNIER CALIPER"
            sample_str = p.get('sample_size') or p.get('sample_frequency') or "5NOS/SHIFT"

            table_data.append([
                Paragraph("10.", bold_cell),
                Paragraph(str(idx).zfill(2), bold_cell),
                Paragraph(p.get('parameter_name', code), cell_left),
                Paragraph(class_str, red_cell if is_crit else cell_style),
                Paragraph(spec, bold_cell),
                Paragraph(method_str, cell_style),
                Paragraph(sample_str, cell_style),
                val_para,                   # 1ST #1
                Paragraph("—", cell_style), # 1ST #2
                Paragraph("—", cell_style), # 1ST #3
                Paragraph("OK", cell_style),
            ])

        # Section 2 Subheader
        table_data.append([
            Paragraph("SECTION 2: PROCESS PARAMETERS (FIRST PIECE SETUP APPROVAL CHECKS)", ParagraphStyle('SecHead2', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
            "", "", "", "", "", "", "", "", "", ""
        ])

        # Add Process Parameters
        for idx, pp in enumerate(proc_param_summary, 1):
            code = pp.get('parameter_code', f"PR{idx}")
            m_info = meas_map.get(code, pp)
            val = m_info.get('measured_value')
            raw_text = m_info.get('voice_raw_text')
            spec = pp.get('specification') or '—'
            dt = pp.get('data_type', 'numeric')
            unit = pp.get('unit', '')
            
            val_str = raw_text or (str(val) if val is not None else "—")
            if dt == 'numeric' and val is not None and not raw_text:
                try:
                    val_str = f"{float(val):.2f} {unit}".strip()
                except (ValueError, TypeError):
                    val_str = str(val)

            val_para = Paragraph(val_str, bold_cell)

            table_data.append([
                Paragraph("10.", bold_cell),
                Paragraph(str(idx).zfill(2), bold_cell),
                Paragraph(f"[PROC] {pp.get('parameter_name', code)}", cell_left),
                Paragraph("PROC", cell_style),
                Paragraph(f"{spec} {unit}".strip(), bold_cell),
                Paragraph("CHECKLIST", cell_style),
                Paragraph("1ST PC ONLY", cell_style),
                val_para,                   # 1ST #1
                Paragraph("—", cell_style), # 1ST #2
                Paragraph("—", cell_style), # 1ST #3
                Paragraph("OK", cell_style),
            ])

        col_widths = [25, 25, 180, 45, 120, 130, 85, 55, 55, 55, 25]
        
        param_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Build style list for setup table with span rows for section headers
        table_styles = [
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('SPAN', (0, 1), (10, 1)), # Section 1 header span
            ('BACKGROUND', (0, 1), (10, 1), colors.HexColor('#0F172A')),
        ]
        
        sec2_row_idx = len(param_summary) + 2
        table_styles.append(('SPAN', (0, sec2_row_idx), (10, sec2_row_idx)))
        table_styles.append(('BACKGROUND', (0, sec2_row_idx), (10, sec2_row_idx), colors.HexColor('#312E81')))
        
        param_table.setStyle(TableStyle(table_styles))
        elements.append(param_table)

    else:
        # Standard 19-column Daily In-Process layout
        table_data = [
            [
                Paragraph("P.NO", header_style), Paragraph("NO", header_style), Paragraph("PRODUCT CHARACTERISTIC", header_style),
                Paragraph("CLASS", header_style), Paragraph("SPECIFICATION", header_style), Paragraph("EVALUATION TECHNIQUE", header_style),
                Paragraph("SAMPLE FREQ", header_style), Paragraph("1ST #1", header_style), Paragraph("1ST #2", header_style), Paragraph("1ST #3", header_style),
                Paragraph("1/HR", header_style), Paragraph("2/HR", header_style), Paragraph("3/HR", header_style), Paragraph("4/HR", header_style),
                Paragraph("5/HR", header_style), Paragraph("6/HR", header_style), Paragraph("7/HR", header_style), Paragraph("8/HR", header_style),
                Paragraph("REMA", header_style)
            ]
        ]

        for idx, p in enumerate(param_summary, 1):
            code = p.get('parameter_code', str(idx).zfill(2))
            m_info = meas_map.get(code, p)
            val = m_info.get('measured_value')
            
            nom = float(p.get('nominal', 0))
            ll = p.get('lower_limit')
            ul = p.get('upper_limit')
            unit = p.get('unit', 'mm')
            
            if ll is not None and ul is not None:
                spec = f"{nom} {unit} [{float(ll):.2f} to {float(ul):.2f}]"
            else:
                spec = f"{nom} {unit}"

            status = m_info.get('status', 'ok')
            val_str = f"{float(val):.3f}" if val is not None else "—"
            val_para = Paragraph(val_str, red_cell if status == 'out_of_spec' else bold_cell)

            is_crit = p.get('is_critical', False)
            class_str = "CRITICAL" if is_crit else "—"
            method_str = p.get('measurement_technique') or p.get('evaluation_technique') or p.get('gauge_used') or "VERNIER CALIPER"
            sample_str = p.get('sample_size') or p.get('sample_frequency') or "5NOS/SHIFT"

            table_data.append([
                Paragraph("10.", bold_cell),
                Paragraph(str(idx).zfill(2), bold_cell),
                Paragraph(p.get('parameter_name', code), cell_left),
                Paragraph(class_str, red_cell if is_crit else cell_style),
                Paragraph(spec, bold_cell),
                Paragraph(method_str, cell_style),
                Paragraph(sample_str, cell_style),
                val_para,                   # 1ST #1
                Paragraph("—", cell_style), # 1ST #2
                Paragraph("—", cell_style), # 1ST #3
                Paragraph("—", cell_style), # 1/HR
                Paragraph("—", cell_style), # 2/HR
                Paragraph("—", cell_style), # 3/HR
                Paragraph("—", cell_style), # 4/HR
                Paragraph("—", cell_style), # 5/HR
                Paragraph("—", cell_style), # 6/HR
                Paragraph("—", cell_style), # 7/HR
                Paragraph("—", cell_style), # 8/HR
                Paragraph("—", cell_style), # REMARK
            ])

        col_widths = [25, 25, 140, 35, 90, 100, 65, 35, 35, 35, 25, 25, 25, 25, 25, 25, 25, 25, 34]
        
        param_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        param_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(param_table)
    elements.append(param_table)

    # 4. REACTION PLAN
    reaction_data = [[Paragraph("REACTION PLAN: <font color='#4B5563'>REJECT, REWORK, SEGREGATE, INFORM SUPERVISOR OR READJUST THE PROCESS</font>", ParagraphStyle('React', fontName='Helvetica-Bold', fontSize=7))]]
    reaction_table = Table(reaction_data, colWidths=[800])
    reaction_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(reaction_table)
    elements.append(Spacer(1, 25))

    # 5. FOOTER SIGNATURES
    footer_data = [
        [
            Paragraph(f"<i>{operator_name}</i>", cell_style),
            Paragraph(f"<i>{inspector_name}</i>", cell_style),
            Paragraph("<i>Supervisor Sign</i>", cell_style)
        ],
        [
            Paragraph("----------------------------------------------------------------------", cell_style),
            Paragraph("----------------------------------------------------------------------", cell_style),
            Paragraph("----------------------------------------------------------------------", cell_style)
        ],
        [
            Paragraph("<b>OPERATOR SIGNATURE</b>", bold_cell),
            Paragraph("<b>QUALITY INSPECTOR SIGNATURE</b>", bold_cell),
            Paragraph("<b>SUPERVISOR SIGNATURE</b>", bold_cell)
        ]
    ]
    footer_table = Table(footer_data, colWidths=[266, 266, 266])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('PADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(footer_table)

    doc.build(elements)
    return f"media/pdf_reports/{file_name}"


def generate_daily_production_pdf(report) -> str:
    media_pdf_dir = os.path.join(settings.MEDIA_ROOT, 'pdf_reports')
    os.makedirs(media_pdf_dir, exist_ok=True)

    file_name = f"DailyProduction_Report_{report.report_id}.pdf"
    file_path = os.path.join(media_pdf_dir, file_name)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=landscape(A4),
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=14, alignment=1)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=10, alignment=1)
    doc_ref_style = ParagraphStyle('DocRef', fontName='Helvetica-Bold', fontSize=8, alignment=2)
    mmpl_style = ParagraphStyle('MMPL', fontName='Helvetica-Bold', fontSize=16, textColor=colors.white, alignment=1)
    cell_style = ParagraphStyle('Cell', fontName='Helvetica', fontSize=9, alignment=1)
    bold_cell = ParagraphStyle('BoldCell', fontName='Helvetica-Bold', fontSize=9, alignment=1)
    bold_left = ParagraphStyle('BoldLeft', fontName='Helvetica-Bold', fontSize=9, alignment=0)
    left_style = ParagraphStyle('LeftStyle', fontName='Helvetica', fontSize=9, alignment=0)

    elements = []

    # 1. Header
    header_data = [
        [
            Paragraph("MMPL", mmpl_style),
            [Paragraph("MANTRI METALLICS PVT. LTD.", title_style), Paragraph("DAILY PRODUCTION REPORT — END OF DAY SUMMARY", subtitle_style)],
            Paragraph("DOC REF: MMPL/PRD/F08<br/>REV: 01 (12.8.2026)<br/>PAGE 1 OF 1", doc_ref_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[100, 550, 150])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # 2. Metadata Grid
    op_name = report.operator.get_full_name().strip() if report.operator else '—'
    if not op_name:
        op_name = report.operator.username if report.operator else '—'

    meta_data = [
        [
            Paragraph(f"<b>DATE:</b> {report.date}", left_style),
            Paragraph(f"<b>MACHINE:</b> {report.machine.machine_code} ({report.machine.name})", left_style),
            Paragraph(f"<b>SHIFT:</b> {report.shift}", left_style),
        ],
        [
            Paragraph(f"<b>PART:</b> {report.part.part_number} ({report.part.part_name})", left_style),
            Paragraph(f"<b>OPERATION:</b> {report.operation or '—'}", left_style),
            Paragraph(f"<b>OPERATOR:</b> {op_name}", left_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[266, 266, 268])
    meta_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 15))

    # 3. Production Summary Table
    prod_table_data = [
        [Paragraph("<font color='white'><b>PRODUCTION FIELD</b></font>", bold_cell), Paragraph("<font color='white'><b>VALUE / COUNT</b></font>", bold_cell), Paragraph("<font color='white'><b>REMARKS / STATUS</b></font>", bold_cell)],
        [Paragraph("Production Target", bold_left), Paragraph(str(report.production_target), cell_style), Paragraph("Target Shift Output", left_style)],
        [Paragraph("Jobs Completed", bold_left), Paragraph(str(report.jobs_completed), cell_style), Paragraph("Total Produced", left_style)],
        [Paragraph("Correct Jobs (Pass)", bold_left), Paragraph(str(report.correct_jobs), cell_style), Paragraph("Accepted Units", left_style)],
        [Paragraph("Incorrect Jobs (Rejections)", bold_left), Paragraph(str(report.incorrect_jobs), cell_style), Paragraph("Total Defective / Rejected", left_style)],
        [Paragraph("  ├ Customer Rejection (CR)", left_style), Paragraph(str(report.cr_count), cell_style), Paragraph("CR Quantity", left_style)],
        [Paragraph("  ├ Machine Rejection (MR)", left_style), Paragraph(str(report.mr_count), cell_style), Paragraph("MR Quantity", left_style)],
        [Paragraph("  └ Rework (RW)", left_style), Paragraph(str(report.rw_count), cell_style), Paragraph("RW Quantity", left_style)],
        [Paragraph("<b>PRODUCTION ACHIEVEMENT %</b>", bold_left), Paragraph(f"<b>{report.achievement_percentage}%</b>", bold_cell), Paragraph(f"<b>{'TARGET MET' if report.achievement_percentage >= 100 else 'UNDER TARGET'}</b>", bold_cell)],
    ]
    prod_table = Table(prod_table_data, colWidths=[300, 200, 300])
    prod_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#DCFCE7') if report.achievement_percentage >= 100 else colors.HexColor('#FEF3C7')),
    ]))
    elements.append(prod_table)
    elements.append(Spacer(1, 15))

    # 4. Remarks Box
    if report.remarks:
        rem_data = [[Paragraph(f"<b>OPERATOR REMARKS:</b> {report.remarks}", left_style)]]
        rem_table = Table(rem_data, colWidths=[800])
        rem_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
        ]))
        elements.append(rem_table)
        elements.append(Spacer(1, 20))

    # 5. Signatures
    sig_data = [
        [Paragraph(f"<i>{op_name}</i>", cell_style), Paragraph("<i>Verified Inspector</i>", cell_style), Paragraph("<i>Verified Supervisor</i>", cell_style)],
        [Paragraph("---------------------------------------", cell_style), Paragraph("---------------------------------------", cell_style), Paragraph("---------------------------------------", cell_style)],
        [Paragraph("<b>OPERATOR SIGNATURE</b>", bold_cell), Paragraph("<b>QUALITY INSPECTOR SIGNATURE</b>", bold_cell), Paragraph("<b>SUPERVISOR SIGNATURE</b>", bold_cell)]
    ]
    sig_table = Table(sig_data, colWidths=[266, 266, 268])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('PADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    return f"media/pdf_reports/{file_name}"


def generate_downtime_pdf(qs, date_str: str, shift_str: str) -> str:
    media_pdf_dir = os.path.join(settings.MEDIA_ROOT, 'pdf_reports')
    os.makedirs(media_pdf_dir, exist_ok=True)

    file_name = f"Downtime_Report_{date_str}_{shift_str}.pdf"
    file_path = os.path.join(media_pdf_dir, file_name)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=landscape(A4),
        rightMargin=15,
        leftMargin=15,
        topMargin=15,
        bottomMargin=15
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=14, alignment=1)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=10, alignment=1)
    doc_ref_style = ParagraphStyle('DocRef', fontName='Helvetica-Bold', fontSize=8, alignment=2)
    cyan_header_style = ParagraphStyle('CyanHeader', fontName='Helvetica-Bold', fontSize=14, alignment=1)
    cell_style = ParagraphStyle('Cell', fontName='Helvetica', fontSize=7, alignment=1)
    bold_cell = ParagraphStyle('BoldCell', fontName='Helvetica-Bold', fontSize=7, alignment=1)

    elements = []

    # 1. Header Table (Hanuman Engineering Works / DOWN TIME REPORT / Doc Ref)
    header_data = [
        [
            Paragraph("<b>HANUMAN ENGINEERING<br/>WORKS</b>", title_style),
            Paragraph("<b>DOWN TIME REPORT</b>", cyan_header_style),
            Paragraph("<b>FORMAT NO. :- QF/MF-06</b><br/>REV. No./ Date :- 00 / 30.09.2026<br/><b>Shift:</b> " + str(shift_str), doc_ref_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[200, 420, 190])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#B0E0E6')),  # Excel Cyan Color
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 6))

    # 2. Date Sub-Header Banner
    date_data = [[Paragraph(f"<b>DATE:</b> {date_str} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>SHIFT:</b> {shift_str}", ParagraphStyle('LeftDate', fontName='Helvetica-Bold', fontSize=9, alignment=0))]]
    date_table = Table(date_data, colWidths=[810])
    date_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E0F2FE')),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(date_table)
    elements.append(Spacer(1, 8))

    # 3. Main Data Table with Excel Merged Header Columns
    table_data = [
        [
            Paragraph("<b>Sr. No.</b>", bold_cell),
            Paragraph("<b>Machine No.</b>", bold_cell),
            Paragraph("<b>Operator Name</b>", bold_cell),
            Paragraph("<b>Target</b>", bold_cell),
            Paragraph("<b>Produced</b>", bold_cell),
            Paragraph("<b>Accepted / Actual</b>", bold_cell),
            Paragraph("<b>Rejection Summary</b>", bold_cell), "", "",
            Paragraph("<b>DOWN TIME IN MINUTES</b>", bold_cell), "", "", "", "", "", "", "", "",
            Paragraph("<b>Total Down Time (Min.)</b>", bold_cell),
            Paragraph("<b>Remarks</b>", bold_cell)
        ],
        [
            "", "", "", "", "", "",
            Paragraph("<b>CR</b>", bold_cell), Paragraph("<b>MR</b>", bold_cell), Paragraph("<b>RW</b>", bold_cell),
            Paragraph("<b>NO LOAD</b>", bold_cell), Paragraph("<b>NO OPERATOR</b>", bold_cell), Paragraph("<b>U/M</b>", bold_cell),
            Paragraph("<b>SETTING</b>", bold_cell), Paragraph("<b>INSP. WAIT</b>", bold_cell), Paragraph("<b>TOOL CHANGE</b>", bold_cell),
            Paragraph("<b>P/O</b>", bold_cell), Paragraph("<b>R/W</b>", bold_cell), Paragraph("<b>TOOL PROB</b>", bold_cell),
            "", ""
        ]
    ]

    total_downtime_sum = 0
    total_produced_sum = 0
    total_accepted_sum = 0

    for idx, obj in enumerate(qs, 1):
        prod = obj.production_report
        op_name = prod.operator.get_full_name().strip() if prod.operator else '—'
        if not op_name and prod.operator:
            op_name = prod.operator.username

        total_downtime_sum += obj.total_downtime
        total_produced_sum += prod.jobs_completed
        total_accepted_sum += prod.correct_jobs

        table_data.append([
            Paragraph(str(idx), cell_style),
            Paragraph(prod.machine.machine_code, bold_cell),
            Paragraph(op_name, cell_style),
            Paragraph(str(prod.production_target), cell_style),
            Paragraph(str(prod.jobs_completed), cell_style),
            Paragraph(str(prod.correct_jobs), cell_style),
            Paragraph(str(prod.cr_count), cell_style),
            Paragraph(str(prod.mr_count), cell_style),
            Paragraph(str(prod.rw_count), cell_style),
            Paragraph(str(obj.no_load), cell_style),
            Paragraph(str(obj.no_operator), cell_style),
            Paragraph(str(obj.um), cell_style),
            Paragraph(str(obj.setting), cell_style),
            Paragraph(str(obj.inspection_wait), cell_style),
            Paragraph(str(obj.tool_change), cell_style),
            Paragraph(str(obj.power_off), cell_style),
            Paragraph(str(obj.rework), cell_style),
            Paragraph(str(obj.tool_problem), cell_style),
            Paragraph(str(obj.total_downtime), bold_cell),
            Paragraph(obj.remarks or '—', cell_style)
        ])

    # Summary Row
    if len(qs) > 0:
        table_data.append([
            Paragraph("<b>TOTAL</b>", bold_cell), "", "", "",
            Paragraph(f"<b>{total_produced_sum}</b>", bold_cell),
            Paragraph(f"<b>{total_accepted_sum}</b>", bold_cell),
            "", "", "", "", "", "", "", "", "", "", "", "",
            Paragraph(f"<b>{total_downtime_sum} Min.</b>", bold_cell),
            ""
        ])

    col_widths = [25, 50, 65, 35, 40, 50, 25, 25, 25, 35, 45, 30, 40, 40, 45, 30, 30, 35, 55, 75]
    main_table = Table(table_data, colWidths=col_widths, repeatRows=2)

    ts = [
        ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor('#B0E0E6')),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('SPAN', (0, 0), (0, 1)),
        ('SPAN', (1, 0), (1, 1)),
        ('SPAN', (2, 0), (2, 1)),
        ('SPAN', (3, 0), (3, 1)),
        ('SPAN', (4, 0), (4, 1)),
        ('SPAN', (5, 0), (5, 1)),
        ('SPAN', (6, 0), (8, 0)),   # Rejection Summary span
        ('SPAN', (9, 0), (17, 0)),  # DOWN TIME IN MINUTES span
        ('SPAN', (18, 0), (18, 1)), # Total Down Time span
        ('SPAN', (19, 0), (19, 1)), # Remarks span
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 3),
    ]

    if len(qs) > 0:
        summary_row_idx = len(table_data) - 1
        ts.extend([
            ('BACKGROUND', (0, summary_row_idx), (-1, summary_row_idx), colors.HexColor('#E2E8F0')),
            ('SPAN', (0, summary_row_idx), (3, summary_row_idx)),
        ])

    main_table.setStyle(TableStyle(ts))
    elements.append(main_table)

    doc.build(elements)
    return f"media/pdf_reports/{file_name}"


