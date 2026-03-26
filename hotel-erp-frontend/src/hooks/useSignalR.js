import { useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAdminAuthStore } from '../store/adminAuthStore';
import { useNotificationStore } from '../store/notificationStore';
import { getMyNotifications } from '../api/activityLogsApi';

export const useSignalR = () => {
    const { token } = useAdminAuthStore();
    const addNotification = useNotificationStore((state) => state.addNotification);
    const setNotifications = useNotificationStore((state) => state.setNotifications);
    const [connection, setConnection] = useState(null);

    // Initialize connection
    useEffect(() => {
        if (!token) {
            if (connection) {
                connection.stop();
                setConnection(null);
            }
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5279/api';
        const hubUrl = apiUrl.replace(/\/api\/?$/, '') + '/notificationHub';

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
                accessTokenFactory: () => token
            })
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);
        
        // Cleanup on unmount or token change
        return () => {
            if (newConnection) {
                newConnection.stop();
            }
        };
    }, [token]);

    // Manage listeners & Fetch initial state
    useEffect(() => {
        if (!connection) return;

        // Fetch Notification History from API
        const fetchHistory = async () => {
            try {
                const res = await getMyNotifications();
                if (res.data) {
                    setNotifications(res.data);
                }
            } catch (err) {
                console.error('Failed to fetch notification history: ', err);
            }
        };
        fetchHistory();

        const startConnection = async () => {
            try {
                if (connection.state === signalR.HubConnectionState.Disconnected) {
                    await connection.start();
                    console.log('Connected to NotificationHub');
                }
            } catch (err) {
                console.error('SignalR Connection Error: ', err);
                setTimeout(startConnection, 5000); // Retry logic
            }
        };

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

        connection.on('ReceiveActivityLog', (log) => {
            addNotification({
                id: log.id || Date.now().toString(),
                message: log.action || 'New activity logged',
                createdAt: log.timestamp || new Date().toISOString(),
                isRead: false,
                ...log
            });
        });

        return () => {
            connection.off('ReceiveNotification');
            connection.off('ReceiveActivityLog');
        };
    }, [connection, addNotification, setNotifications]);

    return { connection };
};