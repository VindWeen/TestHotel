# Module: Quản lý Phòng

## Chức năng
CRUD phòng vật lý, loại phòng, tiện nghi, trạng thái kinh doanh và vệ sinh.

---

## Cấu trúc dữ liệu phòng

```
RoomType (loại phòng: Deluxe, Standard,...)
    ├── basePrice, maxOccupancy, description
    ├── RoomImages[]          # Hình ảnh
    └── RoomTypeAmenities[]   # Many-to-many với Amenity

Room (phòng vật lý)
    ├── roomNumber, floor, viewType
    ├── businessStatus: Available | Occupied | Disabled
    ├── cleaningStatus: Clean | Dirty
    └── roomTypeId → RoomType
```

---

## Business Rules

### Room Business Status
| Status | Ý nghĩa |
|---|---|
| `Available` | Phòng trống, có thể đặt |
| `Occupied` | Đang có khách |
| `Disabled` | Đóng cửa bảo trì |

### Room Cleaning Status
| Status | Ý nghĩa |
|---|---|
| `Clean` | Đã dọn xong |
| `Dirty` | Cần dọn (sau check-out) |

### Quy tắc tạo phòng
- `roomNumber` phải unique trong toàn hệ thống.
- `roomTypeId` phải tồn tại.
- Khi tạo phòng: mặc định `businessStatus = Available`, `cleaningStatus = Clean`.

### Bulk Create (`POST /api/Rooms/bulk-create`)
- Tạo nhiều phòng cùng lúc.
- Bỏ qua (skip) các phòng có số phòng đã tồn tại — không báo lỗi toàn bộ batch.
- Response trả về: `{ created[], skipped[], invalid[] }`.

### Đổi trạng thái phòng (`PATCH /api/Rooms/{id}/status`)
- Chỉ chấp nhận: `Available`, `Occupied`, `Disabled`.

### Đổi trạng thái vệ sinh (`PATCH /api/Rooms/{id}/cleaning-status`)
- Chỉ chấp nhận: `Clean`, `Dirty`.
- Severity `Warning` nếu là `Dirty`.

---

## ActivityLog Actions

| ActionCode | Severity | Gửi cho |
|---|---|---|
| `CREATE_ROOM` | Info | Admin, Manager |
| `UPDATE_ROOM` | Info | Admin, Manager |
| `BULK_CREATE_ROOMS` | Info | Admin, Manager |
| `UPDATE_ROOM_STATUS` | Info | Admin, Manager |
| `UPDATE_ROOM_CLEANING` | Info/Warning | Admin, Manager |
| `DELETE_ROOM_TYPE` | Warning | Admin, Manager |

---

## Endpoints tóm tắt

```http
# RoomTypes
GET    /api/RoomTypes                    # Danh sách loại phòng (public)
GET    /api/RoomTypes/{id}               # Chi tiết loại phòng
POST   /api/RoomTypes                    # Tạo loại phòng
PUT    /api/RoomTypes/{id}               # Cập nhật loại phòng
DELETE /api/RoomTypes/{id}               # Xóa loại phòng

# Rooms
GET    /api/Rooms                        # Danh sách phòng (filter: floor, businessStatus,...)
GET    /api/Rooms/{id}                   # Chi tiết phòng
POST   /api/Rooms                        # Tạo 1 phòng
POST   /api/Rooms/bulk-create            # Tạo nhiều phòng
PUT    /api/Rooms/{id}                   # Sửa thông tin phòng
PATCH  /api/Rooms/{id}/status            # Đổi business status
PATCH  /api/Rooms/{id}/cleaning-status   # Đổi cleaning status
```
