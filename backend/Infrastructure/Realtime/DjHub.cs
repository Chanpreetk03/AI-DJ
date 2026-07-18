using AiDj.Api.Application;
using AiDj.Api.Domain.Models;
using Microsoft.AspNetCore.SignalR;

namespace AiDj.Api.Infrastructure.Realtime;

public sealed class DjHub(RoomEngine roomEngine) : Hub
{
    public async Task Join(string role)
    {
        var normalizedRole = role.ToLowerInvariant() switch
        {
            "output" => "output",
            "booth" => "booth",
            _ => "participant"
        };

        await Groups.AddToGroupAsync(Context.ConnectionId, normalizedRole);
        await Clients.Caller.SendAsync("Joined", new { role = normalizedRole, connectionId = Context.ConnectionId });

        var snapshot = roomEngine.GetSnapshot();
        await Clients.Caller.SendAsync("MusicParamsUpdated", snapshot.Parameters);
        await Clients.Caller.SendAsync("RoomStateUpdated", snapshot.State);
    }

    public async Task SendVibe(VibeVector vibe)
    {
        var snapshot = roomEngine.AcceptVibe(Context.ConnectionId, vibe);
        await Clients.Group("output").SendAsync("MusicParamsUpdated", snapshot.Parameters);
        await Clients.Group("output").SendAsync("VibeVectorUpdated", snapshot.Vibe);
        await Clients.All.SendAsync("RoomStateUpdated", snapshot.State);
    }
}
