// SnapStep.App/LocalServer.cs
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SnapStep.App;

internal sealed class LocalServer : IAsyncDisposable
{
    private WebApplication? _app;
    public string Url { get; } = "http://127.0.0.1:5173";

    public static async Task<LocalServer> StartAsync(
        string url,
        string sessionsRoot,
        string contentRoot,
        CancellationToken ct = default)
    {
        var self = new LocalServer();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ContentRootPath = contentRoot,
            WebRootPath = Path.Combine(contentRoot, "wwwroot"),
        });

        var app = builder.Build();

        // Tamper check (no-op if TamperInfo.Files is empty)
        TamperValidator.Verify(app.Environment, app.Logger);

        Directory.CreateDirectory(sessionsRoot);

        // Serve editor from embedded wwwroot
        app.UseDefaultFiles();
        app.UseStaticFiles();

        // Serve session images
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(sessionsRoot),
            RequestPath = "/sessions"
        });

        app.MapGet("/api/session/{id}", (string id) =>
        {
            var folder = Path.Combine(sessionsRoot, id);
            if (!Directory.Exists(folder))
                return Results.NotFound(new { error = "Session not found" });

            var files = Directory.GetFiles(folder, "*.png")
                                 .OrderBy(f => f)
                                 .Select(f => $"/sessions/{id}/{Path.GetFileName(f)}")
                                 .ToArray();

            var docPath = Path.Combine(folder, "doc.json");
            string? doc = File.Exists(docPath) ? File.ReadAllText(docPath) : null;

            return Results.Ok(new { images = files, doc });
        });

        app.MapPost("/api/session/{id}/doc", async (string id, HttpRequest req) =>
        {
            var folder = Path.Combine(sessionsRoot, id);
            Directory.CreateDirectory(folder);

            using var sr = new StreamReader(req.Body);
            var body = await sr.ReadToEndAsync();
            await File.WriteAllTextAsync(Path.Combine(folder, "doc.json"), body, ct);
            return Results.Ok();
        });

        app.MapFallbackToFile("index.html");

        app.Urls.Clear();
        app.Urls.Add(url);
        await app.StartAsync(ct);

        self._app = app;
        return self;
    }

    public async Task StopAsync()
    {
        if (_app is null) return;
        try
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
        finally
        {
            _app = null;
        }
    }

    public async ValueTask DisposeAsync() => await StopAsync();
}
