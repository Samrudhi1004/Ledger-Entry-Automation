/**
 * Document Control API wrapper.
 * Provides endpoints for Categories, Documents (L1-L4), DCR Workflow (DKI/MR/F/05), and Notifications.
 */

import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: `${BASE}/api/document-control` });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


// ── Documents ──────────────────────────────────────────────────────────────
export const getDocuments = (params = {}) => api.get('/documents/', { params });

export const getDocumentById = (id) => api.get(`/documents/${id}/`);

export const uploadDocument = (formData) =>
  api.post('/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const submitForReview = (id, comment = '') =>
  api.post(`/documents/${id}/submit_review/`, { comment });

export const approveDocument = (id, comment = '') =>
  api.post(`/documents/${id}/approve/`, { comment });

export const rejectDocument = (id, comment) =>
  api.post(`/documents/${id}/reject/`, { comment });

export const reviseDocument = (id, formData) =>
  api.post(`/documents/${id}/revise/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getDocumentHistory = (id) => api.get(`/documents/${id}/history/`);

export const getDownloadUrl = (id) =>
  `${BASE}/api/document-control/documents/${id}/download/`;

export const markObsolete = (id, comment = '') =>
  api.post(`/documents/${id}/obsolete/`, { comment });

// ── Document Change Requests (Form DKI/MR/F/05) ────────────────────────────
export const getDCRs = (params = {}) => api.get('/change-requests/', { params });

export const getDCRById = (id) => api.get(`/change-requests/${id}/`);

export const submitDCR = (data) => api.post('/change-requests/', data);

export const submitDCRReview = (id, data) =>
  api.post(`/change-requests/${id}/submit-review/`, data);

export const rejectDCRReview = (id, data) =>
  api.post(`/change-requests/${id}/reject-review/`, data);

export const approveDCR = (id, data = {}) =>
  api.post(`/change-requests/${id}/approve/`, data);

export const rejectDCRApproval = (id, data) =>
  api.post(`/change-requests/${id}/reject-approval/`, data);

export const getDCRPDFUrl = (id) =>
  `${BASE}/api/document-control/change-requests/${id}/pdf/`;

export const getAssignableUsers = () =>
  api.get('/change-requests/assignable-users/');

// ── Realtime DCR Notifications ─────────────────────────────────────────────
export const getNotifications = () =>
  api.get('/notifications/');

export const getUnreadNotificationCount = () =>
  api.get('/notifications/unread-count/');

export const markNotificationRead = (id) =>
  api.post(`/notifications/${id}/mark-read/`);

export const markAllNotificationsRead = () =>
  api.post('/notifications/mark-all-read/');
