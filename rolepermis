# Permission Matrix

Tài liệu này tổng hợp phân quyền hiện tại theo code đang có trong backend, frontend routing/menu, và dữ liệu seed trong `hotel.sql`.

## 1. Role -> Thấy Gì / Làm Được Gì

| Role | Permission seed hiện tại | Thấy được gì trên frontend | Làm được gì thực tế |
|---|---|---|---|
| `Admin` | `VIEW_DASHBOARD`, `MANAGE_USERS`, `MANAGE_ROLES`, `MANAGE_ROOMS`, `MANAGE_BOOKINGS`, `MANAGE_INVOICES`, `MANAGE_SERVICES`, `VIEW_REPORTS`, `MANAGE_CONTENT`, `MANAGE_INVENTORY`, `VIEW_USERS`, `VIEW_ROLES`, `EDIT_ROLES`, `CREATE_USERS` | Thấy toàn bộ menu/trang admin hiện có: dashboard, rooms, housekeeping, room-types, items, loss-damage, bookings, invoices, services, order-services, memberships, staff, roles | Làm được gần như toàn bộ thao tác admin hiện tại |
| `Manager` | `VIEW_DASHBOARD`, `MANAGE_USERS`, `MANAGE_ROOMS`, `MANAGE_BOOKINGS`, `MANAGE_INVOICES`, `MANAGE_SERVICES`, `VIEW_REPORTS`, `MANAGE_CONTENT`, `MANAGE_INVENTORY`, `VIEW_USERS`, `VIEW_ROLES` | Thấy: dashboard, rooms, housekeeping, room-types, items, loss-damage, bookings, invoices, services, order-services, memberships, staff, roles | Dùng được các module trên; xem user được; sửa user/khóa-reset user được; xem role được; không tạo user vì thiếu `CREATE_USERS`; không đổi role/phân quyền vì thiếu `EDIT_ROLES` |
| `Receptionist` | `VIEW_DASHBOARD`, `MANAGE_ROOMS`, `MANAGE_BOOKINGS`, `MANAGE_INVOICES`, `MANAGE_SERVICES`, `MANAGE_CONTENT`, `MANAGE_INVENTORY` | Thấy: dashboard, rooms, housekeeping, room-types, items, loss-damage, bookings, invoices, services, order-services | Làm được các thao tác thuộc phòng, kho, booking, invoice, service; không vào staff, memberships, roles |
| `Accountant` | `VIEW_DASHBOARD`, `MANAGE_USERS`, `MANAGE_ROOMS`, `MANAGE_BOOKINGS`, `MANAGE_INVOICES`, `MANAGE_SERVICES`, `VIEW_REPORTS` | Thấy: dashboard, rooms, housekeeping, room-types, bookings, invoices, services, order-services, memberships, staff | Memberships và loyalty dùng được; route staff thấy được; nhưng danh sách user có thể lỗi do backend cần `VIEW_USERS` mà role này không có |
| `Housekeeping` | `MANAGE_ROOMS`, `MANAGE_INVOICES`, `MANAGE_SERVICES`, `VIEW_REPORTS`, `MANAGE_CONTENT`, `MANAGE_INVENTORY` | Thấy: rooms, housekeeping, room-types, items, loss-damage, invoices, services, order-services | Làm được các thao tác tương ứng; đăng nhập mặc định sẽ vào `/admin/housekeeping` nếu không có dashboard |
| `Security` | Không có permission seed | Không thấy trang admin nào | Vào `/admin` sẽ rơi sang `403` |
| `Chef` | `MANAGE_SERVICES`, `VIEW_REPORTS`, `MANAGE_CONTENT`, `MANAGE_INVENTORY` | Thấy: items, loss-damage, services, order-services | Làm được inventory và services; mặc định đăng nhập vào `/admin/items` |
| `Waiter` | Không có permission seed | Không thấy trang admin nào | Vào `/admin` sẽ `403` |
| `IT Support` | `VIEW_DASHBOARD`, `MANAGE_USERS`, `MANAGE_ROLES`, `MANAGE_ROOMS`, `MANAGE_BOOKINGS`, `MANAGE_INVOICES`, `VIEW_REPORTS`, `MANAGE_CONTENT` | Thấy: dashboard, rooms, housekeeping, room-types, bookings, invoices, memberships, staff, roles | Có lệch quyền rõ: staff route thấy được nhưng list user có thể 403 vì thiếu `VIEW_USERS`; roles route thấy được trên frontend vì frontend coi `MANAGE_ROLES` như đủ quyền, nhưng backend roles API vẫn có thể 403 vì thiếu `VIEW_ROLES` hoặc `EDIT_ROLES` |
| `Guest` | Không có permission seed | Không có trang admin | Vào `/admin` sẽ `403` |

## 2. Permission -> Thấy Gì / API Gì

| Permission | Thấy được trang/menu | Làm được ở backend |
|---|---|---|
| `VIEW_DASHBOARD` | `/admin/dashboard` | Xem dashboard |
| `MANAGE_ROOMS` | `/admin/rooms`, `/admin/rooms/:id`, `/admin/housekeeping`, `/admin/room-types` | CRUD rooms, room types, amenities, cập nhật business status, cleaning status, bulk create room |
| `MANAGE_INVENTORY` | `/admin/items`, `/admin/loss-damage` | CRUD equipments, room inventories, loss and damages, sync stock/in-use, preview sync |
| `MANAGE_BOOKINGS` | `/admin/bookings`, `/admin/bookings/:id` | Xem booking, chi tiết booking, confirm, check-in, check-out, quản lý voucher |
| `MANAGE_INVOICES` | `/admin/invoices`, `/admin/invoices/:id` | Xem invoice, tạo invoice từ booking/checkout, finalize invoice, payment |
| `MANAGE_SERVICES` | `/admin/services`, `/admin/services/categories`, `/admin/services/items`, `/admin/order-services` | CRUD service category, service item, order service, cập nhật trạng thái order service |
| `MANAGE_USERS` | `/admin/staff`, `/admin/memberships` | Cập nhật user, khóa/mở khóa user, reset password, CRUD membership, xem loyalty members và loyalty transactions |
| `VIEW_USERS` | Không tự mở route/menu nào | `GET /api/UserManagement`, `GET /api/UserManagement/{id}` |
| `CREATE_USERS` | Không tự mở route/menu nào | `POST /api/UserManagement` |
| `VIEW_ROLES` | `/admin/roles` | `GET /api/Roles`, `GET /api/Roles/{id}`, `GET /api/Permissions` |
| `EDIT_ROLES` | Không có route riêng | `POST /api/Roles/assign-permission`, dùng cùng `MANAGE_USERS` để đổi role user qua `PUT /api/UserManagement/{id}/change-role` |
| `MANAGE_ROLES` | Frontend đang coi như đủ để vào trang roles | Backend hiện không có controller nào check trực tiếp permission này cho roles page/API |
| `MANAGE_CONTENT` | Hiện chưa nối route/menu admin tương ứng | CRUD article categories, articles, attractions, approve review |
| `VIEW_REPORTS` | Hiện chưa thấy route/menu/admin page tương ứng | Chưa thấy API admin hiện tại đang check trực tiếp |

### Mapping route frontend hiện tại

| Route | Permission chặn route |
|---|---|
| `/admin/dashboard` | `VIEW_DASHBOARD` |
| `/admin/rooms` | `MANAGE_ROOMS` |
| `/admin/rooms/:id` | `MANAGE_ROOMS` |
| `/admin/housekeeping` | `MANAGE_ROOMS` |
| `/admin/room-types` | `MANAGE_ROOMS` |
| `/admin/items` | `MANAGE_INVENTORY` |
| `/admin/loss-damage` | `MANAGE_INVENTORY` |
| `/admin/bookings` | `MANAGE_BOOKINGS` |
| `/admin/bookings/:id` | `MANAGE_BOOKINGS` |
| `/admin/invoices` | `MANAGE_INVOICES` |
| `/admin/invoices/:id` | `MANAGE_INVOICES` |
| `/admin/services` | `MANAGE_SERVICES` |
| `/admin/services/categories` | `MANAGE_SERVICES` |
| `/admin/services/items` | `MANAGE_SERVICES` |
| `/admin/order-services` | `MANAGE_SERVICES` |
| `/admin/staff` | `MANAGE_USERS` |
| `/admin/memberships` | `MANAGE_USERS` |
| `/admin/roles` | `VIEW_ROLES` nhưng frontend cho `MANAGE_ROLES` đi qua |

### Landing page mặc định sau login

| Điều kiện | Redirect mặc định |
|---|---|
| Có `VIEW_DASHBOARD` | `/admin/dashboard` |
| Role là `Housekeeping` và có `MANAGE_ROOMS` | `/admin/housekeeping` |
| Có `MANAGE_ROOMS` | `/admin/rooms` |
| Có `MANAGE_INVENTORY` | `/admin/items` |
| Có `MANAGE_BOOKINGS` | `/admin/bookings` |
| Có `MANAGE_SERVICES` | `/admin/services` |
| Có `MANAGE_INVOICES` | `/admin/invoices` |
| Có `MANAGE_USERS` | `/admin/staff` |
| Có `VIEW_ROLES` | `/admin/roles` |
| Không khớp gì | `/403` |

## 3. Các Điểm Lệch Frontend - Backend Cần Sửa

| Vấn đề | Frontend hiện tại | Backend hiện tại | Hệ quả |
|---|---|---|---|
| Route `staff` đang check rộng hơn API | Route và menu `staff` dùng `MANAGE_USERS` | API list/detail user dùng `VIEW_USERS` | Có role nhìn thấy trang staff nhưng vào là lỗi 403 khi load dữ liệu |
| Nút thao tác trong `UserListPage` chưa tách theo quyền nhỏ | Cùng một page đang render thêm user, sửa user, đổi role, reset password, toggle status | Tạo user cần `CREATE_USERS`; đổi role cần `MANAGE_USERS` + `EDIT_ROLES`; xem list cần `VIEW_USERS` | User có thể nhìn thấy nút nhưng bấm sẽ fail API |
| Trang `roles` đang cho `MANAGE_ROLES` đi qua ở frontend | `RequirePermission` coi `MANAGE_ROLES` tương đương `VIEW_ROLES` và `EDIT_ROLES` | Roles API chỉ check chính xác `VIEW_ROLES` hoặc `EDIT_ROLES` | Có role như `IT Support` thấy được trang roles nhưng gọi API có thể 403 |
| `MANAGE_ROLES` gần như chưa được backend dùng trực tiếp | FE có logic fallback cho `MANAGE_ROLES` | BE handler check exact claim `permission` | Ý nghĩa permission này đang không nhất quán giữa FE và BE |
| `VIEW_USERS` và `CREATE_USERS` chưa được frontend biểu diễn đúng | FE mở route staff theo `MANAGE_USERS` | BE tách `VIEW_USERS`, `CREATE_USERS`, `MANAGE_USERS`, `EDIT_ROLES` | RBAC đang chi tiết ở backend nhưng frontend vẫn coarse-grained |
| `VIEW_REPORTS` và `MANAGE_CONTENT` đã có seed nhưng chưa có admin route/menu tương ứng | FE chưa expose page riêng | BE có một số API content, reports thì gần như chưa thấy dùng | Có permission nhưng người dùng chưa thấy được module tương ứng trong admin |

### Đề xuất hướng chỉnh

| Nhóm | Nên làm |
|---|---|
| Frontend route/menu | Tách `staff` thành quyền xem bằng `VIEW_USERS`, nút tạo mới bằng `CREATE_USERS`, nút đổi role bằng `EDIT_ROLES`, nút edit/reset/toggle bằng `MANAGE_USERS` |
| Frontend roles page | Chỉ cho vào bằng `VIEW_ROLES`; chỉ hiện nút phân quyền khi có `EDIT_ROLES`; bỏ suy luận `MANAGE_ROLES => VIEW_ROLES/EDIT_ROLES` nếu backend không dùng cùng logic |
| Backend hoặc seed | Nếu muốn giữ `MANAGE_ROLES` là quyền tổng, cần sửa backend authorization để chấp nhận nó như quyền cha; nếu không thì nên bỏ hoặc ngừng cấp riêng permission này |
| Tài liệu hệ thống | Chốt lại chuẩn RBAC theo một trong hai hướng: coarse-grained theo module hoặc fine-grained theo action, tránh FE và BE dùng hai chuẩn khác nhau |

## Nguồn Tổng Hợp

| Nguồn | Mục đích |
|---|---|
| `hotel-erp-frontend/src/routes/AdminRoutes.jsx` | Xác định route nào cần permission gì |
| `hotel-erp-frontend/src/layouts/AdminLayout.jsx` | Xác định menu nào được hiển thị |
| `hotel-erp-frontend/src/routes/RequirePermission.jsx` | Xác định logic chặn route hiện tại |
| `hotel-erp-frontend/src/routes/permissionRouting.js` | Xác định redirect mặc định sau login |
| `hotel-erp-frontend/src/pages/admin/UserListPage.jsx` | Xác định các nút/thao tác đang render ở trang user |
| `hotel-erp-frontend/src/pages/admin/RolePermissionPage.jsx` | Xác định quyền xem/chỉnh role page |
| `HotelManagement.API/Controllers/UserManagementController.cs` | Xác định permission backend của module user |
| `HotelManagement.API/Controllers/RolesController.cs` | Xác định permission backend của module roles |
| `HotelManagement.API/Controllers/MembershipsController.cs` | Xác định permission backend của membership tiers |
| `HotelManagement.API/Controllers/LoyaltyMembersController.cs` | Xác định permission backend của loyalty member |
| `HotelManagement.Core/Helpers/JwtHelper.cs` | Xác định token đang nhét permission dạng claim exact match |
| `hotel.sql` | Xác định seed role và role-permission hiện tại |
