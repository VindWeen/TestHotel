namespace HotelManagement.Core.Entities;

public class BookingDetail
{
    public int Id { get; set; }
    public int? BookingId { get; set; }
    public int? RoomId { get; set; }   // NULL cho đến khi Lễ tân gán phòng
    public int? RoomTypeId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public decimal PricePerNight { get; set; }
    public string? Note { get; set; }

    // Navigation
    public Booking? Booking { get; set; }
    public Room? Room { get; set; }
    public RoomType? RoomType { get; set; }
    public ICollection<OrderService> OrderServices { get; set; } = [];
    public ICollection<LossAndDamage> LossAndDamages { get; set; } = [];
}
