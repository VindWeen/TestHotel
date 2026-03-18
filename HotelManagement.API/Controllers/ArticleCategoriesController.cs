using System.Text;
using System.Text.RegularExpressions;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Entities;
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

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/ArticleCategories
    // Public — danh sách is_active = 1.
    // FE dùng render menu blog và bộ lọc bài viết.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _db.ArticleCategories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Slug
            })
            .ToListAsync();

        return Ok(new { data = categories, total = categories.Count });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/ArticleCategories/{id}
    // Public — chi tiết 1 category.
    // FE dùng load form sửa tên category trong trang admin CMS.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await _db.ArticleCategories
            .AsNoTracking()
            .Where(c => c.Id == id && c.IsActive)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Slug
            })
            .FirstOrDefaultAsync();

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });

        return Ok(category);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/ArticleCategories
    // [MANAGE_CONTENT]
    // Body: { name }. Tự động sinh slug từ name.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Create([FromBody] CreateArticleCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên danh mục không được để trống." });

        // Kiểm tra tên trùng (trong các category đang active)
        var nameExists = await _db.ArticleCategories
            .AnyAsync(c => c.Name == request.Name.Trim() && c.IsActive);
        if (nameExists)
            return Conflict(new { message = $"Danh mục '{request.Name.Trim()}' đã tồn tại." });

        // Sinh slug duy nhất từ name
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

        return CreatedAtAction(nameof(GetById),
            new { id = category.Id },
            new
            {
                message = "Tạo danh mục thành công.",
                category.Id,
                category.Name,
                category.Slug
            });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/ArticleCategories/{id}
    // [MANAGE_CONTENT]
    // Cập nhật name. Slug tự động sinh lại từ name mới.
    // ──────────────────────────────────────────────────────────────────────────
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

        // Kiểm tra tên trùng với category khác đang active
        var nameExists = await _db.ArticleCategories
            .AnyAsync(c => c.Name == request.Name.Trim() && c.IsActive && c.Id != id);
        if (nameExists)
            return Conflict(new { message = $"Danh mục '{request.Name.Trim()}' đã tồn tại." });

        // Nếu Name thay đổi → sinh lại Slug từ Name mới
        if (category.Name != request.Name.Trim())
        {
            var baseSlug = GenerateSlug(request.Name);
            category.Slug = await EnsureUniqueSlug(baseSlug, excludeId: id);
        }

        category.Name = request.Name.Trim();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Cập nhật danh mục thành công.",
            category.Id,
            category.Name,
            category.Slug   // trả về slug mới đã được sinh lại
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE /api/ArticleCategories/{id}
    // [MANAGE_CONTENT]  Soft Delete: is_active = 0.
    // Bài viết cũ giữ nguyên category_id — không bị ảnh hưởng.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageContent)]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.ArticleCategories
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });

        // Đếm bài viết đang dùng category này để thông báo cho admin
        var articleCount = await _db.Articles
            .CountAsync(a => a.CategoryId == id && a.IsActive);

        category.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message          = $"Đã xoá danh mục '{category.Name}' thành công.",
            affectedArticles = articleCount   // FE hiển thị cảnh báo nếu > 0
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Chuyển name tiếng Việt → slug ASCII lowercase, ngăn cách bằng dấu gạch ngang.
    /// Ví dụ: "Tin Tức Khách Sạn" → "tin-tuc-khach-san"
    /// </summary>
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

    /// <summary>
    /// Đảm bảo slug duy nhất trong DB.
    /// Nếu trùng → thêm hậu tố -2, -3, ...
    /// </summary>
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

// ──────────────────────────────────────────────────────────────────────────────
// REQUEST RECORDS
// ──────────────────────────────────────────────────────────────────────────────

/// <summary>Request body cho POST /api/ArticleCategories</summary>
public record CreateArticleCategoryRequest(string Name);

/// <summary>Request body cho PUT /api/ArticleCategories/{id}</summary>
public record UpdateArticleCategoryRequest(string Name);