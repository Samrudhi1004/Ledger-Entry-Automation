import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import api from '../api/axios';
import {
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Eye,
  Building2,
  Cog,
  Layers,
  User,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

export default function DailyProductionReportsPage() {
  const [reports, setReports] = useState([]);
  const [machines, setMachines] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');

  // Selected Detail Modal
  const [selectedReport, setSelectedReport] = useState(null);

  // Load Machines & Parts for filter dropdowns
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [machRes, partRes] = await Promise.all([
          api.get('/api/machines/').catch(() => ({ data: [] })),
          api.get('/api/parts/').catch(() => ({ data: [] })),
        ]);
        setMachines(Array.isArray(machRes.data) ? machRes.data : []);
        setParts(Array.isArray(partRes.data) ? partRes.data : []);
      } catch (err) {
        console.error('Failed to load filter metadata', err);
      }
    }
    loadMetadata();
  }, []);

  // Fetch Reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (machineFilter) params.machine = machineFilter;
      if (partFilter) params.part = partFilter;
      if (shiftFilter) params.shift = shiftFilter;
      if (operatorFilter) params.operator_id = operatorFilter;

      const res = await api.get('/api/inspections/daily-production-reports/', { params });
      setReports(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch Daily Production Reports', err);
      setError('Failed to load Daily Production Reports. Please check server connection.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, machineFilter, partFilter, shiftFilter, operatorFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Export Excel CSV
  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (dateFilter) params.append('date', dateFilter);
    if (machineFilter) params.append('machine', machineFilter);
    if (partFilter) params.append('part', partFilter);
    if (shiftFilter) params.append('shift', shiftFilter);

    window.open(`http://127.0.0.1:8000/api/inspections/daily-production-reports/export_excel/?${params.toString()}`, '_blank');
  };

  // Export PDF
  const handleExportPDF = (reportId) => {
    window.open(`http://127.0.0.1:8000/api/inspections/daily-production-reports/${reportId}/export_pdf/`, '_blank');
  };

  // Summary Metrics
  const totalTarget = reports.reduce((sum, r) => sum + (r.production_target || 0), 0);
  const totalCompleted = reports.reduce((sum, r) => sum + (r.jobs_completed || 0), 0);
  const totalCorrect = reports.reduce((sum, r) => sum + (r.correct_jobs || 0), 0);
  const totalIncorrect = reports.reduce((sum, r) => sum + (r.incorrect_jobs || 0), 0);
  const totalCR = reports.reduce((sum, r) => sum + (r.cr_count || 0), 0);
  const totalMR = reports.reduce((sum, r) => sum + (r.mr_count || 0), 0);
  const totalRW = reports.reduce((sum, r) => sum + (r.rw_count || 0), 0);

  const avgAchievement = totalTarget > 0 ? ((totalCompleted / totalTarget) * 100).toFixed(1) : 0;

  return (
    <>
      <Header
        title="Daily Production Reports"
        subtitle="Supervisor Module — End-of-day production output, target vs actual achievement %, and rejection tracking"
      />

      <div className="page-content bg-gradient-animated" style={{ padding: '24px' }}>


        {/* FILTER TOOLBAR */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1 }}>
              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <Calendar size={16} color="#64748B" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#0F172A' }}
                />
              </div>

              {/* Machine Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <Cog size={16} color="#64748B" />
                <select
                  value={machineFilter}
                  onChange={(e) => setMachineFilter(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#0F172A' }}
                >
                  <option value="">All Machines</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.machine_code} ({m.name})</option>
                  ))}
                </select>
              </div>

              {/* Part Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <Layers size={16} color="#64748B" />
                <select
                  value={partFilter}
                  onChange={(e) => setPartFilter(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#0F172A' }}
                >
                  <option value="">All Parts</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>{p.part_number} ({p.part_name})</option>
                  ))}
                </select>
              </div>

              {/* Shift Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#0F172A' }}
                >
                  <option value="">All Shifts</option>
                  <option value="A">Shift A</option>
                  <option value="B">Shift B</option>
                  <option value="C">Shift C</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(dateFilter || machineFilter || partFilter || shiftFilter) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setDateFilter(''); setMachineFilter(''); setPartFilter(''); setShiftFilter(''); }}
                  style={{ fontSize: '12px', color: '#EF4444' }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* ACTION EXPORT BUTTONS */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={handleExportExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderColor: '#10B981', color: '#059669' }}
              >
                <FileSpreadsheet size={16} /> Export Excel (CSV)
              </button>
              <button
                className="btn btn-outline"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              >
                <Printer size={16} /> Print Sheet
              </button>
            </div>
          </div>
        </div>

        {/* DATA TABLE CONTAINER */}
        <div className="card" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
              Daily Production Report Records ({reports.length})
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={fetchReports}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Loading Daily Production Reports...</div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#EF4444' }}>{error}</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#64748B' }}>
              <BarChart3 size={48} color="#CBD5E1" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A' }}>No Daily Production Reports Submitted Yet</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Operators will submit end-of-day output logs after 8HR inspections complete.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textTransform: 'uppercase', color: '#64748B', fontSize: '11px', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date & Shift</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Machine</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Part & Operation</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Operator</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Target</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Completed</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Correct / Pass</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Incorrect / Fail</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>CR / MR / RW</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Achievement %</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((row) => {
                    const isTargetMet = (row.achievement_percentage || 0) >= 100;
                    return (
                      <tr key={row.id || row.report_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0F172A' }}>
                          {row.date}
                          <span style={{ display: 'inline-block', marginLeft: '6px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: '10px', fontWeight: 'bold' }}>
                            Shift {row.shift}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#1E293B' }}>
                          {row.machine_code}
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>{row.machine_name}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0F172A' }}>{row.part_number}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{row.part_name} • {row.operation || 'Drilling'}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#334155' }}>
                          {row.operator_name || 'Operator'}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#0F172A' }}>
                          {row.production_target}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#2563EB' }}>
                          {row.jobs_completed}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>
                          {row.correct_jobs}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: row.incorrect_jobs > 0 ? '#DC2626' : '#64748B' }}>
                          {row.incorrect_jobs}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px' }}>
                          <span style={{ color: '#DC2626', fontWeight: 'bold' }}>{row.cr_count}</span> /{' '}
                          <span style={{ color: '#D97706', fontWeight: 'bold' }}>{row.mr_count}</span> /{' '}
                          <span style={{ color: '#2563EB', fontWeight: 'bold' }}>{row.rw_count}</span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontWeight: '800',
                              fontSize: '12px',
                              backgroundColor: isTargetMet ? '#DEF7EC' : '#FEF3C7',
                              color: isTargetMet ? '#03543F' : '#92400E',
                            }}
                          >
                            {row.achievement_percentage}%
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              title="View Full Details"
                              onClick={() => setSelectedReport(row)}
                              style={{ color: '#2563EB', padding: '6px' }}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Download PDF"
                              onClick={() => handleExportPDF(row.id || row.report_id)}
                              style={{ color: '#059669', padding: '6px' }}
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL (OFFICIAL TABLE FORMAT) */}
      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', padding: '0', backgroundColor: '#ffffff', border: '2px solid #000000', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>

            {/* Modal Top Close Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', padding: '12px 20px', color: '#ffffff' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px' }}>DAILY PRODUCTION REPORT SHEET</span>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ padding: '20px' }}>
              {/* 1. OFFICIAL COMPANY BRANDING HEADER */}
              <div style={{ border: '2px solid #000000', display: 'grid', gridTemplateColumns: '110px 1fr 180px', marginBottom: '-2px' }}>
                <div style={{ backgroundColor: '#000000', color: '#ffffff', fontWeight: '900', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '1px' }}>
                  MMPL
                </div>
                <div style={{ borderLeft: '2px solid #000000', borderRight: '2px solid #000000', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '900', color: '#000000', letterSpacing: '0.5px' }}>MANTRI METALLICS PVT. LTD.</div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#000000', marginTop: '2px' }}>DAILY PRODUCTION REPORT — END OF DAY SUMMARY</div>
                </div>
                <div style={{ padding: '6px', fontSize: '9px', fontWeight: 'bold', color: '#000000', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div>DOC REF: MMPL/PRD/F08</div>
                  <div>REV: 01 (12.8.2026)</div>
                  <div>PAGE 1 OF 1</div>
                </div>
              </div>

              {/* 2. METADATA HEADER GRID */}
              <div style={{ border: '2px solid #000000', borderTop: 'none', marginBottom: '-2px', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #000000', padding: '6px 12px', fontSize: '11px' }}>
                  <div><b>DATE:</b> {selectedReport.date}</div>
                  <div><b>MACHINE:</b> {selectedReport.machine_code} ({selectedReport.machine_name})</div>
                  <div><b>SHIFT:</b> Shift {selectedReport.shift}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '6px 12px', fontSize: '11px' }}>
                  <div><b>PART:</b> {selectedReport.part_number} ({selectedReport.part_name})</div>
                  <div><b>OPERATION:</b> {selectedReport.operation || 'Drilling'}</div>
                  <div><b>OPERATOR:</b> {selectedReport.operator_name || 'Operator'}</div>
                </div>
              </div>

              {/* 3. OFFICIAL FULL TABLE FORMAT */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000000', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1E293B', color: '#ffffff', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                    <th style={{ border: '1px solid #000000', padding: '8px', width: '50px' }}>S.NO</th>
                    <th style={{ border: '1px solid #000000', padding: '8px', textAlign: 'left' }}>PRODUCTION FIELD / METRIC DESCRIPTION</th>
                    <th style={{ border: '1px solid #000000', padding: '8px', width: '120px' }}>QTY / COUNT</th>
                    <th style={{ border: '1px solid #000000', padding: '8px', width: '220px', textAlign: 'left' }}>REMARKS / BREAKDOWN STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>01</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', fontWeight: 'bold' }}>Production Target</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>{selectedReport.production_target}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#475569' }}>Shift Target Goal</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>02</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', fontWeight: 'bold' }}>Jobs Completed</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#2563EB' }}>{selectedReport.jobs_completed}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#475569' }}>Total Output Produced</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>03</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', fontWeight: 'bold' }}>Correct Jobs (Pass)</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#059669' }}>{selectedReport.correct_jobs}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#059669', fontWeight: 'bold' }}>Accepted Good Quality Units</td>
                  </tr>
                  <tr style={{ backgroundColor: '#FEF2F2' }}>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>04</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', fontWeight: 'bold', color: '#DC2626' }}>Incorrect Jobs (Fail)</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#DC2626' }}>{selectedReport.incorrect_jobs}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#DC2626', fontWeight: 'bold' }}>Total Defective / Non-Conforming</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontSize: '11px' }}>04.1</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', paddingLeft: '24px' }}>├ Customer Rejection (CR)</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#DC2626' }}>{selectedReport.cr_count}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#475569' }}>CR Quantity</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontSize: '11px' }}>04.2</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', paddingLeft: '24px' }}>├ Machine Rejection (MR)</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#D97706' }}>{selectedReport.mr_count}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#475569' }}>MR Quantity</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontSize: '11px' }}>04.3</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', paddingLeft: '24px' }}>└ Rework Quantity (RW)</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#2563EB' }}>{selectedReport.rw_count}</td>
                    <td style={{ border: '1px solid #000000', padding: '8px', color: '#475569' }}>RW Quantity</td>
                  </tr>
                  {/* ACHIEVEMENT SUMMARY ROW */}
                  <tr style={{ backgroundColor: selectedReport.achievement_percentage >= 100 ? '#DCFCE7' : '#FEF3C7' }}>
                    <td style={{ border: '1px solid #000000', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>★</td>
                    <td style={{ border: '1px solid #000000', padding: '10px', fontWeight: '900', fontSize: '13px' }}>PRODUCTION ACHIEVEMENT %</td>
                    <td style={{ border: '1px solid #000000', padding: '10px', textAlign: 'center', fontWeight: '900', fontSize: '16px', color: selectedReport.achievement_percentage >= 100 ? '#059669' : '#D97706' }}>
                      {selectedReport.achievement_percentage}%
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '10px', fontWeight: 'bold', color: selectedReport.achievement_percentage >= 100 ? '#059669' : '#D97706' }}>
                      {selectedReport.achievement_percentage >= 100 ? 'TARGET MET' : 'UNDER TARGET'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 4. REMARKS BOX */}
              <div style={{ border: '2px solid #000000', borderTop: 'none', padding: '10px', backgroundColor: '#F8FAFC', fontSize: '11px' }}>
                <b>REMARKS / NOTES:</b> {selectedReport.remarks || 'No additional remarks provided.'}
              </div>

              {/* 5. SIGNATURES FOOTER */}
              <div style={{ border: '2px solid #000000', borderTop: 'none', padding: '16px 20px', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: '10px' }}>
                <div>
                  <div style={{ fontStyle: 'italic', fontWeight: 'bold', marginBottom: '2px' }}>{selectedReport.operator_name || 'Operator'}</div>
                  <div style={{ borderTop: '1px solid #000000', width: '180px', paddingTop: '4px', fontWeight: 'bold' }}>OPERATOR SIGNATURE</div>
                </div>
                <div>
                  <div style={{ fontStyle: 'italic', fontWeight: 'bold', marginBottom: '2px' }}>Quality Inspector</div>
                  <div style={{ borderTop: '1px solid #000000', width: '180px', paddingTop: '4px', fontWeight: 'bold' }}>QUALITY INSPECTOR SIGNATURE</div>
                </div>
                <div>
                  <div style={{ fontStyle: 'italic', fontWeight: 'bold', marginBottom: '2px' }}>Supervisor Sign</div>
                  <div style={{ borderTop: '1px solid #000000', width: '180px', paddingTop: '4px', fontWeight: 'bold' }}>SUPERVISOR SIGNATURE</div>
                </div>
              </div>

              {/* MODAL ACTION FOOTER */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => handleExportPDF(selectedReport.id || selectedReport.report_id)}>
                  <Download size={16} /> Download Official PDF
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedReport(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
