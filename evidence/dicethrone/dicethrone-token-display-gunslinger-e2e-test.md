# DiceThrone 枪手 Token 显示 E2E 证据

> 2026-06-05 当前有效口径：本文只保留枪手 `Quick Draw` 开局 `Loaded` token 显示的单链路 `L3` 证据，不代表枪手整英雄或枪手/武士整批当前完成态。当前若要判断枪手对象级残余、兄弟能力补审范围或整英雄口径，应以 `evidence/dicethrone/dicethrone-gunslinger-audit-2026-04-11.md`、`evidence/dicethrone/dicethrone-gunslinger-samurai-vs-legacy-audit-2026-04-06.md` 与 `src/games/dicethrone/rule/枪手录入核对.md` 为准。

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
- 本文不能外推 `Loaded` 其它获取/消耗链、`Duel`、`Bounty` 或整英雄 closeout。
