using HotelManagement.Core.DTOs;
using HotelManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Services;

public interface IBookingService
{
    Task<ApiListResponse<BookingResponse>> GetAllAsync(ListQueryRequest queryRequest, int? userId);
}

public class BookingService : IBookingService
{
    private readonly AppDbContext _context;

    public BookingService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ApiListResponse<BookingResponse>> GetAllAsync(ListQueryRequest queryRequest, int? userId)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _context.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .Include(b => b.Invoices)
                .ThenInclude(i => i.Payments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(queryRequest.Status))
            query = query.Where(b => b.Status == queryRequest.Status);

        if (userId.HasValue)
            query = query.Where(b => b.UserId == userId);

        if (queryRequest.FromDate.HasValue)
            query = query.Where(b => b.CheckInTime >= queryRequest.FromDate);

        if (queryRequest.ToDate.HasValue)
            query = query.Where(b => b.CheckOutTime <= queryRequest.ToDate);

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(b =>
                (b.BookingCode != null && b.BookingCode.ToLower().Contains(keyword)) ||
                (b.GuestName != null && b.GuestName.ToLower().Contains(keyword)) ||
                (b.GuestPhone != null && b.GuestPhone.ToLower().Contains(keyword)) ||
                (b.GuestEmail != null && b.GuestEmail.ToLower().Contains(keyword)));
        }

        var sortDirDesc = !string.Equals(queryRequest.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        query = queryRequest.SortBy?.ToLower() switch
        {
            "checkintime" => sortDirDesc ? query.OrderByDescending(b => b.CheckInTime) : query.OrderBy(b => b.CheckInTime),
            "checkouttime" => sortDirDesc ? query.OrderByDescending(b => b.CheckOutTime) : query.OrderBy(b => b.CheckOutTime),
            "bookingcode" => sortDirDesc ? query.OrderByDescending(b => b.BookingCode) : query.OrderBy(b => b.BookingCode),
            _ => sortDirDesc ? query.OrderByDescending(b => b.Id) : query.OrderBy(b => b.Id)
        };

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new ApiListResponse<BookingResponse>
        {
            Data = data.Select(MapToResponse),
            Pagination = new PaginationMeta
            {
                CurrentPage = page,
                PageSize = pageSize,
                TotalItems = total,
                TotalPages = totalPages
            },
            Summary = new { totalItems = total },
            Message = "Láº¥y danh sĂ¡ch booking thĂ nh cĂ´ng."
        };
    }

    private static BookingPaymentSummaryResponse BuildPaymentSummary(Core.Entities.Booking booking)
    {
        var paidBeforeCheckout = Math.Max(0m, booking.DepositAmount ?? 0m);
        var latestInvoice = booking.Invoices
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefault();

        decimal? remainingToCheckout = null;
        if (latestInvoice != null)
        {
            var invoicePaid = latestInvoice.Payments
                .Where(p => string.Equals(p.Status, HotelManagement.Core.Constants.PaymentStatuses.Success, StringComparison.OrdinalIgnoreCase))
                .Sum(p => string.Equals(p.PaymentType, HotelManagement.Core.Constants.PaymentTypes.Refund, StringComparison.OrdinalIgnoreCase)
                    ? -p.AmountPaid
                    : p.AmountPaid);

            remainingToCheckout = Math.Max(0m, (latestInvoice.FinalTotal ?? 0m) - paidBeforeCheckout - invoicePaid);
        }

        return new BookingPaymentSummaryResponse
        {
            EstimatedTotal = booking.TotalEstimatedAmount,
            PaidBeforeCheckout = paidBeforeCheckout,
            RequiredBookingDepositAmount = booking.RequiredBookingDepositAmount,
            RequiredCheckInAmount = booking.RequiredCheckInAmount,
            RemainingToConfirm = Math.Max(0m, booking.RequiredBookingDepositAmount - paidBeforeCheckout),
            RemainingToCheckIn = Math.Max(0m, booking.RequiredCheckInAmount - paidBeforeCheckout),
            RemainingToCheckout = remainingToCheckout,
            CanConfirm = paidBeforeCheckout >= booking.RequiredBookingDepositAmount,
            CanCheckIn = paidBeforeCheckout >= booking.RequiredCheckInAmount
        };
    }

    private static BookingResponse MapToResponse(Core.Entities.Booking b) => new()
    {
        Id = b.Id,
        UserId = b.UserId,
        GuestName = b.GuestName,
        GuestPhone = b.GuestPhone,
        GuestEmail = b.GuestEmail,
        NumAdults = b.NumAdults,
        NumChildren = b.NumChildren,
        BookingCode = b.BookingCode,
        VoucherId = b.VoucherId,
        TotalEstimatedAmount = b.TotalEstimatedAmount,
        DepositAmount = b.DepositAmount,
        CheckInTime = b.CheckInTime,
        CheckOutTime = b.CheckOutTime,
        Status = b.Status,
        Source = b.Source,
        Note = b.Note,
        CancellationReason = b.CancellationReason,
        CancelledAt = b.CancelledAt,
        PaymentSummary = BuildPaymentSummary(b),
        BookingDetails = b.BookingDetails.Select(d => new BookingDetailResponse
        {
            Id = d.Id,
            BookingId = d.BookingId ?? b.Id,
            RoomId = d.RoomId,
            RoomTypeId = d.RoomTypeId,
            CheckInDate = d.CheckInDate,
            CheckOutDate = d.CheckOutDate,
            PricePerNight = d.PricePerNight,
            Note = d.Note,
            RoomName = d.Room?.RoomNumber,
            RoomTypeName = d.RoomType?.Name
        }).ToList()
    };
}

