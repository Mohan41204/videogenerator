/**
 * Centralized API Configuration for Video Generator Frontend.
 * Priority:
 * 1. process.env.NEXT_PUBLIC_API_URL / import.meta.env.NEXT_PUBLIC_API_URL
 * 2. import.meta.env.VITE_API_URL
 * 3. Default fallback: Cloud Run backend URL
 */

const getApiBaseUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.NEXT_PUBLIC_API_URL) return import.meta.env.NEXT_PUBLIC_API_URL;
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  }
  return 'https://video-generator-backend-891990564907.asia-south1.run.app';
};

export const API_BASE_URL = getApiBaseUrl().replace(/\/+$/, '');

/**
 * Resolves a given path or URL.
 * If the path is already an absolute HTTP/HTTPS URL (such as GCS signed URLs:
 * https://storage.googleapis.com/... or https://storage.cloud.google.com/...),
 * it returns the URL directly. Otherwise, it prepends API_BASE_URL.
 */
export const getFullUrl = (path) => {
  if (!path) return '';
  if (typeof path !== 'string') return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
