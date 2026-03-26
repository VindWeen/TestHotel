CREATE TABLE [dbo].[Activity_Logs](
    [id]            [int]            IDENTITY(1,1) NOT NULL,
    [user_id]       [int]            NULL,                        -- FK Users.id (ai thực hiện)
    [role_name]     [nvarchar](100)  NULL,                        -- cache tên role lúc thực hiện
    [action_code]   [nvarchar](100)  NOT NULL,                    -- APPROVE_REVIEW, CREATE_BOOKING...
    [action_label]  [nvarchar](255)  NOT NULL,                    -- "Duyệt đánh giá", "Tạo đặt phòng"
    [entity_type]   [nvarchar](100)  NULL,                        -- "Review", "Booking", "User"...
    [entity_id]     [int]            NULL,                        -- ID bản ghi bị tác động
    [entity_label]  [nvarchar](500)  NULL,                        -- mô tả thêm: "BK-0001", "Khách Hàng A"
    [severity]      [nvarchar](20)   NOT NULL DEFAULT 'Info',     -- Info / Warning / Success / Critical
    [message]       [nvarchar](max)  NOT NULL,                    -- nội dung thông báo hiển thị
    [metadata]      [nvarchar](max)  NULL,                        -- JSON thêm nếu cần
    [is_read]       [bit]            NOT NULL DEFAULT 0,          -- đã đọc chưa (cho UI bell icon)
    [created_at]    [datetime]       NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- FK về Users
ALTER TABLE [dbo].[Activity_Logs]
    WITH CHECK ADD FOREIGN KEY([user_id]) REFERENCES [dbo].[Users]([id])
GO

-- Index để query nhanh theo user và thời gian
CREATE NONCLUSTERED INDEX [IX_Activity_Logs_UserId_CreatedAt]
    ON [dbo].[Activity_Logs] ([user_id] ASC, [created_at] DESC)
GO

CREATE NONCLUSTERED INDEX [IX_Activity_Logs_EntityType_EntityId]
    ON [dbo].[Activity_Logs] ([entity_type] ASC, [entity_id] ASC)
GO