using HotelManagement.Core.DTOs;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Constants;
using HotelManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Services;

public interface IInvoiceService
{
    Task<ApiListResponse<object>> GetListAsync(ListQueryRequest queryRequest, string? status, CancellationToken cancellationToken = default);
    Task<object?> GetDetailAsync(int id, CancellationToken cancellationToken = default);
    Task<object> CreateFromBookingAsync(int bookingId, CancellationToken cancellationToken = default);
    Task<object?> FinalizeAsync(int id, CancellationToken cancellationToken = default);
    Task<object?> GetByBookingIdAsync(int bookingId, CancellationToken cancellationToken = default);
}

public class InvoiceService : IInvoiceService
{
    private readonly AppDbContext _db;

    public InvoiceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ApiListResponse<object>> GetListAsync(ListQueryRequest queryRequest, string? status, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.Invoices
            .AsNoTracking()
            .Include(i => i.Booking)
            .Include(i => i.Payments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(i => i.Status == status);

        if (!string.IsNullOrWhiteSpace(queryRequest.Status))
            query = query.Where(i => i.Status == queryRequest.Status);

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(i =>
                i.Id.ToString().Contains(keyword) ||
                (i.Booking != null && i.Booking.BookingCode.ToLower().Contains(keyword)));
        }

        if (queryRequest.FromDate.HasValue)
            query = query.Where(i => i.CreatedAt >= queryRequest.FromDate.Value);

        if (queryRequest.ToDate.HasValue)
            query = query.Where(i => i.CreatedAt <= queryRequest.ToDate.Value);

        var sortDesc = !string.Equals(queryRequest.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        query = queryRequest.SortBy?.ToLower() switch
        {
            "finaltotal" => sortDesc ? query.OrderByDescending(i => i.FinalTotal) : query.OrderBy(i => i.FinalTotal),
            "status" => sortDesc ? query.OrderByDescending(i => i.Status) : query.OrderBy(i => i.Status),
            _ => sortDesc ? query.OrderByDescending(i => i.CreatedAt) : query.OrderBy(i => i.CreatedAt)
        };

        var totalItems = await query.CountAsync(cancellationToken);
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new
            {
                i.Id,
                i.BookingId,
                BookingCode = i.Booking != null ? i.Booking.BookingCode : null,
                i.TotalRoomAmount,
                i.TotalServiceAmount,
                i.TotalDamageAmount,
                i.DiscountAmount,
                i.TaxAmount,
                i.FinalTotal,
                i.Status,
                i.CreatedAt,
                PaidAmount = i.Payments.Where(p => p.Status == PaymentStatuses.Success).Sum(p => p.AmountPaid)
            })
            .ToListAsync(cancellationToken);

        var responseData = data.Select(i => new
        {
            i.Id,
            i.BookingId,
            i.BookingCode,
            i.TotalRoomAmount,
            i.TotalServiceAmount,
            i.TotalDamageAmount,
            i.DiscountAmount,
            i.TaxAmount,
            i.FinalTotal,
            i.Status,
            i.CreatedAt,
            i.PaidAmount,
            OutstandingAmount = (i.FinalTotal ?? 0m) - i.PaidAmount
        }).ToList();

        return new ApiListResponse<object>
        {
            Data = responseData,
            Pagination = new PaginationMeta
            {
                CurrentPage = page,
                PageSize = pageSize,
                TotalItems = totalItems,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
            },
            Summary = new
            {
                totalItems,
                unpaidItems = responseData.Count(i =>
                    string.Equals(i.Status, InvoiceStatuses.Draft, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(i.Status, InvoiceStatuses.Unpaid, StringComparison.OrdinalIgnoreCase))
            },
            Message = "Lấy danh sách hóa đơn thành công."
        };
    }

    public async Task<object?> GetDetailAsync(int id, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .AsNoTracking()
            .Include(i => i.Booking)
                .ThenInclude(b => b!.BookingDetails)
                    .ThenInclude(d => d.RoomType)
            .Include(i => i.Booking)
                .ThenInclude(b => b!.BookingDetails)
                    .ThenInclude(d => d.Room)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null) return null;

        var paidAmount = invoice.Payments
            .Where(p => p.Status == PaymentStatuses.Success)
            .Sum(p => p.AmountPaid);

        return new
        {
            invoice.Id,
            invoice.BookingId,
            BookingCode = invoice.Booking?.BookingCode,
            invoice.TotalRoomAmount,
            invoice.TotalServiceAmount,
            invoice.TotalDamageAmount,
            invoice.DiscountAmount,
            invoice.TaxAmount,
            invoice.FinalTotal,
            invoice.Status,
            invoice.CreatedAt,
            PaidAmount = paidAmount,
            OutstandingAmount = (invoice.FinalTotal ?? 0m) - paidAmount,
            Booking = invoice.Booking == null ? null : new
            {
                invoice.Booking.Id,
                invoice.Booking.GuestName,
                invoice.Booking.GuestPhone,
                invoice.Booking.GuestEmail,
                invoice.Booking.Status
            },
            BookingDetails = invoice.Booking?.BookingDetails.Select(d => new
            {
                d.Id,
                d.RoomId,
                RoomNumber = d.Room != null ? d.Room.RoomNumber : null,
                d.RoomTypeId,
                RoomTypeName = d.RoomType != null ? d.RoomType.Name : null,
                d.CheckInDate,
                d.CheckOutDate,
                d.PricePerNight
            }),
            Payments = invoice.Payments
                .OrderByDescending(p => p.PaymentDate)
                .Select(p => new
                {
                    p.Id,
                    p.PaymentType,
                    p.PaymentMethod,
                    p.AmountPaid,
                    p.TransactionCode,
                    p.Status,
                    p.PaymentDate,
                    p.Note
                })
        };
    }

    public async Task<object> CreateFromBookingAsync(int bookingId, CancellationToken cancellationToken = default)
    {
        var existing = await _db.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.BookingId == bookingId, cancellationToken);

        if (existing != null)
            return new { created = false, invoiceId = existing.Id, message = "Hóa đơn cho booking này đã tồn tại." };

        var booking = await _db.Bookings
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.OrderServices)
                    .ThenInclude(o => o.OrderServiceDetails)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.LossAndDamages)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (booking == null)
            throw new KeyNotFoundException($"Không tìm thấy booking #{bookingId}.");

        var totalRoomAmount = booking.BookingDetails.Sum(d =>
        {
            var nights = (d.CheckOutDate.Date - d.CheckInDate.Date).Days;
            return Math.Max(1, nights) * d.PricePerNight;
        });

        var totalServiceAmount = booking.BookingDetails
            .SelectMany(d => d.OrderServices)
            .Where(s => s.IsActive && !string.Equals(s.Status, BookingStatuses.Cancelled, StringComparison.OrdinalIgnoreCase))
            .Sum(s => s.TotalAmount ?? s.OrderServiceDetails.Sum(x => x.Quantity * x.UnitPrice));

        var totalDamageAmount = booking.BookingDetails
            .SelectMany(d => d.LossAndDamages)
            .Where(l => !string.Equals(l.Status, "Waived", StringComparison.OrdinalIgnoreCase))
            .Sum(l => l.PenaltyAmount * l.Quantity);

        var discountAmount = Math.Max(0m, totalRoomAmount - booking.TotalEstimatedAmount);
        var subtotal = totalRoomAmount + totalServiceAmount + totalDamageAmount - discountAmount;
        var taxAmount = 0m;
        var finalTotal = Math.Max(0m, subtotal + taxAmount);

        var invoice = new Invoice
        {
            BookingId = bookingId,
            TotalRoomAmount = totalRoomAmount,
            TotalServiceAmount = totalServiceAmount,
            TotalDamageAmount = totalDamageAmount,
            DiscountAmount = discountAmount,
            TaxAmount = taxAmount,
            FinalTotal = finalTotal,
            Status = InvoiceStatuses.Draft,
            CreatedAt = DateTime.UtcNow
        };

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync(cancellationToken);

        return new
        {
            created = true,
            invoiceId = invoice.Id,
            message = "Tạo hóa đơn nháp từ booking thành công.",
            summary = new
            {
                totalRoomAmount,
                totalServiceAmount,
                totalDamageAmount,
                discountAmount,
                taxAmount,
                finalTotal
            }
        };
    }

    public async Task<object?> FinalizeAsync(int id, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null) return null;

        var paidAmount = invoice.Payments
            .Where(p => p.Status == PaymentStatuses.Success)
            .Sum(p => p.AmountPaid);

        var total = invoice.FinalTotal ?? 0m;
        invoice.Status = paidAmount switch
        {
            <= 0m when string.Equals(invoice.Status, InvoiceStatuses.Draft, StringComparison.OrdinalIgnoreCase)
                => InvoiceStatuses.Unpaid,
            <= 0m => InvoiceStatuses.Unpaid,
            var v when v >= total => InvoiceStatuses.Paid,
            _ => InvoiceStatuses.PartiallyPaid
        };

        if (invoice.BookingId.HasValue)
        {
            var booking = await _db.Bookings.FirstOrDefaultAsync(b => b.Id == invoice.BookingId.Value, cancellationToken);
            if (booking != null)
            {
                if (string.Equals(invoice.Status, InvoiceStatuses.Paid, StringComparison.OrdinalIgnoreCase))
                {
                    booking.Status = BookingStatuses.Completed;
                }
                else if (string.Equals(booking.Status, BookingStatuses.Completed, StringComparison.OrdinalIgnoreCase))
                {
                    booking.Status = BookingStatuses.CheckedOutPendingSettlement;
                }
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new
        {
            invoice.Id,
            invoice.Status,
            PaidAmount = paidAmount,
            OutstandingAmount = total - paidAmount
        };
    }

    public async Task<object?> GetByBookingIdAsync(int bookingId, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .AsNoTracking()
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.BookingId == bookingId, cancellationToken);

        if (invoice == null) return null;

        var paidAmount = invoice.Payments
            .Where(p => p.Status == PaymentStatuses.Success)
            .Sum(p => p.AmountPaid);

        return new
        {
            invoice.Id,
            invoice.BookingId,
            invoice.FinalTotal,
            invoice.Status,
            PaidAmount = paidAmount,
            OutstandingAmount = (invoice.FinalTotal ?? 0m) - paidAmount
        };
    }
}
