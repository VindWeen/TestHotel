namespace HotelManagement.Core.Constants;

public static class BookingStatuses
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string CheckedIn = "Checked_in";
    public const string CheckedOutPendingSettlement = "Checked_out_pending_settlement";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
}

public static class PaymentStatuses
{
    public const string Success = "Success";
    public const string Failed = "Failed";
    public const string Pending = "Pending";
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

public static class VoucherDiscountTypes
{
    public const string Percent = "PERCENT";
    public const string FixedAmount = "FIXED_AMOUNT";
}
