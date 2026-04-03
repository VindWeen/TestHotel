namespace HotelManagement.Core.DTOs;

public class LoyaltyMemberListQueryRequest : ListQueryRequest
{
    public int? MembershipId { get; set; }
    public int? MinPoints { get; set; }
    public int? MaxPoints { get; set; }
}

public record LoyaltyTransactionResponse(
    int Id,
    string TransactionType,
    int Points,
    int BalanceAfter,
    string? Note,
    int? BookingId,
    string? BookingCode,
    DateTime CreatedAt
);
