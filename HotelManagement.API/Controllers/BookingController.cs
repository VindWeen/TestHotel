using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Helpers;

namespace HotelManagement.API.Controllers;

#region DTOs
public class CreateBookingRequest
{
    public int? UserId { get; set; }
    public string GuestName { get; set; } = null!;
    public string GuestPhone { get; set; } = null!;
    public string GuestEmail { get; set; } = null!;
    public int NumAdults { get; set; }
    public int NumChildren { get; set; }
    public int? VoucherId { get; set; }
    public string? Source { get; set; }
    public string? Note { get; set; }
    public List<CreateBookingDetailRequest> Details { get; set; } = new();
}

public class CreateBookingDetailRequest
{
    public int RoomTypeId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
}

public class BookingDetailResponse
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public int? RoomId { get; set; }
    public int? RoomTypeId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public decimal PricePerNight { get; set; }
    public string? Note { get; set; }
    public string? RoomName { get; set; }
    public string? RoomTypeName { get; set; }
}

public class BookingResponse
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string? GuestEmail { get; set; }
    public int NumAdults { get; set; }
    public int NumChildren { get; set; }
    public string BookingCode { get; set; } = null!;
    public int? VoucherId { get; set; }
    public decimal TotalEstimatedAmount { get; set; }
    public decimal? DepositAmount { get; set; }
    public DateTime? CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }
    public string? Status { get; set; }
    public string Source { get; set; } = "online";
    public string? Note { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public List<BookingDetailResponse> BookingDetails { get; set; } = new();
}
#endregion

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer _redis;
    private readonly IEmailService _email;

    public BookingsController(AppDbContext context, IConnectionMultiplexer redis, IEmailService email)
    {
        _context = context;
        _redis = redis;
        _email = email;
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
            .Where(b => b.UserId == userId)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
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
            bool redisAvailable = true;
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
                redisAvailable = false;
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
                BookingCode = $"BK{DateTime.UtcNow:yyyyMMddHHmmss}"
            };

            decimal total = 0;

            foreach (var d in request.Details)
            {
                var rt = await _context.RoomTypes.FindAsync(d.RoomTypeId);
                if (rt == null) return BadRequest("RoomType không tồn tại");

                var nights = (d.CheckOutDate - d.CheckInDate).Days;
                if (nights <= 0) return BadRequest("Ngày check-out phải sau check-in");

                var amount = nights * rt.BasePrice;
                total += amount;

                booking.BookingDetails.Add(new BookingDetail
                {
                    RoomTypeId = d.RoomTypeId,
                    CheckInDate = d.CheckInDate,
                    CheckOutDate = d.CheckOutDate,
                    PricePerNight = rt.BasePrice
                });
            }

            // ===== APPLY VOUCHER =====
            if (request.VoucherId.HasValue)
            {
                var v = await _context.Vouchers.FindAsync(request.VoucherId.Value);

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
            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                UserId    = currentUserId,
                Action    = "CREATE_BOOKING",
                TableName = "Bookings",
                RecordId  = booking.Id,
                OldValue  = null,
                NewValue  = $"{{\"bookingCode\": \"{booking.BookingCode}\", \"total\": {booking.TotalEstimatedAmount}}}",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Request.Headers["User-Agent"].ToString(),
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

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
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CONFIRM_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = "{\"status\": \"Pending\"}",
            NewValue  = "{\"status\": \"Confirmed\"}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
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
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CANCEL_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = $"{{\"status\": \"{b.Status}\"}}",
            NewValue  = $"{{\"status\": \"Cancelled\", \"reason\": \"{reason}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
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
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CHECKIN_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = "{\"status\": \"Confirmed\"}",
            NewValue  = "{\"status\": \"Checked_in\"}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
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
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CHECKOUT_BOOKING",
            TableName = "Bookings",
            RecordId  = id,
            OldValue  = "{\"status\": \"Checked_in\"}",
            NewValue  = "{\"status\": \"Completed\"}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        // TODO: tạo Invoice ở đây nếu cần

        return Ok(MapToResponse(b));
    }
}