using HotelManagement.API.Services;
using Xunit;

namespace HotelManagement.Tests;

public class BookingStatusFlowServiceTests
{
    private readonly BookingStatusFlowService _service = new();

    [Fact]
    public void CanTransition_PendingToConfirmed_ReturnsTrue()
    {
        var ok = _service.CanTransition("Pending", "Confirmed", out var error);
        Assert.True(ok);
        Assert.Equal(string.Empty, error);
    }

    [Fact]
    public void CanTransition_CheckedInToCancelled_ReturnsFalse()
    {
        var ok = _service.CanTransition("Checked_in", "Cancelled", out var error);
        Assert.False(ok);
        Assert.Contains("Không thể chuyển trạng thái", error, StringComparison.OrdinalIgnoreCase);
    }
}
