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

    private sealed class SyncStockPreviewItem
    {
        public int EquipmentId { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string EquipmentName { get; set; } = string.Empty;
        public int RoomQuantity { get; set; }
        public int OldInUseQuantity { get; set; }
        public int GlobalCalculatedInUse { get; set; }
        public int GlobalDelta => GlobalCalculatedInUse - OldInUseQuantity;

        // Backward compatibility for existing clients.
        public int NewInUseQuantity => GlobalCalculatedInUse;
        public int Delta => GlobalDelta;
    }

    private async Task<List<SyncStockPreviewItem>> BuildSyncStockPreviewAsync(
        HashSet<int>? equipmentFilter = null,
        Dictionary<int, int>? roomQuantityByEquipment = null,
        bool includeOnlyChanged = true)
    {
        var inUseByEquipment = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.IsActive)
            .GroupBy(i => i.EquipmentId)
            .Select(g => new
            {
                EquipmentId = g.Key,
                InUseQuantity = g.Sum(i => i.Quantity ?? 0)
            })
            .ToDictionaryAsync(x => x.EquipmentId, x => x.InUseQuantity);

        var equipments = await _db.Equipments
            .AsNoTracking()
            .Select(e => new
            {
                e.Id,
                e.ItemCode,
                e.Name,
                e.InUseQuantity
            })
            .ToListAsync();

        return equipments
            .Select(e =>
            {
                if (equipmentFilter is not null && !equipmentFilter.Contains(e.Id))
                    return null;

                var globalCalculatedInUse = inUseByEquipment.TryGetValue(e.Id, out var qty) ? qty : 0;
                var roomQuantity = roomQuantityByEquipment is not null &&
                                   roomQuantityByEquipment.TryGetValue(e.Id, out var rq)
                    ? rq
                    : 0;

                return new SyncStockPreviewItem
                {
                    EquipmentId = e.Id,
                    ItemCode = e.ItemCode,
                    EquipmentName = e.Name,
                    RoomQuantity = roomQuantity,
                    OldInUseQuantity = e.InUseQuantity,
                    GlobalCalculatedInUse = globalCalculatedInUse
                };
            })
            .Where(x => x is not null && (!includeOnlyChanged || x.GlobalDelta != 0))
            .Cast<SyncStockPreviewItem>()
            .OrderByDescending(x => Math.Abs(x.GlobalDelta))
            .ThenBy(x => x.EquipmentName)
            .ToList();
    }

    [HttpGet("room/{roomId:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetByRoom(int roomId)
    {
        var roomExists = await _db.Rooms.AnyAsync(r => r.Id == roomId);
        if (!roomExists)
            return NotFound(new { message = $"Khong tim thay phong #{roomId}." });

        var items = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.RoomId == roomId && i.IsActive)
            .OrderBy(i => i.Equipment.Name)
            .Select(i => new
            {
                i.Id,
                i.RoomId,
                i.EquipmentId,
                equipmentName = i.Equipment.Name,
                i.ItemType,
                i.Quantity,
                i.PriceIfLost,
                i.Note,
                i.IsActive
            })
            .ToListAsync();

        var grouped = items
            .GroupBy(i => i.ItemType)
            .Select(g => new
            {
                itemType = g.Key,
                count = g.Count(),
                items = g.ToList()
            })
            .OrderBy(g => g.itemType)
            .ToList();

        return Ok(new { roomId, data = grouped, total = items.Count });
    }

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
                i.EquipmentId,
                equipmentName = i.Equipment.Name,
                i.ItemType,
                i.Quantity,
                i.PriceIfLost,
                i.Note,
                i.IsActive
            })
            .FirstOrDefaultAsync();

        if (item is null)
            return NotFound(new { message = $"Khong tim thay vat tu #{id}." });

        return Ok(item);
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Create([FromBody] CreateInventoryRequest request)
    {
        var allowedTypes = new[] { "Asset", "Minibar" };
        if (!allowedTypes.Contains(request.ItemType))
            return BadRequest(new { message = "item_type khong hop le. Chap nhan: Asset, Minibar." });

        var roomExists = await _db.Rooms.AnyAsync(r => r.Id == request.RoomId);
        if (!roomExists)
            return NotFound(new { message = $"Khong tim thay phong #{request.RoomId}." });

        var equipment = await _db.Equipments.FindAsync(request.EquipmentId);
        if (equipment is null)
            return BadRequest(new { message = $"Equipment #{request.EquipmentId} khong ton tai." });

        var item = new RoomInventory
        {
            RoomId = request.RoomId,
            EquipmentId = request.EquipmentId,
            ItemType = request.ItemType,
            Quantity = request.Quantity,
            PriceIfLost = request.PriceIfLost,
            Note = request.Note?.Trim(),
            IsActive = true
        };

        _db.RoomInventories.Add(item);
        await _db.SaveChangesAsync();

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "CREATE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId = item.Id,
            OldValue = null,
            NewValue = $"{{\"roomId\": {item.RoomId}, \"equipmentId\": {item.EquipmentId}, \"equipmentName\": \"{equipment.Name}\", \"quantity\": {item.Quantity ?? 0}}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return StatusCode(201, new { message = "Tao vat tu thanh cong.", id = item.Id });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInventoryRequest request)
    {
        var allowedTypes = new[] { "Asset", "Minibar" };
        if (!allowedTypes.Contains(request.ItemType))
            return BadRequest(new { message = "item_type khong hop le. Chap nhan: Asset, Minibar." });

        var item = await _db.RoomInventories
            .Include(i => i.Equipment)
            .FirstOrDefaultAsync(i => i.Id == id && i.IsActive);
        if (item is null)
            return NotFound(new { message = $"Khong tim thay vat tu #{id}." });

        var equipment = await _db.Equipments.FindAsync(request.EquipmentId);
        if (equipment is null)
            return BadRequest(new { message = $"Equipment #{request.EquipmentId} khong ton tai." });

        item.EquipmentId = request.EquipmentId;
        item.ItemType = request.ItemType;
        item.Quantity = request.Quantity;
        item.PriceIfLost = request.PriceIfLost;
        item.Note = request.Note?.Trim();

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "UPDATE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"equipmentId\": {item.EquipmentId}, \"equipmentName\": \"{equipment.Name}\", \"quantity\": {item.Quantity ?? 0}}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Cap nhat vat tu thanh cong." });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.RoomInventories
            .Include(i => i.Equipment)
            .FirstOrDefaultAsync(i => i.Id == id && i.IsActive);
        if (item is null)
            return NotFound(new { message = $"Khong tim thay vat tu #{id}." });

        var hasLossDamage = await _db.LossAndDamages.AnyAsync(l => l.RoomInventoryId == id);
        if (hasLossDamage)
        {
            return Conflict(new
            {
                message = "Khong the xoa vat tu nay vi da co bien ban mat/hong tham chieu den no."
            });
        }

        item.IsActive = false;

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "DELETE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId = id,
            OldValue = $"{{\"isActive\": true, \"equipmentId\": {item.EquipmentId}, \"equipmentName\": \"{item.Equipment.Name}\"}}",
            NewValue = "{\"isActive\": false}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Da xoa vat tu #{id}." });
    }

    [HttpPost("clone")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Clone([FromBody] CloneInventoryRequest request)
    {
        if (request.TargetRoomIds is null || request.TargetRoomIds.Count == 0)
            return BadRequest(new { message = "Danh sach phong dich khong duoc rong." });

        var sourceExists = await _db.Rooms.AnyAsync(r => r.Id == request.SourceRoomId);
        if (!sourceExists)
            return NotFound(new { message = $"Khong tim thay phong nguon #{request.SourceRoomId}." });

        var sourceItems = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.RoomId == request.SourceRoomId && i.IsActive)
            .ToListAsync();

        if (sourceItems.Count == 0)
            return BadRequest(new { message = $"Phong nguon #{request.SourceRoomId} khong co vat tu nao." });

        var distinctTargets = request.TargetRoomIds.Distinct().ToList();
        var validTargetIds = await _db.Rooms
            .AsNoTracking()
            .Where(r => distinctTargets.Contains(r.Id))
            .Select(r => r.Id)
            .ToHashSetAsync();

        var invalidTargets = distinctTargets.Except(validTargetIds).ToList();
        var clonedTo = new List<int>();
        var newItems = new List<RoomInventory>();

        // Chi clone vat tu ma phong dich chua co (theo EquipmentId dang active).
        var existingByRoom = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.RoomId.HasValue && validTargetIds.Contains(i.RoomId.Value) && i.IsActive)
            .Select(i => new { RoomId = i.RoomId!.Value, i.EquipmentId })
            .ToListAsync();

        var existingMap = existingByRoom
            .GroupBy(x => x.RoomId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.EquipmentId).ToHashSet());

        // Neu phong nguon bi trung EquipmentId, chi lay 1 ban ghi dau tien moi EquipmentId.
        var sourceDistinctItems = sourceItems
            .GroupBy(i => i.EquipmentId)
            .Select(g => g.First())
            .ToList();

        var totalClonedItems = 0;
        var totalSkippedItems = 0;

        foreach (var targetId in validTargetIds)
        {
            var existingEquipments = existingMap.TryGetValue(targetId, out var set)
                ? set
                : new HashSet<int>();

            var clonedCountForRoom = 0;
            foreach (var src in sourceDistinctItems)
            {
                if (existingEquipments.Contains(src.EquipmentId))
                {
                    totalSkippedItems++;
                    continue;
                }

                newItems.Add(new RoomInventory
                {
                    RoomId = targetId,
                    EquipmentId = src.EquipmentId,
                    ItemType = src.ItemType,
                    Quantity = src.Quantity,
                    PriceIfLost = src.PriceIfLost,
                    Note = src.Note,
                    IsActive = src.IsActive
                });

                existingEquipments.Add(src.EquipmentId);
                clonedCountForRoom++;
            }

            clonedTo.Add(targetId);
            totalClonedItems += clonedCountForRoom;
        }

        if (newItems.Count > 0)
        {
            _db.RoomInventories.AddRange(newItems);
            await _db.SaveChangesAsync();
        }

        return StatusCode(201, new
        {
            message = $"Da clone {totalClonedItems} vat tu con thieu vao {clonedTo.Count} phong.",
            sourceRoomId = request.SourceRoomId,
            sourceDistinctItems = sourceDistinctItems.Count,
            itemsPerRoom = sourceDistinctItems.Count,
            clonedItems = totalClonedItems,
            skippedExistingItems = totalSkippedItems,
            clonedToRooms = clonedTo,
            invalidRoomIds = invalidTargets
        });
    }

    [HttpPost("sync-stock")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> SyncStock([FromQuery] int? roomId = null)
    {
        HashSet<int>? scopeEquipmentIds = null;
        Dictionary<int, int>? roomQtyByEquipment = null;
        var includeOnlyChanged = true;

        if (roomId.HasValue)
        {
            var roomExists = await _db.Rooms.AnyAsync(r => r.Id == roomId.Value);
            if (!roomExists)
                return NotFound(new { message = $"Khong tim thay phong #{roomId.Value}." });

            roomQtyByEquipment = await _db.RoomInventories
                .AsNoTracking()
                .Where(i => i.RoomId == roomId.Value && i.IsActive)
                .GroupBy(i => i.EquipmentId)
                .Select(g => new
                {
                    EquipmentId = g.Key,
                    Quantity = g.Sum(x => x.Quantity ?? 0)
                })
                .ToDictionaryAsync(x => x.EquipmentId, x => x.Quantity);

            scopeEquipmentIds = roomQtyByEquipment.Keys.ToHashSet();
            includeOnlyChanged = false;
        }

        var preview = await BuildSyncStockPreviewAsync(
            scopeEquipmentIds,
            roomQtyByEquipment,
            includeOnlyChanged);

        if (roomId.HasValue && scopeEquipmentIds!.Count == 0)
        {
            return Ok(new
            {
                message = $"Phong #{roomId.Value} khong co vat tu dang active de dong bo.",
                roomId,
                changedEquipments = 0,
                totalEquipments = 0,
                changes = Array.Empty<object>()
            });
        }

        var equipments = await _db.Equipments.ToListAsync();
        var changed = 0;
        var now = DateTime.UtcNow;
        var previewMap = preview.ToDictionary(x => x.EquipmentId, x => x.GlobalCalculatedInUse);

        foreach (var equipment in equipments)
        {
            if (!previewMap.TryGetValue(equipment.Id, out var newInUse)) continue;
            if (equipment.InUseQuantity == newInUse) continue;

            equipment.InUseQuantity = newInUse;
            equipment.UpdatedAt = now;
            changed++;
        }

        if (changed > 0)
            await _db.SaveChangesAsync();

        return Ok(new
        {
            message = roomId.HasValue
                ? $"Da dong bo kho vat tu cho phong #{roomId.Value}. Da cap nhat {changed} thiet bi."
                : $"Da dong bo kho vat tu thanh cong. Da cap nhat {changed} thiet bi.",
            roomId,
            changedEquipments = changed,
            totalEquipments = roomId.HasValue ? scopeEquipmentIds!.Count : equipments.Count,
            changes = preview.Select(x => new
            {
                equipmentId = x.EquipmentId,
                itemCode = x.ItemCode,
                equipmentName = x.EquipmentName,
                roomQuantity = x.RoomQuantity,
                oldInUseQuantity = x.OldInUseQuantity,
                globalCalculatedInUse = x.GlobalCalculatedInUse,
                globalDelta = x.GlobalDelta,
                // Backward compatibility
                newInUseQuantity = x.NewInUseQuantity,
                delta = x.Delta
            })
        });
    }

    [HttpGet("preview-sync-stock")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> PreviewSyncStock([FromQuery] int? roomId = null)
    {
        HashSet<int>? scopeEquipmentIds = null;
        Dictionary<int, int>? roomQtyByEquipment = null;
        var includeOnlyChanged = true;

        if (roomId.HasValue)
        {
            var roomExists = await _db.Rooms.AnyAsync(r => r.Id == roomId.Value);
            if (!roomExists)
                return NotFound(new { message = $"Khong tim thay phong #{roomId.Value}." });

            roomQtyByEquipment = await _db.RoomInventories
                .AsNoTracking()
                .Where(i => i.RoomId == roomId.Value && i.IsActive)
                .GroupBy(i => i.EquipmentId)
                .Select(g => new
                {
                    EquipmentId = g.Key,
                    Quantity = g.Sum(x => x.Quantity ?? 0)
                })
                .ToDictionaryAsync(x => x.EquipmentId, x => x.Quantity);

            scopeEquipmentIds = roomQtyByEquipment.Keys.ToHashSet();
            includeOnlyChanged = false;
        }

        var preview = await BuildSyncStockPreviewAsync(
            scopeEquipmentIds,
            roomQtyByEquipment,
            includeOnlyChanged);
        return Ok(new
        {
            roomId,
            data = preview.Select(x => new
            {
                equipmentId = x.EquipmentId,
                itemCode = x.ItemCode,
                equipmentName = x.EquipmentName,
                roomQuantity = x.RoomQuantity,
                oldInUseQuantity = x.OldInUseQuantity,
                globalCalculatedInUse = x.GlobalCalculatedInUse,
                globalDelta = x.GlobalDelta,
                // Backward compatibility
                newInUseQuantity = x.NewInUseQuantity,
                delta = x.Delta
            }),
            total = preview.Count
        });
    }

    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var item = await _db.RoomInventories
            .Include(i => i.Equipment)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (item is null)
            return NotFound(new { message = $"Khong tim thay vat tu #{id}." });

        var oldActive = item.IsActive;
        item.IsActive = !item.IsActive;

        var userId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "TOGGLE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId = id,
            OldValue = $"{{\"isActive\": {oldActive.ToString().ToLower()}, \"equipmentId\": {item.EquipmentId}}}",
            NewValue = $"{{\"isActive\": {item.IsActive.ToString().ToLower()}}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var action = item.IsActive ? "kich hoat" : "vo hieu hoa";
        return Ok(new
        {
            message = $"Da {action} vat tu '{item.Equipment.Name}'.",
            item.Id,
            item.EquipmentId,
            equipmentName = item.Equipment.Name,
            item.IsActive
        });
    }
}

public record CreateInventoryRequest(
    int RoomId,
    int EquipmentId,
    string ItemType,
    int? Quantity,
    decimal? PriceIfLost,
    string? Note
);

public record UpdateInventoryRequest(
    int EquipmentId,
    string ItemType,
    int? Quantity,
    decimal? PriceIfLost,
    string? Note
);

public record CloneInventoryRequest(
    int SourceRoomId,
    List<int> TargetRoomIds
);
