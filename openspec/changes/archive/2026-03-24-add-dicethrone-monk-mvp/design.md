## Context
- 首版范围：仅 1v1，仅英雄“僧侣”。
- 骰子表现：优先 3D（react-three-fiber），不稳定则降级为伪3D，再降级为纯2D。
- 牌：实现僧侣全量中文手牌，来源为 `public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png`.

## Goals / Non-Goals
- Goals:
  - 交付可玩的最小闭环：阶段流转 + 投掷/锁定 + 技能判定与结算 +（条件触发）防御阶段 + 状态效果 + 僧侣全量中文手牌的打出与效果.
  - UI 可读、布局稳定、动效有反馈.
- Non-Goals:
  - 多人/团战 Targeting Roll.
  - 全英雄库（首版仅僧侣）.
  - 真实物理掷骰模拟（首版不做）.

## Decisions
### 1) 3D 骰子只做“表现层”而非“规则层”
- 规则层仅依赖 `G.dice[].value`（由引擎层 `RandomFn` 决定，保证联机一致性）.
- 3D 仅渲染与动画：投掷时随机旋转，停下后“旋到”目标面（与 value 对齐）.

### 2) 使用僧侣骰面精灵图作为贴图源
- 贴图来源：`public/assets/dicethrone/images/monk/compressed/dice-sprite.png`（6面）.
- 3D 方案：将整张图作为纹理，针对 6 个面做 UV 裁切（或预切 6 张小图作为面贴图）.
- 降级：2D 直接按 value 显示对应切片.

### 3) 降级策略（可配置/可回滚）
- `renderMode = '3d' | 'pseudo3d' | '2d'`（默认 3d）.
- 3D 不可用的判据：依赖缺失、性能问题、移动端兼容性问题、纹理/面朝向难以稳定对齐.

### 4) 卡牌效果使用“数据驱动 + 小型效果解释器”
- 每张牌定义：`timing`(main/roll/instant)、`cpCost`、`effects[]`.
- `effects` 限定为 MVP 可实现动作集合（例如：抽牌、获得CP、修改骰面、施加/移除状态、造成伤害/治疗）.
- 首版按僧侣全量中文手牌建立数据表，并通过效果动作白名单控制复杂度.

### 5) 面板与卡牌素材的展示方式（以可读与一致为优先）
- 僧侣玩家面板与提示板：
  - `public/assets/dicethrone/images/monk/compressed/monk-player-board.png`
  - `public/assets/dicethrone/images/monk/compressed/monk-tip-board.png`
  首版作为**原图**合并成同一面板弹窗展示.
- 手牌图集：`public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png` 作为图集裁切渲染，单卡尺寸 328×529.
- 基础能力图集：`public/assets/dicethrone/images/monk/compressed/monk-base-ability-cards.png`（与手牌图集规格不同），用于将基础能力以“卡牌覆盖”方式展示在玩家面板对应区域.
- 卡牌背景：`public/assets/dicethrone/images/Common/compressed/card-background.*`，引用遵循图片使用规范（`OptimizedImage` / `buildOptimizedImageSet`，`src` 传 `dicethrone/images/Common/compressed/card-background`）。
- 对手查看方式：点击对手头像切换到“对手视图”（非弹窗）。对手视图展示对手玩家面板+提示板，不显示手牌与骰盘等交互；返回后回到自己的主战斗视图.
- 头像素材：`public/assets/dicethrone/images/Common/compressed/character-portraits.jpg` 用于角色选择与对局 HUD.
- 布局：玩家面板作为主视觉居中展示，约占半屏空间；骰盘嵌入玩家面板中部区域.
- 顶部 HUD：顶部常驻显示对手头像、对手状态效果、对手最近投掷结果（骰面）与对手打出的技能牌（图集裁切缩略图）.
- 对手状态效果：对手身上的状态效果以 `public/assets/dicethrone/images/monk/compressed/effect-icons.png` 图标+层数在顶部HUD/对手视图展示.
- 技能可用性反馈：玩家投掷并确认最终骰面后，面板中“可发动技能区域”高亮，其余技能区域置灰.
- 玩家面板尺寸兼容：不同英雄的玩家面板图片尺寸可能不同，能力区域/覆盖区域位置 MUST 使用相对定位（基于原图宽高的比例）配置，避免固定像素导致错位.

### 6) 英雄升级卡（Hero Upgrades）的理解与约束
- 升级卡仅能在自己的 Main Phase 1/2 打出.
- 升级卡用于将英雄图板上的某项能力从 I → II → III 升级（具体对应哪一项能力，以卡牌文本/图标为准）.
- 当升级到 III 且已拥有 II 时，只需支付两张卡之间的 CP **差价**（规则 5.1）.

### 7) 规则关键点（来自 PDF 的实现约束，影响交互与UI提示）
- 防御技能宣告：若有多个防御能力可选，防御玩家必须在掷防御骰前先宣告选择哪一个防御能力。
- 终极不可响应：终极从被触发到掷骰阶段结束，任何玩家不得采取任何行动；终极的伤害与效果可被增强，但不可被减少/避免/阻止/响应/中断（唯一阻止方式是在其触发前改变骰面结果）。

### 8) 技能牌类型区分与技能牌缩略图展示
- 技能牌分两类：升级基础技能（Hero Upgrades）与作为技能使用的技能牌；数据需标记类型并影响 UI/流程。
- 升级卡：进入升级流程并覆盖面板对应能力区域。
- 技能牌：作为技能使用时在技能展示区以技能牌缩略图显示（来源为 `public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png` 图集裁切，可附名称）。

## Risks / Trade-offs
- 3D 渲染引入依赖与复杂度：通过“只做表现层”降低同步/确定性风险。
- 牌效范围可能膨胀：通过效果动作白名单控制复杂度。
- UI 复杂且动态：使用 absolute/fixed 放置阶段横幅、反应窗口、浮动数字，避免挤压布局。

## 环境检查
- `package.json` 当前未包含 `three`、`@react-three/fiber`、`@react-three/drei`，需在实施阶段补充依赖。
