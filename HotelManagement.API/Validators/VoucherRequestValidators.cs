using FluentValidation;
using HotelManagement.API.Controllers;
using HotelManagement.Core.Constants;

namespace HotelManagement.API.Validators;

public class CreateVoucherRequestValidator : AbstractValidator<CreateVoucherRequest>
{
    public CreateVoucherRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã voucher không được để trống.")
            .MaximumLength(50).WithMessage("Mã voucher tối đa 50 ký tự.");

        RuleFor(x => x.DiscountType)
            .Must(x => x == VoucherDiscountTypes.Percent || x == VoucherDiscountTypes.FixedAmount)
            .WithMessage("Loại giảm giá phải là PERCENT hoặc FIXED_AMOUNT.");

        RuleFor(x => x.DiscountValue)
            .GreaterThan(0).WithMessage("Giá trị giảm phải lớn hơn 0.");

        RuleFor(x => x)
            .Must(x => x.DiscountType != VoucherDiscountTypes.Percent || x.DiscountValue <= 100)
            .WithMessage("Phần trăm giảm giá không được vượt quá 100%.");

        RuleFor(x => x)
            .Must(x => !x.ValidFrom.HasValue || !x.ValidTo.HasValue || x.ValidFrom < x.ValidTo)
            .WithMessage("ValidFrom phải trước ValidTo.");

        RuleFor(x => x.UsageLimit)
            .Must(v => !v.HasValue || v.Value > 0)
            .WithMessage("Giới hạn sử dụng phải lớn hơn 0.");

        RuleFor(x => x.MaxUsesPerUser)
            .GreaterThan(0).WithMessage("Số lượt dùng tối đa mỗi user phải lớn hơn 0.");
    }
}

public class UpdateVoucherRequestValidator : AbstractValidator<UpdateVoucherRequest>
{
    public UpdateVoucherRequestValidator()
    {
        RuleFor(x => x.DiscountType)
            .Must(x => x is null || x == VoucherDiscountTypes.Percent || x == VoucherDiscountTypes.FixedAmount)
            .WithMessage("Loại giảm giá phải là PERCENT hoặc FIXED_AMOUNT.");

        RuleFor(x => x.DiscountValue)
            .Must(v => !v.HasValue || v.Value > 0)
            .WithMessage("Giá trị giảm phải lớn hơn 0.");

        RuleFor(x => x)
            .Must(x =>
            {
                if (x.DiscountType != VoucherDiscountTypes.Percent) return true;
                return !x.DiscountValue.HasValue || x.DiscountValue.Value <= 100;
            })
            .WithMessage("Phần trăm giảm giá không được vượt quá 100%.");

        RuleFor(x => x.UsageLimit)
            .Must(v => !v.HasValue || v.Value > 0)
            .WithMessage("Giới hạn sử dụng phải lớn hơn 0.");

        RuleFor(x => x.MaxUsesPerUser)
            .Must(v => !v.HasValue || v.Value > 0)
            .WithMessage("Số lượt dùng tối đa mỗi user phải lớn hơn 0.");
    }
}
