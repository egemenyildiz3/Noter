using Noter.Api.Data;
using Noter.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    public CategoriesController(AppDbContext db) => _db = db;

    // GET /api/categories
    [HttpGet]
    public async Task<IEnumerable<string>> Get() => await CategorySettings.GetAsync(_db);

    /// <summary>
    /// Replace the category list. Any note whose category is no longer present
    /// is reassigned to "Uncategorized" so no note is ever left orphaned.
    /// </summary>
    [HttpPut]
    public async Task<IEnumerable<string>> Set([FromBody] List<string> categories)
    {
        var cleaned = categories
            .Select(c => c?.Trim() ?? "")
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var value = string.Join(",", cleaned);
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == CategorySettings.Key);
        if (setting is null)
            _db.Settings.Add(new AppSetting { Key = CategorySettings.Key, Value = value });
        else
            setting.Value = value;

        // Clear the category from orphaned notes (set to empty string).
        var allowed = new HashSet<string>(cleaned, StringComparer.OrdinalIgnoreCase);
        var notes = await _db.Notes.ToListAsync();
        foreach (var n in notes.Where(n => !string.IsNullOrEmpty(n.Category) && !allowed.Contains(n.Category)))
            n.Category = "";

        await _db.SaveChangesAsync();
        return cleaned;
    }
}
