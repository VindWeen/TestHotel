using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomInventoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public RoomInventoriesController(AppDbContext db)
    {
        _db = db;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/RoomInventories/room/{roomId}  [MANAGE_INVENTORY]
    // Vật tư is_active=1 của 1 phòng, nhóm theo item_type (Asset / Minibar).
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("room/{roomId:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetByRoom(int roomId)
    {
        var roomExists = await _db.Rooms.AnyAsync(r => r.Id == roomId);
        if (!roomExists)
            return NotFound(new { message = $"Không tìm thấy phòng #{roomId}." });

        var items = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.RoomId == roomId && i.IsActive)
            .OrderBy(i => i.ItemName)
            .Select(i => new
            {
                i.Id,
                i.ItemName,
                i.ItemType,
                i.Quantity,
                i.PriceIfLost
            })
            .ToListAsync();

        // Nhóm theo item_type
        var grouped = items
            .GroupBy(i => i.ItemType)
            .Select(g => new
            {
                itemType = g.Key,
                count    = g.Count(),
                items    = g.ToList()
            })
            .OrderBy(g => g.itemType)   // Asset trước Minibar
            .ToList();

        return Ok(new { roomId, data = grouped, total = items.Count });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/RoomInventories/{id}  [MANAGE_INVENTORY]
    // Chi tiết 1 vật tư — FE load form sửa.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.Id == id && i.IsActive)
            .Select(i => new
            {
                i.Id,
                i.RoomId,
                i.ItemName,
                i.ItemType,
                i.Quantity,
                i.PriceIfLost
            })
            .FirstOrDefaultAsync();

        if (item is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        return Ok(item);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/RoomInventories  [MANAGE_INVENTORY]
    // Tạo 1 vật tư mới cho 1 phòng.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Create([FromBody] CreateInventoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ItemName))
            return BadRequest(new { message = "Tên vật tư không được để trống." });

        var allowedTypes = new[] { "Asset", "Minibar" };
        if (!allowedTypes.Contains(request.ItemType))
            return BadRequest(new { message = "item_type không hợp lệ. Chấp nhận: Asset, Minibar." });

        var roomExists = await _db.Rooms.AnyAsync(r => r.Id == request.RoomId);
        if (!roomExists)
            return NotFound(new { message = $"Không tìm thấy phòng #{request.RoomId}." });

        var item = new RoomInventory
        {
            RoomId      = request.RoomId,
            ItemName    = request.ItemName.Trim(),
            ItemType    = request.ItemType,
            Quantity    = request.Quantity,
            PriceIfLost = request.PriceIfLost,
            IsActive    = true
        };

        _db.RoomInventories.Add(item);
        await _db.SaveChangesAsync();

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "CREATE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId  = item.Id,
            OldValue  = null,
            NewValue  = $"{{\"roomId\": {item.RoomId}, \"itemName\": \"{item.ItemName}\", \"quantity\": {item.Quantity ?? 0}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return StatusCode(201, new { message = "Tạo vật tư thành công.", id = item.Id });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/RoomInventories/{id}  [MANAGE_INVENTORY]
    // Cập nhật tên, số lượng, giá đền bù, item_type.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInventoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ItemName))
            return BadRequest(new { message = "Tên vật tư không được để trống." });

        var allowedTypes = new[] { "Asset", "Minibar" };
        if (!allowedTypes.Contains(request.ItemType))
            return BadRequest(new { message = "item_type không hợp lệ. Chấp nhận: Asset, Minibar." });

        var item = await _db.RoomInventories.FirstOrDefaultAsync(i => i.Id == id && i.IsActive);
        if (item is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        item.ItemName    = request.ItemName.Trim();
        item.ItemType    = request.ItemType;
        item.Quantity    = request.Quantity;
        item.PriceIfLost = request.PriceIfLost;

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "UPDATE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"itemName\": \"{item.ItemName}\", \"quantity\": {item.Quantity ?? 0}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Cập nhật vật tư thành công." });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE /api/RoomInventories/{id}  [MANAGE_INVENTORY]
    // Soft Delete: is_active = 0.
    // Không cho xóa nếu đã có Loss_And_Damages tham chiếu.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.RoomInventories.FirstOrDefaultAsync(i => i.Id == id && i.IsActive);
        if (item is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        // Kiểm tra xem có Loss_And_Damages nào tham chiếu không
        var hasLossDamage = await _db.LossAndDamages
            .AnyAsync(l => l.RoomInventoryId == id);

        if (hasLossDamage)
            return Conflict(new
            {
                message = "Không thể xóa vật tư này vì đã có biên bản mất/hỏng tham chiếu đến nó."
            });

        item.IsActive = false;

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "DELETE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": true, \"itemName\": \"{item.ItemName}\"}}",
            NewValue  = "{\"isActive\": false}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Đã xóa vật tư #{id}." });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/RoomInventories/clone  [MANAGE_INVENTORY]
    // Copy toàn bộ vật tư is_active=1 từ sourceRoomId sang các targetRoomIds.
    // Bulk INSERT — bỏ qua target không tồn tại, báo lại trong response.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("clone")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Clone([FromBody] CloneInventoryRequest request)
    {
        if (request.TargetRoomIds is null || request.TargetRoomIds.Count == 0)
            return BadRequest(new { message = "Danh sách phòng đích không được rỗng." });

        // Kiểm tra phòng nguồn
        var sourceExists = await _db.Rooms.AnyAsync(r => r.Id == request.SourceRoomId);
        if (!sourceExists)
            return NotFound(new { message = $"Không tìm thấy phòng nguồn #{request.SourceRoomId}." });

        // Lấy vật tư is_active của phòng nguồn
        var sourceItems = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.RoomId == request.SourceRoomId && i.IsActive)
            .ToListAsync();

        if (sourceItems.Count == 0)
            return BadRequest(new { message = $"Phòng nguồn #{request.SourceRoomId} không có vật tư nào." });

        // Kiểm tra các phòng đích tồn tại
        var distinctTargets = request.TargetRoomIds.Distinct().ToList();
        var validTargetIds  = await _db.Rooms
            .AsNoTracking()
            .Where(r => distinctTargets.Contains(r.Id))
            .Select(r => r.Id)
            .ToHashSetAsync();

        var invalidTargets = distinctTargets.Except(validTargetIds).ToList();
        var clonedTo       = new List<int>();

        var newItems = new List<RoomInventory>();

        foreach (var targetId in validTargetIds)
        {
            foreach (var src in sourceItems)
            {
                newItems.Add(new RoomInventory
                {
                    RoomId      = targetId,
                    ItemName    = src.ItemName,
                    ItemType    = src.ItemType,
                    Quantity    = src.Quantity,
                    PriceIfLost = src.PriceIfLost,
                    IsActive    = true
                });
            }
            clonedTo.Add(targetId);
        }

        if (newItems.Count > 0)
        {
            _db.RoomInventories.AddRange(newItems);
            await _db.SaveChangesAsync();
        }

        return StatusCode(201, new
        {
            message        = $"Đã clone {sourceItems.Count} vật tư vào {clonedTo.Count} phòng.",
            sourceRoomId   = request.SourceRoomId,
            itemsPerRoom   = sourceItems.Count,
            clonedToRooms  = clonedTo,
            invalidRoomIds = invalidTargets
        });
    }

    // ──────────────────────────────────────────────────────────────
    // PATCH /api/RoomInventories/{id}/toggle-active  [MANAGE_INVENTORY]
    // Bật/tắt vật tư: is_active = 1 ↔ 0
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var item = await _db.RoomInventories.FindAsync(id);
 
        if (item is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });
 
        var oldActive = item.IsActive;
        item.IsActive = !item.IsActive;

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "TOGGLE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": {oldActive.ToString().ToLower()}}}",
            NewValue  = $"{{\"isActive\": {item.IsActive.ToString().ToLower()}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
 
        var action = item.IsActive ? "kích hoạt" : "vô hiệu hóa";
        return Ok(new
        {
            message  = $"Đã {action} vật tư '{item.ItemName}'.",
            item.Id,
            item.ItemName,
            item.IsActive
        });
    }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public record CreateInventoryRequest(
    int      RoomId,
    string   ItemName,
    string   ItemType,
    int?     Quantity,
    decimal? PriceIfLost
);

public record UpdateInventoryRequest(
    string   ItemName,
    string   ItemType,
    int?     Quantity,
    decimal? PriceIfLost
);

public record CloneInventoryRequest(
    int        SourceRoomId,
    List<int>  TargetRoomIds
);
