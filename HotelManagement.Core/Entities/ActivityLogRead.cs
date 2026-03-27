// HotelManagement.Core/Entities/ActivityLogRead.cs
// Bảng junction: lưu trạng thái đã đọc RIÊNG cho từng user
// Thay thế cột IsRead cũ trên ActivityLog (vốn là global).
namespace HotelManagement.Core.Entities;

public class ActivityLogRead
{
    public int Id { get; set; }

    public int ActivityLogId { get; set; }
    public int UserId { get; set; }

    public DateTime ReadAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ActivityLog ActivityLog { get; set; } = null!;
    public User User { get; set; } = null!;
}
