namespace HotelManagement.Core.Entities;

public class Payment
{
    public int Id { get; set; }
    public int? BookingId { get; set; }
    public int? InvoiceId { get; set; }
    public string? PaymentType { get; set; }   // Booking_Deposit / CheckIn_Collection / Final_Settlement / Refund
    public string? PaymentMethod { get; set; } // Cash / VNPay / Credit Card / Bank Transfer
    public decimal AmountPaid { get; set; }
    public string? TransactionCode { get; set; }
    public string Status { get; set; } = "Success"; // Success / Failed / Pending
    public DateTime? PaymentDate { get; set; }
    public string? Note { get; set; }

    // Navigation
    public Booking? Booking { get; set; }
    public Invoice? Invoice { get; set; }
}
