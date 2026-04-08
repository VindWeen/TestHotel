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

    private static int ComputeRemainingToReplenish(LossAndDamage record)
        => Math.Max(0, Math.Max(1, record.Quantity) - Math.Max(0, record.ReplenishedQuantity));

    private static string ComputeRoomStatus(string businessStatus, string cleaningStatus)
        => businessStatus switch
        {
            "Occupied" => "Occupied",
            "Disabled" => "Maintenance",
            "Available" when cleaningStatus is "Dirty" or "PendingLoss" => "Cleaning",
            _ => "Available"
        };

    private async Task<int?> ResolveRoomIdAsync(LossAndDamage record)
    {
        if (record.RoomInventoryId.HasValue)
        {
            return await _db.RoomInventories
                .Where(ri => ri.Id == record.RoomInventoryId.Value)
                .Select(ri => (int?)ri.RoomId)
                .FirstOrDefaultAsync();
        }

        if (record.BookingDetailId.HasValue)
        {
            return await _db.BookingDetails
                .Where(bd => bd.Id == record.BookingDetailId.Value)
                .Select(bd => bd.RoomId)
                .FirstOrDefaultAsync();
        }

        return null;
    }

    private async Task<int?> ResolveBookingDetailIdForRoomInventoryAsync(int roomInventoryId)
    {
        var roomId = await _db.RoomInventories
            .Where(ri => ri.Id == roomInventoryId)
            .Select(ri => ri.RoomId)
            .FirstOrDefaultAsync();

        if (roomId <= 0)
            return null;

        return await _db.BookingDetails
            .Where(bd =>
                bd.RoomId == roomId &&
                bd.Booking != null &&
                (bd.Booking.Status == "Checked_out_pending_settlement" ||
                 bd.Booking.Status == "Completed"))
            .OrderByDescending(bd => bd.Booking!.CheckOutTime ?? bd.CheckOutDate)
            .ThenByDescending(bd => bd.Id)
            .Select(bd => (int?)bd.Id)
            .FirstOrDefaultAsync();
    }

    private async Task SyncRoomCleaningStatusForLossAsync(LossAndDamage record)
    {
        var roomId = await ResolveRoomIdAsync(record);
        if (!roomId.HasValue)
            return;

        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == roomId.Value);
        if (room is null || room.BusinessStatus != "Available")
            return;

        var hasPendingLoss = await _db.LossAndDamages
            .Where(l => l.Id != record.Id && (l.Status == "Pending" || (l.Status == "Confirmed" && l.ReplenishedQuantity < l.Quantity)))
            .AnyAsync(l =>
                (l.RoomInventoryId.HasValue && l.RoomInventory != null && l.RoomInventory.RoomId == roomId.Value)
                || (l.BookingDetailId.HasValue && l.BookingDetail != null && l.BookingDetail.RoomId == roomId.Value));

        if (record.Status == "Pending" || (record.Status == "Confirmed" && ComputeRemainingToReplenish(record) > 0))
            hasPendingLoss = true;

        if (hasPendingLoss)
        {
            if (room.CleaningStatus == "Clean" || room.CleaningStatus == "PendingLoss")
            {
                room.CleaningStatus = "PendingLoss";
                room.Status = ComputeRoomStatus(room.BusinessStatus, room.CleaningStatus);
            }

            return;
        }

        if (room.CleaningStatus == "PendingLoss")
        {
            room.CleaningStatus = "Clean";
            room.Status = ComputeRoomStatus(room.BusinessStatus, room.CleaningStatus);
        }
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
        var shortageQuantity = Math.Max(0, quantity - Math.Max(0, record.ReplenishedQuantity));

        roomInventory.Quantity = Math.Max(0, (roomInventory.Quantity ?? 0) - shortageQuantity);
        roomInventory.IsActive = (roomInventory.Quantity ?? 0) > 0;
        roomInventory.Note ??= record.Description;
        equipment.InUseQuantity = Math.Max(0, equipment.InUseQuantity - shortageQuantity);
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
        var shortageQuantity = Math.Max(0, quantity - Math.Max(0, record.ReplenishedQuantity));

        roomInventory.Quantity = Math.Max(0, roomInventory.Quantity ?? 0) + shortageQuantity;
        roomInventory.IsActive = true;
        equipment.InUseQuantity += shortageQuantity;
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
                l.ReplenishedQuantity,
                l.ReplenishedAt,
                l.ReplenishmentNote,
                l.CreatedAt,
                l.ReportedBy,
                l.ImgUrl,
                ItemName = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber = l.RoomInventory != null && l.RoomInventory.Room != null ? l.RoomInventory.Room.RoomNumber : null,
                ReporterName = l.Reporter != null ? l.Reporter.FullName : null,
                AvailableStock = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.InStockQuantity : 0,
                RoomInventoryQuantity = l.RoomInventory != null ? l.RoomInventory.Quantity : null,
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
            l.ReplenishedQuantity,
            l.ReplenishedAt,
            l.ReplenishmentNote,
            RemainingToReplenish = Math.Max(0, l.Quantity - l.ReplenishedQuantity),
            l.CreatedAt,
            l.ReportedBy,
            l.ItemName,
            l.RoomNumber,
            l.ReporterName,
            l.AvailableStock,
            l.RoomInventoryQuantity,
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
                l.ReplenishedQuantity,
                l.ReplenishedAt,
                l.ReplenishmentNote,
                l.CreatedAt,
                l.ReportedBy,
                l.ImgUrl,
                ItemName = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber = l.RoomInventory != null && l.RoomInventory.Room != null ? l.RoomInventory.Room.RoomNumber : null,
                ReporterName = l.Reporter != null ? l.Reporter.FullName : null,
                AvailableStock = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.InStockQuantity : 0,
                RoomInventoryQuantity = l.RoomInventory != null ? l.RoomInventory.Quantity : null,
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
            record.ReplenishedQuantity,
            record.ReplenishedAt,
            record.ReplenishmentNote,
            RemainingToReplenish = Math.Max(0, record.Quantity - record.ReplenishedQuantity),
            record.CreatedAt,
            record.ReportedBy,
            record.ItemName,
            record.RoomNumber,
            record.ReporterName,
            record.AvailableStock,
            record.RoomInventoryQuantity,
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

        if (!record.BookingDetailId.HasValue && record.RoomInventoryId.HasValue)
            record.BookingDetailId = await ResolveBookingDetailIdForRoomInventoryAsync(record.RoomInventoryId.Value);

        _db.LossAndDamages.Add(record);
        if (record.Status == "Confirmed")
            await SyncEquipmentForLossRecordAsync(record, userId, userAgent);

        await _db.SaveChangesAsync();
        await SyncRoomCleaningStatusForLossAsync(record);
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

        if (request.Quantity < record.ReplenishedQuantity)
            return BadRequest(new { message = "S? l??ng kh?ng ???c nh? h?n ph?n ?? b? sung." });

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
        if (record.ReplenishedQuantity > record.Quantity)
            record.ReplenishedQuantity = record.Quantity;
        if (record.ReplenishedQuantity < Math.Max(1, record.Quantity))
            record.ReplenishedAt = null;
        record.ImgUrl = finalImages.Any() ? JsonSerializer.Serialize(finalImages) : null;

        if (record.Status == "Confirmed")
            await SyncEquipmentForLossRecordAsync(record, userId, userAgent);

        await _db.SaveChangesAsync();
        await SyncRoomCleaningStatusForLossAsync(record);
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
        await SyncRoomCleaningStatusForLossAsync(record);
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

    [HttpPost("{id:int}/replenish")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Replenish(int id, [FromBody] ReplenishLossAndDamageRequest request)
    {
        if (request.Quantity < 1)
            return BadRequest(new { message = "S? l??ng b? sung ph?i l?n h?n 0." });

        var record = await _db.LossAndDamages
            .Include(l => l.RoomInventory)
                .ThenInclude(ri => ri!.Equipment)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (record is null)
            return NotFound(new { message = $"Kh?ng t?m th?y bi?n b?n #{id}." });

        if (record.Status != "Confirmed")
            return BadRequest(new { message = "Ch? c? th? b? sung sau khi bi?n b?n ?? x?c nh?n." });

        if (!record.RoomInventoryId.HasValue || record.RoomInventory?.Equipment is null)
            return BadRequest(new { message = "Bi?n b?n n?y kh?ng g?n v?i v?t t? ph?ng ?? b? sung." });

        var remaining = ComputeRemainingToReplenish(record);
        if (remaining <= 0)
            return BadRequest(new { message = "Bi?n b?n n?y ?? b? sung ??." });

        var roomInventory = record.RoomInventory;
        var equipment = roomInventory.Equipment;
        var availableStock = Math.Max(0, equipment.InStockQuantity);
        if (availableStock <= 0)
            return BadRequest(new
            {
                message = "Kho hi?n kh?ng c?n t?n kh? d?ng ?? b? sung.",
                remainingToReplenish = remaining,
                availableStock
            });

        var actualQuantity = Math.Min(request.Quantity, Math.Min(remaining, availableStock));

        roomInventory.Quantity = Math.Max(0, roomInventory.Quantity ?? 0) + actualQuantity;
        roomInventory.IsActive = true;
        if (!string.IsNullOrWhiteSpace(request.Note))
            roomInventory.Note = request.Note.Trim();

        equipment.InUseQuantity += actualQuantity;
        equipment.UpdatedAt = DateTime.UtcNow;

        record.ReplenishedQuantity += actualQuantity;
        if (record.ReplenishedQuantity >= Math.Max(1, record.Quantity))
            record.ReplenishedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Note))
            record.ReplenishmentNote = request.Note.Trim();

        await _db.SaveChangesAsync();
        await SyncRoomCleaningStatusForLossAsync(record);
        await _db.SaveChangesAsync();

        var remainingAfter = ComputeRemainingToReplenish(record);
        return Ok(new
        {
            message = remainingAfter == 0
                ? "?? b? sung ?? v?t t? cho ph?ng."
                : $"?? b? sung {actualQuantity} v? c?n thi?u {remainingAfter}.",
            replenishedQuantity = actualQuantity,
            totalReplenishedQuantity = record.ReplenishedQuantity,
            remainingToReplenish = remainingAfter,
            roomInventoryQuantity = roomInventory.Quantity,
            availableStock = Math.Max(0, equipment.InStockQuantity)
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

public class ReplenishLossAndDamageRequest
{
    public int Quantity { get; set; }
    public string? Note { get; set; }
}
