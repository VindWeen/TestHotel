using HotelManagement.API.Controllers;
using HotelManagement.API.Services;
using HotelManagement.Core.DTOs;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace HotelManagement.Tests.Contracts;

public class InvoicesControllerResponseContractTests
{
    [Fact]
    public async Task GetList_ReturnsApiListResponseContract()
    {
        var controller = new InvoicesController(new FakeInvoiceService());

        var result = await controller.GetList(new ListQueryRequest(), null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<ApiListResponse<object>>(ok.Value);

        Assert.True(payload.Success);
        Assert.NotNull(payload.Data);
        Assert.NotNull(payload.Pagination);
    }

    [Fact]
    public async Task GetDetail_WhenMissing_ReturnsNotFoundWithMessage()
    {
        var controller = new InvoicesController(new FakeInvoiceService { DetailResult = null });

        var result = await controller.GetDetail(12345);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        var payload = ToDictionary(notFound.Value);
        Assert.True(payload.ContainsKey("message"));
    }

    private static Dictionary<string, object?> ToDictionary(object? source)
    {
        Assert.NotNull(source);
        return source!
            .GetType()
            .GetProperties()
            .ToDictionary(p => p.Name, p => p.GetValue(source));
    }

    private sealed class FakeInvoiceService : IInvoiceService
    {
        public object? DetailResult { get; set; } = new { id = 1 };

        public Task<object> CreateFromBookingAsync(int bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult<object>(new { created = true, invoiceId = 1 });

        public Task<object?> FinalizeAsync(int id, CancellationToken cancellationToken = default)
            => Task.FromResult<object?>(new { id, status = "Paid" });

        public Task<object?> GetByBookingIdAsync(int bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult<object?>(new { id = 1, bookingId });

        public Task<object?> GetDetailAsync(int id, CancellationToken cancellationToken = default)
            => Task.FromResult(DetailResult);

        public Task<ApiListResponse<object>> GetListAsync(ListQueryRequest queryRequest, string? status, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new ApiListResponse<object>
            {
                Data = new object[] { new { id = 1 } },
                Pagination = new PaginationMeta
                {
                    CurrentPage = 1,
                    PageSize = 10,
                    TotalItems = 1,
                    TotalPages = 1
                },
                Message = "ok"
            });
        }
    }
}
