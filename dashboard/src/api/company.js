import api from './axios';

// Get list of factories (Company details)
export const getCompanyDetails = async () => {
  const res = await api.get('/api/machines/factories/');
  return res;
};

// Update primary factory/company details
export const updateCompanyDetails = async (id, data) => {
  const res = await api.patch(`/api/machines/factories/${id}/`, data);
  return res;
};

// Get connected plants overview
export const getCompanyPlants = async () => {
  const res = await api.get('/api/machines/plants/');
  return res;
};
