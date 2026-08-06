## 1. Proposal and intake handoff

- [x] 1.1 读取勇士静态数据、规则 C1-C6、图集和双语 locale。
- [x] 1.2 确认勇士 12 张卡牌、2 个基地与现有 Munchkin 怪物 / 宝藏 owner。
- [x] 1.3 锁定共享改动边界：怪物摧毁触发、无奖励击败、回手附着行动。

## 2. Minions and ongoing effects

- [x] 2.1 接入大英雄天赋二选一、明星勇士触发、狂战士摧毁与指示物、嘲讽者可选怪物打出。
- [x] 2.2 接入哑铃、永恒的英雄、无处不在之盾持续 / 附着 / 离场清理。
- [x] 2.3 将勇士持续力量接入统一 modifier owner，并补单候选手选测试。

## 3. Actions

- [x] 3.1 接入领导运动、斩杀、地牢诱饵、骚乱和战争怒吼。
- [x] 3.2 接入宝藏奖励逐张即时额外出牌、骚乱无奖励和部分使用 / 跳过边界。
- [x] 3.3 为八张行动补对象级 L2 测试与交互登记审计。

## 4. Bases and shared events

- [x] 4.1 新增 `onMonsterDestroyed` 触发上下文与队列收集。
- [x] 4.2 接入堡垒抽宝藏、锦标赛补怪物，验证同基地、消灭者和牌库空边界。
- [x] 4.3 扩展 `MINION_RETURNED` 的附着行动精确回手字段，验证永恒的英雄与其它附着行动去向。

## 5. Real entry and audit

- [x] 5.1 为需要玩家决定的勇士对象补真实入口 E2E；单候选仍必须手动。
- [x] 5.2 逐张核对怪物行、基地、随从、行动卡、泰坦和提示层不重叠、不重复承载。
- [x] 5.3 运行定向 Vitest、真实 E2E、ESLint、typecheck、OpenSpec validate 和 diff check。
- [x] 5.4 AI 审计最终截图并把绝对路径和范围结论写入 evidence。
- [x] 5.5 只有实际覆盖的对象才更新为 passed，未覆盖对象保留 scoped-debt。
