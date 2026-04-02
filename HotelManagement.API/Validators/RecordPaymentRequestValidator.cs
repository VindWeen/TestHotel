using FluentValidation;
using HotelManagement.API.Controllers;

namespace HotelManagement.API.Validators;

public class RecordPaymentRequestValidator : AbstractValidator<RecordPaymentRequest>
{
    public RecordPaymentRequestValidator()
    {
        RuleFor(x => x.InvoiceId)
            .GreaterThan(0).WithMessage("Hóa đơn không hợp lệ.");

        RuleFor(x => x.AmountPaid)
            .GreaterThan(0).WithMessage("Số tiền thanh toán phải lớn hơn 0.");

        RuleFor(x => x.PaymentType)
            .MaximumLength(50).WithMessage("Loại thanh toán tối đa 50 ký tự.");

        RuleFor(x => x.PaymentMethod)
            .MaximumLength(50).WithMessage("Phương thức thanh toán tối đa 50 ký tự.");

        RuleFor(x => x.TransactionCode)
            .MaximumLength(100).WithMessage("Mã giao dịch tối đa 100 ký tự.");
    }
}
