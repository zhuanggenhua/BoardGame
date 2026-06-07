# Dice Throne 反馈 69f18ca4 本地验收收口说明（2026-05-04）

> 2026-06-06 当前有效口径：本文只对应反馈 `69f18ca4ab54eadcc2bb2322` 这一条本地 closeout 记录，不是当前 DiceThrone 所有防御阶段骰面可见性问题都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它理解成单条反馈与共享 fallback 修复簇的对位说明。

## 反馈原文

- `防御阶段看不见骰子`

线上反馈对应：

- feedbackId：`69f18ca4ab54eadcc2bb2322`
- gameId：`dicethrone`
- route：`/play/dicethrone/match/xCY5bkIbm8U?playerID=0`
- appVersion：`production`

## 线上现场

当前生产快照仍停在 `defensiveRoll`，但底层骰子数据本身是存在的：

- `sys.phase = defensiveRoll`
- `sys.flowHalted = false`
- `pendingAttack.defenseAbilityId = thick-skin`
- `core.dice` 中已经有 5 颗骰子的 `value / symbol / isKept`
- `errorContext = null`

这说明问题位点更接近“共享骰面显示层”而不是“领域层没有骰子数据”。

## 对位到既有共享修复

- 已收口反馈 `69cba605d5dec909a0b74c9f` 的标题就是 `无法显示出骰面`
- 对应证据：
  - `evidence/dicethrone/dicethrone-feedback-69cba605-dice-face-visibility-regression-2026-04-22.md`
- 该修复覆盖的是共享骰面可见性兜底：
  - sprite 缺失时改为显示可见文本骰面
  - 真实 UI 证据里已确认骰面不再整块空白

## 本地验证

已重新通过共享兜底单测：

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx --configLoader native -t "dice sprite 缺失时应渲染可见骰面文本兜底，避免整块空白"`

结果：

- `StatusEffectsIcons.test.tsx`：`1 file passed / 1 test passed`

## 关于 fresh E2E

- 我尝试复跑共享 E2E：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone.e2e.ts "ui stability: die lock toggle syncs state"`
- 这次没有进入业务断言，测试运行时在启动游戏服务时提前退出：
  - bootstrap log：`D:\gongzuo\webgame\BoardGame\.tmp\playwright-runtime-isolated-single-pw-1777861896790-thlfo9.log`
- 因此本条 closeout 不把这次失败当成产品回归证据，而是沿用 `69cba605` 已存在的共享截图证据。

## 收口结论

- 按当前任务口径，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 本条现场说明骰子数据仍在，问题位点与已收口 `69cba605` 的共享骰面显示层一致；当前共享 fallback 单测通过，因此本条按共享修复簇转 `resolved`。

---

**当前阅读说明**：本文只能证明这条“defensive roll 看不见骰子”反馈曾按共享显示层修复簇本地收口，不能外推为当前所有防御骰面显示、所有共享 Dice3D 风险或 DiceThrone 当前整体审计都已收口。
