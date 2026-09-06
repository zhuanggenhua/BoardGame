# 法师战争 Board 布局实现合同

> 状态：`foundation-runtime-consumed / v75-open-design-target / correction-ledger-required / full-map-deferred`。入口：`design-system/games/mage-wars.md`。本文件把 UI 合同收敛为 `src/games/mage-wars/Board.tsx` 的 foundation 实现骨架；旧 v6-v74 只保留为失败或历史候选。当前可作为 PC 实现目标的设计稿是 v75，但真实 Board/UI 实施前必须同时消费 v75 原图、v75 审计、几何证据和用户纠正覆盖账本，不得只照最后截图的大概布局实现。

## 桌面基线

- 基准视口：`1920x1080`。
- 布局模式：开放式牌桌，不使用页面级滚动作为主布局。
- 主视觉：中央竞技场底图铺满主舞台；HUD 悬浮在边缘，不遮挡区域目标。

## 区域骨架

| 区域 | 推荐实现 | 约束 |
| --- | --- | --- |
| Board root | `relative h-full overflow-hidden` | 服从上层 board shell；不写 `h-screen` |
| Table background | 低亮度桌面纹理/渐变 | 不能出现黑边或纯色空区 |
| Arena layer | `absolute` 中央，按底图比例约束 | 后续叠加 `zoneId` 热区 |
| Entity layer | 法师、生物、墙体、魔物 | 从领域状态派生，不手写展示样板 |
| FX layer | 独立 overlay，`pointer-events-none` | 仅事件驱动 |
| Player lower HUD | 底部靠近自己侧 | 法术书、已计划法术、弃牌堆入口不得被横幅压住；右下已计划法术位于回合结束入口下方，二者保持同一纵向操作列 |
| Opponent upper HUD | 顶部靠近对手侧 | 只显示公开信息 |
| Action rail | 右下固定纵向列 | 回合结束 / 行动推进位于己方已计划法术上方；不得承载无规则授权的常驻确认 / 执行 / 取消 |
| Attachment strips | 贴近法师状态 | 装备公开，结界分隐藏/展示 |

## 交互状态

| 状态 | UI 行为 |
| --- | --- |
| 无待选 | 行动 rail 显示当前阶段和唯一下一步 |
| 选择法术 | 可施放卡牌本体高亮；非候选降噪 |
| 选择目标 | 棋盘区域/对象本体高亮；目标本体点击即提交。若需要撤选，只能作为选中态临时入口，不得常驻成确认 / 执行 / 取消工作台 |
| 结算中 | FX 层播放；主操作禁用；结果落到目标对象 |
| 等待对手 | 单一等待提示；不显示禁用版操作面板 |
| 非法操作 | 对应对象短促错误反馈；不播放成功 FX |

## 素材引用口径

- `board/standard-arena`
- `cards/mages/mages-core-atlas`
- `cards/backs/spell-card-back`
- `dice/attack-die-texture`
- `tokens/action/ready-token-front`
- `tokens/action/ready-token-back`
- `tokens/damage/damage-token-front`
- `tokens/status/guard-token`
- `tokens/status/burn-token`
- `tokens/status/rot-token`
- `tokens/status/daze-token`
- `tokens/status/stun-token`
- `tokens/status/sleep-token`

上述对象的 foundation 范围资源已通过 `runtime-resource-chain-audit.md` 和真实入口 E2E 证明被当前 Board 消费。未进入 foundation 的完整墙体、全状态详情、全 322 张法术和完整标准竞技场命中区仍按后续 change 补齐。

## 设计 / 实现前置门禁

- 当前 `board-ui-preview.html` 已被用户否决，状态为 `rejected / failed-candidate`；不得继续作为人工验收图或实现入口。
- Open Design v75 是当前 PC 目标稿；旧 v6-v74 不能恢复为人工验收或实现依据。
- 继续改设计稿、Open Design artifact 或 AI 图面核验时，必须先重新读取规则真相源和素材矩阵，至少覆盖学徒法师属性、法术书组成、逐卡字段、竞技场、法师牌、法术牌、卡背、token、骰子和状态标记。
- 进入真实 Board/UI 实现时，必须先逐项消费 `docs/games/mage-wars/design/reference/user-correction-traceability-ledger.md`，并写出实现截图中的对应承载：法术书 6 张、已计划 2 张同尺寸、对手计划右上对手 HUD 左侧相邻卡背、右侧公开弃牌堆正面半露、攻击骰、效果骰、伤害 / 燃烧 / 守卫 / 行动 token、无常驻确认、对象本体直选、地图底层开放 overlay。单位能力按钮视觉位于来源卡牌正下方并居中，但实现应挂在舞台 / `body` 级交互 overlay，以来源实体实时几何矩形定位，避免溢出到相邻棋盘格或 ownership lane 后被其命中层拦截。
- 每个画面中可见的规则对象都必须能回查到正式素材状态：`pass`、`approved-programmatic`、`blocked`、`planned-not-moved`、`temp-only` 或等价状态。
- `planned-not-moved`、`frame-candidate`、`temp-only` 对象不能被包装成正式视觉素材；除非补齐正式落盘、压缩、manifest/atlas config 和运行时引用，否则不得出现在验收稿中冒充完成。
- HTML/CSS 预览只可用于内部布局探索；只有规则/素材前置矩阵通过，才允许渲染 PNG 进入 AI 图面核验。
- 矩阵中只允许“内部布局草图”的对象，不得进入 PureRef / 用户人工验收；AI 自己看图也必须先判 `REVISE`，不能给 `PASS`。v75 之外的历史稿不再是例外候选。

## 验收截图链

0. 主 UI 视觉预览：当前 PC 目标稿是 `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v75.png`；`board-ui-preview.html`、`temp/mage-wars/design-audit/board-ui-preview-1920x1080.png`、v6-v74 artifact 和 `reference/open-design-brief.html` 只保留为失败证据或 brief，不得作为人工验收图。
1. 开局：标准竞技场、双方状态、法术书 / 已计划法术 / 弃牌堆入口、行动 rail。
2. 计划：自己看到计划法术，对手看不到身份。
3. 施法选目标：来源法术 / 行动对象、目标区域 / 对象本体高亮；目标本体点击推进，无常驻确认 / 执行 / 取消。
4. 法术结算：FX 路径/扩散 + 目标命中反馈 + 状态/伤害变化。
5. 攻击：攻击骰、伤害和效果、守卫/反击状态承接。
6. 终局：一方法师死亡，胜者和最终状态摘要。
