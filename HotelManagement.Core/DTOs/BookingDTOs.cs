using System;
using System.Collections.Generic;

namespace HotelManagement.Core.DTOs;

public class CreateBookingRequest
{
    public int? UserId { get; set; }
    public string GuestName { get; set; } = null!;
    public string GuestPhone { get; set; } = null!;
    public string GuestEmail { get; set; } = null!;
    public int NumAdults { get; set; }
    public int NumChildren { get; set; }
    public int? VoucherId { get; set; }
    public string? Source { get; set; }
    public string? Note { get; set; }
    public List<CreateBookingDetailRequest> Details { get; set; } = new();
}

public class CreateBookingDetailRequest
{
    public int RoomTypeId { get; set; }
    public int? RoomId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
}

public class AddBookingDetailRequest
{
    public int RoomTypeId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public string? Note { get; set; }
}

public class CheckInBookingDetailRequest
{
    public int BookingDetailId { get; set; }
    public int? RoomId { get; set; }
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string? GuestEmail { get; set; }
    public string? NationalId { get; set; }
}

public class BulkCheckInBookingRequest
{
    public List<CheckInBookingDetailRequest> Details { get; set; } = new();
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string? GuestEmail { get; set; }
    public string? NationalId { get; set; }
}

public class ExtendStayRequest
{
    public int BookingDetailId { get; set; }
    public DateTime NewCheckOutDate { get; set; }
    public int? TargetRoomId { get; set; }
}

public class EarlyCheckOutRequest
{
    public int BookingDetailId { get; set; }
    public DateTime NewCheckOutDate { get; set; }
}

public class ReceptionDashboardResponse
{
    public DateTime Date { get; set; }
    public List<BookingResponse> TodayArrivals { get; set; } = new();
    public List<BookingResponse> StayingGuests { get; set; } = new();
    public List<BookingResponse> PendingCheckouts { get; set; } = new();
    public object Summary { get; set; } = new();
}

public class BookingDetailResponse
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public int? RoomId { get; set; }
    public int? RoomTypeId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public decimal PricePerNight { get; set; }
    public string? Note { get; set; }
    public string? RoomName { get; set; }
    public string? RoomTypeName { get; set; }
}

public class BookingPaymentSummaryResponse
{
    public decimal EstimatedTotal { get; set; }
    public decimal PaidBeforeCheckout { get; set; }
    public decimal RequiredBookingDepositAmount { get; set; }
    public decimal RequiredCheckInAmount { get; set; }
    public decimal RemainingToConfirm { get; set; }
    public decimal RemainingToCheckIn { get; set; }
    public decimal? RemainingToCheckout { get; set; }
    public bool CanConfirm { get; set; }
    public bool CanCheckIn { get; set; }
}

public class BookingResponse
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string? GuestEmail { get; set; }
    public int NumAdults { get; set; }
    public int NumChildren { get; set; }
    public string BookingCode { get; set; } = null!;
    public int? VoucherId { get; set; }
    public decimal TotalEstimatedAmount { get; set; }
    public decimal? DepositAmount { get; set; }
    public DateTime? CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }
    public string? Status { get; set; }
    public string Source { get; set; } = "online";
    public string? Note { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public BookingPaymentSummaryResponse PaymentSummary { get; set; } = new();
    public List<BookingDetailResponse> BookingDetails { get; set; } = new();
}

public class BookingTimelineEventResponse
{
    public string Type { get; set; } = null!;
    public string Label { get; set; } = null!;
    public DateTime? At { get; set; }
    public string? Note { get; set; }
}

public class AddInvoiceAdjustmentRequest
{
    public string AdjustmentType { get; set; } = "Surcharge";
    public decimal Amount { get; set; }
    public string Reason { get; set; } = null!;
    public string? Note { get; set; }
}
