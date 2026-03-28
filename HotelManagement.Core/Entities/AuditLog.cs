namespace HotelManagement.Core.Entities;

public class AuditLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = null!;
    public string TableName { get; set; } = null!;
    public int RecordId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? UserAgent { get; set; }
    public DateTime? CreatedAt { get; set; }

    // Navigation
    public User? User { get; set; }
}
