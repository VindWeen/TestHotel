// getRoles(), getPermissions(), assignPermissions()
import axiosClient from "./axios";

export const getRoles = () => axiosClient.get("/Roles");

export const getMyPermissions = () => axiosClient.get("/Roles/my-permissions");

export const assignPermission = (roleId, permissionId, grant) =>
  axiosClient.post("/Roles/assign-permission", { roleId, permissionId, grant });
