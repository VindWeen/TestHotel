using HotelManagement.Core.Authorization;
using HotelManagement.Core.Constants;
using HotelManagement.Core.DTOs;
using HotelManagement.Core.Entities;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShiftsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ShiftsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> GetList([FromQuery] string? department = null, [FromQuery] string? status = null, [FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? DateTime.UtcNow.Date).Date;
        var query = _db.Shifts
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.ConfirmedByUser)
            .Where(s => s.PlannedStart.Date <= targetDate && s.PlannedEnd.Date >= targetDate);

        if (!string.IsNullOrWhiteSpace(department))
            query = query.Where(s => s.Department == department);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        var shifts = await query.OrderBy(s => s.PlannedStart).ToListAsync();
        var data = shifts.Select(MapShift).ToList();
        return Ok(new { data, total = data.Count });
    }

    [HttpGet("current")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> GetCurrent()
    {
        var now = DateTime.UtcNow;
        var shifts = await _db.Shifts
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.ConfirmedByUser)
            .Where(s => s.PlannedStart <= now && s.PlannedEnd >= now)
            .OrderByDescending(s => s.Status == ShiftStatuses.Active)
            .ThenBy(s => s.PlannedStart)
            .ToListAsync();
        var data = shifts.Select(MapShift).ToList();

        return Ok(new { data, total = data.Count });
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Create([FromBody] CreateShiftRequest request)
    {
        if (request.PlannedEnd <= request.PlannedStart)
            return BadRequest(new { message = "Thời gian kết thúc phải lớn hơn thời gian bắt đầu." });

        var overlap = await _db.Shifts.AnyAsync(s =>
            s.UserId == request.UserId &&
            s.Status != ShiftStatuses.Completed &&
            s.Status != ShiftStatuses.Absent &&
            request.PlannedStart < s.PlannedEnd &&
            request.PlannedEnd > s.PlannedStart);

        if (overlap)
            return Conflict(new { message = "Nhân sự này đã có ca trùng thời gian." });

        var shift = new Shift
        {
            UserId = request.UserId,
            ShiftType = request.ShiftType.Trim(),
            Department = request.Department.Trim(),
            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            Status = ShiftStatuses.Scheduled,
            CreatedAt = DateTime.UtcNow
        };

        _db.Shifts.Add(shift);
        await _db.SaveChangesAsync();

        var createdShift = await _db.Shifts
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.ConfirmedByUser)
            .Where(s => s.Id == shift.Id)
            .FirstAsync();
        var created = MapShift(createdShift);

        return StatusCode(201, new { message = "Tạo ca làm việc thành công.", data = created });
    }

    [HttpPatch("{id:int}/start")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Start(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift == null) return NotFound(new { message = $"Không tìm thấy ca #{id}." });

        var activeInDepartment = await _db.Shifts.AnyAsync(s =>
            s.Id != id &&
            s.Department == shift.Department &&
            s.Status == ShiftStatuses.Active &&
            s.PlannedStart < shift.PlannedEnd &&
            s.PlannedEnd > shift.PlannedStart);

        if (activeInDepartment)
            return Conflict(new { message = "Bộ phận này đang có ca active chồng thời gian, cần hoàn tất trước khi mở ca mới." });

        shift.ActualStart = DateTime.UtcNow;
        shift.LateMinutes = Math.Max(0, (int)(shift.ActualStart.Value - shift.PlannedStart).TotalMinutes);
        shift.Status = ShiftStatuses.Active;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã bắt đầu ca làm việc.", data = new { shift.Id, shift.Status, shift.ActualStart, shift.LateMinutes } });
    }

    [HttpPatch("{id:int}/handover")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Handover(int id, [FromBody] ShiftHandoverRequest request)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift == null) return NotFound(new { message = $"Không tìm thấy ca #{id}." });

        if (string.IsNullOrWhiteSpace(request.HandoverNote))
            return BadRequest(new { message = "Ghi chú bàn giao không được để trống." });

        shift.HandoverNote = request.HandoverNote.Trim();
        shift.CashAtHandover = request.CashAtHandover;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã lưu thông tin bàn giao ca." });
    }

    [HttpPatch("{id:int}/complete")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Complete(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift == null) return NotFound(new { message = $"Không tìm thấy ca #{id}." });
        if (string.IsNullOrWhiteSpace(shift.HandoverNote))
            return BadRequest(new { message = "Ca làm việc phải có ghi chú bàn giao trước khi hoàn tất." });

        shift.ActualEnd = DateTime.UtcNow;
        shift.Status = ShiftStatuses.Completed;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã hoàn tất ca làm việc.", data = new { shift.Id, shift.Status, shift.ActualEnd } });
    }

    [HttpPatch("{id:int}/confirm")]
    [RequirePermission(PermissionCodes.ManageUsers)]
    public async Task<IActionResult> Confirm(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift == null) return NotFound(new { message = $"Không tìm thấy ca #{id}." });

        shift.ConfirmedBy = JwtHelper.GetUserId(User);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã xác nhận bàn giao ca.", data = new { shift.Id, shift.ConfirmedBy } });
    }

    private static ShiftResponse MapShift(Shift s) => new()
    {
        Id = s.Id,
        UserId = s.UserId,
        UserFullName = s.User.FullName,
        ConfirmedBy = s.ConfirmedBy,
        ConfirmedByName = s.ConfirmedByUser?.FullName,
        ShiftType = s.ShiftType,
        Department = s.Department,
        PlannedStart = s.PlannedStart,
        PlannedEnd = s.PlannedEnd,
        ActualStart = s.ActualStart,
        ActualEnd = s.ActualEnd,
        LateMinutes = s.LateMinutes,
        Status = s.Status,
        HandoverNote = s.HandoverNote,
        CashAtHandover = s.CashAtHandover,
        CreatedAt = s.CreatedAt
    };
}
