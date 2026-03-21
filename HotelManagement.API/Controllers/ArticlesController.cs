using System.Text;
using System.Text.RegularExpressions;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.Core.Models.Enums;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ArticlesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cloudinary   _cloudinary;

    public ArticlesController(AppDbContext db, Cloudinary cloudinary)
    {
        _db         = db;
        _cloudinary = cloudinary;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/Articles
    // Public: chỉ Published + is_active=1.  Admin: thấy cả Draft.
    // Kèm tên category, tên tác giả.  Filter theo category_id.  Phân trang.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll(
        [FromQuery] int?   categoryId,
        [FromQuery] int    page     = 1,
        [FromQuery] int    pageSize = 10)
    {
        if (page     < 1) page     = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        // Kiểm tra caller có permission MANAGE_CONTENT không
        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageContent);

        var query = _db.Articles
            .AsNoTracking()
            .Include(a => a.Category)
            .Include(a => a.Author)
            .Where(a => a.IsActive);

        // Public chỉ thấy Published; Admin thấy tất cả status
        if (!isAdmin)
            query = query.Where(a => a.Status == "Published");

        if (categoryId.HasValue)
            query = query.Where(a => a.CategoryId == categoryId.Value);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(a => a.PublishedAt)
            .ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.Slug,
                a.ThumbnailUrl,
                a.MetaDescription,
                a.Status,
                a.PublishedAt,
                Category = a.Category == null ? null : new { a.Category.Id, a.Category.Name, a.Category.Slug },
                Author   = a.Author   == null ? null : new { a.Author.Id,   a.Author.FullName, a.Author.AvatarUrl }
            })
            .ToListAsync();

        return Ok(new
        {
            data       = items,
            pagination = new
            {
                page,
                pageSize,
                total,
                totalPages = (int)Math.Ceiling((double)total / pageSize)
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/Articles/{slug}
    // Public — AllowAnonymous.  Trả full content + meta cho SEO.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var article = await _db.Articles
            .AsNoTracking()
            .Include(a => a.Category)
            .Include(a => a.Author)
            .Where(a => a.Slug == slug && a.IsActive)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.Slug,
                a.Content,
                a.ThumbnailUrl,
                a.MetaTitle,
                a.MetaDescription,
                a.Status,
                a.PublishedAt,
                Category = a.Category == null ? null : new { a.Category.Id, a.Category.Name, a.Category.Slug },
                Author   = a.Author   == null ? null : new { a.Author.Id,   a.Author.FullName, a.Author.AvatarUrl }
            })
            .FirstOrDefaultAsync();

        if (article is null)
            return NotFound(new { message = $"Không tìm thấy bài viết với slug '{slug}'." });

        // Public không được đọc Draft / Pending_Review
        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageContent);

        if (!isAdmin && article.Status != "Published")
            return NotFound(new { message = $"Không tìm thấy bài viết với slug '{slug}'." });

        return Ok(article);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/Articles
    // [MANAGE_CONTENT]  author_id lấy từ JWT.  Tự sinh slug.  Status = Draft.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Create([FromBody] CreateArticleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Tiêu đề bài viết không được để trống." });

        var authorId = JwtHelper.GetUserId(User);

        // Sinh slug duy nhất từ title
        var baseSlug = GenerateSlug(request.Title);
        var slug     = await EnsureUniqueSlug(baseSlug);

        var article = new HotelManagement.Core.Entities.Article
        {
            CategoryId      = request.CategoryId,
            AuthorId        = authorId,
            Title           = request.Title.Trim(),
            Slug            = slug,
            Content         = request.Content,
            MetaTitle       = request.MetaTitle?.Trim(),
            MetaDescription = request.MetaDescription?.Trim(),
            Status          = "Draft",   // mặc định Draft, không nhận từ body
            IsActive        = true
        };

        _db.Articles.Add(article);
        await _db.SaveChangesAsync();
        var notification = new HotelManagement.Core.Models.Enums.Notification
        {
            Title = "Bài viết mới được tạo",
            Message = $"Bài viết '{article.Title}' đã được tạo với ID #{article.Id}.",
            Type = HotelManagement.Core.Models.Enums.NotificationType.Success,
            Action = HotelManagement.Core.Models.Enums.NotificationAction.CreateArticle
        };

        return CreatedAtAction(nameof(GetBySlug),
            new { slug = article.Slug },
            new
            {
                notification,
                article.Id,
                article.Title,
                article.Slug,
                article.Status
            });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/Articles/{id}
    // [MANAGE_CONTENT]  Cập nhật nội dung & status.
    // Chỉ role "Admin" mới được set Status = "Published".
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateArticleRequest request)
    {
        var article = await _db.Articles.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        // Kiểm tra quyền set status
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var allowed = new[] { "Draft", "Pending_Review", "Published" };
            if (!allowed.Contains(request.Status))
                return BadRequest(new { message = "Status không hợp lệ. Dùng: Draft | Pending_Review | Published." });

            // Chỉ role "Admin" mới được đặt Published
            var roleClaim = User.FindFirst("role")?.Value ?? string.Empty;
            if (request.Status == "Published" &&
                !string.Equals(roleClaim, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                // ← Trả về 403 kèm message rõ ràng thay vì Forbid()
                return StatusCode(403, new
                {
                    error   = "Forbidden",
                    message = "Chỉ Admin mới được xuất bản (Published) bài viết."
                });
            }

            article.Status = request.Status;

            if (request.Status == "Published" && article.PublishedAt is null)
                article.PublishedAt = DateTime.UtcNow;
        }

        // Cập nhật nội dung nếu có
        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            article.Title = request.Title.Trim();

            // Tái sinh slug khi title thay đổi
            var baseSlug = GenerateSlug(request.Title);
            article.Slug = await EnsureUniqueSlug(baseSlug, excludeId: id);
        }

        if (request.CategoryId.HasValue)
            article.CategoryId = request.CategoryId.Value;

        if (request.Content is not null)
            article.Content = request.Content;

        if (request.MetaTitle is not null)
            article.MetaTitle = request.MetaTitle.Trim();

        if (request.MetaDescription is not null)
            article.MetaDescription = request.MetaDescription.Trim();

        await _db.SaveChangesAsync();
        var Notification = new Notification
        {
            Title = "Bài viết đã được cập nhật",
            Message = $"Bài viết '{article.Title}' đã được cập nhật thành công.",
            Type = HotelManagement.Core.Models.Enums.NotificationType.Success,
            Action = HotelManagement.Core.Models.Enums.NotificationAction.UpdateArticle
        };

        return Ok(new
        {
            Notification,
            article.Id,
            article.Title,
            article.Slug,
            article.Status
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE /api/Articles/{id}
    // [MANAGE_CONTENT]  Soft Delete: is_active = 0.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Delete(int id)
    {
        var article = await _db.Articles.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        article.IsActive = false;
        await _db.SaveChangesAsync();
        var Notification = new Notification
        {
            Title = "Bài viết đã bị xoá",
            Message = $"Bài viết '{article.Title}' đã được xoá thành công.",
            Type = HotelManagement.Core.Models.Enums.NotificationType.Success,
            Action = HotelManagement.Core.Models.Enums.NotificationAction.DeleteArticle
        };
        return Ok(new { Notification });
    }

    // ──────────────────────────────────────────────────────────────
    // PATCH /api/Articles/{id}/toggle-active  [MANAGE_CONTENT]
    // Bật/tắt bài viết: is_active = 1 ↔ 0
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var article = await _db.Articles.FindAsync(id);
 
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });
 
        article.IsActive = !article.IsActive;
        await _db.SaveChangesAsync();
        var Notification = new Notification
        {
            Title = $"Bài viết đã được {(article.IsActive ? "kích hoạt" : "vô hiệu hóa")}",
            Message = $"Bài viết '{article.Title}' đã {(article.IsActive ? "được kích hoạt" : "bị vô hiệu hóa")}.",
            Type = HotelManagement.Core.Models.Enums.NotificationType.Success,
            Action = article.IsActive ? HotelManagement.Core.Models.Enums.NotificationAction.EnableCategory : HotelManagement.Core.Models.Enums.NotificationAction.DisableCategory
        };
        return Ok(new
        {
            Notification,
            article.Id,
            article.Title,
            article.IsActive
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/Articles/{id}/thumbnail
    // [MANAGE_CONTENT]  Upload ảnh bìa lên Cloudinary.
    // Xoá ảnh cũ (qua cloudinary_public_id).  Lưu thumbnail_url mới.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/thumbnail")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> UploadThumbnail(int id, IFormFile? file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file ảnh cần upload." });

        // Kiểm tra đuôi file
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { message = "Chỉ chấp nhận ảnh định dạng JPEG, PNG, WebP hoặc GIF." });

        var article = await _db.Articles.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        // 1. Xoá ảnh cũ trên Cloudinary nếu có
        if (!string.IsNullOrWhiteSpace(article.CloudinaryPublicId))
        {
            var deleteParams = new DeletionParams(article.CloudinaryPublicId)
            {
                ResourceType = ResourceType.Image
            };
            await _cloudinary.DestroyAsync(deleteParams);
        }

        // 2. Upload ảnh mới
        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File           = new FileDescription(file.FileName, stream),
            Folder         = "hotel/articles",
            PublicId       = $"article_{id}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
            Transformation = new Transformation().Width(1200).Height(630).Crop("fill").Quality("auto")
        };

        var uploadResult = await _cloudinary.UploadAsync(uploadParams);

        if (uploadResult.Error is not null)
            return StatusCode(502, new { message = $"Upload thất bại: {uploadResult.Error.Message}" });

        // 3. Cập nhật DB
        article.ThumbnailUrl        = uploadResult.SecureUrl.ToString();
        article.CloudinaryPublicId  = uploadResult.PublicId;
        await _db.SaveChangesAsync();
        var notification = new Notification
        {
            Title = "Ảnh bìa đã được cập nhật",
            Message = $"Ảnh bìa của bài viết '{article.Title}' đã được cập nhật thành công.",
            Type = HotelManagement.Core.Models.Enums.NotificationType.Success,
            Action = HotelManagement.Core.Models.Enums.NotificationAction.UpdateArticle
        };
        return Ok(new
        {
            Notification = notification,
            thumbnailUrl = article.ThumbnailUrl
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Chuyển title tiếng Việt → slug ASCII lowercase, ngăn cách bằng dấu gạch ngang.
    /// Ví dụ: "Khám Phá Đà Lạt" → "kham-pha-da-lat"
    /// </summary>
    private static string GenerateSlug(string title)
    {
        // Normalize về dạng tổ hợp, loại bỏ dấu
        var normalized = title.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();

        foreach (var c in normalized)
        {
            var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }

        var slug = sb.ToString().Normalize(NormalizationForm.FormC);

        // Lowercase, xử lý 'đ' → 'd', thay khoảng trắng thành '-', loại ký tự đặc biệt
        slug = slug.ToLowerInvariant();
        slug = slug.Replace("đ", "d");   // ← fix: 'đ' không bị xử lý bởi NFD
        slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");
        slug = Regex.Replace(slug, @"\s+", "-");
        slug = Regex.Replace(slug, @"-{2,}", "-");
        slug = slug.Trim('-');

        return slug;
    }

    /// <summary>
    /// Đảm bảo slug là duy nhất trong DB.
    /// Nếu trùng → thêm hậu tố -2, -3, ...
    /// excludeId: bỏ qua bài viết hiện tại khi PUT.
    /// </summary>
    private async Task<string> EnsureUniqueSlug(string baseSlug, int? excludeId = null)
    {
        var candidate = baseSlug;
        var counter   = 2;

        while (true)
        {
            var exists = await _db.Articles.AnyAsync(a =>
                a.Slug == candidate &&
                (excludeId == null || a.Id != excludeId));

            if (!exists) return candidate;

            candidate = $"{baseSlug}-{counter++}";
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// REQUEST RECORDS
// ──────────────────────────────────────────────────────────────────────────────

/// <summary>Request body cho POST /api/Articles</summary>
public record CreateArticleRequest(
    string  Title,
    int?    CategoryId,
    string? Content,
    string? MetaTitle,
    string? MetaDescription
);

/// <summary>
/// Request body cho PUT /api/Articles/{id}.
/// Tất cả field đều nullable — chỉ cập nhật field được gửi lên.
/// </summary>
public record UpdateArticleRequest(
    string? Title,
    int?    CategoryId,
    string? Content,
    string? MetaTitle,
    string? MetaDescription,
    string? Status   // Draft | Pending_Review | Published (Published chỉ Admin)
);
