using HotelManagement.API.Services;
using Xunit;

namespace HotelManagement.Tests;

public class PaymentServiceTests
{
    private readonly PaymentService _service = new();

    [Theory]
    [InlineData(1)]
    [InlineData(1000)]
    public void IsValidAmount_Positive_ReturnsTrue(decimal amount)
    {
        Assert.True(_service.IsValidAmount(amount));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void EnsureValidAmount_NonPositive_Throws(decimal amount)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => _service.EnsureValidAmount(amount));
    }
}
