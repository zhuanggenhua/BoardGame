# DiceThrone Treant 槽位审计 2026-05-16

## 范围

- 角色：`treant`
- 问题：基础技能高亮 / 被动槽 / 防御槽映射异常
- 触发反馈：树精第一个技能正常，但被动出现可选标记；防御阶段高亮到倒数第二个技能

## 真相源

- 玩家板主图：
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\玩家面板.png`
- 运行时压缩图：
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\compressed\player-board.webp`
- 代码入口：
  - `D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\abilitySlotMapping.ts`
  - `D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\AbilityOverlays.tsx`

## 结论

- 这不是单纯“基础技能数组索引偏一位”。
- 根因先落在数据录入：Treant 玩家板图面合同没有在 intake 阶段写成正式录入口径。
- 直接原因是 Treant 沿用了旧共享槽位语义：
  - 被动 `quiet-cultivation` 被塞进普通技能槽；
  - `rooted` 被错误挂到 `calm`，并在旧实现里重复占了两个槽；
  - v2 实图的真实槽位顺序没有写进 Treant 的角色 override。
- 审计层的问题是：旧 evidence 没有把这份录入合同缺口识别并降级，因此错误的“已审过”结论继续存活了下来。
- 本轮已修复的映射合同：
  - `sky -> quiet-cultivation`（独立被动槽）
  - `lotus -> wild-growth`
  - `combo -> vengeful-vines`
  - `lightning -> nature-touch`
  - `meditate -> rooted`
  - `calm` 不再错误回退到 `rooted`

## 额外发现

- Treant 的卡图 / 面板录入仍存在更深一层的 intake 缺口：
  - 面板右下左侧还存在一格当前运行时代码未完整接线的基础技能位；
  - 现有 `treant` 卡图专属区也存在未完整回写到 `cards.ts` / locale 的对象。
- 这部分不会再用被动或防御槽去“硬填充”遮盖，但仍需后续按主真相源补齐。

## 验证证据

- Vitest：
  - 命令：`npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts`
  - 结论：通过。已锁定 `quiet-cultivation -> sky`、`rooted -> meditate`，并明确 `calm` 不得再命中 `rooted`。
- E2E：
  - 命令：`node scripts/infra/run-e2e-command.mjs dev e2e/dicethrone/dicethrone-treant-slot-mapping.e2e.ts`
  - 前置运行时：前端 `5173`、game server `20101`、API stub `21001`
  - 截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-slot-mapping.e2e\Treant 被动槽不应混入普通技能高亮，扎根应落在真实防御槽\01-treant-board-slot-contract.png`
  - 肉眼观察：
    - 左下紫色被动槽位于 Treant 玩家板独立被动位，不再混入普通技能区。
    - 右下槽位显示 `扎根`，位于真实防御位；原先错误高亮到倒数第二个技能的问题未再出现。
    - 测试同时断言了 `sky/combo/calm/meditate` 的 `data-base-ability-id` / `data-resolved-ability-id` 合同，其中 `calm` 为空，`meditate` 命中 `rooted`。

## 基建备注

- 本机 Windows 把 `6174/6274` 一带端口落在 excluded port range，导致标准 isolated runtime 很难稳定起服。
- 手工证据链最终使用的是：
  - 正常 Vite dev server（`5173`，`configLoader native`）
  - 预构建 game bundle（`20101`）
  - API stub（`21001`）
- 另外确认：`BG_VITE_FORCE_INLINE=1` 这条前端路线在本机会继续暴露第三方包 ESM/CJS 兼容问题，不适合作为本次 Treant 审计的最终证据链。
