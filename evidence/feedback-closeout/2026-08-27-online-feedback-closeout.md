# 2026-08-27 线上反馈收口

## 口径

- 真相源：线上反馈接口 `https://api.easyboardgame.top/admin-api/feedback`。
- 本地材料：`temp/feedback-closeout/2026-08-27T00-08-47-online-current/summary.json` 和同目录诊断包只作镜像与证据。
- 初始统计：2026-08-27 00:08:49 CST 抓取 `open=0`、`in_progress=5`，归并为 5 个代表项。

## 反馈 6a8ea42103143df8b7954df8：Dice Throne 配置页 0CP 升级牌

- 原始症状：玩家在 Dice Throne 配置页看到“卡牌描述是 0 CP 就能升级”。
- 命中对象：工匠的 0CP “电弧盾”，它是受击响应窗口使用的响应型升级牌，不是主阶段免费升级。
- 处理结论：页面展示容易误导，按真实用途改成“响应型升级牌”。
- 改动：
  - `src/games/dicethrone/config/configReviewAdapter.ts` 识别“有待结算伤害条件、没有 replaceAbility 的升级牌”。
  - `src/pages/diceThroneConfigReviewDisplay.ts` 和 `src/pages/DiceThroneConfigReview.tsx` 将此类牌显示为“响应型升级牌”。
  - `public/locales/zh-CN/game-dicethrone.json`、`public/locales/en/game-dicethrone.json` 补充中英文显示值。
  - `src/games/dicethrone/__tests__/configReviewAdapter.test.ts`、`src/pages/__tests__/DiceThroneConfigReview.display.test.ts` 补回归。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/configReviewAdapter.test.ts src/pages/__tests__/DiceThroneConfigReview.display.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：2 个测试文件通过，9 个测试通过。
- 回写建议：`resolved`。
- 回写文案：配置页已把工匠 0CP “电弧盾”显示为“响应型升级牌”。它只能在受击响应窗口打出，不是主阶段免费技能升级。

## 反馈 6a8edff003143df8b7955038：机器人实验室

- 原始症状：玩家反馈“机器人实验室这张牌（基地）没有触发额外加战力的效果。”
- 规则事实：机器人实验室的效果是“这里的角色获得力量标记后，抽 1 张牌”，不是额外加战力。
- 诊断证据：反馈日志里多次出现角色获得力量标记后，紧跟“耳东老师 抽1张牌”；力量增加来自其它牌的效果。
- 处理结论：规则效果已触发，玩家把“获得力量标记”和“机器人实验室额外加战力”混在一起理解。
- 改动：无需改代码。
- 回写建议：`closed`。
- 回写文案：这张基地的规则效果是“这里的角色获得力量标记后，抽 1 张牌”，不是额外加战力。反馈局日志里，角色获得力量标记后已经触发抽牌；看到的力量增加来自其它牌的效果。

## 反馈 6a8ee2d003143df8b7955059：Cy-Bug 灾变

- 原始症状：玩家反馈“赛博虫灾害这张牌效果没有触发。”
- 命中对象：Smash Up《无敌破坏王》派系的 `Cy-Bug 灾变`。
- 根本机制：旧实现只销毁这张持续战术自身，没有执行“每名玩家把该基地自己的随从和基地修正牌移到其它基地，最后销毁并替换原基地”的后续流程。
- 改动：
  - `src/games/smashup/abilities/wreck_it_ralph.ts` 增加逐玩家选择其它基地、移动各自卡牌、销毁并替换原基地的多步流程。
  - `src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts` 补多玩家移动、销毁/替换基地回归。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：1 个测试文件通过，33 个测试通过。
- 回写建议：`resolved`。
- 回写文案：已修复 Cy-Bug 灾变。现在它会让每名在原基地有牌的玩家依次选择其它基地，移动自己在原基地的随从和基地修正牌，最后销毁并替换原基地。

## 反馈 6a8ef31c03143df8b79550d9：选派系阶段 AI 无合法动作

- 原始症状：系统自动反馈显示选派系阶段恢复失败，当前 AI 没有合法动作。
- 玩家可见影响：房间卡在选派系阶段，自动玩家不能继续选派系。
- 状态证据：诊断包显示阶段是 `factionSelect`，1 号位是当前行动玩家，但 1 号位已选满 `frankenstein,avengers`，2 号位也已选满 `werewolves,spider_verse_pod`，0 号位还没选；AI 合法动作数量为 0。
- 根本机制：蛇形选秀计算下一位玩家时，用已选数量直接取草稿顺序中的一个座位，但没有确认该座位是否已经选满。这个残态下它把选择权留给已选满的 1 号位，导致 AI 枚举不到任何合法选派系动作。
- 改动：
  - `src/games/smashup/domain/pregameDraft.ts` 在蛇形/直线选秀里从当前草稿位置继续向后找，跳过已选满玩家，直到找到未选满玩家。
  - `src/games/smashup/ui/normalizeRuntimeState.ts` 对已经持久化的旧残态做一次性归一化：若当前玩家已选满但仍有人未选满，重载时把选择权修回未选满玩家。
  - `src/games/smashup/__tests__/factionSelection.test.ts` 增加线上残态回归：算法返回 0 号位，重载后 0 号位可合法选派系，AI 能枚举 `select-faction`。
- 红测：
  - 修复前新增用例失败：期望下一位是 0，实际返回 1；重载后仍停在 1。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/factionSelection.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：1 个测试文件通过，51 个测试通过。
  - `npx eslint src/games/smashup/domain/pregameDraft.ts src/games/smashup/ui/normalizeRuntimeState.ts src/games/smashup/__tests__/factionSelection.test.ts`
  - 结果：通过。
- 回写建议：`resolved`。
- 回写文案：已修复选派系阶段的卡住问题。旧逻辑可能把选择权交给已经选满两个派系的 AI，导致它没有任何合法动作；现在会跳过已选满玩家，并把旧残留房间修回仍未选满的玩家继续选择。

## 反馈 6a8ef31d03143df8b79550e1：同局同根自动恢复噪音

- 原始症状：系统自动反馈显示同一选派系卡住场景重复恢复被抑制。
- 处理结论：与 `6a8ef31c03143df8b79550d9` 同一局、同一状态、同一根本机制；它是恢复链重复尝试后的后续噪音，不是第二个独立缺陷。
- 验证：跟随上一条选派系阶段 AI 无合法动作修复与测试。
- 回写建议：`resolved`。
- 回写文案：这条和上一条是同一局同一原因的后续提示。选派系阶段已能把选择权交回仍未选满的玩家，AI 不会再因为已选满座位而没有合法动作。

## 本轮验证汇总

- Dice Throne 配置页：2 个测试文件通过，9 个测试通过。
- Smash Up Cy-Bug 灾变：1 个测试文件通过，33 个测试通过。
- Smash Up 选派系 AI 卡死：1 个测试文件通过，51 个测试通过；相关文件 eslint 通过。

## 状态回写与最终回查

- 状态回写入口：5 条反馈均通过生产 Mongo `boardgame.feedbacks` 回写，脚本返回 `writer=mongo-ssh`、`writerReason=missing-token-production-mongo`。
- 最终状态：
  - `6a8ea42103143df8b7954df8` -> `resolved`
  - `6a8edff003143df8b7955038` -> `closed`
  - `6a8ee2d003143df8b7955059` -> `resolved`
  - `6a8ef31c03143df8b79550d9` -> `resolved`
  - `6a8ef31d03143df8b79550e1` -> `resolved`
- 线上回查：`node .spec\skills\feedback-closeout\scripts\triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 8 --out-dir temp\feedback-closeout\2026-08-27T00-58-00-online-final-recheck`
- 回查结果：2026-08-27 00:58:05 CST，线上 `open=0`、`in_progress=0`。
- 本地镜像校验：`node scripts\verify\verify-feedback-status.mjs temp\feedback-closeout\status-board.json`，结果 `feedback-status: ok`。
