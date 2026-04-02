// src/api/authApi.js
import axiosClient from './axios';

/**
 * POST /api/Auth/login
 * Body: { email, password }
 * Response: { token, refreshToken, expiresIn, userId, fullName, email, role, avatarUrl, permissions, notification }
 */
export const login = (email, password) =>
    axiosClient.post('/Auth/login', { email, password });

/**
 * POST /api/Auth/register
 * Body: { fullName, email, password, confirmPassword, phone }
 * Response: { message, token, refreshToken, userId, fullName, email, role, membership, permissions, notification }
 */
export const register = (data) =>
    axiosClient.post('/Auth/register', data);

/**
 * POST /api/Auth/refresh-token
 * Body: { refreshToken }
 * Response: { token, refreshToken, expiresIn }
 */
export const refreshToken = (refreshToken) =>
    axiosClient.post('/Auth/refresh-token', { refreshToken });

/**
 * POST /api/Auth/logout  [Authorize]
 * Response: { message }
 */
export const logout = () =>
    axiosClient.post('/Auth/logout');

/**
 * POST /api/Auth/forgot-password
 * Body: { email }
 * Response: { message }
 */
export const forgotPassword = (email) =>
    axiosClient.post('/Auth/forgot-password', { email });
