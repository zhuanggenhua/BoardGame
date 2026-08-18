# Smash Up 10 周年三派系专项审计（2026-04-19）

## 2026-04-30 最终收口：三派系重审完成

- 本轮最后补齐：
  - `World Champs / 世界冠军`《武士 陈》正路径 L3，见 `evidence/smashup/smashup-world-champs-samurai-chan-e2e-2026-04-30.md`
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "world_champs_samurai_chan 打出时不应触发海龟阿凯式 onPlay 交互|world_champs_samurai_chan 因基地计分从场上进入弃牌堆后会抽一张牌"` → `2 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "武士 陈在基地计分进入弃牌堆后应抽一张牌"` → `1 passed`
- 当前最终结论：
  - `Mermaids / 美人鱼`、`Skeletons / 骷髅`、`World Champs / 世界冠军` 这批重审已完成收口。
  - `埋骨地 / base_boneyard` 保留为“无能力基地”的显式说明，但它不再属于残余范围。
  - 本文中更早时间点写的“仍有残余范围”均保留为**历史记录**，不再代表当前状态。
- 当前验收口径同时明确为：
  - 不是每张卡都机械要求 E2E。
  - 当前批次只把历史投诉对象、真实入口链路、reaction session、阶段切换、UI 出口与高风险对象补到 L3。
  - 其余对象以 `L0-L2` + 风险抽样验收，不再把“全卡都做端到端”当成默认要求。

## 2026-04-30 继续重审记录：World Champs / Skeletons 基地层 L3 补证 + 当前残余范围收紧

- 触发原因：
  - `World Champs / 世界冠军` 与 `Skeletons / 骷髅` 的真正残余已经不再是整派系“很多牌没审”，而是基地层与高层口径还没收紧到对象级。
  - 本轮继续按“卡图口径优先，但要落到 UI 真实出口”推进，先清掉 `竞技场 / 名人堂 / 藏骨堂` 这三条基地层真实入口缺口。
- 本轮实现：
  - `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
    - 新增 `base_arena` 聚焦回归
    - 新增 `base_hall_of_fame` 聚焦回归
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增 `竞技场应在首次于此打出随从后提供抽牌或额外行动交互`
    - 新增 `名人堂应在首次于此打出随从后给予该随从 +2 力量并反映到基地分数`
    - 新增 `藏骨堂应在你的回合开始时允许把弃牌堆中的低力量随从埋葬到这里`
  - 新增证据文档：
    - `evidence/smashup/smashup-world-champs-skeletons-bases-e2e-2026-04-30.md`
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_arena 在此基地首次打出随从后，应提供额外行动或抽牌交互|base_hall_of_fame 在此基地首次打出随从后，应给予该随从本回合 \+2 力量"` → `2 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "竞技场应在首次于此打出随从后提供抽牌或额外行动交互"` → `1 passed`
  3. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "名人堂应在首次于此打出随从后给予该随从"` → `1 passed`
  4. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "藏骨堂应在你的回合开始时允许把弃牌堆中的低力量随从埋葬到这里"` → `1 passed`
- 本轮交叉抽检结论：
  1. **卡图口径 vs 基地数据**
     - `竞技场 / 名人堂 / 藏骨堂` 的名称、索引、断点值与卡图一致。
     - `埋骨地 / base_boneyard` 仍未发现能力注册痕迹，当前按“无能力基地”冻结，而不是“漏实现”。
  2. **领域 vs UI 真实出口**
     - `竞技场` 已证实真实页面会出现“抽牌 / 额外行动 / 跳过”三选一 prompt。
     - `名人堂` 已证实 `+2` 不只存在于领域事件，还会真实反映到基地玩家分数徽章。
     - `藏骨堂` 已证实回合开始 prompt 与埋葬结果都能落到浏览器棋盘。
  3. **reaction session 抽样**
     - `World Champs` 继续以《快如闪电 / 女主角 / 阿拉密斯》作为 reaction session 样本。
     - `Skeletons` 继续以《轮回者 / 骸骨之王》作为 reaction session 样本。
     - `Mermaids` 本轮仍以《塞壬 / 诱惑者 / 无人岛》的 UI 口径回归作为“领域对 / UI错”防漏样本。
- 本轮收紧后的对象清单：
  1. `World Champs`
     - 基地层残留已清空：`竞技场 / 名人堂` 已补到 L3。
     - 卡牌层当前只剩《武士 陈》没有单独正路径 L3；当前冻结为“L2 正路径 + 负路径 L3”。
     - 冻结理由：
       - 该牌当前用户直接反馈风险点是“不要再误串成《海龟阿凯》效果”，这一点已经由负路径 L3 直接锁死；
       - 它本身没有主动 prompt，正路径只是“自身离场后抽 1”，当前由领域回归覆盖；
       - 相比继续机械补一条低信息量 L3，更需要先把旧高层误导口径删干净。
  2. `Skeletons`
     - 卡牌层当前已有《殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园 / 骸骨之王 / 轮回者 / 诡异。可怕。 / 墓碑 / 守墓人 / 墓地爆发》正路径 L3，外加此前已补的链路回写。
     - 基地层残留已清空：`藏骨堂` 已补到 L3，`埋骨地` 当前按“无能力基地”冻结。
- 当前结论等级：
  - **仍有残余范围**
- 当前残余范围（已显式冻结到最小）：
  - 不再是 `World Champs / Skeletons` 基地层缺口。
  - 当前只剩《武士 陈》这条“是否继续补单卡正路径 L3”的冻结说明，以及最终总审计收口尚未单独改写成最终版总结。

## 2026-04-30 继续重审记录：Mermaids《塞壬 / 诱惑者 / 无人岛》L3 补证 + BaseZone 分数口径修复

- 触发原因：
  - `Mermaids / 美人鱼` 剩余的《塞壬 / 诱惑者 / 无人岛》此前只有 L2，没有浏览器级对象证据。
  - 本轮补《塞壬》时还抓到了一个真问题：UI 玩家分数徽章没有按卡面口径显示“控制者总力量贡献”。
- 本轮真实修复：
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
  - 根因不是规则没实现，而是 `BaseZone` 自己手算 `minion + ongoing + base bonus`，绕过了 `getPlayerEffectivePowerOnBase(...)`。
  - 结果会把《塞壬 / 无人岛 / 魅惑 / 人鱼暗礁》这类“只影响控制者总力量、不影响基地总力量”的牌显示错。
  - 现已统一改为：玩家列分数徽章只走 `getPlayerEffectivePowerOnBase(...)`。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增 `塞壬应只压低其他玩家在这里的总力量贡献而不改变基地总力量`
    - 新增 `诱惑者应在其他玩家的仆从本回合移动到这里后获得 +2 力量`
    - 新增 `无人岛应把这里所有仆从的控制者总力量压到 0 并在你下回合开始前自毁`
- 本轮验证：
  1. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "塞壬应只压低其他玩家在这里的总力量贡献而不改变基地总力量"` → `1 passed`
  2. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "诱惑者应在其他玩家的仆从本回合移动到这里后获得"` → `1 passed`
  3. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "无人岛应把这里所有仆从的控制者总力量压到 0 并在你下回合开始前自毁"` → `1 passed`
  4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ongoingModifiers.test.ts --configLoader native --maxWorkers 1 --testNamePattern "mermaids_siren|mermaids_desert_island|mermaids_temptress"` → `6 passed`
  5. `npm run typecheck` → 通过
- 新增证据：
  - `evidence/smashup/smashup-mermaids-siren-temptress-desert-island-e2e-2026-04-30.md`
- 本轮新结论：
  1. 《塞壬》当前已补齐“压低其他玩家个人总力量，但不改基地总力量”的 L3。
  2. 《诱惑者》当前已补齐“别人的仆从本回合移动到这里后，真实棋盘出现 +2”的 L3。
  3. 《无人岛》当前已补齐“压到 0 + 下回合开始前自毁”的 L3。
  4. “其他玩家自己的回合把自己的仆从移动到这里时仍应 +2”这一更细分支，本轮继续由 `ongoingModifiers.test.ts` 锁死，不在 L3 证据里伪装 guest 私有视角。
  5. 截至本轮，`Mermaids` 当前至少已有 `最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸 / 塞壬的歌声 / 塞壬 / 诱惑者 / 无人岛` 共 `8` 条正路径对象级 L3 证据；但三新派系整包仍维持 **仍有残余范围**。

## 2026-04-26 继续重审记录：World Champs《警长 / 木乃伊》真实入口补证 + 误判根因回写

- 触发原因：
  - 用户继续追问《警长》《木乃伊》为什么看起来像“效果没触发/像数据录错”，要求把这两张卡也补到对象级真实入口证据。
  - 本轮重放后确认：这两张牌的问题和《武士 陈》那条“错图索引”不是同一种根因，不能再混写成“世界冠军可能又是卡图录错”。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 重跑并稳定化：
      - `警长应在基地计分前发起决斗并摧毁落败随从`
      - `木乃伊应在基地计分后埋葬到另一个基地`
    - 稳定截图通过 `saveStableScreenshot(...)` 落在 `e2e/evidence/screenshots/`。
- 本轮验证：
  - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "警长应在基地计分前发起决斗并摧毁落败随从"` → `1 passed`
  - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "木乃伊应在基地计分后埋葬到另一个基地"` → `1 passed`
- 新增证据：
  - `evidence/smashup/smashup-world-champs-sheriff-mummy-e2e-2026-04-26.md`
- 本轮新结论：
  1. 《警长》当前已补齐“计分前反应 -> 选敌方仆从 -> 进入决斗牌交互 -> 落败者被摧毁”的 L3 证据。
  2. 《木乃伊》当前已补齐“计分后 -> 选另一个基地 -> 自身被埋葬过去”的 L3 证据。
  3. 这两张牌此前更像是**旧 E2E 链路不真**，不是卡图录错：
     - 《警长》旧误判主因是 helper 只看 host 视角、没消费 guest 私有决斗 prompt，且错误点击了泛化 `Pass`；
     - 《木乃伊》旧误判主因是场景里混入《警长》beforeScoring 反应，污染了 afterScoring 入口。
  4. 因而这轮回写后，`World Champs` 当前至少已有 `斯坦福 / 海龟阿凯 / 盾牌少女 / 战斗精神奖 / 老鼠、鸟和香肠 / 金币猫 / 鲨鱼纹身 / 警长 / 木乃伊` 多条对象级 L3 证据，但三派系整包仍维持 **仍有残余范围**。

## 2026-04-27 继续重审记录：World Champs《高速追逐 / 现在是闪电时间！ / 聪明Set-Up》真实入口补证

- 触发原因：
  - 继续收敛 `World Champs` 残余对象级 L3 缺口，优先补 3 张仍缺浏览器级真实入口证据的行动牌：
    - 《高速追逐》
    - 《现在是闪电时间！》
    - 《聪明Set-Up》
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增：`高速追逐应转移行动到另一基地并移动己方随从且给予 +3 力量`
    - 新增：`现在是闪电时间！应选择己方随从并在本回合给予 +3 力量`
    - 新增：`聪明Set-Up附着后应在该基地本回合首次打出随从时让你抽一张牌`
  - 新增证据文档：
    - `evidence/smashup/smashup-world-champs-high-speed-smart-blitz-e2e-2026-04-27.md`
- 本轮验证：
  1. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "高速追逐"` → `1 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "现在是闪电时间"` → `1 passed`
  3. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "聪明Set-Up"` → `1 passed`
- 结论：
  1. 《高速追逐》当前已补齐“打到基地 -> 发动天赋 -> 转移行动 -> 移动己方随从 -> 本回合 +3”的 L3 证据。
  2. 《现在是闪电时间！》当前已补齐“打出 -> 选择己方随从 -> 本回合 +3”的 L3 证据。
  3. 《聪明Set-Up》当前已补齐“附着到其他玩家随从 -> 该基地首次打出随从 -> 你抽 1 张牌”的 L3 证据。
  4. `World Champs` 当前至少已有 `斯坦福 / 海龟阿凯 / 盾牌少女 / 战斗精神奖 / 老鼠、鸟和香肠 / 金币猫 / 鲨鱼纹身 / 警长 / 木乃伊 / 高速追逐 / 现在是闪电时间！ / 聪明Set-Up` 共 `12` 条正路径对象级 L3 证据，外加《武士 陈》1 条负路径证据；但三派系整包仍维持 **仍有残余范围**。

## 2026-04-26 第七轮修订：Skeletons 审计口径再收紧

- **失效回写 1**：本文此前引用 `smashup-skeletons-wiki-semantic-audit-2026-04-25.md` 时，把 `Skeletons` 记成“**12/12 张牌语义错配**”。这条总括结论现在已经失效；后续卡图优先重录后，当前不再是整派系全错。
- **失效回写 2**：本文此前把 `复仇者 / Revenant` 残余风险写成“**当前实现入口仍挂在 onTurnStart**”。这条表述也已过时；当前实现已改成**弃牌堆主动特殊能力**，旧 `onTurnStart / onActionPlayed / onMinionPlayed / onCardsDiscarded` 近似入口已移除。
- **本轮新修复并回写到审计口径**：
  1. `骸骨之王 / Lord of Bones`：卡图 `temp/skeletons-card-18.png` 明确是“挖掘这里的一张牌”，旧实现却只允许挖自己的埋葬牌；现已修正。
  2. `殉葬品 / Grave Goods`：卡图 `temp/skeletons-card-20.png` 明确要求“弃一张牌，再额外埋葬另一张牌”，旧实现却把两件事错误压在同一张牌上；现已修正为三段交互，并补断言锁死“弃牌 uid != 额外埋葬 uid”。
- **新的验证证据**：
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --testNamePattern "skeletons_(lord_of_bones|grave_goods|revenant)"` → `8 passed`
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --testNamePattern "Skeletons abilities"` → `18 passed`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "复仇者应可在回合中触发埋葬且同回合不重复触发"` → `1 passed`
  - `npx eslint src/games/smashup/abilities/skeletons.ts e2e/src/games/smashup/abilities/skeletons.ts src/games/smashup/__tests__/newFactionAbilities.test.ts e2e/src/games/smashup/__tests__/newFactionAbilities.test.ts` → `0 errors`（仅仓库既有 warnings）
- **当前结论等级保持**：`仍有残余范围`。
- **原因**：本轮虽已把 `复仇者` 也补到真实入口 L3，但三派系整包仍未达到“当前发布口径已收口”的全量覆盖要求，因此本文仍保持 `仍有残余范围`。


## 2026-04-26 卡图优先第二轮修订：三派系重录回写

- 本轮继续以 `temp/cards7-00.png` ~ `temp/cards7-43.png` 为主真相源，Wiki 仅做辅助交叉核对。
- 失效回写：
  - 本文档前面 2026-04-26 小节里那组 `World Champs` 旧中文名（`治安官 / 阿拉米斯 / 斯通福德 / 迪娃 / 盾女 / 卡利科因 / 武士酱 / 蛊惑附体 / 斗志奖杯 / 冲锋时刻！ / 怪兽冲突 / 鼠、鸟与香肠 / 聪明布局`）已失效。
  - 当前卡图优先口径应改为：`警长 / 阿拉密斯 / 斯坦福 / 女主角 / 盾牌少女 / 金币猫 / 武士 陈 / 着魔 / 战斗精神奖 / 现在是闪电时间！ / 怪兽冲击 / 老鼠、鸟和香肠 / 聪明Set-Up`。
- 本轮已落地修复：
  1. `World Champs`
     - `Stoneford / 斯坦福` 改回卡图语义：**检索行动入手，不额外洗牌**。
     - `Mummy / 木乃伊` 维持卡图口径：静态数据为 `ongoing`，实现仅保留 `afterScoring` 触发，不再伪装成 `special`。
     - 已同步回写：`src/games/smashup/data/factions/world_champs.ts`、`src/games/smashup/abilities/world_champs.ts`、`public/locales/zh-CN/game-smashup.json`、`public/locales/en/game-smashup.json`、`src/games/smashup/__tests__/smashup.smoke.test.ts`。
  2. `Mermaids`
     - `最后的歌声` 补回“**取消那些仆从的能力直到回合结束**”。
     - `迷倒观众` 改回“**你不拥有的仆从** / **打出一张额外的行动**”。
  3. `Skeletons`
     - `灵车队伍` 按卡图优先口径修正为：普通打出可移动**任意数量的埋葬牌**；特殊效果仍只限制“你埋葬的牌”。
     - `殉葬品` 修正为：**先从手中埋葬一张牌**，然后才进入“额外埋葬一张牌 / 挖掘一张你的埋葬牌”的后续分支；额外埋葬不再硬编码到同一基地。
- 本轮验证：
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts`
  - `npm run i18n:check`
  - `npm run typecheck`
- 验证结果：
  - `326 passed / 1 skipped`
  - `i18n:check` 通过（保留 1 条既有动态 key warning：`src/games/smashup/ui/PromptOverlay.tsx:146`）
  - `typecheck` 通过
- 当前结论等级：
  - **仍有残余范围**
- 原因：
  - 本轮已清理三派系卡图/文案/关键实现的已知漂移，但这仍主要是 **L1 + L2** 证据补强；
  - 若要恢复成“三派系整包已收口”，仍需把三派系剩余对象级真实入口证据与最终整包结论继续补齐。

## 2026-04-26 继续重审记录：Mermaids 卡图口径再收紧

- 直接真相源：
  - `temp/cards7-03.png` → `塞壬的歌声`
  - `temp/cards7-04.png` → `死亡海湾`
  - `temp/cards7-07.png` → `诱惑者`
  - `temp/cards7-11.png` → `无人岛`
- 新确认的问题不是“维度名字不够多”，而是旧审计里仍有**卡图句法被人脑误读后直接写进结论**：
  1. `塞壬的歌声`
     - 旧实现把“来源基地有没有别人的仆从”当成唯一准入条件。
     - 但卡图是“移动到**另一个**有你仆从的基地”，因此来源基地还必须满足：存在至少 1 个**别的**己方基地可去。
     - 已修复为在来源基地 prompt 阶段就过滤掉这类必然无效的选项。
  2. `无人岛`
     - 失效回写：此前“只压制行动拥有者自己在这里的随从总力量”的结论是错的。
     - 卡图文字是“这里的仆从不能把它们的力量添加到它们控制者的总力量中”，主语是**这里的仆从**，不是“你的仆从”。
     - 正确语义：这里**所有**仆从都不再给各自控制者的个人总力量做贡献；基地总力量本身不变。
  3. `诱惑者`
     - 已再次确认旧 bug 根因是持续条件实现过窄，不是卡图录错。
     - 触发条件必须覆盖“其他玩家在自己的回合把自己的仆从移动到这里”，不能只覆盖“当前玩家把对手仆从移动过来”。
  4. `死亡海湾`
     - 本轮按卡图逐词复核后确认当前实现无语义漂移，但此前没有单独锁死“只数其他玩家仆从”的断言，已补测试。
- 本轮回写文件：
  - `src/games/smashup/abilities/mermaids.ts`
  - `e2e/src/games/smashup/abilities/mermaids.ts`
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - `e2e/src/games/smashup/domain/ongoingModifiers.ts`
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `e2e/src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `src/games/smashup/__tests__/ongoingModifiers.test.ts`
  - `e2e/src/games/smashup/__tests__/ongoingModifiers.test.ts`
- 本轮验证：
  - `npx eslint src/games/smashup/abilities/mermaids.ts`
  - `npx eslint e2e/src/games/smashup/abilities/mermaids.ts`
  - `npx eslint src/games/smashup/domain/ongoingModifiers.ts`
  - `npx eslint e2e/src/games/smashup/domain/ongoingModifiers.ts`
  - `npx eslint src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `npx eslint e2e/src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `npx eslint src/games/smashup/__tests__/ongoingModifiers.test.ts`
  - `npx eslint e2e/src/games/smashup/__tests__/ongoingModifiers.test.ts`
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --testNamePattern "Mermaids abilities"`
  - `npx vitest run src/games/smashup/__tests__/ongoingModifiers.test.ts --testNamePattern "mermaids_temptress|mermaids_desert_island|mermaids_charmed"`
- 结果：
  - `Mermaids abilities`：`10 passed`
  - `ongoingModifiers` 聚焦：`3 passed`
  - ESLint：修改文件 `0 errors`（保留仓库既有 warnings，不是本轮新增）

## 2026-04-26 继续重审记录：外部真问题确认 + 世界冠军中文名清理

## 2026-04-26 继续重审记录：Mermaids L3 补证 + 旧漏审回写

- 触发原因：
  - 按卡图优先重放 `Mermaids / 美人鱼` 关键链路时，这组卡暴露出三类此前未被旧审计拦住的低级错误：
    1. **效果错误**：`最后的歌声` 卡面要求“选择一个你有仆从的基地”，旧实现却允许任意基地；
    2. **配置错误**：`迷倒观众` 卡面要求“选择一个基地”，但静态数据缺少 `playNeedsBase: true`；
    3. **效果错误**：`迷倒观众` 卡面要求“一个你在那里的仆从”，旧实现却允许选择其他基地上的己方随从。
- 这不是单纯“维度名字不够多”，而是旧审计把：
  - L1 静态注册/覆盖率
  - L2 引擎级行为
  - L3 真实入口目标选择
  混在一起后，没有把“**打牌目标契约**”“**目标基地准入**”与“**目标范围语义**”单独拉出来逐卡验。

- 本轮修复：
  - `src/games/smashup/abilities/mermaids.ts`
    - `mermaidsUltimateSongOnPlay` 的基地候选从“所有基地”收紧为“你有仆从的基地”
    - `mermaidsCaptiveAudienceOnPlay` 的候选目标从“全场己方随从”收紧为“目标基地上的己方随从”
  - `src/games/smashup/data/factions/mermaids.ts`
    - `mermaids_captive_audience` 补 `playNeedsBase: true`
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - 回写断言：`最后的歌声` 不得把没有你仆从的基地放进候选；`迷倒观众` 的另一基地己方随从不得进入候选
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 补 `最后的歌声 / 迷倒观众` 两条真实入口浏览器级用例，并把 `最后的歌声` 场景扩成“一个合法基地 + 一个非法基地”防假通过

- 本轮验证：
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --testNamePattern "mermaids_captive_audience|mermaids_ultimate_song"`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "最后的歌声应强制对手额外打出小随从且不触发其打出能力，并给予你额外行动与额外随从"`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "迷倒观众应按目标基地非己方随从数给己方随从加力量并给予额外行动"`

- 新增证据：
  - `evidence/smashup/smashup-mermaids-ultimate-song-captive-audience-e2e-2026-04-26.md`

- 结论收紧：
  - `Mermaids` 当前至少已有 `最后的歌声` 与 `迷倒观众` 两条关键链路的 L3 真实入口证据；
  - 但三新派系整体仍只能继续标记为 **仍有残余范围**；
  - 本案例必须作为旧审计失效补充证据保留：**此前漏掉的不是卡图，也不是测试数量，而是“打牌目标契约 + 目标基地准入 + 目标范围语义 + 真实入口”四层没有逐卡锁死。**

## 2026-04-29 继续重审记录：Mermaids《人鱼女王 / 安静的海岸》对象级 L3 补证

- 触发原因：
  - `Mermaids` 当前已有《最后的歌声》《迷倒观众》两条 L3，但“模式选择”和“场上持续牌天赋迁移”仍只停留在 L2。
  - 本轮优先补《人鱼女王》《安静的海岸》，把这两种高风险交互链路补到浏览器级真实入口。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增 `人鱼女王应可选择移动其他玩家的一个仆从到这里`
    - 新增 `安静的海岸应可从场上发动天赋并移到另一个基地`
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "mermaids_mermaid_queen|mermaids_becalmed_shores"`
     - 结果：`3 passed`
  2. `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "人鱼女王应可选择移动其他玩家的一个仆从到这里"`
     - 结果：`1 passed`
  3. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "安静的海岸应可从场上发动天赋并移到另一个基地"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-mermaids-mermaid-queen-becalmed-e2e-2026-04-29.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-mermaid-queen-move-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-mermaid-queen-move-resolved-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-attached-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-move-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-moved-2026-04-29.png`
- 结论：
  - 《人鱼女王》当前已补齐“选择移动模式后，把其他玩家一个仆从移到这里”的 L3 证据。
  - 《安静的海岸》当前已补齐“打到基地上后，从场上发动持续牌天赋迁移”的 L3 证据。
  - 这两条本轮没有新增实现 bug，新增的是**真实入口补证**。
  - 截至本轮，`Mermaids` 当前至少已有 `最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸` 共 `4` 条正路径对象级 L3 证据；但三新派系整包仍维持 **仍有残余范围**。

## 2026-04-29 继续重审记录：Mermaids《塞壬的歌声》+ Skeletons《他们出来了》对象级 L3 补证

- 触发原因：
  - `Mermaids` 仍缺“来源基地过滤 + 目标仆从移动”这类多段移动链的浏览器级样本；
  - `Skeletons` 仍缺“选基地后一次挖掘多张己方埋葬牌”这类 buried 真实入口样本。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增 `塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地`
    - 新增 `他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌`
- 本轮验证：
  1. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地"`
     - 结果：`1 passed`
  2. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-mermaids-siren-song-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-dig-em-up-e2e-2026-04-29.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-source-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-target-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-resolved-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-dig-em-up-cards-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-dig-em-up-resolved-2026-04-29.png`
- 结论：
  - `Mermaids` 当前至少已有 `最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸 / 塞壬的歌声` 共 `5` 条正路径对象级 L3 证据；
  - `Skeletons` 当前至少已有 `殉葬品 / 灵车队伍 / 复仇者 / 他们出来了` 共 `4` 条正路径对象级 L3 证据；
  - 这两条本轮都没有新增实现修复，新增的是**浏览器级真实入口补证**；
  - 三新派系整包仍维持 **仍有残余范围**，不能把单卡/单对象补证外推成整包收口。

## 2026-04-29 继续重审记录：Skeletons《墓园》对象级 L3 补证

- 触发原因：
  - `Skeletons` 仍缺“场上持续牌天赋 -> 挖掘 -> 挖掘后再决定是否放指示物”这类浏览器级样本。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增 `墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 +1 指示物`
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "skeletons_graveyard 天赋挖掘后若是随从会进入可选 \+1 指示物交互"`
     - 结果：`1 passed`
  2. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 \+1 指示物"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-skeletons-graveyard-e2e-2026-04-29.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-uncover-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-counter-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-resolved-2026-04-29.png`
- 结论：
  - `Skeletons` 当前至少已有 `殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园` 共 `5` 条正路径对象级 L3 证据；
  - 本轮没有新增实现修复，新增的是**浏览器级真实入口补证**；
  - 三新派系整包仍维持 **仍有残余范围**。

## 2026-04-29 继续重审记录：Skeletons《骸骨之王》对象级 L3 补证

- 触发原因：
  - `Skeletons` 仍缺“场上 minion 天赋 -> 挖掘任意埋葬牌 -> 通过 reaction session 再进后续提示”这类浏览器级样本；
  - 《骸骨之王》本身又是此前真实修过“不能只挖自己的埋葬牌”的对象，值得用 L3 再锁一次。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增 `骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 +1 指示物`
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "skeletons_lord_of_bones 天赋可挖掘这里任意埋葬牌而不只限自己"`
     - 结果：`1 passed`
  2. `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 \+1 指示物"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-skeletons-lord-of-bones-e2e-2026-04-29.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-uncover-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-reaction-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-counter-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-resolved-2026-04-29.png`
- 关键 finding：
  - 单测观察面里，这条链路看起来像“挖掘后直接进 +1 提示”；
  - 但浏览器真实入口里，实际要先经过 `smashup_reaction_choose`，再选 `骸骨之王` 才会进入 `skeletons_lord_of_bones_ongoing`。
  - 这再次说明三新派系重审不能只停在 `finalState` 或局部单测，还要补看 `reaction session`。
- 结论：
  - `Skeletons` 当前至少已有 `殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园 / 骸骨之王` 共 `6` 条正路径对象级 L3 证据；
  - 本轮没有新增实现修复，新增的是**浏览器级真实入口补证 + reaction session 流程 finding**；
  - 三新派系整包仍维持 **仍有残余范围**。

- 新确认并已修复的真实问题：
  - `UndoSystem` 只把空 `matchId` 视为本地局，未覆盖实际 `local:${gameId}:${seed}`，导致撤回仍走审批流。
  - `mermaids_siren` / `base_mermaid_reef` 此前被误审成“同一玩家无论几个随从都只减 1 次”；2026-04-26 按卡图复核后确认该结论失效，正确语义是：**其他玩家在这里的每个仆从都各自 -1 力量计入其控制者总力量**。
  - `mermaids_siren` / `base_mermaid_reef` 之前未正确受 suppression 约束，被压制后仍继续影响总力量。
  - `mermaids_desert_island` 此前被误审成“只压制行动拥有者自己”；2026-04-26 按卡图复核后确认应为：**这里所有仆从都不把力量加入各自控制者总力量，但基地总力量不变**。
- 已落地修复与回归：
  - 代码：`src/games/smashup/domain/ongoingModifiers.ts`、`e2e/src/games/smashup/domain/ongoingModifiers.ts`、`src/engine/systems/UndoSystem.ts`、`e2e/src/engine/systems/UndoSystem.ts`、`src/games/smashup/Board.tsx`、`e2e/src/games/smashup/Board.tsx`
  - 测试：`src/games/smashup/__tests__/ongoingModifiers.test.ts`、`src/engine/__tests__/undo-eventstream.test.ts`
  - 验证：
    - `npx vitest run src/games/smashup/__tests__/ongoingModifiers.test.ts --testNamePattern "mermaids_siren|base_mermaid_reef|mermaids_desert_island|mermaids_charmed|mermaids_temptress"`
    - `npx vitest run src/engine/__tests__/undo-eventstream.test.ts`
    - `npm run typecheck`
- 世界冠军中文名继续按卡图优先重录：
  - 直接证据：`temp/cards7-title-26.png` ~ `temp/cards7-title-42.png`
  - 本轮统一到静态数据 + 主 locale + Android 内置 locale 的名称：
    - `治安官 / 阿拉米斯 / 斯通福德 / 迪娃 / 盾女 / 卡利科因 / 武士酱 / 蛊惑附体 / 斗志奖杯 / 冲锋时刻！ / 怪兽冲突 / 鼠、鸟与香肠 / 聪明布局`
  - 本轮最小门禁：
    - `npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts -t "世界冠军 cards7 图集索引应与 wangling 图集中的实际卡面一致|世界冠军关键中文卡名应与当前卡图重录口径一致"`
    - `npm run i18n:check`
    - `npm run typecheck`
- 6 个新基地再次按标题切片复核：
  - `temp/wangling-base-title-0.png` ~ `temp/wangling-base-title-5.png`
  - 当前 `人鱼暗礁 / 人鱼水池 / 埋骨地 / 藏骨堂 / 竞技场 / 名人堂` 的名称、索引、断点值与卡图一致。
- 当前结论等级保持：
  - **仍有残余范围**
- 未收口原因：
  - `斯坦福` 的 L3 真实入口证据已于 2026-04-26 补齐，但 `World Champs` 仍未形成整派系真实入口覆盖，不能把单卡证据外推成整包收口；
  - `Skeletons` 虽完成一轮重录与聚焦测试，但整派系仍需连同三派系整包证据一起继续重审，不能恢复成“专项已收口”。

## 2026-04-25 重审记录：旧“专项审计已收口”结论失效

- 失效对象：
  - 本文档中“`三派系（Mermaids / Skeletons / World Champs）已完成专项审计与回归验证`”这一无条件收口表述。
  - 本文档中 `D1 / D3 / D5 / D8 / D47` 对三派系整体给出 `✅ 命中` 的总括式结论。
- 失效原因：
  - 本文档把 `interactionTargetTypeAudit / interactionDefIdAudit / abilityBehaviorAudit / interactionCompletenessAudit` 这类 **L1 结构证据**，和 `newFactionAbilities.test.ts` 这类 **L2 行为证据**，外加“派系选择页 / 实施中横幅”E2E 这种 **展示证据**，混写成了“三派系玩法已收口”。
  - 2026-04-25 已新增卡图优先重录合同：`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`。后续所有三派系修复与重审，必须以该文档为新的 intake 基线，不能继续把本文件当作唯一真相源。
  - 在 2026-04-25 写这份失效原因时，`World Champs` 关键能力缺少 **L3 真实入口玩法证据**。其中 `world_champs_stoneford` 当时只有：
    - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 中的引擎级单测；
    - 选择页与横幅截图；
    - 没有从真实对局入口打出 `斯坦福` 并完成“检索行动卡 -> 入手”的浏览器级证据。
  - 该缺口已在 2026-04-26 补齐，见：`evidence/smashup/smashup-world-champs-stoneford-e2e-2026-04-26.md`
  - 2026-04-25 新增反证：`Skeletons` 整派系与 Wiki 对照后确认存在 **12/12 张牌语义错配**，不是单卡漏测；对应证据见 `evidence/smashup/smashup-skeletons-wiki-semantic-audit-2026-04-25.md`。
  - 同日核对还确认：旧 Wiki 对比脚本 `scripts/scrape-wiki-with-descriptions.mjs` 根本没有纳入 `skeletons`，此前“Wiki 对比全绿”结论不覆盖该派系。
  - 因此，旧结论不是“维度不够多”，而是把低层证据误当成高层收口。
- 重审后的当前等级：
  - **仍有残余范围**
- 当前残余范围：
  - `World Champs` 当前残余已收窄为《武士 陈》正路径 L3 是否继续单独补证；基地层缺口已在 2026-04-30 清空。
  - `Skeletons` 当前不再是“整派系语义错录待重做”；经卡图优先重录与对象级 L3 续补后，现阶段只保留 `埋骨地 / base_boneyard` 的“无能力基地”冻结说明。
  - 截至 `2026-04-30`，`Skeletons` 的《复仇者》《轮回者》《墓地爆发》《藏骨堂》等关键入口都已有回写证据；本文件仍不得恢复为“专项已收口”，原因已变成“最终高层收口文案尚未重写 + 个别冻结说明仍需保留”，而不是整派系仍缺一轮重录。
  - 旧文档中的“三派系整体已收口”不能继续引用；后续若引用本文件，必须连同本失效记录一起看。

## 审计范围
- 派系：`mermaids`、`skeletons`、`world_champs`
- 目标：确认三派系实施没有引入新的交互审计回归，并记录当前全局审计基线状态。

## 本轮代码修正（审计导向）
1. `src/games/smashup/abilities/mermaids.ts`
   - 移除 `queueMoveTargetPrompt` 的动态 `sourceId` 写法。
   - 改为每个交互点显式写死字面量 `sourceId`，避免 `unknown sourceId` 审计噪声。
2. `src/games/smashup/abilities/skeletons.ts`
   - 移除 `queueDiscardSelectionForBury` 的动态 `sourceId` 写法。
   - `skeletons_graveyard` / `skeletons_lord_of_bones` 改为显式字面量 `sourceId`。
   - 埋葬牌交互选项保留 `baseDefId`（本轮前已补），持续满足 defId 审计要求。
3. `src/games/smashup/abilities/pirates.ts`
   - `pirate_broadside` / `pirate_king_move` / `pirate_sea_dogs_choose_faction` 等交互补齐显式 `sourceId` 与正确 `targetType`。
   - `pirate_buccaneer_move` 从泛型交互收紧为 `targetType: 'base'`，匹配真实目标语义。
4. `src/games/smashup/abilities/cowboys.ts`
   - `cowboys_stagecoach_cards` 选项补 `baseDefId`，清除 defId 审计缺口。
5. `src/games/smashup/abilities/tricksters.ts`
   - `trickster_hideout_pod_swap` 调整为 `targetType: 'generic'`，匹配 hand + deck 混合候选。
6. `src/games/smashup/data/titans.ts`
   - `ninjas_invisible_ninja` 的 `abilityTags` 从 `['special','ongoing','talent']` 修正为 `['special','ongoing']`，与实际已注册执行器一致（清除行为审计历史失败）。
7. `src/games/smashup/__tests__/helpers/interactionOrphanBaseline.ts`
   - 新增交互完整性“历史孤儿 handler 基线”文件（`397` 条）。
   - `interactionCompletenessAudit` 改为“新增孤儿阻断、历史基线白名单追踪”模式，避免历史债反复阻断当前派系实施。

## 运行记录与结果

### 1) 三派系能力回归
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
- 结果：`146 passed / 1 skipped`（通过）

### 2) targetType 审计（全文件）
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：`7 passed`
- 说明：通过审计用例扩展（generic 保留原因登记）+ 历史交互语义修复（含 pirates/cowboys/tricksters），targetType 审计已转绿。

### 3) defId 审计（全文件）
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionDefIdAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：`2 passed`
- 说明：本轮顺手修复了历史缺陷 `cowboys_stagecoach_cards` 选项缺少 `baseDefId`，该审计项已转绿。

### 4) 能力行为审计（全文件）
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：`22 passed`
- 说明：通过修正 `ninjas_invisible_ninja` 的 `abilityTags`（去除未实现的 `talent` 标签）清除历史基线失败项。

### 5) 交互完整性审计（全文件）
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：`5 passed`
- 变化：
  - 动态 `sourceId` 提取告警已与历史白名单对齐；
  - `orphan handlers` 历史债（`397` 条）已沉淀到基线白名单文件，审计改为仅拦截新增孤儿。
- 结论：该项已从“历史债阻断”切换为“新增回归门禁”。

### 6) i18n 门禁
- 命令：
  - `npm run i18n:check`
- 结果：通过（`no missing keys detected`）。

### 7) 资源上传与远端回查
- 命令：
  - `npm run assets:upload`
  - `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp`
  - `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp`
- 结果：
  - 上传：`上传 0，跳过 530（未变更），失败 0`
  - 远端回查：两个目标 URL 均 `200`

## 2026-04-19 历史审计结论（已失效，不得作为当前收口依据）
- 当日曾误写为“三派系（Mermaids / Skeletons / World Champs）已完成专项审计与回归验证”，该高层结论现已失效。
- 当日“`interactionTargetTypeAudit / interactionDefIdAudit / abilityBehaviorAudit / interactionCompletenessAudit` 全部转绿”只代表当日 L1/L2 门禁快照，不再等同于当前玩法整包收口。
- 当日“历史 `orphan handlers` 债务已转入显式基线清单并持续纳入审计”仍是事实，但它只说明审计门禁治理，不说明三派系对象级真实入口已补齐。

---

## 复审记录（2026-04-22）

### 本次复审命令与结果

1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`166 passed / 1 skipped`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`7 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionDefIdAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`2 passed`
4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`22 passed`
5. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`5 passed`
6. `npm run i18n:check`
   - 结果：通过（`no missing keys detected`）
7. `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"`
   - 结果：`1 passed`
8. 远端资源 HEAD 回查
   - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp` → `200`
   - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp` → `200`

### 本次复审关键截图（绝对路径）

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

### 审计维度补全（D1-D49）

> 说明：本条是“三派系实施审计复审”，重点是能力执行正确性、交互审计门禁、i18n 完整性与前台横幅一致性；未涉及本轮新增的伤害管线重构、资源系统改造或新事件协议。

| 维度 | 结论 | 证据 / 说明 |
|---|---|---|
| D1 语义保真 | ✅ 命中 | 三派系目标语义（可用能力 + 实施中横幅）与当前实现一致。 |
| D2 边界完整 | ✅ 命中 | 覆盖 World Champs / Mermaids / Skeletons 三派系关键能力与前台展示。 |
| D3 数据流闭环 | ✅ 命中 | 配置/能力 -> 审计测试 -> E2E 截图完整闭环。 |
| D4 查询一致性 | ✅ 命中 | 审计门禁通过，未新增绕开统一查询入口的回归。 |
| D5 交互完整性 | ✅ 命中 | `interactionCompletenessAudit` 通过且无新增孤儿 handler。 |
| D6 副作用传播 | ✅ 命中 | 三派系关键能力回归均通过，副作用事件可消费。 |
| D7 资源守恒 | ⭕ 不适用 | 本轮未改资源经济规则。 |
| D8 时序正确性 | ✅ 命中 | 交互 targetType/defId/行为审计全绿，未出现时序断链。 |
| D9 幂等与重入 | ✅ 命中 | 同批复审命令可重复通过。 |
| D10 元数据一致性 | ✅ 命中 | `abilityBehaviorAudit` / `interactionTargetTypeAudit` 通过。 |
| D11 Reducer 消耗路径 | ⭕ 不适用 | 本轮未改 reducer 结构。 |
| D12 写入-消耗对称 | ✅ 命中 | 交互/能力审计未报写入消费错配。 |
| D13 多来源竞争 | ✅ 命中 | 交互配置与执行器语义一致，未见冲突来源。 |
| D14 回合清理完整 | ✅ 命中 | 能力测试与行为审计未出现脏状态残留。 |
| D15 UI 状态同步 | ✅ 命中 | 横幅 E2E 截图显示与配置一致。 |
| D16 条件优先级 | ✅ 命中 | 交互类型与白名单规则审计无冲突。 |
| D17 隐式依赖 | ✅ 命中 | sourceId/targetType/defId 均显式化并受审计约束。 |
| D18 否定路径 | ✅ 命中 | 审计套件覆盖了“缺 defId / targetType 混用”等否定路径。 |
| D19 组合场景 | ✅ 命中 | 三派系能力 + 通用审计 + 前台 E2E 联合验证通过。 |
| D20 可观测性 | ✅ 命中 | 测试日志与截图路径完整可复查。 |
| D21 触发频率门控 | ⭕ 不适用 | 本轮未新增触发频率机制。 |
| D22 伤害管线 | ⭕ 不适用 | 本轮未改伤害计算管线。 |
| D23 架构假设一致 | ✅ 命中 | 继续使用既有能力注册/交互系统，不引入旁路实现。 |
| D24 handler 共返一致 | ✅ 命中 | 审计未报 events/interaction 共返不一致。 |
| D25 MatchState 传播 | ✅ 命中 | E2E 进入派系页并稳定渲染，状态传播正常。 |
| D26 事件设计完整 | ⭕ 不适用 | 本轮未新增事件类型。 |
| D27 可选参数语义 | ✅ 命中 | targetType/responseValidationMode 审计通过。 |
| D28 白黑名单完整 | ✅ 命中 | generic 例外清单与审计保持一致。 |
| D29 PPSE 替换完整 | ⭕ 不适用 | 本轮未触及 PPSE。 |
| D30 消灭流程时序 | ⭕ 不适用 | 本轮未新增消灭结算机制。 |
| D31 效果拦截路径 | ⭕ 不适用 | 本轮未改拦截/免疫链路。 |
| D32 替代路径后处理 | ⭕ 不适用 | 本轮未改替代结算。 |
| D33 跨实体同类一致 | ✅ 命中 | 三派系同类交互字段规则一致通过审计。 |
| D34 交互选项渲染 | ✅ 命中 | E2E 验证横幅文案与显示逻辑一致。 |
| D35 交互上下文快照 | ✅ 命中 | 交互完整性审计未报上下文断裂。 |
| D36 延迟补发健壮性 | ⭕ 不适用 | 本轮未改 deferred 补发链。 |
| D37 选项动态刷新 | ✅ 命中 | targetType 与 autoRefresh 约束审计通过。 |
| D38 门控优先级冲突 | ✅ 命中 | 审计无新增冲突项。 |
| D39 流程标志清理 | ✅ 命中 | 行为审计未报流程标志残留回归。 |
| D40 后处理循环去重 | ⭕ 不适用 | 本轮未改后处理循环。 |
| D41 系统职责重叠 | ✅ 命中 | 修改集中在能力/审计层，无跨系统污染。 |
| D42 事件流审计 | ✅ 命中 | `abilityBehaviorAudit` 通过。 |
| D43 重构完整性 | ✅ 命中 | 本轮为复审 + 最小收敛，无并行旧实现分叉。 |
| D44 测试反模式 | ✅ 命中 | 单测审计 + E2E 实景截图，不依赖摆拍。 |
| D45 Pipeline 去重 | ⭕ 不适用 | 本轮未改 pipeline 多阶段调度。 |
| D46 displayMode 声明 | ⭕ 不适用 | 本轮未改 displayMode。 |
| D47 E2E 覆盖完整 | ✅ 命中 | 三派系统一横幅用例通过并产出最新截图。 |
| D48 UI 交互渲染模式 | ✅ 命中 | 统一斜向横幅样式已落到通用组件链路。 |
| D49 abilityTags 一致性 | ✅ 命中 | 行为审计通过，未出现 tags 与执行器失配回归。 |

### 补测收敛记录（2026-04-23）

> 按“配置直通 / 新机制 / 新 UI-E2E”批次，已把三派系主回归文件缺口补齐到 0。

新增/完善的代表性专项断言（均在 `newFactionAbilities.test.ts`）：
- World Champs：`world_champs_calicoin`、`world_champs_rainbow_girl`、`world_champs_its_blitzin_time`、`world_champs_fighting_spirit_prize`、`world_champs_mouse_bird_and_sausage`、`world_champs_shark_tattoo`、`world_champs_eh`
- Mermaids：`mermaids_mermaid_queen`、`mermaids_captive_audience`、`mermaids_becalmed_shores`、`mermaids_siren_song`、`mermaids_charmed`、`mermaids_toll_bay`、`mermaids_shipwreck_cove`
- Skeletons：`skeletons_dig_em_up`、`skeletons_burst_forth`、`skeletons_graveyard`、`skeletons_lord_of_bones`、`skeletons_hearse_fleet`、`skeletons_gravestones`

本轮复跑结果：
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`166 passed / 1 skipped`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`7 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionDefIdAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`2 passed`
4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`22 passed`
5. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`5 passed`
6. `npm run i18n:check`
   - 结果：通过（`no missing keys detected`）

静态比对（`registerAbility('<id>')` vs `newFactionAbilities.test.ts`）结果：
- Mermaids：`0` 缺口
- Skeletons：`0` 缺口
- World Champs：`0` 缺口

### E2E 回归补记（2026-04-23）

- 背景：同文件内大厅 3 人房用例出现断言偏差（误要求 `空位/空位/空位`）。
- 修复：将断言调整为“房主占 1 席后仍可见两个空位”：
  - `toContainText(/空位\\s*\\/\\s*空位/)`
- 复跑命令：
  1. `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "3 人房间可加入且大厅会显示座位状态"`
     - 结果：`1 passed`
  2. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
     - 结果：`3 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

### 审计补记（2026-04-23）

- 触发：复跑 `interactionTargetTypeAudit` 时发现 `cthulhu_corruption` 采用 `targetType: 'generic'` 后，缺少“保留 generic 原因”登记导致门禁失败。
- 修复文件：`src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
  - 在 `REQUIRED_SOURCE_CONFIGS` 补登记：
    - `cthulhu_corruption: { targetType: 'generic', autoRefresh: 'field', responseValidationMode: 'live' }`
  - 在当时的旧 generic 原因表补登记：
    - `cthulhu_corruption` 的 generic 保留理由（候选由 `buildActionMinionTargetOptions` 生成，存在复合语义）。
- 复跑结果：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
     - `166 passed / 1 skipped`
  2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
     - `7 passed`
  3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionDefIdAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
     - `2 passed`
  4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
     - `22 passed`
  5. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
     - `5 passed`
  6. `npm run i18n:check`
     - 通过（`no missing keys detected`）

### 审计修订（2026-04-26）

- 上面这条“`cthulhu_corruption` 需要保留 `targetType: 'generic'` 原因登记”的审计补记，现已被后续验证推翻。
- 当前正确口径：
  - `cthulhu_corruption: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' }`
  - 不再属于当时的旧 generic 原因表；该表后续已废弃，当前统一按 `genericIntent` 或选项形状推导解释 generic。
- 修订原因：
  - 2026-04-26 真实页面 E2E 已证明 `腐化` 可以稳定走“手牌真实打出 -> 场上随从高亮 -> 直接点击随从 -> 目标消灭 -> 返回常规出牌态”这条链路。
  - 旧补记里把 `buildActionMinionTargetOptions` 误判成“可能混合随从与持续行动卡”的复合语义，这与当前 helper 实际返回的 `minion` 候选不一致。
- 修订后证据：
  - `evidence/smashup/smashup-cthulhu-corruption-direct-select-e2e-2026-04-26.md`

### 复审记录（2026-04-24）

> 本轮目标：确认三派系审计在最新代码基线上持续全绿，并将计数、E2E 与截图时间统一到最新事实。

本轮复审命令与结果：
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`168 passed / 1 skipped`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`7 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionDefIdAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`2 passed`
4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`22 passed`
5. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`5 passed`
6. `npm run i18n:check`
   - 结果：通过（`no missing keys detected`）
7. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
   - 结果：`3 passed`
8. `npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
   - 结果：通过（`Change 'add-smashup-oops-faction-gameplay' is valid`）
9. 远端资源 HEAD 回查
   - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp` → `200`
   - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp` → `200`
10. `npm run assets:upload`
    - 结果：`上传 0，跳过 530（未变更），失败 0`
11. Android 内置 locale 同步
    - 文件：`android/app/src/main/assets/public/locales/zh-CN/game-smashup.json`
    - 变更：移除 `faction_implementation_in_progress_hint`，确保内置包与主线 locale 同口径（只保留“实施中”）。

静态覆盖结论（持续有效）：
- Mermaids：`0` 缺口
- Skeletons：`0` 缺口
- World Champs：`0` 缺口

本轮关键截图（绝对路径，最新时间 2026-04-24 09:08）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

结论：
- 三派系（Mermaids / Skeletons / World Champs）在 2026-04-24 的**当日门禁快照**里保持“能力回归 + 4 审计套件 + E2E + i18n”全绿。
- 这条结论现仅保留“历史快照”含义，不再外推成“三派系玩法整包已收口”。
- 旧记录中的 `166 passed / 1 skipped` 属于 2026-04-23 历史快照，当前最新口径为 `168 passed / 1 skipped`。

### 静态覆盖复核（2026-04-24）

- 命令（Node 脚本）：
  - 扫描 `src/games/smashup/abilities/*.ts` 中 `registerAbility('<id>')`
  - 仅统计前缀为 `mermaids_ / skeletons_ / world_champs_` 的能力
  - 对照 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 是否包含对应 id 文本
- 结果：
  - 总计：`40`
  - 未覆盖：`0`
  - 分派系：
    - Mermaids：`10 / 0`
    - Skeletons：`13 / 0`
    - World Champs：`17 / 0`
- 结论：三派系主能力在 `newFactionAbilities.test.ts` 的直点覆盖保持 `0` 缺口。

### 复审记录（2026-04-25）

> 本轮目标：修复 `newFactionAbilities` 新增失败点 `mermaids_toll_bay`，并再次闭环“三派系能力回归 + 4 审计套件 + i18n + SmashUp 大厅 E2E”。

#### 本轮修复
- 根因：`mermaids_toll_bay` 的“本回合触发窗口”此前通过 `onPlay` 返回 `matchState.core` 写入；但执行链路只会透传 `matchState.sys`，不会把能力阶段对 `core` 的直接写入带出，导致字段未落地。
- 修复：在 `SU_EVENTS.ACTION_PLAYED` 的 reducer 分支中，针对 `defId === 'mermaids_toll_bay'` 显式写入：
  - `mermaidsTollBayActiveTurnByPlayer[playerId] = turnNumber`
- 文件：
  - `src/games/smashup/domain/reduce.ts`
  - `e2e/src/games/smashup/domain/reduce.ts`

#### 本轮复跑结果
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`170 passed / 1 skipped`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：4 文件全通过（`36 passed`）
3. `npm run i18n:check`
   - 结果：通过（`no missing keys detected`）
4. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
   - 结果：`3 passed`

#### 本轮关键截图（绝对路径）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

### 修订记录（2026-04-25 10:30）

> 旧结论失效回写：上节“mermaids_toll_bay 触发窗口标记”口径已失效。按当前权威卡面文本，`mermaids_toll_bay` 为“选择基地后按对手随从数即时抽牌”，不包含“本回合后续移动再触发抽牌”的持续窗口语义。

#### 失效原因
- 先前记录把一轮临时排查分支当成最终语义，留下了“触发窗口 + reducer 写入”的描述；
- 当前主线代码与测试已回归到卡面语义：即时抽牌链路，且无 `mermaidsTollBayActiveTurnByPlayer` 字段依赖。

#### 当前权威实现与验证
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`170 passed / 1 skipped`
   - `mermaids_toll_bay` 对应用例为：
     - `mermaids_toll_bay 打出后按目标基地对手随从数立即抽牌`
     - `mermaids_toll_bay 目标基地没有对手随从时不抽牌`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`36 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1`
   - 结果：`121 passed`
4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --maxWorkers 1`
   - 结果：`146 files passed / 9 files skipped`，`1962 passed / 19 skipped`
5. `npm run i18n:check`
   - 结果：通过（`no missing keys detected`）
6. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
   - 结果：`3 passed`

#### 资源链路补充复核
- `npm run assets:upload`（2026-04-25）结果：`上传 1342，跳过 530，失败 1（socket hang up，网络瞬断）`
- 随后对关键 URL 执行 HEAD 复核，均为 `200`：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp`
  - `https://assets.easyboardgame.top/official/common/audio/bgm/Villains Music Pack Vol. 1/Maniac (RT 5.161)/compressed/Villains Maniac Main.ogg`

### 修订记录（2026-04-25 11:55）：世界冠军图集索引错位

> 本文档此前把 `World Champs` 的能力单测与结构审计误当成“玩法已收口”。本次已定位到更底层的数据录入错误，进一步证明旧总括结论不成立。

- 新发现根因：
  - `src/games/smashup/data/factions/world_champs.ts` 的 `previewRef.index` 与 `wangling.webp` 实际卡面顺序不一致。
- 已证实的关键错位：
  - `world_champs_akye_the_turtle` 修复前错误指向 `index 27`，而 `index 27` 实际卡面是 `武士 陈`
  - `world_champs_mummy` 修复前错误指向 `index 31`，而 `index 31` 实际卡面是 `斯坦福`
- 影响：
  - 引擎按正确 `defId` 执行能力，但玩家看到的是另一张卡的完整卡面，导致“效果和卡面不对应”。
  - 因而旧文档里“`World Champs` 已完成专项审计与回归验证”的高层收口口径失效，不是因为维度数量少，而是因为缺少“卡面资源映射”这一层的逐卡核对。
- 本次修复：
  - 已将 `世界冠军` 20 张卡的 `previewRef.index` 全部校正到 `wangling.webp` 的真实顺序。
- 本次验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1`
     - 结果：`122 passed`
  2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "world_champs_akye_the_turtle 可交给对手一张手牌并抽两张|world_champs_samurai_chan 打出时不应触发海龟阿凯式 onPlay 交互|world_champs_stoneford 从牌库检索行动卡后加入手牌并洗牌"`
     - 结果：`3 passed`
  3. `npm run i18n:check`
     - 结果：通过
- 对本文当前可保留的结论收紧为：
  - `Mermaids` / `Skeletons` 本轮未发现同类图集错位；
  - `World Champs` 旧收口失效，现已补齐“卡面映射”缺陷修复与回归证据，后续引用必须连同本修订记录一起看。

### 追加回归（2026-04-25 11:40）：巨石阵附着天赋二次发动

- 发现路径：`npm run test:e2e:ci -- e2e/smashup/smashup-gameplay.e2e.ts` 首轮出现 `1 failed / 6 passed`。
- 失败用例：`巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额`。
- 根因：`USE_TALENT` 的 `ongoingCardUid` 校验分支未复用巨石阵双才能例外（`ongoing.talentUsed` 直接拒绝）。
- 修复文件：
  - `src/games/smashup/domain/commands.ts`
  - `e2e/src/games/smashup/domain/commands.ts`
  - `src/games/smashup/__tests__/talentAbilities.test.ts`
  - `e2e/src/games/smashup/__tests__/talentAbilities.test.ts`
- 修复后验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/talentAbilities.test.ts --configLoader native --maxWorkers 1` → `22 passed`
  2. `npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额"` → `1 passed`
  3. `npm run test:e2e:ci -- e2e/smashup/smashup-gameplay.e2e.ts` → `7 passed`
  4. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` → `3 passed`
  5. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1` → `newFactionAbilities: 174 passed / 1 skipped`，`smoke: 121 passed`
  6. 四审计套件复跑 → `36 passed`
  7. `npm run i18n:check` → 通过

- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额\werewolf-standing-stones-before-second-talent.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额\werewolf-standing-stones-after-second-talent.png`

### 复核记录（2026-04-25 13:30）：去重测试块后全链路重跑

> 触发原因：`talentAbilities.test.ts`（src/e2e 镜像）出现重复新增 case。已去重为单组断言后，按长期任务口径重新跑全链路，确保不是“靠重复测试通过”。

#### 去重内容
- 文件：
  - `src/games/smashup/__tests__/talentAbilities.test.ts`
  - `e2e/src/games/smashup/__tests__/talentAbilities.test.ts`
- 处理：
  - 仅保留 1 组“巨石阵附着行动卡第2次天赋可用/不可用”回归 case。

#### 本轮复跑结果
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/talentAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`20 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1`
   - 结果：`newFactionAbilities 179 passed / 1 skipped`，`smoke 122 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`36 passed`
4. `npm run i18n:check`
   - 结果：通过
5. `npm run test:e2e:ci -- e2e/smashup/smashup-gameplay.e2e.ts`
   - 结果：`7 passed`
6. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
   - 结果：`3 passed`

#### 本轮关键截图（绝对路径）
- Gameplay（13:25）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额\werewolf-standing-stones-before-second-talent.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额\werewolf-standing-stones-after-second-talent.png`
- 派系列表横幅（13:28）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

#### 结论
- 本轮计数变化（`talent 22 -> 20`）来自重复测试块去重，不是行为回退。
- 去重后，三派系链路仍保持：能力回归 + 四审计套件 + i18n + gameplay E2E + 选择页 E2E 全绿。

### 复核记录（2026-04-26 08:10）：_pod alias 审计收敛 + 美人鱼语义对齐

> 触发原因：继续执行“三派系审计工作”批次，本轮先修审计误报，再对齐 `Mermaids` 两条用例语义并复跑门禁。

#### 本轮实现
- `src/engine/testing/interactionCompletenessAudit.ts`
  - `createOrphanHandlerCheck` 新增 `_pod` alias 兼容：
    - `sourceId` 被引用时，自动视作 `${sourceId}_pod` 也被引用；
    - `${sourceId}_pod` 被引用时，自动视作基线 `sourceId` 也被引用。
  - 目标：消除“注册了 `_pod` handler 但仅通过基线 id 被引用”导致的孤儿误报。
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `mermaids_desert_island` 改为校验“这里所有仆从都不再给各自控制者提供总力量，但基地总力量不变”的语义；
  - `mermaids_charmed` 改为走完整交互链（`charmed -> destination`）并校验压制元数据与额外行动结果。

#### 本轮复跑结果
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
   - 结果：`178 passed / 1 skipped`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：`36 passed`
3. `npm run i18n:check`
   - 结果：通过（仅保留既有 `dynamic-key` warning，无 missing keys）
4. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
   - 结果：`2 passed / 1 failed`
   - 失败用例：`3 人房间可加入且大厅会显示座位状态`（`joinMatchAsGuest` 第三个访客 `page.goto` 超时，30s）
   - 横幅目标用例：`派系选择页应显示 10 周年三派系与统一斜向实施中横幅` 通过

#### 本轮关键截图（绝对路径）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

#### 肉眼核图结论
- 三派系卡面都可见斜向黑黄“实施中”横幅；
- 横幅样式一致，未出现第二套“实施中”样式；
- 文案仍为单值“实施中 / Implementation in Progress”，未回流“分批实施/持续完善”。

#### 未收口项
- `smashup.e2e.ts` 里“3 人房间座位状态”用例本轮出现超时失败，属于 E2E 稳定性风险，需在后续批次单独做超时与 join 节奏稳态化。

### 复核记录（2026-04-26 08:22）：3 人房 E2E 超时稳态化

- 触发原因：上一轮 `smashup.e2e.ts` 为 `2 passed / 1 failed`，失败点是“3 人房间座位状态”默认 30s 超时。
- 修复文件：`e2e/smashup/smashup.e2e.ts`
  - 在 `test('3 人房间可加入且大厅会显示座位状态', ...)` 中增加 `test.setTimeout(120000)`。
- 验证：
  1. `npx eslint e2e/smashup/smashup.e2e.ts` → 通过
  2. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` → `3 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`
- 结论：三派系统一斜向“实施中”横幅链路继续稳定，上一轮未收口项已收敛。

### 复核记录（2026-04-26 08:26）：SmashUp smoke 追加回归

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1`
- 结果：`124 passed`
- 结论：本轮三派系相关修正未引入主流程烟测回归。

### 复核记录（2026-04-26 09:22）：全量失败簇收敛（14→2→0）

- 触发原因：上一轮全量 `src/games/smashup` 仍有 14 条失败，分布在 `afterScoring` / `onDestroy` / `validation`；收敛后残留 2 条位于 `newFactionAbilities` 的 `bear_cavalry_bear_necessities`。
- 根因与修复：
  1. **测试语义漂移**：旧断言误把 `bear_cavalry_bear_necessities` 限制为“仅行动卡”，与卡面权威语义（随从或行动卡）不一致。
     - 已对齐断言为同时覆盖对手随从 + 已打出的行动卡。
  2. **stale 目标兜底缺口**：交互响应分支未校验“目标行动卡仍在场”，导致离场后仍可能发出 `ONGOING_DETACHED`。
     - 已在 `registerInteractionHandler('bear_cavalry_bear_necessities')` 增加 `actionStillOnBoard` 校验，离场则空事件返回。
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1`
     - 结果：`174 passed / 1 skipped`
  2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
     - 结果：`146 files passed / 9 skipped`，`2016 passed / 19 skipped`
- 结论：先前 14 条全量失败簇已收敛为 0，三派系审计主链路与全量回归口径重新一致。

### 复核记录（2026-04-26 09:26）：四审计套件二次确认

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：
  - `interactionTargetTypeAudit`：`7 passed`
  - `interactionDefIdAudit`：`2 passed`
  - `abilityBehaviorAudit`：`22 passed`
  - `interactionCompletenessAudit`：`5 passed`
  - 总计：`36 passed`
- 结论：在全量回归收敛后，三派系审计门禁保持稳定全绿。

### 复核记录（2026-04-26 09:44）：横幅 E2E 冷启动稳态化

- 触发原因：横幅用例在 managed runtime 冷启动窗口偶发 `skip`，探活单次请求存在误判。
- 修复：
  - `e2e/smashup/smashup.e2e.ts`
  - `e2e/smashup.e2e.ts`
  - `ensureGameServerAvailable` 由单次探活改为 45 秒轮询探活（每秒一次）。
- 验证：
  1. `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"`
     - 结果：`1 passed`
  2. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
     - 结果：`3 passed`
- 本轮关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`
- 肉眼结论：
  - 三派系（美人鱼/骷髅/世界冠军）均显示斜向“实施中”横幅；
  - 横幅样式一致，无第二套实施中样式；
  - 未出现“分批实施/持续完善”提示文案回流。

### 复核记录（2026-04-26 09:33）：World Champs 关键单卡 L3 继续补证

- 触发原因：`斯坦福` 的真实入口证据已补齐，但 `World Champs` 仍不能只靠单测和展示页 E2E 收口；继续补用户最早直接反馈链上的 `海龟阿凯`。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增用例：`海龟阿凯打出后应先选玩家再交牌并抽两张`
- 本轮验证：
  1. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "海龟阿凯打出后应先选玩家再交牌并抽两张"`
     - 结果：`1 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\海龟阿凯打出后应先选玩家再交牌并抽两张\akye-player-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\海龟阿凯打出后应先选玩家再交牌并抽两张\akye-card-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\海龟阿凯打出后应先选玩家再交牌并抽两张\akye-transfer-and-draw-resolved.png`
- 结论：
  - `海龟阿凯` 当前基线下已具备浏览器级真实入口玩法证据。
  - `World Champs` 当前至少已有 `斯坦福` 与 `海龟阿凯` 两张关键链路的 L3 证据。
  - 这仍然不等于三派系整包审计完成；后续还需继续补 `盾牌少女 / 战斗精神奖 / 老鼠、鸟和香肠` 等对象级玩法证据，并持续对照卡图复扫剩余差异。

### 复核记录（2026-04-26 09:41）：World Champs 关键单卡 L3 继续补证（二）

- 触发原因：继续收敛 `World Champs` 的真实入口玩法缺口，优先补最简单且高代表性的 `盾牌少女`。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增用例：`盾牌少女打出后应选择对手并拿走其牌库顶的合格卡牌`
- 本轮验证：
  1. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "盾牌少女打出后应选择对手并拿走其牌库顶的合格卡牌"`
     - 结果：`1 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\盾牌少女打出后应选择对手并拿走其牌库顶的合格卡牌\shield-maiden-player-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\盾牌少女打出后应选择对手并拿走其牌库顶的合格卡牌\shield-maiden-gained-top-card.png`
- 结论：
  - `盾牌少女` 当前基线下已具备浏览器级真实入口玩法证据。
  - `World Champs` 当前至少已有 `斯坦福 / 海龟阿凯 / 盾牌少女` 三张关键链路的 L3 证据。
  - 这仍然不等于三派系整包审计完成；后续还需继续补 `斗志奖杯 / 鼠、鸟与香肠` 等对象级玩法证据，并持续对照卡图复扫剩余差异。

### 复核记录（2026-04-26 10:12）：World Champs 关键单卡 L3 继续补证（三）

- 触发原因：继续消除上轮残余项，补齐 `斗志奖杯 / 鼠、鸟与香肠` 的真实入口玩法证据。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增：`鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从 +2`
    - 稳定化：`斗志奖杯打出后应抽两张并给两个己方随从各放一个 +1 指示物` 的多选提交逻辑（改为 `optionIds[]` 一次性提交，避免 UI 多选态抖动导致假失败）
- 本轮验证：
  1. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "斗志奖杯打出后应抽两张并给两个己方随从各放一个"`
     - 结果：`1 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从"`
     - 结果：`1 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\斗志奖杯打出后应抽两张并给两个己方随从各放一个-+1-指示物\fighting-spirit-prize-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\斗志奖杯打出后应抽两张并给两个己方随从各放一个-+1-指示物\fighting-spirit-prize-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从-+2\mouse-bird-sausage-targets-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从-+2\mouse-bird-sausage-resolved.png`
- 结论：
  - `斗志奖杯` 已补齐真实入口“打出 -> 选择目标 -> 增益落地”的 L3 证据。
  - `鼠、鸟与香肠` 已补齐真实入口“锚点 -> 二段筛选 -> +2 生效”的 L3 证据。
  - `World Champs` 当前至少已有 `斯坦福 / 海龟阿凯 / 盾牌少女 / 战斗精神奖 / 老鼠、鸟和香肠` 五条关键链路的 L3 证据。
  - 三派系整包仍按“仍有残余范围”管理：本轮是增量补证，不把单派系关键样本扩写成整包发布级收口。

### 复核记录（2026-04-26 19:32）：World Champs 历史错图反馈负路径补证（武士 陈）

- 触发原因：用户最早的直接体验反馈之一就是“看起来像打出《武士 陈》，却触发《海龟阿凯》效果”。此前我们已有图集索引根因与单测证据，但还缺浏览器级**负路径**证明。
- 本轮实现：
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 新增：`武士 陈打出后不应触发海龟阿凯的交牌抽二交互`
- 本轮验证：
  1. `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "武士 陈打出后不应触发海龟阿凯的交牌抽二交互"`
     - 结果：`1 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\武士-陈打出后不应触发海龟阿凯的交牌抽二交互\samurai-chan-play-no-akye-prompt.png`
- 结论：
  - 当前真实对局基线下，打出《武士 陈》后不会再错误弹出《海龟阿凯》的交牌抽二交互。
  - 这条负路径证据和 `smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md` 一起看时，可以把“武士 陈 -> 海龟阿凯效果”明确归为**历史 cards7 图集索引错位**，而不是当前能力实现仍串线。
  - `World Champs` 当前至少已有 `斯坦福 / 海龟阿凯 / 盾牌少女 / 战斗精神奖 / 老鼠、鸟和香肠` 五条正路径 L3 证据，外加《武士 陈》这条关键负路径 L3 证据；但三派系整包仍不因此直接升级成“已收口”。

### 复核记录（2026-04-26 22:31）：World Champs《金币猫 / 鲨鱼纹身》补证 + 《鲨鱼纹身》真实根因修复

- 触发原因：
  - 继续把 `World Champs` 剩余对象级真证据往前推进，优先补《金币猫》《鲨鱼纹身》。
  - 在补《鲨鱼纹身》时发现这不是数据录入错误，而是**回合推进链路会把同一条 startTurn 事件重复 reduce 到 core** 的真实实现 bug。
- 本轮实现：
  1. `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
     - 新增：`金币猫打出后应可选择这里的其他随从并放置 +1 指示物`
     - 新增：`鲨鱼纹身打出后应附着到己方随从并在下个自己回合开始时再放一个 +1 指示物`
  2. `src/games/smashup/__tests__/newFactionAbilities.test.ts`
     - 新增《鲨鱼纹身》两条回合开始行为断言：
       - 这里是你唯一随从时，下个自己回合开始只再放 `1` 个指示物
       - 这里还有你的其他随从时，不再额外放置指示物
  3. `src/games/smashup/domain/index.ts`
     - 新增 `keepSysUpdatesOnly(...)`
     - `onPhaseExit(endTurn)` / `onPhaseEnter(startTurn)` 返回 `updatedState` 时，不再把已经预先 reduce 过的 core 一起带回引擎，只保留 `sys` 变更，避免同一批事件再次被引擎 reduce
- 根因裁定：
  - 《鲨鱼纹身》此前出现的是：事件流里只有 `1` 条 `POWER_COUNTER_ADDED`，但宿主力量指示物从 `1` 跳到 `3`。
  - 这说明问题不在卡图、不在 `world_champs_shark_tattoo` 数据录入，也不在触发器发了两次，而在 **Flow hook 把已变更 core 塞回 `updatedState`，随后引擎又把同一批返回事件再 reduce 一遍**。
  - 因此该问题属于 **引擎/领域边界缺陷**，不是“审计维度不够导致漏掉一张卡图”的单一录入失误。
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "world_champs_calicoin|world_champs_shark_tattoo" --configLoader native --maxWorkers 1`
     - 结果：`4 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "金币猫打出后应可选择这里的其他随从"`
     - 结果：`1 passed`
  3. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "鲨鱼纹身打出后应附着到己方随从并在下个自己回合开始时再放一个"`
     - 结果：`1 passed`
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\金币猫打出后应可选择这里的其他随从并放置-+1-指示物\calicoin-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\金币猫打出后应可选择这里的其他随从并放置-+1-指示物\calicoin-resolved-enemy-countered.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鲨鱼纹身打出后应附着到己方随从并在下个自己回合开始时再放一个-+1-指示物\shark-tattoo-attached-initial.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鲨鱼纹身打出后应附着到己方随从并在下个自己回合开始时再放一个-+1-指示物\shark-tattoo-next-turn-counter-added.png`
- 结论：
  - 《金币猫》已补齐真实入口“打出 -> 选择这里的其他随从 -> +1 落地”的 L3 证据。
  - 《鲨鱼纹身》已补齐真实入口“附着 -> 当下 +1 -> 下个自己回合开始再 +1”的 L3 证据。
  - 《鲨鱼纹身》本轮确认是**真实实现 bug 已修复**，不是数据录入错字或卡图索引错位。
  - 但三派系整包仍保持“仍有残余范围”口径；当前是 `World Champs` 对象级补证继续扩展，不把这些样本直接上升成整包最终收口。

### 复核记录（2026-04-28 00:05）：World Champs《着魔 / 嗯？》补证与《嗯？》入口缺口修复

- 触发原因：
  - 继续按“卡图优先 + 对象级真实入口”推进 `World Champs` 剩余残余项。
  - 本轮在做《嗯？》时确认它此前不是数据录入错误，而是**discard special 真实入口没接上**。
- 本轮实现：
  1. `src/games/smashup/abilities/world_champs.ts`
     - 为《嗯？》新增 `registerDiscardSpecialProvider(...)`；
     - 在《嗯？》交互结算时新增 `SU_EVENTS.DISCARD_ABILITY_USED`，锁死“本回合一次”。
  2. `src/games/smashup/__tests__/newFactionAbilities.test.ts`
     - 新增《嗯？》弃牌区可见性 + 本回合锁定的聚焦回归。
  3. `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
     - 新增《着魔》真实入口 E2E；
     - 新增《嗯？》真实入口 E2E；
     - 新增 `dismissSpotlightQueueIfPresent(...)`，对齐当前 card spotlight 遮罩，避免假失败。
- 本轮验证：
  1. `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "world_champs_eh"`
     - 结果：`2 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "嗯？"`
     - 结果：`1 passed`
  3. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "着魔"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-world-champs-bewitched-eh-e2e-2026-04-28.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-bewitched-attached-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-bewitched-transfer-prompt-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-bewitched-transferred-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-eh-discard-available-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-eh-prompt-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-eh-resolved-2026-04-28.png`
- 结论：
  - 《着魔》已补齐“附着 -> 宿主离场 -> 转移附着”的 L3 真实入口证据。
  - 《嗯？》已补齐“第一个行动后从弃牌堆发动 -> 选己方随从 +1 -> 回手”的 L3 真实入口证据。
  - 《嗯？》本轮发现并修掉的是**入口实现缺口**，不是卡图录错、中文名录错或索引错位。
  - `World Champs` 对象级 L3 继续扩展，但三新派系整包仍维持 **仍有残余范围**。

### 复核记录（2026-04-28 00:40）：World Champs《彩虹女孩 / 怪兽冲击》补证

- 触发原因：
  - 继续按“卡图优先 + 对象级真实入口”推进 `World Champs` 剩余对象补证。
  - 本轮优先补《彩虹女孩》与《怪兽冲击》，确认“同基地其他己方 +1”与“两个额外行动”都能从真实打牌入口走通。
- 本轮实现：
  1. `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
     - 新增《彩虹女孩》真实入口 E2E；
     - 新增《怪兽冲击》真实入口 E2E；
     - 修正《怪兽冲击》用例末尾断言，改为校验《暗杀》正确附着，而不是误判为“即时消灭”。
- 本轮验证：
  1. `npx playwright test e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "彩虹女孩"`
     - 结果：`1 passed`
  2. `npx playwright test e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "怪兽冲击"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-world-champs-rainbow-kaiju-e2e-2026-04-28.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-rainbow-girl-before-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-rainbow-girl-resolved-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-kaiju-conflict-after-first-action-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-kaiju-conflict-third-action-resolved-2026-04-28.png`
- 结论：
  - 《彩虹女孩》当前已补齐“只给这里的其他己方随从 +1”浏览器级 L3 真实入口证据。
  - 《怪兽冲击》当前已补齐“打出后真实获得两个额外行动，并被实际消耗为后续两张行动”的浏览器级 L3 真实入口证据。
  - 《怪兽冲击》本轮没有暴露实现 bug；中途暴露的是**E2E 断言把《暗杀》误当成即时消灭**，不是数据录入问题。
  - 截至本轮，`World Champs` 已累计补到 `16` 条正路径对象级 L3 证据；但三新派系整包仍维持 **仍有残余范围**。

### 复核记录（2026-04-29 00:12）：World Champs《快如闪电 / 女主角 / 阿拉密斯》补证 + 旧误判失效回写

- 触发原因：
  - 用户对“《斯坦福》完全没触发、打出却触发别的效果、是不是审计维度不够全面”这条质疑是对的，当前必须继续往实现级边界深挖。
  - 本轮继续按“卡图优先 + 对象级真实入口 + 旧结论失效回写”推进，优先补《快如闪电》《女主角》《阿拉密斯》这条联合反应窗链路。
- 本轮实现：
  1. `src/games/smashup/domain/reactionQueueHandlers.ts`
  2. `e2e/src/games/smashup/domain/reactionQueueHandlers.ts`
     - 给 `smashup_reaction_choose` 增加 `keepSysUpdatesOnly(...)`，阻断已预先 reduce 过的 `core` 被系统层再次连同原事件 reduce。
  3. `src/games/smashup/domain/ongoingEffects.ts`
  4. `e2e/src/games/smashup/domain/ongoingEffects.ts`
     - 收窄《阿拉密斯》`onMinionAffected` 触发范围：只有“自己被标准行动影响”时才允许入队。
     - 收窄《女主角》同批次复制范围：只对原始受影响的“同基地其他己方随从”建立一次可选复制反应。
  5. `e2e/framework/GameTestContext.ts`
     - 加强“无基地前置、直接选随从”的行动牌 helper 稳定性；
     - `selectOption()` 优先直发 `SYS_INTERACTION_RESPOND`，避免和场上中文卡名撞点击。
  6. `src/games/smashup/__tests__/newFactionAbilities.test.ts`
     - 新增 3 条定向回归：
       - `world_champs_diva 应以可选反应形式复制标准行动效果，未选择前不会自动生效，且不受“你的回合”限制`
       - `world_champs_fast_as_lightning 打到阿拉密斯后应进入包含女主角与阿拉密斯的反应窗`
       - `world_champs_fast_as_lightning 依次选择女主角与阿拉密斯后应正确收口并保留额外行动`
  7. `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
     - 新增：`快如闪电打到阿拉密斯后应可选触发女主角复制并让阿拉密斯提供额外行动`
- 根因裁定：
  1. 《女主角》本轮确认不是配置错误，而是 **reaction handler 双 reduce**：
     - 旧审计只看 `events`，会以为复制只发了 `+2`；
     - 但 `finalState` 里会被二次 reduce 成 `+4`；
     - 因而旧“《女主角》实现正确”结论失效。
  2. 《阿拉密斯》本轮确认不是索引错位，而是 **trigger scope 错误**：
     - 《女主角》复制事件命中自己后，旧 `collectTriggers()` 仍会把《阿拉密斯》错误再入队；
     - 这和卡图/中文名/defId 没关系，是实现级过滤缺口。
  3. 当前这条链还顺手暴露了 **E2E helper 稳定性缺口**，否则“直接选随从”的真实入口并不稳。
- 本轮验证：
  1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "world_champs_diva 应以可选反应形式复制标准行动效果|world_champs_fast_as_lightning 打到阿拉密斯后应进入包含女主角与阿拉密斯的反应窗|world_champs_fast_as_lightning 依次选择女主角与阿拉密斯后应正确收口并保留额外行动"`
     - 结果：`3 passed`
  2. `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "快如闪电打到阿拉密斯后应可选触发女主角复制并让阿拉密斯提供额外行动"`
     - 结果：`1 passed`
- 新增证据文档：
  - `evidence/smashup/smashup-world-champs-diva-aramis-fast-as-lightning-e2e-2026-04-28.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-diva-aramis-reaction-prompt-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-diva-aramis-resolved-2026-04-28.png`
- 结论：
  - 《快如闪电》当前已补齐“打到阿拉密斯 -> 进入联合反应窗”的 L3 证据。
  - 《女主角》当前已补齐“可选复制标准行动，最终只得 `+2`”的 L3 证据。
  - 《阿拉密斯》当前已补齐“自己被标准行动影响后提供额外行动，并被真实消费”的 L3 证据。
  - 这次进一步证明：三新派系重审不能只看 `卡图 / locale / defId / 注册 / 单条 events`，还必须强制补 `finalState / triggerQueue / reaction session / 真实入口 E2E`。
  - 截至本轮，`World Champs` 已累计补到 `19` 条正路径对象级 L3 证据；但三新派系整包仍维持 **仍有残余范围**。
## 2026-04-29 补证（六）：《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》L3 与场景错误回写

- 本轮新增证据：
  - `evidence/smashup/smashup-mermaids-shipwreck-cove-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`
- 本轮命中的低级错误，不再保留旧口径：
  1. 《轮回者》旧 E2E 错把“自埋后立即无交互”当成真相；真实浏览器入口先进入 `smashup_reaction_choose`，再由《轮回者》收口。
  2. 《沉船湾》《墓碑》旧在线场景没有满足 `base_the_jungle (12)` 的计分阈值，导致“没进 afterScoring”其实是测试注入错误，不是实现错误。
- 本轮新增 L3 对象：
  - `mermaids_shipwreck_cove`
  - `skeletons_returned_one`
  - `skeletons_spooky_scary`
  - `skeletons_gravestones`
- 本轮浏览器级验证命令：
  1. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "轮回者打出后应可把自己埋葬到这里"`
  2. `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "沉船湾应在基地计分后可移到另一个基地"`
  3. `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "诡异。可怕。应从弃牌堆埋葬低力量随从并抽一张牌"`
  4. `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "墓碑应在基地计分后可把自己埋葬到另一个基地"`

## 2026-04-29 补证（七）：《守墓人 / 墓地爆发》L3，与旧错误结论失效回写

- 本轮新增证据：
  - `evidence/smashup/smashup-skeletons-gravetender-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-burst-forth-e2e-2026-04-29.md`
- 当前新增 L3 对象：
  - `skeletons_gravetender`
  - `skeletons_burst_forth`
- 已通过命令：
  1. `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "守墓人应在你的其他牌被埋葬后抽一张牌"`
  2. `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "墓地爆发应在基地计分前可挖掘你埋葬在那里的牌"`
  3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "skeletons_burst_forth special 可在指定基地挖掘埋葬牌|雄蜂：scoreBases 阶段（真实基地达临界点）交互解决后不应无限循环" --configLoader native --maxWorkers 1`
- 旧结论失效：
  - 旧“《墓地爆发》当前只是测试基础设施阻塞，业务实现没暴露问题”这条结论已失效。
  - 新证据表明，真实入口不仅能看到 prompt，而且《雷克斯王》已经作为 `MINION_PLAYED` 写进 action log，但同一轮 `BASE_SCORED` 仍按旧总力量 `13` 结算。
- 新确认的根因：
  1. 根因不是数据录入错误，也不是 E2E 场景再一次用错 `defId`。
  2. 根因是 `scoreBases` 阶段交互刚产出领域事件时，FlowSystem 会在这些事件正式 reduce 前继续自动推进，导致《墓地爆发》翻出的随从没有被纳入本次计分。
  3. 本轮已在 `src/games/smashup/domain/systems.ts` 与 `src/games/smashup/domain/index.ts` 增加 `scoreBases` 交互 reduce 门禁，先等这一轮事件落入 core，再继续计分。
- 当前结论：
  - 《守墓人》已补齐“你的其他牌被埋葬后抽 1 张”浏览器级 L3。
  - 《墓地爆发》已补齐“计分前反应 -> 挖掘埋葬牌 -> 翻出的随从改写本次 VP 归属”浏览器级 L3。
  - `Skeletons` 当前至少已有 `殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园 / 骸骨之王 / 轮回者 / 诡异。可怕。 / 墓碑 / 守墓人 / 墓地爆发` 共 `11` 条正路径对象级 L3 证据。
