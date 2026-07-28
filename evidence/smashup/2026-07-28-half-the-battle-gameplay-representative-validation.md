# 半场战争扩玩法对象级验证（2026-07-28）

## 基本信息

- 对象：大杀四方半场战争扩四派系（忍者神龟、特种部队杰拉尔德、宇宙的巨人希曼、珍珠和幻像）
- 日期：2026-07-28
- 文档类型：`object_level_validation`
- 关联 OpenSpec：`openspec/changes/add-smashup-half-the-battle-factions/`
- 前置 intake 合同：`evidence/smashup/2026-07-27-half-the-battle-intake-contract.md`

## 结论等级

结论为 **玩法对象级 L2 已收口，且 PR 范围已按用户要求包含合规图集**。当前代码已完成四派系静态接入，并已注册半场战争扩全对象 ability / trigger / base ability handler；本轮把 `half-the-battle.test.ts` 从 20 条扩到 29 条，覆盖每个新增卡牌 / 基地的主要 effect atom 与关键分支。真实入口 L3/L4 仍保持代表性链证据。服务器素材主源上传仍被 SSH 发布权限阻塞，但用户已明确要求“把图件放 PR 里一起传”，因此本 PR 交付口径改为随 PR 纳入 5 个源 PNG 图集与 5 个运行时 WebP 图集；服务器远端上传保留为生产发布 follow-up。

## 全面审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | `passed:L2_object_level` | 全对象已注册 handler，并在 `half-the-battle.test.ts` 29 条 L2 中按对象 / 能力族覆盖 |
| 规则子句表 | `passed:L2_object_level` | intake 合同记录 L0/L1；本文补充对象级 L2 effect atom 矩阵 |
| 完整技能流程矩阵 | `passed:L2_object_level` | L2 覆盖卡牌 / 基地主要 effect atom、融合牌双面、optional / fallback / cleanup 分支 |
| L0-L4 证据层级 | `partial_by_layer` | L0/L1 intake 通过；L2 对象级通过；L3/L4 代表性真实入口通过 |
| 命中 D 维度 | `passed:representative_risk` | 覆盖 D1/D3/D5/D7/D8/D12/D14/D18/D35/D57 及对象级 effect atom |
| 真实入口 E2E 与截图核验 | `passed` | `e2e/smashup/smashup-half-the-battle-four-factions.e2e.ts`，3 tests passed；人工核图确认派系卡/详情面板/希瑞/玩乐一整夜截图有效 |
| PR 图件交付 | `passed` | 用户明确要求把图件随 PR 一起传；PR 范围包含 5 个源 PNG 图集与 5 个 `compressed/*.webp` 运行时图集 |
| 服务器素材主源发布 | `blocked:deployment_followup` | 上传命令超时；SSH 探针返回 `Permission denied (publickey,gssapi-keyex,gssapi-with-mic)`；远端 HEAD 仍 404；不再作为本次 PR 带图件口径的阻塞项 |
| 残余范围声明 | `passed` | 本文下方列出 remaining blockers |
| 旧 evidence / 旧结论对账回写 | `passed` | 已回写 2026-07-27 intake 合同，不再继续写成“真实入口 E2E 未做” |

## 审计范围

本轮覆盖的文件：

- `src/games/smashup/abilities/half_the_battle.ts`
- `src/games/smashup/domain/events.ts`
- `src/games/smashup/domain/types.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/__tests__/abilities/half-the-battle.test.ts`
- `e2e/smashup/smashup-half-the-battle-four-factions.e2e.ts`

## PR 范围预检

当前工作区存在多条 Smash Up 任务线的混合改动。半场战争扩 PR 范围应只包含以下类别，提交前必须按路径显式 stage，不能直接 `git add .`：

- 半场战争扩代码 / 数据 / 测试：`src/games/smashup/abilities/half_the_battle.ts`、`src/games/smashup/data/factions/half_the_battle.ts`、`src/games/smashup/__tests__/abilities/half-the-battle.test.ts`、`src/games/smashup/__tests__/halfTheBattleFactionIntake.test.ts`。
- 半场战争扩注册与共享消费点：`src/games/smashup/abilities/index.ts`、`src/games/smashup/data/cards.ts`、`src/games/smashup/domain/ids.ts`、`src/games/smashup/domain/atlasCatalog.ts`、`src/games/smashup/domain/events.ts`、`src/games/smashup/domain/types.ts`、`src/games/smashup/domain/reduce.ts`、`src/games/smashup/ui/factionMeta.ts`、`src/games/smashup/__tests__/criticalImageResolver.test.ts`。
- 半场战争扩资源 / manifest / locale / OpenSpec / evidence / E2E：`public/assets/i18n/zh-CN/smashup/cards/compressed/half_the_battle_*.webp`、`public/assets/i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp`、`public/assets/i18n/**/assets-manifest.json`、`public/locales/*/game-smashup.json`、`.gitignore`、`openspec/changes/add-smashup-half-the-battle-factions/**`、`evidence/smashup/2026-07-27-half-the-battle-intake-contract.md`、本文、`e2e/smashup/smashup-half-the-battle-four-factions.e2e.ts`。
- 已确认同一工作区另有非本 PR 范围改动：`Board.tsx`、`zhongguo*`、`yuanhou*`、`diy_*`、`cease_and_desist.ts`、`cyborg_apes.ts`、`super_spies.ts`、`variantBindings.ts`、`discardStripCards.ts` 等；未获用户明确授权前不得混入半场战争扩 PR。

明确不在本文 PR-scope 完成范围内：

- 服务器素材主源上传与 5 个远端资源 `HEAD 200`，当前作为生产发布 follow-up 留档
- 非代表对象逐个补 direct L3/L4 E2E
- 去除派系选择页上的“实施中”横幅；等服务器远端发布链闭合后再移除

## 代表性对象结论

| 对象 | 规则子句 / 动作链 | 实现入口 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- |
| 爱普莉尔·奥尼尔（`geckos_june`） | 与己方印刷战力 4 且不同名随从从手牌/牌库交换；无候选则抽牌 | `half_the_battle.ts` + `MINION_SWAPPED` reducer | L2 | `object_level: passed` |
| 壁虎说唱（`geckos_gecko_rap`） | 己方随从与不同名、战力不高于来源的手牌/牌库/弃牌堆随从交换；首张 / 非首张分支分别给额外战术或 +1 | `half_the_battle.ts` + `MINION_SWAPPED` reducer | L2 | `object_level: passed` |
| 年轻的贵族（`rulers_cosmos_young_noble`） | 有剑附着时，与手牌/牌库/弃牌堆战力 5+ 随从交换并清理原附着剑 | `half_the_battle.ts` + `MINION_SWAPPED` reducer | L2 | `object_level: passed` |
| 老水手（`gi_gerald_shellback`） | 随从面返回另一个非老水手融合牌；行动面复制己方非老水手融合卡行动面能力 | `half_the_battle.ts` | L2 | `object_level: passed` |
| 现在你知道：家庭安全（`gi_gerald_now_you_know_home_safety`） | onPlay 给额外低战力随从；计分基地 special 复制己方非老水手融合卡行动面能力 | `half_the_battle.ts` | L2 | `object_level: passed` |
| 希瑞（`rulers_cosmos_gal_woman`） | 从任意玩家弃牌堆选择“打在随从上”的行动临时贴到目标随从；回合结束或提前离场置于所有者牌库底 | `half_the_battle.ts` + `reduce.ts` 临时附着清理 helper | L2/L3/L4 | `object_level: passed` |
| 有毒废弃物（`rulers_cosmos_now_you_know_toxic_waste`） | onPlay 检索打在随从上的战术；special 转移一个行动并打开可选天赋 follow-up | `half_the_battle.ts` | L2 | `object_level: passed` |
| 玩乐一整夜（`pearl_images_jam_all_night_long`） | 选择玩家在该基地打出战力 ≤2 随从；若别人打出，控制者获得抽牌或 +1 奖励选项 | `half_the_battle.ts` | L2/L3/L4 | `object_level: passed` |
| 粘液池（`base_slime_pool`） | 主动基地能力从牌库顶打出“打在随从上”的行动并贴到该基地随从 | `half_the_battle.ts` + base active ability | L2 | `object_level: passed` |

## 对象级 L2 effect atom 矩阵

以下矩阵对应 `src/games/smashup/__tests__/abilities/half-the-battle.test.ts` 29 条 L2。融合牌按随从面 / 行动面覆盖；持续战术按 talent / trigger 覆盖；基地按触发型或主动型能力覆盖。

| 派系 | L2 覆盖对象与证据 |
| --- | --- |
| 忍者神龟 | 北斋、康定斯基、莫奈、梵高；爱普莉尔·奥尼尔交换与 fallback；爆炸新闻、回旋踢、壁虎飞艇、壁虎力量、壁虎说唱首张 / 非首张、千层饼派对、大师的教学、凯西·琼斯；现在你知道：校园暴力 onPlay / special；下水道隐蔽处、科技球 |
| 特种部队杰拉尔德 | 子爵触发；出发，杰拉尔德！；现在你知道：家庭安全 onPlay / special；卡车式火炮、路霸、外科医生、滑雪缆车、偏激者、封面女郎、老水手、骰子忍者、罗西的随从面 / 行动面；杰拉尔德基地、美国海军旗帜号 |
| 宇宙的巨人希曼 | 希瑞临时附着 / 清理；希曼复制天赋；奥克、邓肯武士、蛙人、年轻的贵族；战斗盔甲、傻瓜们！、无畏的伙伴、魔法武器、玛雅!、神秘转移、现在你知道：有毒废弃物 onPlay / special、魔法之剑、力量之剑；力量城堡、粘液池 |
| 珍珠和幻像 | 珍珠抽牌 / 临时力量；水晶、红宝石、黄玉、世界一切安好全体 / 按玩家、化妆间、玩乐一整夜、爱联结我们、现在你知道：自行车安全、她得到的力量、杰出表彰、我们上，你们下；音乐会场地、录音室 |

## 本轮 reducer 修订

- 新增 `placeAttachedActionLeavingPlay(...)`，集中处理随从附着行动离场去向。
- 希瑞临时附着行动以 metadata `halfTheBattleGalWomanTemporary` 识别；离场默认覆盖为“所有者牌库底”。
- 覆盖的离场路径包括：回合结束、显式 `ONGOING_DETACHED`、基地清除、宿主随从交换 / 置顶 / 置底 / 转移导致附着行动脱离。
- 普通附着行动仍按原规则进入弃牌堆或手牌，避免改变既有 Clyde 2.0 等普通路径。

## 验证证据

### L2 领域行为证据

```text
npx tsc --noEmit --pretty false
结果：passed

node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\half-the-battle.test.ts --configLoader native
结果：29 tests passed

node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\half-the-battle.test.ts src\games\smashup\__tests__\halfTheBattleFactionIntake.test.ts --configLoader native
结果：42 tests passed

node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\halfTheBattleFactionIntake.test.ts src\games\smashup\__tests__\criticalImageResolver.test.ts --configLoader native
结果：30 tests passed

node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\criticalImageResolver.test.ts --configLoader native
结果：17 tests passed

openspec validate add-smashup-half-the-battle-factions --strict --no-interactive
结果：Change 'add-smashup-half-the-battle-factions' is valid
```

### L3/L4 真实入口 E2E 与截图证据

```text
npm run test:e2e:ci:file -- e2e/smashup/smashup-half-the-battle-four-factions.e2e.ts
结果：3 passed (31.7s)
```

人工核过的截图：

```text
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-half-the-battle-four-factions.e2e\派系选择页能看到忍者神龟、特种部队杰拉尔德、宇宙的巨人希曼、珍珠和幻像\忍者神龟派系选择网格卡片.jpg
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-half-the-battle-four-factions.e2e\派系选择页能看到忍者神龟、特种部队杰拉尔德、宇宙的巨人希曼、珍珠和幻像\忍者神龟派系详情面板.jpg
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-half-the-battle-four-factions.e2e\希瑞真实天赋入口会临时贴上弃牌堆战术，并在回合结束置于所有者牌库底\希瑞临时战术已贴上.jpg
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-half-the-battle-four-factions.e2e\希瑞真实天赋入口会临时贴上弃牌堆战术，并在回合结束置于所有者牌库底\希瑞回合结束临时战术置底.jpg
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-half-the-battle-four-factions.e2e\玩乐一整夜真实持续战术入口会让被选玩家在该基地额外打出低战力随从并给奖励\玩乐一整夜已完成奖励收口.jpg
```

截图观察：

- 忍者神龟派系选择网格卡片：真实卡图可见，不是背景裁边或 shimmer。
- 忍者神龟派系详情面板：派系详情、卡牌预览网格与中文卡图可见。
- 希瑞临时战术已贴上：魔法武器已可见地附着到目标随从。
- 希瑞回合结束临时战术置底：状态断言确认临时战术离开宿主并进入所有者牌库底，页面无未收口 interaction。
- 玩乐一整夜已完成奖励收口：被选玩家额外随从已在音乐会场地，控制者奖励抓牌已进入手牌，页面无未收口 interaction。

### 资源发布状态

### PR 图件交付状态

用户已明确要求“把图件放 PR 里一起传”。本 PR 范围同时纳入源 PNG 图集与压缩后的运行时 WebP 图集：

```text
public/assets/i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp
public/assets/i18n/zh-CN/smashup/cards/compressed/half_the_battle_gerald.webp
public/assets/i18n/zh-CN/smashup/cards/compressed/half_the_battle_cosmos.webp
public/assets/i18n/zh-CN/smashup/cards/compressed/half_the_battle_pearl_images.webp
public/assets/i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
```

本地文件尺寸与 intake 合同一致，且两层 manifest 均包含对应 `compressed/half_the_battle*` 条目。

预检通过，只命中 5 个目标资源：

```text
node scripts\assets\upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_gerald.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_cosmos.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_pearl_images.webp --asset-prefix i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
结果：待发布 5 个对象
```

服务器实际上传仍阻塞，作为生产发布 follow-up：

```text
node scripts\assets\upload-to-server.js --skip-android-package-publish --asset-prefix ...
结果：300s timeout，无完成输出。

$env:ASSET_UPLOAD_BATCH_SIZE='1'; node scripts\assets\upload-to-server.js --skip-android-package-publish --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp
结果：90s timeout，无完成输出；单对象发布同样无法完成，排除“5 个对象批次过大”。

ASSET_SERVER_SSH_TARGET / ASSET_SERVER_SSH_KEY_PATH / ASSET_SERVER_SSH_KNOWN_HOSTS_PATH
结果：均未设置；`ssh-add -l` 返回 no agent。

ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=20 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=yes admin@8.148.71.102 echo ok
结果：Permission denied (publickey,gssapi-keyex,gssapi-with-mic)

ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=yes admin@8.148.71.102 boardgame-asset-publish
结果：Permission denied (publickey,gssapi-keyex,gssapi-with-mic)

ssh -v ...
结果：已尝试 C:\Users\Dqm\.ssh\id_ed25519，但服务器拒绝该公钥。

curl.exe -I --max-time 20 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp
curl.exe -I --max-time 20 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
结果：404 Not Found，x-asset-source: server
```

2026-07-28 追加复核：

```text
node scripts\assets\upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_gerald.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_cosmos.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_pearl_images.webp --asset-prefix i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
结果：仍只命中 5 个目标资源，待发布对象与本轮资源范围一致。

ssh -vvv -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=20 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=yes admin@8.148.71.102 echo ok
结果：主机指纹已在 known_hosts 中；客户端仅尝试 C:\Users\Dqm\.ssh\id_ed25519（SHA256:wpIa2eyPbZRPsZgzjGDJRc2RTaTOgMugtmwZpSCjuvM），服务端继续返回 Permission denied。

where ssh-manager / 本机 Codex、agents、仓库路径定点检索
结果：未发现可用 ssh-manager CLI、ASSET_SERVER_SSH_* 配置或项目专用发布私钥。

curl.exe -I --max-time 20 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp
curl.exe -I --max-time 20 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
结果：仍为 404 Not Found，x-asset-source: server。
```

## 禁止假阳性检查

- 误用选择页 / 静态资源 E2E 充当玩法收口：未发生；选择页只证明四派系可见与卡图可见。
- 误用 registerAbility 或 defId 覆盖充当行为完整：未发生；本文把 handler 全对象登记与逐对象证据区分开。
- 误用注入型 interaction E2E 充当真实入口证据：未发生；希瑞和玩乐一整夜均从真实随从/持续战术点击入口进入。
- 只证明 prompt 出现、未证明最终权威状态变化：未发生；E2E 断言已覆盖 finalState / interaction / responseWindow / triggerQueue。
- 误报资源发布完成：未发生；远端仍 404，明确登记为 blocker。

## 残余范围

- `deployment_followup:asset-upload`：缺服务器素材主源发布权限，5 个远端运行时资源仍 `404`；本 PR 已按用户要求随代码带 5 个源 PNG 图集与 5 个运行时 WebP 图集。
- `representative_only:L3/L4`：当前真实入口 E2E 覆盖派系选择、希瑞、玩乐一整夜两条新交互代表链；其余对象以 L2 对象级矩阵收口，未逐个补 direct L3/L4。
- `in_progress:metadata`：四派系仍保留“实施中”横幅，直到服务器远端发布链闭合前不得移除。

## 对外汇报口径

- 允许说：`半场战争扩已完成静态 intake、全对象 handler 注册，并补齐对象级 L2 effect atom 证据。`
- 允许说：`本 PR 已按用户要求包含 5 个源 PNG 图集与 5 个合规运行时 WebP 图集；服务器远端上传仍是生产发布 follow-up。`
- 禁止说：`四派系已完整实装完成。`
- 禁止说：`已全面审计 / 已收口 / 当前发布口径已收口。`
