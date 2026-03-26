import axiosClient from './axios';

export const getMyNotifications = () => {
    return axiosClient.get('/ActivityLogs/my-notifications');
};

export const markNotificationAsRead = (id) => {
    return axiosClient.put(`/ActivityLogs/${id}/mark-read`);
};

export const markAllNotificationsAsRead = () => {
    return axiosClient.put('/ActivityLogs/mark-all-read');
};
