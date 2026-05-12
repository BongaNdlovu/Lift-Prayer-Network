$ErrorActionPreference = "Stop"

$java = Get-Command java -ErrorAction SilentlyContinue

if (-not $java) {
  $candidates = New-Object System.Collections.Generic.List[string]

  if ($env:JAVA_HOME) {
    $javaHomeCandidate = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path $javaHomeCandidate) {
      [void]$candidates.Add($javaHomeCandidate)
    }
  }

  $commonCandidates = @(
    "C:\Program Files\Java\jdk-26.0.1\bin\java.exe"
  )

  foreach ($candidate in $commonCandidates) {
    if (Test-Path $candidate) {
      [void]$candidates.Add($candidate)
    }
  }

  if ($candidates.Count -gt 0) {
    $javaBin = Split-Path $candidates.Item(0) -Parent
    $env:PATH = "$javaBin;$env:PATH"
  }
}

firebase.cmd emulators:exec --only firestore "jest --config jest.rules.config.js --runInBand"
exit $LASTEXITCODE
