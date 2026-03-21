# 🏨 HotelManagement

## ⚙️ Yêu cầu môi trường

### .NET 10

Kiểm tra phiên bản .NET đang có bằng lệnh:

```bash
dotnet --version
```

Nếu chưa có hoặc phiên bản thấp hơn 10, tải SDK tại:
**[Download .NET 10.0 (Linux, macOS, and Windows) | .NET](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)**
> Chọn bản **SDK x64** hoặc **x86** tùy theo máy.

---

## 🚀 Hướng dẫn chạy project

### 1. Tạo branch cho bản thân

Nếu chưa có branch riêng, tạo và chuyển sang branch mới:

```bash
git checkout -b ten-cua-ban
```

### 2. Tạo database

Chạy file `HotelManagement.sql` trên SQL Server để tạo database, các bảng và dữ liệu mẫu.

> **Tài khoản Admin mặc định có trong dữ liệu mẫu:**
> - 📧 Email: `admin@hotel.com`
> - 🔑 Password: `Admin@123`

### 3. Chạy API

```bash
dotnet run --project HotelManagement.API
```

API sẽ chạy tại:
- http://localhost:5279



# 🏨 HotelManagement — Tổng Hợp Dự Án

> **Stack:** .NET 10 · ASP.NET Core Web API · Entity Framework Core 10 · SQL Server · Redis · Cloudinary · JWT  
> **Kiến trúc:** 3-layer — `HotelManagement.Core` · `HotelManagement.Infrastructure` · `HotelManagement.API`

---

## 1. Cấu Trúc Solution

```
HotelManagement/
├── HotelManagement.Core/           # Entities, DTOs, Authorization helpers, JwtHelper
├── HotelManagement.Infrastructure/ # AppDbContext, EF Core migrations
└── HotelManagement.API/            # Controllers, Program.cs, appsettings
```

---

## 2. Cơ Sở Dữ Liệu — 7 Cluster

### Cluster 1: System, Auth & HR
| Bảng | Mô tả |
|---|---|
| `Roles` | Vai trò: Admin, Manager, Receptionist, Accountant, Housekeeping, Security, Chef, Waiter, IT Support, Guest |
| `Permissions` | Quyền hạn với `permission_code` (VD: `MANAGE_ROOMS`) và `module_name` |
| `Role_Permissions` | Composite PK — gán nhiều permission cho 1 role |
| `Memberships` | 10 hạng thành viên từ Khách Mới → Signature, kèm `discount_percent` và `color_hex` |
| `Users` | Thông tin đầy đủ: auth, loyalty points, refresh token, avatar Cloudinary |
| `Audit_Logs` | Ghi lại mọi thao tác thay đổi dữ liệu quan trọng |

### Cluster 2: Room Management
| Bảng | Mô tả |
|---|---|
| `Room_Types` | 10 loại phòng với `slug`, `base_price`, `capacity`, `bed_type`, `view_type` |
| `Rooms` | Tách 2 trục trạng thái: `business_status` (Available/Occupied/Disabled) + `cleaning_status` (Clean/Dirty) |
| `Amenities` | Tiện nghi phòng (Wifi, Smart TV, Điều hòa…) với soft delete |
| `RoomType_Amenities` | Bảng join many-to-many giữa Room_Types và Amenities |
| `Room_Images` | Ảnh Cloudinary: `is_primary`, `sort_order`, soft delete |
| `Room_Inventory` | Vật tư phòng (Asset / Minibar): `price_if_lost`, soft delete |

### Cluster 3: Booking & Promotions
| Bảng | Mô tả |
|---|---|
| `Vouchers` | Mã giảm giá: PERCENT / FIXED_AMOUNT, `usage_limit`, `max_uses_per_user`, thời hạn |
| `Bookings` | Đặt phòng: thông tin khách, booking code unique, trạng thái, nguồn (online/walk_in/phone) |
| `Booking_Details` | Chi tiết từng phòng trong booking: ngày CI/CO, `price_per_night` khóa tại thời điểm đặt |
| `Voucher_Usage` | Theo dõi lịch sử dùng voucher theo từng user/booking |

### Cluster 4: Services & Operations
| Bảng | Mô tả |
|---|---|
| `Service_Categories` | Nhóm dịch vụ (Nhà hàng, Spa, Di chuyển, Giặt ủi…) |
| `Services` | Dịch vụ cụ thể với `price`, `unit`, `image_url`, soft delete |
| `Order_Services` | Đơn đặt dịch vụ gắn với `booking_detail_id` |
| `Order_Service_Details` | Chi tiết từng dịch vụ trong đơn |
| `Loss_And_Damages` | Biên bản mất/hỏng vật tư: `penalty_amount`, `reported_by` (Housekeeping) |

### Cluster 5: Billing, Reviews & CMS
| Bảng | Mô tả |
|---|---|
| `Invoices` | Hóa đơn: tổng phòng, dịch vụ, hư hỏng, giảm giá, thuế, `final_total` |
| `Payments` | Thanh toán: Deposit / Final_Settlement / Refund, nhiều phương thức |
| `Reviews` | Đánh giá: rating 1–5, ảnh Cloudinary, workflow duyệt (pending → approved/rejected) |
| `Article_Categories` | Danh mục bài viết với `slug` unique |
| `Articles` | Bài viết: Draft → Pending_Review → Published, SEO meta, thumbnail Cloudinary |
| `Attractions` | Địa điểm du lịch: tọa độ GPS, khoảng cách km, Google Maps embed |

### Cluster 6 & 7: HR & Loyalty
| Bảng | Mô tả |
|---|---|
| `Shifts` | Ca làm việc: Morning/Afternoon/Night, kế hoạch vs thực tế, bàn giao ca |
| `Loyalty_Transactions` | Lịch sử điểm thưởng: earned / redeemed / expired |

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
2. **`PermissionPolicyProvider`** — tự động tạo `AuthorizationPolicy` từ tên policy = permission code (không cần đăng ký tay)
3. **`PermissionAuthorizationHandler`** — đọc claims `"permission"` trong JWT và so khớp
4. **`[RequirePermission(PermissionCodes.ManageRooms)]`** — attribute tiện lợi thay cho `[Authorize(Policy = "MANAGE_ROOMS")]`

### JWT Token chứa
- `sub` (userId), `email`, `jti`, `role`, `full_name`
- Nhiều claim `"permission"` (mỗi permission_code là 1 claim riêng)

---

## 4. Authentication — Auth Flow

### Endpoints
| Method | Route | Mô tả |
|---|---|---|
| POST | `/api/Auth/login` | Đăng nhập → access token + refresh token |
| POST | `/api/Auth/register` | Đăng ký khách hàng mới |
| POST | `/api/Auth/refresh-token` | Lấy access token mới bằng refresh token |
| POST | `/api/Auth/logout` | Xóa refresh token phía server |

### Đặc điểm
- **Refresh Token Rotation**: mỗi lần refresh cấp token mới, hủy token cũ → chống replay attack
- **Refresh token** lưu server-side trong DB (`refresh_token`, `refresh_token_expiry`), có thể revoke khi logout hoặc khóa tài khoản
- **BCrypt** hash password
- Token hết hạn sau 60 phút, refresh token hết hạn sau 7 ngày

---

## 5. Controllers & API Endpoints

### AuthController
| Method | Route | Auth |
|---|---|---|
| POST | `/api/Auth/login` | Public |
| POST | `/api/Auth/register` | Public |
| POST | `/api/Auth/refresh-token` | Public |
| POST | `/api/Auth/logout` | `[Authorize]` |

### UserManagementController
| Method | Route | Permission |
|---|---|---|
| GET | `/api/UserManagement` | `MANAGE_USERS` |
| GET | `/api/UserManagement/{id}` | `MANAGE_USERS` |
| POST | `/api/UserManagement` | `MANAGE_USERS` |
| PUT | `/api/UserManagement/{id}` | `MANAGE_USERS` |
| DELETE | `/api/UserManagement/{id}` | `MANAGE_USERS` (khóa tài khoản) |
| PUT | `/api/UserManagement/{id}/change-role` | `MANAGE_USERS` + `MANAGE_ROLES` |
| PATCH | `/api/UserManagement/{id}/toggle-status` | `MANAGE_USERS` |

### UserProfileController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/UserProfile/my-profile` | `[Authorize]` |
| PUT | `/api/UserProfile/update-profile` | `[Authorize]` |
| PUT | `/api/UserProfile/change-password` | `[Authorize]` |
| POST | `/api/UserProfile/upload-avatar` | `[Authorize]` |

### RolesController
| Method | Route | Permission |
|---|---|---|
| POST | `/api/Roles/assign-permission` | `MANAGE_ROLES` |
| GET | `/api/Roles/my-permissions` | `[Authorize]` |

### RoomTypesController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/RoomTypes` | Public |
| GET | `/api/RoomTypes/{id}` | Public |
| DELETE | `/api/RoomTypes/{id}` | `MANAGE_ROOMS` |
| POST | `/api/RoomTypes/{id}/images` | `MANAGE_ROOMS` |
| DELETE | `/api/RoomTypes/images/{imageId}` | `MANAGE_ROOMS` |
| PATCH | `/api/RoomTypes/{roomTypeId}/images/{imageId}/set-primary` | `MANAGE_ROOMS` |
| PATCH | `/api/RoomTypes/{id}/toggle-active` | `MANAGE_ROOMS` |

### RoomsController
| Method | Route | Permission |
|---|---|---|
| GET | `/api/Rooms` | `MANAGE_ROOMS` |
| GET | `/api/Rooms/{id}` | `MANAGE_ROOMS` |
| POST | `/api/Rooms` | `MANAGE_ROOMS` |
| PUT | `/api/Rooms/{id}` | `MANAGE_ROOMS` |
| PATCH | `/api/Rooms/{id}/status` | `MANAGE_ROOMS` |
| PATCH | `/api/Rooms/{id}/cleaning-status` | `MANAGE_ROOMS` |
| POST | `/api/Rooms/bulk-create` | `MANAGE_ROOMS` |

### AmenitiesController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/Amenities` | Public (admin thấy cả inactive) |
| GET | `/api/Amenities/{id}` | Public |
| POST | `/api/Amenities` | `MANAGE_ROOMS` |
| PUT | `/api/Amenities/{id}` | `MANAGE_ROOMS` |
| DELETE | `/api/Amenities/{id}` | `MANAGE_ROOMS` |
| PATCH | `/api/Amenities/{id}/toggle-active` | `MANAGE_ROOMS` |

### RoomInventoriesController
| Method | Route | Permission |
|---|---|---|
| GET | `/api/RoomInventories/room/{roomId}` | `MANAGE_INVENTORY` |
| GET | `/api/RoomInventories/{id}` | `MANAGE_INVENTORY` |
| POST | `/api/RoomInventories` | `MANAGE_INVENTORY` |
| PUT | `/api/RoomInventories/{id}` | `MANAGE_INVENTORY` |
| DELETE | `/api/RoomInventories/{id}` | `MANAGE_INVENTORY` |
| POST | `/api/RoomInventories/clone` | `MANAGE_INVENTORY` |
| PATCH | `/api/RoomInventories/{id}/toggle-active` | `MANAGE_INVENTORY` |

### BookingsController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/Bookings` | `MANAGE_BOOKINGS` |
| GET | `/api/Bookings/{id}` | `MANAGE_BOOKINGS` |
| GET | `/api/Bookings/my-bookings` | `[Authorize]` |
| POST | `/api/Bookings` | `[AllowAnonymous]` |
| PATCH | `/api/Bookings/{id}/confirm` | `MANAGE_BOOKINGS` |
| PATCH | `/api/Bookings/{id}/cancel` | `[Authorize]` |
| PATCH | `/api/Bookings/{id}/check-in` | `MANAGE_BOOKINGS` |
| PATCH | `/api/Bookings/{id}/check-out` | `MANAGE_BOOKINGS` |

### VouchersController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/Vouchers` | `MANAGE_BOOKINGS` |
| GET | `/api/Vouchers/{id}` | `MANAGE_BOOKINGS` |
| POST | `/api/Vouchers` | `MANAGE_BOOKINGS` |
| PUT | `/api/Vouchers/{id}` | `MANAGE_BOOKINGS` |
| DELETE | `/api/Vouchers/{id}` | `MANAGE_BOOKINGS` (soft delete) |
| POST | `/api/Vouchers/validate` | `[Authorize]` |

### ReviewsController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/Reviews` | Public (default: chỉ approved) |
| POST | `/api/Reviews` | `[Authorize]` |
| POST | `/api/Reviews/upload-image` | `[Authorize]` |
| PATCH | `/api/Reviews/{id}/approve` | `MANAGE_CONTENT` |

### ArticleCategoriesController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/ArticleCategories` | Public |
| GET | `/api/ArticleCategories/{id}` | Public |
| POST | `/api/ArticleCategories` | `MANAGE_CONTENT` |
| PUT | `/api/ArticleCategories/{id}` | `MANAGE_CONTENT` |
| DELETE | `/api/ArticleCategories/{id}` | `MANAGE_CONTENT` |
| PATCH | `/api/ArticleCategories/{id}/toggle-active` | `MANAGE_CONTENT` |

### ArticlesController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/Articles` | Public (admin thấy Draft) |
| GET | `/api/Articles/{slug}` | Public |
| POST | `/api/Articles` | `MANAGE_CONTENT` |
| PUT | `/api/Articles/{id}` | `MANAGE_CONTENT` |
| DELETE | `/api/Articles/{id}` | `MANAGE_CONTENT` |
| PATCH | `/api/Articles/{id}/toggle-active` | `MANAGE_CONTENT` |
| POST | `/api/Articles/{id}/thumbnail` | `MANAGE_CONTENT` |

### AttractionsController
| Method | Route | Auth |
|---|---|---|
| GET | `/api/Attractions` | Public |
| GET | `/api/Attractions/{id}` | Public |
| POST | `/api/Attractions` | `MANAGE_CONTENT` |
| PUT | `/api/Attractions/{id}` | `MANAGE_CONTENT` |
| DELETE | `/api/Attractions/{id}` | `MANAGE_CONTENT` |
| PATCH | `/api/Attractions/{id}/toggle-active` | `MANAGE_CONTENT` |

---

## 6. Các Tính Năng Nổi Bật

### Booking Flow
```
Pending → Confirmed → Checked_in → Completed
                ↘ Cancelled (bất cứ lúc nào)
```
- **Check-in**: Tự động tìm phòng Available cùng RoomType → gán `RoomId`, đổi `BusinessStatus = Occupied`
- **Check-out**: Đổi `BusinessStatus = Available`, `CleaningStatus = Dirty`
- **Cancel**: Giải phóng phòng về Available + Clean
- **Redis distributed lock**: Khóa slot đặt phòng 30 giây để tránh double booking
- **Voucher**: Validate đầy đủ (thời hạn, usage limit, per-user limit, min booking value)

### Phân tách trạng thái phòng
```
business_status: Available | Occupied | Disabled
cleaning_status: Clean | Dirty
```
Lễ tân quản lý `business_status`, Housekeeping cập nhật `cleaning_status`.

### Upload Cloudinary
- **Avatar**: Resize 500×500, crop face — trong UserProfileController
- **Room images**: Auto quality, folder `hotel/room-types/{id}`, logic set ảnh primary, xóa cũ khi delete
- **Review images**: Resize 1200×800, folder `hotel/reviews`
- **Article thumbnails**: Resize 1200×630, crop fill, xóa ảnh cũ qua `cloudinary_public_id`

### Slug generation (tiếng Việt)
- Chuẩn hóa Unicode NFD → loại bỏ dấu → lowercase → replace "đ" → clean ký tự đặc biệt
- Đảm bảo unique bằng hậu tố `-2`, `-3`... nếu trùng
- Áp dụng cho: Articles, ArticleCategories

### Soft Delete Pattern
Áp dụng nhất quán cho: Amenities, RoomTypes, RoomImages, RoomInventory, Services, Articles, ArticleCategories, Attractions.  
Kèm endpoint `toggle-active` (PATCH) để bật/tắt linh hoạt.

### Audit Log
Ghi log tại: `UpdateBusinessStatus` (Rooms), `LockUser` / `ToggleStatus` (UserManagement).  
Lưu: userId, action, table_name, record_id, old_value, new_value, ip_address, user_agent.

### Review Moderation
```
Gửi review → IsApproved = false (pending) → Admin duyệt → true / từ chối kèm lý do
```
Public GET chỉ trả `IsApproved = true`. Admin filter theo `?status=pending|approved|rejected`.

### Article Publishing
```
Draft → Pending_Review → Published (chỉ Admin được set Published)
```
- `GET /api/Articles` public chỉ thấy Published
- Admin (MANAGE_CONTENT) thấy tất cả status

---

## 7. Cấu Hình & Tích Hợp

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "SQL Server connection string",
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
  }
}
```

### Program.cs — Services đã đăng ký
| Service | Ghi chú |
|---|---|
| `AppDbContext` | EF Core SQL Server |
| JWT Bearer Auth | `ClockSkew = TimeSpan.Zero`, custom 401/403 response JSON |
| `IAuthorizationPolicyProvider` → `PermissionPolicyProvider` | Singleton |
| `IAuthorizationHandler` → `PermissionAuthorizationHandler` | Scoped |
| `JwtHelper` | Scoped |
| `Cloudinary` | Singleton |
| `IConnectionMultiplexer` (Redis) | Singleton |
| Mapster | DI-based mapping |
| Swagger + Bearer security definition | Dev only |
| `ReferenceHandler.IgnoreCycles` | JSON serializer |

### AppDbContext — quy ước đặt tên
- Bảng: tên custom snake_case có underscore (VD: `Room_Types`, `Audit_Logs`)
- Cột: tự động convert PascalCase → snake_case qua regex (`RoomTypeId` → `room_type_id`)
- Tất cả FK constraint name, index name cũng snake_case

---

## 8. Seed Data

| Bảng | Số bản ghi |
|---|---|
| Roles | 10 |
| Permissions | 10 |
| Memberships | 10 (Khách Mới → Signature) |
| Users | 10 (1 Admin, staff, 5 khách hàng) |
| Room_Types | 10 (Standard → Royal Villa) |
| Rooms | 10 |
| Amenities | 10 |
| Vouchers | 10 (KM1–KM10) |
| Bookings | 10 |
| Booking_Details | 10 |
| Invoices | 10 |
| Payments | 10 |
| Services | 10 |
| Reviews | 10 |
| Articles | 10 |
| Attractions | 10 |

**Tài khoản Admin mặc định:** `admin@hotel.com` / `Admin@123`

---

## 9. Chạy Dự Án

```bash
# 1. Tạo database
# Chạy file HotelManagement.sql trên SQL Server

# 2. Chạy thêm migration bổ sung
# Chạy file Bổ sung.sql (thêm refresh_token columns)

# 3. Khởi động API
dotnet run --project HotelManagement.API

# API chạy tại:
# http://localhost:5279

# Swagger UI: http://localhost:5279/swagger
```

---
