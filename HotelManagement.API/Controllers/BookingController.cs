using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Constants;
using HotelManagement.Core.Helpers;
using HotelManagement.API.Services;
using HotelManagement.Core.DTOs;

namespace HotelManagement.API.Controllers;
[ApiController]
[Route("api/[controller]")]
// [Route("api/Booking")]
public class BookingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConnectionMultiplexer _redis;
    private readonly IEmailService _email;
    private readonly IBookingService _bookingService;
    private readonly IBookingStatusFlowService _statusFlowService;
    private readonly IVoucherValidationService _voucherValidationService;
    private readonly IPaymentService _paymentService;
    private readonly IInvoiceService _invoiceService;
    private readonly IAuditTrailService _auditTrail;

    public BookingsController(
        AppDbContext context,
        IConnectionMultiplexer redis,
        IEmailService email,
        IBookingService bookingService,
        IBookingStatusFlowService statusFlowService,
        IVoucherValidationService voucherValidationService,
        IPaymentService paymentService,
        IInvoiceService invoiceService,
        IAuditTrailService auditTrail)
    {
        _context = context;
        _redis = redis;
        _email = email;
        _bookingService = bookingService;
        _statusFlowService = statusFlowService;
        _voucherValidationService = voucherValidationService;
        _paymentService = paymentService;
        _invoiceService = invoiceService;
        _auditTrail = auditTrail;
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

    private static IEnumerable<BookingTimelineEventResponse> BuildTimeline(Booking booking)
    {
        var createdAt = booking.BookingDetails
            .OrderBy(d => d.CheckInDate)
            .Select(d => (DateTime?)d.CheckInDate)
            .FirstOrDefault();

        var events = new List<BookingTimelineEventResponse>
        {
            new()
            {
                Type = "CREATED",
                Label = "Tạo booking",
                At = createdAt,
                Note = booking.Note
            }
        };

        if (booking.CheckInTime.HasValue)
        {
            events.Add(new BookingTimelineEventResponse
            {
                Type = "CHECKED_IN",
                Label = "Khách đã check-in",
                At = booking.CheckInTime
            });
        }

        if (booking.CheckOutTime.HasValue)
        {
            events.Add(new BookingTimelineEventResponse
            {
                Type = "CHECKED_OUT",
                Label = "Khách đã check-out",
                At = booking.CheckOutTime
            });
        }

        if (booking.CancelledAt.HasValue)
        {
            events.Add(new BookingTimelineEventResponse
            {
                Type = "CANCELLED",
                Label = "Booking đã bị hủy",
                At = booking.CancelledAt,
                Note = booking.CancellationReason
            });
        }

        return events
            .Where(e => e.At.HasValue)
            .OrderBy(e => e.At)
            .ToList();
    }

    private IActionResult BookingActionSuccess(string message, Booking booking)
    {
        return Ok(new
        {
            success = true,
            message,
            data = MapToResponse(booking),
            timeline = BuildTimeline(booking)
        });
    }

    private IActionResult BookingActionError(int statusCode, string message)
    {
        return StatusCode(statusCode, new
        {
            success = false,
            message,
            errors = new[] { message }
        });
    }

    // ================= GET ALL =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] ListQueryRequest queryRequest,
        [FromQuery] int? userId)
    {
        var payload = await _bookingService.GetAllAsync(queryRequest, userId);
        return Ok(new
        {
            success = true,
            message = "Lấy danh sách booking thành công.",
            data = payload
        });
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

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        return Ok(new
        {
            success = true,
            message = "Lấy thông tin booking thành công.",
            data = MapToResponse(booking)
        });
    }

    // ================= GET DETAIL (WITH TIMELINE) =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet("{id}/detail")]
    public async Task<IActionResult> GetDetail(int id)
    {
        var booking = await _context.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        return Ok(new
        {
            success = true,
            message = "Lấy chi tiết booking thành công.",
            data = MapToResponse(booking),
            timeline = BuildTimeline(booking)
        });
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

        return Ok(new
        {
            success = true,
            message = "Lấy danh sách booking của bạn thành công.",
            data = bookings.Select(MapToResponse)
        });
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
                        return BookingActionError(StatusCodes.Status400BadRequest, "Đang có người đặt cùng loại phòng, vui lòng thử lại.");
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
                    return BookingActionError(StatusCodes.Status400BadRequest, "Phòng đã bị đặt trong khoảng thời gian này.");
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
                Status = BookingStatuses.Pending,
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
                    return BookingActionError(StatusCodes.Status400BadRequest, $"Loại phòng #{d.RoomTypeId} không tồn tại.");

                var nights = (d.CheckOutDate - d.CheckInDate).Days;
                if (nights <= 0) return BookingActionError(StatusCodes.Status400BadRequest, "Ngày check-out phải sau check-in.");

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
                if (v == null)
                    return BookingActionError(StatusCodes.Status400BadRequest, "Voucher không hợp lệ.");

                if (!_voucherValidationService.ValidateUsage(v, total, DateTime.UtcNow, out var voucherError))
                    return BookingActionError(StatusCodes.Status400BadRequest, voucherError);

                var discount = _voucherValidationService.CalculateDiscount(v, total);

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
            _paymentService.EnsureValidAmount(booking.DepositAmount ?? 0);

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
            {
                ActionCode = "CREATE_BOOKING",
                ActionLabel = "Đặt phòng mới",
                Message = $"Khách hàng {booking.GuestName} đã đặt phòng thành công ({booking.BookingCode}). Tổng: {booking.TotalEstimatedAmount:N0}đ",
                EntityType = "Booking",
                EntityId = booking.Id,
                EntityLabel = booking.BookingCode,
                Severity = "Success",
                TableName = "Bookings",
                RecordId = booking.Id,
                OldValue = null,
                NewValue = $"{{\"bookingCode\": \"{booking.BookingCode}\", \"total\": {booking.TotalEstimatedAmount}}}"
            });

            return BookingActionSuccess("Tạo booking thành công.", booking);
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

        if (b == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (!_statusFlowService.CanTransition(b.Status, BookingStatuses.Confirmed, out var confirmError))
            return BookingActionError(StatusCodes.Status400BadRequest, confirmError);

        b.Status = BookingStatuses.Confirmed;

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CONFIRM_BOOKING",
            ActionLabel = "Xác nhận booking",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã xác nhận booking {b.BookingCode} cho khách {b.GuestName}.",
            EntityType = "Booking",
            EntityId = id,
            EntityLabel = b.BookingCode,
            Severity = "Success",
            TableName = "Bookings",
            RecordId = id,
            OldValue = $"{{\"status\": \"{BookingStatuses.Pending}\"}}",
            NewValue = $"{{\"status\": \"{BookingStatuses.Confirmed}\"}}"
        });
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

        return BookingActionSuccess("Xác nhận booking thành công.", b);
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

        if (b == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (!_statusFlowService.CanTransition(b.Status, BookingStatuses.Cancelled, out var cancelError))
            return BookingActionError(StatusCodes.Status400BadRequest, cancelError);

        b.Status = BookingStatuses.Cancelled;
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

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CANCEL_BOOKING",
            ActionLabel = "Hủy đặt phòng",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã hủy booking {b.BookingCode} của khách {b.GuestName}. Lý do: {reason}",
            EntityType = "Booking",
            EntityId = id,
            EntityLabel = b.BookingCode,
            Severity = "Warning",
            TableName = "Bookings",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"status\": \"{BookingStatuses.Cancelled}\", \"reason\": \"{reason}\"}}"
        });
        return BookingActionSuccess("Hủy booking thành công.", b);
    }

    // ================= CHECK-IN =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/check-in")]
    public async Task<IActionResult> CheckIn(int id)
    {
        var b = await _context.Bookings
            .Include(x => x.BookingDetails)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (!_statusFlowService.CanTransition(b.Status, BookingStatuses.CheckedIn, out var checkInError))
            return BookingActionError(StatusCodes.Status400BadRequest, checkInError);

        foreach (var d in b.BookingDetails)
        {
            var room = await _context.Rooms
                .Where(r => r.RoomTypeId == d.RoomTypeId && r.BusinessStatus == "Available")
                .FirstOrDefaultAsync();

            if (room == null)
                return BookingActionError(StatusCodes.Status400BadRequest, "Không còn phòng trống cho loại phòng này.");

            d.RoomId = room.Id;
            room.BusinessStatus = "Occupied";
        }

        b.Status = BookingStatuses.CheckedIn;
        b.CheckInTime = DateTime.UtcNow;

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHECKIN_BOOKING",
            ActionLabel = "Check-in khách",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã thực hiện check-in cho khách {b.GuestName} ({b.BookingCode}).",
            EntityType = "Booking",
            EntityId = id,
            EntityLabel = b.BookingCode,
            Severity = "Success",
            TableName = "Bookings",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"status\": \"{BookingStatuses.CheckedIn}\"}}"
        });
        return BookingActionSuccess("Check-in booking thành công.", b);
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

        if (b == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (!_statusFlowService.CanTransition(b.Status, BookingStatuses.Completed, out var checkOutError))
            return BookingActionError(StatusCodes.Status400BadRequest, checkOutError);

        foreach (var d in b.BookingDetails)
        {
            if (d.Room != null)
            {
                d.Room.BusinessStatus = "Available";
                d.Room.CleaningStatus = "Dirty";
            }
        }

        b.Status = BookingStatuses.Completed;
        b.CheckOutTime = DateTime.UtcNow;

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHECKOUT_BOOKING",
            ActionLabel = "Check-out khách",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã thực hiện check-out cho khách {b.GuestName} ({b.BookingCode}).",
            EntityType = "Booking",
            EntityId = id,
            EntityLabel = b.BookingCode,
            Severity = "Success",
            TableName = "Bookings",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"status\": \"{BookingStatuses.Completed}\"}}"
        });

        await _invoiceService.CreateFromBookingAsync(b.Id);

        return BookingActionSuccess("Check-out booking thành công.", b);
    }
}


