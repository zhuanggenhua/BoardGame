# Change: 为大杀四方补齐在场泰坦的主动 ongoing 能力入口

## Why
当前大杀四方运行时只支持两类“玩家主动点击场上泰坦”的能力：

- `special`：通过 `ACTIVATE_SPECIAL` 激活；
- `talent`：通过 `USE_TALENT` 激活。

`Emperor Penguin / 企鹅帝皇` 暴露了第三类缺口：它的核心能力文本是“你可以从牌库顶打出随从至本基地中以代替打出通常随从”。这不是被动 buff，也不是 talent，更不是 set-aside special；它是一个发生在“泰坦已在场”期间、由玩家主动选择是否使用的 ongoing 替代入口。

如果继续把这类能力硬塞进 `special` 或 `talent`：

- 会让 `abilityTags` 与实际触发机制失真，违反 `D49`；
- 会把 `talentUsed`、`special` 限次、计分阶段 special 等现有语义污染掉；
- 后续再接同类泰坦时只能继续复制旁路逻辑，不能形成通用入口。

因此需要先为“在场泰坦的主动 ongoing 能力”建立正式契约，再基于这套契约实现 `Emperor Penguin`。

## What Changes
- 为大杀四方新增“在场泰坦的主动 ongoing 能力”能力类型与命令入口，与 `special` / `talent` 分离。
- 为泰坦静态数据补充显式的“可主动激活的 ability kind”声明，避免把所有 `ongoing` 都错误高亮成可点击。
- 在 UI 中为满足条件的在场泰坦提供独立激活入口，并在条件不满足时保持非激活状态。
- 用 `Emperor Penguin / 企鹅帝皇` 作为首个落地场景：允许玩家通过该入口，从牌库顶把一个合法随从打到该泰坦所在基地，以代替一次常规随从打出。

## Out of Scope
- 不在本变更中扩展“所有随从/行动卡的主动 ongoing”通用入口。
- 不在本变更中实现 `Moon Zero Three / 三号空间站`、`Time Box / 时间盒子` 等其它后续泰坦。
- 不在本变更中重写现有 `special` / `talent` 机制的全部 UI，只补与泰坦 ongoing 主动入口直接相关的部分。

## Impact
- Affected specs: `smashup-titans`
- Affected code:
  - `src/games/smashup/data/titans.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/abilityRegistry.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup/smashup-alien-terraform.e2e.ts`
- Risks:
  - 需要避免把被动 `ongoing` 错误地全部变成可点击能力。
  - 需要保证新入口不会误用 `talentUsed` 或 `ACTIVATE_SPECIAL` 的现有门禁。
