namespace HotelManagement.Core.Entities;

public class RoomImage
{
    public int Id { get; set; }
    public int? RoomTypeId { get; set; }
    public string ImageUrl { get; set; } = null!;
    public string? CloudinaryPublicId { get; set; }
    public bool? IsPrimary { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    // Navigation
    public RoomType? RoomType { get; set; }
}
