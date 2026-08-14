# Mage Wars v56 卡面去复读与读卡尺寸前置回执

> 状态：`preflight-ready / open-design-artifact-only / media-generate-forbidden / human-review-not-allowed-until-ai-pass`。本回执用于 v56 Open Design artifact，目标是修正 v55 的卡面字段复写和读卡尺寸失败；不是进入真实 Board/UI 实现的批准。

## 本轮实际读取

| 类型 | 文件 / 来源 | 结论 |
| --- | --- | --- |
| 全局 UI 设计链路 | `D:\codex-home\skills\ui-design-pipeline\SKILL.md` | 卡面已有字段不得复写成 UI chip；看不清应放大、hover / focus 或详情检视 |
| 项目桌游 UI 出稿门禁 | `.spec/skills/boardgame-ui-imagegen/SKILL.md` | 当前可执行卡必须可读；卡牌浏览区要区分当前可执行、可浏览候选和归档入口 |
| 项目 UI 门禁 | `.spec/knowledge/standards/ui-change-gates.md` | 卡面已有字段不得复写成标签墙；不可用小牌墙冒充主交互 |
| 项目 UI/UX | `.spec/knowledge/standards/ui-ux.md` | 正式素材已含信息时不得复读；重复信息不能靠填充制造“信息更满” |
| 法术书组成真相 | `docs/games/mage-wars/rule/apprentice-spellbooks.md` | 学徒法术书来自规则第 5 页；卡牌名和数量已有组成合同 |
| 区域锚点合同 | `docs/games/mage-wars/design/implementable/apprentice-zone-layout-contract.md` | 场上卡必须保持唯一所属区域，v56 不能为放大牌区牺牲区域锚点 |
| DiceThrone 参考 | `src/games/dicethrone/ui/HandArea.tsx`、`CardSpotlightOverlay.tsx`、`DiscardPile.tsx`、`CardPreview.tsx` | 成熟做法是卡图本体承载印刷字段，外部只补费用可支付、可用、inspect / spotlight 等运行态 |

## 规则到画面结论

| 规则 / 规范结论 | 影响主体 | v56 决策 / 禁止项 |
| --- | --- | --- |
| 卡图本身已包含卡名、费用、类型和正文 | 法术书候选、已计划法术 | 删除卡外可见卡名；不新增费用 / 射程 / 目标 chip |
| 若卡图看不清，问题是尺寸 / 检视机制，不是缺少外部文字 | 法术书浏览器、当前施法来源 | 同屏候选从 5 张降到 4 张并放大；当前来源卡放大到可读主对象；焦点候选加大而不复制字段 |
| DiceThrone 的卡牌区用 `CardPreview` 做本体，hover / spotlight 承担读卡 | 法术书候选、已计划法术 | v56 只抽取“不复读印刷字段 + 放大检视”的不变量，不继承 DiceThrone 皮肤或手牌术语 |
| 归档入口默认低权重 | 弃牌堆 | 继续保留卡背堆 + 数量，不展示顶牌正面，不与当前来源同权 |
| 目标选择必须由真实对象承接 | B2 西锁骑士、当前来源火球术 | 保留 B2 本体高亮、骰子 / token 锚点；不恢复目标摘要、大箭头或确认按钮 |

## 可见主体素材账本

| 主体 | 资源 / 来源 | 状态 | v56 呈现 |
| --- | --- | --- | --- |
| 学徒竞技场 | `refs/mage-wars-step1/standard-arena.jpg` | `visible-subject` | 底层规则空间，保留 2x3 区域语义 |
| 场上生物 / 魔物 | `spell-2803-flaming-hellion.png`、`spell-2909-knight-of-westlock.png`、`spell-2801-firebrand-imp.png`、`spell-2224-conjuration.png` | `visible-subject` | 保持唯一 `data-zone-id`，不得被放大牌区遮挡 |
| 法术书候选 | `spell-1901-nullify.png`、`spell-1806-block.png`、`spell-3701-lash-of-hellfire.png` | `visible-subject` | 1 张焦点可读卡 + 2 张邻近候选；分页承载其余候选，卡外不写卡名和费用 |
| 已计划法术 | `spell-1700-fireball.png`、`spell-1804-mage-bane.png` | `visible-subject` | 当前来源卡大幅放大；卡外只保留 `施法来源` 和 `2 / 2` |
| 攻击骰 / 效果骰 | `attack-die-face-*.png`、`effect-die-d12-face.png` | `visible-subject` | 保留在目标附近结算层 |
| 伤害 / 燃烧 / 守卫 / 行动 token | `damage-token-front.png`、`burn-token.png`、`guard-token.png`、`action-marker-red-front.png`、`quickcast-marker-front.png` | `visible-subject` | 保留贴附关系，不省略 |
| 生命 / 法力 / 聚魔条 | 规则第 4 页与 `approved-programmatic-runtime-ui` | `approved-programmatic-runtime-ui` | 继续用清晰条形 UI，不复现法师状态板 |

## 空间预算与尺寸裁决

| 区域 | v55 尺寸 / 问题 | v56 预算 |
| --- | --- | --- |
| 法术书候选 | `90x136`，还在卡外写卡名补读卡；`126x190 / 150x226` 仍偏小，只够辨认图；`230x324` 只是可读边缘；左侧落位会压住 A3 场上卡 | 常规候选 `138x194` 只作浏览入口；焦点候选 `260x366` 承担读卡；法术书整体右移到 A3/B3 场上卡之间，不复写卡名 / 费用 |
| 已计划来源 | `124x175`，只够辨认，不够稳定读卡；`166x236` 仍不适合读完整牌面；`230x324` 只算边缘可读 | 来源卡 `260x366`，作为当前施法主对象 |
| 已计划次卡 | `76x107`，不可读 | 次卡 `126x178`，只作计划槽位；需要阅读时走检视 |
| 中央竞技场 | 不能因放大牌区遮挡场上卡和区域标签 | 法术书左移到不压 A3/B3 场上卡的开放底层区域；计划区覆盖右下低权重底纹，不压目标、骰子、token |
| 归档入口 | 公开可检视但非当前选择来源 | 继续小入口，不展示顶牌正面 |
| 弃牌堆落位 | 归档入口不得压住计划牌或当前来源 | 放在计划区上方空槽；保持卡背堆 + 数量，不展示正面顶牌 |

## 出图禁止项

- 禁止可见文字 `手牌`。
- 禁止卡外重复显示法术牌名、费用、射程、目标、类型、等级或正文。
- 禁止用费用 / 目标 / 射程 chip 代替读卡。
- 禁止恢复常驻 `确认 / 执行 / 取消`。
- 禁止删除骰子、效果骰、token、法术书、已计划法术、弃牌堆和对手已计划卡背。
- 禁止让放大的法术书 / 已计划区遮挡场上实体卡、区域标签、目标高亮、骰子或 token。
- 禁止让弃牌堆这类归档入口压住当前来源卡；归档入口必须给当前来源和场上对象让位。

## 人工验收状态

- 当前 v56 只是待渲染候选，`human-review-not-allowed`。
- 只有导出 PNG 后通过 AI 图面核验，才允许打开给用户人工验收。
