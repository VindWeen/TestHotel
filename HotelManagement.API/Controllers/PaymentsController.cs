using HotelManagement.API.Services;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Constants;
using HotelManagement.Core.Entities;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

public class RecordPaymentRequest
{
    public int InvoiceId { get; set; }
    public string? PaymentType { get; set; }
    public string? PaymentMethod { get; set; }
    public decimal AmountPaid { get; set; }
    public string? TransactionCode { get; set; }
    public string? Note { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPaymentService _paymentService;
    private readonly IInvoiceService _invoiceService;

    public PaymentsController(AppDbContext db, IPaymentService paymentService, IInvoiceService invoiceService)
    {
        _db = db;
        _paymentService = paymentService;
        _invoiceService = invoiceService;
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpPost]
    public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentRequest request)
    {
        _paymentService.EnsureValidAmount(request.AmountPaid);

        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceId);

        if (invoice == null)
            return NotFound(new { success = false, message = $"Không tìm thấy hóa đơn #{request.InvoiceId}." });

        var payment = new Payment
        {
            InvoiceId = request.InvoiceId,
            PaymentType = request.PaymentType ?? "Final_Settlement",
            PaymentMethod = request.PaymentMethod ?? "Cash",
            AmountPaid = request.AmountPaid,
            TransactionCode = request.TransactionCode,
            Status = PaymentStatuses.Success,
            PaymentDate = DateTime.UtcNow,
            Note = request.Note
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        var finalized = await _invoiceService.FinalizeAsync(invoice.Id);

        return Ok(new
        {
            success = true,
            message = "Ghi nhận thanh toán thành công.",
            data = new
            {
                payment.Id,
                payment.InvoiceId,
                payment.AmountPaid,
                payment.PaymentType,
                payment.PaymentMethod,
                payment.TransactionCode,
                payment.Status,
                payment.PaymentDate,
                payment.Note
            },
            invoice = finalized
        });
    }
}
