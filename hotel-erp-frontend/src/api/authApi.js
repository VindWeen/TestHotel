// login(), register(), logout()
// src/api/authApi.js
import axiosClient from './axios';

// POST /api/Auth/login
// Body: { email, password }
// Response: { token, refreshToken, userId, fullName, email, role, avatarUrl, permissions }
export const login = (email, password) =>
    axiosClient.post('/Auth/login', { email, password });

// POST /api/Auth/logout  (cần Bearer token → Interceptor tự gắn)
export const logout = () =>
    axiosClient.post('/Auth/logout');