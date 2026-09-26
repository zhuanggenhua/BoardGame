# Fate/Domination OpenDesign 桌面牌桌候选稿 v2

## 状态

- `open-design-artifact-candidate`
- 人工设计验收：`not-approved`
- 本稿用于先确认信息层级、视觉密度和真实素材承接，不直接替代运行时实现。

## 规则与设计真相源

- 设计合同：`design-system/games/fate-domination.md`
- 运行时实现对照：`src/games/fate-domination/Board.tsx`
- OpenDesign 工具说明：`docs/infra/open-design.md`
- 规则/动作边界：`openspec/changes/add-fate-domination-foundation/specs/fate-domination/spec.md`

## 本轮视觉结论

1. 伏木市地图和真实卡面是主视觉，不用 CSS 伪造卡牌，也不把说明文字做成主区域。
2. 桌面布局固定为顶部局势、中央地图、右侧决策栏、身份条、底部手牌与行动区；玩家可以从地图直接读出当前部署和可行动位置。
3. 蓝色用于信息与可交互状态，金色用于选中、资源和推进动作；面板边框保持薄，避免把牌桌变成后台卡片墙。

## 框体职责

| 框体 | 保护对象 | 允许原因 |
|---|---|---|
| 顶部局势/事件小卡 | 当前回合公共状态 | 需要随时检查，但不抢地图焦点 |
| 右侧玩家栏 | 魔力、VP、指令咒、排名 | 高频决策信息集中在固定侧栏 |
| 身份条 | Master / Servant 选择 | 身份属于局前/局内配置，不遮挡地图 |
| 底部手牌与攻击区 | 牌面选择与当前编成 | 高频操作靠近主行动按钮 |

## 素材账本

| 画面主体 | OpenDesign 输入文件 | 来源 |
|---|---|---|
| 伏木市地图 | `assets/fuyuki-city.webp` | `public/assets/i18n/zh-CN/fate-domination/board/compressed/fuyuki-city.webp` |
| 局势牌 | `assets/situation-turning-point.webp` | `public/assets/i18n/zh-CN/fate-domination/situations/compressed/turning-point.webp` |
| 深山町事件 | `assets/event-fate-battle.webp` | `public/assets/i18n/zh-CN/fate-domination/events/compressed/fate-battle.webp` |
| Master / Servant | `assets/master-emiya.webp`, `assets/servant-saber.webp` | Fate/Domination 正式素材 |
| 攻击与技能手牌 | `assets/attack-*.webp`, `assets/skill-*.webp` | Fate/Domination 正式素材 |

## 互动合同

- 点击手牌只切换设计稿中的选中态。
- 点击加号/顶部牌面打开检查弹层，不改变局面。
- 点击地图位置切换可行动位置，并更新底部提示。
- 点击身份卡切换选中态。
- 点击主按钮切换到“战斗已确认 / 等待对手响应”示意态。

## 结构与氛围边界

- 硬结构：顶部、地图、右侧栏、身份条、底部 dock 的几何关系必须保持。
- 氛围：地图压暗、细网格、路线线条、蓝金色强调可在不影响可读性的范围内调整。
- 设计稿只表达一个高密度行动阶段状态；响应式规则只作为同层级压缩参考，PC 1920×1080 是主验收尺寸。

## 交付

- 源稿：`index.html`
- 设计项目：`b4bb4fbb-ee71-4465-9e34-e4c24f397155`
- 导出证据：`exports/fate-domination-desktop-v2.png`
