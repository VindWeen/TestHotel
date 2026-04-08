namespace HotelManagement.Core.Constants;

public static class BookingStatuses
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string CheckedIn = "Checked_in";
    public const string CheckedOutPendingSettlement = "Checked_out_pending_settlement";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
    public const string NoShow = "NoShow";
}

public static class PaymentStatuses
{
    public const string Success = "Success";
    public const string Failed = "Failed";
    public const string Pending = "Pending";
}

public static class PaymentTypes
{
    public const string BookingDeposit = "Booking_Deposit";
    public const string CheckInCollection = "CheckIn_Collection";
    public const string FinalSettlement = "Final_Settlement";
    public const string Refund = "Refund";
}

public static class InvoiceStatuses
{
    public const string Draft = "Draft";
    public const string ReadyToCollect = "Ready_To_Collect";
    public const string Unpaid = "Unpaid";
    public const string PartiallyPaid = "Partially_Paid";
    public const string Paid = "Paid";
    public const string Refunded = "Refunded";
}

public static class CleaningStatuses
{
    public const string Clean = "Clean";
    public const string Dirty = "Dirty";
    public const string PendingLoss = "PendingLoss";
}

public static class RoomBusinessStatuses
{
    public const string Available = "Available";
    public const string Occupied = "Occupied";
    public const string Disabled = "Disabled";
}

public static class ShiftStatuses
{
    public const string Scheduled = "Scheduled";
    public const string Active = "Active";
    public const string Completed = "Completed";
    public const string Absent = "Absent";
}

public static class MaintenanceStatuses
{
    public const string Open = "Open";
    public const string InProgress = "InProgress";
    public const string Resolved = "Resolved";
    public const string Closed = "Closed";
    public const string Cancelled = "Cancelled";
}

public static class BookingSources
{
    public const string WalkIn = "walk_in";
    public const string Online = "online";
    public const string Phone = "phone";

    public static readonly string[] All = [WalkIn, Online, Phone];
}

public static class VoucherDiscountTypes
{
    public const string Percent = "PERCENT";
    public const string FixedAmount = "FIXED_AMOUNT";
}
