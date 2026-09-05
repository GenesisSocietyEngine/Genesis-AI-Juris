# The approved raster baseline is win32/x64 with Poppler 25.07.0.
# Pin the upstream Windows package bytes as well as its advertised version.
# GitHub release: oschwartz10612/poppler-windows v25.07.0-0.
$ErrorActionPreference = 'Stop'
$releaseUrl = 'https://github.com/oschwartz10612/poppler-windows/releases/download/v25.07.0-0/Release-25.07.0-0.zip'
$expectedSha256 = '435e6265738470b7ae6498b8a298a4025bacb9349656207ef54d0f069687ce57'
$baseline = Get-Content parity/report-pdf-visual-baseline.v1.json -Raw | ConvertFrom-Json
if ($baseline.rasterizer.requiredSuiteVersion -ne '25.07.0') {
    throw 'Review the pinned archive when intentionally changing the PDF baseline'
}
$archive = Join-Path $env:RUNNER_TEMP 'Release-25.07.0-0.zip'
$destination = Join-Path $env:RUNNER_TEMP 'juris-poppler-25.07.0'
Invoke-WebRequest -Uri $releaseUrl -OutFile $archive
$actualSha256 = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -cne $expectedSha256) {
    throw "Poppler archive checksum mismatch: $actualSha256"
}
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
$executables = @(Get-ChildItem -LiteralPath $destination -Recurse -File -Filter pdfinfo.exe)
if ($executables.Count -ne 1) {
    throw 'Expected exactly one pdfinfo.exe in the pinned archive'
}
$binaryDirectory = $executables[0].DirectoryName
$versions = @{}
foreach ($tool in @('pdfinfo', 'pdftotext', 'pdftoppm')) {
    $executable = Join-Path $binaryDirectory "$tool.exe"
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw "Missing $tool executable"
    }
    $versionOutput = @(& $executable -v 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "$tool version check failed" }
    $firstLine = $versionOutput[0].ToString().Trim()
    if ($firstLine -cne $baseline.rasterizer.versions.$tool) {
        throw "Unexpected $tool version: $firstLine"
    }
    $versions[$tool] = $firstLine
    Write-Output $firstLine
}
"POPPLER_BIN=$binaryDirectory" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
@{
    source = $releaseUrl
    archiveSha256 = $actualSha256
    versions = $versions
} | ConvertTo-Json | Set-Content .artifacts/ci-logs/poppler-toolchain.json
