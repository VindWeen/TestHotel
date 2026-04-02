using HotelManagement.API.Services;
using HotelManagement.Core.Entities;
using Xunit;

namespace HotelManagement.Tests;

public class VoucherValidationServiceTests
{
    private readonly VoucherValidationService _service = new();

    [Fact]
    public void ValidateDefinition_PercentOver100_ReturnsFalse()
    {
        var ok = _service.ValidateDefinition("PERCENT", 120, null, null, 10, 1, out var error);
        Assert.False(ok);
        Assert.Contains("không được vượt quá 100", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidateUsage_ExpiredVoucher_ReturnsFalse()
    {
        var voucher = new Voucher
        {
            Code = "TEST",
            DiscountType = "PERCENT",
            DiscountValue = 10,
            IsActive = true,
            ValidTo = DateTime.UtcNow.AddDays(-1)
        };

        var ok = _service.ValidateUsage(voucher, 100000, DateTime.UtcNow, out var error);
        Assert.False(ok);
        Assert.Contains("hết hạn", error, StringComparison.OrdinalIgnoreCase);
    }
}
