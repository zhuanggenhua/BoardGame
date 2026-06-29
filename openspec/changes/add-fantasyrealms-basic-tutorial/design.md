## Context

- `fantasyrealms` 当前已经有正式牌桌、多人/双人流程、计分与 AI，但没有教程加载器，也没有把教程系统接入引擎。
- 现有教程总线已经在 `MatchRoom` 路由、`games/registry.ts`、`manifest.client.generated.tsx` 与 `TutorialSystem` 中稳定存在，因此这次不应新开第二套路由或 tutorial runtime。
- `fantasyrealms` 当前正式回合只有四类命令：
  - `SET_FOCUS_CARD`
  - `DRAW_FROM_DECK`
  - `TAKE_FROM_DISCARD`
  - `DISCARD_CARD`
- 当前正式领域事件里，足够驱动基础教程的关键事件已经存在：
  - `CARDS_DRAWN`
  - `DISCARD_CARD_TAKEN`
  - `CARD_DISCARDED`
  - `FOCUS_CARD_SET`

## Goals / Non-Goals

- Goals:
  - 让 `fantasyrealms` 能通过标准教程路由进入基础教程。
  - 用当前正式牌桌讲清最核心的抓牌/弃牌循环。
  - 给牌桌补稳定的真实锚点，避免 manifest 里写了 highlightTarget 但 UI 上没有对应元素。
  - 用最小测试证明教程能力真实接线，而不是只存在文件。
- Non-Goals:
  - 不在本轮做 `fantasyrealms` 子教程目录、多路线教程或扩展包教程。
  - 不在本轮重做牌桌视觉系统或修复与教程无关的所有 UI 问题。
  - 不在本轮新增房间外的特殊教程入口。

## Decisions

### 1. 复用单教程 manifest，不先上教程目录

- `fantasyrealms` 本轮只缺“基础教程能力”本身，不缺“多子教程寻址”。
- 因此本轮直接新增 `src/games/fantasyrealms/tutorial.ts`，导出单个 `TutorialManifest`。
- 这样 manifest 生成脚本会自动为 `fantasyrealms` 接上 `loadTutorial`，不需要手改 generated 文件。

### 2. 在引擎层接入 TutorialSystem，而不是在 Board 里自建教程状态

- `fantasyrealms/game.ts` 目前只使用 `createBaseSystems()`，尚未包含教程系统。
- 本轮应显式改为和 `qidahen`、`smashup` 一样接入 `createTutorialSystem()`，让命令白名单、事件推进、固定随机策略都回到统一引擎层。
- 这样教程状态仍以 `G.sys.tutorial` 为唯一真相源，避免 Board 组件自持第二份教程进度。

### 3. 只给当前正式牌桌补真实锚点

- 教程高亮必须落在当前正式牌桌的真实元素上，不允许做 tutorial-only 假占位层。
- 本轮建议最少补以下锚点：
  - `fr-deck-draw-zone`
    - 挂在当前牌库抓牌区 `fantasyrealms-live-deck`
  - `fr-center-discard-zone`
    - 挂在中央公开弃牌区 `fantasyrealms-live-center-row`
  - `fr-hand-zone`
    - 挂在手牌区 `fantasyrealms-live-hand-zone`
  - `fr-action-draw`
    - 挂在摸牌动作按钮 `fantasyrealms-live-action-draw`
  - `fr-action-discard`
    - 挂在弃牌动作承接位 `fantasyrealms-live-action-discard`
- 若某一步实际交互是“直接点中央牌/手牌”而不是按钮，则教程内容以真实承接元素为准，按钮只做说明锚点。

### 4. 基础教程按“一个概念一个步骤”收窄

- 参考现有教程样式，本轮基础教程建议保持 5~7 步：
  1. `welcome`
     - 说明这是 Fantasy Realms 牌桌，核心目标是组成高分手牌。
  2. `draw-from-deck`
     - 高亮牌库或摸牌按钮，只允许 `DRAW_FROM_DECK`。
     - `advanceOnEvents: CARDS_DRAWN`
  3. `take-from-discard-explain`
     - 高亮中央公开弃牌区，说明也可以从这里拿牌。
     - 说明步骤，不强制动作。
  4. `discard-after-draw`
     - 高亮手牌区，只允许 `DISCARD_CARD`。
     - `advanceOnEvents: CARD_DISCARDED`
  5. `take-center-option`
     - 进入一个预置了中央公开弃牌的局面，只允许 `TAKE_FROM_DISCARD`。
     - `advanceOnEvents: DISCARD_CARD_TAKEN`
  6. `discard-after-take`
     - 若该预置局面会触发“拿中央后还要弃牌”，则只允许 `DISCARD_CARD`。
  7. `finish`
     - 说明公开弃牌达到阈值即终局，并回到正常计分逻辑。

### 5. 教程场景应优先用固定局面，而不是依赖真实发牌随机碰运气

- 仅靠现有对局 setup，很难保证“中央一定有可拿牌”“拿了中央后一定进入弃牌态”。
- 因此本轮基础教程如果要稳定演示两个不同分支，建议在 `tutorial.ts` 里通过：
  - `aiActions`
  - 固定 `randomPolicy`
  - 或必要的引擎级准备步骤
  来把局面推进到可教学状态。
- 若 `fantasyrealms` 缺少足够的 cheat/预置能力，本轮至少先完成“基础欢迎 + 从牌库抓牌 + 弃牌”主链，并在 tasks 里明确记录中央拿牌教学是否还需下一轮补更强预置能力。

## Risks / Trade-offs

- `fantasyrealms` 当前有自动开局抓牌逻辑，教程若直接落在双人空手开局，可能被自动摸牌副作用抢先推进。
  - Mitigation: 教程 manifest 需要选用不会被自动开局分支抢跑的局面，或在教程模式下显式控制首步。
- 当前牌桌里“摸牌”有时通过按钮承接，有时是自动触发；如果步骤和真实交互承接对象不一致，会导致教程描述误导。
  - Mitigation: 每个步骤先绑定真实命令，再决定 highlightTarget，避免倒过来先盯按钮。
- `createBaseSystems()` 与显式系统数组的改法不同，接入教程系统时可能会波及 undo/action-log 组装方式。
  - Mitigation: 优先保持现有 allowlist 与日志格式不变，只在系统编排层最小增量加入教程系统。

## Verification Plan

- OpenSpec:
  - `openspec validate add-fantasyrealms-basic-tutorial --strict --no-interactive`
- Vitest:
  - 新增 `tutorial.test.ts`，验证基础教程 manifest 结构、步骤 ID、关键事件推进与内容 key。
  - 新增或补充 `tutorialIds.test.ts`，扫描 `Board.tsx` 中必需的 `data-tutorial-id`。
  - 定向回归 `runtimeSkeleton.test.ts` / `Board.foundation.test.tsx`，确认教程接入不破坏现有 runtime 行为。
- Runtime:
  - 生成 manifest 后确认 `manifest.client.generated.tsx` 为 `fantasyrealms` 产出 `loadTutorial`。
  - 记录本轮 tutorial route 是否能解析出 `resolvedTutorialManifest`。
