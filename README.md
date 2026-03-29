# 🏨 HotelManagement — Tổng Hợp Dự Án

> **Stack:** .NET 10 · ASP.NET Core Web API · Entity Framework Core 10 · SQL Server · Redis · Cloudinary · JWT · MailKit · SignalR  
> **Kiến trúc:** 3-layer — `HotelManagement.Core` · `HotelManagement.Infrastructure` · `HotelManagement.API`  
> **Frontend:** React 19 + Vite 8 · Ant Design 6 · Zustand · Axios · React Router DOM v7 · @microsoft/signalr

---

## 1. Cấu Trúc Solution

```
TestHotel/
├── HotelManagement.Core/            # Entity, DTO, Authorization, Helper
│   ├── Authorization/
│   ├── DTOs/
│   ├── Entities/
│   └── Helpers/
├── HotelManagement.Infrastructure/  # DbContext, persistence mapping
│   └── Data/
├── HotelManagement.API/             # Controllers, Services, Hubs, Program
│   ├── Controllers/
│   ├── Services/
│   ├── Hubs/
│   └── Program.cs
└── hotel-erp-frontend/              # React app (routes, api, store)
    └── src/
        ├── routes/
        ├── api/
        └── store/
```

Monorepo chứa backend + frontend trong cùng git root.

---

## 2. Cơ Sở Dữ Liệu — 7 Cluster

### Cluster 1: System, Auth & HR

| Bảng                                                | Mô tả                                           |
| --------------------------------------------------- | ----------------------------------------------- |
| `Roles`, `Permissions`, `Role_Permissions`          | Vai trò và phân quyền (RBAC)                    |
| `Users`, `Memberships`                              | Tài khoản người dùng, hạng thành viên           |
| `Audit_Logs`, `Activity_Logs`, `Activity_Log_Reads` | Nhật ký hệ thống và trạng thái đã đọc thông báo |

### Cluster 2: Room Management

| Bảng                                          | Mô tả                                         |
| --------------------------------------------- | --------------------------------------------- |
| `Room_Types`, `Rooms`                         | Danh mục hạng phòng và phòng thực tế          |
| `Amenities`, `RoomType_Amenities`             | Tiện nghi và ánh xạ tiện nghi theo hạng phòng |
| `Room_Images`, `Room_Inventory`, `Equipments` | Ảnh phòng và vật tư phòng                     |

### Cluster 3: Booking & Promotions

| Bảng                          | Mô tả                               |
| ----------------------------- | ----------------------------------- |
| `Bookings`, `Booking_Details` | Luồng đặt phòng và chi tiết lưu trú |
| `Vouchers`, `Voucher_Usage`   | Mã giảm giá và lịch sử sử dụng      |

### Cluster 4: Services & Operations

| Bảng                                      | Mô tả                         |
| ----------------------------------------- | ----------------------------- |
| `Service_Categories`, `Services`          | Danh mục và dịch vụ phát sinh |
| `Order_Services`, `Order_Service_Details` | Đơn dịch vụ theo booking      |
| `Loss_And_Damages`                        | Biên bản mất/hỏng             |

### Cluster 5: Billing, Reviews & CMS

| Bảng                                            | Mô tả                    |
| ----------------------------------------------- | ------------------------ |
| `Invoices`, `Payments`                          | Hóa đơn và thanh toán    |
| `Reviews`                                       | Đánh giá sau lưu trú     |
| `Article_Categories`, `Articles`, `Attractions` | CMS nội dung và điểm đến |

### Cluster 6 & 7: HR & Loyalty

| Bảng                   | Mô tả                          |
| ---------------------- | ------------------------------ |
| `Shifts`               | Ca làm việc và bàn giao        |
| `Loyalty_Transactions` | Điểm tích lũy/đổi điểm/hết hạn |

---

## 3. Hệ Thống Phân Quyền (RBAC)

### Permission Codes

```text
VIEW_DASHBOARD   MANAGE_USERS    MANAGE_ROLES
MANAGE_ROOMS     MANAGE_BOOKINGS MANAGE_INVOICES
MANAGE_SERVICES  VIEW_REPORTS    MANAGE_CONTENT
MANAGE_INVENTORY
```

### Cơ chế hoạt động

1. `PermissionRequirement` mang permission cần kiểm tra.
2. `PermissionPolicyProvider` tạo policy động theo permission code.
3. `PermissionAuthorizationHandler` đọc claim `permission` trong JWT để authorize.
4. `[RequirePermission(...)]` dùng cho route cần kiểm soát quyền chi tiết.

### JWT Token chứa

- Claim nhận diện: `sub`, `email`, `jti`, `role`, `full_name`
- Claim quyền: nhiều claim `permission` (mỗi quyền là một claim)

---

## 4. Authentication — Auth Flow

### Endpoints

| Method | Route                     | Mô tả                                       |
| ------ | ------------------------- | ------------------------------------------- |
| POST   | `/api/Auth/login`         | Đăng nhập, trả access token + refresh token |
| POST   | `/api/Auth/register`      | Đăng ký tài khoản mới                       |
| POST   | `/api/Auth/refresh-token` | Làm mới access token bằng refresh token     |
| POST   | `/api/Auth/logout`        | Thu hồi refresh token                       |

### Đặc điểm

- Dùng JWT bearer cho API auth.
- Hỗ trợ refresh token rotation để giảm nguy cơ replay.
- Permission claims nằm trong access token để thực thi RBAC tại API.

---

## 5. Hệ Thống Thông Báo (SignalR + Activity Log)

### Kiến trúc

```text
Controller action
  -> IActivityLogService.LogAsync()
    -> lưu Activity_Logs
    -> INotificationService.SendToRolesAsync()
      -> SignalR Hub -> client ReceiveNotification
```

### NotificationHub (`/notificationHub`)

- Yêu cầu xác thực (`[Authorize]`).
- Hỗ trợ lấy token từ query `access_token` cho kết nối WebSocket.
- Kết nối client được định tuyến theo role để nhận thông báo phù hợp.

### NotificationPolicy

- Ánh xạ action code sang danh sách role nhận thông báo.
- Có default recipient cho action chưa được map tường minh.

### Activity_Log_Reads

- Theo dõi trạng thái đọc theo từng user.
- Hỗ trợ `mark-read` và `mark-all-read` cho notification center.

### Frontend (useSignalR.js + notificationStore)

- `useSignalR` khởi tạo realtime connection.
- `notificationStore` quản lý danh sách + số lượng chưa đọc.

---

## 6. Controllers & API Endpoints

Bảng dưới là endpoint trọng yếu theo docs hiện tại.

### AuthController

| Method | Route             | Quyền  |
| ------ | ----------------- | ------ |
| POST   | `/api/Auth/login` | Public |

### AmenitiesController

| Method | Route            | Quyền              |
| ------ | ---------------- | ------------------ |
| GET    | `/api/Amenities` | Public/admin-aware |

### RolesController

| Method | Route                       | Quyền     |
| ------ | --------------------------- | --------- |
| GET    | `/api/Roles/my-permissions` | Authorize |

### Frontend API/Route Matrix (tóm tắt)

| Loại           | Mục tiêu                                                       | Nguồn                        |
| -------------- | -------------------------------------------------------------- | ---------------------------- |
| Route guard    | `/login`, `/admin/dashboard`, `/admin/roles`                   | `src/routes/AdminRoutes.jsx` |
| API adapter    | `getAmenities`, `createAmenity`, `login`                       | `src/api/*.js`               |
| Zustand stores | `useAdminAuthStore`, `useNotificationStore`, `useLoadingStore` | `src/store/*.js`             |

TODO(verify): cập nhật full endpoint matrix khi hoàn tất bảng chi tiết trong `docs/ai-context/_generated/*.md`.

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
