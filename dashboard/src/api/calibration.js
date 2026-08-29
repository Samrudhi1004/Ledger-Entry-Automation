import api from './axios';


export const getCalibrationEquipment = () =>
  api.get('/api/calibration/equipment/');

export const createCalibrationEquipment = (data) =>
  api.post('/api/calibration/equipment/', data);

export const updateCalibrationEquipment = (equipmentId, data) =>
  api.patch(`/api/calibration/equipment/${equipmentId}/`, data);

export const markCalibrationEquipmentFailed = (equipmentId, data) =>
  api.post(`/api/calibration/equipment/${equipmentId}/mark-failed/`, data);

export const markCalibrationEquipmentPassed = (equipmentId, data) =>
  api.post(`/api/calibration/equipment/${equipmentId}/mark-passed/`, data);

export const getCalibrationSummary = () =>
  api.get('/api/calibration/summary/');
