import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CircleCheckBig, CircleX } from 'lucide-react';

import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import {
  createCalibrationEquipment, getCalibrationEquipment, getCalibrationSummary,
  getCalibrationHistory, getCalibrationHistoryPdf, getCalibrationPlan, getCalibrationPlanPdf,
  getCalibrationReport,
  createCalibrationPlanEntry, deleteCalibrationPlanEntry, updateCalibrationPlanEntry,
  recordCalibrationResult, setCalibrationDisposition,
  updateCalibrationEquipment,
} from '../api/calibration';
import { EquipmentFields, Field } from '../components/calibration/CalibrationFields';
import {
  apiErrorMessage, calculateNextCalibrationDate, EMPTY_FORM, EMPTY_SUMMARY, formatDate,
} from '../utils/calibrationData';
import {
  CalibrationDashboard, CalibrationNavigation, EquipmentManagement,
  EquipmentRegistryForm, CalibrationHistoryCard, CalibrationPlanReport,
} from '../components/calibration/CalibrationViews';

const VIEW_COPY = {
  dashboard: {
    title: 'Calibration Dashboard',
    subtitle: 'Monitor calibration validity, due dates, overdue equipment, and rejections',
  },
  equipment: {
    title: 'Equipment Management',
    subtitle: 'Search, review, update, and record calibration decisions',
  },
  register: {
    title: 'Register Equipment',
    subtitle: 'Add a new asset to the calibration equipment registry',
  },
  plan: {
    title: 'Calibration Plan',
    subtitle: 'Review and print the annual planned-versus-actual calibration schedule',
  },
  history: {
    title: 'Calibration History Card',
    subtitle: 'Review and print the permanent calibration record for this equipment',
  },
};

const EMPTY_STATUS_DATA = {
  result_date: '', calibration_agency: '',
  certificate_number: '', traceability_certificate_number: '',
  calibration_details: '', remarks: '', report_file: null,
};

const EMPTY_PLAN_FORM = { equipment: '', planned_date: '', remarks: '' };

export default function CalibrationPage({ view = 'dashboard' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { equipmentId } = useParams();
  const [equipment, setEquipment] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(view !== 'register');
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('due30');
  const [editTarget, setEditTarget] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusAction, setStatusAction] = useState('accepted');
  const [statusData, setStatusData] = useState(EMPTY_STATUS_DATA);
  const [dispositionTarget, setDispositionTarget] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [planYear, setPlanYear] = useState(() => {
    const requestedYear = Number(new URLSearchParams(location.search).get('year'));
    return requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : new Date().getFullYear();
  });
  const [planRows, setPlanRows] = useState([]);
  const [company, setCompany] = useState({});
  const [planPdfDownloading, setPlanPdfDownloading] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyPdfDownloading, setHistoryPdfDownloading] = useState(false);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [planTarget, setPlanTarget] = useState(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [registryOpen, setRegistryOpen] = useState(false);

  useEffect(() => {
    const message = location.state?.success ?? '';
    if (!message) {
      setSuccessMessage('');
      return;
    }
    setSuccessMessage(message);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timeout = window.setTimeout(() => setSuccessMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (view !== 'plan') return;
    const requestedYear = Number(new URLSearchParams(location.search).get('year'));
    if (requestedYear >= 2000 && requestedYear <= 2100 && requestedYear !== planYear) {
      setPlanYear(requestedYear);
    }
  }, [location.search, planYear, view]);

  useEffect(() => {
    if (view !== 'plan') return;
    const params = new URLSearchParams(location.search);
    if (params.get('year') === String(planYear)) return;
    params.set('year', String(planYear));
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate, planYear, view]);

  const refreshData = useCallback(async () => {
    const [equipmentResponse, summaryResponse] = await Promise.all([
      getCalibrationEquipment(), getCalibrationSummary(),
    ]);
    const rows = equipmentResponse.data?.results ?? equipmentResponse.data ?? [];
    setEquipment(Array.isArray(rows) ? rows : []);
    setSummary({ ...EMPTY_SUMMARY, ...summaryResponse.data });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setPageError('');
      try {
        if (view === 'register') {
          const response = await getCalibrationEquipment();
          const rows = response.data?.results ?? response.data ?? [];
          if (active) setEquipment(Array.isArray(rows) ? rows : []);
        } else if (view === 'plan') {
          const [planResponse, equipmentResponse] = await Promise.all([
            getCalibrationPlan(planYear), getCalibrationEquipment(),
          ]);
          if (active) {
            setPlanRows(planResponse.data?.rows ?? []);
            setCompany(planResponse.data?.company ?? {});
            const rows = equipmentResponse.data?.results ?? equipmentResponse.data ?? [];
            setEquipment(Array.isArray(rows) ? rows : []);
          }
        } else if (view === 'history') {
          const response = await getCalibrationHistory(equipmentId);
          if (active) setHistoryData(response.data);
        } else {
          await refreshData();
        }
      } catch {
        if (active) setPageError('Unable to load calibration data from the database.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = ['dashboard', 'equipment'].includes(view)
      ? setInterval(() => refreshData().catch(() => {}), 10000)
      : null;
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [equipmentId, planYear, refreshData, view]);

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();
    return equipment.filter((item) => {
      const searchable = [
        item.equipment_id, item.equipment_name, item.equipment_type,
        item.history_card_number, item.department, item.location,
      ].join(' ').toLowerCase();
      return (!statusFilter || item.status === statusFilter)
        && (!query || searchable.includes(query));
    });
  }, [equipment, search, statusFilter]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => {
      const next = { ...current, [name]: value };
      if (name === 'equipment_id') {
        const normalizedId = value.trim();
        next.history_card_number = normalizedId ? `HC-${normalizedId}` : '';
      }
      if (name === 'last_calibration_date' || name === 'calibration_frequency_days') {
        next.next_calibration_date = calculateNextCalibrationDate(
          next.last_calibration_date, next.calibration_frequency_days,
        );
      }
      return next;
    });
    if (name === 'equipment_id') {
      const normalizedId = value.trim().toLowerCase();
      const duplicate = equipment.some((item) => item.id !== editTarget?.id
        && item.equipment_id?.trim().toLowerCase() === normalizedId);
      setFormError(duplicate ? 'This equipment ID is already registered.' : '');
    }
  };

  const payloadFromForm = () => {
    const payload = { ...formData };
    delete payload.next_calibration_date;
    delete payload.history_card_number;
    payload.equipment_id = payload.equipment_id.trim();
    payload.calibration_frequency_days = Number(payload.calibration_frequency_days);
    return payload;
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const duplicate = equipment.some((item) => item.equipment_id?.trim().toLowerCase() === formData.equipment_id.trim().toLowerCase());
    if (duplicate) {
      setFormError('This equipment ID is already registered. Use a different equipment ID.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const response = await createCalibrationEquipment(payloadFromForm());
      const nextDueDate = response.data?.next_calibration_date || formData.next_calibration_date;
      const nextPlanYear = nextDueDate?.slice(0, 4) || String(new Date().getFullYear());
      setFormData(EMPTY_FORM);
      setFormError('');
      setRegistryOpen(false);
      setSuccessMessage(`${formData.equipment_id} registered successfully.`);
      navigate(`/calibration/plan?year=${nextPlanYear}`, {
        state: { success: `${formData.equipment_id} registered successfully.` },
      });
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to register this equipment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setFormData(Object.fromEntries(
      Object.keys(EMPTY_FORM).map((key) => [key, item[key] ?? ''])
    ));
    setFormError('');
    setSuccessMessage('');
  };

  const closeEdit = () => {
    if (submitting) return;
    setEditTarget(null);
    setFormData(EMPTY_FORM);
    setFormError('');
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await updateCalibrationEquipment(editTarget.id, payloadFromForm());
      setSuccessMessage(`${editTarget.equipment_id} updated successfully.`);
      setEditTarget(null);
      setFormData(EMPTY_FORM);
      try {
        await refreshData();
      } catch {
        setPageError('Equipment saved, but the list could not be refreshed. Try refreshing the page.');
      }
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save this equipment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openStatus = (item, action = 'accepted') => {
    if (item.state === 'rejected') {
      setFormError('');
      setSuccessMessage('');
      setDispositionTarget(item);
      return;
    }
    if (item.state === 'scrapped') return;
    const localToday = new Date();
    localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
    setStatusTarget(item);
    setStatusAction(action);
    setStatusData({ ...EMPTY_STATUS_DATA, result_date: localToday.toISOString().slice(0, 10) });
    setFormError('');
    setSuccessMessage('');
  };

  const closeStatus = () => {
    if (submitting) return;
    setStatusTarget(null);
    setFormError('');
  };

  const handleStatusUpdate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const recordData = {
        result: statusAction,
        calibration_date: statusData.result_date,
        calibration_agency: statusData.calibration_agency,
        certificate_number: statusData.certificate_number,
        traceability_certificate_number: statusData.traceability_certificate_number,
        calibration_details: statusData.calibration_details,
        remarks: statusData.remarks,
      };
      const resultData = new FormData();
      Object.entries(recordData).forEach(([key, value]) => resultData.append(key, value));
      if (statusData.report_file) resultData.append('report_file', statusData.report_file);
      const response = await recordCalibrationResult(statusTarget.id, resultData);
      setSuccessMessage(statusAction === 'accepted'
        ? `${statusTarget.equipment_id} accepted. Next calibration: ${formatDate(response.data.next_calibration_date)}.`
        : `${statusTarget.equipment_id} rejected. Choose repair or scrap.`);
      if (statusAction === 'rejected') setDispositionTarget(response.data);
      setStatusTarget(null);
      try {
        await refreshData();
      } catch {
        setPageError('Result saved, but the equipment list could not be refreshed. Try refreshing the page.');
      }
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save this calibration result.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openRegistry = () => {
    setFormData(EMPTY_FORM);
    setFormError('');
    setRegistryOpen(true);
  };

  const closeRegistry = () => {
    if (submitting) return;
    setRegistryOpen(false);
    setFormData(EMPTY_FORM);
    setFormError('');
  };

  const handleDisposition = async (disposition) => {
    setSubmitting(true);
    setFormError('');
    try {
      await setCalibrationDisposition(dispositionTarget.id, disposition);
      setSuccessMessage(`${dispositionTarget.equipment_id} marked as ${disposition === 'repair' ? 'under repair' : 'scrapped'}.`);
      setDispositionTarget(null);
      try {
        await refreshData();
      } catch {
        setPageError('Disposition saved, but the equipment list could not be refreshed. Try refreshing the page.');
      }
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save the equipment disposition.'));
    } finally {
      setSubmitting(false);
    }
  };

  const viewReport = useCallback(async (record) => {
    try {
      const response = await getCalibrationReport(record.id);
      const url = URL.createObjectURL(response.data);
      setDocumentPreview({
        url,
        name: record.report_file_name,
        type: record.report_content_type || response.data.type,
      });
    } catch {
      setPageError('Unable to open the certificate or evidence.');
    }
  }, []);

  useEffect(() => {
    if (view !== 'history' || documentPreview) return;
    const recordId = new URLSearchParams(location.search).get('certificate');
    const record = historyData?.records?.find((item) => String(item.id) === recordId);
    if (record?.has_report) viewReport(record);
  }, [documentPreview, historyData, location.search, view, viewReport]);

  const closeDocumentPreview = () => {
    if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url);
    setDocumentPreview(null);
    const params = new URLSearchParams(location.search);
    if (params.has('certificate')) {
      params.delete('certificate');
      navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
    }
  };

  const downloadPreview = () => {
    const link = document.createElement('a');
    link.href = documentPreview.url;
    link.download = documentPreview.name;
    link.click();
  };

  const openPlanEditor = (row = null) => {
    setPlanTarget(row);
    setPlanForm(row ? {
      equipment: String(row.equipment_pk),
      planned_date: row.planned_date,
      remarks: row.plan_remarks ?? '',
    } : EMPTY_PLAN_FORM);
    setFormError('');
    setPlanEditorOpen(true);
  };

  const closePlanEditor = () => {
    if (submitting) return;
    setPlanEditorOpen(false);
    setPlanTarget(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setFormError('');
  };

  const savePlanEntry = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      if (planTarget) await updateCalibrationPlanEntry(planTarget.id, planForm);
      else await createCalibrationPlanEntry(planForm);
      setSuccessMessage(`Calibration plan entry ${planTarget ? 'updated' : 'added'} successfully.`);
      setPlanEditorOpen(false);
      setPlanTarget(null);
      setPlanForm(EMPTY_PLAN_FORM);
      setFormError('');
      try {
        const response = await getCalibrationPlan(planYear);
        setPlanRows(response.data?.rows ?? []);
      } catch {
        setPageError('Plan entry saved, but the plan could not be refreshed. Try refreshing the page.');
      }
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save this calibration plan entry.'));
    } finally {
      setSubmitting(false);
    }
  };

  const removePlanEntry = async (row) => {
    if (!window.confirm(`Remove ${row.equipment_id} from the ${planYear} calibration plan?`)) return;
    try {
      await deleteCalibrationPlanEntry(row.id);
      setPlanRows((current) => current.filter((item) => item.id !== row.id));
      setSuccessMessage(`${row.equipment_id} removed from the ${planYear} plan. The equipment remains in the master.`);
    } catch {
      setPageError('Unable to remove this calibration plan entry.');
    }
  };

  const downloadPlanPdf = async (filters = {}) => {
    setPlanPdfDownloading(true);
    setPageError('');
    try {
      const response = await getCalibrationPlanPdf(planYear, filters);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Calibration_Plan_${planYear}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError('Unable to download the calibration plan PDF.');
    } finally {
      setPlanPdfDownloading(false);
    }
  };

  const downloadHistoryPdf = async () => {
    setHistoryPdfDownloading(true);
    setPageError('');
    try {
      const response = await getCalibrationHistoryPdf(equipmentId);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Gauge_History_Card_${historyData?.equipment?.equipment_id || equipmentId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError('Unable to download the gauge history card PDF.');
    } finally {
      setHistoryPdfDownloading(false);
    }
  };

  const copy = VIEW_COPY[view];
  return (
    <>
      <Header title={copy.title} subtitle={copy.subtitle} showLiveStatus={false} />
      <div className="page-content bg-gradient-animated calibration-page">
        <CalibrationNavigation />
        {loading ? <LoadingSpinner message="Loading calibration equipment..." /> : (
          <>
            {pageError && <div className="calibration-notice calibration-notice-error" role="alert">{pageError}</div>}
            {successMessage && <div className="calibration-notice calibration-notice-success" role="status">{successMessage}</div>}
            {view === 'dashboard' && (
              <CalibrationDashboard
                summary={summary}
                equipment={equipment}
                selectedFilter={dashboardFilter}
                onFilterChange={setDashboardFilter}
                openStatus={openStatus}
              />
            )}
            {view === 'equipment' && (
              <EquipmentManagement
                equipment={equipment} filteredEquipment={filteredEquipment}
                search={search} statusFilter={statusFilter}
                setSearch={setSearch} setStatusFilter={setStatusFilter}
                openEdit={openEdit} openStatus={openStatus} onRegister={openRegistry}
              />
            )}
            {view === 'register' && (
              <EquipmentRegistryForm
                formData={formData} formError={formError} submitting={submitting}
                onChange={handleFormChange} onSubmit={handleRegister}
                onCancel={() => navigate('/calibration/equipment')} modal
              />
            )}
            {view === 'plan' && <CalibrationPlanReport year={planYear} setYear={setPlanYear} rows={planRows} company={company} openEditor={openPlanEditor} removeEntry={removePlanEntry} downloadPdf={downloadPlanPdf} downloadingPdf={planPdfDownloading} />}
            {view === 'history' && <CalibrationHistoryCard data={historyData} onViewReport={viewReport} downloadPdf={downloadHistoryPdf} downloadingPdf={historyPdfDownloading} />}
          </>
        )}
      </div>

      {editTarget && (
        <Modal
          title={`Edit ${editTarget.equipment_id}`}
          size="lg"
          onClose={closeEdit}
          footer={(
            <>
              <button className="btn btn-ghost" type="button" onClick={closeEdit} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" type="submit" form="calibration-edit-form" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
            </>
          )}
        >
          {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
          <form id="calibration-edit-form" onSubmit={handleEdit}>
            <EquipmentFields formData={formData} onChange={handleFormChange} historyCardReadOnly />
          </form>
        </Modal>
      )}

      {statusTarget && (
        <Modal
          title={`Calibration Result · ${statusTarget.equipment_id}`}
          size="lg"
          onClose={closeStatus}
          footer={(
            <>
              <button className="btn btn-ghost" type="button" onClick={closeStatus} disabled={submitting}>Cancel</button>
              <button className={`btn ${statusAction === 'accepted' ? 'btn-success' : 'btn-danger'}`} type="submit" form="calibration-status-form" disabled={submitting}>
                {submitting ? 'Saving...' : `Confirm ${statusAction === 'accepted' ? 'Accepted' : 'Rejected'}`}
              </button>
            </>
          )}
        >
          {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
          <div className="calibration-status-equipment">
            <strong>{statusTarget.equipment_name}</strong>
            <span>{statusTarget.equipment_type} · {statusTarget.department} / {statusTarget.location}</span>
          </div>
          <form id="calibration-status-form" onSubmit={handleStatusUpdate}>
            <div className="calibration-status-choices" role="radiogroup" aria-label="Calibration result">
              <button type="button" className={`calibration-status-choice passed${statusAction === 'accepted' ? ' active' : ''}`} role="radio" aria-checked={statusAction === 'accepted'} onClick={() => setStatusAction('accepted')}>
                <CircleCheckBig size={20} aria-hidden="true" /><span><strong>Accepted</strong><small>Release equipment for use</small></span>
              </button>
              <button type="button" className={`calibration-status-choice failed${statusAction === 'rejected' ? ' active' : ''}`} role="radio" aria-checked={statusAction === 'rejected'} onClick={() => setStatusAction('rejected')}>
                <CircleX size={20} aria-hidden="true" /><span><strong>Rejected</strong><small>Choose repair or scrap next</small></span>
              </button>
            </div>
            <div className="calibration-form-grid">
              <Field label="Planned Calibration Date" name="planned_date" type="date" value={statusTarget.next_calibration_date} readOnly />
              <Field label="Calibration Date" name="result_date" type="date" value={statusData.result_date} onChange={(event) => setStatusData((current) => ({ ...current, result_date: event.target.value }))} required />
            </div>
            <p className="calibration-status-help">{statusAction === 'accepted' ? `The next calibration date will be calculated using the ${statusTarget.calibration_frequency_days}-day frequency.` : 'After saving the rejection, choose whether the equipment will be repaired or scrapped.'}</p>
            {statusTarget.acceptance_criteria && <p className="calibration-status-help"><strong>Acceptance criteria:</strong> {statusTarget.acceptance_criteria}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="calibration-report-file">Certificate / Evidence (optional)</label>
              <input id="calibration-report-file" className="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setStatusData((current) => ({ ...current, report_file: event.target.files?.[0] ?? null }))} />
              <small className="text-xs text-muted">PDF, JPG, or PNG; maximum 10 MB.</small>
            </div>
            <div className="calibration-form-grid calibration-result-details">
              <Field label="Calibration Agency" name="calibration_agency" value={statusData.calibration_agency} onChange={(event) => setStatusData((current) => ({ ...current, calibration_agency: event.target.value }))} />
              <Field label="Certificate No." name="certificate_number" value={statusData.certificate_number} onChange={(event) => setStatusData((current) => ({ ...current, certificate_number: event.target.value }))} />
              <Field label="Traceability Certificate" name="traceability_certificate_number" value={statusData.traceability_certificate_number} onChange={(event) => setStatusData((current) => ({ ...current, traceability_certificate_number: event.target.value }))} />
              <div className="form-group calibration-form-span"><label className="form-label" htmlFor="calibration-details">Calibration Details</label><textarea id="calibration-details" className="form-textarea" value={statusData.calibration_details} onChange={(event) => setStatusData((current) => ({ ...current, calibration_details: event.target.value }))} /></div>
              <div className="form-group calibration-form-span"><label className="form-label" htmlFor="result-remarks">Record Remarks</label><textarea id="result-remarks" className="form-textarea" value={statusData.remarks} onChange={(event) => setStatusData((current) => ({ ...current, remarks: event.target.value }))} /></div>
            </div>
          </form>
        </Modal>
      )}

      {registryOpen && (
        <EquipmentRegistryForm
          formData={formData} formError={formError} submitting={submitting}
          onChange={handleFormChange} onSubmit={handleRegister} onCancel={closeRegistry} modal
        />
      )}

      {dispositionTarget && (
        <Modal
          title={`Rejected Equipment · ${dispositionTarget.equipment_id}`}
          onClose={() => setDispositionTarget(null)}
          footer={<button className="btn btn-ghost" type="button" onClick={() => setDispositionTarget(null)} disabled={submitting}>Decide Later</button>}
        >
          {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
          <p className="calibration-status-help">Choose the next controlled state. Scrapped equipment remains available in history but cannot be recalibrated.</p>
          <div className="calibration-disposition-actions">
            <button className="btn btn-primary" type="button" onClick={() => handleDisposition('repair')} disabled={submitting}>Send for Repair</button>
            <button className="btn btn-danger" type="button" onClick={() => handleDisposition('scrapped')} disabled={submitting}>Scrap Equipment</button>
          </div>
        </Modal>
      )}

      {documentPreview && (
        <Modal
          title={`Certificate / Evidence · ${documentPreview.name}`}
          size="xl"
          onClose={closeDocumentPreview}
          footer={(
            <>
              <button className="btn btn-ghost" type="button" onClick={closeDocumentPreview}>Close</button>
              <button className="btn btn-primary" type="button" onClick={downloadPreview}>Download</button>
            </>
          )}
        >
          {documentPreview.type?.startsWith('image/') ? (
            <img className="calibration-evidence-image" src={documentPreview.url} alt={`Certificate or evidence ${documentPreview.name}`} />
          ) : (
            <iframe className="calibration-evidence-frame" src={documentPreview.url} title={`Certificate or evidence ${documentPreview.name}`} />
          )}
        </Modal>
      )}

      {planEditorOpen && (
        <Modal
          title={planTarget ? `Edit Plan · ${planTarget.equipment_id}` : `Add to ${planYear} Calibration Plan`}
          onClose={closePlanEditor}
          footer={(
            <>
              <button className="btn btn-ghost" type="button" onClick={closePlanEditor} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" type="submit" form="calibration-plan-form" disabled={submitting}>{submitting ? 'Saving...' : 'Save Plan Entry'}</button>
            </>
          )}
        >
          {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
          <form id="calibration-plan-form" onSubmit={savePlanEntry}>
            <div className="form-group">
              <label className="form-label" htmlFor="plan-equipment">Equipment *</label>
              <select id="plan-equipment" className="form-select" value={planForm.equipment} onChange={(event) => setPlanForm((current) => ({ ...current, equipment: event.target.value }))} required>
                <option value="">Select equipment from master</option>
                {equipment.filter((item) => item.state !== 'scrapped').map((item) => <option key={item.id} value={item.id}>{item.equipment_id} · {item.equipment_name}</option>)}
              </select>
            </div>
            <Field label="Planned Calibration Date" name="planned_date" type="date" min={`${planYear}-01-01`} max={`${planYear}-12-31`} value={planForm.planned_date} onChange={(event) => setPlanForm((current) => ({ ...current, planned_date: event.target.value }))} required />
            <div className="form-group"><label className="form-label" htmlFor="plan-remarks">Remarks</label><textarea id="plan-remarks" className="form-textarea" value={planForm.remarks} onChange={(event) => setPlanForm((current) => ({ ...current, remarks: event.target.value }))} /></div>
          </form>
        </Modal>
      )}
    </>
  );
}
