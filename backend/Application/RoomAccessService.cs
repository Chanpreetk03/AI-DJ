using System.Security.Cryptography;
using System.Text;

namespace AiDj.Api.Application;

public sealed class RoomAccessService(string signingSecret, bool allowUnauthenticatedHosts)
{
    private readonly byte[] signingKey = Encoding.UTF8.GetBytes(signingSecret);

    public string CreateHostToken(string roomId)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddHours(12).ToUnixTimeSeconds();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(12));
        var payload = $"{roomId}:{expiresAt}:{nonce}";
        var signature = Sign(payload);
        return $"{Encode(payload)}.{Encode(signature)}";
    }

    public bool CanControlRoom(string roomId, string? token)
    {
        if (allowUnauthenticatedHosts)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        var pieces = token.Split('.', 2);
        if (pieces.Length != 2)
        {
            return false;
        }

        try
        {
            var payload = Encoding.UTF8.GetString(Decode(pieces[0]));
            var suppliedSignature = Decode(pieces[1]);
            var expectedSignature = Sign(payload);
            if (!CryptographicOperations.FixedTimeEquals(suppliedSignature, expectedSignature))
            {
                return false;
            }

            var values = payload.Split(':', 3);
            return values.Length == 3 && values[0] == roomId &&
                long.TryParse(values[1], out var expiresAt) &&
                DateTimeOffset.UtcNow.ToUnixTimeSeconds() <= expiresAt;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private byte[] Sign(string payload) => HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(payload));

    private static string Encode(string value) => Encode(Encoding.UTF8.GetBytes(value));

    private static string Encode(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Decode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
