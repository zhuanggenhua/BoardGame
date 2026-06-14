# Change: 通用局内交换座位入口（带阵营选择游戏接入）

## Why
当前 `dicethrone` 之外的对局缺少统一的局内换位入口，导致“开局先后手调整”在不同游戏不可达。  
需要把 HUD 入口通用化到所有“带阵营选择”的游戏，同时保留 `dicethrone` 四人旧入口体验。

## What Changes
- `MatchRoom` 增加通用换位入口模式映射：
  - `dicethrone` 使用 `request` 模式（保留申请/审批/取消语义）
  - `smashup` / `summonerwars` 使用 `instant` 模式（点击即换位）
- 换位入口统一使用 HUD 悬浮球，放在“操作日志”和“强制结束 AI 当前阶段”之间。
- App 运行时隐藏 HUD 全屏按钮（为换位入口腾挪空间）。
- 通用显示门禁：仅在可换位阶段显示；开局后隐藏。
- `summonerwars` 新增 `sw:swap_seat` 命令链（validate/execute/reduce/game commandTypes），用于即时换位并更新先后手。
- `smashup` 复用已有 `su:swap_seat`，补齐校验分支去重。
- `dicethrone` 四人模式保留旧选角换位入口；HUD 入口不替代旧入口。

## Impact
- Affected specs:
  - `inmatch-seating`（新增）
- Affected code:
  - `src/pages/MatchRoom.tsx` 与 `e2e/src/pages/MatchRoom.tsx`
  - `src/components/game/framework/widgets/GameHUD.tsx` 与 `e2e/src/.../GameHUD.tsx`
  - `src/games/summonerwars/domain/*` 与 `e2e/src/games/summonerwars/domain/*`
  - `src/games/summonerwars/game.ts` 与 `e2e/src/games/summonerwars/game.ts`
  - `src/games/smashup/domain/commands.ts` 与 `e2e/src/games/smashup/domain/commands.ts`
  - `e2e/summonerwars/summonerwars.e2e.ts`
