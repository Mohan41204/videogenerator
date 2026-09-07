/**
 * Centralized API Configuration for Video Generator Frontend.
 */

const getApiBaseUrl = () => {
  const viteUrl = import.meta.env.VITE_API_URL;
  const legacyUrl = import.meta.env.NEXT_PUBLIC_API_URL;

  return (
    viteUrl ||
    legacyUrl ||
    'https://video-generator-backend-891990564907.asia-south1.run.app'
  );
};

export const API_BASE_URL = getApiBaseUrl().replace(/\/+$/, '');

export const getFullUrl = (path) => {
  if (!path) return '';
  if (typeof path !== 'string') return path;

  if (
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
