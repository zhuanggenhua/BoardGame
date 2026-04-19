# DiceThrone 枪手 Token 显示 E2E 证据

## 用例
- 用例：`Quick Draw：枪手首回合真实 upkeep 后应获得 1 个装填`
- 文件：`e2e/dicethrone/dicethrone-hero-mechanics.e2e.ts`
- 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-hero-mechanics.e2e.ts "Quick Draw：枪手首回合真实 upkeep 后应获得 1 个装填"`

## 关键截图（已人工查看）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-new-passives\gunslinger-quick-draw-opening-loaded.png`

## 观察结论
- 玩家状态区 `status-tokens` 可见枪手 Token 徽章（装填 Loaded）。
- Token 徽章非空白，图标可见，并显示计数 `1/2`（符合枪手首回合获得 1 个装填的预期）。

## 备注
- 为了人工确认细节，临时放大查看文件：`D:\gongzuo\webgame\BoardGame\temp\inspect\gunslinger-quick-draw-opening-loaded-zoom.png`（仅作审阅辅助）。
