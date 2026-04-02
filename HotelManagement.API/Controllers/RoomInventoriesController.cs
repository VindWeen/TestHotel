using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomInventoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new(JsonSerializerDefaults.Web);

    public RoomInventoriesController(AppDbContext db)
    {
        _db = db;
    }

    private sealed class SnapshotItem
    {
        public int EquipmentId { get; set; }
        public int Quantity { get; set; }
    }

    private sealed class RoomSyncPreviewItem
    {
        public int EquipmentId { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string EquipmentName { get; set; } = string.Empty;
        public int OldRoomQuantity { get; set; }
        public int NewRoomQuantity { get; set; }
        public int Delta => NewRoomQuantity - OldRoomQuantity;
    }

    private static List<SnapshotItem> DeserializeSnapshot(string? snapshotJson)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson))
            return [];

        try
        {
            return JsonSerializer.Deserialize<List<SnapshotItem>>(snapshotJson, SnapshotJsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string SerializeSnapshot(Dictionary<int, int> quantities)
    {
        var items = quantities
            .Where(x => x.Value > 0)
            .OrderBy(x => x.Key)
            .Select(x => new SnapshotItem
            {
                EquipmentId = x.Key,
                Quantity = x.Value
            })
            .ToList();

        return JsonSerializer.Serialize(items, SnapshotJsonOptions);
    }

    private async Task<Dictionary<int, int>> GetActiveRoomQuantitiesAsync(int roomId)
    {
        return await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.RoomId == roomId && i.IsActive)
            .GroupBy(i => i.EquipmentId)
            .Select(g => new
            {
                EquipmentId = g.Key,
                Quantity = g.Sum(x => x.Quantity ?? 0)
            })
            .ToDictionaryAsync(x => x.EquipmentId, x => x.Quantity);
    }

    private static void BumpRoomInventoryVersion(Room room)
    {
        room.InventoryVersion = (room.InventoryVersion < 0 ? 0 : room.InventoryVersion) + 1;
    }

    private async Task<List<RoomSyncPreviewItem>> BuildRoomSyncPreviewAsync(Room room)
    {
        var snapshot = DeserializeSnapshot(room.InventorySyncSnapshotJson)
            .GroupBy(x => x.EquipmentId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
        var current = await GetActiveRoomQuantitiesAsync(room.Id);

        var equipmentIds = snapshot.Keys.Union(current.Keys).ToHashSet();
        if (equipmentIds.Count == 0)
            return [];

        var equipmentMap = await _db.Equipments
            .AsNoTracking()
            .Where(e => equipmentIds.Contains(e.Id))
            .Select(e => new
            {
                e.Id,
                e.ItemCode,
                e.Name
            })
            .ToDictionaryAsync(e => e.Id);

        return equipmentIds
            .Select(id =>
            {
                var oldQty = snapshot.GetValueOrDefault(id);
                var newQty = current.GetValueOrDefault(id);
                if (oldQty == newQty || !equipmentMap.TryGetValue(id, out var equipment))
                    return null;

                return new RoomSyncPreviewItem
                {
                    EquipmentId = id,
                    ItemCode = equipment.ItemCode,
                    EquipmentName = equipment.Name,
                    OldRoomQuantity = oldQty,
                    NewRoomQuantity = newQty
                };
            })
            .Where(x => x is not null)
            .Cast<RoomSyncPreviewItem>()
            .OrderByDescending(x => Math.Abs(x.Delta))
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

        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == request.RoomId);
        if (room is null)
            return NotFound(new { message = $"Khong tim thay phong #{request.RoomId}." });

        var equipment = await _db.Equipments.FindAsync(request.EquipmentId);
        if (equipment is null)
            return BadRequest(new { message = $"Equipment #{request.EquipmentId} khong ton tai." });

        var existingItem = await _db.RoomInventories
            .Where(i => i.RoomId == request.RoomId && i.EquipmentId == request.EquipmentId)
            .OrderByDescending(i => i.IsActive)
            .ThenByDescending(i => i.Id)
            .FirstOrDefaultAsync();

        if (existingItem is not null)
        {
            var wasActive = existingItem.IsActive;
            var oldSnapshot = $"{{\"isActive\": {existingItem.IsActive.ToString().ToLower()}, \"quantity\": {existingItem.Quantity ?? 0}, \"itemType\": \"{existingItem.ItemType}\", \"priceIfLost\": {(existingItem.PriceIfLost?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "null")}}}";

            existingItem.ItemType = request.ItemType;
            existingItem.Quantity = request.Quantity;
            existingItem.PriceIfLost = request.PriceIfLost;
            existingItem.Note = request.Note?.Trim();
            existingItem.IsActive = true;

            BumpRoomInventoryVersion(room);

            var userId = JwtHelper.GetUserId(User);
            _db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = wasActive ? "UPDATE_INVENTORY_FROM_CREATE" : "RESTORE_INVENTORY",
                TableName = "Room_Inventory",
                RecordId = existingItem.Id,
                OldValue = oldSnapshot,
                NewValue = $"{{\"roomId\": {existingItem.RoomId}, \"equipmentId\": {existingItem.EquipmentId}, \"equipmentName\": \"{equipment.Name}\", \"quantity\": {existingItem.Quantity ?? 0}, \"isActive\": true}}",
                UserAgent = Request.Headers["User-Agent"].ToString(),
                CreatedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = wasActive
                    ? "Vat tu da ton tai trong phong. He thong da cap nhat so luong thay vi tao dong moi."
                    : "Vat tu da ton tai o trang thai ngung su dung. He thong da kich hoat lai va cap nhat so luong.",
                id = existingItem.Id,
                roomInventoryVersion = room.InventoryVersion
            });
        }

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
        BumpRoomInventoryVersion(room);

        var createUserId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = createUserId,
            Action = "CREATE_INVENTORY",
            TableName = "Room_Inventory",
            RecordId = item.Id,
            OldValue = null,
            NewValue = $"{{\"roomId\": {item.RoomId}, \"equipmentId\": {item.EquipmentId}, \"equipmentName\": \"{equipment.Name}\", \"quantity\": {item.Quantity ?? 0}}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return StatusCode(201, new { message = "Tao vat tu thanh cong.", id = item.Id, roomInventoryVersion = room.InventoryVersion });
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
            .Include(i => i.Room)
            .FirstOrDefaultAsync(i => i.Id == id && i.IsActive);
        if (item is null)
            return NotFound(new { message = $"Khong tim thay vat tu #{id}." });

        if (item.Room is null)
            return BadRequest(new { message = "Vat tu nay chua duoc gan voi phong hop le." });

        var equipment = await _db.Equipments.FindAsync(request.EquipmentId);
        if (equipment is null)
            return BadRequest(new { message = $"Equipment #{request.EquipmentId} khong ton tai." });

        item.EquipmentId = request.EquipmentId;
        item.ItemType = request.ItemType;
        item.Quantity = request.Quantity;
        item.PriceIfLost = request.PriceIfLost;
        item.Note = request.Note?.Trim();
        BumpRoomInventoryVersion(item.Room);

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

        return Ok(new { message = "Cap nhat vat tu thanh cong.", roomInventoryVersion = item.Room.InventoryVersion });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.RoomInventories
            .Include(i => i.Equipment)
            .Include(i => i.Room)
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
        if (item.Room is not null)
            BumpRoomInventoryVersion(item.Room);

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

        return Ok(new { message = $"Da xoa vat tu #{id}.", roomInventoryVersion = item.Room?.InventoryVersion });
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
        var changedRooms = new HashSet<int>();

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

            if (clonedCountForRoom > 0)
            {
                var targetRoom = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == targetId);
                if (targetRoom is not null)
                {
                    BumpRoomInventoryVersion(targetRoom);
                    changedRooms.Add(targetId);
                }
            }

            clonedTo.Add(targetId);
            totalClonedItems += clonedCountForRoom;
        }

        if (newItems.Count > 0)
        {
            _db.RoomInventories.AddRange(newItems);
            await _db.SaveChangesAsync();
        }

        if (request.SyncSnapshotAfterClone && changedRooms.Count > 0)
        {
            var now = DateTime.UtcNow;
            var targetRooms = await _db.Rooms
                .Where(r => changedRooms.Contains(r.Id))
                .ToListAsync();

            foreach (var targetRoom in targetRooms)
            {
                targetRoom.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(targetRoom.Id));
                targetRoom.InventoryLastSyncedAt = now;
            }

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
            invalidRoomIds = invalidTargets,
            changedRoomIds = changedRooms,
            syncedSnapshotRoomIds = request.SyncSnapshotAfterClone ? changedRooms : []
        });
    }

    [HttpPost("sync-stock")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> SyncStock([FromBody] SyncRoomInventoryStockRequest request)
    {
        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == request.RoomId);
        if (room is null)
            return NotFound(new { message = $"Khong tim thay phong #{request.RoomId}." });

        if (room.InventoryVersion != request.InventoryVersion)
            return Conflict(new { message = "Du lieu vat tu cua phong da thay doi. Vui long xem lai preview truoc khi dong bo." });

        var preview = await BuildRoomSyncPreviewAsync(room);
        var now = DateTime.UtcNow;

        if (preview.Count == 0)
        {
            room.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(room.Id));
            room.InventoryLastSyncedAt = now;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = $"Phong #{room.Id} khong co thay doi vat tu de dong bo.",
                roomId = room.Id,
                updatedEquipments = 0,
                changes = Array.Empty<object>(),
                syncedAt = room.InventoryLastSyncedAt
            });
        }

        var equipmentIds = preview.Select(x => x.EquipmentId).ToList();
        var equipments = await _db.Equipments
            .Where(e => equipmentIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id);

        foreach (var change in preview)
        {
            if (!equipments.TryGetValue(change.EquipmentId, out var equipment))
                continue;

            var nextInUse = equipment.InUseQuantity + change.Delta;
            if (nextInUse < 0)
                return Conflict(new { message = $"Khong the dong bo vi vat tu '{equipment.Name}' se co so luong dang dung am." });
        }

        foreach (var change in preview)
        {
            if (!equipments.TryGetValue(change.EquipmentId, out var equipment))
                continue;

            equipment.InUseQuantity += change.Delta;
            equipment.UpdatedAt = now;
        }

        room.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(room.Id));
        room.InventoryLastSyncedAt = now;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Da dong bo kho vat tu cho phong #{room.Id}.",
            roomId = room.Id,
            updatedEquipments = preview.Count,
            changes = preview.Select(x => new
            {
                equipmentId = x.EquipmentId,
                itemCode = x.ItemCode,
                equipmentName = x.EquipmentName,
                oldRoomQuantity = x.OldRoomQuantity,
                newRoomQuantity = x.NewRoomQuantity,
                delta = x.Delta
            }),
            syncedAt = room.InventoryLastSyncedAt
        });
    }

    [HttpGet("preview-sync-stock")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> PreviewSyncStock([FromQuery] int? roomId = null)
    {
        if (!roomId.HasValue)
            return BadRequest(new { message = "roomId la bat buoc de xem preview dong bo phong." });

        var room = await _db.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == roomId.Value);
        if (room is null)
            return NotFound(new { message = $"Khong tim thay phong #{roomId.Value}." });

        var preview = await BuildRoomSyncPreviewAsync(room);
        return Ok(new
        {
            roomId = room.Id,
            inventoryVersion = room.InventoryVersion,
            lastSyncedAt = room.InventoryLastSyncedAt,
            data = preview.Select(x => new
            {
                equipmentId = x.EquipmentId,
                itemCode = x.ItemCode,
                equipmentName = x.EquipmentName,
                oldRoomQuantity = x.OldRoomQuantity,
                newRoomQuantity = x.NewRoomQuantity,
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
            .Include(i => i.Room)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (item is null)
            return NotFound(new { message = $"Khong tim thay vat tu #{id}." });

        var oldActive = item.IsActive;
        item.IsActive = !item.IsActive;
        if (item.Room is not null)
            BumpRoomInventoryVersion(item.Room);

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
            item.IsActive,
            roomInventoryVersion = item.Room?.InventoryVersion
        });
    }

    [HttpPost("save-room-snapshot")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> SaveRoomSnapshot([FromBody] SaveRoomInventorySnapshotRequest request)
    {
        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == request.RoomId);
        if (room is null)
            return NotFound(new { message = $"Khong tim thay phong #{request.RoomId}." });

        room.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(room.Id));
        room.InventoryLastSyncedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Da luu snapshot vat tu hien tai cho phong #{room.Id}.",
            roomId = room.Id,
            lastSyncedAt = room.InventoryLastSyncedAt
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
    List<int> TargetRoomIds,
    bool SyncSnapshotAfterClone = false
);

public record SyncRoomInventoryStockRequest(
    int RoomId,
    int InventoryVersion
);

public record SaveRoomInventorySnapshotRequest(
    int RoomId
);
