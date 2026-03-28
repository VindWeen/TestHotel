namespace HotelManagement.Core.Entities;

public class RoomInventory
{
    public int Id { get; set; }
    public int? RoomId { get; set; }
    public string ItemType { get; set; } = "Asset"; // Asset / Minibar
    public int? Quantity { get; set; }
    public decimal? PriceIfLost { get; set; }
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
    public int EquipmentId { get; set; }

    // Navigation
    public Room? Room { get; set; }
    public Equipment Equipment { get; set; } = null!;
    public ICollection<LossAndDamage> LossAndDamages { get; set; } = [];
}
