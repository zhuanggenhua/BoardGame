## 1. Implementation
- [x] 1.1 在 `src/games/dicethrone/` 明确首版范围：仅 1v1，仅僧侣；移除/替换原 `barbarian/moon_elf` 占位数据与资源引用。
- [x] 1.2 增加 3D 骰子依赖并在 Vite/React19 下通过构建：`three`、`@react-three/fiber`、`@react-three/drei`。
- [x] 1.3 重构 `DiceThroneState`：明确阶段、rollCount(0-3)、5 颗骰子（锁定）、玩家资源（HP/CP/手牌/牌库/弃牌/状态）。
- [x] 1.4 规则阶段流转（1v1）：Upkeep → Income（起始玩家首回合跳过）→ Main1 → Offensive Roll（最多3次）→ Defensive Roll（按“攻击/可防御伤害”触发，否则跳过）→ Main2 → Discard（手牌>6 必须出售至6；CP 不超过15）。
- [x] 1.5 掷骰系统：第一次掷 5 颗，后续可选择重掷未锁定；支持“锁定/解锁”；到第3次或玩家确认后进入技能选择与结算。
- [x] 1.6 僧侣技能数据与判定：建立结构化技能数据（判定/结算所需最小信息），并以 `public/assets/dicethrone/images/monk/compressed/monk-player-board.png` 作为展示素材（不复刻整张面板排版）；实现“相等/小顺/大顺/符号数量/倍数”判定器。
- [x] 1.7 状态效果实现：闪避(上限3)、太极(上限5)、击倒(不叠加)、净化(上限3)；按 `public/assets/dicethrone/images/monk/compressed/monk-tip-board.png` 处理获得、堆叠上限、消耗时机与效果。
- [x] 1.8 手牌/牌库/弃牌/出售：实现抽牌、弃牌、出售（每张+1CP，但 CP 封顶 15）、回合弃牌限制（>6 必须出售至6）。
- [x] 1.9 实现僧侣全量中文手牌的数据与效果：来源为 `public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png` 图集；建立卡牌数据表（名称/颜色时机/CP 成本/效果）；卡牌 UI 使用图集裁切渲染（单卡尺寸 328×529）。
- [x] 1.10 英雄升级卡流程：仅 Main Phase 1/2 可打出；I → II → III；升级到 III 且已拥有 II 时仅支付差价；升级卡以“覆盖卡牌”方式替换面板对应能力区域显示。
- [x] 1.11 UI：实现 `DiceThroneBoard` 的 1v1 布局；玩家面板居中占据近半页面，骰盘就是面板中部；面板弹窗同时展示“玩家面板+提示板”；顶部 HUD 展示对手头像、状态效果、对手最近投掷结果（骰面）与对手打出的技能牌（图集裁切缩略图）；对手查看通过点击头像切换到“对手视图”（非弹窗且隐藏手牌/骰子交互），对手视图展示对手玩家面板+提示板；保证可读性优先与布局稳定（动态UI使用 absolute/fixed）。
- [x] 1.12 头像图集接入：`public/assets/dicethrone/images/Common/compressed/character-portraits.jpg` 用于角色选择与对局 HUD，实现裁切配置。
- [x] 1.13 3D 骰子渲染：使用 r3f 显示 5 颗骰子；投掷时做关键帧旋转动画；停止后将面朝向与 `G.dice[].value` 对齐；支持降级到伪3D/2D。
- [x] 1.14 动画与反馈：掷骰、锁定、技能高亮、伤害浮字、阶段横幅（Framer Motion）。
- [x] 1.15 技能可用性高亮：玩家投掷并确认最终骰面后，可发动技能区域高亮，其余区域置灰；在对手视图与非掷骰阶段也应保持一致的可视状态。
- [x] 1.16 防御宣告交互：当存在多个可选防御能力时，在掷防御骰前必须先选择/宣告其一（参考 PDF 规则）。
- [x] 1.17 终极不可响应约束：终极触发后至掷骰阶段结束，禁止任何响应/中断操作；仅允许在触发前通过改变骰面来阻止其触发（参考 PDF 规则）。
- [x] 1.18 图集裁切配置：接入 `public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png`（单卡 328×529）与 `public/assets/dicethrone/images/monk/compressed/monk-base-ability-cards.png`（规格不同），并建立裁切映射供“顶部 HUD 技能牌缩略图/基础能力覆盖”使用。
- [x] 1.19 技能牌类型区分：升级基础技能的“升级卡”与作为技能使用的“技能牌”在数据、出牌流程与 UI 展示中做明确区分。
- [x] 1.20 玩家面板尺寸自适配：支持不同英雄玩家面板图片尺寸；能力区域/覆盖区域使用基于原图宽高比例的相对定位配置，避免固定像素导致错位。
- [x] 1.21 卡牌背景接入：使用 `public/assets/dicethrone/images/Common/compressed/card-background.*` 作为卡牌底图，前端引用遵循图片使用规范（`OptimizedImage` / `buildOptimizedImageSet`，`src` 传 `dicethrone/images/Common/compressed/card-background`）。

## 2. Validation
- [x] 2.1 `npm run lint` 无报错（游戏相关代码）。
- [x] 2.2 `npm run build` 通过。
- [x] 2.3 本地 1v1 对局走通：掷骰(≤3次)→锁定→发动技能→（可触发时）进入防御→结算伤害→回合结束。
- [x] 2.4 牌的时机限制生效：蓝/橙/红只能在对应窗口打出；出售与弃牌阶段规则生效；CP 不超过 15.
