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
        public bool IsEquipmentActive { get; set; }
        public int AvailableStock { get; set; }
        public bool HasInsufficientStock { get; set; }
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
                e.Name,
                e.IsActive,
                e.InStockQuantity
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
                    NewRoomQuantity = newQty,
                    IsEquipmentActive = equipment.IsActive,
                    AvailableStock = equipment.InStockQuantity,
                    HasInsufficientStock = newQty > oldQty && (newQty - oldQty) > equipment.InStockQuantity
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
            return NotFound(new { message = $"Không tìm thấy phòng #{roomId}." });

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
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        return Ok(item);
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Create([FromBody] CreateInventoryRequest request)
    {
        var allowedTypes = new[] { "Asset", "Minibar" };
        if (!allowedTypes.Contains(request.ItemType))
            return BadRequest(new { message = "item_type không hợp lệ. Chấp nhận: Asset, Minibar." });

        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == request.RoomId);
        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{request.RoomId}." });

        var equipment = await _db.Equipments.FindAsync(request.EquipmentId);
        if (equipment is null)
            return BadRequest(new { message = $"Equipment #{request.EquipmentId} không tồn tại." });
        if (!equipment.IsActive)
            return Conflict(new { message = $"Vật tư '{equipment.Name}' đang bị vô hiệu hóa và không thể thêm vào phòng." });

        var requestedQuantity = request.Quantity ?? 0;
        if (requestedQuantity < 0)
            return BadRequest(new { message = "Số lượng vật tư không được âm." });
        if (requestedQuantity > equipment.InStockQuantity)
            return Conflict(new { message = $"Tồn kho của vật tư '{equipment.Name}' không đủ để thêm {requestedQuantity} vào phòng." });

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
            existingItem.Quantity = requestedQuantity;
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
                    ? "Vật tư đã tồn tại trong phòng. Hệ thống đã cập nhật số lượng thay vì tạo dòng mới."
                    : "Vật tư đã tồn tại ở trạng thái ngừng sử dụng. Hệ thống đã kích hoạt lại và cập nhật số lượng.",
                id = existingItem.Id,
                roomInventoryVersion = room.InventoryVersion
            });
        }

        var item = new RoomInventory
        {
            RoomId = request.RoomId,
            EquipmentId = request.EquipmentId,
            ItemType = request.ItemType,
            Quantity = requestedQuantity,
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

        return StatusCode(201, new { message = "Tạo vật tư thành công.", id = item.Id, roomInventoryVersion = room.InventoryVersion });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInventoryRequest request)
    {
        var allowedTypes = new[] { "Asset", "Minibar" };
        if (!allowedTypes.Contains(request.ItemType))
            return BadRequest(new { message = "item_type không hợp lệ. Chấp nhận: Asset, Minibar." });

        var item = await _db.RoomInventories
            .Include(i => i.Equipment)
            .Include(i => i.Room)
            .FirstOrDefaultAsync(i => i.Id == id && i.IsActive);
        if (item is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        if (item.Room is null)
            return BadRequest(new { message = "Vật tư này chưa được gắn với phòng hợp lệ." });

        var equipment = await _db.Equipments.FindAsync(request.EquipmentId);
        if (equipment is null)
            return BadRequest(new { message = $"Equipment #{request.EquipmentId} không tồn tại." });
        if (!equipment.IsActive)
            return Conflict(new { message = $"Vật tư '{equipment.Name}' đang bị vô hiệu hóa và không thể gắn vào phòng." });

        var requestedQuantity = request.Quantity ?? 0;
        if (requestedQuantity < 0)
            return BadRequest(new { message = "Số lượng vật tư không được âm." });

        var currentQuantity = item.Quantity ?? 0;
        var delta = request.EquipmentId == item.EquipmentId
            ? requestedQuantity - currentQuantity
            : requestedQuantity;
        if (delta > 0 && delta > equipment.InStockQuantity)
            return Conflict(new { message = $"Tồn kho của vật tư '{equipment.Name}' không đủ để tăng thêm {delta} vào phòng." });

        item.EquipmentId = request.EquipmentId;
        item.ItemType = request.ItemType;
        item.Quantity = requestedQuantity;
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

        return Ok(new { message = "Cập nhật vật tư thành công.", roomInventoryVersion = item.Room.InventoryVersion });
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
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        var hasLossDamage = await _db.LossAndDamages.AnyAsync(l => l.RoomInventoryId == id);
        if (hasLossDamage)
        {
            return Conflict(new
            {
                message = "Không thể xóa vật tư này vì đã có biên bản mất/hỏng tham chiếu đến nó."
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

        return Ok(new { message = $"Đã xóa vật tư #{id}.", roomInventoryVersion = item.Room?.InventoryVersion });
    }

    [HttpPost("clone")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Clone([FromBody] CloneInventoryRequest request)
    {
        if (request.TargetRoomIds is null || request.TargetRoomIds.Count == 0)
            return BadRequest(new { message = "Danh sách phòng đích không được rỗng." });

        var sourceExists = await _db.Rooms.AnyAsync(r => r.Id == request.SourceRoomId);
        if (!sourceExists)
            return NotFound(new { message = $"Không tìm thấy phòng nguồn #{request.SourceRoomId}." });

        var sourceItems = await _db.RoomInventories
            .AsNoTracking()
            .Include(i => i.Equipment)
            .Where(i => i.RoomId == request.SourceRoomId && i.IsActive)
            .ToListAsync();

        if (sourceItems.Count == 0)
            return BadRequest(new { message = $"Phòng nguồn #{request.SourceRoomId} không có vật tư nào." });

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
        var skippedDisabledItems = new List<object>();
        var skippedInsufficientStockItems = new List<object>();

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
                if (src.Equipment?.IsActive == false)
                {
                    skippedDisabledItems.Add(new
                    {
                        roomId = targetId,
                        equipmentId = src.EquipmentId,
                        equipmentName = src.Equipment?.Name,
                        reason = "EquipmentDisabled"
                    });
                    totalSkippedItems++;
                    continue;
                }

                var sourceQuantity = src.Quantity ?? 0;
                var availableStock = src.Equipment?.InStockQuantity ?? 0;
                if (sourceQuantity > availableStock)
                {
                    skippedInsufficientStockItems.Add(new
                    {
                        roomId = targetId,
                        equipmentId = src.EquipmentId,
                        equipmentName = src.Equipment?.Name,
                        requestedQuantity = sourceQuantity,
                        availableStock,
                        reason = "InsufficientStock"
                    });
                    totalSkippedItems++;
                    continue;
                }

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
                    Note = string.IsNullOrWhiteSpace(src.Note)
                        ? $"Đồng bộ từ phòng {request.SourceRoomId}"
                        : $"{src.Note} | Đồng bộ từ phòng {request.SourceRoomId}",
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
            message = $"Đã clone {totalClonedItems} vật tư còn thiếu vào {clonedTo.Count} phòng.",
            sourceRoomId = request.SourceRoomId,
            sourceDistinctItems = sourceDistinctItems.Count,
            itemsPerRoom = sourceDistinctItems.Count,
            clonedItems = totalClonedItems,
            skippedExistingItems = totalSkippedItems,
            skippedDisabledItems,
            skippedInsufficientStockItems,
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
            return NotFound(new { message = $"Không tìm thấy phòng #{request.RoomId}." });

        if (room.InventoryVersion != request.InventoryVersion)
            return Conflict(new { message = "Dữ liệu vật tư của phòng đã thay đổi. Vui lòng xem lại preview trước khi đồng bộ." });

        var preview = await BuildRoomSyncPreviewAsync(room);
        var now = DateTime.UtcNow;

        if (preview.Count == 0)
        {
            room.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(room.Id));
            room.InventoryLastSyncedAt = now;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = $"Phòng #{room.Id} không có thay đổi vật tư để đồng bộ.",
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
        var skippedDisabledItems = new List<object>();

        foreach (var change in preview)
        {
            if (!equipments.TryGetValue(change.EquipmentId, out var equipment))
                continue;

            if (!equipment.IsActive)
            {
                skippedDisabledItems.Add(new
                {
                    equipmentId = equipment.Id,
                    equipmentName = equipment.Name,
                    reason = "EquipmentDisabled"
                });
                continue;
            }

            if (change.Delta > 0 && change.Delta > equipment.InStockQuantity)
                return Conflict(new { message = $"Không thể đồng bộ vì vật tư '{equipment.Name}' không đủ tồn kho.", skippedDisabledItems });

            var nextInUse = equipment.InUseQuantity + change.Delta;
            if (nextInUse < 0)
                return Conflict(new { message = $"Không thể đồng bộ vì vật tư '{equipment.Name}' sẽ có số lượng đang dùng âm." });
        }

        foreach (var change in preview)
        {
            if (!equipments.TryGetValue(change.EquipmentId, out var equipment))
                continue;
            if (!equipment.IsActive)
                continue;

            equipment.InUseQuantity += change.Delta;
            equipment.UpdatedAt = now;
        }

        room.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(room.Id));
        room.InventoryLastSyncedAt = now;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Đã đồng bộ kho vật tư cho phòng #{room.Id}.",
            roomId = room.Id,
            updatedEquipments = preview.Count(x => x.IsEquipmentActive),
            skippedDisabledItems,
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
            return BadRequest(new { message = "roomId là bắt buộc để xem preview đồng bộ phòng." });

        var room = await _db.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == roomId.Value);
        if (room is null)
            return NotFound(new { message = $"Không tìm thấy phòng #{roomId.Value}." });

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
                delta = x.Delta,
                isEquipmentActive = x.IsEquipmentActive,
                availableStock = x.AvailableStock,
                hasInsufficientStock = x.HasInsufficientStock
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
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

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

        var action = item.IsActive ? "kích hoạt" : "vô hiệu hóa";
        return Ok(new
        {
            message = $"Đã {action} vật tư '{item.Equipment.Name}'.",
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
            return NotFound(new { message = $"Không tìm thấy phòng #{request.RoomId}." });

        room.InventorySyncSnapshotJson = SerializeSnapshot(await GetActiveRoomQuantitiesAsync(room.Id));
        room.InventoryLastSyncedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Đã lưu snapshot vật tư hiện tại cho phòng #{room.Id}.",
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
