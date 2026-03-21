// ROLES, ERROR_MESSAGES, STATUS(Active / Locked)
export const ROLES = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    RECEPTIONIST: 'Receptionist',
    ACCOUNTANT: 'Accountant',
    HOUSEKEEPING: 'Housekeeping',
    SECURITY: 'Security',
    CHEF: 'Chef',
    WAITER: 'Waiter',
    IT_SUPPORT: 'IT Support',
    GUEST: 'Guest',
};

export const STATUS = {
    ACTIVE: true,
    LOCKED: false,
};

export const STATUS_LABEL = {
    true: 'Hoạt động',
    false: 'Bị khóa',
};

export const ERROR_MESSAGES = {
    NETWORK: 'Lỗi kết nối, vui lòng thử lại.',
    UNAUTHORIZED: 'Phiên đăng nhập hết hạn.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    NOT_FOUND: 'Không tìm thấy dữ liệu.',
    SERVER: 'Lỗi server, vui lòng thử lại sau.',
};