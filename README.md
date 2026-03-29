# HotelManagement - Tổng Hợp Dự Án

> **Stack:** .NET 10, ASP.NET Core Web API, Entity Framework Core 10, SQL Server, Redis, Cloudinary, JWT, MailKit, SignalR  
> **Kiến trúc:** 3-layer - `HotelManagement.Core` · `HotelManagement.Infrastructure` · `HotelManagement.API`  
> **Frontend:** React 19 + Vite 8 · Ant Design 6 · Zustand · Axios · React Router DOM v7 · @microsoft/signalr  
> **Tài khoản Admin:** Gmail: `admin@hotel.com` / Mật khẩu: `Admin@123`

---

## 1. Cấu Trúc Solution

```text
TestHotel/
|- HotelManagement.Core/            # Entity, DTO, Authorization, Helper
|  |- Authorization/
|  |- DTOs/
|  |- Entities/
|  `- Helpers/
|- HotelManagement.Infrastructure/  # DbContext, persistence mapping
|  `- Data/
|- HotelManagement.API/             # Controllers, Services, Hubs, Program
|  |- Controllers/
|  |- Services/
|  |- Hubs/
|  |- Policies/
|  `- Program.cs
|- hotel-erp-frontend/              # React app
|  `- src/
|     |- routes/
|     |- pages/admin/
|     |- api/
|     |- store/
|     `- hooks/
`- HotelManagement.sql              # Full schema + seed script
```

**Snapshot hiện tại:**

- Backend: 18 controllers, 98 REST endpoints (HTTP attributes).
- Domain: 32 entities trong `HotelManagement.Core/Entities`.
- Frontend: 19 API adapters (`src/api/*.js`), 8 admin pages, 3 Zustand stores.
- Database script: 32 `CREATE TABLE` statements trong `HotelManagement.sql`.

---

## 2. Cơ Sở Dữ Liệu - 7 Cluster

### Cluster 1: System, Auth & HR

| Bảng                                                | Mô tả                                              |
| --------------------------------------------------- | -------------------------------------------------- |
| `Roles`, `Permissions`, `Role_Permissions`          | Vai trò và phân quyền (RBAC)                       |
| `Users`, `Memberships`                              | Tài khoản người dùng, hạng thành viên              |
| `Audit_Logs`, `Activity_Logs`, `Activity_Log_Reads` | Audit log, notification history, trạng thái đã đọc |

### Cluster 2: Room Management

| Bảng                                          | Mô tả                                |
| --------------------------------------------- | ------------------------------------ |
| `Room_Types`, `Rooms`                         | Hạng phòng và phòng thực tế          |
| `Amenities`, `RoomType_Amenities`             | Tiện nghi và mapping theo hạng phòng |
| `Room_Images`, `Room_Inventory`, `Equipments` | Ảnh phòng và vật tư trong phòng      |

### Cluster 3: Booking & Promotions

| Bảng                          | Mô tả                               |
| ----------------------------- | ----------------------------------- |
| `Bookings`, `Booking_Details` | Luồng đặt phòng và chi tiết lưu trú |
| `Vouchers`, `Voucher_Usage`   | Voucher và lịch sử sử dụng          |

### Cluster 4: Services & Operations

| Bảng                                      | Mô tả                           |
| ----------------------------------------- | ------------------------------- |
| `Service_Categories`, `Services`          | Danh mục và dịch vụ phát sinh   |
| `Order_Services`, `Order_Service_Details` | Đơn dịch vụ theo booking detail |
| `Loss_And_Damages`                        | Biên bản mất/hỏng               |

### Cluster 5: Billing, Reviews & CMS

| Bảng                                            | Mô tả                    |
| ----------------------------------------------- | ------------------------ |
| `Invoices`, `Payments`                          | Hóa đơn và thanh toán    |
| `Reviews`                                       | Đánh giá sau lưu trú     |
| `Article_Categories`, `Articles`, `Attractions` | CMS bài viết và địa điểm |

### Cluster 6 & 7: HR & Loyalty

| Bảng                   | Mô tả                              |
| ---------------------- | ---------------------------------- |
| `Shifts`               | Ca làm việc và bàn giao            |
| `Loyalty_Transactions` | Điểm tích lũy / đổi điểm / hết hạn |

---

## 3. Hệ Thống Phân Quyền (RBAC)

### Permission Codes

```text
VIEW_DASHBOARD   MANAGE_USERS     MANAGE_ROLES
MANAGE_ROOMS     MANAGE_BOOKINGS  MANAGE_INVOICES
MANAGE_SERVICES  VIEW_REPORTS     MANAGE_CONTENT
MANAGE_INVENTORY VIEW_USERS       VIEW_ROLES
EDIT_ROLES       CREATE_USERS
```

### Cơ chế hoạt động

1. `PermissionRequirement` mang permission cần kiểm tra.
2. `PermissionPolicyProvider` tạo policy động theo permission code.
3. `PermissionAuthorizationHandler` đọc claim `permission` trong JWT để authorize.
4. `[RequirePermission(...)]` dùng cho route cần kiểm soát quyền chi tiết.

### JWT token chứa

- Claim nhận diện: `sub`, `email`, `jti`, `role`, `full_name`.
- Claim quyền: nhiều claim `permission` (mỗi quyền là một claim).

---

## 4. Authentication - Auth Flow

### Endpoints

| Method | Route                     | Mô tả                                       |
| ------ | ------------------------- | ------------------------------------------- |
| POST   | `/api/Auth/login`         | Đăng nhập, trả access token + refresh token |
| POST   | `/api/Auth/register`      | Đăng ký tài khoản mới                       |
| POST   | `/api/Auth/refresh-token` | Làm mới access token bằng refresh token     |
| POST   | `/api/Auth/logout`        | Thu hồi refresh token                       |

### Đặc điểm

- JWT bearer validate issuer/audience/lifetime/signing key, `ClockSkew = 0`.
- Refresh token rotation (mỗi lần refresh sinh refresh token mới).
- Token cho SignalR được lấy từ query `access_token` tại `/notificationHub`.

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
- Kết nối client được add vào group theo role để gửi thông báo đúng đối tượng.

### NotificationPolicy

- Action code -> danh sách role nhận thông báo.
- Action không có mapping explicit -> mặc định gửi cho `Admin` và `Manager`.

### Activity_Log_Reads

- Theo dõi trạng thái đã đọc theo từng user.
- Hỗ trợ API `mark-read` và `mark-all-read`.

### Frontend (useSignalR + notificationStore)

- `useSignalR` tạo realtime connection + fetch history thông báo.
- `notificationStore` quản lý danh sách và unread count.

---

## 6. Controllers & API Endpoints

### Tổng quan API hiện tại

| Controller                    | Prefix                   | Số endpoint |
| ----------------------------- | ------------------------ | ----------: |
| `AuthController`              | `/api/Auth`              |           4 |
| `UserManagementController`    | `/api/UserManagement`    |           8 |
| `UserProfileController`       | `/api/UserProfile`       |           4 |
| `RolesController`             | `/api/Roles`             |           4 |
| `PermissionsController`       | `/api/Permissions`       |           1 |
| `ActivityLogsController`      | `/api/ActivityLogs`      |           3 |
| `RoomsController`             | `/api/Rooms`             |           7 |
| `RoomTypesController`         | `/api/RoomTypes`         |          11 |
| `AmenitiesController`         | `/api/Amenities`         |           6 |
| `RoomInventoriesController`   | `/api/RoomInventories`   |           7 |
| `EquipmentsController`        | `/api/Equipments`        |           1 |
| `LossAndDamagesController`    | `/api/LossAndDamages`    |           5 |
| `BookingsController`          | `/api/Bookings`          |           8 |
| `VoucherController`           | `/api/Voucher`           |           6 |
| `ReviewController`            | `/api/Review`            |           4 |
| `ArticleCategoriesController` | `/api/ArticleCategories` |           6 |
| `ArticlesController`          | `/api/Articles`          |           7 |
| `AttractionsController`       | `/api/Attractions`       |           6 |

### Ma trận endpoint trọng tâm

| Nhóm              | Endpoint chính                                                                       |
| ----------------- | ------------------------------------------------------------------------------------ |
| Auth              | `/api/Auth/login`, `/api/Auth/refresh-token`, `/api/Auth/logout`                     |
| User & Role       | `/api/UserManagement/*`, `/api/UserProfile/*`, `/api/Roles/*`, `/api/Permissions`    |
| Room Ops          | `/api/Rooms/*`, `/api/RoomTypes/*`, `/api/Amenities/*`, `/api/RoomInventories/*`     |
| Booking & Voucher | `/api/Bookings/*`, `/api/Voucher/*`                                                  |
| Content & Review  | `/api/Articles/*`, `/api/ArticleCategories/*`, `/api/Attractions/*`, `/api/Review/*` |
| Realtime          | `/api/ActivityLogs/my-notifications`, `/notificationHub`                             |

---

## 7. Các Tính Năng Nổi Bật

### Booking Flow

```text
Pending -> Confirmed -> Checked_in -> Completed
              \-> Cancelled
```

- **Create booking:** overlap check và có Redis lock 30s để giảm nguy cơ double booking.
- **Voucher validate:** active, valid date, usage limit, min booking value, discount type.
- **Confirm:** đổi trạng thái `Pending -> Confirmed` và gửi email xác nhận (fire-and-forget).
- **Check-in:** auto gán phòng `BusinessStatus=Available` theo `RoomTypeId`, đổi sang `Occupied`.
- **Check-out:** trả phòng về `BusinessStatus=Available`, `CleaningStatus=Dirty`, đổi booking `Completed`.
- **Cancel:** set `Cancelled`, giải phóng room đang gán về `Available` + `Clean`.

### Room state model

```text
business_status: Available | Occupied | Disabled
cleaning_status: Clean | Dirty
```

### Email Service (MailKit)

4 template đã implement:

1. `SendBookingConfirmationAsync`
2. `SendNewStaffAccountAsync`
3. `SendPasswordChangedAsync`
4. `SendPasswordResetByAdminAsync`

Tất cả email được gọi theo fire-and-forget để không block response API.

### Cloudinary uploads

- Avatar (`UserProfileController`).
- Room type images (`RoomTypesController`).
- Review images (`ReviewController`).
- Article thumbnail (`ArticlesController`).

### Slug generation

- Có xử lý tiếng Việt (bỏ dấu, lower, làm sạch ký tự đặc biệt).
- Có conflict resolver với suffix `-2`, `-3`, ...
- Đang áp dụng cho `Articles`, `ArticleCategories`.

### Soft delete / toggle active

Đang dùng trên nhóm module quản trị nội dung và danh mục: `RoomTypes`, `Amenities`, `RoomInventories`, `Articles`, `ArticleCategories`, `Attractions`, `Vouchers` (tùy endpoint cụ thể theo từng controller).

### Logging

- **Audit log:** ghi lại old/new value cho hành động quan trọng.
- **Activity log:** vừa lưu DB vừa đẩy thông báo realtime theo `NotificationPolicy`.

---

## 8. Frontend - Trạng Thái Hiện Tại

### Đã implement

| Module                           | File                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Auth + route guards              | `src/routes/AdminRoutes.jsx`, `ProtectedRoute.jsx`, `RequirePermission.jsx`, `PublicOnlyRoute.jsx` |
| Login page                       | `src/pages/LoginPage.jsx`                                                                          |
| Admin layout + notification UI   | `src/layouts/AdminLayout.jsx`, `src/components/NotificationMenu.jsx`                               |
| Dashboard page (có gọi API thật) | `src/pages/admin/DashboardPage.jsx`                                                                |
| User management                  | `src/pages/admin/UserListPage.jsx`                                                                 |
| Role & permission                | `src/pages/admin/RolePermissionPage.jsx`                                                           |
| Room management + room detail    | `src/pages/admin/RoomManagementPage.jsx`, `src/pages/admin/RoomDetailPage.jsx`                     |
| Room type management             | `src/pages/admin/RoomTypesPage.jsx`                                                                |
| Equipment listing                | `src/pages/admin/EquipmentPage.jsx`                                                                |
| Loss & damage management         | `src/pages/admin/Lossanddamagepage.jsx`                                                            |
| Axios + 19 API adapters          | `src/api/*.js`                                                                                     |
| Zustand stores                   | `src/store/adminAuthStore.js`, `src/store/loadingStore.js`, `src/store/notificationStore.js`       |
| SignalR hook                     | `src/hooks/useSignalR.js`                                                                          |

### Đang placeholder / chưa có route page đầy đủ

- `/admin/bookings` hiện đang là `ComingSoonPage`.
- Chưa có route quản trị cho invoice, services, shifts, loyalty, reports.
- Chưa có route admin cho CMS bài viết/attraction/review moderation (dù API đã có).

---

## 9. Cấu Hình & Tích Hợp

### Backend runtime (`appsettings.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=HotelManagementDB;...",
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

### Frontend env

```bash
VITE_API_URL=http://localhost:5279/api
```

`useSignalR` đang suy ra hub URL từ `VITE_API_URL` (không đọc trực tiếp `VITE_SIGNALR_URL`).

### Program.cs - services đã đăng ký

- `AppDbContext` (SQL Server)
- JWT Bearer auth + custom 401/403 JSON
- CORS policy `AllowFrontend` (có `AllowCredentials` cho SignalR)
- RBAC services: `PermissionPolicyProvider`, `PermissionAuthorizationHandler`
- `JwtHelper`
- `IConnectionMultiplexer` (Redis)
- `IEmailService`, `INotificationService`, `IActivityLogService`
- `Cloudinary` singleton
- Mapster
- SignalR hub mapping `/notificationHub`
- Swagger (Development)

### Lưu ý bảo mật

`appsettings.json` hiện đang chứa thông tin nhạy cảm thực tế (DB, JWT key, Cloudinary, SMTP). Nên rotate secrets và chuyển sang User Secrets / environment variables trước khi deploy.

---

## 10. Seed Data

Script `HotelManagement.sql` đang seed dữ liệu mẫu theo thứ tự cha-trước-con.

| Bảng                  | Số bản ghi INSERT |
| --------------------- | ----------------: |
| Roles                 |                10 |
| Permissions           |                14 |
| Memberships           |                10 |
| Users                 |                10 |
| Role_Permissions      |                10 |
| Amenities             |                10 |
| Room_Types            |                10 |
| Rooms                 |                14 |
| Room_Images           |                10 |
| Equipments            |                21 |
| Room_Inventory        |               187 |
| Vouchers              |                10 |
| Bookings              |                10 |
| Booking_Details       |                10 |
| Invoices              |                10 |
| Payments              |                10 |
| Service_Categories    |                10 |
| Services              |                10 |
| Order_Services        |                10 |
| Order_Service_Details |                10 |
| Loss_And_Damages      |                 6 |
| Reviews               |                10 |
| Article_Categories    |                10 |
| Articles              |                10 |
| Attractions           |                10 |
| Audit_Logs            |                10 |

---

## 11. Chạy Dự Án

```bash
# 1) Tạo DB
# Chạy file HotelManagement.sql trên SQL Server (database: HotelManagementDB)

# 2) Chạy API
 dotnet run --project HotelManagement.API
# http://localhost:5279
# Swagger: http://localhost:5279/swagger

# 3) Chạy Frontend
cd hotel-erp-frontend
npm install
npm run dev
# http://localhost:5173
```

Prerequisites để chạy đầy đủ:

- .NET SDK 10
- Node.js (khuyến nghị >= 20)
- SQL Server
- Redis

---

## 12. TODO - Còn Thiếu

### Backend

- [ ] `InvoicesController` (CRUD/settlement hóa đơn).
- [ ] `ServicesController` + `ServiceCategoriesController` cho quản trị dịch vụ.
- [ ] `OrderServicesController` cho ordering theo phòng.
- [ ] `ShiftsController` cho quản lý ca.
- [ ] `LoyaltyController` cho điểm tích lũy/đổi điểm.
- [ ] `ReportsController` cho dashboard KPI server-side.
- [ ] Hoàn thiện luồng tạo `Invoice` sau check-out (hiện có TODO trong `BookingsController`).

### Frontend

- [ ] Booking management page thực tế (thay `ComingSoonPage` tại `/admin/bookings`).
- [ ] Invoice management pages.
- [ ] Service/order-service management pages.
- [ ] CMS pages cho Articles/Attractions/Review moderation.
- [ ] Dashboard charts có backend aggregate endpoint (hiện đang tổng hợp client-side từ nhiều API).

### Nguyên tắc đã thống nhất trong code

- RBAC dựa trên `permission` claims, không có "ALL permission" lưu DB.
- `status` (Users) được dùng để lock/unlock tài khoản.
- Email gửi bất đồng bộ (fire-and-forget).
- EF Core là persistence layer chính, script SQL dùng cho khởi tạo/seed.
