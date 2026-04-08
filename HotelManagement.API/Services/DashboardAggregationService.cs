using HotelManagement.Core.Constants;
using HotelManagement.Core.DTOs;
using HotelManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Services;

public interface IDashboardAggregationService
{
    Task<DashboardOverviewResponse> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<ReportOccupancyResponse> GetOccupancyAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default);
    Task<ReportRevenueResponse> GetRevenueAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default);
    Task<ReportBookingsResponse> GetBookingsAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default);
    Task<ReportServicesResponse> GetServicesAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default);
    Task<ReportLossDamageResponse> GetLossDamagesAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default);
    Task<ReportMembersResponse> GetMembersAsync(CancellationToken cancellationToken = default);
}

public class DashboardAggregationService : IDashboardAggregationService
{
    private readonly AppDbContext _db;

    public DashboardAggregationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardOverviewResponse> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;

        var bookings = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
            .OrderByDescending(b => b.Id)
            .Take(200)
            .ToListAsync(cancellationToken);

        var rooms = await _db.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .OrderBy(r => r.RoomNumber)
            .ToListAsync(cancellationToken);

        var users = await _db.Users.AsNoTracking().ToListAsync(cancellationToken);
        var reviews = await _db.Reviews.AsNoTracking().Where(r => r.IsApproved == true).ToListAsync(cancellationToken);
        var damages = await _db.LossAndDamages.AsNoTracking().ToListAsync(cancellationToken);

        var completedBookings = bookings.Where(b => string.Equals(b.Status, BookingStatuses.Completed, StringComparison.OrdinalIgnoreCase)).ToList();
        var totalRevenue = completedBookings.Sum(b => b.TotalEstimatedAmount);
        var todayRevenue = completedBookings
            .Where(b => (b.CheckOutTime ?? b.BookingDetails.OrderByDescending(d => d.CheckOutDate).Select(d => (DateTime?)d.CheckOutDate).FirstOrDefault())?.Date == today)
            .Sum(b => b.TotalEstimatedAmount);

        var availableRooms = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Available && r.CleaningStatus == CleaningStatuses.Clean);
        var occupiedRooms = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Occupied);
        var totalRooms = Math.Max(1, rooms.Count);

        var revenueLabels = Enumerable.Range(0, 7)
            .Select(offset => now.Date.AddDays(offset - 6).ToString("dd/MM"))
            .ToList();
        var revenueValues = Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var day = now.Date.AddDays(offset - 6);
                return completedBookings
                    .Where(b => (b.CheckOutTime ?? b.BookingDetails.OrderByDescending(d => d.CheckOutDate).Select(d => (DateTime?)d.CheckOutDate).FirstOrDefault())?.Date == day)
                    .Sum(b => b.TotalEstimatedAmount);
            })
            .ToList();

        return new DashboardOverviewResponse
        {
            Kpis = new DashboardKpiResponse
            {
                TotalRevenue = totalRevenue,
                TodayRevenue = todayRevenue,
                ActiveBookings = bookings.Count(b => b.Status is BookingStatuses.Pending or BookingStatuses.Confirmed or BookingStatuses.CheckedIn or BookingStatuses.CheckedOutPendingSettlement),
                PendingBookings = bookings.Count(b => b.Status == BookingStatuses.Pending),
                AvailableRooms = availableRooms,
                OccupancyRate = (int)Math.Round((occupiedRooms / (double)totalRooms) * 100),
                AvgRating = reviews.Count == 0
                    ? 0d
                    : Math.Round(reviews.Where(r => r.Rating.HasValue).Average(r => (double)r.Rating!.Value), 1)
            },
            Revenue = new DashboardRevenueResponse
            {
                Labels = revenueLabels,
                Values = revenueValues
            },
            Bookings = new DashboardBookingSummaryResponse
            {
                ByStatus = bookings.GroupBy(b => b.Status ?? "Unknown").ToDictionary(g => g.Key, g => g.Count()),
                Recent = bookings.Take(8).Select(b => new BookingSummaryItemResponse
                {
                    Id = b.Id,
                    BookingCode = b.BookingCode,
                    GuestName = b.GuestName,
                    GuestPhone = b.GuestPhone,
                    TotalEstimatedAmount = b.TotalEstimatedAmount,
                    Status = b.Status,
                    ReferenceDate = b.CheckInTime ?? b.BookingDetails.OrderBy(d => d.CheckInDate).Select(d => (DateTime?)d.CheckInDate).FirstOrDefault()
                }).ToList()
            },
            Rooms = new DashboardRoomSummaryResponse
            {
                CountByStatus = new Dictionary<string, int>
                {
                    ["Ready"] = availableRooms,
                    ["Occupied"] = occupiedRooms,
                    ["Cleaning"] = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Available && r.CleaningStatus == CleaningStatuses.Dirty),
                    ["PendingLoss"] = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Available && r.CleaningStatus == CleaningStatuses.PendingLoss),
                    ["Maintenance"] = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Disabled)
                },
                Preview = rooms.Take(12).Select(r => new RoomSummaryItemResponse
                {
                    Id = r.Id,
                    RoomNumber = r.RoomNumber,
                    RoomTypeName = r.RoomType?.Name,
                    BusinessStatus = r.BusinessStatus,
                    CleaningStatus = r.CleaningStatus,
                    LiveStatus = BuildRoomLiveStatus(r.BusinessStatus, r.CleaningStatus)
                }).ToList()
            },
            Members = new DashboardMemberSummaryResponse
            {
                TotalMembers = users.Count(u => u.MembershipId != null || u.LoyaltyPoints > 0 || u.LoyaltyPointsUsable > 0),
                ActiveMembers = users.Count(u => (u.MembershipId != null || u.LoyaltyPoints > 0 || u.LoyaltyPointsUsable > 0) && u.Status == true),
                LockedMembers = users.Count(u => (u.MembershipId != null || u.LoyaltyPoints > 0 || u.LoyaltyPointsUsable > 0) && u.Status != true),
                TotalPoints = users.Sum(u => u.LoyaltyPoints)
            },
            Damages = new DashboardDamageSummaryResponse
            {
                PendingCount = damages.Count(d => string.Equals(d.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
                ConfirmedCount = damages.Count(d => string.Equals(d.Status, "Confirmed", StringComparison.OrdinalIgnoreCase)),
                TotalPenaltyAmount = damages.Sum(d => d.PenaltyAmount * d.Quantity)
            }
        };
    }

    public async Task<ReportOccupancyResponse> GetOccupancyAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default)
    {
        var rooms = await _db.Rooms.AsNoTracking().ToListAsync(cancellationToken);
        var totalRooms = rooms.Count;
        var occupiedRooms = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Occupied);
        var availableRooms = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Available && r.CleaningStatus == CleaningStatuses.Clean);
        var disabledRooms = rooms.Count(r => r.BusinessStatus == RoomBusinessStatuses.Disabled);

        return new ReportOccupancyResponse
        {
            FromDate = (fromDate ?? DateTime.UtcNow.Date).Date,
            ToDate = (toDate ?? DateTime.UtcNow.Date).Date,
            TotalRooms = totalRooms,
            OccupiedRooms = occupiedRooms,
            AvailableRooms = availableRooms,
            DisabledRooms = disabledRooms,
            OccupancyRate = totalRooms == 0 ? 0 : (int)Math.Round((occupiedRooms / (double)totalRooms) * 100)
        };
    }

    public async Task<ReportRevenueResponse> GetRevenueAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default)
    {
        var (from, to) = NormalizeRange(fromDate, toDate);
        var invoices = await _db.Invoices.AsNoTracking().Where(i => i.CreatedAt >= from && i.CreatedAt <= to).ToListAsync(cancellationToken);
        var roomRevenue = invoices.Sum(i => i.TotalRoomAmount ?? 0m);
        var serviceRevenue = invoices.Sum(i => i.TotalServiceAmount ?? 0m);
        var damageRevenue = invoices.Sum(i => i.TotalDamageAmount ?? 0m);

        return new ReportRevenueResponse
        {
            FromDate = from,
            ToDate = to,
            RoomRevenue = roomRevenue,
            ServiceRevenue = serviceRevenue,
            DamageRevenue = damageRevenue,
            TotalRevenue = roomRevenue + serviceRevenue + damageRevenue
        };
    }

    public async Task<ReportBookingsResponse> GetBookingsAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default)
    {
        var (from, to) = NormalizeRange(fromDate, toDate);
        var bookings = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
            .Where(b => b.BookingDetails.Any(d => d.CheckInDate >= from && d.CheckInDate <= to))
            .ToListAsync(cancellationToken);

        return new ReportBookingsResponse
        {
            FromDate = from,
            ToDate = to,
            ByStatus = bookings.GroupBy(b => b.Status ?? "Unknown").ToDictionary(g => g.Key, g => g.Count()),
            BySource = bookings.GroupBy(b => b.Source ?? BookingSources.Online).ToDictionary(g => g.Key, g => g.Count())
        };
    }

    public async Task<ReportServicesResponse> GetServicesAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default)
    {
        var (from, to) = NormalizeRange(fromDate, toDate);
        var orders = await _db.OrderServices
            .AsNoTracking()
            .Include(o => o.OrderServiceDetails)
                .ThenInclude(d => d.Service)
            .Where(o => o.OrderDate >= from && o.OrderDate <= to)
            .ToListAsync(cancellationToken);

        return new ReportServicesResponse
        {
            FromDate = from,
            ToDate = to,
            TotalOrders = orders.Count,
            TotalAmount = orders.Sum(o => o.TotalAmount ?? 0m),
            TopServices = orders
                .SelectMany(o => o.OrderServiceDetails)
                .Where(d => d.Service != null)
                .GroupBy(d => new { d.ServiceId, d.Service!.Name })
                .Select(g => new ServiceSalesItemResponse
                {
                    ServiceId = g.Key.ServiceId ?? 0,
                    ServiceName = g.Key.Name,
                    Quantity = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.Quantity * x.UnitPrice)
                })
                .OrderByDescending(x => x.Revenue)
                .Take(5)
                .ToList()
        };
    }

    public async Task<ReportLossDamageResponse> GetLossDamagesAsync(DateTime? fromDate, DateTime? toDate, CancellationToken cancellationToken = default)
    {
        var (from, to) = NormalizeRange(fromDate, toDate);
        var incidents = await _db.LossAndDamages.AsNoTracking().Where(x => x.CreatedAt >= from && x.CreatedAt <= to).ToListAsync(cancellationToken);

        return new ReportLossDamageResponse
        {
            FromDate = from,
            ToDate = to,
            TotalIncidents = incidents.Count,
            PendingIncidents = incidents.Count(x => string.Equals(x.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
            ConfirmedIncidents = incidents.Count(x => string.Equals(x.Status, "Confirmed", StringComparison.OrdinalIgnoreCase)),
            TotalPenaltyAmount = incidents.Sum(x => x.PenaltyAmount * x.Quantity)
        };
    }

    public async Task<ReportMembersResponse> GetMembersAsync(CancellationToken cancellationToken = default)
    {
        var users = await _db.Users
            .AsNoTracking()
            .Include(u => u.Membership)
            .Where(u => u.MembershipId != null || u.LoyaltyPoints > 0 || u.LoyaltyPointsUsable > 0)
            .ToListAsync(cancellationToken);

        return new ReportMembersResponse
        {
            TotalMembers = users.Count,
            ActiveMembers = users.Count(u => u.Status == true),
            LockedMembers = users.Count(u => u.Status != true),
            TotalPoints = users.Sum(u => u.LoyaltyPoints),
            TierBreakdown = users
                .GroupBy(u => u.Membership?.TierName ?? "Chưa có hạng")
                .Select(g => new MemberTierBreakdownItemResponse
                {
                    TierName = g.Key,
                    MemberCount = g.Count(),
                    TotalPoints = g.Sum(x => x.LoyaltyPoints)
                })
                .OrderByDescending(x => x.MemberCount)
                .ToList()
        };
    }

    private static (DateTime From, DateTime To) NormalizeRange(DateTime? fromDate, DateTime? toDate)
    {
        var from = (fromDate ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
        var to = (toDate ?? DateTime.UtcNow.Date).Date.AddDays(1).AddTicks(-1);
        if (to < from)
        {
            to = from.AddDays(1).AddTicks(-1);
        }

        return (from, to);
    }

    private static string BuildRoomLiveStatus(string businessStatus, string cleaningStatus)
    {
        if (businessStatus == RoomBusinessStatuses.Disabled) return "Maintenance";
        if (businessStatus == RoomBusinessStatuses.Occupied) return "Occupied";
        if (cleaningStatus == CleaningStatuses.PendingLoss) return "PendingLoss";
        if (cleaningStatus == CleaningStatuses.Dirty) return "Cleaning";
        return "Ready";
    }
}
