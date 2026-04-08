namespace HotelManagement.Core.Entities;

public class MaintenanceTicket
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public int? ReportedByUserId { get; set; }
    public int? AssignedToUserId { get; set; }
    public string Title { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string? Category { get; set; }
    public string Priority { get; set; } = "Medium";
    public bool BlocksRoom { get; set; }
    public string Status { get; set; } = "Open";
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? ExpectedDoneAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? ResolutionNote { get; set; }

    public Room Room { get; set; } = null!;
    public User? ReportedByUser { get; set; }
    public User? AssignedToUser { get; set; }
}
