using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _activityLog;

    public RoomsController(AppDbContext db, IActivityLogService activityLog)
    {
        _db = db;
        _activityLog = activityLog;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/Rooms  [MANAGE_ROOMS — nội bộ]
    // Danh sách phòng vật lý kèm room_type_name, business_status, cleaning_status.
    // Filter: floor, viewType, businessStatus, cleaningStatus, roomTypeId
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int?    floor           = null,
        [FromQuery] string? viewType        = null,
        [FromQuery] string? businessStatus  = null,
        [FromQuery] string? cleaningStatus  = null,
        [FromQuery] int?    roomTypeId      = null)
    {
        var query = _db.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .AsQueryable();

        if (floor.HasValue)
            query = query.Where(r => r.Floor == floor.Value);

        if (!string.IsNullOrWhiteSpace(viewType))
            query = query.Where(r => r.ViewType == viewType.Trim());

        if (!string.IsNullOrWhiteSpace(businessStatus))
            query = query.Where(r => r.BusinessStatus == businessStatus.Trim());

        if (!string.IsNullOrWhiteSpace(cleaningStatus))
            query = query.Where(r => r.CleaningStatus == cleaningStatus.Trim());

        if (roomTypeId.HasValue)
            query = query.Where(r => r.RoomTypeId == roomTypeId.Value);

        var rooms = await query
            .OrderBy(r => r.Floor)
            .ThenBy(r => r.RoomNumber)
            .Select(r => new
            {
                r.Id,
                r.RoomNumber,
                r.Floor,
                r.ViewType,
                r.BusinessStatus,
                r.CleaningStatus,
                r.RoomTypeId,
                roomTypeName = r.RoomType != null ? r.RoomType.Name : null
            })
            .ToListAsync();

        return Ok(new { data = rooms, total = rooms.Count });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/Rooms/{id}  [MANAGE_ROOMS — nội bộ]
    // Chi tiết 1 phòng kèm room_type_name, notes, inventory — FE load form sửa.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> GetById(int id)
    {
        var room = await _db.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .Include(r => r.RoomInventories.Where(i => i.IsActive))
            .Where(r => r.Id == id)
            .Select(r => new
            {
                r.Id,
                r.RoomNumber,
                r.Floor,
                r.ViewType,
                r.BusinessStatus,
                r.CleaningStatus,
                r.Notes,
                r.RoomTypeId,
                roomTypeName = r.RoomType != null ? r.RoomType.Name : null,
                inventory = r.RoomInventories.Select(i => new
                {
                    i.Id,
                    i.ItemName,
                    i.ItemType,
                    i.Quantity,
                    i.PriceIfLost
                })
            })
            .FirstOrDefaultAsync();

        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{id}." });

        return Ok(room);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/Rooms/{id}  [MANAGE_ROOMS]
    // Sửa thông tin phòng: floor, view_type, notes.
    // Không cho đổi room_number. Không cho đổi status ở đây.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoomRequest request)
    {
        var room = await _db.Rooms.FindAsync(id);

        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{id}." });

        room.Floor    = request.Floor;
        room.ViewType = request.ViewType?.Trim();
        room.Notes    = request.Notes?.Trim();

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "UPDATE_ROOM",
            TableName = "Rooms",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"floor\": {request.Floor?.ToString() ?? "null"}, \"viewType\": \"{request.ViewType}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var currentUserId2 = JwtHelper.GetUserId(User);
        await _activityLog.LogAsync(
            actionCode: "UPDATE_ROOM",
            actionLabel: "Cập nhật phòng",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật thông tin phòng {room.RoomNumber}.",
            entityType: "Room",
            entityId: id,
            entityLabel: room.RoomNumber,
            severity: "Info",
            userId: currentUserId2,
            roleName: User.FindFirst("role")?.Value
        );

        return Ok(new { message = "Cập nhật phòng thành công." });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/Rooms  [MANAGE_ROOMS]
    // Tạo 1 phòng mới. Validate room_number unique.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Create([FromBody] CreateRoomRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomNumber))
            return BadRequest(new { message = "Số phòng không được để trống." });

        var roomTypeExists = await _db.RoomTypes.AnyAsync(rt => rt.Id == request.RoomTypeId);
        if (!roomTypeExists)
            return BadRequest(new { message = $"RoomType #{request.RoomTypeId} không tồn tại." });

        var duplicate = await _db.Rooms.AnyAsync(r => r.RoomNumber == request.RoomNumber.Trim());
        if (duplicate)
            return Conflict(new { message = $"Số phòng '{request.RoomNumber}' đã tồn tại." });

        var room = new Room
        {
            RoomNumber      = request.RoomNumber.Trim(),
            Floor           = request.Floor,
            RoomTypeId      = request.RoomTypeId,
            ViewType        = request.ViewType?.Trim(),
            BusinessStatus  = "Available",
            CleaningStatus  = "Clean",
            Status          = "Available"
        };

        _db.Rooms.Add(room);
        // await _db.SaveChangesAsync(); // Removed this extra SaveChangesAsync

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CREATE_ROOM",
            actionLabel: "Tạo phòng mới",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo phòng mới: {room.RoomNumber}.",
            entityType: "Room",
            entityId: room.Id,
            entityLabel: room.RoomNumber,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value,
            metadata: $"{{\"roomNumber\": \"{room.RoomNumber}\", \"floor\": {room.Floor}, \"roomTypeId\": {room.RoomTypeId}, \"viewType\": \"{room.ViewType}\"}}"
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CREATE_ROOM",
            TableName = "Rooms",
            RecordId  = room.Id,
            OldValue  = null,
            NewValue  = $"{{\"roomNumber\": \"{room.RoomNumber}\", \"floor\": {room.Floor}, \"roomTypeId\": {room.RoomTypeId}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return StatusCode(201, new { message = "Tạo phòng thành công.", id = room.Id });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PATCH /api/Rooms/{id}/status  [MANAGE_ROOMS — Manager/Lễ tân]
    // Đổi business_status (Available / Occupied / Disabled). Ghi Audit_Log.
    // Housekeeping không có quyền này (cùng permission MANAGE_ROOMS, phân biệt
    // qua role nếu cần — hiện tại guard bằng MANAGE_ROOMS là đủ).
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/status")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> UpdateBusinessStatus(
        int id,
        [FromBody] UpdateBusinessStatusRequest request)
    {
        var allowed = new[] { "Available", "Occupied", "Disabled" };
        if (!allowed.Contains(request.BusinessStatus))
            return BadRequest(new { message = "business_status không hợp lệ. Chấp nhận: Available, Occupied, Disabled." });

        var room = await _db.Rooms.FindAsync(id);
        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{id}." });

        var oldValue = room.BusinessStatus;
        room.BusinessStatus = request.BusinessStatus;

        // Đồng bộ legacy status (tuỳ chọn giữ tương thích)
        room.Status = request.BusinessStatus;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "UPDATE_ROOM_STATUS",
            actionLabel: "Đổi trạng thái phòng",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã đổi trạng thái phòng {room.RoomNumber} sang '{request.BusinessStatus}'.",
            entityType: "Room",
            entityId: id,
            entityLabel: room.RoomNumber,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value,
            metadata: $"{{\"oldStatus\": \"{oldValue}\", \"newStatus\": \"{request.BusinessStatus}\"}}"
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_ROOM_STATUS",
            TableName = "Rooms",
            RecordId  = id,
            OldValue  = $"{{\"businessStatus\": \"{oldValue}\"}}",
            NewValue  = $"{{\"businessStatus\": \"{request.BusinessStatus}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Đã đổi trạng thái phòng #{id} thành '{request.BusinessStatus}'." });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PATCH /api/Rooms/{id}/cleaning-status  [MANAGE_ROOMS — Housekeeping]
    // Chỉ đổi cleaning_status (Clean / Dirty).
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/cleaning-status")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> UpdateCleaningStatus(
        int id,
        [FromBody] UpdateCleaningStatusRequest request)
    {
        var allowed = new[] { "Clean", "Dirty" };
        if (!allowed.Contains(request.CleaningStatus))
            return BadRequest(new { message = "cleaning_status không hợp lệ. Chấp nhận: Clean, Dirty." });

        var room = await _db.Rooms.FindAsync(id);
        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{id}." });

        var oldCleaningStatus = room.CleaningStatus;
        room.CleaningStatus = request.CleaningStatus;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "UPDATE_ROOM_CLEANING",
            actionLabel: "Đổi trạng thái vệ sinh",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã đổi trạng thái vệ sinh phòng {room.RoomNumber} thành '{request.CleaningStatus}'.",
            entityType: "Room",
            entityId: id,
            entityLabel: room.RoomNumber,
            severity: request.CleaningStatus == "Dirty" ? "Warning" : "Success",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value,
            metadata: $"{{\"oldStatus\": \"{oldCleaningStatus}\", \"newStatus\": \"{request.CleaningStatus}\"}}"
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_ROOM_CLEANING",
            TableName = "Rooms",
            RecordId  = id,
            OldValue  = $"{{\"cleaningStatus\": \"{oldCleaningStatus}\"}}",
            NewValue  = $"{{\"cleaningStatus\": \"{request.CleaningStatus}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Đã cập nhật cleaning_status phòng #{id} thành '{request.CleaningStatus}'." });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/Rooms/bulk-create  [MANAGE_ROOMS]
    // Tạo nhiều phòng 1 lần. Bỏ qua số phòng trùng (không báo lỗi toàn bộ batch).
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("bulk-create")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> BulkCreate([FromBody] List<BulkCreateRoomItem> items)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Danh sách phòng không được rỗng." });

        // Lấy tất cả room_number đã tồn tại để so sánh
        var existingNumbers = await _db.Rooms
            .AsNoTracking()
            .Select(r => r.RoomNumber)
            .ToHashSetAsync();

        // Validate roomTypeId tồn tại
        var requestedTypeIds = items.Select(i => i.RoomTypeId).Distinct().ToList();
        var validTypeIds = await _db.RoomTypes
            .AsNoTracking()
            .Where(rt => requestedTypeIds.Contains(rt.Id))
            .Select(rt => rt.Id)
            .ToHashSetAsync();

        var created  = new List<string>();
        var skipped  = new List<string>();
        var invalid  = new List<string>();

        var newRooms = new List<Room>();

        foreach (var item in items)
        {
            var num = item.RoomNumber?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(num))
            {
                invalid.Add("(trống)");
                continue;
            }

            if (!validTypeIds.Contains(item.RoomTypeId))
            {
                invalid.Add($"{num} — roomTypeId {item.RoomTypeId} không tồn tại");
                continue;
            }

            if (existingNumbers.Contains(num))
            {
                skipped.Add(num);
                continue;
            }

            // Đề phòng trùng trong chính batch này
            existingNumbers.Add(num);

            newRooms.Add(new Room
            {
                RoomNumber     = num,
                Floor          = item.Floor,
                RoomTypeId     = item.RoomTypeId,
                ViewType       = item.ViewType?.Trim(),
                BusinessStatus = "Available",
                CleaningStatus = "Clean",
                Status         = "Available"
            });

            created.Add(num);
        }

        if (newRooms.Count > 0)
        {
            _db.Rooms.AddRange(newRooms);
            await _db.SaveChangesAsync();

            var userId = JwtHelper.GetUserId(User);
            _db.AuditLogs.Add(new AuditLog
            {
                UserId    = userId,
                Action    = "BULK_CREATE_ROOMS",
                TableName = "Rooms",
                RecordId  = 0,
                OldValue  = null,
                NewValue  = $"{{\"count\": {created.Count}, \"rooms\": [{string.Join(",", created.Select(c => $"\"{c}\""))}]}}",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Request.Headers.UserAgent.ToString(),
                CreatedAt = DateTime.UtcNow
            });

            await _activityLog.LogAsync(
                actionCode: "BULK_CREATE_ROOMS",
                actionLabel: "Tạo nhiều phòng",
                message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo {created.Count} phòng mới cùng lúc.",
                entityType: "Room",
                entityId: 0,
                entityLabel: $"{created.Count} phòng",
                severity: "Info",
                userId: userId,
                roleName: User.FindFirst("role")?.Value
            );

            await _db.SaveChangesAsync();
        }

        return StatusCode(201, new
        {
            message  = $"Đã tạo {created.Count} phòng.",
            created,
            skipped,
            invalid
        });
    }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public record UpdateRoomRequest(
    int?    Floor,
    string? ViewType,
    string? Notes
);

public record CreateRoomRequest(
    string  RoomNumber,
    int?    Floor,
    int     RoomTypeId,
    string? ViewType
);

public record UpdateBusinessStatusRequest(string BusinessStatus);

public record UpdateCleaningStatusRequest(string CleaningStatus);

public record BulkCreateRoomItem(
    string  RoomNumber,
    int?    Floor,
    int     RoomTypeId,
    string? ViewType
);
