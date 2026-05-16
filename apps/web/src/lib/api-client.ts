'use client';

import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── Request interceptor — inject auth token ──────────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('veritas-auth');
      if (raw) {
        const state = JSON.parse(raw) as { state?: { accessToken?: string } };
        const token = state?.state?.accessToken;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch { /* sessionStorage not available */ }
  }
  return config;
});

// ─── Response interceptor — handle 401 ────────────────────────────
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const raw = typeof window !== 'undefined'
          ? sessionStorage.getItem('veritas-auth') : null;
        const state = raw
          ? (JSON.parse(raw) as { state?: { refreshToken?: string } }) : null;
        const refreshToken = state?.state?.refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newAccess = (res.data as { data: { accessToken: string } }).data.accessToken;

        if (typeof window !== 'undefined') {
          const current = JSON.parse(sessionStorage.getItem('veritas-auth') ?? '{}') as {
            state?: Record<string, unknown>;
          };
          if (current.state) {
            current.state.accessToken = newAccess;
            sessionStorage.setItem('veritas-auth', JSON.stringify(current));
          }
        }

        originalRequest.headers!.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      } catch {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('veritas-auth');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(
      (error.response?.data as { error?: unknown })?.error ?? error.message,
    );
  },
);

export default apiClient;
