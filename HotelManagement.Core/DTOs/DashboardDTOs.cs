namespace HotelManagement.Core.DTOs;

public class DashboardOverviewResponse
{
    public DashboardKpiResponse Kpis { get; set; } = new();
    public DashboardRevenueResponse Revenue { get; set; } = new();
    public DashboardBookingSummaryResponse Bookings { get; set; } = new();
    public DashboardRoomSummaryResponse Rooms { get; set; } = new();
    public DashboardMemberSummaryResponse Members { get; set; } = new();
    public DashboardDamageSummaryResponse Damages { get; set; } = new();
}

public class DashboardKpiResponse
{
    public decimal TotalRevenue { get; set; }
    public decimal TodayRevenue { get; set; }
    public int ActiveBookings { get; set; }
    public int PendingBookings { get; set; }
    public int AvailableRooms { get; set; }
    public int OccupancyRate { get; set; }
    public double AvgRating { get; set; }
}

public class DashboardRevenueResponse
{
    public List<string> Labels { get; set; } = [];
    public List<decimal> Values { get; set; } = [];
}

public class DashboardBookingSummaryResponse
{
    public Dictionary<string, int> ByStatus { get; set; } = [];
    public List<BookingSummaryItemResponse> Recent { get; set; } = [];
}

public class BookingSummaryItemResponse
{
    public int Id { get; set; }
    public string BookingCode { get; set; } = null!;
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public decimal TotalEstimatedAmount { get; set; }
    public string? Status { get; set; }
    public DateTime? ReferenceDate { get; set; }
}

public class DashboardRoomSummaryResponse
{
    public Dictionary<string, int> CountByStatus { get; set; } = [];
    public List<RoomSummaryItemResponse> Preview { get; set; } = [];
}

public class RoomSummaryItemResponse
{
    public int Id { get; set; }
    public string RoomNumber { get; set; } = null!;
    public string? RoomTypeName { get; set; }
    public string BusinessStatus { get; set; } = null!;
    public string CleaningStatus { get; set; } = null!;
    public string LiveStatus { get; set; } = null!;
}

public class DashboardMemberSummaryResponse
{
    public int TotalMembers { get; set; }
    public int ActiveMembers { get; set; }
    public int LockedMembers { get; set; }
    public int TotalPoints { get; set; }
}

public class DashboardDamageSummaryResponse
{
    public int PendingCount { get; set; }
    public int ConfirmedCount { get; set; }
    public decimal TotalPenaltyAmount { get; set; }
}

public class ReportOccupancyResponse
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalRooms { get; set; }
    public int OccupiedRooms { get; set; }
    public int AvailableRooms { get; set; }
    public int DisabledRooms { get; set; }
    public int OccupancyRate { get; set; }
}

public class ReportRevenueResponse
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public decimal RoomRevenue { get; set; }
    public decimal ServiceRevenue { get; set; }
    public decimal DamageRevenue { get; set; }
    public decimal TotalRevenue { get; set; }
}

public class ReportBookingsResponse
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public Dictionary<string, int> ByStatus { get; set; } = [];
    public Dictionary<string, int> BySource { get; set; } = [];
}

public class ReportServicesResponse
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalOrders { get; set; }
    public decimal TotalAmount { get; set; }
    public List<ServiceSalesItemResponse> TopServices { get; set; } = [];
}

public class ServiceSalesItemResponse
{
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal Revenue { get; set; }
}

public class ReportLossDamageResponse
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalIncidents { get; set; }
    public int PendingIncidents { get; set; }
    public int ConfirmedIncidents { get; set; }
    public decimal TotalPenaltyAmount { get; set; }
}

public class ReportMembersResponse
{
    public int TotalMembers { get; set; }
    public int ActiveMembers { get; set; }
    public int LockedMembers { get; set; }
    public int TotalPoints { get; set; }
    public List<MemberTierBreakdownItemResponse> TierBreakdown { get; set; } = [];
}

public class MemberTierBreakdownItemResponse
{
    public string TierName { get; set; } = null!;
    public int MemberCount { get; set; }
    public int TotalPoints { get; set; }
}
