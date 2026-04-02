using HotelManagement.Core.Entities;
using HotelManagement.Core.Constants;

namespace HotelManagement.API.Services;

public interface IVoucherValidationService
{
    bool ValidateDefinition(
        string discountType,
        decimal discountValue,
        DateTime? validFrom,
        DateTime? validTo,
        int? usageLimit,
        int maxUsesPerUser,
        out string errorMessage);

    bool ValidateUsage(Voucher voucher, decimal bookingAmount, DateTime nowUtc, out string errorMessage);
    decimal CalculateDiscount(Voucher voucher, decimal bookingAmount);
}

public class VoucherValidationService : IVoucherValidationService
{
    public bool ValidateDefinition(
        string discountType,
        decimal discountValue,
        DateTime? validFrom,
        DateTime? validTo,
        int? usageLimit,
        int maxUsesPerUser,
        out string errorMessage)
    {
        if (discountType != VoucherDiscountTypes.Percent && discountType != VoucherDiscountTypes.FixedAmount)
        {
            errorMessage = "Loáº¡i giáº£m giĂ¡ pháº£i lĂ  PERCENT hoáº·c FIXED_AMOUNT.";
            return false;
        }

        if (discountValue <= 0)
        {
            errorMessage = "GiĂ¡ trá»‹ giáº£m pháº£i lá»›n hÆ¡n 0.";
            return false;
        }

        if (discountType == VoucherDiscountTypes.Percent && discountValue > 100)
        {
            errorMessage = "Pháº§n trÄƒm giáº£m giĂ¡ khĂ´ng Ä‘Æ°á»£c vÆ°á»£t quĂ¡ 100%.";
            return false;
        }

        if (validFrom.HasValue && validTo.HasValue && validFrom >= validTo)
        {
            errorMessage = "ValidFrom pháº£i trÆ°á»›c ValidTo.";
            return false;
        }

        if (usageLimit.HasValue && usageLimit.Value <= 0)
        {
            errorMessage = "Giá»›i háº¡n sá»­ dá»¥ng pháº£i lá»›n hÆ¡n 0.";
            return false;
        }

        if (maxUsesPerUser <= 0)
        {
            errorMessage = "Sá»‘ lÆ°á»£t dĂ¹ng tá»‘i Ä‘a má»—i user pháº£i lá»›n hÆ¡n 0.";
            return false;
        }

        errorMessage = string.Empty;
        return true;
    }

    public bool ValidateUsage(Voucher voucher, decimal bookingAmount, DateTime nowUtc, out string errorMessage)
    {
        if (!voucher.IsActive)
        {
            errorMessage = "Voucher Ä‘Ă£ bá»‹ vĂ´ hiá»‡u hĂ³a.";
            return false;
        }

        if (voucher.ValidFrom.HasValue && nowUtc < voucher.ValidFrom.Value)
        {
            errorMessage = "Voucher chÆ°a Ä‘áº¿n ngĂ y sá»­ dá»¥ng.";
            return false;
        }

        if (voucher.ValidTo.HasValue && nowUtc > voucher.ValidTo.Value)
        {
            errorMessage = "Voucher Ä‘Ă£ háº¿t háº¡n.";
            return false;
        }

        if (voucher.UsageLimit.HasValue && voucher.UsedCount >= voucher.UsageLimit.Value)
        {
            errorMessage = "Voucher Ä‘Ă£ háº¿t lÆ°á»£t sá»­ dá»¥ng.";
            return false;
        }

        if (voucher.MinBookingValue.HasValue && bookingAmount < voucher.MinBookingValue.Value)
        {
            errorMessage = $"ÄÆ¡n hĂ ng tá»‘i thiá»ƒu {voucher.MinBookingValue.Value:N0}Ä‘ Ä‘á»ƒ dĂ¹ng voucher nĂ y.";
            return false;
        }

        errorMessage = string.Empty;
        return true;
    }

    public decimal CalculateDiscount(Voucher voucher, decimal bookingAmount)
    {
        decimal discount;
        if (voucher.DiscountType == VoucherDiscountTypes.Percent)
        {
            discount = bookingAmount * voucher.DiscountValue / 100;
            if (voucher.MaxDiscountAmount.HasValue)
                discount = Math.Min(discount, voucher.MaxDiscountAmount.Value);
        }
        else
        {
            discount = voucher.DiscountValue;
        }

        return Math.Min(discount, bookingAmount);
    }
}

