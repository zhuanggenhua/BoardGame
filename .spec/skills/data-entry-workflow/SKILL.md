---
name: data-entry-workflow
description: "BoardGame 数据录入与核对流程。用于图片、规则书、Wiki、PDF、截图、裁图、资源索引和文案同步；先零猜测锁真相源。"
---

# 数据录入工作流

## 规范来源与职责边界

- 本 skill 是 `workflow`：只承载 BoardGame 数据录入的执行顺序、路由和项目内交付要求。
- 通用录入原则、来源优先级、核对契约和零猜测门禁以 `.spec/knowledge/standards/data-entry.md` 为 `canonical-source`。
- 图片/素材路径、manifest、正式资源链和服务器主源以 `.spec/knowledge/standards/asset-pipeline.md` 为 `canonical-source`。
- 本 skill 只保留执行骨架；如果与主源冲突，先改主源，再同步本 workflow。

## 何时使用

- 用户要求“录入数据”“根据图片补卡牌/技能/Token”“核对图片和代码”“整理真相源”“补 atlas 索引”“根据规则书/PDF/Wiki 更新文案或静态数据”时使用。
- 这不是实现 skill；它先收紧数据录入纪律，再把任务路由到对应游戏的 workflow。
- 当任务明确是“配置表 / 配置审查 / 字段核对 / 配置重录 / 配置修正提案”时，先使用项目 `.spec/skills/config-review-workflow/SKILL.md`；本 skill 只补图片、规则源、裁图和录入合同，不复制配置表工作流正文。

## 先读

- 通用门禁：`.spec/knowledge/standards/data-entry.md`
- 图片文字读取、OCR、卡图/房间图规则录入或读图卡死：`.spec/skills/safe-image-reading/SKILL.md`
- 图片资源路径、manifest、服务器素材主源：`.spec/knowledge/standards/asset-pipeline.md`
- 机制实现承接：`.spec/knowledge/standards/engine-systems.md`
- 不确定入口：`.spec/knowledge/README.md`

## 执行骨架

1. **锁定任务现场**
   - 确认 `gameId`、本轮 scope、当前 worktree / 分支、用户指定真相源。
   - scope 是整包、整牌库、全剧本、全房间、全组件时，先建立官方对象全集；当前运行池、发现池、素材 manifest、测试覆盖对象只能作为覆盖对照。

2. **先建录入合同**
   - 按 `data-entry.md` 完成真相源表、对象全集、规则数量 × 素材数量对账、字段版式合同、裁图 / OCR / atlas / 索引合同。
   - 每个对象退出录入层时只能是 `locked / blocked / disputed` 三选一；未锁定对象不得进入实现、UI、E2E、截图或完成口径。
   - `blocked / disputed / unknown-slot / not-in-runtime` 只拦阶段升级和完成宣称，不等于停工；仍有本地证据可补时继续补合同。

3. **图片读取走需求交接**
   - 主线程先写清业务对象、图片路径、要补足的字段 / 判断点、结果用途。
   - 读图 / OCR 只返回当前需求所需字段；录入结论必须落到合同表、evidence 或真相表。
   - 可读字段立即入表；不可读字段只标 `blocked / disputed / partial`，不得猜。

4. **资源链按主源执行**
   - 运行时图片、atlas、Token、状态图标、音频、manifest、服务器素材主源全部回 `asset-pipeline.md`。
   - 录入切图、OCR 图、人工核对图只能放 `temp/**` 或 evidence，不能进 `public/assets/**` 或远程素材主源。
   - 只要本轮新增 / 替换运行时媒体资源，默认执行压缩、上传和远端回查；未完成时必须说明缺口和影响。

5. **先文档后实现**
   - 影响规则、机制、描述、展示或资源映射的录入，必须先更新文档 / 合同，再改运行时代码。
   - 代码、测试、旧 evidence 只能辅助定位；主真相源未锁定前，不得下“不是录入错误”的最终结论。

## S0-S4 拆解骨架

当任务不只是“录入”，还包含实现、重构或验证时，按层推进：

1. **S0 合同层**：真相源、对象全集、数量对账、atlas / 索引、字段版式、`locked / blocked / disputed`。
2. **S1 配置复用层**：ids、静态数据、metadata、locale、可直接复用 handler。
3. **S2 机制扩展层**：只为 S0/S1 无法承接的规则增加机制，先查 `engine-systems.md`。
4. **S3 UI 与 E2E 层**：只对 `locked` 对象做 UI / E2E / 截图证据，不能用截图反推录入已完成。
5. **S4 收口层**：同步文档、资源上传、远端回查、evidence、剩余缺口和最终汇报。

## 批量任务门禁

- “批量派系重审 / 全部重新录入 / 三个新派系全部对照 / 有差别的都修”必须先建批次清单，至少到单卡 / 单基地 / 单对象粒度。
- 当前批次未清空不得因为补了 1-2 项就提前收口；若暂停，必须写清剩余对象卡在哪一层。
- 单对象补证只能提升对象级结论，不能外推为整包、整派系或整批次完成。
- 需要写 E2E 或状态注入前，先确认测试使用的 `defId` / registry id 在真实配置中存在。

## Workflow 路由

### 通用新增派系 / 新增角色 / 新增英雄

- 适用：用户说“新增派系”“新增角色”“新增英雄”“从素材做到可玩”“数据录入、上传、审计、端到端全流程”“彻底完成才停”等语义。
- 必须先读 `.spec/skills/add-new-faction/SKILL.md`，把批次矩阵、L0-L4、资源上传、审计 evidence、真实入口 E2E 作为统一交付门禁。
- 然后再进入下方游戏专用 workflow。
- 禁止只完成选角、静态数据、资源显示或 smoke 测试后就宣称新增完成。

### Smash Up

- **仅 intake / 仅录入资源**
  - 适用：用户只要求核图、切 atlas、录静态数据、补 locale、补 faction metadata、上传资源。
  - 读 `.spec/skills/smashup-faction-intake/SKILL.md`。
- **intake + 派系玩法实施**
  - 适用：用户明确要求“把新派系做进游戏”“继续实现玩法”“从图片一路做到正式可玩”。
  - 先读 `.spec/skills/smashup-faction-intake/SKILL.md`，收口后继续读 `.spec/skills/smashup-faction-implementation/SKILL.md`。
- **旧派系 / 新派系整批重审、重录、补证**
  - 继续走 Smash Up 专项 workflow，并套用上面的“批量任务门禁”。
- **禁止误路由**
  - Smash Up 新派系任务不是“新增游戏”，默认不要改走 `.spec/skills/create-new-game/SKILL.md`。
  - 只有新增全新 `gameId` 时才走新游戏路线。
- 额外硬规则：涉及 Wiki 核对时，必须按仓库根 `AGENTS.md` 使用项目爬虫，不能凭记忆。

### Summoner Wars / 召唤师战争

- 新派系、重录派系、卡图数值核对、提示板核对：读 `.spec/skills/summonerwars-faction-intake/SKILL.md`。
- 单卡费用、生命、战力、攻击类型或牌组符号疑似错录时，先回完整单卡 / 召唤师图，不得用旧 evidence、代码静态值或测试期望覆盖卡图。
- 如果命中同一派系同一批次的版式误读，回到该派系全卡重录合同，不能只点改一张。

### Dice Throne

- 单角色 / 新英雄的图片、骰面、Token、卡牌、裁图、资源上传、规则文档录入：读 `.spec/skills/dicethrone-hero-intake/SKILL.md`。

### 其他游戏

- 若还没有专用 workflow：以 `.spec/knowledge/standards/data-entry.md` 为主流程，再补读该游戏自己的 `src/games/<gameId>/rule/` 文档。
- 新游戏第一次录入时，必须先把图面字段版式合同写进本轮 evidence；若该版式会复用，后续再沉淀到对应游戏 workflow 或规则文档。
- 不得把某个游戏的字段结构、抓取站点或索引习惯提升成项目全局默认。

## 交付要求

- 至少产出：真相源表、切图表、核对合同表、对照表、冲突待裁定表。
- 最终汇报必须明确：
  - 主真相源是什么；
  - 对照源是什么；
  - 哪些字段已确认；
  - 哪些字段仍待裁定；
  - 改动是否已经同步到文档、资源、代码；
  - 资源是否已经上传到服务器素材主源；若没有，具体缺口是什么。
