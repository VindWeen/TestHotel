using HotelManagement.Core.Authorization;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EquipmentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EquipmentsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageInventory)]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        var query = _db.Equipments.AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(e => e.IsActive);

        var items = await query
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Id,
                e.ItemCode,
                e.Name,
                e.Category,
                e.Unit,
                e.TotalQuantity,
                e.InUseQuantity,
                e.DamagedQuantity,
                e.LiquidatedQuantity,
                e.InStockQuantity,
                e.BasePrice,
                e.DefaultPriceIfLost,
                e.Supplier,
                e.IsActive
                ,
                e.ImageUrl
            })
            .ToListAsync();

        return Ok(new { data = items, total = items.Count });
    }
}
