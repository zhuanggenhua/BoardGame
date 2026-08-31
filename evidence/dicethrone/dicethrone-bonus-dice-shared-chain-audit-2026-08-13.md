# DiceThrone 奖励骰 / 临时骰共享链路收口证据（2026-08-14）

## 当前裁决

- 当前对象：DiceThrone 奖励骰 / 临时骰新增右侧普通“确认”按钮后的完整生命周期。
- 原始症状保真：奖励骰以前直接触发正常；新增确认按钮后，父攻击链、临时骰、展示型奖励骰和响应窗口之间出现混淆，表现为确认后去向不稳定、旧专用确认/旧中央特写口径残留、测试反复把旧设计写回。
- 设计结论：奖励骰 / 临时骰不是一条完全独立流程。带 `continuation.kind === 'attack'` 的奖励骰属于攻击父链暂停点；确认后必须恢复被挂起的父攻击骰盘并继续父链。只有明确 `complete` / 独立展示型分支，才保留 `settled + replayOnly` 只读回看。
- 明确禁止回退：不恢复旧 `BonusDieOverlay`、奖励骰专用确认按钮、自动结算、卡牌内嵌确认、背景点击结算或“恢复覆盖前骰区”按钮。

## 本轮改动

| 文件 | 改动 | 现实效果 |
| --- | --- | --- |
| `src/games/dicethrone/domain/reducer.ts` | `BONUS_DICE_SETTLED` 在当前奖励骰挂起父骰盘且 continuation 不是 `complete` 时恢复父骰盘；嵌套奖励骰仍恢复上一层奖励骰 settlement | 父链临时骰确认后回到攻击 / 防御等父流程，不再被当成最终只读展示 |
| `src/games/dicethrone/__tests__/roll-context.test.ts` | 三条旧“攻击型奖励骰确认后只读回看”断言改为父攻击恢复；保留 `complete` 分支只读回看保护 | 单测锁住父链临时骰、嵌套奖励骰、complete 展示型三类去向 |
| `e2e/dicethrone/bonus-dice-flow.ts` | 公共 helper 注释改为“确认入口统一，确认后去向由 continuation 决定” | 避免后续 E2E 再把所有奖励骰写成只读回看 |
| `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts` | 背景点击用例改为：背景点击不结算，普通确认才清 pending，并回到“结算攻击”等待；测试前置补真实主攻击骰上下文 | 覆盖新增普通确认按钮最关键的“不靠背景点击、不自动结算”合同 |
| `e2e/dicethrone/dicethrone-die-modification.e2e.ts` | 野蛮人临时奖励骰确认后断言恢复 5 颗主攻击骰 | 覆盖父链临时骰恢复主攻击骰，不切回合、不切对手 |
| `e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts` | 死亡盛放 II 改为攻击 continuation 口径：确认后攻击完成，pending 清空，当前骰区清理 | 覆盖攻击型 5 骰奖励骰重投上限与最终攻击收口 |
| `src/games/dicethrone/domain/systems.ts` | 系统注释改为“确认后展示由 continuation 决定” | 清除旧“临时骰确认后一律只读回看”的误导 |

## 验证命令

### 单测 / 类型 / 构建

- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\roll-context.test.ts --configLoader native --reporter verbose`
  - 结果：`1 passed / 38 tests passed`。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone --configLoader native --reporter dot`
  - 结果：退出码 `0`，DiceThrone 全量单测通过。输出中存在既有预期拒绝命令日志，不是失败。
- `npm run typecheck`
  - 结果：通过。
- `npm run build`
  - 结果：通过。仅有既有 CSS 优化、Browserslist 过期、动态导入与 chunk size 警告。
- `node --test scripts\infra\ensure-e2e-assets.test.mjs`
  - 结果：`3 passed`。

### E2E / 真实页面链

- `node scripts\infra\run-e2e-command.mjs isolated e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts --project=chromium --workers=1 --grep "bonus die right tray should ignore backdrop click"`
  - 结果：`1 passed`。
  - 覆盖：背景点击不结算奖励骰；只有右侧普通“确认”清掉 pending；确认后回到攻击结算等待。
- `node scripts\infra\run-e2e-single.mjs default e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "bonus die right tray should settle on ordinary confirm in display mode"`
  - 结果：`1 passed`。
  - 覆盖：右侧普通确认按钮可完成 Watch Out 奖励骰收口。
- `node scripts\infra\run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-modification.e2e.ts "野蛮人临时奖励骰确认后恢复主攻击骰，不切给僧侣或对手回合"`
  - 结果：`1 passed`。
  - 覆盖：临时奖励骰确认后恢复父主攻击骰 `[6,5,4,3,2]`，仍是 0 号玩家进攻回合。
- `node scripts\infra\run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-wild-west 应触发装填奖励骰，不改攻击骰盘"`
  - 结果：`1 passed`。
  - 覆盖：Wild West / Loaded 奖励骰不污染主攻击骰盘。
- `node scripts\infra\run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-modification.e2e.ts "战术家真实战争贩子奖励骰可用战术优势重投军刀，并在确认后才进入 5 点攻击结算"`
  - 结果：`1 passed`。
  - 覆盖：奖励骰可被战术优势重投，且必须普通确认后才进入攻击结算。
- `node scripts\infra\run-e2e-single.mjs default e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts "死亡盛放 II 应从真实槽位进入奖励骰界面，并在 2 次重投后达到上限"`
  - 结果：`1 passed`。
  - 覆盖：5 颗奖励骰进入右侧骰盘，2 次重投达到上限，普通确认后攻击完成，防守方 HP 变为 25，延迟毒 1 层，pending 与当前骰区清空。

## 同类扩审记录

- 旧口径扫描范围：`src\games\dicethrone`、`e2e\dicethrone`、`evidence\dicethrone`、`temp\dicethrone-bonus-dice-closeout-task.json`。
- 扫描目标：旧“父链攻击型临时骰不恢复父骰盘”、旧“野蛮人确认后只显示 1 颗奖励骰”、旧“只凭嵌套 settlement 才恢复父链”的实现条件。
- 当前结论：源码、单测、E2E、evidence 和任务状态文件中，旧正向口径已清除。
- 本轮没有做全英雄全奖励骰逐对象 E2E；覆盖等级是“共享 reducer + 代表 E2E + DiceThrone 全量单测 + type/build”。

## 漏审归因

- 表层触发：新增右侧普通确认按钮后，旧测试仍把“奖励骰确认后直接变成最终只读展示”当统一规则。
- 根本机制：临时奖励骰的显示职责和父攻击流程职责没有拆清。攻击型奖励骰应暂停父链，确认后回到父链；独立展示型奖励骰才保留只读回看。
- 旧测试为什么没挡住：旧断言把“背景点击关闭 / 旧中央特写 / 只读回看”混在一起，未同时检查 pending 是否清理、父链是否恢复、当前骰区身份、骰子数量和攻击结算按钮。
- 本轮补强：`roll-context` 单测锁三类去向；Watch Out E2E 锁“背景不结算、普通确认结算”；野蛮人 E2E 锁父链恢复；死亡盛放 II E2E 锁攻击完成后清理。

## 当前限制

- 本轮完成的是本地实现和本地门禁，不代表已部署生产环境。
- 本轮未回写线上反馈系统状态，也未做线上复测。
- 仓库存在大量无关脏改动；提交或发布前必须只选择本轮 DiceThrone 奖励骰 / 临时骰相关改动。

## 2026-08-30 全量奖励骰机制复核增补

### 范围与清单

本次复核以当前 `src/games/dicethrone` 为对象全集，覆盖三类生产入口：

| 类别 | 当前入口 / 对象 | 结算去向 |
| --- | --- | --- |
| 角色与卡牌专用奖励骰 | 工匠、野蛮人、神枪手、僧侣、月精灵、忍者、火法师、武士、暗影盗贼、炽天使、树精、吸血鬼领主、战术家、咒缚海盗 | 专用结算器、攻击加伤、直接伤害、状态、Token、资源或选择 |
| 通用效果奖励骰 | `rollDie`：僧侣、忍者、猎人、工匠、圣骑士、战术家、火法师、暗影盗贼、咒缚海盗等卡牌/技能 | `rollDieResolution` 在确认后按最终骰面结算，不在投掷事件时提前产生副作用 |
| 阶段 / 状态奖励骰 | 纳米爆弹、流血、火药桶、致盲判定、眩光判定 | 阶段推进或状态专用结算；流血伤害明确走直接伤害管线 |

专用结算器逐项核对了：工匠 3、野蛮人 4、神枪手 3、僧侣 3、月精灵 3、忍者 7、火法师 3、武士 3、暗影盗贼 3、炽天使 5、树精 6、吸血鬼领主 1、战术家 3，以及阶段/状态 3 个注册结算器。显式 `customResolutionId` 均能找到对应注册处理器；通用 `rollDie` 不依赖注册表，而由 `rollDieResolution` 统一消费。

### 树精刺藤组合结论

- 刺藤只在正常 `offensiveRoll` 退出时读取普通骰投掷次数：`max(rollCount - 1, 0)`，并限制最多 2 点自伤；战争贩子的额外进攻阶段明确排除。
- 奖励骰单独保存在 `pendingBonusDiceSettlement` / `currentRollContext.kind === 'bonus'`，不会增加 `rollCount`。
- 本次发现并修复奖励骰事件曾经把结果写入普通攻击的历史字段 `pendingAttack.extraRoll`。当前没有运行时消费者，但这是错误的跨语义状态污染；现已停止写入，历史字段仍保留用于旧状态兼容。
- 新增组合回归同时断言：普通骰 1 次时 HP 不因刺藤下降；普通骰 3 次时只下降 2 点；奖励骰不会改变 `rollCount`、不会覆盖已有普通额外骰状态，刺藤 Token 最终消费。

### 验证分层

| 层级 | 结果 | 能证明什么 |
| --- | --- | --- |
| DiceThrone 全量领域测试 | 历史记录曾通过；本轮重新运行 300 秒未结束 | 不能把历史通过结果当成本轮全量回归证据 |
| 树精新增组合回归 | 通过，29/29 | 刺藤与奖励骰并存时的普通骰次数、HP、Token 和状态边界 |
| 天使斗篷真实入口 E2E | 已通过既有 3 条 | 普通防御骰只投/确认一次，攻击与奖励骰承接不混淆 |
| 全奖励骰逐对象真实入口 E2E | 未完成 | 不能据此宣称每一个奖励骰对象都已单独通过六段真实页面链 |

### 2026-08-30 继续核验记录

- 重新运行奖励骰双页用例时，万箭齐发已走到奖励骰修改、总伤害更新和确认后日志校验阶段；此前失败现场停在最终行为日志证据步骤，页面可见奖励骰确认按钮和总伤害 7，未出现“伤害没有计算”的证据。已将行为日志证据改为当前视口截图，避免对超长滚动面板做整块元素截图；该改动尚未获得新的在线通过结果。
- 后续在线复跑被另一个 `betrayal` E2E 占用且处于 `active-unhealthy`：记录的前端、游戏服务和 API 服务均为 down。该环境阻塞只能证明本轮真实入口未完成，不能归因于 DiceThrone 规则实现。
- 本轮重新执行的定向奖励骰合同与树精 Token 测试为 `2 files / 40 tests passed`，`npx tsc --noEmit --pretty false` 通过，当前 evidence 自检通过。重新执行 DiceThrone 目录全量 Vitest 时在 300 秒内未结束，因此本轮不把“全量领域测试通过”作为新证据；此前历史记录中的全量通过结论不替代本轮复核。
- 当前审计等级保持：全量静态对象审查已完成，领域定向回归已通过，天使斗篷真实入口已有通过记录；全奖励骰逐对象真实入口 E2E 和本轮全量 Vitest 仍未收口。

### 本轮漏审归因

之前的奖励骰审计主要扫 `BONUS_DIE_ROLLED` 的展示描述和代表性流程，旧清单只记录了 16 个事件；当前源码实际扫描到 38 个直接事件构造点，还包括通用 `rollDie` 与阶段/状态奖励骰。旧测试大量停在“奖励骰已产生 / pending 已清除 / 交互按钮可见”，没有统一断言最终 HP、普通 `rollCount`、攻击/防御结算承接和状态消费，因此无法发现“普通骰与奖励骰写入同一攻击字段”以及树精组合缺口。本次已补共享状态隔离和刺藤最终 HP 回归；其余对象仍按上表标明为领域覆盖或代表入口覆盖，不外推为全对象真实 E2E 收口。
