# 蜘蛛侠派系录入、实现与审计证据

更新时间：2026-09-19 17:22
对象：Dice Throne `zhizhuxia` / 蜘蛛侠
当前状态：`in_progress`

## 结论与范围

本轮已完成蜘蛛侠本地素材录入、运行时绑定、核心派系规则实现、真实入口选角 / 牌桌 / 手牌升级验收，以及本地资源和规则合同审计。没有把“能选角、卡图能显示”扩写成完整发布结论。

派系冲突裁决保持为：以蜘蛛侠派系效果为主；共享流程只负责合法时机、响应窗口、伤害来源和结算顺序。落网只消费“技能区产生的普通攻击”，手牌、Token、状态和系统直接伤害不消费落网。

## 批次审计矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 evidence | 真实入口 E2E | 当前说明 |
|---|---|---|---|---|---|---|
| `zhizhuxia` | `passed` | `passed` | `passed` | `passed` | `passed` | 16 个正式资源已发布并完成代表 URL `200` 回查；落网来源分流、蜘蛛感应、飞荡脱身、隐形和额外防御投骰均已完成定向合同与真实浏览器交互验证 |

## 素材与图集合同

- 正式手牌图：`public/assets/i18n/zh-CN/dicethrone/images/zhizhuxia/ability-cards.png`
- 正式压缩手牌图：`public/assets/i18n/zh-CN/dicethrone/images/zhizhuxia/compressed/ability-cards.webp`
- 卡图尺寸：`3420 × 7722`
- 物理布局：5 列 × 7 行，末行 3 张，共 33 张
- 公共卡：图集索引 `0–17`
- 蜘蛛侠专属卡：图集索引 `18–32`
- 运行时 atlas 配置：`src/assets/atlas-configs/dicethrone/ability-cards-zhizhuxia.atlas.json`
- 公共目录配置：`public/assets/atlas-configs/dicethrone/ability-cards-zhizhuxia.atlas.json`
- 运行时注册：`src/games/dicethrone/ui/cardAtlas.ts`
- 角色卡定义：`src/games/dicethrone/heroes/zhizhuxia/cards.ts`
- 骰子运行时资源：`public/assets/i18n/zh-CN/dicethrone/images/zhizhuxia/compressed/dice.webp`
- 状态图集：`status-icons-atlas.png`、`status-icons-atlas.json` 及压缩资源

本轮实际修正过的资源链问题是：只放入 `public/assets` 的 atlas 配置不会被 Vite 的源码 import 解析；因此补入 `src/assets/atlas-configs/...`，并由真实 E2E 验证手牌图片节点已加载且尺寸大于占位阈值。

### 资源发布与公网回查

- 预检：`node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/dicethrone/images/zhizhuxia` 命中 16 个待发布对象。
- HTTP 上传入口先返回 `status=524`；按项目正式管理员应急回退，仅对蜘蛛侠前缀启用一次性 SSH `boardgame-asset-publish`。
- 发布结果：`serverPrimaryRelease=20260919085754737`，`serverPrimaryObjects=16`，服务器报告 Dice Throne 安卓素材包自动刷新。
- 代表性公开 URL 均回查 `200`：`ability-cards.webp`、`player-board.webp`、`dice.webp`、`tip.webp`、`status-icons-atlas.webp`、`status-icons-atlas.json`。
- 远端状态图集 JSON 与本地一致，包含 `combo`、`webbed`、`invisible` 三个 128×128 frame。

## 卡牌覆盖

- 总卡数：33
- 蜘蛛侠专属卡：15
- 公共卡：18
- 升级卡：`heavy-punch`、`combo-strike`、`trap`、`venom-punch`
- 专属卡索引：4 张升级卡 `18–21`，11 张行动卡 `22–32`
- 中英文文案：`public/locales/zh-CN/game-dicethrone.json`、`public/locales/en/game-dicethrone.json`

## 规则覆盖

### 升级技能

- 重拳 II：3 / 4 / 5 个拳造成 5 / 6 / 7 点伤害；四同数字获得连击。
- 连连连击 II：2 个蛛网 + 2 个蜘蛛造成 6 点伤害并获得连击。
- 诱捕 II：小顺子造成 6 点伤害并落网；大顺子抽 1 张、造成 9 点伤害并落网。
- 毒液重拳 II：4 个蜘蛛获得隐形并造成 8 点不可防御伤害。

### 落网来源分流

- 施加落网的即时伤害：`damageOrigin: status`、`damageScope: direct`、不可防御。
- 下一次技能区普通攻击：在防御前由 `src/games/dicethrone/domain/attack.ts` 识别并消费落网。
- 手牌、Token、状态和系统直接伤害：保留各自来源，不触发普通攻击消费。
- 来源字段：`src/games/dicethrone/domain/core-types.ts`、`effects.ts`、`events.ts`。
- 手牌来源传递：`src/games/dicethrone/domain/executeCards.ts`。
- Token / 状态来源传递：`src/games/dicethrone/domain/executeTokens.ts`、`tokenResponse.ts`。

### 蜘蛛感应与隐形

- 蜘蛛感应成功面：蜘蛛；飞荡脱身可把蛛网追加为成功面。
- 蜘蛛感应的执行时机已修正为 `withDamage`，由共享防御解析器在防御骰确认后、伤害落地前消费。
- 隐形只在不可防御伤害的“受到伤害前”窗口使用，成功后该段伤害完全失效并消费 1 个隐形。
- 选择蜘蛛感应后，防御投掷阶段可通过消耗隐形增加 1 次防御投骰。

## 运行时消费点

- 技能、骰面、Token、专属卡和公共卡绑定：`src/games/dicethrone/heroes/zhizhuxia/`
- 蜘蛛侠自定义动作：`src/games/dicethrone/domain/customActions/zhizhuxia.ts`
- 落网来源分流与消费：`src/games/dicethrone/domain/attack.ts`
- 伤害来源模型：`src/games/dicethrone/domain/core-types.ts`、`effects.ts`、`events.ts`
- 防御额外投骰门控：`src/games/dicethrone/domain/activeRollTokens.ts`
- 玩家板槽位映射：`src/games/dicethrone/ui/abilitySlotMapping.ts`

## 真实入口与截图证据

标准命令：

```text
node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/zhizhuxia-intake.e2e.ts
```

结果：`2 passed`，本轮运行耗时约 `23.9s`。

规则交互命令：

```text
node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/zhizhuxia-interactions.e2e.ts
```

结果：`7 passed`。

截图组：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-intake.e2e\真实在线双玩家应完成蜘蛛侠选角并看到完整玩家板\01-蜘蛛侠选角-实施中状态.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-intake.e2e\真实在线双玩家应完成蜘蛛侠选角并看到完整玩家板\02-蜘蛛侠牌桌-玩家板与手牌.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-intake.e2e\正式蜘蛛侠卡图槽位可见，升级牌可从真实手牌入口打出\03-蜘蛛侠正式专属卡图槽位.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-intake.e2e\正式蜘蛛侠卡图槽位可见，升级牌可从真实手牌入口打出\04-蜘蛛侠重拳二级升级后.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\落网应在技能区普通攻击进入防御前被消费\01-落网-普通攻击前.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\落网应在技能区普通攻击进入防御前被消费\02-落网-普通攻击前被消费.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\手牌来源直接伤害不消费落网\03-手牌来源伤害-落网保留.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\手牌来源直接伤害不消费落网\04-手牌来源伤害-不消费落网.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\Token-来源反伤不消费落网，并保留-token-直接伤害来源\05-Token来源伤害-落网保留.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\Token-来源反伤不消费落网，并保留-token-直接伤害来源\06-Token来源伤害-不消费落网.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\蜘蛛感应投出蜘蛛后，技能区攻击伤害减半并向上取整\07-蜘蛛感应-投出蜘蛛前.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\蜘蛛感应投出蜘蛛后，技能区攻击伤害减半并向上取整\08-蜘蛛感应-伤害减半结算.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\飞荡脱身使蛛网可作为蜘蛛感应成功面\09-飞荡脱身-蛛网骰面.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\飞荡脱身使蛛网可作为蜘蛛感应成功面\10-飞荡脱身-蛛网视为成功面并减伤.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\隐形在不可防御伤害窗口使本次伤害完全失效\11-隐形-不可防御伤害响应窗口.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\隐形在不可防御伤害窗口使本次伤害完全失效\12-隐形-伤害完全失效.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\蜘蛛感应防御掷骰中消耗隐形后增加一次防御投骰\13-隐形-防御投骰中可用.jpg`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhizhuxia-interactions.e2e\蜘蛛感应防御掷骰中消耗隐形后增加一次防御投骰\14-隐形-增加一次防御投骰.jpg`

### 本轮截图视觉审计

verdict: `PASS`（仅针对本轮截图目标）
score: `92/100`

target_requirements:

- 真实入口可选蜘蛛侠并呈现角色板：`PASS`；选角截图和 DOM 状态均命中蜘蛛侠与实施中标记。
- 牌桌同屏显示玩家板、提示卡、骰盘、资源、阶段栏和手牌区域：`PASS`；未见破图、空白占位或角色板加载失败。
- 正式手牌 atlas 槽位与升级后牌面可见：`PASS`；E2E 校验图集索引 `18/19/25/26/27`、图片已完成加载，升级后 `heavy-punch` 等级为 2。

hard_failures: `[]`

negative_impact_checks:

- 玩家板、提示卡、骰盘、手牌、生命 / CP 和阶段栏均保留在同一牌桌截图中。
- 手牌扇形重叠属于现有手牌表现，不遮挡本轮升级动作的正式牌面；升级截图中牌面实际可读。
- 当前截图没有覆盖落网结算、防御响应和蜘蛛感应触发态，因此这些交互不从本组视觉 PASS 外推完成。

### 规则交互证据

- `PASS`：真实浏览器运行时从 `offensiveRoll` 选择 `heavy-punch-3`，再推进阶段；目标原有 1 层落网被移除，本次攻击直接收口到 `main2`，事件流包含 `PENDING_ATTACK_UPDATED` 和 `STATUS_REMOVED`。
- `PASS`：真实浏览器运行时验证手牌直接伤害保留落网、Token 直接伤害保留落网，并保留 `damageOrigin` / `damageScope` 的来源证据。
- `PASS`：真实浏览器运行时验证蜘蛛感应投出蜘蛛后技能区攻击伤害减半并向上取整；事件最终伤害为 2，攻击正常收口。
- `PASS`：真实浏览器运行时验证飞荡脱身把蛛网追加为蜘蛛感应成功面，并在防御结算后按减半结果收口。
- `PASS`：真实浏览器运行时验证隐形在不可防御伤害的受伤前窗口完全抵消该段伤害并消费 1 个隐形。
- `PASS`：真实浏览器运行时验证蜘蛛感应防御掷骰中消耗隐形后，防御投掷次数上限增加 1，仍停留在防御阶段。

### 测试语义对账与旧测试失效检查

- 测试语义对账：`zhizhuxia-intake.test.ts` 覆盖角色、骰子、卡牌、Token、状态和 atlas 合同；`ability-effect-timing-contract.test.ts` 覆盖防御技能必须由共享防御解析器消费，并断言蜘蛛感应使用 `withDamage`。
- 测试断言：定向合同测试断言 17 个测试用例全部通过；真实规则交互 E2E 断言 7/7 通过，覆盖技能区攻击、手牌 / Token 直接伤害来源、蜘蛛感应、飞荡脱身、隐形和额外防御投骰。
- 负向断言：手牌和 Token 来源不会消费落网；直接伤害与技能区攻击的来源字段保持分离，未发现共享伤害来源被蜘蛛侠专属逻辑误消费。
- 旧测试失效检查：本轮发现旧的蜘蛛感应 `preDefense` 时机断言与共享防御解析器实际消费点不一致；已修正实现和合同测试，剩余全量失败未归因到蜘蛛侠改动。

### 同类扩审与搜索范围

- 搜索范围：横向搜索 Dice Throne 的落网 / 状态伤害来源、`damageOrigin`、`damageScope`、`withDamage` 防御消费点、Token 响应和真实 E2E 入口；重点覆盖 `attack.ts`、`executeCards.ts`、`executeTokens.ts`、`tokenResponse.ts`、`activeRollTokens.ts` 及对应测试。
- 同类扩审：对技能区攻击、手牌伤害、Token / 状态直接伤害和系统直接伤害分别核对来源分流；命中项为技能区攻击消费落网，手牌 / Token / 状态 / 系统来源保留落网，未发现共享来源字段被蜘蛛侠专属逻辑误消费的证据。
- 漏审归因：此前证据停在中间态，只证明了技能区消费和领域来源合同，测试断言过窄，未覆盖手牌 / Token 的真实玩家入口；不是把未执行的对照场景误判为规则已经完成。
- 残余扩审：本轮蜘蛛侠规则交互对象已逐项完成；未扩展到其它派系的规则修复。

## 验证结果

已通过：

- `npx vitest run src/games/dicethrone/__tests__/zhizhuxia-intake.test.ts --configLoader native`：12/12
- `npx vitest run src/games/dicethrone/__tests__/dice-assets-contract.test.ts --configLoader native`：1/1
- `npx vitest run src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts --configLoader native`：4/4
- `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/zhizhuxia-intake.e2e.ts`：2/2
- `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/zhizhuxia-interactions.e2e.ts`：7/7
- 本轮 `zhizhuxia-intake.e2e.ts` 重跑因同工作区已有七大恨 E2E 长任务占用共享运行时，被 `heavy-task-guard` 排队后主动停止；上一轮同一工作区真实入口证据仍为 2/2，且本轮未修改 intake 逻辑或素材。
- `node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/dicethrone/images/zhizhuxia`：16 个对象发布完成，发布批次 `20260919085754737`
- 代表性 `assets.easyboardgame.top` URL：6/6 返回 `200`
- `npm run typecheck`
- `npm run spec:lint`
- `npm run assets:validate`
- `npm run audit:evidence:selfcheck`
- `npm run verify:dicethrone:style-contract`
- `git diff --check`：退出码 0

### 全量 Dice Throne 单测

最近一次全量命令结果：`13 failed | 133 passed` 个测试文件；`34 failed | 2398 passed | 1 skipped` 个测试，共 2433 个测试。

其中蜘蛛侠命中的 `ability-effect-timing-contract` 两条失败已由本轮把蜘蛛感应从 `preDefense` 改为 `withDamage` 修正，并用定向合同测试复核通过。剩余失败集中在战术家 / 咒缚海盗、炽天使、圣骑士、正义战法、共享 Token 响应、实体链和吸血鬼领主等既有链路；当前没有证据表明这些失败由蜘蛛侠改动引起，因此不把它们伪装成蜘蛛侠通过，也不在本轮扩大修复范围。

## 未收口范围

1. 全量 Dice Throne 套件仍有 34 个失败测试；现有证据未显示这些失败由蜘蛛侠改动引起，本轮不扩大修复范围。
2. 角色仍保留 `implementation_in_progress`；需要用户当轮明确批准完成态后，才能从选角隐藏 / 实施中状态进入完成态。
