using System.Collections.Concurrent;
using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class RoomRegistry(VibeToMusicMapper mapper)
{
    private readonly ConcurrentDictionary<string, RoomEngine> rooms = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, RoomMembership> memberships = new(StringComparer.Ordinal);

    public bool TryCreateRoom(string roomId)
    {
        var normalizedRoomId = NormalizeRoomId(roomId);
        return rooms.TryAdd(normalizedRoomId, new RoomEngine(new RoomAggregator(), mapper));
    }

    public RoomMembership Join(string connectionId, string roomId, string role)
    {
        Leave(connectionId);
        var normalizedRoomId = NormalizeRoomId(roomId);
        if (!rooms.TryGetValue(normalizedRoomId, out var room))
        {
            throw new KeyNotFoundException($"Room '{normalizedRoomId}' does not exist.");
        }
        room.RegisterConnection(connectionId, role);
        var membership = new RoomMembership(normalizedRoomId, role, room);
        memberships[connectionId] = membership;
        return membership;
    }

    public bool TryGetMembership(string connectionId, out RoomMembership membership) =>
        memberships.TryGetValue(connectionId, out membership!);

    public RoomMembership? Leave(string connectionId)
    {
        if (!memberships.TryRemove(connectionId, out var membership))
        {
            return null;
        }

        membership.Room.RemoveConnection(connectionId);
        return membership;
    }

    public bool TryGetStatus(string roomId, out DemoStatus? status)
    {
        if (rooms.TryGetValue(NormalizeRoomId(roomId), out var room))
        {
            status = room.GetStatus();
            return true;
        }

        status = null;
        return false;
    }

    public bool Exists(string roomId) => rooms.ContainsKey(NormalizeRoomId(roomId));

    public static string NormalizeRoomId(string? roomId)
    {
        var normalized = string.IsNullOrWhiteSpace(roomId) ? "demo" : roomId.Trim().ToLowerInvariant();
        if (normalized.Length is < 3 or > 64 || normalized.Any(character => !char.IsLetterOrDigit(character) && character is not '-' and not '_'))
        {
            throw new ArgumentException("Room IDs must contain 3-64 letters, numbers, hyphens, or underscores.", nameof(roomId));
        }

        return normalized;
    }
}

public sealed record RoomMembership(string RoomId, string Role, RoomEngine Room);
