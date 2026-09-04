import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { formatDate, fmt } from '../../utils/formatters';

const isValOOC = (val, lower, upper, status) => {
  if (status === 'out_of_spec' || status === 'rejected' || status === 'ooc') return true;
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  if (isNaN(num)) return false;
  if (lower !== undefined && lower !== null && lower !== '' && num < Number(lower)) return true;
  if (upper !== undefined && upper !== null && upper !== '' && num > Number(upper)) return true;
  return false;
};

export default function OfficialFormF02Modal({ session, onClose, autoDownload = false }) {
  const [downloading, setDownloading] = useState(false);

  const dateStr = session?.started_at ? session.started_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const cleanMachine = (session?.machine_code || 'MCH').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPart = (session?.part_number || 'PART').replace(/[^a-zA-Z0-9_-]/g, '_');
  const shiftStr = session?.shift || 'A';
  const isSetupReport = session?.is_setup_approval_only === true;
  
  const shiftDuration = session?.shift_duration_hours || 8;
  const shiftSlots = Array.from({ length: shiftDuration }, (_, i) => i + 1);

  const reportPrefix = isSetupReport ? 'Setup_Approval_Report' : 'Form_F02_Report';
  const fileName = `${reportPrefix}_${dateStr}_Shift_${shiftStr}_${cleanMachine}_${cleanPart}.pdf`;

  const handleDownloadPDF = () => {
    const element = document.getElementById('official-form-f02-report');
    if (!element) return;

    setDownloading(true);

    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    element.style.width = '1122px';
    element.style.maxWidth = 'none';

    const opt = {
      margin:       [5, 5, 5, 5],
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 1122 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    const savePDF = () => {
      if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save().then(() => {
          element.style.width = originalWidth;
          element.style.maxWidth = originalMaxWidth;
          setDownloading(false);
        }).catch(() => {
          element.style.width = originalWidth;
          element.style.maxWidth = originalMaxWidth;
          setDownloading(false);
        });
      } else {
        alert('PDF library is loading. Please try again in a moment.');
        element.style.width = originalWidth;
        element.style.maxWidth = originalMaxWidth;
        setDownloading(false);
      }
    };

    if (window.html2pdf) {
      savePDF();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = savePDF;
      document.body.appendChild(script);
    }
  };

  useEffect(() => {
    if (autoDownload) {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoDownload]);

  // Master Data & Measurements
  const masterProductParams = session.parameter_summary || session.parameters || session.template_parameters || [];
  const masterProcessParams = session.process_parameter_summary || session.process_parameters || [];
  const measurements = session.measurements || [];

  const productMap = {};
  const processMap = {};

  // 1. Populate Product Parameters
  masterProductParams.forEach((p, idx) => {
    const code = p.parameter_code || `P${idx + 1}`;
    const nom = p.nominal ?? p.nominal_value ?? 0;
    const ll = p.lower_limit;
    const ul = p.upper_limit;
    const unit = p.unit || 'mm';

    let specStr = `${nom} ${unit}`;
    if (ll !== undefined && ul !== undefined && ll !== null && ul !== null) {
      specStr = `${nom} ${unit} [${ll} to ${ul}]`;
    }

    productMap[code] = {
      code: code,
      no: String(idx + 1).padStart(2, '0'),
      name: p.parameter_name || code,
      nominal: nom,
      lower_limit: ll,
      upper_limit: ul,
      unit: unit,
      spec: p.specification || specStr,
      method: p.measurement_technique || p.evaluation_technique || p.gauge_used || p.method || 'VERNIER CALIPER',
      sample: p.sample_size || p.sample_frequency || p.sample || '5NOS/SHIFT',
      critical: !!p.is_critical,
      trials: {},
      hourly: {},
      trialsOOC: {},
      hourlyOOC: {},
    };
  });

  // 2. Populate Process Parameters
  masterProcessParams.forEach((pp, idx) => {
    const code = pp.parameter_code || `PR${idx + 1}`;
    const spec = pp.specification || '—';
    const unit = pp.unit || '';
    const ll = pp.lower_limit;
    const ul = pp.upper_limit;

    processMap[code] = {
      code: code,
      no: String(idx + 1).padStart(2, '0'),
      name: pp.parameter_name || code,
      data_type: pp.data_type || 'numeric',
      spec: unit ? `${spec} ${unit}` : spec,
      lower_limit: ll,
      upper_limit: ul,
      unit: unit,
      method: 'CHECKLIST / DISPLAY',
      sample: '1ST PC ONLY',
      critical: false,
      trials: {},
      trialsOOC: {},
    };
  });

  // 3. Populate Measurements
  measurements.forEach((m) => {
    const code = m.parameter_code;
    if (!code) return;
    const trialNo = m.trial_number || 1;
    const isHourlyMeas = m.inspection_type === 'hourly';
    const isProcess = m.is_process_parameter || code.startsWith('PR') || !!processMap[code];

    const targetMap = isProcess ? processMap : productMap;

    if (!targetMap[code]) {
      const nom = m.nominal ?? 0;
      const ll = m.lower_limit;
      const ul = m.upper_limit;
      const unit = m.unit || '';
      let specStr = m.specification || (unit ? `${nom} ${unit}` : `${nom}`);

      targetMap[code] = {
        code: code,
        no: String(Object.keys(targetMap).length + 1).padStart(2, '0'),
        name: m.parameter_name || code,
        nominal: nom,
        lower_limit: ll,
        upper_limit: ul,
        unit: unit,
        spec: specStr,
        method: m.evaluation_technique || m.method || (isProcess ? 'CHECKLIST' : 'VERNIER CALIPER'),
        sample: m.sample_frequency || (isProcess ? '1ST PC ONLY' : '5NOS/SHIFT'),
        critical: !!m.is_critical,
        trials: {},
        hourly: {},
        trialsOOC: {},
        hourlyOOC: {},
      };
    } else {
      if (m.lower_limit !== undefined && m.lower_limit !== null) targetMap[code].lower_limit = m.lower_limit;
      if (m.upper_limit !== undefined && m.upper_limit !== null) targetMap[code].upper_limit = m.upper_limit;
    }

    const isOOC = (m.status === 'out_of_spec' || m.status === 'rejected' || m.status === 'ooc') ||
                  isValOOC(m.measured_value, m.lower_limit ?? targetMap[code].lower_limit, m.upper_limit ?? targetMap[code].upper_limit);

    const valDisplay = m.voice_raw_text || (m.measured_value !== undefined && m.measured_value !== null ? fmt(m.measured_value) : '—');

    if (isHourlyMeas && !isProcess && targetMap[code].hourly) {
      const slot = m.hourly_slot || 1;
      targetMap[code].hourly[slot] = valDisplay;
      targetMap[code].hourlyOOC[slot] = isOOC;
    } else {
      const tNo = (trialNo >= 1 && trialNo <= 3) ? trialNo : 1;
      targetMap[code].trials[tNo] = valDisplay;
      targetMap[code].trialsOOC[tNo] = isOOC;
    }
  });

  // 4. Populate process_param_entries if available
  const procEntries = session.process_param_entries || [];
  procEntries.forEach((entry, idx) => {
    const code = entry.parameter_code || `PR${idx + 1}`;
    const name = entry.parameter_name || code;
    const targetKey = Object.keys(processMap).find(
      k => k === code || processMap[k].name === name || processMap[k].code === code
    ) || code;

    if (!processMap[targetKey]) {
      processMap[targetKey] = {
        code: code,
        no: String(Object.keys(processMap).length + 1).padStart(2, '0'),
        name: name,
        spec: entry.specification || '—',
        method: 'CHECKLIST / DISPLAY',
        sample: '1ST PC ONLY',
        critical: false,
        trials: {},
        trialsOOC: {},
      };
    }

    if (entry.trial_1 !== undefined && entry.trial_1 !== null && entry.trial_1 !== '') {
      processMap[targetKey].trials[1] = String(entry.trial_1);
    }
    if (entry.trial_2 !== undefined && entry.trial_2 !== null && entry.trial_2 !== '') {
      processMap[targetKey].trials[2] = String(entry.trial_2);
    }
    if (entry.trial_3 !== undefined && entry.trial_3 !== null && entry.trial_3 !== '') {
      processMap[targetKey].trials[3] = String(entry.trial_3);
    }
  });

  const productList = Object.values(productMap);
  const processList = Object.values(processMap);

  return (
    <Modal
      size="xl"
      title={isSetupReport ? "MMPL Official First Piece Setup Approval Report (Form F02)" : "MMPL Official 1st Piece Cum In-Process Inspection Report (Form F02)"}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Official Document Reference: MMPL/PRD/F02 (REV 02)</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              id="download-pdf-btn"
              className="btn btn-primary"
              onClick={handleDownloadPDF}
              disabled={downloading}
            >
              {downloading ? 'Generating PDF...' : 'Download PDF Copy'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      }
    >
      <div
        id="official-form-f02-report"
        style={{
          background: '#ffffff',
          color: '#000000',
          padding: '16px 20px',
          fontFamily: "Arial, 'Helvetica Neue', sans-serif",
          fontSize: 10,
          lineHeight: 1.2,
          breakAfter: 'avoid',
        }}
      >
        {/* TOP HEADER */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', marginBottom: 6 }}>
          <tbody>
            <tr style={{ borderBottom: '1.5px solid #000000' }}>
              <td style={{ width: '12%', padding: '6px 4px', borderRight: '1.5px solid #000000', textAlign: 'center', background: '#000000', color: '#ffffff' }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>MMPL</div>
              </td>
              <td style={{ width: '73%', padding: '4px 10px', borderRight: '1.5px solid #000000', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: '0.5px', color: '#000000' }}>MANTRI METALLICS PVT. LTD.</div>
                <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 1, color: '#000000' }}>
                  {isSetupReport ? 'FIRST PIECE SETUP APPROVAL REPORT — PROCESS NO. 10' : '1ST PIECE CUM IN-PROCESS INSPECTION REPORT — PROCESS NO. 10'}
                </div>
              </td>
              <td style={{ width: '15%', padding: '4px 6px', textAlign: 'right', fontSize: 8.5, color: '#000000' }}>
                <div><strong>DOC REF:</strong> MMPL/PRD/F02</div>
                <div><strong>REV:</strong> 02 (15.8.2013)</div>
                <div style={{ marginTop: 1, fontWeight: 'bold' }}>PAGE 1 OF 1</div>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #000000', background: '#ffffff' }}>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>PROCESS NO:</span>{' '}
                <strong style={{ fontSize: 10, color: '#000000' }}>10.</strong>
              </td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>PART NAME & NO:</span>{' '}
                <strong style={{ fontSize: 10, color: '#000000' }}>{session.part_number} ({session.part_name || 'POLY V PULLEY'})</strong>
              </td>
              <td style={{ padding: '3px 6px' }}>
                <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>INSPECTOR / OPERATOR:</span>{' '}
                <strong style={{ fontSize: 10, color: '#000000' }}>{session.operator_name || `Inspector #${session.operator_id || ''}`}</strong>
              </td>
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>MACHINE NO:</span>{' '}
                <strong style={{ fontSize: 10, color: '#000000', fontFamily: 'Consolas, monospace' }}>{session.machine_code}</strong>
              </td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>DATE & SHIFT:</span>{' '}
                <strong style={{ fontSize: 10, color: '#000000' }}>{formatDate(session.started_at || session.created_at)} &nbsp;|&nbsp; Shift {session.shift || 'A'}</strong>
              </td>
              <td style={{ padding: '3px 6px' }}>
                <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>SETUP STATUS:</span>{' '}
                <strong style={{ fontSize: 10, color: '#000000' }}>{session.status ? session.status.toUpperCase().replace('_', ' ') : 'APPROVED'}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        {/* MAIN DATA TABLE */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', textAlign: 'center', fontSize: 8.5 }}>
          <thead>
            <tr style={{ background: '#e2e8f0', borderBottom: '1.5px solid #000000', color: '#000000' }}>
              <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '3%' }}>P.No</th>
              <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '3%' }}>No</th>
              <th style={{ border: '1px solid #000000', padding: '3px 4px', width: isSetupReport ? '23%' : '14%', textAlign: 'left' }}>
                Parameter Name & Description
              </th>
              <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '4%' }}>Class</th>
              <th style={{ border: '1px solid #000000', padding: '3px 4px', width: isSetupReport ? '17%' : '12%' }}>Specification</th>
              <th style={{ border: '1px solid #000000', padding: '3px 4px', width: isSetupReport ? '17%' : '12%' }}>Evaluation Technique</th>
              <th style={{ border: '1px solid #000000', padding: '3px 2px', width: isSetupReport ? '12%' : '9%' }}>Sample Freq</th>
              <th style={{ border: '1px solid #000000', padding: '3px 1px', width: isSetupReport ? '7%' : '5%', background: '#cbd5e1' }}>1st #1</th>
              <th style={{ border: '1px solid #000000', padding: '3px 1px', width: isSetupReport ? '7%' : '5%', background: '#cbd5e1' }}>1st #2</th>
              <th style={{ border: '1px solid #000000', padding: '3px 1px', width: isSetupReport ? '7%' : '5%', background: '#cbd5e1' }}>1st #3</th>
              
              {!isSetupReport && shiftSlots.map(slot => (
                <th key={slot} style={{ border: '1px solid #000000', padding: '3px 1px', width: '4%', background: '#dcfce7' }}>{slot}/Hr</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* SECTION 1: PRODUCT PARAMETER HEADER ROW (SETUP APPROVAL REPORT ONLY) */}
            {isSetupReport && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: '5px 8px',
                    textAlign: 'left',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    letterSpacing: '0.5px',
                    background: '#ffffff',
                    color: '#1e3a8a',
                    border: '1.5px solid #000000',
                    textTransform: 'uppercase',
                  }}
                >
                  PRODUCT PARAMETER
                </td>
              </tr>
            )}

            {productList.map((p, i) => {
              const tr1 = p.trials[1];
              const tr2 = p.trials[2];
              const tr3 = p.trials[3];
              const hr  = p.hourly || {};

              const tr1OOC = p.trialsOOC?.[1] || isValOOC(tr1, p.lower_limit, p.upper_limit);
              const tr2OOC = p.trialsOOC?.[2] || isValOOC(tr2, p.lower_limit, p.upper_limit);
              const tr3OOC = p.trialsOOC?.[3] || isValOOC(tr3, p.lower_limit, p.upper_limit);

              const isAltRow = i % 2 === 1;

              return (
                <tr key={`prod-${i}`} style={{ borderBottom: '1px solid #000000', background: isAltRow ? '#f8fafc' : '#ffffff' }}>
                  <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: 'bold' }}>10.</td>
                  <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: 'bold', fontFamily: 'Consolas, monospace' }}>{p.no}</td>
                  <td style={{ border: '1px solid #000000', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ border: '1px solid #000000', padding: '2px 1px' }}>{p.critical ? <span style={{ color: '#dc2626', fontSize: 8, fontWeight: 'bold' }}>CRITICAL</span> : '—'}</td>
                  <td style={{ border: '1px solid #000000', padding: '2px 4px', fontFamily: 'Consolas, monospace', fontWeight: 'bold' }}>{p.spec}</td>
                  <td style={{ border: '1px solid #000000', padding: '2px 4px', fontSize: 7.5, textTransform: 'uppercase' }}>{p.method}</td>
                  <td style={{ border: '1px solid #000000', padding: '2px 2px', fontSize: 7.5 }}>{p.sample}</td>
                  
                  <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: tr1OOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: tr1OOC ? '#dc2626' : '#000000', background: tr1OOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                    {tr1 !== undefined ? tr1 : '—'}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: tr2OOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: tr2OOC ? '#dc2626' : '#000000', background: tr2OOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                    {tr2 !== undefined ? tr2 : '—'}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: tr3OOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: tr3OOC ? '#dc2626' : '#000000', background: tr3OOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                    {tr3 !== undefined ? tr3 : '—'}
                  </td>

                  {!isSetupReport && shiftSlots.map((slot) => {
                    const hVal = hr[slot];
                    const hOOC = p.hourlyOOC?.[slot] || isValOOC(hVal, p.lower_limit, p.upper_limit);
                    return (
                      <td key={slot} style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: hOOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: hOOC ? '#dc2626' : '#000000', background: hOOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                        {hVal !== undefined ? hVal : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* SECTION 2: PROCESS PARAMETER HEADER ROW (SETUP APPROVAL REPORT ONLY) */}
            {isSetupReport && (
              <>
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: '5px 8px',
                      textAlign: 'left',
                      fontSize: 10.5,
                      fontWeight: 'bold',
                      letterSpacing: '0.5px',
                      background: '#ffffff',
                      color: '#1e3a8a',
                      border: '1.5px solid #000000',
                      textTransform: 'uppercase',
                    }}
                  >
                    PROCESS PARAMETER
                  </td>
                </tr>

                {(processList.length > 0 ? processList : [
                  { no: '01', name: 'Spindle Speed', spec: '1000 - 1500 RPM', method: 'CHECKLIST / DISPLAY', sample: '1ST PC ONLY', trials: {} },
                  { no: '02', name: 'Feed Rate', spec: '0.15 - 0.35 mm/rev', method: 'CHECKLIST / DISPLAY', sample: '1ST PC ONLY', trials: {} },
                  { no: '03', name: 'Coolant Pressure', spec: '10 - 15 Bar', method: 'CHECKLIST / DISPLAY', sample: '1ST PC ONLY', trials: {} },
                  { no: '04', name: 'Tool Setting', spec: 'T01 / Preset OK', method: 'CHECKLIST / DISPLAY', sample: '1ST PC ONLY', trials: {} },
                ]).map((pp, i) => {
                  const tr1 = pp.trials[1];
                  const tr2 = pp.trials[2];
                  const tr3 = pp.trials[3];

                  const tr1OOC = pp.trialsOOC?.[1] || isValOOC(tr1, pp.lower_limit, pp.upper_limit);
                  const tr2OOC = pp.trialsOOC?.[2] || isValOOC(tr2, pp.lower_limit, pp.upper_limit);
                  const tr3OOC = pp.trialsOOC?.[3] || isValOOC(tr3, pp.lower_limit, pp.upper_limit);

                  const isAltRow = i % 2 === 1;

                  return (
                    <tr key={`proc-${i}`} style={{ borderBottom: '1px solid #000000', background: isAltRow ? '#f8fafc' : '#ffffff' }}>
                      <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: 'bold' }}>10.</td>
                      <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: 'bold', fontFamily: 'Consolas, monospace' }}>{pp.no}</td>
                      <td style={{ border: '1px solid #000000', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', color: '#1e3a8a' }}>
                        [PROC] {pp.name}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '2px 1px', fontSize: 7.5, fontWeight: 'bold', color: '#1e3a8a' }}>PROC</td>
                      <td style={{ border: '1px solid #000000', padding: '2px 4px', fontFamily: 'Consolas, monospace', fontWeight: 'bold' }}>{pp.spec}</td>
                      <td style={{ border: '1px solid #000000', padding: '2px 4px', fontSize: 7.5, textTransform: 'uppercase' }}>{pp.method}</td>
                      <td style={{ border: '1px solid #000000', padding: '2px 2px', fontSize: 7.5 }}>{pp.sample}</td>
                      
                      <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: tr1OOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: tr1OOC ? '#dc2626' : '#000000', background: tr1OOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                        {tr1 !== undefined ? tr1 : '—'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: tr2OOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: tr2OOC ? '#dc2626' : '#000000', background: tr2OOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                        {tr2 !== undefined ? tr2 : '—'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '2px 1px', fontWeight: tr3OOC ? 'bold' : 'normal', fontSize: 9, fontFamily: 'Consolas, monospace', color: tr3OOC ? '#dc2626' : '#000000', background: tr3OOC ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                        {tr3 !== undefined ? tr3 : '—'}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>

        {/* REACTION PLAN */}
        <div style={{ marginTop: 6, padding: '4px 8px', border: '1px solid #000000', background: '#f8fafc', fontSize: 7.5, color: '#334155' }}>
          <strong>REACTION PLAN:</strong> REJECT, REWORK, SEGREGATE, INFORM SUPERVISOR OR READJUST THE PROCESS
        </div>

        {/* SIGNATURE BLOCK */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center', borderTop: '1.5px solid #000000', paddingTop: 8 }}>
          <div>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: 10, marginBottom: 3, fontStyle: 'italic', color: '#000000', fontSize: 9.5 }}>
              {session.operator_name || 'Operator Sign'}
            </div>
            <strong style={{ fontSize: 9, letterSpacing: '0.5px' }}>OPERATOR SIGNATURE</strong>
          </div>
          <div>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: 10, marginBottom: 3, fontStyle: 'italic', color: '#000000', fontSize: 9.5 }}>
              {session.inspector_name || session.finalized_by_name || 'Quality Inspector'}
            </div>
            <strong style={{ fontSize: 9, letterSpacing: '0.5px' }}>QUALITY INSPECTOR SIGNATURE</strong>
          </div>
          <div>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: 10, marginBottom: 3, fontStyle: 'italic', color: '#000000', fontSize: 9.5 }}>
              {session.supervisor_name || 'Supervisor Sign'}
            </div>
            <strong style={{ fontSize: 9, letterSpacing: '0.5px' }}>SUPERVISOR SIGNATURE</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
}
