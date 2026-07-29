# 法师战争 Step 1 Open Design Artifact v6 审计

> 状态：`AI_PASS / open-design-artifact / human-review-allowed / user-approval-pending / runtime-coordinate-mapping-pending`。本审计只针对 `mage-wars-step1-runtime-board-v6.html` 这个 Open Design artifact 代码设计稿及其 1920x1080 渲染截图；它不是 `od media generate` 生图结果，也不表示运行时 Board UI 已实现。

## 产物

| 项 | 路径 / 结果 |
| --- | --- |
| Open Design artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v6.html` |
| Open Design artifact 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v6.html.artifact.json` |
| 渲染审计截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v6.png` |
| 截图尺寸 | `1920x1080` |
| 截图字节 | `2760773` |
| 截图 sha256 | `4A10C76270D1F1C7A51E1B6177B71E95265C2845C88A975569FD3B8C777689EF` |
| 素材加载 | `31` 张图片全部 `complete` 且有自然尺寸 |
| 导出说明 | 使用 Playwright 渲染同一个 Open Design artifact HTML 产出审计截图；没有调用 `od media generate`、imagegen 或 media provider。 |

## 本轮启动自证

| 门禁 | 本轮结论 |
| --- | --- |
| 规则页段 | 已在本轮重新读取 `docs/games/mage-wars/rule/domain-modeling.md`、`apprentice-spellbooks.md`、`apprentice-card-atlas-contract.md`、`apprentice-card-field-contract.md`、`board-ui-preflight-matrix.md` 和已批准的 `step1-runtime-board-saturated-ui-design.md`。 |
| 规则到画面 | 学徒模式只呈现 `2x3` 竞技场本体；当前动作是邪术师以快速施法选择 `火球术` 目标；水平 / 垂直距离、隐藏计划 / 隐藏手牌、行动 / 快速施法 token、攻击骰 / 效果骰和自制生命 / 法力读数均直接影响画面。 |
| 正式素材输入链 | artifact 直接引用 Open Design 项目 `refs/mage-wars-step1/**` 的正式素材副本或正式 atlas crop，包括竞技场、法师牌、法术卡、法术卡背、行动 / 快速施法 token、守卫 / 伤害 token、攻击骰贴图。 |
| 程序化裁定 | 生命 / 法力 / 聚魔 / 伤害读数为 `approved-programmatic-runtime-ui`；蓝色效果骰为来源锁定程序化对象；状态板仍为 `reference-only`，未进入主界面。 |
| 人工验收状态 | AI 图面核验已通过，可以打开给用户人工验收；但用户尚未批准，不能说“人工验收通过”。 |

## 规则 / 素材核验

| 门禁 | 结论 |
| --- | --- |
| Open Design artifact 路线 | PASS：v6 是可编辑 HTML/CSS artifact，未调用 media 生图链。 |
| 学徒半场 | PASS：画面只显示玩家可见 `2x3` 学徒竞技场，不再显示未锁定的另一半场。 |
| 饱和交互状态 | PASS：同屏出现邪术师、女祭司、火烙魔婴、烈焰狱鬼、灰衣天使、皇家箭手、缠绕藤蔓和西锁骑士，并有守卫、燃烧、束缚、远程、近战威胁、伤害与当前目标状态。 |
| 当前动作链 | PASS：火球术从己方手牌抬升，火焰路径指向西锁骑士，`确认目标` / `取消` 贴近当前目标；玩家第一眼能按“卡牌 -> 目标 -> 确认”行动。 |
| 隐藏信息 | PASS：对手手牌与对手计划只使用卡背；己方计划单独显示正面，不再混成“对手计划 / 己方计划”一行。 |
| 素材主体 | PASS：棋盘、法师牌、法术牌、卡背、行动 token、快速施法 token、守卫 / 伤害 token 和攻击骰均由正式素材承担主体。 |
| 状态板裁定 | PASS：主 UI 未出现整张或裁切的法师状态板；生命 / 法力 / 聚魔 / 伤害使用贴近法师牌的自制读数。 |
| 少边框 | PASS：主要视觉由棋盘、卡牌、token、光区和路径承担；没有用大框体、玻璃栏或状态板面板替代 Mage Wars 主体。 |
| 主 UI 文案 | PASS：常驻文字以对象名、短状态、数值、按钮标签为主；无规则说明段落。 |
| 素材完整性 | PASS：截图中 31 张图片均加载成功，无破图、空白、`temp/` 临时裁图或状态板主面板。 |

## AI 图面裁决

```text
verdict: PASS
score: 93/100
hard_failures: []
issues:
  - evidence: 桌面右侧仍保留骰盘、对手手牌和计划区的大空域。
    impact: 不影响当前目标选择链路，但后续实现时需要根据真实窗口宽度收紧响应式布局，避免宽屏以外出现过散构图。
    fix: 前端实现阶段用真实 Board 截图验证桌面与移动横屏，必要时让骰盘随目标结算层靠近当前对象。
  - evidence: v6 使用裁切后的 2x3 玩家可见竞技场，不锁定源图左 / 右半场运行时坐标。
    impact: 不阻塞设计稿人工验收；但不能直接作为运行时命中区真相源。
    fix: 人工验收通过后，进入实现前补 `board-coordinate-contract.md` 的真实区域映射和命中区截图。
```

## 玩家友好性逐项批判

| 画面细节 | 当前表现 | 是否对玩家友好 | 结论 | 理由 / 后续约束 |
| --- | --- | --- | --- | --- |
| 学徒竞技场 | 只显示一个 `2x3` 竞技场本体 | 是 | PASS | 玩家不再被“另一半棋盘是否可用”干扰；实现前另锁坐标即可。 |
| 当前状态 | 左上显示 `你的回合 / 选择火球术目标` | 是 | PASS | 短状态足够，不写规则说明。 |
| 当前法术 | 火球术从手牌区抬升 | 是 | PASS | 玩家能看到来源是手牌，不是独立说明面板。 |
| 当前目标 | 西锁骑士有高亮、命中点和 `当前目标` | 是 | PASS | 第一眼能判断选中的目标。 |
| 确认 / 取消 | 按钮贴在目标附近 | 是 | PASS | 目标选择后下一步清楚；触控高度 44px。 |
| 火焰路径 | 火球术到目标之间有红色路径 | 是 | PASS | 源头、方向、目标关系直观。 |
| 合法 / 非法状态 | `射程 0-2`、`越距`、目标区域光区 | 基本友好 | PASS-PARTIAL | 不常驻解释句；后续实现应把非法原因改成 hover / tap 短提示。 |
| 饱和对象 | 多个生物 / 魔物 / 法师同屏 | 是 | PASS | 符合饱和交互，不再是空桌或单对象状态。 |
| 对象状态 | 守卫、燃烧、束缚、远程、近战威胁贴近卡牌 | 是 | PASS | 状态归属清楚，未只放在日志里。 |
| 对手隐藏手牌 | 右上四张卡背 | 是 | PASS | 不泄露对手私有信息。 |
| 对手计划 | 两张卡背，单独标注 `对手计划` | 是 | PASS | 与己方计划分开，避免 v6 初稿的混合标签误读。 |
| 己方计划 | 单张正面计划卡，单独标注 `己方计划` | 是 | PASS | 自己可见正面，符合视角过滤。 |
| 法术书 | 左侧卡背堆 | 基本友好 | PASS-PARTIAL | 表示私密法术书存在；后续实现可增加点击展开而非常驻大面板。 |
| 法师 HUD | 血条、蓝条、聚魔、伤害贴近法师牌 | 是 | PASS | 符合用户要求，动态读数不用硬贴状态板素材。 |
| 行动 token | 红 / 蓝行动标记贴近法师 | 是 | PASS | 接近规则 setup 语义。 |
| 快速施法 token | 黑色 token + `将翻面` 贴近邪术师 | 是 | PASS | 状态由 token 承担，不靠远端文字面板。 |
| 骰盘 | 右侧显示 6 攻击骰 + 蓝色效果骰 | 基本友好 | PASS-PARTIAL | 骰源正确、无遮挡；后续实现可在结算时临时贴近目标。 |
| 边框 / 分区 | 主要没有厚边框 | 是 | PASS | 图面主语是棋盘和卡牌，不是 UI 容器。 |
| 主动作按钮墙 | 非当前 `移动 / 守卫 / 结束` 已视觉退场 | 是 | PASS | 当前目标选择态不再有多余主动作抢焦点。 |
| 常驻说明文案 | 无规则解释段落 | 是 | PASS | 主界面保持对象名、短状态和按钮标签。 |
| 视觉密度 | 物体很多但主链路仍清楚 | 是 | PASS | 饱和而不乱；中心仍是法术 -> 目标。 |
| 宽屏空域 | 左右仍有空间留白 | 可接受 | PASS-PARTIAL | 宽屏用于手牌、计划和骰盘；实现阶段需做响应式验证。 |

## 下一步准入

1. 本图可以打开给用户人工验收。
2. 用户若批准，`3.1.3` 可视为主 UI 视觉稿完成；进入实现前仍要补运行时坐标映射、真实 Board 命中区和桌面 / 移动横屏截图。
3. 用户若指出视觉仍不合格，v6 降为 `failed-candidate`，继续从本审计的问题点返工。
