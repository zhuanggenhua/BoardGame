# Feedback Open Writeback 2026-04-04

## 范围

- 对象：导出批次 `C:\Users\zhuagenbao\GameNotes\不烂\BoardGame反馈导出-2026-04-04T04-52-08-844Z` 中原始 `21` 条 `open` 反馈
- 目标：把已确认修复项回写为 `resolved`，把已确认非 bug / 建议项回写为 `closed`，避免继续堆在 `open`

## 实际写回方式

- 未使用网页域名上的开放反馈 API 直接回写。
- 原因：
  - 本地 `127.0.0.1:3000` 无服务
  - 本地 `127.0.0.1:18001` 虽可访问，但连接的是本地开发库，不是导出所对应的生产数据
  - `https://easyboardgame.top`、`https://api.easyboardgame.top/api` 返回的是 SPA fallback HTML，不是可直接回写的 JSON 接口
- 实际路径：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh boardgame`
  - 直接更新生产库中的 `feedbacks` 集合

## 本轮实际改动

### `open -> resolved`

- `69ce6242094b1acda250f790`
- `69cca762c3e278ba205eb08f`
- `69ce6ca7094b1acda250f831`
- `69ce7167094b1acda250f8a9`
- `69ce7589094b1acda250f8c6`
- `69ce7ac2094b1acda250f933`
- `69ce7bbf094b1acda250f93e`

### `open -> closed`

- `69cbecb1d5dec909a0b74ee9`
- `69ce6dcd094b1acda250f85b`
- `69ce7d74094b1acda250f97c`
- `69ce7fc3094b1acda250f9a3`

## 执行前已非 `open`

这些条目在本轮实际写回前，生产库里就已经被其他流程改过状态，因此本轮没有重复覆盖：

- `69c64529cb50687653b6fa85` `resolved`
- `69c64b20cb50687653b6faae` `resolved`
- `69c7e7bc32bd47a7b57a61fc` `resolved`
- `69c8f2f432bd47a7b57a66f8` `resolved`
- `69c93d9832bd47a7b57a6978` `resolved`

## 第一轮结果（历史记录）

- 这批原始 `21` 条导出时的 `open`，在 2026-04-04 本轮收口后，生产现态为：
  - `resolved: 12`
  - `closed: 4`
  - `open: 5`

## 第一轮结束时仍为 `open` 的条目（历史记录）

- `69ce62f3094b1acda250f7a5`
- `69c9436732bd47a7b57a6a10`
- `69cc8633c3e278ba205eb020`
- `69cca643c3e278ba205eb08d`
- `69ce7358094b1acda250f8ab`

## 第一轮结论（历史记录）

- 本轮已经把“可直接收口”的项真正写回到生产反馈库，不再停留在仓库内文档阶段。
- 上述 `5` 条已在下文“第二轮补证与写回”中继续完成收口，本段仅保留第一轮执行时的历史状态。

## 2026-04-04 第二轮补证与写回

### `open -> resolved`

- `69ce62f3094b1acda250f7a5`
  - 依据：
    - `src/games/cardia/domain/execute.ts` 已在平局时应用 `winTies`
    - `src/games/cardia/__tests__/flow-system-auto-advance.test.ts` 新增 `审判官赢得平局时，仍应跳过 ability 阶段并把平局改判为己方获胜`
  - 结论：实现存在且已补直接回归，反馈可判为已修复
- `69c9436732bd47a7b57a6a10`
  - 依据：
    - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 的 `关门放狗：预算应跨多次选择递减并支持连续消灭`
    - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 的 `关门放狗：预算允许时应支持第三次连续选择并消灭剩余目标`
    - 同文件的 `关门放狗：第一次消灭后应按剩余预算过滤目标`
  - 结论：这条“只能消灭两个，不能继续选择剩下的”现已由直接三段链式回归支撑
- `69cc8633c3e278ba205eb020`
  - 依据：
    - `evidence/ai-interaction-audit-2026-04-04.md`
    - 其中已覆盖在线 AI 私有视角、`isBlocked`、batch 提交、attemptKey 回退和真实 Smash Up 在线 E2E
  - 结论：该反馈描述与已修复的在线 AI 卡住链路一致，可按已修复收口

### `open -> closed`

- `69cca643c3e278ba205eb08d`
  - 依据：
    - 导出截图 `images/smashup/69cca643c3e278ba205eb08d/01-Screenshot.jpg`
    - `src/games/smashup/__tests__/smashup.smoke.test.ts` 的 `大衮在基地上只为你成组同名的随从提供力量`
  - 结论：截图和现有测试都说明加成已生效，更像对总战力显示的误读
- `69ce7358094b1acda250f8ab`
  - 依据：
    - 生产 `actionLog` 与状态快照显示两次弃牌、`Gunfighter tempPowerModifier: 4`
    - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 的 `cowboys_deputy 可在决斗中弃牌给任意随从 +2 力量并改变胜负`
    - `src/games/smashup/domain/duel.ts` 中 `Deputy` 每次固定加 `+2`
  - 结论：这是两次 `Deputy` 叠加，不是单张异常给了 `+4`

## 第二轮写回后结果

- 这批原始 `21` 条导出时的 `open`，在 2026-04-04 第二轮补证并写回后，生产现态为：
  - `resolved: 15`
  - `closed: 6`
  - `open: 0`

## 最终结论

- 本批次 `21` 条原始 `open` 反馈已全部完成线上真实收口。
- 两轮状态更新都不是走本地库，也不是走网页 fallback，而是通过生产机 `mongosh` 直连 `feedbacks` 集合完成真实回写。
