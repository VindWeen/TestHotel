namespace HotelManagement.Core.Entities;

public class ServiceCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<Service> Services { get; set; } = [];
}
