# 哥布林 / 圆桌骑士实现证据

目标状态：active
当前目标：按 Smash Up Fandom / POD / FAQ 口径完成哥布林与圆桌骑士派系实现，并移除 `new_*` 命名。
非当前历史背景：旧 `newRoundTableGoblinsIntake.test.ts` 已由无 `new` 命名的 intake 测试替代。
禁止自动接管：本文只记录本轮哥布林 / 圆桌骑士实现，不代表其他派系或历史任务。
更新时间：2026-08-03

## 规则来源

- 在线条目：Smash Up Fandom 的 Goblins、Knights of the Round Table、Smash Up: Oops, You Did It Again / POD 页面。
- 本地快照：
  - `temp/smashup-goblins-round-table-wiki/goblins.wikitext`
  - `temp/smashup-goblins-round-table-wiki/knights_of_the_round_table.wikitext`
  - `temp/smashup-goblins-round-table-wiki/smash_up_pod.wikitext`
  - `temp/smashup-goblins-round-table-wiki/bases_faq_big_boxes_packs_and_promos.wikitext`
  - `temp/smashup-goblins-round-table-wiki/bases_faq_oops_you_did_it_again.wikitext`

## 实现覆盖

### 哥布林

- 随从 / 行动 / 基地能力实现落点：`src/games/smashup/abilities/goblins.ts`
- 覆盖能力：
  - 混沌领主：硬币后正面给己方随从 +1，反面抽 1 弃 1。
  - 占卜师：每回合第一次己方硬币抽 1；可弃牌把明确偏好的硬币结果改为目标结果。
  - 哥布林招募员：硬币正面抽 1，反面将弃牌堆牌洗回牌库。
  - 自己制造好运：接入硬币改结果流程，并从手牌作为额外行动打出。
  - 谁放的屁：连续正面放 +1，首次自然反面给额外行动并停止。
  - 一点帮助、爆破手、伏击、爆破、加足马力、“魔法”头盔、哥布林洞穴、哥布林镇。
- 最新补充：
  - 伏击反面移动支持 `targetBaseIndex` 指定目的地。
  - 爆破正面优先给 `targetMinionUid` 指定己方随从 +1；反面可按 `targetBaseIndex` 指定基地上的行动牌目标范围。
  - “魔法”头盔测试改走 `beforeScoring` 触发器入口，而不是错误当成手动 special。

### 圆桌骑士

- 随从 / 行动 / 基地能力实现落点：`src/games/smashup/abilities/round_table_knights.ts`
- 覆盖能力：
  - 亚瑟王、加拉哈德、加文、格尼薇儿、兰斯洛特、梅林、帕西瓦尔。
  - 踏上征途、圣剑、善行、梅林藏书馆、高贵坐骑、渔夫王、圣杯、绿衣骑士、湖中女神、阿瓦隆迷雾、追踪野兽。
  - 卡美洛与圆桌会议基地能力。
- 最新补充：
  - `USE_TALENT`、`ACTIVATE_SPECIAL`、`USE_BASE_ABILITY` 目标参数透传到执行/校验上下文。
  - 亚瑟王、帕西瓦尔、梅林藏书馆、格尼薇儿、高贵坐骑、加拉哈德 special 等按玩家指定目标移动/转移。
  - 梅林和湖中女神抽到/取回行动后，发放 `playTiming: immediate` 且限定 `restrictToCardUid` 的立即额外行动机会。
  - 善行、梅林藏书馆、追踪野兽按自身 `cardUid` 定位同基地行动牌，避免同基地多张己方行动牌时错拿第一张。
  - 卡美洛主动能力支持指定己方随从与目的基地；无效目标不再悄悄回退默认目标。

## 命名收口

- 已移除旧 `new_*` 派系 / 卡牌 / 基地命名残留。
- 已删除旧重复测试：`src/games/smashup/__tests__/newRoundTableGoblinsIntake.test.ts`
- 已保留并扩展无 `new` 命名测试：
  - `src/games/smashup/__tests__/roundTableKnightsGoblinsIntake.test.ts`
  - `src/games/smashup/__tests__/abilities/goblins.test.ts`
  - `src/games/smashup/__tests__/abilities/round-table-knights.test.ts`

## 验证

- 命名扫描：
  - `rg -n "new_goblins|new_round_table_knights|NEW_GOBLINS|NEW_ROUND_TABLE_KNIGHTS|base_goblin_village|base_arthurs_court|Goblin Village|Arthur's Court" src/games/smashup public/locales public/assets/i18n -S`
  - 结果：无输出。
- Locale JSON：
  - `node -e "JSON.parse(require('fs').readFileSync('public/locales/en/game-smashup.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/zh-CN/game-smashup.json','utf8')); console.log('locale json ok')"`
  - 结果：`locale json ok`
- 定向测试：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/roundTableKnightsGoblinsIntake.test.ts src/games/smashup/__tests__/abilities/goblins.test.ts src/games/smashup/__tests__/abilities/round-table-knights.test.ts --configLoader native`
  - 结果：3 个测试文件通过，29 条测试通过。
- 类型检查：
  - `npm run typecheck`
  - 结果：通过。

## 说明

- 这轮实现按当前大杀四方引擎既有风格处理“可选择 / may”效果：能通过现有命令字段表达的目标选择已透传；部分多目标/多牌选择在没有现成交互 prompt 的场景下采用确定性默认目标。
- 本证据不包含提交或 push；当前只是实现与本地验证完成。
