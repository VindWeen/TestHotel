namespace HotelManagement.Core.Entities;

public class LoyaltyTransaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? BookingId { get; set; }
    public string TransactionType { get; set; } = null!; // earned / redeemed / expired
    public int Points { get; set; }       // dương: cộng, âm: trừ
    public int BalanceAfter { get; set; } // số dư sau giao dịch
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Booking? Booking { get; set; }
}
