// token, user, permissions + setAuth(), clearAuth()
// src/store/adminAuthStore.js
import { create } from 'zustand';

// ─── Helper: Đọc initial state từ localStorage ────────────────────────────────
// Khi user reload trang, Zustand store bị reset về default.
// → Cần khôi phục từ localStorage để user không bị logout.
const getInitialState = () => {
    try {
        return {
            token: localStorage.getItem('token') || null,
            user: JSON.parse(localStorage.getItem('user') || 'null'),
            permissions: JSON.parse(localStorage.getItem('permissions') || '[]'),
        };
    } catch {
        // Nếu JSON.parse lỗi (data bị corrupt) → reset sạch
        return { token: null, user: null, permissions: [] };
    }
};

// ─── Admin Auth Store ─────────────────────────────────────────────────────────
// Là "nguồn sự thật" (single source of truth) về trạng thái đăng nhập.
//
// Cách dùng trong component:
//   const { token, user, permissions } = useAdminAuthStore();
//   const setAuth = useAdminAuthStore((state) => state.setAuth);
//
// Cách dùng ngoài component (Interceptor):
//   useAdminAuthStore.getState().clearAuth();

export const useAdminAuthStore = create((set) => ({
    // ── State ──────────────────────────────────────────────────────────────────
    ...getInitialState(),

    // ── Actions ────────────────────────────────────────────────────────────────

    // setAuth: gọi sau khi login thành công
    // Nhận toàn bộ response từ POST /api/Auth/login
    setAuth: ({ token, user, permissions, role, fullName, email, avatarUrl }) => {
        // Chuẩn hóa object user từ response backend
        const userData = user || {
            id: null,
            fullName: fullName || '',
            email: email || '',
            role: role || '',
            avatarUrl: avatarUrl || null,
        };

        // Lưu vào Zustand store (reactive — component tự update)
        set({
            token,
            user: userData,
            permissions: permissions || [],
        });

        // Lưu vào localStorage (persist — tồn tại qua reload)
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('permissions', JSON.stringify(permissions || []));
    },

    // clearAuth: gọi khi logout hoặc token hết hạn (401)
    clearAuth: () => {
        // Xóa Zustand store
        set({ token: null, user: null, permissions: [] });

        // Xóa localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
    },

    // hasPermission: kiểm tra quyền cụ thể (dùng trong RequirePermission)
    // Ví dụ: useAdminAuthStore.getState().hasPermission('MANAGE_USERS')
    hasPermission: (permissionCode) => {
        const { permissions } = useAdminAuthStore.getState();
        // permissions là mảng object { permissionCode, name, moduleName }
        // hoặc mảng string tùy response backend
        return permissions.some(
            (p) =>
                (typeof p === 'string' && p === permissionCode) ||
                (typeof p === 'object' && p.permissionCode === permissionCode)
        );
    },
}));