namespace HotelManagement.Core.DTOs;

public record CreateServiceCategoryRequest(string Name);

public record UpdateServiceCategoryRequest(string Name);

public record CreateServiceRequest(
    int? CategoryId,
    string Name,
    string? Description,
    decimal Price,
    string? Unit,
    string? ImageUrl
);

public record UpdateServiceRequest(
    int? CategoryId,
    string Name,
    string? Description,
    decimal Price,
    string? Unit,
    string? ImageUrl
);
