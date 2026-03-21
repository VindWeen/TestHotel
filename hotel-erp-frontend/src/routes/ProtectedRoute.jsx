// Kiểm tra JWT, redirect về /login nếu chưa đăng nhập
import { Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminAuthStore';

export default function ProtectedRoute({ children }) {
    const token = useAdminAuthStore((s) => s.token);

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return children;
}