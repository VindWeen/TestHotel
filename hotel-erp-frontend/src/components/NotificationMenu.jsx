import React from 'react';
import { Badge, Popover, List, Typography, Button, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useNotificationStore } from '../store/notificationStore';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../api/activityLogsApi';

const { Text } = Typography;

export default function NotificationMenu() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

    const handleItemClick = async (item) => {
        if (!item.isRead) {
            try {
                // Call API in the background
                markNotificationAsRead(item.id).catch(console.error);
                // Update local UI immediately for fast response
                markAsRead(item.id);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();
            markAllAsRead();
            message.success('Đã đánh dấu tất cả là đã đọc');
        } catch (err) {
            console.error(err);
            message.error('Lỗi khi đánh dấu đã đọc');
        }
    };

    const content = (
        <div style={{ width: 320, maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '4px 12px' }}>
                <Text strong>Thông báo</Text>
                {unreadCount > 0 && (
                    <Button type="link" size="small" onClick={handleMarkAllAsRead} icon={<CheckOutlined />}>
                        Đánh dấu đã đọc
                    </Button>
                )}
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                        Không có thông báo nào
                    </div>
                ) : (
                    <List
                        itemLayout="horizontal"
                        dataSource={notifications}
                        renderItem={(item) => (
                            <List.Item
                                onClick={() => handleItemClick(item)}
                                style={{
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    background: item.isRead ? 'transparent' : '#f0fdf4',
                                    borderBottom: '1px solid #f3f4f6',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <List.Item.Meta
                                    title={
                                        <Text style={{ fontSize: 13, color: item.isRead ? '#6b7280' : '#111827', fontWeight: item.isRead ? 'normal' : '600' }}>
                                            {item.message || item.action}
                                        </Text>
                                    }
                                    description={
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {new Date(item.createdAt || item.timestamp).toLocaleString('vi-VN')}
                                        </Text>
                                    }
                                />
                                {!item.isRead && (
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0, marginLeft: 8 }} />
                                )}
                            </List.Item>
                        )}
                    />
                )}
            </div>
        </div>
    );

    return (
        <Popover content={content} trigger="click" placement="bottomRight" arrow={false} overlayInnerStyle={{ padding: 0, paddingTop: 8 }}>
            <button
                style={{
                    padding: 8,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    borderRadius: '50%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none'
                }}
            >
                <Badge count={unreadCount} size="small" offset={[-2, 6]}>
                    <BellOutlined style={{ fontSize: 20, color: '#6b7280' }} />
                </Badge>
            </button>
        </Popover>
    );
}
