---
name: engine-simple-choice
description: Choice Request 旧兼容附录：simple-choice 弹窗和历史兼容边界——维护旧 simple-choice 或判断新游戏禁用时查
metadata:
  type: doc
  status: 已交付
---

# Choice Request 旧兼容附录

交互接口总源是 [`rule-driven-interaction-design.md`](rule-driven-interaction-design.md)。本文件只记录 `simple-choice` 作为旧弹窗 surface / legacy adapter 时的兼容边界；它不是新业务阻塞交互框架。

## 定位

- `createSimpleChoice` 是旧兼容工具。新游戏、AI 可控阻塞交互、线上可恢复卡点和已迁出旧弹窗的游戏，必须建立 Choice Request。
- 旧游戏可保留历史 `simple-choice`，但新增交互默认不扩大使用面。
- 允许继续使用的场景只包括纯确认、按钮分支、数值 / 模式选择，且没有场上对象、手牌、棋盘格、来源-目标、多步或响应窗口语义。
- 作为 Choice Request 的薄适配层时，`simple-choice` 只负责显示，不能重新拥有候选真相、权限真相或 AI 语义。

## 字段合同

| 字段 | 现实含义 | 规则 |
| --- | --- | --- |
| `sourceId` | 谁发起这次选择 | 必须稳定，便于日志、恢复和审计 |
| `multi` | 多选数量边界 | 必须嵌套在配置对象的 `multi` 字段下 |
| `autoResolveIfSingle` | 只有一个候选时是否代替玩家完成 | 默认不自动；玩家选择语义禁止设为 true |
| `targetType` | 旧 UI 的目标类型提示 | 只能辅助旧 UI，不能作为 AI 或规则语义主源 |
| `displayMode` | 选项按卡牌还是按钮渲染 | 卡牌选项显式声明卡牌渲染模式 |
| `defId` | 卡牌 / 对象定义身份 | 卡牌预览需要，不能替代渲染模式 |

旧 `targetType` 词表只保留历史解释：`base` 表示区域 / 地点 / 公共目标，`minion` 表示单位 / 场上卡牌对象，`hand` 表示手牌对象，`discard_minion` 表示弃牌堆对象，`generic` 表示通用按钮或对象选择。新增专用交互不得继续扩展这个词表。

## 强制规则

- 玩家要选择卡牌、区域、单位、角色、目标、支付对象、来源、目的地、顺序、数量或是否执行时，即使只有一个合法候选，也必须保留玩家选择或明确跳过 / 确认入口。
- 只有该步骤没有玩家选择、没有可见对象、没有放弃语义，只剩固定机械结果时，才允许自动收口。
- 选项代表卡牌时，option value 必须携带定义身份，UI 不得从字段形状猜渲染模式。
- 跨区域清理、区域替换或对象移除后再解决的交互，必须携带稳定业务标识，不能只保存数组下标或临时位置。
- `responseWindow` 与 `simple-choice` 并存时，普通命令是否放行由响应窗口系统裁决。
- 一个 interaction kind 只表达一种稳定业务语义；来源-目标、多步选择、响应窗口和阶段推进必须建专用 kind / reader / modal。
- 取消 / 跳过入口只保留一个前台承载；阻塞前台默认进入 modal stack，真实可点击内容必须与 modal stack entry 同树。

## 禁止项

- 禁止用 option label、翻译文案、数组下标、UI 类型或 `targetType` 当 AI / 规则主语义。
- 禁止用 `simple-choice` 伪装来源-目标选择、私密候选、棋盘格选择、手牌响应或阶段推进权。
- 禁止把唯一候选直接执行，让玩家看不到候选、成本、跳过或确认。
- 禁止在新游戏中把旧 simple-choice 的 payload 形状当作交互设计模板。
