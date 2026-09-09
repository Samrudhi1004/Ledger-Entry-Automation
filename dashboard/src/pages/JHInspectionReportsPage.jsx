import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import api, { BASE_URL } from '../api/axios';
import { useCompany } from '../context/CompanyContext';
import {
  ClipboardCheck,
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
  User,
  Check,
  X,
  Wrench,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

export default function JHInspectionReportsPage() {
  const { companyName, companyCode, shiftHours: companyShiftHours, totalShiftsPerDay } = useCompany();

  // Active Tab: 'log' | 'matrix'
  const [activeTab, setActiveTab] = useState('log');

  // Metadata
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab 1 (Log) State
  const [reports, setReports] = useState([]);
  const [dateFilter, setDateFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);

  // Tab 2 (Matrix) State
  const [matrixMachine, setMatrixMachine] = useState('');
  const [matrixMonth, setMatrixMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [matrixData, setMatrixData] = useState(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load Machines list
  useEffect(() => {
    async function fetchMachines() {
      try {
        const res = await api.get('/api/machines/').catch(() => ({ data: [] }));
        const mList = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setMachines(mList);
        if (mList.length > 0) {
          setMatrixMachine(mList[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load machines', err);
      }
    }
    fetchMachines();
  }, []);

  // Fetch Reports (Tab 1)
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (machineFilter) params.machine = machineFilter;
      if (shiftFilter) params.shift = shiftFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/api/inspections/jh/reports/', { params });
      setReports(res.data?.results || []);
    } catch (err) {
      console.error('Failed to fetch JH reports', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, machineFilter, shiftFilter, statusFilter]);

  // Fetch Matrix (Tab 2)
  const fetchMatrix = useCallback(async () => {
    if (!matrixMachine) return;
    setLoadingMatrix(true);
    try {
      const res = await api.get('/api/inspections/jh/matrix/', {
        params: { machine: matrixMachine, month: matrixMonth, shift_hours: companyShiftHours || 8 }
      });
      setMatrixData(res.data);
    } catch (err) {
      console.error('Failed to fetch JH matrix', err);
      setMatrixData(null);
    } finally {
      setLoadingMatrix(false);
    }
  }, [matrixMachine, matrixMonth, companyShiftHours]);

  useEffect(() => {
    if (activeTab === 'log') {
      fetchReports();
    } else {
      fetchMatrix();
    }
  }, [activeTab, fetchReports, fetchMatrix]);

  // Stats calculation
  const totalAudits = reports.length;
  const okAudits = reports.filter((r) => r.status === 'ALL_OK').length;
  const issueAudits = reports.filter((r) => r.status === 'HAS_ISSUES').length;
  const correctedAudits = reports.filter((r) => r.status === 'CORRECTED').length;
  const complianceRate = totalAudits > 0 ? Math.round((okAudits / totalAudits) * 100) : 100;

  // Active shifts derived from matrixData or companyShiftHours
  const activeMatrixShifts = matrixData?.shifts || (companyShiftHours === 12 ? ['I', 'II'] : ['I', 'II', 'III']);
  const availableFilterShifts = companyShiftHours === 12 ? ['I', 'II'] : ['I', 'II', 'III'];

  // Helper to display clean Hindi without English parenthetical text
  const getOnlyHindi = (text) => {
    if (!text) return '';
    const idx = text.indexOf('(');
    if (idx !== -1) {
      const before = text.substring(0, idx).trim();
      if (before) return before;
    }
    return text.trim();
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export Matrix to Official Form QF/MF-08 Excel (.xlsx)
  const handleExportExcel = async () => {
    if (!matrixMachine) {
      alert('Please select a machine first.');
      return;
    }
    try {
      setIsExporting(true);
      const params = {
        machine: matrixMachine,
        month: matrixMonth || new Date().toISOString().slice(0, 7),
        shift_hours: companyShiftHours || 8,
      };

      const response = await api.get('/api/inspections/jh/matrix/export_excel/', {
        params,
        responseType: 'blob',
      });

      const machineCode = matrixData?.machine?.machine_code || 'Machine';
      const fileName = `JH_Matrix_${machineCode}_${params.month}.xlsx`;

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Excel matrix:', err);
      alert('Failed to export Excel file. Please check connection and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Header
        title="JH Inspection Reports"
        subtitle="Autonomous Maintenance Shift Audits & 31-Day Shift Matrix (Form QF/MF-08)"
      />

      <div className="page-content" style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh' }}>
        {/* KPI Metrics Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Total Shift Audits
              </span>
              <ClipboardCheck size={20} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', marginTop: '8px' }}>
              {totalAudits}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Recorded across shifts</span>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                100% OK Compliance
              </span>
              <CheckCircle2 size={20} color="#16A34A" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#16A34A', marginTop: '8px' }}>
              {complianceRate}%
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{okAudits} audits completely clear</span>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Issues Flagged (Not OK)
              </span>
              <XCircle size={20} color="#DC2626" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#DC2626', marginTop: '8px' }}>
              {issueAudits}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Unresolved abnormalities</span>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Immediate Corrections
              </span>
              <Wrench size={20} color="#D97706" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#D97706', marginTop: '8px' }}>
              {correctedAudits}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Resolved on shopfloor</span>
          </div>
        </div>

        {/* Tab Selection Bar & Global Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', background: '#E2E8F0', padding: '4px', borderRadius: '10px' }}>
            <button
              onClick={() => setActiveTab('log')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'log' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'log' ? '#0F172A' : '#64748B',
                boxShadow: activeTab === 'log' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              📋 Shift Audit Log
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'matrix' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'matrix' ? '#0F172A' : '#64748B',
                boxShadow: activeTab === 'matrix' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              📊 31-Day Shift Matrix
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {activeTab === 'matrix' && (
              <>
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="btn btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: '1px solid #059669',
                    cursor: isExporting ? 'not-allowed' : 'pointer',
                    fontWeight: '700',
                    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <FileSpreadsheet size={16} color="#FFFFFF" />
                  <span>{isExporting ? 'Generating Excel...' : 'Export Matrix (Excel)'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="btn btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={15} color="#475569" />
                  <span>Print Sheet</span>
                </button>
              </>
            )}

            <button
              onClick={activeTab === 'log' ? fetchReports : fetchMatrix}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} className={loading || loadingMatrix ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* TAB 1: SHIFT AUDIT LOG */}
        {activeTab === 'log' && (
          <div>
            {/* Filter Bar */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #E2E8F0',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', fontWeight: '700' }}>
                <Filter size={16} />
                <span>Filters:</span>
              </div>

              {/* Machine Filter */}
              <select
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  background: '#F8FAFC',
                }}
              >
                <option value="">All Machines</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.machine_code} - {m.name}
                  </option>
                ))}
              </select>

              {/* Shift Filter */}
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  background: '#F8FAFC',
                }}
              >
                <option value="">All Shifts</option>
                {availableFilterShifts.map((s) => (
                  <option key={s} value={s}>
                    Shift {s}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  background: '#F8FAFC',
                }}
              >
                <option value="">All Statuses</option>
                <option value="ALL_OK">All OK (✓)</option>
                <option value="HAS_ISSUES">Has Issues (X)</option>
                <option value="CORRECTED">Corrected (⊗)</option>
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  background: '#F8FAFC',
                }}
              />

              {dateFilter || machineFilter || shiftFilter || statusFilter ? (
                <button
                  onClick={() => {
                    setDateFilter('');
                    setMachineFilter('');
                    setShiftFilter('');
                    setStatusFilter('');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#F1F5F9',
                    color: '#64748B',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>

            {/* Audit Table */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                  <div>Loading JH shift inspection logs...</div>
                </div>
              ) : reports.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                  <ClipboardCheck size={40} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>No JH Audits Found</div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    No autonomous maintenance shift inspections match the selected filters.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '14px 16px', fontWeight: '700' }}>Date</th>
                        <th style={{ padding: '14px 16px', fontWeight: '700' }}>Shift</th>
                        <th style={{ padding: '14px 16px', fontWeight: '700' }}>Machine</th>
                        <th style={{ padding: '14px 16px', fontWeight: '700' }}>Operator</th>
                        <th style={{ padding: '14px 16px', fontWeight: '700' }}>Checkpoints (27 Items)</th>
                        <th style={{ padding: '14px 16px', fontWeight: '700' }}>Audit Status</th>
                        <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => {
                        const isAllOk = r.status === 'ALL_OK';
                        const isHasIssues = r.status === 'HAS_ISSUES';
                        const isCorrected = r.status === 'CORRECTED';

                        return (
                          <tr
                            key={r.id}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0F172A' }}>
                              {r.date}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  background: '#EFF6FF',
                                  color: '#1D4ED8',
                                }}
                              >
                                Shift {r.shift}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: '700', color: '#0F172A' }}>{r.machine_code}</div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>{r.machine_name}</div>
                            </td>
                            <td style={{ padding: '14px 16px', color: '#334155', fontWeight: '500' }}>
                              {r.operator_name}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: '#166534',
                                    background: '#DCFCE7',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  ✓ {r.ok_items}
                                </span>
                                {r.not_ok_items > 0 && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: '#991B1B',
                                      background: '#FEE2E2',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    X {r.not_ok_items}
                                  </span>
                                )}
                                {r.corrected_items > 0 && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: '#92400E',
                                      background: '#FEF3C7',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    ⊗ {r.corrected_items}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              {isAllOk && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#DCFCE7',
                                    color: '#15803D',
                                  }}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>All OK</span>
                                </span>
                              )}
                              {isHasIssues && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#FEE2E2',
                                    color: '#B91C1C',
                                  }}
                                >
                                  <XCircle size={13} />
                                  <span>Has Issues</span>
                                </span>
                              )}
                              {isCorrected && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#FEF3C7',
                                    color: '#B45309',
                                  }}
                                >
                                  <Wrench size={13} />
                                  <span>Corrected</span>
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <button
                                onClick={() => setSelectedReport(r)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  color: '#0F172A',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Eye size={13} />
                                <span>View Checklist</span>
                              </button>
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
        )}

        {/* TAB 2: 31-DAY COMPLIANCE MATRIX (EXACT SPREADSHEET VIEW) */}
        {activeTab === 'matrix' && (
          <div>
            {/* Matrix Controls */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #E2E8F0',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    MACHINE
                  </label>
                  <select
                    value={matrixMachine}
                    onChange={(e) => setMatrixMachine(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      background: '#F8FAFC',
                      fontWeight: '700',
                    }}
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    MONTH & YEAR
                  </label>
                  <input
                    type="month"
                    value={matrixMonth}
                    onChange={(e) => setMatrixMonth(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      background: '#F8FAFC',
                      fontWeight: '700',
                    }}
                  />
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '12px', color: '#475569' }}>
                <span style={{ fontWeight: '700', color: '#0F172A' }}>Legend:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#DCFCE7', color: '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>✓</span>
                  <span>OK</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#FEE2E2', color: '#991B1B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>X</span>
                  <span>Not OK</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#FEF3C7', color: '#92400E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>⊗</span>
                  <span>Correction Done</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#CBD5E1', fontWeight: 'bold' }}>—</span>
                  <span>No Shift Log</span>
                </span>
              </div>
            </div>

            {/* Matrix Sheet Container */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              {loadingMatrix ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={26} className="spin" style={{ margin: '0 auto 10px' }} />
                  <div>Loading 31-day compliance matrix...</div>
                </div>
              ) : !matrixData || !matrixData.items ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  Select a machine to display the compliance matrix.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '75vh' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {/* Header Row 1: Left Columns & Day numbers */}
                    <thead>
                      <tr style={{ background: '#0F172A', color: '#F8FAFC' }}>
                        <th
                          rowSpan={2}
                          style={{
                            padding: '8px 10px',
                            border: '1px solid #334155',
                            position: 'sticky',
                            left: 0,
                            background: '#0F172A',
                            zIndex: 10,
                          }}
                        >
                          Root / Assembly
                        </th>
                        <th
                          rowSpan={2}
                          style={{
                            padding: '8px 6px',
                            border: '1px solid #334155',
                            position: 'sticky',
                            left: '120px',
                            background: '#0F172A',
                            zIndex: 10,
                          }}
                        >
                          Sub No
                        </th>
                        <th
                          rowSpan={2}
                          style={{
                            padding: '8px 10px',
                            border: '1px solid #334155',
                            position: 'sticky',
                            left: '170px',
                            background: '#0F172A',
                            zIndex: 10,
                            minWidth: '220px',
                          }}
                        >
                          Check Point (विवरण)
                        </th>
                        <th
                          rowSpan={2}
                          style={{
                            padding: '8px 10px',
                            border: '1px solid #334155',
                            minWidth: '160px',
                          }}
                        >
                          Standard (मानक)
                        </th>
                        <th rowSpan={2} style={{ padding: '8px 6px', border: '1px solid #334155', textAlign: 'center' }}>
                          Tool
                        </th>
                        <th colSpan={4} style={{ padding: '4px', border: '1px solid #334155', textAlign: 'center' }}>
                          ACTION
                        </th>
                        <th rowSpan={2} style={{ padding: '8px 6px', border: '1px solid #334155', textAlign: 'center' }}>
                          Timing
                        </th>

                        {/* Calendar Days */}
                        {Array.from({ length: matrixData.days_in_month || 30 }, (_, i) => i + 1).map((day) => (
                          <th
                            key={day}
                            colSpan={activeMatrixShifts.length}
                            style={{
                              padding: '6px 4px',
                              border: '1px solid #334155',
                              textAlign: 'center',
                              background: '#1E293B',
                              minWidth: activeMatrixShifts.length === 2 ? '48px' : '66px',
                            }}
                          >
                            {day}
                          </th>
                        ))}
                      </tr>

                      {/* Header Row 2: Action details & Shift columns (I, II, III or I, II) */}
                      <tr style={{ background: '#1E293B', color: '#CBD5E1' }}>
                        <th style={{ padding: '4px 6px', border: '1px solid #334155', fontSize: '9px', textAlign: 'center' }}>C</th>
                        <th style={{ padding: '4px 6px', border: '1px solid #334155', fontSize: '9px', textAlign: 'center' }}>L</th>
                        <th style={{ padding: '4px 6px', border: '1px solid #334155', fontSize: '9px', textAlign: 'center' }}>I</th>
                        <th style={{ padding: '4px 6px', border: '1px solid #334155', fontSize: '9px', textAlign: 'center' }}>Rt</th>

                        {/* Shifts for each day */}
                        {Array.from({ length: matrixData.days_in_month || 30 }, (_, i) => i + 1).flatMap((day) =>
                          activeMatrixShifts.map((shift) => (
                            <th
                              key={`${day}_${shift}`}
                              style={{
                                padding: '4px 2px',
                                border: '1px solid #334155',
                                textAlign: 'center',
                                fontSize: '9px',
                                width: '22px',
                              }}
                            >
                              {shift}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>

                    {/* Matrix Rows */}
                    <tbody>
                      {matrixData.items.map((item, idx) => {
                        const isEven = idx % 2 === 0;
                        const rowBg = isEven ? '#FFFFFF' : '#F8FAFC';

                        return (
                          <tr key={item.id} style={{ background: rowBg }}>
                            {/* Assembly */}
                            <td
                              style={{
                                padding: '8px 10px',
                                border: '1px solid #E2E8F0',
                                fontWeight: '700',
                                color: '#1E293B',
                                position: 'sticky',
                                left: 0,
                                background: rowBg,
                                zIndex: 5,
                              }}
                            >
                              {item.assembly}
                            </td>

                            {/* Sub No */}
                            <td
                              style={{
                                padding: '8px 6px',
                                border: '1px solid #E2E8F0',
                                fontWeight: '800',
                                color: '#0F172A',
                                textAlign: 'center',
                                position: 'sticky',
                                left: '120px',
                                background: rowBg,
                                zIndex: 5,
                              }}
                            >
                              {item.sub_no}
                            </td>

                            {/* Check Point */}
                            <td
                              style={{
                                padding: '8px 10px',
                                border: '1px solid #E2E8F0',
                                color: '#0F172A',
                                fontWeight: '600',
                                position: 'sticky',
                                left: '170px',
                                background: rowBg,
                                zIndex: 5,
                                whiteSpace: 'normal',
                                maxWidth: '280px',
                              }}
                            >
                              {getOnlyHindi(item.check_point)}
                            </td>

                            {/* Standard */}
                            <td
                              style={{
                                padding: '8px 10px',
                                border: '1px solid #E2E8F0',
                                color: '#475569',
                                whiteSpace: 'normal',
                                maxWidth: '200px',
                              }}
                            >
                              {getOnlyHindi(item.standard)}
                            </td>

                            {/* Tool */}
                            <td style={{ padding: '6px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                              {item.tool_type === 'VISUAL' && <span title="Visual (Eye)">👁️</span>}
                              {item.tool_type === 'TOUCH' && <span title="Touch (Hand)">✋</span>}
                              {item.tool_type === 'TOOL' && <span title="Tool / Wrench">🔧</span>}
                            </td>

                            {/* Action Flags */}
                            <td style={{ padding: '4px', border: '1px solid #E2E8F0', textAlign: 'center', color: item.action_clean ? '#16A34A' : '#CBD5E1', fontWeight: 'bold' }}>
                              {item.action_clean ? '★' : ''}
                            </td>
                            <td style={{ padding: '4px', border: '1px solid #E2E8F0', textAlign: 'center', color: item.action_lubricate ? '#D97706' : '#CBD5E1', fontWeight: 'bold' }}>
                              {item.action_lubricate ? '★' : ''}
                            </td>
                            <td style={{ padding: '4px', border: '1px solid #E2E8F0', textAlign: 'center', color: item.action_inspect ? '#2563EB' : '#CBD5E1', fontWeight: 'bold' }}>
                              {item.action_inspect ? '★' : ''}
                            </td>
                            <td style={{ padding: '4px', border: '1px solid #E2E8F0', textAlign: 'center', color: item.action_retighten ? '#9333EA' : '#CBD5E1', fontWeight: 'bold' }}>
                              {item.action_retighten ? '★' : ''}
                            </td>

                            {/* Timing */}
                            <td style={{ padding: '6px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B', fontWeight: '600', fontSize: '10px' }}>
                              {item.timing_sec}
                            </td>

                            {/* Matrix Calendar Cells */}
                            {Array.from({ length: matrixData.days_in_month || 30 }, (_, i) => i + 1).flatMap((day) =>
                              activeMatrixShifts.map((shift) => {
                                const colKey = `${day}_${shift}`;
                                const cell = matrixData.matrix?.[item.sub_no]?.[colKey];

                                if (!cell) {
                                  return (
                                    <td
                                      key={`${day}_${shift}`}
                                      style={{
                                        padding: '4px 2px',
                                        border: '1px solid #E2E8F0',
                                        textAlign: 'center',
                                        color: '#CBD5E1',
                                      }}
                                    >
                                      —
                                    </td>
                                  );
                                }

                                const st = cell.status;
                                let bg = '#DCFCE7';
                                let color = '#15803D';
                                let symbol = '✓';

                                if (st === 'NOT_OK') {
                                  bg = '#FEE2E2';
                                  color = '#B91C1C';
                                  symbol = 'X';
                                } else if (st === 'CORRECTED') {
                                  bg = '#FEF3C7';
                                  color = '#B45309';
                                  symbol = '⊗';
                                }

                                const tooltip = `Day ${day} Shift ${shift} [${cell.operator || 'Operator'}]\nStatus: ${st}${cell.remark ? `\nRemark: ${cell.remark}` : ''}${cell.action_taken ? `\nAction: ${cell.action_taken}` : ''}`;

                                return (
                                  <td
                                    key={`${day}_${shift}`}
                                    title={tooltip}
                                    style={{
                                      padding: '4px 2px',
                                      border: '1px solid #CBD5E1',
                                      textAlign: 'center',
                                      background: bg,
                                      color: color,
                                      fontWeight: '800',
                                      cursor: 'help',
                                    }}
                                  >
                                    {symbol}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DETAIL MODAL (FOR TAB 1 AUDIT LOGS) */}
        {selectedReport && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
            onClick={() => setSelectedReport(null)}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#F8FAFC',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      JH Inspection Audit Checklist
                    </h3>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                      }}
                    >
                      Shift {selectedReport.shift}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    Machine: <strong>{selectedReport.machine_code}</strong> | Date: <strong>{selectedReport.date}</strong> | Operator: <strong>{selectedReport.operator_name}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReport(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {selectedReport.overall_remarks && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      marginBottom: '16px',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ fontWeight: '700', color: '#0F172A' }}>Overall Remarks: </span>
                    <span style={{ color: '#475569' }}>{selectedReport.overall_remarks}</span>
                  </div>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Sub No</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Check Point (विवरण)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Standard (मानक)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tool</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Evaluation</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Remarks / Action Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReport.item_results || []).map((res) => {
                      const isOk = res.status === 'OK';
                      const isNok = res.status === 'NOT_OK';
                      const isCorr = res.status === 'CORRECTED';

                      return (
                        <tr key={res.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0F172A' }}>
                            {res.sub_no}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1E293B', maxWidth: '240px' }}>
                            {getOnlyHindi(res.check_point)}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: '180px' }}>
                            {getOnlyHindi(res.standard)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {res.tool_type === 'VISUAL' && '👁️'}
                            {res.tool_type === 'TOUCH' && '✋'}
                            {res.tool_type === 'TOOL' && '🔧'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {isOk && (
                              <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', fontWeight: 'bold' }}>
                                ✓ OK
                              </span>
                            )}
                            {isNok && (
                              <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#FEE2E2', color: '#B91C1C', fontWeight: 'bold' }}>
                                X Not OK
                              </span>
                            )}
                            {isCorr && (
                              <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#FEF3C7', color: '#B45309', fontWeight: 'bold' }}>
                                ⊗ Corrected
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>
                            {res.remark && <div><strong style={{ color: '#DC2626' }}>Issue:</strong> {res.remark}</div>}
                            {res.action_taken && <div><strong style={{ color: '#D97706' }}>Action:</strong> {res.action_taken}</div>}
                            {!res.remark && !res.action_taken && <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  background: '#F8FAFC',
                }}
              >
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
