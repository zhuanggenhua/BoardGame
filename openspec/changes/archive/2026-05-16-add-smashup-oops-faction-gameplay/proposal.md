# Change: Smash Up Oops 四派系玩法实施

## Why
- `Ancient Egyptians / Cowboys / Samurai / Vikings` 四个派系已经完成图片、atlas、静态数据与 locale intake，但仍未实现正式玩法，当前只能显示卡图，不能按规则运行。
- 其中 `Ancient Egyptians` 和 `Vikings` 都依赖埋葬体系，现有领域层已经有一部分埋葬逻辑与 `vampires_pod` 先例，但缺少正式的派系实现与 UI 展示。
- 用户要求按“一个一个派系实施，全部完成后统一审计，再做端到端测试新交互类型”的顺序推进，不能把四个派系混成一团后再收敛。
- `Ancient Egyptians` 已经暴露出“`Bury this card` 出牌时未强制选择基地”的规则/实现偏差，说明如果把审计全部压到最后统一收尾，缺陷会在共享链路里滞留过久。

## What Changes
- 新增 `smashup-oops-faction-gameplay` 能力，定义 Oops 四派系的正式玩法交付标准。
- 新增 `smashup-oops-faction-audit` 能力，要求从 `Ancient Egyptians` 开始逐派系执行规则审计，而不是只在四派系全部实现后做一次总检查。
- 以分波次方式实施四个派系：
  - 第 1 波：`Ancient Egyptians`，优先补完埋葬主链路与埋葬 UI
  - 第 2 波：`Vikings`，复用并扩展埋葬/弃牌联动
  - 第 3 波：`Cowboys`，补完决斗、手牌数量判定、移动与破坏
  - 第 4 波：`Samurai`，补完荣誉决斗、自毁换杀、被动移动与替代去向
- 将“埋葬卡可见性、翻开、附着目标、决斗目标、替代去向”视为本轮新增交互类型，必须补到 UI 与 E2E，而不是只做领域逻辑。
- 每完成一个派系，必须立即完成该派系的规则对照审计、共享链路扩审、回归测试与 evidence；四个派系全部完成后的统一审计只负责汇总交叉问题与最终留证，不替代单派系审计。

## Impact
- Affected specs:
  - 新增 `smashup-oops-faction-gameplay`
  - 新增 `smashup-oops-faction-audit`
- Affected code:
  - `src/games/smashup/abilities/**`
  - `src/games/smashup/domain/**`
  - `src/games/smashup/ui/**`
  - `src/games/smashup/data/factions/{ancient_egyptians,cowboys,samurai,vikings}.ts`
  - `src/games/smashup/__tests__/**`
  - `e2e/**`
  - `evidence/**`
- Existing dependencies:
  - `domain/bury.ts` 与 `buriedCards` 状态模型
  - `vampires_pod` 的埋葬先例
  - 已完成的 Oops intake change `add-smashup-oops-faction-intake`

## Scope Boundaries
- In scope:
  - 四个派系的正式能力实现
  - 必要的 interaction handler / trigger / ongoing / replacement 行为
  - 埋葬 UI、决斗/选目标 UI、必要的玩家可见性处理
  - 按派系分波次推进，并在每一波完成后立即审计
  - 全量审计与新交互类型的 E2E
- Out of scope:
  - 其他扩展包派系的玩法补完
  - 全局视觉重构
  - 与四个派系无关的引擎大改
