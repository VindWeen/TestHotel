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
    Task<object?> AddAdjustmentAsync(int id, AddInvoiceAdjustmentRequest request, CancellationToken cancellationToken = default);
    Task<object?> RemoveAdjustmentAsync(int id, int adjustmentId, CancellationToken cancellationToken = default);
}

public class InvoiceService : IInvoiceService
{
    private readonly AppDbContext _db;

    public InvoiceService(AppDbContext db)
    {
        _db = db;
    }

    private static string ComputeRoomStatus(string businessStatus, string cleaningStatus)
        => businessStatus switch
        {
            RoomBusinessStatuses.Occupied => "Occupied",
            RoomBusinessStatuses.Disabled => "Maintenance",
            RoomBusinessStatuses.Available when cleaningStatus is CleaningStatuses.Dirty or CleaningStatuses.PendingLoss => "Cleaning",
            _ => "Available"
        };

    private async Task<int?> ResolveRoomIdAsync(LossAndDamage record, CancellationToken cancellationToken = default)
    {
        if (record.RoomInventoryId.HasValue)
        {
            return await _db.RoomInventories
                .Where(ri => ri.Id == record.RoomInventoryId.Value)
                .Select(ri => (int?)ri.RoomId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (record.BookingDetailId.HasValue)
        {
            return await _db.BookingDetails
                .Where(bd => bd.Id == record.BookingDetailId.Value)
                .Select(bd => bd.RoomId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return null;
    }

    private static int ComputeRemainingToReplenish(LossAndDamage record)
        => Math.Max(0, Math.Max(1, record.Quantity) - Math.Max(0, record.ReplenishedQuantity));

    private async Task SyncRoomCleaningStatusForLossAsync(LossAndDamage record, CancellationToken cancellationToken = default)
    {
        var roomId = await ResolveRoomIdAsync(record, cancellationToken);
        if (!roomId.HasValue)
            return;

        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == roomId.Value, cancellationToken);
        if (room is null || room.BusinessStatus != RoomBusinessStatuses.Available)
            return;

        var hasPendingLoss = await _db.LossAndDamages
            .Where(l => l.Id != record.Id && (l.Status == "Pending" || (l.Status == "Confirmed" && l.ReplenishedQuantity < l.Quantity)))
            .AnyAsync(l =>
                (l.RoomInventoryId.HasValue && l.RoomInventory != null && l.RoomInventory.RoomId == roomId.Value)
                || (l.BookingDetailId.HasValue && l.BookingDetail != null && l.BookingDetail.RoomId == roomId.Value), cancellationToken);

        if (record.Status == "Pending" || (record.Status == "Confirmed" && ComputeRemainingToReplenish(record) > 0))
            hasPendingLoss = true;

        if (hasPendingLoss)
        {
            if (room.CleaningStatus == CleaningStatuses.Clean || room.CleaningStatus == CleaningStatuses.PendingLoss)
            {
                room.CleaningStatus = CleaningStatuses.PendingLoss;
                room.Status = ComputeRoomStatus(room.BusinessStatus, room.CleaningStatus);
            }

            return;
        }

        if (room.CleaningStatus == CleaningStatuses.PendingLoss)
        {
            room.CleaningStatus = CleaningStatuses.Clean;
            room.Status = ComputeRoomStatus(room.BusinessStatus, room.CleaningStatus);
        }
    }

    private async Task SyncEquipmentForLossRecordAsync(LossAndDamage record, CancellationToken cancellationToken = default)
    {
        if (record.IsStockSynced || !record.RoomInventoryId.HasValue)
            return;

        var roomInventory = await _db.RoomInventories
            .Include(ri => ri.Equipment)
            .FirstOrDefaultAsync(ri => ri.Id == record.RoomInventoryId.Value, cancellationToken);

        if (roomInventory?.Equipment is null)
            return;

        var equipment = roomInventory.Equipment;
        var quantity = Math.Max(1, record.Quantity);
        var shortageQuantity = Math.Max(0, quantity - Math.Max(0, record.ReplenishedQuantity));

        roomInventory.Quantity = Math.Max(0, (roomInventory.Quantity ?? 0) - shortageQuantity);
        roomInventory.IsActive = (roomInventory.Quantity ?? 0) > 0;
        roomInventory.Note ??= record.Description;
        equipment.InUseQuantity = Math.Max(0, equipment.InUseQuantity - shortageQuantity);
        equipment.DamagedQuantity += quantity;
        equipment.UpdatedAt = DateTime.UtcNow;
        record.IsStockSynced = true;
    }

    private async Task AutoProcessLossAndDamagesForPaidInvoiceAsync(int bookingId, CancellationToken cancellationToken = default)
    {
        var bookingDetailIds = await _db.BookingDetails
            .Where(d => d.BookingId == bookingId)
            .Select(d => d.Id)
            .ToListAsync(cancellationToken);

        var pendingLosses = await _db.LossAndDamages
            .Include(l => l.RoomInventory)
            .Where(l =>
                l.Status == "Pending" &&
                l.BookingDetailId.HasValue &&
                bookingDetailIds.Contains(l.BookingDetailId.Value))
            .ToListAsync(cancellationToken);

        foreach (var record in pendingLosses)
        {
            record.Status = "Confirmed";
            await SyncEquipmentForLossRecordAsync(record, cancellationToken);
        }

        foreach (var record in pendingLosses)
        {
            await SyncRoomCleaningStatusForLossAsync(record, cancellationToken);
        }
    }

    private async Task AutoDeliverOrderServicesForPaidInvoiceAsync(int bookingId, CancellationToken cancellationToken = default)
    {
        var bookingDetailIds = await _db.BookingDetails
            .Where(d => d.BookingId == bookingId)
            .Select(d => d.Id)
            .ToListAsync(cancellationToken);

        if (bookingDetailIds.Count == 0)
            return;

        var pendingOrders = await _db.OrderServices
            .Where(o =>
                o.BookingDetailId.HasValue &&
                bookingDetailIds.Contains(o.BookingDetailId.Value) &&
                o.IsActive &&
                o.Status == "Pending")
            .ToListAsync(cancellationToken);

        foreach (var order in pendingOrders)
        {
            order.Status = "Delivered";
            order.CompletedAt = order.CompletedAt ?? DateTime.UtcNow;
        }
    }

    private async Task<(decimal TotalRoomAmount, decimal TotalServiceAmount, decimal TotalDamageAmount, decimal DiscountAmount, decimal TaxAmount, decimal FinalTotal)> BuildInvoiceSnapshotAsync(int bookingId, CancellationToken cancellationToken = default)
    {
        var booking = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.OrderServices)
                    .ThenInclude(o => o.OrderServiceDetails)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (booking == null)
            throw new KeyNotFoundException($"Không tìm thấy booking #{bookingId}.");

        var bookingDetailIds = booking.BookingDetails.Select(d => d.Id).ToList();

        var totalRoomAmount = booking.BookingDetails.Sum(d =>
        {
            var nights = (d.CheckOutDate.Date - d.CheckInDate.Date).Days;
            return Math.Max(1, nights) * d.PricePerNight;
        });

        var totalServiceAmount = booking.BookingDetails
            .SelectMany(d => d.OrderServices)
            .Where(s => s.IsActive && !string.Equals(s.Status, BookingStatuses.Cancelled, StringComparison.OrdinalIgnoreCase))
            .Sum(s => s.TotalAmount ?? s.OrderServiceDetails.Sum(x => x.Quantity * x.UnitPrice));

        var totalDamageAmount = await _db.LossAndDamages
            .AsNoTracking()
            .Where(l =>
                l.Status != "Waived" &&
                l.BookingDetailId.HasValue &&
                bookingDetailIds.Contains(l.BookingDetailId.Value))
            .SumAsync(l => l.PenaltyAmount * l.Quantity, cancellationToken);

        var discountAmount = Math.Max(0m, totalRoomAmount - booking.TotalEstimatedAmount);
        var subtotal = totalRoomAmount + totalServiceAmount + totalDamageAmount - discountAmount;
        var taxAmount = 0m;
        var finalTotal = Math.Max(0m, subtotal + taxAmount);

        return (totalRoomAmount, totalServiceAmount, totalDamageAmount, discountAmount, taxAmount, finalTotal);
    }

    private async Task SyncInvoiceFromBookingAsync(Invoice invoice, CancellationToken cancellationToken = default)
    {
        if (!invoice.BookingId.HasValue)
            return;

        var snapshot = await BuildInvoiceSnapshotAsync(invoice.BookingId.Value, cancellationToken);
        invoice.TotalRoomAmount = snapshot.TotalRoomAmount;
        invoice.TotalServiceAmount = snapshot.TotalServiceAmount;
        invoice.TotalDamageAmount = snapshot.TotalDamageAmount;
        invoice.DiscountAmount = snapshot.DiscountAmount;
        invoice.TaxAmount = snapshot.TaxAmount;
        invoice.FinalTotal = snapshot.FinalTotal;
    }

    private async Task RecalculateInvoiceTotalsAsync(Invoice invoice, CancellationToken cancellationToken = default)
    {
        await SyncInvoiceFromBookingAsync(invoice, cancellationToken);
        await _db.Entry(invoice).Collection(i => i.Adjustments).LoadAsync(cancellationToken);
        await _db.Entry(invoice).Collection(i => i.Payments).LoadAsync(cancellationToken);

        var surchargeTotal = invoice.Adjustments
            .Where(a => string.Equals(a.AdjustmentType, "Surcharge", StringComparison.OrdinalIgnoreCase))
            .Sum(a => a.Amount);

        var manualDiscountTotal = invoice.Adjustments
            .Where(a => string.Equals(a.AdjustmentType, "Discount", StringComparison.OrdinalIgnoreCase))
            .Sum(a => a.Amount);

        var subtotal = (invoice.TotalRoomAmount ?? 0m)
            + (invoice.TotalServiceAmount ?? 0m)
            + (invoice.TotalDamageAmount ?? 0m)
            + surchargeTotal
            - (invoice.DiscountAmount ?? 0m)
            - manualDiscountTotal;

        invoice.FinalTotal = Math.Max(0m, subtotal + (invoice.TaxAmount ?? 0m));
    }

    public async Task<ApiListResponse<object>> GetListAsync(ListQueryRequest queryRequest, string? status, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.Invoices
            .Include(i => i.Booking)
            .Include(i => i.Payments)
            .Include(i => i.Adjustments)
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
        var invoices = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        foreach (var invoice in invoices)
        {
            await RecalculateInvoiceTotalsAsync(invoice, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);

        var responseData = invoices.Select(i => new
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
            AdjustmentAmount = i.Adjustments
                .Where(a => a.AdjustmentType == "Surcharge")
                .Sum(a => a.Amount),
            ManualDiscountAmount = i.Adjustments
                .Where(a => a.AdjustmentType == "Discount")
                .Sum(a => a.Amount),
            i.Status,
            i.CreatedAt,
            PaidAmount = i.Payments
                .Where(p => p.Status == PaymentStatuses.Success)
                .Sum(p => p.PaymentType == PaymentTypes.Refund ? -p.AmountPaid : p.AmountPaid),
            DepositAmount = i.Booking?.DepositAmount ?? 0m,
            OutstandingAmount = 0m
        }).ToList();

        responseData = responseData.Select(i => new
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
            i.AdjustmentAmount,
            i.ManualDiscountAmount,
            i.Status,
            i.CreatedAt,
            i.PaidAmount,
            i.DepositAmount,
            OutstandingAmount = Math.Max(0m, (i.FinalTotal ?? 0m) - i.PaidAmount - i.DepositAmount)
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
                    string.Equals(i.Status, InvoiceStatuses.ReadyToCollect, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(i.Status, InvoiceStatuses.Unpaid, StringComparison.OrdinalIgnoreCase))
            },
            Message = "Lấy danh sách hóa đơn thành công."
        };
    }

    public async Task<object?> GetDetailAsync(int id, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Booking)
                .ThenInclude(b => b!.BookingDetails)
                    .ThenInclude(d => d.RoomType)
            .Include(i => i.Booking)
                .ThenInclude(b => b!.BookingDetails)
                    .ThenInclude(d => d.Room)
            .Include(i => i.Booking)
                .ThenInclude(b => b!.BookingDetails)
                    .ThenInclude(d => d.OrderServices)
                        .ThenInclude(o => o.OrderServiceDetails)
                            .ThenInclude(od => od.Service)
            .Include(i => i.Payments)
            .Include(i => i.Adjustments)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null) return null;

        await RecalculateInvoiceTotalsAsync(invoice, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var paidAmount = invoice.Payments
            .Where(p => p.Status == PaymentStatuses.Success)
            .Sum(p => p.PaymentType == PaymentTypes.Refund ? -p.AmountPaid : p.AmountPaid);

        var depositAmount = invoice.Booking?.DepositAmount ?? 0m;
        var bookingDetailIds = invoice.Booking?.BookingDetails.Select(d => d.Id).ToList() ?? [];

        var damageItems = await _db.LossAndDamages
            .AsNoTracking()
            .Include(l => l.RoomInventory)
                .ThenInclude(ri => ri!.Equipment)
            .Include(l => l.RoomInventory)
                .ThenInclude(ri => ri!.Room)
            .Where(l =>
                l.Status != "Waived" &&
                l.BookingDetailId.HasValue &&
                bookingDetailIds.Contains(l.BookingDetailId.Value))
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Status,
                l.Quantity,
                l.PenaltyAmount,
                TotalAmount = l.PenaltyAmount * l.Quantity,
                l.Description,
                l.CreatedAt,
                l.ReplenishedQuantity,
                RemainingToReplenish = Math.Max(0, l.Quantity - l.ReplenishedQuantity),
                ItemName = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber = l.RoomInventory != null && l.RoomInventory.Room != null ? l.RoomInventory.Room.RoomNumber : null
            })
            .ToListAsync(cancellationToken);

        var serviceItems = invoice.Booking?.BookingDetails
            .SelectMany(d => d.OrderServices.SelectMany(order => order.OrderServiceDetails.Select(detail => new
            {
                OrderServiceId = order.Id,
                OrderDate = order.OrderDate,
                OrderStatus = order.Status,
                OrderNote = order.Note,
                BookingDetailId = d.Id,
                RoomNumber = d.Room != null ? d.Room.RoomNumber : null,
                ServiceId = detail.ServiceId,
                ServiceName = detail.Service != null ? detail.Service.Name : "Dịch vụ",
                detail.Quantity,
                detail.UnitPrice,
                TotalAmount = detail.Quantity * detail.UnitPrice
            })))
            .Where(item => !string.Equals(item.OrderStatus, BookingStatuses.Cancelled, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(item => item.OrderDate)
            .ThenBy(item => item.ServiceName)
            .ToList() ?? [];

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
            DepositAmount = depositAmount,
            AdjustmentAmount = invoice.Adjustments
                .Where(a => string.Equals(a.AdjustmentType, "Surcharge", StringComparison.OrdinalIgnoreCase))
                .Sum(a => a.Amount),
            ManualDiscountAmount = invoice.Adjustments
                .Where(a => string.Equals(a.AdjustmentType, "Discount", StringComparison.OrdinalIgnoreCase))
                .Sum(a => a.Amount),
            PaidAmount = paidAmount,
            OutstandingAmount = Math.Max(0m, (invoice.FinalTotal ?? 0m) - paidAmount - depositAmount),
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
            ServiceItems = serviceItems,
            DamageItems = damageItems,
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
                }),
            Adjustments = invoice.Adjustments
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.AdjustmentType,
                    a.Amount,
                    a.Reason,
                    a.Note,
                    a.CreatedAt
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

        var snapshot = await BuildInvoiceSnapshotAsync(bookingId, cancellationToken);

        var invoice = new Invoice
        {
            BookingId = bookingId,
            TotalRoomAmount = snapshot.TotalRoomAmount,
            TotalServiceAmount = snapshot.TotalServiceAmount,
            TotalDamageAmount = snapshot.TotalDamageAmount,
            DiscountAmount = snapshot.DiscountAmount,
            TaxAmount = snapshot.TaxAmount,
            FinalTotal = snapshot.FinalTotal,
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
                totalRoomAmount = snapshot.TotalRoomAmount,
                totalServiceAmount = snapshot.TotalServiceAmount,
                totalDamageAmount = snapshot.TotalDamageAmount,
                discountAmount = snapshot.DiscountAmount,
                taxAmount = snapshot.TaxAmount,
                finalTotal = snapshot.FinalTotal
            }
        };
    }

    public async Task<object?> FinalizeAsync(int id, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .Include(i => i.Adjustments)
            .Include(i => i.Booking)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null) return null;

        await RecalculateInvoiceTotalsAsync(invoice, cancellationToken);

        var paidAmount = invoice.Payments
            .Where(p => p.Status == PaymentStatuses.Success)
            .Sum(p => p.PaymentType == PaymentTypes.Refund ? -p.AmountPaid : p.AmountPaid);

        var total = invoice.FinalTotal ?? 0m;
        var depositAmount = invoice.Booking?.DepositAmount ?? 0m;
        var collectedTotal = paidAmount + depositAmount;
        invoice.Status = collectedTotal switch
        {
            <= 0m => InvoiceStatuses.ReadyToCollect,
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
                    await AutoDeliverOrderServicesForPaidInvoiceAsync(booking.Id, cancellationToken);
                    await AutoProcessLossAndDamagesForPaidInvoiceAsync(booking.Id, cancellationToken);
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
            DepositAmount = depositAmount,
            OutstandingAmount = Math.Max(0m, total - collectedTotal)
        };
    }

    public async Task<object?> AddAdjustmentAsync(int id, AddInvoiceAdjustmentRequest request, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Adjustments)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null) return null;

        var adjustmentType = string.Equals(request.AdjustmentType, "Discount", StringComparison.OrdinalIgnoreCase)
            ? "Discount"
            : "Surcharge";

        if (request.Amount <= 0)
            throw new InvalidOperationException("Số tiền điều chỉnh phải lớn hơn 0.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new InvalidOperationException("Lý do điều chỉnh không được để trống.");

        invoice.Adjustments.Add(new InvoiceAdjustment
        {
            AdjustmentType = adjustmentType,
            Amount = request.Amount,
            Reason = request.Reason.Trim(),
            Note = request.Note,
            CreatedAt = DateTime.UtcNow
        });

        await RecalculateInvoiceTotalsAsync(invoice, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return await GetDetailAsync(id, cancellationToken);
    }

    public async Task<object?> RemoveAdjustmentAsync(int id, int adjustmentId, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Adjustments)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null) return null;

        var adjustment = invoice.Adjustments.FirstOrDefault(a => a.Id == adjustmentId);
        if (adjustment == null)
            throw new KeyNotFoundException($"Không tìm thấy điều chỉnh hóa đơn #{adjustmentId}.");

        _db.InvoiceAdjustments.Remove(adjustment);
        await RecalculateInvoiceTotalsAsync(invoice, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return await GetDetailAsync(id, cancellationToken);
    }

    public async Task<object?> GetByBookingIdAsync(int bookingId, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .Include(i => i.Booking)
            .FirstOrDefaultAsync(i => i.BookingId == bookingId, cancellationToken);

        if (invoice == null) return null;

        await RecalculateInvoiceTotalsAsync(invoice, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var paidAmount = invoice.Payments
            .Where(p => p.Status == PaymentStatuses.Success)
            .Sum(p => p.PaymentType == PaymentTypes.Refund ? -p.AmountPaid : p.AmountPaid);

        var depositAmount = invoice.Booking?.DepositAmount ?? 0m;

        return new
        {
            invoice.Id,
            invoice.BookingId,
            invoice.FinalTotal,
            invoice.Status,
            PaidAmount = paidAmount,
            DepositAmount = depositAmount,
            OutstandingAmount = Math.Max(0m, (invoice.FinalTotal ?? 0m) - paidAmount - depositAmount)
        };
    }
}
