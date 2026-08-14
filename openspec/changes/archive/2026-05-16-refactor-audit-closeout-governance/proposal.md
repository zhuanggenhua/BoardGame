# Change: 重构审计收口治理流程

## Why

- 当前项目把“审计套件转绿”“测试文件出现对应 id”“选择页 / 横幅 E2E 通过”与“玩法 / 功能已完成收口”混用，已经产生多次假阳性。
- 现有 `.spec/knowledge/standards/testing-audit.md` 与游戏专项 workflow 虽然写了很多维度，但缺少统一的收口等级、失效回写门禁、以及“哪些证据不能单独作为完成依据”的硬规则。
- 同类问题已经重复出现：旧审计文档承认过漏审失效，但新一轮审计仍在用结构审计与非真实链路 E2E 宣称“已收口”，说明流程治理本身需要重构，而不是继续补零散规则。

## What Changes

- 新增 `audit-closeout-governance` 能力，定义项目级审计收口等级、证据分层、失效回写与残余范围表达规则。
- 把“静态覆盖 / 审计套件 / 展示型 E2E / 注入型交互 E2E”与“真实玩法 / 真实入口 / 真实收口证据”明确分级，禁止再互相冒充。
- 规定对外宣称“已审计 / 已收口 / 已完成”时，必须按对象粒度写清：审计范围、证据级别、剩余未审范围、以及共享根因是否已收口。
- 规定一旦发现旧审计误判或漏审，原文档与后续汇总文档必须同步失效回写，不能保留旧的完成态口径继续流通。
- 为后续实现阶段预留统一落点：更新 `.spec/knowledge/standards/testing-audit.md`、相关游戏 workflow、以及审计 evidence 模板。

## Impact

- Affected specs:
  - 新增 `audit-closeout-governance`
- Affected code / docs:
  - `.spec/knowledge/standards/testing-audit.md`
  - `.spec/skills/smashup-faction-implementation/SKILL.md`
  - 其他后续需要宣称“已审计 / 已收口”的 workflow 与 evidence 文档模板
- Key risks:
  - 新规则会否定一批历史上“结构已绿但玩法证据不足”的收口口径
  - 若没有统一表达规范，团队可能继续把“部分收口”误写成“全部完成”
