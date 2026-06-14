# Change: DiceThrone 4 人玩家目标交互第一批收口

## Why
`add-dicethrone-2v2-team-mode` 已收口 4 人 / 2v2 的核心规则闭环，但“面向玩家目标”的技能、卡牌与状态转移交互并未完成全量审计。当前代码中已经存在多人化入口（如 `targetPlayerIds: Object.keys(state.players)`），但验证层、交互 UI 与 E2E 仍残留 2 人口径，特别是“任意玩家授 token”“移除玩家状态”“转移状态/可移除 token”这几类高风险路径。

如果不补这层专项收口，DiceThrone 会出现“2v2 主链路正确，但具体多人技能/卡牌交互仍可能带 2 人假设”的隐性缺口。

## What Changes
- 新增一条针对 DiceThrone 4 人 / 2v2 的“玩家目标交互兼容”收口 change，专门覆盖第一批高风险多人能力。
- 审计并收口以下第一批范围：
  - 任意玩家授 token 的技能交互（如 `Vengeance II`、`Consecrate`）
  - 任意玩家移除状态 / 移除全部状态的卡牌交互
  - 状态 / 可移除 token 在玩家之间转移的双阶段交互
- 收紧 `GRANT_TOKENS`、`TRANSFER_STATUS` 等命令的交互期验证，避免仅凭“有 pendingInteraction”就放行。
- 将相关交互 UI 从“2 人 self/opponent 视角”补到可稳定区分 4 人候选目标的版本，并补齐稳定测试锚点。
- 为第一批能力补齐 4 人版本的领域测试、组件测试和在线 E2E。

## Impact
- Affected specs: `dicethrone-team-mode`
- Affected code:
  - `src/games/dicethrone/domain/customActions/common.ts`
  - `src/games/dicethrone/domain/customActions/paladin.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `src/games/dicethrone/domain/execute.ts`
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/InteractionOverlay.tsx`
  - `src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx`
  - 现有 DiceThrone 相关 Vitest / Playwright 测试文件
