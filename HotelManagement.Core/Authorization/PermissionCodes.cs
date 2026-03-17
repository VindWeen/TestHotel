namespace HotelManagement.Core.Authorization;

/// <summary>
/// Danh sách permission_code khớp chính xác với cột permission_code trong bảng Permissions.
/// Dùng làm tham số cho [RequirePermission] attribute và PermissionRequirement.
/// </summary>
public static class PermissionCodes
{
    public const string ViewDashboard   = "VIEW_DASHBOARD";
    public const string ManageUsers     = "MANAGE_USERS";
    public const string ManageRoles     = "MANAGE_ROLES";
    public const string ManageRooms     = "MANAGE_ROOMS";
    public const string ManageBookings  = "MANAGE_BOOKINGS";
    public const string ManageInvoices  = "MANAGE_INVOICES";
    public const string ManageServices  = "MANAGE_SERVICES";
    public const string ViewReports     = "VIEW_REPORTS";
    public const string ManageContent   = "MANAGE_CONTENT";
    public const string ManageInventory = "MANAGE_INVENTORY";
}
