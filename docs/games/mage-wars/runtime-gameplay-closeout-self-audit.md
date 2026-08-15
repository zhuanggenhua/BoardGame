# 法师战争标准竞技场两派系运行链收口自审

> 状态：`formal-two-faction-runtime-closeout-pass / scoped-not-full-game`。本文件只证明标准竞技场下兽王 / 女祭司两派系的正式联机核心链已经打通，不表示完整实体版 Mage Wars、全卡表、教程或后续产品系统完成。

## 收口结论

- 已完成：正式双人联机入口从初始房间进入标准竞技场，默认两名法师为兽王 / 女祭司，起始席位来自配置包 `formalStartingDeployment`，不是教程学徒地图。
- 已完成：当前核心链覆盖计划法术、部署生物、对手计划隐藏、守卫、施法、法力 / 弃牌变化、法术 FX、横屏移动、攻击、攻击骰 / 效果骰、伤害 token 和阶段推进。
- 已完成：能力扩展边界已落到注册表合同；预设法术能力由配置 ability catalog、法术能力注册表和法术执行器注册表同步承接，场上对象主动能力由对象能力注册表和对象执行器注册表分发。
- 已完成：运行时使用正式素材链；截图证据来自真实页面，不是 Open Design 设计稿、静态预览或状态注入布局图。
- 已明确：历史资源名、atlas 名或配置版本里的 `apprentice` 只表示首批预设资源来源，不代表本轮目标是教程学徒模式。
- 已明确：`statusTokens`、`temporaryTraits`、`abilityUseRoundNumbers` 仍是后续 TagContainer / ModifierStack 迁移债务；本轮不把它们伪装成已完成的通用 buff 系统，也不建立第二套并行真相。
- 未执行：服务器真实资源上传。上传会改变外部状态；如需发布资源，必须单独走资源发布流程并回查真实结果。
- 不在本轮范围：全 322 张法术、自由构筑、四人模式、豪华竞技场、扩展法师、完整 AI、教程系统、行动日志 UI、撤回 UI。

## 正式入口 E2E 证据

命令：

```powershell
node scripts\infra\run-e2e-command.mjs isolated e2e/mage-wars/online-runtime.e2e.ts
```

结果：`3 passed (1.9m)`。

覆盖关系：

| 用例 | 覆盖内容 | 最新截图证据 |
| --- | --- | --- |
| 正式联机入口从双方计划到部署并保持对手计划隐藏 | 双人正式房间、双方计划、部署、隐藏计划卡背、守卫动作和守卫 token | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机入口从双方计划到部署并保持对手计划隐藏/01-双方计划后-对手计划仍隐藏.jpg` |
| 正式联机入口从双方计划到部署并保持对手计划隐藏 | 部署后场地生物与隐藏边界 | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机入口从双方计划到部署并保持对手计划隐藏/02-部署完成后-场地生物和隐藏计划.jpg` |
| 正式联机入口从双方计划到部署并保持对手计划隐藏 | 守卫后服务端状态断言与守卫标记可见 | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机入口从双方计划到部署并保持对手计划隐藏/04-正式联机守卫后-守卫标记可见.jpg` |
| 正式联机入口真实施放法术并产生法力、弃牌和法术 FX | 真实施放冲锋陷阵、法力和弃牌变化、法术 FX DOM 断言 | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机入口真实施放法术并产生法力、弃牌和法术-FX/03-冲锋陷阵结算后-法力弃牌已变化.jpg` |
| 正式联机移动横屏入口真实移动、攻击并切换回合 | 960x540 横屏布局、场地对象直选 | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机移动横屏入口真实移动、攻击并切换回合/05-横屏生物行动前-场地对象可直选.jpg` |
| 正式联机移动横屏入口真实移动、攻击并切换回合 | 丛林灰狼真实移动到目标区域 | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机移动横屏入口真实移动、攻击并切换回合/06-横屏移动后-丛林灰狼进入目标区域.jpg` |
| 正式联机移动横屏入口真实移动、攻击并切换回合 | 圣光之柱攻击、攻击骰、效果骰、伤害 token | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机移动横屏入口真实移动、攻击并切换回合/07-横屏圣光之柱攻击后-骰盘和伤害状态.jpg` |
| 正式联机移动横屏入口真实移动、攻击并切换回合 | 攻击行动结束后进入终末快速施法窗口 | `test-results/evidence-screenshots/mage-wars/online-runtime.e2e/正式联机移动横屏入口真实移动、攻击并切换回合/08-攻击行动结束后-进入终末快速施法窗口.jpg` |

这些截图只作为 E2E 过程证据；除非用户明确要求打开图片，或后续已经进入稳定候选最终视觉验收，否则不把截图展示动作当成本阶段门禁。

## 能力扩展证据

| 范围 | 证据 | 结论 |
| --- | --- | --- |
| 预设法术能力 | `src/games/mage-wars/__tests__/ability-catalog.test.ts` | 配置 ability catalog、`mageWarsAbilityRegistry` 和 `mageWarsSpellAbilityExecutorRegistry` 的能力 ID 同步；`needs-code` 仍显式保留为缺口 |
| 场上对象主动能力 | `src/games/mage-wars/domain/objectAbilityRuntime.ts` 与 `ability-catalog.test.ts` | 当前对象能力全部可枚举、有元数据、有执行器；未知能力在验证阶段 fail-close |
| 状态 / buff 迁移边界 | `openspec/changes/refactor-mage-wars-object-ability-runtime/specs/mage-wars/spec.md` | 旧状态字段只作为当前实现债务记录，不建立第二套 buff 真相 |

## 门禁结果

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| Mage Wars 定向单测 | `npx vitest run src/games/mage-wars --configLoader native` | `10 files / 263 tests passed` |
| 正式入口 E2E | `node scripts\infra\run-e2e-command.mjs isolated e2e/mage-wars/online-runtime.e2e.ts` | `3 passed (1.9m)` |
| OpenSpec | `openspec validate add-mage-wars-runtime-gameplay-closeout --strict --no-interactive` | valid |
| 主 spec | `openspec validate mage-wars --strict --no-interactive` | valid |
| 项目规范 lint | `npm run spec:lint` | OK |

## 证据边界

- `e2e/mage-wars/online-runtime.e2e.ts` 是本次正式玩法 E2E；它创建正式双人房间、双方占座 / 加入并通过页面点击推进。
- 状态注入布局类 E2E 只能证明布局回归，不再作为玩法完成证据。
- 曾临时新增的 `e2e/mage-wars/runtime-gameplay.e2e.ts` 是单页本地辅助入口，会和双方 ready 规则冲突；本次已从交付中移除，避免误伤 closeout。
- `_shared/online-runtime.e2e` 下的旧截图是早期归档路径错误的历史证据，不作为本文件依据。
- 本文件不是 Mage Wars 整体完成宣告；后续应继续围绕全量法术、自由构筑、更多法师、教程、完整 AI、行动日志 UI 和撤回 UI 分 change 推进。
