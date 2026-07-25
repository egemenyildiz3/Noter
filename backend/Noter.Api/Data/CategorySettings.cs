using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Data;

/// <summary>
/// Helper around the note-categories setting.
/// </summary>
public static class CategorySettings
{
    public const string Key = "Categories";
    public const string Default = "Personal,Work,Ideas";

    public static async Task<List<string>> GetAsync(AppDbContext db)
    {
        var setting = await db.Settings.FirstOrDefaultAsync(s => s.Key == Key);
        var list = Parse(setting?.Value);
        if (list.Count == 0) list = Parse(Default);
        return list;
    }

    public static List<string> Parse(string? value) =>
        (value ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}
