# Module: Room Inventory (Vật tư phòng)

## Chức năng
Quản lý đồ vật trang bị trong mỗi phòng (asset và minibar). Dùng để tính phí khi khách làm mất/hỏng.

---

## Loại vật tư

| Type | Ví dụ |
|---|---|
| `Asset` | TV, điều hòa, minibar unit, khăn tắm |
| `Minibar` | Chai nước, snack, đồ uống |

---

## Business Rules

- Mỗi `RoomInventory` gắn với 1 `Room` cụ thể.
- `price_if_lost`: giá tính tiền bồi thường nếu mất/hỏng.
- Soft delete: `IsActive = false` qua `toggle-active` hoặc DELETE.
- Có endpoint `clone`: nhân bản danh sách vật tư từ phòng này sang phòng khác để tiết kiệm thao tác.

---

## Kết nối với Booking/Invoice

Khi check-out, Housekeeping có thể báo cáo vật tư mất/hỏng (bảng `Loss_And_Damages`):
- `penalty_amount` được tính dựa trên `price_if_lost`
- Khoản này được cộng vào Invoice cuối cùng

---

## Endpoints

```http
GET    /api/RoomInventories/room/{roomId}          # MANAGE_INVENTORY
GET    /api/RoomInventories/{id}                   # MANAGE_INVENTORY
POST   /api/RoomInventories                        # MANAGE_INVENTORY
PUT    /api/RoomInventories/{id}                   # MANAGE_INVENTORY
DELETE /api/RoomInventories/{id}                   # MANAGE_INVENTORY (soft delete)
POST   /api/RoomInventories/clone                  # MANAGE_INVENTORY — nhân bản từ phòng khác
PATCH  /api/RoomInventories/{id}/toggle-active     # MANAGE_INVENTORY
```
