import api from './axios';

export const login = (username, password) =>
  api.post('/api/users/login/', { username, password });

export const logout = (refresh) =>
  api.post('/api/users/logout/', { refresh });

export const getProfile = () =>
  api.get('/api/users/me/');
