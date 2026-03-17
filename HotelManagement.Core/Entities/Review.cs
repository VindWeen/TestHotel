namespace HotelManagement.Core.Entities;

public class Review
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public int? RoomTypeId { get; set; }
    public int? BookingId { get; set; }  // bắt buộc để xác thực lưu trú
    public int? Rating { get; set; }     // điểm tổng thể 1–5
    public string? Comment { get; set; }
    public string? ImageUrl { get; set; }
    public bool? IsApproved { get; set; } = false;
    public string? RejectionReason { get; set; }
    public DateTime? CreatedAt { get; set; }

    // Navigation
    public User? User { get; set; }
    public RoomType? RoomType { get; set; }
    public Booking? Booking { get; set; }
}
