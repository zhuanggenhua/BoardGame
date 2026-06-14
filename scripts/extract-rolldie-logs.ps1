# Extract rollDie-related logs from test output
npx vitest run src/games/dicethrone/__tests__/monk-coverage.test.ts -t "rollDie=莲花: 基础6伤害+获得闪避Token" 2>&1 | 
    Select-String -Pattern "rollDie|CHOICE_REQUESTED|flowHalted|halt" -Context 2,2 |
    Out-File -FilePath evidence/_shared/rolldie-logs.txt -Encoding utf8

Write-Host "Logs extracted to evidence/_shared/rolldie-logs.txt"
