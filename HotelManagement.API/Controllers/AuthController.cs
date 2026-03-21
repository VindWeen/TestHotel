using System.Security.Cryptography;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.Core.Models.Enums;
using Microsoft.AspNetCore.Components.Web;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtHelper _jwt;
    private readonly IConfiguration _config;

    private const int RefreshTokenExpiryDays = 7;

    public AuthController(AppDbContext db, JwtHelper jwt, IConfiguration config)
    {
        _db     = db;
        _jwt    = jwt;
        _config = config;
    }

    // ────────────────────────────────────────────────────────────
    // POST /api/Auth/login
    // ────────────────────────────────────────────────────────────
    /// <summary>
    /// Đăng nhập — trả về access token + refresh token trong body.
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // 1. Tìm user theo email, include Role để lấy tên
        var user = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user is null)
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        // 2. Kiểm tra bị khóa (status = false)
        if (user.Status == false)
            return Unauthorized(new { message = "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên." });

        // 3. Verify password
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        // 4. Lấy danh sách permission_code
        var permissionCodes = await GetPermissionCodesAsync(user.RoleId);

        // 5. Tạo refresh token mới, lưu vào DB
        var roleName     = user.Role?.Name ?? "Guest";
        var refreshToken = GenerateRefreshToken();

        user.LastLoginAt        = DateTime.UtcNow;
        user.RefreshToken       = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        await _db.SaveChangesAsync();
        
        var Notification = new Notification
        {
            Title = "Thông báo đăng nhập",
            Message = $"Chào mừng {user.FullName} đã đăng nhập thành công!",
            Type = NotificationType.Success,
            Action = NotificationAction.LoginAccount
        };

        // 6. Tạo access token
        var token = _jwt.GenerateToken(user, roleName, permissionCodes);

        return Ok(new
        {
            token,
            refreshToken,
            expiresIn   = _config["Jwt:ExpiresInMinutes"],
            userId      = user.Id,
            fullName    = user.FullName,
            email       = user.Email,
            role        = roleName,
            avatarUrl   = user.AvatarUrl,
            permissions = permissionCodes,
            notification = Notification
        });
    }

    // ────────────────────────────────────────────────────────────
    // POST /api/Auth/register
    // ────────────────────────────────────────────────────────────
    /// <summary>
    /// Đăng ký tài khoản khách hàng mới, tự đăng nhập luôn sau khi tạo.
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // 1. Kiểm tra email đã tồn tại chưa
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            return Conflict(new { message = "Email này đã được sử dụng." });

        // 2. Validate password confirm
        if (request.Password != request.ConfirmPassword)
            return BadRequest(new { message = "Mật khẩu xác nhận không khớp." });

        // 3. Lấy role Guest và membership mặc định
        var guestRole         = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Guest");
        var defaultMembership = await _db.Memberships.FirstOrDefaultAsync(m => m.MinPoints == 0);
        var refreshToken      = GenerateRefreshToken();

        // 4. Tạo user mới
        var user = new HotelManagement.Core.Entities.User
        {
            FullName           = request.FullName.Trim(),
            Email              = request.Email.Trim().ToLower(),
            Phone              = request.Phone?.Trim(),
            PasswordHash       = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId             = guestRole?.Id,
            MembershipId       = defaultMembership?.Id,
            Status             = true,
            CreatedAt          = DateTime.UtcNow,
            RefreshToken       = refreshToken,
            RefreshTokenExpiry = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays),
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var Notification = new Notification
        {
            Title = "Thông báo đăng ký",
            Message = $"Chào mừng {user.FullName} đã đăng ký tài khoản thành công!",
            Type = NotificationType.Success,
            Action = NotificationAction.CreateAccount
        };

        // 5. Lấy permissions và tạo token
        var permissionCodes = await GetPermissionCodesAsync(user.RoleId);
        var roleName        = guestRole?.Name ?? "Guest";
        var token           = _jwt.GenerateToken(user, roleName, permissionCodes);

        return StatusCode(201, new
        {
            message     = "Đăng ký thành công.",
            token,
            refreshToken,
            expiresIn   = _config["Jwt:ExpiresInMinutes"],
            userId      = user.Id,
            fullName    = user.FullName,
            email       = user.Email,
            role        = roleName,
            membership  = defaultMembership?.TierName,
            permissions = permissionCodes,
            notification = Notification
        });
    }

    // ────────────────────────────────────────────────────────────
    // POST /api/Auth/refresh-token  [Public]
    // ────────────────────────────────────────────────────────────
    /// <summary>
    /// Dùng refresh token để lấy access token mới mà không cần login lại.
    /// Body: { "refreshToken": "..." }
    /// </summary>
    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "Refresh token không được để trống." });

        // 1. Tìm user theo refresh token
        var user = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        if (user is null)
            return Unauthorized(new { message = "Refresh token không hợp lệ." });

        // 2. Kiểm tra hết hạn
        if (user.RefreshTokenExpiry is null || user.RefreshTokenExpiry <= DateTime.UtcNow)
            return Unauthorized(new { message = "Refresh token đã hết hạn. Vui lòng đăng nhập lại." });

        // 3. Kiểm tra tài khoản có bị khóa không
        if (user.Status == false)
            return Unauthorized(new { message = "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên." });

        // 4. Lấy permissions
        var permissionCodes = await GetPermissionCodesAsync(user.RoleId);

        // 5. Rotate refresh token — cấp token mới, hủy token cũ ngay
        //    Nếu token cũ bị đánh cắp và dùng lại → bị từ chối vì không còn trong DB
        var newRefreshToken = GenerateRefreshToken();
        user.RefreshToken       = newRefreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        await _db.SaveChangesAsync();

        // 6. Tạo access token mới
        var roleName = user.Role?.Name ?? "Guest";
        var token    = _jwt.GenerateToken(user, roleName, permissionCodes);

        return Ok(new
        {
            token,
            refreshToken = newRefreshToken,
            expiresIn    = _config["Jwt:ExpiresInMinutes"],
        });
    }

    // ────────────────────────────────────────────────────────────
    // POST /api/Auth/logout  [Authenticated]
    // ────────────────────────────────────────────────────────────
    /// <summary>
    /// Xóa refresh token trong DB → vô hiệu hóa phiên đăng nhập phía server.
    /// Access token cũ vẫn hợp lệ đến khi hết hạn (đặc điểm JWT stateless).
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = JwtHelper.GetUserId(User);

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
            return NotFound(new { message = "Không tìm thấy tài khoản." });

        user.RefreshToken       = null;
        user.RefreshTokenExpiry = null;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đăng xuất thành công." });
    }

    // ────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────

    private async Task<List<string>> GetPermissionCodesAsync(int? roleId)
        => await _db.RolePermissions
            .Where(rp => rp.RoleId == roleId)
            .Join(_db.Permissions,
                rp => rp.PermissionId,
                p  => p.Id,
                (rp, p) => p.PermissionCode)
            .ToListAsync();

    private static string GenerateRefreshToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
}

// ────────────────────────────────────────────────────────────────
// Request records
// ────────────────────────────────────────────────────────────────

public record LoginRequest(string Email, string Password);

public record RegisterRequest(
    string  FullName,
    string  Email,
    string  Password,
    string  ConfirmPassword,
    string? Phone
);
public record RefreshTokenRequest(string RefreshToken);