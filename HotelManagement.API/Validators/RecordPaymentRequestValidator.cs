using FluentValidation;
using HotelManagement.API.Controllers;

namespace HotelManagement.API.Validators;

public class RecordPaymentRequestValidator : AbstractValidator<RecordPaymentRequest>
{
    public RecordPaymentRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => x.BookingId.HasValue ^ x.InvoiceId.HasValue)
            .WithMessage("Thanh toán ph?i g?n ðúng m?t trong hai ð?i tý?ng: booking ho?c hóa ðõn.");

        When(x => x.BookingId.HasValue, () =>
        {
            RuleFor(x => x.BookingId)
                .GreaterThan(0).WithMessage("Booking không h?p l?.");
        });

        When(x => x.InvoiceId.HasValue, () =>
        {
            RuleFor(x => x.InvoiceId)
                .GreaterThan(0).WithMessage("Hóa ðõn không h?p l?.");
        });

        RuleFor(x => x.AmountPaid)
            .GreaterThan(0).WithMessage("S? ti?n thanh toán ph?i l?n hõn 0.");

        RuleFor(x => x.PaymentType)
            .MaximumLength(50).WithMessage("Lo?i thanh toán t?i ða 50 k? t?.");

        RuleFor(x => x.PaymentMethod)
            .MaximumLength(50).WithMessage("Phýõng th?c thanh toán t?i ða 50 k? t?.");

        RuleFor(x => x.TransactionCode)
            .MaximumLength(100).WithMessage("M? giao d?ch t?i ða 100 k? t?.");
    }
}
