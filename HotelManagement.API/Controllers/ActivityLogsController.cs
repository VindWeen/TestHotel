using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Entities;
using HotelManagement.API.Policies;
using HotelManagement.Core.Helpers;
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

    // ── GET: Lấy thông báo của user hiện tại (isRead tính riêng theo userId) ──
    [HttpGet("my-notifications")]
    public async Task<IActionResult> GetMyNotifications()
    {
        var roleName = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;

        if (roleName != "Admin" && roleName != "Manager")
            return Ok(new List<object>());

        var userId = JwtHelper.GetUserId(User);

        // Blacklist: lấy ActionCode bị chặn với role này
        var blockedCodes = NotificationPolicy.GetBlockedActionCodesForRole(roleName!);

        // LEFT JOIN với ActivityLogReads để tính isRead riêng cho userId hiện tại
        var logs = await _db.ActivityLogs
            .Where(x => x.ActionCode == null || !blockedCodes.Contains(x.ActionCode))
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .Select(x => new
            {
                id       = x.Id,
                message  = x.Message ?? x.ActionLabel,
                action   = x.ActionCode,
                createdAt = x.CreatedAt,
                // isRead = true nếu userId này đã có row trong ActivityLogReads
                isRead   = x.Reads.Any(r => r.UserId == userId)
            })
            .ToListAsync();

        return Ok(logs);
    }

    // ── PUT: Đánh dấu một thông báo đã đọc (chỉ cho userId hiện tại) ──────────
    [HttpPut("{id}/mark-read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var roleName = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (roleName != "Admin" && roleName != "Manager") return Forbid();

        var userId = JwtHelper.GetUserId(User);

        // Idempotent: chỉ insert nếu chưa có
        var alreadyRead = await _db.ActivityLogReads
            .AnyAsync(r => r.ActivityLogId == id && r.UserId == userId);

        if (!alreadyRead)
        {
            _db.ActivityLogReads.Add(new ActivityLogRead
            {
                ActivityLogId = id,
                UserId        = userId,
                ReadAt        = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    // ── PUT: Đánh dấu TẤT CẢ thông báo đã đọc (chỉ cho userId hiện tại) ──────
    [HttpPut("mark-all-read")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var roleName = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (roleName != "Admin" && roleName != "Manager") return Forbid();

        var userId = JwtHelper.GetUserId(User);
        var blockedCodes = NotificationPolicy.GetBlockedActionCodesForRole(roleName!);

        // Lấy id các log mà user này CHƯA đọc
        var unreadIds = await _db.ActivityLogs
            .Where(x => x.ActionCode == null || !blockedCodes.Contains(x.ActionCode))
            .Where(x => !x.Reads.Any(r => r.UserId == userId))
            .Select(x => x.Id)
            .Take(50) // giới hạn đồng bộ với GetMyNotifications
            .ToListAsync();

        if (unreadIds.Count > 0)
        {
            var now = DateTime.UtcNow;
            var rows = unreadIds.Select(logId => new ActivityLogRead
            {
                ActivityLogId = logId,
                UserId        = userId,
                ReadAt        = now
            });
            _db.ActivityLogReads.AddRange(rows);
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

}
