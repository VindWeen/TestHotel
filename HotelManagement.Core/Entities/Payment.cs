namespace HotelManagement.Core.Entities;

public class Payment
{
    public int Id { get; set; }
    public int? InvoiceId { get; set; }
    public string? PaymentType { get; set; }   // Deposit / Final_Settlement / Refund
    public string? PaymentMethod { get; set; } // Cash / VNPay / Credit Card / Bank Transfer
    public decimal AmountPaid { get; set; }
    public string? TransactionCode { get; set; }
    public string Status { get; set; } = "Success"; // Success / Failed / Pending
    public DateTime? PaymentDate { get; set; }
    public string? Note { get; set; }

    // Navigation
    public Invoice? Invoice { get; set; }
}
