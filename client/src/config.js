 export const API_BASE_URL = 'https://videogenerator-backend-ws81.onrender.com';
//export const API_BASE_URL = 'http://localhost:5000';
export const getFullUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
