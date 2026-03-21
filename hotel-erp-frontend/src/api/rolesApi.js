// src/api/rolesApi.js
import axiosClient from './axios';

/**
 * POST /api/Roles/assign-permission  [MANAGE_ROLES]
 * Body: { roleId, permissionId, grant: true = gán / false = thu hồi }
 * Response: { message }
 */
export const assignPermission = (roleId, permissionId, grant) =>
    axiosClient.post('/Roles/assign-permission', { roleId, permissionId, grant });

/**
 * GET /api/Roles/my-permissions  [Authorize]
 * Response: { permissions: [{ permissionCode, name, moduleName }] }
 */
export const getMyPermissions = () =>
    axiosClient.get('/Roles/my-permissions');
