using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class VibeToMusicMapper
{
    public MusicParams Map(RoomState state)
    {
        var energy = Math.Clamp(state.Energy, 0, 1);
        return new MusicParams(
            Tempo: Math.Round(92 + (energy * 48), 1),
            FilterCutoff: Math.Round(0.18 + (energy * 0.82), 3),
            NoteDensity: Math.Round(0.15 + (energy * 0.85), 3),
            LayerCount: energy switch
            {
                < 0.2 => 1,
                < 0.45 => 2,
                < 0.75 => 3,
                _ => 4
            });
    }
}
