import axios from './axios';

// Parts API
export const getParts = (machineId) =>
  axios.get('/api/parts/', { params: machineId ? { machine: machineId } : {} });

export const getPartDetail = (partNumber) =>
  axios.get(`/api/parts/${encodeURIComponent(partNumber)}/`);

export const createPart = (partData) =>
  axios.post('/api/parts/', partData);

export const updatePart = (partNumber, partData) =>
  axios.put(`/api/parts/${encodeURIComponent(partNumber)}/`, partData);

export const deletePart = (partNumber) =>
  axios.delete(`/api/parts/${encodeURIComponent(partNumber)}/`);

// Inspection Templates API (Operations)
export const getPartTemplates = (partNumber, type) =>
  axios.get(`/api/parts/${encodeURIComponent(partNumber)}/templates/`, { params: type ? { type } : {} });

export const createTemplate = (partNumber, templateData) =>
  axios.post(`/api/parts/${encodeURIComponent(partNumber)}/templates/`, templateData);

export const updateTemplate = (templateId, templateData) =>
  axios.patch(`/api/parts/templates/${templateId}/`, templateData);

export const deleteTemplate = (templateId) =>
  axios.delete(`/api/parts/templates/${templateId}/`);

export const publishTemplate = (templateId) =>
  axios.post(`/api/parts/templates/${templateId}/publish/`);

export const getActiveTemplate = (partNumber, type) =>
  axios.get(`/api/parts/${encodeURIComponent(partNumber)}/template/${type}/`);

// Parameters API
export const getTemplateParameters = (templateId) =>
  axios.get(`/api/parts/templates/${templateId}/parameters/`);

export const createParameter = (templateId, paramData) =>
  axios.post(`/api/parts/templates/${templateId}/parameters/`, paramData);

export const updateParameter = (paramId, paramData) =>
  axios.put(`/api/parts/parameters/${paramId}/`, paramData);

export const deleteParameter = (paramId) =>
  axios.delete(`/api/parts/parameters/${paramId}/`);

// Process Parameters API (Setup Approval Only)
export const getProcessParameters = (templateId) =>
  axios.get(`/api/parts/templates/${templateId}/process-parameters/`);

export const createProcessParameter = (templateId, paramData) =>
  axios.post(`/api/parts/templates/${templateId}/process-parameters/`, paramData);

export const updateProcessParameter = (paramId, paramData) =>
  axios.put(`/api/parts/process-parameters/${paramId}/`, paramData);

export const deleteProcessParameter = (paramId) =>
  axios.delete(`/api/parts/process-parameters/${paramId}/`);

// Global Admin Endpoints
export const getAllParameters = () =>
  axios.get('/api/parts/parameters/all/');

export const getAllProcessParameters = () =>
  axios.get('/api/parts/process-parameters/all/');
