// Kiểm tra permission cụ thể, chặn nếu không đủ quyền
import { Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminAuthStore';

export default function RequirePermission({ permission, children }) {
    const permissions = useAdminAuthStore((s) => s.permissions);

    const hasPermission = permissions.some(
        (p) =>
            (typeof p === 'string' && p === permission) ||
            (typeof p === 'object' && p.permissionCode === permission)
    );

    if (!hasPermission) {
        return <Navigate to="/403" replace />;
    }

    return children;
}
