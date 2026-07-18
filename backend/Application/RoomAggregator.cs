using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class RoomAggregator
{
    private const long StaleAfterMilliseconds = 2_000;
    private readonly Dictionary<string, ClientVibe> clients = new();
    private readonly object sync = new();
    private double previousEnergy;
    private long previousStateAt;

    public void Ingest(string clientId, VibeVector vibe, long nowMilliseconds)
    {
        var normalized = vibe with
        {
            Motion = Clamp(vibe.Motion),
            MotionVariance = Clamp(vibe.MotionVariance),
            AudioRms = Clamp(vibe.AudioRms),
            OnsetRate = Math.Max(0, vibe.OnsetRate)
        };

        lock (sync)
        {
            clients[clientId] = new ClientVibe(normalized, nowMilliseconds);
        }
    }

    public void Remove(string clientId)
    {
        lock (sync)
        {
            clients.Remove(clientId);
        }
    }

    public RoomState GetState(long nowMilliseconds)
    {
        lock (sync)
        {
            var active = clients.Values
                .Where(client => nowMilliseconds - client.LastSeenMilliseconds <= StaleAfterMilliseconds)
                .Select(client => client.Vibe)
                .ToArray();

            if (active.Length == 0)
            {
                var emptyState = CreateState(0, 1, 0, 0, 0, 0, nowMilliseconds);
                previousEnergy = 0;
                previousStateAt = nowMilliseconds;
                return emptyState;
            }

            var motionEnergy = active.Average(vibe => BoostLowSignal(vibe.Motion));
            var audioEnergy = active.Average(vibe => BoostLowSignal(vibe.AudioRms));
            var onsetDensity = active.Average(vibe => Math.Clamp(vibe.OnsetRate / 4, 0, 1));
            var energies = active.Select(vibe =>
                (BoostLowSignal(vibe.Motion) * 0.40) +
                (BoostLowSignal(vibe.MotionVariance) * 0.20) +
                (BoostLowSignal(vibe.AudioRms) * 0.25) +
                (Math.Clamp(vibe.OnsetRate / 4, 0, 1) * 0.15)).ToArray();
            var averageEnergy = energies.Average();
            var average = active.Average(vibe => vibe.Motion);
            var variance = active.Average(vibe => Math.Pow(vibe.Motion - average, 2));
            var coherence = 1 - Math.Min(Math.Sqrt(variance) * 2, 1);
            var volatility = CalculateVolatility(energies);
            var trend = CalculateTrend(averageEnergy, nowMilliseconds);
            var confidence = 0.55 + (0.45 * Math.Min(active.Length / 3d, 1));

            return CreateState(
                averageEnergy,
                coherence,
                active.Length,
                motionEnergy,
                audioEnergy,
                onsetDensity,
                trend,
                volatility,
                confidence);
        }
    }

    private RoomState CreateState(
        double energy,
        double coherence,
        int activeClients,
        double motionEnergy,
        double audioEnergy,
        double onsetDensity,
        long nowMilliseconds)
    {
        return CreateState(energy, coherence, activeClients, motionEnergy, audioEnergy, onsetDensity, 0, 0, 0);
    }

    private RoomState CreateState(
        double energy,
        double coherence,
        int activeClients,
        double motionEnergy,
        double audioEnergy,
        double onsetDensity,
        double trend,
        double volatility,
        double confidence)
    {
        return new RoomState(
            Math.Round(energy, 3),
            Math.Round(coherence, 3),
            activeClients,
            Math.Round(motionEnergy, 3),
            Math.Round(audioEnergy, 3),
            Math.Round(onsetDensity, 3),
            Math.Round(trend, 3),
            Math.Round(volatility, 3),
            Math.Round(confidence, 3));
    }

    private double CalculateTrend(double energy, long nowMilliseconds)
    {
        if (previousStateAt == 0)
        {
            previousEnergy = energy;
            previousStateAt = nowMilliseconds;
            return 0;
        }

        var elapsedSeconds = Math.Max((nowMilliseconds - previousStateAt) / 1_000d, 0.25);
        var trend = Math.Clamp((energy - previousEnergy) / elapsedSeconds, -1, 1);
        previousEnergy = energy;
        previousStateAt = nowMilliseconds;
        return trend;
    }

    private static double CalculateVolatility(IReadOnlyCollection<double> energies)
    {
        if (energies.Count < 2)
        {
            return 0;
        }

        var average = energies.Average();
        return Math.Clamp(Math.Sqrt(energies.Average(energy => Math.Pow(energy - average, 2))) * 3, 0, 1);
    }

    private static double Clamp(double value) => Math.Clamp(value, 0, 1);

    private static double BoostLowSignal(double value) => Math.Sqrt(Clamp(value));

    private sealed record ClientVibe(VibeVector Vibe, long LastSeenMilliseconds);
}
