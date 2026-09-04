import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CircleCheckBig, CircleX } from 'lucide-react';

import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import {
  createCalibrationEquipment, getCalibrationEquipment, getCalibrationSummary,
  getCalibrationHistory, getCalibrationPlan, getCalibrationReport,
  createCalibrationPlanEntry, deleteCalibrationPlanEntry, updateCalibrationPlanEntry,
  markCalibrationEquipmentFailed, markCalibrationEquipmentPassed,
  updateCalibrationEquipment,
} from '../api/calibration';
import { EquipmentFields, Field } from '../components/calibration/CalibrationFields';
import { apiErrorMessage, EMPTY_FORM, EMPTY_SUMMARY, formatDate } from '../utils/calibrationData';
import {
  CalibrationDashboard, CalibrationNavigation, EquipmentManagement,
  EquipmentRegistryForm, CalibrationHistoryCard, CalibrationPlanReport,
} from '../components/calibration/CalibrationViews';

const VIEW_COPY = {
  dashboard: {
    title: 'Calibration Dashboard',
    subtitle: 'Monitor calibration validity, due dates, overdue equipment, and failures',
  },
  equipment: {
    title: 'Equipment Management',
    subtitle: 'Search, review, update, and mark registered calibration equipment as failed',
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
  result_date: '', calibration_agency: '', report_number: '',
  certificate_number: '', traceability_certificate_number: '', specified_size: '',
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
  const [statusAction, setStatusAction] = useState('passed');
  const [statusData, setStatusData] = useState(EMPTY_STATUS_DATA);
  const [planYear, setPlanYear] = useState(() => new Date().getFullYear());
  const [planRows, setPlanRows] = useState([]);
  const [historyData, setHistoryData] = useState(null);
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
        item.serial_number, item.department, item.location,
      ].join(' ').toLowerCase();
      return (!statusFilter || item.status === statusFilter)
        && (!query || searchable.includes(query));
    });
  }, [equipment, search, statusFilter]);

  const handleFormChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const payloadFromForm = () => ({
    ...formData,
    calibration_frequency_days: Number(formData.calibration_frequency_days),
  });

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

  const openStatus = (item, action = 'passed') => {
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
        calibration_agency: statusData.calibration_agency,
        report_number: statusData.report_number,
        certificate_number: statusData.certificate_number,
        traceability_certificate_number: statusData.traceability_certificate_number,
        specified_size: statusData.specified_size,
        calibration_details: statusData.calibration_details,
        remarks: statusData.remarks,
      };
      let response;
      if (statusAction === 'passed') {
        const passedData = new FormData();
        passedData.append('passed_date', statusData.result_date);
        Object.entries(recordData).forEach(([key, value]) => passedData.append(key, value));
        if (statusData.report_file) passedData.append('report_file', statusData.report_file);
        response = await markCalibrationEquipmentPassed(statusTarget.id, passedData);
      } else {
        response = await markCalibrationEquipmentFailed(statusTarget.id, {
          failed_date: statusData.result_date,
        });
      }
      await refreshData();
      setSuccessMessage(statusAction === 'passed'
        ? `${statusTarget.equipment_id} passed calibration. Next calibration: ${formatDate(response.data.next_calibration_date)}.`
        : `${statusTarget.equipment_id} marked as failed. The record was retained.`);
      setStatusTarget(null);
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save this calibration result.'));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReport = async (record) => {
    try {
      const response = await getCalibrationReport(record.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.report_file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError('Unable to download the calibration report.');
    }
  };

  const openPlanEditor = (row = null) => {
    setPlanTarget(row);
    setPlanForm(row ? {
      equipment: String(row.equipment_pk),
      planned_date: row.planned_date,
      remarks: row.remarks ?? '',
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
            {view === 'plan' && <CalibrationPlanReport year={planYear} setYear={setPlanYear} rows={planRows} openEditor={openPlanEditor} removeEntry={removePlanEntry} />}
            {view === 'history' && <CalibrationHistoryCard data={historyData} onDownloadReport={downloadReport} />}
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
              <button className={`btn ${statusAction === 'passed' ? 'btn-success' : 'btn-danger'}`} type="submit" form="calibration-status-form" disabled={submitting}>
                {submitting ? 'Saving...' : `Confirm ${statusAction === 'passed' ? 'Passed' : 'Failed'}`}
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
              <button type="button" className={`calibration-status-choice passed${statusAction === 'passed' ? ' active' : ''}`} role="radio" aria-checked={statusAction === 'passed'} onClick={() => setStatusAction('passed')}>
                <CircleCheckBig size={20} aria-hidden="true" /><span><strong>Passed</strong><small>Equipment passed calibration</small></span>
              </button>
              <button type="button" className={`calibration-status-choice failed${statusAction === 'failed' ? ' active' : ''}`} role="radio" aria-checked={statusAction === 'failed'} onClick={() => { setStatusAction('failed'); setStatusData((current) => ({ ...EMPTY_STATUS_DATA, result_date: current.result_date })); }}>
                <CircleX size={20} aria-hidden="true" /><span><strong>Failed</strong><small>Retain and flag the equipment</small></span>
              </button>
            </div>
            {statusAction === 'passed' ? (
              <>
                <Field label="Calibration Date" name="result_date" type="date" value={statusData.result_date} onChange={(event) => setStatusData((current) => ({ ...current, result_date: event.target.value }))} required />
                <p className="calibration-status-help">The next calibration date will be calculated automatically using the {statusTarget.calibration_frequency_days}-day frequency.</p>
                <div className="form-group">
                  <label className="form-label" htmlFor="calibration-report-file">Evidence Report (optional)</label>
                  <input id="calibration-report-file" className="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setStatusData((current) => ({ ...current, report_file: event.target.files?.[0] ?? null }))} />
                  <small className="text-xs text-muted">PDF, JPG, or PNG; maximum 10 MB.</small>
                </div>
                <div className="calibration-form-grid calibration-result-details">
                  <Field label="Calibration Agency" name="calibration_agency" value={statusData.calibration_agency} onChange={(event) => setStatusData((current) => ({ ...current, calibration_agency: event.target.value }))} />
                  <Field label="Report Number" name="report_number" value={statusData.report_number} onChange={(event) => setStatusData((current) => ({ ...current, report_number: event.target.value }))} />
                  <Field label="Certificate Number" name="certificate_number" value={statusData.certificate_number} onChange={(event) => setStatusData((current) => ({ ...current, certificate_number: event.target.value }))} />
                  <Field label="Traceability Certificate" name="traceability_certificate_number" value={statusData.traceability_certificate_number} onChange={(event) => setStatusData((current) => ({ ...current, traceability_certificate_number: event.target.value }))} />
                  <Field label="Specified Size" name="specified_size" value={statusData.specified_size} onChange={(event) => setStatusData((current) => ({ ...current, specified_size: event.target.value }))} />
                  <div className="form-group calibration-form-span"><label className="form-label" htmlFor="calibration-details">Calibration Details</label><textarea id="calibration-details" className="form-textarea" value={statusData.calibration_details} onChange={(event) => setStatusData((current) => ({ ...current, calibration_details: event.target.value }))} /></div>
                  <div className="form-group calibration-form-span"><label className="form-label" htmlFor="result-remarks">Record Remarks</label><textarea id="result-remarks" className="form-textarea" value={statusData.remarks} onChange={(event) => setStatusData((current) => ({ ...current, remarks: event.target.value }))} /></div>
                </div>
              </>
            ) : <p className="calibration-status-help calibration-status-failed-help">Confirm to mark this equipment as failed today. No calibration report details will be saved.</p>}
          </form>
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
                {equipment.map((item) => <option key={item.id} value={item.id}>{item.equipment_id} · {item.equipment_name}</option>)}
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
