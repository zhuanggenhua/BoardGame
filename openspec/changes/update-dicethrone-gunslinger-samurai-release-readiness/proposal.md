# Change: DiceThrone 枪手 / 武士整角色审计与验收收口

## Why
- 当前 worktree 已经补了一批枪手 / 武士的实现缺口、规则回归与真实点击 E2E，但这些产出仍然是按“暴露一个缺口，补一个缺口”的方式推进。
- 这不足以支撑“两个新角色已经完成”的口径，因为还缺少一份正式的角色级验收标准，明确哪些属于必须审计的范围、哪些必须拿到真实入口 E2E、哪些只能算已识别缺口闭环而不能外推成全量完成。
- 如果不把这层验收标准单独立项，后续很容易继续用零散 findings 替代整角色审计，最终在对外汇报时把“部分高风险缺口已关闭”误报成“两个角色整体验收完成”。

## What Changes
- 新增一条面向 DiceThrone 新角色收口的 change，明确枪手 / 武士这轮的整角色审计边界与完成标准。
- 将验收拆成三个必须同时成立的层次：
  - 规则 / 数据 / 共享实现审计
  - 代表性领域回归
  - 代表性真实点击 E2E
- 明确“代表性 E2E”不是要求穷举所有牌，而是要求覆盖每名角色本轮新增或高风险的交互家族，并且至少包含真实入口。
- 明确禁止把“已识别缺口闭环”直接上升表述为“两个角色所有技能、所有卡牌、所有多人分支都已穷尽式审计完成”。

## Impact
- Affected specs:
  - `dicethrone-hero-release-readiness`
- Affected code:
  - `openspec/specs/dicethrone-hero-release-readiness/spec.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - 后续实际审计命中的 DiceThrone 角色数据 / custom action / token / E2E 测试文件
