using Noter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Data;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        db.Database.EnsureCreated();

        // Add Images column if upgrading from a version that didn't have it.
        EnsureColumn(db, "Notes", "Images", "TEXT NOT NULL DEFAULT ''");

        EnsureSetting(db, CategorySettings.Key, CategorySettings.Default);
    }

    private static void EnsureSetting(AppDbContext db, string key, string value)
    {
        if (db.Settings.Any(s => s.Key == key)) return;
        db.Settings.Add(new AppSetting { Key = key, Value = value });
        db.SaveChanges();
    }

    private static void EnsureColumn(AppDbContext db, string table, string column, string columnDef)
    {
        var existing = db.Database
            .SqlQueryRaw<string>($"SELECT name AS \"Value\" FROM pragma_table_info('{table}')")
            .ToList();
        if (existing.Contains(column)) return;
        db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {columnDef}");
    }
}
