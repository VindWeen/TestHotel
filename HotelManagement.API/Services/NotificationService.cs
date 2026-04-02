using HotelManagement.API.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace HotelManagement.API.Services;

public interface INotificationService
{
    Task SendToRoleAsync(string role, string title, string message, string? action = null);
    Task SendToRolesAsync(IEnumerable<string> roles, string title, string message, string? action = null);
    Task SendToAllAsync(string title, string message, string? action = null);
}

public class NotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hub;

    public NotificationService(IHubContext<NotificationHub> hub)
    {
        _hub = hub;
    }

    public async Task SendToRoleAsync(string role, string title, string message, string? action = null)
    {
        await _hub.Clients.Group(role).SendAsync("ReceiveNotification", BuildPayload(title, message, action));
    }

    public async Task SendToRolesAsync(IEnumerable<string> roles, string title, string message, string? action = null)
    {
        var payload = BuildPayload(title, message, action);
        foreach (var role in roles)
            await _hub.Clients.Group(role).SendAsync("ReceiveNotification", payload);
    }

    public async Task SendToAllAsync(string title, string message, string? action = null)
    {
        await _hub.Clients.All.SendAsync("ReceiveNotification", BuildPayload(title, message, action));
    }

    private static object BuildPayload(string title, string message, string? action) => new
    {
        title,
        message,
        action,
        createdAt = DateTime.UtcNow
    };
}

