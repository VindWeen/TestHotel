using HotelManagement.API.Controllers;
using HotelManagement.API.Services;
using HotelManagement.Core.Constants;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelManagement.Tests.Integration.Billing;

public class BookingInvoicePaymentFlowTests
{
    [Fact]
    public async Task BookingInvoicePayment_FullFlow_UpdatesInvoiceToPaid()
    {
        await using var db = CreateDbContext();
        var invoiceService = new InvoiceService(db);
        var paymentService = new PaymentService();
        var paymentsController = new PaymentsController(db, paymentService, invoiceService);

        var booking = new Booking
        {
            BookingCode = "IT-FLOW-001",
            Status = BookingStatuses.Confirmed,
            GuestName = "Nguyen Van A",
            TotalEstimatedAmount = 180m,
            BookingDetails =
            [
                new BookingDetail
                {
                    CheckInDate = DateTime.UtcNow.Date,
                    CheckOutDate = DateTime.UtcNow.Date.AddDays(2),
                    PricePerNight = 100m,
                    OrderServices =
                    [
                        new OrderService { Status = "Delivered", TotalAmount = 50m }
                    ],
                    LossAndDamages =
                    [
                        new LossAndDamage { Status = "Confirmed", Quantity = 1, PenaltyAmount = 20m }
                    ]
                }
            ]
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var createInvoiceResult = await invoiceService.CreateFromBookingAsync(booking.Id);
        var invoiceId = GetPropertyValue<int>(createInvoiceResult, "invoiceId");
        var invoice = await db.Invoices.FirstAsync(i => i.Id == invoiceId);

        var actionResult = await paymentsController.RecordPayment(new RecordPaymentRequest
        {
            InvoiceId = invoiceId,
            AmountPaid = invoice.FinalTotal ?? 0m,
            PaymentMethod = "Cash",
            PaymentType = "Final_Settlement"
        });

        var ok = Assert.IsType<OkObjectResult>(actionResult);
        Assert.NotNull(ok.Value);

        var updatedInvoice = await db.Invoices.FirstAsync(i => i.Id == invoiceId);
        Assert.Equal(InvoiceStatuses.Paid, updatedInvoice.Status);
        Assert.Single(db.Payments);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"hotel-tests-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }

    private static T GetPropertyValue<T>(object source, string propertyName)
    {
        var property = source.GetType().GetProperty(propertyName);
        Assert.NotNull(property);
        var value = property!.GetValue(source);
        Assert.NotNull(value);
        return (T)value!;
    }
}
