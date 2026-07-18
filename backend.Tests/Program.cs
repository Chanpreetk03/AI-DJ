using AiDj.Api.Application;
using AiDj.Api.Domain.Models;

var tests = new (string Name, Action Run)[]
{
    ("Aggregator clamps untrusted vibe values", AggregatorClampsUntrustedVibeValues),
    ("Aggregator excludes stale clients", AggregatorExcludesStaleClients),
    ("Aggregator reports matching participant coherence", AggregatorReportsMatchingParticipantCoherence),
    ("Mapper maps quiet and peak parameters", MapperMapsQuietAndPeakParameters),
    ("Mapper selects layer thresholds", MapperSelectsLayerThresholds)
};

var failures = new List<string>();
foreach (var test in tests)
{
    try
    {
        test.Run();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception exception)
    {
        failures.Add($"FAIL {test.Name}: {exception.Message}");
        Console.WriteLine(failures[^1]);
    }
}

return failures.Count == 0 ? 0 : 1;

static void AggregatorClampsUntrustedVibeValues()
{
    var aggregator = new RoomAggregator();
    aggregator.Ingest("participant-1", new VibeVector(2, -1, 4, -3, 0), 1_000);

    var state = aggregator.GetState(1_000);

    AssertEqual(0.65, state.Energy);
    AssertEqual(1, state.ActiveClients);
}

static void AggregatorExcludesStaleClients()
{
    var aggregator = new RoomAggregator();
    aggregator.Ingest("participant-1", new VibeVector(1, 1, 1, 4, 0), 1_000);

    AssertEqual(1, aggregator.GetState(3_000).ActiveClients);
    AssertEqual(0, aggregator.GetState(3_001).ActiveClients);
    AssertEqual(0, aggregator.GetState(3_001).Energy);
}

static void AggregatorReportsMatchingParticipantCoherence()
{
    var aggregator = new RoomAggregator();
    var matchingVibe = new VibeVector(0.5, 0.25, 0.5, 1, 0);
    aggregator.Ingest("participant-1", matchingVibe, 1_000);
    aggregator.Ingest("participant-2", matchingVibe, 1_000);

    var state = aggregator.GetState(1_000);

    AssertEqual(1, state.Coherence);
    AssertEqual(2, state.ActiveClients);
}

static void MapperMapsQuietAndPeakParameters()
{
    var mapper = new VibeToMusicMapper();

    AssertEqual(new MusicParams(92, 0.18, 0.15, 1), mapper.Map(new RoomState(0, 1, 0)));
    AssertEqual(new MusicParams(140, 1, 1, 4), mapper.Map(new RoomState(1, 0, 4)));
}

static void MapperSelectsLayerThresholds()
{
    var mapper = new VibeToMusicMapper();
    var thresholds = new (double Energy, int Layers)[]
    {
        (0.19, 1), (0.2, 2), (0.44, 2), (0.45, 3), (0.74, 3), (0.75, 4)
    };

    foreach (var threshold in thresholds)
    {
        var parameters = mapper.Map(new RoomState(threshold.Energy, 1, 1));
        AssertEqual(threshold.Layers, parameters.LayerCount);
    }
}

static void AssertEqual<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
        throw new InvalidOperationException($"Expected {expected}, got {actual}.");
    }
}
