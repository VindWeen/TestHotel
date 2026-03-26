# Module: Thông báo Realtime (Notifications)

## Chức năng
Hệ thống thông báo thời gian thực (realtime) cho Admin và Manager khi có sự kiện nghiệp vụ quan trọng xảy ra trong hệ thống.

---

## Kiến trúc

```
Backend Action → ActivityLogService.LogAsync()
    → NotificationPolicy.GetRolesForAction(actionCode)  [tra cứu ai cần nhận]
    → NotificationService.SendToRolesAsync(roles)       [push SignalR]
    → NotificationHub                                   [gửi đến client groups]

Frontend → useSignalR.js hook
    → kết nối Hub với JWT token
    → fetch history: GET /api/ActivityLogs/my-notifications
    → lắng nghe "ReceiveNotification" event
    → notificationStore (Zustand)
    → NotificationMenu.jsx (chuông UI)
```

---

## File liên quan

### Backend
| File | Vai trò |
|---|---|
| `Policies/NotificationPolicy.cs` | **Nguồn cấu hình duy nhất** — map ActionCode → Roles |
| `Services/ActivityLogService.cs` | Ghi log + tự động push SignalR theo policy |
| `Services/NotificationService.cs` | Wrapper SignalR hub context |
| `Hubs/NotificationHub.cs` | SignalR hub, quản lý group theo role |
| `Controllers/ActivityLogsController.cs` | REST API lấy history + mark-read |

### Frontend
| File | Vai trò |
|---|---|
| `hooks/useSignalR.js` | Quản lý kết nối SignalR lifecycle + fetch history |
| `store/notificationStore.js` | Zustand store cho danh sách thông báo |
| `api/activityLogsApi.js` | Axios calls đến ActivityLogsController |
| `components/NotificationMenu.jsx` | UI chuông thông báo |
| `layouts/AdminLayout.jsx` | Mount `useSignalR` hook |

---

## NotificationPolicy — Cách cập nhật

File: `HotelManagement.API/Policies/NotificationPolicy.cs`

```csharp
private static readonly Dictionary<string, string[]> ActionRoleMap = new()
{
    { "GRANT_PERMISSION",  new[] { "Admin" } },          // chỉ Admin
    { "CREATE_BOOKING",    new[] { "Admin", "Manager" } }, // Admin + Manager
    // Mặc định (không có entry) → ["Admin", "Manager"]
};
```

**Các method public trong policy:**
- `GetRolesForAction(actionCode)` — dùng trong `ActivityLogService` khi push SignalR.
- `CanRoleViewAction(role, actionCode)` — kiểm tra nhanh 1 action.
- `GetBlockedActionCodesForRole(role)` — dùng trong `ActivityLogsController` để filter tại DB theo **blacklist** (loại các action có explicit mapping nhưng không bao gồm role này). Actions không có trong map → default hiển cho cả hai.

**Để thêm rule mới:** Chỉ cần thêm 1 dòng vào dictionary. Không cần sửa bất kỳ file nào khác.

---

## Business Rules

1. Chỉ `Admin` và `Manager` nhận thông báo qua chuông.
2. Các action `GRANT_PERMISSION`, `REVOKE_PERMISSION` → chỉ gửi cho `Admin`.
3. Log `LOGIN`, `LOGOUT`, `REGISTER` → không push thông báo (lưu AuditLog thôi).
4. History khi F5 được filter bởi cùng `NotificationPolicy` → luôn đồng bộ với realtime.
5. Mỗi user đọc độc lập (isRead track theo session, không theo user cụ thể).

---

## API Endpoints

```http
GET  /api/ActivityLogs/my-notifications   # Lấy 50 log gần nhất (đã filter theo role)
PUT  /api/ActivityLogs/{id}/mark-read      # Đánh dấu 1 thông báo đã đọc
PUT  /api/ActivityLogs/mark-all-read       # Đánh dấu tất cả đã đọc
```

---

## Thêm thông báo cho Action mới

1. Trong Controller, gọi `_activityLog.LogAsync(actionCode: "NEW_ACTION", ...)`
2. Trong `NotificationPolicy.cs`, thêm: `{ "NEW_ACTION", new[] { "Admin" } }`
3. Không cần sửa gì thêm — realtime push và history đều tự động cập nhật.
