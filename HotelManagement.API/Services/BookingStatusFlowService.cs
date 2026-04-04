using HotelManagement.Core.Constants;

namespace HotelManagement.API.Services;

public interface IBookingStatusFlowService
{
    bool CanTransition(string? currentStatus, string targetStatus, out string errorMessage);
}

public class BookingStatusFlowService : IBookingStatusFlowService
{
    private static readonly Dictionary<string, HashSet<string>> AllowedTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        [BookingStatuses.Pending] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { BookingStatuses.Confirmed, BookingStatuses.Cancelled },
        [BookingStatuses.Confirmed] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { BookingStatuses.CheckedIn, BookingStatuses.Cancelled },
        [BookingStatuses.CheckedIn] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { BookingStatuses.CheckedOutPendingSettlement },
        [BookingStatuses.CheckedOutPendingSettlement] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { BookingStatuses.Completed },
        [BookingStatuses.Completed] = new HashSet<string>(StringComparer.OrdinalIgnoreCase),
        [BookingStatuses.Cancelled] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    };

    public bool CanTransition(string? currentStatus, string targetStatus, out string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(currentStatus))
        {
            errorMessage = "Tráº¡ng thĂ¡i booking hiá»‡n táº¡i Ä‘ang rá»—ng.";
            return false;
        }

        if (!AllowedTransitions.TryGetValue(currentStatus, out var nextStatuses))
        {
            errorMessage = $"Tráº¡ng thĂ¡i booking '{currentStatus}' khĂ´ng há»£p lá»‡.";
            return false;
        }

        if (!nextStatuses.Contains(targetStatus))
        {
            errorMessage = $"KhĂ´ng thá»ƒ chuyá»ƒn tráº¡ng thĂ¡i tá»« {currentStatus} sang {targetStatus}.";
            return false;
        }

        errorMessage = string.Empty;
        return true;
    }
}

