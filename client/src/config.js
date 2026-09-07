/**
 * Centralized API Configuration for Video Generator Frontend.
 * Hardcoded to Cloud Run backend URL for direct production connection.
 */

export const API_BASE_URL = 'https://video-generator-backend-891990564907.asia-south1.run.app';

/**
 * Resolves a given path or URL.
 * If the path is already an absolute HTTP/HTTPS URL (such as a GCS signed URL),
 * it returns the URL directly. Otherwise, it prepends API_BASE_URL.
 */
export const getFullUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
