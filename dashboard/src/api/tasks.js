import api from './axios';

export const getTasks = () => api.get('/api/tasks/');
export const createTask = (data) => api.post('/api/tasks/', data);
export const acceptTask = (taskId) => api.post(`/api/tasks/${taskId}/accept/`);
export const completeTask = (taskId) => api.post(`/api/tasks/${taskId}/complete/`);
export const flagIssue = (taskId, issueDescription) => api.post(`/api/tasks/${taskId}/flag_issue/`, { issue_description: issueDescription });
export const resolveIssue = (taskId, data = {}) => api.post(`/api/tasks/${taskId}/resolve_issue/`, data);
