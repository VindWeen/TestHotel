# Module: Quản lý Người dùng & Phân quyền

## Chức năng
Quản lý tài khoản nhân viên, phân quyền, khóa/mở khóa tài khoản.

---

## Business Rules

### Tạo tài khoản nhân viên (`POST /api/UserManagement`)
- Email phải unique.
- `RoleId` phải tồn tại trong DB.
- Password được hash bằng BCrypt trước khi lưu.
- Sau khi tạo → gửi email thông báo tài khoản mới cho nhân viên.
- ActivityLog: push cho Admin + Manager.

### Cập nhật thông tin (`PUT /api/UserManagement/{id}`)
- Chỉ cập nhật được: fullName, phone, dateOfBirth, gender, address, nationalId.
- Không cho phép đổi email/password qua endpoint này.
- ActivityLog: push cho Admin + Manager.

### Khóa tài khoản cứng (`DELETE /api/UserManagement/{id}`)
- Chỉ set `status = false`, KHÔNG xóa khỏi DB.
- Không được tự khóa chính mình.
- Chỉ khóa tài khoản đang active.

### Reset mật khẩu từ Admin (`POST /api/UserManagement/{id}/reset-password`)
- Phải có quyền `MANAGE_USERS`.
- Sẽ phát sinh mật khẩu ngẫu nhiên siêu an toàn (12 ký tự).
- Gửi trực tiếp Email mật khẩu mới (Template tùy biến đẹp, Background Fire-and-Forget).
- Mã hóa DB qua BCrypt và tạo lưu vết vĩnh viễn trên Audit_Logs (có record email) + Activity_Logs.

### Bật/tắt tài khoản - Toggle (`PATCH /api/UserManagement/{id}/toggle-status`)
- Toggle `user.Status` (true → false → true).
- ActivityLog: `LOCK_ACCOUNT` hoặc `UNLOCK_ACCOUNT` tùy trạng thái mới.

### Đổi quyền (`PUT /api/UserManagement/{id}/change-role`)
- Cần cả quyền `MANAGE_USERS` và `MANAGE_ROLES`.
- Ghi lại tên role cũ và role mới trong ActivityLog message.

---

## Permission System

### Cách hoạt động
```
User có Role → Role có nhiều Permission → Permission guard controller action
```

### Gán quyền cho Role (`POST /api/Roles/assign-permission`)
```json
{ "roleId": 2, "permissionId": 5, "grant": true }  // grant = true: gán, false: thu hồi
```
- Chỉ Admin nhận thông báo về thay đổi quyền (theo NotificationPolicy).

### Lấy quyền người dùng hiện tại
```http
GET /api/Roles/my-permissions
→ Trả về mảng permission codes của role hiện tại
→ FE dùng để ẩn/hiện menu
```

---

## ActivityLog Actions

| ActionCode | Severity | Gửi cho |
|---|---|---|
| `CREATE_USER` | Success | Admin, Manager |
| `UPDATE_USER` | Info | Admin, Manager |
| `LOCK_ACCOUNT` | Warning | Admin, Manager |
| `UNLOCK_ACCOUNT` | Success | Admin, Manager |
| `CHANGE_ROLE` | Warning | Admin, Manager |
| `RESET_PASSWORD` | Warning | Admin, Manager |
| `GRANT_PERMISSION` | Warning | **Admin only** |
| `REVOKE_PERMISSION` | Warning | **Admin only** |

---

## Login/Logout (AuthController)
- Login/Logout **KHÔNG** ghi ActivityLog (tránh spam thông báo).
- Login/Logout vẫn ghi **AuditLog** (dùng cho security audit).
- Register ghi ActivityLog bình thường.
