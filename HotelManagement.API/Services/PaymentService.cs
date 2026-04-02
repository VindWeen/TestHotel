namespace HotelManagement.API.Services;

public interface IPaymentService
{
    bool IsValidAmount(decimal amount);
    void EnsureValidAmount(decimal amount);
}

public class PaymentService : IPaymentService
{
    public bool IsValidAmount(decimal amount) => amount > 0;

    public void EnsureValidAmount(decimal amount)
    {
        if (!IsValidAmount(amount))
            throw new ArgumentOutOfRangeException(nameof(amount), "Sá»‘ tiá»n thanh toĂ¡n pháº£i lá»›n hÆ¡n 0.");
    }
}

