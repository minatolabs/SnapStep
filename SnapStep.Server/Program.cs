using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

#if !DEBUG
try
{
    // Fail fast if critical files were altered
    SnapStep.Server.TamperValidator.Verify(app.Environment, app.Logger);
}
catch (Exception ex)
{
    app.Logger.LogCritical(ex, "Tamper protection failed — server will not start.");
    return; // abort startup
}
#endif

// Simple sanity check for session IDs (desktop uses Guid("N") => 32 hex chars)
static bool IsValidSessionId(string id) => id.Length == 32 && id.All(Uri.IsHexDigit);

// Use the same shared folder for both app and server (simple + reliable)
static string SharedSessionsRoot()
{
    // Optional override via env var
    var env = Environment.GetEnvironmentVariable("SNAPSTEP_DATA");
    if (!string.IsNullOrEmpty(env)) return Path.Combine(env, "sessions");

    // Default: %TEMP%\SnapStep\sessions (works for packaged + unpackaged)
    return Path.Combine(Path.GetTempPath(), "SnapStep", "sessions");
}

var sessionsRoot = SharedSessionsRoot();
Directory.CreateDirectory(sessionsRoot);

// Serve the editor from wwwroot/
app.UseDefaultFiles();
app.UseStaticFiles();

// Serve session images as /sessions/<id>/capture_XXXX.png
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(sessionsRoot),
    RequestPath = "/sessions",
    ServeUnknownFileTypes = false
});

// API: get session (images + saved doc)
app.MapGet("/api/session/{id}", (string id) =>
{
    if (!IsValidSessionId(id))
        return Results.BadRequest(new { error = "Invalid session id" });

    var folder = Path.Combine(sessionsRoot, id);
    if (!Directory.Exists(folder))
        return Results.NotFound(new { error = "Session not found" });

    var files = Directory
        .GetFiles(folder, "*.png")
        .OrderBy(f => f)
        .Select(f => $"/sessions/{id}/{Path.GetFileName(f)}")
        .ToArray();

    var docPath = Path.Combine(folder, "doc.json");
    string? doc = File.Exists(docPath) ? File.ReadAllText(docPath) : null;

    return Results.Ok(new { images = files, doc });
});

// API: save doc (notes + order)
app.MapPost("/api/session/{id}/doc", async (string id, HttpRequest req) =>
{
    if (!IsValidSessionId(id))
        return Results.BadRequest(new { error = "Invalid session id" });

    var folder = Path.Combine(sessionsRoot, id);
    Directory.CreateDirectory(folder);

    using var sr = new StreamReader(req.Body);
    var body = await sr.ReadToEndAsync();
    await File.WriteAllTextAsync(Path.Combine(folder, "doc.json"), body);
    return Results.Ok();
});

// SPA fallback: /session/<id> routes should serve index.html
app.MapFallbackToFile("index.html");

app.Run("http://127.0.0.1:5173");
