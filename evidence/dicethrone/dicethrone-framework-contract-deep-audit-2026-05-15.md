# DiceThrone 框架消费合同深审（2026-05-15）

> 2026-06-05 当前有效口径：本文只保留 2026-05-15 这一轮“共享框架消费合同”深审的历史命中与修复证据，不代表 Treant、Ninja 或四位新英雄整批当前完成态。它现在只能证明“某类共享根因已经被发现、修复并补上自动合同测试”，不能外推成 Treant / Ninja 已全面审计完成；当前实时残余仍应以批次级 `L4` 判等矩阵、旧文档统一回写与最终发布口径统一为准。

## 触发原因

用户指出 Ninja / Treant 的基础技能仍出现贴图、时机、防御、不可防御交叉规则等错误，说明之前“全面审计”结论失效。Rooted / Blink 的防御无效果不是单点录入错误，而是框架消费合同没有被审计和自动化固化。

## 根因结论

这是框架合同治理问题，叠加数据录入审计不够深：

- 数据层 `EffectTiming` 允许 `immediate | preDefense | withDamage | postDamage`。
- 防御结算实际入口 `resolveDefenseEffects` 只消费 `withDamage` 与 `postDamage`。
- 旧审计只核了 AbilityDef / customAction handler / 部分最终 HP，没有从 resolver 消费点反查“这个 timing 是否会被读取”。
- 旧 GTR 用例曾选择不存在的 `flame-shield`，Pipeline 打印 `ability_not_available`，但测试只断言最终状态，导致假阳性通过。

因此，基础技能出错不是“某一行漏看”，而是审计维度缺了“框架消费合同反向审计”和“未预期命令失败不得吞掉”两层。

## 影响面登记

| 合同 | 消费点 | 允许值 / 定义面 | 实际消费值 | 命中对象 | 处理 |
|---|---|---|---|---|---|
| 防御技能 effect timing | `src/games/dicethrone/domain/attack.ts` `resolveDefenseEffects` | `immediate/preDefense/withDamage/postDamage` | `withDamage/postDamage` | Treant `rooted`、Pyromancer `magma-armor` I/II/III | 已改为 `withDamage`，补合同测试 |
| 防御用例命令成功 | `GameTestRunner.steps/actualErrors` | 任意命令可失败但测试未必断言 | 非失败路径必须 `actualErrors=[]` | `pyromancer-coverage` 旧 `flame-shield` | 改为 `magma-armor`，补 `actualErrors` 断言 |

## 自动合同测试

新增：

- `src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts`
- `e2e/src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts`

覆盖：

- 扫描 `CHARACTER_DATA_MAP` 中所有基础 AbilityDef。
- 扫描各英雄升级卡 `replaceAbility.newAbilityDef`。
- 任何 `type='defensive'` 或 `phaseId='defensiveRoll'` 的技能，必须至少有 `withDamage/postDamage` effect。
- 防御技能不得把唯一执行效果留在 `immediate/preDefense/default:preDefense`。

该测试首次运行命中：

- `pyromancer/magma-armor@base`
- `pyromancer/magma-armor@card-magma-armor-2.replaceAbility`
- `pyromancer/magma-armor@card-magma-armor-3.replaceAbility`

这证明旧英雄也存在同类合同风险，不能把问题限定在两个新英雄。

## 修复

代码修复：

- `src/games/dicethrone/heroes/treant/abilities.ts`：`rooted` 防御 effect 改为 `withDamage`。
- `src/games/dicethrone/heroes/pyromancer/abilities.ts`：`magma-armor` I/II/III 防御 custom effect 改为 `withDamage`。
- e2e 镜像目录同步上述改动。

测试修复：

- `src/games/dicethrone/__tests__/pyromancer-coverage.test.ts`：防御选择从不存在的 `flame-shield` 改为 `magma-armor`。
- 同文件新增 `expect(result.actualErrors).toEqual([])`，防止后续命令失败被最终状态断言吞掉。

## 审计规范强化

已更新：

- `.spec/knowledge/standards/testing-audit.md`
  - 新增“框架消费合同必须反向审计”。
  - 新增“测试不得吞掉未预期命令失败”。
- `.windsurf/skills/add-new-faction/SKILL.md`
  - S3 机制门禁增加共享 resolver/system 消费点反查。
  - S4 审计门禁增加框架消费合同矩阵。

## 旧结论降级

旧结论“Treant/Ninja 已全面审计”失效。当前更准确的结论是：

- 已修复并自动化守住一类共享根因：防御技能 timing 与 defense resolver 消费合同。
- Treant/Ninja 新增批次仍应按完整技能流程矩阵继续看，不能用代表性 E2E 外推“全对象无遗漏”。
- 旧 Pyromancer 测试暴露出 GTR 假阳性风险，说明老英雄也需要按合同测试逐步扩审。
- 这里的“已修复共享根因”只表示一条 shared seam 已被补强，**不表示 Treant / Ninja 整英雄、也不表示四位新英雄整批已经审计完成**。当前剩余仍是批次级 `L4` 判等、旧文档统一回写与最终发布口径统一。

## 验证

已通过：

```powershell
npx eslint src/games/dicethrone/heroes/pyromancer/abilities.ts e2e/src/games/dicethrone/heroes/pyromancer/abilities.ts src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts e2e/src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts
npx vitest run src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts --configLoader native --maxWorkers 1
npx vitest run src/games/dicethrone/__tests__/pyromancer-coverage.test.ts --configLoader native --maxWorkers 1
```

结果：

- `ability-effect-timing-contract.test.ts`：1 file / 2 tests passed。
- `pyromancer-coverage.test.ts`：1 file / 6 tests passed，且已断言 `actualErrors=[]`。

## 剩余风险

- 本文只完成“防御 effect timing 消费合同”这一类共享根因的深审，不等于 DiceThrone 全英雄全卡全机制无遗漏。
- 需要继续为其它高风险合同补同类自动测试：攻击修正 timing、卡牌 `timing` 与阶段可用性、token active timing、不可防御跳过防御/响应、previewRef 与 ability slot 映射。
- 因此，本文不能被当作 Treant / Ninja 当前“对象级 residual 已清”或“四英雄整批已收口”的证明；它只能作为后续批次治理矩阵里的共享根因修复条目。
