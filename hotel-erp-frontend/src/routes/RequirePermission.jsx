// Kiểm tra permission cụ thể, chặn nếu không đủ quyền
import { Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminAuthStore';

export default function RequirePermission({ permission, children }) {
    const permissions = useAdminAuthStore((s) => s.permissions);
    const wanted = new Set([permission]);

    if (permission === "VIEW_ROLES" || permission === "EDIT_ROLES") {
        wanted.add("MANAGE_ROLES");
    }

    const hasPermission = permissions.some(
        (p) =>
            (typeof p === 'string' && wanted.has(p)) ||
            (typeof p === 'object' && wanted.has(p.permissionCode))
    );

    if (!hasPermission) {
        return <Navigate to="/403" replace />;
    }

    return children;
}
