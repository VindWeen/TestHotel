# HotelManagement - Tổng Hợp Dự Án

> **Stack:** .NET 10, ASP.NET Core Web API, Entity Framework Core 10, SQL Server, Redis, Cloudinary, JWT, MailKit, SignalR  
> **Kiến trúc:** 4 project trong solution - `HotelManagement.Core` · `HotelManagement.Infrastructure` · `HotelManagement.API` · `HotelManagement.Tests`  
> **Frontend:** React 19 + Vite 8 · Ant Design 6 · Zustand · Axios · React Router DOM v7 · `@microsoft/signalr`

---

## 1. Cấu Trúc Solution

```text
TestHotel/
|- HotelManagement.Core/              # Entity, DTO, Authorization, Helper
|  |- Authorization/
|  |- DTOs/
|  |- Entities/
|  `- Helpers/
|- HotelManagement.Infrastructure/    # AppDbContext, mapping persistence
|  `- Data/
|- HotelManagement.API/               # Controllers, Services, Hubs, Middleware, Program
|  |- Controllers/
|  |- Hubs/
|  |- Middleware/
|  |- Services/
|  `- Program.cs
|- HotelManagement.Tests/             # Unit/integration/contract tests
|- hotel-erp-frontend/                # React admin app
|  `- src/
|     |- api/
|     |- hooks/
|     |- layouts/
|     |- pages/admin/
|     |- routes/
|     `- store/
|- docs/ai-context/                   # Guide và tài liệu nội bộ cho AI
`- HotelManagement.sql                # Full schema + seed script
```

**Snapshot hiện tại**

- Backend: 20 controllers, 115 REST endpoints theo HTTP attributes.
- Domain: 32 entities trong `HotelManagement.Core/Entities`.
- Frontend: 21 API adapters, 13 admin pages, 3 Zustand stores, 1 SignalR hook.
- Database script: 32 bảng trong `HotelManagement.sql`.

---

## 2. Cơ Sở Dữ Liệu - 7 Cluster

### Cluster 1: System, Auth & HR

| Bảng                                                | Mô tả                                              |
| --------------------------------------------------- | -------------------------------------------------- |
| `Roles`, `Permissions`, `Role_Permissions`          | Vai trò và phân quyền RBAC                         |
| `Users`, `Memberships`                              | Tài khoản hệ thống và hạng thành viên              |
| `Audit_Logs`, `Activity_Logs`, `Activity_Log_Reads` | Audit log, thông báo hệ thống và trạng thái đã đọc |

### Cluster 2: Room Management

| Bảng                                          | Mô tả                                                  |
| --------------------------------------------- | ------------------------------------------------------ |
| `Room_Types`, `Rooms`                         | Hạng phòng và phòng vật lý                             |
| `Amenities`, `RoomType_Amenities`             | Tiện ích theo hạng phòng                               |
| `Room_Images`, `Room_Inventory`, `Equipments` | Ảnh phòng, vật tư trong phòng và kho vật tư tổng       |

**Điểm mới trong `Rooms`**

- Có lưu baseline đồng bộ vật tư phòng:
  - `inventory_sync_snapshot_json`
  - `inventory_last_synced_at`
  - `inventory_version`

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
| `Loss_And_Damages`                        | Biên bản mất/hỏng vật tư        |

### Cluster 5: Billing, Reviews & CMS

| Bảng                                            | Mô tả                    |
| ----------------------------------------------- | ------------------------ |
| `Invoices`, `Payments`                          | Hóa đơn và thanh toán    |
| `Reviews`                                       | Đánh giá sau lưu trú     |
| `Article_Categories`, `Articles`, `Attractions` | CMS bài viết và địa điểm |

### Cluster 6 & 7: HR & Loyalty

| Bảng                   | Mô tả                            |
| ---------------------- | -------------------------------- |
| `Shifts`               | Ca làm việc và bàn giao          |
| `Loyalty_Transactions` | Điểm tích lũy, đổi điểm, hết hạn |

---

## 3. Hệ Thống Phân Quyền (RBAC)

### Permission Codes

```text
VIEW_DASHBOARD   MANAGE_USERS      CREATE_USERS
VIEW_USERS       MANAGE_ROLES      VIEW_ROLES
EDIT_ROLES       MANAGE_ROOMS      MANAGE_INVENTORY
MANAGE_BOOKINGS  MANAGE_INVOICES   MANAGE_SERVICES
VIEW_REPORTS     MANAGE_CONTENT
```

### Cơ chế hoạt động

1. `PermissionRequirement` mang permission cần kiểm tra.
2. `PermissionPolicyProvider` tạo policy động theo permission code.
3. `PermissionAuthorizationHandler` đọc claim `permission` trong JWT để authorize.
4. `[RequirePermission(...)]` được gắn ở controller/action cần kiểm soát quyền chi tiết.

### JWT token chứa

- Claim nhận diện: `sub`, `email`, `jti`, `role`, `full_name`.
- Claim quyền: nhiều claim `permission`, mỗi quyền là một claim riêng.

---

## 4. Authentication - Auth Flow

### Endpoints

| Method | Route                       | Mô tả                                       |
| ------ | --------------------------- | ------------------------------------------- |
| POST   | `/api/Auth/login`           | Đăng nhập, trả access token + refresh token |
| POST   | `/api/Auth/register`        | Đăng ký tài khoản mới                       |
| POST   | `/api/Auth/refresh-token`   | Làm mới access token bằng refresh token     |
| POST   | `/api/Auth/logout`          | Thu hồi refresh token                       |
| POST   | `/api/Auth/forgot-password` | Yêu cầu reset mật khẩu                      |

### Đặc điểm

- JWT Bearer validate issuer, audience, lifetime, signing key, `ClockSkew = 0`.
- Refresh token rotation, mỗi lần refresh sinh refresh token mới.
- Token cho SignalR được đọc từ query `access_token` tại `/notificationHub`.

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

- Yêu cầu xác thực.
- Client được add vào group theo role để nhận thông báo đúng đối tượng.

### NotificationPolicy / Activity Logs

- Action code được map sang danh sách role nhận thông báo.
- Nếu action chưa có mapping cụ thể thì mặc định gửi cho `Admin` và `Manager`.
- `Activity_Log_Reads` theo dõi trạng thái đã đọc theo từng user.

### Frontend

- `useSignalR` tạo kết nối realtime và nạp lịch sử thông báo.
- `notificationStore` quản lý danh sách thông báo và unread count.

---

## 6. Controllers & API Endpoints

### Tổng quan API hiện tại

| Controller                    | Prefix                   | Số endpoint |
| ----------------------------- | ------------------------ | ----------: |
| `ActivityLogsController`      | `/api/ActivityLogs`      |           3 |
| `AmenitiesController`         | `/api/Amenities`         |           6 |
| `ArticleCategoriesController` | `/api/ArticleCategories` |           6 |
| `ArticlesController`          | `/api/Articles`          |           7 |
| `AttractionsController`       | `/api/Attractions`       |           6 |
| `AuthController`              | `/api/Auth`              |           5 |
| `BookingController`           | `/api/Booking`           |           9 |
| `EquipmentsController`        | `/api/Equipments`        |           6 |
| `InvoicesController`          | `/api/Invoices`          |           6 |
| `LossAndDamagesController`    | `/api/LossAndDamages`    |           5 |
| `PaymentsController`          | `/api/Payments`          |           1 |
| `PermissionsController`       | `/api/Permissions`       |           1 |
| `ReviewController`            | `/api/Review`            |           4 |
| `RolesController`             | `/api/Roles`             |           4 |
| `RoomInventoriesController`   | `/api/RoomInventories`   |          10 |
| `RoomsController`             | `/api/Rooms`             |           7 |
| `RoomTypesController`         | `/api/RoomTypes`         |          11 |
| `UserManagementController`    | `/api/UserManagement`    |           8 |
| `UserProfileController`       | `/api/UserProfile`       |           4 |
| `VoucherController`           | `/api/Voucher`           |           6 |

### Ma trận endpoint trọng tâm

| Nhóm              | Endpoint chính |
| ----------------- | -------------- |
| Auth              | `/api/Auth/login`, `/api/Auth/refresh-token`, `/api/Auth/logout`, `/api/Auth/forgot-password` |
| User & Role       | `/api/UserManagement/*`, `/api/UserProfile/*`, `/api/Roles/*`, `/api/Permissions` |
| Room Ops          | `/api/Rooms/*`, `/api/RoomTypes/*`, `/api/Amenities/*`, `/api/RoomInventories/*` |
| Inventory Sync    | `/api/RoomInventories/preview-sync-stock`, `/api/RoomInventories/sync-stock`, `/api/Equipments/preview-sync-inuse`, `/api/Equipments/sync-inuse` |
| Booking & Voucher | `/api/Booking/*`, `/api/Voucher/*` |
| Billing           | `/api/Invoices/*`, `/api/Payments/*`, `/api/LossAndDamages/*` |
| Content & Review  | `/api/Articles/*`, `/api/ArticleCategories/*`, `/api/Attractions/*`, `/api/Review/*` |
| Realtime          | `/api/ActivityLogs/*`, `/notificationHub` |

---

## 7. Các Tính Năng Nổi Bật

### Booking Flow

```text
Pending -> Confirmed -> Checked_in -> Completed
              \-> Cancelled
```

- Tạo booking có overlap check và Redis lock để giảm nguy cơ double booking.
- Voucher được validate theo ngày hiệu lực, usage limit, min booking value và kiểu discount.
- Check-in tự động gán phòng khả dụng theo `RoomTypeId`, đổi `BusinessStatus` sang `Occupied`.
- Check-out trả phòng về `BusinessStatus=Available`, `CleaningStatus=Dirty`, đồng thời hoàn tất booking.

### Room state model

```text
business_status: Available | Occupied | Disabled
cleaning_status: Clean | Dirty
status nội suy: Available | Occupied | Cleaning | Maintenance
```

### Đồng bộ vật tư phòng và kho

- `RoomDetailPage` có preview chênh lệch vật tư của riêng phòng so với snapshot trước đó.
- Sync theo phòng cập nhật `Equipments.in_use_quantity` bằng delta của chính phòng rồi lưu snapshot/version mới.
- `EquipmentPage` có sync tổng hợp toàn hệ thống với preview:
  - `Trước` = `in_use_quantity` hiện tại
  - `Sau` = tổng active từ tất cả `Room_Inventory`
  - `Chênh lệch` = `Sau - Trước`
- Sync tổng cũng đồng bộ snapshot cho từng phòng trước khi chuẩn hóa lại `in_use_quantity`.
- Thêm lại vật tư đã soft delete trong phòng sẽ ưu tiên kích hoạt lại dòng cũ thay vì tạo dòng mới.
- Thêm cùng `equipmentId` đã tồn tại active trong cùng phòng sẽ cập nhật dòng hiện có thay vì insert trùng.

### Tạo phòng theo wizard

- Tạo 1 phòng giữ flow 3 bước:
  - Thông tin chính
  - Tiện ích
  - Vật tư & Minibar
- Có chế độ tạo phòng hàng loạt ngay trong cùng wizard:
  - nhập block theo tầng và dải số phòng
  - có thể chọn 1 phòng mẫu để clone vật tư cho toàn bộ batch
  - sau khi tạo sẽ clone vật tư và sync snapshot/kho cho các phòng vừa tạo

### Housekeeping flow

- Trang housekeeping chỉ hiển thị các phòng cần dọn, không còn hiện dòng status thừa trên card.
- Quy trình dọn phòng gồm xác nhận dọn xong, kiểm kê hao hụt/minibar, tạo `Loss_And_Damages`, rồi đổi lại trạng thái phòng.

### Uploads, slug, email và logging

- Cloudinary đang được dùng cho avatar, ảnh hạng phòng, review, article thumbnail.
- Slug generation có xử lý tiếng Việt và resolve suffix `-2`, `-3`, ...
- Email gửi qua MailKit theo kiểu fire-and-forget.
- Audit log lưu old/new value cho hành động quan trọng; activity log vừa lưu DB vừa đẩy realtime.

---

## 8. Frontend - Trạng Thái Hiện Tại

### Đã implement

| Module                         | File chính |
| ------------------------------ | ---------- |
| Auth + route guards            | `src/routes/AdminRoutes.jsx`, `ProtectedRoute.jsx`, `RequirePermission.jsx`, `PublicOnlyRoute.jsx` |
| Admin layout + notification UI | `src/layouts/AdminLayout.jsx`, `src/hooks/useSignalR.js`, `src/store/notificationStore.js` |
| Dashboard                      | `src/pages/admin/DashboardPage.jsx` |
| User management                | `src/pages/admin/UserListPage.jsx` |
| Role & permission              | `src/pages/admin/RolePermissionPage.jsx` |
| Room management                | `src/pages/admin/RoomManagementPage.jsx`, `src/pages/admin/RoomDetailPage.jsx` |
| Room types                     | `src/pages/admin/RoomTypesPage.jsx` |
| Housekeeping                   | `src/pages/admin/HousekeepingPage.jsx` |
| Equipment / kho vật tư         | `src/pages/admin/EquipmentPage.jsx` |
| Loss & damage                  | `src/pages/admin/LossAndDamagePage.jsx` |
| Booking                        | `src/pages/admin/BookingListPage.jsx`, `src/pages/admin/BookingDetailPage.jsx` |
| Invoice                        | `src/pages/admin/InvoiceListPage.jsx`, `src/pages/admin/InvoiceDetailPage.jsx` |
| API adapters                   | `src/api/*.js` (21 file) |
| State                          | `src/store/adminAuthStore.js`, `src/store/loadingStore.js`, `src/store/notificationStore.js` |

### Đã có route admin

- `/admin/dashboard`
- `/admin/rooms`
- `/admin/rooms/:id`
- `/admin/housekeeping`
- `/admin/room-types`
- `/admin/items`
- `/admin/bookings`
- `/admin/bookings/:id`
- `/admin/invoices`
- `/admin/invoices/:id`
- `/admin/staff`
- `/admin/roles`
- `/admin/loss-damage`

### Chưa có page quản trị đầy đủ

- Service / order service management
- Shift / loyalty / reports
- CMS admin cho article, attraction, review moderation

---

## 9. Cấu Hình & Tích Hợp

### Backend runtime (`appsettings.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=<server>;Database=HotelManagementDB;...",
    "Redis": "localhost:6379,abortConnect=false"
  },
  "Jwt": {
    "Key": "<jwt-secret>",
    "Issuer": "HotelManagement",
    "Audience": "HotelManagementUsers",
    "ExpiresInMinutes": 60
  },
  "Cloudinary": {
    "CloudName": "<cloud-name>",
    "ApiKey": "<api-key>",
    "ApiSecret": "<api-secret>"
  },
  "Email": {
    "SmtpHost": "smtp.gmail.com",
    "SmtpPort": 587,
    "SenderEmail": "<sender-email>",
    "SenderName": "Hotel Management",
    "Password": "<smtp-password>"
  }
}
```

### Frontend env

```bash
VITE_API_URL=http://localhost:5279/api
```

`useSignalR` đang suy ra hub URL từ `VITE_API_URL`, không dùng biến hub riêng.

### Program.cs - services đã đăng ký

- `AppDbContext` dùng SQL Server
- JWT Bearer auth + custom 401/403 JSON
- CORS policy `AllowFrontend` có `AllowCredentials` cho SignalR
- RBAC services: `PermissionPolicyProvider`, `PermissionAuthorizationHandler`
- `IConnectionMultiplexer` cho Redis
- `INotificationService`, `IEmailService`, `IActivityLogService`, `IAuditTrailService`
- `IBookingService`, `IInvoiceService`, `IPaymentService`, `IBookingStatusFlowService`, `IVoucherValidationService`
- `Cloudinary` singleton
- Mapster, FluentValidation, SignalR, Swagger

### Lưu ý bảo mật

- `appsettings.json` trong repo hiện đang chứa secrets thật. Nên rotate toàn bộ secrets và chuyển sang User Secrets hoặc environment variables trước khi deploy.
- `README.md` này chỉ giữ ví dụ placeholder, không lặp lại giá trị thật.

---

## 10. Seed Data

Script `HotelManagement.sql` hiện tạo đầy đủ schema và seed dữ liệu mẫu cho các cụm chính:

- RBAC: roles, permissions, role-permissions
- Users, memberships
- Room types, rooms, amenities, room images
- Equipments và `Room_Inventory`
- Vouchers, bookings, booking details
- Invoices, payments
- Service categories, services, orders
- Loss & damages
- Reviews, article categories, articles, attractions
- Audit logs, activity logs, activity log reads

Một vài mốc đáng chú ý từ script hiện tại:

- `Permissions`: 14 bản ghi seed
- `Equipments`: 21 bản ghi seed
- `Rooms`: 14 bản ghi seed
- `Room_Inventory`: 187 bản ghi seed
- `Loss_And_Damages`: 6 bản ghi seed

---

## 11. Chạy Dự Án

```bash
# 1) Tạo DB
# Chạy file HotelManagement.sql trên SQL Server (database: HotelManagementDB)

# 2) Chạy API
dotnet run --project HotelManagement.API
# API: http://localhost:5279
# Swagger: http://localhost:5279/swagger

# 3) Chạy Frontend
cd hotel-erp-frontend
npm install
npm run dev
# Frontend: http://localhost:5173
```

Prerequisites:

- .NET SDK 10
- Node.js >= 20
- SQL Server
- Redis

---

## 12. TODO - Còn Thiếu

### Backend

- [ ] Mở rộng quản trị dịch vụ và order service ở mức đầy đủ.
- [ ] Hoàn thiện shift / loyalty / report endpoints.
- [ ] Rà lại response contract và build verification cho toàn solution.
- [ ] TODO(verify): đánh giá lại có nên giữ `HotelManagement.Tests` trong solution hay loại bỏ.

### Frontend

- [ ] Service management pages.
- [ ] CMS admin pages cho articles, attractions, review moderation.
- [ ] Report pages và dashboard aggregate chuyên biệt.
- [ ] Rà responsive cho wizard tạo phòng hàng loạt trên màn hình hẹp.

### Nguyên tắc đang dùng trong code

- RBAC dựa trên `permission` claims, không có “all permission” lưu DB.
- `Users.status` được dùng để lock/unlock tài khoản.
- Email gửi bất đồng bộ để tránh block API.
- EF Core là persistence layer chính; script SQL dùng cho khởi tạo và seed.
