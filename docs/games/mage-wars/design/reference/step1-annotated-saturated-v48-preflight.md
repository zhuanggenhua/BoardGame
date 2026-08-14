# Mage Wars 标注图饱和布局 v48 出图前硬回执

> 状态：`preflight-ready / open-design-artifact-only / media-generate-forbidden / human-review-not-allowed / implementation-blocked / mobile-blocked`。本轮只重构 PC Open Design 设计稿，不进入真实 Board/UI、真实运行页 E2E 或移动端适配。

## 本轮实际读取

| 类别 | 文件 / 来源 | 对 v48 的直接影响 |
| --- | --- | --- |
| 全局 UI 设计链 | `D:\codex-home\skills\ui-design-pipeline\SKILL.md`、`ui-audit-loop`、`frontend-design`、`existing-ui-design-baseline`、`game-design`、`ui-ux-pro-max` | 设计稿必须先有规则 / 素材 / 玩家任务证据；AI 自检 PASS 前不得打开人工验收 |
| 项目入口 | `AGENTS.md`、`docs/infra/open-design.md`、`.spec/knowledge/README.md`、`.spec/knowledge/standards/ui-change-gates.md`、`.spec/knowledge/standards/ui-ux.md`、`.spec/knowledge/standards/asset-pipeline.md`、`design-system/game-ui/MASTER.md` | Open Design artifact 是代码设计稿，禁止 `od media generate`；PC 未过前冻结实现和移动端；素材主体不能被文字壳替代 |
| Mage Wars 设计真相 | `step1-runtime-board-saturated-ui-design.md`、`v47-audit.md`、`apprentice-zone-layout-contract.md`、`board-coordinate-contract.md`、`board-ui-preflight-matrix.md` | v47 的三项失败必须修：对手计划左上镜像、问号区裁规则职责、分页改成书页边缘样式 |
| Mage Wars 规则 / 数据 | `apprentice-spellbooks.md`、`apprentice-card-field-contract.md` | 当前动作锁为邪术师已计划 `火球术`，目标为 `B2` 的 `西锁骑士`；91 张学徒卡字段完整，卡面字段由卡图承担 |
| 素材输入包 | `step1-runtime-board-asset-input-manifest.md`、Open Design `refs/mage-wars-step1/` | 竞技场、法师牌、火球术、法师祸咒、卡背、攻击骰、效果骰、伤害 / 燃烧 / 行动 / 快速施法 token 均有正式或来源锁定渲染来源 |

## 规则到画面结论

| 规则 / 合同结论 | 影响主体 | v48 设计决策 / 禁止项 |
| --- | --- | --- |
| 学徒竞技场是 `2x3` 半场；区域是移动、射程和目标判断单位 | 中央竞技场和场上卡 | 继续用正式竞技场图，六区 A1/B1/A2/B2/A3/B3 清楚可读；场上卡保留唯一 `data-zone-id`，不得骑线 |
| 计划法术来自法术书，自己看正面；对手只看卡背 / 数量 / 归属 | 底部法术书、己方计划、左上对手计划 | 对手已计划法术放左上镜像槽；己方已计划放右下小槽；禁止叫“手牌”，禁止公开对手牌名 |
| 当前动作是已计划 `火球术` 选择 `B2 西锁骑士` | 当前来源卡、目标高亮、目标摘要 | `火球术` 成为可读来源卡；场上 `火烙魔婴` 只保留为普通场上生物，不再高亮成来源 |
| 费用、射程、目标、骰数和效果已印在卡面 | 火球术卡面和法术书候选 | UI 不复写费用 / 射程 / 目标 / 效果字段；看卡面本体，不堆标签墙 |
| 攻击骰、效果骰、伤害和燃烧 token 是饱和态物理件 / 来源锁定对象 | 目标附近结算层 | 骰子和 token 保留在目标附近上层；不能因为“干净”省略，也不能移动到边栏 |
| 状态板是 reference-only，生命 / 法力 / 聚魔走运行态 UI | 法师 HUD | 法师牌上方 / 附近使用自制血条蓝条和短读数；不把整张状态板或裁切状态板铺成玩家面板 |

## 问号区裁决

| 用户标注 / 问号对象 | 规则身份 | v48 处理 |
| --- | --- | --- |
| 左下大“玩家区” | 没有独立规则身份；其内容已由法师 HUD 承接，token 已在法师 HUD 或宿主对象上出现 | 删除大玩家区外框和独立区域，避免生成第三个玩家面板 |
| 底部“当前来源”大卡 | 有规则身份，但必须是当前已选来源对象，不是场上普通生物 | 保留为 `已选法术` 工作台，卡面改为 `火球术`，并写短状态 `来自已计划法术` |
| 右下大计划框 | 有规则身份，但只需要最多 2 张已计划法术，不需要大容器 | 收缩为 `己方已计划` 小槽，保留两张正式计划卡和数量 |
| 法术书到计划区关系箭头 | 无常驻规则身份；计划关系由区名、计划卡和分页承接即可 | 删除常驻关系箭头；只保留施法动作路径 / 目标高亮这类当前动作反馈 |
| 分页圆形按钮 | 必要，但旧圆按钮不贴书页语法 | 改为贴近法术书页脚的页角翻页样式，不再漂浮圆钮 |

## 素材进入 artifact 链

| 画面主体 | 正式 / 来源锁定素材 | Open Design 渲染来源 | 状态 |
| --- | --- | --- | --- |
| 标准竞技场 | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg` | `refs/mage-wars-step1/standard-arena.jpg` | `visible-subject` |
| 邪术师 / 女祭司法师牌 | `mages-core-atlas.json` frame crop | `mage-warlock-card.png`、`mage-priestess-card.png` | `visible-subject` |
| 火球术 / 法师祸咒 / 候选法术 | `apprentice-spell-atlases.json` frame crop | `spell-1700-fireball.png`、`spell-1804-mage-bane.png` 等 | `visible-subject` |
| 对手已计划 / 隐藏信息 | 通用法术卡背 | `spell-card-back.jpg` | `visible-subject / hidden-info-boundary` |
| 攻击骰 | Mage Wars 攻击骰贴图派生面 | `attack-die-face-*.png` | `visible-subject` |
| 效果骰 | Workshop 锁定蓝色 12 面骰 | artifact 程序化 d12 | `source-locked-programmatic` |
| 行动 / 快速施法 / 守卫 / 伤害 / 燃烧 token | 正式 token 或来源锁定派生图 | `action-marker-red-front.png`、`quickcast-marker-front.png`、`guard-token.png`、`damage-token-front.png`、`burn-token.png` | `visible-subject` |
| 生命 / 法力 / 聚魔 | 状态板规则来源，运行态读数自制 | CSS 条 + 数值 | `approved-programmatic-runtime-ui` |

## 层级与空间预算

| 层级 | 对象 | 允许 / 禁止 |
| --- | --- | --- |
| 背景层 | 暗桌面、正式竞技场 | 可被轻量 HUD 压住边缘；不能被硬面板遮成 dashboard |
| 规则空间层 | 六个区域和区域标签 | 必须可读；卡牌中心在所属区域内 |
| 物理对象层 | 法师牌、场上卡、法术牌、卡背、token、骰子 | 第一视觉主体，不能被文字壳、粗边框或大面板抢走 |
| 主交互层 | 已选火球术、B2 目标高亮、目标摘要、法术书分页 | 允许轻压桌面低权重区；不能挡住目标卡、骰子和 token |
| 结算层 | 攻击骰、效果骰、伤害 / 燃烧 token | 高于棋盘和 HUD，锚定目标附近；禁止边栏化 |
| 辅助 HUD | 法师血条 / 蓝条 / 聚魔、回合结束 | 轻量贴边，不制造玩家区大框或第二工作台 |

## 禁止项

- 不调用 `od media generate`，不走图片模型生图。
- 不写真实 Board/UI，不启动真实运行页，不跑实现 E2E，不做移动端。
- 不显示常驻 `确认 / 执行 / 取消`；目标点击直接提交的设计口径不变。
- 不引入 `手牌`、`hand`、`opponent-hand` 或默认持牌区术语。
- 不省略用户点名的骰子、token、计划法术、法术书、卡背、角色卡和场上卡。
- 不保留没有规则身份的大玩家区、计划关系箭头、孤立圆形分页或大计划框。

## 人工验收状态

- 当前 v48 只能进入截图和 AI 图面核验。
- AI 图面核验通过前，仍为 `human-review-not-allowed`。
- 若 AI 图面发现重叠、来源错误、火球术不可读、对手计划不在左上、分页不是页角样式、骰子 / token 缺失或出现规则外术语，本稿直接降为 `REVISE`，不得打开给用户。
