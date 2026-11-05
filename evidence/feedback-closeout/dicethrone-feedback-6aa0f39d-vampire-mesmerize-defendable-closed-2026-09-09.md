# Dice Throne 线上反馈修复证据（2026-09-09）

## 本轮口径

- 反馈 ID：`6aa0f39d61ba00ac3b647d21`
- 处理口径：线上真实反馈
- 初始读取时间：北京时间 2026-09-09 13:58:45
- 诊断包：`temp/feedback-closeout/2026-09-09T05-58-41-376Z/6aa0f39d61ba00ac3b647d21.md`
- 图面复核裁图：`temp/feedback-closeout/2026-09-09-dicethrone-vampire-image-recheck/mesmerize-vs-upgrade-contact.png`
- 图面复核 SHA256：`c37284b1f6d62b248b474e41b36b5d59bfd5a99e6256025aa5cc9034b0d0a069`
- 真实写回入口：无管理 token，使用生产 Mongo SSH 写入口

## 反馈原文

```text
吸血鬼刚刚选的是不可防御伤害
```

## 效果描述原文

本轮重新打开吸血鬼领主玩家板和升级牌对照图后，确认旧生产文案和旧录入合同不是真相源，图面原文如下：

- 基础 `魅惑之力`：`获得 1 CP。获得催眠。造成 4 不可防御伤害。`
- `魅惑之力 II`：`获得 1 CP。获得催眠。造成 5 不可防御伤害。`

## 当前现场

- 操作记录显示玩家发动的是基础 `魅惑之力`，随后 AI 进入防御阶段并发动 `厚皮`。
- 状态快照显示吸血鬼领主当时 `abilityLevels.mesmerize-power = 1`，`upgradeCardByAbilityId = {}`；`魅惑之力 II / 摄魂术` 升级牌仍在牌堆中，没有成为当前技能。
- 事件流中 `ATTACK_INITIATED` 的 `sourceAbilityId = "mesmerize-power"`，`isDefendable = true`。
- 伤害事件为 `sourceAbilityId = "mesmerize-power"`、基础伤害 4、实际扣血 0；实际扣血为 0 是因为防御阶段 `厚皮` 给出防御结果并抵消了伤害。

## 对照结论

- 玩家反馈“吸血鬼刚刚选的是不可防御伤害”正确。
- 旧录入合同、旧中英文文案和旧实现都把基础 `魅惑之力` 录成“只获得催眠、造成 4 点可防御伤害”，漏掉了 `获得 1 CP` 和 `不可防御伤害`。
- 旧实现因此让基础 `魅惑之力` 进入防御阶段，导致对手通过 `厚皮` 抵消伤害；这与图面规则冲突。
- 本条结论是规则录入和实现消费链同时错误，按真实规则 bug 修复，不应关闭为误报。

## 修复范围

- 更新吸血鬼领主能力定义：基础 `魅惑之力` 现在获得 1 CP、获得 1 个催眠，并造成 4 点不可防御伤害；`魅惑之力 II` 上区现在获得 1 CP、获得 1 个催眠，并造成 5 点不可防御伤害。
- 同步中文和英文运行文案，去掉旧的“基础可防御 / II 级闪避”错误语义。
- 同步吸血鬼领主真相源表、录入核对表和卡牌录入核对表，记录本次图面复核路径和 hash。
- 补充领域回归测试：基础 `魅惑之力` 会发起不可防御攻击，不再进入防御阶段；基础和 II 级共享技能断言 CP、催眠和不可防御伤害。

## 验证

```text
npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
结果：1 passed，26 passed

npm run i18n:check
结果：i18n-check: no missing keys detected. legacy warning baseline: 1

npm run spec:lint
结果：spec-lint: OK
```

## 状态回写

- 北京时间 2026-09-09 18:58 左右，通过生产 Mongo SSH 写回 `resolved`，`matchedCount=1`，`modifiedCount=1`。
- 线上回读字段显示 `status=resolved`、`closedReason=null`，`resolvedMethod` 已写入面向提交者的说明。
- 本地状态镜像显示 `status=resolved`、`lastFetchedStatus=resolved`，旧误关 `closedReason` 已清空。

## 漏审复盘 / 规范回代判断

- 这不是规范缺失，而是已有规范未执行：`feedback-closeout` 已要求规则 / 效果类反馈给出反馈原文、效果描述原文、当前现场和对照结论；带图反馈必须先核图；录入冲突不能用旧实现、旧测试、旧文案互相证明正确。
- `data-entry.md` 已要求清晰图片优先于旧实现、旧测试、旧 evidence 和旧 i18n，且未打开主真相源图片不能裁定“不是录入错误”。
- `rule-contract-audit.md` 已要求合同与用户反馈冲突时回图面或规则源复核，复核后先更新合同，再改实现。
- 前次误关的直接问题是执行失守：把旧生产文案和旧录入合同当成真相源，没有重新打开吸血鬼领主牌图核对。
- 本轮无需新增通用规范；已把本次纠偏写入本 evidence 和吸血鬼领主单游戏合同，下次同类规则 / 录入冲突应直接按现有 `feedback-closeout -> data-entry-workflow -> rule-bug-fix-workflow` 入口执行。
