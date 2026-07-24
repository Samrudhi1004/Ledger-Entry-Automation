import api from './axios';

export const getUsers = (params = {}) =>
  api.get('/api/users/', { params });

export const registerUser = (userData) =>
  api.post('/api/users/register/', userData);

export const deleteUser = (userId) =>
  api.delete(`/api/users/${userId}/`);

export const getPlants = () =>
  api.get('/api/machines/plants/');
