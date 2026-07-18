using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class RoomAggregator
{
    private const long StaleAfterMilliseconds = 2_000;
    private readonly Dictionary<string, ClientVibe> clients = new();
    private readonly object sync = new();

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
                return new RoomState(0, 1, 0);
            }

            var energies = active.Select(vibe =>
                (vibe.Motion * 0.45) +
                (vibe.AudioRms * 0.35) +
                (Math.Min(vibe.OnsetRate / 8, 1) * 0.20)).ToArray();
            var averageEnergy = energies.Average();
            var average = active.Average(vibe => vibe.Motion);
            var variance = active.Average(vibe => Math.Pow(vibe.Motion - average, 2));
            var coherence = 1 - Math.Min(Math.Sqrt(variance) * 2, 1);

            return new RoomState(Math.Round(averageEnergy, 3), Math.Round(coherence, 3), active.Length);
        }
    }

    private static double Clamp(double value) => Math.Clamp(value, 0, 1);

    private sealed record ClientVibe(VibeVector Vibe, long LastSeenMilliseconds);
}
