using AiDj.Api.Application;
using AiDj.Api.Domain.Models;
using Microsoft.AspNetCore.SignalR;

namespace AiDj.Api.Infrastructure.Realtime;

public sealed class DjHub(RoomEngine roomEngine) : Hub
{
    public async Task Join(string role)
    {
        var normalizedRole = NormalizeRole(role);

        await Groups.AddToGroupAsync(Context.ConnectionId, normalizedRole);
        roomEngine.RegisterConnection(Context.ConnectionId, normalizedRole);
        await Clients.Caller.SendAsync("Joined", new { role = normalizedRole, connectionId = Context.ConnectionId });

        var snapshot = roomEngine.GetSnapshot();
        await Clients.Caller.SendAsync("MusicParamsUpdated", snapshot.Parameters);
        await Clients.Caller.SendAsync("RoomStateUpdated", snapshot.State);
        await Clients.All.SendAsync("StatusUpdated", roomEngine.GetStatus());
    }

    public async Task SendVibe(VibeVector vibe)
    {
        var snapshot = roomEngine.AcceptVibe(Context.ConnectionId, vibe);
        await Clients.Group("output").SendAsync("MusicParamsUpdated", snapshot.Parameters);
        await Clients.All.SendAsync("RoomStateUpdated", snapshot.State);
        await Clients.All.SendAsync("StatusUpdated", roomEngine.GetStatus());
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        roomEngine.RemoveConnection(Context.ConnectionId);
        await Clients.All.SendAsync("StatusUpdated", roomEngine.GetStatus());
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
}
