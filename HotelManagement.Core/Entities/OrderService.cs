namespace HotelManagement.Core.Entities;

public class OrderService
{
    public int Id { get; set; }
    public int? BookingDetailId { get; set; }
    public DateTime? OrderDate { get; set; }
    public decimal? TotalAmount { get; set; }
    public string? Status { get; set; } // Pending / Delivered / Cancelled
    public string? Note { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public BookingDetail? BookingDetail { get; set; }
    public ICollection<OrderServiceDetail> OrderServiceDetails { get; set; } = [];
}
