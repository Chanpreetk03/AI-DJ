using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class RoomEngine(RoomAggregator aggregator, VibeToMusicMapper mapper)
{
    private readonly object sync = new();
    private readonly Dictionary<string, string> connectionRoles = new();
    private VibeVector? latestVibe;
    private string? latestSource;
    private long latestVibeAt;

    public void RegisterConnection(string connectionId, string role)
    {
        lock (sync)
        {
            connectionRoles[connectionId] = role;
        }
    }

    public void RemoveConnection(string connectionId)
    {
        lock (sync)
        {
            connectionRoles.Remove(connectionId);
        }

        aggregator.Remove(connectionId);
    }

    public (VibeVector Vibe, RoomState State, MusicParams Parameters) AcceptVibe(string clientId, VibeVector vibe)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        aggregator.Ingest(clientId, vibe, now);
        var state = aggregator.GetState(now);
        lock (sync)
        {
            latestVibe = vibe;
            latestSource = connectionRoles.GetValueOrDefault(clientId, "unknown");
            latestVibeAt = now;
        }
        return (vibe, state, mapper.Map(state));
    }

    public (RoomState State, MusicParams Parameters) GetSnapshot()
    {
        var state = aggregator.GetState(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        return (state, mapper.Map(state));
    }

    public DemoStatus GetStatus()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var snapshot = GetSnapshot();
        lock (sync)
        {
            return new DemoStatus(
                snapshot.State,
                snapshot.Parameters,
                connectionRoles.Count,
                connectionRoles.Count(role => role.Value is "participant" or "booth" or "synthetic"),
                connectionRoles.Values.Any(role => role == "output"),
                latestSource,
                latestVibe,
                latestVibe is null ? null : now - latestVibeAt);
        }
    }
}
