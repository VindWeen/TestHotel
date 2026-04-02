using HotelManagement.Infrastructure.Data;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;

namespace HotelManagement.API.Services;

public sealed class AuditTrailEntry
{
    public string ActionCode { get; set; } = string.Empty;
    public string ActionLabel { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public int? EntityId { get; set; }
    public string? EntityLabel { get; set; }
    public string Severity { get; set; } = "Info";
    public string TableName { get; set; } = string.Empty;
    public int? RecordId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? Metadata { get; set; }
}

public interface IAuditTrailService
{
    Task WriteAsync(
        AppDbContext db,
        ClaimsPrincipal user,
        HttpRequest request,
        AuditTrailEntry entry,
        CancellationToken cancellationToken = default);
}

public class AuditTrailService : IAuditTrailService
{
    private readonly IActivityLogService _activityLog;

    public AuditTrailService(IActivityLogService activityLog)
    {
        _activityLog = activityLog;
    }

    public async Task WriteAsync(
        AppDbContext db,
        ClaimsPrincipal user,
        HttpRequest request,
        AuditTrailEntry entry,
        CancellationToken cancellationToken = default)
    {
        var userId = JwtHelper.GetUserId(user);
        var roleName = user.FindFirst(ClaimTypes.Role)?.Value ?? user.FindFirst("role")?.Value;

        await _activityLog.LogAsync(
            actionCode: entry.ActionCode,
            actionLabel: entry.ActionLabel,
            message: entry.Message,
            entityType: entry.EntityType,
            entityId: entry.EntityId,
            entityLabel: entry.EntityLabel,
            severity: entry.Severity,
            userId: userId,
            roleName: roleName,
            metadata: entry.Metadata
        );

        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = entry.ActionCode,
            TableName = entry.TableName,
            RecordId = entry.RecordId ?? entry.EntityId ?? 0,
            OldValue = entry.OldValue,
            NewValue = entry.NewValue,
            UserAgent = request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}

