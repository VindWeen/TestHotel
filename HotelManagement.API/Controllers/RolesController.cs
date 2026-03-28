using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _activityLog;

    public RolesController(AppDbContext db, IActivityLogService activityLog)
    {
        _db = db;
        _activityLog = activityLog;
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/Roles  [Authorize]
    // Danh sách toàn bộ roles — FE dùng để populate dropdown chọn role.
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    [RequirePermission(PermissionCodes.ViewRoles)]
    public async Task<IActionResult> GetAll()
    {
        var roles = await _db.Roles
            .AsNoTracking()
            .OrderBy(r => r.Id)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description
            })
            .ToListAsync();

        return Ok(new { data = roles, total = roles.Count });
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/Roles/{id}  [MANAGE_ROLES]
    // Chi tiết 1 role kèm danh sách permissions đang được gán.
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ViewRoles)]
    public async Task<IActionResult> GetById(int id)
    {
        var role = await _db.Roles
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                Permissions = r.RolePermissions
                    .Select(rp => new
                    {
                        rp.Permission.Id,
                        rp.Permission.Name,
                        rp.Permission.PermissionCode
                    })
                    .OrderBy(p => p.Name)
                    .ThenBy(p => p.Name)
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (role is null)
            return NotFound(new { message = $"Không tìm thấy role #{id}." });

        return Ok(role);
    }

    /// <summary>
    /// Gán hoặc thu hồi permission cho một role.
    /// Body: { roleId, permissionId, grant: true = gán / false = thu hồi }
    /// </summary>
    [HttpPost("assign-permission")]
    [RequirePermission(PermissionCodes.EditRoles)]
    public async Task<IActionResult> AssignPermission([FromBody] AssignPermissionRequest request)
    {
        var roleExists = await _db.Roles.AnyAsync(r => r.Id == request.RoleId);
        if (!roleExists)
            return NotFound(new { message = $"Role #{request.RoleId} không tồn tại." });

        var permissionExists = await _db.Permissions.AnyAsync(p => p.Id == request.PermissionId);
        if (!permissionExists)
            return NotFound(new { message = $"Permission #{request.PermissionId} không tồn tại." });

        var existing = await _db.RolePermissions
            .FirstOrDefaultAsync(rp =>
                rp.RoleId       == request.RoleId &&
                rp.PermissionId == request.PermissionId);

        if (request.Grant)
        {
            if (existing is null)
            {
                _db.RolePermissions.Add(new RolePermission
                {
                    RoleId       = request.RoleId,
                    PermissionId = request.PermissionId
                });

                var currentUserId = JwtHelper.GetUserId(User);
                _db.AuditLogs.Add(new AuditLog
                {
                    UserId    = currentUserId,
                    Action    = "GRANT_PERMISSION",
                    TableName = "Role_Permissions",
                    RecordId  = request.RoleId,
                    OldValue  = null,
                    NewValue  = $"{{\"roleId\": {request.RoleId}, \"permissionId\": {request.PermissionId}}}",
                    UserAgent = Request.Headers["User-Agent"].ToString(),
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();

                var roleName = (await _db.Roles.FindAsync(request.RoleId))?.Name ?? $"Role #{request.RoleId}";
                var permissionName = (await _db.Permissions.FindAsync(request.PermissionId))?.Name ?? $"Permission #{request.PermissionId}";
                await _activityLog.LogAsync(
                    actionCode: "GRANT_PERMISSION",
                    actionLabel: "Cấp quyền cho vai trò",
                    message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cấp quyền '{permissionName}' cho vai trò '{roleName}'.",
                    entityType: "Role",
                    entityId: request.RoleId,
                    entityLabel: roleName,
                    severity: "Warning",
                    userId: currentUserId,
                    roleName: User.FindFirst("role")?.Value
                );
            }

            return Ok(new { message = "Đã gán permission thành công." });
        }
        else
        {
            if (existing is not null)
            {
                _db.RolePermissions.Remove(existing);

                var currentUserId = JwtHelper.GetUserId(User);
                _db.AuditLogs.Add(new AuditLog
                {
                    UserId    = currentUserId,
                    Action    = "REVOKE_PERMISSION",
                    TableName = "Role_Permissions",
                    RecordId  = request.RoleId,
                    OldValue  = $"{{\"roleId\": {request.RoleId}, \"permissionId\": {request.PermissionId}}}",
                    NewValue  = null,
                    UserAgent = Request.Headers["User-Agent"].ToString(),
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();

                var roleName2 = (await _db.Roles.FindAsync(request.RoleId))?.Name ?? $"Role #{request.RoleId}";
                var permissionName2 = (await _db.Permissions.FindAsync(request.PermissionId))?.Name ?? $"Permission #{request.PermissionId}";
                await _activityLog.LogAsync(
                    actionCode: "REVOKE_PERMISSION",
                    actionLabel: "Thu hồi quyền khỏi vai trò",
                    message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã thu hồi quyền '{permissionName2}' khỏi vai trò '{roleName2}'.",
                    entityType: "Role",
                    entityId: request.RoleId,
                    entityLabel: roleName2,
                    severity: "Warning",
                    userId: currentUserId,
                    roleName: User.FindFirst("role")?.Value
                );
            }

            return Ok(new { message = "Đã thu hồi permission thành công." });
        }
    }

    /// <summary>
    /// Trả về danh sách permission_code của người dùng hiện tại.
    /// FE dùng để ẩn/hiện menu sau khi đăng nhập.
    /// </summary>
    [HttpGet("my-permissions")]
    public async Task<IActionResult> GetMyPermissions()
    {
        var userId = JwtHelper.GetUserId(User);

        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user?.RoleId is null)
            return Ok(new { permissions = Array.Empty<string>() });

        var permissions = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.RoleId == user.RoleId)
            .Join(_db.Permissions,
                rp => rp.PermissionId,
                p  => p.Id,
                (rp, p) => new
                {
                    p.PermissionCode,
                    p.Name
                })
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(new { permissions });
    }
}

public record AssignPermissionRequest(int RoleId, int PermissionId, bool Grant);
