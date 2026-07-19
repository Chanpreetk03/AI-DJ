using AiDj.Api.Application;
using AiDj.Api.Domain.Models;
using Xunit;

namespace AiDj.Api.Tests;

public sealed class RoomRegistryTests
{
    [Fact]
    public void Rooms_keep_vibes_and_status_isolated()
    {
        var registry = new RoomRegistry(new VibeToMusicMapper());
        Assert.True(registry.TryCreateRoom("college-night"));
        Assert.True(registry.TryCreateRoom("quiet-lounge"));
        var first = registry.Join("connection-a", "college-night", "booth");
        var second = registry.Join("connection-b", "quiet-lounge", "booth");

        first.Room.AcceptVibe("connection-a", new VibeVector(1, 1, 1, 4, 1_000));

        Assert.True(registry.TryGetStatus("college-night", out var firstStatus));
        Assert.True(registry.TryGetStatus("quiet-lounge", out var secondStatus));
        Assert.Equal(1, firstStatus!.RoomState.ActiveClients);
        Assert.Equal(0, secondStatus!.RoomState.ActiveClients);
        Assert.NotSame(first.Room, second.Room);
    }

    [Theory]
    [InlineData("demo", "demo")]
    [InlineData("  College-Night  ", "college-night")]
    [InlineData(null, "demo")]
    public void Room_ids_are_normalized(string? input, string expected)
    {
        Assert.Equal(expected, RoomRegistry.NormalizeRoomId(input));
    }
}
