using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HotelManagement.Core.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HotelManagement.Core.Helpers;

public class JwtHelper
{
    private readonly IConfiguration _config;

    public JwtHelper(IConfiguration config)
    {
        _config = config;
    }

    /// <summary>
    /// Tạo JWT token chứa userId, email, roleName và danh sách permission_code.
    /// Permission được đóng gói dưới dạng nhiều claim cùng type "permission".
    /// </summary>
    public string GenerateToken(User user, string roleName, IEnumerable<string> permissionCodes)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(double.Parse(_config["Jwt:ExpiresInMinutes"]!));

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("role",                        roleName),
            new("full_name",                   user.FullName),
        };

        // Mỗi permission_code là 1 claim riêng
        // → Handler đọc bằng: context.User.FindAll("permission")
        foreach (var code in permissionCodes)
            claims.Add(new Claim("permission", code));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Đọc userId từ HttpContext.User — dùng trong controller.
    /// Tuyệt đối không nhận userId từ request body.
    /// </summary>
    public static int GetUserId(ClaimsPrincipal principal)
    {
        var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
               ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return int.Parse(sub!);
    }

    public static string? GetEmail(ClaimsPrincipal principal)
        => principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
}
