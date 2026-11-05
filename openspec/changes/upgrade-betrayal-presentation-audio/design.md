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
  - 房间发现有淡出/入场；普通相邻换房用 hop 表达空间连续性，特殊跨层/传送才采用对应出入场表现。
  - 「你的回合」片头可点 skip。
  - 声音层次更像小屋。
  - 游戏适配留在 `src/games/betrayal/`；按真实消费者扩展已有 `src/engine/mapRenderer/`，复用 FX/EventStream/AudioManager。
- Non-Goals:
  - 不上提平台模式。
  - 不修改其它游戏的适配和玩法；共享 Pixi 扩展须保持原消费者兼容。
  - 不换 Howler、不改 registry 资源布局。
  - 不改 `move` / `explore` 规则语义。
  - 不做踢人、热座、原生 WebSocket、自定义 shader 引擎。

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

- Decision: 小黑屋地图、房间、棋子与场景动效统一使用 Pixi，React 承载固定 UI。
  - Rationale: 用户最新明确采用 Pixi 完整做好小黑屋；参考站 CSS/2D canvas 只说明可借鉴的效果，不再限制目标渲染器。不引入第二套自定义 shader 运行时。

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

## 2026-10-13 实玩增量设计（已批准实施）

本节补足 [M1–M5、D1–D2、I1–I2/I4](../refactor-shared-pixi-map-renderer/reference-comparison.md)，不改变已锁定的直选、探索和 skip 入口。参考站 `walk-out / walk-in` 是来源描述；我方普通移动以本节 hop 合同为准。

### 移动的正式 owner 与时序

- 命令 handler 只提交既有命令；`EventStream` 中被接受的事实与现有视觉缓冲驱动移动。优先复用现有事件身份、来源快照与 FX 阶段，不建立第二套游戏状态或私有防重账本。
- 普通相邻房间一次移动对应一次 hop：来源唤醒 → 位移并抬起 → 落脚及短 ripple → 目标实体接管。源实体与运动投影不能双显；最后位置以权威状态为准。
- `0.3s / 16px` 仅作为初稿参数，在正常地图缩放、PC/窄屏实际观看后确定；不能只把 560ms 常量改短就称为完成。
- 当前 `MOVE_TO_ROOM` 只接收目标房间；第一切片不新增多格自动寻路。路径只展示已确认合法的相邻边和正式成本。后续若支持点击远处房间，必须另行确认逐格规则触发、费用、暂停和重新校验，不能一次跨越。
- 来源身份/位置必须来自已接受事件及其对应前态；不得从已经更新到终点的实体位置猜起点。现有事件缺字段时先核对所有生产者/消费者，选择最窄的事件或适配改动，不扩大领域状态。
- 普通行走、楼梯跨层、传送、强制位移分别映射表现；未知类型不得默认画一条穿墙轨迹。
- 实例完成由现有动画/sequence 完成回调释放相关操作，拒绝、Undo、回滚、切回合和卸载清理旧表现；地图检视不因无关装饰动画被全屏阻塞。

### 声音、镜头与发现

- 房间材质由正式配置声明，registry 提供木/石/楼梯脚步资源；未标材质的房间使用明确的通用脚步，不按中文房名猜材质。每步在落脚阶段触发一次；被拒绝的移动不响成功音。
- 开门、房间落下及发现声音各绑定自己的已发生阶段，复用 AudioManager；不可同时保留点击播放与事件播放两条链路。
- 自动镜头仅在当前对象/目的地不可见时做最小平移，不重置缩放；玩家拖动中取消本次跟随。投骰、详情打开/关闭不重置玩家机位。
- 发现遵守原有命令与规则顺序：声明/朝向仍由玩家选择，纯视觉阶段不添加「继续」。仅在正式揭示后展示可见房间及触发牌，不能因提前播放泄露未揭示信息。
- 光雾使用同一 Pixi 场景，限制到可见区域、复用 ticker 并在退出时销毁。低动态偏好关闭装饰性位移/呼吸/光雾运动，但保留来源、目的地和最终结果的可辨识反馈。

### 选择和阅读

先核查 `eventChoiceSurface`、`decisionActionDockSurface` 和现有分配组件；只有真实入口确认缺口才改。规则牌、候选、已选和下一步保持同屏稳定；每个状态只保留一处提交或收口动作。可逆分配从结果位置直接修改。检视与规则动作分区，关闭检视后保留原合法草稿和镜头；规则已变化导致草稿失效时按已有规则清理，不盲目恢复。

### 首切片验收

固定同一 viewer，从正式页面完成两次相邻移动（含相同方向）、一次被拒绝/中断移动、一个特殊移动、远端/AI 的同类移动。记录 source/travel/landing/settled；同时证明目标位置、费用、事件次数、音频调用和收口状态。声音调用断言不能替代听音；截图/录屏必须来自当前代码真实入口，未获得则标记未验收。UI 完成后 review 事件身份、清理、闭包和共享消费者，再跑相关回归。

### 最新迁移路径

先扩展现有 Pixi 场景以承载正式 atlas 房间、棋子与合法高亮，再迁移小黑屋相机/命中和运动表现。地图几何来自 roomMapModel；材质、裁切和棋子身份来自正式作者源。DOM 过渡适配只可用于未迁移的可访问交互/文字反馈，必须与 Pixi 使用同一显示变换，不以隐藏完整旧地图宣称完成。最终移除小黑屋旧地图绘制与旧移动投影，保留规则/选择/检视的 React owner。

## 当前返工补充：持续场景光照（2026-10-18）

持续房间光照由 `roomLightingSurface` 拥有：已发现房间的实际地图几何生成缓存透明遮罩，边缘十四像素柔化，遮罩交替七百毫秒过渡。纹理仅在房间几何变化时生成，普通相机拖动、缩放不重新栅格化；仍由同一个 Pixi 相机投影，不新增输入处理器。大地图遮罩最长边限制为二千零四十八像素。换楼层、缩减动态、组件卸载释放旧纹理。

当前行动角色柔光由 `explorerLightSurface` 拥有，第一次就绪九百毫秒扩张。逐格移动复用实际 Sprite 动画帧回调，不提前跳到规则终点；光照留在地面、不跟随棋子抬起。回调校验实体和动作标识，旧动作不能改新光照。该层不改规则、音频或网络。

新房间完整舞台、回合横幅和地图光照必须分开检查，不能用其中一个证明另外两个已通过。上述仍是待真实页面视觉验收的实现，不构成整体通过。
