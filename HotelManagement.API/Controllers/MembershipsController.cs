using System.Text.RegularExpressions;
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
public class MembershipsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuditTrailService _auditTrail;

    public MembershipsController(AppDbContext db, IAuditTrailService auditTrail)
    {
        _db = db;
        _auditTrail = auditTrail;
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> GetList([FromQuery] ListQueryRequest queryRequest, [FromQuery] bool includeInactive = false)
    {
        var page = Math.Max(1, queryRequest.Page);
        var pageSize = Math.Clamp(queryRequest.PageSize <= 0 ? 10 : queryRequest.PageSize, 1, 100);

        var query = _db.Memberships.AsNoTracking().AsQueryable();
        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(queryRequest.Keyword))
        {
            var keyword = queryRequest.Keyword.Trim().ToLower();
            query = query.Where(x => x.TierName.ToLower().Contains(keyword));
        }

        query = query.OrderBy(x => x.MinPoints ?? 0).ThenBy(x => x.Id);

        var totalItems = await query.CountAsync();
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.TierName,
                x.MinPoints,
                x.MaxPoints,
                x.DiscountPercent,
                x.ColorHex,
                x.IsActive,
                UserCount = x.Users.Count
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
                activeItems = data.Count(x => x.IsActive)
            },
            Message = "Lấy danh sách hạng thành viên thành công."
        });
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> GetById(int id, [FromQuery] bool includeInactive = false)
    {
        var membership = await _db.Memberships
            .AsNoTracking()
            .Where(x => x.Id == id && (includeInactive || x.IsActive))
            .Select(x => new
            {
                x.Id,
                x.TierName,
                x.MinPoints,
                x.MaxPoints,
                x.DiscountPercent,
                x.ColorHex,
                x.IsActive,
                UserCount = x.Users.Count
            })
            .FirstOrDefaultAsync();

        if (membership is null)
            return NotFound(new { message = $"Không tìm thấy hạng thành viên #{id}." });

        return Ok(membership);
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Create([FromBody] CreateMembershipRequest request)
    {
        var validation = await ValidateMembershipAsync(request.TierName, request.MinPoints, request.MaxPoints, request.DiscountPercent, request.ColorHex, null);
        if (validation is not null)
            return validation;

        var membership = new Membership
        {
            TierName = request.TierName.Trim(),
            MinPoints = request.MinPoints,
            MaxPoints = request.MaxPoints,
            DiscountPercent = request.DiscountPercent,
            ColorHex = request.ColorHex?.Trim(),
            IsActive = true
        };

        _db.Memberships.Add(membership);
        await _db.SaveChangesAsync();

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "CREATE_MEMBERSHIP",
            ActionLabel = "Tạo hạng thành viên",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã tạo hạng thành viên '{membership.TierName}'.",
            EntityType = "Membership",
            EntityId = membership.Id,
            EntityLabel = membership.TierName,
            Severity = "Success",
            TableName = "Memberships",
            RecordId = membership.Id,
            NewValue = $"{{\"tierName\":\"{membership.TierName}\",\"isActive\":true}}"
        });

        return StatusCode(201, new { message = "Tạo hạng thành viên thành công.", data = new { membership.Id, membership.TierName, membership.IsActive } });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMembershipRequest request)
    {
        var membership = await _db.Memberships.FirstOrDefaultAsync(x => x.Id == id);
        if (membership is null)
            return NotFound(new { message = $"Không tìm thấy hạng thành viên #{id}." });

        var validation = await ValidateMembershipAsync(request.TierName, request.MinPoints, request.MaxPoints, request.DiscountPercent, request.ColorHex, id);
        if (validation is not null)
            return validation;

        var oldValue = $"{{\"tierName\":\"{membership.TierName}\",\"isActive\":{membership.IsActive.ToString().ToLower()}}}";

        membership.TierName = request.TierName.Trim();
        membership.MinPoints = request.MinPoints;
        membership.MaxPoints = request.MaxPoints;
        membership.DiscountPercent = request.DiscountPercent;
        membership.ColorHex = request.ColorHex?.Trim();

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "UPDATE_MEMBERSHIP",
            ActionLabel = "Cập nhật hạng thành viên",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã cập nhật hạng thành viên '{membership.TierName}'.",
            EntityType = "Membership",
            EntityId = id,
            EntityLabel = membership.TierName,
            Severity = "Info",
            TableName = "Memberships",
            RecordId = id,
            OldValue = oldValue,
            NewValue = $"{{\"tierName\":\"{membership.TierName}\",\"isActive\":{membership.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật hạng thành viên thành công.", data = new { membership.Id, membership.TierName, membership.IsActive } });
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Delete(int id)
    {
        var membership = await _db.Memberships.FirstOrDefaultAsync(x => x.Id == id);
        if (membership is null)
            return NotFound(new { message = $"Không tìm thấy hạng thành viên #{id}." });

        if (!membership.IsActive)
            return BadRequest(new { message = "Hạng thành viên này đã bị vô hiệu hóa trước đó." });

        var hasUsers = await _db.Users.AnyAsync(x => x.MembershipId == id);
        if (hasUsers)
            return Conflict(new { message = "Không thể xóa mềm hạng thành viên đang được gán cho người dùng." });

        membership.IsActive = false;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "DELETE_MEMBERSHIP_SOFT",
            ActionLabel = "Vô hiệu hóa hạng thành viên",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã vô hiệu hóa hạng thành viên '{membership.TierName}'.",
            EntityType = "Membership",
            EntityId = id,
            EntityLabel = membership.TierName,
            Severity = "Warning",
            TableName = "Memberships",
            RecordId = id,
            OldValue = "{\"isActive\":true}",
            NewValue = "{\"isActive\":false}"
        });

        return Ok(new { message = "Đã vô hiệu hóa hạng thành viên.", data = new { membership.Id, membership.IsActive } });
    }

    [HttpPatch("{id:int}/toggle-active")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var membership = await _db.Memberships.FirstOrDefaultAsync(x => x.Id == id);
        if (membership is null)
            return NotFound(new { message = $"Không tìm thấy hạng thành viên #{id}." });

        var oldValue = membership.IsActive;
        membership.IsActive = !membership.IsActive;

        await _auditTrail.WriteAsync(_db, User, Request, new AuditTrailEntry
        {
            ActionCode = "TOGGLE_MEMBERSHIP",
            ActionLabel = membership.IsActive ? "Kích hoạt hạng thành viên" : "Vô hiệu hóa hạng thành viên",
            Message = $"{(User.FindFirst("full_name")?.Value ?? "Hệ thống")} đã {(membership.IsActive ? "kích hoạt" : "vô hiệu hóa")} hạng thành viên '{membership.TierName}'.",
            EntityType = "Membership",
            EntityId = id,
            EntityLabel = membership.TierName,
            Severity = "Info",
            TableName = "Memberships",
            RecordId = id,
            OldValue = $"{{\"isActive\":{oldValue.ToString().ToLower()}}}",
            NewValue = $"{{\"isActive\":{membership.IsActive.ToString().ToLower()}}}"
        });

        return Ok(new { message = "Cập nhật trạng thái hạng thành viên thành công.", data = new { membership.Id, membership.IsActive } });
    }

    private async Task<IActionResult?> ValidateMembershipAsync(
        string? tierName,
        int? minPoints,
        int? maxPoints,
        decimal? discountPercent,
        string? colorHex,
        int? excludeId)
    {
        if (string.IsNullOrWhiteSpace(tierName))
            return BadRequest(new { message = "Tên hạng thành viên không được để trống." });

        var normalizedName = tierName.Trim().ToLower();
        var duplicate = await _db.Memberships.AnyAsync(x => x.Id != excludeId && x.TierName.ToLower() == normalizedName);
        if (duplicate)
            return Conflict(new { message = $"Hạng thành viên '{tierName.Trim()}' đã tồn tại." });

        if (minPoints < 0)
            return BadRequest(new { message = "Điểm tối thiểu phải lớn hơn hoặc bằng 0." });

        if (maxPoints.HasValue && minPoints.HasValue && maxPoints.Value < minPoints.Value)
            return BadRequest(new { message = "Điểm tối đa phải lớn hơn hoặc bằng điểm tối thiểu." });

        if (discountPercent is < 0 or > 100)
            return BadRequest(new { message = "Phần trăm giảm giá phải nằm trong khoảng từ 0 đến 100." });

        if (!string.IsNullOrWhiteSpace(colorHex) && !Regex.IsMatch(colorHex.Trim(), "^#[0-9A-Fa-f]{6}$"))
            return BadRequest(new { message = "Mã màu phải đúng định dạng #RRGGBB." });

        return null;
    }
}
