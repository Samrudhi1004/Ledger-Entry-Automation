/**
 * Document Control API wrapper.
 * Mirrors the pattern used in other api/ files in this project.
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

// ── Categories ─────────────────────────────────────────────────────────────
export const getCategories   = ()     => api.get('/categories/');
export const createCategory  = (data) => api.post('/categories/', data);
export const updateCategory  = (id, data) => api.patch(`/categories/${id}/`, data);
export const deleteCategory  = (id)   => api.delete(`/categories/${id}/`);

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
