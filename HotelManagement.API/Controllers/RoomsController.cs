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
    private readonly IAuditTrailService _auditTrail;

    public RoomsController(AppDbContext db, IAuditTrailService auditTrail)
    {
        _db = db;
        _auditTrail = auditTrail;
    }

    // -----------------------------------------------------------------------------
    // GET /api/Rooms  [MANAGE_ROOMS - nội bộ]
    // Danh sách phòng vật lý kèm room_type_name, business_status, cleaning_status.
    // Filter: floor, viewType, businessStatus, cleaningStatus, roomTypeId
    // -----------------------------------------------------------------------------
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
                r.Status,
                r.BusinessStatus,
                r.CleaningStatus,
                r.RoomTypeId,
                roomTypeName = r.RoomType != null ? r.RoomType.Name : null,
                activeMaintenanceCount = r.MaintenanceTickets.Count(t =>
                    t.Status == "Open" ||
                    t.Status == "InProgress" ||
                    t.Status == "Resolved")
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            message = "Lấy danh sách phòng thành công.",
            data = rooms,
            total = rooms.Count
        });
    }

    // -----------------------------------------------------------------------------
    // GET /api/Rooms/{id}  [MANAGE_ROOMS - nội bộ]
    // Chi tiết 1 phòng kèm room_type_name, notes, inventory - FE load form sửa.
    // -----------------------------------------------------------------------------
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> GetById(int id)
    {
        var room = await _db.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .Include(r => r.RoomInventories.Where(i => i.IsActive))
                .ThenInclude(i => i.Equipment)
            .Where(r => r.Id == id)
            .Select(r => new
            {
                r.Id,
                r.RoomNumber,
                r.Floor,
                r.ViewType,
                r.Status,
                r.BusinessStatus,
                r.CleaningStatus,
                r.Notes,
                r.RoomTypeId,
                roomTypeName = r.RoomType != null ? r.RoomType.Name : null,
                maintenanceHistory = r.MaintenanceTickets
                    .OrderByDescending(t => t.OpenedAt)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Reason,
                        t.Priority,
                        t.BlocksRoom,
                        t.Status,
                        t.OpenedAt,
                        t.ExpectedDoneAt,
                        t.ResolvedAt,
                        t.ClosedAt
                    }),
                inventory = r.RoomInventories.Select(i => new
                {
                    i.Id,
                    i.EquipmentId,
                    equipmentName = i.Equipment.Name,
                    i.ItemType,
                    i.Quantity,
                    i.PriceIfLost,
                    i.Note
                })
            })
            .FirstOrDefaultAsync();

        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{id}." });

        return Ok(room);
    }

    // -----------------------------------------------------------------------------
    // PUT /api/Rooms/{id}  [MANAGE_ROOMS]
    // Sửa thông tin phòng: floor, view_type, notes.
    // Không cho đổi room_number. Không cho đổi status ở đây.
    // -----------------------------------------------------------------------------
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

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_ROOM",
            ActionLabel = "Cập nhật phòng",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật thông tin phòng {room.RoomNumber}.",
            EntityType = "Room",
            EntityId = id,
            EntityLabel = room.RoomNumber,
            Severity = "Info",
            TableName = "Rooms",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"floor\": {request.Floor?.ToString() ?? "null"}, \"viewType\": \"{request.ViewType}\"}}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Cập nhật phòng thành công." });
    }

    // -----------------------------------------------------------------------------
    // POST /api/Rooms  [MANAGE_ROOMS]
    // Tạo 1 phòng mới. Validate room_number unique.
    // -----------------------------------------------------------------------------
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Create([FromBody] CreateRoomRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomNumber))
            return BadRequest(new { message = "Số phòng không được để trống." });

        var roomTypeExists = await _db.RoomTypes.AnyAsync(rt => rt.Id == request.RoomTypeId);
        if (!roomTypeExists)
            return BadRequest(new { message = $"Loại phòng #{request.RoomTypeId} không tồn tại." });

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

        await _db.SaveChangesAsync();
        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CREATE_ROOM",
            ActionLabel = "Tạo phòng mới",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo phòng mới: {room.RoomNumber}.",
            EntityType = "Room",
            EntityId = room.Id,
            EntityLabel = room.RoomNumber,
            Severity = "Info",
            TableName = "Rooms",
            RecordId = room.Id,
            OldValue = null,
            NewValue = $"{{\"roomNumber\": \"{room.RoomNumber}\", \"floor\": {room.Floor}, \"roomTypeId\": {room.RoomTypeId}}}",
            Metadata = $"{{\"roomNumber\": \"{room.RoomNumber}\", \"floor\": {room.Floor}, \"roomTypeId\": {room.RoomTypeId}, \"viewType\": \"{room.ViewType}\"}}"
        });

        return StatusCode(201, new { success = true, message = "Tạo phòng thành công.", id = room.Id });
    }

    // -----------------------------------------------------------------------------
    // PATCH /api/Rooms/{id}/business_status  [MANAGE_ROOMS - Manager/Lễ tân]
    // Đổi business_status (Available / Occupied / Disabled). Ghi Audit_Log.
    // Housekeeping không có quyền này (cùng permission MANAGE_ROOMS, phân biệt
    // qua role nếu cần - hiện tại guard bằng MANAGE_ROOMS là đủ).
    // -----------------------------------------------------------------------------
    [HttpPatch("{id:int}/business_status")]
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

        // Tính lại Status dựa trên tổ hợp BusinessStatus + CleaningStatus
        room.Status = ComputeStatus(room.BusinessStatus, room.CleaningStatus);

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_ROOM_STATUS",
            ActionLabel = "Đổi trạng thái phòng",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã đổi trạng thái phòng {room.RoomNumber} sang '{request.BusinessStatus}'.",
            EntityType = "Room",
            EntityId = id,
            EntityLabel = room.RoomNumber,
            Severity = "Info",
            TableName = "Rooms",
            RecordId = id,
            OldValue = $"{{\"businessStatus\": \"{oldValue}\"}}",
            NewValue = $"{{\"businessStatus\": \"{request.BusinessStatus}\"}}",
            Metadata = $"{{\"oldStatus\": \"{oldValue}\", \"newStatus\": \"{request.BusinessStatus}\"}}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Đã đổi trạng thái phòng #{id} thành '{request.BusinessStatus}'." });
    }

    // -----------------------------------------------------------------------------
    // PATCH /api/Rooms/{id}/cleaning-status  [MANAGE_ROOMS - Housekeeping]
    // Chỉ đổi cleaning_status (Clean / Dirty / PendingLoss).
    // -----------------------------------------------------------------------------
    [HttpPatch("{id:int}/cleaning-status")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> UpdateCleaningStatus(
        int id,
        [FromBody] UpdateCleaningStatusRequest request)
    {
        var allowed = new[] { "Clean", "Dirty", "PendingLoss" };
        if (!allowed.Contains(request.CleaningStatus))
            return BadRequest(new { message = "cleaning_status không hợp lệ. Chấp nhận: Clean, Dirty, PendingLoss." });

        var room = await _db.Rooms.FindAsync(id);
        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{id}." });

        var oldCleaningStatus = room.CleaningStatus;
        room.CleaningStatus = request.CleaningStatus;

        // Tính lại Status dựa trên tổ hợp BusinessStatus + CleaningStatus
        room.Status = ComputeStatus(room.BusinessStatus, room.CleaningStatus);

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_ROOM_CLEANING",
            ActionLabel = "Đổi trạng thái vệ sinh",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã đổi trạng thái vệ sinh phòng {room.RoomNumber} thành '{request.CleaningStatus}'.",
            EntityType = "Room",
            EntityId = id,
            EntityLabel = room.RoomNumber,
            Severity = request.CleaningStatus is "Dirty" or "PendingLoss" ? "Warning" : "Success",
            TableName = "Rooms",
            RecordId = id,
            OldValue = $"{{\"cleaningStatus\": \"{oldCleaningStatus}\"}}",
            NewValue = $"{{\"cleaningStatus\": \"{request.CleaningStatus}\"}}",
            Metadata = $"{{\"oldStatus\": \"{oldCleaningStatus}\", \"newStatus\": \"{request.CleaningStatus}\"}}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Đã cập nhật cleaning_status phòng #{id} thành '{request.CleaningStatus}'." });
    }

    // -----------------------------------------------------------------------------
    // POST /api/Rooms/bulk-create  [MANAGE_ROOMS]
    // Tạo nhiều phòng một lần. Bỏ qua số phòng trùng (không báo lỗi toàn bộ batch).
    // -----------------------------------------------------------------------------
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
            await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
            {
                ActionCode = "BULK_CREATE_ROOMS",
                ActionLabel = "Tạo hàng loạt phòng",
                Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo {created.Count} phòng.",
                EntityType = "Room",
                EntityId = null,
                EntityLabel = null,
                Severity = "Success",
                TableName = "Rooms",
                RecordId = null,
                OldValue = null,
                NewValue = $"{{\"createdCount\": {created.Count}}}"
            });
        }

        return StatusCode(201, new
        {
            success = true,
            message  = $"Đã tạo {created.Count} phòng.",
            created,
            createdRooms = newRooms.Select(r => new
            {
                r.Id,
                r.RoomNumber
            }),
            skipped,
            invalid
        });
    }
    // -----------------------------------------------------------------------------
    // Helper: tính Status từ tổ hợp BusinessStatus + CleaningStatus
    // Available + Clean        -> Available
    // Available + Dirty        -> Cleaning
    // Available + PendingLoss  -> Cleaning
    // Occupied  (any)    -> Occupied
    // Disabled  (any)    -> Maintenance
    // -----------------------------------------------------------------------------
    private static string ComputeStatus(string businessStatus, string cleaningStatus)
        => businessStatus switch
        {
            "Occupied" => "Occupied",
            "Disabled" => "Maintenance",
            "Available" when cleaningStatus == "Dirty" || cleaningStatus == "PendingLoss" => "Cleaning",
            _ => "Available"
        };
}

// ------------------------------- Request DTOs -------------------------------

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


