// PublicOnlyRoute.jsx
// Ngược với ProtectedRoute: nếu đã có token → redirect về trang mặc định của role đó.
// Nếu chưa đăng nhập → render children bình thường (vd: trang Login).
//
// Cách thêm role mới về sau:
//   Chỉ cần thêm 1 dòng vào ROLE_DEFAULT_PATH bên dưới.
import { Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminAuthStore';

// ─── Bản đồ role → trang mặc định sau khi đăng nhập ──────────────────────────
// Mở rộng map này khi thêm role/frontend mới (vd: Guest → '/booking', v.v.)
export const ROLE_DEFAULT_PATH = {
    Admin:         '/admin/dashboard',
    Manager:       '/admin/dashboard',
    Receptionist:  '/admin/dashboard',
    Accountant:    '/admin/dashboard',
    Housekeeping:  '/admin/dashboard',
    Security:      '/admin/dashboard',
    Chef:          '/admin/dashboard',
    Waiter:        '/admin/dashboard',
    'IT Support':  '/admin/dashboard',
    Guest:         '/',  // placeholder — đổi thành route trang khách sau này
};

const DEFAULT_FALLBACK = '/admin/dashboard';

export default function PublicOnlyRoute({ children }) {
    const token = useAdminAuthStore((s) => s.token);
    const role  = useAdminAuthStore((s) => s.user?.role);

    if (token) {
        const redirectTo = ROLE_DEFAULT_PATH[role] ?? DEFAULT_FALLBACK;
        return <Navigate to={redirectTo} replace />;
    }

    return children;
}
