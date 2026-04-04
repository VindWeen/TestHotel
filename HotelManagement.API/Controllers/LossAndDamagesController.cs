using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.API.Services;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LossAndDamagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cloudinary _cloudinary;
    private readonly INotificationService _notificationService;

    public LossAndDamagesController(AppDbContext db, Cloudinary cloudinary, INotificationService notificationService)
    {
        _db = db;
        _cloudinary = cloudinary;
        _notificationService = notificationService;
    }

    private class ImageItem
    {
        public string url { get; set; } = "";
        public string publicId { get; set; } = "";
    }

    private static List<ImageItem> ParseImages(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return [];

        try
        {
            var parsed = JsonSerializer.Deserialize<List<ImageItem>>(raw);
            if (parsed is not null)
                return parsed;
        }
        catch
        {
        }

        return raw.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? [new ImageItem { url = raw, publicId = "" }]
            : [];
    }

    private static string NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return "Pending";

        var normalized = status.Trim();
        return normalized is "Pending" or "Confirmed" or "Waived"
            ? normalized
            : "Pending";
    }

    private async Task SyncEquipmentForLossRecordAsync(LossAndDamage record, int userId, string userAgent)
    {
        if (record.IsStockSynced || !record.RoomInventoryId.HasValue)
            return;

        var roomInventory = await _db.RoomInventories
            .Include(ri => ri.Equipment)
            .FirstOrDefaultAsync(ri => ri.Id == record.RoomInventoryId.Value);

        if (roomInventory?.Equipment is null)
            return;

        var equipment = roomInventory.Equipment;
        var quantity = Math.Max(1, record.Quantity);

        equipment.InUseQuantity = Math.Max(0, equipment.InUseQuantity - quantity);
        equipment.DamagedQuantity += quantity;
        equipment.UpdatedAt = DateTime.UtcNow;
        record.IsStockSynced = true;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "CONFIRM_LOSS_DAMAGE_SYNC_STOCK",
            TableName = "Equipments",
            RecordId = equipment.Id,
            OldValue = null,
            NewValue = $"{{\"quantity\": {quantity}, \"reason\": \"Xác nhận biên bản mất/hỏng #{record.Id}\"}}",
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        });
    }

    private async Task RestoreEquipmentForLossRecordAsync(LossAndDamage record, int userId, string userAgent)
    {
        if (!record.IsStockSynced || !record.RoomInventoryId.HasValue)
            return;

        var roomInventory = await _db.RoomInventories
            .Include(ri => ri.Equipment)
            .FirstOrDefaultAsync(ri => ri.Id == record.RoomInventoryId.Value);

        if (roomInventory?.Equipment is null)
            return;

        var equipment = roomInventory.Equipment;
        var quantity = Math.Max(1, record.Quantity);

        equipment.InUseQuantity += quantity;
        equipment.DamagedQuantity = Math.Max(0, equipment.DamagedQuantity - quantity);
        equipment.UpdatedAt = DateTime.UtcNow;
        record.IsStockSynced = false;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "RESTORE_LOSS_DAMAGE_SYNC_STOCK",
            TableName = "Equipments",
            RecordId = equipment.Id,
            OldValue = null,
            NewValue = $"{{\"quantity\": {quantity}, \"reason\": \"Hoàn tác biên bản mất/hỏng #{record.Id}\"}}",
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        });
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var query = _db.LossAndDamages
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(l => l.Status == status);

        if (fromDate.HasValue)
            query = query.Where(l => l.CreatedAt >= fromDate.Value.Date);

        if (toDate.HasValue)
            query = query.Where(l => l.CreatedAt < toDate.Value.Date.AddDays(1));

        var records = await query
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.BookingDetailId,
                l.RoomInventoryId,
                l.Quantity,
                l.PenaltyAmount,
                l.Description,
                l.Status,
                l.IsStockSynced,
                l.CreatedAt,
                l.ReportedBy,
                l.ImgUrl,
                ItemName = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber = l.RoomInventory != null && l.RoomInventory.Room != null ? l.RoomInventory.Room.RoomNumber : null,
                ReporterName = l.Reporter != null ? l.Reporter.FullName : null,
            })
            .ToListAsync();

        var data = records.Select(l => new
        {
            l.Id,
            l.BookingDetailId,
            l.RoomInventoryId,
            l.Quantity,
            l.PenaltyAmount,
            l.Description,
            l.Status,
            l.IsStockSynced,
            l.CreatedAt,
            l.ReportedBy,
            l.ItemName,
            l.RoomNumber,
            l.ReporterName,
            Images = ParseImages(l.ImgUrl)
        }).ToList();

        return Ok(new { data, total = data.Count });
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetById(int id)
    {
        var record = await _db.LossAndDamages
            .AsNoTracking()
            .Where(l => l.Id == id)
            .Select(l => new
            {
                l.Id,
                l.BookingDetailId,
                l.RoomInventoryId,
                l.Quantity,
                l.PenaltyAmount,
                l.Description,
                l.Status,
                l.IsStockSynced,
                l.CreatedAt,
                l.ReportedBy,
                l.ImgUrl,
                ItemName = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber = l.RoomInventory != null && l.RoomInventory.Room != null ? l.RoomInventory.Room.RoomNumber : null,
                ReporterName = l.Reporter != null ? l.Reporter.FullName : null,
            })
            .FirstOrDefaultAsync();

        if (record is null)
            return NotFound(new { message = $"Không tìm thấy biên bản #{id}." });

        return Ok(new
        {
            record.Id,
            record.BookingDetailId,
            record.RoomInventoryId,
            record.Quantity,
            record.PenaltyAmount,
            record.Description,
            record.Status,
            record.IsStockSynced,
            record.CreatedAt,
            record.ReportedBy,
            record.ItemName,
            record.RoomNumber,
            record.ReporterName,
            Images = ParseImages(record.ImgUrl)
        });
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageInventory)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Create([FromForm] CreateLossAndDamageRequest request)
    {
        if (request.Quantity < 1)
            return BadRequest(new { message = "Số lượng phải ít nhất là 1." });

        var userId = JwtHelper.GetUserId(User);
        var userAgent = Request.Headers["User-Agent"].ToString();
        var imageList = new List<ImageItem>();

        if (request.Images != null && request.Images.Any())
        {
            foreach (var file in request.Images)
            {
                using var stream = file.OpenReadStream();
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = "hotel/loss-damage",
                    Transformation = new Transformation().Width(1200).Quality("auto").FetchFormat("auto")
                };
                var result = await _cloudinary.UploadAsync(uploadParams);
                if (result.Error == null)
                    imageList.Add(new ImageItem { url = result.SecureUrl.ToString(), publicId = result.PublicId });
            }
        }

        var record = new LossAndDamage
        {
            BookingDetailId = request.BookingDetailId,
            RoomInventoryId = request.RoomInventoryId,
            ReportedBy = userId,
            Quantity = request.Quantity,
            PenaltyAmount = request.PenaltyAmount,
            Description = request.Description?.Trim(),
            Status = NormalizeStatus(request.Status),
            IsStockSynced = false,
            CreatedAt = DateTime.UtcNow,
            ImgUrl = imageList.Any() ? JsonSerializer.Serialize(imageList) : null
        };

        _db.LossAndDamages.Add(record);
        if (record.Status == "Confirmed")
            await SyncEquipmentForLossRecordAsync(record, userId, userAgent);

        await _db.SaveChangesAsync();

        var roomNumber = "N/A";
        if (record.RoomInventoryId.HasValue)
        {
            roomNumber = await _db.RoomInventories
                .Where(ri => ri.Id == record.RoomInventoryId.Value)
                .Select(ri => ri.Room != null ? ri.Room.RoomNumber : null)
                .FirstOrDefaultAsync() ?? "N/A";
        }

        var notification = new Notification
        {
            Title = "Biên bản mới đã được lập",
            Message = $"Một biên bản bồi thường mới đã được tạo cho phòng {roomNumber}.",
            Type = NotificationType.Success,
            Action = NotificationAction.CreateLossReport
        };

        _ = _notificationService.SendToRolesAsync(new[] { "Admin", "Manager" }, notification.Title, notification.Message, notification.Action.ToString());

        return StatusCode(201, new
        {
            message = record.Status == "Confirmed"
                ? "Tạo biên bản thành công và đã đồng bộ kho sau khi xác nhận."
                : "Tạo biên bản thành công. Kho sẽ chỉ được đồng bộ khi biên bản được xác nhận.",
            id = record.Id,
            isStockSynced = record.IsStockSynced,
            notification
        });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateLossAndDamageRequest request)
    {
        if (request.Quantity < 1)
            return BadRequest(new { message = "Số lượng phải ít nhất là 1." });

        var record = await _db.LossAndDamages.FirstOrDefaultAsync(l => l.Id == id);
        if (record is null)
            return NotFound(new { message = $"Không tìm thấy biên bản #{id}." });

        var userId = JwtHelper.GetUserId(User);
        var userAgent = Request.Headers["User-Agent"].ToString();
        var oldStatus = record.Status;
        var oldQuantity = record.Quantity;

        var currentImages = new List<ImageItem>();
        if (!string.IsNullOrEmpty(record.ImgUrl))
        {
            try { currentImages = JsonSerializer.Deserialize<List<ImageItem>>(record.ImgUrl) ?? new(); }
            catch { }
        }

        var imagesToKeep = new List<string>();
        if (!string.IsNullOrEmpty(request.KeepImagesJson))
            imagesToKeep = JsonSerializer.Deserialize<List<string>>(request.KeepImagesJson) ?? new();

        var imagesToRemove = currentImages.Where(ci => !imagesToKeep.Contains(ci.url)).ToList();
        foreach (var img in imagesToRemove.Where(x => !string.IsNullOrWhiteSpace(x.publicId)))
            await _cloudinary.DestroyAsync(new DeletionParams(img.publicId));

        var finalImages = currentImages.Where(ci => imagesToKeep.Contains(ci.url)).ToList();

        if (request.Images != null && request.Images.Any())
        {
            foreach (var file in request.Images)
            {
                using var stream = file.OpenReadStream();
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = "hotel/loss-damage",
                    Transformation = new Transformation().Width(1200).Quality("auto").FetchFormat("auto")
                };
                var result = await _cloudinary.UploadAsync(uploadParams);
                if (result.Error == null)
                    finalImages.Add(new ImageItem { url = result.SecureUrl.ToString(), publicId = result.PublicId });
            }
        }

        if (record.IsStockSynced)
            await RestoreEquipmentForLossRecordAsync(record, userId, userAgent);

        record.Quantity = request.Quantity;
        record.PenaltyAmount = request.PenaltyAmount;
        record.Description = request.Description?.Trim();
        record.Status = NormalizeStatus(request.Status);
        record.ImgUrl = finalImages.Any() ? JsonSerializer.Serialize(finalImages) : null;

        if (record.Status == "Confirmed")
            await SyncEquipmentForLossRecordAsync(record, userId, userAgent);

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title = "Cập nhật biên bản thành công",
            Message = $"Thông tin biên bản #{id} đã được cập nhật.",
            Type = NotificationType.Success,
            Action = NotificationAction.UpdateLossReport
        };

        return Ok(new
        {
            message = oldStatus != record.Status || oldQuantity != record.Quantity
                ? "Cập nhật biên bản thành công và đã đối chiếu lại tồn kho theo trạng thái mới."
                : "Cập nhật biên bản thành công.",
            imgUrl = record.ImgUrl,
            isStockSynced = record.IsStockSynced,
            notification
        });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Delete(int id)
    {
        var record = await _db.LossAndDamages.FirstOrDefaultAsync(l => l.Id == id);
        if (record is null)
            return NotFound(new { message = $"Không tìm thấy biên bản #{id}." });

        var userId = JwtHelper.GetUserId(User);
        var userAgent = Request.Headers["User-Agent"].ToString();

        if (record.IsStockSynced)
            await RestoreEquipmentForLossRecordAsync(record, userId, userAgent);

        if (!string.IsNullOrEmpty(record.ImgUrl))
        {
            try
            {
                var images = JsonSerializer.Deserialize<List<ImageItem>>(record.ImgUrl);
                if (images != null)
                {
                    foreach (var img in images.Where(x => !string.IsNullOrWhiteSpace(x.publicId)))
                        await _cloudinary.DestroyAsync(new DeletionParams(img.publicId));
                }
            }
            catch
            {
            }
        }

        _db.LossAndDamages.Remove(record);
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title = "Đã xóa biên bản",
            Message = $"Biên bản bồi thường #{id} đã được xóa thành công.",
            Type = NotificationType.Success,
            Action = NotificationAction.DeleteLossReport
        };

        return Ok(new
        {
            message = "Đã xóa biên bản và hoàn tác tồn kho nếu biên bản đã từng được xác nhận.",
            notification
        });
    }
}

public class CreateLossAndDamageRequest
{
    public int? BookingDetailId { get; set; }
    public int? RoomInventoryId { get; set; }
    public int Quantity { get; set; }
    public decimal PenaltyAmount { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public List<IFormFile>? Images { get; set; }
}

public class UpdateLossAndDamageRequest
{
    public int Quantity { get; set; }
    public decimal PenaltyAmount { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = null!;
    public List<IFormFile>? Images { get; set; }
    public string? KeepImagesJson { get; set; }
}
