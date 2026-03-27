-- Xoá bảng cũ (vì bảng này chỉ mới tạo, data chưa quan trọng)
IF OBJECT_ID('dbo.Activity_Log_Reads', 'U') IS NOT NULL 
BEGIN
    DROP TABLE [dbo].[Activity_Log_Reads];
END
GO

-- Tạo lại bảng với tên cột dạng snake_case (theo đúng convention của AppDbContext)
CREATE TABLE [dbo].[Activity_Log_Reads] (
    [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [activity_log_id] INT NOT NULL,
    [user_id] INT NOT NULL,
    [read_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT [fk_activity_log_reads_activity_logs] FOREIGN KEY ([activity_log_id]) REFERENCES [dbo].[Activity_Logs] ([id]) ON DELETE CASCADE,
    CONSTRAINT [fk_activity_log_reads_users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([id]) ON DELETE CASCADE
);
GO

-- Tạo lại Index unique
CREATE UNIQUE INDEX [uk_activity_log_user] ON [dbo].[Activity_Log_Reads] ([activity_log_id], [user_id]);
GO

-- Tạo index cho user_id để truy vấn nhanh
CREATE INDEX [ix_activity_log_reads_user_id] ON [dbo].[Activity_Log_Reads] ([user_id]);
GO
