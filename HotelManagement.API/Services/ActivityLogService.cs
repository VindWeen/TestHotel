using System.Threading.Tasks;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.API.Policies;

namespace HotelManagement.API.Services;

public interface IActivityLogService
{
    /// <summary>
    /// Ghi log hoạt động vào DB và gửi thông báo Realtime nếu cần.
    /// Danh sách role nhận thông báo được tra tự động từ NotificationPolicy.
    /// </summary>
    Task LogAsync(ActivityLog log, bool notify = true);

    /// <summary>
    /// Tiện ích ghi log nhanh.
    /// </summary>
    Task LogAsync(
        string actionCode,
        string actionLabel,
        string message,
        string entityType,
        int? entityId = null,
        string? entityLabel = null,
        string severity = "Info",
        int? userId = null,
        string? roleName = null,
        string? metadata = null,
        bool notify = true);
}

public class ActivityLogService : IActivityLogService
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notification;

    public ActivityLogService(AppDbContext db, INotificationService notification)
    {
        _db = db;
        _notification = notification;
    }

    public async Task LogAsync(ActivityLog log, bool notify = true)
    {
        if (log.CreatedAt == default)
            log.CreatedAt = DateTime.UtcNow;

        _db.ActivityLogs.Add(log);
        await _db.SaveChangesAsync();

        if (notify)
        {
            // Tra cứu từ NotificationPolicy — nguồn cấu hình duy nhất
            var targets = NotificationPolicy.GetRolesForAction(log.ActionCode ?? "");
            await _notification.SendToRolesAsync(targets, log.ActionLabel, log.Message, log.ActionCode);
        }
    }

    public async Task LogAsync(
        string actionCode,
        string actionLabel,
        string message,
        string entityType,
        int? entityId = null,
        string? entityLabel = null,
        string severity = "Info",
        int? userId = null,
        string? roleName = null,
        string? metadata = null,
        bool notify = true)
    {
        var log = new ActivityLog
        {
            UserId = userId,
            RoleName = roleName,
            ActionCode = actionCode,
            ActionLabel = actionLabel,
            EntityType = entityType,
            EntityId = entityId,
            EntityLabel = entityLabel,
            Severity = severity,
            Message = message,
            Metadata = metadata,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        await LogAsync(log, notify);
    }
}
