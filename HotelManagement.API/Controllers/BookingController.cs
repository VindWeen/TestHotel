using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Helpers;
using HotelManagement.API.Services;using HotelManagement.Core.DTOs;

namespace HotelManagement.API.Controllers;
[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer _redis;
    private readonly IEmailService _email;
    private readonly IActivityLogService _activityLog;

    public BookingsController(AppDbContext context, IConnectionMultiplexer redis, IEmailService email, IActivityLogService activityLog)
    {
        _context = context;
        _redis = redis;
        _email = email;
        _activityLog = activityLog;
    }

    private IDatabase RedisDb => _redis.GetDatabase();

    private static BookingResponse MapToResponse(Booking b) => new()
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

    // ================= GET ALL =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        string? status,
        DateTime? fromDate,
        DateTime? toDate,
        int? userId,
        int page = 1,
        int pageSize = 10)
    {
        var query = _context.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(b => b.Status == status);

        if (userId.HasValue)
            query = query.Where(b => b.UserId == userId);

        if (fromDate.HasValue)
            query = query.Where(b => b.CheckInTime >= fromDate);

        if (toDate.HasValue)
            query = query.Where(b => b.CheckOutTime <= toDate);

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(b => b.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, page, pageSize, data = data.Select(MapToResponse) });
    }

    // ================= GET BY ID =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var booking = await _context.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null) return NotFound();
        return Ok(MapToResponse(booking));
    }

    // ================= MY BOOKINGS =================
    [Authorize]
    [HttpGet("my-bookings")]
    public async Task<IActionResult> GetMyBookings()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var bookings = await _context.Bookings
            .AsNoTracking()
            .Where(b => b.UserId == userId)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .OrderByDescending(b => b.Id)
            .ToListAsync();

        return Ok(bookings.Select(MapToResponse));
    }

    // ================= CREATE =================
    [AllowAnonymous]
    [HttpPost]
    public async Task<IActionResult> Create(CreateBookingRequest request)
    {
        var locks = new List<string>();

        try
        {
            // ===== REDIS LOCK =====
            try
            {
                foreach (var d in request.Details)
                {
                    var key = $"lock:{d.RoomTypeId}:{d.CheckInDate:yyyyMMdd}:{d.CheckOutDate:yyyyMMdd}";
                    var ok = await RedisDb.StringSetAsync(key, "1", TimeSpan.FromSeconds(30), When.NotExists);
                    if (!ok)
                        return BadRequest("Đang có người đặt cùng loại phòng, thử lại!");
                    locks.Add(key);
                }
            }
            catch (RedisConnectionException)
            {
                // Redis unavailable: continue with DB overlap check as fallback.
            }

            // ===== OVERLAP CHECK =====
            foreach (var d in request.Details)
            {
                var conflict = await _context.BookingDetails.AnyAsync(bd =>
                    bd.RoomTypeId == d.RoomTypeId &&
                    !(bd.CheckOutDate <= d.CheckInDate || bd.CheckInDate >= d.CheckOutDate)
                );

                if (conflict)
                    return BadRequest("Phòng đã bị đặt trong khoảng này!");
            }

            // ===== LẤY USER ID NẾU ĐÃ ĐĂNG NHẬP =====
            int? currentUserId = null;
            if (User.Identity?.IsAuthenticated == true)
                currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var booking = new Booking
            {
                UserId = request.UserId,
                GuestName = request.GuestName,
                GuestPhone = request.GuestPhone,
                GuestEmail = request.GuestEmail,
                NumAdults = request.NumAdults,
                NumChildren = request.NumChildren,
                Status = "Pending",
                Source = request.Source ?? "online",
                Note = request.Note,
                // Thêm 4 ký tự random để tránh trùng khi concurrent same-second
                BookingCode = $"BK{DateTime.UtcNow:yyyyMMddHHmmss}{Guid.NewGuid().ToString("N")[..4].ToUpper()}"
            };

            decimal total = 0;

            // ===== LOAD ALL ROOMTYPES + VOUCHER SONG SONG (Task.WhenAll) =====
            var roomTypeIds = request.Details.Select(d => d.RoomTypeId).Distinct().ToList();
            var roomTypesTask = _context.RoomTypes
                .Where(rt => roomTypeIds.Contains(rt.Id))
                .ToDictionaryAsync(rt => rt.Id);
            var voucherTask = request.VoucherId.HasValue
                ? _context.Vouchers.FindAsync(request.VoucherId.Value).AsTask()
                : Task.FromResult<Voucher?>(null);

            await Task.WhenAll(roomTypesTask, voucherTask);
            var roomTypesDict = roomTypesTask.Result;

            foreach (var d in request.Details)
            {
                if (!roomTypesDict.TryGetValue(d.RoomTypeId, out var rt))
                    return BadRequest($"RoomType #{d.RoomTypeId} không tồn tại");

                var nights = (d.CheckOutDate - d.CheckInDate).Days;
                if (nights <= 0) return BadRequest("Ngày check-out phải sau check-in");

                total += nights * rt.BasePrice;

                booking.BookingDetails.Add(new BookingDetail
                {
                    RoomTypeId = d.RoomTypeId,
                    CheckInDate = d.CheckInDate,
                    CheckOutDate = d.CheckOutDate,
                    PricePerNight = rt.BasePrice
                });
            }

            // ===== APPLY VOUCHER =====
            var v = voucherTask.Result;
            if (request.VoucherId.HasValue)
            {
                if (v == null || !v.IsActive)
                    return BadRequest("Voucher không hợp lệ");

                if (v.ValidFrom.HasValue && DateTime.UtcNow < v.ValidFrom)
                    return BadRequest("Voucher chưa đến ngày sử dụng");

                if (v.ValidTo.HasValue && DateTime.UtcNow > v.ValidTo)
                    return BadRequest("Voucher đã hết hạn");

                if (v.UsageLimit.HasValue && v.UsedCount >= v.UsageLimit)
                    return BadRequest("Voucher đã hết lượt sử dụng");

                if (v.MinBookingValue.HasValue && total < v.MinBookingValue)
                    return BadRequest($"Đơn hàng tối thiểu {v.MinBookingValue:N0}đ để dùng voucher này");

                decimal discount = 0;

                if (v.DiscountType == "PERCENT")
                {
                    discount = total * v.DiscountValue / 100;
                    if (v.MaxDiscountAmount.HasValue)
                        discount = Math.Min(discount, v.MaxDiscountAmount.Value);
                }
                else // FIXED_AMOUNT
                {
                    discount = v.DiscountValue;
                }

                booking.VoucherId = v.Id;
                booking.TotalEstimatedAmount = total - discount;
                v.UsedCount += 1;
            }
            else
            {
                booking.TotalEstimatedAmount = total;
            }

            // ===== DEPOSIT =====
            booking.DepositAmount = booking.TotalEstimatedAmount * 0.3m;

            _context.Bookings.Add(booking);

            // Ghi AuditLog trước SaveChanges (gộp chung 1 lần)
            _context.AuditLogs.Add(new AuditLog
            {
                UserId    = currentUserId,
                Action    = "CREATE_BOOKING",
                TableName = "Bookings",
                RecordId  = booking.Id,
                OldValue  = null,
                NewValue  = $"{{\"bookingCode\": \"{booking.BookingCode}\", \"total\": {booking.TotalEstimatedAmount}}}",
                UserAgent = Request.Headers["User-Agent"].ToString(),
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(); // Chỉ 1 lần

            // Ghi Activity Log (push SignalR)
            await _activityLog.LogAsync(
                actionCode: "CREATE_BOOKING",
                actionLabel: "Đặt phòng mới",
                message: $"Khách hàng {booking.GuestName} đã đặt phòng thành công ({booking.BookingCode}). Tổng: {booking.TotalEstimatedAmount:N0}đ",
                entityType: "Booking",
                entityId: booking.Id,
                entityLabel: booking.BookingCode,
                severity: "Success",
                userId: currentUserId,
                roleName: User.FindFirst("role")?.Value
            );

            return Ok(MapToResponse(booking));
        }
        finally
        {
            foreach (var key in locks)
                await RedisDb.KeyDeleteAsync(key);
        }
    }

    // ================= CONFIRM =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/confirm")]
    public async Task<IActionResult> Confirm(int id)
    {
        var b = await _context.Bookings
            .Include(x => x.BookingDetails)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null) return NotFound();

        if (b.Status != "Pending")
            return BadRequest("Sai trạng thái");

        b.Status = "Confirmed";

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CONFIRM_BOOKING",
            actionLabel: "Xác nhận đặt phòng",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã xác nhận booking {b.BookingCode} cho khách {b.GuestName}.",
            entityType: "Booking",
            entityId: id,
            entityLabel: b.BookingCode,
            severity: "Success",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CONFIRM_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = "{\"status\": \"Pending\"}",
            NewValue  = "{\"status\": \"Confirmed\"}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        // Gửi email xác nhận đặt phòng
        var toEmail = b.GuestEmail ?? b.User?.Email;
        if (!string.IsNullOrEmpty(toEmail))
        {
            var detail = b.BookingDetails.FirstOrDefault();
            _ = _email.SendBookingConfirmationAsync(
                toEmail,
                b.GuestName ?? b.User?.FullName ?? "Quý khách",
                b.BookingCode,
                detail?.CheckInDate  ?? DateTime.Now,
                detail?.CheckOutDate ?? DateTime.Now.AddDays(1),
                b.TotalEstimatedAmount
            );
        }

        return Ok(MapToResponse(b));
    }

    // ================= CANCEL =================
    [Authorize]
    [HttpPatch("{id}/cancel")]
    public async Task<IActionResult> Cancel(int id, string reason)
    {
        var b = await _context.Bookings
            .Include(x => x.BookingDetails)
                .ThenInclude(d => d.Room)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null) return NotFound();

        b.Status = "Cancelled";
        b.CancellationReason = reason;
        b.CancelledAt = DateTime.UtcNow;

        foreach (var d in b.BookingDetails)
        {
            if (d.Room != null)
            {
                d.Room.BusinessStatus = "Available";
                d.Room.CleaningStatus = "Clean";
            }
        }

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CANCEL_BOOKING",
            actionLabel: "Hủy đặt phòng",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã hủy booking {b.BookingCode} của khách {b.GuestName}. Lý do: {reason}",
            entityType: "Booking",
            entityId: id,
            entityLabel: b.BookingCode,
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CANCEL_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = $"{{\"status\": \"{b.Status}\"}}",
            NewValue  = $"{{\"status\": \"Cancelled\", \"reason\": \"{reason}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(MapToResponse(b));
    }

    // ================= CHECK-IN =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/check-in")]
    public async Task<IActionResult> CheckIn(int id)
    {
        var b = await _context.Bookings
            .Include(x => x.BookingDetails)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null) return NotFound();

        if (b.Status != "Confirmed")
            return BadRequest("Chưa confirm");

        foreach (var d in b.BookingDetails)
        {
            var room = await _context.Rooms
                .Where(r => r.RoomTypeId == d.RoomTypeId && r.BusinessStatus == "Available")
                .FirstOrDefaultAsync();

            if (room == null)
                return BadRequest("Không còn phòng trống");

            d.RoomId = room.Id;
            room.BusinessStatus = "Occupied";
        }

        b.Status = "Checked_in";
        b.CheckInTime = DateTime.UtcNow;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CHECKIN_BOOKING",
            actionLabel: "Check-in khách",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã thực hiện check-in cho khách {b.GuestName} ({b.BookingCode}).",
            entityType: "Booking",
            entityId: id,
            entityLabel: b.BookingCode,
            severity: "Success",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CHECKIN_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = "{\"status\": \"Confirmed\"}",
            NewValue  = "{\"status\": \"Checked_in\"}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(MapToResponse(b));
    }

    // ================= CHECK-OUT =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/check-out")]
    public async Task<IActionResult> CheckOut(int id)
    {
        var b = await _context.Bookings
            .Include(x => x.BookingDetails)
                .ThenInclude(d => d.Room)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null) return NotFound();

        if (b.Status != "Checked_in")
            return BadRequest("Chưa check-in");

        foreach (var d in b.BookingDetails)
        {
            if (d.Room != null)
            {
                d.Room.BusinessStatus = "Available";
                d.Room.CleaningStatus = "Dirty";
            }
        }

        b.Status = "Completed";
        b.CheckOutTime = DateTime.UtcNow;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CHECKOUT_BOOKING",
            actionLabel: "Check-out khách",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã thực hiện check-out cho khách {b.GuestName} ({b.BookingCode}).",
            entityType: "Booking",
            entityId: id,
            entityLabel: b.BookingCode,
            severity: "Success",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CHECKOUT_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = "{\"status\": \"Checked_in\"}",
            NewValue  = "{\"status\": \"Completed\"}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        // TODO: tạo Invoice ở đây nếu cần

        return Ok(MapToResponse(b));
    }
}
