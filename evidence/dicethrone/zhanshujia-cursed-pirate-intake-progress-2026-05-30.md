# DiceThrone 战术家 / 咒缚海盗接入进度证据（2026-05-30）

## 结论

本轮完成两名新英雄的 L1 静态接入、英雄专属手牌 L1 逐卡录入与一批 L2 机制结算，不是完整交付。按 `add-new-faction` workflow，复杂专属手牌机制、审计、真实入口 E2E、资源上传和远端 HEAD 回查仍未完成，因此不能宣称两个英雄“已完成”。

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
| 静态代码 | `heroes/zhanshujia/*`、`heroes/cursed_pirate/*`、`domain/statusEvents.ts`、`domain/ids.ts`、`domain/core-types.ts`、`domain/characters.ts`、`domain/index.ts`、`heroes/index.ts`、`ui/cardAtlas.ts`、`ui/assets.ts`、`criticalImageResolver.ts` |
| 手牌 L1 录入 | `src/games/dicethrone/heroes/zhanshujia/cards.ts` 录入战术家 slot 17-31；`src/games/dicethrone/heroes/cursed_pirate/cards.ts` 录入咒缚海盗 slot 17-32；临时单卡裁图位于 `temp/dicethrone-intake/*/hand-cards/` |
| 测试 | `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`，当前 6 tests passed；`src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`，当前 22 tests passed；组合 2 files / 28 tests passed |
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
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 22 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 27 tests passed |
| `npx eslint src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx eslint src/games/dicethrone/domain/statusEvents.ts src/games/dicethrone/domain/effects.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 22 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 27 tests passed |
| `npx eslint src/games/dicethrone/domain/statusEvents.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors；`flowHooks.ts` 保留既有 warnings |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 1 file / 6 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 28 tests passed |
| `npx eslint src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 0 errors |

## 未覆盖风险

| 对象 | 风险 |
| --- | --- |
| 战术优势 | L2 已覆盖获得 CP、重掷、抽牌、施加锁定、获得守护、转移状态入口；真实 UI/E2E 仍未覆盖 |
| 紧缚 | L2 已覆盖额外投掷 1CP 门禁、CP 不足拒绝、进攻投掷阶段结束移除；真实 UI/E2E 仍未覆盖 |
| 战术家防御 | L2 已覆盖反制措施：每组 2 军刀造成 1 反击伤害、每个旗帜防止 1 伤害、每个勋章获得 1 战术优势；真实入口/E2E 仍未覆盖 |
| 战争贩子 | L2 已覆盖奖励骰分支与攻击收口后额外进攻投掷阶段；真实入口/E2E 仍未覆盖 |
| 制胜高地 | L2 已覆盖锁定、紧缚、战术优势上限提升 1、补至新上限与 12 伤害；真实入口/E2E 仍未覆盖 |
| 诅咒金币 | L2 已覆盖自身/他人差异上限、维持伤害、不可移动/移除、海盗可选择获得/不获得；真实入口/E2E 仍未覆盖 |
| 咒缚 | L2 已覆盖自己维持阶段受到 4 点不可防止伤害、对手进攻投掷阶段未发起攻击则施加火药桶；真实入口/E2E 仍未覆盖 |
| 灵魂突刺 | L2 已覆盖 5/7/9 伤害与三同值施加火药桶；若目标已有火药桶，会触发原桶爆炸并保留新桶 |
| 火药桶 | L2 已覆盖维持投骰、1-2 爆炸移除并造成 3 点独立不可防御伤害、3-5 无事发生、6 转交、重复获得时原桶立即爆炸并保留新桶；真实入口/E2E 仍未覆盖 |
| 凋零 | L2 已覆盖来源侧攻击伤害 -1/层；真实入口/E2E 仍未覆盖 |
| 休战 | L2 已覆盖阻止攻击伤害、直接伤害不受影响、阶段结束移除；真实入口/E2E 仍未覆盖 |
| 深海潜行 | L2 已覆盖偷取 1CP、对手自选弃 1 张手牌、施加凋零与 8 伤害；真实入口/E2E 仍未覆盖 |
| 死亡印记 | L2 已覆盖先获得 2CP、弯刀不可防御伤害、战利品抽牌、骷髅施加诅咒金币；真实入口/E2E 仍未覆盖 |
| 亡灵之爪 | L2 已覆盖 8 点不可防御主伤害和按所有对手诅咒金币层数造成直接伤害；真实入口/E2E 仍未覆盖 |
| 咒缚海盗防御 | L2 已覆盖你还嫩了点：每个弯刀反击 1、每个战利品获得 1CP、每个骷髅防止 2 伤害、弯刀+骷髅施加诅咒金币；真实入口/E2E 仍未覆盖 |
| 无情诅咒 | L2 已覆盖可跳过的至多两名对手火药桶选择、4 人 2v2 不列队友、选择两名对手后分别施加火药桶；真实入口/E2E 仍未覆盖 |
| 英雄专属手牌 | L1 已完成逐卡录入与索引测试；战术家复杂升级替换、被攻击后响应牌、目标选择牌，以及咒缚海盗选择类、对手支付、手牌查看/弃牌、翻面条件、至多三名目标等仍待 L2/L3 |
| E2E / 上传 | 未运行真实入口 E2E，未执行资源上传和远端 HEAD 回查 |

## 手牌 L1 录入证据

| heroId | 专属 slot | 空白 slot | 通用牌特殊索引 | 证据 |
| --- | --- | --- | --- | --- |
| `zhanshujia` | 17-31，共 15 张 | 33-34 | `card-unexpected` = 32 | `src/games/dicethrone/rule/战术家卡牌录入核对.md`、`cards.ts`、intake test |
| `cursed_pirate` | 17-32，共 16 张 | 34 | `card-unexpected` = 33 | `src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md`、`cards.ts`、intake test |
