## Context

小黑屋已有可玩 runtime：房间地图、移动过渡、攻击命中、作祟揭示、两套 BGM。交互是 dock 模式：先点「移动」再点高亮房间，先点「探索」再点 `?` 槽。这和项目 UI 门禁「行动入口默认落在正式对象本体」相反，也和参考站战棋式点选相反。

参考站（yuanyigames，压缩包核对）可迁移的不变量：

- 棋盘：合法房间 `can-move` / `reach`，点房间发 `move`；相邻门口是 `ghost` `?`，点它发 `explore`。
- 多对象：地图组件吃 `tokens` / `currentId` / `selected` / `onRoom` / `onGhost`。
- 房间入场：`.tile.fresh` → `tile-settle`（提亮+放大落下）；发现层 `scene-in`（暗→亮、轻微缩放）；棋子 `walk-out` / `walk-in`。
- 「你的回合」：`cr` 墨水标题 + `skip-layer` 全屏点击（`z-index:58; inset:0`）+ `.ink.fast` 把剩余 CSS 动画压到约 0.12s/0.2s。音效 `prompt.turn`（手铃两声，gap 1500）。HUD 另有「轮到你了」pill。
- 淡出观感像 shader：实际是 CSS `filter` / `clip-path` / `mix-blend`、SVG `feTurbulence` 噪声底、以及 2D canvas `destination-out`+blur 的 `map-light`。包内 **WebGL / GLSL 次数为 0**。

上一版错把 skip 写成「跳过 560ms 位移」。参考站其它 `skip` 字符串是规则选项（跳过选牌、跳过事件），不是片头。

「每次轮到你都播」和「只在从别人交回来时播一次」是同一事件：本机 `playerId` 刚成为行动者。已经在自己回合里不重播；别人回合不播。

## Goals / Non-Goals

- Goals:
  - 小黑屋对局按战棋方式走：选棋子、点房间、点 `?` 探索。
  - 房间发现和棋子换房有淡出/入场。
  - 「你的回合」片头可点 skip。
  - 声音层次更像小屋。
  - 改动限制在 `src/games/betrayal/`，最多复用现有共享动画 / FxBus / AudioManager API。
- Non-Goals:
  - 不上提平台模式。
  - 不改其它游戏。
  - 不换 Howler、不改 registry 资源布局。
  - 不改 `move` / `explore` 规则语义。
  - 不做踢人、热座、原生 WebSocket、WebGL shader 引擎。

## Current Betrayal Baseline

- 交互：`previewState.interactionMode` 在 `default | move | explore | ...` 间切换。`actionBarReadModel` 把 `move` / `explore` 做成 dock 项。`canStartExploreSelection` 为真时仍要先 `handleExploreAction` 再点槽。
- 教程：`open-move-targets` 高亮 `betrayal-action-move`，随后高亮 `betrayal-action-explore`。
- 表现：`visualTransitionSurface` 覆盖 explorer/monster 位移 560ms；攻击用共享 `DamageFlash` / `HitStop` / `Shake`；作祟揭示是顶部 cue。
- 音频：`audio.config.ts` 映射 registry Foley/BGM；作祟前 `Tip Toe`、作祟后 `Hostile Hotel`。没有 ambience 循环，没有回合手铃。

## Decisions

- Decision: 本 change 的 owner 是 Betrayal 棋盘交互 + 本游戏表现层，不是新的平台 runtime。
  - Alternatives considered: 先做 `PresentationDirector` 再 opt-in。
  - Rationale: 还没证明这套玩法和观感在小黑屋成立。

- Decision: 你的回合默认选中当前可控制棋子；有剩余移动时合法房间和 `?` 格直接可点，不再进入 `interactionMode === "move"`。
  - Rationale: 参考站和项目 UI 门禁都是本体直选。Dock「移动」是多余模式开关。
  - 作祟后多枚可控制棋子（怪物、附身、帮助之手等）：先点棋子，再点目的地。未选棋子时不发移动。

- Decision: 点相邻 `?` 即开始探索。UI 发已有 `explore` 命令；需要圣符/神像声明时，在点 `?` 之后出声明层，不把「探索」放回 dock。
  - Rationale: 参考站 `onExplore(side)` 挂在 ghost 格上。规则仍要玩家确认朝向/声明时，那是探索开始后的决策，不是第二套入口。

- Decision: dock 不再承载移动和探索。没有独立可执行动作时 dock 退场。
  - Rationale: `ui-change-gates`：上下文动作 dock 必须退场。

- Decision: 房间淡出走 CSS + 可选 2D canvas，不引入 WebGL。
  - Rationale: 参考站没有 shader 引擎。`ink-in` / `scene-in` / `tile-settle` / canvas 光雾已经能做出「像 shader」的淡出。为观感新建 shader 运行时是 YAGNI。

- Decision: skip 只服务「你的回合」片头（全屏点击层 + 加速剩余片头动画 + 收口这次手铃）。不作为移动/攻击/作祟读本的通用快进。
  - Rationale: 参考站 `skip-layer` 与 `cr` 标题同帧出现。

- Decision: 回合片头在本机座位成为行动者时播一次。这就是「每次轮到你」。
  - Rationale: 两个说法描述同一 `turnStarted`。

- Decision: 音频继续 registry + `audio.config.ts`。本轮只加 Betrayal 的 cue 选择、BGM 切换、环境循环和回合手铃。
  - Rationale: 全局混音会影响所有游戏。

## Promotion Gate

上提平台的前提，全部满足才另开 change：

1. 你在真实小黑屋对局里确认：棋盘直选、`?` 自动探索、房间淡出、「你的回合」skip、音频层次比现在好。
2. 能写出哪些是游戏美术（雾、小屋 stinger、房间图），哪些是可复用编排（片头 skip、棋盘直选模式）。
3. 上提方案仍然遵守现有 EventStream / FxBus / registry，不替换 pipeline 或 transport。

未过这三关，不得给其它游戏加开关，也不得改 `audio-system` 全局需求。

## Risks / Trade-offs

- 教程仍指向 dock 移动/探索 → 同轮改 `tutorial.ts` 高亮目标，否则教的是已删除入口。
- 场景层可能挡住点击 → 氛围/淡出层 `pointer-events: none`；skip 层只在片头期间拦截。
- 点 `?` 后仍要选朝向 → 这是规则决策，保留现有旋转/确认层。
- 环境循环音可能和 BGM 抢响度 → 只用 registry 低音量 loop。
- 以后抽取会有一次搬家 → 可接受。先做错平台 owner 的搬家成本更高。

## Migration Plan

1. 先改读模型和棋盘点击合同，让你的回合无需 `move` mode。
2. 把 `?` 格做成与合法房间同级的目的地。
3. 从 dock 拿掉 move/explore，更新 cue 文案。
4. 改教程高亮。
5. 再叠房间淡出和「你的回合」片头。
6. 最后加音频层次。
7. 回滚：交互改动与表现层可分开关；规则命令不变，回滚 UI 不会坏存档。

## Open Questions

无。skip 职责和回合片头时机已由参考站与你的纠正锁定。
