import { useState } from 'react';
import { supervisorOverride } from '../../api/inspections';

export default function InspectionGridSheet({ session, onUpdate }) {
  const [editingParam, setEditingParam] = useState(null);
  const [overrideVal, setOverrideVal]   = useState('');
  const [overrideRemark, setOverrideRemark] = useState('');
  const [loading, setLoading]         = useState(false);

  if (!session) return null;

  const trialNum = session.trial_number ?? 1;
  const isTrial3 = trialNum === 3;
  const parameters = (session.parameter_summary && session.parameter_summary.length > 0)
    ? session.parameter_summary
    : (session.parameters && session.parameters.length > 0 ? session.parameters : (session.measurements || []));
  const measurements = session.measurements ?? [];

  // Group measurements by parameter_code
  const measurementMap = {};
  measurements.forEach((m) => {
    if (!measurementMap[m.parameter_code]) {
      measurementMap[m.parameter_code] = [];
    }
    measurementMap[m.parameter_code].push(m);
  });

  const handleSaveOverride = async (paramCode) => {
    if (!overrideVal || isNaN(overrideVal)) {
      alert('Please enter a valid numeric value.');
      return;
    }
    setLoading(true);
    try {
      await supervisorOverride(session.session_id, paramCode, parseFloat(overrideVal), overrideRemark);
      setEditingParam(null);
      setOverrideVal('');
      setOverrideRemark('');
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply supervisor override.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-sheet-card" style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
      {/* Header Block Replica */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--accent-blue)' }}>
            MMPL — 1ST PIECE CUM IN-PROCESS INSPECTION REPORT
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Part: <strong style={{ color: '#fff' }}>{session.part_number} ({session.part_name || 'POLY V PULLEY'})</strong> | Machine: <strong style={{ color: '#fff' }}>{session.machine_code}</strong> | Shift: <strong>{session.shift}</strong>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${trialNum === 1 ? 'badge-primary' : trialNum === 2 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '6px 12px' }}>
            SETUP PHASE: 1ST PC #{trialNum}
          </span>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Operator: {session.operator_name || 'Samu'}
          </div>
        </div>
      </div>

      {/* Main Digital Report Matrix */}
      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>PARAMETER</th>
              <th style={{ padding: '10px' }}>SPECIFICATION</th>
              <th style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)' }}>1ST PC #1</th>
              <th style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)' }}>1ST PC #2</th>
              <th style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)' }}>1ST PC #3 (SUP. OVERRIDE)</th>
              <th style={{ padding: '8px' }}>1/HR</th>
              <th style={{ padding: '8px' }}>2/HR</th>
              <th style={{ padding: '8px' }}>3/HR</th>
              <th style={{ padding: '8px' }}>4/HR</th>
              <th style={{ padding: '8px' }}>5/HR</th>
              <th style={{ padding: '8px' }}>6/HR</th>
              <th style={{ padding: '8px' }}>7/HR</th>
              <th style={{ padding: '8px' }}>8/HR</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((p) => {
              const pCode = p.parameter_code;
              const pMeas = measurementMap[pCode] || [];
              const isOOC = p.status === 'out_of_spec';
              
              const fpMeas = pMeas.filter(m => m.inspection_type === 'first_piece' || (!m.inspection_type && (!m.hourly_slot || m.hourly_slot === 0)));
              const hourlyMeas = {};
              pMeas.forEach((m) => {
                if (m.inspection_type === 'hourly' && m.hourly_slot > 0) {
                  const slot = m.hourly_slot || 1;
                  hourlyMeas[slot] = m.measured_value;
                }
              });

              // Determine value positions for First Piece Trial #1, Trial #2, Trial #3 (Inspector)
              const valT1 = fpMeas.find(m => (m.trial_number || 1) === 1)?.measured_value ?? (trialNum === 1 && p.measured_value !== undefined ? p.measured_value : null);
              const valT2 = fpMeas.find(m => m.trial_number === 2)?.measured_value ?? (trialNum === 2 && p.measured_value !== undefined ? p.measured_value : null);
              const valT3 = fpMeas.find(m => m.trial_number === 3)?.measured_value ?? (trialNum === 3 && p.measured_value !== undefined ? p.measured_value : null);

              return (
                <tr key={pCode} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ fontWeight: 'bold', padding: '10px' }}>
                    {p.parameter_name} {p.is_critical && <span style={{ color: 'var(--accent-red)' }}>★</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {p.nominal} ± {(p.upper_limit - p.nominal).toFixed(2)} {p.unit}
                  </td>

                  {/* 1ST PC #1 Column */}
                  <td style={{ textAlign: 'center', padding: '10px', background: 'rgba(59, 130, 246, 0.05)' }}>
                    {valT1 !== null ? (
                      <span className={`badge ${isOOC && trialNum === 1 ? 'badge-danger' : 'badge-success'}`}>
                        {valT1} {p.unit}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  {/* 1ST PC #2 Column */}
                  <td style={{ textAlign: 'center', padding: '10px', background: 'rgba(245, 158, 11, 0.05)' }}>
                    {valT2 !== null ? (
                      <span className={`badge ${isOOC && trialNum === 2 ? 'badge-danger' : 'badge-success'}`}>
                        {valT2} {p.unit}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  {/* 1ST PC #3 (Supervisor Override Cell) */}
                  <td style={{ textAlign: 'center', padding: '10px', background: 'rgba(239, 68, 68, 0.05)' }}>
                    {editingParam === pCode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '140px', margin: '0 auto' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          placeholder="Correct Value"
                          value={overrideVal}
                          onChange={(e) => setOverrideVal(e.target.value)}
                          autoFocus
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Override reason..."
                          value={overrideRemark}
                          onChange={(e) => setOverrideRemark(e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        />
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleSaveOverride(pCode)}
                          disabled={loading}
                          style={{ fontSize: '11px', padding: '2px 6px' }}
                        >
                          Save Override
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingParam(null)}
                          style={{ fontSize: '11px', padding: '2px 6px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : valT3 !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span className={`badge ${isOOC && trialNum === 3 ? 'badge-danger' : 'badge-success'}`}>
                          {valT3} {p.unit}
                        </span>
                        {p.override_by_supervisor && <span title="Supervisor Override Entry">(Override)</span>}
                      </div>
                    ) : isTrial3 ? (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => {
                          setEditingParam(pCode);
                          setOverrideVal(p.nominal?.toString() || '');
                        }}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                      >
                        Override
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  {/* 1/HR through 8/HR Hourly Columns */}
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((slotNum) => {
                    const hrVal = hourlyMeas[slotNum];
                    return (
                      <td key={slotNum} style={{ textAlign: 'center', padding: '8px', color: hrVal !== undefined ? '#ffffff' : 'var(--text-muted)', fontSize: '12px', fontWeight: hrVal !== undefined ? 'bold' : 'normal' }}>
                        {hrVal !== undefined ? `${hrVal} ${p.unit}` : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
