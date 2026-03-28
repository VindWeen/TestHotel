// src/api/rolesApi.js
import axiosClient from "./axios";

/**
 * GET /api/Roles  [Authorize]
 * Danh sách tất cả roles — dùng để populate dropdown chọn role
 * Response: { data: [{ id, name, description }], total }
 */
export const getRoles = () => axiosClient.get("/Roles");

/**
 * GET /api/Roles/{id}  [VIEW_ROLES]
 * Chi tiết 1 role kèm danh sách permissions đang được gán
 * Response: { id, name, description, permissions: [{ id, name, permissionCode }] }
 */
export const getRoleById = (id) => axiosClient.get(`/Roles/${id}`);

/**
 * POST /api/Roles/assign-permission  [EDIT_ROLES]
 * Body: { roleId, permissionId, grant: true = gán / false = thu hồi }
 * Response: { message }
 */
export const assignPermission = (roleId, permissionId, grant) =>
  axiosClient.post("/Roles/assign-permission", { roleId, permissionId, grant });

/**
 * GET /api/Roles/my-permissions  [Authorize]
 * Permissions của user hiện tại — dùng để ẩn/hiện menu
 * Response: { permissions: [{ permissionCode, name }] }
 */
export const getMyPermissions = () => axiosClient.get("/Roles/my-permissions");
