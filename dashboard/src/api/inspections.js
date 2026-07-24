import api from './axios';

export const getPendingSessions = (plantId) =>
  api.get('/api/inspections/pending/', plantId ? { params: { plant: plantId } } : {});

export const getSessionDetail = (sessionId) =>
  api.get(`/api/inspections/${sessionId}/`);

export const getSessions = (params = {}) =>
  api.get('/api/inspections/', { params });

export const reviewSession = (sessionId, action, remark = '', rejectedParameters = []) =>
  api.post(`/api/inspections/${sessionId}/review/`, {
    action,
    remark,
    rejected_parameters: rejectedParameters,
  });

export const supervisorOverride = (sessionId, parameterCode, value, remark = '') =>
  api.post(`/api/inspections/${sessionId}/supervisor-override/`, {
    parameter_code: parameterCode,
    measured_value: value,
    remark,
  });
