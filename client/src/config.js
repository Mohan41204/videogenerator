/**
 * Centralized API Configuration for Video Generator Frontend.
 * Hardcoded to Production Google Cloud Run Backend.
 */

export const API_BASE_URL = 'https://video-generator-backend-891990564907.asia-south1.run.app';

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
