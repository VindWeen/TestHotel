using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtHelper _jwt;

    public AuthController(AppDbContext db, JwtHelper jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    /// <summary>
    /// Đăng nhập — trả về JWT token chứa đầy đủ permissions.
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

        // 2. Kiểm tra Soft Delete — nhân viên đã nghỉ việc không được đăng nhập
        if (!user.IsActive)
            return Unauthorized(new { message = "Tài khoản đã bị vô hiệu hóa." });

        // 3. Kiểm tra bị khóa (status = false)
        if (user.Status == false)
            return Unauthorized(new { message = "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên." });

        // 4. BCrypt verify password
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        // 5. Lấy danh sách permission_code của role này
        var permissionCodes = await _db.RolePermissions
            .Where(rp => rp.RoleId == user.RoleId)
            .Join(_db.Permissions,
                rp => rp.PermissionId,
                p => p.Id,
                (rp, p) => p.PermissionCode)
            .ToListAsync();

        // 6. Cập nhật last_login_at
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // 7. Tạo token
        var roleName = user.Role?.Name ?? "Guest";
        var token = _jwt.GenerateToken(user, roleName, permissionCodes);

        return Ok(new
        {
            token,
            expiresIn = 60,
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = roleName,
            avatarUrl = user.AvatarUrl,
            permissions = permissionCodes
        });
    }

    /// <summary>
    /// Đăng ký tài khoản khách hàng mới.
    /// Tự động gán Role = Guest (id=10) và Membership = Khách Mới (id=1).
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // 1. Kiểm tra email đã tồn tại chưa
        var emailExists = await _db.Users.AnyAsync(u => u.Email == request.Email);
        if (emailExists)
            return Conflict(new { message = "Email này đã được sử dụng." });

        // 2. Validate password confirm
        if (request.Password != request.ConfirmPassword)
            return BadRequest(new { message = "Mật khẩu xác nhận không khớp." });

        // 3. Lấy role Guest (id=10) và membership Khách Mới (id=1)
        var guestRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Guest");
        var defaultMembership = await _db.Memberships.FirstOrDefaultAsync(m => m.MinPoints == 0);

        // 4. Tạo user mới
        var user = new HotelManagement.Core.Entities.User
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLower(),
            Phone = request.Phone?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = guestRole?.Id,
            MembershipId = defaultMembership?.Id,
            Status = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // 5. Lấy permission của Guest (thường rỗng, nhưng vẫn query đầy đủ)
        var permissionCodes = await _db.RolePermissions
            .Where(rp => rp.RoleId == user.RoleId)
            .Join(_db.Permissions,
                rp => rp.PermissionId,
                p => p.Id,
                (rp, p) => p.PermissionCode)
            .ToListAsync();

        // 6. Tạo token luôn — đăng ký xong tự đăng nhập
        var roleName = guestRole?.Name ?? "Guest";
        var token = _jwt.GenerateToken(user, roleName, permissionCodes);

        return StatusCode(201, new
        {
            message = "Đăng ký thành công.",
            token,
            expiresIn = 60,
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = roleName,
            membership = defaultMembership?.TierName,
            permissions = permissionCodes
        });
    }
}

public record LoginRequest(string Email, string Password);

public record RegisterRequest(
    string FullName,
    string Email,
    string Password,
    string ConfirmPassword,
    string? Phone
);