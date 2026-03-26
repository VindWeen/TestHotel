using System.Text;
using System.Text.RegularExpressions;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ArticlesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cloudinary   _cloudinary;
    private readonly IActivityLogService _activityLog;

    public ArticlesController(AppDbContext db, Cloudinary cloudinary, IActivityLogService activityLog)
    {
        _db    = db;
        _cloudinary = cloudinary;
        _activityLog = activityLog;
    }

    // GET /api/Articles
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

        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageContent);

        var query = _db.Articles
            .AsNoTracking()
            .Include(a => a.Category)
            .Include(a => a.Author)
            .Where(a => a.IsActive);

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

    // GET /api/Articles/{slug}
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

        var isAdmin = User.Identity?.IsAuthenticated == true
                   && User.HasClaim("permission", PermissionCodes.ManageContent);

        if (!isAdmin && article.Status != "Published")
            return NotFound(new { message = $"Không tìm thấy bài viết với slug '{slug}'." });

        return Ok(article);
    }

    // POST /api/Articles
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Create([FromBody] CreateArticleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Tiêu đề bài viết không được để trống." });

        var authorId = JwtHelper.GetUserId(User);
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
            Status          = "Draft",
            IsActive        = true
        };

        _db.Articles.Add(article);
        await _db.SaveChangesAsync();

        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "CREATE_ARTICLE",
            actionLabel: "Tạo bài viết",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo bài viết mới: \"{article.Title}\".",
            entityType: "Article",
            entityId: article.Id,
            entityLabel: article.Title,
            severity: "Success",
            userId: JwtHelper.GetUserId(User),
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = JwtHelper.GetUserId(User),
            Action    = "CREATE_ARTICLE",
            TableName = "Articles",
            RecordId  = article.Id,
            OldValue  = null,
            NewValue  = $"{{\"title\": \"{article.Title}\", \"slug\": \"{article.Slug}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Bài viết mới được tạo",
            Message = $"Bài viết '{article.Title}' đã được tạo với ID #{article.Id}.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.CreateArticle
        };

        return CreatedAtAction(nameof(GetBySlug),
            new { slug = article.Slug },
            new { notification, article.Id, article.Title, article.Slug, article.Status });
    }

    // PUT /api/Articles/{id}
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateArticleRequest request)
    {
        var article = await _db.Articles.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var allowed = new[] { "Draft", "Pending_Review", "Published" };
            if (!allowed.Contains(request.Status))
                return BadRequest(new { message = "Status không hợp lệ. Dùng: Draft | Pending_Review | Published." });

            var roleClaim = User.FindFirst("role")?.Value ?? string.Empty;
            if (request.Status == "Published" &&
                !string.Equals(roleClaim, "Admin", StringComparison.OrdinalIgnoreCase))
            {
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

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            article.Title = request.Title.Trim();
            var baseSlug  = GenerateSlug(request.Title);
            article.Slug  = await EnsureUniqueSlug(baseSlug, excludeId: id);
        }

        if (request.CategoryId.HasValue)
            article.CategoryId = request.CategoryId.Value;

        if (request.Content is not null)
            article.Content = request.Content;

        if (request.MetaTitle is not null)
            article.MetaTitle = request.MetaTitle.Trim();

        if (request.MetaDescription is not null)
            article.MetaDescription = request.MetaDescription.Trim();

        var currentUserId = JwtHelper.GetUserId(User);
        await _db.SaveChangesAsync();

        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "UPDATE_ARTICLE",
            actionLabel: "Cập nhật bài viết",
            message: $"Nội dung bài viết \"{article.Title}\" đã được cập nhật.",
            entityType: "Article",
            entityId: id,
            entityLabel: article.Title,
            severity: "Info",
            userId: JwtHelper.GetUserId(User),
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_ARTICLE",
            TableName = "Articles",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"title\": \"{article.Title}\", \"status\": \"{article.Status}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Bài viết đã được cập nhật",
            Message = $"Bài viết '{article.Title}' đã được cập nhật thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateArticle
        };

        return Ok(new { notification, article.Id, article.Title, article.Slug, article.Status });
    }

    // DELETE /api/Articles/{id}
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Delete(int id)
    {
        var article = await _db.Articles.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        article.IsActive = false;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: "DELETE_ARTICLE",
            actionLabel: "Xóa bài viết",
            message: $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã xóa bài viết \"{article.Title}\".",
            entityType: "Article",
            entityId: id,
            entityLabel: article.Title,
            severity: "Warning",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "DELETE_ARTICLE",
            TableName = "Articles",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": true, \"title\": \"{article.Title}\"}}",
            NewValue  = "{\"isActive\": false}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Bài viết đã bị xoá",
            Message = $"Bài viết '{article.Title}' đã được xoá thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.DeleteArticle
        };

        return Ok(new { notification });
    }

    // PATCH /api/Articles/{id}/toggle-active
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var article = await _db.Articles.FindAsync(id);

        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        var oldActive = article.IsActive;
        article.IsActive = !article.IsActive;

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log
        await _activityLog.LogAsync(
            actionCode: article.IsActive ? "ENABLE_ARTICLE" : "DISABLE_ARTICLE",
            actionLabel: article.IsActive ? "Kích hoạt bài viết" : "Ẩn bài viết",
            message: $"Bài viết \"{article.Title}\" đã {(article.IsActive ? "được kích hoạt" : "bị ẩn")}.",
            entityType: "Article",
            entityId: id,
            entityLabel: article.Title,
            severity: "Info",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = article.IsActive ? "ENABLE_ARTICLE" : "DISABLE_ARTICLE",
            TableName = "Articles",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": {(!article.IsActive).ToString().ToLower()}}}",
            NewValue  = $"{{\"isActive\": {article.IsActive.ToString().ToLower()}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = $"Bài viết đã được {(article.IsActive ? "kích hoạt" : "vô hiệu hóa")}",
            Message = $"Bài viết '{article.Title}' đã {(article.IsActive ? "được kích hoạt" : "bị vô hiệu hóa")}.",
            Type    = NotificationType.Success,
            Action  = article.IsActive
                        ? NotificationAction.EnableCategory
                        : NotificationAction.DisableCategory
        };

        return Ok(new { notification, article.Id, article.Title, article.IsActive });
    }

    // POST /api/Articles/{id}/thumbnail
    [HttpPost("{id:int}/thumbnail")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> UploadThumbnail(int id, IFormFile? file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file ảnh cần upload." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { message = "Chỉ chấp nhận ảnh định dạng JPEG, PNG, WebP hoặc GIF." });

        var article = await _db.Articles.FirstOrDefaultAsync(a => a.Id == id && a.IsActive);
        if (article is null)
            return NotFound(new { message = $"Bài viết #{id} không tồn tại." });

        if (!string.IsNullOrWhiteSpace(article.CloudinaryPublicId))
        {
            var deleteParams = new DeletionParams(article.CloudinaryPublicId)
            {
                ResourceType = ResourceType.Image
            };
            await _cloudinary.DestroyAsync(deleteParams);
        }

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

        article.ThumbnailUrl       = uploadResult.SecureUrl.ToString();
        article.CloudinaryPublicId = uploadResult.PublicId;
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Ảnh bìa đã được cập nhật",
            Message = $"Ảnh bìa của bài viết '{article.Title}' đã được cập nhật thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateArticle
        };

        return Ok(new { notification, thumbnailUrl = article.ThumbnailUrl });
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private static string GenerateSlug(string title)
    {
        var normalized = title.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();

        foreach (var c in normalized)
        {
            var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }

        var slug = sb.ToString().Normalize(NormalizationForm.FormC);
        slug = slug.ToLowerInvariant();
        slug = slug.Replace("đ", "d");
        slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");
        slug = Regex.Replace(slug, @"\s+", "-");
        slug = Regex.Replace(slug, @"-{2,}", "-");
        slug = slug.Trim('-');

        return slug;
    }

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

public record CreateArticleRequest(
    string  Title,
    int?    CategoryId,
    string? Content,
    string? MetaTitle,
    string? MetaDescription
);

public record UpdateArticleRequest(
    string? Title,
    int?    CategoryId,
    string? Content,
    string? MetaTitle,
    string? MetaDescription,
    string? Status
);
