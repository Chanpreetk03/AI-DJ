using AiDj.Api.Application;
using AiDj.Api.Infrastructure.Realtime;

var builder = WebApplication.CreateBuilder(args);
LoadGeminiEnvironment(builder.Configuration, Path.Combine(builder.Environment.ContentRootPath, ".env"));
LoadGeminiEnvironment(builder.Configuration, Path.Combine(builder.Environment.ContentRootPath, "backend", ".env"));

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
builder.Services.AddHttpClient<IDjDirector, GeminiDjDirector>(client => client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/"));
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
app.MapPost("/api/rooms/{roomId}/dj-direction", async (
    string roomId,
    DjDirectionRequest request,
    HttpRequest http,
    HttpResponse httpResponse,
    RoomRegistry rooms,
    RoomAccessService access,
    IDjDirector director,
    CancellationToken cancellationToken) =>
{
    string normalizedRoomId;
    try
    {
        normalizedRoomId = RoomRegistry.NormalizeRoomId(roomId);
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(new { message = exception.Message });
    }

    var hostToken = http.Headers["X-Room-Host-Token"].FirstOrDefault();
    if (!access.CanControlRoom(normalizedRoomId, hostToken))
    {
        return Results.Unauthorized();
    }

    if (!rooms.TryGetStatus(normalizedRoomId, out var status) || status is null)
    {
        return Results.NotFound(new { message = "This room does not exist." });
    }

    try
    {
        return Results.Ok(await director.DirectAsync(status.RoomState, request.Preferences, cancellationToken));
    }
    catch (DjDirectorUnavailableException exception)
    {
        if (exception.RetryAfter is { } retryAfter)
        {
            httpResponse.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }

        return Results.Problem(exception.Message, statusCode: (int)exception.StatusCode);
    }
});
app.MapHub<DjHub>("/hubs/dj");

static void LoadGeminiEnvironment(IConfigurationManager configuration, string path)
{
    if (!File.Exists(path))
    {
        return;
    }

    var values = new Dictionary<string, string?>(StringComparer.Ordinal);
    foreach (var line in File.ReadLines(path))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#'))
        {
            continue;
        }

        var separator = trimmed.IndexOf('=');
        if (separator <= 0)
        {
            continue;
        }

        var key = trimmed[..separator].Trim();
        if (key is not "GEMINI_API_KEY" and not "GEMINI_MODEL" || !string.IsNullOrWhiteSpace(configuration[key]))
        {
            continue;
        }

        var value = trimmed[(separator + 1)..].Trim().Trim('"');
        if (value.Length > 0)
        {
            values[key] = value;
        }
    }

    if (values.Count > 0)
    {
        configuration.AddInMemoryCollection(values);
    }
}

app.Run();

public sealed record CreateRoomRequest(string? RoomId);
