# 蜘蛛侠 v2 玩家板实现与规则交互审计

更新时间：2026-09-20
对象：Dice Throne `zhizhuxia` / 蜘蛛侠
当前状态：`implementation_in_progress`
证据角色：本文件是 2026-09-20 本轮 v2 实现、真实入口和截图审计记录；此前 `zhizhuxia-final-user-view-20260920` 图组不再作为当前几何结论。

## 1. 本轮修正

- 共享玩家板默认布局从 `v1` 改为 `v2`。
- 未登记角色的布局版本回退从 `v1` 改为 `v2`。
- 蜘蛛侠显式登记正式玩家板尺寸 `1800 × 1089` 和布局版本 `v2`。
- 升级牌覆盖合同总数同步到当前注册值 `140`；蜘蛛侠新增 4 张替换型升级牌已纳入检查。
- 实现前对照成熟的吸血鬼领主玩家板；验收按同视口几何合同检查宽高比、外框、技能槽、终极槽、提示板和升级覆盖层。

## 2. 真实入口结果

正式命令：

```text
node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhizhuxia-intake.e2e.ts
node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhizhuxia-interactions.e2e.ts
```

结果：

- 蜘蛛侠真实入口与卡图审计：`2 passed`
- 蜘蛛侠规则交互审计：`8 passed`
- 规则交互覆盖：蜘蛛发射器施加落网并立即造成 2 点状态伤害、技能区攻击消费落网、手牌来源伤害不消费落网、Token 来源伤害不消费落网、蜘蛛感应减伤、飞荡脱身、隐形完全抵消、额外防御投骰。
- 本轮问题分类：此前不是实现漏写，而是审计 / 测试覆盖缺口。实现已经生成 `DAMAGE_DEALT`；原有单测只检查事件形状，原有 E2E 只检查落网消费，未检查真实打出蜘蛛发射器后的最终生命值。当前已补单测归约断言和真实拖拽入口 E2E，确认对手生命 `50 -> 48`，且仅有一次 `status / direct / unblockable` 的 2 点伤害。

## 3. 截图证据

当前 PNG 验收图组：

- `evidence/dicethrone/zhizhuxia-v2-final-user-view-20260920-png/`
- PASS 清单：`evidence/dicethrone/zhizhuxia-v2-final-user-view-20260920-png/zhizhuxia-v2-final-pass-20260920.json`
- 该目录 20 张媒体均为本轮重跑生成的 PNG；点击放大时查看器直接读取这些 PNG，不再读取旧 JPG。

原始素材图组：

- `evidence/dicethrone/zhizhuxia-original-assets-20260920/`
- 该目录单独保留 `player-board.png`、`落网.png`、`tip.png`、`ability-cards.png`、`dice.png`、`status-icons-atlas.png` 等素材原图；不与 E2E 截图 PASS 混用。

## 4. 视觉裁决

```text
verdict: PASS
score: 95/100
scope: v2 玩家板几何、技能覆盖层和本轮规则交互状态截图
hard_failures: []
```

已核对：

- 蜘蛛侠 `1800 × 1089` 玩家板按自身宽高比显示，未见横向或纵向拉伸、倾斜或错误裁切。
- 左右四组技能槽、底部终极槽与蜘蛛侠底图标题对应；技能覆盖层和升级后的重拳槽没有偏到旧版物理槽位。
- 提示板、骰盘、阶段栏、生命 / CP、响应按钮与玩家板保持同屏，关键状态没有被错误遮挡。
- 落网、蜘蛛感应、飞荡脱身、隐形和额外防御投骰截图均能看到对应真实状态；未把 DOM / E2E 通过单独当作视觉通过。
- Token 反伤截图显示圣骑士玩家板是预期结果：该场景的 `selectedCharacters` 为圣骑士承受反伤、蜘蛛侠位于对手席，不是玩家板串图。

## 5. 验证结果

- `npx vitest run src/games/dicethrone/ui/__tests__/AbilityOverlays.test.tsx src/games/dicethrone/__tests__/criticalImageResolver.test.ts`：通过
- `npx vitest run src/games/dicethrone/__tests__/zhizhuxia-intake.test.ts`：12/12；落网施加测试已归约到目标生命 `48`
- `npx vitest run src/games/dicethrone/__tests__/criticalImageResolver.test.ts`：12/12
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhizhuxia-interactions.e2e.ts`：8/8
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhizhuxia-intake.e2e.ts`：2/2
- `npm run typecheck`：通过
- `npm run spec:lint`：通过
- `git diff --check`：通过

角色仍保留 `implementation_in_progress`，因为完成态是产品状态，需要用户明确批准；这不影响本轮 v2 实现、落网真实伤害验证和当前 PNG 证据已经闭合。
