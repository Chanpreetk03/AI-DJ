using AiDj.Api.Application;
using AiDj.Api.Domain.Models;
using Microsoft.AspNetCore.SignalR;

namespace AiDj.Api.Infrastructure.Realtime;

public sealed class DjHub(RoomRegistry rooms, RoomAccessService access) : Hub
{
    public async Task Join(string role, string roomId = "demo", string? hostToken = null)
    {
        var normalizedRole = NormalizeRole(role);
        var normalizedRoomId = RoomRegistry.NormalizeRoomId(roomId);
        if (HostRoles.Contains(normalizedRole) && !access.CanControlRoom(normalizedRoomId, hostToken))
        {
            throw new HubException("A valid host token is required for this room role.");
        }
        if (rooms.TryGetMembership(Context.ConnectionId, out var previousMembership))
        {
            rooms.Leave(Context.ConnectionId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoleGroup(previousMembership.RoomId, previousMembership.Role));
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(previousMembership.RoomId));
        }
        RoomMembership membership;
        try
        {
            membership = rooms.Join(Context.ConnectionId, normalizedRoomId, normalizedRole);
        }
        catch (KeyNotFoundException)
        {
            throw new HubException("This room has ended or no longer exists. Ask the host for a new invite.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(membership.RoomId));
        await Groups.AddToGroupAsync(Context.ConnectionId, RoleGroup(membership.RoomId, normalizedRole));
        await Clients.Caller.SendAsync("Joined", new { role = normalizedRole, roomId = membership.RoomId, connectionId = Context.ConnectionId });

        var snapshot = membership.Room.GetSnapshot();
        await Clients.Caller.SendAsync("MusicParamsUpdated", snapshot.Parameters);
        await Clients.Caller.SendAsync("RoomStateUpdated", snapshot.State);
        var activeDrop = membership.Room.GetReplayableCrowdDrop();
        if (activeDrop is not null)
        {
            await Clients.Caller.SendAsync("CrowdDropArmed", activeDrop);
        }
        await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("StatusUpdated", membership.Room.GetStatus());
    }

    public async Task SendVibe(VibeVector vibe)
    {
        if (!rooms.TryGetMembership(Context.ConnectionId, out var membership) || !membership.Room.CanSendVibe(Context.ConnectionId))
        {
            throw new HubException("Join as a participant, booth, or synthetic source before sending vibes.");
        }

        var snapshot = membership.Room.AcceptVibe(Context.ConnectionId, vibe);
        await Clients.Group(RoleGroup(membership.RoomId, "output")).SendAsync("MusicParamsUpdated", snapshot.Parameters);
        await Clients.Group(RoleGroup(membership.RoomId, "output")).SendAsync("VibeVectorUpdated", snapshot.Vibe);
        await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("RoomStateUpdated", snapshot.State);
        await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("StatusUpdated", membership.Room.GetStatus());
        if (snapshot.CrowdDrop is not null)
        {
            await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("CrowdDropArmed", snapshot.CrowdDrop);
        }
    }

    public async Task<object> TriggerCrowdDrop()
    {
        if (!rooms.TryGetMembership(Context.ConnectionId, out var membership) || membership.Role != "booth")
        {
            throw new HubException("Only the Booth controller can manually trigger a Crowd Drop.");
        }

        var drop = membership.Room.TryTriggerManualCrowdDrop();
        if (drop is null)
        {
            return new { accepted = false, cooldownRemainingMilliseconds = membership.Room.CrowdDropCooldownRemainingMilliseconds() };
        }

        await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("CrowdDropArmed", drop);
        return new { accepted = true, cooldownRemainingMilliseconds = 45_000 };
    }

    public async Task ConfirmCrowdDropStarted(string dropId)
    {
        if (!rooms.TryGetMembership(Context.ConnectionId, out var membership) || membership.Role != "output")
        {
            throw new HubException("Only the active output can confirm a Crowd Drop start.");
        }

        var started = membership.Room.TryStartCrowdDrop(dropId);
        if (started is not null)
        {
            await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("CrowdDropStarted", started);
        }
    }

    public async Task Leave()
    {
        var membership = rooms.Leave(Context.ConnectionId);
        if (membership is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoleGroup(membership.RoomId, membership.Role));
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(membership.RoomId));
        }
        await Clients.Caller.SendAsync("Left", new { connectionId = Context.ConnectionId });
        if (membership is not null)
        {
            await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("RoomStateUpdated", membership.Room.GetSnapshot().State);
            await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("StatusUpdated", membership.Room.GetStatus());
        }
    }

    public async Task EndRoom()
    {
        if (!rooms.TryGetMembership(Context.ConnectionId, out var membership) || membership.Role != "output")
        {
            throw new HubException("Only the active output console can end this room.");
        }

        if (!rooms.TryEndRoom(membership.RoomId))
        {
            return;
        }

        await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("RoomClosed", new { roomId = membership.RoomId });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var membership = rooms.Leave(Context.ConnectionId);
        if (membership is not null)
        {
            await Clients.Group(RoomGroup(membership.RoomId)).SendAsync("StatusUpdated", membership.Room.GetStatus());
        }
        await base.OnDisconnectedAsync(exception);
    }

    private static string NormalizeRole(string role) => role.ToLowerInvariant() switch
    {
        "output" => "output",
        "booth" => "booth",
        "synthetic" => "synthetic",
        "status" => "status",
        _ => "participant"
    };

    private static string RoomGroup(string roomId) => $"room:{roomId}";

    private static string RoleGroup(string roomId, string role) => $"room:{roomId}:role:{role}";

    private static readonly HashSet<string> HostRoles = ["output", "booth", "synthetic", "status"];
}
