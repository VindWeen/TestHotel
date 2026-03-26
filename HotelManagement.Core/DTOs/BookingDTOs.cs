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
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
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
    public List<BookingDetailResponse> BookingDetails { get; set; } = new();
}
