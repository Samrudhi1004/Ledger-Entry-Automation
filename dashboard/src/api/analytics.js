import api from './axios';

export const getOOCTrend = (days = 7, plantId) =>
  api.get('/api/analytics/ooc-trend/', { params: { days, plant: plantId } });

export const getReport = (fromDate, toDate, machineCode) =>
  api.get('/api/analytics/report/', {
    params: { from: fromDate, to: toDate, machine: machineCode },
  });

export const getMachinePerformance = (machineId, days = 30) =>
  api.get(`/api/analytics/machine/${machineId}/performance/`, {
    params: { days },
  });

export const getOperatorStats = (operatorId, days = 30) =>
  api.get(`/api/analytics/operator/${operatorId}/stats/`, {
    params: { days },
  });

export const getParameterOOCRate = (partNumber) =>
  api.get('/api/analytics/parameters/ooc-rate/', {
    params: { part: partNumber },
  });
