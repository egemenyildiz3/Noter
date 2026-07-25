using Noter.Api.Data;
using Noter.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Controllers;

/// <summary>Full JSON snapshot of all notes + settings, used for backup and restore.</summary>
public class BackupData
{
    public int Version { get; set; } = 1;
    public DateTime ExportedAt { get; set; }
    public List<Note> Notes { get; set; } = new();
    public List<AppSetting> Settings { get; set; } = new();
}

[ApiController]
[Route("api")]
public class ExportController : ControllerBase
{
    private readonly AppDbContext _db;
    public ExportController(AppDbContext db) => _db = db;

    // GET /api/export/json
    [HttpGet("export/json")]
    public async Task<BackupData> ExportJson()
    {
        var notes = await _db.Notes
            .AsNoTracking()
            .OrderBy(n => n.SortOrder)
            .ToListAsync();

        return new BackupData
        {
            Version = 1,
            ExportedAt = DateTime.UtcNow,
            // Images are intentionally excluded from backups — the JSON dump is
            // note text/metadata only, not uploaded binaries. Links live in Body
            // and round-trip normally.
            Notes = notes.Select(n => new Note
            {
                Id = n.Id,
                Title = n.Title,
                Body = n.Body,
                Color = n.Color,
                Category = n.Category,
                SortOrder = n.SortOrder,
                CreatedAt = n.CreatedAt,
                UpdatedAt = n.UpdatedAt,
                Images = "",
            }).ToList(),
            Settings = await _db.Settings.AsNoTracking().ToListAsync(),
        };
    }

    // POST /api/import/json
    [HttpPost("import/json")]
    public async Task<IActionResult> ImportJson([FromBody] BackupData data)
    {
        if (data is null) return BadRequest("No backup data provided.");

        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.Notes.RemoveRange(_db.Notes);
        _db.Settings.RemoveRange(_db.Settings);
        await _db.SaveChangesAsync();

        _db.Notes.AddRange(data.Notes.Select(n => new Note
        {
            Title = n.Title,
            Body = n.Body,
            Color = n.Color,
            Category = n.Category,
            SortOrder = n.SortOrder,
            CreatedAt = n.CreatedAt,
            UpdatedAt = n.UpdatedAt,
        }));
        _db.Settings.AddRange(data.Settings
            .Where(s => !string.IsNullOrWhiteSpace(s.Key))
            .Select(s => new AppSetting { Key = s.Key, Value = s.Value }));

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { imported = true });
    }
}
