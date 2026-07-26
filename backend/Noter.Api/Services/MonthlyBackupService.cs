using System.Text.Json;
using Noter.Api.Controllers;
using Noter.Api.Data;
using Noter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Services;

/// <summary>
/// Writes a JSON snapshot of all notes + settings to the persistent volume once
/// per calendar month. Images are intentionally excluded — links in note bodies
/// are preserved as plain text and round-trip normally.
///
/// Destinations
/// ─────────────
/// Primary   : BACKUPS_PATH env var, or {volume}/backups (derived from DB_PATH).
/// Secondary : ExtraBackupPath in appsettings.json  ← set this to any absolute path.
///             Also overridable at runtime via the EXTRA_BACKUP_PATH env var.
///             Leave empty / omit to disable the secondary copy.
///
/// Resilience: polls every 6 hours and creates the current month's file only if
/// it doesn't already exist, so a container that was off on the 1st still gets
/// that month's backup as soon as it comes back online. Writes are crash-safe
/// (temp file → atomic move). Keeps the 12 most recent monthly snapshots.
/// </summary>
public class MonthlyBackupService : BackgroundService
{
    private const int RetainMonths = 12;
    private static readonly TimeSpan PollInterval = TimeSpan.FromHours(6);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<MonthlyBackupService> _logger;

    public MonthlyBackupService(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        ILogger<MonthlyBackupService> logger)
    {
        _scopeFactory = scopeFactory;
        _config       = config;
        _logger       = logger;
    }

    // ── Primary destination ───────────────────────────────────────────────────
    // Controlled by BACKUPS_PATH env var; falls back to {data dir}/backups
    // where the data dir is inferred from DB_PATH (the Docker volume mount).
    private string BackupsDir
    {
        get
        {
            var configured = _config["BACKUPS_PATH"];
            if (!string.IsNullOrWhiteSpace(configured)) return configured;

            var dbPath  = _config["DB_PATH"] ?? "noter.db";
            var dataDir = Path.GetDirectoryName(Path.GetFullPath(dbPath)) ?? ".";
            return Path.Combine(dataDir, "backups");
        }
    }

    // ── Secondary destination (optional) ─────────────────────────────────────
    // Set "ExtraBackupPath" in appsettings.json to an absolute path, e.g.:
    //   "ExtraBackupPath": "/home/egemen/file-storage/information"
    // Or override at runtime with the EXTRA_BACKUP_PATH environment variable.
    // Null / empty = disabled.
    private string? ExtraBackupsDir
    {
        get
        {
            var path = _config["ExtraBackupPath"];
            return string.IsNullOrWhiteSpace(path) ? null : path;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EnsureBackupForCurrentMonthAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Monthly backup check failed.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task EnsureBackupForCurrentMonthAsync(CancellationToken ct)
    {
        var primaryDir = BackupsDir;
        Directory.CreateDirectory(primaryDir);

        var monthKey    = DateTime.UtcNow.ToString("yyyy-MM");
        var filename    = $"noter-backup-{monthKey}.json";
        var primaryPath = Path.Combine(primaryDir, filename);

        if (File.Exists(primaryPath))
        {
            MirrorToExtra(primaryPath, filename);
            return;
        }

        // ── Build the snapshot ────────────────────────────────────────────────
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var notes = await db.Notes
            .AsNoTracking()
            .OrderBy(n => n.SortOrder)
            .ToListAsync(ct);

        var backup = new BackupData
        {
            Version    = 1,
            ExportedAt = DateTime.UtcNow,
            Notes = notes.Select(n => new Note
            {
                Id        = n.Id,
                Title     = n.Title,
                Body      = n.Body,
                Color     = n.Color,
                Category  = n.Category,
                SortOrder = n.SortOrder,
                CreatedAt = n.CreatedAt,
                UpdatedAt = n.UpdatedAt,
                Images    = "", // excluded from backups
            }).ToList(),
            Settings = await db.Settings.AsNoTracking().ToListAsync(ct),
        };

        var json = JsonSerializer.Serialize(backup, new JsonSerializerOptions { WriteIndented = true });

        var tmp = primaryPath + ".tmp";
        await File.WriteAllTextAsync(tmp, json, ct);
        File.Move(tmp, primaryPath, overwrite: true);

        _logger.LogInformation(
            "Wrote monthly backup: {Path} ({Count} notes)",
            primaryPath, backup.Notes.Count);

        MirrorToExtra(primaryPath, filename);

        PruneOldBackups(primaryDir);
    }

    private void MirrorToExtra(string sourcePath, string filename)
    {
        var extra = ExtraBackupsDir;
        if (extra is null) return;

        try
        {
            Directory.CreateDirectory(extra);
            var dest = Path.Combine(extra, filename);
            File.Copy(sourcePath, dest, overwrite: true);
            _logger.LogInformation("Mirrored backup to extra destination: {Path}", dest);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to mirror backup to extra destination '{Extra}'.", extra);
        }
    }

    private void PruneOldBackups(string dir)
    {
        try
        {
            var files = Directory
                .GetFiles(dir, "noter-backup-*.json")
                .OrderByDescending(f => f)
                .Skip(RetainMonths)
                .ToList();

            foreach (var f in files)
                File.Delete(f);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to prune old backups.");
        }
    }
}
