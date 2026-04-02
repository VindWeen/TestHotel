using HotelManagement.API.Controllers;
using HotelManagement.API.Services;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelManagement.Tests.Contracts;

public class PaymentsControllerResponseContractTests
{
    [Fact]
    public async Task RecordPayment_WhenSuccess_ReturnsExpectedContractFields()
    {
        await using var db = CreateDbContext();
        var invoice = new Invoice
        {
            BookingId = 1,
            FinalTotal = 500m,
            Status = "Unpaid",
            CreatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var controller = new PaymentsController(db, new PaymentService(), new InvoiceService(db));
        var result = await controller.RecordPayment(new RecordPaymentRequest
        {
            InvoiceId = invoice.Id,
            AmountPaid = 500m
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<Dictionary<string, object?>>(ToDictionary(ok.Value));

        Assert.True((bool)payload["success"]!);
        Assert.NotNull(payload["message"]);
        Assert.NotNull(payload["data"]);
        Assert.NotNull(payload["invoice"]);
    }

    [Fact]
    public async Task RecordPayment_WhenInvoiceMissing_ReturnsNotFoundContract()
    {
        await using var db = CreateDbContext();
        var controller = new PaymentsController(db, new PaymentService(), new InvoiceService(db));

        var result = await controller.RecordPayment(new RecordPaymentRequest
        {
            InvoiceId = 9999,
            AmountPaid = 100m
        });

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        var payload = Assert.IsType<Dictionary<string, object?>>(ToDictionary(notFound.Value));

        Assert.False((bool)payload["success"]!);
        Assert.NotNull(payload["message"]);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"hotel-tests-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }

    private static Dictionary<string, object?> ToDictionary(object? source)
    {
        Assert.NotNull(source);
        return source!
            .GetType()
            .GetProperties()
            .ToDictionary(p => p.Name, p => p.GetValue(source));
    }
}
