using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Helpers;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HotelManagement.API.Services;

namespace HotelManagement.API.Controllers;

#region DTOs
public class CreateReviewRequest
{
    public int BookingId { get; set; }
    public int RoomTypeId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public IFormFile? Image { get; set; } // ← đổi từ string? sang IFormFile?
}

public class ApproveReviewRequest
{
    public bool IsApproved { get; set; }
    public string? RejectionReason { get; set; }
}
#endregion

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly Cloudinary _cloudinary;
    private readonly IActivityLogService _activityLog;

    public ReviewsController(AppDbContext context, Cloudinary cloudinary, IActivityLogService activityLog)
    {
        _context = context;
        _cloudinary = cloudinary;
        _activityLog = activityLog;
    }

    // ================= UPLOAD ẢNH =================
    [Authorize]
    [HttpPost("upload-image")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Vui lòng chọn file ảnh");

        // Chỉ cho phép ảnh
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest("Chỉ chấp nhận file ảnh (jpg, png, webp, gif)");

        // Giới hạn 5MB
        if (file.Length > 5 * 1024 * 1024)
            return BadRequest("File không được vượt quá 5MB");

        using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = "hotel/reviews",        // thư mục trên Cloudinary
            Transformation = new Transformation()
                                .Width(1200)
                                .Height(800)
                                .Crop("limit")       // giữ tỉ lệ, không crop
                                .Quality("auto")
                                .FetchFormat("auto")
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
            return BadRequest($"Upload thất bại: {result.Error.Message}");

        return Ok(new
        {
            url = result.SecureUrl.ToString(),
            publicId = result.PublicId
        });
    }

    [AllowAnonymous]
[HttpGet]
public async Task<IActionResult> GetAll(
    int? roomTypeId,
    string? status,   // ← thêm: "pending" / "approved" / "rejected", để trống = chỉ approved (public)
    int page = 1,
    int pageSize = 10)
{
    IQueryable<Review> query;

    if (!string.IsNullOrEmpty(status))
    {
        // Admin filter theo status cụ thể
        query = status.ToLower() switch
        {
            "approved" => _context.Reviews.Where(r => r.IsApproved == true),
            "rejected" => _context.Reviews.Where(r => r.IsApproved == false && r.RejectionReason != null),
            "pending"  => _context.Reviews.Where(r => r.IsApproved == false && r.RejectionReason == null),
            _          => _context.Reviews.Where(r => r.IsApproved == true)
        };
    }
    else
    {
        // Mặc định public: chỉ hiện approved
        query = _context.Reviews.Where(r => r.IsApproved == true);
    }

    if (roomTypeId.HasValue)
        query = query.Where(r => r.RoomTypeId == roomTypeId.Value);

    var total = await query.CountAsync();

    var avgRating = total > 0
        ? await query.AverageAsync(r => (double?)r.Rating ?? 0)
        : 0;

    var data = await query
        .OrderByDescending(r => r.Id)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(r => new
        {
            r.Id,
            r.Rating,
            r.Comment,
            r.ImageUrl,
            r.CreatedAt,
            r.IsApproved,
            r.RejectionReason,
            RoomType = r.RoomType == null ? null : new { r.RoomType.Id, r.RoomType.Name },
            User     = r.User    == null ? null : new { r.User.Id, r.User.FullName, r.User.AvatarUrl }
        })
        .ToListAsync();

    return Ok(new
    {
        total,
        page,
        pageSize,
        avgRating = Math.Round(avgRating, 1),
        data
    });
}

    // ================= POST REVIEW (Authenticated) =================
[Authorize]
[HttpPost]
[Consumes("multipart/form-data")] // ← nhận form-data vì có file
public async Task<IActionResult> Create([FromForm] CreateReviewRequest request)
{
    var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    if (request.Rating < 1 || request.Rating > 5)
        return BadRequest("Rating phải từ 1 đến 5");

    var booking = await _context.Bookings
        .FirstOrDefaultAsync(b => b.Id == request.BookingId && b.UserId == userId);

    if (booking == null)
        return BadRequest("Booking không tồn tại hoặc không thuộc về bạn");

    if (booking.Status != "Completed")
        return BadRequest("Chỉ có thể đánh giá sau khi hoàn thành lưu trú");

    var roomTypeExists = await _context.RoomTypes.AnyAsync(rt => rt.Id == request.RoomTypeId);
    if (!roomTypeExists)
        return BadRequest("RoomType không tồn tại");

    var alreadyReviewed = await _context.Reviews
        .AnyAsync(r => r.UserId == userId && r.BookingId == request.BookingId);

    if (alreadyReviewed)
        return BadRequest("Bạn đã đánh giá booking này rồi");

    // ===== UPLOAD ẢNH LÊN CLOUDINARY NẾU CÓ =====
    string? imageUrl = null;
    if (request.Image != null && request.Image.Length > 0)
    {
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(request.Image.ContentType.ToLower()))
            return BadRequest("Chỉ chấp nhận file ảnh (jpg, png, webp, gif)");

        if (request.Image.Length > 5 * 1024 * 1024)
            return BadRequest("File không được vượt quá 5MB");

        using var stream = request.Image.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File           = new FileDescription(request.Image.FileName, stream),
            Folder         = "hotel/reviews",
            Transformation = new Transformation()
                                .Width(1200)
                                .Height(800)
                                .Crop("limit")
                                .Quality("auto")
                                .FetchFormat("auto")
        };

        var uploadResult = await _cloudinary.UploadAsync(uploadParams);

        if (uploadResult.Error != null)
            return BadRequest($"Upload ảnh thất bại: {uploadResult.Error.Message}");

        imageUrl = uploadResult.SecureUrl.ToString();
    }

    var review = new Review
    {
        UserId          = userId,
        BookingId       = request.BookingId,
        RoomTypeId      = request.RoomTypeId,
        Rating          = request.Rating,
        Comment         = request.Comment,
        ImageUrl        = imageUrl,   // ← URL từ Cloudinary hoặc null nếu không có ảnh
        IsApproved      = false,
        RejectionReason = null,
        CreatedAt       = DateTime.UtcNow
    };

    _context.Reviews.Add(review);
    await _context.SaveChangesAsync();

    return Ok(new
    {
        message = "Đánh giá đã được gửi, chờ admin duyệt",
        review.Id,
        review.Rating,
        review.Comment,
        review.ImageUrl,
        review.IsApproved
    });
}

    // ================= APPROVE / REJECT =================
    [RequirePermission(PermissionCodes.ManageContent)]
    [HttpPatch("{id}/approve")]
    public async Task<IActionResult> Approve(int id, ApproveReviewRequest request)
    {
        var review = await _context.Reviews.FindAsync(id);
        if (review == null) return NotFound();

        if (request.IsApproved)
        {
            review.IsApproved = true;
            review.RejectionReason = null;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.RejectionReason))
                return BadRequest("Vui lòng nhập lý do từ chối");

            review.IsApproved = false;
            review.RejectionReason = request.RejectionReason;
        }

        await _context.SaveChangesAsync();

        await _context.SaveChangesAsync();

        var currentUserId = JwtHelper.GetUserId(User);
        // Ghi Activity Log (Thông báo chuông)
        await _activityLog.LogAsync(
            actionCode: request.IsApproved ? "APPROVE_REVIEW" : "REJECT_REVIEW",
            actionLabel: request.IsApproved ? "Duyệt đánh giá" : "Từ chối đánh giá",
            message: request.IsApproved
                ? $"Đã duyệt đánh giá của khách {review.User?.FullName ?? "vô danh"} cho {review.RoomType?.Name}"
                : $"Đã từ chối đánh giá #{id}. Lý do: {request.RejectionReason}",
            entityType: "Review",
            entityId: id,
            entityLabel: $"Review #{id}",
            severity: request.IsApproved ? "Success" : "Warning",
            userId: currentUserId,
            roleName: User.FindFirst("role")?.Value
        );

        // Khôi phục AuditLog (Ghi hệ thống)
        _context.AuditLogs.Add(new AuditLog
        {
            UserId    = currentUserId,
            Action    = request.IsApproved ? "APPROVE_REVIEW" : "REJECT_REVIEW",
            TableName = "Reviews",
            RecordId  = id,
            OldValue  = null,
            NewValue  = request.IsApproved
                ? "{\"isApproved\": true}"
                : $"{{\"isApproved\": false, \"rejectionReason\": \"{request.RejectionReason}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers["User-Agent"].ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = request.IsApproved ? "Đã duyệt đánh giá" : "Đã từ chối đánh giá",
            review.Id,
            review.IsApproved,
            review.RejectionReason
        });
    }

    
}
