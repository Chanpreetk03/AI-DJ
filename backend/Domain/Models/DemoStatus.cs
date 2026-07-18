namespace AiDj.Api.Domain.Models;

public sealed record DemoStatus(
    RoomState RoomState,
    MusicParams MusicParams,
    int ConnectedClients,
    int ParticipantClients,
    bool OutputConnected,
    string? LatestSource,
    VibeVector? LatestVibe,
    long? LatestVibeAgeMilliseconds);
