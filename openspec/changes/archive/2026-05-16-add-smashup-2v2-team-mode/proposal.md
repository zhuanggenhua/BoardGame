# Change: Smash Up 可选 2v2 团队模式

## Why
当前 Smash Up 只有默认自由混战规则，4 人房无法切换到固定队伍玩法。需要在不影响现有 2/3/4 人自由混战的前提下，补一个默认关闭的可选 2v2 模式。

## What Changes
- 在 Smash Up 房间创建 / 本地对局设置中新增 `teamMode` 选项，并与 `titans` 放在同一组 setupOptions 中。
- `teamMode` 默认值为 `off`；仅 4 人房提供 `2v2` 选项。
- 开启后按固定座位分队：1&3 为一队，2&4 为一队。
- 开启后胜利条件改为“同队总 VP 达到 25 分即获胜”；若双方同一结算窗口同时达标，则继续使用团队最终分数比较，完全相同则不立即结束。
- 前端记分板与结束页补充团队目标 / 团队总分提示，避免仍按个人 15 VP 误导玩家。

## Impact
- Affected specs:
  - `smashup-team-mode`（新增）
- Affected code:
  - `src/games/smashup/manifest.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/teamMode.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/ui/SmashUpEndgame.tsx`
  - `public/locales/zh-CN/game-smashup.json`
  - `public/locales/en/game-smashup.json`
