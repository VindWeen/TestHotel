namespace HotelManagement.Core.Entities;

public class Booking
{
    public int Id { get; set; }
    public int? UserId { get; set; }

    // Thông tin khách
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string? GuestEmail { get; set; }
    public int NumAdults { get; set; } = 1;
    public int NumChildren { get; set; } = 0;

    // Mã & voucher
    public string BookingCode { get; set; } = null!;
    public int? VoucherId { get; set; }

    // Tiền
    public decimal TotalEstimatedAmount { get; set; } = 0;
    public decimal? DepositAmount { get; set; }
    public decimal RequiredBookingDepositAmount { get; set; } = 0;
    public decimal RequiredCheckInAmount { get; set; } = 0;

    // Check-in/out thực tế
    public DateTime? CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }

    // Trạng thái & nguồn
    public string? Status { get; set; } // Pending / Confirmed / Checked_in / Checked_out_pending_settlement / Completed / Cancelled
    public string Source { get; set; } = "online"; // online / walk_in / phone

    // Ghi chú & hủy
    public string? Note { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }

    // Navigation
    public User? User { get; set; }
    public Voucher? Voucher { get; set; }
    public ICollection<BookingDetail> BookingDetails { get; set; } = [];
    public ICollection<Invoice> Invoices { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<Review> Reviews { get; set; } = [];
    public ICollection<LoyaltyTransaction> LoyaltyTransactions { get; set; } = [];
    public ICollection<VoucherUsage> VoucherUsages { get; set; } = [];
}
