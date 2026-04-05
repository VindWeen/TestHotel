using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttractionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _activityLog;

    public AttractionsController(AppDbContext db, IActivityLogService activityLog)
    {
        _db = db;
        _activityLog = activityLog;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GET /api/Attractions
    // Public â€” is_active = 1.
    // KĂ¨m latitude, longitude, category Ä‘á»ƒ FE render Google Maps marker.
    // Sáº¯p xáº¿p theo distance_km tÄƒng dáº§n.
    // Filter tuá»³ chá»n theo category.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] string? category, [FromQuery] bool includeInactive = false)
    {
        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageContent);

        var query = _db.Attractions
            .AsNoTracking()
            .AsQueryable();

        if (!(isAdmin && includeInactive))
            query = query.Where(a => a.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(a => a.Category == category.Trim());

        var items = await query
            .OrderBy(a => a.DistanceKm == null)   // null xuá»‘ng cuá»‘i
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
                a.ImageUrl,
                a.IsActive
            })
            .ToListAsync();

        return Ok(new { data = items, total = items.Count });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GET /api/Attractions/{id}
    // Public â€” chi tiáº¿t 1 Ä‘á»‹a Ä‘iá»ƒm.
    // Tráº£ Ä‘áº§y Ä‘á»§: tá»a Ä‘á»™ GPS, Ä‘á»‹a chá»‰, mĂ´ táº£, áº£nh, map embed link.
    // FE dĂ¹ng khi click marker trĂªn Google Maps.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                Title = "KhĂ´ng tĂ¬m tháº¥y Ä‘á»‹a Ä‘iá»ƒm",
                Message = $"KhĂ´ng tĂ¬m tháº¥y Ä‘á»‹a Ä‘iá»ƒm #{id}.",
                Type = NotificationType.Error,
                Action = NotificationAction.Other
            }});

        return Ok(attraction);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // POST /api/Attractions
    // [MANAGE_CONTENT]
    // Body: { name, category, address, latitude, longitude,
    //         distanceKm, description, imageUrl, mapEmbedLink }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Create([FromBody] CreateAttractionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "TĂªn Ä‘á»‹a Ä‘iá»ƒm khĂ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng." });

        if (!IsValidCategory(request.Category))
            return BadRequest(new
            {
                message = "Category khĂ´ng há»£p lá»‡. DĂ¹ng: Di tĂ­ch | áº¨m thá»±c | Giáº£i trĂ­ | ThiĂªn nhiĂªn."
            });

        if (request.Latitude is < -90 or > 90)
            return BadRequest(new { message = "Latitude pháº£i náº±m trong khoáº£ng -90 Ä‘áº¿n 90." });

        if (request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Longitude pháº£i náº±m trong khoáº£ng -180 Ä‘áº¿n 180." });

        if (request.DistanceKm is < 0)
            return BadRequest(new { message = "DistanceKm khĂ´ng Ä‘Æ°á»£c Ă¢m." });

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

        await _db.SaveChangesAsync();

        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CREATE_ATTRACTION",
            actionLabel: "Táº¡o Ä‘á»‹a Ä‘iá»ƒm",
            message: $"ÄĂ£ thĂªm Ä‘á»‹a Ä‘iá»ƒm tham quan má»›i: \"{attraction.Name}\" ({attraction.Category}).",
            entityType: "Attraction",
            entityId: attraction.Id,
            entityLabel: attraction.Name,
            severity: "Success",
            userId: JwtHelper.GetUserId(User),
            roleName: User.FindFirst("role")?.Value
        );

        // KhĂ´i phá»¥c AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = JwtHelper.GetUserId(User),
            Action    = "CREATE_ATTRACTION",
            TableName = "Attractions",
            RecordId  = attraction.Id,
            OldValue  = null,
            NewValue  = $"{{\"name\": \"{attraction.Name}\", \"category\": \"{attraction.Category}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById),
            new { id = attraction.Id },
            new
            {
                message = "Táº¡o Ä‘á»‹a Ä‘iá»ƒm thĂ nh cĂ´ng.",
                attraction.Id,
                attraction.Name,
                attraction.Category,
                attraction.DistanceKm
            });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PUT /api/Attractions/{id}
    // [MANAGE_CONTENT]
    // Patch-style: chá»‰ cáº­p nháº­t field Ä‘Æ°á»£c gá»­i lĂªn (khĂ´ng null).
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAttractionRequest request)
    {
        var attraction = await _db.Attractions
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (attraction is null)
            return NotFound(new { message = $"KhĂ´ng tĂ¬m tháº¥y Ä‘á»‹a Ä‘iá»ƒm #{id}." });

        // Validate trÆ°á»›c khi cáº­p nháº­t
        if (request.Category is not null && !IsValidCategory(request.Category))
            return BadRequest(new
            {
                message = "Category khĂ´ng há»£p lá»‡. DĂ¹ng: Di tĂ­ch | áº¨m thá»±c | Giáº£i trĂ­ | ThiĂªn nhiĂªn."
            });

        if (request.Latitude is < -90 or > 90)
            return BadRequest(new { message = "Latitude pháº£i náº±m trong khoáº£ng -90 Ä‘áº¿n 90." });

        if (request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Longitude pháº£i náº±m trong khoáº£ng -180 Ä‘áº¿n 180." });

        if (request.DistanceKm is < 0)
            return BadRequest(new { message = "DistanceKm khĂ´ng Ä‘Æ°á»£c Ă¢m." });

        // Chá»‰ cáº­p nháº­t field Ä‘Æ°á»£c gá»­i lĂªn
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

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "UPDATE_ATTRACTION",
            actionLabel: "Cáº­p nháº­t Ä‘á»‹a Ä‘iá»ƒm",
            message: $"ThĂ´ng tin Ä‘á»‹a Ä‘iá»ƒm \"{attraction.Name}\" Ä‘Ă£ Ä‘Æ°á»£c chá»‰nh sá»­a.",
            entityType: "Attraction",
            entityId: id,
            entityLabel: attraction.Name,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // KhĂ´i phá»¥c AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_ATTRACTION",
            TableName = "Attractions",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"name\": \"{attraction.Name}\", \"category\": \"{attraction.Category}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Cáº­p nháº­t Ä‘á»‹a Ä‘iá»ƒm thĂ nh cĂ´ng.",
            attraction.Id,
            attraction.Name,
            attraction.Category,
            attraction.DistanceKm
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // DELETE /api/Attractions/{id}
    // [MANAGE_CONTENT]  Soft Delete: is_active = 0.
    // Marker tá»± biáº¿n máº¥t khá»i Google Maps vĂ¬ GET chá»‰ tráº£ is_active = 1.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Delete(int id)
    {
        var attraction = await _db.Attractions
            .FirstOrDefaultAsync(a => a.Id == id && a.IsActive);

        if (attraction is null)
            return NotFound(new { message = $"KhĂ´ng tĂ¬m tháº¥y Ä‘á»‹a Ä‘iá»ƒm #{id}." });

        attraction.IsActive = false;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "DELETE_ATTRACTION",
            actionLabel: "XĂ³a Ä‘á»‹a Ä‘iá»ƒm",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Há»‡ thá»‘ng")} Ä‘Ă£ xĂ³a Ä‘á»‹a Ä‘iá»ƒm \"{attraction.Name}\".",
            entityType: "Attraction",
            entityId: id,
            entityLabel: attraction.Name,
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // KhĂ´i phá»¥c AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "DELETE_ATTRACTION",
            TableName = "Attractions",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": true, \"name\": \"{attraction.Name}\"}}",
            NewValue  = "{\"isActive\": false}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        await _db.SaveChangesAsync();

        return Ok(new { message = $"ÄĂ£ xoĂ¡ Ä‘á»‹a Ä‘iá»ƒm '{attraction.Name}' thĂ nh cĂ´ng." });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PATCH /api/Attractions/{id}/toggle-active  [MANAGE_CONTENT]
    // Báº­t/táº¯t Ä‘á»‹a Ä‘iá»ƒm: is_active = 1 â†” 0
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var attraction = await _db.Attractions.FindAsync(id);
 
        if (attraction is null)
            return NotFound(new { message = $"KhĂ´ng tĂ¬m tháº¥y Ä‘á»‹a Ä‘iá»ƒm #{id}." });
 
        var oldActive = attraction.IsActive;
        attraction.IsActive = !attraction.IsActive;

        var currentUserId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "TOGGLE_ATTRACTION",
            TableName = "Attractions",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": {oldActive.ToString().ToLower()}}}",
            NewValue  = $"{{\"isActive\": {attraction.IsActive.ToString().ToLower()}}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
 
        var action = attraction.IsActive ? "kĂ­ch hoáº¡t" : "vĂ´ hiá»‡u hĂ³a";
        return Ok(new
        {
            message  = $"ÄĂ£ {action} Ä‘á»‹a Ä‘iá»ƒm '{attraction.Name}'.",
            attraction.Id,
            attraction.Name,
            attraction.IsActive
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PRIVATE HELPERS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /// <summary>
    /// Kiá»ƒm tra category há»£p lá»‡ theo 4 loáº¡i Ä‘á»‹nh nghÄ©a sáºµn trong DB.
    /// null / empty Ä‘Æ°á»£c phĂ©p (field nullable).
    /// </summary>
    private static bool IsValidCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return true;

        var allowed = new[] { "Di tĂ­ch", "áº¨m thá»±c", "Giáº£i trĂ­", "ThiĂªn nhiĂªn" };
        return allowed.Contains(category.Trim());
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// REQUEST RECORDS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// <summary>Request body cho POST /api/Attractions</summary>
public record CreateAttractionRequest(
    string   Name,
    string?  Category,       // Di tĂ­ch | áº¨m thá»±c | Giáº£i trĂ­ | ThiĂªn nhiĂªn
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
/// Táº¥t cáº£ field nullable â€” chá»‰ cáº­p nháº­t field Ä‘Æ°á»£c gá»­i lĂªn.
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

