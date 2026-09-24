import api from './axios';

export const getUsers = (params = {}) =>
  api.get('/api/users/', { params });

export const registerUser = (userData) =>
  api.post('/api/users/register/', userData);

export const deleteUser = (userId) =>
  api.delete(`/api/users/${userId}/`);

export const updateUserStatus = (userId, is_active) =>
  api.patch(`/api/users/${userId}/`, { is_active });

export const updateUserShift = (userId, assigned_shift) =>
  api.patch(`/api/users/${userId}/`, { assigned_shift });

export const getPlants = () =>
  api.get('/api/machines/plants/');

export const getAccessCatalog = () => api.get('/api/users/access/catalog/');
export const getRoles = () => api.get('/api/users/access/roles/');
export const createRole = (data) => api.post('/api/users/access/roles/', data);
export const updateRole = (slug, data) => api.patch(`/api/users/access/roles/${slug}/`, data);
export const deleteRole = (slug) => api.delete(`/api/users/access/roles/${slug}/`);
export const getUserAccess = (id) => api.get(`/api/users/${id}/access/`);
export const updateUserAccess = (id, data) => api.put(`/api/users/${id}/access/`, data);
export const getAccessEvents = (params = {}) => api.get('/api/users/access/events/', { params });
