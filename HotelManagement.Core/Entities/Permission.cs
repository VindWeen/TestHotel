namespace HotelManagement.Core.Entities;

public class Permission
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string PermissionCode { get; set; } = null!;

    // Navigation
    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
