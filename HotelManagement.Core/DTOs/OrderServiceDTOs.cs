namespace HotelManagement.Core.DTOs;

public record OrderServiceItemRequest(
    int ServiceId,
    int Quantity,
    decimal? UnitPriceOverride
);

public record CreateOrderServiceRequest(
    int BookingDetailId,
    string? Note,
    List<OrderServiceItemRequest> Items
);

public record UpdateOrderServiceRequest(
    string? Note,
    List<OrderServiceItemRequest> Items
);

public record UpdateOrderServiceStatusRequest(string Status);
