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
