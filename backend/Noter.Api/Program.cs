using Noter.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddHostedService<Noter.Api.Services.MonthlyBackupService>();

var dbPath = builder.Configuration["DB_PATH"] ?? "noter.db";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

// Resolve uploads directory: prefer UPLOADS_PATH env var (Docker volume), fall back to wwwroot/uploads.
var uploadsDir = app.Configuration["UPLOADS_PATH"]
    ?? Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "uploads");
Directory.CreateDirectory(uploadsDir);

// Make the path accessible to controllers via app config so they don't duplicate this logic.
app.Configuration["UPLOADS_DIR"] = uploadsDir;

// Create and seed the database on startup.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbSeeder.Seed(db);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

// Serve uploaded images at /uploads/** with strict security headers.
// The physical directory is outside wwwroot when running in Docker,
// so we register it manually as a static file provider.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider    = new PhysicalFileProvider(uploadsDir),
    RequestPath     = "/uploads",
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        // Prevent MIME sniffing — browser must treat the file as the declared type.
        headers["X-Content-Type-Options"]  = "nosniff";
        // Prevent the image from being embedded in a frame.
        headers["X-Frame-Options"]         = "DENY";
        // Tight CSP: only allow the image itself, nothing else.
        headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'";
        // Private cache — images are user content, not public assets.
        headers["Cache-Control"]           = "private, max-age=3600";
    }
});

app.MapControllers();
app.Run();
