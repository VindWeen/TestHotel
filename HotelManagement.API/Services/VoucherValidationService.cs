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
            errorMessage = "Loại giảm giá phải là PERCENT hoặc FIXED_AMOUNT.";
            return false;
        }

        if (discountValue <= 0)
        {
            errorMessage = "Giá trị giảm phải lớn hơn 0.";
            return false;
        }

        if (discountType == VoucherDiscountTypes.Percent && discountValue > 100)
        {
            errorMessage = "Phần trăm giảm giá không được vượt quá 100%.";
            return false;
        }

        if (validFrom.HasValue && validTo.HasValue && validFrom >= validTo)
        {
            errorMessage = "ValidFrom phải trước ValidTo.";
            return false;
        }

        if (usageLimit.HasValue && usageLimit.Value <= 0)
        {
            errorMessage = "Giới hạn sử dụng phải lớn hơn 0.";
            return false;
        }

        if (maxUsesPerUser <= 0)
        {
            errorMessage = "Số lượt dùng tối đa mỗi user phải lớn hơn 0.";
            return false;
        }

        errorMessage = string.Empty;
        return true;
    }

    public bool ValidateUsage(Voucher voucher, decimal bookingAmount, DateTime nowUtc, out string errorMessage)
    {
        if (!voucher.IsActive)
        {
            errorMessage = "Voucher đã bị vô hiệu hóa.";
            return false;
        }

        if (voucher.ValidFrom.HasValue && nowUtc < voucher.ValidFrom.Value)
        {
            errorMessage = "Voucher chưa đến ngày sử dụng.";
            return false;
        }

        if (voucher.ValidTo.HasValue && nowUtc > voucher.ValidTo.Value)
        {
            errorMessage = "Voucher đã hết hạn.";
            return false;
        }

        if (voucher.UsageLimit.HasValue && voucher.UsedCount >= voucher.UsageLimit.Value)
        {
            errorMessage = "Voucher đã hết lượt sử dụng.";
            return false;
        }

        if (voucher.MinBookingValue.HasValue && bookingAmount < voucher.MinBookingValue.Value)
        {
            errorMessage = $"Đơn hàng tối thiểu {voucher.MinBookingValue.Value:N0}đ để dùng voucher này.";
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

