// Axios instance + Request/Response Interceptor
// src/api/axios.js
import axios from 'axios';

// ─── Tạo Axios Instance toàn cục ─────────────────────────────────────────────
// baseURL đọc từ .env → VITE_API_URL=http://localhost:5279/api
const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Chạy trước mỗi request:
//   1. Gắn JWT Token vào Header "Authorization: Bearer ..."
//   2. Bật loading spinner toàn màn hình
axiosClient.interceptors.request.use(
    (config) => {
        // Lấy token từ sessionStorage hoặc localStorage
        // Zustand store không thể gọi hook ở đây → đọc Storage trực tiếp
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Bật spinner — dùng .getState() vì đây không phải React component
        // import lazy để tránh circular dependency (loadingStore import axios)
        import('../store/loadingStore').then(({ useLoadingStore }) => {
            useLoadingStore.getState().setLoading(true);
        });

        return config;
    },
    (error) => {
        // Lỗi ngay lúc gửi request (network config error)
        import('../store/loadingStore').then(({ useLoadingStore }) => {
            useLoadingStore.getState().setLoading(false);
        });
        return Promise.reject(error);
    }
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Chạy sau mỗi response:
//   - Success: tắt loading, trả về response
//   - Error: tắt loading, xử lý 401 / 403 tập trung
axiosClient.interceptors.response.use(
    (response) => {
        // Request thành công → tắt spinner
        import('../store/loadingStore').then(({ useLoadingStore }) => {
            useLoadingStore.getState().setLoading(false);
        });
        return response;
    },
    async (error) => {
        // Bất kỳ lỗi nào → tắt spinner trước
        import('../store/loadingStore').then(({ useLoadingStore }) => {
            useLoadingStore.getState().setLoading(false);
        });

        const status = error.response?.status;

        if (status === 401) {
            // Token hết hạn hoặc không hợp lệ
            // → Xóa hết auth data, chuyển về /login
            import('../store/adminAuthStore').then(({ useAdminAuthStore }) => {
                useAdminAuthStore.getState().clearAuth();
            });
            // Chuyển hướng về login (không dùng useNavigate vì ngoài component)
            window.location.href = '/login';
        }

        if (status === 403) {
            // Đã đăng nhập nhưng không đủ quyền → KHÔNG logout
            // Chỉ hiện thông báo, để component tự xử lý nếu cần
            console.warn('[Axios] 403 Forbidden — Không đủ quyền thực hiện thao tác này.');
            // Notification sẽ được show ở component hoặc qua error.response.status
        }

        return Promise.reject(error);
    }
);

export default axiosClient;