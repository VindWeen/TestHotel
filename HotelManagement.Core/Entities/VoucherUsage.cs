namespace HotelManagement.Core.Entities;

public class VoucherUsage
{
    public int Id { get; set; }
    public int VoucherId { get; set; }
    public int UserId { get; set; }
    public int BookingId { get; set; }
    public DateTime UsedAt { get; set; }

    // Navigation
    public Voucher Voucher { get; set; } = null!;
    public User User { get; set; } = null!;
    public Booking Booking { get; set; } = null!;
}
