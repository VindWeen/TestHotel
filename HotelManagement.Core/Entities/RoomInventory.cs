namespace HotelManagement.Core.Entities;

public class RoomInventory
{
    public int Id { get; set; }
    public int? RoomId { get; set; }
    public string ItemName { get; set; } = null!;
    public string ItemType { get; set; } = "Asset"; // Asset / Minibar
    public int? Quantity { get; set; }
    public decimal? PriceIfLost { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public Room? Room { get; set; }
    public ICollection<LossAndDamage> LossAndDamages { get; set; } = [];
}
