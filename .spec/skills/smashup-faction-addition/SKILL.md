---
name: smashup-faction-addition
description: "Smash Up 新增派系端到端 adapter。用于从素材到可玩收口；只编排 intake、实现、审计与 E2E，不复制专项规范正文。"
---

# Smash Up 新增派系端到端 adapter

## 职责边界

- 本 skill 是 `adapter/workflow`，只负责把 Smash Up 新增派系任务串成端到端收口顺序。
- 通用新增可玩对象完成门槛以 [`add-new-faction`](../add-new-faction/SKILL.md) 为主。
- Smash Up 图片、Wiki、atlas、manifest、静态数据和资源上传以 [`smashup-faction-intake`](../smashup-faction-intake/SKILL.md) 为主。
- Smash Up 玩法、旧实现复用、交互、测试、E2E 和审计以 [`smashup-faction-implementation`](../smashup-faction-implementation/SKILL.md) 为主。
- 数据、资源、审计和真实链验收标准回到 `.spec/knowledge/standards/`；本文件不再复制这些标准。

## 默认完成定义

用户要求“Smash Up 新增派系”“新派系增加流程”或“从图片做到可玩”时，默认连续完成：

1. 锁定素材、规则、Wiki / 对照源和对象范围。
2. 完成 intake：裁图、atlas、静态数据、locale、manifest、上传和远端回查。
3. 完成 gameplay implementation：按单派系闭环实现、测试、E2E 和 evidence。
4. 完成统一审计：逐对象结论、共享链依据、残余范围和截图 / 测试证据。

只有用户明确限定“只做 intake / 只录素材 / 先别实现玩法”时，才允许停在 intake。

## Smash Up 专属硬边界

- `public/assets/**` 常被忽略，不能用 `git status` 判断图片资源是否完成。
- Git 默认提交代码、数据、manifest、atlas 注册、locale、测试和 evidence；大图源文件、压缩图和正式卡图 / 基地图走服务器素材主源发布链路，除非用户明确要求才考虑强制入库。
- 新 atlas 进入运行时前必须同时核对两层 manifest：
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
- 上传后必须记录远端回查证据：服务器素材主源 URL、`HEAD` 或等价请求结果、manifest 条目和 atlas grid 尺寸。
- 如果基地复用既有 `base` 合同，候选基地 atlas 不得留在正式 `public/assets/i18n/zh-CN/smashup/base/` 目录，避免后续资源上传误传。

## 执行顺序

### S0 范围与状态清单

先建立本任务状态清单，建议放 `temp/smashup-<batch>-implementation-status.md`，至少包含：

- 派系列表和对象清单。
- 每张卡 / 每个基地的真相源、静态接入、最终状态、真实入口和生命周期状态。
- 已跑命令、结果和 evidence 路径。
- 当前是 intake-only、playable 还是 closeout 范围。

范围未锁定时只继续补证据，不进入录入或实现。

### S1 Intake

按 [`smashup-faction-intake`](../smashup-faction-intake/SKILL.md) 完成：

- 图片 / Wiki / 对照源字段分工和 contract。
- atlas 几何、row-major 索引、尾格 / 非卡牌格核对。
- faction / card / base 静态数据、locale 和 UI metadata。
- 两层 manifest、资源上传、公开 URL 回查。
- implementation handoff：对象清单、规则关键词、可复用机制、待新实现机制和共享层风险。

intake evidence 缺失时，不得声称可以安全进入 gameplay implementation。

### S2 单派系 implementation

按 [`smashup-faction-implementation`](../smashup-faction-implementation/SKILL.md) 单派系闭环推进：

- 先审查既有 Smash Up 能力、共享 helper、resolver、interaction family 和测试。
- 每个对象拆成 effect atom，分别追到规则子句、静态字段、玩家入口、命令 / reducer、UI / 交互出口、测试和 evidence。
- 可复用机制优先复用或扩展共享层；缺共享抽象时再新增，不写一次性硬编码。
- 新交互类型、新 UI 或新操作方式必须补 direct E2E 和截图证据。

批量任务也不得多个派系同时半成品；完成一个派系的实现、测试、E2E 和 evidence 后再进入下一个。

### S3 统一审计

统一审计只汇总已有单派系 evidence，不替代对象级审计：

- 本任务新增范围和历史基线债务分开写。
- 每个新增对象必须有独立审计行，或登记共享链完全同构、仅配置不同的复用依据。
- 某派系只达到“结构审计通过”或“代表性玩法已验证”时，汇总不得升级成“当前发布口径已收口”。
- 旧 evidence 被新证据推翻时，先回写原文档，再更新 rollup / closeout。

## 禁止事项

- 禁止 intake 完成后默认停下，把“做到可玩”拆给用户下一轮。
- 禁止用素材接入、派系选择页可见、locale 完整、结构测试通过冒充玩法完成。
- 禁止不参考旧实现就新增私有分支或硬编码。
- 禁止用代表链外推对象级结论，除非已证明共享链完全同构且只差配置。
- 禁止没有 evidence 就宣称“已审计 / 已收口 / 当前发布口径完成”。
