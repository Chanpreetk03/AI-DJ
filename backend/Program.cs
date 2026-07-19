using AiDj.Api.Application;
using AiDj.Api.Infrastructure.Realtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    var configuredOrigins = builder.Configuration["FRONTEND_ORIGINS"]?
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        ?? ["http://localhost:5173", "https://localhost:5173"];

    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(configuredOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});
builder.Services.AddSingleton<VibeToMusicMapper>();
builder.Services.AddSingleton<RoomRegistry>();
var hostTokenSecret = builder.Configuration["ROOM_HOST_TOKEN_SECRET"];
var requireHostToken = builder.Configuration.GetValue<bool>("ROOM_REQUIRE_HOST_TOKEN");
if (requireHostToken && string.IsNullOrWhiteSpace(hostTokenSecret))
{
    throw new InvalidOperationException("ROOM_HOST_TOKEN_SECRET is required when ROOM_REQUIRE_HOST_TOKEN is enabled.");
}
builder.Services.AddSingleton(new RoomAccessService(
    hostTokenSecret ?? Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)),
    !requireHostToken));

var app = builder.Build();

app.Services.GetRequiredService<RoomRegistry>().TryCreateRoom("demo");

app.UseCors("Frontend");
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "ai-dj-api" }));
app.MapGet("/api/status", (string? room, RoomRegistry rooms) =>
    rooms.TryGetStatus(room ?? "demo", out var status) ? Results.Ok(status) : Results.NotFound());
app.MapPost("/api/rooms", (CreateRoomRequest request, RoomRegistry rooms, RoomAccessService access) =>
{
    var roomId = string.IsNullOrWhiteSpace(request.RoomId)
        ? Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(6)).ToLowerInvariant()
        : RoomRegistry.NormalizeRoomId(request.RoomId);
    if (!rooms.TryCreateRoom(roomId))
    {
        return Results.Conflict(new { message = "That room ID is already in use." });
    }

    return Results.Created($"/api/rooms/{roomId}", new { roomId, hostToken = access.CreateHostToken(roomId) });
});
app.MapHub<DjHub>("/hubs/dj");

app.Run();

public sealed record CreateRoomRequest(string? RoomId);
