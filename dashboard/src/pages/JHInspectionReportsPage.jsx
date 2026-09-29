import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import api, { BASE_URL } from '../api/axios';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import { can } from '../utils/access';
import { showAccessDenied } from '../components/common/AccessDeniedModal';
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
  UploadCloud,
  Trash2,
  Plus,
  Edit3,
  FileText,
  Upload,
  History,
  RotateCcw,
  Clock,
} from 'lucide-react';

export default function JHInspectionReportsPage() {
  const { user } = useAuth();
  const { companyName, companyCode, shiftHours: companyShiftHours, totalShiftsPerDay } = useCompany();
  const canManageChecklist = can(user, 'production.jh.manage');
  const requireChecklistManage = (action = 'manage the JH checklist') => {
    if (canManageChecklist) return true;
    showAccessDenied(`You have view-only access to JH reports. Manage permission is required to ${action}.`);
    return false;
  };
  const openChecklistManager = (mId) => {
    if (!requireChecklistManage('upload a checklist')) return;
    const chosen = (mId ? String(mId) : null) || (matrixMachine ? String(matrixMachine) : null) || (machines[0]?.id ? String(machines[0].id) : '');
    setUploadTargetMachine(chosen);
    setShowUploadModal(true);
    setUploadError('');
    setUploadSuccessMsg('');
    setParsedChecklistItems([]);
    setUploadFile(null);
  };

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

  // Machine-Specific Checklist Status State
  const [machineChecklistStatus, setMachineChecklistStatus] = useState(null);
  const [targetMachineChecklistStatus, setTargetMachineChecklistStatus] = useState(null);

  // Tab 3 (Machine Checklist) State
  const [checklistItems, setChecklistItems] = useState([]);
  const [loadingChecklistItems, setLoadingChecklistItems] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistAssemblyFilter, setChecklistAssemblyFilter] = useState('ALL');
  const [checklistToolFilter, setChecklistToolFilter] = useState('ALL');

  // Checklist Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTargetMachine, setUploadTargetMachine] = useState('');
  const [uploadModalTab, setUploadModalTab] = useState('upload'); // 'upload' | 'history'
  const [uploadFile, setUploadFile] = useState(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsedChecklistItems, setParsedChecklistItems] = useState([]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [checklistVersions, setChecklistVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersionDetail, setSelectedVersionDetail] = useState(null);
  const [loadingVersionDetail, setLoadingVersionDetail] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  // Fetch machine checklist status
  const fetchMachineChecklistStatus = useCallback(async (machineId) => {
    if (!machineId) {
      setMachineChecklistStatus(null);
      return;
    }
    try {
      const res = await api.get('/api/inspections/jh/checklist/status/', { params: { machine: machineId } });
      setMachineChecklistStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch checklist status', err);
    }
  }, []);

  const fetchTargetMachineChecklistStatus = useCallback(async (machineId) => {
    if (!machineId) {
      setTargetMachineChecklistStatus(null);
      return;
    }
    try {
      const res = await api.get('/api/inspections/jh/checklist/status/', { params: { machine: machineId } });
      setTargetMachineChecklistStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch target machine checklist status', err);
    }
  }, []);

  // Fetch Checklist Items for Machine Checklist tab
  const fetchChecklistItems = useCallback(async (machineId) => {
    if (!machineId) return;
    setLoadingChecklistItems(true);
    try {
      const res = await api.get('/api/inspections/jh/items/', { params: { machine: machineId } });
      const items = res.data?.results || [];
      setChecklistItems(items);
    } catch (err) {
      console.error('Failed to load checklist items', err);
      setChecklistItems([]);
    } finally {
      setLoadingChecklistItems(false);
    }
  }, []);

  useEffect(() => {
    if (matrixMachine) {
      fetchMachineChecklistStatus(matrixMachine);
      if (activeTab === 'checklist') {
        fetchChecklistItems(matrixMachine);
      }
    }
  }, [matrixMachine, activeTab, fetchMachineChecklistStatus, fetchChecklistItems]);

  useEffect(() => {
    if (uploadTargetMachine) {
      fetchTargetMachineChecklistStatus(uploadTargetMachine);
    }
  }, [uploadTargetMachine, fetchTargetMachineChecklistStatus]);

  // Load Machines list
  useEffect(() => {
    async function fetchMachines() {
      try {
        const res = await api.get('/api/machines/').catch(() => ({ data: [] }));
        const mList = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setMachines(mList);
        if (mList.length > 0) {
          const firstId = mList[0].id.toString();
          setMatrixMachine(firstId);
          setUploadTargetMachine(firstId);
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
    } else if (activeTab === 'matrix') {
      fetchMatrix();
    } else if (activeTab === 'checklist') {
      fetchChecklistItems(matrixMachine);
    }
  }, [activeTab, fetchReports, fetchMatrix, fetchChecklistItems, matrixMachine]);

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

  // Download Form QF/MF-08 template
  const handleDownloadTemplate = async (targetMachineId) => {
    try {
      const mId = targetMachineId || uploadTargetMachine || matrixMachine;
      const targetObj = machines.find((m) => String(m.id) === String(mId));
      const mCode = targetObj?.machine_code || '';
      const params = mId ? { machine: mId } : {};
      const res = await api.get('/api/inspections/jh/checklist/template/', {
        params,
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', mCode ? `JH_Checklist_Template_${mCode}.xlsx` : 'JH_Checklist_Template_Form_QF_MF_08.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template', err);
      alert('Failed to download Excel template. Please try again.');
    }
  };

  // Upload & parse file (.pdf or .xlsx)
  const handleParseFile = async (e) => {
    if (e) e.preventDefault();
    if (!requireChecklistManage('upload a checklist')) return;
    if (!uploadFile) {
      setUploadError('Please select an Excel (.xlsx) or PDF file to upload.');
      return;
    }
    setIsParsingFile(true);
    setUploadError('');
    setUploadSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await api.post('/api/inspections/jh/checklist/upload_parse/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.items && res.data.items.length > 0) {
        setParsedChecklistItems(res.data.items);
      } else {
        setUploadError('No checklist items could be identified in this file. Please verify format.');
      }
    } catch (err) {
      console.error('File parsing error', err);
      setUploadError(err.response?.data?.error || 'Failed to parse file. Please check file format.');
    } finally {
      setIsParsingFile(false);
    }
  };

  // Save confirmed items to DB
  const handleSaveParsedChecklist = async () => {
    if (!requireChecklistManage('save checklist changes')) return;
    if (!parsedChecklistItems.length) return;
    setIsSavingChecklist(true);
    setUploadError('');
    setUploadSuccessMsg('');
    try {
      const targetMId = uploadTargetMachine || matrixMachine;
      const targetObj = machines.find((m) => String(m.id) === String(targetMId));
      const res = await api.post('/api/inspections/jh/checklist/bulk_save/', {
        machine_id: targetMId,
        items: parsedChecklistItems,
        replace_all: true,
        filename: uploadFile?.name || 'uploaded_checklist.xlsx',
        notes: `Uploaded via Dashboard for ${targetObj?.machine_code || 'Machine'} (${parsedChecklistItems.length} items)`,
      });
      setUploadSuccessMsg(res.data?.message || 'Checklist successfully updated in database!');
      fetchMatrix();
      fetchReports();
      fetchChecklistItems(targetMId);
      fetchChecklistVersions(targetMId);
      if (targetMId) {
        setMatrixMachine(targetMId);
        setMachineFilter(targetMId);
        fetchTargetMachineChecklistStatus(targetMId);
        fetchMachineChecklistStatus(targetMId);
      }
      setTimeout(() => {
        setShowUploadModal(false);
        setParsedChecklistItems([]);
        setUploadFile(null);
        setUploadSuccessMsg('');
        setActiveTab('checklist');
      }, 1200);
    } catch (err) {
      console.error('Checklist save error', err);
      setUploadError(err.response?.data?.error || 'Failed to save checklist to database.');
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // Fetch Checklist Versions History
  const fetchChecklistVersions = async (targetMId) => {
    setLoadingVersions(true);
    try {
      const mId = targetMId || uploadTargetMachine || matrixMachine;
      const params = mId ? { machine: mId } : {};
      const res = await api.get('/api/inspections/jh/checklist/versions/', { params });
      setChecklistVersions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch checklist versions', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  // View specific version details
  const handleViewVersionDetail = async (versionNumber) => {
    setLoadingVersionDetail(true);
    try {
      const params = uploadTargetMachine ? { machine: uploadTargetMachine } : {};
      const res = await api.get(`/api/inspections/jh/checklist/versions/${versionNumber}/`, { params });
      setSelectedVersionDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch version detail', err);
      alert('Failed to load details for this version.');
    } finally {
      setLoadingVersionDetail(false);
    }
  };

  // Restore specific version
  const handleRestoreVersion = async (versionNumber) => {
    if (!requireChecklistManage('restore a checklist version')) return;
    if (!window.confirm(`Are you sure you want to restore Version v${versionNumber} as the active checklist? The mobile operator terminal will immediately use these questions.`)) {
      return;
    }
    setIsRestoringVersion(true);
    setUploadError('');
    setUploadSuccessMsg('');
    try {
      const targetMId = uploadTargetMachine || matrixMachine;
      const params = targetMId ? { machine: targetMId } : {};
      const res = await api.post(`/api/inspections/jh/checklist/versions/${versionNumber}/restore/`, null, { params });
      setUploadSuccessMsg(res.data?.message || `Version v${versionNumber} restored successfully!`);
      fetchChecklistVersions(targetMId);
      fetchMatrix();
      fetchReports();
      if (targetMId) {
        fetchTargetMachineChecklistStatus(targetMId);
        if (targetMId === matrixMachine) {
          fetchMachineChecklistStatus(matrixMachine);
        }
      }
    } catch (err) {
      console.error('Failed to restore version', err);
      setUploadError(err.response?.data?.error || 'Failed to restore version.');
    } finally {
      setIsRestoringVersion(false);
    }
  };

  // Inline edit handlers for preview table
  const handleEditPreviewItem = (index, field, value) => {
    if (!canManageChecklist) {
      requireChecklistManage('edit checklist items');
      return;
    }
    setParsedChecklistItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeletePreviewItem = (index) => {
    if (!requireChecklistManage('delete checklist items')) return;
    setParsedChecklistItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddPreviewItem = () => {
    if (!requireChecklistManage('add checklist items')) return;
    setParsedChecklistItems((prev) => [
      ...prev,
      {
        sub_no: '',
        assembly: '',
        sub_assembly: '',
        check_point: '',
        standard: '',
        tool_type: 'VISUAL',
        rank: '',
        frequency: '',
        timing_sec: '',
        action_clean: false,
        action_lubricate: false,
        action_inspect: false,
        action_retighten: false,
        sort_order: prev.length + 1,
      },
    ]);
  };

  return (
    <>
      <Header
        title="JH Inspection Reports"
        subtitle="Autonomous Maintenance Shift Audits & 31-Day Shift Matrix (Form QF/MF-08)"
      />

      <div className="page-content" style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh' }}>
        <Breadcrumbs items={[{ label: 'Production', to: '/production' }, { label: 'JH Inspection Reports' }]} />

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
            <button
              onClick={() => {
                setActiveTab('checklist');
                fetchChecklistItems(matrixMachine);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'checklist' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'checklist' ? '#0F172A' : '#64748B',
                boxShadow: activeTab === 'checklist' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📑 Machine Checklist</span>
              {machineChecklistStatus?.total_items ? (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: machineChecklistStatus?.has_custom_checklist ? '#DCFCE7' : '#E2E8F0',
                    color: machineChecklistStatus?.has_custom_checklist ? '#15803D' : '#475569',
                    fontWeight: '800',
                  }}
                >
                  {machineChecklistStatus.total_items}
                </span>
              ) : null}
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
              onClick={openChecklistManager}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                borderRadius: '8px',
                background: '#4F46E5',
                color: '#FFFFFF',
                border: '1px solid #4338CA',
                cursor: 'pointer',
                fontWeight: '700',
                boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)',
              }}
            >
              <UploadCloud size={16} color="#FFFFFF" />
              <span>Upload Checklist (PDF/Excel)</span>
            </button>

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
                onChange={(e) => {
                  const val = e.target.value;
                  setMachineFilter(val);
                  if (val) {
                    setMatrixMachine(val);
                    setUploadTargetMachine(val);
                    fetchMachineChecklistStatus(val);
                    fetchChecklistItems(val);
                  }
                }}
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

              {/* Machine Checklist Quick Badge on Filter Bar if machine is selected */}
              {machineFilter && machineChecklistStatus && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: machineChecklistStatus.has_custom_checklist ? '#F0FDF4' : '#FFFBEB',
                    border: `1px solid ${machineChecklistStatus.has_custom_checklist ? '#BBF7D0' : '#FDE68A'}`,
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontWeight: '700', color: machineChecklistStatus.has_custom_checklist ? '#15803D' : '#B45309' }}>
                    {machineChecklistStatus.has_custom_checklist
                      ? `Custom Checklist v${machineChecklistStatus.version_number} (${machineChecklistStatus.total_items} Items)`
                      : `Default Checklist (${machineChecklistStatus.total_items || 27} Items)`}
                  </span>
                  <button
                    onClick={() => {
                      setMatrixMachine(machineFilter);
                      setActiveTab('checklist');
                      fetchChecklistItems(machineFilter);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      fontSize: '11px',
                    }}
                  >
                    View Checklist →
                  </button>
                </div>
              )}

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
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
                  <ClipboardCheck size={44} color="#6366F1" style={{ margin: '0 auto 14px' }} />
                  <div style={{ fontWeight: '800', fontSize: '16px', color: '#0F172A', marginBottom: '6px' }}>
                    {machineFilter
                      ? `No Shift Inspections Recorded Yet for ${machines.find(m => String(m.id) === String(machineFilter))?.machine_code || 'Selected Machine'}`
                      : 'No JH Audits Found'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B', maxWidth: '520px', margin: '0 auto 18px', lineHeight: '1.5' }}>
                    {machineFilter ? (
                      machineChecklistStatus?.has_custom_checklist
                        ? `A custom checklist with ${machineChecklistStatus.total_items} checkpoints (v${machineChecklistStatus.version_number}) is configured and active. Shift inspections submitted by operators via mobile will appear here.`
                        : `Factory default checklist (${machineChecklistStatus?.total_items || 27} checkpoints) is active. Shift inspections submitted by operators via mobile will appear here.`
                    ) : (
                      'No autonomous maintenance shift inspections match the selected filters.'
                    )}
                  </div>
                  {machineFilter && (
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setMatrixMachine(machineFilter);
                          setActiveTab('checklist');
                          fetchChecklistItems(machineFilter);
                        }}
                        style={{
                          padding: '9px 18px',
                          borderRadius: '8px',
                          background: '#4F46E5',
                          color: '#FFFFFF',
                          border: 'none',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                        }}
                      >
                        <Eye size={15} />
                        <span>View Machine Checklist ({machineChecklistStatus?.total_items || ''} Checkpoints)</span>
                      </button>
                      <button
                        onClick={() => {
                          setMatrixMachine(machineFilter);
                          setActiveTab('matrix');
                        }}
                        style={{
                          padding: '9px 18px',
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          color: '#0F172A',
                          border: '1px solid #CBD5E1',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <FileSpreadsheet size={15} color="#10B981" />
                        <span>Open 31-Day Shift Matrix</span>
                      </button>
                    </div>
                  )}
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setMatrixMachine(val);
                      setMachineFilter(val);
                      setUploadTargetMachine(val);
                      fetchMachineChecklistStatus(val);
                      fetchChecklistItems(val);
                    }}
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
                  <span style={{ color: '#CBD5E1', fontWeight: 'bold' }}>-</span>
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
                                      -
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
                            {!res.remark && !res.action_taken && <span style={{ color: '#94A3B8' }}>-</span>}
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

        {/* TAB 3: MACHINE CHECKLIST (MASTER CHECKPOINTS VIEW) */}
        {activeTab === 'checklist' && (
          <div>
            {/* Top Toolbar Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #E2E8F0',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Machine
                  </label>
                  <select
                    value={matrixMachine}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMatrixMachine(val);
                      setMachineFilter(val);
                      setUploadTargetMachine(val);
                      fetchChecklistItems(val);
                      fetchMachineChecklistStatus(val);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                      background: '#F8FAFC',
                      fontWeight: '700',
                      minWidth: '220px',
                    }}
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Pill */}
                {(() => {
                  const isCustom = machineChecklistStatus?.has_custom_checklist;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: isCustom ? '#F0FDF4' : '#FFFBEB',
                        border: `1px solid ${isCustom ? '#BBF7D0' : '#FDE68A'}`,
                        borderRadius: '8px',
                        padding: '8px 14px',
                        alignSelf: 'flex-end',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: isCustom ? '#15803D' : '#B45309' }}>
                          {isCustom ? 'Custom Checklist Active' : 'Factory Default Template'}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                          {isCustom
                            ? `v${machineChecklistStatus.version_number} (${checklistItems.length || machineChecklistStatus.total_items} Checkpoints)`
                            : `(${checklistItems.length || machineChecklistStatus?.total_items || 27} Checkpoints)`
                          }
                          {isCustom && machineChecklistStatus.filename && (
                            <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748B', marginLeft: '6px' }}>
                              · {machineChecklistStatus.filename}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleDownloadTemplate(matrixMachine)}
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
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  <Download size={15} color="#475569" />
                  <span>Download Excel Template</span>
                </button>

                <button
                  onClick={() => {
                    openChecklistManager(matrixMachine);
                    setUploadModalTab('history');
                    fetchChecklistVersions(matrixMachine);
                  }}
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
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  <History size={15} color="#475569" />
                  <span>Version History</span>
                </button>

                <button
                  onClick={() => openChecklistManager(matrixMachine)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '700',
                    boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)',
                  }}
                >
                  <UploadCloud size={16} />
                  <span>{machineChecklistStatus?.has_custom_checklist ? 'Upload New Version' : 'Upload Custom Checklist'}</span>
                </button>
              </div>
            </div>

            {/* Checkpoints Filter Bar */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid #E2E8F0',
                marginBottom: '16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
                <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search checkpoint, Hindi text, standard..."
                  value={checklistSearch}
                  onChange={(e) => setChecklistSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    background: '#F8FAFC',
                  }}
                />
              </div>

              <div>
                <select
                  value={checklistAssemblyFilter}
                  onChange={(e) => setChecklistAssemblyFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    background: '#F8FAFC',
                    fontWeight: '600',
                  }}
                >
                  <option value="ALL">All Assemblies</option>
                  {Array.from(new Set(checklistItems.map((it) => it.assembly).filter(Boolean))).map((asm) => (
                    <option key={asm} value={asm}>{asm}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={checklistToolFilter}
                  onChange={(e) => setChecklistToolFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    background: '#F8FAFC',
                    fontWeight: '600',
                  }}
                >
                  <option value="ALL">All Tool Types</option>
                  <option value="VISUAL">VISUAL (Eye)</option>
                  <option value="TOUCH">TOUCH (Hand)</option>
                  <option value="TOOL">TOOL (Spanner/Key)</option>
                  <option value="GAUGE">GAUGE (Indicator)</option>
                </select>
              </div>

              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginLeft: 'auto' }}>
                Showing {checklistItems.filter((item) => {
                  if (checklistAssemblyFilter !== 'ALL' && item.assembly !== checklistAssemblyFilter) return false;
                  if (checklistToolFilter !== 'ALL' && item.tool_type !== checklistToolFilter) return false;
                  if (checklistSearch.trim()) {
                    const q = checklistSearch.toLowerCase().trim();
                    const matchSub = (item.sub_no || '').toLowerCase().includes(q);
                    const matchAsm = (item.assembly || '').toLowerCase().includes(q);
                    const matchPt = (item.check_point || '').toLowerCase().includes(q);
                    const matchStd = (item.standard || '').toLowerCase().includes(q);
                    return matchSub || matchAsm || matchPt || matchStd;
                  }
                  return true;
                }).length} of {checklistItems.length} checkpoints
              </div>
            </div>

            {/* Checkpoints Table */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {loadingChecklistItems ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                  <div>Loading checkpoints for selected machine...</div>
                </div>
              ) : checklistItems.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
                  <FileText size={40} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#1E293B', marginBottom: '6px' }}>
                    No Checkpoints Available
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', margin: '0 auto 16px' }}>
                    No checklist items found for this machine. Click below to upload an SOP Excel or PDF checklist.
                  </div>
                  <button
                    onClick={() => openChecklistManager(matrixMachine)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#4F46E5',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <UploadCloud size={15} />
                    <span>Upload Checklist Now</span>
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '700', width: '80px' }}>Sub No</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', width: '180px' }}>Assembly / Section</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', minWidth: '260px' }}>Check Point (चेकपॉइंट)</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', minWidth: '200px' }}>Standard / Acceptance Criteria</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', width: '120px' }}>Method / Tool</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', width: '100px' }}>Action</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', width: '80px', textAlign: 'center' }}>Rank</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', width: '90px', textAlign: 'center' }}>Frequency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checklistItems
                        .filter((item) => {
                          if (checklistAssemblyFilter !== 'ALL' && item.assembly !== checklistAssemblyFilter) return false;
                          if (checklistToolFilter !== 'ALL' && item.tool_type !== checklistToolFilter) return false;
                          if (checklistSearch.trim()) {
                            const q = checklistSearch.toLowerCase().trim();
                            const matchSub = (item.sub_no || '').toLowerCase().includes(q);
                            const matchAsm = (item.assembly || '').toLowerCase().includes(q);
                            const matchPt = (item.check_point || '').toLowerCase().includes(q);
                            const matchStd = (item.standard || '').toLowerCase().includes(q);
                            return matchSub || matchAsm || matchPt || matchStd;
                          }
                          return true;
                        })
                        .map((item, idx) => {
                          const toolColors = {
                            VISUAL: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
                            TOUCH: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
                            TOOL: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
                            GAUGE: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
                          };
                          const toolStyle = toolColors[item.tool_type] || toolColors.VISUAL;

                          const rankColors = {
                            A: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
                            B: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
                            C: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
                            D: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
                          };
                          const rankStyle = rankColors[item.rank] || rankColors.A;

                          return (
                            <tr
                              key={item.id || idx}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0F172A' }}>
                                {item.sub_no}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: '#F1F5F9',
                                    color: '#334155',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                  }}
                                >
                                  {item.assembly}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>
                                  {item.check_point}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>
                                {item.standard || '-'}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: toolStyle.bg,
                                    color: toolStyle.text,
                                    border: `1px solid ${toolStyle.border}`,
                                    fontSize: '11px',
                                    fontWeight: '700',
                                  }}
                                >
                                  {item.tool_type || 'VISUAL'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    color: '#475569',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                  }}
                                >
                                  {item.action || 'Check'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: rankStyle.bg,
                                    color: rankStyle.text,
                                    border: `1px solid ${rankStyle.border}`,
                                    fontSize: '11px',
                                    fontWeight: '800',
                                  }}
                                >
                                  {item.rank || 'A'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748B', fontWeight: '600', fontSize: '12px' }}>
                                {item.frequency || 'Daily'}
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

        {/* CHECKLIST UPLOAD & LIVE PREVIEW MODAL */}
        {showUploadModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                maxWidth: (parsedChecklistItems.length > 0 || uploadModalTab === 'history') ? '1100px' : '620px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UploadCloud size={20} color="#4F46E5" />
                      Form QF/MF-08 Checklist Manager
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                      Upload SOP checkpoints via PDF/Excel or review audit history and past versions.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    style={{
                      background: '#F1F5F9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px',
                      cursor: 'pointer',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Sub-Tabs: Upload vs Version History */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadModalTab('upload');
                      setSelectedVersionDetail(null);
                      setUploadError('');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      background: uploadModalTab === 'upload' ? '#4F46E5' : '#E2E8F0',
                      color: uploadModalTab === 'upload' ? '#FFFFFF' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Upload size={14} /> Upload New Checklist
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadModalTab('history');
                      fetchChecklistVersions();
                      setSelectedVersionDetail(null);
                      setUploadError('');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      background: uploadModalTab === 'history' ? '#4F46E5' : '#E2E8F0',
                      color: uploadModalTab === 'history' ? '#FFFFFF' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <History size={14} /> Version History & Audit Log
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {uploadError && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#991B1B',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={18} color="#DC2626" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccessMsg && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: '#F0FDF4',
                      border: '1px solid #86EFAC',
                      color: '#166534',
                      fontSize: '13px',
                      fontWeight: '700',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={18} color="#16A34A" />
                    <span>{uploadSuccessMsg}</span>
                  </div>
                )}

                {/* TAB 1: UPLOAD WORKFLOW */}
                {uploadModalTab === 'upload' && (
                  parsedChecklistItems.length === 0 ? (
                    /* STEP 1: UPLOAD SCREEN */
                    <div>
                      {/* Target Machine Selection & Status Card */}
                      <div
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '18px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Cog size={16} color="#4F46E5" />
                            <span>1. Select Target Machine:</span>
                          </label>
                          {targetMachineChecklistStatus && (
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '800',
                                background: targetMachineChecklistStatus.has_custom_checklist ? '#DCFCE7' : '#FEF3C7',
                                color: targetMachineChecklistStatus.has_custom_checklist ? '#166534' : '#92400E',
                                border: `1px solid ${targetMachineChecklistStatus.has_custom_checklist ? '#86EFAC' : '#FCD34D'}`,
                              }}
                            >
                              {targetMachineChecklistStatus.has_custom_checklist
                                ? `Custom Checklist Active (v${targetMachineChecklistStatus.version_number} • ${targetMachineChecklistStatus.total_items} pts)`
                                : `Using Factory Default Template (${targetMachineChecklistStatus.total_items || 27} pts)`}
                            </span>
                          )}
                        </div>
                        <select
                          value={uploadTargetMachine}
                          onChange={(e) => setUploadTargetMachine(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#0F172A',
                            background: '#F8FAFC',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {machines.map((m) => (
                            <option key={m.id} value={m.id.toString()}>
                              {m.machine_code} - {m.name || m.machine_code}
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px' }}>
                          Any checklist uploaded will bind strictly to this machine without altering other machines.
                        </div>
                      </div>

                      {/* Template download pill */}
                      <div
                        style={{
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '12px',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '20px',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF' }}>
                            Need the standard Form QF/MF-08 template?
                          </div>
                          <div style={{ fontSize: '11px', color: '#3B82F6' }}>
                            Download pre-formatted Excel template with Hindi headers and sample checkpoints.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate(uploadTargetMachine)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#FFFFFF',
                            color: '#1D4ED8',
                            border: '1px solid #93C5FD',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          }}
                        >
                          <Download size={14} /> Download Template (.xlsx)
                        </button>
                      </div>

                      {/* Drag & Drop Upload Container */}
                      <div
                        style={{
                          border: '2px dashed #CBD5E1',
                          borderRadius: '14px',
                          padding: '36px 20px',
                          textAlign: 'center',
                          background: uploadFile ? '#F0FDF4' : '#F8FAFC',
                          borderColor: uploadFile ? '#86EFAC' : '#CBD5E1',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => document.getElementById('jh-file-input').click()}
                      >
                        <input
                          id="jh-file-input"
                          type="file"
                          accept=".xlsx,.xls,.pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setUploadFile(e.target.files[0]);
                              setUploadError('');
                            }
                          }}
                        />
                        <div
                          style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '50%',
                            background: uploadFile ? '#DCFCE7' : '#EEF2FF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '12px',
                          }}
                        >
                          {uploadFile ? (
                            <FileSpreadsheet size={28} color="#16A34A" />
                          ) : (
                            <UploadCloud size={28} color="#4F46E5" />
                          )}
                        </div>

                        {uploadFile ? (
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                              {uploadFile.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                              {(uploadFile.size / 1024).toFixed(1)} KB • Click to choose a different file
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>
                              Click to upload or drag and drop
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                              Excel spreadsheets (.xlsx, .xls) or PDF tables matching Form QF/MF-08
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          onClick={() => setShowUploadModal(false)}
                          style={{
                            padding: '9px 18px',
                            borderRadius: '8px',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            color: '#475569',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleParseFile}
                          disabled={!uploadFile || isParsingFile}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 20px',
                            borderRadius: '8px',
                            background: !uploadFile || isParsingFile ? '#94A3B8' : '#4F46E5',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: !uploadFile || isParsingFile ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                          }}
                        >
                          {isParsingFile && <RefreshCw size={14} className="spin" />}
                          <span>{isParsingFile ? 'Parsing Document...' : 'Parse Document & Preview'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* STEP 2: INTERACTIVE LIVE PREVIEW TABLE */
                    <div>
                      {/* Action & stats banner */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              background: '#DCFCE7',
                              color: '#166534',
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: '800',
                            }}
                          >
                            ✓ Detected {parsedChecklistItems.length} Checkpoints
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>
                            Review and fine-tune questions or standards directly in the table before saving.
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleAddPreviewItem}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#0F172A',
                              cursor: 'pointer',
                            }}
                          >
                            <Plus size={14} color="#10B981" /> Add Row
                          </button>
                          <button
                            onClick={() => setParsedChecklistItems([])}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#64748B',
                              cursor: 'pointer',
                            }}
                          >
                            Re-upload File
                          </button>
                        </div>
                      </div>

                      {/* Preview Table Container */}
                      <div
                        style={{
                          border: '1px solid #E2E8F0',
                          borderRadius: '10px',
                          overflow: 'auto',
                          maxHeight: '48vh',
                          background: '#FFFFFF',
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          <thead>
                            <tr style={{ background: '#0F172A', color: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10 }}>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>Sub No</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', width: '150px' }}>Assembly</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', width: '110px' }}>Sub Assembly</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '220px' }}>Check Point (Hindi / Eng)</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>Standard / Specification</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Tool</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Timing</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedChecklistItems.map((item, idx) => (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid #E2E8F0',
                                  background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                                }}
                              >
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <input
                                    type="text"
                                    value={item.sub_no}
                                    onChange={(e) => handleEditPreviewItem(idx, 'sub_no', e.target.value)}
                                    style={{
                                      width: '50px',
                                      padding: '4px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      textAlign: 'center',
                                      fontWeight: '700',
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    type="text"
                                    value={item.assembly}
                                    onChange={(e) => handleEditPreviewItem(idx, 'assembly', e.target.value)}
                                    style={{
                                      width: '140px',
                                      padding: '4px 6px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    type="text"
                                    value={item.sub_assembly}
                                    onChange={(e) => handleEditPreviewItem(idx, 'sub_assembly', e.target.value)}
                                    style={{
                                      width: '100px',
                                      padding: '4px 6px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    type="text"
                                    value={item.check_point}
                                    onChange={(e) => handleEditPreviewItem(idx, 'check_point', e.target.value)}
                                    style={{
                                      width: '100%',
                                      minWidth: '220px',
                                      padding: '4px 6px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      color: '#0F172A',
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    type="text"
                                    value={item.standard}
                                    onChange={(e) => handleEditPreviewItem(idx, 'standard', e.target.value)}
                                    style={{
                                      width: '100%',
                                      minWidth: '180px',
                                      padding: '4px 6px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      color: '#334155',
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <select
                                    value={item.tool_type}
                                    onChange={(e) => handleEditPreviewItem(idx, 'tool_type', e.target.value)}
                                    style={{
                                      padding: '4px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      background: '#FFFFFF',
                                    }}
                                  >
                                    <option value="VISUAL">VISUAL</option>
                                    <option value="TOUCH">TOUCH</option>
                                    <option value="TOOL">TOOL</option>
                                  </select>
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <input
                                    type="text"
                                    value={item.timing_sec}
                                    onChange={(e) => handleEditPreviewItem(idx, 'timing_sec', e.target.value)}
                                    style={{
                                      width: '60px',
                                      padding: '4px',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      textAlign: 'center',
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleDeletePreviewItem(idx)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#DC2626',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    title="Remove item"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Modal Footer actions */}
                      <div
                        style={{
                          marginTop: '20px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          onClick={() => setShowUploadModal(false)}
                          style={{
                            padding: '9px 18px',
                            borderRadius: '8px',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            color: '#475569',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveParsedChecklist}
                          disabled={isSavingChecklist || parsedChecklistItems.length === 0}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 24px',
                            borderRadius: '8px',
                            background: isSavingChecklist ? '#94A3B8' : '#10B981',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '800',
                            cursor: isSavingChecklist ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          {isSavingChecklist && <RefreshCw size={14} className="spin" />}
                          <span>{isSavingChecklist ? 'Saving to Database...' : `Confirm & Save ${parsedChecklistItems.length} Items to Database`}</span>
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* TAB 2: VERSION HISTORY & AUDIT LOG */}
                {uploadModalTab === 'history' && (
                  <div>
                    {selectedVersionDetail ? (
                      /* Detail view for selected version */
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <button
                            onClick={() => setSelectedVersionDetail(null)}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            ← Back to All Versions
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                              Version v{selectedVersionDetail.version_number} Checkpoints ({selectedVersionDetail.total_items} items)
                            </span>
                            {selectedVersionDetail.is_active ? (
                              <span style={{ background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800' }}>
                                Currently Active
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRestoreVersion(selectedVersionDetail.version_number)}
                                disabled={isRestoringVersion}
                                style={{
                                  background: '#10B981',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <RotateCcw size={12} /> Restore Version v{selectedVersionDetail.version_number}
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'auto', maxHeight: '52vh' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            <thead>
                              <tr style={{ background: '#0F172A', color: '#FFFFFF', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Sub No</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Assembly</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Sub Assembly</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Check Point (Hindi)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Standard</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Tool</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Timing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedVersionDetail.items?.map((it, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800' }}>{it.sub_no}</td>
                                  <td style={{ padding: '8px 10px' }}>{it.assembly}</td>
                                  <td style={{ padding: '8px 10px' }}>{it.sub_assembly}</td>
                                  <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0F172A' }}>{it.check_point}</td>
                                  <td style={{ padding: '8px 10px', color: '#475569' }}>{it.standard}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700' }}>{it.tool_type}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.timing_sec}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* Table list of versions */
                      <div>
                        {/* Machine Filter & Refresh Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Filter by Machine:</label>
                            <select
                              value={uploadTargetMachine}
                              onChange={(e) => {
                                setUploadTargetMachine(e.target.value);
                                fetchChecklistVersions(e.target.value);
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: '#FFFFFF',
                              }}
                            >
                              <option value="">All Machines / Default</option>
                              {machines.map((m) => (
                                <option key={m.id} value={m.id.toString()}>
                                  {m.machine_code} - {m.name || m.machine_code}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => fetchChecklistVersions(uploadTargetMachine)}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <RefreshCw size={12} className={loadingVersions ? 'spin' : ''} /> Refresh History
                          </button>
                        </div>

                        {loadingVersions ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                            <div>Loading version audit history...</div>
                          </div>
                        ) : checklistVersions.length === 0 ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                            No version records found.
                          </div>
                        ) : (
                          <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '80px' }}>Version</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '100px' }}>Machine</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Filename / Source</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Uploaded By</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Upload Date & Time</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Total Items</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '180px' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {checklistVersions.map((v, idx) => (
                                  <tr
                                    key={v.id || idx}
                                    style={{
                                      borderBottom: '1px solid #E2E8F0',
                                      background: v.is_active ? '#F0FDF4' : idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                                    }}
                                  >
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <span style={{ fontWeight: '800', color: v.is_active ? '#166534' : '#0F172A' }}>
                                        v{v.version_number}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: v.machine_code ? '#EFF6FF' : '#F1F5F9', color: v.machine_code ? '#1D4ED8' : '#475569' }}>
                                        {v.machine_code || 'Default'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1E293B' }}>
                                      {v.filename || 'Form_QF_MF_08.xlsx'}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: '#475569' }}>
                                      {v.uploaded_by}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: '#64748B', fontSize: '11px' }}>
                                      {new Date(v.uploaded_at).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700' }}>
                                      {v.total_items} items
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      {v.is_active ? (
                                        <span style={{ background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800' }}>
                                          ✓ Active (Live)
                                        </span>
                                      ) : (
                                        <span style={{ background: '#F1F5F9', color: '#64748B', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600' }}>
                                          Archived
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                        <button
                                          onClick={() => handleViewVersionDetail(v.version_number)}
                                          disabled={loadingVersionDetail}
                                          style={{
                                            background: '#FFFFFF',
                                            border: '1px solid #CBD5E1',
                                            color: '#0F172A',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                          }}
                                          title="Inspect checkpoints in this version"
                                        >
                                          <Eye size={12} /> View
                                        </button>
                                        {!v.is_active && (
                                          <button
                                            onClick={() => handleRestoreVersion(v.version_number)}
                                            disabled={isRestoringVersion}
                                            style={{
                                              background: '#10B981',
                                              border: 'none',
                                              color: '#FFFFFF',
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                            }}
                                            title="Restore this version as active"
                                          >
                                            <RotateCcw size={12} /> Restore
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
