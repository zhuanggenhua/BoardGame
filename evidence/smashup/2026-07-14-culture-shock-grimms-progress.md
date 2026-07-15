# 文化冲击四派系 - 格林童话阶段进展（2026-07-14）

## 当前结论

- 格林童话（`grimms_fairy_tales`）本轮已补齐 L2 领域行为闭环：持续力量配对、格林兄弟的祝福名字别名、牌库检索放顶、弃牌洗回牌库、随从移动、临时加力、额外行动 / 额外随从、樵夫的斧子、团队合作、大灰狼、青蛙王子，以及姜饼屋 / 林中小屋基地能力。
- `grimms-fairy-tales.test.ts` 已扩展到 18 条定向 Vitest，覆盖新增的樵夫的斧子两种模式、团队合作打出 / 入手两种处理，以及格林兄弟的祝福作为缺失搭档名参与持续力量判断。
- 本轮已新增并通过格林童话代表性 L3/L4 真实入口 E2E：派系选择图集可见、团队合作从真实打牌入口检索并额外打出格雷特；但仍不能把格林童话或文化冲击四派系声明为全面完成。
- 文化冲击卡牌与复用基地资源仍沿用阿南西阶段 blocker：本地压缩产物和 manifest 已存在，但 R2/CDN 上传与 `HEAD 200` 仍 blocked。

## 本轮实现补齐

| 对象 | 规则子句 | 当前处理 | 证据 |
| --- | --- | --- | --- |
| 汉瑟 / 格雷特 | 同基地有对应搭档时自身 +2 | 新增基础版专属 power modifier，避免 POD alias 二次叠加；已接入格林兄弟的祝福名字别名 | `汉瑟/格雷特、另一个白雪公主/红玫瑰与小红帽持续力量按条件生效`、`格林兄弟的祝福激活后可作为缺失搭档名参与持续力量判断` |
| 另一个白雪公主 / 红玫瑰 | 同基地有对应搭档时自身 +2 | 新增基础版专属 power modifier；同样走名字别名 helper | 同上 |
| 小红帽 | 大灰狼不在场时，你在此基地的每个随从 +1 | 新增光环型 power modifier；若任意基地有大灰狼则关闭 | `汉瑟/格雷特、另一个白雪公主/红玫瑰与小红帽持续力量按条件生效` |
| 仙女教母的祝福 | 从牌库检索一个随从放到牌库顶 | 新增 deck search prompt、`DECK_INSPECTED` 见证和 `CARD_TO_DECK_TOP` 续算 | `仙女教母的祝福从牌库选择随从放到牌库顶` |
| 一篮子好东西 | 从牌库检索一个行动放到牌库顶 | 复用 deck search to top 链路 | 注册合同测试 |
| 侏儒怪 | 从牌库检索任意牌放到牌库顶 | 复用 deck search to top 链路 | 注册合同测试 |
| 另一个故事 | 至多三张弃牌洗回牌库 | 新增多选弃牌 prompt；支持合法候选存在时跳过；成功时发 `DECK_REORDERED` | `另一个故事在有合法弃牌时允许跳过，也能把至多三张弃牌洗回牌库` |
| 面包屑 | 至多两个同一基地己方随从移动到另一基地 | 新增两段 prompt：选择同源随从 → 选择目的基地；用 `buildValidatedMoveEvents` 落权威状态 | `面包屑能把同一基地至多两个己方随从移动到另一个基地` |
| 老鼠、鸟和香肠 | 同一基地同派系至多两个随从本回合各 +2 | 新增多选 prompt 与同基地/同派系校验；成功时发 `TEMP_POWER_ADDED` | `老鼠、鸟和香肠给同一基地同派系的至多两个随从临时 +2` |
| 樵夫的斧子 | 销毁打在基地上的行动以打出额外行动 | 新增目标 prompt；用 `buildValidatedOngoingDetachEvents` 销毁基地行动并发 `LIMIT_MODIFIED action +1` | `樵夫的斧子可销毁打在基地上的行动并给予额外行动` |
| 樵夫的斧子 | 或销毁大灰狼，从牌库检索随从并作为额外随从打到同一基地 | 新增大灰狼目标分支；销毁后接牌库随从 prompt，并用 `MINION_PLAYED fromDeck consumesNormalLimit=false` 打到原基地 | `樵夫的斧子可销毁大灰狼并从牌库额外打出随从到同一基地` |
| 团队合作 | 选择场上随从，按其能力文字里的随从名检索手牌 / 牌库 / 弃牌堆 | 新增两段 prompt：选择场上随从 → 选择匹配随从和处理方式；当前 L2 映射覆盖格林童话自身命名互文 | `团队合作可按所选随从能力文字中的名字检索并额外打出匹配随从`、`团队合作也可将匹配的弃牌堆随从加入手牌` |
| 格林兄弟的祝福 | 若你在此有 2+ 随从，视为具有你拥有的每个随从名称 | 新增名字别名 helper；已接入汉瑟 / 格雷特、另一个白雪公主 / 红玫瑰、白马王子 / 迷人的公主的同基地命名条件 | `格林兄弟的祝福激活后可作为缺失搭档名参与持续力量判断` |
| 白马王子 | 若迷人的公主在此，天赋额外打出一个行动 | 新增 talent ability，复用 contextual extra action，并支持格林兄弟的祝福名字别名 | `白马王子和迷人的公主在同基地互相满足天赋条件` |
| 迷人的公主 | 若白马王子在此，天赋额外在此打出一个随从 | 新增 talent ability，复用 contextual extra minion，并限制到当前基地；支持名字别名 | 同上 |
| 大灰狼 | 若小红帽不在场，入场时可消灭这里力量 4 或以下随从 | 新增 onPlay prompt 与 `buildValidatedDestroyEvents`，排除力量 5+ 目标并支持跳过 | `大灰狼在小红帽不在场时可消灭这里力量 4 或以下的随从` |
| 大灰狼 | 被消灭后，从弃牌堆额外打出另一个随从到原基地 | 新增 `onMinionDestroyed` mandatory trigger；从已归约销毁状态中的弃牌堆选择随从并发 `MINION_PLAYED fromDiscard` | `大灰狼被消灭后会从弃牌堆额外打出另一个随从到原基地` |
| 青蛙王子 | 你在同基地打出另一个随从后，可将青蛙王子洗入牌库并从弃牌堆额外打出随从到这里 | 新增 `onMinionPlayed` optional trigger；选择后发 `CARD_TO_DECK_TOP` + `DECK_REORDERED` 洗回自身，再 `MINION_PLAYED fromDiscard` | `青蛙王子见证你在同基地打出另一个随从后，可洗回牌库并从弃牌堆额外打出随从` |
| 姜饼屋 | 计分前，每位玩家可令两个同力量己方随从本回合各 +2 | 新增 `beforeScoring` base ability 与 pair prompt；成功时发两条 `TEMP_POWER_ADDED` | `姜饼屋计分前可让两个同力量己方随从直到回合结束各 +2` |
| 林中小屋 | 每回合一次，在你于此打出随从后，可从牌库检索力量 3 或以下随从进手牌 | 新增 `onMinionPlayed` base ability；成功后用同玩家 `CARD_TRANSFERRED` 从 deck 入 hand，并写 `woodlandCottageUsedTurn_<playerId>` | `林中小屋在你于此打出随从后每回合一次可检索力量 3 或以下随从进手牌` |

## 本轮代码落点

- `src/games/smashup/abilities/grimms_fairy_tales.ts`
  - 新增 / 扩展格林童话 ability、interaction handler、power modifier、base ability 注册。
- `src/games/smashup/abilities/index.ts`
  - 接入 `registerGrimmsFairyTalesAbilities()` 与 `registerGrimmsFairyTalesInteractionHandlers()`。
- `src/games/smashup/__tests__/abilities/grimms-fairy-tales.test.ts`
  - 扩展格林童话 L2 行为测试到 18 条。

- `e2e/smashup/smashup-culture-shock-grimms.e2e.ts`
  - 新增格林童话派系选择与团队合作真实入口 L3/L4 E2E。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/grimms-fairy-tales.test.ts --configLoader native` | PASS，18 tests |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts --configLoader native` | PASS，6 tests |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| `npm run test:e2e:file -- e2e/smashup/smashup-culture-shock-grimms.e2e.ts` | PASS，2 tests |
| `git diff --check -- src/games/smashup/abilities/grimms_fairy_tales.ts src/games/smashup/__tests__/abilities/grimms-fairy-tales.test.ts e2e/smashup/smashup-culture-shock-grimms.e2e.ts evidence/smashup/2026-07-14-culture-shock-grimms-progress.md` | PASS |

## 仍未实现 / 不得误报完成

- 已补代表性 L3/L4 E2E 文件：`e2e/smashup/smashup-culture-shock-grimms.e2e.ts`。
- 代表截图：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-grimms.e2e/派系选择页能看到格林童话，并加载文化冲击图集/01-格林童话-派系选择页图集可见.jpg`。
- 代表截图：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-grimms.e2e/团队合作可从真实打牌入口检索并额外打出格雷特/05-团队合作-格雷特额外打出结算后.jpg`。
- 团队合作当前 L2 名字匹配覆盖格林童话自身命名互文；若后续要求跨派系完整泛文本解析，需要单独接入全卡牌能力文本索引。
- 面包屑、老鼠鸟香肠、姜饼屋、林中小屋、青蛙王子仍可继续补更细对象级拒绝路径证据。
- 文化冲击资源远端链路仍 blocked：R2 凭据不可用，代表 CDN URL 仍未取得 `HEAD 200`。