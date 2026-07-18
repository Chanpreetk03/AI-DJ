using AiDj.Api.Application;
using AiDj.Api.Infrastructure.Realtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins("http://localhost:5173", "https://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});
builder.Services.AddSingleton<RoomAggregator>();
builder.Services.AddSingleton<VibeToMusicMapper>();
builder.Services.AddSingleton<RoomEngine>();

var app = builder.Build();

app.UseCors("Frontend");
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "ai-dj-api" }));
app.MapHub<DjHub>("/hubs/dj");

app.Run();
