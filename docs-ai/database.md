# Database Schema

## Naming Convention

| Quy tắc | Áp dụng |
|---|---|
| Tên bảng | `snake_case`, số nhiều: `users`, `bookings`, `room_types` |
| Tên cột | `snake_case`: `created_at`, `full_name`, `role_id` |
| Khóa ngoại | `[tên bảng]_id`: `role_id`, `user_id`, `room_type_id` |
| Khóa chính | Luôn là `id` (int, auto-increment) |
| Timestamps | `created_at`, `updated_at` (DateTime UTC) |
| Boolean | `status` (true=active), `is_read`, `is_active` |

---

## Danh sách bảng

### 👤 Users & Authentication

| Bảng | Mô tả |
|---|---|
| `Users` | Người dùng hệ thống (Admin, Manager, nhân viên, khách) |
| `Roles` | Vai trò: Admin, Manager, Receptionist, Housekeeping, Guest |
| `Permissions` | Danh sách quyền: `MANAGE_USERS`, `MANAGE_ROOMS`,... |
| `Role_Permissions` | Many-to-many: Role ↔ Permission |
| `Memberships` | Hạng thành viên khách hàng (Silver, Gold, Platinum,...) |

### 🏨 Rooms

| Bảng | Mô tả |
|---|---|
| `RoomTypes` | Loại phòng (Standard, Deluxe,...) với giá, sức chứa |
| `Rooms` | Phòng vật lý (số phòng, tầng, trạng thái) |
| `Room_Images` | Hình ảnh loại phòng |
| `Amenities` | Tiện nghi (Wifi, TV, Minibar,...) |
| `Room_Type_Amenities` | Many-to-many: RoomType ↔ Amenity |
| `Room_Inventories` | Đồ vật trong phòng (để tính phí mất mát) |

### 📅 Booking

| Bảng | Mô tả |
|---|---|
| `Bookings` | Đặt phòng (guestName, phone, status, totalAmount) |
| `Booking_Details` | Chi tiết booking (roomTypeId, checkIn, checkOut, price) |
| `Invoices` | Hóa đơn thanh toán |
| `Payments` | Giao dịch thanh toán |
| `Vouchers` | Mã giảm giá |
| `Voucher_Usages` | Lịch sử dùng voucher |

### 📝 Content

| Bảng | Mô tả |
|---|---|
| `Articles` | Bài viết, tin tức |
| `Article_Categories` | Danh mục bài viết |
| `Attractions` | Địa điểm du lịch gần khách sạn |
| `Reviews` | Đánh giá của khách |

### 💰 Services & Loyalty

| Bảng | Mô tả |
|---|---|
| `Services` | Dịch vụ thêm (spa, laundry,...) |
| `Service_Categories` | Danh mục dịch vụ |
| `Order_Services` | Order dịch vụ thêm |
| `Order_Service_Details` | Chi tiết order |
| `Loyalty_Transactions` | Lịch sử tích/đổi điểm |

### 🔒 Audit & Logging

| Bảng | Mô tả |
|---|---|
| `Audit_Logs` | Nhật ký kiểm tra (ai, làm gì, khi nào, IP) |
| `Activity_Logs` | Log sự kiện nghiệp vụ + nền tảng push thông báo |

---

## Key Relationships

```
User → Role (many-to-one)
Role → Permission (many-to-many via Role_Permissions)
User → Membership (many-to-one)

Booking → User (many-to-one, nullable cho guest vãng lai)
Booking → BookingDetail (one-to-many)
BookingDetail → RoomType (many-to-one)
BookingDetail → Room (many-to-one, assigned on check-in)

RoomType → Room (one-to-many)
RoomType → Amenity (many-to-many via RoomTypeAmenities)
RoomType → RoomImage (one-to-many)

Room → RoomInventory (one-to-many)
```

---

## Cột quan trọng cần chú ý

### Users
```sql
id, full_name, email, password_hash, role_id, membership_id,
status (bool: true=active), last_login_at,
refresh_token, refresh_token_expiry,
loyalty_points, loyalty_points_usable,
created_at, updated_at
```

### Rooms
```sql
id, room_number, floor, view_type,
business_status (Available|Occupied|Disabled),
cleaning_status (Clean|Dirty),
status (legacy, đồng bộ với business_status),
room_type_id, notes
```

### Bookings
```sql
id, booking_code (unique: BK20260327123456),
user_id (nullable), guest_name, guest_phone, guest_email,
num_adults, num_children,
status (Pending|Confirmed|Checked_in|Completed|Cancelled),
total_estimated_amount, deposit_amount,
check_in_time, check_out_time,
source (online|counter), voucher_id,
cancellation_reason, cancelled_at
```

### Activity_Logs
```sql
id, user_id, role_name, action_code, action_label,
entity_type, entity_id, entity_label,
message, metadata, severity (Info|Success|Warning|Error),
is_read (bool), created_at
```

---

## SQL Indexes

### Activity_Logs — Chỉ mục tối ưu

| Index | Cột | Mục đích |
|---|---|---|
| `IX_Activity_Logs_UserId_CreatedAt` | `(user_id, created_at DESC)` | Query log theo user |
| `IX_Activity_Logs_EntityType_EntityId` | `(entity_type, entity_id)` | Query log theo entity |
| `IX_Activity_Logs_IsRead_CreatedAt` | `(is_read, created_at DESC)` | Màn hình thông báo, đếm unread |
| `IX_Activity_Logs_ActionCode` | `(action_code)` | Filter theo actionCode trong Policy |

> **Lưu ý khi thêm cột mới vào Activity_Logs:** Nếu cột mới sẽ được dùng trong `WHERE` clause thường xuyên, hãy bổ sung index tương ứng vào `Bổ sung Activity_Logs.sql` và `AppDbContext.cs`.
