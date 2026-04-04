using HotelManagement.API.Services;
using HotelManagement.Core.Authorization;
using HotelManagement.Core.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoiceService;

    public InvoicesController(IInvoiceService invoiceService)
    {
        _invoiceService = invoiceService;
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] ListQueryRequest queryRequest, [FromQuery] string? status)
    {
        var payload = await _invoiceService.GetListAsync(queryRequest, status);
        return Ok(payload);
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetDetail(int id)
    {
        var data = await _invoiceService.GetDetailAsync(id);
        if (data == null)
            return NotFound(new { message = $"Không tìm thấy hóa đơn #{id}." });

        return Ok(new { message = "Lấy chi tiết hóa đơn thành công.", data });
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpGet("by-booking/{bookingId:int}")]
    public async Task<IActionResult> GetByBookingId(int bookingId)
    {
        var data = await _invoiceService.GetByBookingIdAsync(bookingId);
        if (data == null)
            return NotFound(new { message = $"Không tìm thấy hóa đơn cho booking #{bookingId}." });

        return Ok(new { message = "Lấy hóa đơn thành công.", data });
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpPost("from-booking/{bookingId:int}")]
    public async Task<IActionResult> CreateFromBooking(int bookingId)
    {
        try
        {
            var result = await _invoiceService.CreateFromBookingAsync(bookingId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpPost("from-checkout/{bookingId:int}")]
    public async Task<IActionResult> CreateFromCheckout(int bookingId)
    {
        return await CreateFromBooking(bookingId);
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpPost("{id:int}/finalize")]
    public async Task<IActionResult> FinalizeInvoice(int id)
    {
        var result = await _invoiceService.FinalizeAsync(id);
        if (result == null)
            return NotFound(new { message = $"Không tìm thấy hóa đơn #{id}." });

        return Ok(new { message = "Chốt hóa đơn thành công.", data = result });
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpPost("{id:int}/adjustments")]
    public async Task<IActionResult> AddAdjustment(int id, [FromBody] AddInvoiceAdjustmentRequest request)
    {
        try
        {
            var result = await _invoiceService.AddAdjustmentAsync(id, request);
            if (result == null)
                return NotFound(new { message = $"Không tìm thấy hóa đơn #{id}." });

            return Ok(new { message = "Đã thêm điều chỉnh hóa đơn thành công.", data = result });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [RequirePermission(PermissionCodes.ManageInvoices)]
    [HttpDelete("{id:int}/adjustments/{adjustmentId:int}")]
    public async Task<IActionResult> RemoveAdjustment(int id, int adjustmentId)
    {
        try
        {
            var result = await _invoiceService.RemoveAdjustmentAsync(id, adjustmentId);
            if (result == null)
                return NotFound(new { message = $"Không tìm thấy hóa đơn #{id}." });

            return Ok(new { message = "Đã xóa điều chỉnh hóa đơn thành công.", data = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
