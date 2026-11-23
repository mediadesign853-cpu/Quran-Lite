param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('word', 'indesign')]
  [string]$Target,
  [Parameter(Mandatory = $true)]
  [string]$PayloadPath
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 may use the system OEM code page for redirected stdout.
# Electron reads this stream as UTF-8, so explicitly align the encodings to preserve Persian messages.
$script:QuranUtf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $script:QuranUtf8
$OutputEncoding = $script:QuranUtf8

function Write-Result([bool]$Ok, [string]$Message, [string]$Code = '') {
  $result = @{ ok = $Ok; message = $Message }
  if (-not [string]::IsNullOrWhiteSpace($Code)) { $result.code = $Code }
  $result = $result | ConvertTo-Json -Compress
  [Console]::Out.WriteLine("QURAN_RESULT:$result")
}

function Initialize-QuranComNative {
  if ('QuranComNative' -as [type]) { return }

  $source = @'
using System;
using System.Runtime.InteropServices;
public static class QuranComNative {
    [DllImport("oleaut32.dll", PreserveSig = true)]
    public static extern int GetActiveObject(
        ref Guid rclsid,
        IntPtr reserved,
        [MarshalAs(UnmanagedType.IUnknown)] out object ppunk
    );
}
'@
  Add-Type -TypeDefinition $source -Language CSharp
}

function ConvertTo-NormalizedExePath([string]$CommandLine) {
  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $null }
  $expanded = [Environment]::ExpandEnvironmentVariables($CommandLine.Trim())
  $exePath = $null

  if ($expanded -match '^\s*"(?<path>[^"]+\.exe)"') {
    $exePath = $Matches.path
  }
  elseif ($expanded -match '^\s*(?<path>.+?\.exe)(?:\s|$)') {
    $exePath = $Matches.path.Trim('"')
  }

  if ([string]::IsNullOrWhiteSpace($exePath)) { return $null }
  try { return [IO.Path]::GetFullPath($exePath).TrimEnd('\') } catch { return $exePath.TrimEnd('\') }
}

function Get-ComRegistrationCandidates(
  [string]$BaseProgId,
  [string]$ProcessName
) {
  $runningPaths = @()
  Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      if (-not [string]::IsNullOrWhiteSpace($_.Path)) {
        $runningPaths += [IO.Path]::GetFullPath($_.Path).TrimEnd('\')
      }
    }
    catch { }
  }

  # Discover registered ProgIDs at runtime instead of maintaining a list of release years.
  # The version-independent ProgID is always considered first; versioned ProgIDs are discovered
  # from the registry and matched to the executable path of the running application when possible.
  $progIds = @($BaseProgId)
  $prefix = "$BaseProgId."
  try {
    $progIds += [Microsoft.Win32.Registry]::ClassesRoot.GetSubKeyNames() |
    Where-Object { $_.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } |
    Sort-Object
  }
  catch { }

  $candidates = @()
  foreach ($progId in ($progIds | Select-Object -Unique)) {
    try {
      $progKey = [Microsoft.Win32.Registry]::ClassesRoot.OpenSubKey("$progId\CLSID")
      if ($null -eq $progKey) { continue }
      $clsidText = [string]$progKey.GetValue('')
      $progKey.Close()
      if ([string]::IsNullOrWhiteSpace($clsidText)) { continue }

      $comType = [Type]::GetTypeFromProgID($progId, $false)
      if ($null -eq $comType) { continue }
      $clsid = [Guid]$clsidText

      $serverPath = $null
      $serverKey = [Microsoft.Win32.Registry]::ClassesRoot.OpenSubKey("CLSID\{$clsid}\LocalServer32")
      if ($null -ne $serverKey) {
        $serverPath = ConvertTo-NormalizedExePath ([string]$serverKey.GetValue(''))
        $serverKey.Close()
      }

      $matchesRunningProcess = $false
      foreach ($runningPath in $runningPaths) {
        if ($serverPath -and [string]::Equals($serverPath, $runningPath, [StringComparison]::OrdinalIgnoreCase)) {
          $matchesRunningProcess = $true
          break
        }
      }

      $candidates += [pscustomobject]@{
        ProgId                = $progId
        Clsid                 = $clsid
        ComType               = $comType
        ServerPath            = $serverPath
        MatchesRunningProcess = $matchesRunningProcess
      }
    }
    catch { }
  }

  return @($candidates | Sort-Object `
    @{ Expression = { if ($_.MatchesRunningProcess) { 0 } elseif ($_.ProgId -eq $BaseProgId) { 1 } else { 2 } } }, `
    @{ Expression = { $_.ProgId } })
}

function Get-ComApplication(
  [string]$BaseProgId,
  [string]$ProcessName,
  [string]$ApplicationName
) {
  Initialize-QuranComNative
  $runningProcesses = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
  if ($runningProcesses.Count -eq 0) {
    throw "$ApplicationName يُرجى فتح مستند أولاً"
  }

  $candidates = @(Get-ComRegistrationCandidates -BaseProgId $BaseProgId -ProcessName $ProcessName)
  if ($candidates.Count -eq 0) {
    throw "لم يتم العثور على تسجيل $ApplicationName. يُرجى التحقق من تثبيت التطبيق أو إصلاحِ"
  }

  $attempts = New-Object System.Collections.Generic.List[string]
  $checkedClsids = @{}
  $beforeProcessIds = @($runningProcesses | ForEach-Object { $_.Id })

  # First attach to an already-running automation object if the application published one in ROT.
  foreach ($candidate in $candidates) {
    $clsidKey = $candidate.Clsid.ToString('D')
    if ($checkedClsids.ContainsKey($clsidKey)) { continue }
    $checkedClsids[$clsidKey] = $true

    try {
      $application = $null
      $clsid = [Guid]$candidate.Clsid
      $hr = [QuranComNative]::GetActiveObject([ref]$clsid, [IntPtr]::Zero, [ref]$application)
      if ($hr -eq 0 -and $null -ne $application) {
        return $application
      }
      $attempts.Add((('{0}: ROT HRESULT 0x{1:X8}' -f $candidate.ProgId, ([long]$hr -band 0xFFFFFFFFL))))
    }
    catch {
      $attempts.Add("$($candidate.ProgId): ROT $($_.Exception.Message)")
    }
  }

  # InDesign may be running without exposing its object through ROT. In that case COM activation
  # is the supported automation entry point (CreateObject/New-Object -ComObject equivalent).
  # The process must already be running; we never intentionally start a closed application here.
  $activationCandidates = @($candidates | Sort-Object `
    @{ Expression = { if ($_.MatchesRunningProcess) { 0 } elseif ($_.ProgId -eq $BaseProgId) { 1 } else { 2 } } })

  foreach ($candidate in $activationCandidates) {
    $application = $null
    try {
      $application = [Activator]::CreateInstance($candidate.ComType)
    }
    catch {
      $attempts.Add("$($candidate.ProgId): COM activation $($_.Exception.Message)")
      continue
    }

    if ($null -ne $application) {
      $afterProcessIds = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
      $newProcessIds = @($afterProcessIds | Where-Object { $beforeProcessIds -notcontains $_ })
      if ($newProcessIds.Count -gt 0) {
        $documentCount = -1
        try { $documentCount = [int]$application.Documents.Count } catch { }
        if ($documentCount -eq 0) {
          try { $application.Quit() } catch { }
        }
        throw "تأکد من فتح مستند $ApplicationName "
      }
      return , $application
    }
    $attempts.Add("$($candidate.ProgId): COM activation returned an empty object")
  }

  $attemptText = $attempts -join '; '
  throw "تعذّر إنشاء الاتصال مع $ApplicationName. التفاصيل: $attemptText"
}

try {
  if (-not (Test-Path -LiteralPath $PayloadPath -PathType Leaf)) {
    throw 'لم يتم العثور على بيانات الآية اللازمة لإدراج الهامش'
  }

  $payloadJson = [System.IO.File]::ReadAllText($PayloadPath, [System.Text.Encoding]::UTF8)
  $payload = $payloadJson | ConvertFrom-Json
  $ayahText = [string]$payload.text
  $referenceText = [string]$payload.reference

  if ([string]::IsNullOrWhiteSpace($ayahText) -or [string]::IsNullOrWhiteSpace($referenceText)) {
    throw 'نص الآية أو مرجعها فارغ'
  }

  if ($Target -eq 'word') {
    # Word exposes the current text container through StoryType:
    # 1 = main document text, 2 = existing footnotes, 3 = endnotes.
    $word = Get-ComApplication -BaseProgId 'Word.Application' -ProcessName 'WINWORD'

    if ($word.Documents.Count -lt 1) {
      throw 'افتح مستند وُرد أولاً'
    }

    $document = $word.ActiveDocument
    if ($null -eq $document) {
      throw 'لم يتم العثور على مستند Word حاول مرة أخرى'
    }

    $selection = $word.Selection
    $range = $selection.Range
    $storyType = [int]$range.StoryType

    # A nested native footnote cannot be created in Word. Keep both the ayah and
    # its address inside the current footnote as ordinary text instead.
    if ($storyType -eq 2) {
      $range.Text = "$ayahText $referenceText"
      $word.Activate() | Out-Null
      Write-Result $true 'تم إدراج الآية ومرجعها كنص داخل الهامش الموجود في Word' 'existing-footnote-text'
      exit 0
    }

    # Native footnotes are only inserted from the main document story. Do not
    # replace the user's selection in headers, endnotes, text boxes, or separators.
    if ($storyType -ne 1) {
      if ($storyType -eq 3) {
        throw 'المؤشر داخل حاشية ختامية في Word. لإنشاء هامش جديد، ضعه في متن المستند.'
      }
      throw 'لإدراج هامش حقيقي في Word، ضع المؤشر داخل متن المستند أو داخل هامش موجود.'
    }

    $start = [int]$range.Start
    $originalText = [string]$range.Text
    $originalFootnoteCount = [int]$document.Footnotes.Count

    try {
      # Replace selected text (if any), then add a native numbered footnote immediately after it.
      $range.Text = $ayahText
      $end = $start + $ayahText.Length
      $footnoteRange = $document.Range($end, $end)
      $null = $document.Footnotes.Add($footnoteRange, [Type]::Missing, $referenceText)
    }
    catch {
      # Avoid leaving an orphaned ayah in the document if Word rejects footnote creation.
      try {
        while ([int]$document.Footnotes.Count -gt $originalFootnoteCount) {
          $document.Footnotes.Item([int]$document.Footnotes.Count).Delete()
        }
        $restoreRange = $document.Range($start, $start + $ayahText.Length)
        $restoreRange.Text = $originalText
      }
      catch {
        # Preserve the original automation error; rollback is best-effort only.
      }
      throw
    }

    $word.Activate() | Out-Null
    Write-Result $true 'تم إدراج الهامش في Word' 'native-footnote'
    exit 0
  }

  if ($Target -eq 'indesign') {
    $indesign = Get-ComApplication -BaseProgId 'InDesign.Application' -ProcessName 'InDesign'

    if ($indesign.Documents.Count -lt 1) {
      throw 'افتح انديزاين أولاً'
    }

    $activeDocument = $indesign.ActiveDocument
    if ($null -eq $activeDocument) {
      throw 'لم يتم العثور على مستند InDesign مفتوح'
    }

    # Use the packaged JSX file as the single source of truth for InDesign behavior.
    # This keeps the source JSX and the code actually executed by PowerShell identical.
    $jsxPath = Join-Path $PSScriptRoot 'insert-footnote.jsx'
    if (-not (Test-Path -LiteralPath $jsxPath -PathType Leaf)) {
      throw 'فایل اسکریپت داخلی InDesign در کنار فایل ارتباطی برنامه پیدا نشد.'
    }

    $jsx = [System.IO.File]::ReadAllText($jsxPath, [System.Text.Encoding]::UTF8)
    if (-not $jsx.Contains('__QURAN_PAYLOAD_JSON__')) {
      throw 'قالب اسکریپت InDesign معتبر نیست.'
    }

    $payloadLiteral = $payloadJson
    $payloadLiteral = $payloadLiteral.Replace([string][char]0x2028, '\u2028').Replace([string][char]0x2029, '\u2029')
    $jsx = $jsx.Replace('__QURAN_PAYLOAD_JSON__', $payloadLiteral)

    $indesignResult = [string]$indesign.DoScript([string]$jsx, 1246973031)
    switch ($indesignResult.Trim()) {
      'QURAN_OK_EXISTING_FOOTNOTE' {
        Write-Result $true 'تم إدراج الآية ومرجعها كنص داخل الهامش الموجود في InDesign' 'existing-footnote-text'
        exit 0
      }
      'QURAN_OK_NATIVE_FOOTNOTE' {
        Write-Result $true 'تم إدراج الهامش في InDesign' 'native-footnote'
        exit 0
      }
      'QURAN_ERROR|NO_DOCUMENT' {
        Write-Result $false 'لم يتم العثور على مستند InDesign مفتوح'
        exit 0
      }
      'QURAN_ERROR|NO_SELECTION' {
        Write-Result $false 'ضع مؤشر الكتابة داخل إطار نص أو هامش موجود في InDesign أولاً'
        exit 0
      }
      'QURAN_ERROR|TEXT_REQUIRED' {
        Write-Result $false 'الموضع المحدد ليس نصاً قابلاً للتحرير في InDesign'
        exit 0
      }
      'QURAN_ERROR|FOOTNOTE_WRITE_FAILED' {
        Write-Result $false 'تعذّر إدراج النص داخل الهامش الموجود في InDesign'
        exit 0
      }
      'QURAN_ERROR|STORY_INVALID' {
        Write-Result $false 'تعذّر تحديد موضع صالح لإدراج النص في InDesign'
        exit 0
      }
      default {
        Write-Result $false 'تعذّر إدراج الآية والهامش في InDesign. تحقق من إطار النص وموضع المؤشر.'
        exit 0
      }
    }
  }
  throw 'التطبيق المستهدف غير مدعوم'
}
catch {
  $message = $_.Exception.Message
  if (
    $message -match 'Object reference not set to an instance of an object|NullReferenceException'
  ) {
    $message = 'يرجى تحديد إطار نص أو موضع إدراج صالح أولاً.'
  }

  if ([string]::IsNullOrWhiteSpace($message)) {
    $message = 'حدث خطأ غير متوقع.'
  }

  Write-Result $false $message
}
