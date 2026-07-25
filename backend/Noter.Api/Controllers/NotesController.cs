using Noter.Api.Data;
using Noter.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public NotesController(AppDbContext db, IWebHostEnvironment env, IConfiguration config)
    {
        _db     = db;
        _env    = env;
        _config = config;
    }

    private string UploadsPath =>
        _config["UPLOADS_DIR"]
        ?? Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads");

    // GET /api/notes
    [HttpGet]
    public async Task<IEnumerable<Note>> Get() =>
        await _db.Notes.OrderBy(n => n.SortOrder).ThenBy(n => n.CreatedAt).ToListAsync();

    // POST /api/notes
    [HttpPost]
    public async Task<ActionResult<Note>> Create([FromBody] NoteInput input)
    {
        var maxOrder = _db.Notes.Any() ? await _db.Notes.MaxAsync(n => n.SortOrder) : -1;
        var note = new Note
        {
            Title     = input.Title?.Trim() ?? "",
            Body      = input.Body?.Trim() ?? "",
            Color     = input.Color ?? "#1e1f2e",
            Category  = input.Category?.Trim() ?? "",
            Images    = NormaliseImages(input.Images),
            SortOrder = maxOrder + 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = note.Id }, note);
    }

    // PUT /api/notes/:id
    [HttpPut("{id}")]
    public async Task<ActionResult<Note>> Update(int id, [FromBody] NoteInput input)
    {
        var note = await _db.Notes.FindAsync(id);
        if (note is null) return NotFound();

        // Delete any images that were removed from this note.
        var oldImages = ParseImages(note.Images);
        var newImages = ParseImages(NormaliseImages(input.Images));
        foreach (var removed in oldImages.Except(newImages))
            DeleteImageFile(removed);

        note.Title     = input.Title?.Trim() ?? "";
        note.Body      = input.Body?.Trim() ?? "";
        note.Color     = input.Color ?? note.Color;
        note.Category  = input.Category?.Trim() ?? note.Category;
        note.Images    = string.Join(",", newImages);
        note.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return note;
    }

    // DELETE /api/notes/:id
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var note = await _db.Notes.FindAsync(id);
        if (note is null) return NotFound();

        // Clean up uploaded images from disk.
        foreach (var filename in ParseImages(note.Images))
            DeleteImageFile(filename);

        _db.Notes.Remove(note);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/notes/reorder
    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder([FromBody] List<int> ids)
    {
        var notes = await _db.Notes.ToListAsync();
        var indexMap = ids.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        foreach (var note in notes)
        {
            if (indexMap.TryGetValue(note.Id, out var order))
                note.SortOrder = order;
        }
        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---- Helpers ----

    private static List<string> ParseImages(string raw) =>
        (raw ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(IsValidFilename)
            .ToList();

    private static string NormaliseImages(string? raw) =>
        string.Join(",", ParseImages(raw ?? ""));

    private void DeleteImageFile(string filename)
    {
        if (!IsValidFilename(filename)) return;
        var uploadsDir = UploadsPath;
        var fullPath   = Path.Combine(uploadsDir, filename);
        var resolved   = Path.GetFullPath(fullPath);
        if (!resolved.StartsWith(Path.GetFullPath(uploadsDir) + Path.DirectorySeparatorChar)) return;
        if (System.IO.File.Exists(fullPath)) System.IO.File.Delete(fullPath);
    }

    private static bool IsValidFilename(string f)
    {
        if (string.IsNullOrWhiteSpace(f)) return false;
        if (f.Contains('/') || f.Contains('\\') || f.Contains("..")) return false;
        var ext = Path.GetExtension(f).ToLowerInvariant();
        return ext is ".jpg" or ".png";
    }
}

public class NoteInput
{
    public string? Title    { get; set; }
    public string? Body     { get; set; }
    public string? Color    { get; set; }
    public string? Category { get; set; }
    public string? Images   { get; set; }
}
