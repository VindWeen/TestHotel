using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System.Net;

namespace HotelManagement.API.Services;

public interface IEmailService
{
    Task SendBookingConfirmationAsync(string toEmail, string guestName, string bookingCode, DateTime checkIn, DateTime checkOut, decimal totalAmount);
    Task SendNewStaffAccountAsync(string toEmail, string fullName, string password, string roleName);
    Task SendGuestWelcomeAsync(string toEmail, string fullName);
    Task SendGuestAccountCreatedAsync(string toEmail, string fullName, string password);
    Task SendPasswordChangedAsync(string toEmail, string fullName);
    Task SendForgotPasswordResetAsync(string toEmail, string fullName, string newPassword);
    Task SendPasswordResetByAdminAsync(string toEmail, string fullName, string newPassword);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public Task SendBookingConfirmationAsync(string toEmail, string guestName, string bookingCode, DateTime checkIn, DateTime checkOut, decimal totalAmount)
    {
        var subject = $"[Hotel] Xác nhận đặt phòng #{bookingCode}";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">✅ Đặt phòng thành công!</h2>
                <p>Xin chào <strong>{WebUtility.HtmlEncode(guestName)}</strong>,</p>
                <p>Đặt phòng của bạn đã được xác nhận. Dưới đây là thông tin chi tiết:</p>

                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: #f9f8f3;">
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Mã đặt phòng</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">{WebUtility.HtmlEncode(bookingCode)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Check-in</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">{checkIn:dd/MM/yyyy}</td>
                    </tr>
                    <tr style="background: #f9f8f3;">
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Check-out</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">{checkOut:dd/MM/yyyy}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Tổng tiền dự kiến</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; color: #4f645b; font-weight: 700;">{totalAmount:N0} VNĐ</td>
                    </tr>
                </table>

                <p style="color: #6b7280; font-size: 13px;">Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ chúng tôi.</p>
                <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, guestName, subject, body);
    }

    public Task SendNewStaffAccountAsync(string toEmail, string fullName, string password, string roleName)
    {
        var subject = "[Hotel] Tài khoản nhân viên của bạn đã được tạo";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">👋 Chào mừng bạn đến với đội ngũ!</h2>
                <p>Xin chào <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
                <p>Tài khoản nhân viên của bạn đã được tạo thành công. Dưới đây là thông tin đăng nhập:</p>

                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: #f9f8f3;">
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Email đăng nhập</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">{WebUtility.HtmlEncode(toEmail)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Mật khẩu tạm thời</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 700; color: #dc2626;">{WebUtility.HtmlEncode(password)}</td>
                    </tr>
                    <tr style="background: #f9f8f3;">
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Vai trò</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">{WebUtility.HtmlEncode(roleName)}</td>
                    </tr>
                </table>

                <p style="color: #dc2626; font-size: 13px;">⚠️ Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu.</p>
                <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, fullName, subject, body);
    }

    public Task SendGuestWelcomeAsync(string toEmail, string fullName)
    {
        var subject = "[Hotel] Chào mừng bạn đến với hệ thống khách sạn";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">Xin chào {WebUtility.HtmlEncode(fullName)}!</h2>
                <p>Tài khoản khách hàng của bạn đã được tạo thành công.</p>
                <p>Bạn có thể đăng nhập để theo dõi lịch sử đặt phòng, hạng thành viên và các ưu đãi hiện có.</p>
                <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, fullName, subject, body);
    }

    public Task SendGuestAccountCreatedAsync(string toEmail, string fullName, string password)
    {
        var subject = "[Hotel] Tài khoản thành viên của bạn đã được tạo";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">Tài khoản của bạn đã sẵn sàng</h2>
                <p>Xin chào <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
                <p>Tài khoản thành viên đã được tạo cho bạn sau khi làm thủ tục check-in. Bạn có thể đăng nhập bằng email này và mật khẩu tạm thời bên dưới:</p>

                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: #f9f8f3;">
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Email đăng nhập</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">{WebUtility.HtmlEncode(toEmail)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Mật khẩu tạm thời</td>
                        <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 700; color: #15803d;">{WebUtility.HtmlEncode(password)}</td>
                    </tr>
                </table>

                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="margin: 0; color: #92400e;">Vui lòng đăng nhập và đổi mật khẩu sau khi vào hệ thống.</p>
                </div>

                <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, fullName, subject, body);
    }

    public Task SendPasswordChangedAsync(string toEmail, string fullName)
    {
        var subject = "[Hotel] Mật khẩu của bạn vừa được thay đổi";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">🔐 Mật khẩu đã được thay đổi</h2>
                <p>Xin chào <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
                <p>Mật khẩu tài khoản của bạn vừa được thay đổi thành công vào lúc <strong>{DateTime.Now:HH:mm dd/MM/yyyy}</strong>.</p>

                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="margin: 0; color: #92400e;">⚠️ Nếu bạn <strong>không thực hiện</strong> thay đổi này, vui lòng liên hệ quản trị viên ngay lập tức.</p>
                </div>

                <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, fullName, subject, body);
    }

    public Task SendForgotPasswordResetAsync(string toEmail, string fullName, string newPassword)
    {
        var subject = "[Hotel] Mat khau moi cho tai khoan cua ban";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">Mat khau moi cua ban da san sang</h2>
                <p>Xin chao <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
                <p>He thong da xu ly yeu cau quen mat khau cua ban. Day la mat khau moi de ban dang nhap:</p>

                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                    <span style="font-size: 24px; font-weight: 700; letter-spacing: 0.1em; color: #15803d; font-family: monospace; padding: 4px 8px; background: #dcfce7; border-radius: 4px; user-select: all; cursor: copy;">{WebUtility.HtmlEncode(newPassword)}</span>
                </div>

                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="margin: 0; color: #92400e;">Vui long dang nhap bang mat khau moi va doi lai mat khau sau khi vao he thong.</p>
                </div>

                <p style="color: #6b7280; font-size: 13px;">Neu ban khong thuc hien yeu cau nay, vui long lien he bo phan ho tro som nhat co the.</p>
                <p style="color: #6b7280; font-size: 13px;">Tran trong,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, fullName, subject, body);
    }

    public Task SendPasswordResetByAdminAsync(string toEmail, string fullName, string newPassword)
    {
        var subject = "[Hotel] Mật khẩu của bạn đã được thiết lập lại";
        var body = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #4f645b;">&#128274; Mật khẩu đã được thiết lập lại</h2>
                <p>Xin chào <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
                <p>Quản trị viên đã thiết lập lại mật khẩu tài khoản của bạn. Dưới đây là mật khẩu mới:</p>

                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                    <span style="font-size: 24px; font-weight: 700; letter-spacing: 0.1em; color: #15803d; font-family: monospace; padding: 4px 8px; background: #dcfce7; border-radius: 4px; user-select: all; cursor: copy;">{WebUtility.HtmlEncode(newPassword)}</span>
                </div>

                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="margin: 0; color: #92400e;">&#9888;&#65039; Vui lòng đăng nhập và <strong>đổi mật khẩu ngay</strong> sau khi nhận được email này.</p>
                </div>

                <p style="color: #6b7280; font-size: 13px;">Nếu bạn không yêu cầu điều này, vui lòng liên hệ quản trị viên ngay lập tức.</p>
                <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/><strong>Hotel Management Team</strong></p>
            </div>
            """;

        return SendAsync(toEmail, fullName, subject, body);
    }

    private async Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        var smtpHost = _config["Email:SmtpHost"]!;
        var smtpPort = int.Parse(_config["Email:SmtpPort"]!);
        var senderEmail = _config["Email:SenderEmail"]!;
        var senderName = _config["Email:SenderName"]!;
        var password = _config["Email:Password"]!;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(senderName, senderEmail));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        await client.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(senderEmail, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
