# Overview — TestHotel ERP System

## Mô tả dự án

**TestHotel** là một hệ thống ERP quản lý khách sạn (Hotel Management ERP) fullstack, được xây dựng như đề tài môn học **Lập trình Ứng dụng Web** tại LHU.

Hệ thống bao gồm:
- Backend REST API (C# ASP.NET Core)
- Frontend SPA (React + Vite)
- Realtime notifications (SignalR)

---

## Tech Stack

### Backend
| Layer | Công nghệ |
|---|---|
| Framework | ASP.NET Core 8 Web API |
| ORM | Entity Framework Core (Code-First) |
| Database | SQL Server |
| Auth | JWT Bearer Token |
| Realtime | SignalR |
| Cache/Lock | Redis (StackExchange.Redis) |
| Email | SMTP (custom IEmailService) |
| Password | BCrypt.Net |

### Frontend
| Layer | Công nghệ |
|---|---|
| Framework | React 18 + Vite |
| State | Zustand |
| UI Library | Ant Design (antd) |
| HTTP Client | Axios |
| Realtime | @microsoft/signalr |
| Routing | React Router v6 |
| Auth guard | Role-based routing |

---

## Mục tiêu hệ thống

1. **Quản lý Nhân sự**: Tạo/sửa/khóa tài khoản nhân viên, phân quyền theo role.
2. **Quản lý Phòng**: CRUD phòng, loại phòng, tiện nghi, trạng thái kinh doanh & vệ sinh.
3. **Đặt phòng**: Tạo booking, xác nhận, check-in, check-out, hủy.
4. **Nội dung**: Bài viết, địa điểm du lịch gần khách sạn.
5. **Khách hàng**: Đăng ký/đăng nhập, tích điểm loyalty, membership tier.
6. **Realtime Notifications**: SignalR push notifications cho Admin/Manager khi có sự kiện quan trọng.
7. **Audit Trail**: Toàn bộ hành động quan trọng được ghi AuditLog + ActivityLog.

---

## Roles hệ thống

Project có tổng cộng **10 roles**:

| Role | Mô tả |
|---|---|
| `Admin` | Quyền cao nhất, quản lý toàn bộ |
| `Manager` | Quản lý vận hành khách sạn |
| `Receptionist` | Lễ tân, xử lý check-in/out |
| `Housekeeping` | Cập nhật trạng thái vệ sinh phòng |
| `Accountant` | Quản lý hóa đơn, thanh toán |
| `Security` | Bảo vệ |
| `Chef` | Đầu bếp |
| `Waiter` | Phục vụ |
| `IT Support` | Hỗ trợ kỹ thuật |
| `Guest` | Khách đặt phòng trực tuyến |

---

## Cấu trúc thư mục gốc

```
TestHotel/
├── HotelManagement.API/        # Web API layer
├── HotelManagement.Core/       # Domain entities, interfaces, helpers
├── HotelManagement.Infrastructure/ # DbContext, migrations
├── hotel-erp-frontend/         # React frontend
└── docs-ai/                    # AI documentation (thư mục này)
```

---

## Seed Data (mặc định)

| Bảng | Số bản ghi |
|---|---|
| Roles | 10 |
| Permissions | 10 |
| Memberships | 10 (Khách Mới → Signature) |
| Users | 10 (1 Admin, staff, 5 khách hàng) |
| Room Types | 10 (Standard → Royal Villa) |
| Rooms | 10 |
| Amenities | 10 |
| Vouchers | 10 (KM1–KM10) |
| Bookings | 10 |

**Tài khoản Admin mặc định:** `admin@hotel.com` / `Admin@123`

---

## TODO — Tính năng chưa cài đặt

> Các controller sau **chưa có** trong codebase hiện tại:

- `InvoicesController` — tạo và quản lý hóa đơn
- `ServicesController` — CRUD dịch vụ và danh mục
- `OrderServicesController` — đặt dịch vụ trong phòng  
- `ShiftsController` — quản lý ca làm việc nhân viên
- `LoyaltyController` — xem và quy đổi điểm thưởng
- `ReportsController` — dashboard và báo cáo thống kê
- Tự động tạo Invoice sau check-out (`// TODO` trong BookingController)
- Rate limiting
