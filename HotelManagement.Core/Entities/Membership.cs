namespace HotelManagement.Core.Entities;

public class Membership
{
    public int Id { get; set; }
    public string TierName { get; set; } = null!;
    public int? MinPoints { get; set; }
    public int? MaxPoints { get; set; }
    public decimal? DiscountPercent { get; set; }
    public string? ColorHex { get; set; }

    // Navigation
    public ICollection<User> Users { get; set; } = [];
}
