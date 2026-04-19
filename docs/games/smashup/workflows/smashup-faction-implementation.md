# Smash Up 派系玩法实施工作流

## 适用范围

适用于 **Smash Up 新派系在 intake 完成之后** 的正式玩法实施，覆盖：

- faction / card / base 的最终运行时接入
- ability / trigger / interaction handler / base ability 实现
- 共享机制复用与缺口补齐
- 单派系测试、E2E、evidence
- 批量派系任务的统一收口

本工作流**不负责**重新做一遍图片核对、atlas 索引裁定、资源 truth-source 合同；这些属于 intake 阶段。

本流程继承通用 `data-entry-workflow` 的 Spec 拆解模板（S0~S4），只是把其具体化到 Smash Up 派系实现。

## 前置输入（缺一不可）

进入 implementation 前，至少要有：

1. 一份已收口的 intake 合同文档
   - 必须写明主真相源、对照源、atlas 几何、row-major 索引、基地元信息
2. intake 已确认的 handoff 包
   - faction 清单
   - card/base canonical 名称
   - 仍待裁定项
   - 复用风险说明
3. 对应派系图片、locale、静态数据已接入或已明确待接入范围

若 intake 尚未收口，implementation 必须停下，不能边猜边做。

## 核心原则

### 1. 一次只做一个派系

批量任务也必须按单派系闭环推进：

1. 派系 A：实现 → 测试 → E2E → evidence
2. 派系 B：实现 → 测试 → E2E → evidence
3. 派系 C：实现 → 测试 → E2E → evidence
4. 最后再做统一审计与批量收口

禁止“三个派系同时改一半”后再试图一起救火。

### 2. 资源完成 ≠ 派系完成

以下都**不能**当成“派系已完成”：

- 只是 atlas / locale 已接入
- 只是 faction selection 能看到新派系
- 只是静态数据已录入
- 只是单测通过

只有当 **玩法实现 + 测试 + E2E + evidence** 都闭环后，才能说该派系完成。

### 3. 先复用共享机制，再补共享缺口

优先检查：

- `src/games/smashup/domain/`
- `src/games/smashup/abilities/`
- `src/games/smashup/__tests__/`

是否已有：

- bury / uncover
- ongoing modifier
- ongoing restriction / suppression
- movement / transfer / destroy / replace
- duel
- after scoring / before scoring / response window

若确实缺共享抽象，再补共享层；不要一上来在派系文件里堆私有硬编码。

## 典型文件落点

### 基础接入

- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/ui/factionMeta.ts`
- `public/locales/zh-CN/game-smashup.json`
- `public/locales/en/game-smashup.json`

### 派系数据与能力

- `src/games/smashup/data/factions/<faction>.ts`
- `src/games/smashup/abilities/<faction>.ts`
- `src/games/smashup/abilities/index.ts`

### 测试与留证

- `src/games/smashup/__tests__/*.test.ts`
- `e2e/smashup/*.e2e.ts`
- `evidence/smashup/*.md`

## 执行步骤

### 1. 读取 handoff 包并裁定实现边界

每个派系开工前，必须先写清楚：

- 哪些卡是直接复用现有能力
- 哪些卡是“同名但要重新核语义”
- 哪些卡必须全新实现
- 哪些基地能力已有共享模板
- 哪些机制会要求修改共享层

### 2. 单派系内再拆三批子任务（强制）

每个派系实施时，必须再拆成以下三批并按顺序推进：

1. **可直接通过配置复用的一批**
   - 目标：先把可复用卡牌/基地快速接上，降低不确定性
   - 典型内容：id、previewRef、abilityTags、已有 handler 绑定
2. **需要新机制或共享层扩展的一批**
   - 目标：解决当前引擎/共享抽象无法表达的规则
   - 典型内容：新增 shared helper、补 domain 抽象、补 interaction 链路
3. **需要新 UI / 新交互表现的一批（含对应 E2E）**
   - 目标：把机制真正暴露为可操作、可验收的真实链路
   - 典型内容：新交互组件、可选目标提示、阶段按钮、真实端到端流程验证

禁止把“机制还没实现”或“UI 还没接上”的残留留到派系完成后再补。

### 3. 先完成静态接入，再落能力

顺序建议：

1. faction id / atlas / metadata / locale
2. `data/factions/*.ts`
3. `abilities/*.ts`
4. `abilities/index.ts`
5. 必要的 domain / shared helper 调整

### 4. 共享缺口可直接扩展重构（默认授权）

当你在派系实施中确认存在共享抽象缺口时：

- 允许直接进行必要的扩展重构，不需要再逐次停下来确认
- 但必须满足：
  - 改动目的仅限“让当前与后续派系都可复用”
  - 不引入临时硬编码和一次性补丁
  - 同步更新受影响测试与 evidence
  - 在阶段总结中明确写清“为什么要改共享层、影响范围是什么”

仍需单独确认的场景：

- 分支/worktree/tag 操作
- 删除/清理本地数据
- 其他高风险不可逆操作

### 5. 单派系完成后立刻验证

每完成一个派系，至少做：

- 相关 Vitest
- 受影响的审计测试
- 至少 1 条关键真实交互 E2E
- 1 份 evidence 文档

不能把验证全压到最后。

### 6. 批量任务最后再做统一审计

当所有派系都已完成后，再做：

- 统一回归
- 批量 E2E 补充
- 统一 evidence 汇总
- 资源上传与远端回查

## 多 agent 使用建议

允许并行的通常是：

- 规则核对
- 索引合同整理
- 文档 / evidence 草拟
- 测试梳理

默认**不建议**多个 agent 同时写同一组核心文件：

- `ids.ts`
- `atlasCatalog.ts`
- `data/cards.ts`
- `abilities/index.ts`
- locale 主文件

如果要并行，必须先明确文件写入边界，避免互相覆盖。

## World Champs 额外规则

`World Champs` 默认按 **mixed-source one-of deck** 对待。

这意味着：

- 不能因为卡名和旧牌一样，就默认直接复用旧 handler
- 必须逐张写清：
  - 直接复用
  - 复制并改名
  - 全新实现
- 只有在语义已核对一致后，才允许别名复用

## 完成清单

- [ ] intake 合同与 handoff 包已存在
- [ ] 单派系边界已裁定
- [ ] 单派系已按“配置复用 / 新机制 / 新 UI+E2E”三批推进
- [ ] 运行时静态接入完成
- [ ] ability / interaction / base ability 完成
- [ ] 相关 Vitest 通过
- [ ] 关键 E2E 通过
- [ ] evidence 已留档
- [ ] 批量统一审计完成
- [ ] 若涉及资源运行时链路，R2 / CDN 已上传并远端验证
