using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoomTypesController : ControllerBase
{
    private readonly AppDbContext _context; // Changed _db to _context
    private readonly Cloudinary _cloudinary;
    private readonly IActivityLogService _activityLog; // Added IActivityLogService

    public RoomTypesController(AppDbContext context, Cloudinary cloudinary, IActivityLogService activityLog) // Modified constructor
    {
        _context = context; // Changed _db = db to _context = context
        _cloudinary = cloudinary;
        _activityLog = activityLog; // Assigned activityLog
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/RoomTypes  [Public]
    // Danh sách is_active=1 kèm ảnh primary và amenities.
    // Dùng cho trang tìm kiếm phòng.
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var roomTypes = await _context.RoomTypes // Changed _db.RoomTypes to _context.RoomTypes
            .AsNoTracking()
            .Where(rt => rt.IsActive)
            .Select(rt => new
            {
                rt.Id,
                rt.Name,
                rt.Slug,
                rt.BasePrice,
                rt.CapacityAdults,
                rt.CapacityChildren,
                rt.AreaSqm,
                rt.BedType,
                rt.ViewType,
                rt.Description,
                PrimaryImage = rt.RoomImages
                    .Where(img => img.IsActive && img.IsPrimary == true)
                    .Select(img => new { img.Id, img.ImageUrl, img.SortOrder })
                    .FirstOrDefault(),
                Amenities = rt.RoomTypeAmenities
                    .Where(rta => rta.Amenity.IsActive)
                    .Select(rta => new
                    {
                        rta.Amenity.Id,
                        rta.Amenity.Name,
                        rta.Amenity.IconUrl
                    })
                    .ToList()
            })
            .OrderBy(rt => rt.Name)
            .ToListAsync();

        return Ok(roomTypes);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/RoomTypes/{id}  [Public]
    // Chi tiết 1 loại phòng: toàn bộ ảnh (sort_order) + amenities.
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var roomType = await _context.RoomTypes // Changed _db.RoomTypes to _context.RoomTypes
            .AsNoTracking()
            .Where(rt => rt.Id == id && rt.IsActive)
            .Select(rt => new
            {
                rt.Id,
                rt.Name,
                rt.Slug,
                rt.BasePrice,
                rt.CapacityAdults,
                rt.CapacityChildren,
                rt.AreaSqm,
                rt.BedType,
                rt.ViewType,
                rt.Description,
                Images = rt.RoomImages
                    .Where(img => img.IsActive)
                    .OrderBy(img => img.SortOrder)
                    .Select(img => new
                    {
                        img.Id,
                        img.ImageUrl,
                        img.IsPrimary,
                        img.SortOrder
                    })
                    .ToList(),
                Amenities = rt.RoomTypeAmenities
                    .Where(rta => rta.Amenity.IsActive)
                    .Select(rta => new
                    {
                        rta.Amenity.Id,
                        rta.Amenity.Name,
                        rta.Amenity.IconUrl
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (roomType is null)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{id}." });

        return Ok(roomType);
    }

    // ──────────────────────────────────────────────────────────────
    // DELETE /api/RoomTypes/{id}  [MANAGE_ROOMS]
    // Soft Delete: is_active = 0.
    // Không xóa khi đang có Booking active (Pending / Confirmed / Checked_in).
    // ──────────────────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Delete(int id)
    {
        var roomType = await _context.RoomTypes // Changed _db.RoomTypes to _context.RoomTypes
            .FirstOrDefaultAsync(rt => rt.Id == id && rt.IsActive);

        if (roomType is null)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{id}." });

        // Kiểm tra có booking active không:
        // BookingDetail.RoomTypeId = id, Booking.Status thuộc nhóm chưa kết thúc
        var activeStatuses = new[] { "Pending", "Confirmed", "Checked_in" };

        var hasActiveBooking = await _context.BookingDetails // Changed _db.BookingDetails to _context.BookingDetails
            .AnyAsync(bd =>
                bd.RoomTypeId == id &&
                bd.Booking != null &&
                activeStatuses.Contains(bd.Booking.Status));

        if (hasActiveBooking)
            return BadRequest(new
            {
                message = "Không thể xóa loại phòng đang có booking chưa hoàn tất."
            });

        roomType.IsActive = false;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "DELETE_ROOM_TYPE",
            actionLabel: "Xóa loại phòng",
            message: $"Admin đã xóa loại phòng '{roomType.Name}'.", // Changed rt.Name to roomType.Name
            entityType: "RoomType",
            entityId: id,
            entityLabel: roomType.Name, // Changed rt.Name to roomType.Name
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = currentUserId,
            Action = "DELETE_ROOM_TYPE",
            TableName = "RoomTypes",
            RecordId = id,
            OldValue = $"{{\"isActive\": true, \"name\": \"{roomType.Name}\"}}",
            NewValue = "{\"isActive\": false}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(); // Changed _db.SaveChangesAsync() to _context.SaveChangesAsync()

        return Ok(new { message = $"Đã xóa loại phòng '{roomType.Name}'." });
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/RoomTypes/{id}/images  [MANAGE_ROOMS]
    // Upload ảnh lên Cloudinary → INSERT Room_Images.
    // Nếu chưa có ảnh nào → tự động set is_primary = 1.
    // ──────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/images")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var roomType = await _context.RoomTypes // Changed _db.RoomTypes to _context.RoomTypes
            .FirstOrDefaultAsync(rt => rt.Id == id && rt.IsActive);

        if (roomType is null)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{id}." });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "File ảnh không hợp lệ." });

        // Upload lên Cloudinary
        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = $"hotel/room-types/{id}",
            Transformation = new Transformation().Quality("auto").FetchFormat("auto")
        };

        var uploadResult = await _cloudinary.UploadAsync(uploadParams);

        if (uploadResult.Error is not null)
            return StatusCode(500, new { message = $"Upload thất bại: {uploadResult.Error.Message}" });

        // Xác định sort_order tiếp theo
        var maxSortOrder = await _context.RoomImages // Changed _db.RoomImages to _context.RoomImages
            .Where(img => img.RoomTypeId == id && img.IsActive)
            .Select(img => (int?)img.SortOrder)
            .MaxAsync() ?? -1;

        // Nếu chưa có ảnh nào → ảnh đầu tiên tự động là primary
        var hasPrimary = await _context.RoomImages // Changed _db.RoomImages to _context.RoomImages
            .AnyAsync(img => img.RoomTypeId == id && img.IsActive && img.IsPrimary == true);

        var image = new RoomImage
        {
            RoomTypeId = id,
            ImageUrl = uploadResult.SecureUrl.ToString(),
            CloudinaryPublicId = uploadResult.PublicId,
            IsPrimary = !hasPrimary,   // true nếu đây là ảnh đầu tiên
            SortOrder = maxSortOrder + 1,
            IsActive = true
        };

        _context.RoomImages.Add(image); // Changed _db.RoomImages.Add to _context.RoomImages.Add

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "UPLOAD_ROOM_IMAGE",
            actionLabel: "Tải ảnh loại phòng",
            message: $"Đã tải ảnh mới cho loại phòng '{roomType.Name}'.",
            entityType: "RoomImage",
            entityId: image.Id,
            entityLabel: image.ImageUrl,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = currentUserId,
            Action = "UPLOAD_ROOM_IMAGE",
            TableName = "RoomImages",
            RecordId = image.Id,
            OldValue = null,
            NewValue = $"{{\"url\": \"{image.ImageUrl}\", \"roomTypeId\": {id}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(); // Changed _db.SaveChangesAsync() to _context.SaveChangesAsync()

        return StatusCode(201, new
        {
            message = "Upload ảnh thành công.",
            image.Id,
            image.ImageUrl,
            image.IsPrimary,
            image.SortOrder
        });
    }

    // ──────────────────────────────────────────────────────────────
    // DELETE /api/RoomTypes/images/{imageId}  [MANAGE_ROOMS]
    // Logic kép: Soft Delete DB (is_active = 0) + DestroyAsync Cloudinary.
    // ──────────────────────────────────────────────────────────────
    [HttpDelete("images/{imageId:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> DeleteImage(int imageId)
    {
        var image = await _context.RoomImages // Changed _db.RoomImages to _context.RoomImages
            .FirstOrDefaultAsync(img => img.Id == imageId && img.IsActive);

        if (image is null)
            return NotFound(new { message = $"Không tìm thấy ảnh #{imageId}." });

        // Xóa file vật lý trên Cloudinary nếu có publicId
        if (!string.IsNullOrWhiteSpace(image.CloudinaryPublicId))
        {
            var deleteResult = await _cloudinary.DestroyAsync(
                new DeletionParams(image.CloudinaryPublicId));

            // Ghi log nếu Cloudinary xóa thất bại, nhưng vẫn tiếp tục soft delete DB
            if (deleteResult.Error is not null)
                Console.WriteLine($"[Cloudinary] Xóa ảnh {image.CloudinaryPublicId} thất bại: {deleteResult.Error.Message}");
        }

        // Soft delete DB
        image.IsActive = false;

        var currentUserId = JwtHelper.GetUserId(User);
        await _activityLog.LogAsync(
            actionCode: "DELETE_ROOM_IMAGE",
            actionLabel: "Xóa ảnh loại phòng",
            message: $"Đã xóa ảnh '{image.ImageUrl}' của loại phòng.",
            entityType: "RoomImage",
            entityId: imageId,
            entityLabel: image.ImageUrl,
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        await _context.SaveChangesAsync(); // Changed _db.SaveChangesAsync() to _context.SaveChangesAsync()

        return Ok(new { message = "Đã xóa ảnh thành công." });
    }

    // ──────────────────────────────────────────────────────────────
    // PATCH /api/RoomTypes/{roomTypeId}/images/{imageId}/set-primary  [MANAGE_ROOMS]
    // Transaction: UPDATE tất cả ảnh → is_primary=0, rồi imageId → is_primary=1.
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{roomTypeId:int}/images/{imageId:int}/set-primary")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> SetPrimaryImage(int roomTypeId, int imageId)
    {
        // Kiểm tra loại phòng tồn tại
        var roomType = await _context.RoomTypes // Changed _db.RoomTypes to _context.RoomTypes
            .FirstOrDefaultAsync(rt => rt.Id == roomTypeId && rt.IsActive);

        if (roomType is null) // Changed roomTypeExists to roomType
            return NotFound(new { message = $"Không tìm thấy loại phòng #{roomTypeId}." });

        // Kiểm tra ảnh thuộc đúng loại phòng này
        var targetImage = await _context.RoomImages // Changed _db.RoomImages to _context.RoomImages
            .FirstOrDefaultAsync(img =>
                img.Id == imageId &&
                img.RoomTypeId == roomTypeId &&
                img.IsActive);

        if (targetImage is null)
            return NotFound(new { message = $"Không tìm thấy ảnh #{imageId} trong loại phòng #{roomTypeId}." });

        // Transaction: reset tất cả → set ảnh mới
        await using var transaction = await _context.Database.BeginTransactionAsync(); // Changed _db.Database to _context.Database

        try
        {
            // Bước 1: Bỏ primary tất cả ảnh của loại phòng này
            await _context.RoomImages // Changed _db.RoomImages to _context.RoomImages
                .Where(img => img.RoomTypeId == roomTypeId && img.IsActive && img.IsPrimary == true)
                .ExecuteUpdateAsync(s => s.SetProperty(img => img.IsPrimary, false));

            // Bước 2: Set ảnh được chọn là primary
            targetImage.IsPrimary = true;
            await _context.SaveChangesAsync(); // Changed _db.SaveChangesAsync() to _context.SaveChangesAsync()

            var currentUserId = JwtHelper.GetUserId(User);
            await _activityLog.LogAsync(
                actionCode: "SET_PRIMARY_ROOM_IMAGE",
                actionLabel: "Đặt ảnh chính loại phòng",
                message: $"Đã đặt ảnh '{targetImage.ImageUrl}' làm ảnh chính cho loại phòng '{roomType.Name}'.",
                entityType: "RoomImage",
                entityId: imageId,
                entityLabel: targetImage.ImageUrl,
                severity: "Info",
                userId: currentUserId,
                roleName: User.FindFirst("role")?.Value
            );

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { message = "Cập nhật ảnh chính thất bại." });
        }

        return Ok(new { message = $"Đã đặt ảnh #{imageId} làm ảnh chính." });
    }

    // ──────────────────────────────────────────────────────────────
    // PATCH /api/RoomTypes/{id}/toggle-active  [MANAGE_ROOMS]
    // Bật/tắt loại phòng: is_active = 1 ↔ 0
    // Không cho tắt khi đang có Booking active
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var roomType = await _context.RoomTypes.FindAsync(id); // Changed _db.RoomTypes to _context.RoomTypes

        if (roomType is null)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{id}." });

        // Không cho tắt khi đang có booking active
        if (roomType.IsActive)
        {
            var activeStatuses = new[] { "Pending", "Confirmed", "Checked_in" };

            var hasActiveBooking = await _context.BookingDetails // Changed _db.BookingDetails to _context.BookingDetails
                .AnyAsync(bd =>
                    bd.RoomTypeId == id &&
                    bd.Booking != null &&
                    activeStatuses.Contains(bd.Booking.Status));

            if (hasActiveBooking)
                return BadRequest(new
                {
                    message = "Không thể vô hiệu hóa loại phòng đang có booking chưa hoàn tất."
                });
        }

        var oldActive = roomType.IsActive;
        roomType.IsActive = !roomType.IsActive;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: roomType.IsActive ? "ENABLE_ROOM_TYPE" : "DISABLE_ROOM_TYPE", // Changed rt.IsActive to roomType.IsActive
            actionLabel: roomType.IsActive ? "Kích hoạt loại phòng" : "Vô hiệu hóa loại phòng", // Changed rt.IsActive to roomType.IsActive
            message: $"Loại phòng '{roomType.Name}' đã {(roomType.IsActive ? "được kích hoạt" : "bị vô hiệu hóa")}.", // Changed rt.Name to roomType.Name and rt.IsActive to roomType.IsActive
            entityType: "RoomType",
            entityId: id,
            entityLabel: roomType.Name, // Changed rt.Name to roomType.Name
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        await _context.SaveChangesAsync(); // Changed _db.SaveChangesAsync() to _context.SaveChangesAsync()

        var action = roomType.IsActive ? "kích hoạt" : "vô hiệu hóa";
        return Ok(new
        {
            message = $"Đã {action} loại phòng '{roomType.Name}'.",
            roomType.Id,
            roomType.Name,
            roomType.IsActive
        });
    }
}
