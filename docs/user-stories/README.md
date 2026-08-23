# 用户故事与需求留档入口

本目录用于保存用户在对话中明确提出、会影响规则裁定、实现口径、验收方式或长期流程的需求。

用户故事是独立于规则书、图片真相源和既有实现之外的需求真相参考；当用户明确给出裁定或要求时，后续实现、审计与规则解释都应先对齐这里的留档。

## 留档规则

- 项目级通用需求放在 `project/`。
- 游戏级需求统一放在对应游戏目录下的 `docs/games/<gameId>/user-stories/`。
- 若用户故事要求偏离图片、规则书或既有实现，必须写清：
  - 用户原始要求
  - 覆盖的对象和字段
  - 覆盖原因
  - 验收标准
  - 不覆盖的范围

## 当前入口

- 项目级：`project/image-first-source-priority.md`
- 项目级：`project/mobile-ota-mandatory-update-policy-2026-07-10.md`
- 项目级：`project/seat-emote-recipient-first-acceptance.md`

游戏级用户故事不在本入口维护手写清单；用以下命令查当前真实文件：

```bash
rg --files docs/games -g "user-stories/*.md"
```
