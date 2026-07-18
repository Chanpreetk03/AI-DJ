using AiDj.Api.Application;
using AiDj.Api.Domain.Models;
using Xunit;

namespace AiDj.Api.Tests;

public sealed class RoomEngineTests
{
    [Fact]
    public void Aggregator_excludes_a_client_after_the_stale_window()
    {
        var aggregator = new RoomAggregator();
        aggregator.Ingest("phone-1", Vibe(1), 1_000);

        var active = aggregator.GetState(2_000);
        var stale = aggregator.GetState(3_001);

        Assert.Equal(1, active.ActiveClients);
        Assert.True(active.Energy >= 0.9);
        Assert.Equal(0, stale.ActiveClients);
        Assert.Equal(0, stale.Energy);
    }

    [Fact]
    public void Aggregator_clamps_invalid_sensor_values()
    {
        var aggregator = new RoomAggregator();
        aggregator.Ingest("phone-1", new VibeVector(4, -2, 2, -10, 1_000), 1_000);

        var state = aggregator.GetState(1_000);

        Assert.InRange(state.Energy, 0, 1);
        Assert.Equal(1, state.ActiveClients);
    }

    [Theory]
    [InlineData(0.0, 1, 92)]
    [InlineData(0.3, 2, 106.4)]
    [InlineData(0.6, 3, 120.8)]
    [InlineData(1.0, 4, 140)]
    public void Mapper_produces_stable_music_tiers(double energy, int expectedLayers, double expectedTempo)
    {
        var parameters = new VibeToMusicMapper().Map(new RoomState(energy, 1, 1));

        Assert.Equal(expectedLayers, parameters.LayerCount);
        Assert.Equal(expectedTempo, parameters.Tempo);
        Assert.InRange(parameters.FilterCutoff, 0, 1);
        Assert.InRange(parameters.NoteDensity, 0, 1);
    }

    [Fact]
    public void Status_reports_output_separately_from_audience_clients()
    {
        var engine = new RoomEngine(new RoomAggregator(), new VibeToMusicMapper());
        engine.RegisterConnection("output-1", "output");
        engine.RegisterConnection("phone-1", "participant");
        engine.RegisterConnection("status-1", "status");
        engine.AcceptVibe("phone-1", Vibe(0.5));

        var status = engine.GetStatus();

        Assert.Equal(3, status.ConnectedClients);
        Assert.Equal(1, status.ParticipantClients);
        Assert.True(status.OutputConnected);
        Assert.Equal("participant", status.LatestSource);
        Assert.NotNull(status.LatestVibe);
    }

    private static VibeVector Vibe(double energy) => new(energy, energy, energy, energy * 4, 1_000);
}
