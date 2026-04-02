using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using System.Text.Json;
using HotelManagement.API.Services;
using HotelManagement.Core.Models.Enums;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LossAndDamagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cloudinary   _cloudinary;
    private readonly INotificationService _notificationService;

    public LossAndDamagesController(AppDbContext db, Cloudinary cloudinary, INotificationService notificationService)
    {
        _db                  = db;
        _cloudinary          = cloudinary;
        _notificationService = notificationService;
    }

    // Đối tượng hỗ trợ lưu trữ JSON trong DB
    private class ImageItem { public string url { get; set; } = ""; public string publicId { get; set; } = ""; }
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

        if (!string.IsNullOrEmpty(status))
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
                l.CreatedAt,
                l.ReportedBy,
                l.ImgUrl, // Lưu ý: cái này bây giờ là chuỗi JSON mảng ảnh
                ItemName     = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber   = l.RoomInventory != null && l.RoomInventory.Room != null
                                 ? l.RoomInventory.Room.RoomNumber : null,
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
                l.CreatedAt,
                l.ReportedBy,
                l.ImgUrl,
                ItemName     = l.RoomInventory != null && l.RoomInventory.Equipment != null ? l.RoomInventory.Equipment.Name : null,
                RoomNumber   = l.RoomInventory != null && l.RoomInventory.Room != null
                                 ? l.RoomInventory.Room.RoomNumber : null,
                ReporterName = l.Reporter != null ? l.Reporter.FullName : null,
            })
            .FirstOrDefaultAsync();

        if (record is null) return NotFound(new { message = $"Không tìm thấy biên bản #{id}." });
        return Ok(new
        {
            record.Id,
            record.BookingDetailId,
            record.RoomInventoryId,
            record.Quantity,
            record.PenaltyAmount,
            record.Description,
            record.Status,
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
        if (request.Quantity < 1) return BadRequest(new { message = "Số lượng phải ít nhất là 1." });

        var userId = JwtHelper.GetUserId(User);
        var imageList = new List<ImageItem>();

        // Xử lý upload nhiều ảnh nếu có
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
            ReportedBy      = userId,
            Quantity        = request.Quantity,
            PenaltyAmount   = request.PenaltyAmount,
            Description     = request.Description?.Trim(),
            Status          = request.Status ?? "Pending",
            CreatedAt       = DateTime.UtcNow,
            ImgUrl        = imageList.Any() ? JsonSerializer.Serialize(imageList) : null
        };

        _db.LossAndDamages.Add(record);
        await _db.SaveChangesAsync();

        // Tự động trừ tồn kho khi lập biên bản từ vật tư phòng.
        if (record.RoomInventoryId.HasValue)
        {
            var roomInventory = await _db.RoomInventories
                .Include(ri => ri.Equipment)
                .FirstOrDefaultAsync(ri => ri.Id == record.RoomInventoryId.Value);

            if (roomInventory?.Equipment is not null)
            {
                var equipment = roomInventory.Equipment;
                var deductQty = Math.Max(1, record.Quantity);

                equipment.InUseQuantity = Math.Max(0, equipment.InUseQuantity - deductQty);
                equipment.DamagedQuantity += deductQty;

                _db.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    Action = "DEDUCT_EQUIPMENT",
                    TableName = "Equipments",
                    RecordId = equipment.Id,
                    OldValue = null,
                    NewValue = $"{{\"quantity\": {deductQty}, \"reason\": \"Ghi nhận từ biên bản mất/hư #{record.Id}\"}}",
                    UserAgent = Request.Headers["User-Agent"].ToString(),
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
            }
        }

        // Lấy thông tin số phòng để gửi thông báo chi tiết hơn
        var roomNumber = "N/A";
        if (record.RoomInventoryId.HasValue)
        {
            roomNumber = await _db.RoomInventories
                .Where(ri => ri.Id == record.RoomInventoryId)
                .Select(ri => ri.Room!.RoomNumber)
                .FirstOrDefaultAsync() ?? "N/A";
        }

        var notification = new Notification
        {
            Title   = "Biên bản mới đã được lập",
            Message = $"Một biên bản bồi thường mới đã được tạo cho phòng {roomNumber}.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.CreateLossReport
        };

        // Bắn SignalR cho Admin và Manager
        _ = _notificationService.SendToRolesAsync(new[] { "Admin", "Manager" }, notification.Title, notification.Message, notification.Action.ToString());

        return StatusCode(201, new { message = "Tạo biên bản thành công.", id = record.Id, notification });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateLossAndDamageRequest request)
    {
        var record = await _db.LossAndDamages.FirstOrDefaultAsync(l => l.Id == id);
        if (record is null) return NotFound(new { message = $"Không tìm thấy biên bản #{id}." });

        // 1. Phân tích ảnh cũ
        var currentImages = new List<ImageItem>();
        if (!string.IsNullOrEmpty(record.ImgUrl))
        {
            try { currentImages = JsonSerializer.Deserialize<List<ImageItem>>(record.ImgUrl) ?? new(); }
            catch { /* fallback nếu không phải json */ }
        }

        // 2. Xác định ảnh cần giữ lại (Frontend gửi về danh sách URL muốn giữ)
        var imagesToKeep = new List<string>();
        if (!string.IsNullOrEmpty(request.KeepImagesJson))
        {
            imagesToKeep = JsonSerializer.Deserialize<List<string>>(request.KeepImagesJson) ?? new();
        }

        // 3. Xóa các ảnh không được giữ lại trên Cloudinary
        var imagesToRemove = currentImages.Where(ci => !imagesToKeep.Contains(ci.url)).ToList();
        foreach (var img in imagesToRemove)
        {
            await _cloudinary.DestroyAsync(new DeletionParams(img.publicId));
        }

        // 4. Danh sách ảnh mới sau khi lọc
        var finalImages = currentImages.Where(ci => imagesToKeep.Contains(ci.url)).ToList();

        // 5. Upload các ảnh mới thêm vào
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

        record.Quantity      = request.Quantity;
        record.PenaltyAmount = request.PenaltyAmount;
        record.Description   = request.Description?.Trim();
        record.Status        = request.Status;
        record.ImgUrl      = finalImages.Any() ? JsonSerializer.Serialize(finalImages) : null;

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Cập nhật biên bản thành công",
            Message = $"Thông tin biên bản #{id} đã được cập nhật.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateLossReport
        };

        return Ok(new { message = "Cập nhật biên bản thành công.", imgUrl = record.ImgUrl, notification });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> Delete(int id)
    {
        var record = await _db.LossAndDamages.FirstOrDefaultAsync(l => l.Id == id);
        if (record is null) return NotFound(new { message = $"Không tìm thấy biên bản #{id}." });

        // Xóa tất cả ảnh trên Cloudinary
        if (!string.IsNullOrEmpty(record.ImgUrl))
        {
            try {
                var images = JsonSerializer.Deserialize<List<ImageItem>>(record.ImgUrl);
                if (images != null) {
                    foreach (var img in images) await _cloudinary.DestroyAsync(new DeletionParams(img.publicId));
                }
            } catch { }
        }

        _db.LossAndDamages.Remove(record);
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Đã xóa biên bản",
            Message = $"Biên bản bồi thường #{id} đã được xóa thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.DeleteLossReport
        };

        return Ok(new { message = $"Đã xóa biên bản #{id}.", notification });
    }
}

public class CreateLossAndDamageRequest
{
    public int?            BookingDetailId { get; set; }
    public int?            RoomInventoryId { get; set; }
    public int             Quantity { get; set; }
    public decimal         PenaltyAmount { get; set; }
    public string?         Description { get; set; }
    public string?         Status { get; set; }
    public List<IFormFile>? Images { get; set; } // Upload nhiều file
}

public class UpdateLossAndDamageRequest
{
    public int             Quantity { get; set; }
    public decimal         PenaltyAmount { get; set; }
    public string?         Description { get; set; }
    public string          Status { get; set; } = null!;
    public List<IFormFile>? Images { get; set; } // File ảnh mới tải lên
    public string?         KeepImagesJson { get; set; } // JSON mảng URL các ảnh cũ muốn giữ lại
}
