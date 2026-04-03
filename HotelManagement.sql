--============================================== TẠO DATABASE ============================================
use master
if exists(select * from sys.databases where name = 'HotelManagementDB')
    drop database [HotelManagementDB]
go
create database [HotelManagementDB]

--============================================ TẠO BẢNG =================================
go 
USE [HotelManagementDB]
GO

-- ============================================================
-- CLUSTER 1: SYSTEM, AUTH & HR
-- ============================================================

CREATE TABLE [dbo].[Roles](
    [id]          [int]           IDENTITY(1,1) NOT NULL,
    [name]        [nvarchar](100) NOT NULL,
    [description] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Permissions](
    [id]              [int]         IDENTITY(1,1) NOT NULL,
    [name]            [nvarchar](100) NOT NULL,
    [permission_code] [varchar](50)   NOT NULL,         -- BOOKING_CREATE, ROOM_EDIT, REPORT_VIEW
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Role_Permissions](
    [role_id]       [int] NOT NULL,
    [permission_id] [int] NOT NULL,
PRIMARY KEY CLUSTERED ([role_id] ASC, [permission_id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Memberships](
    [id]               [int]           IDENTITY(1,1) NOT NULL,
    [tier_name]        [nvarchar](100) NOT NULL,
    [min_points]       [int]           NULL,
    [max_points]       [int]           NULL,            -- giới hạn trên của dải điểm, NULL = không giới hạn
    [discount_percent] [decimal](5, 2) NULL,
    [color_hex]        [varchar](7)    NULL,            -- màu badge FE: #CD7F32 Bronze, #C0C0C0 Silver, #FFD700 Gold
    [is_active]        [bit]           NOT NULL DEFAULT 1,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Users](
    -- Identity & Auth
    [id]                   [int]            IDENTITY(1,1) NOT NULL,
    [role_id]              [int]            NULL,
    [membership_id]        [int]            NULL,
    -- Thông tin cơ bản
    [full_name]            [nvarchar](255)  NOT NULL,
    [email]                [nvarchar](255)  NOT NULL,
    [phone]                [nvarchar](50)   NULL,
    [date_of_birth]        [date]           NULL,        -- ưu đãi sinh nhật, CRM
    [gender]               [nvarchar](10)   NULL,        -- phân tích khách hàng
    [address]              [nvarchar](500)  NULL,        -- xuất hóa đơn VAT
    [national_id]          [nvarchar](20)   NULL,        -- số CCCD/Hộ chiếu
    -- Auth
    [password_hash]        [nvarchar](max)  NOT NULL,
    [avatar_url]           [nvarchar](max)  NULL,        -- Cloudinary URL
    -- Loyalty
    [loyalty_points]       [int]            NOT NULL DEFAULT 0,  -- tổng điểm tích lũy
    [loyalty_points_usable][int]            NOT NULL DEFAULT 0,  -- điểm có thể quy đổi thành tiền
    -- Status & Timestamps
    [status]               [bit]            NULL,        -- 1: Active, 0: Locked dùng để mở/khóa tài khoản và cả disable tài khoản nhân viên nghỉ việc
    [last_login_at]        [datetime]       NULL,        -- bảo mật, phân tích hành vi
    [created_at]           [datetime]       NOT NULL DEFAULT GETDATE(),
    [updated_at]           [datetime]       NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Audit_Logs](
    [id]          [int]            IDENTITY(1,1) NOT NULL,
    [user_id]     [int]            NULL,
    [action]      [nvarchar](50)   NOT NULL,
    [table_name]  [nvarchar](100)  NOT NULL,
    [record_id]   [int]            NOT NULL,
    [old_value]   [nvarchar](max)  NULL,
    [new_value]   [nvarchar](max)  NULL,
    [user_agent]  [nvarchar](500)  NULL,
    [created_at]  [datetime]       NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- ============================================================
-- Thêm refresh_token + refresh_token_expiry vào Users
-- ============================================================
 
ALTER TABLE [dbo].[Users]
    ADD [refresh_token]        [nvarchar](500) NULL,
        [refresh_token_expiry] [datetime]      NULL;
GO

-- ============================================================
-- CLUSTER 2: ROOM MANAGEMENT
-- ============================================================

CREATE TABLE [dbo].[Amenities](
    [id]        [int]            IDENTITY(1,1) NOT NULL,
    [name]      [nvarchar](255)  NOT NULL,
    [icon_url]  [nvarchar](max)  NULL,
    [is_active] [bit]            NOT NULL DEFAULT 1,    -- Soft Delete
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Room_Types](
    [id]                [int]            IDENTITY(1,1) NOT NULL,
    [name]              [nvarchar](255)  NOT NULL,
    [slug]              [nvarchar](100)  NULL,           -- URL thân thiện, UNIQUE
    [base_price]        [decimal](18, 2) NOT NULL,
    [capacity_adults]   [int]            NOT NULL,
    [capacity_children] [int]            NOT NULL,
    [area_sqm]          [decimal](8, 2)  NULL,           -- diện tích phòng m²
    [bed_type]          [nvarchar](50)   NULL,           -- King / Queen / Twin
    [view_type]         [nvarchar](50)   NULL,           -- Biển / Núi / Thành phố / Vườn
    [description]       [nvarchar](max)  NULL,
    [is_active]         [bit]            NOT NULL DEFAULT 1,  -- Soft Delete
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Rooms](
    [id]                           [int]            IDENTITY(1,1) NOT NULL,
    [room_type_id]                 [int]            NULL,
    [room_number]                  [nvarchar](50)   NOT NULL,
    [floor]                        [int]            NULL,
    [view_type]                    [nvarchar](50)   NULL,            -- hướng phòng vật lý cụ thể
    -- Tách 2 trục trạng thái (Buoi4 slide 30)
    [status]                       [nvarchar](50)   NULL,            -- Available / Occupied / Maintenance (trạng thái kinh doanh cũ — giữ cho tương thích)
    [business_status]              [nvarchar](20)   NOT NULL DEFAULT 'Available', -- Available / Occupied / Disabled
    [cleaning_status]              [nvarchar](20)   NOT NULL DEFAULT 'Clean',     -- Clean / Dirty
    [notes]                        [nvarchar](500)  NULL,            -- ghi chú bảo trì, đặc điểm phòng
    [inventory_sync_snapshot_json] [nvarchar](max)  NULL,            -- snapshot vật tư đã sync gần nhất của phòng
    [inventory_last_synced_at]     [datetime2](0)   NULL,            -- thời điểm sync gần nhất
    [inventory_version]            [int]            NOT NULL DEFAULT 0, -- version để chống preview cũ
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[RoomType_Amenities](
    [room_type_id] [int] NOT NULL,
    [amenity_id]   [int] NOT NULL,
PRIMARY KEY CLUSTERED ([room_type_id] ASC, [amenity_id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Room_Images](
    [id]                    [int]            IDENTITY(1,1) NOT NULL,
    [room_type_id]          [int]            NULL,
    [image_url]             [nvarchar](max)  NOT NULL,
    [cloudinary_public_id]  [nvarchar](255)  NULL,       -- để gọi DestroyAsync khi xóa
    [is_primary]            [bit]            NULL,
    [sort_order]            [int]            NOT NULL DEFAULT 0,  -- thứ tự gallery
    [is_active]             [bit]            NOT NULL DEFAULT 1,  -- Soft Delete
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Equipments](
    [id]                 [int]            IDENTITY(1,1) NOT NULL,
    [item_code]           [varchar](50)    NOT NULL,
    [name]               [nvarchar](255)  NOT NULL,
    [category]           [nvarchar](100)  NOT NULL,
    [unit]               [nvarchar](50)   NOT NULL,
    [total_quantity]      [int]            NOT NULL,
    [in_use_quantity]      [int]            NOT NULL,
    [damaged_quantity]    [int]            NOT NULL,
    [liquidated_quantity] [int]            NOT NULL,
    [in_stock_quantity]  AS ((([total_quantity]-[in_use_quantity])-[damaged_quantity])-[liquidated_quantity]),
    [base_price]          [decimal](18, 2) NOT NULL,
    [default_price_if_lost] [decimal](18, 2) NOT NULL,
    [supplier]           [nvarchar](255)  NULL,
    [is_active]           [bit]            NOT NULL,
    [created_at]          [datetime]       NULL,
    [updated_at]          [datetime]       NULL,
    [image_url]           [nvarchar](max)  NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO


CREATE TABLE [dbo].[Room_Inventory](
    [id]            [int]           IDENTITY(1,1) NOT NULL,
    [room_id]       [int]           NULL,
    [quantity]      [int]           NULL,
    [price_if_lost] [decimal](18,2) NULL,
    [note]          [nvarchar](255) NULL,
    [is_active]     [bit]           NULL,
    [item_type]     [varchar](50)   NULL,
    [equipment_id]   [int]           NOT NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

-- ============================================================
-- CLUSTER 3: BOOKING & PROMOTIONS
-- ============================================================

CREATE TABLE [dbo].[Vouchers](
    [id]                        [int]            IDENTITY(1,1) NOT NULL,
    [code]                      [nvarchar](50)   NOT NULL,
    [discount_type]             [nvarchar](50)   NOT NULL,      -- PERCENT / FIXED_AMOUNT
    [discount_value]            [decimal](18, 2) NOT NULL,
    [max_discount_amount]       [decimal](18, 2) NULL,          -- trần giảm tối đa (dùng cho PERCENT)
    [min_booking_value]         [decimal](18, 2) NULL,
    [applicable_room_type_id]   [int]            NULL,          -- FK Room_Types, NULL = áp dụng tất cả
    [valid_from]                [datetime]       NULL,
    [valid_to]                  [datetime]       NULL,
    [usage_limit]               [int]            NULL,          -- tổng lượt dùng toàn hệ thống
    [used_count]                [int]            NOT NULL DEFAULT 0,  -- đếm lượt đã dùng
    [max_uses_per_user]         [int]            NOT NULL DEFAULT 1,  -- giới hạn mỗi user
    [is_active]                 [bit]            NOT NULL DEFAULT 1,
    [created_at]                [datetime]       NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Bookings](
    [id]                     [int]            IDENTITY(1,1) NOT NULL,
    [user_id]                [int]            NULL,           -- NULL = khách vãng lai
    -- Thông tin khách
    [guest_name]             [nvarchar](255)  NULL,
    [guest_phone]            [nvarchar](50)   NULL,
    [guest_email]            [nvarchar](255)  NULL,
    [num_adults]             [int]            NOT NULL DEFAULT 1,
    [num_children]           [int]            NOT NULL DEFAULT 0,
    -- Mã & voucher
    [booking_code]           [nvarchar](50)   NOT NULL,
    [voucher_id]             [int]            NULL,
    -- Tiền
    [total_estimated_amount] [decimal](18, 2) NOT NULL DEFAULT 0,  -- tổng tiền dự kiến
    [deposit_amount]         [decimal](18, 2) NULL    DEFAULT 0,   -- tiền đã cọc
    -- Check-in/out thực tế
    [check_in_time]          [datetime]       NULL,          -- thời điểm check-in thực tế
    [check_out_time]         [datetime]       NULL,          -- thời điểm check-out thực tế
    -- Trạng thái & nguồn
    [status]                 [nvarchar](50)   NULL,          -- Pending / Confirmed / Checked_in / Completed / Cancelled
    [source]                 [nvarchar](20)   NOT NULL DEFAULT 'online',  -- online / walk_in / phone
    -- Ghi chú & hủy
    [note]                   [nvarchar](500)  NULL,
    [cancellation_reason]    [nvarchar](500)  NULL,
    [cancelled_at]           [datetime]       NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Booking_Details](
    [id]              [int]            IDENTITY(1,1) NOT NULL,
    [booking_id]      [int]            NULL,
    [room_id]         [int]            NULL,           -- NULL cho đến khi Lễ tân gán phòng
    [room_type_id]    [int]            NULL,
    [check_in_date]   [datetime]       NOT NULL,
    [check_out_date]  [datetime]       NOT NULL,
    [price_per_night] [decimal](18, 2) NOT NULL,       -- khóa giá tại thời điểm đặt
    [note]            [nvarchar](500)  NULL,            -- ghi chú nội bộ (yêu cầu đặc biệt)
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

-- ============================================================
-- CLUSTER 4: SERVICES & OPERATIONS
-- ============================================================

CREATE TABLE [dbo].[Service_Categories](
    [id]   [int]           IDENTITY(1,1) NOT NULL,
    [name] [nvarchar](255) NOT NULL,
    [is_active] [bit]      NOT NULL DEFAULT 1,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Services](
    [id]          [int]            IDENTITY(1,1) NOT NULL,
    [category_id] [int]            NULL,
    [name]        [nvarchar](255)  NOT NULL,
    [description] [nvarchar](500)  NULL,                -- mô tả hiển thị FE
    [price]       [decimal](18, 2) NOT NULL,
    [unit]        [nvarchar](50)   NULL,
    [image_url]   [nvarchar](max)  NULL,                -- ảnh dịch vụ hiển thị FE
    [is_active]   [bit]            NOT NULL DEFAULT 1,  -- kích hoạt/vô hiệu hóa theo mùa
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Order_Services](
    [id]                [int]            IDENTITY(1,1) NOT NULL,
    [booking_detail_id] [int]            NULL,
    [order_date]        [datetime]       NULL,
    [total_amount]      [decimal](18, 2) NULL,
    [status]            [nvarchar](50)   NULL,          -- Pending / Delivered / Cancelled
    [note]              [nvarchar](500)  NULL,           -- ghi chú đặc biệt: "Dị ứng hải sản"
    [completed_at]      [datetime]       NULL,           -- thời gian hoàn thành
    [is_active]         [bit]            NOT NULL DEFAULT 1,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Order_Service_Details](
    [id]               [int]            IDENTITY(1,1) NOT NULL,
    [order_service_id] [int]            NULL,
    [service_id]       [int]            NULL,
    [quantity]         [int]            NOT NULL,
    [unit_price]       [decimal](18, 2) NOT NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Loss_And_Damages](
    [id]                [int]            IDENTITY(1,1) NOT NULL,
    [booking_detail_id] [int]            NULL,
    [room_inventory_id] [int]            NULL,
    [reported_by]       [int]            NULL,          -- FK Users.id — Housekeeping lập biên bản
    [quantity]          [int]            NOT NULL,
    [penalty_amount]    [decimal](18, 2) NOT NULL,
    [description]       [nvarchar](max)  NULL,
    [img_url]           [nvarchar](max)  NULL,          -- ảnh minh chứng thiệt hại lưu Cloudinary
    [status]            [nvarchar](20)   NOT NULL DEFAULT 'Pending',  -- Pending / Confirmed / Waived
    [created_at]        [datetime]       NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- ============================================================
-- CLUSTER 5: BILLING, REVIEWS & CMS
-- ============================================================

CREATE TABLE [dbo].[Invoices](
    [id]                   [int]            IDENTITY(1,1) NOT NULL,
    [booking_id]           [int]            NULL,
    [total_room_amount]    [decimal](18, 2) NULL,
    [total_service_amount] [decimal](18, 2) NULL,
    [total_damage_amount]  [decimal](18, 2) NULL,       -- cộng dồn từ Loss_And_Damages
    [discount_amount]      [decimal](18, 2) NULL,
    [tax_amount]           [decimal](18, 2) NULL,
    [final_total]          [decimal](18, 2) NULL,
    [status]               [nvarchar](50)   NULL,       -- Unpaid / Partially_Paid / Paid / Refunded
    [created_at]           [datetime]       NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Payments](
    [id]               [int]            IDENTITY(1,1) NOT NULL,
    [invoice_id]       [int]            NULL,
    [payment_type]     [nvarchar](30)   NULL,           -- Deposit / Final_Settlement / Refund
    [payment_method]   [nvarchar](50)   NULL,           -- Cash / VNPay / Credit Card / Bank Transfer
    [amount_paid]      [decimal](18, 2) NOT NULL,
    [transaction_code] [nvarchar](100)  NULL,
    [status]           [nvarchar](20)   NOT NULL DEFAULT 'Success',  -- Success / Failed / Pending
    [payment_date]     [datetime]       NULL,
    [note]             [nvarchar](500)  NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Reviews](
    [id]               [int]           IDENTITY(1,1) NOT NULL,
    [user_id]          [int]           NULL,
    [room_type_id]     [int]           NULL,
    [booking_id]       [int]           NULL,            -- bắt buộc để xác thực lưu trú
    -- Rating chi tiết
    [rating]           [int]           NULL,            -- điểm tổng thể (1-5)
    -- Nội dung
    [comment]          [nvarchar](max) NULL,
    [image_url]        [nvarchar](max) NULL,            -- ảnh minh chứng đánh giá
    -- Kiểm duyệt
    [is_approved]      [bit]           NULL DEFAULT 0,
    [rejection_reason] [nvarchar](500) NULL,            -- lý do từ chối để gửi email thông báo
    [created_at]       [datetime]      NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Article_Categories](
    [id]        [int]           IDENTITY(1,1) NOT NULL,
    [name]      [nvarchar](255) NOT NULL,
    [slug]      [nvarchar](100) NULL,                   -- URL /blog/category/cam-nang-du-lich
    [is_active] [bit]           NOT NULL DEFAULT 1,     -- Soft Delete
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Articles](
    [id]                    [int]            IDENTITY(1,1) NOT NULL,
    [category_id]           [int]            NULL,
    [author_id]             [int]            NULL,
    -- Nội dung
    [title]                 [nvarchar](max)  NOT NULL,
    [slug]                  [nvarchar](255)  NULL,
    [content]               [nvarchar](max)  NULL,
    -- Media
    [thumbnail_url]         [nvarchar](max)  NULL,
    [cloudinary_public_id]  [nvarchar](255)  NULL,      -- xóa ảnh bìa cũ khi cập nhật
    -- SEO
    [meta_title]            [nvarchar](200)  NULL,
    [meta_description]      [nvarchar](500)  NULL,
    -- Trạng thái & Phân loại
    [status]                [nvarchar](20)   NOT NULL DEFAULT 'Draft',  -- Draft / Pending_Review / Published
    [is_active]             [bit]            NOT NULL DEFAULT 1,        -- Soft Delete
    [published_at]          [datetime]       NULL,
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Attractions](
    [id]            [int]            IDENTITY(1,1) NOT NULL,
    [name]          [nvarchar](255)  NOT NULL,
    [category]      [nvarchar](50)   NULL,              -- Di tích / Ẩm thực / Giải trí / Thiên nhiên
    [address]       [nvarchar](500)  NULL,              -- địa chỉ đầy đủ hiển thị popup bản đồ
    [latitude]      [decimal](9, 6)  NULL,              -- tọa độ GPS cho Google Maps
    [longitude]     [decimal](9, 6)  NULL,
    [distance_km]   [decimal](5, 2)  NULL,
    [description]   [nvarchar](max)  NULL,
    [image_url]     [nvarchar](max)  NULL,              -- ảnh hiển thị card grid
    [map_embed_link][nvarchar](max)  NULL,
    [is_active]     [bit]            NOT NULL DEFAULT 1,  -- Soft Delete
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- ============================================================
-- CLUSTER 6: HR — SHIFTS (Module 6 FR 6.2)
-- ============================================================

CREATE TABLE [dbo].[Shifts](
    [id]              [int]            IDENTITY(1,1) NOT NULL,
    [user_id]         [int]            NOT NULL,        -- FK Users.id
    [confirmed_by]    [int]            NULL,            -- Manager xác nhận ca
    -- Loại & bộ phận
    [shift_type]      [nvarchar](20)   NOT NULL,        -- Morning / Afternoon / Night
    [department]      [nvarchar](50)   NOT NULL,        -- Lễ tân / Housekeeping / Bảo vệ / F&B
    -- Kế hoạch vs thực tế
    [planned_start]   [datetime]       NOT NULL,
    [planned_end]     [datetime]       NOT NULL,
    [actual_start]    [datetime]       NULL,
    [actual_end]      [datetime]       NULL,
    [late_minutes]    [int]            NOT NULL DEFAULT 0,
    -- Trạng thái
    [status]          [nvarchar](20)   NOT NULL DEFAULT 'Scheduled',  -- Scheduled / Active / Completed / Absent
    -- Bàn giao ca
    [handover_note]   [nvarchar](max)  NULL,
    [cash_at_handover][decimal](18, 2) NULL,
    [created_at]      [datetime]       NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- ============================================================
-- CLUSTER 7: LOYALTY & PROMOTIONS TRACKING
-- ============================================================

CREATE TABLE [dbo].[Loyalty_Transactions](
    [id]               [int]            IDENTITY(1,1) NOT NULL,
    [user_id]          [int]            NOT NULL,       -- FK Users.id
    [booking_id]       [int]            NULL,           -- FK Bookings.id
    [transaction_type] [nvarchar](20)   NOT NULL,       -- earned / redeemed / expired
    [points]           [int]            NOT NULL,       -- dương: cộng, âm: trừ
    [balance_after]    [int]            NOT NULL,       -- số dư sau giao dịch
    [note]             [nvarchar](255)  NULL,
    [created_at]       [datetime]       NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Voucher_Usage](
    [id]         [int]      IDENTITY(1,1) NOT NULL,
    [voucher_id] [int]      NOT NULL,                   -- FK Vouchers.id
    [user_id]    [int]      NOT NULL,                   -- FK Users.id
    [booking_id] [int]      NOT NULL,                   -- FK Bookings.id
    [used_at]    [datetime] NOT NULL DEFAULT GETDATE(),
PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

-- ============================================================
-- UNIQUE INDEXES
-- ============================================================
SET ANSI_PADDING ON
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Article_Categories_Slug] ON [dbo].[Article_Categories] ([slug] ASC) WHERE [slug] IS NOT NULL
GO
ALTER TABLE [dbo].[Articles]           ADD UNIQUE NONCLUSTERED ([slug] ASC)
GO
ALTER TABLE [dbo].[Bookings]           ADD UNIQUE NONCLUSTERED ([booking_code] ASC)
GO
ALTER TABLE [dbo].[Equipments]         ADD UNIQUE NONCLUSTERED ([item_code] ASC)
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Room_Types_Slug] ON [dbo].[Room_Types] ([slug] ASC) WHERE [slug] IS NOT NULL
GO
ALTER TABLE [dbo].[Users]              ADD UNIQUE NONCLUSTERED ([email] ASC)
GO
ALTER TABLE [dbo].[Vouchers]           ADD UNIQUE NONCLUSTERED ([code] ASC)
GO

-- ============================================================
-- DEFAULT CONSTRAINTS
-- ============================================================
ALTER TABLE [dbo].[Articles]           ADD DEFAULT (getdate())    FOR [published_at]
ALTER TABLE [dbo].[Audit_Logs]         ADD DEFAULT (getdate())    FOR [created_at]
ALTER TABLE [dbo].[Bookings]           ADD DEFAULT ('Pending')    FOR [status]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((0))          FOR [total_quantity]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((0))          FOR [in_use_quantity]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((0))          FOR [damaged_quantity]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((0))          FOR [liquidated_quantity]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((0))          FOR [base_price]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((0))          FOR [default_price_if_lost]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT ((1))          FOR [is_active]
ALTER TABLE [dbo].[Equipments]         ADD DEFAULT (getutcdate()) FOR [created_at]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ((0))          FOR [total_room_amount]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ((0))          FOR [total_service_amount]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ((0))          FOR [total_damage_amount]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ((0))          FOR [discount_amount]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ((0))          FOR [tax_amount]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ((0))          FOR [final_total]
ALTER TABLE [dbo].[Invoices]           ADD DEFAULT ('Unpaid')     FOR [status]
ALTER TABLE [dbo].[Loss_And_Damages]   ADD DEFAULT (getdate())    FOR [created_at]
ALTER TABLE [dbo].[Memberships]        ADD DEFAULT ((0))          FOR [min_points]
ALTER TABLE [dbo].[Memberships]        ADD DEFAULT ((0.00))       FOR [discount_percent]
ALTER TABLE [dbo].[Order_Services]     ADD DEFAULT (getdate())    FOR [order_date]
ALTER TABLE [dbo].[Order_Services]     ADD DEFAULT ((0))          FOR [total_amount]
ALTER TABLE [dbo].[Order_Services]     ADD DEFAULT ('Pending')    FOR [status]
ALTER TABLE [dbo].[Payments]           ADD DEFAULT (getdate())    FOR [payment_date]
ALTER TABLE [dbo].[Reviews]            ADD DEFAULT (getdate())    FOR [created_at]
ALTER TABLE [dbo].[Room_Images]        ADD DEFAULT ((0))          FOR [is_primary]
ALTER TABLE [dbo].[Room_Inventory]     ADD DEFAULT ((1))          FOR [quantity]
ALTER TABLE [dbo].[Room_Inventory]     ADD DEFAULT ((0))          FOR [price_if_lost]
ALTER TABLE [dbo].[Room_Inventory]     ADD DEFAULT ((1))          FOR [is_active]
ALTER TABLE [dbo].[Room_Inventory]     ADD DEFAULT ('Asset')      FOR [item_type]
ALTER TABLE [dbo].[Rooms]              ADD DEFAULT ('Available')  FOR [status]
ALTER TABLE [dbo].[Users]              ADD DEFAULT ((1))          FOR [status]
ALTER TABLE [dbo].[Vouchers]           ADD DEFAULT ((0))          FOR [min_booking_value]
GO

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================
-- Cluster 1
ALTER TABLE [dbo].[Audit_Logs]          WITH CHECK ADD FOREIGN KEY([user_id])              REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Role_Permissions]    WITH CHECK ADD FOREIGN KEY([permission_id])         REFERENCES [dbo].[Permissions]       ([id])
ALTER TABLE [dbo].[Role_Permissions]    WITH CHECK ADD FOREIGN KEY([role_id])               REFERENCES [dbo].[Roles]             ([id])
ALTER TABLE [dbo].[Users]               WITH CHECK ADD FOREIGN KEY([membership_id])         REFERENCES [dbo].[Memberships]       ([id])
ALTER TABLE [dbo].[Users]               WITH CHECK ADD FOREIGN KEY([role_id])               REFERENCES [dbo].[Roles]             ([id])
-- Cluster 2
ALTER TABLE [dbo].[Room_Images]         WITH CHECK ADD FOREIGN KEY([room_type_id])          REFERENCES [dbo].[Room_Types]        ([id])
ALTER TABLE [dbo].[Room_Inventory]      WITH CHECK ADD FOREIGN KEY([room_id])               REFERENCES [dbo].[Rooms]             ([id])
ALTER TABLE [dbo].[Room_Inventory]      WITH CHECK ADD CONSTRAINT [FK_RoomInventory_Equipments] FOREIGN KEY([equipment_id]) REFERENCES [dbo].[Equipments] ([id])
ALTER TABLE [dbo].[Room_Inventory]      CHECK CONSTRAINT [FK_RoomInventory_Equipments]
ALTER TABLE [dbo].[Rooms]               WITH CHECK ADD FOREIGN KEY([room_type_id])          REFERENCES [dbo].[Room_Types]        ([id])
ALTER TABLE [dbo].[RoomType_Amenities]  WITH CHECK ADD FOREIGN KEY([amenity_id])            REFERENCES [dbo].[Amenities]         ([id])
ALTER TABLE [dbo].[RoomType_Amenities]  WITH CHECK ADD FOREIGN KEY([room_type_id])          REFERENCES [dbo].[Room_Types]        ([id])
-- Cluster 3
ALTER TABLE [dbo].[Booking_Details]     WITH CHECK ADD FOREIGN KEY([booking_id])            REFERENCES [dbo].[Bookings]          ([id])
ALTER TABLE [dbo].[Booking_Details]     WITH CHECK ADD FOREIGN KEY([room_id])               REFERENCES [dbo].[Rooms]             ([id])
ALTER TABLE [dbo].[Booking_Details]     WITH CHECK ADD FOREIGN KEY([room_type_id])          REFERENCES [dbo].[Room_Types]        ([id])
ALTER TABLE [dbo].[Bookings]            WITH CHECK ADD FOREIGN KEY([user_id])               REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Bookings]            WITH CHECK ADD FOREIGN KEY([voucher_id])            REFERENCES [dbo].[Vouchers]          ([id])
ALTER TABLE [dbo].[Vouchers]            WITH CHECK ADD FOREIGN KEY([applicable_room_type_id]) REFERENCES [dbo].[Room_Types]      ([id])
-- Cluster 4
ALTER TABLE [dbo].[Invoices]            WITH CHECK ADD FOREIGN KEY([booking_id])            REFERENCES [dbo].[Bookings]          ([id])
ALTER TABLE [dbo].[Loss_And_Damages]    WITH CHECK ADD FOREIGN KEY([booking_detail_id])     REFERENCES [dbo].[Booking_Details]   ([id])
ALTER TABLE [dbo].[Loss_And_Damages]    WITH CHECK ADD FOREIGN KEY([room_inventory_id])     REFERENCES [dbo].[Room_Inventory]    ([id])
ALTER TABLE [dbo].[Loss_And_Damages]    WITH CHECK ADD FOREIGN KEY([reported_by])           REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Order_Service_Details] WITH CHECK ADD FOREIGN KEY([order_service_id])   REFERENCES [dbo].[Order_Services]    ([id])
ALTER TABLE [dbo].[Order_Service_Details] WITH CHECK ADD FOREIGN KEY([service_id])         REFERENCES [dbo].[Services]          ([id])
ALTER TABLE [dbo].[Order_Services]      WITH CHECK ADD FOREIGN KEY([booking_detail_id])     REFERENCES [dbo].[Booking_Details]   ([id])
ALTER TABLE [dbo].[Services]            WITH CHECK ADD FOREIGN KEY([category_id])           REFERENCES [dbo].[Service_Categories]([id])
-- Cluster 5
ALTER TABLE [dbo].[Articles]            WITH CHECK ADD FOREIGN KEY([author_id])             REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Articles]            WITH CHECK ADD FOREIGN KEY([category_id])           REFERENCES [dbo].[Article_Categories]([id])
ALTER TABLE [dbo].[Payments]            WITH CHECK ADD FOREIGN KEY([invoice_id])            REFERENCES [dbo].[Invoices]          ([id])
ALTER TABLE [dbo].[Reviews]             WITH CHECK ADD FOREIGN KEY([booking_id])            REFERENCES [dbo].[Bookings]          ([id])
ALTER TABLE [dbo].[Reviews]             WITH CHECK ADD FOREIGN KEY([room_type_id])          REFERENCES [dbo].[Room_Types]        ([id])
ALTER TABLE [dbo].[Reviews]             WITH CHECK ADD FOREIGN KEY([user_id])               REFERENCES [dbo].[Users]             ([id])
-- Cluster 6 & 7
ALTER TABLE [dbo].[Loyalty_Transactions] WITH CHECK ADD FOREIGN KEY([user_id])             REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Loyalty_Transactions] WITH CHECK ADD FOREIGN KEY([booking_id])          REFERENCES [dbo].[Bookings]          ([id])
ALTER TABLE [dbo].[Shifts]              WITH CHECK ADD FOREIGN KEY([user_id])               REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Shifts]              WITH CHECK ADD FOREIGN KEY([confirmed_by])          REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Voucher_Usage]       WITH CHECK ADD FOREIGN KEY([voucher_id])            REFERENCES [dbo].[Vouchers]          ([id])
ALTER TABLE [dbo].[Voucher_Usage]       WITH CHECK ADD FOREIGN KEY([user_id])               REFERENCES [dbo].[Users]             ([id])
ALTER TABLE [dbo].[Voucher_Usage]       WITH CHECK ADD FOREIGN KEY([booking_id])            REFERENCES [dbo].[Bookings]          ([id])
GO

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================
ALTER TABLE [dbo].[Reviews] WITH CHECK ADD CHECK (([rating]>=(1) AND [rating]<=(5)))
GO

-- Filtered unique index: mỗi user chỉ review 1 lần mỗi booking
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Reviews_User_Booking')
    DROP INDEX [UQ_Reviews_User_Booking] ON [dbo].[Reviews];
GO
CREATE UNIQUE INDEX [UQ_Reviews_User_Booking]
    ON [dbo].[Reviews] ([user_id], [booking_id])
    WHERE [booking_id] IS NOT NULL;
GO

-- ============================================================
-- BẢNG Activity_Logs
-- Lưu thông báo hệ thống cho Admin/Manager/Staff
-- ============================================================

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

-- Index cho filter ActionCode trong backend
CREATE NONCLUSTERED INDEX [IX_Activity_Logs_ActionCode]
    ON [dbo].[Activity_Logs] ([action_code] ASC)
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

-- ============================================================
-- SEED DATA — THỨ TỰ CHA TRƯỚC CON
-- ============================================================

-- 1. Roles
SET IDENTITY_INSERT [dbo].[Roles] ON
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (1,  N'Admin',       N'Quản trị viên')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (2,  N'Manager',     N'Quản lý khách sạn')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (3,  N'Receptionist',N'Lễ tân')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (4,  N'Accountant',  N'Kế toán')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (5,  N'Housekeeping',N'Buồng phòng')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (6,  N'Security',    N'Bảo vệ')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (7,  N'Chef',        N'Đầu bếp')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (8,  N'Waiter',      N'Nhân viên phục vụ')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (9,  N'IT Support',  N'Kỹ thuật viên')
INSERT [dbo].[Roles] ([id], [name], [description]) VALUES (10, N'Guest',       N'Khách hàng')
SET IDENTITY_INSERT [dbo].[Roles] OFF
GO

-- 2. Permissions
SET IDENTITY_INSERT [dbo].[Permissions] ON
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (1,  N'VIEW_DASHBOARD',   N'VIEW_DASHBOARD')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (2,  N'MANAGE_USERS',     N'MANAGE_USERS')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (3,  N'MANAGE_ROLES',     N'MANAGE_ROLES')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (4,  N'MANAGE_ROOMS',     N'MANAGE_ROOMS')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (5,  N'MANAGE_BOOKINGS',  N'MANAGE_BOOKINGS')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (6,  N'MANAGE_INVOICES',  N'MANAGE_INVOICES')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (7,  N'MANAGE_SERVICES',  N'MANAGE_SERVICES')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (8,  N'VIEW_REPORTS',     N'VIEW_REPORTS')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (9,  N'MANAGE_CONTENT',   N'MANAGE_CONTENT')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (10, N'MANAGE_INVENTORY', N'MANAGE_INVENTORY')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (11, N'VIEW_USERS',       N'VIEW_USERS')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (12, N'VIEW_ROLES',       N'VIEW_ROLES')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (13, N'EDIT_ROLES',       N'EDIT_ROLES')
INSERT [dbo].[Permissions] ([id], [name], [permission_code]) VALUES (14, N'CREATE_USERS',     N'CREATE_USERS')
SET IDENTITY_INSERT [dbo].[Permissions] OFF
GO

-- 3. Memberships
SET IDENTITY_INSERT [dbo].[Memberships] ON
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (1,  N'Khách Mới', 0,      499,    CAST(0.00  AS Decimal(5,2)), N'#9E9E9E', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (2,  N'Đồng',      500,    999,    CAST(2.00  AS Decimal(5,2)), N'#CD7F32', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (3,  N'Bạc',       1000,   2999,   CAST(5.00  AS Decimal(5,2)), N'#C0C0C0', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (4,  N'Vàng',      3000,   4999,   CAST(8.00  AS Decimal(5,2)), N'#FFD700', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (5,  N'Bạch Kim',  5000,   9999,   CAST(10.00 AS Decimal(5,2)), N'#E5E4E2', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (6,  N'Kim Cương', 10000,  19999,  CAST(15.00 AS Decimal(5,2)), N'#B9F2FF', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (7,  N'Elite',     20000,  49999,  CAST(20.00 AS Decimal(5,2)), N'#7B68EE', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (8,  N'VIP',       50000,  99999,  CAST(25.00 AS Decimal(5,2)), N'#FF8C00', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (9,  N'VVIP',      100000, 199999, CAST(30.00 AS Decimal(5,2)), N'#DC143C', 1)
INSERT [dbo].[Memberships] ([id], [tier_name], [min_points], [max_points], [discount_percent], [color_hex], [is_active]) VALUES (10, N'Signature', 200000, NULL,   CAST(35.00 AS Decimal(5,2)), N'#2F4F4F', 1)
SET IDENTITY_INSERT [dbo].[Memberships] OFF
GO

-- 4. Users
SET IDENTITY_INSERT [dbo].[Users] ON
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (1,  1,  NULL, N'Nguyễn Admin',    N'admin@hotel.com',       N'0900000001', N'$2a$11$oFBpZq/8S8DAE2qhAt0TCOIsOXB3WlBlmdybSneBVxZBdqcKzm9Qu',  1, 0,    0,    CAST(N'2026-01-01T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (2,  2,  NULL, N'Trần Manager',    N'manager@hotel.com',     N'0900000002', N'hash2',  1, 0,    0,    CAST(N'2026-01-01T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (3,  3,  NULL, N'Lê Lễ Tân',      N'reception1@hotel.com',  N'0900000003', N'hash3',  1, 0,    0,    CAST(N'2026-01-01T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (4,  3,  NULL, N'Phạm Lễ Tân',    N'reception2@hotel.com',  N'0900000004', N'hash4',  1, 0,    0,    CAST(N'2026-01-01T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (5,  4,  NULL, N'Hoàng Kế Toán',  N'accountant@hotel.com',  N'0900000005', N'hash5',  1, 0,    0,    CAST(N'2026-01-01T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (6,  10, 1,    N'Khách Hàng A',   N'guestA@gmail.com',      N'0900000006', N'hash6',  1, 120,  100,  CAST(N'2026-01-10T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (7,  10, 2,    N'Khách Hàng B',   N'guestB@gmail.com',      N'0900000007', N'hash7',  1, 550,  400,  CAST(N'2026-01-15T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (8,  10, 3,    N'Khách Hàng C',   N'guestC@gmail.com',      N'0900000008', N'hash8',  1, 1200, 1000, CAST(N'2026-01-20T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (9,  10, 4,    N'Khách Hàng D',   N'guestD@gmail.com',      N'0900000009', N'hash9',  1, 3500, 3000, CAST(N'2026-01-25T00:00:00.000' AS DateTime))
INSERT [dbo].[Users] ([id],[role_id],[membership_id],[full_name],[email],[phone],[password_hash],[status],[loyalty_points],[loyalty_points_usable],[created_at])
VALUES (10, 10, 5,    N'Khách Hàng E',   N'guestE@gmail.com',      N'0900000010', N'hash10', 1, 5200, 5000, CAST(N'2026-02-01T00:00:00.000' AS DateTime))
SET IDENTITY_INSERT [dbo].[Users] OFF
GO

-- 5. Role_Permissions
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 1)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 2)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 3)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 4)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 5)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 6)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 7)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 8)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 9)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 10)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 11)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 12)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 13)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (1, 14)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 1)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 2)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 4)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 5)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 6)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 7)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 8)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 9)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 10)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 11)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (2, 12)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 1)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 4)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 5)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 6)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 7)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 9)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (3, 10)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 1)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 2)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 4)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 5)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 6)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 7)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (4, 8)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (5, 4)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (5, 6)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (5, 7)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (5, 8)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (5, 9)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (5, 10)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (7, 7)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (7, 8)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (7, 9)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (7, 10)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 1)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 2)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 3)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 4)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 5)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 6)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 8)
INSERT [dbo].[Role_Permissions] ([role_id], [permission_id]) VALUES (9, 9)
GO

-- 6. Amenities
SET IDENTITY_INSERT [dbo].[Amenities] ON
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (1,  N'Wifi Miễn Phí',     N'wifi.png',      1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (2,  N'Smart TV',           N'tv.png',        1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (3,  N'Điều Hòa',           N'ac.png',        1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (4,  N'Bồn Tắm Sứ',        N'bathtub.png',   1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (5,  N'Ban Công',           N'balcony.png',   1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (6,  N'Minibar',            N'minibar.png',   1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (7,  N'Két Sắt',            N'safe.png',      1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (8,  N'Máy Sấy Tóc',       N'hairdryer.png', 1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (9,  N'Máy Pha Cà Phê',    N'coffee.png',    1)
INSERT [dbo].[Amenities] ([id], [name], [icon_url], [is_active]) VALUES (10, N'Bàn Làm Việc',      N'desk.png',      1)
SET IDENTITY_INSERT [dbo].[Amenities] OFF
GO

-- 7. Room_Types
SET IDENTITY_INSERT [dbo].[Room_Types] ON
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (1,  N'Standard Single',    N'standard-single',    CAST(400000.00  AS Decimal(18,2)), 1, 0, CAST(20.0 AS Decimal(8,2)), N'Single',  N'Thành phố', N'Phòng tiêu chuẩn 1 giường đơn',        1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (2,  N'Standard Double',    N'standard-double',    CAST(500000.00  AS Decimal(18,2)), 2, 1, CAST(25.0 AS Decimal(8,2)), N'Double',  N'Thành phố', N'Phòng tiêu chuẩn 1 giường đôi',        1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (3,  N'Superior City View', N'superior-city-view', CAST(700000.00  AS Decimal(18,2)), 2, 1, CAST(30.0 AS Decimal(8,2)), N'Queen',   N'Thành phố', N'Phòng cao cấp hướng phố',               1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (4,  N'Deluxe Ocean View',  N'deluxe-ocean-view',  CAST(900000.00  AS Decimal(18,2)), 2, 2, CAST(35.0 AS Decimal(8,2)), N'King',    N'Biển',      N'Phòng Deluxe hướng biển',               1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (5,  N'Premium Deluxe',     N'premium-deluxe',     CAST(1200000.00 AS Decimal(18,2)), 2, 2, CAST(38.0 AS Decimal(8,2)), N'King',    N'Biển',      N'Phòng Premium tiện nghi cao cấp',       1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (6,  N'Family Suite',       N'family-suite',       CAST(1500000.00 AS Decimal(18,2)), 4, 2, CAST(55.0 AS Decimal(8,2)), N'Twin',    N'Vườn',      N'Phòng Suite cho gia đình',              1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (7,  N'Junior Suite',       N'junior-suite',       CAST(1800000.00 AS Decimal(18,2)), 2, 2, CAST(60.0 AS Decimal(8,2)), N'King',    N'Biển',      N'Phòng Suite nhỏ nhắn sang trọng',      1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (8,  N'Executive Suite',    N'executive-suite',    CAST(2500000.00 AS Decimal(18,2)), 2, 2, CAST(75.0 AS Decimal(8,2)), N'King',    N'Biển',      N'Phòng Suite cho doanh nhân',            1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (9,  N'Presidential Suite', N'presidential-suite', CAST(5000000.00 AS Decimal(18,2)), 4, 2, CAST(120.0 AS Decimal(8,2)),N'King',   N'Biển',      N'Phòng Tổng thống',                      1)
INSERT [dbo].[Room_Types] ([id],[name],[slug],[base_price],[capacity_adults],[capacity_children],[area_sqm],[bed_type],[view_type],[description],[is_active])
VALUES (10, N'Royal Villa',        N'royal-villa',        CAST(8000000.00 AS Decimal(18,2)), 6, 4, CAST(250.0 AS Decimal(8,2)),N'King',   N'Biển',      N'Biệt thự hoàng gia nguyên căn',         1)
SET IDENTITY_INSERT [dbo].[Room_Types] OFF
GO

-- 8. Rooms
SET IDENTITY_INSERT [dbo].[Rooms] ON
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (1, 1, N'101', 1, N'Thành phố', N'Cleaning', N'Available', N'Dirty', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (2, 1, N'102', 1, N'Biển', N'Cleaning', N'Available', N'Dirty', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (3, 3, N'201', 2, N'Vườn', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (4, 4, N'202', 2, N'Biển', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (5, 5, N'301', 3, N'Thành phố', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (6, 6, N'302', 3, N'Biển', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (7, 7, N'401', 4, N'Vườn', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (8, 8, N'402', 4, N'Biển', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (9, 9, N'501', 5, N'Biển', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (10, 10, N'VILLA-1', 1, N'Vườn', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (11, 1, N'103', 1, N'Thành phố', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (12, 1, N'104', 1, N'Vườn', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (13, 4, N'203', 2, N'Biển', N'Available', N'Available', N'Clean', NULL)
INSERT [dbo].[Rooms] ([id], [room_type_id], [room_number], [floor], [view_type], [status], [business_status], [cleaning_status], [notes]) VALUES (14, 3, N'204', 2, N'Thành phố', N'Available', N'Available', N'Clean', NULL)
SET IDENTITY_INSERT [dbo].[Rooms] OFF
GO

-- 9. RoomType_Amenities
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (1, 1)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (1, 2)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (1, 3)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (2, 1)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (2, 2)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (3, 4)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (3, 5)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (4, 6)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (4, 7)
INSERT [dbo].[RoomType_Amenities] ([room_type_id], [amenity_id]) VALUES (5, 8)
GO

-- 10. Room_Images
SET IDENTITY_INSERT [dbo].[Room_Images] ON
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (1, 1, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154214/hotel/room-types/1/crw6molabapnox1khazi.jpg', N'hotel/room-types/1/crw6molabapnox1khazi', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (2, 2, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154197/hotel/room-types/2/mekf9ki56w102inizn6z.jpg', N'hotel/room-types/2/mekf9ki56w102inizn6z', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (3, 3, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154229/hotel/room-types/3/viy3r9wupitadubpir7s.jpg', N'hotel/room-types/3/viy3r9wupitadubpir7s', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (4, 4, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775156566/hotel/room-types/4/x2izong8svk0aa78c4lh.jpg', N'hotel/room-types/4/x2izong8svk0aa78c4lh', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (5, 5, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154150/hotel/room-types/5/vkbl56yybog4blncgubi.jpg', N'hotel/room-types/5/vkbl56yybog4blncgubi', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (6, 6, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775153906/hotel/room-types/6/blrz4q4gbq75mt1q2rk5.jpg', N'hotel/room-types/6/blrz4q4gbq75mt1q2rk5', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (7, 7, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154137/hotel/room-types/7/xgjdljfv6tswwfqq2ovw.jpg', N'hotel/room-types/7/xgjdljfv6tswwfqq2ovw', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (8, 8, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775153887/hotel/room-types/8/boksaj6gmalul8auj2wo.jpg', N'hotel/room-types/8/boksaj6gmalul8auj2wo', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (9, 9, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154162/hotel/room-types/9/lmnowdhlz9stfs9g9sve.jpg', N'hotel/room-types/9/lmnowdhlz9stfs9g9sve', 1, 0, 1)
INSERT [dbo].[Room_Images] ([id], [room_type_id], [image_url], [cloudinary_public_id], [is_primary], [sort_order], [is_active]) VALUES (10, 10, N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775154183/hotel/room-types/10/wzp5lmcb6gebwd7iawaj.jpg', N'hotel/room-types/10/wzp5lmcb6gebwd7iawaj', 1, 0, 1)
SET IDENTITY_INSERT [dbo].[Room_Images] OFF
GO

-- 11. Equipments
SET IDENTITY_INSERT [dbo].[Equipments] ON 

INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (1, N'TV-SS-43', N'Smart TV Samsung 43 inch', N'Điện tử', N'Cái', 60, 6, 0, 0, CAST(7500000.00 AS Decimal(18, 2)), CAST(8000000.00 AS Decimal(18, 2)), N'Samsung Vietnam', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:33:08.103' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179986/QuanTriKhachSan/Equipments/bc0copnaxxcnocjovhhd.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (2, N'AC-DK-9000', N'Điều hòa Daikin 9000 BTU', N'Điện tử', N'Cái', 60, 9, 0, 0, CAST(8200000.00 AS Decimal(18, 2)), CAST(9000000.00 AS Decimal(18, 2)), N'Daikin Vietnam', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:31:19.883' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179878/QuanTriKhachSan/Equipments/yhhmra6dxybwiwn2yaqm.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (3, N'MB-AF-50', N'Tủ lạnh Minibar Aqua 50L', N'Điện tử', N'Cái', 60, 9, 0, 0, CAST(2500000.00 AS Decimal(18, 2)), CAST(3000000.00 AS Decimal(18, 2)), N'Aqua', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:33:28.893' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775180007/QuanTriKhachSan/Equipments/kdqqlentkb7v1nrwanfy.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (4, N'HD-PN-1000', N'Máy sấy tóc Panasonic', N'Điện tử', N'Cái', 70, 9, 0, 0, CAST(450000.00 AS Decimal(18, 2)), CAST(600000.00 AS Decimal(18, 2)), N'Điện Máy Xanh', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:29.497' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179948/QuanTriKhachSan/Equipments/cdxhcafmz69zsc8jynpj.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (5, N'KL-SH-17', N'Ấm đun nước siêu tốc Sunhouse', N'Điện tử', N'Cái', 70, 9, 0, 0, CAST(250000.00 AS Decimal(18, 2)), CAST(350000.00 AS Decimal(18, 2)), N'Sunhouse', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:29:48.703' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179787/QuanTriKhachSan/Equipments/rdlvkfd1bihiw7ovcfbh.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (6, N'BD-KG-20', N'Giường King Size 2m x 2m2', N'Nội thất', N'Chiếc', 25, 12, 0, 0, CAST(12000000.00 AS Decimal(18, 2)), CAST(15000000.00 AS Decimal(18, 2)), N'Nội thất Hòa Phát', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:31:51.537' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179910/QuanTriKhachSan/Equipments/znpshjefropgics8bkh2.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (7, N'BD-SG-12', N'Giường Single 1m2 x 2m', N'Nội thất', N'Chiếc', 50, 11, 0, 0, CAST(5500000.00 AS Decimal(18, 2)), CAST(7000000.00 AS Decimal(18, 2)), N'Nội thất Hòa Phát', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:03.793' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179922/QuanTriKhachSan/Equipments/evxxijuwsqfe3y2qr74x.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (8, N'WD-WD-01', N'Tủ quần áo gỗ công nghiệp', N'Nội thất', N'Cái', 60, 9, 0, 0, CAST(3500000.00 AS Decimal(18, 2)), CAST(5000000.00 AS Decimal(18, 2)), N'Xưởng Gỗ An Cường', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:33:34.947' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775180013/QuanTriKhachSan/Equipments/xccor1jwwjjnrxgjbcsx.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (9, N'TB-WK-01', N'Bàn làm việc + Ghế', N'Nội thất', N'Bộ', 60, 9, 0, 0, CAST(2200000.00 AS Decimal(18, 2)), CAST(3000000.00 AS Decimal(18, 2)), N'Nội thất Hòa Phát', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:29:57.740' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179796/QuanTriKhachSan/Equipments/a7huw3azduwbzu7caooj.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (10, N'HG-WD-01', N'Móc treo quần áo bằng gỗ', N'Nội thất', N'Chiếc', 600, 48, 0, 0, CAST(15000.00 AS Decimal(18, 2)), CAST(30000.00 AS Decimal(18, 2)), N'Nhựa Duy Tân', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:44.537' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179963/QuanTriKhachSan/Equipments/yd3it2qr5ax1hf7vsvyr.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (11, N'TW-BT-01', N'Khăn tắm cotton 70x140cm', N'Đồ vải', N'Chiếc', 250, 26, 0, 0, CAST(85000.00 AS Decimal(18, 2)), CAST(150000.00 AS Decimal(18, 2)), N'Dệt may Thành Công', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:22.140' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179941/QuanTriKhachSan/Equipments/fbdwh4abv7hh4dfier6t.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (12, N'TW-FC-01', N'Khăn mặt cotton 30x30cm', N'Đồ vải', N'Chiếc', 250, 26, 0, 0, CAST(25000.00 AS Decimal(18, 2)), CAST(50000.00 AS Decimal(18, 2)), N'Dệt may Thành Công', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:13.420' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179932/QuanTriKhachSan/Equipments/isq6ckitl1gamquw7eui.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (13, N'MT-FT-01', N'Thảm chùi chân', N'Đồ vải', N'Chiếc', 150, 9, 0, 0, CAST(45000.00 AS Decimal(18, 2)), CAST(80000.00 AS Decimal(18, 2)), N'Dệt may Thành Công', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:33:43.447' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775180022/QuanTriKhachSan/Equipments/lj22knewmhpsqdow0omn.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (14, N'BL-DC-01', N'Chăn lông vũ', N'Đồ vải', N'Chiếc', 100, 23, 0, 0, CAST(850000.00 AS Decimal(18, 2)), CAST(1200000.00 AS Decimal(18, 2)), N'Everon', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:31:11.420' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179870/QuanTriKhachSan/Equipments/ltli8ilbwy0nidk6zhbh.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (15, N'PL-CT-01', N'Gối tựa lưng / Gối ngủ', N'Đồ vải', N'Chiếc', 200, 34, 0, 0, CAST(150000.00 AS Decimal(18, 2)), CAST(250000.00 AS Decimal(18, 2)), N'Everon', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:31:37.580' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179896/QuanTriKhachSan/Equipments/bpd6kf16ks3hod1fdn6k.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (16, N'DR-LV-500', N'Nước suối Lavie 500ml', N'Minibar', N'Chai', 800, 48, 0, 0, CAST(4000.00 AS Decimal(18, 2)), CAST(10000.00 AS Decimal(18, 2)), N'Lavie', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:33:01.247' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179979/QuanTriKhachSan/Equipments/tikrgk9fy7jdw5weoguq.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (17, N'DR-CC-320', N'Nước ngọt Coca Cola 320ml', N'Minibar', N'Lon', 400, 10, 0, 0, CAST(7000.00 AS Decimal(18, 2)), CAST(20000.00 AS Decimal(18, 2)), N'Coca Cola', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:53.867' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179972/QuanTriKhachSan/Equipments/nvme1zf3ey3nn94qasum.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (18, N'DR-HB-330', N'Bia Heineken 330ml', N'Minibar', N'Lon', 300, 22, 0, 0, CAST(16000.00 AS Decimal(18, 2)), CAST(35000.00 AS Decimal(18, 2)), N'Heineken', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:30:14.003' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179812/QuanTriKhachSan/Equipments/r8dohogecgngzzgjajw8.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (19, N'SN-OM-01', N'Mì ly Omachi', N'Minibar', N'Ly', 150, 18, 0, 0, CAST(12000.00 AS Decimal(18, 2)), CAST(25000.00 AS Decimal(18, 2)), N'Masan', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:32:37.287' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179956/QuanTriKhachSan/Equipments/ug3qdolzlgr8yxtyopen.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (20, N'SN-OR-01', N'Bánh Oreo 133g', N'Minibar', N'Hộp', 150, 18, 0, 0, CAST(15000.00 AS Decimal(18, 2)), CAST(30000.00 AS Decimal(18, 2)), N'Mondelez', 1, CAST(N'2026-03-25T14:10:11.000' AS DateTime), CAST(N'2026-04-03T01:30:05.527' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179804/QuanTriKhachSan/Equipments/gli8geoomaudnlyz5cpk.jpg')
INSERT [dbo].[Equipments] ([id], [item_code], [name], [category], [unit], [total_quantity], [in_use_quantity], [damaged_quantity], [liquidated_quantity], [base_price], [default_price_if_lost], [supplier], [is_active], [created_at], [updated_at], [image_url]) VALUES (21, N'TV-SS-55', N'Tivi Samsung 55 inch', N'Điện tử', N'cái', 10, 7, 0, 0, CAST(15000000.00 AS Decimal(18, 2)), CAST(17000000.00 AS Decimal(18, 2)), N'Điện Máy Xanh', 1, CAST(N'2026-03-26T17:29:39.000' AS DateTime), CAST(N'2026-04-03T01:33:14.863' AS DateTime), N'https://res.cloudinary.com/dekvhccnn/image/upload/v1775179993/QuanTriKhachSan/Equipments/lujhndv05zngr3kn3hqc.jpg')

SET IDENTITY_INSERT [dbo].[Equipments] OFF
GO

-- 12. Room_Inventory - Bỏ trống tự thêm lại

SET IDENTITY_INSERT [dbo].[Room_Inventory] ON
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (1, 1, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (2, 1, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (3, 1, 1, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (4, 1, 1, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (5, 1, 1, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (6, 1, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (7, 1, 2, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (8, 1, 1, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (9, 1, 1, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (10, 1, 1, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (11, 1, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (12, 1, 1, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (13, 1, 3, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (14, 1, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (15, 1, 2, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (16, 1, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (17, 1, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (18, 1, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (19, 1, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (20, 10, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (21, 10, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (22, 10, 3, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (23, 10, 4, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (24, 10, 4, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (25, 10, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (26, 10, 6, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (27, 10, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (28, 10, 4, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (29, 10, 4, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (30, 10, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (31, 10, 3, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (32, 10, 7, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (33, 10, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (34, 10, 8, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (35, 10, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (36, 10, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (37, 10, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (38, 10, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (39, 10, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (40, 10, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (41, 3, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (42, 3, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (43, 3, 1, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (44, 3, 1, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (45, 3, 1, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (46, 3, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (47, 3, 2, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (48, 3, 1, CAST(15000000.00 AS Decimal(18, 2)), NULL, 0, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (49, 3, 2, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (50, 3, 2, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (51, 3, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (52, 3, 1, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (53, 3, 4, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (54, 3, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (55, 3, 4, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (56, 3, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 0, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (57, 3, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (58, 3, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (59, 3, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (60, 3, 1, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (61, 3, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (62, 4, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (63, 4, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (64, 4, 1, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (65, 4, 1, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (66, 4, 1, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (67, 4, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (68, 4, 2, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (69, 4, 2, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (70, 4, 2, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (71, 4, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (72, 4, 1, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (73, 4, 4, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (74, 4, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (75, 4, 4, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (76, 4, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (77, 4, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (78, 4, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (79, 4, 1, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (80, 4, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (81, 5, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (82, 5, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (83, 5, 2, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (84, 5, 2, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (85, 5, 2, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (86, 5, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (87, 5, 2, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (88, 5, 4, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (89, 5, 4, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (90, 5, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (91, 5, 2, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (92, 5, 4, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (93, 5, 2, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (94, 5, 4, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (95, 5, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (96, 5, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (97, 5, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (98, 5, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (99, 5, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
GO
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (100, 6, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (101, 6, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (102, 6, 1, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (103, 6, 1, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (104, 6, 2, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (105, 6, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (106, 6, 2, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (107, 6, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (108, 6, 1, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (109, 6, 1, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (110, 6, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (111, 6, 1, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (112, 6, 5, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (113, 6, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (114, 6, 2, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (115, 6, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (116, 6, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (117, 6, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (118, 6, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (119, 7, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (120, 7, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (121, 7, 3, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (122, 7, 4, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (123, 7, 4, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (124, 7, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (125, 7, 6, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (126, 7, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (127, 7, 4, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (128, 7, 4, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (129, 7, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (130, 7, 3, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (131, 7, 7, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (132, 7, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (133, 7, 8, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (134, 7, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (135, 7, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (136, 7, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (137, 7, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (138, 7, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (139, 7, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (140, 8, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (141, 8, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (142, 8, 3, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (143, 8, 4, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (144, 8, 4, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (145, 8, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (146, 8, 6, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (147, 8, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (148, 8, 4, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (149, 8, 4, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (150, 8, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (151, 8, 3, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (152, 8, 7, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (153, 8, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (154, 8, 8, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (155, 8, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (156, 8, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (157, 8, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (158, 8, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (159, 8, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (160, 8, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (161, 9, 1, CAST(350000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 5)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (162, 9, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 9)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (163, 9, 3, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 20)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (164, 9, 4, CAST(35000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 18)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (165, 9, 4, CAST(1200000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 14)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (166, 9, 1, CAST(9000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 2)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (167, 9, 6, CAST(250000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 15)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (168, 9, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 7)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (169, 9, 4, CAST(50000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 12)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (170, 9, 4, CAST(150000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 11)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (171, 9, 1, CAST(600000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 4)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (172, 9, 3, CAST(25000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 19)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (173, 9, 7, CAST(30000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 10)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (174, 9, 1, CAST(20000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 17)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (175, 9, 8, CAST(10000.00 AS Decimal(18, 2)), NULL, 1, N'Minibar', 16)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (176, 9, 1, CAST(8000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 1)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (177, 9, 1, CAST(3000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 3)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (178, 9, 1, CAST(5000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 8)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (179, 9, 1, CAST(80000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 13)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (180, 9, 1, CAST(17000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 21)
INSERT [dbo].[Room_Inventory] ([id], [room_id], [quantity], [price_if_lost], [note], [is_active], [item_type], [equipment_id]) VALUES (181, 9, 2, CAST(15000000.00 AS Decimal(18, 2)), NULL, 1, N'Asset', 6)
SET IDENTITY_INSERT [dbo].[Room_Inventory] OFF
GO

-- 13. Vouchers
SET IDENTITY_INSERT [dbo].[Vouchers] ON
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (1,  N'KM1',  N'PERCENT',      CAST(10.00  AS Decimal(18,2)), CAST(500000.00  AS Decimal(18,2)), CAST(500000.00   AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 100, 0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (2,  N'KM2',  N'FIXED_AMOUNT', CAST(100000.00 AS Decimal(18,2)), NULL, CAST(1000000.00  AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 50,  0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (3,  N'KM3',  N'PERCENT',      CAST(15.00  AS Decimal(18,2)), CAST(1000000.00 AS Decimal(18,2)), CAST(2000000.00  AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 30,  0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (4,  N'KM4',  N'FIXED_AMOUNT', CAST(200000.00 AS Decimal(18,2)), NULL, CAST(1500000.00  AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 50,  0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (5,  N'KM5',  N'PERCENT',      CAST(20.00  AS Decimal(18,2)), CAST(2000000.00 AS Decimal(18,2)), CAST(3000000.00  AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 20,  0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (6,  N'KM6',  N'FIXED_AMOUNT', CAST(50000.00  AS Decimal(18,2)), NULL, CAST(0.00         AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 200, 0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (7,  N'KM7',  N'PERCENT',      CAST(5.00   AS Decimal(18,2)), CAST(300000.00  AS Decimal(18,2)), CAST(0.00         AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 500, 0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (8,  N'KM8',  N'FIXED_AMOUNT', CAST(500000.00 AS Decimal(18,2)), NULL, CAST(5000000.00  AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 10,  0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (9,  N'KM9',  N'PERCENT',      CAST(25.00  AS Decimal(18,2)), CAST(5000000.00 AS Decimal(18,2)), CAST(10000000.00 AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 5,   0, 1, 1, CAST(N'2025-01-01' AS DateTime))
INSERT [dbo].[Vouchers] ([id],[code],[discount_type],[discount_value],[max_discount_amount],[min_booking_value],[applicable_room_type_id],[valid_from],[valid_to],[usage_limit],[used_count],[max_uses_per_user],[is_active],[created_at])
VALUES (10, N'KM10', N'FIXED_AMOUNT', CAST(1000000.00 AS Decimal(18,2)), NULL, CAST(20000000.00 AS Decimal(18,2)), NULL, CAST(N'2025-01-01' AS DateTime), CAST(N'2026-12-31' AS DateTime), 2,   0, 1, 1, CAST(N'2025-01-01' AS DateTime))
SET IDENTITY_INSERT [dbo].[Vouchers] OFF
GO

-- 14. Bookings
SET IDENTITY_INSERT [dbo].[Bookings] ON
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (1,  6,    N'Khách Hàng A',    N'0900000006', NULL, 1, 0, N'BK-0001', NULL, CAST(800000.00   AS Decimal(18,2)), CAST(400000.00  AS Decimal(18,2)), N'Completed',  N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (2,  7,    N'Khách Hàng B',    N'0900000007', NULL, 2, 1, N'BK-0002', 1,    CAST(2500000.00  AS Decimal(18,2)), CAST(500000.00  AS Decimal(18,2)), N'Checked_in', N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (3,  8,    N'Khách Hàng C',    N'0900000008', NULL, 2, 0, N'BK-0003', NULL, CAST(1400000.00  AS Decimal(18,2)), CAST(300000.00  AS Decimal(18,2)), N'Confirmed',  N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (4,  9,    N'Khách Hàng D',    N'0900000009', NULL, 2, 2, N'BK-0004', 2,    CAST(3600000.00  AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), N'Pending',    N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (5,  10,   N'Khách Hàng E',    N'0900000010', NULL, 2, 0, N'BK-0005', NULL, CAST(1200000.00  AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), N'Cancelled',  N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (6,  NULL, N'Khách Vãng Lai 1',N'0911111111', NULL, 2, 0, N'BK-0006', NULL, CAST(3000000.00  AS Decimal(18,2)), CAST(500000.00  AS Decimal(18,2)), N'Completed',  N'walk_in')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (7,  NULL, N'Khách Vãng Lai 2',N'0922222222', NULL, 2, 1, N'BK-0007', 3,    CAST(3600000.00  AS Decimal(18,2)), CAST(1000000.00 AS Decimal(18,2)), N'Checked_in', N'walk_in')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (8,  6,    N'Khách Hàng A',    N'0900000006', NULL, 2, 2, N'BK-0008', NULL, CAST(10000000.00 AS Decimal(18,2)), CAST(2000000.00 AS Decimal(18,2)), N'Confirmed',  N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (9,  7,    N'Khách Hàng B',    N'0900000007', NULL, 4, 0, N'BK-0009', NULL, CAST(25000000.00 AS Decimal(18,2)), CAST(5000000.00 AS Decimal(18,2)), N'Completed',  N'online')
INSERT [dbo].[Bookings] ([id],[user_id],[guest_name],[guest_phone],[guest_email],[num_adults],[num_children],[booking_code],[voucher_id],[total_estimated_amount],[deposit_amount],[status],[source])
VALUES (10, 8,    N'Khách Hàng C',    N'0900000008', NULL, 2, 0, N'BK-0010', 4,    CAST(16000000.00 AS Decimal(18,2)), CAST(3000000.00 AS Decimal(18,2)), N'Checked_in', N'online')
SET IDENTITY_INSERT [dbo].[Bookings] OFF
GO

-- 15. Booking_Details
SET IDENTITY_INSERT [dbo].[Booking_Details] ON
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (1,  1,  1,    1,  CAST(N'2026-03-01' AS DateTime), CAST(N'2026-03-03' AS DateTime), CAST(400000.00  AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (2,  2,  2,    2,  CAST(N'2026-03-05' AS DateTime), CAST(N'2026-03-10' AS DateTime), CAST(500000.00  AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (3,  3,  NULL, 3,  CAST(N'2026-04-10' AS DateTime), CAST(N'2026-04-12' AS DateTime), CAST(700000.00  AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (4,  4,  NULL, 4,  CAST(N'2026-05-01' AS DateTime), CAST(N'2026-05-05' AS DateTime), CAST(900000.00  AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (5,  5,  NULL, 5,  CAST(N'2026-03-15' AS DateTime), CAST(N'2026-03-16' AS DateTime), CAST(1200000.00 AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (6,  6,  6,    6,  CAST(N'2026-02-10' AS DateTime), CAST(N'2026-02-12' AS DateTime), CAST(1500000.00 AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (7,  7,  7,    7,  CAST(N'2026-03-07' AS DateTime), CAST(N'2026-03-09' AS DateTime), CAST(1800000.00 AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (8,  8,  NULL, 8,  CAST(N'2026-06-01' AS DateTime), CAST(N'2026-06-05' AS DateTime), CAST(2500000.00 AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (9,  9,  9,    9,  CAST(N'2026-01-20' AS DateTime), CAST(N'2026-01-25' AS DateTime), CAST(5000000.00 AS Decimal(18,2)))
INSERT [dbo].[Booking_Details] ([id],[booking_id],[room_id],[room_type_id],[check_in_date],[check_out_date],[price_per_night])
VALUES (10, 10, 10,   10, CAST(N'2026-03-06' AS DateTime), CAST(N'2026-03-08' AS DateTime), CAST(8000000.00 AS Decimal(18,2)))
SET IDENTITY_INSERT [dbo].[Booking_Details] OFF
GO

-- 16. Invoices
SET IDENTITY_INSERT [dbo].[Invoices] ON
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (1,  1,  CAST(800000.00   AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(400000.00 AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(80000.00    AS Decimal(18,2)), CAST(1180000.00  AS Decimal(18,2)), N'Paid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (2,  2,  CAST(2500000.00  AS Decimal(18,2)), CAST(200000.00  AS Decimal(18,2)), CAST(300000.00 AS Decimal(18,2)), CAST(250000.00 AS Decimal(18,2)), CAST(245000.00   AS Decimal(18,2)), CAST(2995000.00  AS Decimal(18,2)), N'Unpaid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (3,  3,  CAST(1400000.00  AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(140000.00   AS Decimal(18,2)), CAST(1540000.00  AS Decimal(18,2)), N'Unpaid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (4,  4,  CAST(3600000.00  AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(100000.00 AS Decimal(18,2)), CAST(350000.00   AS Decimal(18,2)), CAST(3850000.00  AS Decimal(18,2)), N'Unpaid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (5,  5,  CAST(1200000.00  AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(120000.00   AS Decimal(18,2)), CAST(1320000.00  AS Decimal(18,2)), N'Refunded')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (6,  6,  CAST(3000000.00  AS Decimal(18,2)), CAST(500000.00  AS Decimal(18,2)), CAST(850000.00 AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(395000.00   AS Decimal(18,2)), CAST(4745000.00  AS Decimal(18,2)), N'Paid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (7,  7,  CAST(3600000.00  AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(540000.00 AS Decimal(18,2)), CAST(306000.00   AS Decimal(18,2)), CAST(3366000.00  AS Decimal(18,2)), N'Unpaid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (8,  8,  CAST(10000000.00 AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(1000000.00  AS Decimal(18,2)), CAST(11000000.00 AS Decimal(18,2)), N'Unpaid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (9,  9,  CAST(25000000.00 AS Decimal(18,2)), CAST(1000000.00 AS Decimal(18,2)), CAST(450000.00 AS Decimal(18,2)), CAST(0.00      AS Decimal(18,2)), CAST(2645000.00  AS Decimal(18,2)), CAST(29045000.00 AS Decimal(18,2)), N'Paid')
INSERT [dbo].[Invoices] ([id],[booking_id],[total_room_amount],[total_service_amount],[total_damage_amount],[discount_amount],[tax_amount],[final_total],[status])
VALUES (10, 10, CAST(16000000.00 AS Decimal(18,2)), CAST(0.00       AS Decimal(18,2)), CAST(300000.00 AS Decimal(18,2)), CAST(200000.00 AS Decimal(18,2)), CAST(1658000.00  AS Decimal(18,2)), CAST(17758000.00 AS Decimal(18,2)), N'Unpaid')
SET IDENTITY_INSERT [dbo].[Invoices] OFF
GO

-- 17. Payments
SET IDENTITY_INSERT [dbo].[Payments] ON
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (1,  1,  N'Final_Settlement', N'Cash',          CAST(880000.00   AS Decimal(18,2)), N'CASH001',  N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (2,  2,  N'Deposit',          N'VNPay',          CAST(1000000.00  AS Decimal(18,2)), N'VNPAY123', N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (3,  3,  N'Deposit',          N'Credit Card',    CAST(500000.00   AS Decimal(18,2)), N'CC456',    N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (4,  4,  N'Final_Settlement', N'Momo',           CAST(3850000.00  AS Decimal(18,2)), N'MOMO789',  N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (5,  5,  N'Refund',           N'Bank Transfer',  CAST(1320000.00  AS Decimal(18,2)), N'BANK001',  N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (6,  6,  N'Final_Settlement', N'Cash',           CAST(3850000.00  AS Decimal(18,2)), N'CASH002',  N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (7,  7,  N'Deposit',          N'VNPay',          CAST(3366000.00  AS Decimal(18,2)), N'VNPAY999', N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (8,  8,  N'Deposit',          N'Credit Card',    CAST(11000000.00 AS Decimal(18,2)), N'CC888',    N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (9,  9,  N'Final_Settlement', N'Bank Transfer',  CAST(28600000.00 AS Decimal(18,2)), N'BANK002',  N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
INSERT [dbo].[Payments] ([id],[invoice_id],[payment_type],[payment_method],[amount_paid],[transaction_code],[status],[payment_date])
VALUES (10, 10, N'Deposit',          N'Momo',           CAST(5000000.00  AS Decimal(18,2)), N'MOMO111',  N'Success', CAST(N'2026-03-06T22:07:35.027' AS DateTime))
SET IDENTITY_INSERT [dbo].[Payments] OFF
GO

-- 18 Service_Categories
SET IDENTITY_INSERT [dbo].[Service_Categories] ON
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (1,  N'Nhà Hàng & Ẩm Thực', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (2,  N'Spa & Massage', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (3,  N'Di Chuyển & Đưa Đón', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (4,  N'Giặt Ủi', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (5,  N'Tour Du Lịch', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (6,  N'Phòng Gym & Yoga', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (7,  N'Hồ Bơi', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (8,  N'Tổ Chức Sự Kiện', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (9,  N'Khu Vui Chơi Trẻ Em', 1)
INSERT [dbo].[Service_Categories] ([id], [name], [is_active]) VALUES (10, N'Cửa Hàng Lưu Niệm', 1)
SET IDENTITY_INSERT [dbo].[Service_Categories] OFF
GO

-- 19. Services
SET IDENTITY_INSERT [dbo].[Services] ON
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (1,  1,  N'Set Ăn Sáng Buffet',    CAST(200000.00 AS Decimal(18,2)), N'Người',  1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (2,  1,  N'Mì Ý Hải Sản',          CAST(150000.00 AS Decimal(18,2)), N'Phần',   1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (3,  2,  N'Massage Toàn Thân 60p', CAST(500000.00 AS Decimal(18,2)), N'Lượt',   1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (4,  2,  N'Xông Hơi Thảo Dược',   CAST(300000.00 AS Decimal(18,2)), N'Lượt',   1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (5,  3,  N'Đưa Đón Sân Bay 4 Chỗ',CAST(350000.00 AS Decimal(18,2)), N'Chuyến', 1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (6,  3,  N'Thuê Xe Máy Nửa Ngày', CAST(100000.00 AS Decimal(18,2)), N'Chiếc',  1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (7,  4,  N'Giặt Khô Áo Vest',     CAST(120000.00 AS Decimal(18,2)), N'Cái',    1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (8,  4,  N'Giặt Sấy Tiêu Chuẩn', CAST(40000.00  AS Decimal(18,2)), N'Kg',     1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (9,  5,  N'Tour Đảo Nửa Ngày',    CAST(800000.00 AS Decimal(18,2)), N'Người',  1)
INSERT [dbo].[Services] ([id],[category_id],[name],[price],[unit],[is_active])
VALUES (10, 10, N'Móc Khóa Kỷ Niệm',    CAST(50000.00  AS Decimal(18,2)), N'Cái',    1)
SET IDENTITY_INSERT [dbo].[Services] OFF
GO

-- 20. Order_Services
SET IDENTITY_INSERT [dbo].[Order_Services] ON
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (1,  1,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(0.00       AS Decimal(18,2)), N'Cancelled', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (2,  2,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(200000.00  AS Decimal(18,2)), N'Delivered', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (3,  3,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(0.00       AS Decimal(18,2)), N'Pending', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (4,  4,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(500000.00  AS Decimal(18,2)), N'Delivered', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (5,  5,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(0.00       AS Decimal(18,2)), N'Pending', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (6,  6,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(350000.00  AS Decimal(18,2)), N'Delivered', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (7,  7,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(800000.00  AS Decimal(18,2)), N'Delivered', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (8,  8,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(0.00       AS Decimal(18,2)), N'Pending', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (9,  9,  CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(1000000.00 AS Decimal(18,2)), N'Delivered', 1)
INSERT [dbo].[Order_Services] ([id],[booking_detail_id],[order_date],[total_amount],[status],[is_active])
VALUES (10, 10, CAST(N'2026-03-06T22:07:35.027' AS DateTime), CAST(150000.00  AS Decimal(18,2)), N'Delivered', 1)
SET IDENTITY_INSERT [dbo].[Order_Services] OFF
GO

-- 21. Order_Service_Details
SET IDENTITY_INSERT [dbo].[Order_Service_Details] ON
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (1,  2,  2,  1, CAST(150000.00 AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (2,  2,  10, 1, CAST(50000.00  AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (3,  4,  3,  1, CAST(500000.00 AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (4,  6,  5,  1, CAST(350000.00 AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (5,  7,  9,  1, CAST(800000.00 AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (6,  9,  1,  5, CAST(200000.00 AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (7,  10, 2,  1, CAST(150000.00 AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (8,  4,  8,  2, CAST(40000.00  AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (9,  6,  10, 2, CAST(50000.00  AS Decimal(18,2)))
INSERT [dbo].[Order_Service_Details] ([id],[order_service_id],[service_id],[quantity],[unit_price]) VALUES (10, 7,  6,  2, CAST(100000.00 AS Decimal(18,2)))
SET IDENTITY_INSERT [dbo].[Order_Service_Details] OFF
GO

-- 22. Loss_And_Damages - Để trống cho sạch :Đ
SET IDENTITY_INSERT [dbo].[Loss_And_Damages] ON

SET IDENTITY_INSERT [dbo].[Loss_And_Damages] OFF
GO

-- 23. Reviews
SET IDENTITY_INSERT [dbo].[Reviews] ON
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (1,  6,  1,  5, N'Phòng tuyệt vời!',                       CAST(N'2026-03-06T22:07:35.023' AS DateTime), 1,    1)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (2,  7,  2,  4, N'Khá tốt, nhân viên thân thiện.',          CAST(N'2026-03-06T22:07:35.023' AS DateTime), 2,    1)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (3,  8,  3,  3, N'Bình thường, điều hòa hơi ồn.',           CAST(N'2026-03-06T22:07:35.023' AS DateTime), 3,    1)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (4,  9,  4,  5, N'View biển rất đẹp.',                      CAST(N'2026-03-06T22:07:35.023' AS DateTime), 4,    1)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (5,  10, 5,  4, N'Bữa sáng ngon miệng.',                    CAST(N'2026-03-06T22:07:35.023' AS DateTime), 5,    0)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (6,  6,  6,  5, N'Rất thích hợp cho gia đình.',             CAST(N'2026-03-06T22:07:35.023' AS DateTime), 8,    1)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (7,  7,  7,  5, N'Sang trọng, đẳng cấp.',                   CAST(N'2026-03-06T22:07:35.023' AS DateTime), 9,    1)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (8,  8,  8,  2, N'Chưa hài lòng với dịch vụ dọn phòng.',   CAST(N'2026-03-06T22:07:35.023' AS DateTime), 10,   0)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (9,  9,  9,  5, N'Hoàn hảo mọi mặt.',                      CAST(N'2026-03-06T22:07:35.023' AS DateTime), NULL, 0)
INSERT [dbo].[Reviews] ([id],[user_id],[room_type_id],[rating],[comment],[created_at],[booking_id],[is_approved])
VALUES (10, 10, 10, 5, N'Trải nghiệm tuyệt vời nhất.',             CAST(N'2026-03-06T22:07:35.023' AS DateTime), NULL, 0)
SET IDENTITY_INSERT [dbo].[Reviews] OFF
GO

-- 24. Article_Categories
SET IDENTITY_INSERT [dbo].[Article_Categories] ON
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (1,  N'Tin Tức Khách Sạn',     N'tin-tuc-khach-san',     1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (2,  N'Cẩm Nang Du Lịch',     N'cam-nang-du-lich',      1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (3,  N'Khám Phá Ẩm Thực',     N'kham-pha-am-thuc',      1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (4,  N'Sự Kiện & Lễ Hội',     N'su-kien-le-hoi',        1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (5,  N'Chương Trình Khuyến Mãi',N'chuong-trinh-khuyen-mai',1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (6,  N'Văn Hóa Địa Phương',   N'van-hoa-dia-phuong',    1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (7,  N'Hướng Dẫn Di Chuyển',  N'huong-dan-di-chuyen',   1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (8,  N'Góc Thư Giãn',          N'goc-thu-gian',           1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (9,  N'Hỏi Đáp (FAQ)',         N'hoi-dap-faq',            1)
INSERT [dbo].[Article_Categories] ([id],[name],[slug],[is_active]) VALUES (10, N'Thư Viện Ảnh',          N'thu-vien-anh',           1)
SET IDENTITY_INSERT [dbo].[Article_Categories] OFF
GO

-- 25. Articles
SET IDENTITY_INSERT [dbo].[Articles] ON
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (1,  1,  1, N'Khai trương nhà hàng mới',       N'khai-truong-nha-hang', N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (2,  2,  2, N'5 điểm đến không thể bỏ lỡ',    N'5-diem-den',           N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (3,  3,  3, N'Món ngon hải sản địa phương',    N'mon-ngon-hai-san',     N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (4,  4,  1, N'Sự kiện đếm ngược năm mới',      N'su-kien-nam-moi',      N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (5,  5,  2, N'Khuyến mãi mùa hè 2026',        N'khuyen-mai-mua-he',    N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (6,  6,  3, N'Lịch sử văn hóa vùng miền',     N'lich-su-van-hoa',      N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (7,  7,  1, N'Từ sân bay về khách sạn',        N'tu-san-bay-ve-ks',     N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (8,  8,  2, N'Cách thư giãn cuối tuần',        N'cach-thu-gian',        N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (9,  9,  3, N'Quy định nhận trả phòng',        N'quy-dinh-nhan-tra',    N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
INSERT [dbo].[Articles] ([id],[category_id],[author_id],[title],[slug],[content],[thumbnail_url],[status],[is_active],[published_at])
VALUES (10, 10, 1, N'Bộ ảnh resort flycam',           N'bo-anh-resort',        N'Nội dung...', NULL, N'Published', 1, CAST(N'2026-03-06T22:07:35.023' AS DateTime))
SET IDENTITY_INSERT [dbo].[Articles] OFF
GO

-- 26. Attractions
SET IDENTITY_INSERT [dbo].[Attractions] ON
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (1,  N'Chợ Trung Tâm',          N'Ẩm thực',  N'123 Đường Trung Tâm',    CAST(16.047079 AS Decimal(9,6)), CAST(108.206230 AS Decimal(9,6)), CAST(1.50  AS Decimal(5,2)), N'Khu chợ truyền thống sầm uất',          NULL, N'link_map_1',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (2,  N'Bãi Biển Chính',         N'Thiên nhiên',N'Bờ biển Đông',          CAST(16.050000 AS Decimal(9,6)), CAST(108.210000 AS Decimal(9,6)), CAST(0.50  AS Decimal(5,2)), N'Bãi tắm công cộng tuyệt đẹp',           NULL, N'link_map_2',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (3,  N'Bảo Tàng Thành Phố',    N'Di tích',  N'456 Đường Lịch Sử',      CAST(16.040000 AS Decimal(9,6)), CAST(108.200000 AS Decimal(9,6)), CAST(3.00  AS Decimal(5,2)), N'Lưu giữ giá trị lịch sử',               NULL, N'link_map_3',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (4,  N'Phố Đi Bộ',             N'Giải trí', N'789 Phố Đêm',            CAST(16.045000 AS Decimal(9,6)), CAST(108.205000 AS Decimal(9,6)), CAST(1.00  AS Decimal(5,2)), N'Khu vực vui chơi giải trí về đêm',      NULL, N'link_map_4',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (5,  N'Chùa Cổ Lịch Sử',      N'Di tích',  N'Núi Ngũ Hành Sơn',       CAST(16.000000 AS Decimal(9,6)), CAST(108.230000 AS Decimal(9,6)), CAST(5.50  AS Decimal(5,2)), N'Ngôi chùa linh thiêng',                 NULL, N'link_map_5',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (6,  N'Khu Vui Chơi Giải Trí', N'Giải trí', N'Khu Vui Chơi Phía Tây',  CAST(15.990000 AS Decimal(9,6)), CAST(108.150000 AS Decimal(9,6)), CAST(8.00  AS Decimal(5,2)), N'Công viên trò chơi quy mô lớn',         NULL, N'link_map_6',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (7,  N'Suối Nước Nóng',        N'Thiên nhiên',N'Vùng Núi Phía Tây',     CAST(15.920000 AS Decimal(9,6)), CAST(108.100000 AS Decimal(9,6)), CAST(15.00 AS Decimal(5,2)), N'Điểm nghỉ dưỡng thiên nhiên',           NULL, N'link_map_7',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (8,  N'Làng Nghề Truyền Thống',N'Di tích',  N'Làng Cổ Ngoại Ô',        CAST(15.960000 AS Decimal(9,6)), CAST(108.130000 AS Decimal(9,6)), CAST(12.00 AS Decimal(5,2)), N'Trải nghiệm văn hóa bản địa',           NULL, N'link_map_8',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (9,  N'Trung Tâm Thương Mại',  N'Giải trí', N'321 Đường Mua Sắm',      CAST(16.043000 AS Decimal(9,6)), CAST(108.208000 AS Decimal(9,6)), CAST(2.00  AS Decimal(5,2)), N'Khu mua sắm cao cấp',                   NULL, N'link_map_9',  1)
INSERT [dbo].[Attractions] ([id],[name],[category],[address],[latitude],[longitude],[distance_km],[description],[image_url],[map_embed_link],[is_active])
VALUES (10, N'Điểm Ngắm Hoàng Hôn',  N'Thiên nhiên',N'Mũi Đất Phía Nam',      CAST(16.020000 AS Decimal(9,6)), CAST(108.215000 AS Decimal(9,6)), CAST(4.00  AS Decimal(5,2)), N'Nơi có view biển đẹp nhất',             NULL, N'link_map_10', 1)
SET IDENTITY_INSERT [dbo].[Attractions] OFF
GO
