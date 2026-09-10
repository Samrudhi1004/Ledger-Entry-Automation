"""
jh_excel_generator.py

Generates the official JISHU-HOZEN Monitoring Sheet (Form QF/MF-08, JH STEP-3)
in authentic Microsoft Excel (.xlsx) format using openpyxl.

Features:
- Official Lumax / Hanuman Engineering Title Banner & Warning Badges
  (BREAK DOWN [B], ACCIDENT [+], DEFECT [D])
- Form Header (Line Name, Machine Code, Month & Year, JH Status: STEP 3)
- Multi-Level Headers: Root Map No, Assembly, Sub No, Sub Assembly, Check For,
  Standard, Tool, Rank, Freq, ACTION (C, L, I, Rt), During Operation, Time, Resp.
- 31-Day Shift Grid with Shift I, II, III (or I, II for 12-hr schedule)
- Full Unicode support for pure Hindi checklist checkpoints & standards
- Action Star indicators (★) for Clean, Lubricate, Inspect, Retighten
- Formatted Checkmark evaluations (✓ OK, ✕ NOT OK, ⊗ NOT OK CORRECTION DONE)
- Cell merges per assembly, colored headers, borders, and column auto-dimensions
"""

import io
import calendar
from datetime import date
from typing import Optional

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from .models import JHChecklistItem, JHInspectionRecord
from apps.machines.models import Machine


def generate_jh_matrix_xlsx(
    machine: Optional[Machine],
    year: int,
    month: int,
    shift_hours: int = 8,
) -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"JH Matrix {year}-{month:02d}"
    ws.views.sheetView[0].showGridLines = True

    # 1. Determine shift setup
    if shift_hours == 12:
        shifts = ['I', 'II']
    else:
        shifts = ['I', 'II', 'III']
    shift_count = len(shifts)

    _, days_in_month = calendar.monthrange(year, month)
    month_name = calendar.month_name[month]

    # 2. Fetch checklist items
    items = list(JHChecklistItem.objects.filter(is_active=True).order_by('sort_order', 'sub_no'))

    # 3. Fetch inspection evaluations
    matrix = {}
    for it in items:
        matrix[it.sub_no] = {}

    if machine:
        start_date = date(year, month, 1)
        end_date = date(year, month, days_in_month)
        records = JHInspectionRecord.objects.filter(
            machine=machine,
            date__gte=start_date,
            date__lte=end_date,
        ).prefetch_related('item_results', 'item_results__item')

        for rec in records:
            day_num = rec.date.day
            shift_code = rec.shift
            col_key = f"{day_num}_{shift_code}"
            for res in rec.item_results.all():
                if res.item.sub_no in matrix:
                    matrix[res.item.sub_no][col_key] = res.status

    # ── Styling Definitions ──────────────────────────────────────────────────
    thin_side = Side(style='thin', color='000000')
    medium_side = Side(style='medium', color='000000')

    thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    # Fonts
    font_main_title   = Font(name='Arial', size=13, bold=True)
    font_badge_title  = Font(name='Arial', size=9, bold=True, color='000000')
    font_format_no    = Font(name='Arial', size=8, bold=True)
    font_meta         = Font(name='Arial', size=10, bold=True)
    font_col_header   = Font(name='Arial', size=9, bold=True)
    font_action_hdr   = Font(name='Arial', size=9, bold=True)
    font_day_hdr      = Font(name='Arial', size=9, bold=True)
    font_shift_hdr    = Font(name='Arial', size=8, bold=True)
    font_data         = Font(name='Arial', size=9)
    font_hindi        = Font(name='Arial', size=9)
    font_star         = Font(name='Arial', size=11, bold=True, color='1D4ED8')  # Blue star ★
    font_ok           = Font(name='Arial', size=10, bold=True, color='059669')  # Green ✓
    font_not_ok       = Font(name='Arial', size=10, bold=True, color='DC2626')  # Red ✕
    font_corrected    = Font(name='Arial', size=10, bold=True, color='2563EB')  # Blue ⊗
    font_legend       = Font(name='Arial', size=9, bold=True)

    # Fills
    fill_yellow_badge = PatternFill(start_color='FFEB3B', end_color='FFEB3B', fill_type='solid')
    fill_red_symbol   = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid')
    fill_action_hdr   = PatternFill(start_color='FFF59D', end_color='FFF59D', fill_type='solid')
    fill_not_ok_cell  = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid')
    fill_corr_cell    = PatternFill(start_color='DBEAFE', end_color='DBEAFE', fill_type='solid')
    fill_gray_header  = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    fill_light_shift  = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')

    # Alignments
    align_center       = Alignment(horizontal='center', vertical='center', wrap_text=True)
    align_left         = Alignment(horizontal='left', vertical='center', wrap_text=True)
    align_right        = Alignment(horizontal='right', vertical='center', wrap_text=True)
    align_vert_center  = Alignment(horizontal='center', vertical='center')

    # ── Columns Setup ────────────────────────────────────────────────────────
    fixed_col_count = 16
    total_cols = fixed_col_count + (days_in_month * shift_count)

    # ── ROW 1: TOP BANNER ────────────────────────────────────────────────────
    ws.row_dimensions[1].height = 36

    # Left: JISHU-HOZEN Monitoring sheet
    ws.merge_cells("A1:E1")
    ws["A1"] = "JISHU-HOZEN   Monitoring sheet\n(JH STEP-3 Tentative Standards)"
    ws["A1"].font = font_main_title
    ws["A1"].alignment = align_left

    # Middle Warning Badges (Cols J to S)
    # 1. BREAK DOWN (Cols J:K merged, Col L symbol)
    ws.merge_cells("J1:K1")
    ws["J1"] = "BREAK DOWN"
    ws["J1"].font = font_badge_title
    ws["J1"].fill = fill_yellow_badge
    ws["J1"].alignment = align_center

    ws["L1"] = "▲ B"
    ws["L1"].font = Font(name='Arial', size=9, bold=True, color='DC2626')
    ws["L1"].fill = fill_red_symbol
    ws["L1"].alignment = align_center

    # 2. ACCIDENT (Cols M:N merged, Col O symbol)
    ws.merge_cells("M1:N1")
    ws["M1"] = "ACCIDENT"
    ws["M1"].font = font_badge_title
    ws["M1"].fill = fill_yellow_badge
    ws["M1"].alignment = align_center

    ws["O1"] = "✚"
    ws["O1"].font = Font(name='Arial', size=11, bold=True, color='DC2626')
    ws["O1"].fill = fill_red_symbol
    ws["O1"].alignment = align_center

    # 3. DEFECT (Cols P:Q merged, Col R symbol)
    ws.merge_cells("P1:Q1")
    ws["P1"] = "DEFECT"
    ws["P1"].font = font_badge_title
    ws["P1"].fill = fill_yellow_badge
    ws["P1"].alignment = align_center

    ws["R1"] = "● D"
    ws["R1"].font = Font(name='Arial', size=9, bold=True, color='000000')
    ws["R1"].fill = fill_yellow_badge
    ws["R1"].alignment = align_center

    # Right: FORMAT NO
    last_col_letter = get_column_letter(total_cols)
    fmt_start_col = max(19, total_cols - 4)
    fmt_start_letter = get_column_letter(fmt_start_col)
    ws.merge_cells(f"{fmt_start_letter}1:{last_col_letter}1")
    ws[f"{fmt_start_letter}1"] = "FORMAT NO : QF/MF-08\nRev No : 00     Rev Date : 01.01.24"
    ws[f"{fmt_start_letter}1"].font = font_format_no
    ws[f"{fmt_start_letter}1"].alignment = align_right

    # ── ROW 2: METADATA ROW ──────────────────────────────────────────────────
    ws.row_dimensions[2].height = 24

    ws.merge_cells("A2:C2")
    ws["A2"] = "LINE NAME :-"
    ws["A2"].font = font_meta
    ws["A2"].alignment = align_left

    mc_code = machine.machine_code if machine else 'CNC-01'
    mc_name = machine.name if machine else 'Machine'
    ws.merge_cells("D2:H2")
    ws["D2"] = f"MC NAME :-  {mc_code} ({mc_name})"
    ws["D2"].font = font_meta
    ws["D2"].alignment = align_left

    ws.merge_cells("I2:N2")
    ws["I2"] = f"MONTH & YEAR :-  {month_name.upper()} - {year}"
    ws["I2"].font = font_meta
    ws["I2"].alignment = align_left

    ws.merge_cells(f"O2:{last_col_letter}2")
    ws["O2"] = "JH STATUS :-  STEP 3"
    ws["O2"].font = font_meta
    ws["O2"].alignment = align_left

    # ── ROWS 3 & 4: TABLE HEADERS ────────────────────────────────────────────
    ws.row_dimensions[3].height = 22
    ws.row_dimensions[4].height = 20

    fixed_headers = [
        (1, "ROOT\nMAP NO"),
        (2, "Assembly"),
        (3, "Sub\nNo"),
        (4, "Sub Assembly"),
        (5, "Check For"),
        (6, "Standard"),
        (7, "Tool"),
        (8, "Rank"),
        (9, "Freq"),
    ]

    for col_idx, text in fixed_headers:
        col_letter = get_column_letter(col_idx)
        ws.merge_cells(f"{col_letter}3:{col_letter}4")
        cell = ws[f"{col_letter}3"]
        cell.value = text
        cell.font = font_col_header
        cell.alignment = align_center

    # ACTION Block (Cols 10 to 13, J to M)
    ws.merge_cells("J3:M3")
    ws["J3"] = "ACTION"
    ws["J3"].font = font_col_header
    ws["J3"].alignment = align_center
    ws["J3"].fill = fill_action_hdr

    action_subs = [
        (10, "C"),   # Clean
        (11, "L"),   # Lubricate
        (12, "I"),   # Inspect
        (13, "Rt"),  # Retighten
    ]
    for col_idx, sub_lbl in action_subs:
        cell = ws.cell(row=4, column=col_idx)
        cell.value = sub_lbl
        cell.font = font_action_hdr
        cell.alignment = align_center
        cell.fill = fill_action_hdr

    # Fixed Right Headers
    right_headers = [
        (14, "DURING\nMACHINE\nOPERATION"),
        (15, "TIME\nIN SEC"),
        (16, "RESP"),
    ]
    for col_idx, text in right_headers:
        col_letter = get_column_letter(col_idx)
        ws.merge_cells(f"{col_letter}3:{col_letter}4")
        cell = ws[f"{col_letter}3"]
        cell.value = text
        cell.font = font_col_header
        cell.alignment = align_center

    # Day & Shift Columns (Cols 17 onwards)
    for d in range(1, days_in_month + 1):
        start_c = fixed_col_count + 1 + ((d - 1) * shift_count)
        end_c = start_c + shift_count - 1

        start_letter = get_column_letter(start_c)
        end_letter = get_column_letter(end_c)

        # Merge Day Header in Row 3
        if start_c != end_c:
            ws.merge_cells(f"{start_letter}3:{end_letter}3")
        day_cell = ws[f"{start_letter}3"]
        day_cell.value = d
        day_cell.font = font_day_hdr
        day_cell.alignment = align_center
        day_cell.fill = fill_gray_header

        # Shift Headers in Row 4
        for s_idx, shift_code in enumerate(shifts):
            shift_col = start_c + s_idx
            s_cell = ws.cell(row=4, column=shift_col)
            s_cell.value = shift_code
            s_cell.font = font_shift_hdr
            s_cell.alignment = align_center
            s_cell.fill = fill_light_shift

    # ── ROWS 5 ONWARDS: DATA ROWS ────────────────────────────────────────────
    current_row = 5
    assembly_groups = []
    current_assembly = None
    assembly_start_row = 5

    for item in items:
        ws.row_dimensions[current_row].height = 26

        # Check for assembly grouping
        item_assembly = item.assembly.strip()
        if current_assembly is None:
            current_assembly = item_assembly
            assembly_start_row = current_row
        elif item_assembly != current_assembly:
            assembly_groups.append((current_assembly, assembly_start_row, current_row - 1))
            current_assembly = item_assembly
            assembly_start_row = current_row

        # Col 1: ROOT MAP NO (left blank or root map index)
        c1 = ws.cell(row=current_row, column=1, value="")
        c1.alignment = align_center
        c1.font = font_col_header

        # Col 2: Assembly
        c2 = ws.cell(row=current_row, column=2, value=item.assembly)
        c2.alignment = align_left
        c2.font = font_col_header

        # Col 3: Sub No
        c3 = ws.cell(row=current_row, column=3, value=item.sub_no)
        c3.alignment = align_center
        c3.font = font_col_header

        # Col 4: Sub Assembly (Hindi)
        c4 = ws.cell(row=current_row, column=4, value=item.sub_assembly or '—')
        c4.alignment = align_left
        c4.font = font_hindi

        # Col 5: Check For (Hindi)
        c5 = ws.cell(row=current_row, column=5, value=item.check_point)
        c5.alignment = align_left
        c5.font = font_hindi

        # Col 6: Standard (Hindi)
        c6 = ws.cell(row=current_row, column=6, value=item.standard)
        c6.alignment = align_left
        c6.font = font_hindi

        # Col 7: Tool
        tool_label = 'VISUAL' if item.tool_type == 'VISUAL' else 'TOUCH' if item.tool_type == 'TOUCH' else 'TOOL'
        c7 = ws.cell(row=current_row, column=7, value=tool_label)
        c7.alignment = align_center
        c7.font = Font(name='Arial', size=9)

        # Col 8: Rank
        c8 = ws.cell(row=current_row, column=8, value=item.rank or 'D')
        c8.alignment = align_center
        c8.font = font_col_header

        # Col 9: Freq
        c9 = ws.cell(row=current_row, column=9, value=item.frequency or 'D')
        c9.alignment = align_center
        c9.font = font_data

        # Col 10 to 13: ACTION stars (★)
        c10 = ws.cell(row=current_row, column=10, value="★" if item.action_clean else "")
        c10.alignment = align_center
        c10.font = font_star

        c11 = ws.cell(row=current_row, column=11, value="★" if item.action_lubricate else "")
        c11.alignment = align_center
        c11.font = font_star

        c12 = ws.cell(row=current_row, column=12, value="★" if item.action_inspect else "")
        c12.alignment = align_center
        c12.font = font_star

        c13 = ws.cell(row=current_row, column=13, value="★" if item.action_retighten else "")
        c13.alignment = align_center
        c13.font = font_star

        # Col 14: DURING OPERATION
        c14 = ws.cell(row=current_row, column=14, value="✓")
        c14.alignment = align_center
        c14.font = font_ok

        # Col 15: TIME IN SEC
        c15 = ws.cell(row=current_row, column=15, value=item.timing_sec or '5 DPT.')
        c15.alignment = align_center
        c15.font = font_data

        # Col 16: RESP
        c16 = ws.cell(row=current_row, column=16, value="OPR")
        c16.alignment = align_center
        c16.font = font_data

        # Day & Shift Evaluation Cells
        for d in range(1, days_in_month + 1):
            start_c = fixed_col_count + 1 + ((d - 1) * shift_count)
            for s_idx, shift_code in enumerate(shifts):
                shift_col = start_c + s_idx
                cell_key = f"{d}_{shift_code}"
                eval_status = matrix.get(item.sub_no, {}).get(cell_key)

                val_cell = ws.cell(row=current_row, column=shift_col)
                val_cell.alignment = align_center

                if eval_status == 'OK':
                    val_cell.value = "✓"
                    val_cell.font = font_ok
                elif eval_status == 'NOT_OK':
                    val_cell.value = "✕"
                    val_cell.font = font_not_ok
                    val_cell.fill = fill_not_ok_cell
                elif eval_status == 'CORRECTED':
                    val_cell.value = "⊗"
                    val_cell.font = font_corrected
                    val_cell.fill = fill_corr_cell
                else:
                    val_cell.value = ""

        current_row += 1

    # Add final assembly group
    if current_assembly is not None:
        assembly_groups.append((current_assembly, assembly_start_row, current_row - 1))

    # Merge assembly column cells vertically for each assembly
    for asm_name, s_row, e_row in assembly_groups:
        if s_row < e_row:
            ws.merge_cells(f"B{s_row}:B{e_row}")
            ws[f"B{s_row}"].alignment = align_vert_center

            ws.merge_cells(f"A{s_row}:A{e_row}")
            ws[f"A{s_row}"].value = "5"
            ws[f"A{s_row}"].alignment = align_vert_center

    # ── LEGEND FOOTER ROW ────────────────────────────────────────────────────
    legend_row = current_row
    ws.row_dimensions[legend_row].height = 24
    ws.merge_cells(f"A{legend_row}:{last_col_letter}{legend_row}")
    l_cell = ws[f"A{legend_row}"]
    l_cell.value = "✓  OK                  ✕  NOT OK                  ⊗  NOT OK CORRECTION DONE"
    l_cell.font = font_legend
    l_cell.alignment = align_center
    l_cell.fill = fill_gray_header

    # ── BORDERS & CELL STYLING PASS ──────────────────────────────────────────
    for r in range(1, legend_row + 1):
        for c in range(1, total_cols + 1):
            cell = ws.cell(row=r, column=c)
            if not cell.border or cell.border == Border():
                cell.border = thin_border

    # ── COLUMN WIDTHS ────────────────────────────────────────────────────────
    col_widths = {
        1: 6,    # ROOT MAP NO
        2: 20,   # Assembly
        3: 7,    # Sub No
        4: 20,   # Sub Assembly
        5: 32,   # Check For
        6: 28,   # Standard
        7: 8,    # Tool
        8: 6,    # Rank
        9: 6,    # Freq
        10: 4.5, # C
        11: 4.5, # L
        12: 4.5, # I
        13: 4.5, # Rt
        14: 10,  # During Op
        15: 9,   # Time
        16: 7,   # Resp
    }

    for col_idx, width in col_widths.items():
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    # Shift columns width
    for c in range(fixed_col_count + 1, total_cols + 1):
        col_letter = get_column_letter(c)
        ws.column_dimensions[col_letter].width = 4.2

    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
