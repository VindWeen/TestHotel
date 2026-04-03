namespace HotelManagement.Core.DTOs;

public record CreateMembershipRequest(
    string TierName,
    int? MinPoints,
    int? MaxPoints,
    decimal? DiscountPercent,
    string? ColorHex
);

public record UpdateMembershipRequest(
    string TierName,
    int? MinPoints,
    int? MaxPoints,
    decimal? DiscountPercent,
    string? ColorHex
);
