using HotelManagement.API.Services;
using HotelManagement.Core.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardAggregationService _dashboardAggregationService;

    public DashboardController(IDashboardAggregationService dashboardAggregationService)
    {
        _dashboardAggregationService = dashboardAggregationService;
    }

    [HttpGet("overview")]
    [RequirePermission(PermissionCodes.ViewDashboard)]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        var data = await _dashboardAggregationService.GetOverviewAsync(cancellationToken);
        return Ok(new { message = "Lấy dữ liệu dashboard thành công.", data });
    }
}
