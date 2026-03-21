using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    // GET /api/Amenities
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageRooms);

        var query = _db.Amenities.AsNoTracking();

        if (!isAdmin)
            query = query.Where(a => a.IsActive);

        var list = await query
            .OrderBy(a => a.IsActive ? 0 : 1)
            .ThenBy(a => a.Name)
            .Select(a => new { a.Id, a.Name, a.IconUrl, a.IsActive })
            .ToListAsync();

        return Ok(list);
    }

    // GET /api/Amenities/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var amenity = await _db.Amenities
            .AsNoTracking()
            .Where(a => a.Id == id && a.IsActive)
            .Select(a => new { a.Id, a.Name, a.IconUrl })
            .FirstOrDefaultAsync();

        if (amenity is null)
            return NotFound(new { message = $"Không tìm thấy tiện nghi #{id}." });

        return Ok(amenity);
    }

    // POST /api/Amenities
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Create([FromBody] CreateAmenityRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên tiện nghi không được để trống." });

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

        var notification = new Notification
        {
            Title   = "Tiện nghi mới đã được thêm",
            Message = $"Tiện nghi '{amenity.Name}' đã được tạo thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.CreateAmenity
        };

        return StatusCode(201, new { amenity.Id, amenity.Name, amenity.IconUrl, notification });
    }

    // PUT /api/Amenities/{id}
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAmenityRequest request)
    {
        var amenity = await _db.Amenities
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (amenity is null)
            return NotFound(new { message = $"Không tìm thấy tiện nghi #{id}." });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên tiện nghi không được để trống." });

        var duplicateName = await _db.Amenities
            .AnyAsync(a => a.Name == request.Name.Trim() && a.IsActive && a.Id != id);

        if (duplicateName)
            return Conflict(new { message = $"Tiện nghi '{request.Name}' đã tồn tại." });

        amenity.Name    = request.Name.Trim();
        amenity.IconUrl = request.IconUrl?.Trim();

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Tiện nghi đã được cập nhật",
            Message = $"Tiện nghi '{amenity.Name}' đã được cập nhật thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateAmenity
        };

        return Ok(new { amenity.Id, amenity.Name, amenity.IconUrl, notification });
    }

    // DELETE /api/Amenities/{id}
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Delete(int id)
    {
        var amenity = await _db.Amenities
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (amenity is null)
            return NotFound(new { message = $"Không tìm thấy tiện nghi #{id}." });

        amenity.IsActive = false;
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Tiện nghi đã bị xoá",
            Message = $"Tiện nghi '{amenity.Name}' đã được xoá thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.DisableAmenity
        };

        return Ok(new { notification });
    }

    // PATCH /api/Amenities/{id}/toggle-active
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var amenity = await _db.Amenities.FindAsync(id);

        if (amenity is null)
            return NotFound(new { message = $"Không tìm thấy tiện nghi #{id}." });

        amenity.IsActive = !amenity.IsActive;
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = $"Tiện nghi đã được {(amenity.IsActive ? "kích hoạt" : "vô hiệu hóa")}",
            Message = $"Tiện nghi '{amenity.Name}' đã {(amenity.IsActive ? "được kích hoạt" : "bị vô hiệu hóa")}.",
            Type    = NotificationType.Success,
            Action  = amenity.IsActive
                        ? NotificationAction.EnableAmenity
                        : NotificationAction.DisableAmenity
        };

        return Ok(new { notification, amenity.Id, amenity.Name, amenity.IsActive });
    }
}

public record CreateAmenityRequest(string Name, string? IconUrl);
public record UpdateAmenityRequest(string Name, string? IconUrl);
