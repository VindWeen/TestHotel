import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAdminAuthStore } from '../store/adminAuthStore';
import { useNotificationStore } from '../store/notificationStore';
import { getMyNotifications } from '../api/activityLogsApi';

export const useSignalR = () => {
    const { token } = useAdminAuthStore();
    const addNotification = useNotificationStore((state) => state.addNotification);
    const setNotifications = useNotificationStore((state) => state.setNotifications);
    const connectionRef = useRef(null);

    useEffect(() => {
        if (!token) {
            if (connectionRef.current) {
                connectionRef.current.stop();
                connectionRef.current = null;
            }
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5279/api';
        const hubUrl = apiUrl.replace(/\/api\/?$/, '') + '/notificationHub';

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
                accessTokenFactory: () => token
            })
            .withAutomaticReconnect()
            .build();

        connectionRef.current = connection;

        const fetchHistory = async () => {
            try {
                const res = await getMyNotifications();
                if (res.data) setNotifications(res.data);
            } catch (err) {
                console.error('Failed to fetch notification history: ', err);
            }
        };

        const startConnection = async () => {
            try {
                if (connection.state === signalR.HubConnectionState.Disconnected) {
                    await connection.start();
                    console.log('Connected to NotificationHub');
                }
            } catch (err) {
                console.error('SignalR Connection Error: ', err);
                setTimeout(startConnection, 5000);
            }
        };

        fetchHistory();
        startConnection();

        connection.on('ReceiveNotification', (notification) => {
            addNotification({
                id: notification.id || Date.now().toString(),
                message: notification.message || notification,
                createdAt: notification.createdAt || new Date().toISOString(),
                isRead: false,
                ...notification
            });
        });

        return () => {
            connection.off('ReceiveNotification');
            connection.stop();
            if (connectionRef.current === connection) {
                connectionRef.current = null;
            }
        };
    }, [token, addNotification, setNotifications]);

    return { connection: connectionRef.current };
};
