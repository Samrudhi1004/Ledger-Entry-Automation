import api from './axios';

export const login = (username, password) =>
  api.post('/api/users/login/', { username, password });

export const logout = (refresh) =>
  api.post('/api/users/logout/', { refresh });

export const getProfile = () =>
  api.get('/api/users/me/');

export const updateProfile = (data) =>
  api.patch('/api/users/me/', data);

export const uploadProfilePhoto = (file) => {
  const formData = new FormData();
  formData.append('photo', file);
  return api.post('/api/users/me/photo/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const changePassword = (data) =>
  api.post('/api/users/change-password/', data);

export const requestEmailVerification = () =>
  api.post('/api/users/verify-email/request/');

export const verifyEmail = (token) =>
  api.post('/api/users/verify-email/confirm/', { token });
