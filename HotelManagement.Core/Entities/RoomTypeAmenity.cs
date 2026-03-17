namespace HotelManagement.Core.Entities;

public class RoomTypeAmenity
{
    public int RoomTypeId { get; set; }
    public int AmenityId { get; set; }

    // Navigation
    public RoomType RoomType { get; set; } = null!;
    public Amenity Amenity { get; set; } = null!;
}
