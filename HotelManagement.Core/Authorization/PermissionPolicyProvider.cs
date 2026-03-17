using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace HotelManagement.Core.Authorization;

/// <summary>
/// Tự động tạo AuthorizationPolicy từ tên policy = permission_code.
/// Nhờ provider này, viết [Authorize(Policy = "MANAGE_ROOMS")] là đủ —
/// không cần đăng ký từng policy tay trong Program.cs.
/// </summary>
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync()
        => _fallback.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync()
        => _fallback.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        // Nếu policy name là chữ hoa + gạch dưới (pattern của permission code)
        // thì tự build policy với PermissionRequirement tương ứng
        if (!string.IsNullOrEmpty(policyName) && policyName == policyName.ToUpper())
        {
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(policyName))
                .Build();

            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        // Fallback cho các policy khác
        return _fallback.GetPolicyAsync(policyName);
    }
}
