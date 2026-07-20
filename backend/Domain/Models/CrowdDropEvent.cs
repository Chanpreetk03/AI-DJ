namespace AiDj.Api.Domain.Models;

public sealed record CrowdDropEvent(
    string Id,
    string Source,
    int Contributors,
    double Energy,
    double Coherence,
    long CountdownEndsAtMilliseconds,
    int CountdownDurationMilliseconds);

public sealed record CrowdDropStartedEvent(
    string Id,
    string Source,
    int Contributors,
    double Energy,
    double Coherence,
    long StartsAtMilliseconds);
