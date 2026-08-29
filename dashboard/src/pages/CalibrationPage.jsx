import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleCheckBig, CircleX } from 'lucide-react';

import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import {
  createCalibrationEquipment, getCalibrationEquipment, getCalibrationSummary,
  markCalibrationEquipmentFailed, markCalibrationEquipmentPassed,
  updateCalibrationEquipment,
} from '../api/calibration';
import { EquipmentFields, Field } from '../components/calibration/CalibrationFields';
import { apiErrorMessage, EMPTY_FORM, EMPTY_SUMMARY, formatDate } from '../utils/calibrationData';
import {
  CalibrationDashboard, CalibrationNavigation, EquipmentManagement,
  EquipmentRegistryForm,
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
};

export default function CalibrationPage({ view = 'dashboard' }) {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [statusData, setStatusData] = useState({ result_date: '', failure_remark: '' });

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
      try {
        await refreshData();
      } catch {
        if (active) setPageError('Unable to load calibration equipment from the database.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(() => refreshData().catch(() => {}), 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshData, view]);

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
    setStatusData({ result_date: localToday.toISOString().slice(0, 10), failure_remark: '' });
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
      const response = statusAction === 'passed'
        ? await markCalibrationEquipmentPassed(statusTarget.id, { passed_date: statusData.result_date })
        : await markCalibrationEquipmentFailed(statusTarget.id, {
          failed_date: statusData.result_date,
          failure_remark: statusData.failure_remark,
        });
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
              <button type="button" className={`calibration-status-choice failed${statusAction === 'failed' ? ' active' : ''}`} role="radio" aria-checked={statusAction === 'failed'} onClick={() => setStatusAction('failed')}>
                <CircleX size={20} aria-hidden="true" /><span><strong>Failed</strong><small>Retain and flag the equipment</small></span>
              </button>
            </div>
            <Field label="Calibration Date" name="result_date" type="date" value={statusData.result_date} onChange={(event) => setStatusData((current) => ({ ...current, result_date: event.target.value }))} required />
            {statusAction === 'passed' ? (
              <p className="calibration-status-help">The next calibration date will be calculated automatically using the {statusTarget.calibration_frequency_days}-day frequency.</p>
            ) : (
              <div className="form-group">
                <label className="form-label" htmlFor="failure-remark">Failure Remark (optional)</label>
                <textarea id="failure-remark" className="form-textarea" name="failure_remark" value={statusData.failure_remark} onChange={(event) => setStatusData((current) => ({ ...current, failure_remark: event.target.value }))} />
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
