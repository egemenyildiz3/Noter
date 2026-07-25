using Microsoft.AspNetCore.Mvc;

namespace Noter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ImagesController : ControllerBase
{
    // Allowed MIME types mapped to their magic-byte signatures.
    // We read the actual file bytes — never trust the Content-Type header or file extension alone.
    private static readonly (string Mime, byte[] Magic)[] AllowedSignatures =
    [
        ("image/jpeg", new byte[] { 0xFF, 0xD8, 0xFF }),
        ("image/png",  new byte[] { 0x89, 0x50, 0x4E, 0x47 }),
    ];

    private static readonly Dictionary<string, string> MimeToExt = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"]  = ".png",
    };

    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB

    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public ImagesController(IWebHostEnvironment env, IConfiguration config)
    {
        _env    = env;
        _config = config;
    }

    private string UploadsPath =>
        _config["UPLOADS_DIR"]
        ?? Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads");

    // POST /api/images  — multipart/form-data, field name "file"
    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file provided.");

        if (file.Length > MaxBytes)
            return BadRequest("File exceeds 5 MB limit.");

        // Read magic bytes (first 12 bytes is enough for all signatures above).
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header.AsMemory(0, header.Length));

        var detectedMime = DetectMime(header, read);
        if (detectedMime is null)
            return UnprocessableEntity("File type not allowed. Only JPEG and PNG are accepted.");

        // Generate a random UUID filename — no user-controlled path component anywhere.
        var filename = $"{Guid.NewGuid()}{MimeToExt[detectedMime]}";
        var uploadsDir = UploadsPath;
        Directory.CreateDirectory(uploadsDir);
        var fullPath = Path.Combine(uploadsDir, filename);

        // Write the full file (rewind stream first).
        stream.Position = 0;
        await using var dest = System.IO.File.Create(fullPath);
        await stream.CopyToAsync(dest);

        return Ok(new { filename });
    }

    // DELETE /api/images/{filename}
    [HttpDelete("{filename}")]
    public IActionResult Delete(string filename)
    {
        // Validate: filename must be a bare name with no path separators and a known extension.
        if (!IsValidFilename(filename))
            return BadRequest("Invalid filename.");

        var fullPath = Path.Combine(UploadsPath, filename);

        // Confirm the resolved path is still inside the uploads directory (defense in depth).
        var uploadsDir = Path.GetFullPath(UploadsPath);
        var resolved  = Path.GetFullPath(fullPath);
        if (!resolved.StartsWith(uploadsDir + Path.DirectorySeparatorChar))
            return BadRequest("Invalid path.");

        if (!System.IO.File.Exists(fullPath))
            return NotFound();

        System.IO.File.Delete(fullPath);
        return NoContent();
    }

    // ---- Helpers ----

    private static string? DetectMime(byte[] header, int read)
    {
        foreach (var (mime, magic) in AllowedSignatures)
        {
            if (read < magic.Length) continue;
            if (header.Take(magic.Length).SequenceEqual(magic))
                return mime;
        }
        return null;
    }

    private static bool IsValidFilename(string filename)
    {
        if (string.IsNullOrWhiteSpace(filename)) return false;
        if (filename.Contains('/') || filename.Contains('\\') || filename.Contains("..")) return false;
        var ext = Path.GetExtension(filename).ToLowerInvariant();
        return ext is ".jpg" or ".png";
    }
}
