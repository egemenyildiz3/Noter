namespace Noter.Api.Models;

/// <summary>Simple key/value store for app settings.</summary>
public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}
