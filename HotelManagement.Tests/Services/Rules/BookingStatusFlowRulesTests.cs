using HotelManagement.API.Services;
using HotelManagement.Core.Constants;
using Xunit;

namespace HotelManagement.Tests.Services.Rules;

public class BookingStatusFlowRulesTests
{
    private readonly BookingStatusFlowService _service = new();

    [Theory]
    [InlineData(BookingStatuses.Pending, BookingStatuses.Confirmed, true)]
    [InlineData(BookingStatuses.Confirmed, BookingStatuses.CheckedIn, true)]
    [InlineData(BookingStatuses.CheckedIn, BookingStatuses.CheckedOutPendingSettlement, true)]
    [InlineData(BookingStatuses.CheckedOutPendingSettlement, BookingStatuses.Completed, true)]
    [InlineData(BookingStatuses.Completed, BookingStatuses.Confirmed, false)]
    [InlineData(BookingStatuses.Cancelled, BookingStatuses.Confirmed, false)]
    public void CanTransition_FollowsConfiguredRules(string from, string to, bool expected)
    {
        var ok = _service.CanTransition(from, to, out _);
        Assert.Equal(expected, ok);
    }
}
