using AiDj.Api.Domain.Models;

namespace AiDj.Api.Application;

public sealed class VibeToMusicMapper
{
    public MusicParams Map(RoomState state)
    {
        var energy = Math.Clamp(state.Energy, 0, 1);
        var forwardMomentum = Math.Clamp(Math.Max(state.EnergyTrend, 0), 0, 1);
        var musicalPulse = Math.Clamp((state.AudioEnergy * 0.55) + (state.OnsetDensity * 0.45), 0, 1);
        var baseLayers = energy switch
        {
            < 0.2 => 1,
            < 0.45 => 2,
            < 0.75 => 3,
            _ => 4
        };
        return new MusicParams(
            Tempo: Math.Round(92 + (energy * 48) + (forwardMomentum * 4), 1),
            FilterCutoff: Math.Round(Math.Clamp(0.12 + (energy * 0.58) + (state.AudioEnergy * 0.3), 0, 1), 3),
            NoteDensity: Math.Round(Math.Clamp(0.12 + (energy * 0.55) + (musicalPulse * 0.33), 0, 1), 3),
            LayerCount: Math.Clamp(baseLayers + (musicalPulse > 0.8 && baseLayers < 4 ? 1 : 0), 1, 4));
    }
}
