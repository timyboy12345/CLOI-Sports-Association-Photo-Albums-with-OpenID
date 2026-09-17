import axios from 'axios';

const API_URL = import.meta.env.VITE_SERVER_URL || '';
const API_BASE = API_URL ? `${API_URL}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export const getUploadsUrl = (path: string, type: 'thumb' | 'original' | 'webp' = 'thumb') => {
  if (!path) return '';
  if (type === 'webp') path = path.replace(/\.(jpg|jpeg|png)$/i, '.compressed.webp');
  if (type === 'thumb') path = path.replace(/\.(jpg|jpeg|png)$/i, '.thumb.webp');

  return API_URL ? `${API_URL}/api/uploads/${path}` : `/api/uploads/${path}`;
};

export default api;
