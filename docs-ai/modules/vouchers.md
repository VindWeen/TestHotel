# Module: Vouchers

## Chức năng
Quản lý mã giảm giá khi đặt phòng. Validate và áp dụng khi tạo booking.

---

## Loại Voucher

| Type | Mô tả |
|---|---|
| `PERCENT` | Giảm theo % tổng giá trị |
| `FIXED_AMOUNT` | Giảm một số tiền cố định |

---

## Business Rules

- Mỗi voucher có `usage_limit`: tổng lần dùng toàn hệ thống.
- `max_uses_per_user`: giới hạn số lần dùng của 1 user.
- `min_booking_value`: giá trị booking tối thiểu để áp dụng.
- Có thời hạn: `valid_from` và `valid_until`.
- Soft delete (không xóa vật lý) — `IsActive = false` qua `DELETE`.

### Validate Voucher (khi đặt phòng)
Gọi `POST /api/Vouchers/validate` trước khi tạo booking:
```json
Request: { "code": "KM1", "bookingAmount": 1500000 }
Response: { "valid": true, "discountAmount": 200000, "finalAmount": 1300000 }
```

Các trường hợp invalid:
- Voucher không tồn tại hoặc inactive
- Ngoài thời hạn
- Đã dùng đủ lần (`usage_limit` hoặc `max_uses_per_user`)
- Tổng booking chưa đạt `min_booking_value`

---

## Endpoints

```http
GET    /api/Vouchers            # MANAGE_BOOKINGS — danh sách
GET    /api/Vouchers/{id}       # MANAGE_BOOKINGS — chi tiết
POST   /api/Vouchers            # MANAGE_BOOKINGS — tạo mới
PUT    /api/Vouchers/{id}       # MANAGE_BOOKINGS — chỉnh sửa
DELETE /api/Vouchers/{id}       # MANAGE_BOOKINGS — soft delete
POST   /api/Vouchers/validate   # [Authorize] — validate voucher code
```

---

## Seed Data
10 voucher mẫu: KM1 → KM10, dạng PERCENT và FIXED_AMOUNT, active sẵn.
