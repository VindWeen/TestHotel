# 🏨 HotelManagement — Tổng Hợp Dự Án

> **Stack:** .NET 10 · ASP.NET Core Web API · Entity Framework Core 10 · SQL Server · Redis · Cloudinary · JWT · MailKit · SignalR  
> **Kiến trúc:** 3-layer — `HotelManagement.Core` · `HotelManagement.Infrastructure` · `HotelManagement.API`  
> **Frontend:** React 19 + Vite 8 · Ant Design 6 · Zustand · Axios · React Router DOM v7 · @microsoft/signalr

---

## 1. Cấu Trúc Solution

```
HotelManagement/
├── HotelManagement.Core/           # Entities, DTOs, Authorization helpers, JwtHelper
│   ├── Authorization/              # PermissionCodes, RequirePermissionAttribute, Handler, Provider
│   ├── DTOs/                       # BookingDTOs, RoomTypeDTO, AmenitiesDTO, UploadImageDTO
│   ├── Entities/                   # 30+ entity classes
│   ├── Helpers/                    # JwtHelper
│   └── Models/Enums/               # NotificationEnums (Notification, NotificationType, NotificationAction)
├── HotelManagement.Infrastructure/
│   └── Data/                       # AppDbContext (EF Core, snake_case convention)
└── HotelManagement.API/
    ├── Controllers/                 # 15+ controllers
    ├── Hubs/                        # NotificationHub (SignalR)
    ├── Policies/                    # NotificationPolicy (RBAC cho thông báo)
    ├── Services/                    # EmailService, ActivityLogService, NotificationService
    └── Program.cs
```

Monorepo: `hotel-erp-frontend/` nằm trong thư mục gốc của backend repo.

```
hotel-erp-frontend/
├── src/
│   ├── api/           # 14 file API client (authApi, userManagementApi, bookingsApi, ...)
│   ├── components/    # NotificationMenu.jsx
│   ├── hooks/         # useSignalR.js (đầy đủ implementation)
│   ├── layouts/       # AdminLayout.jsx (sidebar + topbar + spinner overlay)
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   └── admin/
│   │       ├── DashboardPage.jsx  (minimal, test-only)
│   │       ├── UserListPage.jsx   (hoàn chỉnh)
│   │       └── RolePermissionPage.jsx (hoàn chỉnh)
│   ├── routes/        # AdminRoutes, ProtectedRoute, RequirePermission, PublicOnlyRoute
│   └── store/         # adminAuthStore, loadingStore, notificationStore
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## 2. Cơ Sở Dữ Liệu — 7 Cluster

### Cluster 1: System, Auth & HR

| Bảng                 | Mô tả                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Roles`              | 10 vai trò: Admin, Manager, Receptionist, Accountant, Housekeeping, Security, Chef, Waiter, IT Support, Guest |
| `Permissions`        | 10 quyền với `permission_code` và `module_name`                                                               |
| `Role_Permissions`   | Composite PK — gán nhiều permission cho 1 role                                                                |
| `Memberships`        | 10 hạng từ Khách Mới → Signature, kèm `discount_percent`, `color_hex`                                         |
| `Users`              | Auth đầy đủ, loyalty points, refresh token, avatar Cloudinary                                                 |
| `Audit_Logs`         | Ghi lại mọi thao tác thay đổi dữ liệu quan trọng                                                              |
| `Activity_Logs`      | Thông báo realtime (SignalR): `action_code`, `severity`, `entity_type/id/label`, `metadata`                   |
| `Activity_Log_Reads` | Per-user read status (junction table, unique idx trên `activity_log_id + user_id`)                            |

### Cluster 2: Room Management

| Bảng                 | Mô tả                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `Room_Types`         | 10 loại phòng với `slug`, `base_price`, `capacity`, `bed_type`, `view_type`                          |
| `Rooms`              | 2 trục trạng thái: `business_status` (Available/Occupied/Disabled) + `cleaning_status` (Clean/Dirty) |
| `Amenities`          | Tiện nghi với soft delete                                                                            |
| `RoomType_Amenities` | Many-to-many giữa Room_Types and Amenities                                                           |
| `Room_Images`        | Ảnh Cloudinary: `is_primary`, `sort_order`, `cloudinary_public_id`, soft delete                      |
| `Room_Inventory`     | Vật tư phòng (Asset / Minibar): `price_if_lost`, soft delete                                         |

### Cluster 3: Booking & Promotions

| Bảng              | Mô tả                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| `Vouchers`        | PERCENT / FIXED_AMOUNT, `usage_limit`, `max_uses_per_user`, thời hạn           |
| `Bookings`        | Booking code unique, thông tin khách, trạng thái, nguồn (online/walk_in/phone) |
| `Booking_Details` | Chi tiết phòng: ngày CI/CO, `price_per_night` khóa tại thời điểm đặt           |
| `Voucher_Usage`   | Lịch sử dùng voucher theo user/booking                                         |

### Cluster 4: Services & Operations

| Bảng                    | Mô tả                                              |
| ----------------------- | -------------------------------------------------- |
| `Service_Categories`    | Nhóm dịch vụ                                       |
| `Services`              | Dịch vụ cụ thể với soft delete                     |
| `Order_Services`        | Đơn đặt dịch vụ gắn với `booking_detail_id`        |
| `Order_Service_Details` | Chi tiết từng dịch vụ trong đơn                    |
| `Loss_And_Damages`      | Biên bản mất/hỏng: `penalty_amount`, `reported_by` |

### Cluster 5: Billing, Reviews & CMS

| Bảng                 | Mô tả                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `Invoices`           | Tổng phòng/dịch vụ/hư hỏng, giảm giá, thuế, `final_total`                |
| `Payments`           | Deposit / Final_Settlement / Refund, nhiều phương thức                   |
| `Reviews`            | Rating 1–5, ảnh Cloudinary, workflow duyệt (pending → approved/rejected) |
| `Article_Categories` | Danh mục bài viết với `slug` unique                                      |
| `Articles`           | Draft → Pending_Review → Published, SEO meta, thumbnail Cloudinary       |
| `Attractions`        | Địa điểm du lịch: tọa độ GPS, khoảng cách km, Google Maps embed          |

### Cluster 6 & 7: HR & Loyalty

| Bảng                   | Mô tả                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `Shifts`               | Ca làm việc: Morning/Afternoon/Night, kế hoạch vs thực tế, bàn giao ca |
| `Loyalty_Transactions` | Lịch sử điểm thưởng: earned / redeemed / expired                       |

---

## 3. Hệ Thống Phân Quyền (RBAC)

### Permission Codes

```
VIEW_DASHBOARD   MANAGE_USERS    MANAGE_ROLES
MANAGE_ROOMS     MANAGE_BOOKINGS MANAGE_INVOICES
MANAGE_SERVICES  VIEW_REPORTS    MANAGE_CONTENT
MANAGE_INVENTORY
```

### Cơ chế hoạt động

1. **`PermissionRequirement`** — mang `permission_code` cần kiểm tra
2. **`PermissionPolicyProvider`** — tự động tạo `AuthorizationPolicy` từ policy name = permission code
3. **`PermissionAuthorizationHandler`** — đọc claims `"permission"` trong JWT và so khớp
4. **`[RequirePermission(PermissionCodes.ManageRooms)]`** — attribute thay cho `[Authorize(Policy = "MANAGE_ROOMS")]`

### JWT Token chứa

- `sub` (userId), `email`, `jti`, `role`, `full_name`
- Nhiều claim `"permission"` (mỗi permission_code là 1 claim riêng)

---

## 4. Authentication — Auth Flow

### Endpoints

| Method | Route                     | Mô tả                                    |
| ------ | ------------------------- | ---------------------------------------- |
| POST   | `/api/Auth/login`         | Đăng nhập → access token + refresh token |
| POST   | `/api/Auth/register`      | Đăng ký khách hàng mới (role: Guest)     |
| POST   | `/api/Auth/refresh-token` | Lấy access token mới bằng refresh token  |
| POST   | `/api/Auth/logout`        | Xóa refresh token phía server            |

### Đặc điểm

- **Refresh Token Rotation**: mỗi lần refresh cấp token mới, hủy token cũ → chống replay attack
- **Refresh token** lưu server-side trong DB (`refresh_token`, `refresh_token_expiry`), revoke khi logout/khóa tài khoản
- **BCrypt** hash password
- Access token hết hạn sau **60 phút**, refresh token hết hạn sau **7 ngày**
- Token storage phía frontend: body-based (sessionStorage / localStorage tùy chọn "Remember me")

---

## 5. Hệ Thống Thông Báo (SignalR + Activity Log)

### Kiến trúc

```
Controller action
    → IActivityLogService.LogAsync()
        → INSERT Activity_Logs (DB)
        → INotificationService.SendToRolesAsync()
            → SignalR Hub → Client "ReceiveNotification"
```

### NotificationHub (`/notificationHub`)

- `[Authorize]` — chỉ user đã đăng nhập mới kết nối được
- Khi connect: tự động join Group theo role name (VD: "Admin", "Manager")
- Frontend gửi JWT qua query string `?access_token=...` (vì WebSocket không hỗ trợ custom header)

### NotificationPolicy

- Nguồn cấu hình duy nhất ánh xạ `ActionCode → []Role nhận thông báo`
- Default: `["Admin", "Manager"]` cho action không có trong map
- Ví dụ: `GRANT_PERMISSION` → chỉ `Admin`; `CREATE_BOOKING` → `Admin, Manager`
- Blacklist-based filtering cho history endpoint (`GetBlockedActionCodesForRole`)

### Activity_Log_Reads

- Per-user read status (tách khỏi `Activity_Logs` để nhiều user có trạng thái đọc độc lập)
- Unique index: `(activity_log_id, user_id)`
- Endpoint: `PUT /api/ActivityLogs/{id}/mark-read` và `PUT /api/ActivityLogs/mark-all-read`

### Frontend (useSignalR.js + notificationStore)

- `useSignalR()` hook khởi tạo connection, gọi trong `AdminLayout`
- Fetch history từ `/api/ActivityLogs/my-notifications` khi kết nối
- `notificationStore` (Zustand): `notifications[]`, `unreadCount`, `addNotification`, `markAsRead`, `markAllAsRead`
- `NotificationMenu.jsx` (Ant Design Popover + Badge): hiển thị danh sách, đánh dấu đã đọc

---

## 6. Controllers & API Endpoints

### AuthController

| Method | Route                     | Auth          |
| ------ | ------------------------- | ------------- |
| POST   | `/api/Auth/login`         | Public        |
| POST   | `/api/Auth/register`      | Public        |
| POST   | `/api/Auth/refresh-token` | Public        |
| POST   | `/api/Auth/logout`        | `[Authorize]` |

### UserManagementController

| Method | Route                                     | Permission                      |
| ------ | ----------------------------------------- | ------------------------------- |
| GET    | `/api/UserManagement`                     | `MANAGE_USERS`                  |
| GET    | `/api/UserManagement/{id}`                | `MANAGE_USERS`                  |
| POST   | `/api/UserManagement`                     | `MANAGE_USERS`                  |
| PUT    | `/api/UserManagement/{id}`                | `MANAGE_USERS`                  |
| DELETE | `/api/UserManagement/{id}`                | `MANAGE_USERS` (soft lock)      |
| PUT    | `/api/UserManagement/{id}/change-role`    | `MANAGE_USERS` + `MANAGE_ROLES` |
| PATCH  | `/api/UserManagement/{id}/toggle-status`  | `MANAGE_USERS`                  |
| POST   | `/api/UserManagement/{id}/reset-password` | `MANAGE_USERS`                  |

### UserProfileController

| Method | Route                              | Auth          |
| ------ | ---------------------------------- | ------------- |
| GET    | `/api/UserProfile/my-profile`      | `[Authorize]` |
| PUT    | `/api/UserProfile/update-profile`  | `[Authorize]` |
| PUT    | `/api/UserProfile/change-password` | `[Authorize]` |
| POST   | `/api/UserProfile/upload-avatar`   | `[Authorize]` |

### RolesController

| Method | Route                          | Permission     |
| ------ | ------------------------------ | -------------- |
| GET    | `/api/Roles`                   | `[Authorize]`  |
| GET    | `/api/Roles/{id}`              | `MANAGE_ROLES` |
| POST   | `/api/Roles/assign-permission` | `MANAGE_ROLES` |
| GET    | `/api/Roles/my-permissions`    | `[Authorize]`  |

### RoomTypesController

| Method | Route                                                      | Auth           |
| ------ | ---------------------------------------------------------- | -------------- |
| GET    | `/api/RoomTypes`                                           | Public         |
| GET    | `/api/RoomTypes/{id}`                                      | Public         |
| DELETE | `/api/RoomTypes/{id}`                                      | `MANAGE_ROOMS` |
| POST   | `/api/RoomTypes/{id}/images`                               | `MANAGE_ROOMS` |
| DELETE | `/api/RoomTypes/images/{imageId}`                          | `MANAGE_ROOMS` |
| PATCH  | `/api/RoomTypes/{roomTypeId}/images/{imageId}/set-primary` | `MANAGE_ROOMS` |
| PATCH  | `/api/RoomTypes/{id}/toggle-active`                        | `MANAGE_ROOMS` |

### RoomsController

| Method | Route                             | Permission     |
| ------ | --------------------------------- | -------------- |
| GET    | `/api/Rooms`                      | `MANAGE_ROOMS` |
| GET    | `/api/Rooms/{id}`                 | `MANAGE_ROOMS` |
| POST   | `/api/Rooms`                      | `MANAGE_ROOMS` |
| PUT    | `/api/Rooms/{id}`                 | `MANAGE_ROOMS` |
| PATCH  | `/api/Rooms/{id}/status`          | `MANAGE_ROOMS` |
| PATCH  | `/api/Rooms/{id}/cleaning-status` | `MANAGE_ROOMS` |
| POST   | `/api/Rooms/bulk-create`          | `MANAGE_ROOMS` |

### AmenitiesController

| Method | Route                               | Auth                            |
| ------ | ----------------------------------- | ------------------------------- |
| GET    | `/api/Amenities`                    | Public (admin thấy cả inactive) |
| GET    | `/api/Amenities/{id}`               | Public                          |
| POST   | `/api/Amenities`                    | `MANAGE_ROOMS`                  |
| PUT    | `/api/Amenities/{id}`               | `MANAGE_ROOMS`                  |
| DELETE | `/api/Amenities/{id}`               | `MANAGE_ROOMS`                  |
| PATCH  | `/api/Amenities/{id}/toggle-active` | `MANAGE_ROOMS`                  |

### RoomInventoriesController

| Method | Route                                     | Permission         |
| ------ | ----------------------------------------- | ------------------ |
| GET    | `/api/RoomInventories/room/{roomId}`      | `MANAGE_INVENTORY` |
| GET    | `/api/RoomInventories/{id}`               | `MANAGE_INVENTORY` |
| POST   | `/api/RoomInventories`                    | `MANAGE_INVENTORY` |
| PUT    | `/api/RoomInventories/{id}`               | `MANAGE_INVENTORY` |
| DELETE | `/api/RoomInventories/{id}`               | `MANAGE_INVENTORY` |
| POST   | `/api/RoomInventories/clone`              | `MANAGE_INVENTORY` |
| PATCH  | `/api/RoomInventories/{id}/toggle-active` | `MANAGE_INVENTORY` |

### BookingsController

| Method | Route                          | Auth               |
| ------ | ------------------------------ | ------------------ |
| GET    | `/api/Bookings`                | `MANAGE_BOOKINGS`  |
| GET    | `/api/Bookings/{id}`           | `MANAGE_BOOKINGS`  |
| GET    | `/api/Bookings/my-bookings`    | `[Authorize]`      |
| POST   | `/api/Bookings`                | `[AllowAnonymous]` |
| PATCH  | `/api/Bookings/{id}/confirm`   | `MANAGE_BOOKINGS`  |
| PATCH  | `/api/Bookings/{id}/cancel`    | `[Authorize]`      |
| PATCH  | `/api/Bookings/{id}/check-in`  | `MANAGE_BOOKINGS`  |
| PATCH  | `/api/Bookings/{id}/check-out` | `MANAGE_BOOKINGS`  |

### VouchersController

| Method | Route                    | Auth                            |
| ------ | ------------------------ | ------------------------------- |
| GET    | `/api/Vouchers`          | `MANAGE_BOOKINGS`               |
| GET    | `/api/Vouchers/{id}`     | `MANAGE_BOOKINGS`               |
| POST   | `/api/Vouchers`          | `MANAGE_BOOKINGS`               |
| PUT    | `/api/Vouchers/{id}`     | `MANAGE_BOOKINGS`               |
| DELETE | `/api/Vouchers/{id}`     | `MANAGE_BOOKINGS` (soft delete) |
| POST   | `/api/Vouchers/validate` | `[Authorize]`                   |

### ReviewsController

| Method | Route                       | Auth                                                   |
| ------ | --------------------------- | ------------------------------------------------------ |
| GET    | `/api/Reviews`              | Public (filter: `?status=pending\|approved\|rejected`) |
| POST   | `/api/Reviews`              | `[Authorize]` (multipart/form-data, ảnh upload thẳng)  |
| POST   | `/api/Reviews/upload-image` | `[Authorize]`                                          |
| PATCH  | `/api/Reviews/{id}/approve` | `MANAGE_CONTENT`                                       |

### ArticleCategoriesController

| Method | Route                                       | Auth             |
| ------ | ------------------------------------------- | ---------------- |
| GET    | `/api/ArticleCategories`                    | Public           |
| GET    | `/api/ArticleCategories/{id}`               | Public           |
| POST   | `/api/ArticleCategories`                    | `MANAGE_CONTENT` |
| PUT    | `/api/ArticleCategories/{id}`               | `MANAGE_CONTENT` |
| DELETE | `/api/ArticleCategories/{id}`               | `MANAGE_CONTENT` |
| PATCH  | `/api/ArticleCategories/{id}/toggle-active` | `MANAGE_CONTENT` |

### ArticlesController

| Method | Route                              | Auth                      |
| ------ | ---------------------------------- | ------------------------- |
| GET    | `/api/Articles`                    | Public (admin thấy Draft) |
| GET    | `/api/Articles/{slug}`             | Public                    |
| POST   | `/api/Articles`                    | `MANAGE_CONTENT`          |
| PUT    | `/api/Articles/{id}`               | `MANAGE_CONTENT`          |
| DELETE | `/api/Articles/{id}`               | `MANAGE_CONTENT`          |
| PATCH  | `/api/Articles/{id}/toggle-active` | `MANAGE_CONTENT`          |
| POST   | `/api/Articles/{id}/thumbnail`     | `MANAGE_CONTENT`          |

### AttractionsController

| Method | Route                                 | Auth             |
| ------ | ------------------------------------- | ---------------- |
| GET    | `/api/Attractions`                    | Public           |
| GET    | `/api/Attractions/{id}`               | Public           |
| POST   | `/api/Attractions`                    | `MANAGE_CONTENT` |
| PUT    | `/api/Attractions/{id}`               | `MANAGE_CONTENT` |
| DELETE | `/api/Attractions/{id}`               | `MANAGE_CONTENT` |
| PATCH  | `/api/Attractions/{id}/toggle-active` | `MANAGE_CONTENT` |

### ActivityLogsController

| Method | Route                                | Auth                                        |
| ------ | ------------------------------------ | ------------------------------------------- |
| GET    | `/api/ActivityLogs/my-notifications` | `[Authorize]` (chỉ Admin/Manager nhận data) |
| PUT    | `/api/ActivityLogs/{id}/mark-read`   | `[Authorize]`                               |
| PUT    | `/api/ActivityLogs/mark-all-read`    | `[Authorize]`                               |

---

## 7. Các Tính Năng Nổi Bật

### Booking Flow

```
Pending → Confirmed → Checked_in → Completed
                ↘ Cancelled (bất cứ lúc nào)
```

- **Check-in**: Tự động tìm phòng Available cùng RoomType → gán `RoomId`, đổi `BusinessStatus = Occupied`
- **Check-out**: Đổi `BusinessStatus = Available`, `CleaningStatus = Dirty`
- **Cancel**: Giải phóng phòng về Available + Clean
- **Redis distributed lock**: Khóa slot đặt phòng 30 giây tránh double booking
- **Voucher**: Validate đầy đủ (thời hạn, usage limit, per-user limit, min booking value)
- **Email**: Gửi xác nhận booking qua MailKit (fire-and-forget) sau khi Confirm

### Phân tách trạng thái phòng

```
business_status: Available | Occupied | Disabled
cleaning_status: Clean | Dirty
```

### Email Service (MailKit + Gmail SMTP)

Có 4 template email được implement:

1. `SendBookingConfirmationAsync` — xác nhận đặt phòng
2. `SendNewStaffAccountAsync` — tài khoản nhân viên mới (gửi mật khẩu tạm)
3. `SendPasswordChangedAsync` — thông báo đổi mật khẩu
4. `SendPasswordResetByAdminAsync` — admin reset mật khẩu (gửi mật khẩu ngẫu nhiên 12 ký tự)

Tất cả email gửi theo mô hình **fire-and-forget** (`_ = _email.SendXxxAsync(...)`) để không block API response.

### Reset Password (Admin)

- `POST /api/UserManagement/{id}/reset-password`
- Generate mật khẩu random 12 ký tự (chữ hoa + thường + số + ký tự đặc biệt, tránh ký tự dễ nhầm)
- Hash bằng BCrypt, gửi email plain text đến người dùng
- Ghi AuditLog + ActivityLog

### Upload Cloudinary

- **Avatar**: Resize 500×500, crop face — `hotel_avatars/`
- **Room images**: Auto quality, `hotel/room-types/{id}/`, set primary, xóa qua `cloudinary_public_id`
- **Review images**: Limit 1200×800, `hotel/reviews/`
- **Article thumbnails**: Fill 1200×630, `hotel/articles/`, xóa ảnh cũ khi cập nhật

### Slug generation (Vietnamese-aware)

- NFD normalize → loại dấu → lowercase → replace "đ" → clean ký tự đặc biệt
- Đảm bảo unique bằng suffix `-2`, `-3`...
- Áp dụng cho: `Articles`, `ArticleCategories`

### Soft Delete Pattern

Áp dụng nhất quán cho: Amenities, RoomTypes, RoomImages, RoomInventory, Services, Articles, ArticleCategories, Attractions, Vouchers.  
Endpoint `PATCH /{id}/toggle-active` cho: RoomTypes, Amenities, RoomInventories, ArticleCategories, Articles, Attractions.

### Audit Log

Ghi tại mọi action quan trọng. Lưu: userId, action, table_name, record_id, old_value (JSON), new_value (JSON), ip_address, user_agent.

### Activity Log + Realtime

Ghi và push SignalR đồng thời tại: CreateUser, LockAccount, UnlockAccount, ChangeRole, CreateBooking, ConfirmBooking, CancelBooking, CheckIn, CheckOut, CreateRoom, UpdateRoom, DeleteRoomType, CreateAmenity, DeleteAmenity, CreateArticle, DeleteArticle, CreateAttraction, DeleteAttraction, GrantPermission, RevokePermission, CreateVoucher, UpdateVoucher, ApproveReview, RejectReview...

### Review Moderation

```
Gửi → IsApproved = false (pending) → Admin duyệt → true / từ chối kèm lý do
```

- Filter `?status=pending|approved|rejected` (Admin only)
- Public GET chỉ trả `IsApproved = true`

### Article Publishing

```
Draft → Pending_Review → Published (chỉ Admin được set Published)
```

---

## 8. Frontend — Trạng Thái Hiện Tại

### Hoàn chỉnh

| Module                      | File                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Axios client + Interceptors | `src/api/axios.js`                                                                                                                                                                                                                                                        |
| Auth store (Zustand)        | `src/store/adminAuthStore.js`                                                                                                                                                                                                                                             |
| Loading store               | `src/store/loadingStore.js`                                                                                                                                                                                                                                               |
| Notification store          | `src/store/notificationStore.js`                                                                                                                                                                                                                                          |
| SignalR hook                | `src/hooks/useSignalR.js`                                                                                                                                                                                                                                                 |
| Route guards                | `ProtectedRoute`, `RequirePermission`, `PublicOnlyRoute`                                                                                                                                                                                                                  |
| Admin layout                | `AdminLayout.jsx` (sidebar, topbar, spinner, notification bell)                                                                                                                                                                                                           |
| Login page                  | `LoginPage.jsx` (đăng nhập + modal đăng ký)                                                                                                                                                                                                                               |
| User management             | `UserListPage.jsx` (CRUD, toggle status, detail modal, reset password, export CSV)                                                                                                                                                                                        |
| Role & permission           | `RolePermissionPage.jsx` (bảng roles, modal phân quyền checkbox theo module)                                                                                                                                                                                              |
| Notification menu           | `NotificationMenu.jsx` (Popover, badge count, mark read)                                                                                                                                                                                                                  |
| 14 API client files         | `authApi`, `userManagementApi`, `userProfileApi`, `rolesApi`, `roomTypesApi`, `roomsApi`, `amenitiesApi`, `roomInventoriesApi`, `bookingsApi`, `vouchersApi`, `reviewsApi`, `articleCategoriesApi`, `articlesApi`, `attractionsApi` + `activityLogsApi`, `permissionsApi` |
| Utility functions           | `formatDate`, `formatCurrency`, `truncateText`, `buildQueryString`                                                                                                                                                                                                        |
| Constants                   | `ROLES`, `STATUS`, `STATUS_LABEL`, `ERROR_MESSAGES`                                                                                                                                                                                                                       |

### Còn thiếu (chưa implement)

- Trang Quản lý Phòng (`/admin/rooms`)
- Trang Booking Management (`/admin/bookings`)
- Trang Invoice Management
- Trang Amenities/Room Inventory
- Dashboard thực sự (charts, stats)
- `src/components/` directory (ngoài NotificationMenu)

---

## 9. Cấu Hình & Tích Hợp

### appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=MSI;Database=HotelManagementDB;...",
    "Redis": "localhost:6379,abortConnect=false"
  },
  "Jwt": {
    "Key": "...",
    "Issuer": "HotelManagement",
    "Audience": "HotelManagementUsers",
    "ExpiresInMinutes": 60
  },
  "Cloudinary": {
    "CloudName": "...",
    "ApiKey": "...",
    "ApiSecret": "..."
  },
  "Email": {
    "SmtpHost": "smtp.gmail.com",
    "SmtpPort": 587,
    "SenderEmail": "...",
    "SenderName": "Hotel Management",
    "Password": "..."
  }
}
```

### Frontend .env

```
VITE_API_URL=http://localhost:5279/api
VITE_SIGNALR_URL=http://localhost:5279
```

### Program.cs — Services đã đăng ký

| Service                                                     | Ghi chú                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `AppDbContext`                                              | EF Core SQL Server                                                           |
| JWT Bearer Auth                                             | `ClockSkew = TimeSpan.Zero`, custom 401/403 JSON, SignalR query string token |
| CORS                                                        | AllowCredentials cho SignalR, origins: localhost:5173/5174/3000              |
| `IAuthorizationPolicyProvider` → `PermissionPolicyProvider` | Singleton                                                                    |
| `IAuthorizationHandler` → `PermissionAuthorizationHandler`  | Scoped                                                                       |
| `JwtHelper`                                                 | Scoped                                                                       |
| `Cloudinary`                                                | Singleton                                                                    |
| `IConnectionMultiplexer` (Redis)                            | Singleton                                                                    |
| `IEmailService` → `EmailService`                            | Scoped                                                                       |
| `INotificationService` → `NotificationService`              | Scoped                                                                       |
| `IActivityLogService` → `ActivityLogService`                | Scoped                                                                       |
| Mapster                                                     | DI-based mapping                                                             |
| SignalR                                                     | `builder.Services.AddSignalR()`                                              |
| Swagger + Bearer                                            | Dev only                                                                     |
| `ReferenceHandler.IgnoreCycles`                             | JSON serializer                                                              |

### AppDbContext — Quy ước

- Bảng: tên custom (VD: `Room_Types`, `Audit_Logs`, `Activity_Logs`, `Activity_Log_Reads`)
- Cột: tự động PascalCase → snake_case (`RoomTypeId` → `room_type_id`)
- FK, index name cũng snake_case
- Nhiều quan hệ phức tạp: Shift có 2 FK về Users, LossAndDamage.ReportedBy → Users

---

## 10. Seed Data

| Bảng            | Số bản ghi                         |
| --------------- | ---------------------------------- |
| Roles           | 10                                 |
| Permissions     | 10                                 |
| Memberships     | 10 (Khách Mới → Signature)         |
| Users           | 10 (1 Admin, staff, 5 khách hàng)  |
| Room_Types      | 10 (Standard Single → Royal Villa) |
| Rooms           | 10                                 |
| Amenities       | 10                                 |
| Vouchers        | 10 (KM1–KM10)                      |
| Bookings        | 10                                 |
| Booking_Details | 10                                 |
| Invoices        | 10                                 |
| Payments        | 10                                 |
| Services        | 10                                 |
| Reviews         | 10                                 |
| Articles        | 10                                 |
| Attractions     | 10                                 |

**Tài khoản Admin mặc định:** `admin@hotel.com` / `Admin@123`

---

## 11. Chạy Dự Án

```bash
# 1. Tạo database — chạy HotelManagement.sql trên SQL Server

# 2. Khởi động API
dotnet run --project HotelManagement.API
# http://localhost:5279
# Swagger: http://localhost:5279/swagger

# 3. Khởi động Frontend
cd hotel-erp-frontend
npm install   # lần đầu
npm run dev
# http://localhost:5173
```

---

## 12. TODO — Còn Thiếu

### Backend

- [ ] **InvoicesController** — tạo và quản lý hóa đơn
- [ ] **ServicesController** — CRUD dịch vụ và danh mục
- [ ] **OrderServicesController** — đặt dịch vụ trong phòng
- [ ] **ShiftsController** — quản lý ca làm việc nhân viên
- [ ] **LoyaltyController** — xem và quy đổi điểm thưởng
- [ ] **ReportsController** — dashboard và báo cáo thống kê
- [ ] **PermissionsController** — GET `/api/Permissions` (endpoint đã có `permissionsApi.js` ở FE nhưng controller chưa tạo)
- [ ] **Tạo Invoice** sau check-out (TODO comment trong BookingsController)
- [ ] Rate limiting

### Frontend

- [ ] **RoomManagementPage** — danh sách, tạo, sửa phòng, đổi trạng thái
- [ ] **BookingManagementPage** — danh sách, confirm, cancel, check-in, check-out
- [ ] **InvoiceManagementPage**
- [ ] **AmenitiesPage** và **RoomInventoryPage**
- [ ] **Dashboard thực sự** — charts, KPIs, thống kê
- [ ] Các trang CMS (Articles, Attractions)
- [ ] Role/permission UI đã hoàn chỉnh ✅

### Nguyên tắc thiết kế đã thống nhất

- **"ALL" permission**: chỉ là UI convenience (checkbox "chọn tất cả") trên FE, **không** lưu DB
- **`status` vs `is_active` trên Users**: `status` = tạm khóa/mở, không có cột `is_active` riêng cho User entity
- **Email sends**: fire-and-forget để không block API response
- **Token storage**: body-based, sessionStorage (default) hoặc localStorage (Remember me)
- **EF Core over raw SQL**: nhất quán toàn project
