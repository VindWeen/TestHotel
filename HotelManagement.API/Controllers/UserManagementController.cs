using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserManagementController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmailService _email;
    private readonly IActivityLogService _activityLog;

    public UserManagementController(AppDbContext db, IEmailService email, IActivityLogService activityLog)
    {
        _db = db;
        _email = email;
        _activityLog = activityLog;
    }

    // GET /api/UserManagement?roleId=&page=&pageSize=
    [HttpGet]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int? roleId,
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 10)
    {
        if (page     < 1) page     = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var query = _db.Users
            .AsNoTracking()
            .AsQueryable();

        if (roleId.HasValue)
            query = query.Where(u => u.RoleId == roleId.Value);

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Phone,
                u.DateOfBirth,
                u.Gender,
                u.Address,
                u.NationalId,
                u.AvatarUrl,
                u.LoyaltyPoints,
                u.LoyaltyPointsUsable,
                u.Status,
                u.LastLoginAt,
                u.CreatedAt,
                u.UpdatedAt,
                RoleId         = u.RoleId,
                RoleName       = u.Role       != null ? u.Role.Name       : null,
                MembershipId   = u.MembershipId,
                MembershipTier = u.Membership != null ? u.Membership.TierName : null
            })
            .ToListAsync();

        var notification = new Notification
        {
            Title   = "Danh sách người dùng",
            Message = $"Đã lấy danh sách người dùng thành công. Tổng cộng {totalItems} người dùng.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.ViewUsers
        };

        return Ok(new
        {
            data       = users,
            pagination = new { currentPage = page, pageSize, totalItems, totalPages },
            notification
        });
    }

    // GET /api/UserManagement/{id}
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .Include(u => u.Membership)
            .Where(u => u.Id == id)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Phone,
                u.DateOfBirth,
                u.Gender,
                u.Address,
                u.NationalId,
                u.AvatarUrl,
                u.LoyaltyPoints,
                u.LoyaltyPointsUsable,
                u.Status,
                u.LastLoginAt,
                u.CreatedAt,
                u.UpdatedAt,
                RoleId         = u.RoleId,
                RoleName       = u.Role       != null ? u.Role.Name       : null,
                MembershipId   = u.MembershipId,
                MembershipTier = u.Membership != null ? u.Membership.TierName : null
            })
            .FirstOrDefaultAsync();

        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        return Ok(user);
    }

    // POST /api/UserManagement
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var emailExists = await _db.Users
            .AnyAsync(u => u.Email == request.Email.Trim().ToLower());
        if (emailExists)
            return Conflict(new { message = "Email này đã được sử dụng." });

        if (request.RoleId.HasValue)
        {
            var roleExists = await _db.Roles.AnyAsync(r => r.Id == request.RoleId.Value);
            if (!roleExists)
                return BadRequest(new { message = $"Role #{request.RoleId} không tồn tại." });
        }

        var plainPassword = request.Password; // lưu trước khi hash (để gửi email)
        var user = new User
        {
            FullName     = request.FullName.Trim(),
            Email        = request.Email.Trim().ToLower(),
            Phone        = request.Phone?.Trim(),
            DateOfBirth  = request.DateOfBirth,
            Gender       = request.Gender?.Trim(),
            Address      = request.Address?.Trim(),
            NationalId   = request.NationalId?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId       = request.RoleId,
            Status       = true,
            CreatedAt    = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        // Gửi email thông báo tài khoản mới
        var roleName = request.RoleId.HasValue
            ? (await _db.Roles.FindAsync(request.RoleId.Value))?.Name
            : null;

        _ = _email.SendNewStaffAccountAsync(
            user.Email,
            user.FullName,
            plainPassword,
            roleName ?? "Nhân viên"
        );

        await _db.SaveChangesAsync();
        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CREATE_USER",
            actionLabel: "Tạo tài khoản mới",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo tài khoản nhân viên mới cho {user.FullName} ({roleName ?? "N/A"}).",
            entityType: "User",
            entityId: user.Id,
            entityLabel: user.Email,
            severity: "Success",
            userId: currentUserId,
            roleName: User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CREATE_USER",
            TableName = "Users",
            RecordId  = user.Id,
            OldValue  = null,
            NewValue  = $"{{\"email\": \"{user.Email}\", \"fullName\": \"{user.FullName}\", \"roleId\": {user.RoleId?.ToString() ?? "null"}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Tài khoản mới đã được tạo",
            Message = $"Tài khoản cho người dùng '{user.FullName}' đã được tạo thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.CreateUser
        };

        return StatusCode(201, new { message = "Tạo tài khoản nhân viên thành công.", userId = user.Id, notification });
    }

    // PUT /api/UserManagement/{id}
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy user #{id}." });

        var oldValues = $"{{\"fullName\": \"{user.FullName}\", \"phone\": \"{user.Phone}\"}}";

        user.FullName    = request.FullName?.Trim()   ?? user.FullName;
        user.Phone       = request.Phone?.Trim()      ?? user.Phone;
        user.DateOfBirth = request.DateOfBirth        ?? user.DateOfBirth;
        user.Gender      = request.Gender?.Trim()     ?? user.Gender;
        user.Address     = request.Address?.Trim()    ?? user.Address;
        user.NationalId  = request.NationalId?.Trim() ?? user.NationalId;
        user.UpdatedAt   = DateTime.UtcNow;

        var currentUserId = JwtHelper.GetUserId(User);

        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "UPDATE_USER",
            actionLabel: "Cập nhật thông tin nhân viên",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật thông tin của {user.FullName}.",
            entityType: "User",
            entityId: id,
            entityLabel: user.Email,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value
        );

        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_USER",
            TableName = "Users",
            RecordId  = id,
            OldValue  = oldValues,
            NewValue  = $"{{\"fullName\": \"{user.FullName}\", \"phone\": \"{user.Phone}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Cập nhật thông tin người dùng",
            Message = $"Thông tin của người dùng '{user.FullName}' đã được cập nhật thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateUser
        };

        return Ok(new { notification });
    }

    // DELETE /api/UserManagement/{id}
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> LockUser(int id)
    {
        var currentUserId = JwtHelper.GetUserId(User);

        if (currentUserId == id)
            return BadRequest(new { message = "Bạn không thể tự khoá chính mình." });

        var user = await _db.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        if (user.Status == false)
            return BadRequest(new { message = "Tài khoản này đã bị khoá trước đó." });

        user.Status    = false;
        user.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "LOCK_ACCOUNT",
            TableName = "Users",
            RecordId  = id,
            OldValue  = "{\"status\": true}",
            NewValue  = "{\"status\": false}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        await _activityLog.LogAsync(
            actionCode: "LOCK_ACCOUNT",
            actionLabel: "Khóa tài khoản",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã khóa tài khoản của {user.FullName} ({user.Email}).",
            entityType: "User",
            entityId: id,
            entityLabel: user.Email,
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value
        );

        var notification = new Notification
        {
            Title   = "Khoá tài khoản",
            Message = "Đã khoá tài khoản thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.LockAccount
        };

        return Ok(new { notification });
    }

    // PUT /api/UserManagement/{id}/change-role
    [HttpPut("{id:int}/change-role")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    [RequirePermission(PermissionCodes.ManageRoles)]
    public async Task<IActionResult> ChangeRole(int id, [FromBody] ChangeRoleRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        var role = await _db.Roles.FindAsync(request.NewRoleId);
        if (role is null)
            return BadRequest(new { message = $"Role #{request.NewRoleId} không tồn tại." });

        var oldRoleId  = user.RoleId;
        user.RoleId    = request.NewRoleId;
        user.UpdatedAt = DateTime.UtcNow;

        var oldRoleName = (await _db.Roles.FindAsync(oldRoleId))?.Name ?? $"ID {oldRoleId}";

        await _db.SaveChangesAsync();
        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CHANGE_ROLE",
            actionLabel: "Đổi quyền người dùng",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã đổi quyền của {user.FullName} từ '{oldRoleName}' sang '{role.Name}'.",
            entityType: "User",
            entityId: id,
            entityLabel: user.Email,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CHANGE_ROLE",
            TableName = "Users",
            RecordId  = id,
            OldValue  = $"{{\"roleId\": {oldRoleId?.ToString() ?? "null"}}}",
            NewValue  = $"{{\"roleId\": {request.NewRoleId}, \"roleName\": \"{role.Name}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Đổi role người dùng",
            Message = $"Role của người dùng '{user.FullName}' đã được đổi thành '{role.Name}'.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateUser
        };

        return Ok(new { oldRoleId, newRoleId = request.NewRoleId, newRoleName = role.Name, notification });
    }

    // PATCH /api/UserManagement/{id}/toggle-status
    [HttpPatch("{id:int}/toggle-status")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var currentUserId = JwtHelper.GetUserId(User);

        var user = await _db.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        var oldStatus  = user.Status;
        user.Status    = !(user.Status ?? true);
        user.UpdatedAt = DateTime.UtcNow;

        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: user.Status == true ? "UNLOCK_ACCOUNT" : "LOCK_ACCOUNT",
            actionLabel: user.Status == true ? "Mở khóa tài khoản" : "Khóa tài khoản",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã {(user.Status == true ? "mở khóa" : "khóa")} tài khoản của {user.FullName} ({user.Email}).",
            entityType: "User",
            entityId: id,
            entityLabel: user.Email,
            severity: user.Status == true ? "Success" : "Warning",
            userId: currentUserId,
            roleName: User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = user.Status == true ? "UNLOCK_ACCOUNT" : "LOCK_ACCOUNT",
            TableName = "Users",
            RecordId  = id,
            OldValue  = $"{{\"status\": {(oldStatus?.ToString().ToLower() ?? "null")}}}",
            NewValue  = $"{{\"status\": {user.Status.ToString()!.ToLower()}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = $"{(user.Status == true ? "Mở khóa" : "Khóa")} tài khoản",
            Message = $"Đã {(user.Status == true ? "mở khóa" : "khóa")} tài khoản thành công.",
            Type    = NotificationType.Success,
            Action  = user.Status == true ? NotificationAction.UnlockAccount : NotificationAction.LockAccount
        };

        return Ok(new { notification, userId = id, status = user.Status });
    }

    // POST /api/UserManagement/{id}/reset-password
    [HttpPost("{id:int}/reset-password")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> ResetPassword(int id)
    {
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        if (string.IsNullOrWhiteSpace(user.Email))
            return BadRequest(new { message = "Người dùng này không có email." });

        // Generate mật khẩu random 12 ký tự: chữ hoa + thường + số + đặc biệt
        var newPassword = GenerateRandomPassword(12);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt    = DateTime.UtcNow;

        var currentUserId = JwtHelper.GetUserId(User);

        // Ghi AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "RESET_PASSWORD",
            TableName = "Users",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"resetBy\": {currentUserId}, \"targetUser\": \"{user.Email}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        // Ghi ActivityLog
        await _activityLog.LogAsync(
            actionCode: "RESET_PASSWORD",
            actionLabel: "Reset mật khẩu",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã reset mật khẩu cho {user.FullName} ({user.Email}).",
            entityType: "User",
            entityId: id,
            entityLabel: user.Email,
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value
        );

        // Gửi email (fire-and-forget — không block response)
        _ = _email.SendPasswordResetByAdminAsync(user.Email, user.FullName, newPassword);

        var notification = new Notification
        {
            Title   = "Reset mật khẩu thành công",
            Message = $"Đã reset mật khẩu và gửi email cho {user.FullName} ({user.Email}).",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateUser
        };

        return Ok(new { message = "Đã reset mật khẩu và gửi email thành công.", notification });
    }

    // ── Helper: generate random password ──────────────────────────────────────
    private static string GenerateRandomPassword(int length)
    {
        const string upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Bỏ O, I
        const string lower   = "abcdefghjkmnpqrstuvwxyz";  // Bỏ o, i, l
        const string digits  = "23456789";                 // Bỏ 0, 1
        const string special = "@#$%*!?";                  // Bỏ & < > để tránh mâu thuẫn HTML, thêm !?
        const string all     = upper + lower + digits + special;

        var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        var bytes = new byte[length];
        rng.GetBytes(bytes);

        var chars = new char[length];
        // Đảm bảo có ít nhất 1 ký tự mỗi loại
        chars[0] = upper[bytes[0]  % upper.Length];
        chars[1] = lower[bytes[1]  % lower.Length];
        chars[2] = digits[bytes[2] % digits.Length];
        chars[3] = special[bytes[3] % special.Length];
        for (int i = 4; i < length; i++)
            chars[i] = all[bytes[i] % all.Length];

        // Shuffle để không lộ pattern vị trí
        return new string(chars.OrderBy(_ => System.Security.Cryptography.RandomNumberGenerator.GetInt32(length)).ToArray());
    }
}


public record CreateUserRequest(
    string    FullName,
    string    Email,
    string    Password,
    string?   Phone,
    DateOnly? DateOfBirth,
    string?   Gender,
    string?   Address,
    string?   NationalId,
    int?      RoleId
);

public record UpdateUserRequest(
    string?   FullName,
    string?   Phone,
    DateOnly? DateOfBirth,
    string?   Gender,
    string?   Address,
    string?   NationalId
);

public record ChangeRoleRequest(int NewRoleId);
