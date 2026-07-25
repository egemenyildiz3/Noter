using System.Text.Json;
using Noter.Api.Controllers;
using Noter.Api.Data;
using Noter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Services;

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

    // Resolve the backups directory: BACKUPS_PATH env, else "<data dir>/backups"
    // where the data dir is inferred from DB_PATH (the volume mount in Docker).
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
        var dir = BackupsDir;
        Directory.CreateDirectory(dir);

        var monthKey = DateTime.UtcNow.ToString("yyyy-MM");
        var target   = Path.Combine(dir, $"noter-backup-{monthKey}.json");

        if (File.Exists(target))
            return; // already have this month's snapshot

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
            // Images excluded on purpose (see /api/export/json).
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
                Images    = "",
            }).ToList(),
            Settings = await db.Settings.AsNoTracking().ToListAsync(ct),
        };

        var json = JsonSerializer.Serialize(backup, new JsonSerializerOptions { WriteIndented = true });

        // Write to a temp file first, then move into place so a crash mid-write
        // can never leave a truncated backup.
        var tmp = target + ".tmp";
        await File.WriteAllTextAsync(tmp, json, ct);
        File.Move(tmp, target, overwrite: true);

        _logger.LogInformation("Wrote monthly backup: {Path} ({Count} notes)", target, backup.Notes.Count);

        PruneOldBackups(dir);
    }

    // Keep only the most recent RetainMonths backups.
    private void PruneOldBackups(string dir)
    {
        try
        {
            var files = Directory
                .GetFiles(dir, "noter-backup-*.json")
                .OrderByDescending(f => f) // yyyy-MM sorts lexicographically
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
