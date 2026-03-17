using HotelManagement.Core.Entities;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace HotelManagement.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // ── Cluster 1: System, Auth & HR ────────────────────────────
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<User> Users => Set<User>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // ── Cluster 2: Room Management ───────────────────────────────
    public DbSet<Amenity> Amenities => Set<Amenity>();
    public DbSet<RoomType> RoomTypes => Set<RoomType>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomTypeAmenity> RoomTypeAmenities => Set<RoomTypeAmenity>();
    public DbSet<RoomImage> RoomImages => Set<RoomImage>();
    public DbSet<RoomInventory> RoomInventories => Set<RoomInventory>();

    // ── Cluster 3: Booking & Promotions ─────────────────────────
    public DbSet<Voucher> Vouchers => Set<Voucher>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<BookingDetail> BookingDetails => Set<BookingDetail>();

    // ── Cluster 4: Services & Operations ────────────────────────
    public DbSet<ServiceCategory> ServiceCategories => Set<ServiceCategory>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<OrderService> OrderServices => Set<OrderService>();
    public DbSet<OrderServiceDetail> OrderServiceDetails => Set<OrderServiceDetail>();
    public DbSet<LossAndDamage> LossAndDamages => Set<LossAndDamage>();

    // ── Cluster 5: Billing, Reviews & CMS ───────────────────────
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ArticleCategory> ArticleCategories => Set<ArticleCategory>();
    public DbSet<Article> Articles => Set<Article>();
    public DbSet<Attraction> Attractions => Set<Attraction>();

    // ── Cluster 6 & 7: HR & Loyalty ─────────────────────────────
    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<VoucherUsage> VoucherUsages => Set<VoucherUsage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── 1. Map tên bảng SQL (snake_case / underscore) ────────
        modelBuilder.Entity<AuditLog>().ToTable("Audit_Logs");
        modelBuilder.Entity<RoomType>().ToTable("Room_Types");
        modelBuilder.Entity<RoomTypeAmenity>().ToTable("RoomType_Amenities");
        modelBuilder.Entity<RoomImage>().ToTable("Room_Images");
        modelBuilder.Entity<RoomInventory>().ToTable("Room_Inventory");
        modelBuilder.Entity<RolePermission>().ToTable("Role_Permissions");
        modelBuilder.Entity<BookingDetail>().ToTable("Booking_Details");
        modelBuilder.Entity<ServiceCategory>().ToTable("Service_Categories");
        modelBuilder.Entity<OrderService>().ToTable("Order_Services");
        modelBuilder.Entity<OrderServiceDetail>().ToTable("Order_Service_Details");
        modelBuilder.Entity<LossAndDamage>().ToTable("Loss_And_Damages");
        modelBuilder.Entity<ArticleCategory>().ToTable("Article_Categories");
        modelBuilder.Entity<LoyaltyTransaction>().ToTable("Loyalty_Transactions");
        modelBuilder.Entity<VoucherUsage>().ToTable("Voucher_Usage");

        // ── 2. Composite Primary Keys cho bảng join ──────────────
        modelBuilder.Entity<RolePermission>()
            .HasKey(rp => new { rp.RoleId, rp.PermissionId });

        modelBuilder.Entity<RoomTypeAmenity>()
            .HasKey(rta => new { rta.RoomTypeId, rta.AmenityId });

        // ── 3. Unique Indexes ─────────────────────────────────────
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        modelBuilder.Entity<Voucher>()
            .HasIndex(v => v.Code).IsUnique();

        modelBuilder.Entity<Booking>()
            .HasIndex(b => b.BookingCode).IsUnique();

        modelBuilder.Entity<Article>()
            .HasIndex(a => a.Slug).IsUnique();

        // Filtered unique: NULL slug không bị vi phạm unique
        modelBuilder.Entity<RoomType>()
            .HasIndex(rt => rt.Slug)
            .IsUnique()
            .HasFilter("[slug] IS NOT NULL");

        modelBuilder.Entity<ArticleCategory>()
            .HasIndex(ac => ac.Slug)
            .IsUnique()
            .HasFilter("[slug] IS NOT NULL");

        // Filtered unique: mỗi user chỉ review 1 lần mỗi booking
        modelBuilder.Entity<Review>()
            .HasIndex(r => new { r.UserId, r.BookingId })
            .IsUnique()
            .HasFilter("[booking_id] IS NOT NULL");

        // ── 4. Quan hệ có nhiều FK trỏ về cùng 1 bảng ───────────

        // Shifts: User có 2 FK về Users (UserId và ConfirmedBy)
        modelBuilder.Entity<Shift>()
            .HasOne(s => s.User)
            .WithMany(u => u.Shifts)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Shift>()
            .HasOne(s => s.ConfirmedByUser)
            .WithMany(u => u.ConfirmedShifts)
            .HasForeignKey(s => s.ConfirmedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // LossAndDamage: ReportedBy → Users
        modelBuilder.Entity<LossAndDamage>()
            .HasOne(l => l.Reporter)
            .WithMany(u => u.ReportedDamages)
            .HasForeignKey(l => l.ReportedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // ── 5. Map tên cột snake_case cho toàn bộ entity ─────────
        // EF Core mặc định dùng PascalCase, SQL dùng snake_case
        // Convention này convert tự động: RoomTypeId → room_type_id
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }

            foreach (var key in entity.GetKeys())
            {
                key.SetName(ToSnakeCase(key.GetName()!));
            }

            foreach (var fk in entity.GetForeignKeys())
            {
                fk.SetConstraintName(ToSnakeCase(fk.GetConstraintName()!));
            }

            foreach (var index in entity.GetIndexes())
            {
                index.SetDatabaseName(ToSnakeCase(index.GetDatabaseName()!));
            }
        }
    }

    // Helper: PascalCase / camelCase → snake_case
    private static string ToSnakeCase(string name)
    {
        return Regex.Replace(name, @"([a-z0-9])([A-Z])", "$1_$2").ToLower();
    }
}
