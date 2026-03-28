using HotelManagement.Core.Authorization;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PermissionsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ViewRoles)]
    public async Task<IActionResult> GetAll()
    {
        var permissions = await _db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.PermissionCode)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.PermissionCode
            })
            .ToListAsync();

        return Ok(new { data = permissions, total = permissions.Count });
    }
}
