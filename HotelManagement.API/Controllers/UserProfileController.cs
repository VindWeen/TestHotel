using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserProfileController : ControllerBase
{
    private readonly AppDbContext    _db;
    private readonly IConfiguration _config;

    public UserProfileController(AppDbContext db, IConfiguration config)
    {
        _db     = db;
        _config = config;
    }

    // GET /api/UserProfile/my-profile
    [HttpGet("my-profile")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = JwtHelper.GetUserId(User);

        var profile = await _db.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .Include(u => u.Membership)
            .Where(u => u.Id == userId)
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
                RoleId             = u.RoleId,
                RoleName           = u.Role       != null ? u.Role.Name             : null,
                MembershipId       = u.MembershipId,
                MembershipTier     = u.Membership != null ? u.Membership.TierName   : null,
                MembershipDiscount = u.Membership != null ? u.Membership.DiscountPercent : null,
                MembershipColor    = u.Membership != null ? u.Membership.ColorHex   : null
            })
            .FirstOrDefaultAsync();

        if (profile is null)
            return NotFound(new { message = "Không tìm thấy thông tin người dùng." });

        return Ok(profile);
    }

    // PUT /api/UserProfile/update-profile
    [HttpPut("update-profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = JwtHelper.GetUserId(User);

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
            return NotFound(new { message = "Không tìm thấy thông tin người dùng." });

        user.FullName    = request.FullName?.Trim()  ?? user.FullName;
        user.Phone       = request.Phone?.Trim()     ?? user.Phone;
        user.Address     = request.Address?.Trim()   ?? user.Address;
        user.DateOfBirth = request.DateOfBirth       ?? user.DateOfBirth;
        user.Gender      = request.Gender?.Trim()    ?? user.Gender;
        user.UpdatedAt   = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Cập nhật thông tin thành công",
            Message = "Thông tin cá nhân của bạn đã được cập nhật.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateProfile
        };

        return Ok(new { notification });
    }

    // PUT /api/UserProfile/change-password
    [HttpPut("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = JwtHelper.GetUserId(User);

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
            return NotFound(new { message = "Không tìm thấy thông tin người dùng." });

        if (!BCrypt.Net.BCrypt.Verify(request.OldPassword, user.PasswordHash))
            return BadRequest(new { message = "Mật khẩu cũ không chính xác." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt    = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "CHANGE_PASSWORD",
            TableName = "Users",
            RecordId  = userId,
            OldValue  = null,
            NewValue  = null,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Đổi mật khẩu thành công",
            Message = "Mật khẩu của bạn đã được thay đổi.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateProfile
        };

        return Ok(new { notification });
    }

    // POST /api/UserProfile/upload-avatar
    [HttpPost("upload-avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file ảnh." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { message = "Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF)." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "File ảnh không được vượt quá 5MB." });

        var userId = JwtHelper.GetUserId(User);

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
            return NotFound(new { message = "Không tìm thấy thông tin người dùng." });

        var account    = new CloudinaryDotNet.Account(
            _config["Cloudinary:CloudName"]!,
            _config["Cloudinary:ApiKey"]!,
            _config["Cloudinary:ApiSecret"]!);
        var cloudinary = new CloudinaryDotNet.Cloudinary(account);

        if (!string.IsNullOrEmpty(user.AvatarUrl))
        {
            var oldPublicId = ExtractPublicIdFromUrl(user.AvatarUrl);
            if (!string.IsNullOrEmpty(oldPublicId))
                await cloudinary.DestroyAsync(new CloudinaryDotNet.Actions.DeletionParams(oldPublicId));
        }

        using var stream = file.OpenReadStream();
        var uploadParams = new CloudinaryDotNet.Actions.ImageUploadParams
        {
            File           = new CloudinaryDotNet.FileDescription(file.FileName, stream),
            Folder         = "hotel_avatars",
            Transformation = new CloudinaryDotNet.Transformation()
                                .Width(500).Height(500).Crop("thumb").Gravity("face")
        };

        var uploadResult = await cloudinary.UploadAsync(uploadParams);

        if (uploadResult.Error != null)
            return StatusCode(502, new { message = "Upload ảnh thất bại.", detail = uploadResult.Error.Message });

        var oldAvatar = user.AvatarUrl;
        user.AvatarUrl = uploadResult.SecureUrl.ToString();
        user.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = userId,
            Action    = "UPDATE_AVATAR",
            TableName = "Users",
            RecordId  = userId,
            OldValue  = oldAvatar != null ? $"{{\"avatarUrl\": \"{oldAvatar}\"}}" : null,
            NewValue  = $"{{\"avatarUrl\": \"{user.AvatarUrl}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Upload avatar thành công.", avatarUrl = user.AvatarUrl });
    }

    // ── Private helper ────────────────────────────────────────────────────────

    private static string? ExtractPublicIdFromUrl(string url)
    {
        try
        {
            var uri         = new Uri(url);
            var path        = uri.AbsolutePath;
            var uploadIndex = path.IndexOf("/upload/", StringComparison.Ordinal);
            if (uploadIndex < 0) return null;

            var afterUpload = path[(uploadIndex + 8)..];
            var segments    = afterUpload.Split('/');
            var startIndex  = 0;

            for (var i = 0; i < segments.Length; i++)
            {
                if (segments[i].Length > 1 && segments[i][0] == 'v' &&
                    long.TryParse(segments[i][1..], out _))
                {
                    startIndex = i + 1;
                    break;
                }
            }

            if (startIndex >= segments.Length) return null;

            var publicIdWithExt = string.Join('/', segments[startIndex..]);
            var dotIndex        = publicIdWithExt.LastIndexOf('.');
            return dotIndex > 0 ? publicIdWithExt[..dotIndex] : publicIdWithExt;
        }
        catch
        {
            return null;
        }
    }
}

public record UpdateProfileRequest(
    string?   FullName,
    string?   Phone,
    string?   Address,
    DateOnly? DateOfBirth,
    string?   Gender
);

public record ChangePasswordRequest(
    string OldPassword,
    string NewPassword
);
