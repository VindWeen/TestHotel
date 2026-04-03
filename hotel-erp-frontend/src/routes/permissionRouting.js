const normalizePermissionCode = (permission) => {
  if (typeof permission === "string") return permission;
  if (permission && typeof permission === "object") return permission.permissionCode;
  return null;
};

const getPermissionSet = (permissions = []) => {
  const codes = permissions
    .map(normalizePermissionCode)
    .filter(Boolean);
  return new Set(codes);
};

const hasPermission = (permissionSet, code) => {
  if (code === "VIEW_ROLES") {
    return permissionSet.has("VIEW_ROLES") || permissionSet.has("MANAGE_ROLES");
  }
  return permissionSet.has(code);
};

export function getDefaultAdminPath(role, permissions = []) {
  const permissionSet = getPermissionSet(permissions);

  if (hasPermission(permissionSet, "VIEW_DASHBOARD")) return "/admin/dashboard";

  // Housekeeping thường đi thẳng khu vực dọn phòng khi không có dashboard.
  if (role === "Housekeeping" && hasPermission(permissionSet, "MANAGE_ROOMS")) {
    return "/admin/housekeeping";
  }

  if (hasPermission(permissionSet, "MANAGE_ROOMS")) return "/admin/rooms";
  if (hasPermission(permissionSet, "MANAGE_INVENTORY")) return "/admin/items";
  if (hasPermission(permissionSet, "MANAGE_BOOKINGS")) return "/admin/bookings";
  if (hasPermission(permissionSet, "MANAGE_SERVICES")) return "/admin/services";
  if (hasPermission(permissionSet, "MANAGE_INVOICES")) return "/admin/invoices";
  if (hasPermission(permissionSet, "MANAGE_USERS")) return "/admin/staff";
  if (hasPermission(permissionSet, "VIEW_ROLES")) return "/admin/roles";

  return "/403";
}
