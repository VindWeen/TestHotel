namespace HotelManagement.Core.Entities;

public class InvoiceAdjustment
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public string AdjustmentType { get; set; } = "Surcharge"; // Surcharge / Discount
    public decimal Amount { get; set; }
    public string Reason { get; set; } = null!;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public Invoice Invoice { get; set; } = null!;
}
