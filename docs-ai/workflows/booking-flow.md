# Workflow: Booking End-to-End

## Luồng đặt phòng online (Guest tự đặt)

```
1. Guest truy cập trang web
2. Chọn loại phòng, ngày check-in/out
3. POST /api/Bookings
   ├── Backend: Redis lock tránh race condition
   ├── Backend: Kiểm tra overlap ngày
   ├── Backend: Tính tiền (prices * nights)
   ├── Backend: Áp voucher nếu có
   ├── Backend: Tạo Booking (Status = Pending)
   ├── Backend: Ghi ActivityLog (CREATE_BOOKING)
   └── Response: BookingCode, totalAmount, depositAmount

4. Admin/Manager nhận notification realtime qua chuông
5. Manager xem danh sách Pending tại: GET /api/Bookings?status=Pending

6. Manager xác nhận: PATCH /api/Bookings/{id}/confirm
   ├── Backend: Status → Confirmed
   ├── Backend: Gửi email xác nhận cho khách
   └── Backend: Ghi ActivityLog (CONFIRM_BOOKING)

7. Khách đến, Receptionist check-in: PATCH /api/Bookings/{id}/check-in
   ├── Backend: Tìm phòng vật lý còn Available (theo RoomType)
   ├── Backend: Assign Room vào BookingDetail
   ├── Backend: Room.BusinessStatus = Occupied
   ├── Backend: Status → Checked_in
   └── Backend: Ghi ActivityLog (CHECKIN_BOOKING)

8. Khách trả phòng, Receptionist check-out: PATCH /api/Bookings/{id}/check-out
   ├── Backend: Room.BusinessStatus = Available
   ├── Backend: Room.CleaningStatus = Dirty
   ├── Backend: Status → Completed
   └── Backend: Ghi ActivityLog (CHECKOUT_BOOKING)

9. Housekeeping cập nhật dọn phòng xong:
   PATCH /api/Rooms/{id}/cleaning-status
   Body: { "cleaningStatus": "Clean" }
```

---

## Luồng Hủy Booking (Cancel)

```
1. Khách hoặc nhân viên hủy:
   PATCH /api/Bookings/{id}/cancel?reason=...

2. Backend:
   ├── Status → Cancelled
   ├── CancellationReason, CancelledAt được ghi lại
   ├── Giải phóng phòng liên quan (nếu đã assign)
   └── Ghi ActivityLog (CANCEL_BOOKING - Warning)
```
