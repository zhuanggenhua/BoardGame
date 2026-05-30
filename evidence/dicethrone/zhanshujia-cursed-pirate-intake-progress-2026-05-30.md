# DiceThrone 战术家 / 咒缚海盗接入进度证据（2026-05-30）

## 结论

本轮完成两名新英雄的 L1 静态接入与一批 L2 机制结算，不是完整交付。按 `add-new-faction` workflow，审计、英雄专属手牌逐卡录入、火药桶、防御精确 resolver、真实入口 E2E、资源上传和远端 HEAD 回查仍未完成，因此不能宣称两个英雄“已完成”。

## 批次矩阵

| heroId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `zhanshujia` | `in_progress` | `in_progress` | `in_progress` | `pending` | `pending` | L1/L2 部分接入 |
| `cursed_pirate` | `in_progress` | `in_progress` | `in_progress` | `pending` | `pending` | L1/L2 部分接入 |

## 已完成证据

| 类别 | 证据 |
| --- | --- |
| 规则文档 | `src/games/dicethrone/rule/战术家真相源表.md`、`战术家录入核对.md`、`战术家卡牌录入核对.md`、`咒缚海盗真相源表.md`、`咒缚海盗录入核对.md`、`咒缚海盗卡牌录入核对.md` |
| 资源本地生成 | `public/assets/i18n/zh-CN/dicethrone/images/zhanshujia/compressed/*.webp`、`public/assets/i18n/zh-CN/dicethrone/images/cursed/compressed/*.webp` |
| 状态图集 | `status-icons-atlas.json/png/webp`，战术家 frame `tactical_advantage/bind`；咒缚海盗 frame `wither/parley/powder_keg/cursed_coin` |
| 静态代码 | `heroes/zhanshujia/*`、`heroes/cursed_pirate/*`、`domain/ids.ts`、`domain/core-types.ts`、`domain/characters.ts`、`domain/index.ts`、`heroes/index.ts`、`ui/cardAtlas.ts`、`ui/assets.ts`、`criticalImageResolver.ts` |
| 测试 | `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`，5 tests passed；`src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`，当前 11 tests passed；组合 2 files / 16 tests passed |
| manifest | `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id dicethrone` 已执行；`--validate --root public/assets/i18n/zh-CN --id dicethrone` 通过 |

## 验证命令

| 命令 | 结果 |
| --- | --- |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过 |
| `npx eslint <本轮 TS 文件>` | 0 errors；`characters.ts` 保留既有 2 warnings |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts --configLoader native` | 1 file / 5 tests passed |
| `npm run i18n:check` | 无 missing key；保留 3 条既有 warning |
| `npx tsc --noEmit --pretty false` | 通过 |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id dicethrone` | 通过 |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 11 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 16 tests passed |

## 未覆盖风险

| 对象 | 风险 |
| --- | --- |
| 战术优势 | L2 已覆盖获得 CP、重掷、抽牌、施加锁定、获得守护、转移状态入口；真实 UI/E2E 仍未覆盖 |
| 紧缚 | L2 已覆盖额外投掷 1CP 门禁、CP 不足拒绝、进攻投掷阶段结束移除；真实 UI/E2E 仍未覆盖 |
| 战术家防御 | 反制措施的军刀/旗帜/勋章逐骰结算未实现 |
| 战争贩子 | L2 已覆盖奖励骰分支与攻击收口后额外进攻投掷阶段；真实入口/E2E 仍未覆盖 |
| 制胜高地 | L2 已覆盖锁定、紧缚、战术优势上限提升 1、补至新上限与 12 伤害；真实入口/E2E 仍未覆盖 |
| 诅咒金币 | L2 已覆盖自身/他人差异上限、维持伤害、不可移动/移除；“海盗可选择不获得金币”仍未实现 |
| 灵魂突刺 | L2 已覆盖 5/7/9 伤害与三同值施加火药桶；火药桶重叠爆炸仍归入火药桶 pending |
| 火药桶 | 维持投骰、爆炸、转交、重叠立即爆炸未实现 |
| 凋零 | L2 已覆盖来源侧攻击伤害 -1/层；真实入口/E2E 仍未覆盖 |
| 休战 | L2 已覆盖阻止攻击伤害、直接伤害不受影响、阶段结束移除；真实入口/E2E 仍未覆盖 |
| 深海潜行 | L2 已覆盖偷取 1CP、对手自选弃 1 张手牌、施加凋零与 8 伤害；真实入口/E2E 仍未覆盖 |
| 死亡印记 | L2 已覆盖先获得 2CP、弯刀不可防御伤害、战利品抽牌、骷髅施加诅咒金币；真实入口/E2E 仍未覆盖 |
| 亡灵之爪 | L2 已覆盖 8 点不可防御主伤害和按所有对手诅咒金币层数造成直接伤害；真实入口/E2E 仍未覆盖 |
| 咒缚海盗防御 | 你还嫩了点逐骰结算未实现 |
| 英雄专属手牌 | 尚未裁完整单卡与逐卡录入，当前只接通通用牌 |
| E2E / 上传 | 未运行真实入口 E2E，未执行资源上传和远端 HEAD 回查 |
