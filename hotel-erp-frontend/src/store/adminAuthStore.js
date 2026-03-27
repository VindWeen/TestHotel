// token, user, permissions + setAuth(), clearAuth()
// src/store/adminAuthStore.js
import { create } from 'zustand';

// ─── Helper: Đọc initial state từ localStorage ────────────────────────────────
// Khi user reload trang, Zustand store bị reset về default.
// → Cần khôi phục từ localStorage để user không bị logout.
const getInitialState = () => {
    try {
        // Ưu tiên đọc từ sessionStorage (nếu người dùng không check Remember me),
        // sau đó mới đọc từ localStorage (nếu có check)
        const token = sessionStorage.getItem('token') || localStorage.getItem('token') || null;
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || 'null';
        const permissionsStr = sessionStorage.getItem('permissions') || localStorage.getItem('permissions') || '[]';

        return {
            token,
            user: JSON.parse(userStr),
            permissions: JSON.parse(permissionsStr),
        };
    } catch {
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
    // Nhận toàn bộ response từ POST /api/Auth/login và cờ rememberMe
    setAuth: ({ token, user, permissions, role, fullName, email, avatarUrl, rememberMe = false }) => {
        const userData = user || {
            id: null,
            fullName: fullName || '',
            email: email || '',
            role: role || '',
            avatarUrl: avatarUrl || null,
        };

        set({
            token,
            user: userData,
            permissions: permissions || [],
        });

        const storage = rememberMe ? localStorage : sessionStorage;
        const otherStorage = rememberMe ? sessionStorage : localStorage;

        // Xóa data ở storage không dùng tới để tránh xung đột
        otherStorage.removeItem('token');
        otherStorage.removeItem('user');
        otherStorage.removeItem('permissions');

        // Lưu vào storage được chọn
        storage.setItem('token', token);
        storage.setItem('user', JSON.stringify(userData));
        storage.setItem('permissions', JSON.stringify(permissions || []));
    },

    // clearAuth: gọi khi logout hoặc token hết hạn (401)
    clearAuth: () => {
        set({ token: null, user: null, permissions: [] });

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');

        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('permissions');
    },

    // hasPermission: kiểm tra quyền cụ thể (dùng trong RequirePermission)
    hasPermission: (permissionCode) => {
        const { permissions } = useAdminAuthStore.getState();
        return permissions.some(
            (p) =>
                (typeof p === 'string' && p === permissionCode) ||
                (typeof p === 'object' && p.permissionCode === permissionCode)
        );
    },

    // updateUser: gọi sau khi lấy được getMyProfile() để cập nhật avatar, v.v.
    updateUser: (updatedData) => {
        const { user: currentUser } = useAdminAuthStore.getState();
        const newUser = { ...currentUser, ...updatedData };
        
        set({ user: newUser });
        
        // Cập nhật vào storage đang chứa session
        if (sessionStorage.getItem('token')) {
            sessionStorage.setItem('user', JSON.stringify(newUser));
        } else if (localStorage.getItem('token')) {
            localStorage.setItem('user', JSON.stringify(newUser));
        }
    },
}));