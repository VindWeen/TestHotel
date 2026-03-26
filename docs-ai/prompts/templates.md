# Prompt Templates

Các prompt mẫu tái sử dụng cho AI agents khi làm việc với project TestHotel.

---

## 🔧 Tạo API Controller mới

```
Dựa vào docs-ai/architecture.md, docs-ai/conventions.md và docs-ai/api-guidelines.md,
hãy tạo một REST API controller cho [Module Name] trong project TestHotel.

Yêu cầu:
- Namespace: HotelManagement.API.Controllers
- Inject: AppDbContext, IActivityLogService
- Endpoints cần có: [GET list / GET by id / POST / PUT / DELETE]
- Permissions: RequirePermission(PermissionCodes.Manage[Module])
- Mỗi CUD action: gọi _activityLog.LogAsync() + AuditLog
- Response format: tuân theo conventions.md
- Message trong ActivityLog: luôn có tên người thực hiện từ User.FindFirst("full_name")
- Thêm ActionCode vào NotificationPolicy.cs
```

---

## 🗄️ Tạo Entity mới

```
Dựa vào docs-ai/database.md và conventions.md, tạo Entity class mới cho [EntityName]:

Fields cần có:
- [list fields]

Yêu cầu:
- Namespace: HotelManagement.Core.Entities
- Naming: snake_case cho columns (dùng [Column("...")] annotation)
- PrimaryKey: int Id
- Timestamps: DateTime? CreatedAt, DateTime? UpdatedAt
- Thêm DbSet<EntityName> vào AppDbContext
- Tạo migration
- Cập nhật docs-ai/database.md
```

---

## 🐛 Debug / Fix Bug

```
Project: TestHotel Hotel ERP
Tech stack: ASP.NET Core 8 + React + SignalR + EF Core + SQL Server

Vấn đề: [mô tả bug]

Files liên quan:
- [file 1]
- [file 2]

Hãy:
1. Phân tích nguyên nhân
2. Đề xuất fix tối thiểu, không phá vỡ convention
3. Kiểm tra xem fix có ảnh hưởng docs-ai không
```

---

## 📢 Thêm Notification cho Action

```
Trong project TestHotel, hãy thêm thông báo realtime cho action "[ACTION_NAME]":

1. Thêm ActionCode "[ACTION_CODE]" vào NotificationPolicy.cs, gửi cho: [roles]
2. Trong [Controller].cs tại action [method name]:
   - Gọi _activityLog.LogAsync() với đầy đủ tham số
   - Message phải có tên người thực hiện: User.FindFirst("full_name")?.Value
   - Severity phù hợp: Info | Success | Warning | Error
3. Cập nhật docs-ai/modules/[module].md — bảng ActivityLog Actions
```

---

## 🔍 Review Code

```
Review đoạn code sau trong project TestHotel theo tiêu chí:
1. Có tuân theo conventions.md không?
2. ActivityLog và AuditLog có đầy đủ không?
3. Không hardcode tên role/người dùng?
4. SaveChangesAsync không bị gọi thừa?
5. Response format có đúng chuẩn?
6. Docs-ai nào cần update?

[paste code vào đây]
```
