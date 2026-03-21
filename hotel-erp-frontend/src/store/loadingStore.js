// isLoading + setLoading()
// src/store/loadingStore.js
import { create } from 'zustand';

// ─── Loading Store ────────────────────────────────────────────────────────────
// Mục đích: Axios Interceptor bật/tắt isLoading để AdminLayout
//           hiện/ẩn Spin Overlay toàn màn hình khi gọi API.
//
// Cách dùng trong component:
//   const isLoading = useLoadingStore((state) => state.isLoading);
//
// Cách dùng ngoài component (Interceptor):
//   useLoadingStore.getState().setLoading(true);

export const useLoadingStore = create((set) => ({
    // Trạng thái ban đầu: không loading
    isLoading: false,

    // Action bật/tắt loading
    setLoading: (bool) => set({ isLoading: bool }),
}));