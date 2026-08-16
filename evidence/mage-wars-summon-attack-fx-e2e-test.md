# Mage Wars 召唤与攻击特效过程帧 E2E 证据

## 本轮目标

- 两个派系代表链路跑通：兽王侧召唤 `野性山猫`，女祭司侧召唤 `阿希拉牧师`。
- 攻击代表链路跑通：`间歇喷泉` 从来源格飞向目标单位，并在命中时出现伤害飘字。
- 截图覆盖必要过程帧：召唤来源/目标、召唤光柱、单位落场；攻击来源到目标、投射物飞行、命中动画和伤害飘字。
- 本轮不声明全量法术、装备、结界、buff 或完整 UI 视觉审计全部完成。

## 端到端验证

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-command.mjs isolated e2e/mage-wars/online-runtime.e2e.ts --grep "正式页面召唤和攻击必要过程帧覆盖"`
- 结果：`1 passed (1.4m)`
- 目标用例：`Mage Wars formal online runtime › 正式页面召唤和攻击必要过程帧覆盖`
- 说明：命令前置编码检查仍有 5 个历史可疑告警，当前默认模式只告警不阻断；本轮没有把这些历史告警当作 Mage Wars 特效失败。

## 尺寸匹配回归

- 规范主源：`.spec/knowledge/standards/animation-effects.md` 已补充“棋盘特效尺寸匹配”，要求局部特效默认以单位 / 附件槽 / 目标对象的可见尺寸为参照，禁止按整格或全屏放大。
- 代码口径：Mage Wars 召唤 `scale` 从整格大光幕收敛为单位周边光效，召唤暗角关闭；推斥 / 传送来源唤醒、路径爆发和落点光团缩小到单位附近，由 `src/games/mage-wars/ui/fxTuning.ts` 统一调参。
- E2E 门槛：召唤过程帧新增特效盒最大比例约束，要求 FX 中心落在目标格内、目标中心仍被特效覆盖、特效盒最大边不超过目标格 `0.88x`，同时保留亮核和强变化像素门槛，避免“越大越容易通过”。
- 人工图面复核：新召唤截图中光柱不再遮挡半个棋盘，主体回到单位周边；攻击命中、推斥和传送过程帧仍由对应 E2E 覆盖。

## 组件复用 / 调参分离回归

- 规范主源：`.spec/knowledge/standards/animation-effects.md` 已明确“复用组件不等于复用参数”。
- 代码口径：Mage Wars 只复用 `BoardSummonEffectPreset`、`BoardProjectilePathPreset`、`BoardProjectileAttackPreset`、`BoardBurstImpactPreset`、`BoardDamageImpactPreset` 的组件职责；颜色、粒子 preset、时长、路径 padding、飘字字号、命中爆发和受击组合由 `src/games/mage-wars/ui/fxTuning.ts` 显式声明。
- 低层断言：`src/games/mage-wars/__tests__/Board.fx.test.tsx` 覆盖 Mage Wars 攻击颜色、命中爆发 preset / overflow 和直接伤害轻量受击参数，避免正式 renderer 隐式沿用共享 preset 默认调参。

## 截图证据

目录：`test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式页面召唤和攻击必要过程帧覆盖/`

- `01-兽王野性山猫-召唤来源和目标区域.jpg`
- `01-兽王野性山猫-召唤光柱过程帧.jpg`
- `01-兽王野性山猫-召唤完成单位落场.jpg`
- `02-女祭司阿希拉牧师-召唤来源和目标区域.jpg`
- `02-女祭司阿希拉牧师-召唤光柱过程帧.jpg`
- `02-女祭司阿希拉牧师-召唤完成单位落场.jpg`
- `03-间歇喷泉攻击阿希拉牧师-来源到目标投射过程帧.jpg`
- `03-间歇喷泉攻击阿希拉牧师-投射物飞行中.jpg`
- `03-间歇喷泉攻击阿希拉牧师-命中动画和伤害飘字过程帧.jpg`

## 自动核验结论

- 召唤过程帧：E2E 断言 FX 层存在召唤 canvas，非透明像素和高亮像素达到门槛，FX 中心落在本次目标格内，且目标中心仍被局部特效覆盖。
- 召唤过程帧尺寸：E2E 断言特效盒最大边不超过目标格 `0.88x`，避免召唤光柱按整格或全屏遮挡。
- 召唤截图区域：E2E 对动作前目标格和过程帧目标格做归一化像素对比，要求强变化像素、亮度正向变化像素达到局部单位特效门槛，并且亮度提升必须压过暗场变化。
- 攻击过程帧：E2E 断言投射路径携带来源格 `2:0` 和目标格 `2:1`，投射物飞行帧存在，命中帧出现 `mage-wars-fx-attack-damage-float` 伤害飘字。
- 权威状态：E2E 断言正式页面点击目标后，服务端状态出现 `间歇喷泉` 对目标对象的攻击掷骰事件。

## 额外受影响 E2E

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-command.mjs isolated e2e/mage-wars/online-runtime.e2e.ts --grep "正式页面推斥法术过程帧覆盖来源飞行命中"`
- 结果：`1 passed (42.9s)`
- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-command.mjs isolated e2e/mage-wars/online-runtime.e2e.ts --grep "正式页面传送法术过程帧覆盖来源轨迹落点"`
- 结果：`1 passed (42.1s)`

## 低层回归

- 命令：`npx vitest run src/games/mage-wars/__tests__/Board.fx.test.tsx --configLoader native`
- 结果：`1 file passed, 12 tests passed`
- 命令：`npx vitest run src/engine/fx/__tests__/useFxBus.budget.test.tsx src/engine/fx/__tests__/frameClock.test.ts --configLoader native`
- 结果：`2 files passed, 10 tests passed`
- 命令：`npm run spec:lint`
- 结果：`spec-lint: OK`
- 命令：`npx tsc --noEmit --pretty false --skipLibCheck false --project tsconfig.json`
- 结果：通过，无 TypeScript 输出错误。

## 口径

- 允许说：Mage Wars 当前两个派系代表召唤流程和一条攻击投射/命中流程，已经有真实页面 E2E、过程帧截图和自动核验。
- 禁止说：Mage Wars 全量法术、全量技能类型、装备/结界/buff 表现、整套 UI 视觉审计已经全部完成。
- 本轮未把候选图或失败图打开给用户；截图目录只作为通过后的证据清单列出。
