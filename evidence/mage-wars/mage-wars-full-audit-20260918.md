# Mage Wars 全面审计总账

> 审计日期：2026-09-23
> 文档类型：`audit`
> 结论等级：`当前范围已完成，产品范围有明确边界`
> 这份文档完成的是“四本标准起始法术书 153 个唯一卡对象”的逐卡数据、资源、运行时消费者和规则实现审计；不把当前范围结果外推成完整 322 张卡池、自由构筑或产品级主黄金 E2E 已完成。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 当前配置包 153 项逐项列出；四本标准书与 5 个对象能力另列 |
| 真相源状态 | passed | 配置包、规则合同、能力目录、当前实现均已锁定 |
| 原子语义断言 | passed | 153/153 行有规则合同、结构化字段或明确的共享消费归属；`needsReview=0` |
| 实现消费链 | passed | 153/153 行有当前运行时消费者；149 张进入通用施法 family，4 张由对象 / 响应专用链消费 |
| 最终权威结果 | passed | `temp/mage-wars-full-audit-20260922.json`：`pass=153`、`runtimeAllPass=true`、`status=complete` |
| 交互真实入口 | passed | 当前新增 11 项玩家交互逐项有真实点击、直接结果断言和 76 张同次运行截图 |
| 验证证据 | passed | Mage Wars 39 个测试文件 / 530 个测试通过；在线真实入口 11 passed |
| 共享影响与代表链依据 | passed | 第 5 节列出 sharedFlowId、消费点、触发队列、阶段收口、无残留和可外推边界 |
| 缺口分类与范围裁定 | passed | 第 7 节逐项分类并给出最小补救 |
| 旧 evidence / 旧结论对账回写 | passed | 第 10 节明确保留范围与降级口径 |
| 残余范围声明 | passed | 第 2、7、10、12、13、14 节明确当前范围与产品范围边界 |

## 1. 审计范围

- 游戏：`mage-wars`
- 本轮对象：当前配置包中全部带 `standard-starting-spell` 的法术对象、法师 / 场上对象主动能力、四本标准起始法术书、阶段 / 资源 / 目标 / 响应 / 终局共享链、支撑能力和当前真实入口证据。
- 当前真相源：`src/games/mage-wars/data/mage-wars.config.json`、`src/games/mage-wars/domain/abilityCatalog.ts`、`docs/games/mage-wars/rule/standard-starting-spellbooks.md`、`docs/games/mage-wars/rule/apprentice-card-field-contract.md`、当前领域实现与测试。
- 当前入口 / 环境：本地 Board、Mage Wars 正式双人入口、现有 Playwright 真实入口证据；当前工作树包含未提交 Mage Wars UI / E2E 修改。
- 明确不在本轮对象全集内：尚未进入当前配置包的未来扩展卡 / 扩展法师、四人模式、豪华竞技场、服务器资源发布结果。它们作为产品边界记录，不计入本轮 153 张当前配置对象，但不能被宣传为已完成。

## 2. 总体结论

| 审计面 | 当前结果 | 证据 | 现实含义 |
| --- | --- | --- | --- |
| 当前配置法术对象全集 | 已建立 | `buildMageWarsSpellAbilityDefs()` 当前返回 153 项 | 153 个对象均已登记到本账，不再只有代表卡 |
| 法术对象实现分类 | 153 项 `implemented`，0 项 `needs-code` | `abilityCatalog.ts`、配置包与逐卡矩阵 | 当前范围没有“配置已登记但没有运行时消费者”的卡 |
| 场上对象主动能力 | 5 项均标记 `implemented` | `mageWarsObjectAbilityDefs`、`objectAbilityRuntime.ts` | 仅说明注册与执行入口存在；真实入口仍按代表链判等 |
| 标准起始书 | 4 本，唯一条目数 50 / 44 / 46 / 45，总张数 67 / 55 / 59 / 59 | `standardStartingSpellbooks.ts`、`mage-wars.config.json` | 当前正式入口是四本标准起始书，不是全卡池自由构筑 |
| 领域回归验证 | 39 个测试文件 / 530 个测试通过 | 当前命令见第 8 节 | 当前范围规则链与 UI 单测已通过 |
| 真实入口证据 | 11 项新增交互通过，76 张截图 | `evidence/mage-wars/mage-wars-online-runtime-pass-manifest-20260923.json` | 新增交互已逐项留存真实浏览器证据，但不等于每张卡各自有浏览器场景 |
| 产品发布状态 | `under_construction` | `src/games/mage-wars/manifest.ts` | 当前代码自己也保留“施工中”状态，和全量完成不一致 |

因此，本轮的审计判断是：**四本标准起始法术书的 153 个唯一卡对象已完成数据、资源、运行时消费者和规则实现审计；当前新增 11 项玩家交互也已完成真实浏览器收口。仍不能把这个范围外推为完整 322 张卡池、自由构筑、移动教程、远程 AI 或产品级主黄金 E2E 全部完成。**

## 3. 法术对象统计

| 法术类型 | 对象总数 | 配置标记已实现 | 明确需要代码 | 当前实现比例 |
| --- | ---: | ---: | ---: | ---: |
| 攻击 | 12 | 12 | 0 | 100.0% |
| 结界 | 38 | 38 | 0 | 100.0% |
| 魔物 | 15 | 15 | 0 | 100.0% |
| 生物 | 33 | 33 | 0 | 100.0% |
| 咒语 | 28 | 28 | 0 | 100.0% |
| 装备 | 27 | 27 | 0 | 100.0% |

- 统计口径：以当前运行时 `buildMageWarsSpellAbilityDefs()` 返回的 153 项为准。
- `implemented` 只代表配置 / 能力目录的实现状态，不自动等同于每张卡都有独立真实入口 E2E。
- 当前 `requiresCodeSupport=false` 已与运行时消费者、规则合同和回归测试对账；不再把旧的 `needs-code` 快照当作当前缺口。
- 2026-09-19 已把 1804「法师祸咒」接入现有显性对象结界施法 family；其施法结算后的 1 点直接伤害继续由 TimingOpportunitySystem 消费，未新增第二套触发入口。

## 4. 标准起始书与主动能力对象

### 标准起始书

| 法师 | 实体卡数量 | 唯一卡条目数 | 来源 |
| --- | ---: | ---: | --- |
| beastmaster_apprentice | 33 | 26 | 配置包标准起始书 |
| priestess_apprentice | 30 | 25 | 配置包标准起始书 |
| warlock_apprentice | 30 | 25 | 配置包标准起始书 |
| wizard_apprentice | 30 | 26 | 配置包标准起始书 |

### 场上对象主动能力

| 来源卡号 | 能力 | abilityId | 实现状态 | 当前裁定 |
| ---: | --- | --- | --- | --- |
| 2822 | 蓝色精怪迅捷传送 | mw.object.2822.swift-teleport | implemented | 对象能力注册表 + objectAbilityRuntime；当前有领域 / Board 代表证据，不外推为全对象完成 |
| 2811 | 治疗之光 | mw.object.2811.healing-light | implemented | 对象能力注册表 + objectAbilityRuntime；当前有领域 / Board 代表证据，不外推为全对象完成 |
| 2907 | 救赎献祭 | mw.object.2907.redemption-sacrifice | implemented | 对象能力注册表 + objectAbilityRuntime；当前有领域 / Board 代表证据，不外推为全对象完成 |
| 3710 | 群兽法杖 | mw.equipment.3710.beast-staff | implemented | 对象能力注册表 + objectAbilityRuntime；当前有领域 / Board 代表证据，不外推为全对象完成 |
| 3716 | 元素魔杖 | mw.equipment.3716.elemental-staff-bind | implemented | 对象能力注册表 + objectAbilityRuntime；当前有领域 / Board 代表证据，不外推为全对象完成 |

## 5. 共享流程审计

| sharedFlowId | 共享流程 | 当前证据 | 直接证明 | 仍不能证明 |
| --- | --- | --- | --- | --- |
| `mw.entry.spellbook-selection` | 选择法师 / 标准书、命名副本进入计划 | `e2e/mage-wars/mage-selection.e2e.ts`；`MageSelectionGate.test.tsx` | 选择页、标准书 / 命名副本、进入计划态的入口合同 | 全卡池自由构筑、扩展法师 |
| `mw.phase.planning-and-channeling` | 计划、隐藏计划、聚魔、阶段推进 | `phase-flow.test.ts`；教程 E2E / 既有候选链 | 计划命令、资源变化、阶段进入和隐藏信息边界 | 每张卡在每种阶段组合下的自然整局 |
| `mw.spell.cast-resolution` | 施法、目标、法力、弃牌、攻击 / 治疗 / 推动 / 传送 | `spell-resolution.test.ts`、`spell-action-cards.test.ts`、`online-runtime.e2e.ts` | 153 张标准卡均有当前运行时消费者；代表交互有最终权威结果 | 每张卡各自一条浏览器场景、完整自由构筑 |
| `mw.arena.object-action` | 场上对象移动、攻击、守卫、对象能力 | `arena-action-flow.test.ts`、`arena-object-attacks.test.ts`、`Board.fx.test.tsx` | 对象动作、目标选择、能力入口和部分特效 | 全部生物 / 附件主动能力的独立玩家链 |
| `mw.response.window` | 守卫反击、隐藏结界揭示 / 反制、响应后清理 | `guard-defense-window.test.ts`、`enchantment-response.test.ts`、现有隐藏响应 E2E | 已证明代表响应提交后最终状态和清理 | 多响应者、AI 响应、全部响应牌 |
| `mw.wall.boundary-and-passage` | 墙体边界目标、视线阻挡、穿越伤害 | `wall-mechanics.test.ts`、`evidence/mage-wars-wall-mechanics/e2e-test.md` | 当前两张墙体对象的公共机制和一条真实入口链 | 服务器资源发布；仅按共享流程判等的对象没有独立浏览器链 |
| `mw.lifecycle.upkeep-and-gameover` | 维护、状态伤害 / 移除、回合交接、胜负 | `status-upkeep-flow.test.ts`、`phase-flow.test.ts` | 领域状态变化和近终局收口 | 当前领域回归全绿，但未证明自然满血整局打到胜负 |
| `mw.support.capabilities` | 操作日志、撤回、音效、本地 AI、教程、开发调试 | `game.ts`、`actionLog.ts`、`audio.config.ts`、`ai.ts`、`tutorial.ts` 与对应测试 | 注册入口、部分领域合同、教程桌面链 | 操作日志 UI、撤回 UI、远端 AI、移动教程和全量自然玩家链 |

共享流程复用裁定：逐卡矩阵只在触发时机、候选生成、权限、payload、执行入口、最终权威状态和清理语义一致时复用；当前矩阵已将这些条件落成逐卡行。11 组真实浏览器交互证明新增玩家入口，不把它越权解释成每张卡都有独立浏览器场景。
代表对象判等依据：1905「魔法逆转」、1907「传送陷阱」、25700「荆棘之墙」、3425「原力推斥」、3710「群兽法杖」和 2822「蓝色精怪」分别覆盖隐藏响应、区域进入触发、墙体边界、推斥、附件能力和对象主动能力；只有触发时机、目标模式、权限、payload、执行入口、最终状态和清理语义全部一致，才允许共享流程复用。若只是配置差异，留在逐卡矩阵；出现任一行为差异，则必须补独立直接测试或独立入口证据。
共享流程 / 同样流程复用的结论来自逐卡一致性核对，不来自名称相似或能力目录布尔值；当前 153 行矩阵已完成该核对。

## 6. 当前支撑能力状态

| 能力 | 当前状态 | 当前证据 | 不能外推的部分 |
| --- | --- | --- | --- |
| 操作日志 | 已接入实现 | `game.ts` 注册 `ACTION_ALLOWLIST` + `formatMageWarsActionEntry`；多份领域测试断言日志事件 | 未形成独立真实玩家日志面板收口证据 |
| 撤回 | 已接入实现 | `game.ts` 注册独立 `UNDO_ALLOWLIST`；领域测试断言真人快照与 AI 不占快照 | 未完成真实浏览器撤回 UI / 刷新恢复证据 |
| 音效 | 已接入实现 | `audio.config.ts` 有反馈解析、BGM、critical / warm key；`audio.config.test.ts` 当前 4 项通过 | 代码解析通过不等于真实设备试听完成 |
| 本地 AI | 已接入实现 | `manifest.ts` 为 `localAi: true`；`ai.ts` 有合法动作构建与 baseline policy；`ai.test.ts` 当前 6 项通过 | `remoteAi: false`；没有完整自然对局 AI 证据 |
| 教程 | 桌面当前范围已通过 | `tutorial.ts`、`tutorial.test.ts`、`evidence/mage-wars-tutorial/e2e-test.md` | 移动教程、所有可选分支、完整实体版教学不在当前收口 |
| 开发调试 | 有开发态接入 | `game.ts` 注册 `createCheatSystem()` | 不构成正式玩家玩法入口，也不替代真实 E2E |

## 7. 明确发现与缺口分类

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞全量收口 | 最小补救 |
| --- | --- | --- | --- | --- |
| 0 个 `needs-code` 法术对象 | 已收口 | 否 | 否 | 保持逐卡矩阵、配置包和能力目录同步 |
| 当前领域回归 | 已通过 | 否 | 否 | 保持全目录回归；新增牌族实现时继续补最小领域测试 |
| 当前新增真实入口 | 已通过 | 否 | 否 | 继续按新增交互逐项生成截图与 PASS 清单 |
| 操作日志 / 撤回缺少真实 UI 收口 | 当前范围验证缺口 | 否 | 是产品交付口径 | 补正式 HUD / FAB 真实入口与回退、日志可见性和刷新恢复证据 |
| `remoteAi: false` | 非阻塞扩展（若当前目标只要求本地 AI） | 否 | 若目标包含远端 AI，则是 | 明确产品范围；当前不把它伪装成已支持 |
| 服务器资源发布未执行 | 外部状态未验证 | 否 | 否 | 需要线上交付时走正式发布链并回查 HTTP 结果 |
| `statusTag: under_construction` | 产品状态提示 | 否 | 否 | 当前范围完成不等于产品全范围完成，保持原值 |

## 8. 当前验证命令与结果

### 领域测试

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/mage-wars --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000
```

结果：

- 39 个测试文件：39 通过。
- 530 个测试：530 通过。
- 既有 React `act(...)` 提示和预期拒绝日志均未造成失败；全量进程退出码为 0。

### 现有真实入口证据

- 命令：`npm run test:e2e:file -- e2e/mage-wars/online-runtime.e2e.ts`；结果：`11 passed`。
- 截图目录：`test-results/evidence-screenshots/mage-wars/online-runtime.e2e`，共 76 张媒体。
- `evidence/mage-wars-phase-rail-layout-pass-manifest-20260918.json` 只证明阶段轨道 / HUD / 响应式布局，本身不证明规则或全游戏完成。
- 本轮只生成链接，没有代为打开浏览器。；本轮只生成链接，没有代为打开浏览器。。

## 9. 对象级审计清单

下面逐项列出当前 153 个配置法术对象。当前状态以 `temp/mage-wars-full-audit-20260922.json` 为准；旧的 `needs-code` 行已按当前配置包、运行时消费者和回归结果同步为 `implemented`。

### 攻击

| 卡号 | 名称 | 配置实现状态 | 对象 ID | 合同来源 | 当前裁定 |
| ---: | --- | --- | --- | --- | --- |
| 1700 | 火球术 | implemented | spell-1700 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1701 | 火焰风暴 | implemented | spell-1701 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1702 | 烈焰爆弹 | implemented | spell-1702 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1703 | 连锁闪电 | implemented | spell-1703 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1704 | 雷导术 | implemented | spell-1704 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1705 | 闪电箭矢 | implemented | spell-1705 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1706 | 圣光之柱 | implemented | spell-1706 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1707 | 烈焰之环 | implemented | spell-1707 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1708 | 怒雷箭矢 | implemented | spell-1708 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1709 | 眩目闪光 | implemented | spell-1709 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1710 | 间歇喷泉 | implemented | spell-1710 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1711 | 气流 | implemented | spell-1711 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |

### 结界

| 卡号 | 名称 | 配置实现状态 | 对象 ID | 合同来源 | 当前裁定 |
| ---: | --- | --- | --- | --- | --- |
| 1800 | 剧痛难当 | implemented | spell-1800 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1801 | 死亡链接 | implemented | spell-1801 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1804 | 法师祸咒 | implemented | spell-1804 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 已接入显性对象结界施法 family；施法结算后的 1 点直接伤害由时点机会链消费；仍需逐卡真实入口证据，不能外推为全游戏完成 |
| 1806 | 格挡 | implemented | spell-1806 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1807 | 剧痛锁链 | implemented | spell-1807 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1808 | 公牛耐力 | implemented | spell-1808 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1809 | 灵蛇反射 | implemented | spell-1809 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1810 | 闪电之环 | implemented | spell-1810 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1811 | 诱饵 | implemented | spell-1811 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1812 | 神力干涉 | implemented | spell-1812 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1813 | 神力加护 | implemented | spell-1813 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1814 | 雄鹰之翼 | implemented | spell-1814 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1815 | 精华汲取 | implemented | spell-1815 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1816 | 身心俱疲 | implemented | spell-1816 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1818 | 原力法剑 | implemented | spell-1818 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1819 | 原力法球 | implemented | spell-1819 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1820 | 尸鬼腐化 | implemented | spell-1820 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1821 | 法力融合 | implemented | spell-1821 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1822 | 猎鹰之眼 | implemented | spell-1822 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1823 | 狱火陷阱 | implemented | spell-1823 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1824 | 折翼 | implemented | spell-1824 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1825 | 厄运 | implemented | spell-1825 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1826 | 死亡印记 | implemented | spell-1826 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1900 | 猫鼬灵步 | implemented | spell-1900 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1901 | 法力失效 | implemented | spell-1901 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1902 | 毒血攻心 | implemented | spell-1902 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1903 | 反戈一击 | implemented | spell-1903 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1904 | 攻击逆转 | implemented | spell-1904 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1905 | 魔法逆转 | implemented | spell-1905 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1907 | 传送陷阱 | implemented | spell-1907 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1908 | 原力之握 | implemented | spell-1908 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1910 | 鲜血贪噬 | implemented | spell-1910 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1912 | 心灵安抚 | implemented | spell-1912 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1913 | 圣佑领地 | implemented | spell-1913 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1914 | 巨熊力量 | implemented | spell-1914 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1915 | 猎豹之速 | implemented | spell-1915 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 1916 | 体肤重生 | implemented | spell-1916 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 1917 | 犀牛兽皮 | implemented | spell-1917 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |

### 魔物

| 卡号 | 名称 | 配置实现状态 | 对象 ID | 合同来源 | 当前裁定 |
| ---: | --- | --- | --- | --- | --- |
| 2203 | 阿希拉神殿 | implemented | spell-2203 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2206 | 尖齿与利爪 | implemented | spell-2206 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2207 | 拉贾恩之怒 | implemented | spell-2207 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2208 | 毒气云雾 | implemented | spell-2208 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2209 | 五星魔阵 | implemented | spell-2209 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2212 | 战斗锻炉 | implemented | spell-2212 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2218 | 巢穴 | implemented | spell-2218 | docs/games/mage-wars/rule/familiar-spellcasting-card-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2219 | 宾莎拉之手 | implemented | spell-2219 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2221 | 法力水晶 | implemented | spell-2221 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2222 | 法力灵花 | implemented | spell-2222 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2223 | 法力虹吸 | implemented | spell-2223 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2224 | 缠绕藤蔓 | implemented | spell-2224 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2303 | 生命巨树默克塔利 | implemented | spell-2303 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2500 | 烈火之墙 | implemented | spell-2500 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 25700 | 荆棘之墙 | implemented | spell-25700 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |

### 生物

| 卡号 | 名称 | 配置实现状态 | 对象 ID | 合同来源 | 当前裁定 |
| ---: | --- | --- | --- | --- | --- |
| 2800 | 暗契屠魔 | implemented | spell-2800 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2801 | 火烙魔婴 | implemented | spell-2801 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2802 | 钢爪灰熊 | implemented | spell-2802 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2803 | 烈焰狱鬼 | implemented | spell-2803 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2804 | 狼人宠物戈伦 | implemented | spell-2804 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2806 | 头狼赤爪 | implemented | spell-2806 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2807 | 汲法水蛭 | implemented | spell-2807 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2808 | 翠绿树蜥 | implemented | spell-2808 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2809 | 石目蛇蜥 | implemented | spell-2809 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2810 | 戈尔贡箭手 | implemented | spell-2810 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2811 | 阿希拉牧师 | implemented | spell-2811 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2812 | 苦木林狐 | implemented | spell-2812 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2813 | 布洛根·血石 | implemented | spell-2813 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2814 | 高地独角兽 | implemented | spell-2814 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2816 | 皇家箭手 | implemented | spell-2816 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2817 | 闪电天使瓦尔莎拉 | implemented | spell-2817 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2818 | 火焰领主阿德拉梅莱克 | implemented | spell-2818 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2819 | 丛林灰狼 | implemented | spell-2819 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2820 | 雷隙猎鹰 | implemented | spell-2820 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2821 | 雪貂伙伴索斯鲁柯 | implemented | spell-2821 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2822 | 蓝色精怪 | implemented | spell-2822 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2824 | 深林幽影切维尔 | implemented | spell-2824 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2825 | 暗沼蝙蝠 | implemented | spell-2825 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2826 | 骷髅哨兵 | implemented | spell-2826 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2901 | 暗沼九头蛇 | implemented | spell-2901 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2902 | 死魂吸血鬼 | implemented | spell-2902 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2903 | 高山猩猩 | implemented | spell-2903 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2904 | 月光妖精 | implemented | spell-2904 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 2906 | 野性山猫 | implemented | spell-2906 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2907 | 灰衣天使 | implemented | spell-2907 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2908 | 乌鸦魔宠胡金 | implemented | spell-2908 | docs/games/mage-wars/rule/familiar-spellcasting-card-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2909 | 西锁骑士 | implemented | spell-2909 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 2910 | 玛拉寇达 | implemented | spell-2910 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |

### 咒语

| 卡号 | 名称 | 配置实现状态 | 对象 ID | 合同来源 | 当前裁定 |
| ---: | --- | --- | --- | --- | --- |
| 3400 | 生命汲取 | implemented | spell-3400 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3401 | 炎爆 | implemented | spell-3401 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3402 | 次级治疗 | implemented | spell-3402 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3403 | 兽性觉醒 | implemented | spell-3403 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3404 | 汲血之击 | implemented | spell-3404 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3405 | 群体治疗 | implemented | spell-3405 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3408 | 单体治疗 | implemented | spell-3408 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3409 | 结界窃取 | implemented | spell-3409 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3410 | 传送 | implemented | spell-3410 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3411 | 昏睡 | implemented | spell-3411 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3412 | 结界迁移 | implemented | spell-3412 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3413 | 放逐 | implemented | spell-3413 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3414 | 反隐驱散 | implemented | spell-3414 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3415 | 起死回生 | implemented | spell-3415 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3416 | 战斗怒火 | implemented | spell-3416 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3417 | 荒野呼唤 | implemented | spell-3417 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3418 | 毒素净化 | implemented | spell-3418 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3420 | 魔法净化 | implemented | spell-3420 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3421 | 穿刺突击 | implemented | spell-3421 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3422 | 完美一击 | implemented | spell-3422 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3423 | 圣疗神恩 | implemented | spell-3423 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3424 | 击倒 | implemented | spell-3424 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3425 | 原力推斥 | implemented | spell-3425 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3426 | 神行无阻 | implemented | spell-3426 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3500 | 力量汲取 | implemented | spell-3500 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3523 | 原力推斥 | implemented | spell-3523 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3605 | 瓦解 | implemented | spell-3605 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3606 | 驱散 | implemented | spell-3606 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |

### 装备

| 卡号 | 名称 | 配置实现状态 | 对象 ID | 合同来源 | 当前裁定 |
| ---: | --- | --- | --- | --- | --- |
| 3700 | 恶魔胸甲 | implemented | spell-3700 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3701 | 狱火长鞭 | implemented | spell-3701 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3702 | 皮革手套 | implemented | spell-3702 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3703 | 龙鳞锁甲 | implemented | spell-3703 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3704 | 奥秘法杖 | implemented | spell-3704 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3705 | 抑制斗篷 | implemented | spell-3705 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3706 | 阿希拉法杖 | implemented | spell-3706 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3707 | 重生腰带 | implemented | spell-3707 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3708 | 风龙皮甲 | implemented | spell-3708 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3709 | 元素斗篷 | implemented | spell-3709 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3710 | 群兽法杖 | implemented | spell-3710 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3711 | 巨熊皮甲 | implemented | spell-3711 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3712 | 天护皇冠 | implemented | spell-3712 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3713 | 奥术戒指 | implemented | spell-3713 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3714 | 破晓指环 | implemented | spell-3714 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3715 | 偏移护腕 | implemented | spell-3715 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3716 | 元素魔杖 | implemented | spell-3716 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3719 | 塑火指环 | implemented | spell-3719 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3720 | 恐惧头盔 | implemented | spell-3720 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3721 | 皮革长靴 | implemented | spell-3721 | docs/games/mage-wars/rule/apprentice-card-field-contract.md | 进入实现池；需共享流程或直接证据，不能外推为逐卡浏览器通过 |
| 3722 | 野银长弓 | implemented | spell-3722 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3725 | 法师魔杖 | implemented | spell-3725 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3726 | 摩洛王的折磨 | implemented | spell-3726 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3800 | 月光项链 | implemented | spell-3800 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3801 | 阿希拉之戒 | implemented | spell-3801 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3802 | 群兽之戒 | implemented | spell-3802 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |
| 3803 | 诅咒之戒 | implemented | spell-3803 | docs/games/mage-wars/rule/standard-starting-spellbooks.md | 已由 2026-09-22 逐卡矩阵验证；当前运行时消费者已接入 |


## 10. 旧 evidence / 旧结论对账

| 旧材料 | 当前对账 |
| --- | --- |
| `evidence/mage-wars-golden-flow-coverage-matrix.md` | 继续有效，但只支持“当前范围候选链”，不能支持“全面完成”。 |
| `docs/games/mage-wars/runtime-gameplay-closeout-self-audit.md` | 继续有效，明确是 `scoped-not-full-game`；本账把其残余范围转成对象级清单。 |
| `evidence/mage-wars-tutorial/e2e-test.md` | 继续有效，范围是桌面教程；不能外推到移动教程 / 全卡池 / 完整自然对局。 |
| `evidence/mage-wars-phase-rail-layout-pass-manifest-20260918.json` | 继续有效，范围仅是当前 UI 布局修复；不能当玩法或全面审计证据。 |
| 旧的“当前范围完成”式表述 | 若没有同时附本账的对象全集与残余范围，统一降级为“当前范围 / 代表链已验证”。 |

## 11. 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 当前配置包 153 项逐项列出；四本标准书与 5 个对象能力另列 |
| 真相源状态 | passed | 配置包、规则合同、能力目录、当前实现均已锁定 |
| 原子语义断言 | passed | 153/153 行有规则合同、结构化字段或明确的共享消费归属；`needsReview=0` |
| 实现消费链 | passed | 153/153 行有当前运行时消费者；149 张进入通用施法 family，4 张由对象 / 响应专用链消费 |
| 最终权威结果 | passed | `temp/mage-wars-full-audit-20260922.json`：`pass=153`、`runtimeAllPass=true`、`status=complete` |
| 交互真实入口 | passed | 当前新增 11 项玩家交互逐项有真实点击、直接结果断言和 76 张同次运行截图 |
| 验证证据 | passed | Mage Wars 39 个测试文件 / 530 个测试通过；在线真实入口 11 passed |
| 共享影响与代表链依据 | passed | 第 5 节列出 sharedFlowId、消费点和可外推边界 |
| 缺口分类与范围裁定 | passed | 第 7 节逐项分类并给出最小补救 |
| 旧 evidence / 旧结论回写 | passed | 第 10 节明确保留范围与降级口径 |
| 残余范围声明 | passed | 第 2、7、10、12、13、14 节明确当前范围与产品范围边界 |

## 12. 最小后续动作

1. 保持 153 张标准起始书矩阵、配置包、atlas/frame 合同和能力目录同步。
2. 新增玩家交互时，继续按项目规范逐项补真实点击、直接结果断言、同次运行截图和 `VIEWER_URL`。
3. 若要扩大到完整 322 张卡池、自由构筑、移动教程、远端 AI 或线上资源发布，另开明确范围的审计批次，不把本账本外推。

## 13. 对外口径

- 可以说：四本标准起始法术书 153 张唯一卡对象已完成当前范围的全面数据、资源、运行时消费者和规则实现审计；当前新增 11 项玩家交互已通过真实浏览器 E2E。
- 不能说：完整 322 张卡池、自由构筑、完整自然整局、远端 AI、移动教程或线上资源发布已经完成。
## 14. 2026-09-23 当前新增交互真实入口收口

本节记录当前新增玩家交互的逐项真实浏览器覆盖；它不把 11 组 E2E 越权解释成 153 张卡各自都有独立浏览器场景。

| # | 新增玩家交互 | 真实动作与直接结果 | 证据目录 |
| --- | --- | --- | --- |
| 1 | 双方计划到部署并保持对手计划隐藏 | 双方真实提交计划；部署完成；对手计划仍不可见 | `正式联机入口从双方计划到部署并保持对手计划隐藏` |
| 2 | 正式施放标准强化法术 | 真实点击施放；法力、弃牌和卡牌结果发生对应变化 | `正式联机入口真实施放标准强化法术并只产生法力、弃牌和卡牌结果` |
| 3 | 移动、攻击并切换回合 | 真实选择单位、移动、攻击并结束当前回合；目标状态和回合阶段推进 | `正式联机入口真实移动、攻击并切换回合` |
| 4 | 召唤与远程攻击过程帧 | 真实召唤与攻击；来源、飞行、命中和伤害过程帧均保存 | `正式页面召唤和攻击必要过程帧覆盖` |
| 5 | 近战攻击实际动效 | 真实近战目标选择；来源唤醒、命中、伤害飘字和稳定收口均保存 | `正式页面近战攻击实际动效独立证据覆盖` |
| 6 | 当前范围候选链 | 真实覆盖选择法师、计划、部署、移动、守卫、装备结界、魔物、攻击、能力和终局 | `Mage-Wars-入口接入当前范围候选链：选择法师法术书后覆盖计划、部署、移动、守卫、装备结界、魔物、攻击、能力和终局` |
| 7 | 隐藏法力失效响应窗口 | 真实揭示隐藏响应结界并反制目标法术；目标法术进入弃牌 | `正式页面隐藏法力失效响应窗口可揭示并反制目标法术` |
| 8 | 群兽法杖附件治疗模式 | 真实从牌面发动、选择友方动物、选择治疗模式；治疗结果和过程帧均保存 | `正式页面群兽法杖附件可从牌面发动并选择治疗模式` |
| 9 | 墙体边界、视线与穿越伤害 | 真实选择墙体边界；墙后目标不可选；穿越墙体触发通行伤害 | `正式页面墙体法术可选择边界并在穿越时触发通行伤害` |
| 10 | 推斥法术过程帧 | 真实施放推斥；来源、飞行、命中和推离路径均保存 | `正式页面推斥法术过程帧覆盖来源飞行命中` |
| 11 | 传送法术过程帧 | 真实施放传送；来源唤醒、轨迹和目标区域落点均保存 | `正式页面传送法术过程帧覆盖来源轨迹落点` |

### 本轮直接验证
- 命令：`npm run test:e2e:file -- e2e/mage-wars/online-runtime.e2e.ts`；结果：`11 passed`。
- 截图目录：`test-results/evidence-screenshots/mage-wars/online-runtime.e2e`，共 76 张媒体。
- PASS 清单：`evidence/mage-wars/mage-wars-online-runtime-pass-manifest-20260923.json`。
- PASS 清单 dry-run：通过；`MEDIA_COUNT=76`。
- `npm run audit:evidence:selfcheck -- evidence/mage-wars/mage-wars-full-audit-20260918.md`：通过。
- `npm run spec:lint`：通过。
- 网页查看器：`VIEWER_URL=http://127.0.0.1:4867/?key=cffbc195e8c1`；本轮只生成链接，没有代为打开浏览器。

### 结论边界

这 11 项证明的是当前新增真实玩家交互已经逐项有真实点击、直接结果断言和同次运行截图证据；它不能替代完整 322 张卡池、自由构筑、移动教程、远端 AI 或线上资源发布的独立审计。
