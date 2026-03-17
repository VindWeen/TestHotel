namespace HotelManagement.Core.Entities;

public class Amenity
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? IconUrl { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<RoomTypeAmenity> RoomTypeAmenities { get; set; } = [];
}
