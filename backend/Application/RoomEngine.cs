using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class RoomEngine(RoomAggregator aggregator, VibeToMusicMapper mapper)
{
    private readonly CrowdDropController crowdDrop = new();
    private readonly object sync = new();
    private readonly Dictionary<string, string> connectionRoles = new();
    private VibeVector? latestVibe;
    private string? latestClientId;
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

        lock (sync)
        {
            if (latestClientId == connectionId)
            {
                latestVibe = null;
                latestClientId = null;
                latestSource = null;
                latestVibeAt = 0;
            }
        }
    }

    public string? GetConnectionRole(string connectionId)
    {
        lock (sync)
        {
            return connectionRoles.GetValueOrDefault(connectionId);
        }
    }

    public bool CanSendVibe(string connectionId)
    {
        lock (sync)
        {
            return connectionRoles.TryGetValue(connectionId, out var role) &&
                role is "participant" or "booth" or "synthetic";
        }
    }

    public (VibeVector Vibe, RoomState State, MusicParams Parameters, CrowdDropEvent? CrowdDrop) AcceptVibe(string clientId, VibeVector vibe)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        aggregator.Ingest(clientId, vibe, now);
        var state = aggregator.GetState(now);
        lock (sync)
        {
            latestVibe = vibe;
            latestClientId = clientId;
            latestSource = connectionRoles.GetValueOrDefault(clientId, "unknown");
            latestVibeAt = now;
        }
        lock (sync)
        {
            return (vibe, state, mapper.Map(state), crowdDrop.Observe(state, now));
        }
    }

    public CrowdDropEvent? TryTriggerManualCrowdDrop()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var state = aggregator.GetState(now);
        lock (sync)
        {
            return crowdDrop.TryManualTrigger(state, now);
        }
    }

    public CrowdDropStartedEvent? TryStartCrowdDrop(string dropId)
    {
        lock (sync)
        {
            return crowdDrop.TryStart(dropId, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }
    }

    public CrowdDropEvent? GetReplayableCrowdDrop()
    {
        lock (sync)
        {
            return crowdDrop.GetReplayableActiveDrop(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }
    }

    public long CrowdDropCooldownRemainingMilliseconds()
    {
        lock (sync)
        {
            return crowdDrop.RemainingCooldownMilliseconds(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }
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
