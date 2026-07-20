using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

/// <summary>Owns Crowd Drop eligibility, cooldown, and re-arm rules for one room.</summary>
public sealed class CrowdDropController
{
    private const double EnergyThreshold = 0.75;
    private const double CoherenceThreshold = 0.70;
    private const int MinimumContributors = 3;
    private const long SustainedForMilliseconds = 4_000;
    private const long CooldownMilliseconds = 45_000;
    private const long CountdownMilliseconds = 3_000;

    private long? qualifyingSince;
    private long? lastTriggeredAt;
    private bool isArmed = true;
    private CrowdDropEvent? activeDrop;

    public CrowdDropEvent? ActiveDrop => activeDrop;

    public CrowdDropEvent? Observe(RoomState state, long nowMilliseconds)
    {
        if (!Qualifies(state))
        {
            qualifyingSince = null;
            isArmed = true;
            return null;
        }

        qualifyingSince ??= nowMilliseconds;
        if (!isArmed || nowMilliseconds - qualifyingSince < SustainedForMilliseconds || IsCoolingDown(nowMilliseconds))
        {
            return null;
        }

        return Trigger("automatic", state, nowMilliseconds);
    }

    public CrowdDropEvent? TryManualTrigger(RoomState state, long nowMilliseconds)
    {
        return IsCoolingDown(nowMilliseconds) ? null : Trigger("manual", state, nowMilliseconds);
    }

    public CrowdDropStartedEvent? TryStart(string id, long startsAtMilliseconds)
    {
        if (activeDrop is null || activeDrop.Id != id)
        {
            return null;
        }

        var started = new CrowdDropStartedEvent(
            activeDrop.Id,
            activeDrop.Source,
            activeDrop.Contributors,
            activeDrop.Energy,
            activeDrop.Coherence,
            startsAtMilliseconds);
        activeDrop = null;
        return started;
    }

    public long RemainingCooldownMilliseconds(long nowMilliseconds) => lastTriggeredAt is null
        ? 0
        : Math.Max(0, CooldownMilliseconds - (nowMilliseconds - lastTriggeredAt.Value));

    private CrowdDropEvent Trigger(string source, RoomState state, long nowMilliseconds)
    {
        isArmed = false;
        qualifyingSince = null;
        lastTriggeredAt = nowMilliseconds;
        activeDrop = new CrowdDropEvent(
            Guid.NewGuid().ToString("N"),
            source,
            state.ActiveClients,
            state.Energy,
            state.Coherence,
            nowMilliseconds + CountdownMilliseconds,
            (int)CountdownMilliseconds);
        return activeDrop;
    }

    private bool IsCoolingDown(long nowMilliseconds) => RemainingCooldownMilliseconds(nowMilliseconds) > 0;

    private static bool Qualifies(RoomState state) => state.Energy >= EnergyThreshold &&
        state.Coherence >= CoherenceThreshold &&
        state.ActiveClients >= MinimumContributors;
}
