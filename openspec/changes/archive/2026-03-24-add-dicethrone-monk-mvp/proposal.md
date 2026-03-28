# Change: 增加《王权骰铸》僧侣(1v1) MVP（3D 骰子优先）

## Why
当前项目已存在 `src/games/dicethrone/` 的原型，但尚未满足《王权骰铸》第2版规则的关键交互（8阶段、最多3次投掷/锁定、可用技能判定、状态效果、卡牌时机等），也未实现目标英雄“僧侣”的数据与可读的战斗UI。本变更旨在交付一个最小可玩的 1v1 僧侣对局闭环，并优先尝试 3D 骰子表现以提升高级感。

## What Changes
- 交付 **1v1 僧侣** 对局的最小可玩闭环：阶段 → 投掷/锁定 → 技能判定 → 结算（含防御阶段入口条件）→ 回合结束。
- 僧侣英雄数据落地：技能（含终极与防御）与状态效果（闪避/太极/击倒/净化）的堆叠与消耗规则。
- 卡牌系统首版实现：僧侣全量中文手牌（数据、抽/弃、出售换 CP、按颜色限制出牌时机）。
- UI 素材策略（首版）：
  - 素材目录：`public/assets/dicethrone/images/monk/compressed/`；通用素材目录：`public/assets/dicethrone/images/Common/compressed/`。
  - `monk-player-board.png` 与 `monk-tip-board.png` **合并为同一面板弹窗**展示（支持缩放/关闭），避免误读与复刻成本。
  - `monk-ability-cards.png` 作为手牌图集裁切渲染（全量中文），单卡尺寸为 328×529。
  - `monk-base-ability-cards.png` 作为基础能力图集：基础能力以“卡牌覆盖”的方式展示在玩家面板对应区域，交互仅需高亮/置灰。
  - 卡牌背景：`public/assets/dicethrone/images/Common/compressed/card-background.*`，前端引用遵循图片使用规范（`OptimizedImage` / `buildOptimizedImageSet`，`src` 传 `dicethrone/images/Common/compressed/card-background`）。
  - 顶部 HUD：顶部常驻显示对手头像、状态效果、对手最近投掷结果（骰面）与对手打出的技能牌（图集裁切缩略图）。
  - 查看对手不使用弹窗：通过点击对手头像**切换到对手视图**，该视图展示对手玩家面板+提示板，并隐藏手牌与骰盘等交互；返回后回到自己的主战斗视图。
  - `public/assets/dicethrone/images/Common/compressed/character-portraits.jpg` 用于“角色选择/对局HUD头像”。
  - 升级操作使用卡牌覆盖到面板对应区域以替换能力；玩家面板居中占据近半页面，骰盘位于玩家面板中间。
  - 玩家投掷/确认骰面后：面板中的“可用技能区域”高亮，其余不可用技能区域置灰。
  - 技能牌类型区分：**同一套手牌/同一牌库**中按类型字段区分“升级卡”(升级基础技能)与“技能卡”(作为技能使用)，仅流程与 UI 展示不同。
- 骰子表现优先使用 `react-three-fiber` 实现 3D 骰子（不强制物理模拟），并提供降级路径：3D → 伪3D → 2D。

## Impact
- Affected specs:
  - `specs/dicethrone-monk-mvp/spec.md`（新增能力规格）
- Affected code:
  - `src/games/dicethrone/`（现有原型将被扩展/重构以符合规则与“僧侣”内容）
- New dependencies（计划新增）:
  - `three`
  - `@react-three/fiber`
  - `@react-three/drei`
