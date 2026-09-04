export const API_BASE_URL = 'https://videogenerator-5hfk.onrender.com';

export const getFullUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
