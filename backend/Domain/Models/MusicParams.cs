namespace AiDj.Api.Domain.Models;

public sealed record MusicParams(
    double Tempo,
    double FilterCutoff,
    double NoteDensity,
    int LayerCount);
