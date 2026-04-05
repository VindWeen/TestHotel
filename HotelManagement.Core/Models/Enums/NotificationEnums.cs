namespace HotelManagement.Core.Models.Enums
{
    public class Notification
    {
        public string? Title { get; set; }
        public string? Message { get; set; }
        public NotificationType Type { get; set; }
        public NotificationAction Action { get; set; }
    }
    public enum NotificationType
    {
        Success,
        Error,
        Warning,
        Info
    }
    public enum NotificationAction
    {
        CreateAccount,
        UpdateAccount,
        ResetPassword,
        LockAccount,
        LoginAccount,
        UnlockAccount,
        DeleteAccount,
        CreateAmenity,
        UpdateAmenity,
        EnableAmenity,
        DisableAmenity,
        CreateRoom,
        UpdateRoom,
        DeleteRoom,
        CreateBooking,
        UpdateBooking,
        CancelBooking,
        CheckIn,
        CheckOut,
        CreateCategory,
        UpdateCategory,
        DeleteCategory,
        EnableCategory,
        DisableCategory,
        CreateArticle,
        UpdateArticle,
        DeleteArticle,
        CreateAttraction,
        UpdateAttraction,
        DeleteAttraction,
        EnableAttraction,
        DisableAttraction,
        Other,
        CreateUser,
        UpdateUser,
        ViewUsers,
        UpdateProfile,
        CreateProfile,
        CreateLossReport,
        UpdateLossReport,
        DeleteLossReport,
    }
}
