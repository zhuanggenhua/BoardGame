# Change: 补齐山屋惊魂更多作祟剧本

## Why

当前 `betrayal` 已有作祟剧本 1（赤红杰克归来）、3（灰尘）、12（大宅饿了）、33（魔法相机）的正式代表链。事件牌合同里的 23 张正面事件均已进入正式运行事件牌堆；本变更用于记录 12、33 从门禁保护推进到代表链完成，并避免旧 evidence 继续沿用“运行牌堆少两张 / 12、33 仍被门禁挡住”的错误口径。

## What Changes

- 为作祟剧本 3（灰尘）、12（大宅饿了）、33（魔法相机）建立结构化剧本合同和正式运行态。
- 扩展现有 `scenarioConfig` / `game.ts` / `Board.tsx` / `ai.ts` 链路，让新增剧本复用正式领域命令、正式页面交互和正式 AI 决策，不新增临时剧本页或 Board-local 假状态。
- 在每个剧本完整实现且通过验证后，才把对应事件牌从“合同 locked / 运行态门禁”提升回正式运行事件牌堆。
- 更新半实现审计、事件牌审计、主 spec 视角和 E2E/领域证据，避免继续把门禁保护误写成剧本完成。

## Impact

- Affected specs: `betrayal-additional-haunts`
- Affected code:
  - `src/games/betrayal/scenarioConfig.ts`
  - `src/games/betrayal/game.ts`
  - `src/games/betrayal/Board.tsx`
  - `src/games/betrayal/ai.ts`
  - `src/games/betrayal/__tests__/**`
  - `e2e/betrayal/**`
- Affected docs/evidence:
  - `evidence/betrayal/betrayal-half-implemented-audit-2026-07-18.md`
  - `evidence/betrayal/betrayal-discovery-effect-audit-2026-07-02.md`
  - `evidence/betrayal/full-audit/object-l0-l4-matrix.md`
  - `docs/games/betrayal/master-spec-view.md`
  - `docs/games/betrayal/README.md`

## Approval Status

- Approved by user in the current conversation.
- Haunt 3（灰尘）formal representative gameplay implementation and verification are complete.
- Haunts 12（大宅饿了）and 33（魔法相机）now have formal representative runtime chains; deeper branches still require the same domain, UI/E2E, audit, and release checks before being claimed complete.
