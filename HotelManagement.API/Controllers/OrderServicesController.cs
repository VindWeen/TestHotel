using HotelManagement.API.Services;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Constants;
using HotelManagement.Core.DTOs;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrderServicesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuditTrailService _auditTrail;

    public OrderServicesController(AppDbContext db, IAuditTrailService auditTrail)
    {
        _db = db;
        _auditTrail = auditTrail;
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetList(
        [FromQuery] ListQueryRequest queryRequest,
        [FromQuery] int? bookingDetailId = null,
        [FromQuery] int? bookingId = null,
        [FromQuery] bool includeInactive = false)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.OrderServices
            .AsNoTracking()
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.Booking)
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.Room)
            .AsQueryable();

        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        if (bookingDetailId.HasValue)
            query = query.Where(x => x.BookingDetailId == bookingDetailId.Value);

        if (bookingId.HasValue)
            query = query.Where(x => x.BookingDetail != null && x.BookingDetail.BookingId == bookingId.Value);

        if (!string.IsNullOrWhiteSpace(queryRequest.Status))
            query = query.Where(x => x.Status == queryRequest.Status);

        if (queryRequest.FromDate.HasValue)
            query = query.Where(x => x.OrderDate >= queryRequest.FromDate.Value);

        if (queryRequest.ToDate.HasValue)
            query = query.Where(x => x.OrderDate <= queryRequest.ToDate.Value);

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(x =>
                (x.Note != null && x.Note.ToLower().Contains(keyword)) ||
                (x.BookingDetail != null && x.BookingDetail.Booking != null && x.BookingDetail.Booking.BookingCode.ToLower().Contains(keyword)) ||
                (x.BookingDetail != null && x.BookingDetail.Booking != null && x.BookingDetail.Booking.GuestName.ToLower().Contains(keyword)) ||
                (x.BookingDetail != null && x.BookingDetail.Room != null && x.BookingDetail.Room.RoomNumber.ToLower().Contains(keyword)));
        }

        query = query.OrderByDescending(x => x.OrderDate ?? DateTime.MinValue).ThenByDescending(x => x.Id);

        var totalItems = await query.CountAsync();
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.BookingDetailId,
                BookingId = x.BookingDetail != null ? x.BookingDetail.BookingId : null,
                BookingCode = x.BookingDetail != null && x.BookingDetail.Booking != null ? x.BookingDetail.Booking.BookingCode : null,
                GuestName = x.BookingDetail != null && x.BookingDetail.Booking != null ? x.BookingDetail.Booking.GuestName : null,
                RoomNumber = x.BookingDetail != null && x.BookingDetail.Room != null ? x.BookingDetail.Room.RoomNumber : null,
                x.OrderDate,
                x.TotalAmount,
                x.Status,
                x.Note,
                x.CompletedAt,
                x.IsActive,
                ItemCount = x.OrderServiceDetails.Count
            })
            .ToListAsync();

        return Ok(new ApiListResponse<object>
        {
            Data = data,
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
                pendingItems = data.Count(x => string.Equals(x.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
                deliveredItems = data.Count(x => string.Equals(x.Status, "Delivered", StringComparison.OrdinalIgnoreCase)),
                cancelledItems = data.Count(x => string.Equals(x.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
            },
            Message = "Lấy danh sách đơn dịch vụ thành công."
        });
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetById(int id, [FromQuery] bool includeInactive = false)
    {
        var order = await _db.OrderServices
            .AsNoTracking()
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.Booking)
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.Room)
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.RoomType)
            .Include(x => x.OrderServiceDetails)
                .ThenInclude(d => d.Service)
            .Where(x => x.Id == id && (includeInactive || x.IsActive))
            .Select(x => new
            {
                x.Id,
                x.BookingDetailId,
                BookingId = x.BookingDetail != null ? x.BookingDetail.BookingId : null,
                BookingCode = x.BookingDetail != null && x.BookingDetail.Booking != null ? x.BookingDetail.Booking.BookingCode : null,
                GuestName = x.BookingDetail != null && x.BookingDetail.Booking != null ? x.BookingDetail.Booking.GuestName : null,
                RoomNumber = x.BookingDetail != null && x.BookingDetail.Room != null ? x.BookingDetail.Room.RoomNumber : null,
                RoomTypeName = x.BookingDetail != null && x.BookingDetail.RoomType != null ? x.BookingDetail.RoomType.Name : null,
                x.OrderDate,
                x.TotalAmount,
                x.Status,
                x.Note,
                x.CompletedAt,
                x.IsActive,
                Details = x.OrderServiceDetails
                    .OrderBy(d => d.Id)
                    .Select(d => new
                    {
                        d.Id,
                        d.ServiceId,
                        ServiceName = d.Service != null ? d.Service.Name : null,
                        d.Quantity,
                        d.UnitPrice,
                        LineTotal = d.Quantity * d.UnitPrice
                    })
            })
            .FirstOrDefaultAsync();

        if (order is null)
            return NotFound(new { message = $"Không tìm thấy đơn dịch vụ #{id}." });

        return Ok(order);
    }

    [HttpGet("by-booking-detail/{bookingDetailId:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetByBookingDetail(int bookingDetailId, [FromQuery] bool includeInactive = false)
    {
        var bookingDetailExists = await _db.BookingDetails.AnyAsync(x => x.Id == bookingDetailId);
        if (!bookingDetailExists)
            return NotFound(new { message = $"Không tìm thấy chi tiết booking #{bookingDetailId}." });

        var data = await _db.OrderServices
            .AsNoTracking()
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.Booking)
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.Room)
            .Include(x => x.BookingDetail)
                .ThenInclude(d => d!.RoomType)
            .Include(x => x.OrderServiceDetails)
                .ThenInclude(d => d.Service)
            .Where(x => x.BookingDetailId == bookingDetailId && (includeInactive || x.IsActive))
            .Select(x => new
            {
                x.Id,
                x.BookingDetailId,
                BookingId = x.BookingDetail != null ? x.BookingDetail.BookingId : null,
                BookingCode = x.BookingDetail != null && x.BookingDetail.Booking != null ? x.BookingDetail.Booking.BookingCode : null,
                GuestName = x.BookingDetail != null && x.BookingDetail.Booking != null ? x.BookingDetail.Booking.GuestName : null,
                RoomNumber = x.BookingDetail != null && x.BookingDetail.Room != null ? x.BookingDetail.Room.RoomNumber : null,
                RoomTypeName = x.BookingDetail != null && x.BookingDetail.RoomType != null ? x.BookingDetail.RoomType.Name : null,
                x.OrderDate,
                x.TotalAmount,
                x.Status,
                x.Note,
                x.CompletedAt,
                x.IsActive,
                Details = x.OrderServiceDetails
                    .OrderBy(d => d.Id)
                    .Select(d => new
                    {
                        d.Id,
                        d.ServiceId,
                        ServiceName = d.Service != null ? d.Service.Name : null,
                        d.Quantity,
                        d.UnitPrice,
                        LineTotal = d.Quantity * d.UnitPrice
                    })
            })
            .ToListAsync();

        return Ok(new { bookingDetailId, data, total = data.Count });
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> Create([FromBody] CreateOrderServiceRequest request)
    {
        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "Đơn dịch vụ phải có ít nhất 1 dòng dịch vụ." });

        var bookingDetail = await ValidateBookingDetailForOrderAsync(request.BookingDetailId);
        if (bookingDetail is null)
            return BadRequest(new { message = $"Không thể tạo đơn dịch vụ cho booking detail #{request.BookingDetailId}." });

        var serviceMapResult = await BuildOrderItemsAsync(request.Items);
        if (!serviceMapResult.Success)
            return BadRequest(new { message = serviceMapResult.ErrorMessage });

        var order = new OrderService
        {
            BookingDetailId = request.BookingDetailId,
            OrderDate = DateTime.UtcNow,
            Status = "Pending",
            Note = request.Note?.Trim(),
            TotalAmount = serviceMapResult.TotalAmount,
            IsActive = true,
            OrderServiceDetails = serviceMapResult.Items.Select(x => new OrderServiceDetail
            {
                ServiceId = x.Service.Id,
                Quantity = x.Quantity,
                UnitPrice = x.UnitPrice
            }).ToList()
        };

        _db.OrderServices.Add(order);
        await _db.SaveChangesAsync();

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CREATE_ORDER_SERVICE",
            ActionLabel = "Tạo đơn dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo đơn dịch vụ #{order.Id}.",
            EntityType = "OrderService",
            EntityId = order.Id,
            EntityLabel = $"OrderService #{order.Id}",
            Severity = "Success",
            TableName = "Order_Services",
            RecordId = order.Id,
            NewValue = $"{{\"bookingDetailId\":{order.BookingDetailId},\"totalAmount\":{order.TotalAmount},\"status\":\"{order.Status}\",\"isActive\":true}}"
        });

        return StatusCode(201, new { message = "Tạo đơn dịch vụ thành công.", data = new { order.Id, order.TotalAmount, order.Status, order.IsActive } });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateOrderServiceRequest request)
    {
        var order = await _db.OrderServices
            .Include(x => x.OrderServiceDetails)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (order is null)
            return NotFound(new { message = $"Không tìm thấy đơn dịch vụ #{id}." });

        if (!order.IsActive)
            return Conflict(new { message = "Không thể cập nhật đơn dịch vụ đã bị vô hiệu hóa." });

        if (!string.Equals(order.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Chỉ đơn dịch vụ đang ở trạng thái Pending mới được cập nhật." });

        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "Đơn dịch vụ phải có ít nhất 1 dòng dịch vụ." });

        var serviceMapResult = await BuildOrderItemsAsync(request.Items);
        if (!serviceMapResult.Success)
            return BadRequest(new { message = serviceMapResult.ErrorMessage });

        var oldValue = $"{{\"totalAmount\":{order.TotalAmount},\"status\":\"{order.Status}\",\"isActive\":{order.IsActive.ToString().ToLower()}}}";

        _db.OrderServiceDetails.RemoveRange(order.OrderServiceDetails);
        order.OrderServiceDetails = serviceMapResult.Items.Select(x => new OrderServiceDetail
        {
            OrderServiceId = order.Id,
            ServiceId = x.Service.Id,
            Quantity = x.Quantity,
            UnitPrice = x.UnitPrice
        }).ToList();
        order.Note = request.Note?.Trim();
        order.TotalAmount = serviceMapResult.TotalAmount;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_ORDER_SERVICE",
            ActionLabel = "Cập nhật đơn dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật đơn dịch vụ #{order.Id}.",
            EntityType = "OrderService",
            EntityId = order.Id,
            EntityLabel = $"OrderService #{order.Id}",
            Severity = "Info",
            TableName = "Order_Services",
            RecordId = order.Id,
            OldValue = oldValue,
            NewValue = $"{{\"totalAmount\":{order.TotalAmount},\"status\":\"{order.Status}\",\"isActive\":{order.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật đơn dịch vụ thành công.", data = new { order.Id, order.TotalAmount, order.Status, order.IsActive } });
    }

    [HttpPatch("{id:int}/status")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderServiceStatusRequest request)
    {
        var order = await _db.OrderServices.FirstOrDefaultAsync(x => x.Id == id);
        if (order is null)
            return NotFound(new { message = $"Không tìm thấy đơn dịch vụ #{id}." });

        if (!order.IsActive)
            return Conflict(new { message = "Không thể đổi trạng thái cho đơn dịch vụ đã bị vô hiệu hóa." });

        var nextStatus = request.Status?.Trim();
        if (string.IsNullOrWhiteSpace(nextStatus) || !new[] { "Pending", "Delivered", "Cancelled" }.Contains(nextStatus))
            return BadRequest(new { message = "Trạng thái đơn dịch vụ không hợp lệ." });

        if (string.Equals(order.Status, "Delivered", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(nextStatus, "Delivered", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Không thể chuyển ngược trạng thái của đơn dịch vụ đã giao." });

        var oldValue = $"{{\"status\":\"{order.Status}\",\"completedAt\":\"{order.CompletedAt:O}\"}}";
        order.Status = nextStatus;
        order.CompletedAt = string.Equals(nextStatus, "Delivered", StringComparison.OrdinalIgnoreCase)
            ? DateTime.UtcNow
            : order.CompletedAt;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHANGE_ORDER_SERVICE_STATUS",
            ActionLabel = "Cập nhật trạng thái đơn dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã chuyển trạng thái đơn dịch vụ #{order.Id} sang '{order.Status}'.",
            EntityType = "OrderService",
            EntityId = id,
            EntityLabel = $"OrderService #{order.Id}",
            Severity = "Info",
            TableName = "Order_Services",
            RecordId = id,
            OldValue = oldValue,
            NewValue = $"{{\"status\":\"{order.Status}\",\"completedAt\":\"{order.CompletedAt:O}\"}}"
        });

        return Ok(new { message = "Cập nhật trạng thái đơn dịch vụ thành công.", data = new { order.Id, order.Status, order.CompletedAt } });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> Delete(int id)
    {
        var order = await _db.OrderServices.FirstOrDefaultAsync(x => x.Id == id);
        if (order is null)
            return NotFound(new { message = $"Không tìm thấy đơn dịch vụ #{id}." });

        if (!order.IsActive)
            return BadRequest(new { message = "Đơn dịch vụ này đã bị vô hiệu hóa trước đó." });

        if (!string.Equals(order.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Chỉ đơn dịch vụ đang ở trạng thái Pending mới được xóa mềm." });

        order.IsActive = false;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "DELETE_ORDER_SERVICE_SOFT",
            ActionLabel = "Vô hiệu hóa đơn dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã vô hiệu hóa đơn dịch vụ #{order.Id}.",
            EntityType = "OrderService",
            EntityId = id,
            EntityLabel = $"OrderService #{order.Id}",
            Severity = "Warning",
            TableName = "Order_Services",
            RecordId = id,
            OldValue = "{\"isActive\":true}",
            NewValue = "{\"isActive\":false}"
        });

        return Ok(new { message = "Đã vô hiệu hóa đơn dịch vụ.", data = new { order.Id, order.IsActive } });
    }

    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var order = await _db.OrderServices.FirstOrDefaultAsync(x => x.Id == id);
        if (order is null)
            return NotFound(new { message = $"Không tìm thấy đơn dịch vụ #{id}." });

        var oldValue = order.IsActive;
        order.IsActive = !order.IsActive;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "TOGGLE_ORDER_SERVICE",
            ActionLabel = order.IsActive ? "Kích hoạt đơn dịch vụ" : "Vô hiệu hóa đơn dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã {(order.IsActive ? "kích hoạt" : "vô hiệu hóa")} đơn dịch vụ #{order.Id}.",
            EntityType = "OrderService",
            EntityId = id,
            EntityLabel = $"OrderService #{order.Id}",
            Severity = "Info",
            TableName = "Order_Services",
            RecordId = id,
            OldValue = $"{{\"isActive\":{oldValue.ToString().ToLower()}}}",
            NewValue = $"{{\"isActive\":{order.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật trạng thái đơn dịch vụ thành công.", data = new { order.Id, order.IsActive } });
    }

    private async Task<BookingDetail?> ValidateBookingDetailForOrderAsync(int bookingDetailId)
    {
        var bookingDetail = await _db.BookingDetails
            .Include(x => x.Booking)
            .FirstOrDefaultAsync(x => x.Id == bookingDetailId);

        if (bookingDetail?.Booking is null)
            return null;

        if (string.Equals(bookingDetail.Booking.Status, BookingStatuses.CheckedOutPendingSettlement, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(bookingDetail.Booking.Status, BookingStatuses.Completed, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(bookingDetail.Booking.Status, BookingStatuses.Cancelled, StringComparison.OrdinalIgnoreCase))
            return null;

        return bookingDetail;
    }

    private async Task<(bool Success, string? ErrorMessage, decimal TotalAmount, List<(Service Service, int Quantity, decimal UnitPrice)> Items)> BuildOrderItemsAsync(
        List<OrderServiceItemRequest> items)
    {
        var serviceIds = items.Select(x => x.ServiceId).Distinct().ToList();
        var services = await _db.Services
            .Where(x => serviceIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        var resultItems = new List<(Service Service, int Quantity, decimal UnitPrice)>();
        decimal total = 0m;

        foreach (var item in items)
        {
            if (item.Quantity <= 0)
                return (false, "Số lượng dịch vụ phải lớn hơn 0.", 0m, []);

            if (!services.TryGetValue(item.ServiceId, out var service))
                return (false, $"Dịch vụ #{item.ServiceId} không tồn tại.", 0m, []);

            if (!service.IsActive)
                return (false, $"Dịch vụ '{service.Name}' đang bị vô hiệu hóa.", 0m, []);

            if (service.CategoryId.HasValue)
            {
                var categoryActive = await _db.ServiceCategories
                    .Where(x => x.Id == service.CategoryId.Value)
                    .Select(x => (bool?)x.IsActive)
                    .FirstOrDefaultAsync();

                if (categoryActive == false)
                    return (false, $"Nhóm của dịch vụ '{service.Name}' đang bị vô hiệu hóa.", 0m, []);
            }

            var unitPrice = item.UnitPriceOverride ?? service.Price;
            if (unitPrice <= 0)
                return (false, $"Đơn giá của dịch vụ '{service.Name}' phải lớn hơn 0.", 0m, []);

            total += item.Quantity * unitPrice;
            resultItems.Add((service, item.Quantity, unitPrice));
        }

        return (true, null, total, resultItems);
    }
}
