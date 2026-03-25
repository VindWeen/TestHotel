// src/api/permissionsApi.js
import axiosClient from './axios';

/**
 * GET /api/Permissions  [MANAGE_ROLES]
 * Trả về toàn bộ permissions có trong hệ thống
 * Response: { data: [{ id, name, permissionCode, moduleName }], total }
 */
export const getAllPermissions = () =>
    axiosClient.get('/Permissions');
