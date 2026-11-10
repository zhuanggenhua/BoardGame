# 山中小屋第三版：小黑屋表现差距实玩记录

- 实玩入口：`https://yuanyigames.top/` → 单人模式 → 新的冒险。
- 实玩覆盖：多格移动、目的地预览/确认、`?` 探索、发现新房间、旋转/放置/确认、事件卡、理智/敏捷检定、伤害骰、预兆、灾厄揭露、叛徒/英雄阶段、十字弓远程攻击、怪物组两只机器人追击与攻击、伤害分配、交回下一轮。
- 实玩进度：旧局真实推进到第 6 轮；第 37 号灾厄「灵魂出窍」已触发；阮丹的十字弓攻击、机器人 1/2 的追击与攻击均已完成，已交回第 6 轮斯蒂芬妮回合。
- 证据目录：`evidence/betrayal-presentation-audit-20261011/`。
- 证据边界：本轮按用户要求不打开声音；结论以真实浏览器截图、GIF、AX/DOM 文本和操作步骤为主。声音部分只保留资源包中的 cue 结构作为提案线索，不称为本轮听感验证。

## 差距表

| ID | 玩家能感到什么 | 对方做什么 | 我方现在做什么 | 吸收？ | 依据 |
|---|---|---|---|---|---|
| M01 | 移动像战棋规划，先看到“能走到哪里” | 选中棋子后直接展示合法房间、步数角标；点目的地先出现路径/确认态，再沿路径走 | `Board.tsx` 先切 `interactionMode="move"`，再点房间，`MOVE_TO_ROOM` 与单次视觉过渡一起发；action bar 仍有 move / explore | 要 | 对方 DOM/CSS：`.reach`、`.reach-badge`、`.reach.selected`；我方 `src/games/betrayal/Board.tsx:4291-4331`、`actionBarReadModel.ts:121-135`；实玩步骤：点“选择走廊”→出现“走到这里 · 1 步”→确认 |
| M02 | 目的地一眼看懂，知道会经过哪些格 | SVG `.map-path` 虚线行军线 + 途经圆点，选中后持续预览 | 无路径线、无途经点；仅从源 token 直达目标矩形 | 要 | 对方 DOM/CSS：`.map-path polyline`、`.map-path circle`；我方 `visualTransitionSurface.tsx:286-305` 只对 `x/y` 做一次 Framer Motion 位移 |
| M03 | 移动预算是可读的，不用心算 | 合法房间右上角 `.reach-badge` 显示剩余步数；hover 显示房间名；选中房间 `.reach.selected` 脉冲 | 没有对方那种统一步数角标/房间名 hover/选中脉冲闭环；依赖 dock 文案“还有 N 步”和房间高亮 | 要 | 对方 CSS：`.reach-badge`、`.reach-name`、`.reach.selected`；我方 AX 实玩只见“还有 3 步/2 步”，仓内 `roomMapSurface.tsx:405-423` 只按 `interactionMode` 计算 target |
| M04 | 每走一格都能感到“走了一格”，不是瞬移 | `.token.walking.hop-0/1` 每格约 0.3s 抬升 16px；每格落地 `map-ripple`，再进入下一格 | `BetrayalVisualTransitionLayer` 560ms 从源中心到目标中心，一次直线飞行；无逐格 hop、无每格落点效果 | 要，P0 | 对方 CSS：`.token.walking.hop-0/1`、`@keyframes token-hop-a/b`、`.map-ripple`；我方 `visualTiming.ts:1`、`visualTransitionSurface.tsx:286-305` |
| M05 | 到达目的地有“落点”和镜头确认 | 落点 `map-ripple` + 地图飘字；镜头 focus + zoom 到目标 | 只在过渡前后调用 `focusRoomOnMap`，没有落点 ripple / map-pop；镜头反馈不形成到达节拍 | 要，P0 | 对方 DOM/JS：`.map-ripple`、`map-pop`、`map-light`；我方 `Board.tsx:4302-4324` 只有 focus 定时调用 |
| M06 | 走木地板、地下石、楼梯是三套脚感 | `step.wood` / `step.stone` / `step.stairs` 每格播放，gap 60ms；新房间还叠加 `door.open` / `room.enter` | `EXPLORER_MOVED` 只解析一个 `BETRAYAL_MOVE_KEY`；没有按地板/楼梯逐格拆 cue | 要，P0 | 对方 JS：`step.wood`、`step.stone`、`step.stairs`、`gap:60`；我方 `src/games/betrayal/audio.config.ts:156-181` |
| E01 | 探索是地图上的发现动作，不是切模式 | 门口大号 `?`；可探索的 `.door-hint.on` 呼吸灯；点 `?` 直接发探索 | 当前主要由 dock 的 `explore` action 进入探索模式，再点目标房间；房门没有对方那种可点呼吸 `?` | 要（直选/? 已锁定，本文补演出与反馈） | 对方 DOM/CSS：`.door-hint`、`.door-hint.on`、`hint-breathe`；我方 `actionBarReadModel.ts:131-135`、`Board.tsx:4411-4427`；实玩旧局多次点击“从 X 向上/下探索”完成探索 |
| E02 | 推门、画房、放板块、进房是连续一条发现链 | `door.open` → `tile.ink` → `tile.place` → `room.enter`；时间间隔和声音层次分明 | 探索事件有单一 `ROOM_EXPLORED` resolver，未按门/墨线/落板/进房拆出玩家可感的连续 cue | 要，P0 | 对方 JS：`door.open`、`tile.ink`、`tile.place`、`room.enter`；我方 `audio.config.ts:164-169` 只有 `ROOM_EXPLORED` 统一分派 |
| E03 | 新房间像“进入一个场景”，前后有淡出/入场 | 新房间发现使用 `.scene-bg` `scene-in` 暗到亮；人物 `.cut-figure` 走入；离场 `.phase-leaving` `walk-out`，到场 `.phase-arriving` `walk-in` | 我方已有发现/卡牌层，但实玩对比没有同等级的场景淡出、人物出入场与一套完整房间入场节奏 | 要，P1 | 对方 CSS：`.scene-bg`、`@keyframes scene-in`、`.cut-figure`、`.phase-leaving .scene-figures`、`.phase-arriving .scene-figures`；实玩旧局发现礼拜堂、坟场、军火库、冬季卧室时可见完整入场片段 |
| E04 | 地图不是纯黑平面，探索有光雾和空间感 | 2D canvas `.map-light` 挖暗房、给当前棋子径向光；不是 WebGL/GLSL | 我方无对应 canvas 光雾层，房间与 token 主要靠静态牌桌渲染 | 要，P1 | 对方 JS：`canvas.map-light`；资源包未发现 WebGL/GLSL；我方 `src/games/betrayal/roomMapSurface.tsx` 无同类 canvas 光照层 |
| T01 | “轮到你”是一个完整回合入口，skip 只跳片头 | 片头用 `.skip-layer` 全屏点击；`prompt.turn` 手铃两声；skip 压短剩余片头动画；同一回合不重复播 | 我方音频配置有 `TURN_ENDED`，但未形成独立“拿到行动权”的全屏片头/skip 层；action bar 直接回到可操作态 | 要；沿用已锁定 skip 语义 | 对方 DOM/JS：`.skip-layer`、`prompt.turn`；我方 `audio.config.ts:180-181` 有结束回合音效，但搜索不到 Betrayal 专用 turn-intro/skip 链；实玩旧局交回后对方片头只播一次 |
| U01 | dock 告诉我当前角色、剩余步数和场景，不抢地图主操作 | Dock 是角色立绘 + 剩余步数 + 情境 chip，不放移动/探索/交易/使用/结束整排入口 | 我方 `actionBarReadModel` 明确维护 move / explore / trade / use / roomEffect / endTurn 六类动作 | 要，P2 | 对方 DOM：dock 结构与情境 chip；我方 `src/games/betrayal/actionBarReadModel.ts:121-190` |
| A01 | 攻击是一次完整的 VS 对决，不是点按钮后突然出结果 | 选择武器后展示双方属性、立绘、骰子、结果和“没打中/受伤”结论一屏完成；十字弓明确敏捷、相邻板块、失手不受伤 | 我方已有 `attackImpactSurface` / `attackStateModel` / 视线与投骰接线；本次已完成英雄→怪物、怪物→英雄两条自然攻击链 | 要，P2 | 实玩：阮丹用十字弓攻击保安机器人 2，`敏捷对决 3 对 6：没打中，阮丹不受伤`；随后机器人 1→斯蒂芬妮、机器人 2→阮丹均出现 VS、双方骰子、结论层；关键帧保留在本轮浏览器截图中；我方 `src/games/betrayal/attackImpactSurface.tsx`、`Board.tsx:3304+` |
| A02 | 攻击入口本身要有清晰反馈 | 对方攻击 chip 初点没有明显变化，按 Enter 才打开攻击选择层；这是实测到的粗糙点，不吸收为优点 | 我方需要检查攻击 chip 点击后是否立即给出选择态/合法目标，不要只看已有 surface 是否存在 | 部分吸收：吸收信息结构，不吸收“按 Enter 才出现” | 依据：实玩步骤“点攻击 chip → 无明显变化 → Enter → 出现攻击选择层”；我方 `attackStateModel.ts` / `Board.tsx:2185-2202` |
| R01 | 事件/伤害不是一闪而过，结果能读懂 | 对方事件检定、敏捷检定、伤害骰分别有独立结果层；可怜的尤里克、崩塌的房间均能看到检定值与后果 | 我方已有 `recentRollSurface`、`damageAllocationSurface`，但应保证结果层顺序、归属、返回牌桌和稳定收口与实玩一致 | 要，P2 | 对方实玩：理智检定 5；敏捷检定 2→坠落；伤害骰 0；我方 `src/games/betrayal/damageAllocationSurface.tsx`、`Board.tsx:6625+` |
| R02 | 卡牌、手牌、楼层切换都要保留在节奏里 | 对方发现军火库直接翻出“十字弓”，卡面可打开看武器属性；楼层 tab 直接切换并保持地图上下文 | 我方已有库存 rail、卡牌详情与楼层 tab；差距在发现/拿牌后是否有一套连续“发现→获得→可用”反馈 | 要，P2 | 对方实玩：军火库→十字弓→卡面详情；AX/UI 可见楼层按钮；我方 `inventoryCardSurface.tsx`、`Board.tsx` 楼层/库存接线 |
| G01 | 怪物回合要告诉玩家下一步，能看见移动/攻击槽位 | 对方显示“保安机器人组回合”、控制者、最短合法路线、每只攻击任选一次，并逐只给追击选择框；执行后回写“追击已完成，可选攻击一次”，再开放攻击 | 我方已有 `monsterActionReadModel` / `monsterActionSelectionReadModel` / `monsterActionResolutionModel`；本次实玩已完成机器人 1、机器人 2 的追击与攻击，并交回下一轮 | 要，P2 | AX/操作步骤：勾选机器人 1→`执行追击`→`追击已完成，可选攻击一次`→攻击斯蒂芬妮；结束后切机器人 2，重复同链；本轮截图记录 VS 与结算；我方 `Board.tsx:2673-2731`、`monsterActionReadModel.ts` |
| G02 | 受击不是一闪而过，伤害数值、属性扣减和确认点都看得懂 | 机器人攻击结算先显示大号 `−5/−7`、双方骰子与差值，再进入独立伤害分配层，最后回写“力量 4→3 / 敏捷 3→2”并确认返回牌桌 | 我方已有 `damageAllocationSurface`，但需保证机器人攻击也走同一条稳定链，不把伤害直接吞进结果日志 | 要，P2 | 实玩截图/AX：机器人 1→斯蒂芬妮显示 `受到 5 点物理伤害`，分配层提供“力量扣一点/敏捷扣一点”；机器人 2→阮丹显示 `受到 7 点物理伤害`，确认后回写力量变化并结束该怪物行动 |

## 提案增量建议

### P0：移动演出与声音

1. 把玩家移动拆成“选中 → 合法目标 → 路径预览 → 确认/执行 → 逐格移动 → 落点收口”状态链；移动规则命令仍只发 `MOVE_TO_ROOM`。
2. 为每条移动路径生成 SVG/Canvas 路径线与途经点，路径必须跟随当前地图缩放和楼层。
3. 将 560ms 单段飞行改为按 path 分段的逐格 hop；每格结束才能扣除/展示下一步。
4. 为木地板、地下石、楼梯拆分每格脚步 cue；保持现有 Howler/audio pipeline，不增加新音频引擎。
5. 增加落点 ripple、落点短飘字和目标房间 focus/zoom，且落点后清理 ghost / blocker。
6. 补“当前可走 N 格”的统一角标、hover 房间名、选中脉冲，移动预算变化与真实路径同步。

### P1：发现过场与光雾

7. 点 `?` 后串联 door-open、墨线绘房、板块落下、方向确认、人物 walk-in、room-enter 的视觉/音效节奏。
8. 给新房间做 CSS 场景层：暗到亮、人物走入、离场淡出；明确采用 CSS keyframes + DOM，不引入 WebGL。
9. 增加 2D canvas 地图光雾：未知区域压暗、当前棋子径向光、落点附近短时提亮；不抄对方配色与素材。
10. 将发现过场和地图状态回收成稳定收口：过场结束后回到棋盘、当前角色、剩余步数和可继续操作态。

### P2：其它交互

11. 把攻击选择、VS 对决、骰子结果、伤害结论整理成同一屏可读的连续链；攻击 chip 点击必须立即出现选择反馈。
12. 统一事件检定 / 伤害分配 / 返回牌桌的结果层节奏；保证来源对象、骰子、数字和结论不互相遮挡。
13. 用统一怪物回合 panel 展示 controller、移动力、合法路径、攻击槽位与不可达原因；后续补真实可达目标局的怪物逐格走子验证。
14. 保留楼层切换、卡牌详情、手牌点选的现有信息结构，补“发现→获得→可用”的短反馈，不改规则数据。
15. 将“本机刚拿到行动权”的 turn-intro / skip 做成独立事件：拿到行动权播一次，自己回合内不重播，skip 只压片头。

## 不吸收

- 不抄对方配色、字体、墨线素材、角色皮肤和整体视觉皮肤。
- 不改 `src/`、不改 OpenSpec、不提交、不发布。
- 不把“有追击控件”扩大成完整逐格怪物走子动画已验收；本次确认了追击→攻击→伤害链，怪物逐格 hop 仍需后续可视化专项验证。
