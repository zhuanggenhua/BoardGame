# DiceThrone Treant 槽位审计 2026-05-16

> 2026-06-05 当前有效口径：本文只保留 Treant 玩家板槽位/可视合同专项审计结论，不代表 Treant 整英雄或 Treant/Ninja 整批当前完成态。当前若要判断 Treant 对象级残余、兄弟能力补审范围或整批口径，应以 `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`、`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/treant录入核对.md` 为准。
>
> 2026-08-26 槽位覆盖说明：本文里“`calm` 为空”的断言只代表 2026-05-16 当轮为排除 `rooted` 错挂而记录的历史中间态，不再是当前玩家板合同。当前合同已由 `evidence/dicethrone/升级牌槽位全量回图审计-2026-07-04.md` 与 `src/games/dicethrone/rule/treant真相源表.md` 覆盖为：`calm -> wild-roar`，`lightning -> nature-touch`，`meditate -> rooted`。

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

> 2026-06-05 当前阅读门禁：本节保留的是 2026-05-16 做槽位专项审计时，基于当时代码与录入状态额外看到的**历史疑点**。这些疑点不能自动外推成 2026-06-05 当前仍存在的对象级 residual；若要判断这些点后来是否已被实现层、录入层或总汇总回写吸收，必须回到 `dicethrone-treant-full-audit-2026-05-16.md`、`dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/treant录入核对.md` 的现行矩阵。

- 2026-05-16 当轮曾继续怀疑：Treant 的卡图 / 面板录入可能还存在更深一层的 intake 缺口，包括“面板右下左侧仍有基础技能位未完整接线”“专属卡区仍有对象未完整回写到 `cards.ts` / locale”。
- 这些表述现在只能保留为**当轮怀疑与后续排查入口**，不能直接当作 2026-06-05 当前实现状态。后续补审已经把 Treant 多个基础对象、升级对象和 15 张专属卡推进到对象级 `L3`，当前若还有未完成项，也应统一落到批次级 `L4` 判等、旧文档统一回写与最终发布口径统一，而不是继续直接引用本节把它们表述成“当前仍未接线”。

## 同类扩审记录

- 搜索范围：2026-08-26 横向核对 `treant真相源表.md`、`treant录入核对.md`、`升级牌槽位全量回图审计-2026-07-04.md`、`AbilityOverlays.test.tsx` 与 `treant-ability-card-contract.test.ts` 中的 `calm / lightning / wild-roar / nature-touch / rooted` 槽位描述。
- 命中项：本文的 `calm` 空槽断言是历史中间态；`treant真相源表.md` 的旧“临时同时放行 / 待后续确认”口径已同步改为当前合同。
- 当前结论：树精当前玩家板槽位以 `calm -> wild-roar`、`lightning -> nature-touch`、`meditate -> rooted` 为准；本文保留为历史漏审复盘，不再作为当前槽位真相源。
- 漏审归因：旧审计证据停在“排除 rooted 错挂”的中间态，没有把右下左侧普通技能槽继续锁成 `wild-roar`，属于证据停在中间态和审计对象没建全集。

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
    - 当轮测试同时断言了 `sky/combo/calm/meditate` 的 `data-base-ability-id` / `data-resolved-ability-id` 合同，其中 `calm` 为空，`meditate` 命中 `rooted`。该 `calm` 空槽断言已被 2026-07-04 全量回图审计覆盖，当前只作为历史中间态保留。

## 基建备注

- 本机 Windows 把 `6174/6274` 一带端口落在 excluded port range，导致标准 isolated runtime 很难稳定起服。
- 手工证据链最终使用的是：
  - 正常 Vite dev server（`5173`，`configLoader native`）
  - 预构建 game bundle（`20101`）
  - API stub（`21001`）
- 另外确认：`BG_VITE_FORCE_INLINE=1` 这条前端路线在本机会继续暴露第三方包 ESM/CJS 兼容问题，不适合作为本次 Treant 审计的最终证据链。
