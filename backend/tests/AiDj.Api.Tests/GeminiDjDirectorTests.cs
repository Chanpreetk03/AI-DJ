using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AiDj.Api.Application;
using AiDj.Api.Domain.Models;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiDj.Api.Tests;

public sealed class GeminiDjDirectorTests
{
    [Fact]
    public async Task Director_preserves_Gemini_rate_limit_retry_delay()
    {
        using var http = new HttpClient(new StaticResponseHandler("{}", HttpStatusCode.TooManyRequests, 90))
        {
            BaseAddress = new Uri("https://example.test/"),
        };
        var configuration = new ConfigurationManager { ["GEMINI_API_KEY"] = "test-key" };
        var director = new GeminiDjDirector(http, configuration);

        var error = await Assert.ThrowsAsync<DjDirectorUnavailableException>(() => director.DirectAsync(
            new RoomState(0.5, 0.8, 2),
            new DjPreferences("spotify", "English", "allow", "late-night love songs"),
            CancellationToken.None));

        Assert.Contains("rate limit", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(TimeSpan.FromSeconds(90), error.RetryAfter);
        Assert.Equal(HttpStatusCode.TooManyRequests, error.StatusCode);
    }

    [Fact]
    public async Task Director_turns_truncated_Gemini_JSON_into_a_retryable_error()
    {
        const string truncatedDirective = "{\"vibe\":\"Late-night romance\",\"reason\":\"Warm and intimate\",\"searchQueries\":[\"Best Part Daniel Caesar\"],\"candidates\":[";
        var geminiResponse = JsonSerializer.Serialize(new
        {
            candidates = new[]
            {
                new { content = new { parts = new[] { new { text = truncatedDirective } } } },
            },
        });
        using var http = new HttpClient(new StaticResponseHandler(geminiResponse))
        {
            BaseAddress = new Uri("https://example.test/"),
        };
        var configuration = new ConfigurationManager { ["GEMINI_API_KEY"] = "test-key" };
        var director = new GeminiDjDirector(http, configuration);

        var error = await Assert.ThrowsAsync<DjDirectorUnavailableException>(() => director.DirectAsync(
            new RoomState(0.5, 0.8, 2, 0.4, 0.5, 0.4, 0.1, 0.1, 0.9),
            new DjPreferences("spotify", "English", "allow", "late-night love songs"),
            CancellationToken.None));

        Assert.Contains("invalid JSON", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class StaticResponseHandler(string body, HttpStatusCode status = HttpStatusCode.OK, int? retryAfterSeconds = null) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
            if (retryAfterSeconds is not null)
            {
                response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(retryAfterSeconds.Value));
            }

            return Task.FromResult(response);
        }
    }
}
