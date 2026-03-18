namespace HotelManagement.DTOs
{
    public class UpdateRoomTypeRequest
    {
        public string? Name { get; set; }
        public decimal Price { get; set; }
        public string? Description { get; set; }
    }
    public class CreateRoomTypeRequest
    {
        public string? Name { get; set; }
        public decimal Price { get; set; }
        public string? Description { get; set; }
    }
}