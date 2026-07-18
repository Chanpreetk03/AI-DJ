namespace AiDj.Api.Domain.Models;

public sealed record RoomState(
    double Energy,
    double Coherence,
    int ActiveClients,
    double MotionEnergy = 0,
    double AudioEnergy = 0,
    double OnsetDensity = 0,
    double EnergyTrend = 0,
    double Volatility = 0,
    double Confidence = 0);
