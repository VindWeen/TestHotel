namespace HotelManagement.Core.DTOs;

public class CreateMaintenanceTicketRequest
{
    public int RoomId { get; set; }
    public string Title { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string? Category { get; set; }
    public string Priority { get; set; } = "Medium";
    public int? AssignedToUserId { get; set; }
    public bool BlocksRoom { get; set; }
    public DateTime? ExpectedDoneAt { get; set; }
}

public class UpdateMaintenanceTicketRequest
{
    public string Title { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string? Category { get; set; }
    public string Priority { get; set; } = "Medium";
    public int? AssignedToUserId { get; set; }
    public bool BlocksRoom { get; set; }
    public DateTime? ExpectedDoneAt { get; set; }
}

public class UpdateMaintenanceStatusRequest
{
    public string Status { get; set; } = null!;
    public string? ResolutionNote { get; set; }
}

public class MaintenanceTicketResponse
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public string RoomNumber { get; set; } = null!;
    public string? RoomTypeName { get; set; }
    public string Title { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string? Category { get; set; }
    public string Priority { get; set; } = null!;
    public bool BlocksRoom { get; set; }
    public string Status { get; set; } = null!;
    public DateTime OpenedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? ExpectedDoneAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? ResolutionNote { get; set; }
    public MaintenanceUserReferenceResponse? ReportedBy { get; set; }
    public MaintenanceUserReferenceResponse? AssignedTo { get; set; }
}

public class MaintenanceUserReferenceResponse
{
    public int Id { get; set; }
    public string FullName { get; set; } = null!;
}
