# DEUKRO26 MIPP-Import ohne Erweiterung.
# Startet Edge unsichtbar mit einem eigenen Profil, öffnet die MIPP-Liste, wartet, führt das Auslesen und den Import aus und beendet Edge wieder.
# Aufruf:   powershell -ExecutionPolicy Bypass -File mipp-import.ps1
# Einmal anmelden (sichtbares Edge-Fenster, danach schließen):   ... -File mipp-import.ps1 -Setup
# Regelmäßig: Windows-Aufgabenplanung (siehe mipp.html). Ergebnis steht in %LOCALAPPDATA%\DEUKRO26-Import\log.txt
param(
  [string]$Url = '__URL__',
  [int]$WaitSeconds = 10,
  [switch]$Setup,
  [string]$Browser = ''
)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'DEUKRO26-Import'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$log = Join-Path $dir 'log.txt'
function Log([string]$t) {
  $line = (Get-Date -Format 'dd.MM.yyyy HH:mm:ss') + ' ' + $t
  Add-Content -Path $log -Value $line
  Write-Host $line
}

if (-not $Url -or $Url -eq '__URL__') { Write-Host 'Bitte die MIPP-Adresse mit -Url angeben oder oben im Skript eintragen.'; exit 2 }

# Edge finden
$edge = $Browser
if (-not $edge) {
  $cands = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")
  foreach ($c in $cands) { if (Test-Path $c) { $edge = $c; break } }
}
if (-not $edge) { Log 'FEHLER Edge wurde nicht gefunden (Parameter -Browser nutzen).'; exit 2 }
$profileDir = Join-Path $dir 'profile'

if ($Setup) {
  Write-Host 'Edge öffnet sich. Bitte bei MIPP anmelden, dann das Fenster schließen.'
  Start-Process -FilePath $edge -ArgumentList @("--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', $Url) | Out-Null
  exit 0
}

# Der Programmtext für die Seite (Auslesen und Import)
$js = @'
__JS__
'@

$port = Get-Random -Minimum 20000 -Maximum 40000
$edgeArgs = @("--remote-debugging-port=$port", '--remote-allow-origins=*', "--user-data-dir=`"$profileDir`"", '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank')
$null = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru
$ws = $null
$script:id = 0

function Send([string]$method, $params) {
  $script:id++
  $msg = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  $seg = New-Object 'System.ArraySegment[byte]' -ArgumentList (,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  while ($true) {
    $buf = New-Object byte[] 65536
    $sb = New-Object System.Text.StringBuilder
    do {
      $rseg = New-Object 'System.ArraySegment[byte]' -ArgumentList (,$buf)
      $r = $ws.ReceiveAsync($rseg, [Threading.CancellationToken]::None).Result
      [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
    } until ($r.EndOfMessage)
    $o = $sb.ToString() | ConvertFrom-Json
    if ($o.id -eq $script:id) { return $o }
  }
}
function Eval([string]$expr) {
  $o = Send 'Runtime.evaluate' @{ expression = $expr; returnByValue = $true }
  return $o.result.result.value
}

$exit = 1
try {
  # Auf den Debug-Anschluss warten
  $page = $null
  for ($i = 0; $i -lt 60 -and -not $page; $i++) {
    try { $page = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json" | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $page) { throw 'Edge hat nicht gestartet (Debug-Anschluss fehlt).' }
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()

  $null = Send 'Page.enable' @{}
  $null = Send 'Page.navigate' @{ url = $Url }
  # Laden abwarten (bis 60 s), dann die Wartezeit
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    $st = Eval 'document.readyState'
    if ($st -eq 'complete') { break }
  }
  Start-Sleep -Seconds $WaitSeconds
  $null = Eval "window.__dekrResult = ''"
  $null = Eval $js
  $res = ''
  for ($i = 0; $i -lt 90 -and -not $res; $i++) {
    Start-Sleep -Seconds 1
    $res = Eval "window.__dekrResult || ''"
  }
  if (-not $res) { $res = 'FEHLER keine Antwort der Seite (Zeitüberschreitung)' }
  Log $res
  if ($res.StartsWith('OK')) { $exit = 0 }
} catch {
  Log ('FEHLER ' + $_.Exception.Message)
} finally {
  try { if ($ws) { $null = Send 'Browser.close' @{} } } catch { }
  Start-Sleep -Seconds 2
  # Reste beenden (nur Edge-Prozesse dieses Profils)
  try {
    Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like '*DEUKRO26-Import*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { }
}
exit $exit
