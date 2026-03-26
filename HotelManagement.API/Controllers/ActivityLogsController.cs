using HotelManagement.Infrastructure.Data;
using HotelManagement.API.Policies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HotelManagement.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class ActivityLogsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ActivityLogsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("my-notifications")]
    public async Task<IActionResult> GetMyNotifications()
    {
        var roleName = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;

        // Hiện tại luồng thông báo chỉ hướng tới Admin và Manager
        if (roleName != "Admin" && roleName != "Manager")
        {
            return Ok(new List<object>()); 
        }

        var logs = await _db.ActivityLogs
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .Select(x => new 
            {
                id = x.Id,
                message = x.Message ?? x.ActionLabel,
                action = x.ActionCode,
                createdAt = x.CreatedAt,
                isRead = x.IsRead
            })
            .ToListAsync();

        // Lọc theo NotificationPolicy — chỉ giữ lại log mà role này có quyền xem
        var filtered = logs
            .Where(x => NotificationPolicy.CanRoleViewAction(roleName!, x.action ?? ""))
            .ToList();

        return Ok(filtered);
    }

    [HttpPut("{id}/mark-read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var roleName = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (roleName != "Admin" && roleName != "Manager") return Forbid();

        var log = await _db.ActivityLogs.FindAsync(id);
        if (log == null) return NotFound();

        log.IsRead = true;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("mark-all-read")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var roleName = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (roleName != "Admin" && roleName != "Manager") return Forbid();

        var unreadLogs = await _db.ActivityLogs.Where(x => !x.IsRead).ToListAsync();
        foreach (var log in unreadLogs)
        {
            log.IsRead = true;
        }
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
