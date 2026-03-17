namespace HotelManagement.Core.Entities;

public class Attraction
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Category { get; set; }  // Di tích / Ẩm thực / Giải trí / Thiên nhiên
    public string? Address { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? DistanceKm { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? MapEmbedLink { get; set; }
    public bool IsActive { get; set; } = true;
}
