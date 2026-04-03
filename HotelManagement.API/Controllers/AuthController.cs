using System.Security.Cryptography;
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
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly JwtHelper _jwt;
    private readonly IConfiguration _config;
    private readonly IActivityLogService _activityLog;
    private readonly IEmailService _email;

    private const int RefreshTokenExpiryDays = 7;

    public AuthController(AppDbContext context, JwtHelper jwt, IConfiguration config, IActivityLogService activityLog, IEmailService email)
    {
        _context = context;
        _jwt = jwt;
        _config = config;
        _activityLog = activityLog;
        _email = email;
    }

    // POST /api/Auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var normalizedEmail = request.Email?.Trim().ToLower() ?? "";
        
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user is null)
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        if (user.Status == false)
            return Unauthorized(new { message = "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên." });

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        var permissionCodes = await GetPermissionCodesAsync(user.RoleId);
        var roleName = user.Role?.Name ?? "Guest";
        var refreshToken = GenerateRefreshToken();

        user.LastLoginAt = DateTime.UtcNow;
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            Action = "LOGIN",
            TableName = "Users",
            RecordId = user.Id,
            OldValue = null,
            NewValue = $"{{\"email\": \"{user.Email}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        var notification = new Notification
        {
            Title = "Thông báo đăng nhập",
            Message = $"Chào mừng {user.FullName} đã đăng nhập thành công!",
            Type = NotificationType.Success,
            Action = NotificationAction.LoginAccount
        };

        var token = _jwt.GenerateToken(user, roleName, permissionCodes);

        return Ok(new
        {
            token,
            refreshToken,
            expiresIn = _config["Jwt:ExpiresInMinutes"],
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = roleName,
            avatarUrl = user.AvatarUrl,
            permissions = permissionCodes,
            notification
        });
    }

    // POST /api/Auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var normalizedEmail = request.Email?.Trim().ToLower() ?? "";

        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail))
            return Conflict(new { message = "Email này đã được sử dụng." });

        if (request.Password != request.ConfirmPassword)
            return BadRequest(new { message = "Mật khẩu xác nhận không khớp." });

        var guestRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Guest");
        var defaultMembership = await _context.Memberships.FirstOrDefaultAsync(m => m.MinPoints == 0 && m.IsActive);
        var refreshToken = GenerateRefreshToken();

        var user = new HotelManagement.Core.Entities.User
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLower(),
            Phone = request.Phone?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = guestRole?.Id,
            MembershipId = defaultMembership?.Id,
            Status = true,
            CreatedAt = DateTime.UtcNow,
            RefreshToken = refreshToken,
            RefreshTokenExpiry = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays),
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        var roleName = guestRole?.Name ?? "Guest";

        // Gửi email thông tin tài khoản mới tạo (theo yêu cầu đồng bộ với UserManagementController)
        _ = _email.SendNewStaffAccountAsync(
            user.Email,
            user.FullName,
            request.Password,
            roleName
        );

        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "REGISTER",
            actionLabel: "Đăng ký tài khoản",
            message: $"Khách hàng mới đã đăng ký: {user.FullName} ({user.Email}).",
            entityType: "User",
            entityId: user.Id,
            entityLabel: user.Email,
            severity: "Success",
            userId: user.Id,
            roleName: "Customer"
        );

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = user.Id,
            Action    = "REGISTER",
            TableName = "Users",
            RecordId  = user.Id,
            OldValue  = null,
            NewValue  = $"{{\"email\": \"{user.Email}\", \"fullName\": \"{user.FullName}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        var permissionCodes = await GetPermissionCodesAsync(user.RoleId);
        var token = _jwt.GenerateToken(user, roleName, permissionCodes);

        var notification = new Notification
        {
            Title = "Thông báo đăng ký",
            Message = $"Chào mừng {user.FullName} đã đăng ký tài khoản thành công!",
            Type = NotificationType.Success,
            Action = NotificationAction.CreateAccount
        };

        return StatusCode(201, new
        {
            message = "Đăng ký thành công.",
            token,
            refreshToken,
            expiresIn = _config["Jwt:ExpiresInMinutes"],
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = roleName,
            membership = defaultMembership?.TierName,
            permissions = permissionCodes,
            notification
        });
    }

    // POST /api/Auth/refresh-token
    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "Refresh token không được để trống." });

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        if (user is null)
            return Unauthorized(new { message = "Refresh token không hợp lệ." });

        if (user.RefreshTokenExpiry is null || user.RefreshTokenExpiry <= DateTime.UtcNow)
            return Unauthorized(new { message = "Refresh token đã hết hạn. Vui lòng đăng nhập lại." });

        if (user.Status == false)
            return Unauthorized(new { message = "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên." });

        var permissionCodes = await GetPermissionCodesAsync(user.RoleId);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        await _context.SaveChangesAsync();

        var roleName = user.Role?.Name ?? "Guest";
        var token = _jwt.GenerateToken(user, roleName, permissionCodes);

        return Ok(new
        {
            token,
            refreshToken = newRefreshToken,
            expiresIn = _config["Jwt:ExpiresInMinutes"],
        });
    }

    // POST /api/Auth/forgot-password
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var normalizedEmail = request.Email?.Trim().ToLower() ?? "";
        if (string.IsNullOrWhiteSpace(normalizedEmail))
            return BadRequest(new { message = "Email không được để trống." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        if (user is null)
            return NotFound(new { message = "Email không tồn tại trong hệ thống." });

        var newPassword = PasswordGenerator.GenerateRandomPassword(12);
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            Action = "FORGOT_PASSWORD_RESET",
            TableName = "Users",
            RecordId = user.Id,
            OldValue = null,
            NewValue = $"{{\"email\": \"{user.Email}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await _email.SendPasswordResetByAdminAsync(user.Email, user.FullName, newPassword);

        return Ok(new { message = "Mật khẩu mới đã được gửi về email của bạn." });
    }

    // POST /api/Auth/logout
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = JwtHelper.GetUserId(User);

        var user = await _context.Users.FindAsync(userId);
        if (user is null)
            return NotFound(new { message = "Không tìm thấy tài khoản." });

        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;

        // Khôi phục AuditLog
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "LOGOUT",
            TableName = "Users",
            RecordId  = userId,
            OldValue  = null,
            NewValue  = null,
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Đăng xuất thành công." });
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private async Task<List<string>> GetPermissionCodesAsync(int? roleId)
        => await _context.RolePermissions
            .Where(rp => rp.RoleId == roleId)
            .Join(_context.Permissions,
                rp => rp.PermissionId,
                p => p.Id,
                (rp, p) => p.PermissionCode)
            .ToListAsync();

    private static string GenerateRefreshToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

}

public record LoginRequest(string Email, string Password);

public record RegisterRequest(
    string  FullName,
    string  Email,
    string  Password,
    string  ConfirmPassword,
    string? Phone
);

public record RefreshTokenRequest(string RefreshToken);
public record ForgotPasswordRequest(string Email);
