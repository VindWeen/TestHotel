-- ============================================================
-- BẢNG NOTIFICATIONS
-- Lưu thông báo hệ thống cho Admin/Manager/Staff
-- ============================================================

USE [HotelManagementDB]
GO

CREATE TABLE [dbo].[Notifications](
    [id]            [int]            IDENTITY(1,1) NOT NULL,
    
    -- Người nhận (NULL = broadcast cho cả role)
    [user_id]       [int]            NULL,           -- FK Users.id — người nhận cụ thể
    [target_role]   [nvarchar](100)  NULL,           -- "Admin" / "Manager" / "Receptionist" ...
                                                     -- NULL = gửi đến user_id cụ thể
    -- Nội dung
    [title]         [nvarchar](255)  NOT NULL,
    [message]       [nvarchar](max)  NOT NULL,
    [type]          [nvarchar](20)   NOT NULL DEFAULT 'Info',   -- Success / Error / Warning / Info
    
    -- Hành động liên quan (để FE điều hướng)
    [action]        [nvarchar](100)  NULL,           -- "CreateBooking" / "ApproveReview" ...
    [entity_type]   [nvarchar](100)  NULL,           -- "Bookings" / "Reviews" / "Users" ...
    [entity_id]     [int]            NULL,           -- ID bản ghi liên quan (để điều hướng)
    [redirect_url]  [nvarchar](500)  NULL,           -- "/admin/bookings/5" (tùy chọn)

    -- Người thực hiện hành động
    [actor_id]      [int]            NULL,           -- FK Users.id — ai tạo ra thông báo này
    [actor_name]    [nvarchar](255)  NULL,           -- cache tên để tránh JOIN

    -- Trạng thái đọc
    [is_read]       [bit]            NOT NULL DEFAULT 0,
    [read_at]       [datetime]       NULL,

    -- Soft delete
    [is_active]     [bit]            NOT NULL DEFAULT 1,

    [created_at]    [datetime]       NOT NULL DEFAULT GETDATE(),

PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- ── Foreign Keys ──────────────────────────────────────────────
ALTER TABLE [dbo].[Notifications]
    WITH CHECK ADD FOREIGN KEY([user_id])
    REFERENCES [dbo].[Users] ([id])
GO

ALTER TABLE [dbo].[Notifications]
    WITH CHECK ADD FOREIGN KEY([actor_id])
    REFERENCES [dbo].[Users] ([id])
GO

-- ── Indexes ───────────────────────────────────────────────────
-- Tra cứu nhanh thông báo của 1 user
CREATE NONCLUSTERED INDEX [IX_Notifications_UserId_IsRead]
    ON [dbo].[Notifications] ([user_id] ASC, [is_read] ASC, [is_active] ASC)
    INCLUDE ([title], [message], [created_at])
GO

-- Tra cứu broadcast theo role
CREATE NONCLUSTERED INDEX [IX_Notifications_TargetRole]
    ON [dbo].[Notifications] ([target_role] ASC, [is_active] ASC)
    INCLUDE ([title], [created_at])
GO

-- Check constraint cho type
ALTER TABLE [dbo].[Notifications]
    WITH CHECK ADD CONSTRAINT [CK_Notifications_Type]
    CHECK ([type] IN ('Success', 'Error', 'Warning', 'Info'))
GO