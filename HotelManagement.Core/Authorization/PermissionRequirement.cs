using Microsoft.AspNetCore.Authorization;

namespace HotelManagement.Core.Authorization;

/// <summary>
/// Requirement mang permission_code cần kiểm tra.
/// Được tạo tự động bởi PermissionPolicyProvider cho mỗi policy name = permission code.
/// </summary>
public class PermissionRequirement : IAuthorizationRequirement
{
    public string PermissionCode { get; }

    public PermissionRequirement(string permissionCode)
    {
        PermissionCode = permissionCode;
    }
}
