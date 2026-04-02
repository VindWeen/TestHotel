using System.Security.Cryptography;

namespace HotelManagement.Core.Helpers;

public static class PasswordGenerator
{
    public static string GenerateRandomPassword(int length)
    {
        if (length < 4)
            throw new ArgumentOutOfRangeException(nameof(length), "Password length must be at least 4.");

        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghjkmnpqrstuvwxyz";
        const string digits = "23456789";
        const string special = "@#$%*!?";
        const string all = upper + lower + digits + special;

        var bytes = RandomNumberGenerator.GetBytes(length);
        var chars = new char[length];

        chars[0] = upper[bytes[0] % upper.Length];
        chars[1] = lower[bytes[1] % lower.Length];
        chars[2] = digits[bytes[2] % digits.Length];
        chars[3] = special[bytes[3] % special.Length];
        for (var i = 4; i < length; i++)
            chars[i] = all[bytes[i] % all.Length];

        for (var i = 0; i < length; i++)
        {
            var j = RandomNumberGenerator.GetInt32(length);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars);
    }
}
