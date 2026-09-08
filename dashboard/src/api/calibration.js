import api from './axios';


export const getCalibrationEquipment = () =>
  api.get('/api/calibration/equipment/');

export const createCalibrationEquipment = (data) =>
  api.post('/api/calibration/equipment/', data);

export const updateCalibrationEquipment = (equipmentId, data) =>
  api.patch(`/api/calibration/equipment/${equipmentId}/`, data);

export const recordCalibrationResult = (equipmentId, data) =>
  api.post(`/api/calibration/equipment/${equipmentId}/record-result/`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const setCalibrationDisposition = (equipmentId, disposition) =>
  api.post(`/api/calibration/equipment/${equipmentId}/disposition/`, { disposition });

export const getCalibrationSummary = () =>
  api.get('/api/calibration/summary/');

export const getCalibrationHistory = (equipmentId) =>
  api.get(`/api/calibration/equipment/${equipmentId}/history/`);

export const getCalibrationHistoryPdf = (equipmentId) =>
  api.get(`/api/calibration/equipment/${equipmentId}/history/pdf/`, { responseType: 'blob' });

export const getCalibrationPlan = (year) =>
  api.get('/api/calibration/plan/', { params: { year } });

export const getCalibrationPlanPdf = (year, filters = {}) =>
  api.get('/api/calibration/plan/pdf/', { params: { year, ...filters }, responseType: 'blob' });

export const createCalibrationPlanEntry = (data) =>
  api.post('/api/calibration/plan/', data);

export const updateCalibrationPlanEntry = (entryId, data) =>
  api.patch(`/api/calibration/plan/${entryId}/`, data);

export const deleteCalibrationPlanEntry = (entryId) =>
  api.delete(`/api/calibration/plan/${entryId}/`);

export const getCalibrationReport = (recordId) =>
  api.get(`/api/calibration/records/${recordId}/report/`, { responseType: 'blob' });
