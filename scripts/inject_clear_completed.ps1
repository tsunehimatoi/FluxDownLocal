param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Update-SourceFile {
  param(
    [Parameter(Mandatory)] [string]$RelativePath,
    [Parameter(Mandatory)] [scriptblock]$Transform
  )

  $path = Join-Path $RepoRoot $RelativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Injection target not found: $path"
  }

  $original = [System.IO.File]::ReadAllText($path)
  $newline = if ($original.Contains("`r`n")) { "`r`n" } else { "`n" }
  $updated = & $Transform $original $newline
  if ($updated -ne $original) {
    [System.IO.File]::WriteAllText($path, $updated, $Utf8NoBom)
    Write-Host "Injected: $RelativePath"
  } else {
    Write-Host "Already injected: $RelativePath"
  }
}

function Add-BeforeAnchor {
  param(
    [string]$Text,
    [string]$Newline,
    [string]$Marker,
    [string]$Anchor,
    [string]$Content
  )
  if ($Text.Contains($Marker)) { return $Text }
  $Anchor = $Anchor.Trim([char[]]"`r`n") -replace "`r?`n", $Newline
  $index = $Text.IndexOf($Anchor, [System.StringComparison]::Ordinal)
  if ($index -lt 0 -or $index -ne $Text.LastIndexOf($Anchor, [System.StringComparison]::Ordinal)) {
    throw "Expected exactly one anchor: $Anchor"
  }
  $block = $Content.TrimStart([char[]]"`r`n") -replace "`r?`n", $Newline
  if (-not $block.EndsWith($Newline)) { $block += $Newline }
  return $Text.Insert($index, $block)
}

function Add-AfterAnchor {
  param(
    [string]$Text,
    [string]$Newline,
    [string]$Marker,
    [string]$Anchor,
    [string]$Content
  )
  if ($Text.Contains($Marker)) { return $Text }
  $Anchor = $Anchor.Trim([char[]]"`r`n") -replace "`r?`n", $Newline
  $index = $Text.IndexOf($Anchor, [System.StringComparison]::Ordinal)
  if ($index -lt 0 -or $index -ne $Text.LastIndexOf($Anchor, [System.StringComparison]::Ordinal)) {
    throw "Expected exactly one anchor: $Anchor"
  }
  $insertAt = $index + $Anchor.Length
  $block = $Content.TrimStart([char[]]"`r`n") -replace "`r?`n", $Newline
  if (-not $block.EndsWith($Newline)) { $block += $Newline }
  $block = $Newline + $block.TrimEnd([char[]]"`r`n")
  return $Text.Insert($insertAt, $block)
}

Update-SourceFile 'lib/src/models/download_controller.dart' {
  param($text, $nl)
  Add-BeforeAnchor $text $nl 'void deleteCompletedTasks()' '  String? get selectedTaskId' @'
  /// 清空所有本机已完成任务的记录，保留已下载文件。
  void deleteCompletedTasks() {
    final ids = _tasks
        .where((task) => task.status == TaskStatus.completed)
        .map((task) => task.id)
        .toList();
    logInfo(_tag, 'deleteCompletedTasks: ${ids.length} tasks');
    if (ids.isEmpty) return;

    _checkedTaskIds
      ..clear()
      ..addAll(ids);
    deleteCheckedTasks(deleteFiles: false);
  }

'@
}

Update-SourceFile 'lib/src/models/settings_provider.dart' {
  param($text, $nl)
  $text = Add-AfterAnchor $text $nl '_showTitlebarClearCompleted = true' '  bool _showTitlebarResumeAll = true; // 全部恢复按钮' @'
  bool _showTitlebarClearCompleted = true; // 清空已完成任务按钮
'@
  $text = Add-AfterAnchor $text $nl 'get showTitlebarClearCompleted' '  bool get showTitlebarResumeAll => _showTitlebarResumeAll;' @'
  bool get showTitlebarClearCompleted => _showTitlebarClearCompleted;
'@
  $text = Add-BeforeAnchor $text $nl 'void setShowTitlebarClearCompleted' '  void setShowTitlebarSettings(bool value)' @'
  void setShowTitlebarClearCompleted(bool value) {
    if (_showTitlebarClearCompleted == value) return;
    _showTitlebarClearCompleted = value;
    notifyListeners();
    _saveToRust('show_titlebar_clear_completed', value.toString());
  }

'@
  Add-BeforeAnchor $text $nl "case 'show_titlebar_clear_completed'" "        case 'show_titlebar_settings':" @'
        case 'show_titlebar_clear_completed':
          _showTitlebarClearCompleted = entry.value != 'false';
'@
}

Update-SourceFile 'lib/src/pages/settings_page.dart' {
  param($text, $nl)
  Add-BeforeAnchor $text $nl 'label: s.showTitlebarClearCompleted' @'
                _SettingRow(
                  label: s.showTitlebarSettings,
'@ @'
                _SettingRow(
                  label: s.showTitlebarClearCompleted,
                  description: s.showTitlebarClearCompletedDesc,
                  child: ShadSwitch(
                    value: settingsProvider.showTitlebarClearCompleted,
                    onChanged: (v) =>
                        settingsProvider.setShowTitlebarClearCompleted(v),
                  ),
                ),
'@
}

Update-SourceFile 'lib/src/widgets/header_bar.dart' {
  param($text, $nl)
  $text = Add-AfterAnchor $text $nl 'final showClearCompleted =' '    final showResume = settings?.showTitlebarResumeAll ?? true;' @'
    final showClearCompleted =
        settings?.showTitlebarClearCompleted ?? true;
'@
  $text = Add-BeforeAnchor $text $nl 'tooltip: s.clearCompletedTasks' '        if (showPause)' @'
        if (showClearCompleted)
          _ToolButton(
            icon: LucideIcons.trash2,
            tooltip: s.clearCompletedTasks,
            onPressed: controller.deleteCompletedTasks,
            iconSize: 16,
            onSecondaryTapUp: settings == null
                ? null
                : (d) => _showHideMenu(
                    context,
                    d.globalPosition,
                    () => settings.setShowTitlebarClearCompleted(false),
                  ),
          ),
'@
  $text = Add-AfterAnchor $text $nl 'settings.showTitlebarClearCompleted,' '          settings.showTitlebarResumeAll,' @'
          settings.showTitlebarClearCompleted,
'@
  if (-not $text.Contains('_toolButtonWidth * 5')) {
    $old = '_windowButtonsWidth + _toolButtonWidth * 4'
    $new = '_windowButtonsWidth + _toolButtonWidth * 5'
    if (-not $text.Contains($old)) { throw "Titlebar reservation anchor changed" }
    $text = $text.Replace($old, $new)
  }
  $text
}

Update-SourceFile 'lib/src/i18n/translations.dart' {
  param($text, $nl)
  $text = Add-AfterAnchor $text $nl 'String get clearCompletedTasks =>' "  String get resumeAll => _r('resumeAll');" @'
  String get clearCompletedTasks => _r('clearCompletedTasks');
'@
  Add-AfterAnchor $text $nl 'String get showTitlebarClearCompleted =>' "  String get showTitlebarResumeAllDesc => _r('showTitlebarResumeAllDesc');" @'
  String get showTitlebarClearCompleted =>
      _r('showTitlebarClearCompleted');
  String get showTitlebarClearCompletedDesc =>
      _r('showTitlebarClearCompletedDesc');
'@
}

Update-SourceFile 'assets/i18n/zh.json' {
  param($text, $nl)
  $text = Add-AfterAnchor $text $nl '"clearCompletedTasks":' '  "resumeAll": "全部恢复",' @'
  "clearCompletedTasks": "清空已完成任务",
'@
  Add-AfterAnchor $text $nl '"showTitlebarClearCompleted":' '  "showTitlebarResumeAllDesc": "在标题栏显示全部恢复按钮",' @'
  "showTitlebarClearCompleted": "清空已完成任务按钮",
  "showTitlebarClearCompletedDesc": "在标题栏显示清空已完成任务按钮",
'@
}

Update-SourceFile 'assets/i18n/en.json' {
  param($text, $nl)
  $text = Add-AfterAnchor $text $nl '"clearCompletedTasks":' '  "resumeAll": "Resume All",' @'
  "clearCompletedTasks": "Clear Completed Tasks",
'@
  Add-AfterAnchor $text $nl '"showTitlebarClearCompleted":' '  "showTitlebarResumeAllDesc": "Show resume all button in the titlebar",' @'
  "showTitlebarClearCompleted": "Clear Completed Button",
  "showTitlebarClearCompletedDesc": "Show the clear completed tasks button in the titlebar",
'@
}

Write-Host 'Clear-completed titlebar customization is ready.' -ForegroundColor Green
