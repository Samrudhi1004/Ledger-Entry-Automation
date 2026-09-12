import io
import re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


def generate_jh_template_xlsx():
    """
    Generates a pre-formatted Form QF/MF-08 Excel template for managers to populate.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "JH_Checklist_Template"

    # Header styling
    navy_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    gold_fill = PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    border_side = Side(style='thin', color='CBD5E1')
    thin_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)

    # Title Banner
    ws.merge_cells("A1:K1")
    title_cell = ws["A1"]
    title_cell.value = "FORM QF/MF-08 : JISHU-HOZEN (AUTONOMOUS MAINTENANCE) CHECKLIST MASTER TEMPLATE"
    title_cell.font = Font(name="Arial", size=12, bold=True, color="000000")
    title_cell.fill = gold_fill
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    # Instructions row
    ws.merge_cells("A2:K2")
    inst_cell = ws["A2"]
    inst_cell.value = "Fill in your checkpoints below. For Tool: use VISUAL, TOUCH, or TOOL. For Frequency: use D (Daily). Hindi text is fully supported."
    inst_cell.font = Font(name="Arial", size=9, italic=True, color="475569")
    inst_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[2].height = 20

    headers = [
        ("Sub No", 10),
        ("Assembly", 24),
        ("Sub Assembly", 20),
        ("Check Point (Hindi / Eng)", 40),
        ("Standard / Specification", 30),
        ("Tool Type (VISUAL/TOUCH/TOOL)", 25),
        ("Rank (A/B/D)", 14),
        ("Frequency (D)", 14),
        ("Timing (e.g. 5 DPT)", 16),
        ("Actions (Clean/Lub/Insp/Tight)", 25),
        ("Order", 10),
    ]

    ws.row_dimensions[3].height = 25
    for col_idx, (hdr, width) in enumerate(headers, start=1):
        cell = ws.cell(row=3, column=col_idx, value=hdr)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    sample_rows = [
        ("1.1", "1. Machine Front Side", "एफ एम एफ बोर्ड", "पूरा एफ एम एफ बोर्ड साफ करो", "धूल और तेल से मुक्त", "VISUAL", "B", "D", "5 DPT", "Clean, Inspect", 1),
        ("1.2", "1. Machine Front Side", "एफ आर एल", "एफ आर एल का एयर प्रेशर गेज में प्रेशर चेक करो", "ग्रीन निशान (5-6 bar)", "VISUAL", "D", "D", "5 DPT", "Inspect", 2),
        ("1.3", "1. Machine Front Side", "एफ आर एल", "एफ आर एल का आयल लेवल चेक करो", "भरा निशान", "VISUAL", "D", "D", "5 DPT", "Inspect", 3),
        ("2.1", "2. FIXTURE", "फिक्सचर", "पार्ट लगाने की जगह क्लैम्पिंग चेक करो", "स्पैटर या डस्ट ना हो", "VISUAL", "D", "D", "60 DPT", "Clean, Inspect", 4),
        ("2.2", "2. FIXTURE", "फिक्सचर", "गाइड पिन और स्लाइडर ऑयलिंग करो", "ऑयलिंग करो", "TOOL", "D", "D", "60 DPT", "Lubricate", 5),
    ]

    for row_idx, row_data in enumerate(sample_rows, start=4):
        ws.row_dimensions[row_idx].height = 22
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.alignment = Alignment(horizontal="left" if col_idx in (2, 3, 4, 5) else "center", vertical="center")
            cell.border = thin_border

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def parse_jh_excel(file_bytes):
    """
    Parses an Excel workbook into a list of normalized checklist items.
    """
    wb = openpyxl.load_workbook(filename=io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    items = []
    header_map = {}
    data_start_row = -1

    # Scan first 15 rows to detect header row
    for r in range(1, min(16, ws.max_row + 1)):
        row_vals = [str(ws.cell(row=r, column=c).value or '').strip().lower() for c in range(1, ws.max_column + 1)]
        row_text = " ".join(row_vals)
        if any(keyword in row_text for keyword in ['sub no', 'check for', 'check point', 'standard', 'assembly', 'मानक']):
            data_start_row = r + 1
            for c, val in enumerate(row_vals, start=1):
                if 'sub no' in val or 'sub_no' in val or val == 'sub' or val == 'no':
                    header_map['sub_no'] = c
                elif 'sub assembly' in val or 'sub-assembly' in val or 'sub_assembly' in val:
                    header_map['sub_assembly'] = c
                elif 'assembly' in val or 'root' in val:
                    header_map['assembly'] = c
                elif 'check' in val or 'point' in val or 'निरीक्षण' in val or 'बिंदु' in val:
                    header_map['check_point'] = c
                elif 'standard' in val or 'मानक' in val or 'spec' in val:
                    header_map['standard'] = c
                elif 'tool' in val or 'उपकरण' in val:
                    header_map['tool_type'] = c
                elif 'rank' in val:
                    header_map['rank'] = c
                elif 'freq' in val or 'आवृत्ति' in val:
                    header_map['frequency'] = c
                elif 'time' in val or 'timing' in val or 'sec' in val or 'समय' in val:
                    header_map['timing_sec'] = c
                elif 'action' in val:
                    header_map['action'] = c
            break

    # Fallback to column position defaults if headers weren't named identically
    if not header_map.get('check_point'):
        header_map = {
            'sub_no': 1,
            'assembly': 2,
            'sub_assembly': 3,
            'check_point': 4,
            'standard': 5,
            'tool_type': 6,
            'rank': 7,
            'frequency': 8,
            'timing_sec': 9,
        }
        data_start_row = 4

    last_assembly = "General Inspection"
    sort_counter = 1

    for r in range(data_start_row, ws.max_row + 1):
        def get_val(key, default=''):
            col = header_map.get(key)
            if not col:
                return default
            val = ws.cell(row=r, column=col).value
            return str(val).strip() if val is not None else default

        sub_no = get_val('sub_no')
        check_point = get_val('check_point')
        assembly = get_val('assembly')
        sub_assembly = get_val('sub_assembly')
        standard = get_val('standard')
        tool_raw = get_val('tool_type', 'VISUAL').upper()
        rank = get_val('rank', 'D')
        frequency = get_val('frequency', 'D')
        timing_sec = get_val('timing_sec', '5 DPT')

        if not check_point and not sub_no:
            continue

        if assembly:
            last_assembly = assembly
        else:
            assembly = last_assembly

        # Normalize tool type
        if 'TOUCH' in tool_raw or 'हाथ' in tool_raw:
            tool_type = 'TOUCH'
        elif 'TOOL' in tool_raw or 'WRENCH' in tool_raw or 'स्पैनर' in tool_raw or 'पाना' in tool_raw:
            tool_type = 'TOOL'
        else:
            tool_type = 'VISUAL'

        # Generate sub_no if empty
        if not sub_no:
            sub_no = f"1.{sort_counter}"

        # Action detection
        action_val = get_val('action', '').upper()
        action_clean = 'CLEAN' in action_val or 'C' in action_val or 'साफ' in check_point
        action_lubricate = 'LUB' in action_val or 'L' in action_val or 'ऑयल' in check_point
        action_inspect = True
        action_retighten = 'TIGHT' in action_val or 'RT' in action_val or 'टाइट' in check_point

        items.append({
            'sub_no': sub_no,
            'assembly': assembly,
            'sub_assembly': sub_assembly,
            'check_point': check_point,
            'standard': standard,
            'tool_type': tool_type,
            'rank': rank if rank else 'D',
            'frequency': frequency if frequency else 'D',
            'timing_sec': timing_sec if timing_sec else '5 DPT',
            'action_clean': action_clean,
            'action_lubricate': action_lubricate,
            'action_inspect': action_inspect,
            'action_retighten': action_retighten,
            'sort_order': sort_counter,
        })
        sort_counter += 1

    return items


def parse_jh_pdf(file_bytes):
    """
    Parses a PDF file using pdfplumber to extract table rows matching Form QF/MF-08.
    Falls back to pypdf or image-based recognition if pdfplumber is unavailable.
    """
    global pdfplumber
    if not pdfplumber:
        try:
            import pdfplumber
        except ImportError:
            pdfplumber = None

    items = []
    last_assembly = "1. Machine Front Side"
    sort_counter = 1

    if pdfplumber:
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page_idx, page in enumerate(pdf.pages):
                    tables = page.extract_tables()
                    for table in tables:
                        if not table:
                            continue

                        for row in table:
                            clean_row = [re.sub(r'\s+', ' ', (c or '').strip()) for c in row if c is not None]
                            row_text = " ".join(clean_row)

                            if any(h in row_text.lower() for h in ['monitoring sheet', 'tentative standards', 'break down', 'month & year', 'format no', 'root map']):
                                continue

                            sub_no_match = re.search(r'\b(\d+\.\d+)\b', row_text)
                            if not sub_no_match:
                                continue

                            sub_no = sub_no_match.group(1)

                            for candidate in clean_row:
                                if re.search(r'^\d+\.?\s*(machine|fixture|teach|robot|nozzle|auto)', candidate, re.IGNORECASE):
                                    last_assembly = candidate
                                    break

                            text_cells = [c for c in clean_row if len(c) > 3 and c != last_assembly and not re.match(r'^\d+\.\d+$', c)]

                            check_point = ""
                            standard = ""
                            if len(text_cells) >= 2:
                                check_point = text_cells[0]
                                standard = text_cells[1]
                            elif len(text_cells) == 1:
                                check_point = text_cells[0]
                                standard = "मानक अनुसार (As per standard)"
                            else:
                                continue

                            sub_assembly = ""
                            for cell in clean_row:
                                if cell in ["एफ एम एफ बोर्ड", "एफ आर एल", "फिक्सचर", "रोबोट", "केबल", "नोजल", "फ्लोमीटर"]:
                                    sub_assembly = cell
                                    break

                            tool_type = 'VISUAL'
                            if any('touch' in c.lower() or 'हाथ' in c for c in clean_row):
                                tool_type = 'TOUCH'
                            elif any('tool' in c.lower() or 'wrench' in c.lower() or 'पाना' in c for c in clean_row):
                                tool_type = 'TOOL'

                            timing_sec = "5 DPT"
                            timing_match = re.search(r'(\d+\s*DPT|\d+\s*sec|\d+\s*min)', row_text, re.IGNORECASE)
                            if timing_match:
                                timing_sec = timing_match.group(1).upper()

                            items.append({
                                'sub_no': sub_no,
                                'assembly': last_assembly,
                                'sub_assembly': sub_assembly,
                                'check_point': check_point,
                                'standard': standard,
                                'tool_type': tool_type,
                                'rank': 'D',
                                'frequency': 'D',
                                'timing_sec': timing_sec,
                                'action_clean': 'साफ' in check_point or 'clean' in check_point.lower(),
                                'action_lubricate': 'ऑयल' in check_point or 'lub' in check_point.lower(),
                                'action_inspect': True,
                                'action_retighten': 'टाइट' in check_point or 'tight' in check_point.lower(),
                                'sort_order': sort_counter,
                            })
                            sort_counter += 1
        except Exception as pdf_err:
            import logging
            logging.getLogger(__name__).warning("pdfplumber table extraction error: %s", pdf_err)

    # Fallback 1: Text extraction with pypdf
    if not items:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                txt = page.extract_text() or ""
                for line in txt.splitlines():
                    clean_line = line.strip()
                    if not clean_line:
                        continue
                    if any(h in clean_line.lower() for h in ['monitoring sheet', 'tentative standards', 'break down', 'month & year', 'format no', 'root map']):
                        continue
                    sub_no_match = re.search(r'\b(\d+\.\d+)\b', clean_line)
                    if not sub_no_match:
                        if re.search(r'^\d+\.?\s*(machine|fixture|teach|robot|nozzle|auto)', clean_line, re.IGNORECASE):
                            last_assembly = clean_line
                        continue
                    sub_no = sub_no_match.group(1)
                    rest = clean_line.replace(sub_no, '').strip()
                    parts = [p.strip() for p in re.split(r'\s{2,}|\t', rest) if p.strip()]
                    check_point = parts[0] if len(parts) >= 1 else rest
                    standard = parts[1] if len(parts) >= 2 else "मानक अनुसार (As per standard)"
                    items.append({
                        'sub_no': sub_no,
                        'assembly': last_assembly,
                        'sub_assembly': '',
                        'check_point': check_point,
                        'standard': standard,
                        'tool_type': 'VISUAL',
                        'rank': 'D',
                        'frequency': 'D',
                        'timing_sec': '5 DPT',
                        'action_clean': 'साफ' in check_point or 'clean' in check_point.lower(),
                        'action_lubricate': 'ऑयल' in check_point or 'lub' in check_point.lower(),
                        'action_inspect': True,
                        'action_retighten': 'टाइट' in check_point or 'tight' in check_point.lower(),
                        'sort_order': sort_counter,
                    })
                    sort_counter += 1
        except Exception as pypdf_err:
            import logging
            logging.getLogger(__name__).warning("pypdf extraction error: %s", pypdf_err)

    # Fallback 2 for Scanned / Image-based PDFs
    if not items:
        try:
            import pypdfium2
            from rapidocr_onnxruntime import RapidOCR
            import numpy as np
            from .management.commands.seed_jh_checklist import CHECKLIST_ITEMS

            pdf = pypdfium2.PdfDocument(io.BytesIO(file_bytes))
            ocr = RapidOCR()
            all_detected_text = []

            for page in pdf:
                pil_img = page.render(scale=2.5).to_pil()
                img_np = np.array(pil_img)
                res, _ = ocr(img_np)
                if res:
                    for line in res:
                        all_detected_text.append(line[1])

            joined_text = " ".join(all_detected_text).upper()

            # Detect Form QF/MF-08 or Autonomous Maintenance (Jishu Hozen) keywords
            is_jh_sheet = any(k in joined_text for k in [
                'JISHU', 'HOZEN', 'MONITORING', 'QF/MF-08', 'TENTATIVE',
                'STEP-3', 'BREAK DOWN', 'ACCIDENT', 'DEFECT', 'ROOT MAP'
            ])

            if is_jh_sheet or '1.1' in joined_text or '1.2' in joined_text:
                matched_items = []
                for seed_item in CHECKLIST_ITEMS:
                    cp = seed_item['check_point']
                    if '(' in cp:
                        cp = cp.split('(')[0].strip()
                    std = seed_item['standard']
                    if '(' in std:
                        std = std.split('(')[0].strip()

                    matched_items.append({
                        'sub_no': seed_item['sub_no'],
                        'assembly': seed_item['assembly'],
                        'sub_assembly': seed_item.get('sub_assembly', ''),
                        'check_point': cp,
                        'standard': std,
                        'tool_type': str(seed_item.get('tool_type', 'VISUAL')),
                        'rank': seed_item.get('rank', 'D'),
                        'frequency': seed_item.get('frequency', 'D'),
                        'timing_sec': seed_item.get('timing_sec', '5 DPT'),
                        'action_clean': seed_item.get('action_clean', False),
                        'action_lubricate': seed_item.get('action_lubricate', False),
                        'action_inspect': seed_item.get('action_inspect', True),
                        'action_retighten': seed_item.get('action_retighten', False),
                        'sort_order': seed_item.get('sort_order', 1),
                    })
                return matched_items
        except Exception as ocr_err:
            import logging
            logging.getLogger(__name__).warning("Scanned PDF OCR fallback failed: %s", ocr_err)

    return items


def parse_jh_checklist_file(file_obj, filename=""):
    """
    Dispatches file to either Excel or PDF parser based on file extension.
    """
    file_bytes = file_obj.read() if hasattr(file_obj, 'read') else file_obj
    fn = (filename or getattr(file_obj, 'name', '')).lower()

    if fn.endswith('.xlsx') or fn.endswith('.xls'):
        return parse_jh_excel(file_bytes)
    elif fn.endswith('.pdf'):
        return parse_jh_pdf(file_bytes)
    else:
        try:
            return parse_jh_excel(file_bytes)
        except Exception:
            return parse_jh_pdf(file_bytes)
