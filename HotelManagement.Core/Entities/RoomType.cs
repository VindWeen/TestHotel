namespace HotelManagement.Core.Entities;

public class RoomType
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Slug { get; set; }
    public decimal BasePrice { get; set; }
    public int CapacityAdults { get; set; }
    public int CapacityChildren { get; set; }
    public decimal? AreaSqm { get; set; }
    public string? BedType { get; set; }
    public string? ViewType { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<Room> Rooms { get; set; } = [];
    public ICollection<RoomTypeAmenity> RoomTypeAmenities { get; set; } = [];
    public ICollection<RoomImage> RoomImages { get; set; } = [];
    public ICollection<BookingDetail> BookingDetails { get; set; } = [];
    public ICollection<Review> Reviews { get; set; } = [];
    public ICollection<Voucher> Vouchers { get; set; } = [];
}
