namespace HotelManagement.Core.Entities;

public class Shift
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? ConfirmedBy { get; set; }

    // Loại & bộ phận
    public string ShiftType { get; set; } = null!;   // Morning / Afternoon / Night
    public string Department { get; set; } = null!;  // Lễ tân / Housekeeping / Bảo vệ / F&B

    // Kế hoạch vs thực tế
    public DateTime PlannedStart { get; set; }
    public DateTime PlannedEnd { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public int LateMinutes { get; set; } = 0;

    // Trạng thái
    public string Status { get; set; } = "Scheduled"; // Scheduled / Active / Completed / Absent

    // Bàn giao ca
    public string? HandoverNote { get; set; }
    public decimal? CashAtHandover { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public User? ConfirmedByUser { get; set; }
}
