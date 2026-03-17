using Microsoft.AspNetCore.Authorization;

namespace HotelManagement.Core.Authorization;

/// <summary>
/// Attribute tiện lợi thay cho [Authorize(Policy = "MANAGE_ROOMS")].
/// Dùng: [RequirePermission(PermissionCodes.ManageRooms)]
/// Có thể stack nhiều cái: cả hai permission đều phải có (AND logic).
/// </summary>
public class RequirePermissionAttribute : AuthorizeAttribute
{
    public RequirePermissionAttribute(string permissionCode)
        : base(permissionCode)
    {
    }
}
