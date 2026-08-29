import os

api_path = 'dashboard/src/api/parts.js'
with open(api_path, 'a', encoding='utf-8') as f:
    f.write('''
// Global Admin Endpoints
export const getAllParameters = () =>
  axios.get('/api/parts/parameters/all/');

export const getAllProcessParameters = () =>
  axios.get('/api/parts/process-parameters/all/');
''')
print("Added global endpoints to frontend API.")
