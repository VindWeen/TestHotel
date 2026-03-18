using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoomTypesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cloudinary   _cloudinary;

    public RoomTypesController(AppDbContext db, Cloudinary cloudinary)
    {
        _db         = db;
        _cloudinary = cloudinary;
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/RoomTypes  [Public]
    // Danh sách is_active=1 kèm ảnh primary và amenities.
    // Dùng cho trang tìm kiếm phòng.
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var roomTypes = await _db.RoomTypes
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
        var roomType = await _db.RoomTypes
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
        var roomType = await _db.RoomTypes
            .FirstOrDefaultAsync(rt => rt.Id == id && rt.IsActive);

        if (roomType is null)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{id}." });

        // Kiểm tra có booking active không:
        // BookingDetail.RoomTypeId = id, Booking.Status thuộc nhóm chưa kết thúc
        var activeStatuses = new[] { "Pending", "Confirmed", "Checked_in" };

        var hasActiveBooking = await _db.BookingDetails
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
        await _db.SaveChangesAsync();

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
        var roomType = await _db.RoomTypes
            .FirstOrDefaultAsync(rt => rt.Id == id && rt.IsActive);

        if (roomType is null)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{id}." });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "File ảnh không hợp lệ." });

        // Upload lên Cloudinary
        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File           = new FileDescription(file.FileName, stream),
            Folder         = $"hotel/room-types/{id}",
            Transformation = new Transformation().Quality("auto").FetchFormat("auto")
        };

        var uploadResult = await _cloudinary.UploadAsync(uploadParams);

        if (uploadResult.Error is not null)
            return StatusCode(500, new { message = $"Upload thất bại: {uploadResult.Error.Message}" });

        // Xác định sort_order tiếp theo
        var maxSortOrder = await _db.RoomImages
            .Where(img => img.RoomTypeId == id && img.IsActive)
            .Select(img => (int?)img.SortOrder)
            .MaxAsync() ?? -1;

        // Nếu chưa có ảnh nào → ảnh đầu tiên tự động là primary
        var hasPrimary = await _db.RoomImages
            .AnyAsync(img => img.RoomTypeId == id && img.IsActive && img.IsPrimary == true);

        var image = new RoomImage
        {
            RoomTypeId          = id,
            ImageUrl            = uploadResult.SecureUrl.ToString(),
            CloudinaryPublicId  = uploadResult.PublicId,
            IsPrimary           = !hasPrimary,   // true nếu đây là ảnh đầu tiên
            SortOrder           = maxSortOrder + 1,
            IsActive            = true
        };

        _db.RoomImages.Add(image);
        await _db.SaveChangesAsync();

        return StatusCode(201, new
        {
            message   = "Upload ảnh thành công.",
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
        var image = await _db.RoomImages
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
        await _db.SaveChangesAsync();

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
        var roomTypeExists = await _db.RoomTypes
            .AnyAsync(rt => rt.Id == roomTypeId && rt.IsActive);

        if (!roomTypeExists)
            return NotFound(new { message = $"Không tìm thấy loại phòng #{roomTypeId}." });

        // Kiểm tra ảnh thuộc đúng loại phòng này
        var targetImage = await _db.RoomImages
            .FirstOrDefaultAsync(img =>
                img.Id         == imageId &&
                img.RoomTypeId == roomTypeId &&
                img.IsActive);

        if (targetImage is null)
            return NotFound(new { message = $"Không tìm thấy ảnh #{imageId} trong loại phòng #{roomTypeId}." });

        // Transaction: reset tất cả → set ảnh mới
        await using var transaction = await _db.Database.BeginTransactionAsync();

        try
        {
            // Bước 1: Bỏ primary tất cả ảnh của loại phòng này
            await _db.RoomImages
                .Where(img => img.RoomTypeId == roomTypeId && img.IsActive && img.IsPrimary == true)
                .ExecuteUpdateAsync(s => s.SetProperty(img => img.IsPrimary, false));

            // Bước 2: Set ảnh được chọn là primary
            targetImage.IsPrimary = true;
            await _db.SaveChangesAsync();

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { message = "Cập nhật ảnh chính thất bại." });
        }

        return Ok(new { message = $"Đã đặt ảnh #{imageId} làm ảnh chính." });
    }
}