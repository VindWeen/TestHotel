using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _db;

    public RolesController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Gán hoặc thu hồi permission cho một role.
    /// Body: { roleId, permissionId, grant: true = gán / false = thu hồi }
    /// </summary>
    [HttpPost("assign-permission")]
    [RequirePermission(PermissionCodes.ManageRoles)]
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
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = Request.Headers["User-Agent"].ToString(),
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
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
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = Request.Headers["User-Agent"].ToString(),
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
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
                    p.Name,
                    p.ModuleName
                })
            .OrderBy(p => p.ModuleName)
            .ToListAsync();

        return Ok(new { permissions });
    }
}

public record AssignPermissionRequest(int RoleId, int PermissionId, bool Grant);
