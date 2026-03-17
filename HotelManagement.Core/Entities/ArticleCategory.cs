namespace HotelManagement.Core.Entities;

public class ArticleCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Slug { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<Article> Articles { get; set; } = [];
}
