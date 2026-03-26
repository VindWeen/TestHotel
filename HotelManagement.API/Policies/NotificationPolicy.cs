namespace HotelManagement.API.Policies;

/// <summary>
/// Nguồn cấu hình duy nhất cho toàn bộ quy tắc thông báo (Notification Rules).
/// Để thay đổi ai nhận thông báo nào, chỉ cần chỉnh sửa TẠI ĐÂY.
/// Mặc định (action không có trong map): gửi cho cả Admin và Manager.
/// </summary>
public static class NotificationPolicy
{
    /// <summary>
    /// Ánh xạ ActionCode → danh sách Role nhận thông báo (realtime + history).
    /// </summary>
    private static readonly Dictionary<string, string[]> ActionRoleMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // ── Quản lý Quyền (chỉ Admin) ─────────────────────────────────────────
        { "GRANT_PERMISSION",           new[] { "Admin" } },
        { "REVOKE_PERMISSION",          new[] { "Admin" } },

        // ── Quản lý Người dùng (Admin + Manager) ──────────────────────────────
        { "CREATE_USER",                new[] { "Admin", "Manager" } },
        { "UPDATE_USER",                new[] { "Admin", "Manager" } },
        { "LOCK_ACCOUNT",               new[] { "Admin", "Manager" } },
        { "UNLOCK_ACCOUNT",             new[] { "Admin", "Manager" } },
        { "CHANGE_ROLE",                new[] { "Admin", "Manager" } },

        // ── Đặt phòng (Admin + Manager) ───────────────────────────────────────
        { "CREATE_BOOKING",             new[] { "Admin", "Manager" } },
        { "CONFIRM_BOOKING",            new[] { "Admin", "Manager" } },
        { "CANCEL_BOOKING",             new[] { "Admin", "Manager" } },
        { "CHECKIN_BOOKING",            new[] { "Admin", "Manager" } },
        { "CHECKOUT_BOOKING",           new[] { "Admin", "Manager" } },

        // ── Phòng (Admin + Manager) ────────────────────────────────────────────
        { "CREATE_ROOM",                new[] { "Admin", "Manager" } },
        { "UPDATE_ROOM",                new[] { "Admin", "Manager" } },
        { "BULK_CREATE_ROOMS",          new[] { "Admin", "Manager" } },
        { "UPDATE_ROOM_STATUS",         new[] { "Admin", "Manager" } },
        { "UPDATE_ROOM_CLEANING",       new[] { "Admin", "Manager" } },

        // ── Loại phòng (Admin + Manager) ──────────────────────────────────────
        { "DELETE_ROOM_TYPE",           new[] { "Admin", "Manager" } },

        // ── Tiện nghi / Địa điểm / Bài viết (Admin + Manager) ────────────────
        { "DELETE_AMENITY",             new[] { "Admin", "Manager" } },
        { "DELETE_ATTRACTION",          new[] { "Admin", "Manager" } },
        { "CREATE_ARTICLE",             new[] { "Admin", "Manager" } },
        { "DELETE_ARTICLE",             new[] { "Admin", "Manager" } },
    };

    /// <summary>
    /// Trả về danh sách Role cần nhận thông báo cho một ActionCode.
    /// Nếu action chưa có trong map, trả về default ["Admin", "Manager"].
    /// </summary>
    public static string[] GetRolesForAction(string actionCode)
        => ActionRoleMap.TryGetValue(actionCode, out var roles)
            ? roles
            : new[] { "Admin", "Manager" };

    /// <summary>
    /// Kiểm tra xem một role có được phép nhận thông báo cho action này không.
    /// Dùng để filter history trong ActivityLogsController.
    /// </summary>
    public static bool CanRoleViewAction(string roleName, string actionCode)
        => GetRolesForAction(actionCode).Contains(roleName, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Trả về HashSet ActionCode bị chặn với role này.
    /// = Các action CÓ explicit mapping nhưng KHÔNG bao gồm role này.
    /// Actions không có trong map → default [Admin, Manager] → không chặn.
    /// Dùng blacklist thay whitelist để không vô tình ẩn các action "default".
    /// </summary>
    public static HashSet<string> GetBlockedActionCodesForRole(string roleName)
    {
        return ActionRoleMap
            .Where(kv => !kv.Value.Contains(roleName, StringComparer.OrdinalIgnoreCase))
            .Select(kv => kv.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
