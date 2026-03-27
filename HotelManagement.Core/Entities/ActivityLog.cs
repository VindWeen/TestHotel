// HotelManagement.Core/Entities/ActivityLog.cs
namespace HotelManagement.Core.Entities;

public class ActivityLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? RoleName { get; set; }

    // Hành động
    public string ActionCode { get; set; } = null!;   // APPROVE_REVIEW, CONFIRM_BOOKING...
    public string ActionLabel { get; set; } = null!;  // "Duyệt đánh giá", "Xác nhận booking"

    // Đối tượng bị tác động
    public string? EntityType { get; set; }   // "Review", "Booking", "User", "Room"...
    public int? EntityId { get; set; }
    public string? EntityLabel { get; set; }  // "BK-0001", "Khách Hàng A"

    // Nội dung
    public string Severity { get; set; } = "Info"; // Info / Success / Warning / Critical
    public string Message { get; set; } = null!;
    public string? Metadata { get; set; }           // JSON nếu cần thêm dữ liệu

    // Trạng thái đọc (per-user — xem ActivityLogRead)
    // IsRead cũ đã được tách sang bảng ActivityLogRead để hỗ trợ nhiều user.
    public DateTime CreatedAt { get; set; }

    // Navigation
    public User? User { get; set; }
    public ICollection<ActivityLogRead> Reads { get; set; } = [];
}