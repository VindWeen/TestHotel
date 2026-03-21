// src/api/userManagementApi.js
import axiosClient from './axios';
import { buildQueryString } from '../utils';

/**
 * GET /api/UserManagement?roleId=&page=&pageSize=  [MANAGE_USERS]
 * Response: { data, pagination, notification }
 */
export const getUsers = (params = {}) => {
    const query = buildQueryString(params);
    return axiosClient.get(`/UserManagement?${query}`);
};

/**
 * GET /api/UserManagement/{id}  [MANAGE_USERS]
 * Response: user object with role and membership info
 */
export const getUserById = (id) =>
    axiosClient.get(`/UserManagement/${id}`);

/**
 * POST /api/UserManagement  [MANAGE_USERS]
 * Body: { fullName, email, password, phone, dateOfBirth, gender, address, nationalId, roleId }
 * Response: { message, userId, notification }
 */
export const createUser = (data) =>
    axiosClient.post('/UserManagement', data);

/**
 * PUT /api/UserManagement/{id}  [MANAGE_USERS]
 * Body: { fullName, phone, dateOfBirth, gender, address, nationalId }
 * Response: { notification }
 */
export const updateUser = (id, data) =>
    axiosClient.put(`/UserManagement/${id}`, data);

/**
 * DELETE /api/UserManagement/{id}  [MANAGE_USERS]
 * Locks (soft-delete) the account — sets status = false
 * Response: { notification }
 */
export const lockUser = (id) =>
    axiosClient.delete(`/UserManagement/${id}`);

/**
 * PUT /api/UserManagement/{id}/change-role  [MANAGE_USERS + MANAGE_ROLES]
 * Body: { newRoleId }
 * Response: { oldRoleId, newRoleId, newRoleName, notification }
 */
export const changeRole = (id, newRoleId) =>
    axiosClient.put(`/UserManagement/${id}/change-role`, { newRoleId });

/**
 * PATCH /api/UserManagement/{id}/toggle-status  [MANAGE_USERS]
 * Response: { notification, userId, status }
 */
export const toggleStatus = (id) =>
    axiosClient.patch(`/UserManagement/${id}/toggle-status`);
