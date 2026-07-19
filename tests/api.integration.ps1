$ErrorActionPreference = "Stop"

$port = 5099
$baseUrl = "http://127.0.0.1:$port"
$project = Join-Path $PSScriptRoot "..\backend\AiDj.Api.csproj"
$stdoutPath = Join-Path $env:TEMP "ai-dj-api-integration-$port.out.log"
$stderrPath = Join-Path $env:TEMP "ai-dj-api-integration-$port.err.log"
$process = $null

try {
  $process = Start-Process dotnet -ArgumentList @("run", "--project", $project, "--no-build", "--no-launch-profile", "--urls", $baseUrl) -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
      $health = Invoke-RestMethod "$baseUrl/health"
      if ($health.status -eq "ok" -and $health.service -eq "ai-dj-api") { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw "API did not become ready. See $stderrPath" }

  $status = Invoke-RestMethod "$baseUrl/api/status"
  if ($status.connectedClients -ne 0) { throw "Expected no connected clients at startup." }
  if ($status.participantClients -ne 0) { throw "Expected no participant clients at startup." }
  if ($status.outputConnected -ne $false) { throw "Expected outputConnected=false at startup." }
  if ($null -eq $status.roomState -or $null -eq $status.musicParams) { throw "Status response omitted roomState or musicParams." }

  $env:AI_DJ_TEST_BASE_URL = $baseUrl
  $frontendPath = Join-Path $PSScriptRoot "..\frontend"
  Push-Location $frontendPath
  & node --experimental-strip-types (Join-Path $frontendPath "src\signalr.integration.ts")
  Pop-Location
  if ($LASTEXITCODE -ne 0) { throw "SignalR integration test failed." }

  Write-Output "PASS API health and status integration"
} finally {
  if ($null -ne $process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}
