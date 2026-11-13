# 骰子王座：伤害响应被旧进攻骰重掷中断

- 线上反馈原文：`[system][player-command-failure] SKIP_TOKEN_RESPONSE pipeline_error`。同一对局重复 20 次，代表记录 `6af4356d24b60c04d6ba555c`。
- 原始现场：工匠的超频运行已进入伤害响应，武僧打出抬一手后，旧进攻骰重掷触发技能重选，清除了尚被续接帧引用的攻击；跳过响应时因此报 `攻击效果续接帧恢复时 pendingAttack 已变化`。
- 规则来源：`src/games/dicethrone/rule/王权骰铸规则.md` 第 3.3 节（宣告、干扰重选、启动依次进行）；`src/games/dicethrone/rule/圣骑士卡牌录入核对.md` index 17 记录抬一手牌面原文：“选择对手的1颗骰子，强制他重掷该骰子。”本轮另查看武僧图集 index 17 完整卡面，与牌名和效果一致。
- 实现：`src/games/dicethrone/domain/rules.ts` 在伤害响应期间阻止改骰牌操作旧进攻骰，保留其它当前骰区原有规则；`validateCommand` 和玩家可用性共同使用 `checkPlayCard`。
- 验证：在线私密回放的最近撤回状态（进攻阶段、超频运行待伤害、抬一手在响应者手牌）经 `executePipeline` 执行：出牌以 `rollContextLocked` 拒绝；从同一未污染状态跳过响应成功，进入 `main2`，待伤害及待攻击均清空。使用固定随机源，不声称重放了完整历史随机序列。
- 本地测试：`npx vitest run src/engine/transport/__tests__/feedbackReplayCommandHistory.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessCoordinator.test.ts src/games/dicethrone/__tests__/roll-context.test.ts src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts --maxWorkers=1`，72 项通过。
- 漏审：既有骰区测试覆盖奖励骰及独立出牌校验，但未覆盖攻击已启动、伤害响应仍处进攻阶段、改骰牌作用旧进攻骰的组合。现有规则合同和反馈回归门槛已经要求同一真实时机与消费链验证，本次补测试，不新增重复规范。
- 边界：本地修复及管线回放，不等于生产已部署；已受污染的旧对局未验证自动修复。
