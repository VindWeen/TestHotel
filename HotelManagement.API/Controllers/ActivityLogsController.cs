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

        // Blacklist: lấy ActionCode bị chặn với role này
        // (action không có trong map → mặc định hiển cho Admin+Manager, không bị chặn)
        var blockedCodes = NotificationPolicy.GetBlockedActionCodesForRole(roleName!);

        var logs = await _db.ActivityLogs
            .Where(x => x.ActionCode == null || !blockedCodes.Contains(x.ActionCode))
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

        return Ok(logs);
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

        // Dùng ExecuteUpdateAsync — 1 câu SQL UPDATE, không load entity vào RAM
        await _db.ActivityLogs
            .Where(x => !x.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true));

        return NoContent();
    }
}
