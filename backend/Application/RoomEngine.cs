using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class RoomEngine(RoomAggregator aggregator, VibeToMusicMapper mapper)
{
    public (RoomState State, MusicParams Parameters) AcceptVibe(string clientId, VibeVector vibe)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        aggregator.Ingest(clientId, vibe, now);
        var state = aggregator.GetState(now);
        return (state, mapper.Map(state));
    }

    public (RoomState State, MusicParams Parameters) GetSnapshot()
    {
        var state = aggregator.GetState(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        return (state, mapper.Map(state));
    }
}
