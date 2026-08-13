import api from './axios';

export const getLiveStatus = (plantId) =>
  api.get('/api/dashboard/live/', plantId ? { params: { plant: plantId } } : {});

export const getShiftSummary = (plantId, shift) =>
  api.get('/api/dashboard/shift-summary/', { params: { ...(plantId ? { plant: plantId } : {}), shift } });
