namespace HotelManagement.Core.Entities;

public class Article
{
    public int Id { get; set; }
    public int? CategoryId { get; set; }
    public int? AuthorId { get; set; }

    // Nội dung
    public string Title { get; set; } = null!;
    public string? Slug { get; set; }
    public string? Content { get; set; }

    // Media
    public string? ThumbnailUrl { get; set; }
    public string? CloudinaryPublicId { get; set; }

    // SEO
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }

    // Trạng thái
    public string Status { get; set; } = "Draft"; // Draft / Pending_Review / Published
    public bool IsActive { get; set; } = true;
    public DateTime? PublishedAt { get; set; }

    // Navigation
    public ArticleCategory? Category { get; set; }
    public User? Author { get; set; }
}
