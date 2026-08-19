# Mage Wars 召唤与攻击特效过程帧 E2E 证据

## 本轮目标

- 两个派系代表链路跑通：兽王侧召唤 `野性山猫`，女祭司侧召唤 `阿希拉牧师`。
- 攻击代表链路跑通：`间歇喷泉` 从来源格飞向目标单位，并在命中时出现伤害飘字。
- 截图覆盖必要过程帧：召唤来源 / 目标、召唤光柱、单位落场；攻击来源到目标、投射物飞行、命中动画和伤害飘字。
- 本轮重点验证实体视觉生命周期：攻击骰、投射、命中和伤害飘字活跃期间，目标单位不能整张消失。
- 本轮不声明全量法术、装备、结界、buff 或完整 UI 视觉审计全部完成。

## 本次端到端验证

- 时间：2026-08-18 22:50（本地）
- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/mage-wars/online-runtime.e2e.ts "正式页面召唤和攻击必要过程帧覆盖"`
- 结果：`1 passed (58.3s)`
- 目标用例：`Mage Wars formal online runtime › 正式页面召唤和攻击必要过程帧覆盖`
- 说明：命令前置编码检查仍有 5 个历史可疑告警，当前默认模式只告警不阻断；本轮没有把这些历史告警当作 Mage Wars 特效失败。
- 修正说明：上一版截图里“伤害飘字”肉眼不可见，原因为 E2E 只断言了 DOM 可见并在飘字刚出现时落盘；本次已把 Mage Wars 攻击飘字调大、改为高对比红色，并把截图门槛提升为字号、透明度、文本内容都达到可读阈值后再延迟落盘。

## 截图证据清单

目录：`test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式页面召唤和攻击必要过程帧覆盖/`

1. `01-兽王野性山猫-召唤来源和目标区域.jpg`
   - 证明：兽王侧已进入真实页面召唤前状态，来源法术与目标区域可见。
2. `01-兽王野性山猫-召唤光柱过程帧.jpg`
   - 证明：野性山猫召唤过程中有可见光柱 / 粒子过程帧，特效锚在目标对象附近。
3. `01-兽王野性山猫-召唤完成单位落场.jpg`
   - 证明：野性山猫完成落场，召唤流程不是只截到过程特效。
4. `02-女祭司阿希拉牧师-召唤来源和目标区域.jpg`
   - 证明：女祭司侧已进入真实页面召唤前状态，来源法术与目标区域可见。
5. `02-女祭司阿希拉牧师-召唤光柱过程帧.jpg`
   - 证明：阿希拉牧师召唤过程中有可见光柱 / 粒子过程帧，特效锚在目标对象附近。
6. `02-女祭司阿希拉牧师-召唤完成单位落场.jpg`
   - 证明：阿希拉牧师完成落场，第二个派系代表召唤链路跑通。
7. `03-间歇喷泉攻击阿希拉牧师-来源到目标投射过程帧.jpg`
   - 证明：攻击从来源到目标生成投射链路，不是只在目标点播放命中。
8. `03-间歇喷泉攻击阿希拉牧师-投射物飞行中.jpg`
   - 证明：投射物飞行中帧被捕捉，目标单位在过程帧中持续可见。
9. `03-间歇喷泉攻击阿希拉牧师-命中动画和伤害飘字过程帧.jpg`
   - 证明：命中和伤害飘字过程帧被捕捉，目标单位在结算反馈期间持续可见。

## 自动核验结论

- 召唤过程帧：E2E 断言 FX 层存在召唤 canvas，非透明像素和高亮像素达到门槛。
- 召唤锚点：E2E 断言召唤 FX 中心贴近目标对象中心，目标对象中心仍被特效覆盖，特效最大尺寸受目标对象比例约束，避免“贴格子不贴单位”或“越大越容易通过”。
- 牌面非空白：截图前后调用 `waitForVisibleMageWarsAtlasCardsLoaded`，可见图集牌面必须加载完成、尺寸非零，并通过采样像素差异检查；空白壳层、未完成 shimmer 或低差异纯色牌面会直接失败。
- 攻击过程帧：E2E 断言投射路径携带来源格 `2:0` 和目标格 `2:1`，投射物飞行帧存在，命中帧出现 `mage-wars-fx-attack-damage-float` 伤害飘字。
- 伤害飘字可读性：E2E 不再只检查飘字 DOM 是否存在；截图前必须满足飘字宽高至少 `24px`、字号至少 `30px`、有效透明度大于 `0.78`，并额外等待 `160ms` 捕捉更清楚的峰值帧。
- 目标连续可见：E2E 启动目标连续性监视器，覆盖攻击骰、投射、命中和伤害飘字活跃帧；目标对象任一帧不可见、透明度过低或消失都会失败。
- 结果避让：E2E 断言攻击骰结果层使用路径旁侧避让位，并检查骰子结果层与目标单位的遮挡比例。
- 权威状态：E2E 断言正式页面点击目标后，服务端状态出现 `间歇喷泉` 对目标对象的攻击掷骰事件。

## 相关低层回归

- `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/hooks/__tests__/useVisualEntityBuffer.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：`7 tests passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/mage-wars/__tests__/Board.fx.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：`14 tests passed`
- `openspec validate refactor-fx-anchor-snapshot-system --strict --no-interactive`
  - 结果：`Change 'refactor-fx-anchor-snapshot-system' is valid`
- `npm run spec:lint`
  - 结果：`spec-lint: OK`
- `npx eslint src/components/game/framework/hooks/useVisualEntityBuffer.ts src/components/game/framework/hooks/__tests__/useVisualEntityBuffer.test.ts src/games/mage-wars/ui/useGameEvents.ts src/games/mage-wars/__tests__/Board.fx.test.tsx`
  - 结果：`0 errors, 1 warning`；warning 是 `src/games/mage-wars/ui/useGameEvents.ts:311` 的既有 `setState in effect` 模式。

## 口径

- 允许说：Mage Wars 当前两个派系代表召唤流程和一条攻击投射 / 命中流程，已经有真实页面 E2E、过程帧截图和自动核验。
- 允许说：攻击目标单位在骰子、投射、命中和伤害飘字活跃期间由共享实体视觉生命周期承接，不会因为规则状态先结算而整张提前消失。
- 允许说：上一版“命中动画和伤害飘字过程帧”证据失效，已通过提高飘字表现强度与截图可读门槛重新生成。
- 禁止说：Mage Wars 全量法术、全量技能类型、装备 / 结界 / buff 表现、整套 UI 视觉审计已经全部完成。
- 本轮只列截图证据路径；没有把候选图或失败图打开给用户。
