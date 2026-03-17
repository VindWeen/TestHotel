namespace HotelManagement.Core.Entities;

public class Service
{
    public int Id { get; set; }
    public int? CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? Unit { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ServiceCategory? Category { get; set; }
    public ICollection<OrderServiceDetail> OrderServiceDetails { get; set; } = [];
}
