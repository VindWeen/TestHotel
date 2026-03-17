using Microsoft.AspNetCore.Authorization;

namespace HotelManagement.Core.Authorization;

/// <summary>
/// Handler kiểm tra xem JWT hiện tại có chứa claim "permission" = requirement.PermissionCode không.
/// Claim "permission" được đóng gói vào token lúc login (xem JwtHelper).
/// </summary>
public class PermissionAuthorizationHandler
    : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        // Lấy tất cả claim có type = "permission"
        var permissions = context.User
            .FindAll("permission")
            .Select(c => c.Value);

        if (permissions.Contains(requirement.PermissionCode))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
