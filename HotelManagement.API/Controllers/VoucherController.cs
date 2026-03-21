using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Helpers;

namespace HotelManagement.API.Controllers;

#region DTOs
public class CreateVoucherRequest
{
    public string Code { get; set; } = null!;
    public string DiscountType { get; set; } = null!; // PERCENT / FIXED_AMOUNT
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal? MinBookingValue { get; set; }
    public int? ApplicableRoomTypeId { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
    public int? UsageLimit { get; set; }
    public int MaxUsesPerUser { get; set; } = 1;
}

public class UpdateVoucherRequest
{
    public string? DiscountType { get; set; }
    public decimal? DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal? MinBookingValue { get; set; }
    public int? ApplicableRoomTypeId { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
    public int? UsageLimit { get; set; }
    public int? MaxUsesPerUser { get; set; }
    public bool? IsActive { get; set; }
}

public class ValidateVoucherRequest
{
    public string Code { get; set; } = null!;
    public decimal BookingAmount { get; set; }
}
#endregion

[ApiController]
[Route("api/[controller]")]
public class VouchersController : ControllerBase
{
    private readonly AppDbContext _context;

    public VouchersController(AppDbContext context)
    {
        _context = context;
    }

    // ================= GET ALL =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        bool? isActive,
        int page = 1,
        int pageSize = 10)
    {
        var query = _context.Vouchers.AsQueryable();

        if (isActive.HasValue)
            query = query.Where(v => v.IsActive == isActive.Value);

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(v => v.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new
            {
                v.Id,
                v.Code,
                v.DiscountType,
                v.DiscountValue,
                v.MaxDiscountAmount,
                v.MinBookingValue,
                v.ApplicableRoomTypeId,
                v.ValidFrom,
                v.ValidTo,
                v.UsageLimit,
                v.UsedCount,          // ← used_count / usage_limit
                v.MaxUsesPerUser,
                v.IsActive,
                v.CreatedAt
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, data });
    }

    // ================= GET BY ID =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var v = await _context.Vouchers.FindAsync(id);
        if (v == null) return NotFound();
        return Ok(v);
    }

    // ================= CREATE =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPost]
    public async Task<IActionResult> Create(CreateVoucherRequest request)
    {
        // Validate discount type
        if (request.DiscountType != "PERCENT" && request.DiscountType != "FIXED_AMOUNT")
            return BadRequest("DiscountType phải là PERCENT hoặc FIXED_AMOUNT");

        // Validate PERCENT không vượt 100
        if (request.DiscountType == "PERCENT" && request.DiscountValue > 100)
            return BadRequest("Phần trăm giảm giá không được vượt quá 100%");

        // Validate ngày
        if (request.ValidFrom.HasValue && request.ValidTo.HasValue
            && request.ValidFrom >= request.ValidTo)
            return BadRequest("ValidFrom phải trước ValidTo");

        // Kiểm tra code trùng
        var exists = await _context.Vouchers.AnyAsync(v => v.Code == request.Code);
        if (exists)
            return BadRequest($"Mã voucher '{request.Code}' đã tồn tại");

        var voucher = new Voucher
        {
            Code                 = request.Code.ToUpper().Trim(),
            DiscountType         = request.DiscountType,
            DiscountValue        = request.DiscountValue,
            MaxDiscountAmount    = request.MaxDiscountAmount,
            MinBookingValue      = request.MinBookingValue,
            ApplicableRoomTypeId = request.ApplicableRoomTypeId,
            ValidFrom            = request.ValidFrom,
            ValidTo              = request.ValidTo,
            UsageLimit           = request.UsageLimit,
            MaxUsesPerUser       = request.MaxUsesPerUser,
            UsedCount            = 0,
            IsActive             = true,
            CreatedAt            = DateTime.UtcNow
        };

        _context.Vouchers.Add(voucher);
        await _context.SaveChangesAsync();

        var currentUserId = JwtHelper.GetUserId(User);
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "CREATE_VOUCHER",
            TableName = "Vouchers",
            RecordId  = voucher.Id,
            OldValue  = null,
            NewValue  = $"{{\"code\": \"{voucher.Code}\", \"discountType\": \"{voucher.DiscountType}\", \"discountValue\": {voucher.DiscountValue}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return Ok(voucher);
    }

    // ================= UPDATE =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateVoucherRequest request)
    {
        var v = await _context.Vouchers.FindAsync(id);
        if (v == null) return NotFound();

        // Validate discount type nếu có thay đổi
        if (request.DiscountType != null
            && request.DiscountType != "PERCENT"
            && request.DiscountType != "FIXED_AMOUNT")
            return BadRequest("DiscountType phải là PERCENT hoặc FIXED_AMOUNT");

        if (request.DiscountType == "PERCENT"
            && request.DiscountValue.HasValue
            && request.DiscountValue > 100)
            return BadRequest("Phần trăm giảm giá không được vượt quá 100%");

        // Validate ngày
        var newFrom = request.ValidFrom ?? v.ValidFrom;
        var newTo   = request.ValidTo   ?? v.ValidTo;
        if (newFrom.HasValue && newTo.HasValue && newFrom >= newTo)
            return BadRequest("ValidFrom phải trước ValidTo");

        // Cập nhật các field nếu có giá trị mới
        if (request.DiscountType     != null) v.DiscountType         = request.DiscountType;
        if (request.DiscountValue    .HasValue) v.DiscountValue      = request.DiscountValue.Value;
        if (request.MaxDiscountAmount.HasValue) v.MaxDiscountAmount  = request.MaxDiscountAmount;
        if (request.MinBookingValue  .HasValue) v.MinBookingValue    = request.MinBookingValue;
        if (request.ApplicableRoomTypeId.HasValue) v.ApplicableRoomTypeId = request.ApplicableRoomTypeId;
        if (request.ValidFrom        .HasValue) v.ValidFrom          = request.ValidFrom;
        if (request.ValidTo          .HasValue) v.ValidTo            = request.ValidTo;
        if (request.UsageLimit       .HasValue) v.UsageLimit         = request.UsageLimit;
        if (request.MaxUsesPerUser   .HasValue) v.MaxUsesPerUser     = request.MaxUsesPerUser.Value;
        if (request.IsActive         .HasValue) v.IsActive           = request.IsActive.Value;

        var currentUserId = JwtHelper.GetUserId(User);
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "UPDATE_VOUCHER",
            TableName = "Vouchers",
            RecordId  = id,
            OldValue  = null,
            NewValue  = $"{{\"code\": \"{v.Code}\", \"isActive\": {v.IsActive.ToString().ToLower()}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(v);
    }

    // ================= DELETE (SOFT) =================
    [RequirePermission(PermissionCodes.ManageBookings)]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var v = await _context.Vouchers.FindAsync(id);
        if (v == null) return NotFound();

        v.IsActive = false; // ← Soft delete, không xóa khỏi DB

        var currentUserId = JwtHelper.GetUserId(User);
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = "DELETE_VOUCHER",
            TableName = "Vouchers",
            RecordId  = id,
            OldValue  = $"{{\"isActive\": true}}",
            NewValue  = $"{{\"isActive\": false}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Voucher '{v.Code}' đã bị vô hiệu hóa." });
    }

    // ================= VALIDATE =================
    [Authorize]
    [HttpPost("validate")]
    public async Task<IActionResult> Validate(ValidateVoucherRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var v = await _context.Vouchers
            .FirstOrDefaultAsync(x => x.Code == request.Code.ToUpper().Trim());

        if (v == null || !v.IsActive)
            return BadRequest(new { valid = false, message = "Voucher không tồn tại hoặc đã bị vô hiệu hóa" });

        // Kiểm tra thời hạn
        if (v.ValidFrom.HasValue && DateTime.UtcNow < v.ValidFrom)
            return BadRequest(new { valid = false, message = "Voucher chưa đến ngày sử dụng" });

        if (v.ValidTo.HasValue && DateTime.UtcNow > v.ValidTo)
            return BadRequest(new { valid = false, message = "Voucher đã hết hạn" });

        // Kiểm tra usage limit
        if (v.UsageLimit.HasValue && v.UsedCount >= v.UsageLimit)
            return BadRequest(new { valid = false, message = "Voucher đã hết lượt sử dụng" });

        // Kiểm tra user đã dùng voucher này chưa (max_uses_per_user)
        var userUsedCount = await _context.VoucherUsages
            .CountAsync(vu => vu.VoucherId == v.Id && vu.UserId == userId);

        if (userUsedCount >= v.MaxUsesPerUser)
            return BadRequest(new { valid = false, message = $"Bạn đã dùng voucher này tối đa {v.MaxUsesPerUser} lần" });

        // Kiểm tra min booking value
        if (v.MinBookingValue.HasValue && request.BookingAmount < v.MinBookingValue)
            return BadRequest(new
            {
                valid   = false,
                message = $"Đơn hàng tối thiểu {v.MinBookingValue:N0}đ để dùng voucher này"
            });

        // Tính tiền giảm
        decimal discount = 0;
        if (v.DiscountType == "PERCENT")
        {
            discount = request.BookingAmount * v.DiscountValue / 100;
            if (v.MaxDiscountAmount.HasValue)
                discount = Math.Min(discount, v.MaxDiscountAmount.Value);
        }
        else
        {
            discount = v.DiscountValue;
        }

        discount = Math.Min(discount, request.BookingAmount); // không giảm quá tổng tiền

        return Ok(new
        {
            valid           = true,
            voucherId       = v.Id,
            code            = v.Code,
            discountType    = v.DiscountType,
            discountValue   = v.DiscountValue,
            discountAmount  = discount,
            finalAmount     = request.BookingAmount - discount,
            usageRemaining  = v.UsageLimit.HasValue ? v.UsageLimit - v.UsedCount : (int?)null
        });
    }
}