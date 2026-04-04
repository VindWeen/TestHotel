using HotelManagement.Core.Authorization;
using HotelManagement.Core.DTOs;
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
    private readonly IAuditTrailService _auditTrail;

    public UserManagementController(AppDbContext db, IEmailService email, IAuditTrailService auditTrail)
    {
        _db = db;
        _email = email;
        _auditTrail = auditTrail;
    }

    // GET /api/UserManagement?roleId=&page=&pageSize=
    [HttpGet]
    [RequirePermission(PermissionCodes.ViewUsers)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int? roleId,
        [FromQuery] ListQueryRequest queryRequest)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.Users
            .AsNoTracking()
            .AsQueryable();

        if (roleId.HasValue)
            query = query.Where(u => u.RoleId == roleId.Value);

        if (!string.IsNullOrWhiteSpace(queryRequest.Status))
        {
            if (queryRequest.Status.Equals("active", StringComparison.OrdinalIgnoreCase))
                query = query.Where(u => u.Status == true);
            else if (queryRequest.Status.Equals("locked", StringComparison.OrdinalIgnoreCase))
                query = query.Where(u => u.Status != true);
        }

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(u =>
                (u.FullName != null && u.FullName.ToLower().Contains(keyword)) ||
                (u.Email != null && u.Email.ToLower().Contains(keyword)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(keyword)));
        }

        if (queryRequest.FromDate.HasValue)
            query = query.Where(u => u.CreatedAt >= queryRequest.FromDate.Value);

        if (queryRequest.ToDate.HasValue)
            query = query.Where(u => u.CreatedAt <= queryRequest.ToDate.Value);

        var totalItems = await query.CountAsync();
        var activeItems = await query.CountAsync(u => u.Status == true);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var sortDirDesc = !string.Equals(queryRequest.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        query = queryRequest.SortBy?.ToLower() switch
        {
            "fullname" => sortDirDesc ? query.OrderByDescending(u => u.FullName) : query.OrderBy(u => u.FullName),
            "email" => sortDirDesc ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "createdat" => sortDirDesc ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
            _ => sortDirDesc ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt)
        };

        var users = await query
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
            Title = "Danh sách người dùng",
            Message = $"Đã lấy danh sách người dùng thành công. Tổng cộng {totalItems} người dùng.",
            Type = NotificationType.Success,
            Action = NotificationAction.ViewUsers
        };

        var payload = new ApiListResponse<object>
        {
            Data = users,
            Pagination = new PaginationMeta
            {
                CurrentPage = page,
                PageSize = pageSize,
                TotalItems = totalItems,
                TotalPages = totalPages
            },
            Summary = new { totalItems, activeItems },
            Message = "Lấy danh sách người dùng thành công.",
            Notification = notification
        };

        return Ok(payload);
    }
    // GET /api/UserManagement/{id}
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ViewUsers)]
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
    [RequirePermission(PermissionCodes.CreateUsers)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var actorRoleName = User.FindFirst("role")?.Value;
        var actorLevel = GetRoleLevel(actorRoleName);

        var emailExists = await _db.Users
            .AnyAsync(u => u.Email == request.Email.Trim().ToLower());
        if (emailExists)
            return Conflict(new { message = "Email này đã được sử dụng." });

        if (request.RoleId.HasValue)
        {
            var role = await _db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == request.RoleId.Value);
            if (role is null)
                return BadRequest(new { message = $"Vai trò #{request.RoleId} không tồn tại." });

            if (string.Equals(role.Name, "Guest", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Không tạo tài khoản quản trị với vai trò Guest." });

            if (GetRoleLevel(role.Name) > actorLevel)
                return StatusCode(403, new { message = "Bạn không thể tạo người dùng với vai trò cao hơn cấp bậc hiện tại của mình." });
        }

        if (request.MembershipId.HasValue)
        {
            var membershipExists = await _db.Memberships.AnyAsync(m => m.Id == request.MembershipId.Value && m.IsActive);
            if (!membershipExists)
                return BadRequest(new { message = $"Hạng thành viên #{request.MembershipId} không tồn tại hoặc đang bị vô hiệu hóa." });
        }

        var plainPassword = PasswordGenerator.GenerateRandomPassword(12);
        var user = new User
        {
            FullName     = request.FullName.Trim(),
            Email        = request.Email.Trim().ToLower(),
            Phone        = request.Phone?.Trim(),
            DateOfBirth  = request.DateOfBirth,
            Gender       = request.Gender?.Trim(),
            Address      = request.Address?.Trim(),
            NationalId   = request.NationalId?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(plainPassword),
            RoleId       = request.RoleId,
            MembershipId = request.MembershipId,
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
        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CREATE_USER",
            ActionLabel = "Tạo tài khoản mới",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo tài khoản nhân viên mới cho {user.FullName} ({roleName ?? "N/A"}).",
            EntityType = "User",
            EntityId = user.Id,
            EntityLabel = user.Email,
            Severity = "Success",
            TableName = "Users",
            RecordId = user.Id,
            OldValue = null,
            NewValue = $"{{\"email\": \"{user.Email}\", \"fullName\": \"{user.FullName}\", \"roleId\": {user.RoleId?.ToString() ?? "null"}}}"
        });

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
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        var oldValues = $"{{\"fullName\": \"{user.FullName}\", \"phone\": \"{user.Phone}\"}}";

        if (request.MembershipId.HasValue)
        {
            var membershipExists = await _db.Memberships.AnyAsync(m => m.Id == request.MembershipId.Value && m.IsActive);
            if (!membershipExists)
                return BadRequest(new { message = $"Hạng thành viên #{request.MembershipId} không tồn tại hoặc đang bị vô hiệu hóa." });
        }

        user.FullName    = request.FullName?.Trim()   ?? user.FullName;
        user.Phone       = request.Phone?.Trim()      ?? user.Phone;
        user.DateOfBirth = request.DateOfBirth        ?? user.DateOfBirth;
        user.Gender      = request.Gender?.Trim()     ?? user.Gender;
        user.Address     = request.Address?.Trim()    ?? user.Address;
        user.NationalId  = request.NationalId?.Trim() ?? user.NationalId;
        user.MembershipId = request.MembershipId ?? user.MembershipId;
        user.UpdatedAt   = DateTime.UtcNow;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_USER",
            ActionLabel = "Cập nhật hồ sơ người dùng",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật thông tin người dùng {user.FullName}.",
            EntityType = "User",
            EntityId = id,
            EntityLabel = user.Email,
            Severity = "Info",
            TableName = "Users",
            RecordId = id,
            OldValue = oldValues,
            NewValue = $"{{\"fullName\": \"{user.FullName}\", \"phone\": \"{user.Phone}\"}}"
        });

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

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "LOCK_ACCOUNT",
            ActionLabel = "Khóa tài khoản",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã khóa tài khoản của {user.FullName} ({user.Email}).",
            EntityType = "User",
            EntityId = id,
            EntityLabel = user.Email,
            Severity = "Warning",
            TableName = "Users",
            RecordId = id,
            OldValue = "{\"status\": true}",
            NewValue = "{\"status\": false}"
        });

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
    [RequirePermission(PermissionCodes.EditRoles)]
    public async Task<IActionResult> ChangeRole(int id, [FromBody] ChangeRoleRequest request)
    {
        var actorId = JwtHelper.GetUserId(User);
        var actorRoleName = User.FindFirst("role")?.Value;
        var actorLevel = GetRoleLevel(actorRoleName);

        var user = await _db.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        var role = await _db.Roles.FindAsync(request.NewRoleId);
        if (role is null)
            return BadRequest(new { message = $"Vai trò #{request.NewRoleId} không tồn tại." });

        var currentRole = user.RoleId.HasValue
            ? await _db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == user.RoleId.Value)
            : null;
        var currentTargetLevel = GetRoleLevel(currentRole?.Name);
        var newTargetLevel = GetRoleLevel(role.Name);

        if (currentTargetLevel > actorLevel)
            return StatusCode(403, new { message = "Bạn không thể chỉnh vai trò của người dùng có cấp bậc cao hơn mình." });

        if (string.Equals(role.Name, "Guest", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Không thể đổi người dùng quản trị sang vai trò Guest tại màn này." });

        if (newTargetLevel > actorLevel)
            return StatusCode(403, new { message = "Bạn không thể gán vai trò cao hơn cấp bậc hiện tại của mình." });

        if (actorId == id && newTargetLevel > actorLevel)
            return StatusCode(403, new { message = "Bạn không thể tự nâng mình lên vai trò cao hơn." });

        var oldRoleId  = user.RoleId;
        user.RoleId    = request.NewRoleId;
        user.UpdatedAt = DateTime.UtcNow;

        var oldRoleName = (await _db.Roles.FindAsync(oldRoleId))?.Name ?? $"ID {oldRoleId}";

        await _db.SaveChangesAsync();
        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CHANGE_ROLE",
            ActionLabel = "Đổi quyền người dùng",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã đổi quyền của {user.FullName} từ '{oldRoleName}' sang '{role.Name}'.",
            EntityType = "User",
            EntityId = id,
            EntityLabel = user.Email,
            Severity = "Info",
            TableName = "Users",
            RecordId = id,
            OldValue = $"{{\"roleId\": {oldRoleId?.ToString() ?? "null"}}}",
            NewValue = $"{{\"roleId\": {request.NewRoleId}, \"roleName\": \"{role.Name}\"}}"
        });

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
        var user = await _db.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = $"Không tìm thấy người dùng #{id}." });

        var oldStatus  = user.Status;
        user.Status    = !(user.Status ?? true);
        user.UpdatedAt = DateTime.UtcNow;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = user.Status == true ? "UNLOCK_ACCOUNT" : "LOCK_ACCOUNT",
            ActionLabel = user.Status == true ? "Mở khóa tài khoản" : "Khóa tài khoản",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã {(user.Status == true ? "mở khóa" : "khóa")} tài khoản của {user.FullName} ({user.Email}).",
            EntityType = "User",
            EntityId = id,
            EntityLabel = user.Email,
            Severity = user.Status == true ? "Success" : "Warning",
            TableName = "Users",
            RecordId = id,
            OldValue = $"{{\"status\": {(oldStatus?.ToString().ToLower() ?? "null")}}}",
            NewValue = $"{{\"status\": {user.Status.ToString()!.ToLower()}}}"
        });

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
        var newPassword = PasswordGenerator.GenerateRandomPassword(12);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt    = DateTime.UtcNow;

        var currentUserId = JwtHelper.GetUserId(User);
        await _db.SaveChangesAsync();
        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "RESET_PASSWORD",
            ActionLabel = "Reset mật khẩu",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã reset mật khẩu cho {user.FullName} ({user.Email}).",
            EntityType = "User",
            EntityId = id,
            EntityLabel = user.Email,
            Severity = "Warning",
            TableName = "Users",
            RecordId = id,
            OldValue = null,
            NewValue = $"{{\"resetBy\": {currentUserId}, \"targetUser\": \"{user.Email}\"}}"
        });

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

    private static int GetRoleLevel(string? roleName) => roleName?.Trim().ToLowerInvariant() switch
    {
        "guest" => 0,
        "housekeeping" => 20,
        "receptionist" => 30,
        "accountant" => 30,
        "security" => 30,
        "chef" => 30,
        "waiter" => 30,
        "it support" => 40,
        "manager" => 80,
        "admin" => 100,
        _ => 10
    };

}


public record CreateUserRequest(
    string    FullName,
    string    Email,
    string?   Phone,
    DateOnly? DateOfBirth,
    string?   Gender,
    string?   Address,
    string?   NationalId,
    int?      RoleId,
    int?      MembershipId = null
);

public record UpdateUserRequest(
    string?   FullName,
    string?   Phone,
    DateOnly? DateOfBirth,
    string?   Gender,
    string?   Address,
    string?   NationalId,
    int?      MembershipId = null
);

public record ChangeRoleRequest(int NewRoleId);

