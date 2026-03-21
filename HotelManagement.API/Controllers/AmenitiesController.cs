using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.Core.Models.Enums;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AmenitiesController : ControllerBase
{
    private readonly AppDbContext _db;

    public AmenitiesController(AppDbContext db)
    {
        _db = db;
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/Amenities  [Public / MANAGE_ROOMS]
    // Public     : chỉ thấy is_active = 1.
    // Admin      : thấy tất cả kể cả đã soft delete,
    //              mỗi item kèm field isActive để FE phân biệt.
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageRooms);

        var query = _db.Amenities.AsNoTracking();

        if (!isAdmin)
            query = query.Where(a => a.IsActive);

        var list = await query
            .OrderBy(a => a.IsActive ? 0 : 1)  // active lên trước, đã xóa xuống dưới
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.IconUrl,
                a.IsActive  // admin cần biết cái nào đang bị ẩn
            })
            .ToListAsync();

        return Ok(list);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/Amenities/{id}  [Public]
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var amenity = await _db.Amenities
            .AsNoTracking()
            .Where(a => a.Id == id && a.IsActive)
            .Select(a => new { a.Id, a.Name, a.IconUrl })
            .FirstOrDefaultAsync();

        if (amenity is null)
            return NotFound(new Notification
            {
                Title = "Không tìm thấy tiện nghi",
                Message = $"Không tìm thấy tiện nghi #{id}.",
                Type = NotificationType.Error,
                Action = NotificationAction.CreateAmenity // Action nào phù hợp tuỳ context
            });

        return Ok(amenity);
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/Amenities  [MANAGE_ROOMS]
    // Body: { name, iconUrl }. INSERT với is_active = 1.
    // ──────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Create([FromBody] CreateAmenityRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên tiện nghi không được để trống." });

        // Kiểm tra tên trùng (trong các amenity đang active)
        var exists = await _db.Amenities
            .AnyAsync(a => a.Name == request.Name.Trim() && a.IsActive);

        if (exists)
            return Conflict(new { message = $"Tiện nghi '{request.Name}' đã tồn tại." });

        var amenity = new Amenity
        {
            Name     = request.Name.Trim(),
            IconUrl  = request.IconUrl?.Trim(),
            IsActive = true
        };

        _db.Amenities.Add(amenity);
        await _db.SaveChangesAsync();

        var Notification = new Notification
        {
            Title = "Tiện nghi mới đã được thêm",
            Message = $"Tiện nghi '{amenity.Name}' đã được tạo thành công.",
            Type = NotificationType.Success,
            Action = NotificationAction.CreateAmenity
        };

        return StatusCode(201, new
        {
            amenity.Id,
            amenity.Name,
            amenity.IconUrl,
            notification = Notification
        });
    }

    // ──────────────────────────────────────────────────────────────
    // PUT /api/Amenities/{id}  [MANAGE_ROOMS]
    // Cập nhật name, icon_url.
    // ──────────────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAmenityRequest request)
    {
        var amenity = await _db.Amenities
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (amenity is null)
            return NotFound(new Notification
            {
                Title = "Không tìm thấy tiện nghi",
                Message = $"Không tìm thấy tiện nghi #{id}.",
                Type = NotificationType.Error,
                Action = NotificationAction.Other // Action nào phù hợp tuỳ context
            });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new Notification
            {
                Title = "Tên tiện nghi không hợp lệ",
                Message = "Tên tiện nghi không được để trống.",
                Type = NotificationType.Error,
                Action = NotificationAction.UpdateAmenity
            });

        // Kiểm tra tên trùng với amenity khác
        var duplicateName = await _db.Amenities
            .AnyAsync(a => a.Name == request.Name.Trim() && a.IsActive && a.Id != id);

        if (duplicateName)
            return Conflict(new Notification
            {
                Title = "Tên tiện nghi đã tồn tại",
                Message = $"Tiện nghi '{request.Name}' đã tồn tại.",
                Type = NotificationType.Error,
                Action = NotificationAction.UpdateAmenity
            });

        amenity.Name    = request.Name.Trim();
        amenity.IconUrl = request.IconUrl?.Trim();

        await _db.SaveChangesAsync();

        var Notification = new Notification
        {
            Title = "Tiện nghi đã được cập nhật",
            Message = $"Tiện nghi '{amenity.Name}' đã được cập nhật thành công.",
            Type = NotificationType.Success,
            Action = NotificationAction.UpdateAmenity
        };

        return Ok(new
        {
            amenity.Id,
            amenity.Name,
            amenity.IconUrl,
            notification = Notification
        });
    }

    // ──────────────────────────────────────────────────────────────
    // PATCH /api/Amenities/{id}/toggle-active  [MANAGE_ROOMS]
    // Bật/tắt tiện nghi: is_active = 1 ↔ 0
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var amenity = await _db.Amenities.FindAsync(id);
 
        if (amenity is null)
            return NotFound(new Notification
            {
                Title = "Không tìm thấy tiện nghi",
                Message = $"Không tìm thấy tiện nghi #{id}.",
                Type = NotificationType.Error,
                Action = NotificationAction.Other // Action nào phù hợp tuỳ context
            });
 
        amenity.IsActive = !amenity.IsActive;
        await _db.SaveChangesAsync();


        var Notification= new Notification
        {
            Title = $"Tiện nghi đã được {(amenity.IsActive ? "kích hoạt" : "vô hiệu hóa")}",
            Message = $"Tiện nghi '{amenity.Name}' đã {(amenity.IsActive ? "được kích hoạt" : "bị vô hiệu hóa")}.",
            Type = NotificationType.Success,
            Action = amenity.IsActive ? NotificationAction.EnableAmenity : NotificationAction.DisableAmenity
        };
        return Ok(new
        {
            amenity.Id,
            amenity.Name,
            amenity.IsActive,
            notification = Notification
        });
    }
}

// ──────────────────────────────────────────────────────────────────
// Request records
// ──────────────────────────────────────────────────────────────────

public record CreateAmenityRequest(string Name, string? IconUrl);
public record UpdateAmenityRequest(string Name, string? IconUrl);
