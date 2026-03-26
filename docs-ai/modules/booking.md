# Module: Booking (Đặt phòng)

## Chức năng
Quản lý toàn bộ vòng đời đặt phòng: từ tạo booking đến check-out.

---

## Booking Status Flow

```
[Khách tạo] → Pending
    → [Manager/Admin xác nhận] → Confirmed
        → [Receptionist check-in] → Checked_in
            → [Receptionist check-out] → Completed
    → [Hủy bởi khách/nhân viên] → Cancelled
```

---

## Business Rules

1. **Tạo Booking** (`POST /api/Bookings`):
   - Được phép không cần đăng nhập (`[AllowAnonymous]`).
   - Phải có ít nhất 1 `BookingDetail` (roomTypeId, checkIn, checkOut).
   - Check-out phải sau check-in.
   - Kiểm tra overlap: không đặt cùng loại phòng trong cùng khoảng ngày.
   - Dùng Redis lock để tránh race condition khi 2 người đặt cùng lúc.
   - Load toàn bộ RoomType cần thiết **1 query duy nhất** (tránh N+1), fetch song song với Voucher bằng `Task.WhenAll`.
   - `BookingCode` = `BK{yyyyMMddHHmmss}{4 ký tự GUID}` — đảm bảo unique kể cả khi concurrent same-second.
   - Voucher logic: kiểm tra hợp lệ, hạn dùng, giới hạn lượt.
   - `AuditLog` được add trước `SaveChangesAsync` duy nhất (chỉ 1 lần ghi DB).


2. **Confirm** (`PATCH /api/Bookings/{id}/confirm`):
   - Chỉ từ trạng thái `Pending`.
   - Gửi email xác nhận cho khách.
   - Ghi ActivityLog: chỉ push cho Admin + Manager.

3. **Cancel** (`PATCH /api/Bookings/{id}/cancel?reason=...`):
   - Bất kỳ booking nào chưa Completed.
   - Phải có lý do.
   - Giải phóng phòng liên quan (set BusinessStatus = Available).

4. **Check-in** (`PATCH /api/Bookings/{id}/check-in`):
   - Chỉ từ trạng thái `Confirmed`.
   - Tự động assign phòng thực tế từ RoomType còn Available.
   - Set room.BusinessStatus = Occupied.

5. **Check-out** (`PATCH /api/Bookings/{id}/check-out`):
   - Chỉ từ trạng thái `Checked_in`.
   - Set room.BusinessStatus = Available, CleaningStatus = Dirty.

---

## ActivityLog Actions

| ActionCode | Severity | Gửi cho |
|---|---|---|
| `CREATE_BOOKING` | Success | Admin, Manager |
| `CONFIRM_BOOKING` | Success | Admin, Manager |
| `CANCEL_BOOKING` | Warning | Admin, Manager |
| `CHECKIN_BOOKING` | Success | Admin, Manager |
| `CHECKOUT_BOOKING` | Success | Admin, Manager |

---

## Entities liên quan
- `Booking` — bản ghi booking chính
- `BookingDetail` — chi tiết từng phòng trong booking
- `Room` — phòng vật lý được assign khi check-in
- `Voucher`, `VoucherUsage` — giảm giá

---

## DTOs

Tất cả DTO của module Booking nằm trong:
**`HotelManagement.Core/DTOs/BookingDTOs.cs`**

| DTO | Mục đích |
|---|---|
| `CreateBookingRequest` | Payload tạo mới booking |
| `CreateBookingDetailRequest` | Từng item chi tiết trong booking |
| `BookingResponse` | Trả về booking cho client |
| `BookingDetailResponse` | Trả về booking detail (kèm RoomName, RoomTypeName) |
