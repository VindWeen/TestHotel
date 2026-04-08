namespace HotelManagement.Core.DTOs;

public class CreateShiftRequest
{
    public int UserId { get; set; }
    public string ShiftType { get; set; } = null!;
    public string Department { get; set; } = null!;
    public DateTime PlannedStart { get; set; }
    public DateTime PlannedEnd { get; set; }
}

public class ShiftHandoverRequest
{
    public string HandoverNote { get; set; } = null!;
    public decimal? CashAtHandover { get; set; }
}

public class ShiftResponse
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserFullName { get; set; } = null!;
    public int? ConfirmedBy { get; set; }
    public string? ConfirmedByName { get; set; }
    public string ShiftType { get; set; } = null!;
    public string Department { get; set; } = null!;
    public DateTime PlannedStart { get; set; }
    public DateTime PlannedEnd { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public int LateMinutes { get; set; }
    public string Status { get; set; } = null!;
    public string? HandoverNote { get; set; }
    public decimal? CashAtHandover { get; set; }
    public DateTime CreatedAt { get; set; }
}
