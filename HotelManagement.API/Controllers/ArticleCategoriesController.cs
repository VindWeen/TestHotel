using System.Text;
using System.Text.RegularExpressions;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Core.Models.Enums;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ArticleCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ArticleCategoriesController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/ArticleCategories
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _db.ArticleCategories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Slug })
            .ToListAsync();

        return Ok(new { data = categories, total = categories.Count });
    }

    // GET /api/ArticleCategories/{id}
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await _db.ArticleCategories
            .AsNoTracking()
            .Where(c => c.Id == id && c.IsActive)
            .Select(c => new { c.Id, c.Name, c.Slug })
            .FirstOrDefaultAsync();

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });

        return Ok(category);
    }

    // POST /api/ArticleCategories
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Create([FromBody] CreateArticleCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên danh mục không được để trống." });

        var nameExists = await _db.ArticleCategories
            .AnyAsync(c => c.Name == request.Name.Trim() && c.IsActive);
        if (nameExists)
            return Conflict(new { message = $"Danh mục '{request.Name.Trim()}' đã tồn tại." });

        var baseSlug = GenerateSlug(request.Name);
        var slug     = await EnsureUniqueSlug(baseSlug);

        var category = new ArticleCategory
        {
            Name     = request.Name.Trim(),
            Slug     = slug,
            IsActive = true
        };

        _db.ArticleCategories.Add(category);
        await _db.SaveChangesAsync();

        var currentUserId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CREATE_ARTICLE_CATEGORY",
            TableName = "Article_Categories",
            RecordId  = category.Id,
            OldValue  = null,
            NewValue  = $"{{\"name\": \"{category.Name}\", \"slug\": \"{category.Slug}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Tạo danh mục bài viết",
            Message = $"Danh mục '{category.Name}' đã được tạo thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.CreateCategory
        };

        return CreatedAtAction(nameof(GetById),
            new { id = category.Id },
            new { category.Id, category.Name, category.Slug, notification });
    }

    // PUT /api/ArticleCategories/{id}
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateArticleCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên danh mục không được để trống." });

        var category = await _db.ArticleCategories
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });

        var nameExists = await _db.ArticleCategories
            .AnyAsync(c => c.Name == request.Name.Trim() && c.IsActive && c.Id != id);
        if (nameExists)
            return Conflict(new { message = $"Danh mục '{request.Name.Trim()}' đã tồn tại." });

        if (category.Name != request.Name.Trim())
        {
            var baseSlug = GenerateSlug(request.Name);
            category.Slug = await EnsureUniqueSlug(baseSlug, excludeId: id);
        }

        category.Name = request.Name.Trim();

        var currentUserId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_ARTICLE_CATEGORY",
            TableName = "Article_Categories",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"name\": \"{category.Name}\", \"slug\": \"{category.Slug}\"}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Cập nhật danh mục bài viết",
            Message = $"Danh mục '{category.Name}' đã được cập nhật thành công.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.UpdateCategory
        };

        return Ok(new { category.Id, category.Name, category.Slug, notification });
    }

    // DELETE /api/ArticleCategories/{id}
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.ArticleCategories
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });

        var articleCount = await _db.Articles
            .CountAsync(a => a.CategoryId == id && a.IsActive);

        category.IsActive = false;

        var currentUserId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "DELETE_ARTICLE_CATEGORY",
            TableName = "Article_Categories",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": true, \"name\": \"{category.Name}\"}}",
            NewValue  = "{\"isActive\": false}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = "Xoá danh mục bài viết",
            Message = $"Danh mục '{category.Name}' đã được xoá thành công. Có {articleCount} bài viết đang sử dụng danh mục này.",
            Type    = NotificationType.Success,
            Action  = NotificationAction.DeleteCategory
        };

        return Ok(new { notification, affectedArticles = articleCount });
    }

    // PATCH /api/ArticleCategories/{id}/toggle-active
    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var category = await _db.ArticleCategories.FindAsync(id);

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });

        var oldActive = category.IsActive;
        category.IsActive = !category.IsActive;

        var currentUserId = JwtHelper.GetUserId(User);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "TOGGLE_ARTICLE_CATEGORY",
            TableName = "Article_Categories",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": {oldActive.ToString().ToLower()}}}",
            NewValue  = $"{{\"isActive\": {category.IsActive.ToString().ToLower()}}}",
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var notification = new Notification
        {
            Title   = $"Danh mục đã được {(category.IsActive ? "kích hoạt" : "vô hiệu hóa")}",
            Message = $"Danh mục '{category.Name}' đã {(category.IsActive ? "được kích hoạt" : "bị vô hiệu hóa")}.",
            Type    = NotificationType.Success,
            Action  = category.IsActive
                        ? NotificationAction.EnableCategory
                        : NotificationAction.DisableCategory
        };

        return Ok(new { notification, category.Id, category.Name, category.IsActive });
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private static string GenerateSlug(string name)
    {
        var normalized = name.Normalize(NormalizationForm.FormD);
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
            var exists = await _db.ArticleCategories.AnyAsync(c =>
                c.Slug == candidate &&
                (excludeId == null || c.Id != excludeId));

            if (!exists) return candidate;
            candidate = $"{baseSlug}-{counter++}";
        }
    }
}

public record CreateArticleCategoryRequest(string Name);
public record UpdateArticleCategoryRequest(string Name);

