using FluentValidation;
using HotelManagement.Core.DTOs;

namespace HotelManagement.API.Validators;

public class CreateBookingRequestValidator : AbstractValidator<CreateBookingRequest>
{
    public CreateBookingRequestValidator()
    {
        RuleFor(x => x.GuestName)
            .NotEmpty().WithMessage("Tên khách không được để trống.")
            .MaximumLength(120).WithMessage("Tên khách tối đa 120 ký tự.");

        RuleFor(x => x.GuestPhone)
            .NotEmpty().WithMessage("Số điện thoại không được để trống.")
            .MaximumLength(20).WithMessage("Số điện thoại tối đa 20 ký tự.");

        RuleFor(x => x.GuestEmail)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.");

        RuleFor(x => x.NumAdults)
            .GreaterThan(0).WithMessage("Số người lớn phải lớn hơn 0.");

        RuleFor(x => x.NumChildren)
            .GreaterThanOrEqualTo(0).WithMessage("Số trẻ em không được âm.");

        RuleFor(x => x.Details)
            .NotNull().WithMessage("Danh sách phòng không được để trống.")
            .Must(x => x.Count > 0).WithMessage("Danh sách phòng không được để trống.");

        RuleForEach(x => x.Details).SetValidator(new CreateBookingDetailRequestValidator());
    }
}

public class CreateBookingDetailRequestValidator : AbstractValidator<CreateBookingDetailRequest>
{
    public CreateBookingDetailRequestValidator()
    {
        RuleFor(x => x.RoomTypeId)
            .GreaterThan(0).WithMessage("Loại phòng không hợp lệ.");

        RuleFor(x => x.CheckOutDate)
            .GreaterThan(x => x.CheckInDate)
            .WithMessage("Ngày check-out phải sau ngày check-in.");
    }
}
