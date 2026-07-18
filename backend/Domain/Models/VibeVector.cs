namespace AiDj.Api.Domain.Models;

public sealed record VibeVector(
    double Motion,
    double MotionVariance,
    double AudioRms,
    double OnsetRate,
    long Timestamp);
