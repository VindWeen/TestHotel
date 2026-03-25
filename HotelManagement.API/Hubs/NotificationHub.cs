using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HotelManagement.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    /// <summary>
    /// Khi client kết nối, tự động thêm vào Group theo Role.
    /// Ví dụ: Admin → Group "Admin", Receptionist → Group "Receptionist"
    /// Nhờ đó có thể broadcast thông báo đến toàn bộ 1 Role cùng lúc.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var roleName = Context.User?.FindFirst("role")?.Value;

        if (!string.IsNullOrEmpty(roleName))
            await Groups.AddToGroupAsync(Context.ConnectionId, roleName);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var roleName = Context.User?.FindFirst("role")?.Value;

        if (!string.IsNullOrEmpty(roleName))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roleName);

        await base.OnDisconnectedAsync(exception);
    }
}
