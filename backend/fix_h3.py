import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/services.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

original_fp_loop = """            fp_sessions = InspectionSession.objects.filter(**fp_kwargs).order_by('trial_number', 'started_at')
            for fp_s in fp_sessions:
                fp_doc = self.collection.find_one({'_id': str(fp_s.session_id)})
                if fp_doc:
                    t_no = fp_s.trial_number or fp_doc.get('trial_number') or 1
                    if fp_s.finalized_by and 'inspector_name' not in doc:
                        doc['inspector_name'] = fp_s.finalized_by.get_full_name()
                    for m in fp_doc.get('measurements', []):
                        add_meas(m, def_type='first_piece', def_trial=t_no, def_slot=1)"""

fixed_fp_loop = """            fp_sessions = list(InspectionSession.objects.filter(**fp_kwargs).order_by('trial_number', 'started_at'))
            if fp_sessions:
                fp_ids = [str(s.session_id) for s in fp_sessions]
                fp_docs = {d['_id']: d for d in self.collection.find({'_id': {'$in': fp_ids}})}
                for fp_s in fp_sessions:
                    fp_doc = fp_docs.get(str(fp_s.session_id))
                    if fp_doc:
                        t_no = fp_s.trial_number or fp_doc.get('trial_number') or 1
                        if fp_s.finalized_by and 'inspector_name' not in doc:
                            doc['inspector_name'] = fp_s.finalized_by.get_full_name()
                        for m in fp_doc.get('measurements', []):
                            add_meas(m, def_type='first_piece', def_trial=t_no, def_slot=1)"""


original_hourly_loop = """            hourly_sessions = InspectionSession.objects.filter(**hourly_kwargs).order_by('hourly_unlocked_slot', 'started_at')
            for h_sess in hourly_sessions:
                h_doc = self.collection.find_one({'_id': str(h_sess.session_id)})
                if h_doc:
                    slot = h_sess.hourly_unlocked_slot or h_doc.get('hourly_slot') or 1
                    for m in h_doc.get('measurements', []):
                        add_meas(m, def_type='hourly', def_trial=0, def_slot=slot)"""


fixed_hourly_loop = """            hourly_sessions = list(InspectionSession.objects.filter(**hourly_kwargs).order_by('hourly_unlocked_slot', 'started_at'))
            if hourly_sessions:
                hourly_ids = [str(s.session_id) for s in hourly_sessions]
                hourly_docs = {d['_id']: d for d in self.collection.find({'_id': {'$in': hourly_ids}})}
                for h_sess in hourly_sessions:
                    h_doc = hourly_docs.get(str(h_sess.session_id))
                    if h_doc:
                        slot = h_sess.hourly_unlocked_slot or h_doc.get('hourly_slot') or 1
                        for m in h_doc.get('measurements', []):
                            add_meas(m, def_type='hourly', def_trial=0, def_slot=slot)"""

content = content.replace(original_fp_loop, fixed_fp_loop)
content = content.replace(original_hourly_loop, fixed_hourly_loop)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
