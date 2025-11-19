import axios, { AxiosError } from 'axios';
import { getErrorMessage } from './errors';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally - transform error responses to have a consistent format
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Normalize error response format
    if (error.response?.data) {
      const data = error.response.data as any;
      if (data.detail) {
        // If detail is an object or array, convert to string
        if (typeof data.detail !== 'string') {
          data.detail = getErrorMessage(error);
        }
      } else {
        // If no detail, add a generic one
        data.detail = getErrorMessage(error);
      }
    }
    return Promise.reject(error);
  }
);

export interface Session {
  id: number;
  tenant_id: number;
  user_id: number;
  title: string | null;
  status: string;
  created_at: string;
}

export interface Step {
  id: number;
  session_id: number | null;
  guide_id: number | null;
  index: number;
  title: string | null;
  description: string | null;
  screenshot_key: string | null;
  screenshot_url?: string | null;
  action_type: string | null;
  action_context: any;
  created_at: string;
}

export interface Guide {
  id: number;
  tenant_id: number;
  owner_id: number;
  session_id: number | null;
  title: string;
  description: string | null;
  content: any;
  status: string;
  share_token: string | null;
  created_at: string;
  updated_at: string | null;
  steps: Step[];
}

export interface Annotation {
  id: number;
  guide_id: number;
  step_id: number | null;
  type: string;
  data: any;
  created_at: string;
}

export const apiClient = {
  // Auth
  async login(email: string, password: string) {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);
    
    const response = await api.post('/v1/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },

  async register(email: string, password: string, fullName?: string) {
    const response = await api.post('/v1/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  },

  async getMe() {
    const response = await api.get('/v1/auth/me');
    return response.data;
  },

  // Admin endpoints
  async listAllUsers() {
    const response = await api.get('/admin/users');
    return response.data;
  },

  async createUser(userData: {
    email: string;
    password: string;
    full_name?: string;
    is_admin?: boolean;
  }) {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },

  async updateUser(userId: number, updates: {
    email?: string;
    password?: string;
    full_name?: string;
    is_active?: boolean;
    is_admin?: boolean;
  }) {
    const response = await api.patch(`/admin/users/${userId}`, updates);
    return response.data;
  },

  async deleteUser(userId: number) {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  // Sessions
  async createSession(title?: string) {
    const response = await api.post('/v1/sessions', { title });
    return response.data;
  },

  async getSession(sessionId: number) {
    const response = await api.get(`/v1/sessions/${sessionId}`);
    return response.data;
  },

  // Uploads
  async getPresignedUrl(filename: string, contentType: string = 'image/png') {
    const response = await api.post('/v1/uploads', null, {
      params: { filename, content_type: contentType },
    });
    return response.data;
  },

  // Steps
  async createStep(stepData: {
    session_id: number;
    index: number;
    title?: string;
    description?: string;
    screenshot_key: string;
    action_type?: string;
    action_context?: any;
  }) {
    const response = await api.post('/v1/steps', stepData);
    return response.data;
  },

  // Guides
  async listGuides() {
    const response = await api.get('/v1/guides');
    return response.data;
  },

  async getGuide(guideId: number) {
    const response = await api.get(`/v1/guides/${guideId}`);
    return response.data;
  },

  async updateGuide(guideId: number, updates: {
    title?: string;
    description?: string;
    content?: any;
    status?: string;
  }) {
    const response = await api.patch(`/v1/guides/${guideId}`, updates);
    return response.data;
  },

  async completeSession(sessionId: number) {
    const response = await api.post(`/v1/sessions/${sessionId}/complete`);
    return response.data;
  },

  // Annotations
  async createAnnotation(annotationData: {
    guide_id: number;
    step_id?: number;
    type: string;
    data: any;
  }) {
    const response = await api.post('/v1/annotations', annotationData);
    return response.data;
  },

  async getAnnotations(guideId: number) {
    const response = await api.get(`/v1/guides/${guideId}/annotations`);
    return response.data;
  },

  async deleteAnnotation(annotationId: number) {
    const response = await api.delete(`/v1/annotations/${annotationId}`);
    return response.data;
  },

  // Exports
  async requestExport(guideId: number, format: string = 'pdf') {
    const response = await api.post('/v1/exports/pdf', { guide_id: guideId, format });
    return response.data;
  },

  async getExportStatus(jobId: number) {
    const response = await api.get(`/v1/exports/${jobId}`);
    return response.data;
  },
};

export default api;


