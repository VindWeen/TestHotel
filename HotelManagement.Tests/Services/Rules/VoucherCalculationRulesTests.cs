using HotelManagement.API.Services;
using HotelManagement.Core.Constants;
using HotelManagement.Core.Entities;
using Xunit;

namespace HotelManagement.Tests.Services.Rules;

public class VoucherCalculationRulesTests
{
    private readonly VoucherValidationService _service = new();

    [Fact]
    public void CalculateDiscount_PercentVoucher_RespectsMaxDiscountAmount()
    {
        var voucher = new Voucher
        {
            DiscountType = VoucherDiscountTypes.Percent,
            DiscountValue = 20m,
            MaxDiscountAmount = 100m
        };

        var discount = _service.CalculateDiscount(voucher, 1000m);

        Assert.Equal(100m, discount);
    }

    [Fact]
    public void CalculateDiscount_FixedAmount_DoesNotExceedBookingAmount()
    {
        var voucher = new Voucher
        {
            DiscountType = VoucherDiscountTypes.FixedAmount,
            DiscountValue = 300m
        };

        var discount = _service.CalculateDiscount(voucher, 200m);

        Assert.Equal(200m, discount);
    }
}
