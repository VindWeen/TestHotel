using HotelManagement.API.Services;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.DTOs;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ServicesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuditTrailService _auditTrail;

    public ServicesController(AppDbContext db, IAuditTrailService auditTrail)
    {
        _db = db;
        _auditTrail = auditTrail;
    }

    [HttpGet("categories")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetCategories(
        [FromQuery] ListQueryRequest queryRequest,
        [FromQuery] bool? isActive = null,
        [FromQuery] bool includeInactive = false)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.ServiceCategories.AsNoTracking().AsQueryable();
        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);
        else if (!includeInactive)
            query = query.Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(keyword));
        }

        var sortDesc = string.Equals(queryRequest.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        query = queryRequest.SortBy?.ToLowerInvariant() switch
        {
            "name" => sortDesc ? query.OrderByDescending(x => x.Name) : query.OrderBy(x => x.Name),
            _ => sortDesc ? query.OrderByDescending(x => x.Id) : query.OrderBy(x => x.Id)
        };

        var totalItems = await query.CountAsync();
        var activeItems = await query.CountAsync(x => x.IsActive);
        var inactiveItems = totalItems - activeItems;
        var withServices = await query.CountAsync(x => x.Services.Any(s => s.IsActive));
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.IsActive,
                ServiceCount = x.Services.Count(s => s.IsActive)
            })
            .ToListAsync();

        return Ok(new ApiListResponse<object>
        {
            Data = data,
            Pagination = new PaginationMeta
            {
                CurrentPage = page,
                PageSize = pageSize,
                TotalItems = totalItems,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
            },
            Summary = new
            {
                totalItems,
                activeItems,
                inactiveItems,
                withServices
            },
            Message = "Lấy danh sách nhóm dịch vụ thành công."
        });
    }

    [HttpGet("categories/{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetCategoryById(int id, [FromQuery] bool includeInactive = false)
    {
        var category = await _db.ServiceCategories
            .AsNoTracking()
            .Where(x => x.Id == id && (includeInactive || x.IsActive))
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.IsActive,
                Services = x.Services
                    .Where(s => includeInactive || s.IsActive)
                    .OrderBy(s => s.Name)
                    .Select(s => new
                    {
                        s.Id,
                        s.Name,
                        s.Price,
                        s.Unit,
                        s.IsActive
                    })
            })
            .FirstOrDefaultAsync();

        if (category is null)
            return NotFound(new { message = $"Không tìm thấy nhóm dịch vụ #{id}." });

        return Ok(category);
    }

    [HttpPost("categories")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateServiceCategoryRequest request)
    {
        var normalizedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
            return BadRequest(new { message = "Tên nhóm dịch vụ không được để trống." });

        var exists = await _db.ServiceCategories
            .AnyAsync(x => x.Name.ToLower() == normalizedName.ToLower());
        if (exists)
            return Conflict(new { message = $"Nhóm dịch vụ '{normalizedName}' đã tồn tại." });

        var category = new ServiceCategory
        {
            Name = normalizedName,
            IsActive = true
        };

        _db.ServiceCategories.Add(category);
        await _db.SaveChangesAsync();

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CREATE_SERVICE_CATEGORY",
            ActionLabel = "Tạo nhóm dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo nhóm dịch vụ '{category.Name}'.",
            EntityType = "ServiceCategory",
            EntityId = category.Id,
            EntityLabel = category.Name,
            Severity = "Success",
            TableName = "Service_Categories",
            RecordId = category.Id,
            NewValue = $"{{\"name\":\"{category.Name}\",\"isActive\":true}}"
        });

        return StatusCode(201, new { message = "Tạo nhóm dịch vụ thành công.", data = new { category.Id, category.Name, category.IsActive } });
    }

    [HttpPut("categories/{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateServiceCategoryRequest request)
    {
        var category = await _db.ServiceCategories.FirstOrDefaultAsync(x => x.Id == id);
        if (category is null)
            return NotFound(new { message = $"Không tìm thấy nhóm dịch vụ #{id}." });

        var normalizedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
            return BadRequest(new { message = "Tên nhóm dịch vụ không được để trống." });

        var duplicate = await _db.ServiceCategories
            .AnyAsync(x => x.Id != id && x.Name.ToLower() == normalizedName.ToLower());
        if (duplicate)
            return Conflict(new { message = $"Nhóm dịch vụ '{normalizedName}' đã tồn tại." });

        var oldValue = $"{{\"name\":\"{category.Name}\",\"isActive\":{category.IsActive.ToString().ToLower()}}}";
        category.Name = normalizedName;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_SERVICE_CATEGORY",
            ActionLabel = "Cập nhật nhóm dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật nhóm dịch vụ '{category.Name}'.",
            EntityType = "ServiceCategory",
            EntityId = id,
            EntityLabel = category.Name,
            Severity = "Info",
            TableName = "Service_Categories",
            RecordId = id,
            OldValue = oldValue,
            NewValue = $"{{\"name\":\"{category.Name}\",\"isActive\":{category.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật nhóm dịch vụ thành công.", data = new { category.Id, category.Name, category.IsActive } });
    }

    [HttpDelete("categories/{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _db.ServiceCategories.FirstOrDefaultAsync(x => x.Id == id);
        if (category is null)
            return NotFound(new { message = $"Không tìm thấy nhóm dịch vụ #{id}." });

        if (!category.IsActive)
            return BadRequest(new { message = "Nhóm dịch vụ này đã bị vô hiệu hóa trước đó." });

        var hasActiveServices = await _db.Services.AnyAsync(x => x.CategoryId == id && x.IsActive);
        if (hasActiveServices)
            return Conflict(new { message = "Không thể xóa mềm nhóm dịch vụ khi vẫn còn dịch vụ đang hoạt động." });

        category.IsActive = false;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "DELETE_SERVICE_CATEGORY_SOFT",
            ActionLabel = "Vô hiệu hóa nhóm dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã vô hiệu hóa nhóm dịch vụ '{category.Name}'.",
            EntityType = "ServiceCategory",
            EntityId = id,
            EntityLabel = category.Name,
            Severity = "Warning",
            TableName = "Service_Categories",
            RecordId = id,
            OldValue = "{\"isActive\":true}",
            NewValue = "{\"isActive\":false}"
        });

        return Ok(new { message = "Đã vô hiệu hóa nhóm dịch vụ.", data = new { category.Id, category.IsActive } });
    }

    [HttpPatch("categories/{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> ToggleCategoryActive(int id)
    {
        var category = await _db.ServiceCategories.FirstOrDefaultAsync(x => x.Id == id);
        if (category is null)
            return NotFound(new { message = $"Không tìm thấy nhóm dịch vụ #{id}." });

        var oldValue = category.IsActive;
        category.IsActive = !category.IsActive;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "TOGGLE_SERVICE_CATEGORY",
            ActionLabel = category.IsActive ? "Kích hoạt nhóm dịch vụ" : "Vô hiệu hóa nhóm dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã {(category.IsActive ? "kích hoạt" : "vô hiệu hóa")} nhóm dịch vụ '{category.Name}'.",
            EntityType = "ServiceCategory",
            EntityId = id,
            EntityLabel = category.Name,
            Severity = "Info",
            TableName = "Service_Categories",
            RecordId = id,
            OldValue = $"{{\"isActive\":{oldValue.ToString().ToLower()}}}",
            NewValue = $"{{\"isActive\":{category.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật trạng thái nhóm dịch vụ thành công.", data = new { category.Id, category.IsActive } });
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetServices(
        [FromQuery] ListQueryRequest queryRequest,
        [FromQuery] int? categoryId = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] bool includeInactive = false)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.Services
            .AsNoTracking()
            .Include(x => x.Category)
            .AsQueryable();

        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        if (categoryId.HasValue)
            query = query.Where(x => x.CategoryId == categoryId.Value);

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(keyword) ||
                (x.Description != null && x.Description.ToLower().Contains(keyword)) ||
                (x.Category != null && x.Category.Name.ToLower().Contains(keyword)));
        }

        var sortDesc = string.Equals(queryRequest.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        query = queryRequest.SortBy?.ToLowerInvariant() switch
        {
            "name" => sortDesc ? query.OrderByDescending(x => x.Name) : query.OrderBy(x => x.Name),
            "price" => sortDesc ? query.OrderByDescending(x => x.Price) : query.OrderBy(x => x.Price),
            _ => query.OrderByDescending(x => x.IsActive).ThenBy(x => x.Name)
        };

        var totalItems = await query.CountAsync();
        var activeItems = await query.CountAsync(x => x.IsActive);
        var inactiveItems = totalItems - activeItems;
        var usedCategories = await query
            .Where(x => x.CategoryId.HasValue)
            .Select(x => x.CategoryId)
            .Distinct()
            .CountAsync();
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.CategoryId,
                CategoryName = x.Category != null ? x.Category.Name : null,
                CategoryIsActive = x.Category != null && x.Category.IsActive,
                x.Name,
                x.Description,
                x.Price,
                x.Unit,
                x.ImageUrl,
                x.IsActive
            })
            .ToListAsync();

        return Ok(new ApiListResponse<object>
        {
            Data = data,
            Pagination = new PaginationMeta
            {
                CurrentPage = page,
                PageSize = pageSize,
                TotalItems = totalItems,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
            },
            Summary = new
            {
                totalItems,
                activeItems,
                inactiveItems,
                usedCategories
            },
            Message = "Lấy danh sách dịch vụ thành công."
        });
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> GetServiceById(int id, [FromQuery] bool includeInactive = false)
    {
        var service = await _db.Services
            .AsNoTracking()
            .Include(x => x.Category)
            .Where(x => x.Id == id && (includeInactive || x.IsActive))
            .Select(x => new
            {
                x.Id,
                x.CategoryId,
                CategoryName = x.Category != null ? x.Category.Name : null,
                CategoryIsActive = x.Category != null && x.Category.IsActive,
                x.Name,
                x.Description,
                x.Price,
                x.Unit,
                x.ImageUrl,
                x.IsActive
            })
            .FirstOrDefaultAsync();

        if (service is null)
            return NotFound(new { message = $"Không tìm thấy dịch vụ #{id}." });

        return Ok(service);
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> CreateService([FromBody] CreateServiceRequest request)
    {
        var validation = await ValidateServiceRequestAsync(request.CategoryId, request.Name, request.Price);
        if (validation is not null)
            return validation;

        var service = new Service
        {
            CategoryId = request.CategoryId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Price = request.Price,
            Unit = request.Unit?.Trim(),
            ImageUrl = request.ImageUrl?.Trim(),
            IsActive = true
        };

        _db.Services.Add(service);
        await _db.SaveChangesAsync();

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CREATE_SERVICE",
            ActionLabel = "Tạo dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo dịch vụ '{service.Name}'.",
            EntityType = "Service",
            EntityId = service.Id,
            EntityLabel = service.Name,
            Severity = "Success",
            TableName = "Services",
            RecordId = service.Id,
            NewValue = $"{{\"name\":\"{service.Name}\",\"price\":{service.Price},\"isActive\":true}}"
        });

        return StatusCode(201, new { message = "Tạo dịch vụ thành công.", data = new { service.Id, service.Name, service.IsActive } });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> UpdateService(int id, [FromBody] UpdateServiceRequest request)
    {
        var service = await _db.Services.FirstOrDefaultAsync(x => x.Id == id);
        if (service is null)
            return NotFound(new { message = $"Không tìm thấy dịch vụ #{id}." });

        var validation = await ValidateServiceRequestAsync(request.CategoryId, request.Name, request.Price);
        if (validation is not null)
            return validation;

        var oldValue = $"{{\"name\":\"{service.Name}\",\"price\":{service.Price},\"isActive\":{service.IsActive.ToString().ToLower()}}}";
        service.CategoryId = request.CategoryId;
        service.Name = request.Name.Trim();
        service.Description = request.Description?.Trim();
        service.Price = request.Price;
        service.Unit = request.Unit?.Trim();
        service.ImageUrl = request.ImageUrl?.Trim();

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_SERVICE",
            ActionLabel = "Cập nhật dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật dịch vụ '{service.Name}'.",
            EntityType = "Service",
            EntityId = id,
            EntityLabel = service.Name,
            Severity = "Info",
            TableName = "Services",
            RecordId = id,
            OldValue = oldValue,
            NewValue = $"{{\"name\":\"{service.Name}\",\"price\":{service.Price},\"isActive\":{service.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật dịch vụ thành công.", data = new { service.Id, service.Name, service.IsActive } });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> DeleteService(int id)
    {
        var service = await _db.Services.FirstOrDefaultAsync(x => x.Id == id);
        if (service is null)
            return NotFound(new { message = $"Không tìm thấy dịch vụ #{id}." });

        if (!service.IsActive)
            return BadRequest(new { message = "Dịch vụ này đã bị vô hiệu hóa trước đó." });

        service.IsActive = false;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "DELETE_SERVICE_SOFT",
            ActionLabel = "Vô hiệu hóa dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã vô hiệu hóa dịch vụ '{service.Name}'.",
            EntityType = "Service",
            EntityId = id,
            EntityLabel = service.Name,
            Severity = "Warning",
            TableName = "Services",
            RecordId = id,
            OldValue = "{\"isActive\":true}",
            NewValue = "{\"isActive\":false}"
        });

        return Ok(new { message = "Đã vô hiệu hóa dịch vụ.", data = new { service.Id, service.IsActive } });
    }

    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageServices)]
    public async Task<IActionResult> ToggleServiceActive(int id)
    {
        var service = await _db.Services.FirstOrDefaultAsync(x => x.Id == id);
        if (service is null)
            return NotFound(new { message = $"Không tìm thấy dịch vụ #{id}." });

        if (service.CategoryId.HasValue)
        {
            var category = await _db.ServiceCategories.FirstOrDefaultAsync(x => x.Id == service.CategoryId.Value);
            if (category is not null && !category.IsActive && !service.IsActive)
                return Conflict(new { message = "Không thể kích hoạt dịch vụ khi nhóm dịch vụ đang bị vô hiệu hóa." });
        }

        var oldValue = service.IsActive;
        service.IsActive = !service.IsActive;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "TOGGLE_SERVICE",
            ActionLabel = service.IsActive ? "Kích hoạt dịch vụ" : "Vô hiệu hóa dịch vụ",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã {(service.IsActive ? "kích hoạt" : "vô hiệu hóa")} dịch vụ '{service.Name}'.",
            EntityType = "Service",
            EntityId = id,
            EntityLabel = service.Name,
            Severity = "Info",
            TableName = "Services",
            RecordId = id,
            OldValue = $"{{\"isActive\":{oldValue.ToString().ToLower()}}}",
            NewValue = $"{{\"isActive\":{service.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật trạng thái dịch vụ thành công.", data = new { service.Id, service.IsActive } });
    }

    private async Task<IActionResult?> ValidateServiceRequestAsync(int? categoryId, string? name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Tên dịch vụ không được để trống." });

        if (price <= 0)
            return BadRequest(new { message = "Giá dịch vụ phải lớn hơn 0." });

        if (!categoryId.HasValue)
            return null;

        var category = await _db.ServiceCategories.FirstOrDefaultAsync(x => x.Id == categoryId.Value);
        if (category is null)
            return BadRequest(new { message = $"Nhóm dịch vụ #{categoryId.Value} không tồn tại." });

        if (!category.IsActive)
            return Conflict(new { message = "Không thể gán dịch vụ vào nhóm dịch vụ đang bị vô hiệu hóa." });

        return null;
    }
}
