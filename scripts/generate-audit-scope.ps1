# 生成审查范围文档
$numstat = git diff --numstat 6ea1f9f^..6ea1f9f
$files = @()

foreach ($line in $numstat) {
    $parts = $line -split '\s+'
    if ($parts.Length -ge 3) {
        $add = if ($parts[0] -eq '-') { 0 } else { [int]$parts[0] }
        $del = if ($parts[1] -eq '-') { 0 } else { [int]$parts[1] }
        $path = $parts[2..($parts.Length-1)] -join ' '
        $files += [PSCustomObject]@{
            Path = $path
            Add = $add
            Del = $del
            Net = $add - $del
            Status = 'PENDING'
            Module = ''
        }
    }
}

Write-Host "总文件数: $($files.Count)"

# 分类模块
foreach ($file in $files) {
    if ($file.Path -like 'src/games/dicethrone/*') { $file.Module = 'DiceThrone'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'src/games/smashup/*') { $file.Module = 'SmashUp'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'src/games/summonerwars/*') { $file.Module = 'SummonerWars'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'src/engine/*') { $file.Module = 'Engine'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'src/server/*') { $file.Module = 'Server'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'src/components/game/framework/*') { $file.Module = 'Framework'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'src/core/*') { $file.Module = 'Core'; $file.Status = 'DONE' }
    elseif ($file.Path -like 'public/locales/*') { $file.Module = 'i18n' }
    elseif ($file.Path -like 'src/components/*') { $file.Module = 'Components' }
    elseif ($file.Path -like 'src/pages/*') { $file.Module = 'Pages' }
    elseif ($file.Path -like 'src/services/*') { $file.Module = 'Services' }
    elseif ($file.Path -like 'src/lib/*') { $file.Module = 'Lib' }
    elseif ($file.Path -like 'src/contexts/*') { $file.Module = 'Contexts' }
    elseif ($file.Path -like 'src/hooks/*') { $file.Module = 'Hooks' }
    elseif ($file.Path -like 'src/ugc/*' -or $file.Path -like 'src/games/ugc-wrapper/*') { $file.Module = 'UGC' }
    elseif ($file.Path -like 'src/games/tictactoe/*') { $file.Module = 'TicTacToe' }
    else { $file.Module = 'Other' }
}

# 统计
$audited = ($files | Where-Object { $_.Status -eq 'DONE' }).Count
$remaining = $files.Count - $audited

Write-Host "已审查: $audited 文件 ($([math]::Round($audited / $files.Count * 100, 1))%)"
Write-Host "待审查: $remaining 文件 ($([math]::Round($remaining / $files.Count * 100, 1))%)"

# 生成 Markdown
$md = @"
# POD 提交完整审查范围文档

## 文档说明

本文档记录 POD 提交（6ea1f9f）中每个文件的审查状态。

**创建时间**: 2026-03-04  
**总文件数**: $($files.Count) 个

---

## 审查进度统计

| 状态 | 文件数 | 百分比 |
|------|--------|--------|
| ✅ 已审查 | $audited | $([math]::Round($audited / $files.Count * 100, 1))% |
| ⏳ 待审查 | $remaining | $([math]::Round($remaining / $files.Count * 100, 1))% |
| **总计** | **$($files.Count)** | **100%** |

---

## 按模块分组

"@

# 按模块分组输出
$moduleGroups = $files | Group-Object -Property Module | Sort-Object -Property Count -Descending

foreach ($group in $moduleGroups) {
    $moduleName = $group.Name
    $moduleFiles = $group.Group
    $totalAdd = ($moduleFiles | Measure-Object -Property Add -Sum).Sum
    $totalDel = ($moduleFiles | Measure-Object -Property Del -Sum).Sum
    $totalNet = $totalAdd - $totalDel
    $netStr = if ($totalNet -ge 0) { "+$totalNet" } else { "$totalNet" }
    
    $auditedCount = ($moduleFiles | Where-Object { $_.Status -eq 'DONE' }).Count
    $moduleStatus = if ($auditedCount -eq $moduleFiles.Count) { 'DONE' } else { 'PENDING' }
    
    $md += @"

### $moduleName ($($moduleFiles.Count) files)

**总变更**: +$totalAdd -$totalDel (净: $netStr)  
**审查状态**: $moduleStatus

| 文件 | 变更 | 净变更 | 审查状态 |
|------|------|--------|----------|

"@
    
    foreach ($file in $moduleFiles) {
        $netStr = if ($file.Net -ge 0) { "+$($file.Net)" } else { "$($file.Net)" }
        $md += "| ``$($file.Path)`` | +$($file.Add) -$($file.Del) | $netStr | $($file.Status) |`n"
    }
    
    $md += "`n---`n"
}

# 保存文件
$md | Out-File -FilePath evidence/_shared/audit-scope-complete.md -Encoding UTF8
Write-Host "✅ 已生成完整审查范围文档: evidence/_shared/audit-scope-complete.md"

# 同时导出 CSV
$files | Export-Csv -Path tmp/all-files-changes.csv -NoTypeInformation -Encoding UTF8
Write-Host "✅ 已导出 CSV: tmp/all-files-changes.csv"
