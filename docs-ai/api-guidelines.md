# API Guidelines

## URL Structure

```
/api/{Resource}/{id}/{sub-resource}
```

| Pattern | Ví dụ | Mô tả |
|---|---|---|
| `GET /api/Resource` | `GET /api/Rooms` | Lấy danh sách |
| `GET /api/Resource/{id}` | `GET /api/Rooms/5` | Lấy 1 item |
| `POST /api/Resource` | `POST /api/Rooms` | Tạo mới |
| `PUT /api/Resource/{id}` | `PUT /api/Rooms/5` | Cập nhật toàn bộ |
| `PATCH /api/Resource/{id}/action` | `PATCH /api/Bookings/5/confirm` | Action riêng lẻ |
| `DELETE /api/Resource/{id}` | `DELETE /api/UserManagement/5` | Xóa hoặc khóa |

---

## HTTP Status Codes chuẩn

| Code | Khi nào |
|---|---|
| `200 OK` | GET, PUT, PATCH thành công |
| `201 Created` | POST tạo mới thành công |
| `204 No Content` | Hành động thành công, không có body (ví dụ: mark-read) |
| `400 Bad Request` | Dữ liệu đầu vào sai |
| `401 Unauthorized` | Chưa đăng nhập |
| `403 Forbidden` | Đăng nhập rồi nhưng không đủ quyền |
| `404 Not Found` | Không tìm thấy resource |
| `409 Conflict` | Trùng lặp (email đã tồn tại, số phòng đã có,...) |
| `500 Internal Server Error` | Lỗi server |

---

## Request / Response Format

### Pagination (danh sách dài)
```json
// Request
GET /api/UserManagement?page=1&pageSize=10&roleId=2

// Response
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 45,
    "totalPages": 5
  }
}
```

### Error Response
```json
{ "message": "Mô tả lỗi rõ ràng bằng tiếng Việt" }
```

### Success Response (Create)
```json
{
  "message": "Tạo thành công.",
  "id": 42
}
```

---

## Authentication

### Login
```http
POST /api/Auth/login
Body: { "email": "...", "password": "..." }

Response: {
  "token": "...",
  "refreshToken": "...",
  "role": "Admin",
  "fullName": "Nguyễn Văn A",
  "permissions": ["MANAGE_USERS", "MANAGE_ROOMS", ...]
}
```

### Token trong request
```http
Authorization: Bearer <token>
```

### Refresh token
```http
POST /api/Auth/refresh-token
Body: { "refreshToken": "..." }
```

---

## Notification API

### Lấy lịch sử thông báo
```http
GET /api/ActivityLogs/my-notifications
→ Trả về 50 thông báo gần nhất theo role của người dùng hiện tại
→ Được filter theo NotificationPolicy
```

### Đánh dấu đã đọc
```http
PUT /api/ActivityLogs/{id}/mark-read
PUT /api/ActivityLogs/mark-all-read
```

---

## Các Controller hiện có

| Controller | Route | Chức năng chính |
|---|---|---|
| `AuthController` | `/api/Auth` | Login, Register, Logout, RefreshToken |
| `UserManagementController` | `/api/UserManagement` | CRUD nhân viên, phân quyền, khóa/mở khóa |
| `UserProfileController` | `/api/UserProfile` | Xem/sửa profile cá nhân |
| `RolesController` | `/api/Roles` | Danh sách role, gán/thu hồi permission |
| `RoomsController` | `/api/Rooms` | CRUD phòng, đổi trạng thái, bulk-create |
| `RoomTypesController` | `/api/RoomTypes` | CRUD loại phòng, hình ảnh, amenities |
| `BookingsController` | `/api/Bookings` | Tạo booking, confirm, cancel, check-in/out |
| `AmenitiesController` | `/api/Amenities` | CRUD tiện nghi |
| `AttractionsController` | `/api/Attractions` | CRUD địa điểm du lịch |
| `ArticlesController` | `/api/Articles` | CRUD bài viết |
| `ArticleCategoriesController` | `/api/ArticleCategories` | CRUD danh mục bài viết |
| `ReviewController` | `/api/Reviews` | Đánh giá phòng |
| `VoucherController` | `/api/Vouchers` | CRUD voucher, kích hoạt/vô hiệu hóa |
| `RoomInventoriesController` | `/api/RoomInventories` | Đồ vật trong phòng |
| `ActivityLogsController` | `/api/ActivityLogs` | Lấy thông báo, đánh dấu đã đọc |
