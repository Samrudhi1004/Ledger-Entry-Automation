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
  const [successMessage, setSuccessMessage] = useState(location.state?.success ?? '');
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
  const [planYear, setPlanYear] = useState(() => new Date().getFullYear());
  const [planRows, setPlanRows] = useState([]);
  const [company, setCompany] = useState({});
  const [planPdfDownloading, setPlanPdfDownloading] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyPdfDownloading, setHistoryPdfDownloading] = useState(false);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [planTarget, setPlanTarget] = useState(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);

  const refreshData = useCallback(async () => {
    const [equipmentResponse, summaryResponse] = await Promise.all([
      getCalibrationEquipment(), getCalibrationSummary(),
    ]);
    const rows = equipmentResponse.data?.results ?? equipmentResponse.data ?? [];
    setEquipment(Array.isArray(rows) ? rows : []);
    setSummary({ ...EMPTY_SUMMARY, ...summaryResponse.data });
  }, []);

  useEffect(() => {
    if (view === 'register') return;
    let active = true;
    const load = async () => {
      setPageError('');
      try {
        if (view === 'plan') {
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
      if (name === 'last_calibration_date' || name === 'calibration_frequency_days') {
        next.next_calibration_date = calculateNextCalibrationDate(
          next.last_calibration_date, next.calibration_frequency_days,
        );
      }
      return next;
    });
  };

  const payloadFromForm = () => {
    const payload = { ...formData };
    delete payload.next_calibration_date;
    payload.calibration_frequency_days = Number(payload.calibration_frequency_days);
    return payload;
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await createCalibrationEquipment(payloadFromForm());
      setSuccessMessage(`${formData.equipment_id} registered successfully.`);
      navigate('/calibration/equipment', {
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
      await refreshData();
      setSuccessMessage(`${editTarget.equipment_id} updated successfully.`);
      setEditTarget(null);
      setFormData(EMPTY_FORM);
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
      await refreshData();
      setSuccessMessage(statusAction === 'accepted'
        ? `${statusTarget.equipment_id} accepted. Next calibration: ${formatDate(response.data.next_calibration_date)}.`
        : `${statusTarget.equipment_id} rejected. Choose repair or scrap.`);
      if (statusAction === 'rejected') setDispositionTarget(response.data);
      setStatusTarget(null);
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save this calibration result.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisposition = async (disposition) => {
    setSubmitting(true);
    setFormError('');
    try {
      await setCalibrationDisposition(dispositionTarget.id, disposition);
      await refreshData();
      setSuccessMessage(`${dispositionTarget.equipment_id} marked as ${disposition === 'repair' ? 'under repair' : 'scrapped'}.`);
      setDispositionTarget(null);
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
      const response = await getCalibrationPlan(planYear);
      setPlanRows(response.data?.rows ?? []);
      setSuccessMessage(`Calibration plan entry ${planTarget ? 'updated' : 'added'} successfully.`);
      closePlanEditor();
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
      <Header title={copy.title} subtitle={copy.subtitle} />
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
                openEdit={openEdit} openStatus={openStatus}
              />
            )}
            {view === 'register' && (
              <EquipmentRegistryForm
                formData={formData} formError={formError} submitting={submitting}
                onChange={handleFormChange} onSubmit={handleRegister}
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
            <EquipmentFields formData={formData} onChange={handleFormChange} />
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
            <Field label="Calibration Date" name="result_date" type="date" value={statusData.result_date} onChange={(event) => setStatusData((current) => ({ ...current, result_date: event.target.value }))} required />
            <p className="calibration-status-help">{statusAction === 'accepted' ? `The next calibration date will be calculated using the ${statusTarget.calibration_frequency_days}-day frequency.` : 'After saving the rejection, choose whether the equipment will be repaired or scrapped.'}</p>
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
