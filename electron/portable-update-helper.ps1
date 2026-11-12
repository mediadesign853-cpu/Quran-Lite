param(
    [Parameter(Mandatory = $true)]
    [string]$JobFile
)

$ErrorActionPreference = 'Stop'
function Show-UpdateError([string]$Message) {
    try {
        $shell = New-Object -ComObject WScript.Shell
        [void]$shell.Popup(
            "به‌روزرسانی Quran Reader Lite انجام نشد.`r`n`r`n$Message`r`n`r`nفایل نسخهٔ قبلی در صورت امکان حفظ شده است.",
            0,
            'Quran Reader Lite — خطای به‌روزرسانی',
            16
        )
    }
    catch {
        # The app may be running on a Windows installation without WScript.Shell.
    }
}

function Get-Sha512Base64([string]$Path) {
    $algorithm = [System.Security.Cryptography.SHA512]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $hash = $algorithm.ComputeHash($stream)
        return [Convert]::ToBase64String($hash)
    }
    finally {
        $stream.Dispose()
        $algorithm.Dispose()
    }
}

$sourcePath = $null
$jobPath = $null
$stagePath = $null
$backupPath = $null
$targetPath = $null
$replacementCommitted = $false

try {
    $jobPath = [System.IO.Path]::GetFullPath($JobFile)
    if (-not (Test-Path -LiteralPath $jobPath -PathType Leaf)) {
        throw 'فایل اطلاعات عملیات به‌روزرسانی پیدا نشد.'
    }

    $job = Get-Content -LiteralPath $jobPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $sourcePath = [System.IO.Path]::GetFullPath([string]$job.sourcePath)
    $targetPath = [System.IO.Path]::GetFullPath([string]$job.targetPath)
    $expectedHash = [string]$job.expectedSha512
    $appProcessId = [int]$job.parentPid

    if ([System.IO.Path]::GetExtension($targetPath).ToLowerInvariant() -ne '.exe') {
        throw 'مسیر فایل Portable معتبر نیست.'
    }
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw 'فایل نسخهٔ جدید پیدا نشد.'
    }
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
        throw 'فایل نسخهٔ فعلی Portable پیدا نشد.'
    }
    if ($expectedHash -notmatch '^[A-Za-z0-9+/]{86}==$') {
        throw 'Hash مورد انتظار معتبر نیست.'
    }

    # Wait until the Electron process exits. The portable wrapper may release its
    # own file handle slightly later, so replacement below is retried as well.
    try {
        $parent = Get-Process -Id $appProcessId -ErrorAction Stop
        $parent.WaitForExit()
    }
    catch {
        # The app may already have exited before this helper starts.
    }

    $actualSourceHash = Get-Sha512Base64 -Path $sourcePath
    if ($actualSourceHash -cne $expectedHash) {
        throw 'صحت فایل دانلودشده در ابزار جایگزینی تأیید نشد.'
    }

    $targetDirectory = [System.IO.Path]::GetDirectoryName($targetPath)
    $stagePath = "$targetPath.quran-update-stage"
    $backupPath = "$targetPath.previous"

    # Check the target folder is writable before changing anything.
    $writeProbe = Join-Path $targetDirectory ('.quran-update-probe-' + [Guid]::NewGuid().ToString('N'))
    [System.IO.File]::WriteAllText($writeProbe, 'test')
    Remove-Item -LiteralPath $writeProbe -Force

    if (Test-Path -LiteralPath $stagePath) {
        Remove-Item -LiteralPath $stagePath -Force
    }

    Copy-Item -LiteralPath $sourcePath -Destination $stagePath -Force
    $stagedHash = Get-Sha512Base64 -Path $stagePath
    if ($stagedHash -cne $expectedHash) {
        throw 'کپی فایل جدید در پوشهٔ Portable کامل یا معتبر نیست.'
    }

    # The previous backup is only removed after a newly downloaded and verified
    # executable has been copied successfully beside the target executable.
    if (Test-Path -LiteralPath $backupPath) {
        Remove-Item -LiteralPath $backupPath -Force
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le 90; $attempt++) {
        $movedOld = $false
        try {
            [System.IO.File]::Move($targetPath, $backupPath)
            $movedOld = $true

            try {
                [System.IO.File]::Move($stagePath, $targetPath)
                $replacementCommitted = $true
                break
            }
            catch {
                if ($movedOld -and (Test-Path -LiteralPath $backupPath) -and -not (Test-Path -LiteralPath $targetPath)) {
                    [System.IO.File]::Move($backupPath, $targetPath)
                }
                throw
            }
        }
        catch {
            $lastError = $_
            if ($attempt -lt 90) {
                Start-Sleep -Seconds 2
            }
        }
    }

    if (-not $replacementCommitted) {
        throw "فایل Portable پس از چند تلاش قابل جایگزینی نبود. ممکن است فایل در حال استفاده یا پوشه فقط‌خواندنی باشد. $lastError"
    }

    try {
        Start-Process -FilePath $targetPath | Out-Null
    }
    catch {
        # Best-effort rollback if Windows cannot start the replacement executable.
        $failedPath = "$targetPath.failed-update"
        try {
            if (Test-Path -LiteralPath $failedPath) {
                Remove-Item -LiteralPath $failedPath -Force
            }
            if (Test-Path -LiteralPath $targetPath) {
                [System.IO.File]::Move($targetPath, $failedPath)
            }
            if (Test-Path -LiteralPath $backupPath) {
                [System.IO.File]::Move($backupPath, $targetPath)
            }
        }
        catch {
            # Keep both files if rollback itself cannot complete.
        }
        throw "ویندوز نتوانست نسخهٔ جدید را اجرا کند: $($_.Exception.Message)"
    }

    # The new app removes .previous after its window has loaded successfully.
}
catch {
    Show-UpdateError -Message $_.Exception.Message
    exit 1
}
finally {
    if ($sourcePath -and (Test-Path -LiteralPath $sourcePath)) {
        try { Remove-Item -LiteralPath $sourcePath -Force } catch { }
    }
    if ($jobPath -and (Test-Path -LiteralPath $jobPath)) {
        try { Remove-Item -LiteralPath $jobPath -Force } catch { }
    }
    if ($stagePath -and (Test-Path -LiteralPath $stagePath)) {
        try { Remove-Item -LiteralPath $stagePath -Force } catch { }
    }
}
