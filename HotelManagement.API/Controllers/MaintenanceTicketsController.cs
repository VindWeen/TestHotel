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
public class MaintenanceTicketsController : ControllerBase
{
    private readonly AppDbContext _db;

    public MaintenanceTicketsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> GetList([FromQuery] string? status = null, [FromQuery] int? roomId = null)
    {
        var query = _db.MaintenanceTickets
            .AsNoTracking()
            .Include(t => t.Room).ThenInclude(r => r.RoomType)
            .Include(t => t.ReportedByUser)
            .Include(t => t.AssignedToUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(t => t.Status == status);

        if (roomId.HasValue)
            query = query.Where(t => t.RoomId == roomId.Value);

        var tickets = await query.OrderByDescending(t => t.OpenedAt).ToListAsync();
        var data = tickets.Select(MapTicket).ToList();
        return Ok(new { data, total = data.Count });
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> GetById(int id)
    {
        var ticket = await _db.MaintenanceTickets
            .AsNoTracking()
            .Include(t => t.Room).ThenInclude(r => r.RoomType)
            .Include(t => t.ReportedByUser)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null) return NotFound(new { message = $"Không tìm thấy phiếu bảo trì #{id}." });
        return Ok(new { data = MapTicket(ticket) });
    }

    [HttpPost]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Create([FromBody] CreateMaintenanceTicketRequest request)
    {
        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == request.RoomId);
        if (room == null) return BadRequest(new { message = $"Phòng #{request.RoomId} không tồn tại." });

        var ticket = new MaintenanceTicket
        {
            RoomId = request.RoomId,
            ReportedByUserId = JwtHelper.GetUserId(User),
            AssignedToUserId = request.AssignedToUserId,
            Title = request.Title.Trim(),
            Reason = request.Reason.Trim(),
            Category = request.Category?.Trim(),
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Medium" : request.Priority.Trim(),
            BlocksRoom = request.BlocksRoom,
            ExpectedDoneAt = request.ExpectedDoneAt,
            Status = MaintenanceStatuses.Open,
            OpenedAt = DateTime.UtcNow
        };

        if (ticket.BlocksRoom)
            room.BusinessStatus = RoomBusinessStatuses.Disabled;

        _db.MaintenanceTickets.Add(ticket);
        await _db.SaveChangesAsync();
        return StatusCode(201, new { message = "Đã tạo phiếu bảo trì.", data = await BuildTicketById(ticket.Id) });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMaintenanceTicketRequest request)
    {
        var ticket = await _db.MaintenanceTickets.Include(t => t.Room).FirstOrDefaultAsync(t => t.Id == id);
        if (ticket == null) return NotFound(new { message = $"Không tìm thấy phiếu bảo trì #{id}." });

        ticket.Title = request.Title.Trim();
        ticket.Reason = request.Reason.Trim();
        ticket.Category = request.Category?.Trim();
        ticket.Priority = string.IsNullOrWhiteSpace(request.Priority) ? ticket.Priority : request.Priority.Trim();
        ticket.AssignedToUserId = request.AssignedToUserId;
        ticket.ExpectedDoneAt = request.ExpectedDoneAt;

        if (ticket.BlocksRoom != request.BlocksRoom)
        {
            ticket.BlocksRoom = request.BlocksRoom;
            if (ticket.BlocksRoom && ticket.Status != MaintenanceStatuses.Closed && ticket.Status != MaintenanceStatuses.Cancelled)
            {
                ticket.Room.BusinessStatus = RoomBusinessStatuses.Disabled;
            }
            else if (!ticket.BlocksRoom && ticket.Room.BusinessStatus == RoomBusinessStatuses.Disabled && ticket.Status is MaintenanceStatuses.Open or MaintenanceStatuses.InProgress)
            {
                ticket.Room.BusinessStatus = RoomBusinessStatuses.Available;
                ticket.Room.Status = ticket.Room.CleaningStatus == CleaningStatuses.Clean ? "Available" : "Cleaning";
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật phiếu bảo trì.", data = await BuildTicketById(ticket.Id) });
    }

    [HttpPatch("{id:int}/status")]
    [RequirePermission(PermissionCodes.ManageRooms)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateMaintenanceStatusRequest request)
    {
        var ticket = await _db.MaintenanceTickets.Include(t => t.Room).FirstOrDefaultAsync(t => t.Id == id);
        if (ticket == null) return NotFound(new { message = $"Không tìm thấy phiếu bảo trì #{id}." });

        if (!new[] { MaintenanceStatuses.Open, MaintenanceStatuses.InProgress, MaintenanceStatuses.Resolved, MaintenanceStatuses.Closed, MaintenanceStatuses.Cancelled }.Contains(request.Status))
            return BadRequest(new { message = "Trạng thái phiếu bảo trì không hợp lệ." });

        ticket.Status = request.Status;
        ticket.ResolutionNote = string.IsNullOrWhiteSpace(request.ResolutionNote) ? ticket.ResolutionNote : request.ResolutionNote.Trim();

        switch (request.Status)
        {
            case MaintenanceStatuses.InProgress:
                ticket.StartedAt ??= DateTime.UtcNow;
                if (ticket.BlocksRoom)
                    ticket.Room.BusinessStatus = RoomBusinessStatuses.Disabled;
                break;
            case MaintenanceStatuses.Resolved:
                ticket.ResolvedAt = DateTime.UtcNow;
                if (ticket.BlocksRoom)
                    ticket.Room.BusinessStatus = RoomBusinessStatuses.Disabled;
                break;
            case MaintenanceStatuses.Closed:
                ticket.ClosedAt = DateTime.UtcNow;
                if (ticket.BlocksRoom)
                {
                    ticket.Room.BusinessStatus = RoomBusinessStatuses.Available;
                    ticket.Room.CleaningStatus = CleaningStatuses.Dirty;
                    ticket.Room.Status = "Cleaning";
                }
                break;
            case MaintenanceStatuses.Cancelled:
                if (ticket.BlocksRoom && ticket.Room.BusinessStatus == RoomBusinessStatuses.Disabled)
                {
                    ticket.Room.BusinessStatus = RoomBusinessStatuses.Available;
                    ticket.Room.Status = ticket.Room.CleaningStatus == CleaningStatuses.Clean ? "Available" : "Cleaning";
                }
                break;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật trạng thái phiếu bảo trì.", data = await BuildTicketById(ticket.Id) });
    }

    private async Task<MaintenanceTicketResponse> BuildTicketById(int id)
    {
        var ticket = await _db.MaintenanceTickets
            .AsNoTracking()
            .Include(t => t.Room).ThenInclude(r => r.RoomType)
            .Include(t => t.ReportedByUser)
            .Include(t => t.AssignedToUser)
            .FirstAsync(t => t.Id == id);

        return MapTicket(ticket);
    }

    private static MaintenanceTicketResponse MapTicket(MaintenanceTicket t) => new()
    {
        Id = t.Id,
        RoomId = t.RoomId,
        RoomNumber = t.Room.RoomNumber,
        RoomTypeName = t.Room.RoomType?.Name,
        Title = t.Title,
        Reason = t.Reason,
        Category = t.Category,
        Priority = t.Priority,
        BlocksRoom = t.BlocksRoom,
        Status = t.Status,
        OpenedAt = t.OpenedAt,
        StartedAt = t.StartedAt,
        ExpectedDoneAt = t.ExpectedDoneAt,
        ResolvedAt = t.ResolvedAt,
        ClosedAt = t.ClosedAt,
        ResolutionNote = t.ResolutionNote,
        ReportedBy = t.ReportedByUser == null ? null : new MaintenanceUserReferenceResponse { Id = t.ReportedByUser.Id, FullName = t.ReportedByUser.FullName },
        AssignedTo = t.AssignedToUser == null ? null : new MaintenanceUserReferenceResponse { Id = t.AssignedToUser.Id, FullName = t.AssignedToUser.FullName }
    };
}
