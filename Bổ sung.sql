-- ============================================================
-- Thêm refresh_token + refresh_token_expiry vào Users
-- ============================================================
 
ALTER TABLE [dbo].[Users]
    ADD [refresh_token]        [nvarchar](500) NULL,
        [refresh_token_expiry] [datetime]      NULL;
GO