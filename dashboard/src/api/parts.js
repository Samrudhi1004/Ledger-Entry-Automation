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

export const submitTemplateReview = (templateId, data) =>
  axios.post(`/api/parts/templates/${templateId}/submit-review/`, data);

export const reviewTemplateAction = (templateId, data) =>
  axios.post(`/api/parts/templates/${templateId}/review/`, data);

export const approveTemplateAction = (templateId, data) =>
  axios.post(`/api/parts/templates/${templateId}/approve/`, data);

// Document Change Request (DCR) API for Master Parameters (Form DKI/MR/F/05)
export const getTemplateDCRs = (templateId) =>
  axios.get(`/api/parts/templates/${templateId}/change-requests/`);

export const submitTemplateDCR = (templateId, dcrData) =>
  axios.post(`/api/parts/templates/${templateId}/change-requests/`, dcrData);

export const reviewTemplateDCR = (dcrId, data) =>
  axios.post(`/api/parts/change-requests/${dcrId}/review/`, data);

export const approveTemplateDCR = (dcrId, data) =>
  axios.post(`/api/parts/change-requests/${dcrId}/approve/`, data);

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
export const getAllParameters = (config = {}) =>
  axios.get('/api/parts/parameters/all/', config);

export const getAllProcessParameters = (config = {}) =>
  axios.get('/api/parts/process-parameters/all/', config);

// Engineering Drawings API (Supervisors & Admins)
export const getDrawings = () =>
  axios.get('/api/parts/drawings/');

export const createDrawing = (formData) =>
  axios.post('/api/parts/drawings/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const uploadDrawingVersion = (drawingId, formData) =>
  axios.post(`/api/parts/drawings/${drawingId}/upload_version/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const submitDrawingReview = (drawingId, data) =>
  axios.post(`/api/parts/drawings/${drawingId}/submit-review/`, data);

export const reviewDrawingAction = (drawingId, data) =>
  axios.post(`/api/parts/drawings/${drawingId}/review/`, data);

export const approveDrawingAction = (drawingId, data) =>
  axios.post(`/api/parts/drawings/${drawingId}/approve/`, data);

export const getDrawingHistory = (drawingId) =>
  axios.get(`/api/parts/drawings/${drawingId}/history/`);

export const deleteDrawing = (drawingId) =>
  axios.delete(`/api/parts/drawings/${drawingId}/`);

// Control Plans API (Supervisors & Admins)
export const getControlPlans = () =>
  axios.get('/api/parts/control-plans/');

export const createControlPlan = (formData) =>
  axios.post('/api/parts/control-plans/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const uploadControlPlanVersion = (controlPlanId, formData) =>
  axios.post(`/api/parts/control-plans/${controlPlanId}/upload_version/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const submitControlPlanReview = (controlPlanId, data) =>
  axios.post(`/api/parts/control-plans/${controlPlanId}/submit-review/`, data);

export const reviewControlPlanAction = (controlPlanId, data) =>
  axios.post(`/api/parts/control-plans/${controlPlanId}/review/`, data);

export const approveControlPlanAction = (controlPlanId, data) =>
  axios.post(`/api/parts/control-plans/${controlPlanId}/approve/`, data);

export const getControlPlanHistory = (controlPlanId) =>
  axios.get(`/api/parts/control-plans/${controlPlanId}/history/`);

export const deleteControlPlan = (controlPlanId) =>
  axios.delete(`/api/parts/control-plans/${controlPlanId}/`);


