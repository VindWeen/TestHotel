using HotelManagement.Core.Authorization;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Data.SqlClient;
using System.Text.Json;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EquipmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cloudinary _cloudinary;
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new(JsonSerializerDefaults.Web);

    public EquipmentsController(AppDbContext db, Cloudinary cloudinary)
    {
        _db = db;
        _cloudinary = cloudinary;
    }

    private sealed class RoomSnapshotItem
    {
        public int EquipmentId { get; set; }
        public int Quantity { get; set; }
    }

    private static string SerializeRoomSnapshot(Dictionary<int, int> quantities)
    {
        var items = quantities
            .Where(x => x.Value > 0)
            .OrderBy(x => x.Key)
            .Select(x => new RoomSnapshotItem
            {
                EquipmentId = x.Key,
                Quantity = x.Value
            })
            .ToList();

        return JsonSerializer.Serialize(items, SnapshotJsonOptions);
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        var query = _db.Equipments.AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(e => e.IsActive);

        var items = await query
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Id,
                e.ItemCode,
                e.Name,
                e.Category,
                e.Unit,
                e.TotalQuantity,
                e.InUseQuantity,
                e.DamagedQuantity,
                e.LiquidatedQuantity,
                e.InStockQuantity,
                e.BasePrice,
                e.DefaultPriceIfLost,
                e.Supplier,
                e.IsActive
                ,
                e.ImageUrl
            })
            .ToListAsync();

        return Ok(new { data = items, total = items.Count });
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageInventory)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Create([FromForm] SaveEquipmentRequest request)
    {
        var validationError = ValidateRequest(request);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var itemCode = request.ItemCode.Trim();
        var codeExists = await _db.Equipments.AnyAsync(e => e.ItemCode.ToLower() == itemCode.ToLower());
        if (codeExists)
            return Conflict(new { message = $"Mã vật tư '{itemCode}' đã tồn tại." });

        var now = DateTime.UtcNow;
        string? uploadedImageUrl = null;
        if (request.ImageFile is not null)
        {
            var uploadError = await ValidateImageFileAsync(request.ImageFile);
            if (uploadError is not null)
                return BadRequest(new { message = uploadError });

            var uploadResult = await UploadImageToCloudinaryAsync(request.ImageFile);
            if (uploadResult.Error is not null)
                return StatusCode(502, new { message = $"Upload ảnh thất bại: {uploadResult.Error.Message}" });

            uploadedImageUrl = uploadResult.SecureUrl?.ToString();
        }

        var equipment = new Core.Entities.Equipment
        {
            ItemCode = itemCode,
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            Unit = request.Unit.Trim(),
            TotalQuantity = request.TotalQuantity,
            BasePrice = request.BasePrice,
            DefaultPriceIfLost = request.DefaultPriceIfLost,
            Supplier = string.IsNullOrWhiteSpace(request.Supplier) ? null : request.Supplier.Trim(),
            ImageUrl = uploadedImageUrl,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Equipments.Add(equipment);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            return HandleDbUpdateException(ex);
        }

        return StatusCode(201, new
        {
            message = "Tạo vật tư thành công.",
            id = equipment.Id
        });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] SaveEquipmentRequest request)
    {
        var validationError = ValidateRequest(request);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var equipment = await _db.Equipments.FirstOrDefaultAsync(e => e.Id == id);
        if (equipment is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        var itemCode = request.ItemCode.Trim();
        var codeExists = await _db.Equipments.AnyAsync(e => e.Id != id && e.ItemCode.ToLower() == itemCode.ToLower());
        if (codeExists)
            return Conflict(new { message = $"Mã vật tư '{itemCode}' đã tồn tại." });

        equipment.ItemCode = itemCode;
        equipment.Name = request.Name.Trim();
        equipment.Category = request.Category.Trim();
        equipment.Unit = request.Unit.Trim();
        equipment.TotalQuantity = request.TotalQuantity;
        equipment.BasePrice = request.BasePrice;
        equipment.DefaultPriceIfLost = request.DefaultPriceIfLost;
        equipment.Supplier = string.IsNullOrWhiteSpace(request.Supplier) ? null : request.Supplier.Trim();

        if (request.ImageFile is not null)
        {
            var uploadError = await ValidateImageFileAsync(request.ImageFile);
            if (uploadError is not null)
                return BadRequest(new { message = uploadError });

            var oldPublicId = ExtractPublicIdFromUrl(equipment.ImageUrl);
            if (!string.IsNullOrWhiteSpace(oldPublicId))
            {
                var deleteResult = await _cloudinary.DestroyAsync(new DeletionParams(oldPublicId));
                if (deleteResult.Error is not null)
                    Console.WriteLine($"[Cloudinary] Xóa ảnh cũ thất bại: {deleteResult.Error.Message}");
            }

            var uploadResult = await UploadImageToCloudinaryAsync(request.ImageFile);
            if (uploadResult.Error is not null)
                return StatusCode(502, new { message = $"Upload ảnh thất bại: {uploadResult.Error.Message}" });

            equipment.ImageUrl = uploadResult.SecureUrl?.ToString();
        }

        equipment.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            return HandleDbUpdateException(ex);
        }
        return Ok(new { message = "Cập nhật vật tư thành công." });
    }

    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var equipment = await _db.Equipments.FirstOrDefaultAsync(e => e.Id == id);
        if (equipment is null)
            return NotFound(new { message = $"Không tìm thấy vật tư #{id}." });

        equipment.IsActive = !equipment.IsActive;
        equipment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = equipment.IsActive ? "Đã bật vật tư." : "Đã tắt vật tư.",
            id = equipment.Id,
            isActive = equipment.IsActive
        });
    }

    [HttpGet("preview-sync-inuse")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> PreviewSyncInUse()
    {
        var totalsByEquipment = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.IsActive)
            .GroupBy(i => i.EquipmentId)
            .Select(g => new
            {
                EquipmentId = g.Key,
                Quantity = g.Sum(x => x.Quantity ?? 0)
            })
            .ToDictionaryAsync(x => x.EquipmentId, x => x.Quantity);

        var items = await _db.Equipments
            .AsNoTracking()
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Id,
                e.ItemCode,
                e.Name,
                e.InUseQuantity
            })
            .ToListAsync();

        var preview = items
            .Select(e =>
            {
                var newInUseQuantity = totalsByEquipment.GetValueOrDefault(e.Id);
                return new
                {
                    equipmentId = e.Id,
                    itemCode = e.ItemCode,
                    equipmentName = e.Name,
                    oldInUseQuantity = e.InUseQuantity,
                    newInUseQuantity,
                    delta = newInUseQuantity - e.InUseQuantity
                };
            })
            .OrderByDescending(x => Math.Abs(x.delta))
            .ThenBy(x => x.equipmentName)
            .ToList();

        return Ok(new { data = preview, total = preview.Count });
    }

    [HttpPost("sync-inuse")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> SyncInUse()
    {
        var totalsByEquipment = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.IsActive)
            .GroupBy(i => i.EquipmentId)
            .Select(g => new
            {
                EquipmentId = g.Key,
                Quantity = g.Sum(x => x.Quantity ?? 0)
            })
            .ToDictionaryAsync(x => x.EquipmentId, x => x.Quantity);

        var totalsByRoom = await _db.RoomInventories
            .AsNoTracking()
            .Where(i => i.IsActive && i.RoomId.HasValue)
            .GroupBy(i => new { RoomId = i.RoomId!.Value, i.EquipmentId })
            .Select(g => new
            {
                g.Key.RoomId,
                g.Key.EquipmentId,
                Quantity = g.Sum(x => x.Quantity ?? 0)
            })
            .ToListAsync();

        var equipments = await _db.Equipments.ToListAsync();
        var rooms = await _db.Rooms.ToListAsync();
        var now = DateTime.UtcNow;
        var changed = 0;
        var changes = new List<object>();

        var roomSnapshotMap = totalsByRoom
            .GroupBy(x => x.RoomId)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(x => x.EquipmentId, x => x.Quantity)
            );

        foreach (var room in rooms)
        {
            room.InventorySyncSnapshotJson = SerializeRoomSnapshot(
                roomSnapshotMap.GetValueOrDefault(room.Id) ?? new Dictionary<int, int>());
            room.InventoryLastSyncedAt = now;
        }

        foreach (var equipment in equipments)
        {
            var newInUseQuantity = totalsByEquipment.GetValueOrDefault(equipment.Id);
            var oldInUseQuantity = equipment.InUseQuantity;
            var delta = newInUseQuantity - oldInUseQuantity;

            changes.Add(new
            {
                equipmentId = equipment.Id,
                itemCode = equipment.ItemCode,
                equipmentName = equipment.Name,
                oldInUseQuantity,
                newInUseQuantity,
                delta
            });

            if (delta == 0) continue;

            equipment.InUseQuantity = newInUseQuantity;
            equipment.UpdatedAt = now;
            changed++;
        }

        if (changed > 0)
            await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Da dong bo vat tu thanh cong. Da cap nhat snapshot tung phong va {changed} equipment.",
            changedEquipments = changed,
            totalEquipments = equipments.Count,
            syncedRooms = rooms.Count,
            changes
        });
    }

    private static string? ValidateRequest(SaveEquipmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ItemCode))
            return "Mã vật tư không được để trống.";
        if (string.IsNullOrWhiteSpace(request.Name))
            return "Tên vật tư không được để trống.";
        if (string.IsNullOrWhiteSpace(request.Category))
            return "Danh mục không được để trống.";
        if (string.IsNullOrWhiteSpace(request.Unit))
            return "Đơn vị tính không được để trống.";
        if (request.TotalQuantity < 0)
            return "Tổng số lượng không được âm.";
        if (request.BasePrice < 0)
            return "Giá gốc không được âm.";
        if (request.DefaultPriceIfLost < 0)
            return "Giá đền bù không được âm.";

        return null;
    }

    private static Task<string?> ValidateImageFileAsync(IFormFile file)
    {
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return Task.FromResult<string?>("Chỉ chấp nhận file ảnh JPEG, PNG, WebP, GIF.");

        if (file.Length > 5 * 1024 * 1024)
            return Task.FromResult<string?>("File ảnh không được vượt quá 5MB.");

        return Task.FromResult<string?>(null);
    }

    private async Task<ImageUploadResult> UploadImageToCloudinaryAsync(IFormFile file)
    {
        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = "QuanTriKhachSan/Equipments",
            Transformation = new Transformation().Quality("auto").FetchFormat("auto")
        };

        return await _cloudinary.UploadAsync(uploadParams);
    }

    private static string? ExtractPublicIdFromUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        try
        {
            var uri = new Uri(url);
            var path = uri.AbsolutePath;
            var uploadIndex = path.IndexOf("/upload/", StringComparison.Ordinal);
            if (uploadIndex < 0) return null;

            var afterUpload = path[(uploadIndex + 8)..];
            var segments = afterUpload.Split('/');
            var startIndex = 0;
            for (var i = 0; i < segments.Length; i++)
            {
                if (segments[i].Length > 1 && segments[i][0] == 'v' && long.TryParse(segments[i][1..], out _))
                {
                    startIndex = i + 1;
                    break;
                }
            }

            if (startIndex >= segments.Length) return null;
            var publicIdWithExt = string.Join('/', segments[startIndex..]);
            var dotIndex = publicIdWithExt.LastIndexOf('.');
            return dotIndex > 0 ? publicIdWithExt[..dotIndex] : publicIdWithExt;
        }
        catch
        {
            return null;
        }
    }

    private IActionResult HandleDbUpdateException(DbUpdateException ex)
    {
        var sqlEx = ex.InnerException as SqlException;
        if (sqlEx is not null)
        {
            return sqlEx.Number switch
            {
                2601 or 2627 => Conflict(new { message = "Mã vật tư đã tồn tại (vi phạm unique)." }),
                515 => BadRequest(new { message = "Thiếu dữ liệu bắt buộc. Vui lòng kiểm tra các trường có dấu *." }),
                8152 => BadRequest(new { message = "Độ dài dữ liệu vượt quá giới hạn cột trong CSDL." }),
                _ => StatusCode(500, new { message = $"Lỗi CSDL: {sqlEx.Message}" })
            };
        }

        return StatusCode(500, new
        {
            message = ex.InnerException?.Message ?? ex.Message
        });
    }
}

public record SaveEquipmentRequest(
    string ItemCode,
    string Name,
    string Category,
    string Unit,
    int TotalQuantity,
    decimal BasePrice,
    decimal DefaultPriceIfLost,
    string? Supplier,
    IFormFile? ImageFile
);
