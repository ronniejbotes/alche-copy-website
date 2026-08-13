<#
.SYNOPSIS
  Real-time 60fps screen capture for the ALCHE rebuild study.

.DESCRIPTION
  The Playwright rig (capture-live.mjs) gives deterministic frames, but its video
  is re-encoded from a page-capture stream and drops detail on fast WebGL motion.
  This records the actual composited desktop with the Desktop Duplication API, so
  the drag inertia, spring return and scroll easing are captured as they render.

  Drive the site with your own mouse while this runs.

.PARAMETER Name
  Output basename, written to reference/screen/<Name>.mp4

.PARAMETER Seconds
  Recording length. Recording stops on its own — no keypress needed.

.PARAMETER Fps
  Capture framerate. 60 matches the site's animation loop.

.PARAMETER Window
  Optional window title substring. Captures just that window (GDI) instead of the
  full desktop. Full desktop is sharper and faster; use this only if you need a
  cropped result.

.PARAMETER Encoder
  auto (default) picks NVENC if the GPU supports it, else libx264 CRF 16.

.EXAMPLE
  .\tools\capture\record-screen.ps1 -Name logo-drag -Seconds 45

.EXAMPLE
  .\tools\capture\record-screen.ps1 -Name scroll-pass -Seconds 90 -Fps 60
#>

param(
  [string]$Name = "capture",
  [int]$Seconds = 60,
  [int]$Fps = 60,
  [string]$Window = "",
  [ValidateSet("auto", "nvenc", "x264")]
  [string]$Encoder = "auto"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = Join-Path $repoRoot "reference\screen"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$outFile = Join-Path $outDir "$Name.mp4"
if (Test-Path $outFile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $outFile = Join-Path $outDir "$Name-$stamp.mp4"
  Write-Host "[record] existing file kept; writing $([System.IO.Path]::GetFileName($outFile))"
}

# --- pick an encoder -------------------------------------------------------

function Test-Nvenc {
  $probe = & ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=256x256:rate=1 `
    -frames:v 1 -c:v h264_nvenc -f null - 2>&1
  return ($LASTEXITCODE -eq 0)
}

$useNvenc = $false
if ($Encoder -eq "nvenc") {
  $useNvenc = $true
} elseif ($Encoder -eq "auto") {
  Write-Host "[record] probing NVENC..."
  $useNvenc = Test-Nvenc
  if ($useNvenc) { Write-Host "[record] NVENC available" } else { Write-Host "[record] NVENC unavailable, using libx264" }
}

# --- build the input -------------------------------------------------------

if ($Window -ne "") {
  # GDI window grab. Software frames already, so no hwdownload needed.
  $inputArgs = @("-f", "gdigrab", "-framerate", "$Fps", "-i", "title=$Window")
  $filter = "format=yuv420p"
  $hwFrames = $false
} else {
  # Desktop Duplication — GPU frames, much lower overhead than gdigrab desktop.
  $inputArgs = @("-f", "lavfi", "-i", "ddagrab=output_idx=0:framerate=$Fps")
  $filter = $null
  $hwFrames = $true
}

$encArgs = if ($useNvenc) {
  @("-c:v", "h264_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-cq", "19", "-b:v", "0")
} else {
  @("-c:v", "libx264", "-preset", "veryfast", "-crf", "16")
}

# NVENC eats the D3D11 frames directly; libx264 needs them pulled to system memory.
if ($hwFrames -and -not $useNvenc) {
  $filter = "hwdownload,format=bgra,format=yuv420p"
} elseif ($hwFrames -and $useNvenc) {
  $filter = $null
}

$ffArgs = @("-hide_banner", "-y") + $inputArgs + @("-t", "$Seconds")
if ($filter) { $ffArgs += @("-vf", $filter) }
$ffArgs += $encArgs
$ffArgs += @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $outFile)

Write-Host ""
Write-Host "[record] $Seconds s at $Fps fps -> $outFile"
Write-Host "[record] go drive the site now"
Write-Host ""

& ffmpeg @ffArgs

if ($LASTEXITCODE -ne 0) {
  Write-Host "[record] ffmpeg exited $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

$size = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
Write-Host ""
Write-Host "[record] done - $outFile ($size MB)" -ForegroundColor Green
Write-Host "[record] extract stills:  ffmpeg -i `"$outFile`" -vf fps=30 reference\screen\$Name-%04d.png"
