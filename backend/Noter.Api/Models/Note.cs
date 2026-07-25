namespace Noter.Api.Models;

public class Note
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Color { get; set; } = "#1e1f2e";
    public string Category { get; set; } = "";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Comma-separated list of uploaded image filenames (UUIDs with extension).</summary>
    public string Images { get; set; } = "";
}
