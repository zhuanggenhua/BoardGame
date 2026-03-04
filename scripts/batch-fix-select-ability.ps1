# 批量修复测试文件中缺少的 SELECT_ABILITY 命令

$fixes = @(
    @{
        file = "src/games/dicethrone/__tests__/paladin-coverage.test.ts"
        abilityId = "divine-shield"
    },
    @{
        file = "src/games/dicethrone/__tests__/pyromancer-coverage.test.ts"
        abilityId = "flame-shield"
    },
    @{
        file = "src/games/dicethrone/__tests__/shadow-thief-abilities.test.ts"
        abilityId = "shadow-guard"
    },
    @{
        file = "src/games/dicethrone/__tests__/moon-elf-abilities.test.ts"
        abilityId = "shadow-step"
    },
    @{
        file = "src/games/dicethrone/__tests__/moon-elf-shield-integration.test.ts"
        abilityId = "shadow-step"
    },
    @{
        file = "src/games/dicethrone/__tests__/righteous-combat-token-response.test.ts"
        abilityId = "divine-shield"
    },
    @{
        file = "src/games/dicethrone/__tests__/targeted-defense-damage.test.ts"
        abilityId = "shadow-step"
    },
    @{
        file = "src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts"
        abilityId = "meditation"  # 默认使用 Monk
    },
    @{
        file = "src/games/dicethrone/__tests__/cross-hero.test.ts"
        abilityId = "thick-skin"  # 狂战士
    }
)

foreach ($fix in $fixes) {
    $file = $fix.file
    $abilityId = $fix.abilityId
    
    if (Test-Path $file) {
        try {
            Write-Host "Processing $file..."
            $content = Get-Content $file -Raw -Encoding UTF8
            $pattern = "cmd\('CONFIRM_ROLL',\s*'1'\)\s*,\s*cmd\('ADVANCE_PHASE',\s*'1'\)"
            $replacement = "cmd('CONFIRM_ROLL', '1'),`n                    cmd('SELECT_ABILITY', '1', { abilityId: '$abilityId' }),`n                    cmd('ADVANCE_PHASE', '1')"
            $newContent = $content -replace $pattern, $replacement
            
            if ($content -ne $newContent) {
                Set-Content $file $newContent -Encoding utf8NoBOM -NoNewline
                Write-Host "  ✅ Fixed $file" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  No matches found in $file" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ Error processing $file : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  ❌ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`nDone!" -ForegroundColor Cyan
