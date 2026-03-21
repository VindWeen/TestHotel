using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttractionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AttractionsController(AppDbContext db)
    {
        _db = db;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/Attractions
    // Public — is_active = 1.
    // Kèm latitude, longitude, category để FE render Google Maps marker.
    // Sắp xếp theo distance_km tăng dần.
    // Filter tuỳ chọn theo category.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] string? category)
    {
        var query = _db.Attractions
            .AsNoTracking()
            .Where(a => a.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(a => a.Category == category.Trim());

        var items = await query
            .OrderBy(a => a.DistanceKm == null)   // null xuống cuối
            .ThenBy(a => a.DistanceKm)
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.Category,
                a.Address,
                a.Latitude,
                a.Longitude,
                a.DistanceKm,
                a.ImageUrl
            })
            .ToListAsync();

        return Ok(new { data = items, total = items.Count });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/Attractions/{id}
    // Public — chi tiết 1 địa điểm.
    // Trả đầy đủ: tọa độ GPS, địa chỉ, mô tả, ảnh, map embed link.
    // FE dùng khi click marker trên Google Maps.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var attraction = await _db.Attractions
            .AsNoTracking()
            .Where(a => a.Id == id && a.IsActive)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.Category,
                a.Address,
                a.Latitude,
                a.Longitude,
                a.DistanceKm,
                a.Description,
                a.ImageUrl,
                a.MapEmbedLink
            })
            .FirstOrDefaultAsync();

        if (attraction is null)
            return NotFound(new { Notification = new Notification
            {
                Title = "Không tìm thấy địa điểm",
                Message = $"Không tìm thấy địa điểm #{id}.",
                Type = NotificationType.Error,
                Action = NotificationAction.CreateArticle // Action nào phù hợp tuỳ context
            }});

        return Ok(attraction);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/Attractions
    // [MANAGE_CONTENT]
    // Body: { name, category, address, latitude, longitude,
    //         distanceKm, description, imageUrl, mapEmbedLink }
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Create([FromBody] CreateAttractionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên địa điểm không được để trống." });

        if (!IsValidCategory(request.Category))
            return BadRequest(new
            {
                message = "Category không hợp lệ. Dùng: Di tích | Ẩm thực | Giải trí | Thiên nhiên."
            });

        if (request.Latitude is < -90 or > 90)
            return BadRequest(new { message = "Latitude phải nằm trong khoảng -90 đến 90." });

        if (request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Longitude phải nằm trong khoảng -180 đến 180." });

        if (request.DistanceKm is < 0)
            return BadRequest(new { message = "DistanceKm không được âm." });

        var attraction = new Attraction
        {
            Name         = request.Name.Trim(),
            Category     = request.Category?.Trim(),
            Address      = request.Address?.Trim(),
            Latitude     = request.Latitude,
            Longitude    = request.Longitude,
            DistanceKm   = request.DistanceKm,
            Description  = request.Description?.Trim(),
            ImageUrl     = request.ImageUrl?.Trim(),
            MapEmbedLink = request.MapEmbedLink?.Trim(),
            IsActive     = true
        };

        _db.Attractions.Add(attraction);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById),
            new { id = attraction.Id },
            new
            {
                message = "Tạo địa điểm thành công.",
                attraction.Id,
                attraction.Name,
                attraction.Category,
                attraction.DistanceKm
            });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/Attractions/{id}
    // [MANAGE_CONTENT]
    // Patch-style: chỉ cập nhật field được gửi lên (không null).
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAttractionRequest request)
    {
        var attraction = await _db.Attractions
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (attraction is null)
            return NotFound(new { message = $"Không tìm thấy địa điểm #{id}." });

        // Validate trước khi cập nhật
        if (request.Category is not null && !IsValidCategory(request.Category))
            return BadRequest(new
            {
                message = "Category không hợp lệ. Dùng: Di tích | Ẩm thực | Giải trí | Thiên nhiên."
            });

        if (request.Latitude is < -90 or > 90)
            return BadRequest(new { message = "Latitude phải nằm trong khoảng -90 đến 90." });

        if (request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Longitude phải nằm trong khoảng -180 đến 180." });

        if (request.DistanceKm is < 0)
            return BadRequest(new { message = "DistanceKm không được âm." });

        // Chỉ cập nhật field được gửi lên
        if (!string.IsNullOrWhiteSpace(request.Name))
            attraction.Name = request.Name.Trim();

        if (request.Category is not null)
            attraction.Category = request.Category.Trim();

        if (request.Address is not null)
            attraction.Address = request.Address.Trim();

        if (request.Latitude.HasValue)
            attraction.Latitude = request.Latitude.Value;

        if (request.Longitude.HasValue)
            attraction.Longitude = request.Longitude.Value;

        if (request.DistanceKm.HasValue)
            attraction.DistanceKm = request.DistanceKm.Value;

        if (request.Description is not null)
            attraction.Description = request.Description.Trim();

        if (request.ImageUrl is not null)
            attraction.ImageUrl = request.ImageUrl.Trim();

        if (request.MapEmbedLink is not null)
            attraction.MapEmbedLink = request.MapEmbedLink.Trim();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Cập nhật địa điểm thành công.",
            attraction.Id,
            attraction.Name,
            attraction.Category,
            attraction.DistanceKm
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE /api/Attractions/{id}
    // [MANAGE_CONTENT]  Soft Delete: is_active = 0.
    // Marker tự biến mất khỏi Google Maps vì GET chỉ trả is_active = 1.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Delete(int id)
    {
        var attraction = await _db.Attractions
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (attraction is null)
            return NotFound(new { message = $"Không tìm thấy địa điểm #{id}." });

        attraction.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Đã xoá địa điểm '{attraction.Name}' thành công." });
    }

    // ──────────────────────────────────────────────────────────────
    // PATCH /api/Attractions/{id}/toggle-active  [MANAGE_CONTENT]
    // Bật/tắt địa điểm: is_active = 1 ↔ 0
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var attraction = await _db.Attractions.FindAsync(id);
 
        if (attraction is null)
            return NotFound(new { message = $"Không tìm thấy địa điểm #{id}." });
 
        attraction.IsActive = !attraction.IsActive;
        await _db.SaveChangesAsync();
 
        var action = attraction.IsActive ? "kích hoạt" : "vô hiệu hóa";
        return Ok(new
        {
            message  = $"Đã {action} địa điểm '{attraction.Name}'.",
            attraction.Id,
            attraction.Name,
            attraction.IsActive
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Kiểm tra category hợp lệ theo 4 loại định nghĩa sẵn trong DB.
    /// null / empty được phép (field nullable).
    /// </summary>
    private static bool IsValidCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return true;

        var allowed = new[] { "Di tích", "Ẩm thực", "Giải trí", "Thiên nhiên" };
        return allowed.Contains(category.Trim());
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// REQUEST RECORDS
// ──────────────────────────────────────────────────────────────────────────────

/// <summary>Request body cho POST /api/Attractions</summary>
public record CreateAttractionRequest(
    string   Name,
    string?  Category,       // Di tích | Ẩm thực | Giải trí | Thiên nhiên
    string?  Address,
    decimal? Latitude,
    decimal? Longitude,
    decimal? DistanceKm,
    string?  Description,
    string?  ImageUrl,
    string?  MapEmbedLink
);

/// <summary>
/// Request body cho PUT /api/Attractions/{id}.
/// Tất cả field nullable — chỉ cập nhật field được gửi lên.
/// </summary>
public record UpdateAttractionRequest(
    string?  Name,
    string?  Category,
    string?  Address,
    decimal? Latitude,
    decimal? Longitude,
    decimal? DistanceKm,
    string?  Description,
    string?  ImageUrl,
    string?  MapEmbedLink
);
