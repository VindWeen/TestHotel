namespace HotelManagement.Core.Entities;

public class LossAndDamage
{
    public int Id { get; set; }
    public int? BookingDetailId { get; set; }
    public int? RoomInventoryId { get; set; }
    public int? ReportedBy { get; set; }   // FK Users.Id — Housekeeping lập biên bản
    public int Quantity { get; set; }
    public decimal PenaltyAmount { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending"; // Pending / Confirmed / Waived
    public bool IsStockSynced { get; set; } = false;
    public int ReplenishedQuantity { get; set; } = 0;
    public DateTime? ReplenishedAt { get; set; }
    public string? ReplenishmentNote { get; set; }
    public DateTime? CreatedAt { get; set; }
    public string? ImgUrl { get; set; }

    // Navigation
    public BookingDetail? BookingDetail { get; set; }
    public RoomInventory? RoomInventory { get; set; }
    public User? Reporter { get; set; }
}
