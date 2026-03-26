# 📘 ActivityLog - Thiết kế & Triển khai

## 1. 📌 Tên bảng & Entity

- **Entity:** `ActivityLog`
- **Bảng SQL:** `Activity_Logs`

### ✅ Lý do chọn tên

- `Notification` đã dùng cho DTO (`NotificationEnums.cs`)
- `AuditLog` thiên về log kỹ thuật / bảo mật
- 👉 `ActivityLog` rõ nghĩa: **ghi lại hành động nghiệp vụ hiển thị cho người dùng**

---

## 2. 🗄️ SQL tạo bảng

```sql
CREATE TABLE [dbo].[Activity_Logs](
    [id]            [int]            IDENTITY(1,1) NOT NULL,
    [user_id]       [int]            NULL,
      NULL,
      NOT NULL,
      NOT NULL,
      NULL,
    [entity_id]     [int]            NULL,
      NULL,
       NOT NULL DEFAULT 'Info',
    [message]       [nvarchar](max)  NOT NULL,
    [metadata]      [nvarchar](max)  NULL,
    [is_read]       [bit]            NOT NULL DEFAULT 0,
    [created_at]    [datetime]       NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
```

### 🔗 Foreign Key

```sql
ALTER TABLE [dbo].[Activity_Logs]
ADD FOREIGN KEY([user_id]) REFERENCES [dbo].[Users]([id])
GO
```

### ⚡ Index tối ưu truy vấn

```sql
CREATE NONCLUSTERED INDEX [IX_Activity_Logs_UserId_CreatedAt]
ON [dbo].[Activity_Logs] ([user_id] ASC, [created_at] DESC)
GO

CREATE NONCLUSTERED INDEX [IX_Activity_Logs_EntityType_EntityId]
ON [dbo].[Activity_Logs] ([entity_type] ASC, [entity_id] ASC)
GO
```

---

## 3. 🌱 Seed Data mẫu

```sql
SET IDENTITY_INSERT [dbo].[Activity_Logs] ON

INSERT INTO [dbo].[Activity_Logs]
([id],[user_id],[role_name],[action_code],[action_label],[entity_type],[entity_id],[entity_label],[severity],[message],[is_read],[created_at])
VALUES
(1, 1, N'Admin', N'APPROVE_REVIEW', N'Duyệt đánh giá', N'Review', 1, N'Review #1', N'Success', N'Admin đã duyệt đánh giá của Khách Hàng A.', 0, GETDATE()),
(2, 3, N'Receptionist', N'CONFIRM_BOOKING', N'Xác nhận đặt phòng', N'Booking', 3, N'BK-0003', N'Success', N'Lễ tân đã xác nhận booking BK-0003.', 0, GETDATE()),
(3, 1, N'Admin', N'LOCK_ACCOUNT', N'Khóa tài khoản', N'User', 7, N'Khách Hàng B', N'Warning', N'Admin đã khóa tài khoản.', 1, GETDATE())

SET IDENTITY_INSERT [dbo].[Activity_Logs] OFF
GO
```

---

## 4. 💻 Entity C#

📂 `HotelManagement.Core/Entities/ActivityLog.cs`

```csharp
namespace HotelManagement.Core.Entities;

public class ActivityLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? RoleName { get; set; }

    public string ActionCode { get; set; } = null!;
    public string ActionLabel { get; set; } = null!;

    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? EntityLabel { get; set; }

    public string Severity { get; set; } = "Info";
    public string Message { get; set; } = null!;
    public string? Metadata { get; set; }

    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; }

    public User? User { get; set; }
}
```

---

## 5. 🔗 Cập nhật User Entity

```csharp
public ICollection<ActivityLog> ActivityLogs { get; set; } = [];
```

---

## 6. ⚙️ Cập nhật AppDbContext

### Thêm DbSet

```csharp
public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
```

### Config trong OnModelCreating

```csharp
modelBuilder.Entity<ActivityLog>().ToTable("Activity_Logs");

modelBuilder.Entity<ActivityLog>()
    .HasIndex(a => new { a.UserId, a.CreatedAt });

modelBuilder.Entity<ActivityLog>()
    .HasIndex(a => new { a.EntityType, a.EntityId });
```

---

## 7. 🚀 Cách sử dụng trong Controller

### Ví dụ: Approve Review

```csharp
_context.ActivityLogs.Add(new ActivityLog
{
    UserId      = currentUserId,
    RoleName    = User.FindFirst("role")?.Value,
    ActionCode  = request.IsApproved ? "APPROVE_REVIEW" : "REJECT_REVIEW",
    ActionLabel = request.IsApproved ? "Duyệt đánh giá" : "Từ chối đánh giá",
    EntityType  = "Review",
    EntityId    = id,
    EntityLabel = $"Review #{id}",
    Severity    = request.IsApproved ? "Success" : "Warning",
    Message     = request.IsApproved
        ? $"Đã duyệt đánh giá #{id}"
        : $"Đã từ chối đánh giá #{id}: {request.RejectionReason}",
    CreatedAt   = DateTime.UtcNow
});
```

---

## 8. ✅ Checklist triển khai

- [ ] Chạy SQL tạo bảng `Activity_Logs`
- [ ] Tạo `ActivityLog.cs`
- [ ] Thêm navigation vào `User.cs`
- [ ] Thêm `DbSet` vào `AppDbContext`
- [ ] Config index + table mapping
- [ ] Gọi `_context.ActivityLogs.Add(...)` trong các controller

---

## 🎯 Ghi chú thêm

- `ActivityLog` dùng cho **UI notification (bell icon)**
- Có thể mở rộng:
  - Filter theo `IsRead`
  - API lấy log theo user
  - Realtime (SignalR) nếu cần

---
