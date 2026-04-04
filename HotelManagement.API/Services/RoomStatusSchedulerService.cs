using HotelManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Services;

public sealed class RoomStatusSchedulerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RoomStatusSchedulerService> _logger;
    private readonly TimeSpan[] _triggerTimes =
    [
        new TimeSpan(11, 0, 0),
        new TimeSpan(23, 0, 0),
    ];

    public RoomStatusSchedulerService(IServiceScopeFactory scopeFactory, ILogger<RoomStatusSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = DateTime.Now;
                var nextRun = _triggerTimes
                    .Select(t => now.Date + t)
                    .Where(t => t > now)
                    .DefaultIfEmpty(now.Date.AddDays(1) + _triggerTimes[0])
                    .Min();

                var delay = nextRun - now;
                if (delay > TimeSpan.Zero)
                    await Task.Delay(delay, stoppingToken);

                await MarkRoomsDirtyAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RoomStatusSchedulerService failed.");
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }
    }

    private async Task MarkRoomsDirtyAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var rooms = await db.Rooms
            .Where(r => r.BusinessStatus == "Available" && r.CleaningStatus == "Clean")
            .ToListAsync(cancellationToken);

        if (rooms.Count == 0)
            return;

        foreach (var room in rooms)
        {
            room.CleaningStatus = "Dirty";
            room.Status = "Cleaning";
        }

        await db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Marked {Count} available rooms as Dirty by schedule.", rooms.Count);
    }
}
