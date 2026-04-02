using HotelManagement.Core.Models.Enums;

namespace HotelManagement.Core.DTOs;

public class ListQueryRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Keyword { get; set; }
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
    public string? Status { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}

public class PaginationMeta
{
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
}

public class ApiListResponse<T>
{
    public bool Success { get; set; } = true;
    public IEnumerable<T> Data { get; set; } = [];
    public PaginationMeta Pagination { get; set; } = new();
    public object? Summary { get; set; }
    public string? Message { get; set; }
    public IEnumerable<string>? Errors { get; set; }
    public Notification? Notification { get; set; }
}

public class ApiErrorResponse
{
    public bool Success { get; set; } = false;
    public string Message { get; set; } = "Unexpected server error.";
    public IEnumerable<string> Errors { get; set; } = [];
    public string? TraceId { get; set; }
}
