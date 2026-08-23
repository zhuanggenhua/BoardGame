# 法师战争设计索引

本目录只做 `mage-wars` 设计入口：锁当前稿、证据入口、失败候选处理和继续迭代门禁。逐版本流水账留在各自 preflight / audit / geometry 文件里，不再堆进 README。

## 当前有效裁定

- 当前基线：`v80` 红框对象交换修正版。竞技场格子使用人物 / 肖像法师本体；玩家 HUD 使用密集文字法师规则 / 提示卡。
- 这只是 Mage Wars 当前稿裁定，不是跨游戏 UI 模板。
- 用户未明确批准前，真实 Board/UI 实现、真实页面 E2E 和移动端适配仍冻结。
- 当前有效设计工具是 Open Design artifact 代码设计稿及其渲染截图；不要改走 `od media generate`、图片模型生图或静态 mock。
- `AI_PASS` 只表示 AI 图面核验通过，不等于用户人工批准。

## 必读入口

| 入口 | 作用 |
| --- | --- |
| [rule-to-ui-element-list](implementable/rule-to-ui-element-list.md) | 规则对象到 UI 元素的当前职责拆分；含 v80 法师对象职责 |
| [user-correction-traceability-ledger](reference/user-correction-traceability-ledger.md) | 用户纠正覆盖账本；下一版 artifact、截图和 AI 图面核验前必须逐项消费 |
| [external-ui-methodology-baseline](reference/external-ui-methodology-baseline.md) | 外部 UI 方法论基线；继续设计前先消费 |
| [board-ui-preflight-matrix](implementable/board-ui-preflight-matrix.md) | 主 UI 前置矩阵；继续迭代前重读 |
| [step1-runtime-board-asset-input-manifest](reference/step1-runtime-board-asset-input-manifest.md) | 正式素材输入包 |

> `v80` 当前裁定已经沉淀到职责清单和用户纠正账本；如果后续需要送验，必须补齐对应独立 artifact、PNG、audit 和 geometry 文件，不能只凭本 README 宣告通过。

## 继续迭代门禁

- 继续改视觉稿、Open Design artifact、HTML 预览或 AI 图面核验前，先消费用户纠正账本；若账本发现规则缺主源，先回项目 skill 或设计标准补主源。
- 继续设计前必须重读主 UI 前置矩阵、学徒法术书合同、学徒区域锚点合同和规则对象到 UI 元素清单。
- 每个可见主体必须绑定正式素材路径、atlas frame 或 `approved-programmatic-runtime-ui` 裁定。
- 对手计划法术、隐性结界和未公开法术书内容只能显示卡背 / 数量 / 控制归属，不得公开正面或卡名。
- 主 UI 常驻文字只允许对象名、数值、短状态和按钮标签；规则说明、教程句和实现验收文案不得进入主界面。
- AI 图面核验必须先查规则 / 素材矩阵，再看图；矩阵不过时，视觉再像也只能判 `REVISE`。

## 当前基线要点

- 法师对象拆三层：竞技场战场实体、玩家 HUD 规则提示卡、详情层规则回看。
- 当前 v80 采用“竞技场人物本体 + 玩家 HUD 规则提示卡”；未来若换落位，必须说明替代方案如何保持三层职责分离并重新获得用户认可。
- 法术书、已计划法术、弃牌堆、隐性结界卡背、公开场上法术 / 装备 / 生物是牌区白名单；不得发明规则不存在的默认持牌区。
- 弃牌堆是已消耗 / 公开检视归档区，不是隐藏信息；常驻只做所属玩家边缘紧凑入口，只有当前步骤要求检视、回收或结算时才提升权重。
- 程序化运行态 UI 不能是粗糙占位；效果骰、血条、蓝条、费用球等自制对象必须过形状、材质、尺寸、状态和素材一致性审查。

## 历史候选处理

- v1 多设计稿失败：四套方案同页同母版，不能再作为多方案入口。
- v2 / v3 / v6 证明独立 artifact 路线可行，但不再是人工验收候选。
- v7-v18、v23-v79 都是历史失败或被后续反馈取代的候选；除非对应 audit 被重新更新为当前候选，不得送人工验收。
- v19-v21 保留为区域锚点和多设计稿前对照基线；不能覆盖当前 v80 裁定。
- v75 曾解决弃牌堆公开可检视语义，但已被 v80 的法师对象交换裁定取代；不要用 v75 直接推进实现。

## 目录约定

- `reference/`：前置包、用户纠正、方法论和素材输入。
- `implementable/`：可实现合同、坐标和规则对象职责。
- `generated/`：Open Design artifact、PNG、审计和几何证据。
- README 只负责路由和当前裁定；逐版本原因看各自证据文件。
