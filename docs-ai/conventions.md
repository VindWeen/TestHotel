# Coding Conventions

## Backend (C# / ASP.NET Core)

### Naming
| Item | Convention | Ví dụ |
|---|---|---|
| Class | PascalCase | `UserManagementController` |
| Method | PascalCase | `GetUserById`, `ToggleStatus` |
| Private field | `_camelCase` | `_db`, `_activityLog` |
| Parameter | camelCase | `int userId`, `string roleName` |
| Local variable | camelCase | `var currentUserId` |
| Constant | SCREAMING_SNAKE | `PermissionCodes.MANAGE_USERS` |
| Namespace | PascalCase | `HotelManagement.API.Controllers` |

### Controller Structure
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]  // nếu cần auth
public class ExampleController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _activityLog;

    public ExampleController(AppDbContext db, IActivityLogService activityLog)
    {
        _db = db;
        _activityLog = activityLog;
    }

    // GET /api/Example
    [HttpGet]
    [RequirePermission(PermissionCodes.ManageXxx)]
    public async Task<IActionResult> GetAll() { ... }
}
```

### Response Format chuẩn
```csharp
// Success — list
return Ok(new { data = list, pagination = new { ... } });

// Success — single
return Ok(item);

// Created
return StatusCode(201, new { message = "...", id = entity.Id });

// Error
return NotFound(new { message = "Không tìm thấy..." });
return BadRequest(new { message = "Lỗi validation..." });
return Conflict(new { message = "Đã tồn tại..." });
```

### Activity Log (bắt buộc cho mọi hành động quan trọng)
```csharp
var currentUserId = JwtHelper.GetUserId(User);
var actionUser = User.FindFirst("full_name")?.Value ?? "Hệ thống";

await _activityLog.LogAsync(
    actionCode: "ACTION_CODE",           // SCREAMING_SNAKE_CASE
    actionLabel: "Tên hành động VN",
    message: $"{actionUser} đã ...",     // Luôn có tên người thực hiện
    entityType: "EntityName",
    entityId: entity.Id,
    entityLabel: entity.Name,
    severity: "Info",                    // Info | Success | Warning | Error
    userId: currentUserId,
    roleName: User.FindFirst("role")?.Value
);
```

### AuditLog (bắt buộc kèm ActivityLog)
```csharp
_db.AuditLogs.Add(new AuditLog
{
    UserId    = currentUserId,
    Action    = "ACTION_CODE",
    TableName = "TableName",
    RecordId  = entity.Id,
    OldValue  = JsonSerializer.Serialize(oldData),  // null nếu CREATE
    NewValue  = JsonSerializer.Serialize(newData),  // null nếu DELETE
    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
    UserAgent = Request.Headers["User-Agent"].ToString(),
    CreatedAt = DateTime.UtcNow
});
await _db.SaveChangesAsync();
```

---

## Frontend (React / JavaScript)

### Naming
| Item | Convention | Ví dụ |
|---|---|---|
| Component | PascalCase | `NotificationMenu`, `AdminLayout` |
| Hook | `use` + PascalCase | `useSignalR`, `useNotificationStore` |
| Store | camelCase + Store | `notificationStore`, `adminAuthStore` |
| API file | camelCase + Api | `activityLogsApi`, `bookingApi` |
| Page | PascalCase | `UserManagement`, `BookingList` |
| Constant | SCREAMING_SNAKE | `BASE_URL`, `TOKEN_KEY` |
| CSS class | kebab-case | `.notification-menu`, `.sidebar-nav` |

### Cấu trúc thư mục frontend
```
src/
├── api/           # Axios API calls (một file per domain)
├── components/    # Shared UI components tái sử dụng
├── hooks/         # Custom React hooks
├── layouts/       # Layout wrappers (AdminLayout, etc.)
├── pages/         # Page components (theo route)
│   ├── admin/     # Trang quản trị
│   └── guest/     # Trang khách hàng
├── routes/        # Route config & guards
├── store/         # Zustand stores
└── utils/         # Utility functions
```

### API Call pattern
```js
// src/api/exampleApi.js
import axiosInstance from './axiosInstance';  // đã có JWT interceptor

export const getAll = () => axiosInstance.get('/Example');
export const create = (data) => axiosInstance.post('/Example', data);
export const update = (id, data) => axiosInstance.put(`/Example/${id}`, data);
export const remove = (id) => axiosInstance.delete(`/Example/${id}`);
```

### Zustand Store pattern
```js
import { create } from 'zustand';

export const useExampleStore = create((set) => ({
    items: [],
    setItems: (items) => set({ items }),
    addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
}));
```

---

## Quy tắc chung

1. **Không hardcode chuỗi quan trọng** — dùng biến, constant, hoặc config file.
2. **Không trả về exception message raw** — luôn wrap trong `{ message: "..." }`.
3. **Dùng `async/await`** — không dùng `.then().catch()` rải rác.
4. **Xóa mềm (Soft Delete)** — không xóa cứng entity khỏi DB; dùng `IsActive = false` + endpoint `PATCH /{id}/toggle-active`.
5. **Không duplicate SaveChangesAsync** — chỉ gọi 1 lần sau khi add/update xong.
6. **Tên người thực hiện trong log** — luôn dùng `User.FindFirst("full_name")?.Value` thay vì hardcode role.
7. **`AsNoTracking()` cho query read-only** — luôn thêm khi chỉ đọc dữ liệu, không cần track thay đổi.
8. **Không dùng `.Include()` cùng `.Select()`** — nếu đã dùng `.Select()`, EF tự JOIN; Include thừa gây nhiễu.
9. **Bulk update dùng `ExecuteUpdateAsync`** — thay vì load entity vào RAM rồi foreach.
10. **DTOs đặt trong `HotelManagement.Core/DTOs/`** — KHÔNG định nghĩa DTO trực tiếp bên trong file Controller. File đặt theo module, ví dụ: `BookingDTOs.cs`, `RoomTypeDTOs.cs`.
11. **Modal / Popup — fetch trước, mở sau** — luôn gọi API lấy dữ liệu trước khi set state `open = true`. Tránh mở modal rỗng rồi mới fetch (gây flash skeleton khó chịu).
    ```js
    // ✅ Đúng: fetch → điền data → mở modal
    const openEdit = async (id) => {
      const res = await getById(id);
      setFormData(res.data);
      setModalOpen(true);   // chỉ mở sau khi có data
    };
    // ❌ Sai: mở modal → fetch → điền (gây flash loading)
    ```


---

## Soft Delete Pattern

Mọi entity quan trọng dùng `IsActive` bool thay vì xóa vật lý:
```csharp
// Entity
public bool IsActive { get; set; } = true;

// Xóa mềm (trong controller DELETE):
entity.IsActive = false;
await _db.SaveChangesAsync();

// Toggle active (PATCH /{id}/toggle-active):
entity.IsActive = !entity.IsActive;
await _db.SaveChangesAsync();

// Filter khi query (public endpoint):
.Where(x => x.IsActive)
```

Áp dụng cho: Amenities, RoomTypes, RoomImages, RoomInventory, Services, Articles, ArticleCategories, Attractions.

---

## Slug Generation (Tiếng Việt → URL)

Dùng cho: Articles, ArticleCategories.
```csharp
// Logic:
// 1. Normalize Unicode NFD → loại bỏ dấu
// 2. Replace "đ" → "d"
// 3. Lowercase, replace ký tự đặc biệt bằng "-"
// 4. Đảm bảo unique: thêm hậu tố "-2", "-3"... nếu trùng
// Kết quả: "Khách Sạn Đẹp" → "khach-san-dep"
```

---

## Cloudinary Upload Rules

| Loại | Endpoint | Kích cỡ | Folder |
|---|---|---|---|
| Avatar user | `POST /api/UserProfile/upload-avatar` | 500×500, crop Face | `hotel/avatars` |
| Ảnh loại phòng | `POST /api/RoomTypes/{id}/images` | Auto quality | `hotel/room-types/{id}` |
| Ảnh review | `POST /api/Reviews/upload-image` | 1200×800 | `hotel/reviews` |
| Thumbnail bài viết | `POST /api/Articles/{id}/thumbnail` | 1200×630, crop fill | `hotel/articles` |

Khi xóa entity → luôn xóa ảnh cũ trên Cloudinary qua `cloudinary_public_id`.
