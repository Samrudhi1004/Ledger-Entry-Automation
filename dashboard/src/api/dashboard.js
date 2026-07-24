import api from './axios';

export const getLiveStatus = (plantId) =>
  api.get('/api/dashboard/live/', { params: { plant: plantId } });

export const getShiftSummary = (plantId, shift) =>
  api.get('/api/dashboard/shift-summary/', { params: { plant: plantId, shift } });
