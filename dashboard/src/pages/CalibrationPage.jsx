import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import {
  createCalibrationEquipment, getCalibrationEquipment, getCalibrationSummary,
  markCalibrationEquipmentFailed, updateCalibrationEquipment,
} from '../api/calibration';
import { EquipmentFields, Field } from './calibration/CalibrationFields';
import { apiErrorMessage, EMPTY_FORM, EMPTY_SUMMARY } from './calibration/calibrationData';
import {
  CalibrationDashboard, CalibrationNavigation, EquipmentManagement,
  EquipmentRegistryForm,
} from './calibration/CalibrationViews';

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
  const [editTarget, setEditTarget] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failureTarget, setFailureTarget] = useState(null);
  const [failureData, setFailureData] = useState({ failed_date: '', failure_remark: '' });

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
    return () => { active = false; };
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

  const attentionEquipment = useMemo(
    () => equipment.filter((item) => item.status !== 'Valid').slice(0, 5),
    [equipment]
  );

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

  const openFailure = (item) => {
    const localToday = new Date();
    localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
    setFailureTarget(item);
    setFailureData({ failed_date: localToday.toISOString().slice(0, 10), failure_remark: '' });
    setFormError('');
    setSuccessMessage('');
  };

  const handleMarkFailed = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await markCalibrationEquipmentFailed(failureTarget.id, failureData);
      await refreshData();
      setSuccessMessage(`${failureTarget.equipment_id} marked as failed. The record was retained.`);
      setFailureTarget(null);
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to mark this equipment as failed.'));
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
            {view === 'dashboard' && <CalibrationDashboard summary={summary} attentionEquipment={attentionEquipment} />}
            {view === 'equipment' && (
              <EquipmentManagement
                equipment={equipment} filteredEquipment={filteredEquipment}
                search={search} statusFilter={statusFilter}
                setSearch={setSearch} setStatusFilter={setStatusFilter}
                openEdit={openEdit} openFailure={openFailure}
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

      {failureTarget && (
        <Modal
          title={`Mark ${failureTarget.equipment_id} as Failed`}
          onClose={() => !submitting && setFailureTarget(null)}
          footer={(
            <>
              <button className="btn btn-ghost" type="button" onClick={() => setFailureTarget(null)} disabled={submitting}>Cancel</button>
              <button className="btn btn-danger" type="submit" form="calibration-failure-form" disabled={submitting}>{submitting ? 'Saving...' : 'Mark as Failed'}</button>
            </>
          )}
        >
          {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
          <p className="mb-16">This keeps the equipment in the registry and records the failure details.</p>
          <form id="calibration-failure-form" onSubmit={handleMarkFailed}>
            <Field label="Failed Date" name="failed_date" type="date" value={failureData.failed_date} onChange={(event) => setFailureData((current) => ({ ...current, failed_date: event.target.value }))} required />
            <div className="form-group">
              <label className="form-label" htmlFor="failure-remark">Failure Remark (optional)</label>
              <textarea id="failure-remark" className="form-textarea" name="failure_remark" value={failureData.failure_remark} onChange={(event) => setFailureData((current) => ({ ...current, failure_remark: event.target.value }))} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
