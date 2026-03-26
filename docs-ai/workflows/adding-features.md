# Workflow: Thêm Tính năng Mới (Adding a Feature)

## Checklist khi thêm một module/feature mới

### 1. Backend — Entity mới

```
[ ] Tạo Entity class trong HotelManagement.Core/Entities/
[ ] Add DbSet<Entity> vào AppDbContext
[ ] Tạo migration: dotnet ef migrations add AddEntity
[ ] Update database: dotnet ef database update
[ ] Cập nhật docs-ai/database.md
```

### 2. Backend — Controller mới

```
[ ] Tạo [Name]Controller.cs trong HotelManagement.API/Controllers/
[ ] Inject AppDbContext, IActivityLogService vào constructor
[ ] Thêm [RequirePermission(...)] cho các action cần quyền
[ ] Với mỗi CUD action: gọi _activityLog.LogAsync() + AuditLog
[ ] Thêm ActionCode mới vào NotificationPolicy.cs
[ ] Cập nhật docs-ai/api-guidelines.md
[ ] Tạo hoặc cập nhật docs-ai/modules/[module].md
```

### 3. Frontend — API + UI

```
[ ] Tạo src/api/[name]Api.js với các Axios calls
[ ] Tạo store nếu cần: src/store/[name]Store.js
[ ] Tạo page: src/pages/admin/[module]/[Page].jsx
[ ] Thêm route vào routes config
[ ] Thêm menu item vào sidebar (AdminLayout hoặc sidebar config)
```

### 4. Notification (nếu cần thông báo)

```
[ ] Định nghĩa ActionCode: "NEW_ACTION" (SCREAMING_SNAKE_CASE)
[ ] Thêm vào NotificationPolicy.cs: { "NEW_ACTION", new[] { "Admin" } }
[ ] Gọi _activityLog.LogAsync(actionCode: "NEW_ACTION", ...) trong controller
[ ] Không cần sửa gì ở frontend — tự động được xử lý qua hook
```

---

## Checklist khi sửa feature hiện có

```
[ ] Sửa code tương ứng
[ ] Update message trong LogAsync nếu nghĩa thay đổi
[ ] Update docs-ai/modules/[module].md
[ ] Nếu thay đổi schema → update docs-ai/database.md
[ ] Nếu thay đổi API → update docs-ai/api-guidelines.md
[ ] Nếu thay đổi rule thông báo → update NotificationPolicy.cs + docs
```

---

## Workflow: Thêm Notification Rule mới

```
1. Quyết định ActionCode: "MY_ACTION"
2. Quyết định ai nhận: ["Admin"] hoặc ["Admin", "Manager"]

3. Mở file: HotelManagement.API/Policies/NotificationPolicy.cs
4. Thêm dòng vào ActionRoleMap:
   { "MY_ACTION", new[] { "Admin" } }

5. Trong Controller, gọi:
   await _activityLog.LogAsync(
       actionCode: "MY_ACTION",
       actionLabel: "Tên hành động VN",
       message: $"{actionUser} đã ...",
       ...
   );

6. DONE — realtime push và history filter tự động áp dụng rule mới.
```
