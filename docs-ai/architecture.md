# Architecture — Layer Structure & Patterns

## Solution Structure

```
HotelManagement.sln
├── HotelManagement.Core          # Domain layer (no dependencies)
│   ├── Entities/                 # EF Core entity classes
│   ├── DTOs/                     # Data Transfer Objects
│   ├── Models/Enums/             # Enums (NotificationType, etc.)
│   ├── Authorization/            # PermissionCodes, RequirePermissionAttribute
│   └── Helpers/                  # JwtHelper, etc.
│
├── HotelManagement.Infrastructure # Data access layer
│   ├── Data/AppDbContext.cs      # EF DbContext, entity configurations
│   └── Migrations/               # EF migrations
│
└── HotelManagement.API           # Presentation layer
    ├── Controllers/              # REST API controllers
    ├── Services/                 # Business services (IActivityLogService, etc.)
    ├── Hubs/                     # SignalR hubs (NotificationHub)
    ├── Policies/                 # Notification policy config
    └── Program.cs                # DI container, middleware config
```

---

## Dependency Rules (Layered Architecture)

```
API → Infrastructure → Core
API → Core
Infrastructure → Core
Core → (nothing — pure domain)
```

- `Core` không được import từ `API` hoặc `Infrastructure`.
- `Infrastructure` không được import từ `API`.
- `API` có thể dùng cả hai.

---

## Authentication & Authorization

### JWT Bearer Token
- Token được tạo bởi `JwtHelper.GenerateToken()` trong `Core/Helpers`.
- Claims trong token: `sub` (userId), `role`, `full_name`, `email`, nhiều claim `"permission"` (mỗi permission_code là 1 claim riêng).
- Token được gửi trong header: `Authorization: Bearer <token>`
- Token hết hạn sau **60 phút**.

### Refresh Token Rotation
- Refresh token lưu server-side trong DB (`refresh_token`, `refresh_token_expiry`).
- Hết hạn sau **7 ngày**.
- Mỗi lần refresh token → cấp token mới **và** revoke token cũ (chống replay attack).
- Khi logout hoặc khóa tài khoản → refresh token bị xóa/revoke.
- **Remember Me:** Nếu người dùng tick "Remember me" khi đăng nhập, `token` và `user` info được lưu ở `localStorage` (vĩnh viễn). Nếu không, dữ liệu được lưu ở `sessionStorage` (mất khi đóng tab). Logic này được quản lý tập trung tại `adminAuthStore.js` và `axios.js`.

### Permission-based Authorization
```csharp
// Trên controller action:
[RequirePermission(PermissionCodes.ManageUsers)]

// PermissionCodes là static class trong Core/Authorization/
// Ví dụ: PermissionCodes.ManageRooms, PermissionCodes.ManageBookings
```

### Tách biệt giữa Xác thực (Authentication) và Phân quyền (Authorization):
- `[Authorize]` = phải đăng nhập
- `[RequirePermission(...)]` = phải có quyền cụ thể

---

## SignalR Architecture

```
Backend Action
    └→ ActivityLogService.LogAsync(actionCode, ...)
            └→ NotificationPolicy.GetRolesForAction(actionCode)
                    └→ NotificationService.SendToRolesAsync(roles, ...)
                            └→ NotificationHub → Client Group ("Admin" / "Manager")

Frontend
    └→ useSignalR.js (hook)
            ├→ HubConnectionBuilder → connect với JWT
            ├→ Fetch history: GET /api/ActivityLogs/my-notifications
            └→ Listen: connection.on("ReceiveNotification", handler)
                └→ notificationStore.addNotification(...)
                        └→ NotificationMenu.jsx (UI)
9. **Per-user Read Tracking:** Hệ thống không dùng cờ `IsRead` chung trên bảng `ActivityLog`. Thay vào đó, mỗi lần user click xem thông báo, một bản ghi sẽ được tạo trong bảng `Activity_Log_Reads`. Query lấy thông báo sẽ `LEFT JOIN` với bảng này để xác định trạng thái đã đọc riêng cho từng người.
```

### Notification Policy (Nguồn cấu hình duy nhất)
File: `HotelManagement.API/Policies/NotificationPolicy.cs`
- Map ActionCode → danh sách Role nhận thông báo.
- Dùng cho cả realtime push (SignalR) và history filter (REST API).
- **Chỉ cần sửa file này để thay đổi rule thông báo.**

---

## Audit & Activity Logging

| Log type | Bảng | Mục đích |
|---|---|---|
| `AuditLog` | `Audit_Logs` | Ghi lại mọi thay đổi (ai, gì, khi nào, IP). Dùng cho báo cáo bảo mật. |
| `ActivityLog` | `Activity_Logs` | Ghi lại sự kiện nghiệp vụ, push realtime notification cho Admin/Manager. |

Mọi action quan trọng trong Controller đều phải:
1. Gọi `_activityLog.LogAsync(...)` — ghi ActivityLog + push SignalR
2. Thêm bản ghi vào `_db.AuditLogs` — ghi AuditLog chi tiết

---

## Patterns sử dụng

| Pattern | Nơi dùng |
|---|---|
| Repository via EF | Trực tiếp dùng `AppDbContext` trong Controllers (không wrapper). |
| Service pattern | `IActivityLogService`, `INotificationService`, `IEmailService` |
| Policy pattern | `NotificationPolicy.cs` cho notification rules |
| Dependency Injection | Đăng ký trong `Program.cs` |
| Soft Delete | Entity có `IsActive` bool, dùng `toggle-active` PATCH thay DELETE thật |
| Redis Distributed Lock | Dùng trong BookingController để tránh double-booking race condition |
| Cloudinary | Upload ảnh phòng, avatar, review, thumbnail bài viết |
| Store pattern (FE) | Zustand stores cho state management |
| Custom Hook (FE) | `useSignalR.js`, `useAdminAuthStore` |
