# 🏨 HotelManagement — Tổng Hợp Dự Án

> **Stack:** .NET 10 (Preview) · ASP.NET Core Web API · Entity Framework Core 10 · SQL Server · Redis · Cloudinary · JWT · MailKit · SignalR  
> **Kiến trúc:** 3-layer — `HotelManagement.Core` · `HotelManagement.Infrastructure` · `HotelManagement.API`  
> **Frontend:** React 19 + Vite 8 · Ant Design 6 · Zustand · Axios · React Router DOM v7 · @microsoft/signalr

---

## 1. Cấu Trúc Solution

### Backend Structure

```
HotelManagement/
├── HotelManagement.Core/           # Entities, DTOs, Authorization helpers, JwtHelper
│   ├── Authorization/              # PermissionCodes, RequirePermissionAttribute, Handler, Provider
│   ├── DTOs/                       # BookingDTOs, RoomTypeDTO, AmenitiesDTO, UploadImageDTO
│   ├── Entities/                   # 30+ entity classes
│   ├── Helpers/                    # JwtHelper
│   └── Models/Enums/               # NotificationEnums
├── HotelManagement.Infrastructure/
│   └── Data/                       # AppDbContext (EF Core, snake_case convention)
└── HotelManagement.API/
    ├── Controllers/                 # 15+ controllers
    ├── Hubs/                        # NotificationHub (SignalR)
    ├── Policies/                    # NotificationPolicy (RBAC cho thông báo)
    ├── Services/                    # EmailService, ActivityLogService, NotificationService
    └── Program.cs
```

### Frontend Structure

```
hotel-erp-frontend/
├── src/
│   ├── api/           # 14 file API client (authApi, userManagementApi, bookingsApi, ...)
│   ├── components/    # NotificationMenu.jsx
│   ├── hooks/         # useSignalR.js
│   ├── layouts/       # AdminLayout.jsx (sidebar + topbar + spinner overlay)
│   ├── pages/         # LoginPage.jsx, UserListPage.jsx, RolePermissionPage.jsx
│   ├── routes/        # AdminRoutes, ProtectedRoute, RequirePermission, PublicOnlyRoute
│   ├── store/         # adminAuthStore, loadingStore, notificationStore
│   └── utils/         # formatters, buildQueryString
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## 2. Cơ Sở Dữ Liệu — Hệ thống 7 Clusters

### Cluster 1: System, Auth & HR

| Bảng                 | Mô tả                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Roles`              | 10 vai trò: Admin, Manager, Receptionist, Accountant, Housekeeping, Security, Chef, Waiter, IT Support, Guest |
| `Permissions`        | 10 quyền với `permission_code` và `module_name`                                                               |
| `Role_Permissions`   | Composite PK — gán nhiều permission cho 1 role                                                                |
| `Memberships`        | 10 hạng từ Khách Mới → Signature, kèm `discount_percent`, `color_hex`                                         |
| `Users`              | Auth đầy đủ, loyalty points, refresh token, avatar Cloudinary                                                 |
| `Audit_Logs`         | Ghi lại mọi thao tác thay đổi dữ liệu quan trọng                                                              |
| `Activity_Logs`      | Thông báo realtime (SignalR): `action_code`, `severity`, `entity_type/id/label`                               |
| `Activity_Log_Reads` | Per-user read status (junction table, unique idx trên `activity_log_id + user_id`)                            |

### Cluster 2: Room Management

| Bảng                 | Mô tả                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `Room_Types`         | 10 loại phòng với `slug`, `base_price`, `capacity`, `bed_type`, `view_type`                          |
| `Rooms`              | 2 trục trạng thái: `business_status` (Available/Occupied/Disabled) + `cleaning_status` (Clean/Dirty) |
| `Amenities`          | Tiện nghi với soft delete                                                                            |
| `RoomType_Amenities` | Many-to-many giữa Room_Types và Amenities                                                            |
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

### Permission Codes tiêu biểu

```
VIEW_DASHBOARD   MANAGE_USERS    MANAGE_ROLES
MANAGE_ROOMS     MANAGE_BOOKINGS MANAGE_INVOICES
MANAGE_SERVICES  VIEW_REPORTS    MANAGE_CONTENT
MANAGE_INVENTORY
```

### Cơ chế hoạt động

1. **`PermissionRequirement`**: Mang `permission_code` cần kiểm tra.
2. **`PermissionPolicyProvider`**: Tự động tạo `AuthorizationPolicy` từ policy name.
3. **`PermissionAuthorizationHandler`**: Đọc claims `"permission"` trong JWT và so khớp.
4. **Custom Attribute**: `[RequirePermission(PermissionCodes.ManageRooms)]` thay cho `[Authorize(Policy = "...")]`.

---

## 4. Authentication & Security

### Endpoints

- **POST** `/api/Auth/login`: Đăng nhập → access token + refresh token.
- **POST** `/api/Auth/register`: Đăng ký khách hàng mới (role: Guest).
- **POST** `/api/Auth/refresh-token`: Xoay vòng (Rotate) Token.
- **POST** `/api/Auth/logout`: Vô hiệu hóa session.

### Bảo mật

- **Refresh Token Rotation**: Mỗi lần refresh cấp token mới, hủy token cũ → chống replay attack.
- **BCrypt**: Thuật toán băm mật khẩu hiện đại với Salt mạnh.
- **Email Normalization**: Tất cả Email được chuẩn hóa `Trim().ToLower()` trước khi xử lý Auth.
- **Session Persistence**: Hỗ trợ linh hoạt LocalStorage (Remember me) và SessionStorage.

---

## 5. Thông Báo Realtime (SignalR)

### Luồng xử lý

Action trong Controller → `IActivityLogService` → Lưu DB → `INotificationService` → Push qua SignalR Hub → Client cập nhật Badge & Menu.

### Đặc điểm nổi bật

- **NotificationPolicy**: Nguồn cấu hình duy nhất dùng để ánh xạ Role nhận thông báo.
- **Per-user Read Tracking**: Trạng thái đọc độc lập cho từng User (Manager A đọc không làm Manager B mất thông báo).
- **History Sync**: Tự động đồng bộ lịch sử 50 thông báo gần nhất khi F5 trang.

---

## 6. Controllers — Danh mục API

| Controller       | Phân quyền yêu cầu      | Mô tả chính                                                |
| ---------------- | ----------------------- | ---------------------------------------------------------- |
| `Auth`           | Public / Authorize      | Login, Register, Refresh Token, Logout                     |
| `UserManagement` | `MANAGE_USERS`          | CRUD Nhân viên, Reset Pass, Toggle Status, Change Role     |
| `UserProfile`    | `[Authorize]`           | My Profile, Change Password, Upload Avatar                 |
| `Roles`          | `MANAGE_ROLES`          | Danh sách Role, Gán quyền (Permission Assign)              |
| `RoomTypes`      | Public / `MANAGE_ROOMS` | CMS Loại phòng, Quản lý ảnh Cloudinary                     |
| `Rooms`          | `MANAGE_ROOMS`          | CRUD Phòng, Đổi trạng thái vệ sinh/kinh doanh, Bulk Create |
| `Bookings`       | `MANAGE_BOOKINGS`       | Workflow đặt phòng: Confirm, Check-in, Check-out, Cancel   |
| `Vouchers`       | `MANAGE_BOOKINGS`       | CRUD Voucher, Validate điều kiện sử dụng                   |
| `Reviews`        | `MANAGE_CONTENT`        | Workflow duyệt đánh giá của khách hàng                     |
| `Articles`       | `MANAGE_CONTENT`        | CMS Bài viết, SEO, Thumbnail Cloudinary, Slug generation   |

---

## 7. Các Tính Năng Kỹ Thuật Đặc Biệt

- **Distributed Lock (Redis)**: Khóa slot đặt phòng 30 giây để tránh tình trạng "vượt rào" đặt trùng phòng (double booking).
- **Email Fire-and-Forget**: Gửi email xác nhận, reset mật khẩu qua MailKit mà không làm chậm tốc độ phản hồi API.
- **Slug Generation**: Hệ thống tự động chuyển đổi tiêu đề Tiếng Việt có dấu thành URL friendly slug unique.
- **Cloudinary Integration**: Tự động tối ưu ảnh (resize, crop face cho avatar, format optimization).
- **Audit Trace**: Lưu vết chi tiết ai, lúc nào, thay đổi `OldValue` thành `NewValue` (dạng JSON) cho mọi bảng quan trọng.

---

## 8. Trạng Thái Frontend — Dashboard & UI

### Đã hoàn thiện 100%

- Giao diện Đăng nhập + Đăng ký.
- Layout Quản trị: Sidebar, Header, Breadcrumb, Loading Spinner.
- Quản lý Nhân sự: Bảng danh sách, Modal chi tiết, Form thêm/sửa, Reset mật khẩu.
- Phân quyền: Giao diện Checkbox ma trận giữa Role và Permission.
- Hệ thống Chuông thông báo Realtime: Badge count, Popover history.

### Các trang đang phát triển (Backend đã sẵn sàng)

- Quản lý Phòng & Loại phòng.
- Quản lý Đặt phòng & Voucher.
- Dashboard báo cáo & Biểu đồ thống kê.

---

## 9. Hướng Dẫn Chạy Dự Án

### Backend

1. Chạy file `HotelManagement.sql` trên SQL Server.
2. Cấu hình `appsettings.json` (ConnectionStrings, Cloudinary, Email SMTP).
3. `dotnet run --project HotelManagement.API`

### Frontend

1. `cd hotel-erp-frontend`
2. `npm install`
3. `npm run dev`

**Tài khoản Admin:** `admin@hotel.com` / `Admin@123`

---

## 10. Lời Kết (Ghi chú TODO)

Dự án hiện đang trong giai đoạn hoàn thiện các module nghiệp vụ sâu (Invoices, Shifts). Tuy nhiên, nền tảng cốt lõi về **Security, Realtime Notification, Infrastructure (Redis/Cloudinary)** đã được xây dựng cực kỳ vững chắc và đúng chuẩn kiến trúc hiện đại.

---

_Tài liệu được cập nhật tự động bởi AI Documentation System._
