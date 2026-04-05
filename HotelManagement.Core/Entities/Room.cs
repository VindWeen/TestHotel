namespace HotelManagement.Core.Entities;

public class Room
{
    public int Id { get; set; }
    public int? RoomTypeId { get; set; }
    public string RoomNumber { get; set; } = null!;
    public int? Floor { get; set; }
    public string? ViewType { get; set; }

    // Trạng thái cũ — giữ cho tương thích
    public string? Status { get; set; }

    // Tách 2 trục trạng thái (Buoi4 slide 30)
    public string BusinessStatus { get; set; } = "Available"; // Available / Occupied / Disabled
    public string CleaningStatus { get; set; } = "Clean";     // Clean / Dirty / PendingLoss

    public string? Notes { get; set; }
    public string? InventorySyncSnapshotJson { get; set; }
    public DateTime? InventoryLastSyncedAt { get; set; }
    public int InventoryVersion { get; set; }

    // Navigation
    public RoomType? RoomType { get; set; }
    public ICollection<RoomInventory> RoomInventories { get; set; } = [];
    public ICollection<BookingDetail> BookingDetails { get; set; } = [];
}
