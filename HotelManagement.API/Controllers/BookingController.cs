using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Constants;
using HotelManagement.API.Services;
using HotelManagement.Core.DTOs;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private static readonly string[] ReservationBlockingStatuses =
    [
        BookingStatuses.Pending,
        BookingStatuses.Confirmed,
        BookingStatuses.CheckedIn,
        BookingStatuses.CheckedOutPendingSettlement
    ];

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

    private static (DateTime CheckInDate, DateTime CheckOutDate) NormalizeStayDates(DateTime checkInDate, DateTime checkOutDate)
    {
        var normalizedCheckIn = checkInDate.Date;
        var normalizedCheckOut = checkOutDate.Date <= normalizedCheckIn
            ? normalizedCheckIn.AddDays(1)
            : checkOutDate.Date;

        return (normalizedCheckIn, normalizedCheckOut);
    }

    private static int CalculateNights(DateTime checkInDate, DateTime checkOutDate)
    {
        var (normalizedCheckIn, normalizedCheckOut) = NormalizeStayDates(checkInDate, checkOutDate);
        return Math.Max(1, (normalizedCheckOut - normalizedCheckIn).Days);
    }

    private static string BuildRoomLiveStatusLabel(Room room)
    {
        if (string.Equals(room.BusinessStatus, "Disabled", StringComparison.OrdinalIgnoreCase))
        {
            return "Bảo trì";
        }

        if (string.Equals(room.BusinessStatus, "Occupied", StringComparison.OrdinalIgnoreCase))
        {
            return "Đang có khách";
        }

        if (!string.Equals(room.CleaningStatus, "Clean", StringComparison.OrdinalIgnoreCase))
        {
            return "Đang dọn";
        }

        return "Sẵn sàng";
    }

    private static string BuildRoomBookingStatusLabel(Room room, bool hasReservationConflict)
    {
        if (string.Equals(room.BusinessStatus, "Disabled", StringComparison.OrdinalIgnoreCase))
        {
            return "Bảo trì";
        }

        if (hasReservationConflict)
        {
            return "Trùng lịch";
        }

        return "Có thể book";
    }

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
                Label = string.Equals(booking.Status, BookingStatuses.Completed, StringComparison.OrdinalIgnoreCase)
                    ? "Khách đã check-out và hoàn tất quyết toán"
                    : "Khách đã check-out, chờ quyết toán",
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

    private IActionResult BookingActionError(int statusCode, string message, object? extra = null)
    {
        return StatusCode(statusCode, new
        {
            success = false,
            message,
            errors = new[] { message },
            data = extra
        });
    }

    private async Task<string> GenerateBookingCodeAsync(CancellationToken cancellationToken = default)
    {
        var baseCode = DateTime.Now.ToString("yyyyMMddHHmmss");
        var generatedCode = baseCode;
        var suffix = 0;

        while (await _context.Bookings.AnyAsync(b => b.BookingCode == generatedCode, cancellationToken))
        {
            suffix += 1;
            generatedCode = $"{baseCode}{suffix:00}";
        }

        return generatedCode;
    }

    private async Task RecalculateBookingTotalsAsync(Booking booking, CancellationToken cancellationToken = default)
    {
        await _context.Entry(booking)
            .Collection(b => b.BookingDetails)
            .LoadAsync(cancellationToken);

        var subtotal = booking.BookingDetails.Sum(d => CalculateNights(d.CheckInDate, d.CheckOutDate) * d.PricePerNight);
        var finalTotal = subtotal;

        if (booking.VoucherId.HasValue)
        {
            var voucher = await _context.Vouchers.FirstOrDefaultAsync(v => v.Id == booking.VoucherId.Value, cancellationToken);
            if (voucher != null && _voucherValidationService.ValidateUsage(voucher, subtotal, DateTime.Now, out _))
            {
                finalTotal -= _voucherValidationService.CalculateDiscount(voucher, subtotal);
            }
        }

        booking.TotalEstimatedAmount = Math.Max(0m, finalTotal);
        booking.DepositAmount = booking.TotalEstimatedAmount * 0.3m;
    }

    private async Task<int> CountBookedRoomsAsync(int roomTypeId, DateTime checkInDate, DateTime checkOutDate, int? excludeBookingId = null, CancellationToken cancellationToken = default)
    {
        var (normalizedCheckIn, normalizedCheckOut) = NormalizeStayDates(checkInDate, checkOutDate);

        return await _context.BookingDetails
            .AsNoTracking()
            .Where(bd => bd.RoomTypeId == roomTypeId
                && bd.BookingId != null
                && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                && (!excludeBookingId.HasValue || bd.BookingId != excludeBookingId.Value)
                && !(bd.CheckOutDate <= normalizedCheckIn || bd.CheckInDate >= normalizedCheckOut))
            .CountAsync(cancellationToken);
    }

    private async Task<int> CountTotalRoomsByTypeAsync(int roomTypeId, CancellationToken cancellationToken = default)
    {
        return await _context.Rooms
            .AsNoTracking()
            .Where(r => r.RoomTypeId == roomTypeId && r.BusinessStatus != "Disabled")
            .CountAsync(cancellationToken);
    }

    private async Task<bool> HasCapacityForDetailAsync(int roomTypeId, DateTime checkInDate, DateTime checkOutDate, int? excludeBookingId = null, CancellationToken cancellationToken = default)
    {
        var totalRooms = await CountTotalRoomsByTypeAsync(roomTypeId, cancellationToken);
        if (totalRooms <= 0)
        {
            return false;
        }

        var bookedRooms = await CountBookedRoomsAsync(roomTypeId, checkInDate, checkOutDate, excludeBookingId, cancellationToken);
        return bookedRooms < totalRooms;
    }

    private async Task<Room?> FindAvailableRoomAsync(BookingDetail detail, int? requestedRoomId = null, CancellationToken cancellationToken = default)
    {
        var (normalizedCheckIn, normalizedCheckOut) = NormalizeStayDates(detail.CheckInDate, detail.CheckOutDate);

        var roomQuery = _context.Rooms
            .Include(r => r.RoomType)
            .Where(r => r.RoomTypeId == detail.RoomTypeId && r.BusinessStatus == "Available" && r.CleaningStatus == "Clean");

        if (requestedRoomId.HasValue)
        {
            roomQuery = roomQuery.Where(r => r.Id == requestedRoomId.Value);
        }

        var candidateRooms = await roomQuery
            .OrderBy(r => r.RoomNumber)
            .ToListAsync(cancellationToken);

        foreach (var room in candidateRooms)
        {
            var hasConflict = await _context.BookingDetails
                .AsNoTracking()
                .AnyAsync(bd => bd.Id != detail.Id
                    && bd.RoomId == room.Id
                    && bd.BookingId != null
                    && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                    && !(bd.CheckOutDate <= normalizedCheckIn || bd.CheckInDate >= normalizedCheckOut), cancellationToken);

            if (!hasConflict)
            {
                return room;
            }
        }

        return null;
    }

    private async Task<List<object>> BuildAlternativeRoomSuggestionsAsync(Booking booking, BookingDetail detail, DateTime newCheckOutDate, CancellationToken cancellationToken = default)
    {
        var extensionStartDate = detail.CheckOutDate.Date;
        var extensionEndDate = newCheckOutDate.Date <= extensionStartDate
            ? extensionStartDate.AddDays(1)
            : newCheckOutDate.Date;
        var roomTypes = await _context.RoomTypes
            .AsNoTracking()
            .Where(rt => rt.IsActive && rt.CapacityAdults >= booking.NumAdults && rt.CapacityChildren >= booking.NumChildren)
            .OrderBy(rt => rt.Id == detail.RoomTypeId ? 0 : 1)
            .ThenBy(rt => rt.BasePrice)
            .ToListAsync(cancellationToken);

        var suggestions = new List<object>();

        foreach (var roomType in roomTypes)
        {
            var candidateRooms = await _context.Rooms
                .AsNoTracking()
                .Where(r => r.RoomTypeId == roomType.Id && r.BusinessStatus != "Disabled")
                .OrderBy(r => r.RoomNumber)
                .ToListAsync(cancellationToken);

            foreach (var room in candidateRooms)
            {
                var hasConflict = await _context.BookingDetails
                    .AsNoTracking()
                    .AnyAsync(bd => bd.Id != detail.Id
                        && bd.RoomId == room.Id
                        && bd.BookingId != null
                        && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                        && !(bd.CheckOutDate <= extensionStartDate || bd.CheckInDate >= extensionEndDate), cancellationToken);

                if (!hasConflict)
                {
                    suggestions.Add(new
                    {
                        room.Id,
                        room.RoomNumber,
                        room.Floor,
                        RoomTypeId = roomType.Id,
                        RoomTypeName = roomType.Name,
                        roomType.BasePrice,
                        SameRoomType = roomType.Id == detail.RoomTypeId,
                        ExtensionStartDate = extensionStartDate,
                        NewCheckOutDate = extensionEndDate
                    });
                }
            }

            if (suggestions.Count >= 6)
            {
                break;
            }
        }

        return suggestions;
    }

    private async Task ApplyCheckInToDetailAsync(Booking booking, BookingDetail detail, int? requestedRoomId, CancellationToken cancellationToken = default)
    {
        if (detail.RoomTypeId == null)
        {
            throw new InvalidOperationException("Booking detail chưa có loại phòng.");
        }

        if (detail.RoomId.HasValue)
        {
            var assignedRoom = await _context.Rooms.FirstOrDefaultAsync(r => r.Id == detail.RoomId.Value, cancellationToken);
            if (assignedRoom != null)
            {
                assignedRoom.BusinessStatus = "Occupied";
                detail.Room = assignedRoom;
            }
        }
        else
        {
            var room = await FindAvailableRoomAsync(detail, requestedRoomId, cancellationToken);
            if (room == null)
            {
                throw new InvalidOperationException(requestedRoomId.HasValue
                    ? "Phòng được chọn không còn khả dụng cho booking detail này."
                    : "Không còn phòng trống sạch phù hợp cho loại phòng này.");
            }

            detail.RoomId = room.Id;
            detail.Room = room;
            room.BusinessStatus = "Occupied";
        }

        booking.Status = BookingStatuses.CheckedIn;
        booking.CheckInTime ??= DateTime.UtcNow;
    }

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

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet("receptionist/dashboard")]
    public async Task<IActionResult> GetReceptionDashboard([FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? DateTime.Today).Date;

        var bookings = await _context.Bookings
            .AsNoTracking()
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .Where(b => b.Status != BookingStatuses.Cancelled)
            .OrderByDescending(b => b.Id)
            .ToListAsync();

        var arrivals = bookings
            .Where(b => (b.Status == BookingStatuses.Pending || b.Status == BookingStatuses.Confirmed)
                && b.BookingDetails.Any(d => d.CheckInDate.Date == targetDate))
            .ToList();

        var staying = bookings
            .Where(b => b.Status == BookingStatuses.CheckedIn)
            .ToList();

        var pendingCheckouts = bookings
            .Where(b => b.Status == BookingStatuses.CheckedIn
                && b.BookingDetails.Any(d => d.CheckOutDate.Date <= targetDate))
            .ToList();

        var response = new ReceptionDashboardResponse
        {
            Date = targetDate,
            TodayArrivals = arrivals.Select(MapToResponse).ToList(),
            StayingGuests = staying.Select(MapToResponse).ToList(),
            PendingCheckouts = pendingCheckouts.Select(MapToResponse).ToList(),
            Summary = new
            {
                arrivals = arrivals.Count,
                staying = staying.Count,
                pendingCheckouts = pendingCheckouts.Count
            }
        };

        return Ok(new
        {
            success = true,
            message = "Lấy dữ liệu lễ tân thành công.",
            data = response
        });
    }

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet("receptionist/member-suggestions")]
    public async Task<IActionResult> GetReceptionMemberSuggestions([FromQuery] string? keyword = null)
    {
        var query = _context.Users
            .AsNoTracking()
            .Where(u => (u.MembershipId != null || u.LoyaltyPoints > 0 || u.LoyaltyPointsUsable > 0) && u.Status == true);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var normalizedKeyword = keyword.Trim().ToLower();
            query = query.Where(u =>
                (u.FullName != null && u.FullName.ToLower().Contains(normalizedKeyword)) ||
                (u.Email != null && u.Email.ToLower().Contains(normalizedKeyword)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(normalizedKeyword)));
        }

        var data = await query
            .OrderBy(u => u.FullName)
            .Take(8)
            .Select(u => new
            {
                u.Id,
                FullName = u.FullName,
                u.Phone,
                u.Email,
                MembershipTier = u.Membership != null ? u.Membership.TierName : null,
                u.LoyaltyPointsUsable
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            message = "Lấy danh sách gợi ý khách thành viên thành công.",
            data
        });
    }

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet("receptionist/availability")]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] DateTime checkInDate,
        [FromQuery] DateTime checkOutDate,
        [FromQuery] int numAdults,
        [FromQuery] int numChildren)
    {
        var (normalizedCheckIn, normalizedCheckOut) = NormalizeStayDates(checkInDate, checkOutDate);

        var roomTypes = await _context.RoomTypes
            .AsNoTracking()
            .Where(rt => rt.IsActive && rt.CapacityAdults >= numAdults && rt.CapacityChildren >= numChildren)
            .OrderBy(rt => rt.BasePrice)
            .ToListAsync();

        var result = new List<object>();

        foreach (var roomType in roomTypes)
        {
            var rooms = await _context.Rooms
                .AsNoTracking()
                .Where(r => r.RoomTypeId == roomType.Id)
                .OrderBy(r => r.RoomNumber)
                .ToListAsync();

            var roomItems = new List<object>();
            var availableRooms = 0;

            foreach (var room in rooms)
            {
                var hasReservationConflict = await _context.BookingDetails
                    .AsNoTracking()
                    .AnyAsync(bd => bd.RoomId == room.Id
                        && bd.BookingId != null
                        && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                        && !(bd.CheckOutDate <= normalizedCheckIn || bd.CheckInDate >= normalizedCheckOut));

                var liveStatusLabel = BuildRoomLiveStatusLabel(room);
                var bookingStatusLabel = BuildRoomBookingStatusLabel(room, hasReservationConflict);
                var selectable = !string.Equals(room.BusinessStatus, "Disabled", StringComparison.OrdinalIgnoreCase) && !hasReservationConflict;

                if (selectable)
                {
                    availableRooms += 1;
                }

                roomItems.Add(new
                {
                    room.Id,
                    room.RoomNumber,
                    room.Floor,
                    room.BusinessStatus,
                    room.CleaningStatus,
                    LiveStatusLabel = liveStatusLabel,
                    BookingStatusLabel = bookingStatusLabel,
                    Selectable = selectable
                });
            }

            result.Add(new
            {
                roomType.Id,
                roomType.Name,
                roomType.BasePrice,
                roomType.CapacityAdults,
                roomType.CapacityChildren,
                roomType.BedType,
                roomType.AreaSqm,
                roomType.ViewType,
                AvailableRooms = availableRooms,
                SuggestedTotal = CalculateNights(normalizedCheckIn, normalizedCheckOut) * roomType.BasePrice,
                Rooms = roomItems
            });
        }

        return Ok(new
        {
            success = true,
            message = "Lấy danh sách phòng phù hợp thành công.",
            data = result,
            meta = new
            {
                checkInDate = normalizedCheckIn,
                checkOutDate = normalizedCheckOut,
                numAdults,
                numChildren
            }
        });
    }

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

    [AllowAnonymous]
    [HttpPost]
    public async Task<IActionResult> Create(CreateBookingRequest request)
    {
        var locks = new List<string>();

        try
        {
            foreach (var d in request.Details)
            {
                var normalized = NormalizeStayDates(d.CheckInDate, d.CheckOutDate);
                d.CheckInDate = normalized.CheckInDate;
                d.CheckOutDate = normalized.CheckOutDate;
            }

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
            }

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
                BookingCode = await GenerateBookingCodeAsync()
            };

            var roomTypeIds = request.Details.Select(d => d.RoomTypeId).Distinct().ToList();
            var roomTypesDict = await _context.RoomTypes
                .Where(rt => roomTypeIds.Contains(rt.Id))
                .ToDictionaryAsync(rt => rt.Id);
            var voucher = request.VoucherId.HasValue
                ? await _context.Vouchers.FindAsync(request.VoucherId.Value)
                : null;

            decimal subtotal = 0m;

            foreach (var d in request.Details)
            {
                if (!roomTypesDict.TryGetValue(d.RoomTypeId, out var rt))
                    return BookingActionError(StatusCodes.Status400BadRequest, $"Loại phòng #{d.RoomTypeId} không tồn tại.");

                if (d.RoomId.HasValue)
                {
                    var selectedRoom = await _context.Rooms
                        .AsNoTracking()
                        .FirstOrDefaultAsync(r => r.Id == d.RoomId.Value);

                    if (selectedRoom == null || selectedRoom.RoomTypeId != d.RoomTypeId)
                        return BookingActionError(StatusCodes.Status400BadRequest, "Phòng được chọn không thuộc hạng phòng đã chọn.");

                    var hasReservationConflict = await _context.BookingDetails
                        .AsNoTracking()
                        .AnyAsync(bd => bd.RoomId == d.RoomId.Value
                            && bd.BookingId != null
                            && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                            && !(bd.CheckOutDate <= d.CheckInDate || bd.CheckInDate >= d.CheckOutDate));

                    var selectable = !string.Equals(selectedRoom.BusinessStatus, "Disabled", StringComparison.OrdinalIgnoreCase)
                        && !hasReservationConflict;

                    if (!selectable)
                        return BookingActionError(StatusCodes.Status400BadRequest, $"Phòng {selectedRoom.RoomNumber} không khả dụng trong khoảng ngày đã chọn.");
                }
                else if (!await HasCapacityForDetailAsync(d.RoomTypeId, d.CheckInDate, d.CheckOutDate))
                {
                    return BookingActionError(StatusCodes.Status400BadRequest, "Không còn đủ số lượng phòng trống cho loại phòng này trong khoảng thời gian đã chọn.");
                }

                var nights = CalculateNights(d.CheckInDate, d.CheckOutDate);
                subtotal += nights * rt.BasePrice;

                booking.BookingDetails.Add(new BookingDetail
                {
                    RoomTypeId = d.RoomTypeId,
                    RoomId = d.RoomId,
                    CheckInDate = d.CheckInDate,
                    CheckOutDate = d.CheckOutDate,
                    PricePerNight = rt.BasePrice
                });
            }

            if (request.VoucherId.HasValue)
            {
                if (voucher == null)
                    return BookingActionError(StatusCodes.Status400BadRequest, "Voucher không hợp lệ.");

                if (voucher.ApplicableRoomTypeId.HasValue
                    && !request.Details.Any(d => d.RoomTypeId == voucher.ApplicableRoomTypeId.Value))
                {
                    return BookingActionError(StatusCodes.Status400BadRequest, "Voucher này không áp dụng cho hạng phòng đã chọn.");
                }

                if (!_voucherValidationService.ValidateUsage(voucher, subtotal, DateTime.Now, out var voucherError))
                    return BookingActionError(StatusCodes.Status400BadRequest, voucherError);

                var discount = _voucherValidationService.CalculateDiscount(voucher, subtotal);
                booking.VoucherId = voucher.Id;
                booking.TotalEstimatedAmount = subtotal - discount;
                voucher.UsedCount += 1;
            }
            else
            {
                booking.TotalEstimatedAmount = subtotal;
            }

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

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPost("{id}/details")]
    public async Task<IActionResult> AddRoomToBooking(int id, AddBookingDetailRequest request, CancellationToken cancellationToken)
    {
        var booking = await _context.Bookings
            .Include(b => b.BookingDetails)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (booking.Status is BookingStatuses.Completed or BookingStatuses.Cancelled or BookingStatuses.CheckedOutPendingSettlement)
            return BookingActionError(StatusCodes.Status400BadRequest, "Booking hiện tại không thể thêm phòng mới.");

        var roomType = await _context.RoomTypes.FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId && rt.IsActive, cancellationToken);
        if (roomType == null)
            return BookingActionError(StatusCodes.Status400BadRequest, $"Loại phòng #{request.RoomTypeId} không tồn tại hoặc đã ngưng hoạt động.");

        var normalized = NormalizeStayDates(request.CheckInDate, request.CheckOutDate);
        if (!await HasCapacityForDetailAsync(request.RoomTypeId, normalized.CheckInDate, normalized.CheckOutDate, booking.Id, cancellationToken))
            return BookingActionError(StatusCodes.Status400BadRequest, "Không còn đủ số lượng phòng trống để thêm vào booking này.");

        booking.BookingDetails.Add(new BookingDetail
        {
            RoomTypeId = request.RoomTypeId,
            CheckInDate = normalized.CheckInDate,
            CheckOutDate = normalized.CheckOutDate,
            PricePerNight = roomType.BasePrice,
            Note = request.Note
        });

        await RecalculateBookingTotalsAsync(booking, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "ADD_BOOKING_ROOM",
            ActionLabel = "Thêm phòng vào booking",
            Message = $"Đã thêm phòng loại {roomType.Name} vào booking {booking.BookingCode}.",
            EntityType = "Booking",
            EntityId = booking.Id,
            EntityLabel = booking.BookingCode,
            Severity = "Success",
            TableName = "Booking_Details",
            RecordId = booking.BookingDetails.OrderByDescending(x => x.Id).First().Id,
            OldValue = null,
            NewValue = $"{{\"roomTypeId\": {roomType.Id}, \"checkInDate\": \"{normalized.CheckInDate:O}\", \"checkOutDate\": \"{normalized.CheckOutDate:O}\"}}"
        });

        return BookingActionSuccess("Đã thêm phòng vào booking thành công.", booking);
    }

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

        var toEmail = b.GuestEmail ?? b.User?.Email;
        if (!string.IsNullOrEmpty(toEmail))
        {
            var detail = b.BookingDetails.FirstOrDefault();
            _ = _email.SendBookingConfirmationAsync(
                toEmail,
                b.GuestName ?? b.User?.FullName ?? "Quý khách",
                b.BookingCode,
                detail?.CheckInDate ?? DateTime.Now,
                detail?.CheckOutDate ?? DateTime.Now.AddDays(1),
                b.TotalEstimatedAmount
            );
        }

        await _context.SaveChangesAsync();
        return BookingActionSuccess("Xác nhận booking thành công.", b);
    }

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

        await _context.SaveChangesAsync();
        return BookingActionSuccess("Hủy booking thành công.", b);
    }

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/check-in-room")]
    public async Task<IActionResult> CheckInRoom(int id, CheckInBookingDetailRequest request, CancellationToken cancellationToken)
    {
        var booking = await _context.Bookings
            .Include(x => x.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(x => x.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (booking.Status != BookingStatuses.Confirmed && booking.Status != BookingStatuses.CheckedIn)
            return BookingActionError(StatusCodes.Status400BadRequest, "Chỉ booking đã xác nhận hoặc đang lưu trú mới được check-in theo phòng.");

        var detail = booking.BookingDetails.FirstOrDefault(d => d.Id == request.BookingDetailId);
        if (detail == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking detail #{request.BookingDetailId}.");

        try
        {
            await ApplyCheckInToDetailAsync(booking, detail, request.RoomId, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return BookingActionError(StatusCodes.Status400BadRequest, ex.Message);
        }

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHECKIN_BOOKING_DETAIL",
            ActionLabel = "Check-in từng phòng",
            Message = $"Đã check-in booking detail #{detail.Id} cho booking {booking.BookingCode}.",
            EntityType = "Booking",
            EntityId = booking.Id,
            EntityLabel = booking.BookingCode,
            Severity = "Success",
            TableName = "Booking_Details",
            RecordId = detail.Id,
            OldValue = null,
            NewValue = $"{{\"roomId\": {detail.RoomId?.ToString() ?? "null"}, \"status\": \"{booking.Status}\"}}"
        });

        return BookingActionSuccess("Check-in từng phòng thành công.", booking);
    }

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/check-in-bulk")]
    public async Task<IActionResult> CheckInBulk(int id, BulkCheckInBookingRequest? request, CancellationToken cancellationToken)
    {
        var booking = await _context.Bookings
            .Include(x => x.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(x => x.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (booking.Status != BookingStatuses.Confirmed && booking.Status != BookingStatuses.CheckedIn)
            return BookingActionError(StatusCodes.Status400BadRequest, "Chỉ booking đã xác nhận hoặc đang lưu trú mới được check-in hàng loạt.");

        var requestedDetails = request?.Details ?? [];
        var detailsToCheckIn = requestedDetails.Count > 0
            ? booking.BookingDetails.Where(d => requestedDetails.Any(x => x.BookingDetailId == d.Id)).ToList()
            : booking.BookingDetails.ToList();

        if (detailsToCheckIn.Count == 0)
            return BookingActionError(StatusCodes.Status400BadRequest, "Không có booking detail nào để check-in.");

        foreach (var detail in detailsToCheckIn)
        {
            var itemRequest = requestedDetails.FirstOrDefault(x => x.BookingDetailId == detail.Id);
            try
            {
                await ApplyCheckInToDetailAsync(booking, detail, itemRequest?.RoomId, cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                return BookingActionError(StatusCodes.Status400BadRequest, ex.Message);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHECKIN_BOOKING_BULK",
            ActionLabel = "Check-in hàng loạt",
            Message = $"Đã check-in {detailsToCheckIn.Count} phòng cho booking {booking.BookingCode}.",
            EntityType = "Booking",
            EntityId = booking.Id,
            EntityLabel = booking.BookingCode,
            Severity = "Success",
            TableName = "Bookings",
            RecordId = booking.Id,
            OldValue = null,
            NewValue = $"{{\"checkedInCount\": {detailsToCheckIn.Count}, \"status\": \"{booking.Status}\"}}"
        });

        return BookingActionSuccess("Check-in hàng loạt thành công.", booking);
    }

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/check-in")]
    public async Task<IActionResult> CheckIn(int id, CancellationToken cancellationToken)
        => await CheckInBulk(id, null, cancellationToken);

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/extend-stay")]
    public async Task<IActionResult> ExtendStay(int id, ExtendStayRequest request, CancellationToken cancellationToken)
    {
        var booking = await _context.Bookings
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (booking.Status != BookingStatuses.Confirmed && booking.Status != BookingStatuses.CheckedIn)
            return BookingActionError(StatusCodes.Status400BadRequest, "Chỉ booking đã xác nhận hoặc đang lưu trú mới được ở thêm ngày.");

        var detail = booking.BookingDetails.FirstOrDefault(d => d.Id == request.BookingDetailId);
        if (detail == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking detail #{request.BookingDetailId}.");

        var oldCheckOutDate = detail.CheckOutDate;
        var (_, normalizedNewCheckOut) = NormalizeStayDates(detail.CheckInDate, request.NewCheckOutDate);

        if (normalizedNewCheckOut <= detail.CheckOutDate.Date)
            return BookingActionError(StatusCodes.Status400BadRequest, "Ngày check-out mới phải lớn hơn ngày check-out hiện tại để ở thêm ngày.");

        if (detail.RoomId.HasValue)
        {
            var roomConflict = await _context.BookingDetails
                .AsNoTracking()
                .AnyAsync(bd => bd.Id != detail.Id
                    && bd.RoomId == detail.RoomId
                    && bd.BookingId != null
                    && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                    && !(bd.CheckOutDate <= detail.CheckOutDate.Date || bd.CheckInDate >= normalizedNewCheckOut), cancellationToken);

            if (!roomConflict)
            {
                detail.CheckOutDate = normalizedNewCheckOut;
                await RecalculateBookingTotalsAsync(booking, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);

                return BookingActionSuccess("Đã cập nhật ở thêm ngày cho booking thành công.", booking);
            }
        }
        else if (await HasCapacityForDetailAsync(detail.RoomTypeId ?? 0, detail.CheckInDate, normalizedNewCheckOut, booking.Id, cancellationToken))
        {
            detail.CheckOutDate = normalizedNewCheckOut;
            await RecalculateBookingTotalsAsync(booking, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return BookingActionSuccess("Đã cập nhật ở thêm ngày cho booking thành công.", booking);
        }

        if (request.TargetRoomId.HasValue)
        {
            var targetRoom = await _context.Rooms
                .Include(r => r.RoomType)
                .FirstOrDefaultAsync(r => r.Id == request.TargetRoomId.Value, cancellationToken);

            if (targetRoom == null || string.Equals(targetRoom.BusinessStatus, "Disabled", StringComparison.OrdinalIgnoreCase))
                return BookingActionError(StatusCodes.Status400BadRequest, "Phòng thay thế không khả dụng.");

            var targetConflict = await _context.BookingDetails
                .AsNoTracking()
                .AnyAsync(bd => bd.Id != detail.Id
                    && bd.RoomId == targetRoom.Id
                    && bd.BookingId != null
                    && ReservationBlockingStatuses.Contains(bd.Booking!.Status!)
                    && !(bd.CheckOutDate <= detail.CheckOutDate.Date || bd.CheckInDate >= normalizedNewCheckOut), cancellationToken);

            if (targetConflict)
                return BookingActionError(StatusCodes.Status400BadRequest, "Phòng thay thế đã có booking trong khoảng thời gian ở thêm.");

            var transferStartDate = detail.CheckOutDate.Date;
            var transferNote = string.IsNullOrWhiteSpace(detail.Note)
                ? $"Chuyển phòng để ở thêm từ phòng #{detail.RoomId?.ToString() ?? "N/A"}"
                : $"{detail.Note} | Chuyển phòng để ở thêm từ phòng #{detail.RoomId?.ToString() ?? "N/A"}";

            booking.BookingDetails.Add(new BookingDetail
            {
                RoomTypeId = targetRoom.RoomTypeId,
                RoomId = targetRoom.Id,
                CheckInDate = transferStartDate,
                CheckOutDate = normalizedNewCheckOut,
                PricePerNight = targetRoom.RoomType?.BasePrice ?? detail.PricePerNight,
                Note = transferNote
            });

            await RecalculateBookingTotalsAsync(booking, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return BookingActionSuccess("Đã thêm chặng phòng mới để ở thêm ngày thành công.", booking);
        }

        var suggestions = await BuildAlternativeRoomSuggestionsAsync(booking, detail, normalizedNewCheckOut, cancellationToken);
        return BookingActionError(
            StatusCodes.Status409Conflict,
            "Phòng hiện tại đã có booking khác trong khoảng thời gian ở thêm. Vui lòng chọn phòng thay thế.",
            new
            {
                bookingId = booking.Id,
                bookingCode = booking.BookingCode,
                bookingDetailId = detail.Id,
                currentRoomId = detail.RoomId,
                currentRoomTypeId = detail.RoomTypeId,
                oldCheckOutDate,
                newCheckOutDate = normalizedNewCheckOut,
                suggestions
            });
    }

    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPatch("{id}/early-checkout")]
    public async Task<IActionResult> EarlyCheckOut(int id, EarlyCheckOutRequest request, CancellationToken cancellationToken)
    {
        var booking = await _context.Bookings
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.Room)
            .Include(b => b.BookingDetails)
                .ThenInclude(d => d.RoomType)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (booking == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking #{id}.");

        if (booking.Status != BookingStatuses.Confirmed && booking.Status != BookingStatuses.CheckedIn)
            return BookingActionError(StatusCodes.Status400BadRequest, "Chỉ booking đã xác nhận hoặc đang lưu trú mới được out sớm.");

        var detail = booking.BookingDetails.FirstOrDefault(d => d.Id == request.BookingDetailId);
        if (detail == null)
            return BookingActionError(StatusCodes.Status404NotFound, $"Không tìm thấy booking detail #{request.BookingDetailId}.");

        var normalizedDate = request.NewCheckOutDate.Date <= detail.CheckInDate.Date
            ? detail.CheckInDate.Date.AddDays(1)
            : request.NewCheckOutDate.Date;

        if (normalizedDate > detail.CheckOutDate.Date)
            return BookingActionError(StatusCodes.Status400BadRequest, "Ngày check-out mới phải nhỏ hơn hoặc bằng ngày check-out hiện tại.");

        detail.CheckOutDate = normalizedDate;
        await RecalculateBookingTotalsAsync(booking, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "EARLY_CHECKOUT_ADJUSTMENT",
            ActionLabel = "Điều chỉnh out sớm",
            Message = $"Đã điều chỉnh ngày check-out sớm cho booking {booking.BookingCode}.",
            EntityType = "Booking",
            EntityId = booking.Id,
            EntityLabel = booking.BookingCode,
            Severity = "Warning",
            TableName = "Booking_Details",
            RecordId = detail.Id,
            OldValue = null,
            NewValue = $"{{\"bookingDetailId\": {detail.Id}, \"newCheckOutDate\": \"{normalizedDate:O}\"}}"
        });

        return BookingActionSuccess("Đã cập nhật out sớm và tính lại booking thành công.", booking);
    }

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

        if (!_statusFlowService.CanTransition(b.Status, BookingStatuses.CheckedOutPendingSettlement, out var checkOutError))
            return BookingActionError(StatusCodes.Status400BadRequest, checkOutError);

        foreach (var d in b.BookingDetails)
        {
            if (d.Room != null)
            {
                d.Room.BusinessStatus = "Available";
                d.Room.CleaningStatus = "Dirty";
            }
        }

        b.Status = BookingStatuses.CheckedOutPendingSettlement;
        b.CheckOutTime = DateTime.UtcNow;

        await _auditTrail.WriteAsync(_context, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHECKOUT_BOOKING",
            ActionLabel = "Check-out khách",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã thực hiện check-out cho khách {b.GuestName} ({b.BookingCode}) và chuyển booking sang trạng thái chờ quyết toán.",
            EntityType = "Booking",
            EntityId = id,
            EntityLabel = b.BookingCode,
            Severity = "Success",
            TableName = "Bookings",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"status\": \"{BookingStatuses.CheckedOutPendingSettlement}\"}}"
        });

        await _context.SaveChangesAsync();
        await _invoiceService.CreateFromBookingAsync(b.Id);

        return BookingActionSuccess("Check-out booking thành công. Booking đang chờ quyết toán hóa đơn.", b);
    }
}

