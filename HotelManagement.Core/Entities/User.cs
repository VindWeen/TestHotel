namespace HotelManagement.Core.Entities;

public class User
{
    public int Id { get; set; }
    public int? RoleId { get; set; }
    public int? MembershipId { get; set; }

    // Thông tin cơ bản
    public string FullName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string? Phone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? Address { get; set; }
    public string? NationalId { get; set; }

    // Auth
    public string PasswordHash { get; set; } = null!;
    public string? AvatarUrl { get; set; }

    // Refresh Token — lưu server-side để validate và revoke khi logout
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }

    // Loyalty
    public int LoyaltyPoints { get; set; } = 0;
    public int LoyaltyPointsUsable { get; set; } = 0;

    // Status & Timestamps
    public bool? Status { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public Role? Role { get; set; }
    public Membership? Membership { get; set; }
    public ICollection<Booking> Bookings { get; set; } = [];
    public ICollection<Review> Reviews { get; set; } = [];
    public ICollection<Article> Articles { get; set; } = [];
    public ICollection<AuditLog> AuditLogs { get; set; } = [];
    public ICollection<Shift> Shifts { get; set; } = [];
    public ICollection<Shift> ConfirmedShifts { get; set; } = [];
    public ICollection<LoyaltyTransaction> LoyaltyTransactions { get; set; } = [];
    public ICollection<VoucherUsage> VoucherUsages { get; set; } = [];
    public ICollection<LossAndDamage> ReportedDamages { get; set; } = [];
    public ICollection<ActivityLog> ActivityLogs { get; set; } = [];
}