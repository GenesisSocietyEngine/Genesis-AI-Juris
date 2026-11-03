param([Parameter(Mandatory=$true)][string]$ScriptPath, [Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$trainingScript = Get-Content -LiteralPath $ScriptPath -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$trainingVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $trainingVoice.SelectVoice('Microsoft Zira Desktop')
  $trainingVoice.Rate = 0
  $trainingFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  foreach ($trainingScene in $trainingScript.scenes) {
    $trainingVoice.SetOutputToWaveFile((Join-Path $OutputDirectory ($trainingScene.id + '.wav')), $trainingFormat)
    $trainingVoice.Speak($trainingScene.narration.en)
    $trainingVoice.SetOutputToNull()
  }
  Write-Output ('Offline synthetic narration: ' + $trainingVoice.Voice.Name)
} finally { $trainingVoice.Dispose() }
