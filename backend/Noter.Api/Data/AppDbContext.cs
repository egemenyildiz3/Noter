using Noter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Noter.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Note> Notes => Set<Note>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppSetting>().HasKey(s => s.Key);
    }
}
