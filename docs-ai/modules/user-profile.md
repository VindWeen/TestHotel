# Module: User Profile (Tự quản lý tài khoản)

## Chức năng
Cho phép người dùng đã đăng nhập tự xem và chỉnh sửa thông tin cá nhân của mình.

---

## Khác với UserManagement

| | UserProfile | UserManagement |
|---|---|---|
| Ai dùng | Người dùng tự quản thông tin mình | Admin/Manager quản lý nhân viên |
| Auth | `[Authorize]` (chỉ cần đăng nhập) | `MANAGE_USERS` permission |
| Đổi password | ✅ | ❌ |
| Upload avatar | ✅ | ❌ |
| Đổi Role | ❌ | ✅ |
| Khóa tài khoản | ❌ | ✅ |

---

## Cloudinary — Upload Avatar

- Endpoint: `POST /api/UserProfile/upload-avatar`
- Resize: 500×500 px, crop chế độ `Face`.
- Folder Cloudinary: `hotel/avatars`.
- Lưu URL vào `user.avatar_url`.

---

## Endpoints

```http
GET  /api/UserProfile/my-profile         # [Authorize] — xem thông tin cá nhân
PUT  /api/UserProfile/update-profile     # [Authorize] — sửa tên, SĐT, DOB, địa chỉ
PUT  /api/UserProfile/change-password    # [Authorize] — đổi mật khẩu (cần old password)
POST /api/UserProfile/upload-avatar      # [Authorize] — upload ảnh đại diện Cloudinary
```

---

## Business Rules: Đổi mật khẩu
- Phải cung cấp đúng `old_password` để xác thực.
- `new_password` được hash bằng BCrypt trước khi lưu.
- Sau khi đổi password thành công → có thể invalidate refresh token cũ (tùy implement).
