import { create } from 'zustand';

export const useNotificationStore = create((set) => ({
    notifications: [],
    unreadCount: 0,

    // Add a new notification
    addNotification: (notification) => set((state) => {
        // Tránh bị trùng lặp notification nếu backend gửi 2 lần (có thể dựa vào id)
        const isDuplicate = state.notifications.some(n => n.id === notification.id);
        if (isDuplicate) return state;

        return {
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1
        };
    }),

    // Set initial notifications (e.g., from an API later if needed)
    setNotifications: (notifications) => set({
        notifications,
        unreadCount: notifications.filter(n => !n.isRead).length
    }),

    // Mark a specific notification as read
    markAsRead: (id) => set((state) => {
        let readStatusChanged = false;
        const updatedNotifications = state.notifications.map(n => {
            if (n.id === id && !n.isRead) {
                readStatusChanged = true;
                return { ...n, isRead: true };
            }
            return n;
        });

        if (!readStatusChanged) return state;

        return {
            notifications: updatedNotifications,
            unreadCount: Math.max(0, state.unreadCount - 1)
        };
    }),

    // Mark all as read
    markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0
    })),
    
    // Clear all
    clearNotifications: () => set({ notifications: [], unreadCount: 0 })
}));
