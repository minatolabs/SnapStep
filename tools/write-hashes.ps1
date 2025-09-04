param(
  [string]$Root = "$PSScriptRoot\..",
  [string]$Out  = "$PSScriptRoot\..\SnapStep.Server\TamperInfo.cs"
)

$targets = @(
  "wwwroot\app.min.js"
)

$lines = @()
$lines += "namespace SnapStep.Server {"
$lines += "  internal static class TamperInfo {"
$lines += "    public static readonly (string Path, string Sha256)[] Files = new[] {"

foreach ($t in $targets) {
  $full = Join-Path (Join-Path $Root "SnapStep.Server") $t
  if (!(Test-Path $full)) { continue }
  $hash = (Get-FileHash $full -Algorithm SHA256).Hash
  $rel  = $t.Replace('\','/')
  $lines += "      (`"$rel`", `"$hash`"),"
}

$lines += "    };"
$lines += "  }"
$lines += "}"
Set-Content -Path $Out -Value ($lines -join "`r`n") -Encoding UTF8
