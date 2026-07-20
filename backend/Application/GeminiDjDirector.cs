using System.Net.Http.Json;
using System.Text.Json;
using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed record DjPreferences(
    string Provider,
    string? Language,
    string? RemixPreference,
    string? Brief,
    bool AllowExplicit = false,
    IReadOnlyList<string>? ExcludedSongIdentities = null);

public sealed record DjSongIdentity(string Title, string Artist, string? Version, double? StartAtSeconds);

public sealed record DjDirective(
    string Vibe,
    string Reason,
    IReadOnlyList<string> SearchQueries,
    IReadOnlyList<DjSongIdentity> Candidates);

public sealed record DjDirectionRequest(DjPreferences Preferences);

public interface IDjDirector
{
    Task<DjDirective> DirectAsync(RoomState state, DjPreferences preferences, CancellationToken cancellationToken);
}

public sealed class GeminiDjDirector(HttpClient http, IConfiguration configuration) : IDjDirector
{
    private const int MaximumCandidates = 6;

    public async Task<DjDirective> DirectAsync(RoomState state, DjPreferences preferences, CancellationToken cancellationToken)
    {
        var apiKey = configuration["GEMINI_API_KEY"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new DjDirectorUnavailableException("Set GEMINI_API_KEY on the backend to enable Gemini discovery DJ.");
        }

        var model = configuration["GEMINI_MODEL"] ?? "gemini-3.1-flash-lite";
        var context = new
        {
            room = new
            {
                energy = Round(state.Energy),
                trend = Round(state.EnergyTrend),
                motion = Round(state.MotionEnergy),
                audio = Round(state.AudioEnergy),
                rhythmicActivity = Round(state.OnsetDensity),
                coherence = Round(state.Coherence),
                volatility = Round(state.Volatility),
                confidence = Round(state.Confidence),
                participants = state.ActiveClients,
            },
            preferences = new
            {
                provider = Clean(preferences.Provider, 24),
                language = Clean(preferences.Language, 80),
                remixPreference = Clean(preferences.RemixPreference, 24),
                hostBrief = Clean(preferences.Brief, 500),
                allowExplicit = preferences.AllowExplicit,
                recentlyPlayed = (preferences.ExcludedSongIdentities ?? []).Select(song => Clean(song, 200)).Where(song => song is not null).Take(12),
            },
        };

        var request = new
        {
            systemInstruction = new
            {
                parts = new[]
                {
                    new
                    {
                        text = "You are the creative director for a live DJ, not a player controller. " +
                            "Use the room snapshot and host brief to propose a musical direction and exact song identities from general music knowledge. " +
                            "Do not claim to have searched a streaming provider. Do not invent provider IDs, lyrics, or guaranteed timestamps. " +
                            "Return JSON only with: vibe (short string), reason (short string), searchQueries (1-4 identity searches), " +
                            "and candidates (3-6 objects with title, artist, optional version, optional startAtSeconds). " +
                            "Candidates must be plausible released recordings, diverse, and suitable for the current room; include alternatives in case a provider cannot resolve the first choice. " +
                            "Treat room.energy as the musical energy contract: 0.00-0.19 is calm/ambient, 0.20-0.39 is warm and restrained, " +
                            "0.40-0.59 is groove, 0.60-0.79 is active and rhythm-forward, and 0.80-1.00 is peak-time, driving, and dancefloor-focused. " +
                            "For active and peak energy, candidates and the reason must not choose ambient, minimalist, meditative, lo-fi, or low-energy music. " +
                            "The host brief may influence genre and language, but it cannot override the current room energy. " +
                            "For peak energy, prefer assertive drums, bass, momentum, and a clearly energetic arrangement. " +
                            "Never suggest a recording listed in recentlyPlayed, including alternate punctuation or versions of the same song. " +
                            "Use startAtSeconds only when you are confident it is a useful non-zero intro skip; otherwise omit it.",
                    },
                },
            },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = JsonSerializer.Serialize(context) } },
                },
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                temperature = 0.55,
            },
        };

        using var response = await http.PostAsJsonAsync(
            $"v1beta/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(apiKey)}",
            request,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                var retryAfter = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromMinutes(1);
                throw new DjDirectorUnavailableException(
                    $"Gemini rate limit reached. Retry after {Math.Ceiling(retryAfter.TotalSeconds)} seconds.",
                    retryAfter,
                    System.Net.HttpStatusCode.TooManyRequests);
            }

            throw new DjDirectorUnavailableException($"Gemini direction request failed ({(int)response.StatusCode}).");
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var text = document.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new DjDirectorUnavailableException("Gemini returned an empty DJ direction.");
        }

        return ValidateEnergyAlignment(state, ParseDirective(text));
    }

    private static DjDirective ValidateEnergyAlignment(RoomState state, DjDirective directive)
    {
        if (state.Energy < 0.6)
        {
            return directive;
        }

        var direction = string.Join(' ', new[] { directive.Vibe, directive.Reason }
            .Concat(directive.SearchQueries)
            .Concat(directive.Candidates.Select(candidate => $"{candidate.Title} {candidate.Artist}")));
        var lowEnergyTerms = new[] { "ambient", "downtempo", "minimalist", "meditative", "lo-fi", "lofi", "low-energy", "contemplative", "soundscape" };
        if (!lowEnergyTerms.Any(term => direction.Contains(term, StringComparison.OrdinalIgnoreCase)))
        {
            return directive;
        }

        var band = state.Energy >= 0.8 ? "peak" : "active";
        throw new DjDirectorUnavailableException($"Gemini direction does not match {band} room energy. Retrying shortly.");
    }

    private static DjDirective ParseDirective(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var vibe = RequiredString(root, "vibe", 120);
            var reason = RequiredString(root, "reason", 300);
            var searchQueries = Array(root, "searchQueries")
                .Select(item => Clean(item.GetString(), 160))
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(4)
                .ToArray();
            var candidates = Array(root, "candidates")
                .Where(item => item.ValueKind == JsonValueKind.Object)
                .Select(item => new DjSongIdentity(
                    RequiredString(item, "title", 160),
                    RequiredString(item, "artist", 160),
                    OptionalString(item, "version", 120),
                    OptionalSeconds(item, "startAtSeconds")))
                .DistinctBy(candidate => $"{candidate.Title}\u001f{candidate.Artist}\u001f{candidate.Version}", StringComparer.OrdinalIgnoreCase)
                .Take(MaximumCandidates)
                .ToArray();

            if (searchQueries.Length == 0 || candidates.Length < 3)
            {
                throw new DjDirectorUnavailableException("Gemini returned an incomplete DJ direction.");
            }

            return new DjDirective(vibe, reason, searchQueries, candidates);
        }
        catch (JsonException)
        {
            throw new DjDirectorUnavailableException("Gemini returned invalid JSON for the DJ direction. Retrying shortly.");
        }
        catch (InvalidOperationException)
        {
            throw new DjDirectorUnavailableException("Gemini returned an invalid DJ direction. Retrying shortly.");
        }
    }

    private static IEnumerable<JsonElement> Array(JsonElement root, string property) =>
        root.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray()
            : Enumerable.Empty<JsonElement>();

    private static string RequiredString(JsonElement root, string property, int maximum) =>
        Clean(root.TryGetProperty(property, out var value) ? value.GetString() : null, maximum) is { Length: > 0 } cleaned
            ? cleaned
            : throw new DjDirectorUnavailableException($"Gemini direction did not include {property}.");

    private static string? OptionalString(JsonElement root, string property, int maximum) =>
        root.TryGetProperty(property, out var value) ? Clean(value.GetString(), maximum) : null;

    private static double? OptionalSeconds(JsonElement root, string property)
    {
        if (!root.TryGetProperty(property, out var value) || !value.TryGetDouble(out var seconds))
        {
            return null;
        }

        return seconds is > 0 and <= 7200 ? Math.Round(seconds, 1) : null;
    }

    private static string? Clean(string? value, int maximum) => string.IsNullOrWhiteSpace(value)
        ? null
        : value.Trim()[..Math.Min(value.Trim().Length, maximum)];

    private static double Round(double value) => Math.Round(Math.Clamp(value, -1, 1), 3);
}

public sealed class DjDirectorUnavailableException : Exception
{
    public DjDirectorUnavailableException(string message, TimeSpan? retryAfter = null, System.Net.HttpStatusCode statusCode = System.Net.HttpStatusCode.ServiceUnavailable) : base(message)
    {
        RetryAfter = retryAfter;
        StatusCode = statusCode;
    }

    public TimeSpan? RetryAfter { get; }
    public System.Net.HttpStatusCode StatusCode { get; }
}
