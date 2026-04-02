using System.Text;
using HotelManagement.API.Hubs;           // ← THÊM MỚI
using HotelManagement.API.Middleware;
using HotelManagement.API.Services;       // ← THÊM MỚI
using HotelManagement.Core.Authorization;
using HotelManagement.Core.Helpers;
using HotelManagement.Infrastructure.Data;
using HotelManagement.Core.DTOs;
using FluentValidation;
using FluentValidation.AspNetCore;
using Mapster;
using MapsterMapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ── CORS ───────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:3000",
                "http://127.0.0.1:5500",
                "null"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();   // ← BẮT BUỘC cho SignalR
    });
});

// ── Redis ──────────────────────────────────────────────────
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
    return ConnectionMultiplexer.Connect(configuration);
});

// ── 1. Database ──────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── 2. JWT Authentication ────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew                = TimeSpan.Zero
        };

        options.Events = new JwtBearerEvents
        {
            // ── THÊM MỚI: SignalR WebSocket không gửi được header
            // → đọc token từ query string ?access_token=...
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/notificationHub"))
                {
                    ctx.Token = accessToken;
                }
                return Task.CompletedTask;
            },

            OnChallenge = ctx =>
            {
                ctx.HandleResponse();
                ctx.Response.StatusCode  = 401;
                ctx.Response.ContentType = "application/json";
                return ctx.Response.WriteAsync(
                    "{\"error\":\"Unauthorized\",\"message\":\"Token không hợp lệ hoặc đã hết hạn.\"}");
            },
            OnForbidden = ctx =>
            {
                ctx.Response.StatusCode  = 403;
                ctx.Response.ContentType = "application/json";
                return ctx.Response.WriteAsync(
                    "{\"error\":\"Forbidden\",\"message\":\"Bạn không có quyền thực hiện hành động này.\"}");
            }
        };
    });

// ── 3. RBAC ──────────────────────────────────────────────────────
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization();

// ── 4. Helpers & Services ────────────────────────────────────────
builder.Services.AddScoped<JwtHelper>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IActivityLogService, ActivityLogService>();
builder.Services.AddScoped<IAuditTrailService, AuditTrailService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IBookingStatusFlowService, BookingStatusFlowService>();
builder.Services.AddScoped<IVoucherValidationService, VoucherValidationService>();
// ── 4.5 Cloudinary ──────────────────────────────────────────────────
var cloudCfg     = builder.Configuration.GetSection("Cloudinary");
var cloudAccount = new CloudinaryDotNet.Account(
    cloudCfg["CloudName"],
    cloudCfg["ApiKey"],
    cloudCfg["ApiSecret"]
);
builder.Services.AddSingleton(new CloudinaryDotNet.Cloudinary(cloudAccount));

// ── 5. Mapster ───────────────────────────────────────────────────
builder.Services.AddMapster();
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// ── 6. Controllers ───────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(x => x.Value?.Errors.Count > 0)
            .SelectMany(x => x.Value!.Errors.Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage) ? "Dữ liệu không hợp lệ." : e.ErrorMessage))
            .ToList();

        var payload = new ApiErrorResponse
        {
            Success = false,
            Message = "Dữ liệu đầu vào không hợp lệ.",
            Errors = errors,
            TraceId = context.HttpContext.TraceIdentifier
        };

        return new BadRequestObjectResult(payload);
    };
});

// ── 7. SignalR ───────────────────────────────────────────────────
builder.Services.AddSignalR();  // ← THÊM MỚI

// ── 8. Swagger với Bearer token ──────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Hotel Management API",
        Version = "v1"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Nhập JWT token. Ví dụ: eyJhbGci..."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ── Build ────────────────────────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/notificationHub"); // ← THÊM MỚI

app.Run();
