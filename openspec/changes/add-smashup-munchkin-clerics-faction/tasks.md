## 1. Proposal and intake handoff

- [x] 1.1 Review and approve this change before runtime implementation
- [x] 1.2 Confirm牧师 12 张卡牌、2 个基地、静态数据、atlas 与双语 locale 已存在
- [x] 1.3 Confirm牧师规则原文与 C1-C6 子句已记录在 `evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md`

## 2. Cleric minions

- [x] 2.1 Implement 红衣主教：弃牌堆至少 5 张后手动发动并随机回收 2 张
- [x] 2.2 Implement 资深修士：计分后手动选择另一个己方仆从和目标基地，移动替代清场
- [x] 2.3 Implement 特纳：手动选择摧毁这里的亡灵怪物，或回收弃牌堆随机仆从
- [x] 2.4 Implement 圣临者：可选手动确认，随机回收弃牌堆随机 1 张牌
- [x] 2.5 Add minion ability tags, registration and L2 behavior tests

## 3. Cleric actions

- [x] 3.1 Implement 垃圾处理的基地持续与计分后跨基地替代清场
- [x] 3.2 Implement 光盘的弃牌堆随机回收 2 张
- [x] 3.3 Implement 监禁诅咒的附着能力压制与移除恢复
- [x] 3.4 Implement 无用诅咒的基地力量合计排除与移除恢复
- [x] 3.5 Implement 好习惯与加入团队的回合临时力量修正和清理
- [x] 3.6 Implement 解除诅咒的附着行动选择与摧毁
- [x] 3.7 Implement 回忆祷词的跨玩家弃牌堆随机行动展示、额外行动打出与原归属保留
- [x] 3.8 Add action tags, registration and L2 behavior tests

## 4. Cleric bases

- [x] 4.1 Implement 圣洁酒店的计分后按拥有者将仆从放牌库顶，支持手动顺序
- [x] 4.2 Implement 抓鬼的不死怪物入基地后放怪物牌库底
- [x] 4.3 Add base registration and L2 behavior tests

## 5. Real entry and audit

- [x] 5.1 Add at least one direct real-entry E2E for the new牧师 interaction type
- [x] 5.2 Verify every required choice remains manual, including single-candidate paths
- [x] 5.3 Run targeted Vitest, E2E and ESLint checks
- [x] 5.4 AI-audit final screenshots and record absolute paths
- [x] 5.5 Update the evidence object matrix with only the actually covered L2/L3/L4 scope
- [x] 5.6 Run `openspec validate add-smashup-munchkin-clerics-faction --strict --no-interactive`
