namespace AiDj.Api.Domain.Models;

public sealed record RoomState(
    double Energy,
    double Coherence,
    int ActiveClients);
