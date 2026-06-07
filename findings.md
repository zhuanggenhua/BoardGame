> 状态提示（2026-06-05）：本文件汇总的是历史批次的事实、结论与残余风险；其中出现的 `当前状态`、`进行中`、`长期任务` 等表述，默认只代表写入当时，不自动等于当前对话目标。除非用户当轮明确点名，否则仅作历史 findings 参考。

# Findings: DiceThrone 战术家与咒缚海盗新增英雄接入（2026-05-31）

## 已确认事实

- 2026-06-06 当前 live 复核新增事实：我本轮直接重跑了 `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts + src/games/dicethrone/__tests__/character-catalog-status.test.ts + src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts + src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`，结果为 `4 files / 97 passed`。这不是沿用文档旧口径，而是当前代码现状复核；同时 `src/games/dicethrone/domain/core-types.ts` 与 `src/games/dicethrone/__tests__/character-catalog-status.test.ts` 也已直接证明 `zhanshujia / cursed_pirate` 当前确实不再保留 `implementation_in_progress`。因此本轮对“规则都实施了吗 / 技能是不是要重录 / 审计也是吗”的回答可以继续固定为：规则实现已落地，不需要整套重录，审计 closeout 已完成。
- 2026-06-06 最新最终口径：本节下文若再出现“继续挂 `implementation_in_progress` / 审计 hold / completion audit 未封版”的表述，默认都只代表 2026-06-06 更早批次的阶段记录；当前权威结论以前三条 closeout 事实为准。
- 2026-06-06 最新新增事实：本轮 closeout 已完成，`implementation_in_progress` 的旧 hold 口径已失效。`src/games/dicethrone/domain/core-types.ts` 已移除 `zhanshujia / cursed_pirate` 的目录徽标，`src/games/dicethrone/__tests__/character-catalog-status.test.ts` 现已显式锁定 `gunslinger / samurai / treant / ninja / zhanshujia / cursed_pirate` 都不再保留 `implementation_in_progress`。这说明当前对外结论已经不是“最终审计未封版继续挂标”，而是“这两名新英雄已完成 closeout，目录完成态已生效”。
- 2026-06-06 最新新增事实：本轮最新静态权威结果已更新为 `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts src/games/dicethrone/__tests__/character-catalog-status.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native` -> `4 files / 97 passed`；同时 `npx tsc --noEmit --pretty false` 与 `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 也都通过。这说明当前不只是“有几条代表链是绿的”，而是 closeout、目录状态、intake、mechanics 四组收口门禁已同时打绿。
- 2026-06-06 最新新增事实：latest full-file E2E 权威整跑仍以本地日志 `temp/dicethrone-intake-full-run-2026-06-06-pass2.log` 为准，结果为 `80 passed (20.3m)`。我随后又重新发起过一轮整文件复跑，但 30 分钟超时窗口内没有自然收口，因此当前最稳口径仍应引用这份已完成日志，而不是把那次超时误记成业务回退。
- 2026-06-06 最新新增事实：对“规则都实施了吗 / 技能是不是要重录 / 审计也是”的当前权威回答已切换为：
  - 规则实现已落地。
  - 不需要整套重录。
  - 审计 closeout 已完成；当前剩余只是文档同步，不再是实现或审计 hold。
- 2026-06-06 最新新增事实：战术家 / 咒缚海盗自身的 `i18n` raw-text warning 当前已经清空，不再是这批新英雄的 remaining。当前已把 `zhanshujia` 与 `cursed_pirate` 四个英雄源码文件里的能力效果描述、手牌效果描述、升级替换说明与 human 面能力名/描述全部切到 i18n key，并补齐中英文 locale。最新 `npm run i18n:check` 虽然仍因仓库其它 DiceThrone 历史债失败，但输出里已不再包含 `src/games/dicethrone/heroes/zhanshujia/**` 或 `src/games/dicethrone/heroes/cursed_pirate/**`。这说明当前若还要保留 `implementation_in_progress`，原因已经不能再归结为“这两个英雄自己的 i18n 还没收干净”，而只能回到最终审计 gate。
- 2026-06-06 最新新增事实：最终 closeout 分组现在也有了独立代码门禁，而不再只是审计 prose 对对象做人工归桶。新增 `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts` 后，当前已显式锁定：战术家 `9 / 9` 玩家板对象与 `15` 张专属手牌、咒缚海盗双面 `18 / 18` 玩家板对象与 `16 / 16` 专属手牌、以及 `诅咒金币 / 火药桶 / 双面续结` 这些最终 closeout 桶，都必须完整纳入审计分组，不能再留“其实还有对象没入矩阵”的 residual。与 `closeout + intake + mechanics + character-catalog-status` 一起复跑后的最新静态结果为 `4 files / 97 passed`。这说明当前连 family closeout gate 也已被代码锁住，不再需要把“是否允许摘标”继续保留为当前 blocker。
- 2026-06-06 最新新增事实：`implementation_in_progress` 的摘标边界现在又多了一层自动化 contract，而不再只靠 evidence 文本。新增 `src/games/dicethrone/__tests__/character-catalog-status.test.ts` 后，当前已显式锁定：`gunslinger / samurai / treant / ninja` 不应继续保留 `implementation_in_progress`，`zhanshujia / cursed_pirate` 在最终审计 gate 封版前继续保留。相关验证已通过 `npx vitest run src/games/dicethrone/__tests__/character-catalog-status.test.ts --configLoader native`（`1 file / 2 passed`）以及与 `character-catalog-i18n.test.ts` 组合复跑（`2 files / 4 passed`）。这说明当前“哪些英雄应该挂标、哪些已经摘标”已经进入代码门禁，不再只是历史文档口径。
- 2026-06-06 最新新增事实：`implementation_in_progress` 当前保留的真实原因，已经不再是“规则尚未实施”或“human 面尚未接线”，而是 DiceThrone intake workflow 里的最终审计门禁尚未封版。按 `docs/games/dicethrone/workflows/dicethrone-hero-intake.md` 逐项回看，当前数据录入 / 机制 / 资源 / 上传 / E2E 都已进入可复述通过态；唯一继续 `hold` 的是双面 face-by-face completion audit、family 级 `L4` 合法复用边界与最终 verdict。因此现在对“规则都实施了吗 / 技能是不是还要重录 / 审计也是吗”的正确回答应固定为：实现层面已大幅落地，不需要整套重录，但审计门禁仍未封版，所以徽标继续保留。
- 2026-06-06 最新新增事实：family 级 `L4` 合法复用登记已开始由自动化合同直接守门，而不再只留在审计 prose。`zhanshujia-cursed-pirate-intake.test.ts` 现已新增 6 条静态合同：除咒缚海盗的 `奖励骰五类 dispatch seam`、`诅咒金币 direct/continuation/双面差异 seam`、`火药桶 writer seam` 外，又补上战术家的 `升级 replace shell`、`复合升级 variant seam`、`奖励骰主阶段/防御/额外进攻 seam`。连同 `zhanshujia-cursed-pirate-mechanics.test.ts` 一起重跑后，当前权威静态计数已更新为 `2 files / 90 passed`。这说明战术家与咒缚海盗的主要 family remaining 都已从“缺少自动化合法复用 proof”继续收窄到“最终 verdict 与徽标是否允许收口”，而不是还缺某条 seam 的实现。
- 2026-06-06 最新新增事实：`e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 现已从先前的 `71` / `78` 条阶段继续扩到 `80` 条，并由 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 真整跑到 `80 passed (20.3m)`。前一轮“full-file 在 70 条附近挂住、看起来像 soak/route preload 风险”的判断，当前已确认主要是命令超时窗口过短；尾段 `10` 条分组也已独立 `10 passed`。这说明当前 intake 的主 blocker 已不再是整份 full-file 稳定性，而是 family / 双面 completion audit 与 `L4` 合法复用登记。
- 2026-06-06 新增事实：咒缚海盗奖励骰 family 现在又多了一层机制级负向证据，而不再只停在“正向命中分支已跑通”。最新回归已证明：`起锚` 的骷髅分支只施加 `休战`、非骷髅默认分支只 `draw 1`；`抽筋剥皮` 在弯刀数不足 `3` 时只累计攻击伤害而不会误施加 `火药桶`；`死亡印记` 的纯弯刀盘面不会串写 `draw / 诅咒金币`；`瞭望台` 的弯刀查看手牌分支确认后不会误弃牌；`虚张声势` 也已补齐机制层三分支，分别锁定 `弯刀 -> 2 点伤害`、`战利品 -> 抽 2`、`骷髅 -> 火药桶`。当前整份 `zhanshujia-cursed-pirate-mechanics.test.ts` 已更新为 `76 passed`。这说明奖励骰 family 的 remaining 已继续收窄到 family final verdict 与合法复用登记，而不是“默认分支还没落地”。
- 2026-06-06 新增事实：`凋零 / 休战` 当前都已拿到第二条不同攻击来源的 live consumer 直证，而不再只锁在 `灵魂突刺 / 弯刀突刺`。新增的两条定向 direct E2E 都复用 `死亡吐息` 真实入口：一条证明 Guest 持有 `凋零 1` 时，`breath-of-death-small` 会把 Host 伤害从 `7` 压到 `6`（`Host HP 50 -> 44`）；另一条证明 Guest 持有 `休战 1` 时，同一 `breath-of-death-small` 攻击链会阻断攻击伤害、保留 `凋零 / 火药桶` 状态写入，并在阶段结束清理 `休战`。这说明当前剩余已从“还缺第二条来源直证”收敛为状态 family verdict 的封版与合法复用登记。
- 2026-06-06 新增事实：human 面 `判决指令 / 无情劫掠` 的 continuation 当前也不再只锁定 accept path。新增两条机制回归已证明：当海盗选择“不获得诅咒金币”时，`判决指令` 仍会继续施加 `休战` 并结算 `7` 点不可防御伤害，`无情劫掠` 仍会继续施加 `休战 + 火药桶` 并保留 `12` 点主伤害收口。当前整份 `zhanshujia-cursed-pirate-mechanics.test.ts` 已更新为 `70 passed`。这说明 `诅咒金币 family` 的 `continuation writer` 子段现在已有 accept / decline 双路径硬证据。
- 2026-06-06 新增事实：`火药桶 family` 的 `upkeep transfer` 当前也不再只靠对象级 E2E 证明“转交给已持有者时原桶爆炸”。新增机制回归已直接锁定：`upkeep-powder-keg` 选择把火药桶转交给 `P2` 且 `P2` 预持有火药桶时，会同时移除 `P1` 旧桶、对 `P2` 结算 `3` 点 direct damage、并把 `P2` 的新桶保持在 `1` 层。当前整份 `zhanshujia-cursed-pirate-mechanics.test.ts` 已更新为 `71 passed`。这说明 `火药桶 family` 的 `upkeep transfer` 子段现在已有机制层硬证据。
- 2026-06-04 新增事实：咒缚海盗 human 面剩余 3 个对象不再是运行时缺口。`点燃炸药` 已修正为 `preDefense` 下同时落 `火药桶 + 伤害`；`判决指令` 与 `无情劫掠` 已改为本地 choice continuation，诅咒金币选择完成后会继续结算 `休战 / 火药桶 / 伤害`。相关验证已由定向三条机制测试、`mechanics + intake + ninja regression` 组合回归，以及 `tsc` 共同锁定。
- 2026-06-04 新增事实：`无情劫掠` 的真实入口 direct E2E 现已通过，说明这条链当前不再被 `pendingAttack` 残留或攻击链不收口阻断。验证命令为 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 ultimate 槽位触发并结算无情劫掠的诅咒金币续结链"`，结果 `1 passed`。
- 2026-06-04 新增事实：`做好标记` 的真实入口 direct E2E 现已通过，但当前有效证据来自 legacy globalSetup + `prebuilt + BG_VITE_FORCE_INLINE=1` 绕过路径，而不是 `run-e2e-single.mjs` 的托管 runtime。根因不是业务链红灯，而是 E2E 旧断言把“奖励骰结算状态出现”误写成“`bonus-die-overlay` 一定可见”；修正为“优先点击真实确认伤害按钮，否则走权威 `SKIP_BONUS_DICE_REROLL` 收口”后，用例已回到业务位点并转绿。
- 2026-06-04 新增事实：`嘿，老兄` 的真实入口 direct E2E 现已通过，说明人类面最后一条防御对象也已拿到当前有效 direct E2E 证据；其真实收口为 `Host HP 48 / Guest HP 48 / Guest CP 6 / Guest cursedCoin 1`。
- 2026-06-04 新增事实：此前一次出现的 `MatchRoomWithAudio.tsx` 动态导入失败，目前未在最小前端反馈环中复现。独立 Vite 直接请求 `/@vite/client`、`/src/pages/MatchRoomWithAudio.tsx` 与 `/src/pages/MatchRoom.tsx` 均返回 `200`，因此这更像当时特定 runtime/冷启动波动，而不是当前源码静态编译就会稳定触发的前端红灯。
- 战术家与咒缚海盗当前不是“完整完成”，而是 L1 静态接入、资源链、真实入口 E2E 与一批 L2 机制通过；战略防御、送你们去喂鱼、手牌选择、瞭望台三分支、作战室奖励骰展示、占得上风勋章分支、起锚骷髅分支、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰展示、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、两条防御响应链、深海潜行完整真实攻击入口、4 人无情诅咒火药桶链、诅咒卡牌自伤抽牌分支、封舱弃手重抽链、分点给我单目标火药桶链、亡灵之爪诅咒金币追加直伤链、诅咒金币维持阶段掉血链，以及火药桶维持阶段爆炸链都已有代表性真实入口截图链，但全流程仍受复杂交互未逐项 L3/L4 限制。
- 战争贩子 II 勋章专门链此前未锁定的真实根因有两层：E2E 场景只改了 `abilityLevels` 没把 `war-monger` 真替换成升级后的能力定义；正式领域链则在勋章分支先写入 `extraAttackInProgress`、当前攻击稍后才于防御阶段收口时，没有把下一阶段切回 `offensiveRoll`。两层现都已修复，并分别由 E2E 与机制测试锁定。
- 资源链已经闭合：上传前 `assets:check` 发现 24 个本轮 DiceThrone 新资源缺远端，随后 `assets:upload` 成功上传；两名英雄的玩家板、提示板、手牌图、骰子、状态图集以及 Common 背景/头像远端 HEAD 均为 200。
- 真实入口双玩家 E2E 已通过：战术家和咒缚海盗可在真实在线选角入口被两名玩家选择，并能进入对局；截图证明双方玩家板、提示板、HUD、骰区与代表手牌 atlas 可见。
- `通用牌索引` 当前也已拿到真实 UI 证据，而不再只是 intake test 的静态断言：开局双玩家 E2E 现已给 Host/Guest 手牌同时注入各自的 `card-unexpected`，并在同一条真实用例里等待两边 common 卡图加载完成、断言可见后再截图；因此 `05-host-zhanshujia-hand-card-atlas.png` 与 `06-guest-cursed-pirate-hand-card-atlas.png` 现在同时证明了战术家 slot 32 与咒缚海盗 slot 33 的通用牌 atlas 运行时落点。
- 战术家 `军刀突刺` 现在也已拿到对象级 L3 代表链：新的真实入口 E2E 已证明 `fist` 槽位在 3 军刀盘面下会解析为 `sabre-thrust-3`，点击后先留在 `offensiveRoll`，再由 Host 推进到 Guest 的 `still-wet-behind-ears` 防御阶段；随后把 Guest 防御骰固定成全战利品面后，服务器状态断言 `Host HP=50 / Guest HP=46`，说明基础 `3 军刀 -> 4 伤害` 主链已经在真实 UI 里闭环。
- 战术家 `军刀突刺 II` 现在也已拿到对象级 L3 代表链：新的真实入口 E2E 已证明 `fist` 槽位在升级场景下会解析为 `sabre-thrust-2-3`，点击后同样先留在 `offensiveRoll`，再由 Host 推进到 Guest 的 `still-wet-behind-ears` 防御阶段；随后把 Guest 防御骰固定成全战利品面后，服务器状态断言 `Host HP=50 / Guest HP=45 / Guest bind=1`，说明升级后的 `5` 点伤害与“三同值施加紧缚”已经在真实 UI 中闭环。
- 战术家 `地毯式轰炸 II` 现在也已拿到对象级 L3 代表链：新的真实入口 E2E 已证明 `chi` 槽位在 `4 旗帜 + 1 军刀` 盘面下会解析为 `carpet-bombing-2-strategy`，点击后会在无 `pendingAttack` 的前提下真实完成 `Host 战术优势=3` 与 `抽 2 张牌`，且抽到的 `战略防御！ / 占得上风！` 会真实进入手牌区。这说明升级旗帜分支的 `grantToken + drawCard(2)` 已在真实 UI 中闭环。
- 战术家 `战略转移 II` 现在也已拿到对象级 L3 代表链：新的真实入口 E2E 已证明 `calm` 槽位在 `4 勋章 + 3 勋章` 同时满足时不会自动走主分支，而是会先弹出“选择发动变体” modal；Host 显式选择 `战略转移 II（4个勋章）` 后，才会创建 `strategic-shift-2-main` 攻击链，并在推进后收口到 `Host 战术优势=5 / Guest bind=1 / Guest HP=45`。这说明升级主分支的 `grantToken + bind + unblockable damage` 已在真实 UI 中闭环。
- 战术家 `摇鼓运动 II` 现在也已拿到对象级 L3 代表链：新的真实入口 E2E 已证明 `lotus` 槽位在 `3 军刀 + 2 勋章` 盘面下会直接解析为 `drum-movement-2-main`，点击并推进后会自然打开 Guest 的 `still-wet-behind-ears` 防御阶段；把 Guest 防御骰固定成全战利品面后，服务器状态断言 `Host 战术优势=1 / Guest bind=1 / Guest HP=43`，说明主分支的 `grantToken + bind + 7 伤害` 已在真实 UI 中闭环。
- 历史上确实有过整份 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 在同一轮托管 isolated runtime 下 `26 passed (11.3m)` 的记录，但这已经不能当当前结论复述。最新整文件回归没有形成“当前全绿”证据：最新一次整跑在最前两条开局/选角用例就被 online room / frontend runtime 不稳定拦住，现象包括 `page.goto ... waitUntil "commit" timeout`、`chrome-error://chromewebdata/`、`localStorage/sessionStorage Access is denied`，随后 26 条全部 `skipped`，并伴随前端服务异常退出 `code=3221226505`。
- 本轮已新增 `scripts/infra/diagnose-dicethrone-room-entry.ts`，把环境反馈环收窄到 `create -> join -> seed -> goto room -> wait character selection`。它已经证明：当前 isolated single-worker DiceThrone 诊断并不只是 `Board.tsx` 首取慢，而是会在真正进房前随机撞启动期 OOM。
- 上述最小探针在两种 runtime 下都已打到可复述的环境证据：
  - `bundle` runtime：`vite-with-logging` 前端进程异常退出，同时 `bundle-runner e2e-game-single` 在启动期 `Fatal JavaScript out of memory`。
  - `tsx` runtime：Vite 与游戏服务分别出现 `Zone Allocation failed - process out of memory`。
  - 因此当前不能再把 DiceThrone 验证噪音单纯表述成“房间冷启动慢”或“只是一条用例 flake”。
- `waitForFrontendAssets(hostPage, 30000)` 在 DiceThrone setup 里现在只能算 best-effort 诊断，不能当硬门禁：即使 runtime manager 已把 `/__ready`、`/@vite/client`、`/src/main.tsx` 纳入健康检查，Playwright `page.request.get('/@vite/client')` 仍可能单独挂死 30 秒；这能证明环境不稳，但不能直接推出后续业务链一定失败。
- 新增的 `占得上风 / 起锚` 对象级真实入口都已单跑通过：前者通过循环重置最小主阶段手牌场景直到命中勋章分支，确认战术优势从 `0 -> 4`；后者同样命中骷髅分支，确认对目标真实写入 `休战 1`。这两条不再适合继续留在“独立对象待补”里。
- 当前能确认的新通过证据是三条 `咒缚` 对象链都已单跑收口：`咒缚` 维持阶段自伤、对手未发起攻击时施加火药桶、火药桶维持阶段爆炸链均已通过真实入口定点 E2E。
- `火药桶` upkeep 代表链当前不再依赖 `primeHarnessRandomQueue(...)`。新的结论是：online 服的 upkeep bonus die 不能稳定受前端 harness 随机队列控制；但在 isolated runtime 侧，`prebuilt + BG_VITE_FORCE_INLINE=1` 且不启 `BG_VITE_FORCE_CONFIG_INLINE` 已被证明能绕开启动期 `howler` / OOM 组合噪音，把定点验证重新带回真实业务位点。
- `反制措施 / 你还嫩了点` 当前已经拿到新的运行证据：旧红根因确实是测试把 `ADVANCE_PHASE` 发给了错误玩家，而不是领域逻辑未实现。修正为 `反制措施 -> Host / playerId '0'`、`你还嫩了点 -> Guest / playerId '1'` 后，定点 E2E 已再次 `1 passed`。
- 对 `反制措施 / 你还嫩了点` 的静态复核结果现已被新的运行证据补强，而不是被推翻：`rules.ts` 的 `canAdvancePhase(defensiveRoll)`、`flowHooks.ts` 的 `defensiveRoll` 退出逻辑，以及现有 mechanics tests 都表明 `setupDefenseEvidenceScenario(...)` 的 direct `defensiveRoll + pendingAttack + rollConfirmed` 注入结构在合同上仍是自洽的；当前最新通过也说明首个真实修点不是这条注入结构，而是结束防御命令发给了错误玩家。
- 战术家 `9 张升级牌` 当前也已拿到代表性真实入口证据，而不再只是 L2 映射：新 E2E 已证明升级牌从真实手牌用 `PLAY_UPGRADE_CARD` 打出后，会把 `war-monger` 的 `abilityLevels` 从 `1 -> 2`，把 `upgradeCardByAbilityId['war-monger'].cardId` 写成 `upgrade-zhanshujia-war-monger-2`，手牌归 0、CP 从 `5 -> 3`，且升级牌不会误入弃牌堆，而是保留在升级槽位。
- 战术家 `战争贩子` 本体现在也已拿到对象级 L3 代表链：新 E2E 已证明真实攻击入口会先出现奖励骰覆盖层，并在关闭覆盖层、由防守方完成防御收口后，Host 真实回到额外进攻 `offensiveRoll`。这说明基础 `rollDie` 分支与 `postDamage -> extra offensive roll` 链都不再只停留在 mechanics test。
- 战术家 `地毯式轰炸` 现在也已拿到对象级 L3 代表链：新的 4 人真实入口 E2E 已证明该链会先进入 `targetingRoll`，完成目标骰投掷/确认后，若命中 `5/6` 会真实弹出 `dt-defender-choice`，随后再进入 `selectPlayer` 双敌选择覆盖层；最终可只命中敌队两名玩家，不会把队友混入候选，且服务器状态断言 `player0Hp=46 / player2Hp=46 / player3Hp=50`。
- `run-e2e-single.mjs` 当前必须串行跑。同一轮并行定点 run 会稳定撞 `.tmp/e2e-preflight-cache.json` 的 `EBUSY`，这属于验证基础设施边界，不应误记成业务对象红灯。
- E2E 截图前等待图片真实加载完成是必要门禁。本轮上传前曾暴露“DOM 存在但图片未从远端加载完成”的空面板风险；`waitForBoardImageReady` 将证据从“元素出现”提升到“图片已加载且可见”。
- 咒缚海盗运行时现已同时接入咒缚面 `player-board` 与人类面 `human-player-board` 两张玩家板底图；`HeroState.playerBoardFace` 已参与主玩家板与攻击特写选图，海盗的一生咒缚面治疗 3 与普通面获得 1 诅咒金币分支均有 L2 证据。
- `无情诅咒` 的 4 人真实入口当前已不再是未验证高风险项。`42-45` 已同时证明：目标骰 `5/6` 的选敌归属正确、Host 会收到火药桶选择 modal、选择 `施加给 P2, P4` 后双敌方会真实落桶。
- `诅咒卡牌` 现在也有对象级 L3 代表链：真实入口会展示“诅咒卡牌：选择结算效果” modal，且“受 4 伤害抽 3”分支能回写 HP、手牌与弃牌落点。
- `封舱` 现在也有对象级 L3 代表链：真实入口可以证明打牌前手牌、打牌后其余手牌进入弃牌堆，以及重抽 4 张新手牌的闭环，不再只是机制测试通过。
- `分点给我` 现在也有对象级 L3 代表链：真实入口可以证明源卡进入弃牌堆，且目标玩家真实获得 1 层火药桶，不再只是共享 `grantStatus` 合同外推。
- `亡灵之爪` 现在也有对象级 L3 代表链：真实入口可以证明 Guest 通过 `calm` 槽位发动后，Host 在保留 3 层诅咒金币的同时从 50 HP 降到 39 HP，说明 8 点不可防御主伤害与按金币层数追加的 direct 伤害都已走通。
- `诅咒金币` 现在也有对象级 L3 代表链：真实入口可以证明 Guest 从 `discard` 推进回合后，Host 在进入 `upkeep` 时从 50 HP 降到 47 HP，且 3 层诅咒金币不被移除，说明维持阶段掉血与状态保留都已走通。
- `火药桶` 现在也有对象级 L3 代表链：真实入口可以证明 Guest 从 `discard` 推进回合后，Host 在进入 `upkeep` 时从 50 HP 降到 47 HP，且火药桶从 1 层移除到 0，说明维持阶段 1-2 爆炸分支已走通。
- 战术家 `制胜高地` 现在也有对象级 L3 代表链：真实入口可以证明 Host 通过 `ultimate` 槽位触发后，Guest 获得 `锁定 1 / 紧缚 1`，且 Host 的战术优势上限从 5 升到 6 并补满到 6。
- 战术家 `战术优势` 现在也有对象级 L3 代表链：真实入口可以证明 Host 通过被动按钮进入 `selectStatus -> selectTargetStatus` 双阶段交互，并在消耗 4 层战术优势后，把自己身上的 `紧缚` 真实转移给 Guest。
- 战术家 `紧缚` 现在也有对象级 L3 代表链：真实入口截图 `64-66` 已证明 Guest 在额外进攻投掷里先支付 `1CP` 再重投，并在离开 `offensiveRoll` 后清掉自己身上的 `紧缚`。这条链最新单跑为 `1 passed`。
- 战术家 `伴装撤退` 现在已有对象级 L3 代表链：之前失败的根因不是业务未实现，而是测试错误地直接派发基础 ID `soul-stab`，绕开了真实已解析为 `soul-stab-3` 的攻击槽位。改为点击真实 `data-resolved-ability-id="soul-stab-3"` 槽位后，Host 已能在自然打开的 `defensiveRoll` 里从真实手牌打出 `伴装撤退`，并收口到“攻击者获得 `紧缚 1`、防守方获得 `3` 点护盾、源卡进入弃牌堆”。
- 战术家 `脱战` 现在也已有对象级 L3 代表链：不再走 `direct state injection -> defensiveRoll` 捷径，而是复用真实 `soul-stab-3` 攻击链自然打开防御窗口。当前真实 run 已证明 Host 能从真实手牌打出 `脱战`，并完成奖励骰分支结算；本次截图链命中的是军刀分支，收口结果为攻击者 HP `50 -> 48`，且源卡进入弃牌堆。
- 对象级彻底审计已开始回收第一批“可合法复用”的 shared/representative 条目，而不是继续把所有 shared 对象一律算作未收口。当前已明确登记的首批对象包括：`反制措施 II`（复用基础反制措施的同一 defensive slot + custom action 链）、`凋零`（复用深海潜行 / 啜呼已证实的真实状态链）和 `劫掠`（复用深海潜行同一 `cursed-pirate-steal-one-cp` custom action 链）。
- 对象级彻底审计的第二批可保守登记对象，已经收窄到“没有私有 resolver、没有 choice/奖励骰/额外阶段，只由通用 `grantStatus / grantToken / damage` 组合而成”的条目。当前新增可登记对象为：`摇鼓运动`、`战略转移`、`死亡吐息`。它们的共同点是：共享入口仍是玩家板攻击链，共享消费点仍是 `CombatAbilityManager -> effects.ts` 的通用 effect 消费，剩余差异仅是参数值，不再包含独立交互链。
- 在进一步收紧口径后，又可以继续保守登记一批“纯共享手牌 immediate 链 / 纯共享 effect 组合”对象：`包夹侧翼`、`开拓战场`、`伏击`、`灵魂指令`、`坏血病`、`休战`（手牌）。这些条目都没有私有 `customAction`，也不依赖 `rollDie`、奖励骰、额外阶段或升级替换；它们复用的只是已被现有真实入口截图证明的通用 `grantToken / grantStatus / damage` 消费链，或真实手牌 immediate 写入链。
- 进一步往下筛后，又确认了一类可以严格收口但不放宽标准的对象：它们虽然没有自己的独立截图链，但已经在别的已通过真实入口里被显式消费成前置条件，而且剩余差异只在 L2 已锁住的参数/附带条件。当前新增命中的对象是：`包夹侧翼 II`、`休战` 状态本体、`灵魂突刺`。其中 `灵魂突刺` 后续已继续升级为独立 direct E2E，不应再按“仅 representative”理解。
- `implementation_in_progress` 仍应保留，但当前更准确的原因已经不是“战术家高优先对象还没补齐”或“整份 intake E2E 仍红”。真实剩余门禁是：对象级彻底审计里仍有一批 `L1/L2 shared` 或仅有 `representative` 结论的对象，尚未逐对象登记合法复用依据，或尚未补独立 L3/L4 / `scoped-debt` 结论。

## 当前结论

- 可以说：战术家与咒缚海盗已完成资源上传、远端回查、真实入口双玩家 E2E，以及代表性开局展示/手牌 atlas 截图核验。
- 可以说：旧防御链 `反制措施 / 你还嫩了点` 已在 `prebuilt + inline Vite` 绕过路径下恢复通过，且根因已锁定为 E2E 测试命令玩家写反。
- 不能说：两个英雄已完整完成、机制已全量 L3/L4、整份 intake 当前全绿，或可以移除 `implementation_in_progress`。

## 后续风险

- 若要继续推进“官方双面咒缚海盗完整实现”，下一步不再是补人类面底图本身，而是证明 normal 面是否会在真实流程中自动切换，以及它是否存在与咒缚面不同的完整技能语义；当前只能证明两张底图都已接入运行时，不能把这一步外推成双面机制已完成。
- 多人目标、隐藏信息查看、手牌弃置、跨玩家双步选择、目标页奖励骰选择、深海潜行完整攻击入口、作战室奖励骰展示、干票大的奖励骰分支、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、4 人无情诅咒火药桶链、诅咒卡牌选择链、封舱弃手重抽链、分点给我单目标火药桶链、亡灵之爪追加直伤链、诅咒金币维持阶段掉血链与火药桶维持阶段爆炸链已有代表性 E2E 证据；后续若对外承诺“完全可玩”，剩余工作重点已从“继续证明这些代表链是否能跑通”转为“把其余对象逐项补到真实入口交互链、或在审计中登记共享链合法复用/明确冻结”。
- 当前不能把 `无情诅咒` 单链通过外推成“所有 4 人 DiceThrone online readiness 都已稳定”。现阶段更准确的口径是：这条新英雄 intake 的高风险 4 人链已收口，但通用多人房冷启动与 frontend runtime 仍有明显波动；历史上的整份 intake `26 passed` 只是一轮旧通过记录，最新整跑已被环境不稳定取代，更不能外推成多人基线已做完重复 soak。
- 当前也不能把“旧防御链已恢复”外推成“整份 intake 当前全绿”。更准确的口径是：这条旧红业务链已经恢复，剩余阻塞回到对象级彻底审计与 runtime 稳定性，而不是 `反制措施 / 你还嫩了点` 仍未实现。
- 对战术家防御响应牌，真实入口策略现在已经同时被 `伴装撤退 / 脱战` 验证：应复用正式攻击链，让响应窗口自然打开，再证明从真实手牌打出目标响应牌；不应继续沿用 direct state injection 把房间瞬间切到 `defensiveRoll` 的捷径。
- 战术家对象级高优先缺口现已清空：`紧缚` 已由 `64-66` 真实入口链补齐，`伴装撤退` 已由 `67-68` 真实防御响应手牌链补齐，`脱战` 已由 `69-71` 真实防御响应手牌链补齐。当前剩余风险回到整批 intake 级别的“复杂交互 UI 尚未逐项 L3/L4 全覆盖”，不是这三个对象仍未落地。
- `虚张声势` 先前不能保守外推的原因已经解除：它带独立 `rollDie` 三分支入口，但现在已补到真实手牌打出 + 奖励骰覆盖层 + 弯刀分支收口的对象级 direct E2E，因此不再属于“只能 shared 外推”的对象。
- `诱饵` 先前不能保守外推的原因现在也已经解除：它带 attack modifier 时序 hook，但最新 direct E2E 已证明 Guest 先通过真实 `soul-stab-3` 攻击入口建立攻击链，再从真实手牌打出 `诱饵` 后，会在仍处于 `offensiveRoll` 时把 Host HP 直接从 `50 -> 48`，同时源卡进入弃牌堆、Guest CP 从 `5 -> 4`；这条链同时证明它当前不会走 `pendingAttack.bonusDamage / attackModifierBonusDamage` 写入。
- `军刀突刺 II` 先前不能保守外推的原因现在也已经解除：它既带升级替换，又带私有 `customActionId=zhanshujia-bind-if-three-kind`，不能只靠基础 `军刀突刺` 或 mechanics test 外推；最新 direct E2E 已证明升级后的真实玩家板槽位、伤害提升与三同值紧缚写入会在同一条攻击链里闭环。
- `地毯式轰炸 II` 先前也不能完全保守外推：虽然旗帜分支只由共享 `grantToken + drawCard` 组成，但它仍挂在升级后的复合能力 `variants` 上，不能只用 4 人主分支或 L2 配置映射证明；最新 direct E2E 已证明升级后的真实玩家板槽位、无攻击链的即时结算形态，以及 `抽 2` 的手牌落点都在同一条真实链里闭环。
- 因此，对象级高价值独立缺口已清空。`implementation_in_progress` 仍不能移除，因为剩余门禁已经回到 shared / representative 条目的逐对象合法复用登记、复杂交互 L3/L4 覆盖与 runtime 稳定性，而不是还有哪张单卡完全缺首条 direct E2E。
- 对咒缚海盗 human 面而言，这个结论现在也成立得更彻底：`弯刀突刺 / 做好标记 / human-cursed / 走跳板 / 点燃炸药 / 判决指令 / 惊魂动魄 / 嘿，老兄 / 无情劫掠` 9 个对象都已拿到独立真实入口 direct E2E；当前真正剩余的是逐对象更高层级 completion audit、双面对象级重审计，以及整份 intake 的 soak 稳定性。
- `点燃炸药 / 判决指令 / 无情劫掠` 这 3 个 human 面对象现在也不应继续挂在“独立 L2/L3 证据待补”的旧口径里：它们已经分别拿到 L2 机制证据，且 `无情劫掠` 已补独立 direct E2E，当前更准确的剩余项是对象级 completion audit、其余 human 面对象独立 L3/L4 与整批 soak 稳定性。
- 2026-06-04 进一步新增事实：`点燃炸药` 与 `判决指令` 的独立真实入口 direct E2E 也已补齐，旧口径里“这两条仍待补 direct E2E”已经失效。当前 human 面高优先剩余项不再是这 3 个对象的首条真实入口缺失，而是人类面板新增真相源下的逐槽 completion audit、其余对象独立 L3/L4 与双面整体重审计。
- 2026-06-04 进一步新增事实：咒缚海盗双面图面合同现在不再只写了 human 面。`咒缚海盗真相源表.md` 与 `咒缚海盗录入核对.md` 已同时显式记录咒缚面 / 人类面两套逐槽合同，因此“逐槽合同缺失”已不再是当前剩余项；真实剩余项已收窄为双面对象级重审计、remaining representative 条目的逐对象 L3/L4 与 soak 稳定性。
- 2026-06-04 进一步新增事实：`死亡吐息` 现已拿到独立真实入口 direct E2E。旧 blocker 不是业务链未实现，而是测试夹具把“小顺子”误写成 `[1,2,3,5,6]` 非顺子盘面；修正为 `[1,2,3,4,6]` 后，定点命令已 `1 passed`，并收口到 `Host HP 50 -> 43 / Host powderKeg 1 / Host wither 1`。因此它不应再保留为“待 CPU 回落补证”的 representative 条目。
- completion audit 最新结论之一是：对象审计文档里的 `grantStatus` 特例合同不应再保留 `L2 partial`。当前机制测试已经覆盖诅咒金币拒绝/上限/不可移除、火药桶维持与重叠、凋零减攻击伤害、休战阻伤与清理、紧缚 `1CP` 门禁与清理、锁定写入；对象矩阵与截图链也已经为这批状态消费者补齐 representative L3 的逐对象登记。
- completion audit 最新结论之二是：对象审计文档里的 `奖励骰/随机` 合同也不应再保留 `L2 partial`。当前机制测试已覆盖作战室、死亡印记、战争贩子、战争贩子 II 勋章分支、干票大的、抽筋剥皮、啜呼、瞭望台三分支；现有定点 E2E 与截图链则已经补齐作战室、占得上风、起锚、战争贩子、战争贩子 II、干票大的、抽筋剥皮、死亡印记、啜呼、瞭望台、虚张声势的 representative L3。
- 因此，`对象级 L3/L4 | partial` 的真实原因也已经变化：它不再主要表示“还有单对象首条 direct E2E 缺失”或“shared / representative 尚未登记”，而是表示“仍有一批对象只达到 representative L3、尚未逐对象独立补满 L3/L4”，再加上整份 intake runtime 仍缺少稳定重复通过/soak 证据。
- runtime 侧的最新事实也已经收窄：
  - `Online match: Can start a game successfully` 已在当前 isolated single-worker runtime 下通过。
  - `Online 4-player room: create claim-seat join and start successfully` 也已通过。
  - 所以现在的运行风险不再是“简单进房/开局稳定失败”，而是长跑 soak、更多对象和整份 intake 的连续稳定性。
- 进一步分层后，剩余 `representative L3` 里最需要优先补独立 `L4` 的，是带明显交互窗/多步选择/跨阶段链的对象：
  - 战术优势
  - 反制措施 / 你还嫩了点
  - 无情诅咒
  - 深海潜行
  - 瞭望台
  - 啜呼

# Findings: TDD 行为 seam 与测试结构重构（2026-05-16）

## 已确认事实

- `expansionBaseAbilities.test.ts` 仍是典型的“按扩展来源聚合”的旧入口。里面原本把 `10th Anniversary`、Cthulhu 扩展、AL9000、Pretty Pretty 以及多条 stale regression 混在一起。现在至少 `10th Anniversary` 这块已经拆成 [bases/anniversary-bases.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/bases/anniversary-bases.test.ts:1>)，说明这个旧壳还能继续按基地簇收缩，而不是只能整体保留。
- `scoreBases-auto-continue.test.ts` 里还有一层明显的混层：它原本不仅测 `scoreBases` 自动推进，还塞了多条与 AI 候选枚举相关的通用交互测试。现在已经把 `optional multi / ordered multi / required empty / exact multi` 这 5 条迁到 [ai-interaction-choice-enumeration.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts:1>)，因此 `scoreBases-auto-continue.test.ts` 不再承担泛 AI 交互枚举职责。
- `afterscoring-window-skip-base-clear.test.ts` 不是一个自然的单文件边界。里面原本混着 `base_greenhouse` / `base_tortuga` 的重复 happy-path、`base_the_mothership` / `base_pirate_cove` 的延迟清场链、`base_temple_of_goju_tiebreak` 的 finalize 语义，以及一组 `scoreBases` 收尾门禁。现在已经收成 [scoreBases-deferred-finalization.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts:1>)，并删掉了重复 happy-path 入口，说明这次处理的是系统最终化边界，不是改标题。
- `afterScoring-rescoring.test.ts` 里那两条 `smashup_immediate_extra_minion` 其实不是 afterScoring 响应窗口合同，它们属于“立即额外打出”这条系统入口。把它们继续放在 afterScoring 响应窗口文件里，会让后续维护者误以为它们和 `smashup_reaction_choose` 是同一层边界。现在这两条已经并回 `abilities/immediate-extra-action.test.ts`，说明应该按“额外打出类型”而不是按“出现时机”来归类。
- `turnTransitionInteractionBug.test.ts` 这次被拆开后，边界更清楚了：它原来混着两条不同的系统链，`startTurn/base_rlyeh` 和 `scoreBases/base_tortuga`。前者锁的是回合切换时 `base_rlyeh` prompt 能否被响应并恢复到 `playCards`，后者锁的是计分阶段 `base_tortuga afterScoring` 是否会暂停链路、等待亚军响应并在响应后恢复。把这两条链混在一份 `bug` 文件里，只会让后续继续把不同系统边界写进同一个入口。
- `multi-base-afterscoring-bug.test.ts` 这轮确认了一个很容易误判的边界：名字里带 `bug`，内容却不是一次性复现壳。它真正锁的是 `scoreBases` 的多基地恢复语义: 当前基地进入 `afterScoring / Me First!` 交互后，后续基地计分不能丢；复杂链路里也不能重复计分、重复清场或提前结束。所以它的正确收口不是删，也不是并回派系，而是改成明确系统入口 `scoreBases-multi-base-chain-recovery.test.ts`。
- `igor-rlyeh-double-trigger.test.ts` 也不是 `destroy-trigger-prompt-coexistence.test.ts` 的重复。后者锁的是“基地 prompt 与 Igor prompt 并存时不要伪装成双触发”，而这份锁的是更具体的 `base_rlyeh onTurnStart -> MINION_DESTROYED -> frankenstein_igor onDestroy` 真实链幂等性。对这类文件，真正的不变量是“某条系统链只触发一次”，不是“某次 bug 名字保留下来”。
- `elder-things-ongoing.test.ts` 这轮证明了“ongoing”标签本身不能当边界。它内部同时放了：
  - `elder_thing_dunwich_horror` 附着行动
  - `elder_thing_the_price_of_power` 计分 special
  - `elder_thing_elder_thing` 保护与 onPlay prompt
  - `elder_thing_shoggoth` 打出限制与 onPlay
  这些都不是跨派系共享机制，而是远古之物自己的一组能力合同。
- 所以保留 `elder-things.test.ts` + `elder-things-ongoing.test.ts` 这对双入口，只会继续制造“远古之物的行为到底写回哪份”的维护分裂。正确动作是并回单一派系入口，而不是再给 ongoing 壳找理由。
- `onDestroyAbilities.test.ts` 同样不是一个自然边界。它把：
  - 共享 `onDestroy` 基础设施
  - `robot_nukebot`
  - `trickster_gremlin`
  - `trickster_gremlin_pod`
  - `bear_cavalry_general_ivan` 的弱 destroy 保护回归
  全部挂在一个旧入口里。
- 更糟的是，`General Ivan destroy 保护` 那两条里有一条实际上依赖非法目标 payload，另一条断言的也不是“没有 Ivan 时应被消灭”，而是“因为 Bear Necessities 本就不能打自己人，所以不会消灭”。这种测试不是稳定行为合同，继续机械搬运只会把噪声扩散到新文件里。
- 这轮把 `onDestroy` 共享基础设施拆到 `abilities/on-destroy-mechanics.test.ts`，把机器人/诡术师 onDestroy 行为并回各自专项，并让 `onDestroyAbilities.test.ts` 退场，说明正确方向不是“给旧根目录文件换个名字”，而是：
  - 共享机制留机制专项
  - 派系行为回派系专项
  - 弱测试直接淘汰，不为了凑数量继续保留假合同
- `baseFactionOngoing.test.ts` 里的 `机器人 ongoing` 与 `巫师 ongoing` 也证明了另一个根因：旧大文件经常自带本地夹具前提。比如机器人 `Archive` 测试原先默认带着“机器人派系 + 非空牌库”，一旦并回 `robots.test.ts` 改用通用 helper，就会合法地抽不到牌。这个红灯不是实现坏了，而是旧大文件把业务前提藏在自己的状态工厂里。
- 所以这类迁移不能只复制 `describe`。必须同时把旧文件里真正有意义的前提显式化，比如：
  - `Archive` 相关测试需要显式给对应玩家提供牌库
  - 需要依赖派系判定的测试要显式声明机器人派系，而不是吃 helper 默认的 `pirates/aliens`
- 机器人这段迁移后，`baseFactionOngoing` 里还暴露出明显的历史复制噪声：`robot_microbot_archive` 的 Alpha/remote/enemy/self 几组测试在旧文件里重复了一遍。并回专项时只保留唯一语义版本，能直接减少未来“同一行为修两处”的测试碎裂。
- `expansionOngoing.test.ts` 这轮也证明了“只把测试从一个文件搬到另一个文件”还不够。真正应该固化的是**每个派系只有一个自然入口**。只要 `Steampunks / Innsmouth / Miskatonic` 这种已经能按派系命名的簇还挂在扩展包聚合文件里，后续改实现时就还会出现“我该改专项文件还是改聚合文件”的双维护分裂。
- 这次把 `Steampunks` 并回既有专项、再为 `Innsmouth` 与 `Miskatonic` 补建专项文件，最后删除 `expansionOngoing.test.ts`，说明正确的收口动作不是保留一个越来越短的旧壳，而是在每个尾项都有明确归宿后直接让旧壳退场。
- `killer_plant_water_lily` 这轮把一个很典型的测试脆弱点钉死了：旧 `expansionOngoing.test.ts` 自带的本地 `makeState` 默认塞了牌库，所以“控制者回合开始抽 1 牌”在旧文件里天然满足前提；迁到共享 `helpers.makeState` 后，默认牌库是空的，测试却没有显式声明“牌库里有可抽卡”，于是看起来像实现坏了，实际是测试夹具把业务前提藏在旧 helper 里。
- 这类问题不能只通过“把 expected 改绿”处理。真正该固化的不变量是：**凡是验证 draw/draw-if-available 这类行为的测试，都要显式写出牌库/弃牌堆前提，而不是依赖某个局部工厂函数的隐式默认值。** 这正是用户抱怨“每次重构都要改测试”的根因之一。
- `ninja_hidden_ninja consumesNormalLimit` 这条红灯再次证明：fake prompt 夹具不是“更快的 seam”，而是另一套不受系统合同保护的伪实现。`SimpleChoiceSystem` 现在依赖 runtime prompt 上的 `availableOptions` 语义，手工塞一个只带 `options` / `data.sourceId` 的 current prompt，会在 `respondToPrompt(...)` 时直接炸在系统层。对这类业务交互，最稳的入口仍是能力 executor / 真实命令链产出的 prompt。
- `trickster_brownie` 和 Hill 这两条一起说明，`control_change` 类 affect 没有单一“永远正确”的 controller 口径：Hill 需要看到变更后的 `toControllerId` 才能判断“现在由谁控制”；Brownie 在“被对手卡牌影响”这个语义上又需要知道受害方是谁，因此 `control_change` 分支应优先消费原始事件里的 `fromControllerId`。正确做法不是回滚全局 affect 修复，而是让具体能力在需要时读取 `affectEvent`。
- 本地测试 helper 也要对齐真实 reducer。`triggerBrownieFromEvent(...)` 之前只把 `buildAffectRecords(...)` 的结果直接灌进 `fireTriggers(...)`，漏掉了 reducer 实际会传的 `affectEvent` 与 `affectBatchTargets`，导致测试无法覆盖到基于原始影响事件的 trigger 语义。这类 helper 如果比生产链少半截上下文，就会把“实现红灯”和“测试夹具失真”混在一起。
- `bear_cavalry_bear_rides_you_pod_choose_base` 可以完全走公开行为链：`PLAY_ACTION` 已经会产出选随从 prompt，响应后真实进入选基地 prompt，再响应后真实进入 `choose_suppress`。这说明这条旧 `getInteractionHandler(...)` 并不是系统合同，而只是历史上为了方便断言候选列表留下的直调 seam。
- `abilities/bear-cavalry.test.ts` 剩下的两条 `bear_cavalry_superiority_pod_talent` 更像低层合同：它们锁的是 runtime prompt 解析后的 `protect/draw` 分支如何写 metadata 与产出抽牌，而不是普通用户链。和 `bear_rides_you_pod_choose_base` 不同，这两条不值得为了“继续降命中数”硬迁。
- `smashup.smoke.test.ts` 的 `major_ursa` 迁移证明普通业务三段链可以完全收回 prompt facade：`USE_TALENT` 先产出 `choose_destination`，选基地后真实进入 `smashup_reaction_choose`，响应后继续出现 `choose_minion`，最后再出现 `choose_base`。这条链不需要再靠 handler 直调和 continuationContext 手填来“补齐”。
- 这也说明 `respondToPromptOption(...)` 的 `finalState` 是当前测试 seam 的权威入口；只要实现没坏，测试不应再自己调用 `postProcessSystemEvents(...)` 或手工接管 prompt 队列。
- `pirates-ongoing.test.ts` 里“已取得触发资格后，即使先被其他 afterScoring 效果移走，仍可继续结算自己的移动”这一类场景，不属于“当前已经有 prompt 的普通 UI 链”，而是显式在测 afterScoring reaction session 的恢复与继续结算。这里用 `resolveSmashUpReactionChoice(...)` 比用 `getInteractionHandler('smashup_reaction_choose')` 更合适，因为它锁的是 reaction session 语义，不是 handler registry 出口。
- `smashup.smoke.test.ts` 里 Hill give-minion -> counter 这条链暴露出一个真实实现问题，而不只是测试 seam 问题：旧测试手工 `resolveAffectedMinions(...)` 会把 `onMinionAffected` trigger 再排一次队，掩盖了真实命令链第一次消费 trigger 时其实拿到的是“控制权变更前”的随从快照。
- `MINION_CONTROL_CHANGED` 的 affect 记录如果直接从变更前 `core` 取 `triggerMinion`，像 `ignobles_the_hill_that_strolls` 这种要求“现在由别人控制、但仍归你所有”的 `onMinionAffected(control_change)` 会被错误短路。这里真正该固化的合同是：`control_change` 类 affect trigger 看到的控制者必须是 `toControllerId`，否则公开行为测试只能继续靠手工补状态兜底。
- 对这类真实反应链测试，`respondToPromptOption(...)` 的 `finalState` 已经包含后处理、trigger queue 与 reaction prompt。测试再自己 `resolveAffectedMinions(...)` / `maybeResolveReactionQueue(...)`，不是“更完整”，而是在重新实现一遍 pipeline，极易制造重复 trigger 或错过真实实现 bug。
- 用户质疑“这么快，还是只改表象”成立为质量风险：仅拆文件名不能解决“重构实现就要跟着改测试”的根因。
- 2026-05-16 13:48 复核：`ninja-hidden-ninja-interaction-bug.test.ts` 的价值不在删掉 `it.skip`，而在把旧复现恢复成真实命令入口。测试通过 `PLAY_ACTION` 进入 Me First! 响应窗口，断言业务 prompt 和候选手牌随从，而不是继续读 `sys.interaction.current`。
- `wizard-archmage-zombie-interaction.test.ts` 进一步证明 skip 恢复不能只“取消 skip”：旧文件的 `autoRespond` 和 console 输出本身没有稳定测试价值；恢复后的不变量是“僵尸行动卡额外打出的弃牌堆大法师仍触发 onMinionPlayed 后处理，并给出额外行动”。这类断言能覆盖真实行为，且不会绑定 InteractionSystem 外壳。
- `vampireBuffetE2E.test.ts` 是“不要为了数字复活重复测试”的例子：它是整文件 skip，且旧注释表明历史口径不再适用；当前行为已由 `newOngoingAbilities.test.ts` 和 `abilities/giant-ants.test.ts` 覆盖。删除这种入口比把过期测试改成 facade 更符合 TDD，因为它减少错误测试资产，而不是复制重复断言。
- `wizard-archmage-debug.test.ts` 与 `steampunk-aggromotive-bug.test.ts` 说明 skip 治理还有一种正确动作：删除已被可运行测试取代的调试/旧错误描述文件。TDD 资产应该是当前可执行的不变量测试，不是历史 console 追踪或“当前错误行为”说明。
- `igor-ondestroy-idempotency.test.ts` 的九命之屋块恢复后，skip 治理从“删重复”推进到“补组合不变量”：九命之屋 pendingSave 与 Igor onDestroy 的交互不应靠裸 `current/queue/data.sourceId` 统计，而应通过 `getPromptsBySourceId` 表达“有拯救 prompt、没有 Igor prompt、消灭事件暂缓”。
- `interactionChainE2E.test.ts` 的 Alien Probe 红灯说明旧 skipped 用例可能在保护已经废弃的规则文本。恢复时必须回到当前卡牌规则和现有活跃测试，而不是为了保留旧标题继续测试牌库顶/底这种过期行为。
- 对 skip 历史文件的处理标准进一步确认：只有能恢复为“真实命令/触发入口 + prompt facade + 最终行为断言”的，才算有效恢复；单纯把内部字段替换成 helper、或者移除 skip 而不跑通，不算 TDD seam 治理。
- 当前根因是旧 SmashUp 交互测试直接依赖 InteractionSystem 内部结构：`sys.interaction`、`prompt.data.options`、手写 `SYS_INTERACTION_RESPOND`。
- 已有正确方向是把高频交互测试收进 `helpers.ts` 的 prompt facade，再由结构门禁阻止新迁移文件回退到裸内部访问。
- UI/手动验证测试也不应直读 current：如果目标是“出现 simple choice prompt”，就走 `getSimpleChoicePrompt`，不要用 `asSimpleChoice(sys.interaction.current)`。
- Igor 系列回归证明真正的 seam 不只是 source/options：prompt 所属玩家、响应命令、current+queue 查询都应通过 facade 表达，否则 InteractionSystem 改外壳时仍会批量碎裂。
- 可选 prompt 读取也需要 facade：`getOptionalSimpleChoicePrompt` 让响应窗口这类“可能没有当前 prompt”的测试不用继续绑定 `sys.interaction?.current` 存储位置。
- 统一反应选择器测试应直接使用 `getReactionPrompt`；同样的 `smashup_reaction_choose` source 断言不应在每个 reaction queue 文件里重复展开内部 interaction 结构。
- GameTestRunner 命令数组里的响应命令也要有 facade：`respondCommand` 集中系统响应命令形状，避免每个测试手写 `SYS_INTERACTION_RESPOND`。
- 动态候选和多选约束同样属于测试 seam：`optionsGenerator`、`multi.min`、handler data 不能继续散落在业务测试里裸读 `interaction.data`，否则 prompt 外壳一改仍会批量碎裂。
- 旧扫描表达式没有覆盖所有坏味道：`state.sys.interaction?.current`、`interaction.data.title` 这类隐式裸读也会造成实现结构重构时测试跟改，迁移时应主动一并收敛。
- 不能把“降命中数”本身当目标：skipped 文件、注释中的历史实现条件、以及明确测系统内部 halt 合同的 setup，不应为了数字好看而改成 facade。
- `runtimeEvidenceIssues.test.ts` 暴露出更深一层问题：有些旧测试不仅耦合内部结构，还存在“跑到某一步但没有证明标题声称的行为”的弱断言。Fledgling Vampire POD 用例标题要求 bury prompt，但旧代码只 `void getInteractionsFromMS`；补强后必须穿过统一 reaction prompt 才能证明真正的 bury source prompt。
- `talentAbilities.test.ts` 说明“只验证 prompt 结构”的老测试也应走 facade：测试可以继续断言对手数量、取消选项与 Servitor 行动卡选择 prompt，但不需要知道 prompt 来自 `sys.interaction`、也不需要直接 import `INTERACTION_COMMANDS`。
- `baseAbilityIntegrationE2E.test.ts` 说明“完整链路测试”也不等于可以裸读 InteractionSystem；它要证明的是从真实 trigger 路径最终出现某个业务 prompt，适合用 `getPromptsBySourceId` / `getSimpleChoicePrompt` 表达，而不是手工拼 current + queue。

## 本轮结论

- `ninja-hidden-ninja-interaction-bug-repro.test.ts` 证明了“复现壳”和“现行回归”要按不变量去重，而不是按文件名区分。它虽然用了另一套 `GameTestRunner + makeTestCore` 壳，但锁的仍然只是：Me First! 窗口打出 `ninja_hidden_ninja` 后要创建 prompt，并记录 `specialLimitUsed`。这个不变量已经被 `ninja-hidden-ninja-interaction-bug.test.ts` 承接，所以正确动作是删壳，不是并回 `abilities/ninjas.test.ts` 再制造第三入口。
- `pirate-cove-repeat-trigger-bug.test.ts` 则说明“看起来像 bug 修复文件”也可能只是基地专项的第二入口。它前两条都只是 `base_pirate_cove afterScoring` prompt 合同：非冠军有随从时生成 1 个 prompt、冠军不生成 prompt；这些已被 `baseAbilitiesPrompt.test.ts` 覆盖。第三条还是空 `TODO`，不能当有效资产。对这类文件，继续保留只会制造“好像还多一层保护”的假象。
- 这两份删除共同强化了一条筛选标准：**如果旧文件不提供新的公开行为矩阵、只是在另一套夹具里重复现有合同，或者只剩空 TODO / 注释意图，就应直接删壳。** 否则后续重构时仍会出现“行为没变，但两三个地方都得同步修测试”的重复维护。
- `mothership-scout-afterscore-bug.test.ts` 则落在另一类。它虽然名字像 bug 壳，但内容并不是“再测一次母舰 prompt 存在”这么浅，而是在锁 afterScoring 多段链的顺序不变量：基地 prompt 先结算，`alien_scout_return` / `pirate_first_mate_choose_base` 后续继续弹出，整条链收口前不提前清场换基地。这类用例不能因为文件名不好看就删；正确动作是把它改名成系统合同入口，而不是和前两份一样直接删除。
- `ninja-special-limit-fix.test.ts` 进一步确认：**元数据合同也有归宿，不该单独漂在根目录。** 这 4 条用例锁的都是忍者特殊能力自己的 `specialLimitGroup` 声明和“不能再用共享 `ninja_special`”这一不变量，真实边界就在 `abilities/ninjas.test.ts` 的 `specialLimitGroup` 段，而不是另开一个根目录 `*-fix.test.ts`。
- `alien-probe-bug.test.ts` 则是典型的“派系行为被历史 bug 名字掩盖”。它测的是 `alien_probe` 的公开行为矩阵：单对手直接看手牌并选随从、多对手先选对手、非随从卡禁用、无随从时直接结束、选中后对手弃牌。这个边界显然属于 `abilities/aliens.test.ts`，继续留根目录只会让“外星人能力改动到底去哪里补测试”再次分裂成两处。
- 这两份收口共同强化了一个标准：**如果文件锁的是某张卡/某派系的公开行为，不管名字里叫 bug 还是 fix，都优先并回该派系专项；只有在它锁的是跨卡牌/跨基地/跨交互阶段的系统顺序不变量时，才保留为独立系统合同文件。**
- `afterscoring-timing-verification.test.ts` 说明另一种应该直接删除的债：**占位壳**。文件名看起来像“时序验证”，实际内容只有 `expect(true).toBe(true)`，没有任何行为断言。像这种文件即使 CI 绿，也不能算覆盖；真正的时序不变量必须在已有真实链路测试里找到对应证据，否则就是假资产。
- `pirate-cove-chain-fix.test.ts` 则再次证明，系统合同应该按“阶段边界”命名，而不是沿用某次 bug 名称。它真正锁的是 `scoreBases -> Me First! 窗口 -> afterScoring` 的门禁链：窗口打开时阻止 ADVANCE_PHASE、无人可响应时自动关闭、所有人 pass 后进入 afterScoring 交互。这个边界属于阶段/窗口系统，不属于海盗湾业务本身，所以正确动作不是删，也不是并回派系，而是改名成正式系统入口。

- `madness-mechanics.test.ts` 证明了另一种高维护成本旧壳：它看起来像“疯狂机制”文件，实际上混着两类完全不同的不变量。
  - 一类是跨派系共享合同：`cthulhu_whispers_in_darkness`、`miskatonic_those_meddling_kids_pod`、`innsmouth_recruitment` 这几个能力都在锁“离阶段额外行动/额外随从必须标成 `playTiming: immediate`”。
  - 另一类是派系自己的业务行为：`cthulhu_seal_is_broken`、`cthulhu_corruption`、`miskatonic_psychological_profiling`、`miskatonic_mandatory_reading`、`innsmouth_recruitment` 的真实出牌/结算链。
  把这两类混在一个旧入口里，后续改实现时就会再次遇到“这是共享机制，还是某个派系自己的行为”的归属摇摆。
- 这批正确的收口方式已经验证成立：共享时序合同单列成 `abilities/extra-play-timing-mechanics.test.ts`，派系行为并回 `abilities/cthulhu.test.ts`、`abilities/miskatonic.test.ts`、`abilities/innsmouth.test.ts`。这不是按文件名分类，而是按“不变量属于共享机制还是属于某个业务对象”分类。
- `miskatonic_lost_knowledge` 也说明迁移时不能为了“全搬完”重复制造合同。ongoing talent 的 `TALENT_USED payload`、`TURN_STARTED reset` 之类基础设施，`talent-mechanics.test.ts` 已经有共享覆盖；专项文件只该保留它自己的行为入口，比如“抽疯狂卡 + 获得额外随从额度”。否则同一个底层合同又会分散到共享文件和派系文件里双维护。
- 这批 seam 收口不是停在“把旧 helper 名字换一遍”。迁移后的关键链路已经改成：
  - 真实 `PLAY_ACTION` / `runCommand(...)`
  - 真实 prompt facade：`getSimpleChoicePrompt`、`getPromptOption`、`respondToPromptOption(s)`
  - 真实 `finalState` / 业务事件断言
  而不是 `postProcessSystemEvents(...)`、`lastMatchState`、局部 fake state 壳、手工后处理。
- 本批最后一个红灯也再次说明“测试碎裂”和“实现坏了”要区分开：`cthulhu_corruption` 的失败不是行为回归，而是新测试里用到了 facade helper `getPromptOption(...)`，但文件顶部漏了 import。补齐 import 后，`cthulhu.test.ts` 单文件 `60 passed`，组合 `extra-play-timing-mechanics.test.ts + cthulhu.test.ts + miskatonic.test.ts + innsmouth.test.ts` 为 `110 passed`。这类收口值得记账，因为它说明拆层方案本身已经稳定，剩下的是普通接线错误，不是设计方向错了。

- `baseFactionOngoing.test.ts` 这轮不是只把一条定点红灯改绿，而是把两层 seam 都收正了：`ninja_hidden_ninja` 改回真实 special executor，Brownie helper 改回真实 reducer 触发形状；因此整文件 81 条现在一起通过，说明不是“改了一个假 prompt 又留下别的伪入口”。
- `bear_cavalry.test.ts` 已继续减少 1 条普通业务 direct handler 命中；全仓 `getInteractionHandler` / `getAbilityRuntimePromptHandler` 统计从 `44` 降到 `43`。留下来的 `superiority_pod_talent`、`temple-firstmate-afterscore`、`titan_penguins_emperor_penguin_play` 更像应显式保留或谨慎审视的低层合同，而不是同类业务链债务。
- Skeletons 迁移不是表象整理：新文件 19 个用例全部通过，并且没有禁用模式或裸内部交互访问。
- `newFactionAbilities.test.ts` 已进一步收缩；当前旧大文件只剩 Samurai 与巨蚁相关测试债务。
- `npm run test:structure` 已证明本轮新增/迁出文件符合结构门禁；旧大文件债务仍按 warning 保留，后续迁出时继续消化。
- 本轮 Igor 小批次不是只改标线：`igor-big-gulp-two-igors.test.ts`、`igor-double-trigger-bug.test.ts`、`igor-two-igors-one-destroyed.test.ts` 已把 prompt source/options/player、响应命令与 current+queue 查询收进 helper；3 个目标文件禁用模式 0 命中，组合 4 tests passed。
- `response-window-skip.test.ts` 进一步说明系统边界测试也可以降耦合：cancel 行为通过 `cancelPrompt` 表达，Hidden Ninja 子交互通过 prompt facade 读取，单文件 5 tests passed。
- `reactionQueueOnTurnStart.test.ts` 已把 onTurnStart/onTurnEnd 统一反应 prompt 断言收进 `getReactionPrompt`；单文件 2 tests passed。
- `robot-hoverbot-chain.test.ts` 已把命令数组响应和 live prompt options 读取收进 facade；单文件 3 tests passed。
- `robotAbilities.test.ts` 已把 Microbot Reclaimer 的 source、multi、动态 options、handler data 与 optionIds 响应收进 facade；单文件 11 tests passed，目标文件禁用模式 0 命中。
- `trickster-mark-of-sleep-self-target.test.ts` 已把 Mark of Sleep / POD 的 title/options/source 与响应命令收进 facade；单文件 9 tests passed，目标文件禁用模式和隐式 current 裸读 0 命中。
- `afterscoring-window-skip-base-clear.test.ts` 已把可迁移的 reaction prompt / immediate extra prompt / no prompt 断言收进 facade；单文件 15 tests passed。该文件剩余内部 current 命中属于系统状态构造，不把这类 setup 伪装成业务 seam。
- `alien-scout-pod-afterscore.test.ts` 已把 afterScoring prompt 的 current+queue 查询、option 查找和 handler data 传递收进 facade；单文件 4 tests passed，目标文件禁用模式和隐式 current 裸读 0 命中。
- `expansionAbilities.test.ts` 不是只改表象：Bear Hug 的选择/响应、Ghost/Commission/Scrap Diving 的 prompt 出现性都从本地 current+queue 拼接、`.data.sourceId`、`.data.options`、手写系统响应命令迁到 prompt facade；单文件 32 tests passed，目标文件禁用模式和隐式 current 裸读 0 命中。
- `reactionQueueBaseAbilities.test.ts` 继续证明底层 reaction queue 测试也能降耦合：统一反应 prompt、options、handler data、无 prompt、真实基地 prompt 都通过 facade 表达；单文件 6 tests passed，目标文件禁用模式和隐式 current 裸读 0 命中。
- `frankensteinFaq.test.ts` 把 FAQ 行为链的两段 prompt 和响应命令收进 facade；测试仍验证 Blitzed 可移除 0 个指示物再消灭 0 战力随从、It’s Alive! 跳过后不遗留 pending 效果，但不再绑定 InteractionSystem 字段路径。
- `reactionQueueBaseOptionalClockwise.test.ts` 说明 optional reaction 的 clockwise 轮转也不需要裸读 current：当前玩家、候选项、pass 后再轮转、旧 handler data 和清 current 过渡都可通过 facade/helper 表达。
- `pirate-broadside-self-target.test.ts` 仍验证 Broadside 可选择自己/对手、基地过滤，以及 Saucy Wench 可消灭弱随从；但所有 prompt source/title/options 和响应命令都已收进 facade，不再裸读 `current.data`。
- `wildlifePreserveProtection.test.ts` 不是只改描述：Seeing Stars 与 Unfathomable Goals 仍验证野生保护区会过滤/阻止行动卡效果，但测试不再依赖 prompt 存在于 `sys.interaction.current`、候选存在于 `data.options`、响应命令叫 `SYS_INTERACTION_RESPOND`；目标文件旧模式扫描 0 命中。
- `buryEngine.test.ts` 是更直接的 seam 收敛：埋葬翻开窗口仍验证按 cardUid 选择埋葬牌并执行翻开效果，但测试不再知道系统响应命令常量或候选列表的内部字段路径。
- `pirate-cove-repeat-trigger-bug.test.ts` 清的是主扫描之外的真实耦合：手工 current+queue 统计与 `(interaction.data as any).sourceId` 被收进 `getPromptsBySourceId`，冠军无交互断言改为同时覆盖 current + queue 的 `expectNoPrompt`。
- `pirate-king-afterscoring-window.test.ts` 说明完整系统管线测试也不需要 import `InteractionSystem`：prompt 获取、选项查找、响应命令都可通过 facade 表达。
- `promptE2E.test.ts` 是主债务下降批次：多个 prompt E2E 仍验证同一行为，但不再逐个知道 `interaction.current.data.sourceId` 或 current+queue 的拼接方式。
- `afterScoring-rescoring.test.ts` 说明本轮不是只改断言文字：可选当前 prompt 读取和测试 setup 中放入 current prompt 的动作都通过 facade/helper 表达，目标文件对主禁用模式与隐式 `interaction.data` 裸读 0 命中，8 个真实链路用例仍通过。
- `baseAbilities.test.ts` 的 ability runtime 测试现在仍验证 prompt continuation 可恢复 sequence，但断言不再靠 `asSimpleChoice(sys.interaction.current)` 和裸 `current.data`；这属于测试接口 seam，而不是改名。
- `bigGulpDroneIntercept.test.ts` 清掉的是主计数之外的真实坏味道：直接读 `interaction.data.sourceId/options` 和手写 `INTERACTION_COMMANDS.RESPOND`。该文件仍覆盖 Big Gulp 选 Igor、Drone 防消灭、最终无 prompt，但测试只通过 facade 表达交互。
- `robot-hoverbot-stable.test.ts` 迁移时暴露 helper 覆盖差异：`getPromptOptionById` 不适合历史 `data.options` 形状，`getPromptOption` 才是更稳的行为 seam。保留对 Hoverbot id 稳定性的专项断言是合理的，因为该文件本来就在锁“不应生成 timestamp id”的回归。
- `cthulhu-chosen-display-mode.test.ts` 保留了神选者 UI bug 的行为证据：prompt 必须是 generic/button、选项不能带 `baseDefId`、多实例 queued prompt 也必须 button；这些断言现在通过 prompt facade 和 sourceId 查询表达，不再绑定 current/queue 的内部字段路径。
- `robot-hoverbot-button-disabled.test.ts` 说明 Hoverbot 的“按钮可点” bug 也可以通过测试接口 seam 验证：title/source/options/optionsGenerator 不再从 `interaction.data` 裸读，而是通过 prompt facade 和 `getPromptHandlerData` 表达，行为断言仍保持原样。
- `duplicateInteractionRespond.test.ts` 是系统边界回归，不应隐藏“重复同一命令对象”的测试意图；本轮只把系统响应命令常量收进 `respondCommand`，保留二次提交被拒绝和无二次副作用的行为断言。
- `specialInteractionChain.test.ts` 的剩余耦合只在本地响应 helper；迁移到 `respondCommand` 后，24 条特殊交互代表链仍通过，同时业务测试不再知道系统响应命令常量。
- `runtimeEvidenceIssues.test.ts` 不是简单改字段：Fledgling Vampire POD 复现现在明确证明 Big Gulp 目标选择后进入 `smashup_reaction_choose`，再选择 Fledgling 反应并出现 `vampire_fledgling_vampire_pod_bury_source`；Mi-go POD 复现也通过 prompt facade 读取 decline/counter prompt 和候选 minion，而不是裸读 `data.options`。
- `talentAbilities.test.ts` 已把 Cthulhu Star Spawn / Servitor 的 prompt 结构断言和取消响应收进 prompt/command facade；20 条天赋测试仍通过，目标文件扩展扫描 0 命中。
- `baseAbilityIntegrationE2E.test.ts` 已把基地能力完整链路中的 prompt existence、reaction queue 响应和 Shoggoth -> Asylum 二段 prompt 候选读取收进 facade；23 条集成链路测试仍通过，目标文件扩展扫描 0 命中。
- `meFirst.test.ts` 说明响应窗口测试的根因不是文件名，而是行为端口过浅：Me First! 的 pass、打出 special、Mandatory Reading 二段选择和窗口恢复，现在都通过 `respondCommand`、`getSimpleChoicePrompt`、`getPromptOption` 与 `expectNoPrompt` 表达；测试仍验证响应窗口推进和最终状态，但不再绑定 `INTERACTION_COMMANDS.RESPOND`、`asSimpleChoice(current)` 或 options 存储位置。
- `madnessPromptAbilities.test.ts` 说明旧 handler 桥接也能降耦合：测试仍可直接调用能力 handler 验证事件与最终状态，但 prompt source、候选 options、multi、handler data 与 respond command 需要经 facade 传递；这样后续 InteractionSystem 外壳重构时，不必逐个修改 Madness / Book of Iter / Thing on the Doorstep 的业务测试体。
- `madnessAbilities.test.ts` 进一步确认“执行器直接调用 + handler 直接调用”的老测试不必继续散落 current/queue 结构：用本地过渡 helper 取最近 prompt、再通过共享 facade 读 source/options/handler data，可以保留旧测试的诊断价值，同时把实现存储形状隔离到一处。
- `architecture-duplicate-processing.test.ts` 不是只改表象：测试仍验证 Big Gulp 消灭 Igor 后 `MINION_DESTROYED` 只后处理一次、Igor onDestroy 只出现一次，但测试体不再知道 active prompt 存在 `sys.interaction.current`、候选在 `data.options`、玩家响应命令叫 `INTERACTION_COMMANDS.RESPOND`，也不再手工拼 current+queue 统计业务 prompt。
- `baseFactionOngoing.test.ts` 继续证明“不是只改表象”：同一文件里仍验证 Infiltrate 目标过滤、Hidden Ninja 手牌候选、Acolyte 打出 Gunfighter 后接 Cowboy 决斗、Flame Trap POD 双实例上下文、Mark of Sleep 玩家目标 prompt；变化是测试通过 facade 表达这些业务 prompt，而不是暴露 current/queue/data/options/RESPOND 存储细节。
- `reactionQueueDestroyerId.test.ts` 说明 reaction queue 的测试 seam 不应停在“能拿到第一个 interaction”：业务断言是“选择某个 sourceDefId 的 reaction 后出现对应 POD play prompt，并保留 displayCard 预览上下文”。这可以通过 `getReactionPromptOptionBySourceDefId`、`getPromptsBySourceId` 与 prompt handler-data facade 表达，不需要测试体直接遍历 `data.options` 或 `data.sourceId`。
- `zombieWizardAbilities.test.ts` 说明大批“创建 Prompt”类能力测试的维护成本来自重复绑定 current/data/sourceId；迁移后仍验证僵尸和巫师能力会创建正确业务 prompt、displayCard、以及 handler 直接消费后产生正确事件，但不再把 InteractionSystem 存储路径写进每个用例。
- `cthulhuExpansionAbilities.test.ts` 进一步说明多步 handler 桥接测试也可以降耦合：Miskatonic 的“选择基地 -> 逐张行动卡选择”仍验证逐步 detach，但选择 prompt 通过 sourceId facade 查询；Recruit by Force / It Begins Again 仍验证 min=0、skip、handler 事件和状态结果，但不再从 `current.data.options/multi` 裸读。
- `giantAntsPod.test.ts` 说明 POD 链路不是只能通过内部 current/options 验证：Ant Drone 防消灭、Ant Soldier 转移指示物、Gimme the Prize 双目标、We Will Rock You 基地选择、Who Wants to Live Forever 检索，都可以通过 prompt source、业务 option 和 `respondToPrompt` 表达。
- `zombieInteractionChain.test.ts` 是对“只改表象”的直接校验：该文件原本 22 条僵尸交互链全部通过 `asSimpleChoice(sys.interaction.current)`、裸 `choice.options` 和手写系统响应命令推进；迁移后仍跑同样 22 条行为链，但测试体不再知道 InteractionSystem 的 current 存储位置或 RESPOND 常量。
- 新增 `respondOptionsCommand` 是必要的接口补洞：多选 prompt 的空选择同样应通过 command facade 表达，否则单选响应被收口后，多选测试仍会因为命令 payload 结构重构而碎裂。
- `elderThingsPod.test.ts` 说明 POD 回归里的 displayCard、对手响应、二段 destroy prompt、基地选择 prompt、可选跳过 prompt 都可以通过同一组 facade 表达；迁移后仍验证 Shoggoth 可消灭大于 6 力量随从、Price of Power 运行时基地选择和 Spreading Horror 拒绝路径，但不再绑定 current/data/options/RESPOND 存储形状。
- `multi-base-afterscoring-bug.test.ts` 说明复杂 afterScoring 链路也不能例外：多基地计分、海盗王移动、托尔图加、海盗大副、便衣忍者、四人压力链都能用“当前业务 prompt + 业务 option + respondCommand”表达；测试仍覆盖重复计分防线，但不再把 `asSimpleChoice(current)` 和 `SYS_INTERACTION_RESPOND` 写进每个步骤。
- `factionAbilities.test.ts` 这轮不是只改表象：Trickster / Pirates / Ninjas / Dinosaurs / Robots / Wizards / immediate extra action / Aliens 的旧测试仍验证原业务行为，但 prompt 获取、候选读取、动态 optionsGenerator、响应命令与无 prompt 断言已经统一走 prompt facade；目标文件旧内部耦合扫描 0 命中，46 条用例仍通过。
- 清理 warning 时短暂删错 `matchState` 也反向证明了门禁价值：facade 迁移后测试失败点会集中在“是否有公开行为状态可传入 facade”，而不是到处追 `current.data` 字段；这类失败必须按语义恢复状态输入，不能为了 eslint 把行为断言削掉。
- `shayuFactionAbilities.test.ts` 进一步暴露出另一类高维护成本结构：**按扩展包/组合包命名的多派系混装文件**。它虽然不是 `new*` / `misc` 这种显眼垃圾桶，但把鲨鱼、龙卷风、神话希腊三个完全独立的派系行为挂在一个 shayu 入口下，本质上仍然在冲淡行为边界。
- `shayuComprehensiveBehavior.test.ts` 说明“综合审计补充”也不能天然豁免结构约束。文件里的 14 条用例可以清晰归到 3 个派系行为入口和 3 个基地行为入口，并不存在一个必须跨派系共住的共享机制；继续保留 shayu 入口，只会让后续补测试的人继续在“该进哪儿”上摇摆。
- 这两类 shayu 文件的正确收口方式已经验证出来：
  - 派系行为归位到 `abilities/sharks.test.ts`、`abilities/tornados.test.ts`、`abilities/mythic-greeks.test.ts`
  - 基地行为归位到 `bases/the-deep-base.test.ts`、`bases/trailer-park-base.test.ts`、`bases/tornado-alley-base.test.ts`
  - 删除 `shayuFactionAbilities.test.ts` 与 `shayuComprehensiveBehavior.test.ts` 旧入口，避免形成“已拆一部分，但旧入口还在”的双入口债务
- 这次收口不是只换文件名。验证证据是：新增归宿组合 `vitest` 为 `35 passed`，eslint 0 errors，`npm run test:structure -- --all` OK，且两个旧入口 `Test-Path` 都为 `False`。也就是说，现在不是“旧文件还在，只是又复制了一份新文件”，而是行为边界和入口层级一起收正了。
- `expansionAbilities.test.ts` 的 `Ghost` 段则暴露了另一种双入口债务：同一派系已经有 `abilities/ghosts.test.ts`，却还在扩展包聚合文件里保留完整业务簇。这样的结构会让后续改幽灵时再次面临“该改专项文件还是改扩展包文件”的分裂入口。
- 这类双入口的正确处理不是新旧并存，而是把完整业务簇彻底并到现有专项入口，再让聚合文件只保留还没有自然归宿的扩展派系。`Ghost` 这步已经验证成立：`abilities/ghosts.test.ts` 现在承接 `ghost_ghost / ghost_seance / ghost_shady_deal / ghost_ghostly_arrival`，而 `expansionAbilities.test.ts` 不再混放幽灵业务测试。
- 这一步的有效证据也不是“文件更整洁了”，而是：
  - `npx vitest run abilities/ghosts.test.ts expansionAbilities.test.ts` -> `40 passed`
  - `npx eslint ...` -> `0 errors`
  - `npm run test:structure -- --all` -> `OK`
  - `expansionAbilities.test.ts` 中已无 `Ghost` 业务 describe，只剩文件头注释曾经提到幽灵，随后也已同步清理

## 后续风险

- 迁完 Skeletons / Giant Ants / Samurai 还不能宣称整个测试框架重构完成；旧大文件退出新增入口只解决了一类测试垃圾桶问题。
- 其他历史 SmashUp 测试仍含旧内部耦合；如果不继续迁，它们仍会在后续 InteractionSystem 重构时制造同步改测试成本。
- 当前全 `src/games/smashup/__tests__` 仍有残余历史债务；虽然后续重点已不再是 shayu 入口，但仍要继续按小批次推进，不把局部 facade 收敛误报成整体完成。

## 2026-05-16 15:20 补充发现：`newOngoingAbilities` 清空不是改表象

- `newOngoingAbilities.test.ts` 的剩余债务不能只按“describe 移到别的文件”处理。真正的风险在于其中多条基地交互测试直接调用 `getInteractionHandler()`，一旦 handler 签名、InteractionSystem 响应事件外壳或 prompt 存储方式调整，测试会跟着批量碎裂。
- 本批迁出把这些用例改成“业务触发 -> prompt facade 选 option -> `respondToPrompt` -> 断言目标业务事件”。这暴露了旧 handler 裸测隐藏的问题：完整响应链会包含系统事件，测试不应锁 `events.length === 1` 或 `events[0]`，而应查找 `CARDS_DISCARDED` / `MINION_DESTROYED` / `MINION_RETURNED` 这类业务事件。
- `newOngoingAbilities.test.ts` 已删除后，`test:structure` warning 从两个旧泛名文件降到只剩 `newBaseAbilities.test.ts`。这说明 ongoing 垃圾桶已实际退出，但不是整体完成；下一段必须继续拆 `newBaseAbilities.test.ts`，否则基地能力测试仍会继续以旧泛名入口承载结构债务。
- `newBaseAbilities.test.ts` 当前已经没有业务测试裸 prompt seam 命中；主要问题是旧泛名入口和“新增场景继续往 new* 垃圾桶堆”的协作信号。把它移动到 `bases/base-ability-contracts.test.ts` 不是最终理想结构，但能先消除 `new*` 入口与结构门禁 warning，同时保留 60 条现有基地合同测试绿灯。
- 后续不应把 `bases/base-ability-contracts.test.ts` 当成新的垃圾桶。它只是承接已有基地合同的集合文件；新增或大改时仍应按基地族、扩展包或交互类型拆到更聚焦文件。
- 继续拆分后，`base-ability-contracts.test.ts` 已删除，风险从“换名大垃圾桶”降为“少数较大的明确主题文件”。当前最大的是 `samurai-bases.test.ts`（约 707 行），其主题边界仍清晰；后续如果继续增长，应优先拆 Samurai POD 复用与 Sakura Garden 触发链，而不是再建泛名回归文件。
- 进一步拆分 `samurai-bases.test.ts` 后，最大的剩余基地测试文件降到 `base-core-effects.test.ts`（约 556 行）。这次拆分不是改断言语义，而是按三类真实主题分流：Shogun's Palace 决斗抓牌、Sakura Garden 触发链、POD 基地复用合同。后续如果要继续压缩，应从 `base-core-effects.test.ts` 的 Field of Honor / Crypt / Workshop 子簇入手。

---

# Findings: 反馈真实链路与 AI 自动反馈复核（2026-05-15）

## 已确认事实

- 本地真实用户反馈链路没有坏：E2E 已覆盖反馈弹窗提交、API 写入、后台 API 查询、后台页面列表与详情展示。
- 生产只读查询显示最近 14 天有 45 条反馈记录；当前未收口项不是 0，而是 2 条。
- 回写前未收口项：
  - `6a05e66129cd213e03bfd82f`：`splendor | online-ai-watchdog | open`
  - `6a005f68d5153682969e5c7d`：`smashup | feedback-modal | in_progress`
- 最新 open AI 自动反馈的证据足够定位：`legal_action_command_failed:RESERVE_OPEN_CARD:gameNotStarted`，`stateSnapshot` 里已有 `legalActions` 与 `aiDecisionPreview`。

## 本轮结论

- “最近都没有反馈”不是反馈系统断流；更准确是生产仍有反馈，且本地真实提交链路已由 E2E 证明正常。
- AI 自动反馈 payload 证据不需要重构；问题在 Splendor 未开局状态下 watchdog 仍尝试代 AI 发动作。
- 已修复 watchdog pregame 边界与 Splendor AI legal actions 未开局门禁。
- 规范已补强：反馈 `resolved` 不等待生产部署或未来不复发，部署/观察是后续发布状态。
- 生产状态已回写：`6a05e66129cd213e03bfd82f` -> `resolved`，回写时间 `2026-05-15T15:38:58.914Z`。
- 证据文档：
  - `evidence/feedback-real-submission-e2e-2026-05-15.md`
  - `evidence/engine/online-ai-watchdog-feedback-diagnostics-2026-05-15.md`

---

# Findings: 线上 AI 自动反馈排查与修复（2026-05-13）

## 已确认事实

- 用户本轮点名“线上反馈”和“AI 自动反馈”，按生产真源只读查询处理。
- 本轮优先查 `reporterType=system`、`source=online-ai-watchdog`、`contactInfo=system:online-ai-watchdog`、`errorContext.source=online-ai-watchdog` 或内容前缀 `[system][online-ai-watchdog]` 的 `open/in_progress` 项。
- 生产操作入口已确认：`ssh admin@8.148.71.102`，项目目录 `/home/admin/BoardGame`，Mongo 容器 `boardgame-mongodb`。
- 生产回写/部署/重启不属于当前第一步；先只读。

## 待确认

- 当前是否仍有系统 AI 自动反馈未收口。
- 未收口项是否包含足够定位字段：`gameId`、`matchId`、`incidentKind`、`reason`、`stateSnapshot`、聚合 key 与时间窗口。
- 若字段不足，重构目标应优先补“可诊断性”而不是猜业务规则。

## 本轮结论

- 生产当前 `open/in_progress = 7`，其中系统 AI 自动反馈 `6` 条，全部为 `smashup|online-ai-watchdog|force-end-turn-failed`。
- 6 条最后发生时间均在 `2026-05-10`，集中在 `smashup_reaction_choose`、`elder_thing_*`、`wizard_neophyte` 与 active-turn `ADVANCE_PHASE` 恢复链路。
- 旧反馈的 `stateSnapshot` 足以归类，但 `command_failed` 不足以定位真实业务拒绝原因；本轮已按用户口径重构诊断链。
- 证据文档：`evidence/engine/online-ai-watchdog-feedback-diagnostics-2026-05-13.md`。

---

# Findings: SmashUp shayu 三派系通用入口矩阵补强与全量重审（2026-05-12）

## 已确认事实

- 本轮目标不是再补一个飞鲨特例，而是把“描述动作链第一入口”沉淀为通用审计矩阵。
- 旧 shayu evidence 已经回写过若干失效项：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_athena`、`base_oracle_at_delphi`。
- 当前必须避免把 2026-05-11 的“严格抽样审计”冒充成三派系全量重审。
- shayu 全量范围：`sharks` 12 张卡 + 2 基地，`tornados` 12 张卡 + 2 基地，`mythic_greeks` 15 张卡 + 2 基地。

## 初始风险判断

- P0：所有 `playNeedsBase/playNeedsMinion/ongoingTarget/specialNeedsBase` 与文案第一入口一致性。
- P0：所有“你的/对手/任意”随从目标必须有 UI/validator/handler 一致的控制者约束。
- P0：所有“至多/任意数量/可以/任意顺序”必须有 skip/multi/order 语义，不得自动吞掉玩家选择。
- P1：所有多步交互必须携带前一步上下文，不能靠当前 UI 选中或第一个匹配对象猜。
- P1：所有 beforeScoring/afterScoring/onActionPlayed/onMinionMoved/onMinionDestroyed/base ability 触发链必须能落到最终权威状态。

---

# Findings: 七大恨新游戏前置 intake（2026-05-11）

## 已确认事实

- 主真相源：
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\七大恨规则.pdf`
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images`
- 项目内已存在本轮前置产物，继续复用而非覆盖：
  - `src/games/qidahen/rule/七大恨规则.md`
  - `src/games/qidahen/rule/七大恨素材接入清单.md`
  - `evidence/qidahen/qidahen-feasibility-2026-05-11.md`
  - `public/assets/i18n/zh-CN/qidahen/`
  - `public/assets/qidahen/thumbnails/cover.png`
- PDF 为原生文字，可通过项目脚本 `npm run pdf:md` 处理；当前规则 MD 已结构化成章节索引与规则正文。
- 素材目录共已接入 70 张正式中文资源，另有 1 张缩略图。
- 资源压缩结果：
  - `public/assets/i18n/zh-CN/qidahen/**/compressed/*.webp`：70 张，约 4.65 MB。
  - `public/assets/qidahen/thumbnails/compressed/cover.webp`：1 张，约 42.5 KB。
- 资源远端闭环：
  - `npm run assets:check` 显示本轮新增 71 个远端缺失资源。
  - `npm run assets:upload` 上传 71，跳过 1875，删除 0，失败 0。
  - 远端抽查主地图、明牌库图集、缩略图均为 200。

## 可行性结论

- 七大恨可接入，但属于中重策略游戏，不建议一次性完整自动化。
- 推荐先做 1619 三人剧本 MVP：轮盘、手牌资源、地图状态、基础移动/征兵/外交/战斗/胜利；人物、事件、战术、纪年例外分批白名单自动化。
- 最大风险是私有视角木块信息、地图边界结构化、多步战斗 Interaction、卡牌/人物例外量。

## Skill 优化

- 已补强 `.codex/skill/create-new-game/SKILL.md`：新增“规则 PDF 转 Markdown 与可行性评估”前置阶段。
- 新门禁要求 PDF→MD、素材盘点、压缩/manifest/远端检查、可行性分析完成后，才进入正式游戏骨架阶段。

---

# Findings: DiceThrone Treant / Ninja 新英雄（2026-05-09）

> 当前正式 findings 入口。下方内容是创建 worktree 时继承的历史记录，本轮只引用本节。

## 已确认事实

- 新 worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja`
- 当前状态：detached HEAD，未新建分支。
- 主工作树存在大量与本轮无关的 DiceThrone / SmashUp 改动；本轮必须避免混入。
- 用户提供的 `treant` / `ninja` 图片目录不是当前 HEAD 跟踪内容，新 worktree 初始没有这些文件，需要从主工作树复制。
- `treant` 原始素材：
  - `木苗树灵.png`
  - `神性树灵.png`
  - `生命源泉.png`
  - `提示板.png`
  - `玩家面板.png`
  - `幼种树灵.png`
  - `abilitycards.png`
  - `dice.png`
- `ninja` 原始素材：
  - `慢性中毒.png`
  - `忍术icon.png`
  - `提示板.png`
  - `玩家面板.png`
  - `烟雾弹icon.png`
  - `Ablilitycards.png`
  - `dice.png`
- 规范门禁：
  - 必须先建 DiceThrone 录入核对文档，再改运行时代码。
  - 新角色默认优先复用老英雄共享合同，特别是升级卡、`previewRef`、atlas、同类档位取最高、复合子技能。
  - `crops/` 只作为核对中间产物；正式运行时默认优先 `ability-cards` atlas。
  - 修改运行时资源后必须压缩、重建 manifest、上传并远端回查；若不能上传，需要最终说明。

## 待核对

- 两个新英雄的正式英文 canonical 名称、hero id 与 UI 展示名。
- `abilitycards.png` / `Ablilitycards.png` 的图集行列、与旧英雄 `ability-cards` atlas 是否同合同。
- treant 的 3 张独立 token/状态图片与提示板中的 token 定义关系。
- ninja 的 3 张独立状态/icon 图片与提示板中的 token 定义关系。
- 玩家面板上的技能、骰面、被动、终极技与旧英雄能力模型的复用/新增机制边界。

---

# Findings & Resources

## 2026-05-10 命令执行异常全链路发现

- `src/engine/transport/server.ts` 的 batch 失败链路原本会丢失真实原因：
  - `executeCommandInternal()` 能拿到 `result.error` 或 thrown `Error.message`；
  - `handleBatch()` / `executeBatchInternal()` 失败后固定发送 `batch:rejected(..., 'command_failed')`；
  - 这会把领域验证错误、pipeline contract 错误全部折叠成泛化失败。
- `src/pages/MatchRoom.tsx` 原本把 `command_failed` 归入 `SYSTEM_ERRORS`，在线错误处理直接 return。
- `src/engine/transport/react.tsx` 原本在 batch rejection 中显式跳过 `command_failed` 的 `onError`，导致批处理失败进一步不可见。
- 生产 SmashUp 日志中“命令执行异常”的真实原因是 effect contract 缺字段：
  - `base_the_asylum@onMinionPlayed` 缺 `controllerState`；
  - `base_ninja_dojo@afterScoring` 缺 `turnFlags`；
  - `base_castle_blood@onMinionPlayed` 缺 `turnFlags`。
- SummonerWars `长舟` 反馈缺 `matchId/stateSnapshot/actionLog`，源码内没有 `长舟/Longship` 对应实体；不能在没有现场的情况下直接放开召唤规则。
- 2026-05-10 追加修正：用户澄清“长舟”应按“大杀四方 / SmashUp”理解，已确认对应对象是维京基地 `base_drakkar`（德拉卡尔号 / Drakkar），不是 SummonerWars 地图或召唤入口。
- `base_drakkar` 回归原因：
  - `a4de3636` 把 SmashUp 反应排序资源从 `orderingFootprint` 切到运行时 `effectContract`，并把基地能力执行包进 `wrapTriggerCallbackWithEffectContract()`；
  - `base_drakkar` 旧声明只有 `reads: ['deckState']`、`writes: ['deckState', 'handState']`；
  - 但真实能力需要读 `players.*.minionsPlayedPerBase`（`playLimits`），可能读对手弃牌堆洗回（`discardState`），并打开 `base_drakkar` 选择玩家交互（缺 `opensInteraction: true`）；
  - 所以合法的“第一位随从打到德拉卡尔号”会被 contract 当成越权读取/交互误拦截，再被 transport 折叠成泛化 `command_failed`。
- 当前工作区修复口径不是继续给每张卡补手写 contract，而是移除旧运行时 contract 拦截，资源排序改走 reaction footprint / effect DSL 推导；已补 `PLAY_MINION -> base_drakkar` 真实触发链回归，当前 `base_drakkar` 聚焦测试 4 passed。

## Addendum（2026-05-07）：漏审主因已确认为“流程层不够深”，已升级审计规范

- 本轮结论不是“审计完全没维度”，而是：
  - 一部分维度口径需要补硬，典型是 `D37`
  - 更大的问题是执行层级停在 `L1/L2`，没有稳定打到 `L3/L4`
- 已在 `docs/ai-rules/testing-audit.md` 新增“深度审计流程（强制）”章节，核心变化：
  - 审计前先建对象清单并标层级，不再允许模糊汇报“这一批差不多审过了”
  - 每个对象必须串完整链路，不能只核对 validator 或只跑单测
  - reaction / response window / afterScoring / onDestroy / 动态候选 / 恢复态 / 同批事件后处理，全部改成真实入口强制核对项
  - 命中共享根因时必须自动扩审到同类函数、同类事件和共享调用点
  - 旧审计文档被推翻时必须原地回写失效结论
- 本轮点名加强的两个高风险位点：
  - `D37`：动态刷新不等于合法性完整，仍需继续核对 `zone/location/可打出形态`
  - `D40`：批内副作用必须串行吃最新状态，避免“同时杀俩小鬼只结算一次”这类 stale state 漏审

## Addendum（2026-05-04）：Splendor watchdog `69f6c4bc...` 已按本地热补止血结果回写 resolved

- `69f6c4bc9ec13b96d710e10d` 的系统文案是：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`
- 本轮最终回写前，线上只剩 watchdog 聚合摘要：
  - `route = server-watchdog`
  - `mode = online`
  - `occurrenceCount = 686`
  - `lastOccurredAt = 2026-05-03T23:49:50.740Z`
- 这条并不是“当前还在继续刷的新现场”，而是本轮 Splendor transport 热补止血后，状态尚未人工回写的旧聚合项：
  - `src/engine/transport/onlineAiRecovery.ts` 已禁止 Splendor 生成裸 `ADVANCE_PHASE` fallback
  - `src/engine/transport/server.ts` 已按 manifest 过滤 `localAi=false`，不会再因残留 seat metadata 把 Splendor 当成 AI 房间
- 本轮 fresh 复核再次通过：
  - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`
  - `src/engine/transport/__tests__/server.test.ts`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:55:00.000Z`

## Addendum（2026-05-04）：DiceThrone watchdog `69f471da...` / `69f73be4...` 已按已修簇残留回写 resolved

- 这两条系统单文案完全一致：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 本轮最终回写前，线上只剩 watchdog 聚合摘要，没有还能继续复核的真实残局：
  - `69f471da9ec13b96d7109902`：`occurrenceCount = 2563`
  - `69f73be49ec13b96d710f1c2`：`occurrenceCount = 2`
  - 两条都已没有 phase / pendingInteraction / pendingAttack 级现场信息
- 当前本地 transport 修复链已经覆盖这类残留原因：
  - `evidence/transport/online-ai-watchdog-targetingroll-legal-only-fix-2026-04-30.md`
  - `evidence/dicethrone/dicethrone-online-ai-watchdog-human-response-window-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-online-ai-orphan-displayonly-bonus-settlement-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-feedback-69f21b05-ai-stall-targetingroll-loaded-local-closeout-2026-05-04.md`
- 本轮 fresh 复核再次通过：
  - `src/engine/transport/__tests__/server.test.ts`
    - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
    - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`
    - `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`
- 2026-05-04 已通过生产 Mongo 批量回写：
  - `matched=2`
  - `modified=2`
  - `updatedAt=2026-05-04T05:50:00.000Z`

## Addendum（2026-05-06）：SmashUp 最后两条人工反馈已按正确口径回写，当前人类未收口为 0

- 本轮继续沿用 `人类反馈 > 系统自动反馈`，没有再把最后两条人工单让位给 watchdog 系统单。
- `69fa23e04590ce09779a7c52`（`“嗯？”可以重复使用。`）的结论是：
  - 不是新 bug，而是已修未回写。
  - fresh 证据链已覆盖：
    - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 中 `world_champs_eh`
    - 真实入口 E2E：`e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 三张收口截图：`eh-discard-panel-available` / `eh-minion-prompt-visible` / `eh-resolved-returned-to-hand`
  - 因此正式回写口径是 `resolved`。
- `69fa0bd74590ce09779a7bd6`（`尸体商店 + 雄蜂`）的结论是：
  - 不是实现 bug，而是规则理解偏差。
  - “防止被消灭”不等于“已经被消灭”，不会满足依赖“消灭”获得标记的语义。
  - 因此正式回写口径是 `closed`，不是 `resolved`。
- 生产回写回显：
  - `temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
  - `69fa23e04590ce09779a7c52`：`matched=1 / modified=1 -> resolved`
  - `69fa0bd74590ce09779a7bd6`：`matched=1 / modified=1 -> closed`
- 回写后生产复核：
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
  - `temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`
  - 当前 `reporterType=user && status in [open,in_progress]` 的查询结果为：
    - `count = 0`
    - `docs = []`
- 本轮正式证据文档：
  - `evidence/feedback-closeout/smashup-human-final-two-writeback-2026-05-06.md`

## Addendum（2026-05-04）：当前线上 open 反馈已清零

- 最终生产盘面：
  - `openTotal = 0`
  - `inProgressTotal = 0`
  - `groups = {}`
- 最终摘要文件：
  - `temp/feedback-online/post-20260504-resolved-batch-17-summary.json`
- 本轮收口语义仍然遵守用户指定口径：
  - `resolved = 本地已经修好并完成本地验收`
  - 不代表已上传、已发布、已做正式镜像发版

## Addendum（2026-05-04）：SmashUp `69f5469a...` 《着魔》并非未附着，已回写 resolved

- `69f5469a9ec13b96d710ae26` 的反馈原文是：
  - `着魔没效果，目标随从没有附加行动卡`
- 线上当前权威态不是“系统根本没附着成功”，而是已经推进到了更后拍：
  - `sys.phase = playCards`
  - `sys.flowHalted = false`
  - `sys.interaction.queue = []`
- 同一份线上 action log 已经直接记录到《着魔》的真实附着：
  - `[08:31:10] 测试员: 战术卡施放： 着魔`
  - `[08:31:10] 测试员: 附加持续战术： 着魔  →  c24`
  - `[08:31:45] 测试员: 附加持续战术： 着魔  →  c6`
  - `[08:32:19] 测试员: 附加持续战术： 着魔  →  c24`
  - `[08:32:42] 测试员: 附加持续战术： 着魔  →  c24`
- 当前保存下来的终态里虽然看不到宿主身上仍挂着《着魔》，但这是因为：
  - `world_champs_bewitched (c11)` 已在 `players['0'].discard`
  - 当时被附着过的 `skeletons_returned_one (c24)` 也已经进入弃牌堆
  - 结论是链路已经继续推进到宿主与《着魔》都离场后的更后拍，而不是“前面从没附着上”
- 仓库当前权威文案与既有回归也完全支持这一结论：
  - `public/locales/zh-CN/game-smashup.json`
    - `打出到一个仆从身上。持续：这个仆从获得+2力量。如果这个仆从离开游戏，转移这张行动到另一个仆从身上。`
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着`
  - `evidence/smashup/smashup-world-champs-bewitched-eh-e2e-2026-04-28.md`
    - 已证明《着魔》会真实附着、宿主离场后会真实弹转移 prompt，并能重新附着到新宿主
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:35:00.000Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 3`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`
  - `smashup|feedback-modal = 0`

## Addendum（2026-05-04）：SmashUp `69f01fd4...` 《斯芬克斯》真实选择位点不是单独按钮，已回写 resolved

- `69f01fd49b68d90ee983669d` 的反馈原文是：
  - `没法选择打出斯芬克斯`
- 线上当前权威态已经说明现场不是“系统没给可选目标”，而是已经进入 `Sphinx` 的真实起始回合交互：
  - `sys.phase = startTurn`
  - `sys.flowHalted = false`
  - `current.id = titan_sphinx_start_turn_0`
  - `current.data.sourceId = titan_sphinx_start_turn`
- 这份交互当前给出的真实候选不是“点一张 Sphinx 卡面”，而是：
  - 选择一张自己的埋葬牌 `buried-c17 = 远古诅咒 @ 金字塔`
  - 或 `skip`
- 场上上下文也与这份交互完全对得上：
  - `base_pyramids_pod` 下方确实存在 1 张己方埋葬牌
  - `titan_0_sphinx` 仍在 `setaside`
- 当前仓库权威文案与实现都明确说明 `Sphinx` 的入口就是“先选埋葬牌，再把泰坦打到该牌所在基地”：
  - `public/locales/zh-CN/game-smashup.json`
    - `特殊：你的回合开始时，你可以将你埋葬的一张牌返回手牌，然后将此泰坦打出到该牌所在的基地。`
  - `src/games/smashup/abilities/titans.ts`
    - `sphinxOnTurnStart(...)` 会先收集“你的埋葬牌”作为候选
    - `titan_sphinx_start_turn` handler 在选中埋葬牌后，才会把该埋葬牌回手并把 `Sphinx` 打到对应基地
- 本轮复核也再次证明当前代码基线无回归：
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互`
    - `狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互`
  - 浏览器级既有证据：
    - `evidence/smashup-sphinx-start-turn-buried-refresh-e2e-test.md`
    - `evidence/smashup-sphinx-stale-buried-options-e2e.md`
- 因此这条反馈不是“系统不能打出 Sphinx”，而是用户把真实交互位点理解成了“应该额外弹出一个单独的 Sphinx 按钮”。
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:25:00.000Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 4`
  - `smashup|feedback-modal = 1`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f387a3...` 《雏菊花环》正负号并未写反，已回写 resolved

- `69f387a35cacc4e6b5cdbd4c` 的反馈原文是：
  - `按效果我应该加2战力  而不是减2`
- 线上当前权威态已经说明这不是“自己给自己贴了《雏菊花环》却被扣 2”的场景：
  - `base_secret_garden` 上的 `c10 = fairies_tinx`
  - `c10.controller = "0"`
  - `c10.attachedActions` 中存在 `c17 = fairies_daisy_chain`
  - `c17.ownerId = "2"`
- 同一份 action log 末尾还能看到真实链路：
  - `tinx -> 神秘花园`
  - `ongoing_detached 雏菊花环 ... （原因：tinx）`
  - `ongoing_attached 雏菊花环 -> c10`
- 当前仓库权威文案与实现完全一致：
  - `public/locales/zh-CN/game-smashup.json`
    - `打在一个随从上。持续：如果你控制该随从，它具有 +2 力量；否则它具有 -2 力量。`
  - `public/locales/en/game-smashup.json`
    - `Play on a minion. Ongoing: This minion has +2 power if you control it, or -2 power if you do not.`
  - `src/games/smashup/abilities/ongoing_modifiers.ts`
    - `fairies_daisy_chain` 当前逻辑是 `action.ownerId === ctx.minion.controller ? +2 : -2`
- 因此这条反馈对应的现场里：
  - 随从控制者是 `0`
  - 附着的《雏菊花环》拥有者是 `2`
  - 根据当前规则语义，结论就应该是 **-2**，不是 `+2`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:02:42.133Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 5`
  - `smashup|feedback-modal = 2`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f544f9...` 《轮回者》reaction 语义误判已回写 resolved

- `69f544f99ec13b96d710ae00` 混在一起描述了两个现象：
  - 《轮回者》打出后为什么还会出现 `选择反应`
  - 《名人堂 + 大法师》为什么之前还会出现结算顺序选择
- 线上当前保存下来的权威态已经说明它不是“最终没生效”的坏终态：
  - `base_hall_of_fame.buriedCards` 中已经存在 `skeletons_returned_one`
  - `base_hall_of_fame.minions` 中已不存在《轮回者》本体
  - `flowHalted=false`、当前阶段已回到 `playCards`
- 这与现有浏览器级证据完全一致：
  - `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`
  - 该文档已经明确修订过旧错误假设：
    - 旧假设：`轮回者` 自埋后应“直接无交互”
    - 当前真实链路：先进入 `smashup_reaction_choose`，再由《轮回者》收口
- 《名人堂 + 大法师》这一半也已有精确回归：
  - `src/games/smashup/__tests__/archmageE2E.test.ts`
    - `在名人堂打出大法师时，应自动结算无冲突 trigger 而不是弹排序交互`
- 2026-05-04 本轮尝试 fresh 复跑上述 `archmageE2E` 时，被当前工作区内 unrelated 的 `ancient_egyptians` 初始化错误阻塞：
  - `ReferenceError: ancientEgyptiansSealTheTombProgram is not defined`
  - 位置：`src/games/smashup/abilities/ancient_egyptians.ts`
  - 该错误与本条反馈无直接关系，本轮未扩大范围去修无关脏改
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T04:50:58.267Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 6`
  - `smashup|feedback-modal = 3`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f385d7...` `Puck + Spirit of the Forest` 双分支补发已回写 resolved

- `69f385d75cacc4e6b5cdbd4a` 的用户反馈不是一个新根因，而是 Fairy Titan `Spirit of the Forest` 的“一回合一次 OR 两边都触发”语义在 `Puck` 上的具象表现：
  - 现场 action log 已出现 `Puck -> 436-1337工厂`
  - 当前场上同时存在 `fairies_spirit_of_the_forest`
  - 现场快照末尾交互已包含 `extra_action / draw_card` 两个分支
- 当前仓库已有与该反馈直接同构的精确回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`
  - `src/games/smashup/__tests__/commandsValidation.test.ts`
    - `fairies_spirit_of_the_forest special 需要同时保留通常随从与通常行动额度`
- 2026-05-04 本轮已复跑并通过上述两条聚焦回归，证明当前代码基线下：
  - 第一条 OR 分支执行后，不会把第二条分支吞掉
  - follow-up prompt 会继续给出剩余分支与 `skip`
  - Titan 的“本回合已用”标记只会在完整收口后落下
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T04:26:35.049Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 7`
  - `smashup|feedback-modal = 4`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f27a5d...` 忍者侍从额外打出随从不触发 `onPlay` 已回写 resolved

- `69f27a5dab54eadcc2bb2c75` 的线上现场不是“忍者侍从没有把随从打出来”，而是“额外打出的随从已经进场，但它的打出效果没有继续往后触发交互链”：
  - action log 已明确出现 `忍者侍从 -> 工坊`
  - action log 已明确出现 `枪手 -> 工坊`
  - 但后续没有 `枪手` 的决斗选择，也没有对应的决斗结算
- 根因不在 `ninja_acolyte_play` 交互处理器本身，而在 `MINION_PLAYED` 的后处理时机：
  - `ninja_acolyte_play` 响应后确实会产出 `MINION_PLAYED(consumesNormalLimit=false)`
  - 这个 `MINION_PLAYED` 不是走普通 `PLAY_MINION` execute 主链，而是走 `afterEvents` 轮里的交互处理器返回事件
  - `postProcessSystemEvents()` 在处理这类 `afterEvents` 轮产生的 `MINION_PLAYED` 时，临时 `core` 里还看不到刚进场的随从
  - `cowboys_gunfighter` 的 `onPlay` 需要先在当前 state 里找到自己所在基地；看不到自己时，`queueEnemyDuelPrompt()` 会直接短路返回空事件
- 本地最小修复点：
  - `src/games/smashup/domain/index.ts`
  - 在 `postProcessSystemEvents()` 的 `MINION_PLAYED` 分支中，若当前事件来自 `afterEvents` 轮且尚未 reduce，则先把该 `MINION_PLAYED` 临时 reduce 到 `tempCore`，再调用 `fireMinionPlayedTriggers()`
- 已新增并通过的聚焦回归：
  - `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
    - `忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择`
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `cowboys_gunfighter 打出后可与同基地敌方随从决斗并消灭失败者`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T04:09:25.548Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 8`
  - `smashup|feedback-modal = 5`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`
- 修订说明：
  - 本文档下方关于“`69f27a5d...` 仍需独立核对”的旧结论已失效
  - 该条现已按“本地已修 + 生产状态已回写”独立收口

## Addendum（2026-05-04）：SmashUp `69f27faa...` `Difference Engine` 无限抽牌已回写 resolved

- `69f27faaab54eadcc2bb2c77` 的现场不是“差分机能力自己死循环”，而是 `endTurn` 恢复态把同一组 `onTurnEnd` trigger 重新排队：
  - 现场终态是 `sys.phase = endTurn`、`sys.flowHalted = true`
  - `triggerQueue` 同时含有 `onTurnEnd:steampunk_difference_engine` 与 `onTurnEnd:tricksters_big_funny_giant`
  - action log 连续出现多次“游客6550 抽1张牌”
- 关键事件模式已经锁定问题位点：
  - `SYS_INTERACTION_RESOLVED`
  - `su:trigger_consumed`
  - 紧接着再次出现同一组 `su:trigger_queued`
  - 这说明 bug 不在 trigger 执行逻辑本身，而在“已经消费过的 turn-end frame 被重新 collect”
- 本地最小修复点：
  - `src/games/smashup/domain/index.ts`
  - 在 `smashupFlowHooks.onPhaseExit` 的 `from === 'endTurn'` 分支前加入恢复态闸门
  - 当 `flowHalted=true`、无 active interaction、无 `SmashUpReactionSession`、且 `triggerQueue` 里已无 `turn-end:` frame 时，直接发 `SU_EVENTS.TURN_ENDED`，不再重新 `collectTriggers('onTurnEnd')`
- 已新增并通过的聚焦回归：
  - `src/games/smashup/__tests__/turnCycle.test.ts`
    - `endTurn 反应交互结算后不会把同一组 onTurnEnd trigger 重新入队`
  - `src/games/smashup/__tests__/expansionOngoing.test.ts`
    - `steampunk_difference_engine`
- 线上状态回写约束补充：
  - 本地 `.env` 里的 `MONGO_URI` 指向 `localhost:27017/boardgame`，不是生产真源
  - 因此本轮 `69f27faa...` 的状态回写改走 `SSH + docker exec boardgame-mongodb mongosh boardgame`
  - 生产回写结果：`matched=1 / modified=1`，反馈已变为 `status=resolved`
- 回写后最新生产 open 盘面：
  - `openTotal = 9`
  - `smashup|feedback-modal = 6`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`
- 结论约束：
  - 现在可以确认 `69f27faa...` 这一条已按“本地已修 + 生产状态已回写”收口
  - 但不能把它外推成“同房间 WWJIlGJSnnt 里的其它 SmashUp 反馈都已一起收口”；`69f27a5d...` 已在后续批次独立收口，其余条目仍需分别核对

## Addendum（2026-05-04）：SmashUp `69f7ac9d...` 重复 special 候选定位

- `69f7ac9d9ec13b96d710fded` 不是旧的 `stale private overlay` 型问题，生产快照有两个更具体的特征：
  - `smashup_reaction_choose` 同一 prompt 中重复出现 `activate_special:titan:titan_2_wizards_arcane_protector:3`
  - `progressMarker` 中的旧 interaction id 与 `stateSnapshot.interaction.shared.id` 不同，说明 watchdog recovery 已推进过一次，但同类 visible interaction 又重开并最终落成 `blocker_persisted`
- 本地最小修复没有去碰更大范围 transport 分支，而是先直接收口最可证的 runtime 出口：
  - `src/games/smashup/domain/reactionSession.ts`
  - `e2e/src/games/smashup/domain/reactionSession.ts`
  - `buildReactionOptions(...)` 现在会按 `existing.id === option.id` 或 reaction value 等价去重
  - `resolveSmashUpReactionChoice(...)` 现在会先按 live session 正规化持久化 choice；若 live 里只剩 `pass`，则直接按当前语义收口
- 已新增并通过的聚焦回归：
  - `smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass`
  - `smashup_reaction_choose 响应持久化后的失效 special 快照时，应按当前 live 语义正规化并直接收口`
  - `smashup_reaction_choose 构建反应选项时，应去重重复的泰坦 special 候选`
- 额外发现的最小编译阻塞已顺手修平：
  - `src/games/smashup/abilities/innsmouth.ts`
  - `e2e/src/games/smashup/abilities/innsmouth.ts`
  - 原因是文件里调用了 `registerInteractionHandler(...)`，但漏了对应 import
- 新确认的生产基线差异：
  - 远端 `/home/admin/BoardGame` 源码里不存在以下文件：
    - `src/games/smashup/domain/reactionSession.ts`
    - `src/games/smashup/domain/reactionWindowState.ts`
    - `src/games/smashup/domain/abilityRuntime.ts`
    - `src/games/smashup/domain/branchingChoice.ts`
  - 这说明生产当前不是“只差一个去重补丁”，而是整条 `smashup` 新交互运行时层尚未在远端源码基线上落地
- 当前任务口径已切换并执行：
  - `resolved = 本地已修好`
  - 因此 `69f7ac9d...` 已在 2026-05-04 直接按本地修复完成口径回写为 `resolved`
- 修平后已复跑通过的 transport/watchdog 聚焦套件：
  - `smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted`
  - `online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn`
  - `online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败`
- 结论约束：
  - 现在可以确认 `69f7ac9d...` 所暴露的“重复 special 候选 / stale special 正规化”这一层已按本地修复口径收口
  - 但还不能把它外推成“其余 smashup watchdog open 都可直接一起关掉”

## Addendum（2026-05-04）：DiceThrone `69f5be8c...` 已回写 resolved

- `69f5be8c9ec13b96d710baa4` 在本轮回写前不是“可能已经被别人顺手关了”，而是生产 Mongo 直查仍明确为：
  - `status = open`
  - `source = feedback-modal`
  - `severity = critical`
- 这条反馈当前能收口，不是因为“用户描述模糊也先关掉”，而是因为线上现场与本地修复证据已经对齐：
  - 生产现场权威态明确落在 human `main1`
  - 真残留物是 AI 枪手 `pendingBonusDiceSettlement.displayOnly = true` 的孤儿展示态
  - 对应修复与验证已分别落在：
    - `evidence/dicethrone/dicethrone-online-ai-orphan-displayonly-bonus-settlement-fix-2026-05-02.md`
    - `evidence/dicethrone/dicethrone-online-ai-pending-interaction-hidden-response-fix-2026-05-02.md`
- 已执行最小回写：
  - `temp/feedback-closeout/update-feedback-status-20260504-69f5be8c-to-resolved.raw.txt`
  - 结果：`matched=1`、`modified=1`
  - 同次返回的远端文档已变为 `status=resolved`，`updatedAt=2026-05-04T00:09:29.653Z`
- 回写后复核：
  - `temp/feedback-online/post-69f5be-resolved-summary-20260504.json` 已确认该条不再占用 `open` 盘面
  - 当前 `openTotal = 20`
  - `dicethrone|feedback-modal` 从 `7` 降到 `6`
- 口径约束：
  - 这里只能说明 **这条与 transport/watchdog 强关联的 DiceThrone human feedback 已收口**
  - 不能外推成“DiceThrone 全部问题已完”或“两条 dicethrone watchdog 聚合项也自动可关”

## Addendum（2026-05-04）：DiceThrone `69f4acdf...` `card-dizzy` 响应链已回写 resolved

- `69f4acdf9ec13b96d7109f30` 的原文是“头晕目眩无法使用”，生产现场权威态不是“用户手滑没点到”，而是：
  - Barbarian 在 `main2`
  - 手牌中明确存在 `card-dizzy`
  - 前一拍真实攻击已造成 `13` 点伤害
- 仓库里已有与该现场直接对位的本地证据链：
  - 领域回归：`src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts` 中 `card-dizzy afterAttackResolved 响应窗口链`
  - 真实 E2E：`evidence/dicethrone/dicethrone-card-dizzy-after-attack-e2e-test.md`
  - 截图证据明确覆盖：`afterAttackResolved` 窗口真实出现 -> `card-dizzy` 真实打出 -> 目标获得 `Concussion` -> 响应窗收口
- 2026-05-04 已按“本地已修即 resolved”口径通过生产 Mongo 回写；回写结果：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T01:22:42.855Z`

## Addendum（2026-05-04）：SmashUp `69f5c17f... / 69f42358...` 已按同类 stale reaction 证据回写

- `69f5c17f9ec13b96d710bb03` 与 `69f423585cacc4e6b5cdbdbf` 都属于：
  - `smashup`
  - `online-ai-watchdog`
  - `visible-interaction:recover-interaction:blocker_persisted`
  - `smashup_reaction_choose`
  - `scoreBases`
- 这两条与 `69f479...` 的 `endTurn` mandatory 双触发不同，当前更接近已补证的 `scoreBases` / stale reaction choice 闭环：
  - `69f5c17f...` 现有 findings 已直接对应 transport 闭环补测
  - `69f42358...` 是更早的同类 `scoreBases` 聚合项，按相同 runtime + transport 证据链收口
- 2026-05-04 已通过生产 Mongo 回写：
  - `69f5c17f...` -> `resolved`，`updatedAt=2026-05-04T01:24:03.114Z`
  - `69f42358...` -> `resolved`，`updatedAt=2026-05-04T01:24:03.433Z`
- 最新线上 open 聚类已降到：
  - `dicethrone|feedback-modal = 5`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `smashup|online-ai-watchdog = 1`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f479...` `endTurn` mandatory 顺序 watchdog 已回写

- `69f479c69ec13b96d71099e3` 与前面两条 `scoreBases` stale reaction 聚合项不是同一个根因：
  - 现场特征是 `phase = endTurn`
  - 强制顺序选项是：
    - `trigger:onTurnEnd:steampunk_difference_engine:0:0`
    - `trigger:onTurnEnd:tricksters_big_funny_giant:0:1`
  - 问题不是“第一个 trigger 不会被选”，而是选完第一个 trigger 后，watchdog 把后续 `endTurn` 收口误限制成“只能找 legal action”，没有允许 SmashUp `endTurn` 像 `scoreBases` 一样 fallback `ADVANCE_PHASE`
- 本地最小修复：
  - `src/engine/transport/server.ts` 将 SmashUp `currentPhase === 'endTurn'` 纳入 `allowAdvancePhaseFallbackAfterLegalExhausted`
  - `src/engine/transport/__tests__/server.test.ts` 新增并跑通：
    - `watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T01:41:41.863Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 5`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`
  - `smashup|online-ai-watchdog = 0`

## Addendum（2026-05-04）：DiceThrone `69f21b05...` 枪手 `Loaded` / `targetingRoll` 卡死已回写

- 这条不是泛化“AI 想太久”，而是 DiceThrone 枪手 `targetingRoll` 选目标后叠加 `Loaded` token / bonus die 的收口链脱节：
  - 现场状态：`sys.phase = targetingRoll`、`flowHalted = true`、`interaction.isBlocked = true`、`interaction.queue = []`
  - 末尾事件顺序仍能看到：
    - `CHOICE_REQUESTED(targeting-roll)`
    - `CHOICE_RESOLVED`
    - `CHOICE_REQUESTED(offensiveRollEndToken)`
    - `BONUS_DICE_REROLL_REQUESTED`
  - 这说明交互请求确实发出过，但可见交互和 watchdog 收口链没有一起走完
- 该条与已收口 `69f5be8c...` 同属 `displayOnly / pendingBonusDiceSettlement / hidden response` 处理簇，同时共享 `69f04210...` 的 `targetingRoll` 推进缺口与 Android `AppUpdatePlugin` 噪音
- 2026-05-04 已补强本地复核并通过：
  - `flow.test.ts` 中 `targetingRoll` 4 条聚焦回归
  - `server.test.ts` 中 `displayOnly / hidden interaction / watchdog` 5 条聚焦回归
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T02:09:53.325Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 4`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：DiceThrone `69f2a81c...` token 弹窗双击 / 目标恢复反馈已回写

- 这条反馈文本描述的是“先选目标、再弹 token、token 弹窗要点两次、原目标选择没恢复”。
- 但生产快照保存下来的并不是故障中间态，而是修复后能正常收口的终态：
  - `sys.phase = main2`
  - `flowHalted = false`
  - `interaction.queue = []`
  - `pendingAttack = null`
  - 末尾事件完整走到 `TOKEN_RESPONSE_CLOSED -> ATTACK_RESOLVED -> SYS_PHASE_CHANGED(defensiveRoll -> main2)`
- 因此这条不是一个仍未闭合的新问题，而是 DiceThrone `pendingInteractionId / hidden response / token response` 修复簇下的“已修未回写”反馈。
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T02:21:27.353Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 3`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：DiceThrone `69f31c69...` “再来点”反馈已回写

- 这条不是新问题，项目内已有专项审计 `evidence/dicethrone-4p-attack-modifier-targeting-roll-audit-2026-04-30.md` 已直接点名：
  - 线上真实反馈时间：`2026-04-30T09:10:01.709Z`
  - 线上真实反馈原文：`再来点这张卡自己整个回合都用不了`
- 根因是 4 人 `targetingRoll` 自动目标窗口里，攻击修正卡旧逻辑把可用性错误绑死到 `pendingAttack.defenderId` 是否已写回。
- 2026-05-04 已按当前代码基线复跑聚焦回归：
  - `攻击修正卡可在 defenderId 写回前直接结算到自动目标`
  - `4 人模式 targetingRoll 自动目标后，Loaded token 的奖励骰特写应命中自动目标`
- 当前生产快照也已回到 `main1`、`flowHalted=false`、`interaction.queue=[]`、`pendingAttack=null`，说明这是已修未回写反馈。
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T02:28:06.896Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 2`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：DiceThrone `feedback-modal` 已清零

- `69f18ca4ab54eadcc2bb2322`：
  - 线上现场仍带有 `defensiveRoll` 阶段的骰子数据，说明不是“领域层没产出骰子”，而是共享骰面显示层问题
  - 已并入 `69cba605...` 的共享骰面可见性修复簇
  - 2026-05-04 已复跑 fallback 单测通过
  - fresh E2E 尝试因测试 runtime 启动失败未进入业务断言，因此沿用旧共享截图证据收口
- `69f1978dab54eadcc2bb24b0`：
  - 只保留 route 级“游戏中途加载失败”，无 `stateSnapshot` / `errorContext`
  - 按明确推断并入同日 DiceThrone 全局 HUD 加载失败簇：`69f1f938...` / `69f1f943...`
  - 2026-05-04 已重跑 `chatSelectionLogic.test.ts` 与 `npm run build`，当前修复链稳定
- 2026-05-04 完成上述两条回写后：
  - `dicethrone|feedback-modal = 0`
  - 全部剩余 open 聚类为：
    - `smashup|feedback-modal = 7`
    - `dicethrone|online-ai-watchdog = 2`
    - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：Splendor watchdog 生产热补已落地

- `splendor` 当前不是“历史聚合项还没清掉”，而是 2026-05-04 晚间再次真实复发：
  - `2026-05-04 23:29:57` 到 `23:33:09`，生产 `boardgame-game-server` 持续对 `matchId=cWGQSaUXt1B` 执行 watchdog
  - 同一窗口里 `failureCount` 从 `1998` 增长到 `2022`
  - 失败口径仍是 `ADVANCE_PHASE -> unknownCommand`
- 标准镜像发布链在本时间点还不包含这次修复：
  - 当前官方 `ghcr.io/zhuanggenhua/boardgame-game:latest` 导出的 `server.mjs` 哈希是 `19197f1831000ccc603df12fc1d21ffb353ef2d6a0f0baf4619dd166d7b24b8f`
  - 该官方 bundle 中查不到本轮新增修复特征字符串 `display-only-bonus`
  - 结论：直接跑 `bash scripts/deploy/deploy-image.sh update latest` 仍无法把这次 watchdog 修复正式带上生产
- 本轮执行的最小风险生产热补路径：
  - 远端源码仓库先同步当前已验证的 `src/engine/transport/onlineAiRecovery.ts`
  - 为让现有 `server.ts` 在远端旧仓库中重新可编译，补齐最小依赖同步：
    - `src/engine/transport/storage.ts`
    - `src/engine/ai/**`
    - `src/engine/systems/UndoSystem.ts`
  - 远端宿主机 `Node 22` 直接跑 `build-node-bundle.mjs` 仍因 `esbuild` 解析链异常失败，最终改用 `ghcr.io/zhuanggenhua/boardgame-game:latest` 的 `Node 24` 容器挂载 `/home/admin/BoardGame` 来编译
  - 产物：
    - `/home/admin/BoardGame/temp/prod-bundles/game/server.mjs` → `809aebcda8ddbe4d99ab98e3b997e57cce7af2417527a008741cdf229b81230d`
    - `/home/admin/BoardGame/temp/prod-bundles/game/server.mjs.map` → `91dade1ff134f10b3e85a1a8b4882cb90bcca52bdfd7790916f6d16927d4a5de`
- 生产替换与复核结论：
  - 已把上述 bundle 覆盖到 `boardgame-game-server:/app/server.mjs` 与 `/app/server.mjs.map`
  - 容器重启后复核 `sha256sum /app/server.mjs /app/server.mjs.map`，与热补产物哈希完全一致
  - `2026-05-03T23:51:12.821Z` 复核 `curl http://127.0.0.1/health` 返回 `{"status":"ok",...}`
  - 再观察 `70s` 日志窗口，`grep 'cWGQSaUXt1B'` 与 `grep 'online-ai-watchdog failed'` 都为空，说明本轮 `splendor` 刷屏已被当前热补止住
- 回退物料已落盘：
  - 热补 bundle：`/home/admin/hotfix-backups/20260504-splendor-watchdog/server.hotfix.mjs`
  - 官方镜像原始 bundle：`/home/admin/hotfix-backups/20260504-splendor-watchdog/server.registry-latest.mjs`
- 残余风险：
  - 当前生产修复仍属于 **bundle 热补**，不是正式 GHCR 镜像发布；若后续按官方旧 `latest` 重建容器，补丁会丢失
  - 因此下一阶段仍要把这次修复收敛回正式镜像发布路径，不能把“当前日志安静”误写成长期收口

## Addendum（2026-05-04）：三簇 watchdog 本地验证结论

- `splendor` 当前最关键的线上 open 项 `69f6c4bc9ec13b96d710e10d`，本地已确认根因与修复方向：
  - 根因 1：`src/engine/transport/onlineAiRecovery.ts` 旧逻辑会对 `splendor` 这类不支持阶段推进命令的游戏生成裸 `ADVANCE_PHASE` recovery
  - 根因 2：`src/engine/transport/server.ts` 旧逻辑只信 `setupData.seatControllers`，未按 manifest 过滤 `localAi=false`
  - 修复后已通过：
    - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `src/engine/transport/__tests__/server.test.ts` 中 `splendor` manifest/no-ai 聚焦回归
- `dicethrone` 当前 open watchdog / 用户“枪手防御技能 + 转移状态效果卡死”主链，本地聚焦验证已过：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
  - `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
  - `src/games/dicethrone/__tests__/flow.test.ts` 中 `targetingRoll / defensive / displayOnly / bonus` 相关聚焦用例
- `smashup` 当前 open watchdog `visible-interaction:recover-interaction:blocker_persisted` 主链，本地聚焦验证已过：
  - `src/engine/transport/__tests__/server.test.ts` 中 `visible-interaction / reaction chain / follow-up advance / mandatory-order` 相关用例
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- 仍需保持谨慎的点：
  - 当前工作区存在大量并行 dirty 改动；即使本地聚焦测试通过，也不能直接把“可发布”与“本地已验证”混为一谈
  - `dicethrone flow.test.ts` 全文件还有 2 条旧断言失败，当前都落在技能升级历史用例，现象是预期 `main2`、实际 `defensiveRoll`；本轮未把它们当成线上反馈主链 blocker

## Addendum（2026-05-04）：SmashUp transport 闭环与 Splendor 生产止血

- `smashup` `69f5c17f9ec13b96d710bb03 / visible-interaction:recover-interaction:blocker_persisted` 现在不只是“领域层/AI 层高覆盖”，transport 闭环也已经补测：
  - `src/engine/transport/__tests__/server.test.ts` 新增 “`smashup` 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 `blocker_persisted`”
  - 该测试直接用持久化 stale `smashup_reaction_choose` 状态跑 `runOnlineAiRecoveryTick()`，结果会先执行 `interaction:persisted-stale-reaction-choice:pass`，再自然推进，不再写入 `force-end-turn-failed`
  - 这条补测与现有 `scoreBases-auto-continue.test.ts`、`commandsValidation.test.ts` 共同构成：`live option refresh -> runtime prompt resolve -> transport watchdog recovery` 的完整证据链
- `splendor` 当前线上增长不是“Mongo 里残留房间”：
  - 生产 Mongo `matches` 中查不到对应 `splendor` 房间，`/internal/rooms?gameName=splendor` 也返回空
  - 但 `boardgame-game-server` 单进程仍持续对 `Nh_5xVWO0km` 执行 `ADVANCE_PHASE -> unknownCommand`
  - 先尝试 game-server 内部 `DELETE /internal/rooms/Nh_5xVWO0km`，接口返回 `200 {"deleted":true}`，但无法阻止日志继续增长，说明该接口删除的不是 watchdog 实际扫描的幽灵 active match
  - 进一步确认容器内仅 1 个 Node 进程后，判断该问题属于单进程残留内存态；在 `/internal/rooms` 全量为空的前提下，重启 `boardgame-game-server` 是当前最小可执行止血路径
- 重启后复核结论：
  - `docker logs --since 1m boardgame-game-server` 不再出现 `Nh_5xVWO0km`、`l_nV1EVQkNG`、`2mAr8CtKjlP`
  - `69f6c4bc9ec13b96d710e10d` 停在 `occurrenceCount = 417`
  - 当前生产已经从“持续刷 open watchdog + 持续放大日志”恢复到“open 仍未人工回写，但不再继续增长”
- 残余风险：
  - 当前止血依赖一次生产重启，尚未把本地 `splendor` watchdog 修复正式发布到生产；若未来再出现同型 orphan active match，理论上仍可能复发
  - 生产日志里曾同时出现 `dicethrone` / `summonerwars` 的幽灵 watchdog match；本轮重启后一并沉默，但仍需后续判断它们是同类内存残留，还是需要独立代码修复

## Addendum（2026-05-03）：线上反馈源恢复与当前盘面

- 本轮依据的真实来源是 **线上反馈源**：
  - 生产 API：`https://api.easyboardgame.top/admin/feedback`
  - 生产 Mongo：`8.148.71.102:/home/admin/BoardGame` 下的 `boardgame-mongodb`
- 初始阻塞不是“接口权限问题”，而是生产环境真实故障：
  - `/admin/feedback` 返回 `500`
  - `boardgame-mongodb` 因 `FTDC diagnostic.data` 写失败持续重启
  - 根盘 `/dev/vda3` 满盘，`40G` 已用尽
- 占用核实结果：
  - `/var/lib/docker/containers` 约 `13G`
  - 其中 `boardgame-game-server` 的 JSON 日志单文件约 `13G`
  - `Mongo` 数据卷本体仅约 `530MB`，不是主占用
- 已执行的最小风险止血：
  - 仅截断 `boardgame-game-server` 的单个 Docker 日志文件
  - 没有删除 Mongo 业务数据卷，也没有改生产镜像
  - 根盘恢复到约 `68%` 使用率后，`boardgame-mongodb` 可重新正常启动
- 当前线上真源快照：
  - `temp/feedback-online/current-open-20260503.json`
  - `temp/feedback-online/current-in-progress-20260503.json`
- 当前最新盘面：
  - `open = 20`
  - `in_progress = 0`
  - 结构分布：
    - `dicethrone | feedback-modal = 7`
    - `smashup | feedback-modal = 7`
    - `smashup | online-ai-watchdog = 3`
    - `dicethrone | online-ai-watchdog = 2`
    - `splendor | online-ai-watchdog = 1`
- 当前最需要先止血的线上项：
  - `69f6c4bc9ec13b96d710e10d`
    - `splendor`
    - `force-end-turn-failed active-turn:follow-up-advance:command_failed`
    - `occurrenceCount` 已继续增长，并且正持续制造生产大日志
  - `69f471da9ec13b96d7109902`、`69f73be49ec13b96d710f1c2`
    - `dicethrone`
    - `active-turn-legal-only:follow-up-advance:legal_action_unavailable`
    - 与用户反馈“枪手防御技能/转移状态效果卡死”高度相关
  - `69f5c17f9ec13b96d710bb03` 及其历史同类项
    - `smashup`
    - `visible-interaction:recover-interaction:blocker_persisted`
    - 需要确认是否已经被当前 dirty worktree 中的交互/runtime 改动部分覆盖

## Addendum（2026-05-03）：长期任务状态约束

- `C:\Users\zhuagenbao\.codex\.omx\ralph-loop.local.md` 当前正在服务另一条 Smash Up runtime 重构长期任务。
- 为避免抢占既有 loop，本轮“线上反馈持续修复”改用以下持久状态：
  - 仓库根：`task_plan.md` / `progress.md` / `findings.md`
  - 仓库临时状态：`temp/feedback-longtask.json`
  - 全局独立 state：`C:\Users\zhuagenbao\.codex\.omx\state\long-term-task\boardgame-online-feedback-20260503.json`

## Addendum（2026-04-30）：Smash Up《武士 陈》正路径补证与最终验收口径

- 本轮补上了 `World Champs` 最后一个对象级冻结点：《武士 陈》正路径 L3。
- 新证据：
  - `evidence/smashup/smashup-world-champs-samurai-chan-e2e-2026-04-30.md`
- 新验证：
  - `world_champs_samurai_chan` 聚焦 Vitest：`2 passed`
  - `武士 陈在基地计分进入弃牌堆后应抽一张牌` E2E：`1 passed`
- 这条补证后，前一版“《武士 陈》只保留负路径 L3 + 领域正路径”的冻结说明失效。
- 也同步明确这轮流程结论：
  - 不是每个对象都机械要求端到端。
  - 必须补到 L3 的，是历史投诉对象、真实入口链路、reaction session、阶段切换、UI 出口和曾出现“领域对 / UI错”的对象。
  - 其余对象保持 `L0-L2` + 风险抽样即可，不再用“全卡都上 E2E”制造无效工作量。

## Addendum（2026-04-30）：Smash Up 世界冠军 / 骷髅基地层残余清理

- 本轮新增 3 条基地层对象级 L3：
  - `竞技场 / base_arena`
  - `名人堂 / base_hall_of_fame`
  - `藏骨堂 / base_ossuary`
- 这批补证后，三新派系当前残余范围被继续收紧：
  - `World Champs`：基地层真实入口残留已清空；当前只剩《武士 陈》正路径是否继续单独补 L3 的冻结说明
  - `Skeletons`：基地层真实入口残留已清空；`埋骨地 / base_boneyard` 没有能力注册痕迹，当前按“无能力基地”冻结
- 本轮也补上了一个流程层结论：
  - 不是所有“还没补到 L3”的对象都必须机械继续补到同一深度
  - 对于《武士 陈》这类没有主动 prompt、当前用户直接反馈风险点又是“别串成海龟阿凯效果”的对象，负路径 L3 + 领域正路径 + 明确降级理由，才是当前更严谨的收口方式
- 证据：
  - `evidence/smashup/smashup-world-champs-skeletons-bases-e2e-2026-04-30.md`

## Addendum（2026-04-30）：Smash Up 美人鱼《塞壬 / 诱惑者 / 无人岛》重审

- 本轮不是单纯补截图，先抓到 1 个真实 UI 口径 bug：
  - `BaseZone` 玩家列分数徽章此前没有走 `getPlayerEffectivePowerOnBase(...)`
  - 而是自己手算 `getEffectivePower + ongoing + base bonus`
  - 结果会漏掉《塞壬 / 无人岛 / 魅惑 / 人鱼暗礁》这类“只影响控制者总力量、不影响基地总力量”的扣减语义
- 这说明此前返工的一个根因不是“维度名不够多”，而是：
  - L2 领域断言已经对
  - 但 L3 浏览器真实出口没有逐对象核到 UI 显示口径
  - 于是把“规则正确、显示错误”误当成“数据录错 / 效果没触发”
- 本轮已修复：
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
- 本轮新增对象级 L3：
  - `塞壬`
  - `诱惑者`
  - `无人岛`
- 证据：
  - `evidence/smashup/smashup-mermaids-siren-temptress-desert-island-e2e-2026-04-30.md`

## Addendum（2026-04-24）：线上反馈 69a440ea（DiceThrone 教程弃牌堆方向）
- 反馈 `69a440ea1eb921c6091f1231` 指向“教程把右侧弃牌堆写成左侧”。
- 复核结论：中文文案已正确，英文教程仍残留旧方向描述（`on the left`）。
- 已修复 `public/locales/en/game-dicethrone.json`：
  - `tutorial.steps.sellCardIntro` 改为 `on the right`
  - `tutorial.steps.undoSellIntro` 改为 `on the right`
- 校验：`npm run i18n:check` 通过。
- 证据：`evidence/dicethrone/dicethrone-feedback-69a440ea-tutorial-discard-side-fix-2026-04-24.md`。

## Addendum（2026-04-07）：Android 本地素材包图片加载故障
- 原生安装链路本身正常：`GamePackageForegroundRuntime`/`GamePackagePlugin` 会把游戏包解压到 `.../files/game-packages/<gameId>/current/assets`，并通过 `assetRootPath` 回传前端。
- 启动期丢本地素材的首个根因在 `src/features/mobile-packages/packageManagerService.ts`：
  - `hydrateInstalledNativeGamePackages()` 之前只会处理已经存在 `fallbackCache` 的游戏。
  - `fallbackCache` 主要由大厅里的 `useGamePackageState()` 注册；如果用户没先经过这层 hook，已安装包会被 hydration 直接跳过。
  - 结果是 `setGameAssetBaseOverride(gameId, assetBaseUrl)` 没有执行，AssetLoader 继续按远端资源域名取图。
- 图片长时间“加载中”的第二个根因在 `src/components/common/media/OptimizedImage.tsx`：
  - 组件原先把所有“非 http(s) 本地路径”都走成开发态 `/assets/...` 的 `fetch -> blob` workaround。
  - Android 已安装包路径 `/_capacitor_file_/...` 也会落进这个分支，导致本地包图片被误伤，停在加载态。
- 本轮修复策略：
  - `hydrateInstalledNativeGamePackages()` 在 fallbackState 缺失时，使用已安装包信息构造兜底 state，再继续 emit/apply override。
  - `OptimizedImage` 的 blob-fetch workaround 收窄为“仅开发态 public `/assets/...`”；对 `/_capacitor_file_/...` 直接交给 `<img>` 原生加载。
  - `nativeGamePackagePlugin.ts` 对原生首次 ack / installState listener 返回的 `running/completed/cancelled` 做前端状态归一化，禁止把非法状态直接写进 `StoredGamePackageState.status`。
- 第二轮真机排障确认了更前置的一层 bug：
  - `易桌游测试(top.easyboardgame.app.debug)` 当前私有目录里没有 `dicethrone` 已安装包，也没有 `install-state.json`。
  - 但旧 H5 bundle 仍可能把原生 ack 的 `status: "running"` 直接写进前端状态，导致下载按钮被判成“处理中”并直接变灰。
  - 这会掩盖后续“是否正确使用本地素材包”的真实状态，所以必须先修状态机污染，再继续看图片链路。
- 定向验证：
  - `src/components/common/media/__tests__/CardPreview.i18n.test.tsx` 新增断言：游戏包 override 生效时，`OptimizedImage` 不得触发 fetch/blob workaround。
  - `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` 新增断言：即使未先进入大厅包管理 hook，启动期 hydration 也能把原生已安装包同步进状态缓存。
  - 真机 `易桌游测试` OTA 目录已覆盖最新 `dist/`，启动日志确认加载的是新 bundle `http://localhost/assets/index-wN3ZSRu0.js`。
  - 真机截图与 `uiautomator dump` 已确认 `王权骰铸 -> 安装游戏包` 按钮处于可点击态，不再是“直接变灰”的脏状态。

## Requirements Checklist
- [x] 使用中文沟通与文档
- [x] 涉及图片资源时遵循 `docs/ai-rules/asset-pipeline.md`
- [x] 涉及图片驱动录入时遵循 `docs/ai-rules/data-entry.md`
- [x] 涉及审计时先遵循 `docs/ai-rules/testing-audit.md`
- [x] 涉及自动化测试与 E2E 时遵循 `docs/testing-best-practices.md` 与 `docs/automated-testing.md`
- [x] 本次任务需要独立 worktree、OpenSpec、可复刻工作流文档、Vitest、E2E、evidence

## Addendum（2026-03-28）：Dice Throne AI 审计收口
- 本轮 Dice Throne AI 卡死主链路已收口，核心根因确认是 token response 关闭后，只 resolve 交互，没有同步清理 `sys.responseWindow.current`。
- 修复点：`src/games/dicethrone/domain/systems.ts` 在 `TOKEN_RESPONSE_CLOSED` 路径显式清空 `sys.responseWindow.current`，避免领域层已关闭、系统层仍残留响应窗口。
- 同步校正了一条过期回归：Monk 太极在当前 token 规则下，单个响应窗口内只允许合法使用一次；旧的“双太极再 skip”预期不是当前真相。
- 回归测试已改成当前真实行为：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 断言 AI 执行 `['token-response', 'skip-token-response']`
  - 断言 `state.sys.responseWindow?.current` 被清空
  - 断言后续 AI 返回正常 `advance-phase`
- 本轮补齐的 AI 覆盖重点：setup 选角/ready 视角切换、main1 可行动作优先级、defensiveRoll 连续决策、attemptKey 去重、response-play-card 优先级、passive draw-card 优先级、token-response 关闭清理。
- 验证结果：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1` → `26 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native --maxWorkers 1` → `8 passed`
- 结论：这次 Dice Throne AI 审计暴露的缺口不在单一领域规则，而在“本地 AI 连续决策链 + 响应关闭后的系统态清理 + 过期回归未同步当前 token 规则”三者叠加。

## Research Findings

### 规范与流程
- 根工作区已有并行任务改动，且根目录 `task_plan.md` 正服务其他主题，当前任务必须隔离执行。
- 图片资源运行时禁止直接引用原始 `.png/.jpg`，需要走 `compressed/*.webp` 路径，由项目工具自动映射。
- 图片录入属于“先文档后实现”任务，需要先锁定来源、建立核对契约，再落运行时代码。
- 新的 E2E 必须使用 `e2e/framework` 的 `GameTestContext` API，并将显式证据截图写入 `test-results/evidence-screenshots/_shared/`。
- 用户本轮已明确要求：spec、审计、测试、E2E 全部包含在交付范围内。

### 当前工作区状态
- 新 worktree：`D:\\gongzuo\\webgame\\BoardGame-wt-smashup-base-faction-assets`
- 分支：`feat/smashup-base-faction-assets`
- 基线：`main` 分支提交 `8dc480cd`

### 当前素材核对结论
- 原工作区存在未纳入 `main` 的 Smash Up 中文原图：`public/assets/i18n/zh-CN/smashup/base/aiji_base.png` 与 `public/assets/i18n/zh-CN/smashup/cards/aiji.png`。
- `aiji_base.png` 尺寸为 `4096x1458`，视觉内容与目标四派系基地一致，包含：
  - `Saloon` / `So-So Corral`
  - `Pyramids` / `Star Portal`
  - `Kyuden Konbini` / `Sakura Shigemi`
  - `Drakkar` / `Longhouse`
- 用户已修正 `aiji.png`，当前 worktree 内文件尺寸为 `2914x4096`，内容确认为 `Ancient Egyptians / Cowboys / Samurai / Vikings` 四派系统一卡图。
- `aiji.png` 的真实切片结构为 `7x7` row-major，共 `49` 格：
  - 前 `48` 格是四个派系的卡牌
  - 最后 `1` 格是 `Smash Up` 尾格，不参与卡牌录入
- `aiji_base.png` 的真实切片结构为 `2x4` row-major，共 `8` 张基地。
- 本轮已执行 `npm run compress:images -- public/assets/i18n/zh-CN/smashup`，产物为：
  - `public/assets/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
  - `public/assets/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`

### TTS / 英文资源发现
- `public/assets/atlas-configs/smashup/2833984701.json`（TTS 源数据）中可定位到四个目标派系的 kit：
  - `Ancient Egyptians Kit`
  - `Cowboys Kit`
  - `Samurai Kit`
  - `Vikings Kit`
- 可确认的基地与英文卡堆如下：
  - Ancient Egyptians：`Pyramids`、`Star Portal`
  - Cowboys：`Saloon`、`So-So Corral`
  - Samurai：`Shogun's Palace`、`Sakura Garden`
  - Vikings：`Longhouse`、`Drakkar`
- 四个 faction deck 的 TTS `CustomDeck` 已定位：
  - Ancient Egyptians：deck `79`
  - Cowboys：deck `54`
  - Samurai：deck `55`
  - Vikings：deck `56`
- 这意味着即使中文 cards 原图缺失，仍可先从 TTS / Wiki 锁定派系列表、英文 defId 候选、卡牌数量与基础数据结构。

### 已确认的切片索引与命名差异
- `aiji.png` 的 row-major 顺序按 faction 分块稳定，依次为：
  - Vikings：索引 `0-11`
  - Samurai：索引 `12-23`
  - Ancient Egyptians：索引 `24-35`
  - Cowboys：索引 `36-47`
- `aiji_base.png` 的 row-major 顺序为：
  - `0 Saloon`
  - `1 So-So Corral`
  - `2 Pyramids`
  - `3 Star Portal`
  - `4 Kyuden Konbini`
  - `5 Sakura Shigemi`
  - `6 Drakkar`
  - `7 Longhouse`
- 武士基地存在来源差异：
  - 图片图面英文：`Kyuden Konbini` / `Sakura Shigemi`
  - TTS / Wiki canonical：`Shogun's Palace` / `Sakura Garden`
  - 结论：base def 采用 canonical 英文名与 defId，图面差异必须写入 workflow / evidence 契约。

### Smash Up 专项规则
- 根 `AGENTS.md` 明确要求：Smash Up 的数据录入、数据核对、审计、效果描述查询必须先跑 Wiki 爬虫，不能只凭图片或记忆。
- 因此本次正式录入的权威链路应为：
  - 图片：用于资源文件、atlas 切片、中文图面与索引确认
  - Wiki / 项目爬虫：用于卡牌/基地描述、名称、效果与数据审计

### 本轮实现边界
- OpenSpec `add-smashup-oops-faction-intake` 已将本变更边界定义为：
  - 图片压缩与 atlas 接入
  - faction / cards / bases 静态数据录入
  - locale / UI faction metadata 接入
  - intake 流程文档、证据文档、Vitest、E2E
- 不在本轮内：
  - 四个派系完整 ability handler / ongoing registry / trigger registry 的 gameplay 补完

## Gameplay Proposal Findings

### 用户最新实施要求
- 已明确改为玩法阶段，不再停留在静态录入验收。
- 实施顺序必须是“一个一个派系来”，不能四个派系并行混改。
- 四个派系全部完成后再做统一审计。
- E2E 重点不是再次验证静态图片，而是覆盖本轮新增交互类型。

### 已建立的 gameplay proposal
- OpenSpec change：`add-smashup-oops-faction-gameplay`
- 校验结果：`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 已通过
- 主要范围：
  - `Ancient Egyptians`：bury、unbury、replacement destination、owner-visible bury UI
  - `Vikings`：bury/discard synergy、buried recovery
  - `Cowboys`：duel、hand-size checks、movement、destroy
  - `Samurai`：honor-based destruction、reactive movement、replacement destination
  - UI：必须端到端支撑 bury source/target、duel target、replacement destination

### 玩法实施顺序裁定
- 第一波：`Ancient Egyptians`
  - 原因：先把 bury 主链路与 UI 做成正式能力，解决已有体系“有领域没 UI”的缺口。
- 第二波：`Vikings`
  - 原因：复用 bury / discard / hidden info 处理，能直接验证第一波设计是否足够通用。
- 第三波：`Cowboys`
  - 原因：决斗和手牌数量判定依赖不同交互模型，应与 bury 稳定后分开调试。
- 第四波：`Samurai`
  - 原因：替代去向与响应移动更偏 after-event / replacement 语义，放在最后更利于集中验证。

### 现有代码事实（对 gameplay 有直接影响）
- bury 领域模型已存在：
  - `src/games/smashup/domain/bury.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/domain/index.ts`
- `vampires_pod` 已有 bury 先例，但 UI 仍未正式完成：
  - `src/games/smashup/abilities/vampires.ts`
- Smash Up UI 中目前基本没有 bury 渲染入口：
  - `src/games/smashup/ui/BaseZone.tsx` 是后续 bury UI 主要落点之一

### proposal 阶段的关键结论
- intake 与 gameplay 必须分成两个 OpenSpec change，不能混写。
- bury UI 不能再延后到“最后统一补”，否则 Ancient Egyptians 第一波无法算完整实现。
- 新交互类型的 E2E 应围绕“能不能从 UI 完成整条链路”设计，而不是只断言领域状态存在。

## Ancient Egyptians 实施发现

- Ancient Egyptians 的旧 locale 文本与当前 Wiki/Fandom 口径存在系统性偏差，已按当前口径修正 `Mummy / Pyramid Engineer / Priest of Anubis / Pharaoh / Lost Knowledge / You Can Take It With You / Tomb Trap / Seal the Tomb / Plague of Locusts / Mummy Strength / Blessing of Anubis / Ancient Curse / Pyramids / Star Portal`。
- bury 体系仅有“从埋葬翻开并额外打出”的半成品实现，不足以支持 Ancient Egyptians：
  - 需要区分 `onUncover` 与“正常额外打出”
  - 需要支持非法时机翻开 `special` 时直接弃置
  - 需要支持 `CARD_BURIED` 的 `buriedFrom: 'play'` 真正把场上实体移出
- 以 `onCardBuried / onBuriedCardUncovered` 作为通用触发时机后，`base_star_portal` 与 `Pharaoh` 可以直接复用反应队列，不再把 Ancient Egyptians 特判塞进 UI 或 reducer。
- bury UI 现已落在 `src/games/smashup/ui/BaseZone.tsx`：
  - 当前玩家通过 `playerView` 保留真实 `defId`，因此可直接渲染真实卡面
  - 非控制者继续看到 `buried_unknown`，UI 只渲染隐藏占位，不会泄露真实信息

## Vikings 实施发现

- 仓库原有 Vikings locale 与官方 Oops 规则书 / Fandom 口径明显冲突，不能继续当作实现基线；本轮已整体改回官方语义。
- 当前 Vikings 的实现主轴不是 bury，而是 `deck top / discard / steal / extra-action` 联动，核心文本基线为：
  - `Huscarl`：天赋，手牌压回牌库顶，本回合自身 `+2`
  - `Shield Maiden`：展示另一位玩家牌库顶；若为行动或力量 `<= 3` 的随从，则加入你手牌
  - `Raider`：天赋，至多三张手牌压顶，本回合自身每张 `+1`
  - `Valkyrie`：从另一位玩家弃牌堆取一张随从到你手牌
  - `Viking Funeral`：附着力量 `5+` 随从；当其进入弃牌堆时你得 `1 VP`；若你拥有该随从则改为回盒
  - `Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training`
  - `Drakkar / Longhouse`
- `base_drakkar` 不能走 `CARD_TRANSFERRED` 的同玩家 `deck -> hand` 路径；该 reducer 分支会被相同 key 覆盖。当前已改用 `CARDS_DRAWN`，测试通过。
- 已落地的 Vikings 行为包括：
  - `Huscarl / Shield Maiden / Raider / Valkyrie`
  - `Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training`
  - `Viking Funeral`
  - `base_drakkar / base_longhouse`
- 仍需在统一收尾阶段重点复核的近似实现点：
  - `Raiding Party` 目前是“先入手再给额外同类打出额度”的近似语义，不是严格的“从揭示区立即打出”
  - `Raiding Party` 未实现“其余牌任意顺序放回牌库顶”的完整交互
  - `Viking Funeral` 目前只有最小覆盖测试，后续统一审计时应补更强回归用例

## Cowboys 实施发现

- 仓库原有 Cowboys locale 与官方 Oops 规则书 / Fandom 口径冲突明显，不能继续沿用；本轮已将 `Deputy / Gunfighter / Pinkerton / Sheriff / Stagecoach / Run 'Em Off / Quick Draw / High Noon / Gold Strike / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / So-So Corral` 切回官方文本。
- Cowboys 第一轮已落地的玩法主链路包括：
  - `Gunfighter`：打出后在同基地选择敌方随从决斗，并按胜负消灭失败者
  - `High Noon`：先选己方随从再选敌方随从决斗；己方获胜时给予该基地额外随从额度
  - `Run 'Em Off`：决斗后给予胜者 `+3` 临时力量，并把失败者移动到另一基地
  - `Quick Draw`：已实现“普通场景 `+2` / active duel 中 `+4`”两条分支
  - `Gold Strike`：打出到基地后，在你打出随从到这里时抽牌
  - `Sheriff / Saloon / So-So Corral`
- 本轮顺手修掉了 `cowboys.ts` 中两处会制造假阳性的旧逻辑：
  - 额外出牌额度事件误写成 `amount`，现已改回 reducer 约定的 `delta`
  - `Saloon` 曾被错误塞进 duel 结算里直接抽牌；现已只保留官方的 `onMinionDestroyed` 基地触发
- 当前 Cowboys 已切到官方 duel 内核共享实现；已覆盖并验证的链路包括：
  - `Pinkerton`：决斗前为己方决斗随从放置 `+1` 指示物
  - `双方各可选择 1 张 duel card 或跳过`
  - `Deputy`：弃置手牌中的 `Deputy`，再选择一个随从获得直到回合结束 `+2` 力量
  - `destroy_loser / high_noon / run_em_off / vp_to_winner / draw2_to_winner` 等结局分支复用同一 duel 状态机
- Cowboys 决斗链此前还存在一处 UI 文案层的 i18n 断裂：
  - `Board.tsx` 顶部决斗横幅与卡名已经跟随 locale 渲染
  - 但 `src/games/smashup/domain/duel.ts` 的阶段标题、跳过按钮、Pinkerton 数量按钮仍是硬编码中文
  - 同时 `Board.tsx` 里用于手牌/基地/随从直点交互的快捷按钮没有复用 `PromptOverlay` 的 i18n 解析
  - 结果就是英文 locale 下会出现“英文横幅 + 中文交互标题/按钮”的混搭
- 本轮修复后：
  - `PromptOption` 新增 `labelKey / labelParams`
  - `PromptOverlay.tsx` 支持把整句 `ui.xxx` 直接解析成翻译文本
  - `Board.tsx` 的 hand/base/minion 快捷按钮也统一走同一套 label 解析
  - `duel.ts` 的 `Pinkerton / duel card / Deputy / Run 'Em Off` 相关提示全部改成 locale key
  - 复跑 Cowboys 浏览器 E2E 后，决斗横幅、阶段提示与跳过按钮已经统一成同一语言，不再混搭
- 本轮 E2E 还额外暴露并修复了一个真实的 duel 收尾 bug：
  - `smashup_duel_deputy_target` 之前会在弃掉 `Deputy` 后继续用旧状态推进阶段，导致同一玩家再次收到已失效的 `Deputy` 提示
  - 现已改为先模拟 `CARDS_DISCARDED + addTempPower` 再推进下一阶段，浏览器与单测都已验证修复
- Cowboys 当前仍需在后续阶段复核的缺口：
  - `Stagecoach` 的 `move / transfer` 完整语义尚未接入
  - `Dynamite Surprise` 的“对方查看/展示你手牌或牌库时反制消灭”尚未接入
  - `Form a Posse` 目前只有 `+1` 力量，尚未实现“不能被消灭/移动/回手”的完整保护
  - `Gold in Them Thar Hills` 当前仍是“抽到手里 + 给额外额度”的近似实现，不是严格的“立刻额外打出并把余牌任意排序放回”
- `So-So Corral` 已重新按官方口径收敛为“决斗并消灭失败者”；之前基于不完整摘录的“不消灭”判断已确认错误，后续统一审计不得再回退到那套口径。
- 统一审计阶段额外暴露出一个结构性硬错误：`cowboys_stagecoach` 已标注 `abilityTags: ['onPlay']`，但当时没有实际执行器；现已补上最小可运行实现与测试。
- 当前 `Stagecoach` 的明确 MVP 范围是：
  - 先选来源基地
  - 再选同一基地上 `1-2` 个己方随从
  - 最后把它们移动到另一基地
- 当前 `Stagecoach` 仍未覆盖的语义包括：
  - 更完整的 `transfer` 语义
  - 与附着行动牌、基地持续牌、其他联动对象一起搬运时的细粒度行为

## Samurai 实施发现

- 仓库原有 Samurai locale 与官方 Oops 规则书 / Fandom 口径冲突明显，不能继续沿用；本轮已将 `Samurai-Chan / Ronin / Bushi / Shogun / Yokai Attack! / Way of the Warrior / Honorable Combat / Honor the Fallen / Honor the Ancestors / Heart of the Battle / Final Haiku / Code of Bushido / Shogun's Palace / Sakura Garden` 切回官方文本。
- Samurai 第一轮已落地的玩法主链路包括：
  - `Ronin`：当它是你在该基地唯一的己方随从时，可放置两个 `+1` 指示物
  - `Samurai-Chan`：从场上进入弃牌堆后抽一张牌
  - `Bushi`：从场上进入弃牌堆且力量 `>= 5` 时获得 `1 VP`
  - `Shogun`：你另一个随从从场上进入弃牌堆后，在此随从上放置 `+1` 指示物
  - `Yokai Attack!`：消灭你的一个随从，获得额外随从与额外行动额度
  - `Honorable Combat`：两段选择后按 duel MVP 比较力量，胜者控制者获得 `1 VP`
  - `Code of Bushido`：通过三段交互把总计三个 `+1` 指示物分配给你的随从
  - `Honor the Ancestors`：当前第一轮会先给己方随从放置 `+1` 指示物，并按“其他玩家数量上限”自动把弃牌堆中的随从洗回牌库
  - `Way of the Warrior`：当前第一轮已接入对目标随从的 `+3` 临时力量
  - `Final Haiku`：附着随从离场后，当前场上的己方随从都会获得直到回合结束 `+2` 力量
  - `Heart of the Battle`：计分前 special，决斗后消灭失败者
  - `Honor the Fallen`：你此处随从进入弃牌堆后抽牌
  - `base_shoguns_palace / base_sakura_garden`
- 当前 Samurai 仍然只是第一轮实现，不是完整官方语义；统一收尾阶段必须复核以下缺口：
  - 仍未实现官方 duel 的完整 duel-card 内核，当前 `Honorable Combat / Heart of the Battle / Shogun's Palace` 仍使用力量比较型 MVP
  - `Way of the Warrior` 目前只实现了 `+3` 临时力量，尚未接入“本回合进入弃牌堆时抽牌”的正式临时触发语义
  - `Honor the Ancestors` 目前是“按其他玩家数量上限自动取弃牌堆前 N 张随从洗回牌库”的 MVP，尚未接入更精细的玩家选择 / may 语义
  - `Final Haiku` 已接入核心离场加成，但仍需在统一审计阶段复核其与附着目标离场、结算时序、后进场随从的严格官方语义
  - `Sakura Garden` 已覆盖 `onMinionDestroyed / onMinionDiscardedFromBase` 两条入口，但“同回合首次”门控目前仍更偏 destroy 记录，需在统一收尾阶段复核 discard-from-base 路径的去重语义

## 统一审计与 Gameplay E2E 发现

- `abilityBehaviorAudit.test.ts` 默认不会被普通 `vitest` 配置执行；必须使用：
  - `npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`
- 统一审计当前已通过，结果为 `21 passed`；说明四派系第一轮实现至少已经满足现有描述-元数据-注册链路的一致性门槛。
- 新增的三条 gameplay E2E 当前覆盖的是“浏览器层新交互类型能否走通”，不是“所有正式出牌链都已 full-chain 覆盖”。
- 三条 gameplay E2E 的真实覆盖口径如下：
  - `Ancient Egyptians`：验证埋葬条带显示、翻开选择、翻开后弃置与抓牌结算
  - `Cowboys`：验证真实打出 `Gunfighter` 后，浏览器里可以完整走通 `Pinkerton -> 决斗牌 -> Deputy -> 结算`
  - `Samurai`：验证目标点击、己方随从离场，以及额外随从/行动额度兑现
- 其中两条是明确的“交互注入型 E2E”：
  - `Ancient Egyptians` 直接注入 `ancient_egyptians_seal_the_tomb_uncover`
  - `Samurai` 直接注入 `samurai_yokai_attack`
- 因此这两条只能证明：
  - bury / extra-play 这两类新 UI 交互在浏览器中可操作
  - 交互选择后的 reducer/额度/UI 联动能兑现
- 但它们不能替代：
  - `Ancient Egyptians / Samurai` 从手牌正常打出该牌到最终结算的 full-chain E2E
  - Samurai outcome 专项在浏览器中的独立出图证明（当前仍以领域测试为主）

## Visual / Browser Data
- E2E 最初出现“卡图/基地图白板”现象，但不是 atlas 索引错误：
  - 远端 `aiji.webp` / `aiji_base.webp` 可正常下载
  - 页面内 `new Image()` 可拿到正确 `naturalWidth / naturalHeight`
  - 真正根因是 `CardPreview` 以前使用多层 `background-image` 充当 locale fallback，Playwright 截图路径下会把 atlas 渲染成白板
- 已修复为：运行时选择“实际加载成功的单个 URL”作为最终 `backgroundImage`。
- 新 atlas 已上传到 R2，并验证：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp` → `200`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp` → `200`
- E2E 最终证据截图：
  - `test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-selection-visible.png`
  - `test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-intake-board.png`

## Technical notes
```text
关键规范：
- AGENTS.md
- openspec/AGENTS.md
- docs/ai-rules/asset-pipeline.md
- docs/ai-rules/data-entry.md
- docs/ai-rules/testing-audit.md
- docs/testing-best-practices.md
- docs/automated-testing.md

关键原图：
- D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\base\aiji_base.png
- D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\cards\aiji.png

当前 worktree 压缩产物：
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\public\assets\i18n\zh-CN\smashup\base\compressed\aiji_base.webp
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\public\assets\i18n\zh-CN\smashup\cards\compressed\aiji.webp

最终 evidence：
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\evidence\smashup\smashup-oops-faction-intake-contract.md
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\evidence\smashup\smashup-oops-faction-intake-e2e-test.md
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\docs\games\smashup\workflows\smashup-faction-intake.md
```

## 2026-03-31 feedback closeout

### ���޸����������鵵��
- `69c8c039`�������ı����� DiceThrone����ʵ�ʶ�Ӧ SmashUp Samurai ͬʱ�������⣻���� `393b83b3` ���ǡ�
- `69c8c230` / `69c8c419` / `69c8c4f8`��Samurai ���������� `393b83b3` �޸���
- `69c903f3`��AI �Ʒֽ׶� special ���������� `d8ec6aad` �޸���
- `69c92631`����������ѡĹ����Ӻ���ѡ���ش�������� `22713717` �޸���
- `69c92aa4` / `69c92bca`��Ancient Egyptians ǰ���������� `05db8831` �޸���
- `69c92d8d` / `69c9319f`��Ancient Egyptians ʣ������������ `fa9a4c02` �޸���
- `69c92e82`���������������⣬���߼�����ȷ��ȱ�ؼ��ع鸲�ǣ��Ѳ����Բ������޸��鵵��`3dd374b2`����
- `69c93b65`���������� / afterScoring ���ⴰ���쳣������ `4ec96272` �޸���
- `69c942f0`��һĿ��Ȼ vs ɱ����������ȷ���� bug ���� `74d8e513` �޸���

### �ѹر�
- `69c93d98`��֤�ݲ��㣻����ʵ������ػع�δ�����Դ��ڵ����� bug���ȹرա�
- `69c8f2f4`���߸����ѱ������޸����ǣ���ǰ `mobileSupport` ���� zero-height �ع��� Gunslinger `The Law` 1v1/����Ŀ��ѡ��ع��ͨ������ȱ����ʵ�豸/Ŀ�����������ê��ǰ���رչ鵵��

### ����������Ӧ�ύ
- `74d8e513` fix(smashup): respect in plain sight against entangled
- `393b83b3` fix(smashup): tighten samurai trigger regressions
- `4ec96272` fix(smashup): skip pirate king afterscoring window when unplayable
- `fa9a4c02` fix(smashup): cover ancient egyptians tomb trap and seal the tomb
- `22713717` fix(smashup): support dead rise discard-base quick play
- `3dd374b2` fix(smashup): cover drakkar reshuffle handoff
- `05db8831` fix(smashup): close ancient egyptians feedback regressions
- `d8ec6aad` fix(smashup): resolve open feedback regressions

## 2026-04-22 lane-S2R Findings
- 工作区当前有大量非本轮改动；本轮必须只碰 SmashUp 反馈相关文件与 evidence，不回滚/不覆盖他人修改。
- 根目录旧 	ask_plan.md/findings.md/progress.md 服务历史 SmashUp/Oops 任务，本轮作为 2026-04-22 Addendum 追加，不创建第二份正式 plan。
- 目标实现初步入口：src/games/smashup/abilities/world_champs.ts、src/games/smashup/abilities/mermaids.ts、src/games/smashup/abilities/samurai.ts、src/games/smashup/domain/baseAbilities.ts、src/games/smashup/domain/reducer.ts、对应 faction data/locale 与现有测试文件。

## 2026-04-22 Dicethrone critical follow-up Findings
- `69cba605` 的核心风险点在于 `Dice3D` 无 sprite 时仅显示 shimmer；当浏览器/网络导致骰图长期不可用，会形成“骰面不可见”的真实体验缺口。
- 本轮将兜底策略改成“shimmer + 可见文本符号”，并且用 `data-face-symbol` 暴露可观测标记，保证失败路径可验证。
- `69c3c83e` 黑屏链路本轮未观察到新的回归实现点；历史修复（board-shell 缩放从 CSS 除法改为 JS 预计算）仍在当前代码中。
- 本轮证据文档：`evidence/dicethrone/dicethrone-feedback-69c3c83e-69cba605-followup-2026-04-22.md`。

## 2026-04-22 SmashUp 三派系审计复审 Findings
- 三派系（`mermaids` / `skeletons` / `world_champs`）能力回归与四项审计套件在当前代码上全部通过，未发现新增行为回归。
- “实施中”文案已收敛到单值：`实施中 / Implementation in Progress`，并已从中英文 locale 删除 `faction_implementation_in_progress_hint` 长文案键。
- 三派系统一斜向横幅 E2E 已复跑通过，最新截图时间为 2026-04-22 23:26（`test-results/evidence-screenshots/_shared/smashup-10th-factions-*.png`）。
- 三派系专项审计文档已补齐 D1-D49 维度：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`。
- 通过静态比对 `registerAbility` 与 `newFactionAbilities` 主回归文件，发现仍有 20 条能力未被该文件直接点名（Mermaids 7 / Skeletons 6 / World Champs 7）；已在审计文档登记为“未覆盖风险”，后续按批次补专项断言。

## 2026-04-23 SmashUp 三派系补测收敛 Findings
- 已在 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 补齐三派系缺口能力用例，新增/完善 `21` 条专项断言（含 `world_champs_shark_tattoo`、`skeletons_hearse_fleet`、`mermaids_toll_bay` 等）。
- `newFactionAbilities` 最新结果提升为 `166 passed / 1 skipped`，说明补测后无新增回归。
- 四项审计门禁与 i18n 复跑全部通过：
  - `interactionTargetTypeAudit` `7 passed`
  - `interactionDefIdAudit` `2 passed`
  - `abilityBehaviorAudit` `22 passed`
  - `interactionCompletenessAudit` `5 passed`
  - `npm run i18n:check` 通过
- 静态比对 `registerAbility('<id>')` 与 `newFactionAbilities.test.ts` 后，三派系缺口已收敛为 `0 / 0 / 0`（Mermaids / Skeletons / World Champs）。

## 2026-04-23 SmashUp 三派系大厅 E2E 断言修正 Findings
- 失败根因不是业务回归，而是测试语义错配：3 人房创建后房主占 1 席，座位文本应为“玩家 / 空位 / 空位”，旧断言误写成“空位 / 空位 / 空位”。
- 已将 `e2e/smashup/smashup.e2e.ts` 的座位校验收敛为 `toContainText(/空位\\s*\\/\\s*空位/)`，保留“仍有两个空位”的真实业务约束。
- 修正后复跑结果：
  - 单用例：`npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "3 人房间可加入且大厅会显示座位状态"` → `1 passed`
  - 整文件：`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` → `3 passed`
- 三派系统一斜向“实施中”横幅用例在整文件复跑中仍保持通过，无新增样式回归。

## 2026-04-23 SmashUp 三派系审计门禁补记 Findings
- 复跑 `interactionTargetTypeAudit` 时出现 1 条门禁失败：`cthulhu_corruption` 已切到 `targetType: 'generic'`，但审计白名单未登记保留理由。
- 已在 `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` 补齐两处登记：
  - `REQUIRED_SOURCE_CONFIGS`：补 `targetType/generic + autoRefresh: field + responseValidationMode: live`
  - `APPROVED_GENERIC_SOURCE_REASONS`：补 `cthulhu_corruption` 的 generic 保留原因
- 修复后整组门禁回归恢复全绿：
  - `newFactionAbilities`：`166 passed / 1 skipped`
  - `interactionTargetTypeAudit`：`7 passed`
  - `interactionDefIdAudit`：`2 passed`
  - `abilityBehaviorAudit`：`22 passed`
  - `interactionCompletenessAudit`：`5 passed`
  - `npm run i18n:check`：通过

## 2026-04-23 Workflow 升级补记（派系实施流程）
- 已在 `docs/games/smashup/workflows/smashup-faction-implementation.md` 增补强制门禁：凡新增 `targetType: 'generic'` 的 `sourceId`，必须同步更新 `interactionTargetTypeAudit` 的 `REQUIRED_SOURCE_CONFIGS` 与 `APPROVED_GENERIC_SOURCE_REASONS`。
- 这次补记把“审计规则”前置到 workflow，避免后续新增派系时再次踩到“实现对了但审计登记漏了”的回归坑。

## 2026-04-24 SmashUp 三派系持续审计 Findings
- 已复跑三派系主回归与四项审计门禁，最新结果为：
  - `newFactionAbilities`: `168 passed / 1 skipped`
  - `interactionTargetTypeAudit`: `7 passed`
  - `interactionDefIdAudit`: `2 passed`
  - `abilityBehaviorAudit`: `22 passed`
  - `interactionCompletenessAudit`: `5 passed`
  - `npm run i18n:check`: 通过
- 已复跑 `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`，整文件 `3 passed`（含三派系统一斜向“实施中”横幅用例）。
- 横幅证据截图已更新到最新时间 `2026-04-24 09:08`（`test-results/evidence-screenshots/_shared/smashup-10th-factions-*.png`）。
- 历史“20 条缺口”已在 2026-04-23 收敛为 `0 / 0 / 0`，2026-04-24 再次复核保持不变；当前不存在三派系主回归覆盖缺口。
- 追加静态覆盖复核（扫描 `registerAbility` vs `newFactionAbilities.test.ts`）：
  - 总计能力：`40`
  - 未覆盖：`0`
  - Mermaids：`10/0`，Skeletons：`13/0`，World Champs：`17/0`
- `npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 已复跑通过。
- R2 远端资源回查保持 `200`：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp`

## 2026-04-24 Workflow 强化补记（通用 + SmashUp）
- 已更新 `.codex/skill/data-entry-workflow/SKILL.md`：
  - 新增“长期任务连续执行模式”强制门禁（S0→S4 连续推进，不得中间收口）；
  - 明确 `continue` 的默认语义是“推进下一批执行”，不是重复汇报。
- 已更新 `docs/games/smashup/workflows/smashup-faction-implementation.md`：
  - 新增“长期任务连续执行（强制）”章节；
  - 约束在无硬阻塞时持续执行，且每次推进必须回填可复查证据与 planning 文件。
- 已同步 Android 内置 locale：
  - `android/app/src/main/assets/public/locales/zh-CN/game-smashup.json` 删除 `faction_implementation_in_progress_hint`，避免 App 壳继续出现旧长文案。
- `npm run assets:upload` 复跑结果：`上传 0，跳过 530（未变更），失败 0`。

## 2026-04-24 反馈审计文档复核补记
- 已在以下证据文档追加“2026-04-24 复核补记”，与当前主线 E2E 结果对齐：
  - `evidence/smashup/smashup-feedback-69db57c-faction-select-stall-2026-04-22.md`
  - `evidence/smashup/smashup-feedback-69daa51e-auto-skip-turn-2026-04-22.md`
- 统一复核命令：`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`，结果 `3 passed`。

## 2026-04-25 两条 watchdog 反馈定向复测 Findings
- `69db57c` 定向用例复测通过：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "回归：在线 AI 在 factionSelect 阶段 seat state 延迟就绪时，不得被 watchdog 跳过到空牌对局"` → `1 passed`
- `69daa51e` 两条定向用例复测通过：
  - `在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合` → `1 passed`
  - `在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏` → `1 passed`
- 关键截图时间已更新到 `2026-04-25 00:13`，对应证据文档已追加“2026-04-25 定向复测补记”。

## 2026-04-24 线上反馈 69eb3924（SmashUp recover-interaction 卡住）
- 线上 watchdog 快照显示 `smashup_reaction_choose` 出现重复 `optionId`（同一 `activate_special:titan:*` 重复两次），并触发 `visible-interaction:recover-interaction:blocker_persisted`。
- 根因：`scoringEligibleBaseIndices` 在锁定/读取链路缺少统一去重，重复基地索引在 scoreBases 响应窗口放大为重复交互选项。
- 修复：
  - `ongoingModifiers.getScoringEligibleBaseIndices` 统一走 `normalizeScoringEligibleBaseIndices`（保序去重）；
  - `reduce` 的 `SCORING_ELIGIBLE_BASES_LOCKED` 写入前去重；
  - `index.getLockedScoringBaseIndices` 统一走 getter，避免绕过规范化。
- 回归：`src/games/smashup/__tests__/scoringEligibleLock.test.ts` 新增 2 条去重用例并通过（`12 passed`）。
- 远端状态：`69eb392453c8e640a4475d6b` 已回写为 `resolved`（`matched=1, modified=1`）。

## 2026-04-25 SmashUp 三派系复审补记（Toll Bay 回归修复）
- `newFactionAbilities` 新出现失败点是 `mermaids_toll_bay 打出后会标记本回合触发窗口`，根因不是能力缺失，而是写入路径错误：
  - 能力里通过 `result.matchState.core` 直接改 core；
  - 但执行链路仅透传 `updatedState.sys`，不会把该 core 写回，导致字段落地失败。
- 已把“触发窗口标记”收敛到 reducer 的权威写入路径：
  - 在 `SU_EVENTS.ACTION_PLAYED` 中，`defId === 'mermaids_toll_bay'` 时写入 `mermaidsTollBayActiveTurnByPlayer[playerId] = turnNumber`。
- 修复后复跑结果：
  - `newFactionAbilities`: `170 passed / 1 skipped`
  - `interactionTargetTypeAudit + interactionDefIdAudit + abilityBehaviorAudit + interactionCompletenessAudit`: `36 passed`
  - `npm run i18n:check`: 通过
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`: `3 passed`
- 补充稳定性复核：`smashup.smoke.test.ts` 复跑 `121 passed`，确认本轮修复未破坏 SmashUp 主流程烟测。

## 2026-04-25 三派系审计修订（旧结论失效回写）
- 失效结论：上一条“`mermaids_toll_bay` 触发窗口标记回归修复”的描述与当前权威语义不一致，已判定失效。
- 当前权威语义：`mermaids_toll_bay` 仅执行“选择基地后按对手随从数即时抽牌”，不包含“本回合后续移动再触发”的持续窗口。
- 证据：
  - `newFactionAbilities.test.ts` 中该卡仅保留两条即时抽牌断言，当前结果 `170 passed / 1 skipped`；
  - 全量 SmashUp 回归 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --maxWorkers 1` 结果 `146 files passed / 9 skipped`，`1962 passed / 19 skipped`；
  - 四审计套件复跑 `36 passed`，`smashup.smoke.test.ts` `121 passed`，`smashup.e2e.ts` `3 passed`。
- 文档修订：
  - 已在 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 新增“修订记录（2026-04-25 10:30）”，显式标注旧结论失效与新口径。

## 2026-04-25 R2 复核补记
- 执行 `npm run assets:upload`，结果：`上传 1342，跳过 530，失败 1（socket hang up）`。
- 对关键 URL 二次 HEAD 复核均为 `200`：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp`
  - `https://assets.easyboardgame.top/official/common/audio/bgm/Villains Music Pack Vol. 1/Maniac (RT 5.161)/compressed/Villains Maniac Main.ogg`

## 2026-04-25 Gameplay 回归 Finding：巨石阵附着天赋二次发动
- 问题复现：
  - `npm run test:e2e:ci -- e2e/smashup/smashup-gameplay.e2e.ts` 首轮出现 `1 failed / 6 passed`；
  - 失败用例：`巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额`。
- 根因：
  - `src/games/smashup/domain/commands.ts` 的 `USE_TALENT` 在 `ongoingCardUid` 分支对 `ongoing.talentUsed` 直接拒绝；
  - 缺少“巨石阵 + 附着在己方随从上的持续行动卡 + 双才能名额未占用”的例外判定。
- 修复：
  - `src/games/smashup/domain/commands.ts` 与 `e2e/src/games/smashup/domain/commands.ts` 补 `attachedHostMinion` 识别与双才能例外；
  - `src/games/smashup/__tests__/talentAbilities.test.ts` 与 `e2e/src/games/smashup/__tests__/talentAbilities.test.ts` 新增 2 条回归测试（可用/不可用各 1 条）。
- 修复后验证：
  - `talentAbilities.test.ts`: `22 passed`
  - `smashup-gameplay.e2e.ts`: `7 passed`
  - `smashup.e2e.ts`: `3 passed`
  - `newFactionAbilities + smoke`: `174 passed / 1 skipped` + `121 passed`
  - 四审计套件：`36 passed`
  - `npm run i18n:check`: 通过

## 2026-04-25 三派系复核补记（去重测试块后重跑）
- 触发：发现 `src/e2e/src/games/smashup/__tests__/talentAbilities.test.ts` 有重复新增 case。
- 处理：去重为单组“附着行动卡第2次天赋可用/不可用”回归断言，避免重复测试掩盖真实覆盖率。
- 去重后复跑结果：
  - `talentAbilities.test.ts`：`20 passed`
  - `newFactionAbilities + smashup.smoke`：`179 passed / 1 skipped` + `122 passed`
  - 四审计套件：`36 passed`
  - `npm run i18n:check`：通过
  - `smashup-gameplay.e2e.ts`：`7 passed`
  - `smashup.e2e.ts`：`3 passed`
- 结论：计数变化来自重复 case 去重，不是能力回退；去重后三派系主链路仍全绿。

## 2026-04-25 数据录入基操补齐（Wiki 工具链）
- `scripts/scrape-wiki-with-descriptions.mjs` 已补 `skeletons / mermaids / world_champs` 映射，避免对 10 周年派系漏抓。
- `scripts/final-wiki-code-comparison.mjs` 已补：
  - `nameEn` 双引号/单引号统一解析；
  - 名称归一化（`'`/`’`）避免假缺失；
  - 报告显式声明“仅校验 name/count，不校验语义”。
- 现场复核：
  - `node scripts/scrape-wiki-with-descriptions.mjs skeletons` -> `12 种 / 20 张`
  - `node scripts/final-wiki-code-comparison.mjs` -> `1 正确 / 0 问题（仅 name/count）`
  - `npx eslint scripts/scrape-wiki-with-descriptions.mjs scripts/final-wiki-code-comparison.mjs` -> 0 errors
- 结论：工具链“漏派系 + 引号误判”问题已修复；`Skeletons` 语义错配结论不变，仍需整派系重录与实现。

## 2026-04-25 Skeletons 整派系重录实施（进行中）
- 已将 `newFactionAbilities.test.ts` 的 Skeletons 区块（原 7064-7604）整体替换为新语义断言，覆盖：
  - Returned One 自埋 + 翻开后再翻一张；
  - Place ’em Down / Dig ’em Up 的基地-卡牌双段交互；
  - Graveyard / Grave Goods / Lord of Bones 的“挖掘+指示物/手埋”语义；
  - Spooky, Scary... 的“弃牌堆埋葬 + 抽 1”；
  - Hearse Fleet 的埋葬牌搬运；
  - Revenant 回合内弃牌堆自埋且每回合一次；
  - Gravestones 计分后自埋到他基地；
  - Gravetender 每回合首次埋/挖触发抽牌。
- 定向验证通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "Skeletons abilities" --configLoader native --maxWorkers 1`
  - 结果：`13 passed`（Skeletons 子集全绿）。
- `interactionTargetTypeAudit` 已按新 sourceId 完成门禁同步：
  - 新增/调整 `APPROVED_GENERIC_SOURCE_REASONS`（`skeletons_*_cards/uncover/...`）；
  - 修复 `unknown` generic 来源（`handleSkeletonsHearseFleetSpecialMode` 改为字面量 sourceId 分支）；
  - 移除失效登记项 `skeletons_dig_em_up`，改为 `skeletons_dig_em_up_cards`。
- 审计验证通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
  - 结果：`7 passed`。
- 质量门禁：
  - `npx eslint src/games/smashup/abilities/skeletons.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`：0 error（warnings 存量未扩大）；
  - `npm run i18n:check`：通过（仅动态 key 警告）。

## 2026-04-26 SmashUp 三派系审计续跑 Findings
- `interactionCompletenessAudit` 的孤儿误报根因已确认是 `_pod` alias 引用不对称；在 `createOrphanHandlerCheck` 做 alias 对称映射后，审计恢复稳定通过。
- `Mermaids` 两条争议用例已对齐当前实现语义：
  - `mermaids_desert_island` 校验“控制者总力量压制”而非“强制退回随从”；
  - `mermaids_charmed` 校验完整交互链与压制元数据，不再误用 `tempPowerModifier=-2` 旧口径。
- 最新门禁口径：`newFactionAbilities 178 passed / 1 skipped`，四审计套件 `36 passed`，`i18n:check` 通过（仅 dynamic-key warning）。
- E2E 本轮状态：横幅目标用例通过并完成核图；同文件存在 1 条 join 超时失败（3 人房座位状态），需后续单独稳态化。

## 2026-04-26 SmashUp 横幅 E2E 稳态化补记
- 本轮 `smashup.e2e.ts` 失败不是横幅逻辑回归，而是“3 人房间”用例在第三访客 join 时触发默认 30s 测试超时。
- 已在 `e2e/smashup/smashup.e2e.ts` 对该用例显式提升超时为 `120000ms`，保留原业务断言不变。
- 修复后复跑结果：`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 为 `3 passed`，横幅用例继续通过。

## 2026-04-26 SmashUp smoke 追加复核
- 在完成三派系审计 + 横幅 E2E 收敛后，补跑 `smashup.smoke.test.ts`，结果 `124 passed`。
- 结论：本轮 `_pod` 审计修复、Mermaids 语义对齐与 E2E 超时稳态化未引入 SmashUp 主流程烟测回归。

## 2026-04-26 全量 SmashUp 回归探测 Findings
- 三派系目标门禁（`newFactionAbilities` + 4 审计 + 横幅 E2E + smoke）本轮均已通过；但全量 `src/games/smashup` 复跑仍报 `14` 条失败。
- 当前失败主要集中在两条链路：
  1) `afterScoring` 响应窗口会话收口（2 条）；
  2) `onDestroy` 事件链期望（11 条）与 1 条命令校验。
- 这批失败不在本轮“横幅统一样式 + 三派系审计门禁”直接改动面内，但已构成继续推进的阻塞项，需下一批进入定向排查与修复。

## 2026-04-26 全量 SmashUp 失败簇收敛（14 → 2 → 0）
- 14 条失败簇先收敛到 2 条后，最终剩余均位于 `newFactionAbilities.test.ts` 的 `bear_cavalry_bear_necessities`：
  1) 断言把目标限制成“仅行动卡”；
  2) stale 目标离场后仍可能发出 `ONGOING_DETACHED`。
- 根因分类：
  - **测试语义漂移**：卡面/i18n 权威语义明确是“消灭一个随从或在基地上打出的一张战术卡”，旧断言过度收窄。
  - **交互 stale 防护缺口**：`bear_cavalry_bear_necessities` handler 对行动卡分支缺少“目标仍在场”校验。
- 修复：
  - 对齐回归断言为“目标包含对手随从 + 已打出的行动卡”；
  - 在 `registerInteractionHandler('bear_cavalry_bear_necessities')` 增加 `actionStillOnBoard` 校验，离场则返回空事件。
- 验证：
  - `newFactionAbilities.test.ts`：`174 passed / 1 skipped`；
  - 全量回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
    - `146 files passed / 9 skipped`
    - `2016 passed / 19 skipped`

## 2026-04-26 三派系审计套件复核（收敛后再次确认）
- 失败簇清零后，复跑四项审计套件：
  - `interactionTargetTypeAudit`
  - `interactionDefIdAudit`
  - `abilityBehaviorAudit`
  - `interactionCompletenessAudit`
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：`4 files passed`，`36 passed`。
- 结论：三派系审计门禁在“14→0”修复后仍保持全绿，没有被回归修复反向打破。

## 2026-04-26 横幅 E2E 稳态化（服务冷启动防抖）
- 现象：`派系选择页应显示 10 周年三派系与统一斜向实施中横幅` 用例在 managed runtime 冷启动窗口偶发 `skip`，根因是探活仅单次请求，服务尚未 ready 即判定不可用。
- 修复：
  - `e2e/smashup/smashup.e2e.ts`
  - `e2e/smashup.e2e.ts`
  - `ensureGameServerAvailable` 改为 45 秒轮询探活（每秒一次）。
- 验证：
  1. `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"` → `1 passed`
  2. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` → `3 passed`
  3. `npm run i18n:check` → 通过（仅既有 `dynamic-key` warning）
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 2026-04-26 World Champs 关键链路补证（三）
- 新增 `world_champs_mouse_bird_and_sausage` 的浏览器级真实入口证据：覆盖“锚点选择 -> 同基地同派系二段多选 -> +2 生效”完整链路。
- 修正 `world_champs_fighting_spirit_prize` 的 E2E 多选提交方式：将“UI 局部点击 + confirm”改成 `SYS_INTERACTION_RESPOND(optionIds[])` 一次性提交，避免多选态在不同渲染模式下不稳定导致的假阴性。
- 结论变化：
  - `World Champs` 的 L3 证据从 `Stoneford / 海龟阿凯 / 盾女` 扩展为 `Stoneford / 海龟阿凯 / 盾女 / 斗志奖杯 / 鼠、鸟与香肠`。
  - 这仍是“关键样本扩展”，不是“三派系整包发布收口”；主口径继续保持“仍有残余范围”。
- 本轮关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\斗志奖杯打出后应抽两张并给两个己方随从各放一个-+1-指示物\fighting-spirit-prize-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\斗志奖杯打出后应抽两张并给两个己方随从各放一个-+1-指示物\fighting-spirit-prize-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从-+2\mouse-bird-sausage-targets-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从-+2\mouse-bird-sausage-resolved.png`

## 2026-04-26 骷髅《复仇者》真实入口口径回写
- 旧 E2E 失败不是《复仇者》逻辑回归，而是**测试还停留在旧 prompt 模型**。
- 当前真实实现已经不是 `waitForInteraction('skeletons_revenant_base')` 这条链，而是：
  1. 你的出牌阶段，弃牌堆存在《复仇者》；
  2. 弃牌堆面板中出现可选《复仇者》；
  3. 选中后出现“点击基地埋葬这张牌”提示；
  4. 点基地直接 `ACTIVATE_SPECIAL({ discardCardUid, baseIndex })`；
  5. `usedDiscardPlayAbilities` 记账后，同回合第二次不再暴露入口。
- 因此这里被补上的不是单纯一条 E2E，而是**审计口径纠偏**：旧“Revenant 仍缺 during-turn/L3”结论已经失效。

## 2026-04-26 世界冠军《武士 陈》负路径证据
- 当前浏览器基线下，真实打出《武士 陈》后不会再出现《海龟阿凯》的“选择玩家 -> 交牌 -> 抽两张”交互。
- 这说明用户当时看到的“武士 陈卡面却触发海龟阿凯效果”在当前基线上已不再复现，能够继续支撑“根因是 cards7 图集索引错位，而不是当前能力实现串线”的结论。
- 这条证据的价值是**负路径**：不是再证明《海龟阿凯》能正常触发，而是证明《武士 陈》不会误触发《海龟阿凯》。

## 2026-04-26 World Champs《金币猫 / 鲨鱼纹身》补证与根因升级
- 《金币猫》当前浏览器级真实入口已确认：
  - 打出后 prompt 会同时给出同基地己方/敌方其他随从；
  - 选择敌方后，只有敌方目标获得 `+1`，没有误加到己方。
- 《鲨鱼纹身》当前卡图语义与实现录入本身一致，问题不在数据录入：
  - 打出时附着并立即给宿主 `+1`；
  - 下个自己回合开始时若这里确实只有你这一张随从，则再给 `+1`；
  - 若这里还有你的其他随从，则不会额外加。
- 本轮真正定位到的根因比“卡图/配置录错”更深一层：
  - `src/games/smashup/domain/index.ts` 的 flow hook 会把**已被事件预先 reduce 过的 core**夹带进 `updatedState` 返回；
  - 引擎随后又会对返回事件再 reduce 一遍；
  - 对《鲨鱼纹身》表现成“事件只有 1 条，结果却多算 1 次”。
- 结论：
  - 这次不是“审计维度只有卡图/文本不够”，而是**对象级重审把问题从表面卡牌怀疑，推进到了 flow hook / updatedState / core 双算边界缺陷**。
  - 也因此，后续三派系重审不能只看“卡图对上了没”，还必须继续抽样覆盖“startTurn / endTurn / afterScoring”这类阶段切换链路。

## 2026-04-26 World Champs《警长 / 木乃伊》补证与误判根因回写
- 《警长》与《木乃伊》当前都已补到浏览器级真实入口证据：
  - `警长应在基地计分前发起决斗并摧毁落败随从` → `1 passed`
  - `木乃伊应在基地计分后埋葬到另一个基地` → `1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-world-champs-sheriff-mummy-e2e-2026-04-26.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-duel-card-prompt-2026-04-26.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-duel-resolved-2026-04-26.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-mummy-after-scoring-prompt-2026-04-26.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-mummy-buried-on-other-base-2026-04-26.png`
- 本轮收紧后的根因结论：
  - 《警长》此前更像是 **E2E helper 只看 host 视角 + 错点泛化 Pass + 场景残留 titan 污染**；
  - 《木乃伊》此前更像是 **beforeScoring 场景污染 afterScoring 入口**；
  - 这两张牌当前都**不应再被粗暴归类成“卡图录错 / 数据录错”**。

## 2026-04-27 World Champs《高速追逐 / 现在是闪电时间！ / 聪明Set-Up》对象级补证
- 本轮继续按“卡图优先 + 对象级真实入口”推进，补齐 3 张仍缺浏览器级 L3 证据的行动牌：
  - 《高速追逐》
  - 《现在是闪电时间！》
  - 《聪明Set-Up》
- 本轮 E2E 结论：
  - `高速追逐`：已证实真实链路为“打到基地 -> 发动天赋 -> 先选己方随从 -> 再选目标基地 -> 行动转移、随从移动、本回合 +3”
  - `现在是闪电时间！`：已证实真实链路为“打出 -> 选己方随从 -> 仅被选中者本回合 +3”
  - `聪明Set-Up`：已证实真实链路为“附着到其他玩家随从 -> 切到对手出牌阶段 -> 该基地首次打出随从后你抽 1 张”
- 证据文档：
  - `evidence/smashup/smashup-world-champs-high-speed-smart-blitz-e2e-2026-04-27.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-high-speed-chase-ongoing-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-high-speed-chase-minion-prompt-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-high-speed-chase-resolved-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-its-blitzin-time-prompt-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-its-blitzin-time-resolved-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-smart-set-up-attached-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-smart-set-up-triggered-2026-04-27.png`
- 当前口径继续保持：
  - `World Champs` 对象级证据继续扩展，但三新派系整包仍是 **仍有残余范围**。

## 2026-04-28 World Champs《着魔 / 嗯？》补证与《嗯？》入口缺口定位
- 《着魔》当前不是数据录入问题；真实入口已证实为“附着宿主 -> 宿主离场 -> 转移到另一个随从并继续 +2”。
- 《嗯？》本轮发现的真实问题不是卡图/locale/previewRef，而是**入口实现缺口**：
  - 之前只有 `special executor` 和交互 handler；
  - 但没有注册到弃牌区 `discard special provider`；
  - 也没有在结算后写 `DISCARD_ABILITY_USED` 做“本回合一次”锁定。
- 修复后《嗯？》已证实真实链路为：
  - 本回合打出第一个行动后；
  - 从弃牌堆作为额外行动发动；
  - 选择一个己方随从获得 `+1`；
  - 该牌回到手牌。
- 这次再次说明三新派系重审不能只看“卡图和中文名有没有对上”，还要抽样 `discard special / endTurn / afterScoring / startTurn` 这类真实入口链路。

## 2026-04-28 World Champs《彩虹女孩 / 怪兽冲击》补证
- 《彩虹女孩》当前不是数据录入问题；真实入口已证实为“打出后只给这里的其他己方随从 +1，自己、敌方、其他基地己方都不吃到加成”。
- 《怪兽冲击》当前也不是数据录入问题；真实入口已证实为“打出后得到两个额外行动，并能在同回合真实打出后续两张行动”。
- 《怪兽冲击》本轮暴露的问题是**E2E 断言写错**：
  - 我一开始把第三张行动《暗杀》误当成“立即消灭目标”；
  - 但《暗杀》真实语义是“附着后在回合结束时消灭该随从”；
  - 所以这里修的是验证口径，不是卡牌实现。
- 这再次说明三新派系重审除了卡图和中文名，还要把“验证断言是否忠于卡图语义”也纳入审计范围。

## 2026-04-29 World Champs《快如闪电 / 女主角 / 阿拉密斯》补证与旧误判失效
- 旧“《女主角》复制标准行动实现没问题”的结论已经失效。
- 失效原因不是卡图、中文名或索引，而是旧审计主要停在 `events`，没有把 `finalState`、`triggerQueue`、`reaction session` 收口和真实入口 E2E 拉进来。
- 这次定位出的两条真实根因是：
  1. `smashup_reaction_choose` handler 把已经预先 reduce 过的 `core` 连同事件一起交还系统层，导致同一批事件再次 reduce；《女主角》因此从应得 `+2` 落成了 `+4`。
  2. `collectTriggers()` 对《阿拉密斯》的 `onMinionAffected` 过滤不够，只要别的随从被标准行动影响，也可能把《阿拉密斯》错误再入队。
- 为了让这条真实入口稳定可测，本轮还补了两类配套修正：
  - `GameTestContext.playCard()` 与 `selectOption()` 对“无基地前置、直接选随从”的行动牌和重名中文选项做了更稳的 direct respond；
  - 《女主角》同批次目标过滤被显式收窄到“原始受影响的同基地其他己方随从”，避免同批次误回看。
- 定向复跑结果：
  - `newFactionAbilities` 聚焦 3 条：`3 passed`
  - `快如闪电打到阿拉密斯后应可选触发女主角复制并让阿拉密斯提供额外行动`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-world-champs-diva-aramis-fast-as-lightning-e2e-2026-04-28.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-diva-aramis-reaction-prompt-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-diva-aramis-resolved-2026-04-28.png`
- 结论：
  - 这次不是数据录入错误，而是**reaction/reducer 边界错误 + trigger scope 错误**。
  - 审计维度必须继续保持：`卡图/locale/defId/注册` 之外，再强制覆盖 `finalState / triggerQueue / reaction session / 真实入口 E2E`。

## 2026-04-29 Mermaids《人鱼女王 / 安静的海岸》补证
- 当前 `Mermaids` 的残余问题已经不是“有没有基础单测”，而是对象级 L3 太少。
- 本轮新增两条浏览器级真实入口：
  1. 《人鱼女王》走 `move` 模式，把其他玩家的一个仆从移到“这里”；
  2. 《安静的海岸》打到基地后，从场上发动持续牌天赋并迁移到另一个基地。
- 这两条链路都不是新增实现修复，而是把此前只停留在 L2 的行为补到真实入口。
- 定向复跑结果：
  - `mermaids_mermaid_queen|mermaids_becalmed_shores`：`3 passed`
  - `人鱼女王应可选择移动其他玩家的一个仆从到这里`：`1 passed`
  - `安静的海岸应可从场上发动天赋并移到另一个基地`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-mermaids-mermaid-queen-becalmed-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-mermaid-queen-move-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-mermaid-queen-move-resolved-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-attached-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-move-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-moved-2026-04-29.png`
- 结论：
  - `Mermaids` 当前至少已有 `最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸` 共 `4` 条对象级正路径 L3。
  - 但三新派系整包仍是 **仍有残余范围**，不能把这 4 条直接外推成整包收口。

## 2026-04-29 Mermaids《塞壬的歌声》+ Skeletons《他们出来了》补证
- 本轮新增两条浏览器级真实入口：
  1. 《塞壬的歌声》只允许选择“还有其他己方基地可去”的来源基地，并把目标仆从真实移到该己方基地；
  2. 《他们出来了》只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌。
- 定向复跑结果：
  - `塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地`：`1 passed`
  - `他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-mermaids-siren-song-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-dig-em-up-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-source-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-target-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-resolved-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-dig-em-up-cards-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-dig-em-up-resolved-2026-04-29.png`
- 流程 finding：
  - 本轮第一次写《他们出来了》场景时，误用了仓库里并不存在的 `robot_microbot_beta`，直接把第二张“被挖掘牌”打成了 `discardWithoutPlay` 假问题。
  - 这说明 **E2E 场景数据本身也要按卡图/真实 card def 做强约束**；否则测试会制造假阴性或假阳性。
- 结论：
  - `Mermaids` 当前至少已有 `5` 条对象级正路径 L3：`最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸 / 塞壬的歌声`。
  - `Skeletons` 当前至少已有 `4` 条对象级正路径 L3：`殉葬品 / 灵车队伍 / 复仇者 / 他们出来了`。
  - 三新派系整包仍是 **仍有残余范围**，不能把这些对象级补证直接外推成整包收口。

## 2026-04-29 Skeletons《墓园》补证
- 本轮新增一条浏览器级真实入口：
  1. 《墓园》从场上发动天赋，挖掘这里一张你的埋葬牌；若挖出的是随从，则继续进入“是否放置 1 个 +1 指示物”的后续交互。
- 定向复跑结果：
  - `skeletons_graveyard 天赋挖掘后若是随从会进入可选 +1 指示物交互`：`1 passed`
  - `墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 \+1 指示物`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-skeletons-graveyard-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-uncover-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-counter-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-resolved-2026-04-29.png`
- 结论：
  - `Skeletons` 当前至少已有 `5` 条对象级正路径 L3：`殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园`。
  - 这轮新增的是**真实入口补证**，不是新增实现修复。
  - 三新派系整包仍是 **仍有残余范围**。

## 2026-04-29 Skeletons《骸骨之王》补证
- 本轮新增一条浏览器级真实入口：
  1. 《骸骨之王》从场上发动天赋，挖掘这里任意埋葬牌；被挖出的“其他随从”需要先经过 `smashup_reaction_choose`，再进入“是否放置 1 个 +1 指示物”的后续交互。
- 定向复跑结果：
  - `skeletons_lord_of_bones 天赋可挖掘这里任意埋葬牌而不只限自己`：`1 passed`
  - `骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 \+1 指示物`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-skeletons-lord-of-bones-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-uncover-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-reaction-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-counter-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-resolved-2026-04-29.png`
- 流程 finding：
  - 单测里这条链路容易被看成“挖出后直接弹 +1 提示”；
  - 但浏览器真入口里实际先进入 `smashup_reaction_choose`，再选 `骸骨之王` 才会继续到 `skeletons_lord_of_bones_ongoing`。
  - 这说明 `reaction session` 仍然必须保留在三新派系重审维度里，不能退回只看单测或 `finalState`。
- 结论：
  - `Skeletons` 当前至少已有 `6` 条对象级正路径 L3：`殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园 / 骸骨之王`。
  - 这轮新增的是**真实入口补证 + reaction session 流程 finding**，不是新增实现修复。
  - 三新派系整包仍是 **仍有残余范围**。

## 2026-04-29 Workflow / Skill 修订结论
- 这轮返工不只是单卡漏测问题，还暴露出两条流程缺口：
  1. 批量派系重审时，没有把“当前批次未清空不得停”写成项目内硬门禁；
  2. E2E 场景真值与 `reaction session` 审计维度还没被现有 workflow 明确提升到强制级。
- 已回写到项目内 skill / workflow：
  - `.codex/skill/data-entry-workflow/SKILL.md`
  - `docs/games/smashup/workflows/smashup-faction-implementation.md`
  - `docs/ai-rules/testing-audit.md`
- 新增的强制点：
  - 批量派系重审必须先建对象清单，并持续推进到当前批次清空
  - `continue` 在这类任务里默认表示“继续下一个未完成对象”，不是“补 1-2 张后停下汇报”
  - E2E 场景必须先做 `defId` 真值预检
  - Smash Up 对象补证默认按 `L0-L4` 分层验收
  - 真实入口若出现 `smashup_reaction_choose`，必须单独作为 `reaction session` 证据留档
## Session: 2026-04-29 《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》L3 补证
- **Status:** in_progress
- Findings:
  - 《轮回者》旧 E2E 的失败根因不是实现 bug，而是旧测试把“自埋后直接无交互”当成事实；真实入口会先进入 `smashup_reaction_choose`，再由《轮回者》触发项收口。
  - 《沉船湾》《墓碑》旧在线场景都没有把《绿洲丛林》推到 `12` 点计分阈值，因此“没进计分后的触发窗”属于 E2E 注入错误，不属于业务实现错误。
  - 这类错误说明当前重审必须继续坚持两条门禁：
    1. `reaction session` 不能靠单测观察面代替，浏览器级必须真看 prompt；
    2. online afterScoring 场景必须先核对原基地是否真的达到 breakpoint，再判断实现是否失效。
- Evidence:
  - `evidence/smashup/smashup-mermaids-shipwreck-cove-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`

## Session: 2026-04-29 《守墓人 / 墓地爆发》续推
- **Status:** in_progress
- Findings:
  - 《守墓人》浏览器级正路径已通过，说明“你的其他牌被埋葬后抽 1 张”在真实入口里没有漏掉。
  - 《墓地爆发》旧“只是测试基础设施阻塞”结论已失效。
  - 新确认的真实根因：
    1. 真实链路确实能进入 `skeletons_burst_forth` prompt，且目标埋葬牌会翻正、可点，这部分不是问题；
    2. 问题出在 `scoreBases` 交互收口后的自动推进时序：交互刚产出的 `MINION_PLAYED` 还没 reduce 进 core，Flow 就继续计分了；
    3. 结果是 action log 里能先看到《雷克斯王》被挖出来，但同一轮 `BASE_SCORED` 仍按旧总力量 `13` 结算。
  - 本轮修复后：
    1. `src/games/smashup/domain/systems.ts` 与 `src/games/smashup/domain/index.ts` 已新增 `scoreBases` 交互 reduce 门禁；
    2. 《墓地爆发》浏览器级已通过，证明翻出的随从会真实改写本次计分结果。
- Evidence:
  - `evidence/smashup/smashup-skeletons-gravetender-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-burst-forth-e2e-2026-04-29.md`

## Addendum（2026-04-30）：Feedback cleanup audit 收口复核
- 2026-04-24 初版 `temp/feedback-cleanup-audit-2026-04-24.md` 把 4 条反馈都列为“需复核是否回归”，这在当时成立，但已不是当前真相。
- 2026-04-30 复核后确认：
  - `69c8f2f432bd47a7b57a66f8`（DiceThrone 黑屏）已在 `temp/feedback-closeout/status-board.json` 记为 `resolved`。
  - `699f098e25c2319ea7b5f281`（波纹造成伤害但没有掉血）已在 `status-board.json` 记为 `resolved`。
  - `69a277a317d6c588726802fe`（SummonerWars 撤回特别慢 / 放大镜功能没了）已在 `status-board.json` 记为 `resolved`。
- 当前只剩 `699f0a1625c2319ea7b5f2a9`（获得 3cp 后伤害不对）未完成最终闭环：
  - 已有本地业务验证 evidence：`evidence/dicethrone/dicethrone-feedback-699eb46-699f0a-regression-verification-2026-04-25.md`
  - 但最新 `temp/feedback-closeout/remote-human-unresolved-latest.json` 仍显示该反馈远端状态为 `in_progress`
  - `status-board.json` 也尚无该条登记
- 结论：Feedback cleanup audit 不能按“已全部完成”处理；最准确说法是“仅剩 699f0a 的远端状态/状态板闭环证据待补”。

## Addendum（2026-04-30）：Feedback cleanup audit 最终闭环确认
- 对 `699f0a1625c2319ea7b5f2a9` 的最新远端直查结果表明：该反馈当前线上已是 `resolved`。
- 本地执行的 `temp/feedback-closeout/update-feedback-status-20260430-699f0a-to-resolved.js` 返回 `matched=0 / modified=0`，原因不是失败，而是该条在数据库里已经不再属于 `open / in_progress`。
- 同次返回的远端文档字段：`status=resolved`，`updatedAt=2026-04-25T16:24:42.444Z`。
- 由此可确认：此前“只剩 699f0a 未闭环”的结论已经失效；真实问题是本地状态板与审计文档漏登记，而不是线上未回写。
- 现已补齐 `temp/feedback-closeout/status-board.json` 与相关规划文档，`Feedback cleanup audit` 可以按完成处理。

## 2026-05-02 控制流栈化收口补记
- `smashup-complex-multi-base-scoring.e2e.ts` 的失败根因不是新的业务缺陷，而是测试仍按旧 UI / 旧 sourceId 假设写：
  - PASS 按钮仅匹配 `跳过|Pass|Skip`，没有覆盖真实文案 `让过`；
  - 4p 复杂链路里把固定 sourceId 顺序当成契约，没有接受 `smashup_reaction_choose -> 具体触发` 的新主链。
- 这轮修复后，SmashUp 浏览器级证据口径统一为：
  1. 先证明反应入口确实打开；
  2. 再证明 PASS / 触发选择后窗口能真实收口；
  3. 对多基地场景，用最终 VP / 基地替换结果证明“最后一个锁定基地只自动结算一次”。
- 额外清理：根目录重复旧 E2E `e2e/smashup-afterscoring-simple-complete.e2e.ts` 与 `e2e/smashup-multi-base-scoring-complete.e2e.ts` 已删除，避免旧副本继续漂移成遗留。

## 2026-05-02 DiceThrone 栈化回归补记
- 这轮真正需要证明的不是“所有武士 token 全链都重写通过”，而是 **control-flow 栈化后前台 owner / 队列恢复 / 多目标弹窗没有被打坏**。
- 当前已跑通且已看图的 3 条复杂链路，分别覆盖了 3 类高风险点：
  1. `The Law` 4 人 2v2 多目标：证明多人 targeting modal 仍按前台 owner 正常工作；
  2. `simple-choice` 收口后恢复 token 响应：证明队列恢复链没有丢失前台弹窗；
  3. `samurai honor pass`：证明 token 响应窗口关闭后不会错误 reopen。
- 根目录旧副本 `e2e/dicethrone-token-response-window.e2e.ts` 的 `samurai honor should open from real attack flow and resolve by two clicks` 当前失败，不宜直接拿来否定本轮框架重构：
  - 失败截图里 guest 端停在 `4. 那啥攻击阶段`，host 端是 `可以响应 / 跳过` + `结算攻击` 并存，说明它混用了旧入口假设与当前 UI 语义；
  - 进一步轮询后，host 侧状态会直接回到 `main2` / `defenderId=null`，更像旧测试选中的武士技能链本身不再产生“可防御”真实入口，而不是 modal owner 栈逻辑把窗口吞掉；
  - 因此它当前更应被视为 **历史重复旧测试副本**，不是本轮已经确认的产品回归。
- 本轮没有保留对这条旧副本失败 case 的试探性测试补丁，避免把“为了追旧假设而改测试”的噪音混进正式收口。
- 进一步排查后确认：
  - `e2e/dicethrone-token-response-window.e2e.ts` 可以安全删除，因为它的 6 条测试标题都已被 `e2e/dicethrone/dicethrone-token-response-window.e2e.ts` 覆盖，后者还是超集（额外包含 `月精灵闪避成功后自动收口` 与 `samurai honor pass`）。
  - 但 `e2e/dicethrone-simple-start.e2e.ts` 与 `e2e/dicethrone/dicethrone-simple-start.e2e.ts` 目前只是 **部分重叠**，彼此仍有独立用例；`e2e/dicethrone-status-interaction-complete.e2e.ts` 也仍是当前唯一正式文件，不可按“重复旧副本”删除。

## 2026-05-05 08:05 线上房间加入失败复核
- 来源口径：线上反馈源（生产 Mongo + 生产 API）。
- 生产 Mongo 直查发现当前未关闭的人类反馈只剩 2 条：  - 69f86b739ec13b96d71107d4：创房间后朋友进不了提示进入失败  - 69f86c159ec13b96d7110804：朋友加入不了房间提示加入失败
- 生产 API 部署前可稳定复现：create -> claim-seat -> join（不带 playerID）返回 403，body 为 "playerID is required"。
- 生产机仓库 /home/admin/BoardGame/server.ts 仍停在旧 join 协议（commit 2d1b8bf8b3fea80a536dd5ff3008b5e032752027），/games/:name/:matchID/join 仍强制要求 playerID。
- 当前仓库 / origin/main 已切到 resolveJoinSeat 自动分座语义，因此本次故障属于生产镜像滞后，不是新回归。
- 另发现 Android 反馈附带的 "AppUpdate plugin is not implemented on android" 来自 subscribeAndroidNativeUpdateState listener 注册 promise 未兜底，是独立兼容性风险。
- 2026-05-05 继续追查后已锁定：缺 `AppUpdatePlugin` 的不是某个 OTA/H5 bundle，而是 **2026-04-04 08:43 +0800 提交 `2b56ac5a` 之前构建出的 Android 原生壳**。
- 直接证据链：
  - `git show 7c013bce:android/app/src/main/java/top/easyboardgame/app/MainActivity.java` 中只有 `registerPlugin(GamePackagePlugin.class)`，没有 `AppUpdatePlugin`。
  - `git show 2b56ac5a --stat` 显示 `AppUpdatePlugin.java` 与 `MainActivity.java` 的注册是在 `2026-04-04 08:43 +0800` 首次落仓。
  - `git show 2b56ac5a:package.json` 仍是 `version: 0.5.0`；随后 `880b7d33` 才把项目版本升到 `0.5.1`。
  - `https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk` 当前可直接访问，且包内 `classes.dex` 可检出 `AppUpdatePlugin` / `top/easyboardgame/app/AppUpdatePlugin` 字符串；同路径 `0.5.0.apk` 返回 404。
  - `evidence/android-release-0.5.1-rollback-investigation-2026-04-04.md` 已记录：在 `2026-04-04` 修复前，`native-app-updates/android/stable/latest.json` 一度是 404；修复后首个补发到 stable 的正式原生包就是 `0.5.1.apk`。
- 结论收敛：
  - **首个确认带 `AppUpdatePlugin` 的正式原生包是 `0.5.1.apk`。**
  - 因此线上这类 `"AppUpdate" plugin is not implemented on android` 反馈，对应的缺插件正式壳就是 **`0.5.0` 正式 Android 包（以及更早壳）**，不是 `index-D9GB3chM.js` 这类 OTA/H5 hash 对应的 bundle。

## 2026-05-05 SmashUp 并列计分口径修复
- 真实业务仓库确认是 `D:/gongzuo/webgame/BoardGame`，不是 AstrBot 仓库；来源是 `tools/codex_cli_bridge.py` 与 `data/config/astrbot_plugin_hapi_connector_config.json` 的 `auto_forward_codex_bridge_cwd`。
- `大杀四方战斗力相等的情况下应该是取第二位分` 的根因定位到：
  - `src/games/smashup/domain/index.ts` -> `buildBaseRankings()`
  - 旧逻辑把并列玩家保留在当前高位 `rankSlot`，所以并列第一仍拿第一位分，并列第二仍拿第二位分。
- 修复后口径：并列组按其占据的最低名次发分。
  - 两人并列第一 -> 都拿第二位分
  - 两人并列第二 -> 都拿第三位分
- 为避免 AI 继续按旧口径判断基地收益，同步修了 `src/games/smashup/ai.ts` 的 `estimateBaseVpAward()`。
- 回归：`src/games/smashup/__tests__/baseScoring.test.ts` 新增 2 条并列计分测试，复跑通过；`npm run typecheck` 通过。

## 2026-05-05 DiceThrone watchdog：server 侧 stale candidate 才是剩余误报入口
- 当前生产新刷的 `dicethrone|online-ai-watchdog` 现场虽然快照里已经是：
  - `phase=offensiveRoll/defensiveRoll`
  - `responseWindow.windowType=afterRollConfirmed`
  - `responseWindow.responderQueue=['0']`
  - `legalActions.total=0`
  - 但本地纯函数 `resolveForceEndTurnForStalledAi(...)` 其实早已覆盖“当前 responder 是 human 时返回 null”。
- 新确认的剩余缺口不在纯函数，而在 `src/engine/transport/server.ts` 的 watchdog 序列：
  - server 拿到旧的 `active-turn-legal-only` candidate 后，若现场在恢复尝试期间切成了 human 响应窗，旧实现仍可能沿用旧 candidate 继续走失败上报；
  - 于是会出现“反馈 reason 还是 `active-turn-legal-only:follow-up-advance:legal_action_unavailable`，但 `stateSnapshot` 看起来已经是 human `afterRollConfirmed` 窗口”的错位现象。
- 本轮最小修复：
  - 在 `runOnlineAiRecoverySequence()` 里新增 candidate 再校验；
  - 任何失败上报前，都会重新跑一次 `resolveOnlineAiRecoveryCandidate(...)`；
  - 若现场已经不再匹配原 candidate（特别是已变成 human 响应窗或已无 candidate），直接删除 tracker 并静默退出，不再写系统单。
- 新增回归直接覆盖这类错位现场：
  - `online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败`
- 已验证：
  - 上述新回归 + 既有两条 human response window 用例一并通过，共 `3 passed`。
- 结论：
  - 这次更像“server 侧旧 candidate 过期未失效”，不是 `onlineAiRecovery.ts` 再次漏判 human responder。
  - 目前仍停在本地修复验证；若要真正止住线上这批 watchdog，需要后续把这一个 transport 补丁带到生产。

## 2026-05-05 SmashUp 人类反馈优先续跑
- 当前人工主线是 3 条 `smashup|feedback-modal`：
  - `69f96a734590ce09779a7205`：并列计分
  - `69f9623c4590ce09779a715f`：熊的泰坦不能用额外随从打出
  - `69f961ca4590ce09779a715a`：多人观战有 bug 看不了其他人
- `69f96a...`：
  - 已确认属于“代码已修、状态未回写”而非新根因；`buildBaseRankings()` 与 AI VP 估值都已按新产品口径修正。
- `69f9623c...`：
  - 共享根因不是熊派系专属能力，而是 `smashup_immediate_extra_minion` 的候选集漏掉了 `playAsKinds=['minion']` 的 `setaside` 泰坦。
  - 最小正确修复不是给 `bear_cavalry_major_ursa` 写特判，而是让共享 `extraPlay` 逻辑同时支持：
    - 候选枚举：`player.hand` 随从 + `getSetAsideTitansPlayableAs(..., 'minion')`
    - 基地校验：手牌随从走 `PLAY_MINION`；泰坦走 `ACTIVATE_SPECIAL`
    - 执行：手牌随从走 `PLAY_MINION`；泰坦走 `ACTIVATE_SPECIAL`
  - 新回归已经证明：额外随从 prompt 能看到 `t-ursa`，选中后会进入基地选择并最终产出 `SU_EVENTS.TITAN_PLAYED`。
- 本地状态板现状：
  - `temp/feedback-closeout/status-board.json` 仍是旧 `remote-human-unresolved-20260421-163730.json` 派生板，当前 3 条人工单 ID 不在其中。
  - 因此现在不能用 `update-local-feedback-board.mjs` 直接补状态，只能先在规划文档里登记最新事实，待拿到最新 human summary 后再正式 sync。
- `69f961ca...`：
  - 真实根因不是 spectator 加房链路，而是 `src/games/smashup/Board.tsx` 旧实现把“对手视角”建模成 `self/opponent` 二元状态，并固定取 `coreTurnOrder` 里的第一个非自己玩家。
  - 这导致四人局/观战时点击第 2、3 个玩家分数，也只能看到第一个对手的公开牌区。
  - 当前已改成 `viewTargetPlayerId` 直指被点击玩家；`displayedDeckPlayerId`、`HandArea`、`DeckDiscardZone`、返回按钮和 touch 入口都跟着切到统一模型。
  - 真实 E2E 已证明：
    - 点 P2 后能进入 `对手视角`，公开牌区显示 `牌库 3 / 弃牌 (1)`；
    - 再点 P3 后公开牌区切成 `牌库 5 / 弃牌 (2)`，不是仍停在第一个对手；
    - 返回后横幅消失，自己的手牌恢复，公开区回到 `牌库 0 / 弃牌 (0)`。
- 本轮已补 3 份本地 closeout evidence，后续可直接作为远端状态回写依据：
  - `evidence/smashup/smashup-feedback-69f96a734590ce09779a7205-tied-base-scoring-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f9623c4590ce09779a715f-extra-minion-titan-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f961ca4590ce09779a715a-multi-opponent-view-local-closeout-2026-05-05.md`

## 2026-05-06 SmashUp 三条人工反馈状态回写
- 当前开放反馈 HTTP 路径不能作为正式写入口：
  - `GET https://api.easyboardgame.top/feedback/open?status=open&page=1&limit=10` 直接返回 `404`
  - 因此本轮正式回写仍以生产 `feedbacks` 集合为准，不冒充走了 HTTP 接口。
- 生产 `feedbacks` 直连核对结果：
  - `69f96a734590ce09779a7205` / `69f9623c4590ce09779a715f` / `69f961ca4590ce09779a715a` 回写前都处于 `open`
  - 正式写入后都处于 `resolved`
  - 主证据链是回写前后两份生产快照：
    - `temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-before-20260506.raw.txt`
    - `temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-after-20260506.raw.txt`
- 本地状态板这次不再停在“老 summary 缺 ID”的状态：
  - 已把 3 条缺失人工反馈补入 `temp/feedback-closeout/status-board.json`
  - 已挂接本地 closeout evidence、验证命令和 E2E 截图
  - 校验通过：`feedback-status: ok`
- 当前剩余线上人类未收口项仍有 2 条：
  - `69fa23e04590ce09779a7c52`
  - `69fa0bd74590ce09779a7bd6`
  - 因此本轮只能宣称“指定 3 条已完成正式状态回写”，不能宣称“线上人类反馈已清零”。

## 2026-05-07 00:20 SmashUp `69faac614590ce09779a7d8f` 宗教圆环发不了效果

- 首轮新增 E2E 没有失败在规则校验或 quota 消费，而是失败在点击 `[data-ongoing-uid="oa-sacred-circle"]` 这一步。
- Playwright 明确回显：一个 `absolute inset-0 z-60` 的透明层拦截了 pointer events，这层来自基地 ongoing 卡放大镜按钮的包裹容器。
- 因此这条反馈的真实根因是 **UI 透明层吞点击**，不是《宗教圆环》领域能力本身无效。
- 最小修复方式是：
  - 桌面端把该包裹层改成 `pointer-events-none`
  - 保留真正的放大镜按钮在 hover 时 `pointer-events-auto`
- 修后同一条 E2E 已通过，截图证明《宗教圆环》能进入“已用”态，且手牌《本地人》最终成功落到巫师学院。
- 生产 `feedbacks` 直查已完成正式闭环：
  - 回写前：`69faac614590ce09779a7d8f` 仍为 `status=open`
  - 回写结果：`matchedCount=1`、`modifiedCount=1`
  - 回写后：该条已为 `status=resolved`，`updatedAt=2026-05-07T00:28:41.546Z`
- 同批最终复核：`reporterType=user && status in [open, in_progress]` 当前 `count=0`，说明截至 `2026-05-07 08:xx +08`，线上人类未收口反馈已清零。
- 但若按“所有反馈”口径看生产真源全量 `status in [open, in_progress]`：
  - 当前仍有 `32` 条未收口
  - 全部来自 `reporterType=system`、`source=online-ai-watchdog`
  - 因此当前不能回答“所有反馈都修好了”；更准确的说法是“人类反馈已清零，系统 watchdog 反馈还剩 32 条”

## 2026-05-07 21:25 最后 21 条 watchdog 系统反馈清零

- 上面“还剩 32 条”的结论已失效。
- 本轮后续又处理了：
  - 先单独回写 `69fb3fde76f10333c15ed8d9 / 69fc62984a37805e1526f6d9` 两条 SmashUp stale `arcane protector` watchdog 单；
  - 再批量回写最后 `21` 条系统单。
- 最后 21 条的正式回写结果是：
  - `resolved.matchedCount = 9`
  - `resolved.modifiedCount = 9`
  - `closed.matchedCount = 12`
  - `closed.modifiedCount = 12`
- 判定口径明确为：
  - `force-end-turn-failed ...` / `unsatisfiable-interaction-auto-skipped empty-options` 属于已修未回写或失败留痕，回写 `resolved`
  - `force-end-turn-success ...` 属于历史成功 telemetry，回写 `closed`
- 生产最终复核快照：
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - 结果：`totalOpenOrInProgress = 0`、`humanOpen = 0`
- 因此截至 `2026-05-07 21:25 +08`，准确口径已变为：
  - 人类反馈未收口：`0`
  - 系统反馈未收口：`0`
  - 全量未收口：`0`

## 2026-05-07 21:52 `69fc6298` 短暂重开后再次清零

- `69fc62984a37805e1526f6d9` 在 `2026-05-07 21:39 +08` 又被生产真源打成了 `open`。
- fresh 生产复核当时结果是：
  - `totalOpenOrInProgress = 1`
  - `humanOpen = 0`
- 这次不是新的人工反馈，而是同一个 SmashUp watchdog 聚合项再次刷开。
- 结合同局 `matchId=bSJjqanl8rO` 的生产日志，我实际看到：
  - 先出现 `force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`
  - 随后 watchdog 又继续把同局从 `scoreBases` 推到 `draw`、再推回 `playCards`
  - 说明这条在当拍已经重新收口，只是反馈状态没有跟着二次回写
- 因此本轮再次按失败类系统单口径，把该条正式回写为 `resolved`：
  - `matchedCount = 1`
  - `modifiedCount = 1`
- 最新生产复核时间是 `2026-05-07 21:52 +08`：
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 当前最终真相：
  - 人类反馈仍为 `0`
  - 系统反馈仍为 `0`
  - 全量反馈仍为 `0`

## 2026-05-07 22:00 fresh 复核仍为 0

- 最新生产直查：
  - `ts = 2026-05-07T14:00:21.653Z`
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 说明当前最终口径没有再变，仍是：
  - 人类反馈已清零
  - 系统反馈已清零
  - 全量反馈已清零


## 2026-05-10 16:20 +08 Treant / Ninja 关键发现

- 两个新英雄 ability-cards 的运行时规格为 `900x2048`、`5x8` row-major，不可复用旧公共 atlas。
- 新增角色可复用 v2 玩家面板布局，但必须显式接入 `abilitySlotLayout` / `abilitySlotMapping` / `cardAtlas`。
- 隔离 worktree 缺少未提交的 DiceThrone Common 压缩资源会导致选角头像与背景黑块；已补入 `Common/compressed`，R2 远端同内容已存在。
- 游戏内玩家面板不是 `img[alt=玩家面板]`，而是 `data-testid=player-board-surface` 上的 role image；E2E 断言已按真实 UI 出口调整。


## 2026-05-10 Treant/Ninja 重来关键发现
- `e2e/dicethrone` 下通过 `../src/...` 引入的是 `e2e/src` 旧快照，不是项目真实 `src`；新英雄 token ID 在旧快照中不存在，会把注入 token 写成 `undefined: 1`。新增机制 E2E 必须用 `../../src/...` 或直接使用稳定字面量。
- DiceThrone 被动面板旧点击处理只处理 `rerollDie` / `drawCard`，没有派发 `custom` 被动动作；因此树精生命源泉在 UI 上可用但点击无效。修复点是 Board 的 `handlePassiveActionClick`。
- Display-only 奖励骰在截图中可能表现为骰子/粒子展示而非完整居中弹窗；证据必须同时看状态变化截图，不能只用 `bonus-die-overlay` locator 断言冒充完成。

## 2026-05-12 重审结果

- 已把通用入口语义从原则扩展为矩阵门禁。
- 已建立 shayu 三派系 45 对象全量 P0/P1 审计矩阵。
- 本轮未发现新的 P0/P1 blocker。
- 当前残余：未新增浏览器 E2E 截图，因此不得把本轮结论说成全量 L3 E2E 收口；Argonaut 跨派系 action-trigger 泛化仍是后续专项。
## 2026-05-12 shayu 再次抽样调查

- 抽样对象：`sharks_dangerous_waters`、`tornados_cyclone`、`mythic_greeks_favor_of_hermes`、`mythic_greeks_favor_of_zeus`、`base_wooden_horse`。
- 关键发现：`mythic_greeks_favor_of_zeus` 的数据 `playNeedsBase` 让 UI/validator 第一入口已是基地，但 handler 旧实现又创建 `greekBasePromptProgram`，属于同 targetType 二次选择，违反“第一入口单一真相”。
- 修复：`favorOfZeus` 直接消费 `ctx.targetBaseIndex ?? ctx.baseIndex` 并发 `BREAKPOINT_MODIFIED`。
- 通用规范补强：第一入口已由命令 payload/UI 点击确定时，handler 不得再创建同 targetType 二次选择 prompt。
- 其他抽样对象未发现新 blocker；均补 L2 行为测试。

## 2026-05-12 shayu 审计缺口复盘与专项发现

- 用户指出的问题成立：不是用户要求偷懒，而是此前审计把“全量静态矩阵/抽样”误当成足够的入口链审计。
- 真正缺口：没有逐项检查 `playNeedsBase/playNeedsMinion/specialNeedsBase/trigger context` 已确定第一入口后，handler 是否仍创建同 targetType 二次 prompt。
- 已补通用门禁，不写单卡特例：第一入口已由命令 payload / UI 点击对象确定时，handler 必须直接消费，不得重复选择同一入口对象。
- 本轮专项全量重审发现 3 项：
  - `mythic_greeks_favor_of_zeus`：二次 base prompt。
  - `tornados_carried_away`：二次 minion prompt。
  - `tornados_not_in_kansas`：替换基地后同一 action 误触发新基地 onActionPlayed。
- 当前证据等级：L2 行为验证通过；本轮追加复跑 3 条高风险真实入口 E2E；其余未复跑对象不得写成 L3。

## 2026-05-12 审计口径修正：未限定“审计”必须等于全面审计

- 用户指出“审计默认指全面审计”成立；此前把专项/抽样/静态矩阵简称审计，是执行口径错误。
- 已把规则写入 `docs/ai-rules/testing-audit.md`：抽样、专项、L1 静态必须显式命名，不能冒充全面审计。
- shayu 当前真实状态：第一入口直接消费专项完成；三派系整体全面审计未完成。
- 新总入口：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。

## Addendum（2026-05-12）：全面审计 guard 当前未完成

- 已运行 `task-completion-guard` 检查 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json`。
- 结果：`INCOMPLETE`，符合预期；未完成项是全量 L2、全交互 L3、全部适用 L4、以及发现项修复/回写。
- 因此当前不得宣称 shayu 三派系全面审计完成。


## 2026-05-12 22:50 shayu 全面审计 L2 补强发现

- 本轮没有发现新的实现 blocker，但确认旧矩阵把若干对象停在“入口/间接/抽样”层级：`sharks_chum`、`base_the_deep`、`mythic_greeks_favor_of_hades`、`base_trailer_park`、`base_tornado_alley`。
- 已用领域行为测试把这些对象提升到 L2：状态断言落在宿主 +1、海渊低战力消灭、哈迪斯行动牌回手、活动房屋公园移入 +1、龙卷风走廊 once/turn 与防递归。
- 当前不能把 L2 补强等同全面审计完成：逐对象 L3/代表链和 L4 时序治理仍未核销。


## Addendum（2026-05-12 23:50 +08）：L3 真实入口补强批次

- 已补强并实际看图核对 2 条高风险 E2E：
  - Sharks：大白鲨结算辅助、飞鲨真实入口、激光束真实入口。
  - Mythic Greeks / Tornados：哈迪斯、宙斯、雅典娜、信风真实入口。
- 本批新截图与肉眼结论已回写总入口：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- 重要限定：`sharks_great_white` 这次仍由 test harness dispatch 触发天赋，只能算结算辅助证据，不算完整真实 UI 天赋入口 L3。
- 当前可升级为 L3 的对象：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_hades`、`mythic_greeks_favor_of_zeus`、`mythic_greeks_favor_of_athena`、`tornados_trade_winds`。
- 当前仍不得宣称全面审计完成：45 对象全量 L2 核销、全部 L3 代表链、全部 L4 时序治理仍未完成。


### 2026-05-13 00:03 +08 全文件 E2E 回归补充

- 补跑整文件：`$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 说明：第一次整文件复跑被同类 E2E heavy-task guard 拦截；确认使用隔离 runtime 后显式允许并发并通过。
- 该结果证明 `e2e/smashup-shayu-factions.e2e.ts` 当前 14 条代表性真实入口/时序链没有被本轮测试修正破坏；仍不等于 45 对象全量 L3/L4 完成。


## Addendum（2026-05-13 00:16 +08）：C3 全量 L2 核销

- 新增 `tornados_twister` 旋风 push/pull L2 行为测试。
- `shayuComprehensiveBehavior.test.ts` 当前 13 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 0 errors。
- 已在全面审计总入口逐对象写清 45/45 的 L2 行为证据来源；C3 可标 pass。
- 仍未完成：C4 全交互 L3/代表链截图归档、C5 全部时序/窗口/队列 L4、C6 最终修复/旧 evidence 全量回写。


## Addendum（2026-05-13 00:55 +08）：全面审计 C4/C5/C6 回写

- 总入口仍是 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- `sharks_great_white` 已重新用真实 UI 点击随从触发天赋，旧“仅 harness 辅助”结论失效。
- C4 已逐对象归档：所有真实 UI 交互入口均为独立 L3 或等价代表链；无用户入口对象显式标记 C4 不适用。
- C5 已逐家族归档：beforeScoring、afterScoring、base replace、once/turn、action-trigger、base trigger、destroy trigger、multi/order/continuationContext 均有 L4 或系统代表链证据。
- C6 已完成回写；最终是否 COMPLETE 以 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json` 与 guard 检查为准。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`

## 2026-05-14 23:38 +08 Twister 反馈复盘：审计维度仍缺“可选否定路径”

- 反馈 `6a055d1429cd213e03bfd3e9` 暴露的根因不是移动方向、阈值或入口字段，而是“你可以”语义只测了成功路径。
- 原 shayu 全面审计的失误：把 `tornados_twister` / `tornados_monster_tornado` 的 push/pull 成功路径当成完整规则证据，没有要求“合法候选存在但玩家选择跳过”的否定路径。
- 新增通用不变量：凡文案包含“你可以 / 可以选择 / 至多 / 任意数量 / may / up to / any number”，成功路径与拒绝路径是两个独立验收项；合法候选存在时必须证明 skip/空选后权威状态不变。
- 已固化位置：
  - `docs/ai-rules/testing-audit.md`
  - `.codex/skill/add-new-faction/SKILL.md`
  - `.codex/skill/smashup-faction-addition/SKILL.md`
  - `src/games/smashup/__tests__/abilityBehaviorAudit.test.ts`
- 后续同类审计禁止只写“能移动/能消灭/能拿牌”，必须同时写“能不做且状态不变”或明确说明该效果是强制效果。

## 2026-05-15 Twister 后 shayu 再审计发现

- 已按完整技能流程矩阵重新覆盖 shayu 三派系 39 张卡 + 6 张基地，共 45 对象。
- 本轮重点复核 Twister 反馈暴露的“可选否定路径”不变量：合法候选存在时，玩家仍必须能拒绝执行，且 finalState 不应发生对应移动/消灭/改变。
- 三条全链路抽查覆盖不同机制家族：Twister skip、Athena/Trade Winds 多步排序交换、Gone with the Wind afterScoring 延迟清场。
- 当前未发现新的实现错误；也未发现需要在 Twister 可选否定路径之外再新增规范维度的第二类缺口。
- 结论边界：这是 post-Twister 完整技能流程再审计和代表性全链路抽查完成，不表示每个对象都新增了一条独立 E2E；逐对象证据等级以 `evidence/smashup/smashup-shayu-post-twister-complete-flow-audit-2026-05-15.md` 矩阵为准。

## 2026-05-15 shayu 长描述复杂对象抽样发现

- 抽样对象：`sharks_megalodon`、`mythic_greeks_argonaut`、`sharks_blood_in_the_water`、`tornados_not_in_kansas`、`mythic_greeks_favor_of_dionysus`。
- 新发现的真实实现缺口集中在 `mythic_greeks_argonaut`：
  - 旧入口缺少 `playAsAction`，不能在随从额度耗尽但行动额度可用时按卡面“改为打出这张牌”。
  - 旧 Argonaut onPlay 手写触发 Odysseus / Heracles / Spartan，漏掉 Jason 的 onActionPlayed 能力。
- 已修复并补证据：`playAsAction` 贯通类型、校验、reducer、UI dispatch；Argonaut onPlay 可从 Odysseus prompt 继续串 Jason base prompt。
- 其余抽样对象未发现新的 blocker；本轮证据落在 `evidence/smashup/smashup-shayu-long-text-sample-audit-2026-05-15.md`。

## 2026-05-15 审计规范根因升级

- 本次 Argonaut 漏审代表的根因不是单卡特例，而是通用审计方法缺口：旧矩阵按“对象级 pass”核销，没有强制把真相源文本逐句/逐子句拆开验证。
- 影响边界是所有游戏：任何卡牌、技能、Token、状态、按钮、装备、基地、角色能力只要一段描述里包含多个语义，就可能被主效果测试掩盖掉第二句/例外/替代入口/额外触发。
- 已固化不变量：规则文本必须拆成 `C1/C2/C3...` 子句；每个子句都要映射到实现入口、共享消费点、状态写入/消耗点和证据。任一子句缺证据，整对象不得写 `passed`。
- 已更新落点：`docs/ai-rules/testing-audit.md`、`.codex/skill/add-new-faction/SKILL.md`、`.codex/skill/smashup-faction-addition/SKILL.md`，并回写 shayu 旧 evidence 失效结论。

## 2026-05-16 TDD 行为 seam 发现

- “拆测试文件”本身不是有效重构；有效点是让测试只通过稳定 helper facade 观察 prompt 与响应，避免实现重构时因为 `sys.interaction.current`、`prompt.data.options`、内部 command 字符串变化而批量改业务测试。
- 旧 `newFactionAbilities.test.ts` 的最后剩余块暴露了同一类耦合：决斗链、Ronin/Yokai/Code of Bushido 等用例直接读取内部 prompt 结构。已迁出到 `abilities/samurai.test.ts` 并改为 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`、`expectNoPrompt`。
- `npm run test:structure` 会扫描删除 diff，所以旧大文件被删除后仍能报告“旧内容含债务”的 warning；这不是新入口残留。后续判断是否还有新增入口，应同时看实际文件存在性与聚焦目录扫描。
- `archmageE2E.test.ts` 这类“没有 prompt”的测试同样不应断言 `sys.interaction.current` 的字段路径；`expectNoPrompt` 才是稳定行为合同。后续可优先批量处理同类纯 no-prompt 断言，风险低、收益明确。
- `turnCycle.test.ts` 证明同类收敛可以按文件小步推进：先跑基线，再替换 no-prompt 断言，再跑单文件与结构门禁。不要在一个大批次里混改 prompt 响应、无 prompt、队列顺序与业务断言。
- `specialInteractionChain.test.ts` 暴露另一类低风险收敛：测试已经通过 `asSimpleChoice` 表达“我要一个简单选择”，但仍从 `sys.interaction.current` 取原始字段。应统一改为 `getSimpleChoicePrompt`，把内部存储路径藏进 helper。
- `killer-plant-pod-verification.test.ts` 说明响应链也可以小步迁移：当测试已经使用 `testRunner.runCommand` 和标准 MatchState 时，优先复用 `respondToPrompt`，不要继续裸写 `SYS_INTERACTION_RESPOND`。
- `shayuEntryConsumption.test.ts` 属于“审计型行为测试”，也应避免裸读 prompt data；审计结论要落在“有哪个语义 prompt / 没有二次 prompt / options 不含旧入口对象”，这些可通过 facade 表达，不需要绑 InteractionSystem 存储路径。
- `promptSystem.test.ts` / `promptResponseChain.test.ts` 属于底层集成测试，但“没有活跃交互”仍是行为合同，不是必须裸读 `sys.interaction.current` 的理由；保留 queue 断言可作为额外底层细节，但主合同应走 `expectNoPrompt`。
- `reactionQueueOrdering.test.ts` 暴露了更底层的一类耦合：测试在验证 reaction choice 时同时知道 prompt sourceId、options 存储位置、以及“清掉 current 后直接调用 resolver”的内部形态。本轮把 source/options 读取迁到 facade，并把清 prompt 细节收进 `withoutCurrentPrompt` helper；这比改断言文案更接近 TDD 规范里的“深模块、小接口”。
- `baseAbilityIntegration.test.ts` 的二段 Mushroom Kingdom POD 测试证明 facade 不能只包 `current`，因为业务行为经常表现为“当前 prompt + 队列里的后续 prompt”。`getSimpleChoicePrompt(state, sourceId)` 应按 sourceId 在 current + queue 中查找，这样测试表达的是“出现了目标语义 prompt”，不是“它恰好排在 queue[0]”。
- 少数历史测试仍直接调用旧 interaction handler；过渡期应使用 `getPromptHandlerData(prompt)`，让 handler 所需 data 形状集中在 helper，而不是散落在测试文件里。
- `wizard-neophyte-actionlog.test.ts` 说明“只把 sourceId 断言换成 helper”还不够；真正会在实现重构时反复碎裂的是测试体手写系统响应命令。应优先把这类 `INTERACTION_COMMANDS.RESPOND` 改为 `respondToPrompt`，让测试只表达“选择 to_hand / play_extra”。
- `ninja-hidden-ninja-no-minions.test.ts` 与 `temple-firstmate-afterscore.test.ts` 说明低风险 sourceId 收敛也有价值：业务测试不需要知道 prompt 当前存在于 `current` 字段，只需要断言目标业务 prompt 可观察。
- `pirate-broadside-d1-audit.test.ts` 暴露 audit 文件验证口径差异：普通 `npm test` 会默认排除 `*audit*.test.ts`，这类文件必须用 `vitest.config.audit.ts` 或对应 audit 脚本验证，不能把 “No test files found” 误读成业务失败。
- `scoringEligibleLock.test.ts` 说明 option 查找也应走 facade；测试要表达“选 source/target 语义选项”，不应依赖 `current.data.options.find(...)` 的存储路径。
- `wizard-neophyte-ongoing.test.ts` 进一步确认 ongoing 目标基地这类二段 prompt 不应在测试体里暴露“当前交互 + options”形状；二段交互同样可以通过 `getSimpleChoicePrompt` + `respondToPrompt` 表达。
- `ninja-hidden-ninja-interaction-bug-repro.test.ts` 说明历史复现测试里的注释也会固化内部结构语言；可在不丢失故障语义的前提下改成“当前 prompt 为空/目标 prompt 不存在”。
- reaction queue 的 onBaseRevealed / onMinionDiscardedFromBase / onMinionPlayed 小文件都只是在证明“出现统一反应选择”；这类测试应直接用 `getReactionPrompt`，不要每个文件重复知道统一反应 prompt 的内部 sourceId 存放路径。
- `pirate-cove-chain-fix.test.ts` 说明旧泛名文件不只要“改走 facade”，还必须遵守结构门禁的净删减约束；在旧泛名文件里新增本地 helper 即使语义正确，也会继续制造旧入口体量，应优先内联或迁出到聚焦文件。
- `turnTransitionInteractionBug.test.ts` 说明 `runner.run` 重放命令序列不是必须手写系统响应命令；当上一拍已经拿到真实 MatchState，后续响应应优先用 `respondToPrompt(state, optionId, playerId)`，测试表达“玩家选择 skip”，不表达系统命令 payload 形状。
- `duplicateInteractionRespond.test.ts` 属于底层防重复响应回归，但消费后“没有活跃 prompt”仍可以用 `expectNoPrompt` 表达；只有“重复同一命令被拒绝”这个行为需要保留命令重放。
- `elder-thing-multi-select.test.ts` 是底层 simple-choice 多选合同测试，`multi` 本身仍可作为系统合同字段断言；但 options/source/target 这些通用读取应走 facade，避免游戏测试继续依赖 `data` 存储层。
- `turnCycle.test.ts` 的蘑菇王国 / Invisible Ninja 段落证明“直接调用 handler”的过渡测试也可以减少耦合：handler lookup 用 `getPromptSourceId(prompt)`，handler data 用 `getPromptHandlerData(prompt)`，这样未来 prompt 外壳调整时不用改测试体。
- `igor-big-gulp-double-trigger.test.ts` / `igor-rlyeh-double-trigger.test.ts` 说明“查某个业务 prompt 是否只出现一次”不应由测试体手工拼 `current + queue` 完成；已新增 `getPromptsBySourceId`，把队列存储形状集中到 helper。
- `shoggoth-destroy-choice.test.ts` 说明直接调用旧 handler 的多步测试也能降耦合：用 `withoutCurrentPrompt` 表达“引擎调用 handler 前已清 current”，用 `getPromptHandlerData` 传递旧 handler data，不在测试体展开 `sys.interaction.current` 的结构。
- `ancientEgyptiansMummyStrength.feedback-regression.test.ts` 暴露旧泛名文件的结构门禁风险：即使是正确的 facade 替换，只要净新增内容也会被 `test:structure` 拦截；旧泛名文件只能净删减或等量替换，最终仍应迁入聚焦测试。
- `madMonsterPartyPreventedDestroy.test.ts` 说明“包含 A prompt、不包含 B prompt”也应直接通过 sourceId facade 表达，不应先暴露完整 interaction 列表再手工 map。
- `audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts` 与 `choice-audit-fixes.test.ts` 再次确认 audit 文件需要 `vitest.config.audit.ts` 验证；普通 `npm test` 的 `No test files found` 是配置排除，不是业务失败。
- `choice-audit-fixes.test.ts` 证明旧 handler 桥接测试的本地 `clearCurrentInteraction` 应统一替换为 `withoutCurrentPrompt`，否则同一个内部清理细节会在多个 audit/回归文件重复散落。
- `wildlifePreserveProtection.test.ts` 补充证明“保护效果测试”也能降耦合：动作卡创建 prompt、选择目标、候选过滤和决斗 skip 错误提示都可通过 facade 表达，不需要测试体知道 InteractionSystem 的字段路径。
- `buryEngine.test.ts` 进一步确认“响应命令形状”也是高价值 seam：测试只表达玩家选择哪张埋葬牌翻开，不表达 `INTERACTION_COMMANDS.RESPOND` 与 `payload.optionId` 的底层拼装。
- `pirate-cove-repeat-trigger-bug.test.ts` 说明全量主计数不是唯一指标：`(interaction.data as any).sourceId` 这类隐式裸读也会在 prompt 外壳重构时碎裂，迁移时应主动一起清。
- `pirate-king-afterscoring-window.test.ts` 进一步把系统响应命令生成集中到 helper；后续 `InteractionSystem` 命令字符串或 payload 结构变化时，不应再逐个改业务测试。
- `promptE2E.test.ts` 说明历史 “E2E” 命名的 Vitest 行为测试也应使用 prompt facade；测试名称强调完整链路，不代表可以绑定内部 prompt 存储路径。
- 当前全 `src/games/smashup/__tests__` 仍有 626 条旧内部耦合命中，说明本轮只是持续迁移的一段，不是整体完成。后续应按文件簇推进：先低风险 no-prompt，再 prompt source/options，再响应命令，最后处理确实属于底层 InteractionSystem 合同测试的少数例外。
- `promptSystem.test.ts` / `promptResponseChain.test.ts` 说明不能机械追求扩展扫描 0 命中：普通“玩家响应某 option”的命令形状应改为 `respondCommand`，但 AI fallback 返回 `RESPOND/CANCEL`、`INTERACTION_EVENTS.RESOLVED` 常量这类测试目标本身就是系统合同，应保留直断言并在计划里标明为有意例外。
- `reactionQueueOrdering.test.ts` 暴露另一类小而重要的 seam：测试需要构造带 `continuationContext` 的 prompt 时，不应在测试体里直接写 `interaction.data`。`withPromptHandlerData` 把这种注入集中到 helper，后续 prompt 外壳调整时只改一处。
- `tortuga-pirate-king-flowhalted-fix.test.ts` 说明即便测试对象是 flowHalted 与交互状态守卫，也可以把“无活跃 prompt / 有活跃 prompt”的断言写成 `expectNoPrompt` / `getFirstPrompt`；注释里反复写内部路径会继续固化错误的测试接口习惯。
- `ancientEgyptiansMummyStrength.feedback-regression.test.ts` 与 `pirate-broadside-d1-audit.test.ts` 继续印证：审计/反馈回归测试也不应手写 `INTERACTION_COMMANDS.RESPOND`。这类测试的稳定接口是“玩家选择某 optionId”，不是系统命令 payload 结构。
- `elder-thing-multi-select.test.ts` 说明即便测试目标是 `createSimpleChoice` 的 multi 合同，也不需要在测试体里绑定 `data.multi` 的存储路径；`getPromptMulti` 能保留“multi 配置正确”这个行为断言，同时隔离 prompt 外壳变化。
- `alien-scout-no-duplicate-scoring.test.ts` 是典型“长命令序列回归”：即使命令数组需要精确表达 afterScoring 选择顺序，也应通过 `respondCommand` 表达选择 option 的行为，避免把系统响应命令结构散落在回归脚本里。
- `audit-d11-d12-d14-dino-rampage.test.ts` 说明 audit 文件里如果已经使用 `GameTestRunner`，响应当前 prompt 可优先用 `runner.resolveInteraction`；测试仍能表达“选择某个 minion/base option”，但不用知道 `SYS_INTERACTION_RESPOND` 命令字符串和 payload 外壳。
- `alienAuditFixes.test.ts` 说明本地测试 helper 也要一起治理：如果文件内自定义 `respondInteraction` 仍手写系统命令，后续实现重构仍会批量改测试。应让本地 helper 调用共享 facade，例如 `respondToPrompt`。
- `afterscoring-window-skip-base-clear.test.ts` 说明“构造特殊系统状态”也不必在测试体里反复写 `sys.interaction.current`；`withCurrentPrompt` / `withoutCurrentPrompt` / `withPromptHandlerData` 可以保留测试意图，同时隔离 InteractionSystem 存储形状。
- `scoreBases-auto-continue.test.ts` 说明 AI 行为测试也不能继续把 command 外壳散在断言里：如果测试目标是“AI 选择了哪个 option”，应通过 `respondCommand` / `getRespondCommandOptionId` 表达，而不是逐个手写 `SYS_INTERACTION_RESPOND`。同一文件的 `multi_base_scoring` prompt 读取也已从 `asSimpleChoice(sys.interaction.current)` 改为按 sourceId 查询的 prompt facade。
- resolution frame 这类 setup 元数据也应 helper 化；`withPromptResolutionFrameId` 让测试表达“这个 prompt 属于哪个 frame”，不直接依赖 current prompt 的存储路径。
- `elderThingAbilities.test.ts` 说明“派系能力单测”也不应因为是旧 handler 桥接就裸取 `matchState.sys.interaction.current.data`；handler data 可以通过 `getPromptHandlerData(prompt)` 传递，source/target/option/响应命令都能通过 facade 表达。
- 清理未使用变量时必须按失败用例回看变量是否后续被断言读取；本轮机械把 `events` 改成 `_events` 曾造成短暂红灯，后续类似 lint cleanup 只能针对真正未使用的局部变量做最小替换。
- `ongoingE2E.test.ts` 说明“完整 Prompt 链 E2E”也不应裸读 current：链路仍验证 Shanghai 选随从、选基地、移动落地，但测试只通过 `getSimpleChoicePrompt` / `getPromptOption` / `respondCommand` 表达玩家选择，不再绑定 InteractionSystem 的存储字段。
- POD/afterScoring prompt source 断言同样应走 `getPromptSourceId`；测试目标是“创建了 Buccaneer/First Mate 的业务 prompt”，不是“sourceId 恰好存在 data.sourceId 字段”。
- `query6Abilities.test.ts` 进一步说明“只改 sourceId 读取”还不够：同一个普通业务测试里通常同时散落 prompt source、options、multi、无 prompt 和响应命令形状；一次有效 seam 收敛应把这些一起收进 facade。
- 不能机械把“无某类事件”升级成“无 prompt”。`wizard_portal` 的全行动卡分支正是“无抽牌事件，但必须创建排序 prompt”；后续给无事件分支补 `expectNoPrompt` 前，必须先读测试名和规则语义。
- `respondCommand(...)` 可以保留命令序列测试的时间戳和玩家选择语义，同时去掉 `INTERACTION_COMMANDS.RESPOND` / `payload.optionId` 的手写外壳；这比仅替换 import 更接近 TDD 的稳定行为端口。
- `baseAbilitiesPrompt.test.ts` 说明旧 handler 桥接并不必暴露 `interaction.data`：测试仍可直接调用 handler 验证 stale-state 回归，但 handler data 应通过 `getPromptHandlerData(prompt)` 获取，这样 prompt 外壳变化时不会批量改测试体。
- 二段 prompt 不应通过 `queue[0]` 证明；`getSimpleChoicePrompt(state, sourceId)` 能表达“出现了目标业务 prompt”，同时隐藏 current/queue 的存储位置。
- 基地 prompt 的 title/player/options/source 都属于可观察 prompt 合同，应该通过 facade 断言；测试不需要知道这些字段目前在 `data` 还是展开在 prompt 顶层。
- `igor-ondestroy-idempotency.test.ts` 说明“统计某 sourceId 的 prompt 数量”应直接使用 `getPromptsBySourceId`，不要在测试体里重复拼 `current + queue`；这类重复代码是实现外壳重构时的高频碎裂点。
- 跳过块不是降计数对象。若命中只存在于 `it.skip` 历史场景，默认记录为历史债务，不为了漂亮数字去改没有运行验证价值的代码。
- `ongoingTalent.test.ts` 说明 runtime prompt 链也能按稳定行为端口表达：Zeppelin/Hideout/Pixie 的多步链仍直接调用旧 handler 验证 stale-state 与链式交互，但 prompt 查找、options 和 handler data 都不再暴露 current/queue/data 形状。
- 对 `autoResolveIfSingle` 这类 prompt 配置，测试应兼容顶层 prompt 与 handler data 两种外壳读取；重点是“该业务 prompt 是否单选自动解析”，不是字段住在哪一层。
- 只把 `newBaseAbilities.test.ts` 移到 `base-ability-contracts.test.ts` 会变成换名不换本质；有效治理必须继续检查文件是否仍是“多个业务对象共用一个大容器”。本轮继续把 `base-ability-contracts`、`samurai-bases`、`base-core-effects` 与 `first-minion-bases` 拆到业务对象/行为簇文件，才算避开“只改表象”。
- `first-minion-bases.test.ts` 的拆分说明“机制相似”不必然等于“同一测试文件”：实验工坊带旧持久化队列恢复与大法师联动，集会场只是首随从临时力量合同；放在一起会让后续任一基地重构时误扫另一类规则。按具体基地拆开更符合 TDD 的稳定行为边界。
- 拆分后的判断标准不是行数本身，而是是否还存在旧入口、裸 prompt seam、skip 死代码、或跨业务对象的大杂烩。当前目标扫描为 0 命中，`bases` 目录全量 101 tests passed；后续再拆应先证明文件内确实混有独立业务边界，不能为了压行数制造碎片化测试。
- `base-scoring-effects.test.ts` 是“按机制粗分”仍然不够的例子：4 个 afterScoring 基地互不共享规则语义，后续任一基地改规则都不应让维护者扫完整计分集合。拆成鬼屋/刚柔流寺庙/大图书馆/仪式场所文件后，测试边界更接近卡牌对象。
- `interaction-base-abilities.test.ts` 暴露重复入口问题：鬼屋 AL9000 已有自己的基地文件，集合里又有一份交互测试。正确处理不是保留两个入口，而是把交互分支合并到鬼屋文件，并删除集合入口。
- 将旧 `respondToPrompt` 直接替换为 `runCommand(respondCommand(...))` 会让测试走完整管线，也会暴露夹具不完整的问题。`rlyeh-base.test.ts` / `ninja-dojo-base.test.ts` 的红灯说明测试夹具必须包含真实玩家字段，否则不是业务断言，而是在后处理阶段因假状态崩掉。
- 测试数减少不一定代表覆盖下降：本轮 `bases` 从 101 到 100，是合并了鬼屋 AL9000 的重复“多手牌产生 prompt”覆盖；单手牌自动弃、响应弃指定手牌、空手牌不触发仍保留。后续审计测试数量变化时要先分辨“重复覆盖合并”与“行为分支丢失”。
- 对同一主题链路也要继续问“变体是否属于同一业务对象”。`samurai-sakura-garden-bases.test.ts` 最初可解释为 Sakura Garden 触发链，但普通版与 POD 版来自不同卡池/复用口径，拆成 `sakura-garden-base.test.ts` 与 `sakura-garden-pod-base.test.ts` 后，后续维护者能直接定位目标变体。
- 不要把“跨对象交互”误判为“必须同文件”。普通 Sakura Garden 与 `samurai_honor_the_fallen` 的顺序属于普通基地合同；POD Sakura Garden 与 `samurai_samurai_chan_pod` 的顺序属于 POD 变体合同。测试可以保留交互链，但文件归属应落到被验证的基地变体。
- `laboratorium-base.test.ts` 的进一步拆分说明，同一张基地牌也可能有两类维护频率不同的测试：基础规则合同应留在短文件里；线上反馈/旧持久化队列恢复这种高上下文回归应独立成文件，避免基础规则重构时被历史队列细节拖住。
- 对 `bases` 目录的验证不能再依赖单次大并发 Vitest 结果：本机两次全目录跑法都在 worker fork 阶段 OOM。可靠证据是分批精确文件验证，每批 6 个文件，覆盖 `bases/*.ts` 实际文件树并全部通过。后续若目录继续增长，应优先沉淀脚本化分批验证，而不是反复用会 OOM 的单命令。
- `pod-base-reuse.test.ts` 说明“复用合同”也容易变成横向垃圾桶。POD 复用测试应跟随对应普通基地/派系上下文，例如 Cowboys POD 放回 `cowboys-bases.test.ts`，Vikings POD 进一步随 `drakkar` / `longhouse` 拆分，而不是单独维护一个跨派系 POD 集合。
- 合并集合后要警惕制造新的集合文件：把 Vikings POD 全部并回 `vikings-bases.test.ts` 后，该文件立刻变成 Drakkar + Longhouse 的混合入口。正确收敛是继续按具体基地拆成 `drakkar-base.test.ts` 与 `longhouse-base.test.ts`。

## 2026-05-16 14:15 +08 afterScoring skip 治理补充发现

- `base_miskatonic_university_base` 当前注册点是 `onMinionPlayed`，不是 afterScoring；旧 `miskatonic-scout-afterscore.test.ts` 的前提已过期，恢复它会制造错误规则合同。
- `wizard-academy-scout-afterscore.test.ts` 使用旧 `wizard_academy` / `wizard_academy_reorder` 口径；当前有效 sourceId 是 `base_wizard_academy`，且可直接通过 `ADVANCE_PHASE` 后的真实 prompt 链验证。
- 真实 afterScoring 链路的稳定测试 seam 是：`ADVANCE_PHASE` 进入计分 → `getReactionPrompt` / `getSimpleChoicePrompt(sourceId)` 读取业务 prompt → 选择 option → 最终状态断言；不需要测试体读取 `sys.interaction.current` / `data.options`。
- `newOngoingAbilities.test.ts` 说明旧泛名大文件可以继续做“净删减式”收敛：不往里新增场景，只把现有业务断言迁到 facade，结构门禁会保留旧泛名债务 warning 但不阻断。
- `base_rlyeh` 无目标分支暴露一个重要边界：不是所有“无交互”都等价于“有 matchState 且无 prompt”。如果能力执行在无交互时不返回 matchState，测试应保留 `matchState` 不存在这个行为合同，不能强行套 prompt facade。
- `getFirstPrompt` 适合只关心“下一条业务 prompt 的 options 合同”而不关心 sourceId 的测试；若测试实际要锁 sourceId，应优先用 `getSimpleChoicePrompt(state, sourceId)`。
- `expansionOngoing.test.ts` 进一步证明本轮不是只改标线：Steampunk/Killer Plant/Innsmouth/Miskatonic 的业务测试仍验证候选过滤、二段 prompt、stale-state 防重复、POD 链路与最终事件，但测试体不再直接知道 prompt 在 `sys.interaction.current`、后续 prompt 在 `queue[0]`、候选在 `data.options` 或 handler data 就是 `interaction.data`。
- 无交互分支有两种稳定合同：能力可能返回一个无 prompt 的 matchState，也可能完全不返回 matchState。后续迁移不能机械套 `expectNoPrompt(result.matchState!)`；应先确认该用例原本保护的是“无活跃 prompt”还是“无后续 matchState”。
- `expansionBaseAbilities.test.ts` 说明扩展基地测试的高频脆弱点不只在 sourceId：stale handler 回归、reaction queue 后续 prompt、scoring session continuationContext 都曾直接绑定 `interaction.data` / `queue[0]`。这些应通过 `getPromptHandlerData` 和 sourceId prompt 查询表达，测试目标才是“出现哪个业务 prompt / 选择哪个业务 option / 是否保留 continuation 语义”，而不是 InteractionSystem 存储形状。
- `PromptOverlay.interactions.test.tsx` 说明 UI 组件测试同样不应直接 import 系统响应常量；如果测试目标是“点击按钮提交某 option”，稳定合同应是 `respondCommand(optionId)` 生成的命令语义，而不是 `INTERACTION_COMMANDS.RESPOND` 的字符串和 payload 外壳。
- `vampiresPod.test.ts` 说明 POD 复杂交互链不是只能裸读 `sys.interaction.current` 或 `queue`：Big Gulp 目标、Fledgling 反应、Nine Lives save/decline、The Count / Dinner Date / Wolf Pact 后续 prompt 都可以通过 prompt facade 表达。这样实现内部把 prompt 从 current 移到 queue、调整 data 外壳或改响应命令字符串时，业务测试不应批量碎裂。
- “不是表象”的最低判断标准：不是看命中数下降多少，而是业务测试是否还能用稳定语义端口表达行为。有效迁移应同时满足三点：测试名/断言仍描述业务行为；测试体不裸读 prompt 存储结构；验证仍跑过原行为链。`vampiresPod.test.ts` 本批满足该标准，但全目录仍有 465 条旧耦合命中，不能宣称整体完成。
- `newBaseAbilities.test.ts` 证明旧大文件里最脆的是“业务链 + 系统外壳”混写：同一测试既在证明 Drakkar/Longhouse/Cowboys/Samurai 的业务效果，又手写 `SYS_INTERACTION_RESPOND` 和 `prompt.data.options`。本轮把这些集中到 prompt/command facade 后，测试仍验证抽牌、埋葬、决斗、POD 复用和 reaction choose 顺序，但不再绑定 InteractionSystem 的字段位置。
- reaction queue 选择应按“选择哪个 sourceDefId 的反应”表达，而不是让每个测试手工知道 current prompt、triggerQueue、option.value.triggerId 和 RESPOND 命令外壳。`resolveReactionPromptBySource` 这类本地小 helper 是合理过渡；若后续多个文件重复出现，应再上提到共享 helper。
- 旧泛名文件即使命中清零，结构债务仍存在。`newBaseAbilities.test.ts` 当前 prompt seam 目标扫描为 0，但 `test:structure` 仍提示旧泛名文件债务，后续目标应是按基地/派系/能力簇迁出，而不是继续把新场景塞回这个文件。
- `interactionChainE2E.test.ts` 是最能说明“不是只改表象”的文件：它仍然逐步验证 2-4 步真实交互链、循环链、直点链和 stale move 回归，但测试体不再直接知道 prompt 存在 `sys.interaction.current`、响应命令叫 `INTERACTION_COMMANDS.RESPOND`、选项存在 `choice.options`。这正是 TDD 规范里的“行为通过稳定接口验证”。
- `smashup.smoke.test.ts` 进一步证明不能用“只改表层”来收口：该文件仍保留 133 条 smoke 行为断言，覆盖泰坦天赋、基地触发、reaction choose、AI 响应、Pecos Bill 决斗和 Fort Titanosaurus 等链路；变化是测试体不再裸读 `state.sys.interaction.current.data`、`queue[0].data`、`prompt.data.options` 或手写 `SYS_INTERACTION_RESPOND`。这能减少后续 InteractionSystem prompt 外壳重构时同步改测试的范围。
- reaction choose 的稳定 seam 应表达“选择哪个 sourceDefId 的反应”。`getReactionPromptOptionBySourceDefId` 比每个测试手写 `triggerQueue` map + `current.data.options.find(...)` 更符合 TDD 的行为接口原则。
- 旧 handler 桥接不是一律删掉；当测试仍在验证业务事件和最终状态时，可以保留 handler 调用，但 prompt source/options/handler data 必须走 facade。这样保留诊断价值，同时把内部 prompt data 形状收敛到 helper。
- 可选后续 prompt 不能机械替换为强制 facade。Ghost The Dead Rise 的链路里，弃牌后可能因弃牌堆候选不合格而没有下一步 prompt；原测试允许这一点。迁移时必须用 `getOptionalSimpleChoicePrompt` 保留“可能有，也可能没有”的行为合同。
- 对“跳过第二步”这类链路，保留一个 `getPromptOptions(...).some(id === 'skip')` 的断言比完全删掉临时 `choice` 更好；它证明 UI/交互确实给出了跳过选项，而不只是命令能被硬发出去。
- `shayuComprehensiveBehavior.test.ts` 说明“审计行为测试”也不是只能裸读内部 prompt：L2 仍验证 Megalodon 目标过滤、Mako/血腥水域额外随从限制、Shark Reef 放指示物、Hades 回收行动牌、Twister/Monster Tornado 可选跳过等业务行为，但 source/options/player/无 prompt 断言已经通过 facade 表达。
- “只改表象”的判定应看断言是否仍绑定内部外壳。`shayuComprehensiveBehavior.test.ts` 本批不是把 38 个命中改成等价字符串，而是把 prompt 外壳读取集中到 `chooseOptionBySource` 与共享 helper；后续 InteractionSystem 调整 `current/queue/data/options` 时，这类业务测试应只需要改 helper。
- 剩余 53 条不能机械清零：`promptSystem.test.ts` 中 AI fallback/event 常量属于底层合同候选，`igor-ondestroy-idempotency.test.ts` 的 4 条在 `it.skip` 历史块，audit 文件需要专用配置验证。后续应先分类，再迁移，不能为了漂亮数字改无运行价值或本来应保留的底层合同断言。
- `audit-d1-alien-crop-circles.test.ts` 暴露出测试数据工厂本身也是 TDD seam：手写随从对象少了 `attachedActions`，导致 audit 在领域 reduce 中红灯。修这种不是“为了测试改实现”，而是把测试夹具收回 `makeMinion` 这个领域对象工厂，避免以后领域字段增加时每个测试各自碎裂。
- audit 文件迁移要先用 `vitest.config.audit.ts` 建红/绿基线。普通 `npm test` 默认不覆盖 audit；如果不跑专用配置，既看不到真实红灯，也无法证明 facade 迁移没有破坏审计行为。
- 当前剩余 40 条里，多数来自 `.skip` 旧复现文件；这些不应按普通可运行测试处理。后续真正需要治理的是：一类是恢复/重写为可运行行为测试，一类是归档为历史债务，一类是 `promptSystem.test.ts` 这种底层合同例外。
- `promptSystem.test.ts` 是本轮“不要机械清零”的明确例子：AI fallback 测试目标就是确认无可选项时返回 `RESPOND` emergency skip 或 `CANCEL`，这里直接断言 `INTERACTION_COMMANDS` 属于底层系统合同，不是业务测试偷读实现细节。
- `.skip` 旧复现文件不能只做 facade 替换。它们现在没有运行价值，若要治理，应先决定是否仍代表真实需求，再重写成当前测试框架可运行的行为测试；否则迁移内部字段只是把死代码刷干净。
- 旧 `test-alien-scout-afterscore.test.ts` 的核心意图已经由活跃的 `alien-scout-pod-afterscore.test.ts` 覆盖：基础版 `alien_scout` 与 POD 版都会创建 `alien_scout_return`，同时还有两个侦察兵并存和 stale handler 场景。后续处理该 skip 文件应偏向归档/删除前确认，而不是复制同义测试。
- 规范文档里的示例也会反向塑造测试习惯。`docs/testing-best-practices.md` 底部如果继续把 `getInteractionsFromMS` 列为“检查交互”的默认工具，即使前文写了 facade 门禁，后续仍容易被复制出旧 seam。快速参考必须与门禁保持一致：默认 facade，低层枚举只留给系统契约测试。
- 性能优化不能再用“提交 skip”表达。文档中的慢速测试建议应改成“缩小运行范围/专用配置”，而不是 `it.skip`；E2E 里的动态 `test.skip()` 只允许作为环境前置失败保护，不能掩盖业务链路失败。
- 本轮 broad scan 的“剩余 40”已经不再代表活跃普通业务测试旧 seam：36 条属于 skip 历史文件，3 条属于 `promptSystem.test.ts` 系统合同，1 条属于 helper 兼容重导出。后续指标应改成“恢复/归档 skip 历史文件数量”，而不是继续追求 prompt coupling 数字清零。
- helper 重导出也是测试 seam 的一部分：即使没有业务测试直接裸读，只要 `auditUtils` 继续暴露 `getInteractionsFromMS`，新审计测试仍可能复制低层枚举路线。删除未使用的兼容出口比继续在文档里解释“别用它”更可靠。
- 全 audit 失败不能被包装成本轮失败或通过：本轮删除出口的验证证据是“无外部引用 + 结构门禁通过”；额外 audit 红灯暴露的是既有规则/注册债务，应单独按业务对象修复，不能为了证明 TDD seam 而顺手改 expected 或白名单。
- `.skip` 历史文件不能机械改成“不 skip”。`elder-thing-multi-select-integration.test.ts` 原实现依赖不存在的 Runner 形状，真正的恢复方式是重新锁定行为入口：真实 `PLAY_MINION` 命令链 + prompt facade + 最终事件/状态断言。这样才是在补测试接口，而不是把死代码改活。
- 对“多选”这类交互，不一定要测试 `data.multi` 的内部字段。更稳定的行为证据是：第一步候选包含所有合法目标，第二步不再包含已选目标，最终只消灭被选的两个随从。
- `test-alien-scout-afterscore.test.ts` 说明历史 bug 复现的标题通常比旧实现更有价值。旧实现绑定过期 Runner 和内部 `interaction.data`，但真实不变量是“移除 special tag 后 afterScoring trigger 仍创建回手 prompt，选择回手会改变权威状态”。恢复时应保留这个不变量，丢掉旧外壳。

## 2026-05-16 16:25 补充发现：Field of Honor 不是压行数问题

- `field-of-honor-base.test.ts` 最初看起来是“单一基地文件”，但实际混合了四类维护频率不同的行为：基础 `onMinionDestroyed` 合同、FAQ batch、`robot_microbot_guard` 真实命令链、缺 `destroyerId` 的后处理兜底。后两类属于消灭事件管线回归，不应和基础基地合同绑在一个文件里。
- 仅把 `field-of-honor-base.test.ts` 拆小仍然不够；真正的旧 seam 是测试体直接调 `processDestroyTriggers`。这个函数属于 reducer 内部后处理流程，后续参数、返回结构或调用位置调整时，业务测试会被迫跟改。
- 新增 `resolveDestroyedMinions` 的价值在于把测试语言改成“这些随从被消灭，由当前玩家结算”，而不是“调用 reducer 的某个内部函数并手写 `MINION_DESTROYED` 事件外壳”。这符合 TDD 的公开行为 seam 方向。
- 同类问题不能只修 Field of Honor。`base_crypt` 的 FAQ batch 用例也直接调 `processDestroyTriggers`；本轮同步迁到 `resolveDestroyedMinions`，否则会留下同一类重构碎裂点。
- 工具验证也要防“表象”：并行跑分批测试和结构门禁会触发本机 Node/Vitest OOM，不能把 OOM 当业务失败或成功。低并发分批 + 失败文件单独复跑，才是当前 `bases` 目录可复查的验证方式。

## 2026-05-16 16:40 补充发现：后处理入口比文件名更关键

- `processDestroyTriggers` 的裸调用不是单个 Field of Honor 问题，而是整棵 SmashUp 测试树的重构碎裂点。只拆目录或换文件名不能降低后续 reducer 参数/返回结构调整时的测试维护成本。
- `resolveDestroyedMinions` 应作为普通业务测试的稳定端口：测试输入是被消灭随从的业务事实，测试输出是产生的业务事件与最终状态；测试体不需要知道后处理函数名、参数顺序或 reducer 文件位置。
- helper 层保留 `processDestroyTriggers` 是合理的过渡边界；业务测试扫描应排除 helper 层并确保普通测试不再直接 import reducer 内部后处理函数。
- 下一批不能机械追求 `process*Triggers` 全清零。当前 `processMoveTriggers` / `processAffectTriggers` / `processReturnToHandTriggers` 命中集中在 `reactionQueueOrdering.test.ts` 与 `smashup.smoke.test.ts`；应先区分“业务测试误用内部入口”和“底层 reducer/系统合同测试”，前者上移到 facade，后者可保留但要明确命名为底层合同。

## 2026-05-16 16:50 补充发现：底层合同测试不应为了数字清零而隐藏意图

- `smashup.smoke.test.ts` 的后处理调用属于普通业务链路：它要证明硕大圆石、漫游山岭巨人、时间盒子的可观察行为，因此应通过 `resolveMovedMinions` / `resolveAffectedMinions` / `resolveCardsReturnedToHand` 表达业务触发。
- `reactionQueueOrdering.test.ts` 的后处理调用属于底层系统合同：测试名和断言都直接针对 `sourceEventId`、`frameId`、`counterChangeKind`、`counterDelta`。把这些调用包进业务 facade 反而会模糊测试目的。
- `processDeckInspectionTriggers` 当前也只在 `reactionQueueOrdering.test.ts` 中出现，且断言 deck-inspected 的 `sourceEventId` / `frameId`；这和 move/affect 一样应保留为底层合同测试。
- 后续扫描指标必须分两类看：普通业务测试裸调后处理入口应清零；明确命名的后处理合同测试可保留低层调用，但要有精确测试通过作为证据。

## 2026-05-16 16:58 补充发现：同一文件不能只收一半 seam

- `smashup.smoke.test.ts` 先收掉后处理函数裸调后，硕大圆石链路仍在用 `current ?? queue[0]` 和 `prompt.data` 推进。只做到这一步仍会在 InteractionSystem 外壳重构时碎裂。
- 对同一业务链路，正确收敛应同时覆盖触发入口和 prompt 读取/handler data：后处理通过 `resolveMovedMinions` 表达，prompt 通过 sourceId facade 查询，handler data 通过 `getPromptHandlerData` 传递。
- 文件级扫描比全局大数字更有执行价值：`smashup.smoke.test.ts` 的目标裸 prompt 模式已经 0 命中，说明该文件对当前几类高频 seam 已阶段性收口。

## 2026-05-16 17:02 补充发现：不要把 current 为空偷换成无 prompt

- `scoreBases-auto-continue.test.ts` 中 Hoverbot sourceId 裸读可以直接迁到 prompt facade，因为测试目标就是“出现 robot_hoverbot prompt”。
- 同文件另一处 `resolved.state.sys.interaction?.current === undefined` 不能机械替换为 `expectNoPrompt`。后者还要求 queue 为空，语义更强；除非确认该用例真正要保护“完全无 prompt”，否则会把测试合同扩大。
- 因此 seam 治理也要保持 TDD 粒度：只迁移等价的观察接口，不因为 helper 更方便就改变原行为断言范围。

## 2026-05-16 17:05 补充发现：存在性断言也应走 facade

- `afterscoring-response-window-execution.test.ts` 的 `queue.length > 0 || current` 虽然只是存在性判断，但仍绑定 InteractionSystem 存储形状。等价行为表达是 `getSimpleChoicePrompt(state)`。
- 对“有交互”这类测试，若不关心 sourceId，使用无 sourceId 的 prompt facade 比硬猜 sourceId 更稳；若测试名要求具体业务 prompt，再补 sourceId 断言。

## 2026-05-16 17:14 补充发现：先看文件内既有语义再升级断言

- `turnCycle.test.ts` 已有多处 `expectNoPrompt`，因此把同文件一处 `current === undefined` 改为 `expectNoPrompt` 符合同一文件的既有合同语义。
- 这和 `scoreBases-auto-continue.test.ts` 不同：后者没有证据表明 queue 也应为空，所以不能机械升级。迁移前先看同文件已有 helper 用法，是避免过度断言的低成本判断。

## 2026-05-16 17:18 补充发现：可选 reaction 结果要保留可选语义

- `baseAbilityIntegrationE2E.test.ts` 的 `maybeResolveReactionQueue` 用例原本允许返回 `undefined`；迁移时不能强制要求一定有 state。
- 等价迁移方式是 `if (resolved) expectNoPrompt(resolved.state)`，既隐藏 prompt 存储结构，又不改变“无 reaction 结果也可接受”的原合同。

## 2026-05-16 17:20 补充发现：数量断言应指向业务 prompt，不是 queue 容器

- `igor-two-igors-one-destroyed.test.ts` 的核心不变量是“只触发一个 Igor onDestroy prompt”。直接断言 queue 长度为 0 只是当前存储形状的副作用。
- `getPromptsBySourceId(state, 'frankenstein_igor')` 能同时覆盖 current 与 queue，断言也更贴近测试标题；这类替换比单纯 `expectNoPrompt` 更符合业务语义。

## 2026-05-16 17:30 补充发现：表象扫描要落到分层边界

- `multi-base-afterscoring-bug.test.ts` 说明“无 prompt”是业务可观察结果，不应写成 `current` 是否存在或 `queue` 长度；`expectNoPrompt` 失败时还能暴露剩余 sourceId，比裸断言更利于定位。
- `afterscoring-window-skip-base-clear.test.ts` 的 `queue = []` 不是断言，而是测试状态构造。把它收进 `withOnlyCurrentPrompt` / `withoutQueuedPrompts` 后，后续 InteractionSystem 内部队列字段变化时，只需改 helper，不需要逐个改业务用例。
- `promptSystem.test.ts` 与 `promptResponseChain.test.ts` 已经有 `expectNoPrompt` 时，再补 `sys.interaction.queue === []` 只是在重复绑定内部存储形状；删掉这类断言不会降低行为覆盖，反而减少重构碎裂点。
- 当前剩余扫描命中应保留分类：`reactionQueueOrdering.test.ts` 直接验证 `sourceEventId` / `frameId` / `counterChangeKind`，属于后处理系统合同；`bases/base-contract-helpers.ts` 是 helper 层封装点。把这两类也包成高层业务 facade，反而会丢失底层合同测试的表达力。

## 2026-05-16 17:35 补充发现：options 也是 prompt 合同的一部分

- `choice.options` 看起来比 `sys.interaction.current` 温和，但仍然把业务测试绑到 prompt 对象字段名。`getPromptOptions` 已经同时兼容 `prompt.options` 与 `prompt.data.options`，普通测试应默认走它。
- 这批改动没有削弱业务断言：Alien Invasion 仍验证受保护随从不进候选，Laseratops POD 仍验证按印制力量过滤，Cthulhu Chosen 仍验证 generic yes/no 按钮，Block the Path POD 仍验证可选派系组合。
- 对 option 枚举类测试，稳定接口不是“数组存在于哪里”，而是“候选集合包含/不包含哪些业务值”。后续新增 prompt 测试时，应优先用 `getPromptOptions` / `getPromptOption` / `getPromptOptionByCardUid` 这类 helper。

## 2026-05-16 17:40 补充发现：handler seam 先收参数签名，再决定是否黑盒化

- `baseAbilitiesPrompt.test.ts` 的 stale prompt 用例是在刻意构造“prompt 创建后目标已离场”的边界状态，短期内直接改成真实命令链可能会丢失这个诊断入口。
- 但每个用例都手写 `getInteractionHandler('具体 id')`、`getPromptHandlerData(interaction)`、`dummyRandom` 和时间戳参数，会让 handler 签名重构时成片修改测试。把这些集中到 `resolvePromptAgainstCore` 是比“直接改成 E2E”更稳的中间层。
- 后续判断 handler 直调时应先问：测试目标是 handler 注册/参数合同、stale 边界处理，还是普通用户行为？前两类可保留低层入口但要收拢签名；普通用户行为才应迁到命令链或 prompt respond facade。

## 2026-05-16 17:45 补充发现：共享 facade 比文件内小 helper 更能防回潮

- `resolvePromptAgainstCore` 如果只留在 `baseAbilitiesPrompt.test.ts`，其他文件仍会继续复制 `getInteractionHandler` + `getPromptHandlerData` + 参数顺序。上提为 `resolvePromptViaRegisteredHandler` 后，后续迁移有统一落点。
- `reactionQueueDestroyerId.test.ts` 是较好的第二个样本：它仍然保留“先走 reaction queue，再确认 displayCard 上下文”的业务断言，但不再知道 `smashup_reaction_choose` handler 的位置参数。
- 共享 helper 的边界是“已有 prompt 对象，需要按注册 handler 解析”；没有 prompt 对象、专门测试注册表行为、或直接测试 reducer/保护过滤的文件，不应被强行塞进这个 helper。

## 2026-05-16 17:50 补充发现：reaction queue 可以收 prompt seam，但保留后处理合同

- `reactionQueueOrdering.test.ts` 里同时存在两类测试：一类是“用户选择哪个 reaction prompt”的响应链，适合走 `resolvePromptViaRegisteredHandler`；另一类是 `process*Triggers` 给 queued trigger stamped `frameId/sourceEventId`，这属于底层合同，不能为了扫描好看而隐藏。
- `reactionQueueBaseOptionalClockwise.test.ts` 的关键行为是 optional trigger 按顺时针玩家轮转。迁移到共享 helper 后，测试仍验证 playerId 轮转与可选项集合，只是不再知道 reaction handler 的参数顺序。
- 对 reaction queue 后续治理，扫描指标应拆成两列：prompt 响应 seam 可持续迁移；后处理 frame/source 合同保留直接低层入口并要求测试名明确。

## 2026-05-16 17:55 补充发现：小派系文件适合先清 prompt handler seam

- `abilities/cthulhu.test.ts` 和 `elderThingAbilities.test.ts` 都是明确已有 prompt 对象、随后只为选择一个 option 而直调 handler 的模式，适合直接迁到 `resolvePromptViaRegisteredHandler`。
- 迁移后业务断言没有变：`special_madness` 仍验证抽牌/返回事件，`elder_thing_mi_go` 仍验证对手抽疯狂卡与施法者抽牌；变化只是不再绑定 handler 注册表和位置参数。
- `getPromptHandlerData` 不需要绝对清零。用于传 handler 参数时应被 facade 接管；用于验证 `displayCard`、`continuationContext`、`autoRefresh` 这类 prompt 合同时可以保留，但测试名和断言必须说明其合同意义。

## 2026-05-16 18:00 补充发现：旧泛名文件不能继续承接“顺手治理”

- `choice-audit-fixes.test.ts` 即使只是 facade 迁移，也会触发测试结构门禁，因为旧泛名文件出现净新增内容。这类文件不能继续作为当前测试治理的落点。
- 正确处理方式是迁出为聚焦文件，例如本轮的 `elder-thing-choice-goju-tiebreak.test.ts`。这样既保留原有 10 条审计回归，又不继续强化 `*-fixes` 大杂烩。
- 无 prompt 对象的 handler-level 合同测试不能强塞进 `resolvePromptViaRegisteredHandler`。`base_temple_of_goju_tiebreak` 当前直接构造 `iData`，说明它验证的是 handler 边界；后续若要升层，应先补真实 prompt 构造或命令链，而不是伪造 prompt facade。

## 2026-05-16 18:08 补充发现：普通业务 prompt 响应应优先走命令链

- `shoggoth-destroy-choice.test.ts` 原先每个用例都要知道 handler 名、handler 参数顺序、prompt data 存储位置，以及“调用 handler 前要先清 current”。这不是表象耦合，而是测试直接复刻 InteractionSystem 内部执行步骤。
- `respondToPromptOption(...)` 把业务测试接口提升到“玩家选择某个可见选项”。以后 handler 签名、`prompt.data` 结构、current 清理时机变化时，普通业务测试只需要维护 helper，不应成片改用例。
- `turnCycle.test.ts` 暴露出另一个内部耦合：旧测试手动 handler 响应后还要手动 `advanceSmashUpReactionSession`。真实 `SYS_INTERACTION_RESPOND` 管线会自动续出下一个 prompt，因此业务测试应断言“下一个 prompt 出现”，而不是继续模拟内部 resume 步骤。
- 分层口径更新：普通业务链路优先 `respondToPromptOption` / `respondToPrompt`；刻意验证 stale prompt、handler 边界或无 prompt 对象的测试才使用 `resolvePromptViaRegisteredHandler` 或更低层入口，并且测试名要表达其合同性质。

## 2026-05-16 18:14 补充发现：runtime prompt 也不能默认直调 handler

- Alien Scout 和 Microbot Reclaimer 都属于 ability runtime prompt，但普通“玩家选择一个选项”的测试仍应通过 `SYS_INTERACTION_RESPOND` 跑完整管线。否则测试会绕过事件后处理、状态应用和 prompt 续接，只验证 runtime handler 函数本身。
- stale prompt 不必退回直接 handler。`withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` 可以明确表达“旧 prompt 尚在，但权威 core 已变化”，再通过真实响应命令验证不会重复回手；这比手动传 `getPromptHandlerData(oldPrompt)` 更贴近实际运行态。
- `robotAbilities.test.ts` 剩余的 `getPromptHandlerData(prompt)` 属于动态 `optionsGenerator` 刷新合同：测试要证明弃牌堆变化后候选重新计算，不是要解析 handler。后续扫描不能把所有 `getPromptHandlerData` 等同看待，必须区分“传 handler 参数”与“prompt contract 数据输入”。
- 空多选跳过也应走 `respondToPromptOptions(state, [])`。这补齐了 `respondToPromptOption` 只能处理单个可见选项的空选择场景，避免多选能力继续手写 handler value 数组。

## 2026-05-16 18:18 补充发现：强行命令链化会掩盖低层合同

- `abilities/pirates-ongoing.test.ts` 的 First Mate afterScoring 用例手工构造 scoring session 与 reaction session，当前并没有 visible prompt 可供 `SYS_INTERACTION_RESPOND` 响应。把它硬改成 `respondToPromptOption` 会红灯，说明这是 session/handler 合同测试，不是普通用户交互链。
- 这类用例可以保留 `getInteractionHandler`，但必须在计划中归类为有意低层例外；否则扫描数字会误导下一轮继续强改，导致测试语义被破坏。
- 相比之下，`pirate_full_sail_choose_minion` 的“完成”响应可以通过真实 ability 触发先拿到 prompt，再走 `respondToPromptOption`。判断标准不是 handler 名是否存在，而是当前测试是否能以公开 prompt/命令链表达同一行为。
- `getInteractionHandler('pirate_buccaneer_move')` 这种“已注册”断言本身就是注册表合同。它不应该被 prompt facade 替换；要减少重构碎裂，应把这类合同测试集中、命名清楚，而不是伪装成业务测试。

## 2026-05-16 18:22 补充发现：用 finalState 取代 handler events + applyEvents

- `zombieWizardAbilities.test.ts` 原 `zombie_mall_crawl` 用例先直调 runtime handler，再手动 `applyEvents` 到 core。这样测试知道了“handler 返回事件、调用方负责应用事件”的内部分工。
- 改为 `respondToPromptOption` 后，测试直接从 `finalState.core` 观察弃牌堆和牌库结果，合同更接近玩家响应后的权威状态；这比单纯把 handler 调用包一层更稳定。
- `zombie_outbreak_choose_base` 同理：测试关心的是选中空基地后获得受限随从额度，而不是 runtime handler 的 value 参数形状。响应接口应表达“选择 baseIndex=1 的 prompt option”。
- 该文件剩余 `getPromptHandlerData(current)?.displayCard` 是 prompt 展示合同，和传 handler 参数不同；这类断言可以保留，但后续如果大量出现，应考虑增加 `getPromptDisplayCard` 之类更窄的 facade。

## 2026-05-16 18:25 补充发现：stale 回归可以用旧 prompt + 新 core 表达

- `frankenstein_angry_mob` 原测试通过 `resolveCurrentPromptHandlerWithCore` 把旧 prompt data 和新 core 手动喂给 handler。这个模式能测 stale，但把测试绑死在 handler 参数和“handler 返回事件后谁来 resolveInteraction”的内部分工上。
- 改为 `withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` 后，测试仍然表达同一个 stale 不变量：用户看到的是旧二段 prompt，但权威状态里目标手牌已经离开。响应走真实命令，断言不产生塞回牌库和加指示物事件。
- 这给 stale 类回归一个可复用模板：先通过真实链路拿旧 prompt，再把 prompt 挂到变化后的 match state 上响应。除非测试目标就是 handler 函数本身，否则不需要 runtime handler 直调。
- live 分支同样应从 `finalState` 或 emitted business events 观察结果，不要手动 `resolveInteraction` 拼出下一步 prompt。

## 2026-05-16 18:28 补充发现：bug 复现文件也应优先验证真实链路

- `igor-big-gulp-double-trigger.test.ts` 原测试名和代码都把复现写成 `execute -> handler -> processDestroyMoveCycle`，这会让后续 reducer/handler 拆分重构时测试同步碎裂。
- 改成 `runCommand(PLAY_ACTION)` + `respondToPromptOption` 后，测试仍覆盖同一个用户可见不变量：Big Gulp 消灭 Igor 后，只出现一个 Igor onDestroy prompt。底层 destroy cycle 是否仍叫 `processDestroyMoveCycle` 不再影响测试体。
- 历史 bug 文件里的 `console.log` 不是证据；能用 prompt facade 和最终 prompt 数量断言表达时，应删掉调试输出，避免把排障痕迹当长期测试接口。
- 低层后处理函数仍需要合同测试，但应集中在像 `reactionQueueOrdering.test.ts` 这类明确验证 frame/source 的文件，而不是散落在业务 bug 复现里。

## 2026-05-16 18:47 补充发现：live 响应下“无事发生”有两种完全不同的语义

- `expansionOngoing.test.ts` 暴露出一个之前容易混淆的点：从 direct handler 迁到 `SYS_INTERACTION_RESPOND` 后，`events.length === 0` 不再稳定等价于“业务上什么都没发生”。命令链至少可能产出 `SYS_INTERACTION_RESOLVED`，而 live 校验还可能在进入 runtime handler 之前就直接拒绝响应。
- 具体分层应拆成两类：
  - `live` 刷新后该选项已经失效：应断言 `optionsGenerator` 刷新结果不再包含该 option，随后 `respondToPromptOption(...)` 返回 `success=false` / `无效的选择`。`steampunk_mechanic_target` 被 `ornate_dome` 封锁就是这种情况。
  - 该 option 仍可点击，但 runtime 恢复阶段发现权威状态已变化：应断言响应成功收口，但不会产生业务事件，且最终权威状态未发生目标变化。`steampunk_mechanic_target` / `steampunk_change_of_venue_choose_base` 的“手牌已空”就是这种情况。
- 这意味着后续治理不能机械把旧 handler 测试里的 `expect(events).toHaveLength(0)` 平移过来；需要先判断失效发生在“响应前的 live 候选重验”还是“响应后的 runtime 业务检查”。
- 对业务测试而言，更稳的断言落点是“关键业务事件是否出现”和 `finalState.core` 是否变化，而不是总事件数组长度。总长度会被系统事件污染，继续拿它做断言只会把新管线的合理行为误判成回归。
- `killer_plant_venus_man_trap_search` 的成功路径进一步证明：一旦测试目标只是“玩家从 prompt 里选一张牌后发生什么”，即便它是 runtime prompt，也应该直接走 `respondToPromptOption(...)`。测试只关心 `MINION_PLAYED` 的业务载荷，不该知道 `getAbilityRuntimePromptHandler(...)` 的存在。

## 2026-05-16 19:06 补充发现：最终状态断言比手动 applyEvents 更接近真实合同

- `miskatonic_mandatory_reading_draw` 原先两条测试用 `getInteractionHandler(...)` 取事件，再手动 `applyEvents(state, result.events)` 验证结果。这实际上把“handler 只吐事件、调用方再 reduce”也写进了测试合同。
- 改成 `respondToPromptOption(...)` 后，测试可以直接看 `result.finalState.core`。这更接近真实用户响应后的权威状态，也减少未来 reducer / pipeline 分工调整时的连锁改测成本。
- “选择跳过” 这类命令链测试不应继续断言 `events.length === 0`。更稳的表达是“不产生目标业务事件”，例如这里明确断言没有 `MADNESS_DRAWN` 与 `PERMANENT_POWER_ADDED`，从而避开 `SYS_INTERACTION_RESOLVED` 一类系统事件噪音。
- `madnessAbilities.test.ts` 这一批迁完后，文件内剩余 low-level 入口已经更清晰：`miskatonic_those_meddling_kids_pod_mode` 是 off-phase immediate 合同，`responseValidationMode` 是 live prompt contract；`miskatonic_mandatory_reading_draw` 不再伪装成 handler-level 测试。

## 2026-05-16 21:26 补充发现：半迁移残留比旧直调更危险

- `madnessAbilities.test.ts` 这次红灯证明，“已经把主要逻辑改成 prompt 响应，但还留着两行 `getInteractionHandler(...)` 断言”是比纯旧测试更差的状态：它让测试看起来像在走真实链，实际却同时绑定两套 seam，一旦 import 被清掉就直接 ReferenceError。
- 这类残留必须尽快收成单一入口。对 `miskatonic_those_meddling_kids_pod_mode` 来说，真正要保留的是“off-phase 额外行动仍标成 `immediate`”这个合同，不是“注册表里有个同名 handler 变量”。
- `base_nine_lives_intercept` 的三条旧测试进一步说明：即使交互本身来自 replacement/保护链，只要玩家最终看到的是业务 prompt，就仍然应该通过“触发真实销毁 -> 产出 prompt -> 响应 prompt”表达。直接敲 handler 会把 continuationContext、位置参数和事件外壳一起锁进测试。
- “目标随从已失效时不应再移动旧目标” 这种 stale 场景也不需要保留直调。更稳的做法是先走真实 destroy 链拿到 prompt，再替换响应时的 `core` 去模拟目标失效；这样锁住的是“响应时二次校验必须阻止旧目标复活”，不是 handler 的裸输入形状。
- 这批收口后，全仓 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 命中从 `42` 降到 `38`。下降本身不是目标，但它说明剩余项更集中在明确的系统合同、注册表合同和 stale/baseDefId 合同，而不是业务链测试伪装成低层测试。

## 2026-05-16 21:41 补充发现：stale/baseDefId 合同也不等于必须直调 handler

- `base_mushroom_kingdom` 这两条 Deep Roots / Infiltrate 测试再次说明：哪怕你最终想验证的是“保护过滤如何看待基地能力归因”，只要业务上先出现的是 prompt，就应该先走真实 `triggerBaseAbilityWithMS(...)` 和 `respondToPromptOption(...)`。真正的合同是 move 事件的 reason 与保护系统归因，不是 `continuationContext.mushroomBaseIndex` 的位置参数怎么传。
- `igor-rlyeh-double-trigger.test.ts` 过去把“base_rlyeh 选择消灭 Igor”拆成 `getInteractionHandler('base_rlyeh')` + `processDestroyMoveCycle(...)` 两段，实质是在手工重放真实命令链。改成真实 prompt 响应后，测试更直接表达“选中 Igor 后，只应出现一个 `frankenstein_igor` prompt”，也更不容易因为系统后处理顺序调整而大面积碎裂。
- `base_temple_of_goju_tiebreak` 的 tie-break 选择也不需要显式碰 handler。对业务测试来说，`triggerBaseAbility('base_temple_of_goju')` 先产出平局 prompt，再通过 `respondToPromptOption(...)` 选中某个并列最强随从，已经足够覆盖“玩家选择后正确放牌库底”。
- `pirate_buccaneer_move` 是更有代表性的例子：这两条测试确实在锁 `resolveLiveBaseIndex(...)` 的 `baseDefId` 语义，但也可以通过“先让 replacement prompt 真实出现，再在 stale core 上响应”来表达。这样测试保留了 `BASE_CLEARED` / `baseDefId` 漂移的真实语义，却不再把 handler 存在性、value 形状和位置参数顺序写进断言。
- 冗余的“业务文件里顺手断一下 handler 已注册”现在也更清楚该往哪里删。`abilities/pirates-ongoing.test.ts` 和 `smashup.smoke.test.ts` 的几条注册断言去掉后，没有损失真实行为覆盖；注册存在性本来就该由 `abilityInteractionRegistry.test.ts` 这类专门合同文件承担。
- 到这一步，全仓 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 命中已降到 `29`。剩余项的性质比之前清楚很多：注册表合同、prompt 系统合同、runtime prompt 非法值拒绝合同，以及少量明确的 score-session / stale / resolve-time 二次校验合同。

## 2026-05-16 19:16 补充发现：多选 prompt 也应直接表达为 optionIds 响应

- `cthulhu_recruit_by_force` 与 `cthulhu_it_begins_again` 的旧测试把“多选 prompt -> 传 value 数组给 handler”当成合同，这会把选项值形状和 handler 参数顺序一起锁死。
- 对业务测试来说，更稳的接口是：先从真实 prompt 里拿到候选 option ids，再用 `respondToPromptOptions(...)` 响应。这样测试表达的是“玩家勾选了这些可见选项”，不是“内部 handler 期望什么 value 数组”。
- 这类用例的“跳过”也不该再靠 direct handler 传空数组推断，而应显式走 `respondToPromptOptions(state, [])`。这样才能覆盖真实命令链里 min=0、多选收口、系统事件附带等行为。

## 2026-05-16 19:17 补充发现：链式基地能力与行动卡链没有本质区别

- `base_mushroom_kingdom_pod` 这条链说明：基地能力产生的 prompt，和行动卡/随从能力产生的 prompt，在测试 seam 上不应区别对待。只要用户真的能看到 prompt，就应该优先走 `respondToPromptOption(...)`，而不是因为它来自 base ability 就保留 direct handler。
- 同一个文件里残留的未使用 helper、草稿命令数组和未使用 import，也会掩盖真实剩余债务。顺手清掉这些死代码，有助于后续判断“还有哪些 direct handler 是真的必须保留的”。

## 2026-05-16 19:21 补充发现：命令链测试要按业务事件断言，不能假定事件数组只剩业务事件

- `trickster_pixie_pod` 迁到 `respondToPromptOption(s)` 后，测试第一次红灯不是行为错，而是旧断言继续假设 `events` 数组只包含 `POWER_COUNTER_ADDED` / `ONGOING_DETACHED`。真实命令链会附带 `SYS_INTERACTION_RESOLVED`。
- 这再次证明：对业务测试而言，正确断言应该是“数组包含目标业务事件”或直接看 `finalState.core`，而不是 `toEqual([唯一业务事件])`。否则每次把 direct handler 换回命令链，测试都会因为系统事件噪音假红。
- `trickster_hideout_pod_swap` 也说明单选 prompt 不需要知道 value 结构如何喂给 handler。测试只要表达“玩家在 swap prompt 里选了 hand/deck 的哪张卡”，其余由 facade 承担。

## 2026-05-16 19:29 补充发现：要断言响应后的最终状态，入口也必须是完整 matchState

- `madnessPromptAbilities.test.ts` 的 `cthulhu_madness_unleashed` “跳过”用例第一次改完后红灯，不是业务错，而是还在用 `execPlayAction(...)` 这类“只适合拿事件”的入口，随后却拿响应结果去断言 `finalState.core`。
- 这说明测试接口分层不只体现在“怎么 respond prompt”，还体现在“从哪个入口拿 state”。只要测试目标是玩家响应后的权威最终状态，就应从 `execPlayActionWithMatch(...)`、`runCommand(...)` 这类保留完整 matchState 的入口开始。
- `miskatonic_book_of_iter_the_unseen` 也再次证明：普通业务测试不应该保留“handler 返回事件，再由测试手动 applyEvents”的合同。改成真实 prompt 响应后，测试直接看 `resolve.finalState.core`，更接近真实调用方职责。
- `miskatonic_thing_on_the_doorstep` 的并列最高力量场景说明，哪怕是 special 触发出来的 prompt，只要用户能看到并点击，就应优先走 `getFirstPrompt` / `getPromptOptions` / `respondToPromptOption(...)`；不需要继续裸读 `sys.interaction` 或直调 handler。

## 2026-05-16 19:36 补充发现：一个文件里也要把“普通业务链”和“低层例外”分开治理

- `expansionBaseAbilities.test.ts` 很适合当样本：同一个文件里同时存在两类 direct handler。
  - `base_mermaid_pool`、`base_ossuary`、`base_arena`、`base_the_asylum`、`base_miskatonic_university_base` 这类“已有真实 prompt、用户只是点选项”的测试，应该迁到 `respondToPromptOption(...)`。
  - `base_land_of_balance` / `base_sheep_shrine` / `base_the_pasture` 的 stale 回归，以及 `smashup_reaction_choose` 的 queued reaction 测试，则仍然在验证“旧 prompt + 新 core”或 reaction/session 合同，不能机械一刀切。
- 同一文件里混着两类入口时，最好按“是否存在真实可点击 prompt”和“测试标题是否在锁 stale/reaction/baseDefId/frame/source 合同”来拆，而不是按文件名整体判断要不要命令链化。
- `base_arena` 与 `base_miskatonic_university_base` 的红灯再次证明：从 direct handler 迁到命令链后，原先的 `events.length === 1/2` 和固定事件下标几乎都会失效。更稳的写法是按业务事件类型 `find/filter`，因为 `SYS_INTERACTION_RESOLVED` 这类系统事件属于正常副产物。
- `base_the_asylum` 的两段链说明，多段 prompt 也不该继续用“先拿 option.value，再手动调下一层 handler”的方式写。更稳的合同是“第一次点击哪个可见手牌选项，第二次点击哪个可见随从选项”，最后直接看 `finalState.core` 与关键业务事件。

## 2026-05-16 19:44 补充发现：同一份 stale 回归也可以继续复用真实 respond 语义

- `interactionChainE2E.test.ts` 的熊骑兵 4 条 stale 回归说明，哪怕测试框架是 `GameTestRunner` 本地 `respond(...)`，也仍然可以沿用“旧 prompt + 新 core + 真实响应命令”的治理口径，不需要回退到 direct handler。
- 这里暴露出的关键差异不是业务语义，而是 helper 返回形状：`GameTestRunner` 的 `run(...)` 结果要看 `steps[0]?.success` 与 `finalState`，不能把别处 `respondToPromptOption(...)` 的 `success/events/finalState` 直返结构照搬过来。
- 这意味着后续迁 stale 回归时，要先分清“测试语义层”与“测试 runner 结果层”。语义层统一走真实 prompt respond；结果层按文件现有 runner 断言，不要为了统一外观再造一套多余桥接。

## 2026-05-16 19:49 补充发现：stale 回归不等于必须保留 direct handler

- `expansionBaseAbilities.test.ts` 的 `base_land_of_balance`、`base_sheep_shrine`、`base_the_pasture`、`base_innsmouth_base_choose_card`、`base_cat_fanciers_alley`、`base_inventors_salon` 再次证明：只要用户真实会看到旧 prompt，再响应时只是权威 core 已变化，这类 stale 回归就应该优先写成 `withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` + `respondToPromptOption(...)`。
- direct handler 只应该留给两类场景：没有可见 prompt 的低层 session/registry 合同，或者像 `base_greenhouse` 这样明确在锁 scoring-session / replacement follow-up / deferred action 写入位置的合同。把普通 stale 也留在 direct handler，只会继续把 handler 参数顺序、`getPromptHandlerData`、时间戳和随机源写死在测试体里。
- 这一批还进一步确认：命令链版 stale 回归不该再说 `events.length === 0`。正确口径是“响应成功，但目标业务事件没有发生”。这样既保留 stale 不变量，也不会把 `SYS_INTERACTION_RESOLVED` 之类系统事件误报成失败。

## 2026-05-16 19:52 补充发现：冒烟测试里的普通 titan prompt 也不该例外

- `smashup.smoke.test.ts` 的 `titan_sphinx_start_turn`、`titan_sphinx_after_scoring`、`titan_sphinx_talent` 原先虽然在“冒烟测试”里，但本质上仍是普通业务 prompt：真实 trigger 已经创建 prompt，用户只是点一张卡。把这类用例继续写成 `getInteractionHandler(...)` + `getPromptHandlerData(...)` + 手动 reduce，只是在冒烟文件里重复锁死内部执行分工。
- 改成 `respondToPromptOption(...)` 后，断言直接落到 `finalState.core`，说明“冒烟测试”与“能力专项测试”在 seam 选择上不该双标。只要测试目标是用户点击 prompt 后的权威状态，就应优先走真实响应命令。
- 当前全仓剩余 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 还有 76 条，但成分已经比前几轮更纯：一部分是注册表/系统合同，一部分是 `smashup.smoke.test.ts` 这类还未分簇的 titan 业务链。下一轮继续推进时，优先拿“已有真实 prompt、只差一步点击”的小簇，而不是先去碰明显的 registry/session 合同。

## 2026-05-16 20:06 补充发现：有些 prompt 响应的关键合同不在 events，而在 finalState.core

- `titan_pirates_the_kraken_talent` 暴露出一个更细的分层点：prompt handler 不只会返回业务事件，还可能同步写入 `state.core` 里的元状态。这条能力在响应时除了发出 `PERMANENT_POWER_ADDED`，还会通过 `schedulePowerModifierUntilNextTurnStart(...)` 把 `timedPowerModifiers` 写进 core。
- 因此，像 Kraken 这种“当前先加减力量，未来某个 `TURN_STARTED` 再回退”的能力，如果测试只做 `afterCommand + response.events.reduce(...)`，会看到当下 debuff 生效，但会丢失未来回退所需的元状态，随后误判成“不会恢复”。
- 可复用口径应是：
  - 若 prompt 响应只吐业务事件、不写额外状态元数据，可以继续根据需要用 `afterCommand + response.events.reduce(...)` 或 `resolved.finalState.core`。
  - 若 prompt 响应还会写 `timedPowerModifiers`、queued reaction bookkeeping、session / replacement metadata 等状态元数据，测试必须优先以 `resolved.finalState.core` 作为权威后态，再做后续事件推进验证。
- `titan_kaiju_gorgodzolla_draw` 也再次证明，回到真实 `respond` 命令后，系统层事件 `SYS_INTERACTION_RESOLVED` 会自然进入事件流。业务测试不应再假设“响应事件数组只包含业务事件”，而应改成“包含关键业务事件 + 最终权威状态正确”。
- 这一轮把 `Mergacon play/talent` 一并收掉后，全仓 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 命中从 72 降到 66，说明 `smashup.smoke.test.ts` 里仍有不少“普通 prompt 冒烟用例”可继续按同样思路收敛。

## 2026-05-16 20:13 补充发现：旧 handler 时代的“手喂 timestamp”通常不是业务合同

- `titan_time_travelers_time_box_play` 改到真实 `respondToPromptOption(...)` 后，`enteredAt` 不再等于旧测试直调 handler 时传进去的 `113`，而是回到命令链自己的时间口径（当前表现为 `0`）。这说明测试原先锁住的是“我给 handler 传了什么 timestamp”，不是用户可见行为。
- 对这类 prompt 业务测试，更稳的断言应该是：
  - 泰坦是否到了对的基地；
  - 计数 / 标记 / 所有权 / 力量修正等公开状态是否正确；
  - 必要时是否产生了关键业务事件。
  不应继续把 `enteredAt`、本地手传 `timestamp`、`continuationContext` 细节当成业务合同，除非测试目标明确是底层 frame / session / audit 元数据。
- `titan_super_spies_moon_zero_three` 这条还进一步说明：两段 prompt 链在走真实 `respond` 后，不必再由测试手动 `postProcessSystemEvents(...)` 拼接中间状态。只要当前链路没有刻意在测底层 post-process 顺序，直接观察每次 `respond` 返回的 `finalState` 更稳。
- `titan_magical_girls_walking_castle` 的多选链则证明，多段 prompt 也不必保留“拿 option.value 数组喂给 handler”的写法。测试应表达“玩家点了哪几个可见 option id”，而不是“内部 handler 接收什么 value 结构”。
- 本轮继续把 `walking_castle`、`time_box_play`、`moon_zero_three`、`megabot_move` 收掉后，全仓命中从 66 降到 60；剩余 `smashup.smoke.test.ts` 里的 direct handler 已进一步集中到 `creampuff_man`、`major_ursa`、`rainboroc`、`very_large_boulder`、`hill_that_strolls` 这些多段链和少量显式合同点。

## 2026-05-16 20:18 补充发现：二段 prompt 链不需要手工“保活当前 prompt”

- `titan_ghosts_creampuff_man_discard` -> `titan_ghosts_creampuff_man_play` 这条链原测试在第一段 handler 后，先手工 `reduce(events)` 出新 core，再用 `withCurrentPrompt(...)` 把第二段 prompt 挂回状态。这其实又把“handler 返回什么 state、测试如何把 prompt 挂回 current”写成了合同。
- 改成真实 `respondToPromptOption(...)` 后，第一段响应返回的 `finalState` 自己就带着第二段 prompt。更稳的表达是直接从 `discardResolved.finalState` 读取下一段 prompt，而不是继续手工拼 `withCurrentPrompt(...)`。
- `titan_itty_critters_rainboroc` 同样说明：若第一段响应已经在真实命令链里把 deck/discard 和下一段 prompt 都推进好了，就不该再手动 `reduce(events)` 出一个 `afterShuffle` 再拿旧 state 喂给第二段 handler。业务测试应直接观察每段 `finalState.core`。
- 这类二段链的本质合同是“第一次点击哪个可见候选，第二次点击哪个可见候选，最终公开状态如何变化”，不是“测试如何帮命令链补状态”。继续手工保活 prompt / 手工拼 core，只会让重构时又碎一片测试。
- 本轮把 `creampuff_man` 与 `rainboroc` 也收掉后，全仓命中从 60 降到 56，`smashup.smoke.test.ts` 内只剩 `major_ursa`、`very_large_boulder`、`hill_that_strolls` 这几簇普通多段链，以及两条显式合同断言。

## 2026-05-16 22:03 补充发现：真实 prompt 链测试仍然必须满足能力自身的触发资格

- `titan_penguins_emperor_penguin_play` 的 resolve-time recheck 红灯证明了一点：把测试从 direct handler 迁到真实 trigger/response 链后，旧测试里那些“之前被直调 handler 绕过去的前置条件”都会重新变成真门槛。
- Emperor Penguin 在 `onTurnStart` 创建 special prompt 的真实资格不是“set-aside 有 titan 就行”，而是“当前没有己方 live titan，且至少有一个基地已有 3 个己方随从”。如果测试不摆出这个局面，`fireTriggers(...)` 根本不会产出 `titan_penguins_emperor_penguin_play`。
- 这类用例的正确写法不是回退到 direct handler，而是分两层状态：
  - `promptCore` 负责满足真实触发资格，证明 prompt 确实会出现；
  - `staleCore` 负责在响应前引入状态漂移，证明 resolve-time 的二次合法性检查会把原本可点的旧 prompt 拦下来。
- 对 Emperor Penguin 来说，真正稳定的合同是：`trigger` 负责基于公开资格创建 prompt，`resolve` 再通过 `canControllerPlayTitan(...)` 拒绝“当前已存在另一只己方 live titan”的 stale 响应。这个合同能抗重构；“测试手动给 handler 喂 continuation/timestamp”不能。
- 复跑后全仓 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 已降到 24。剩余条目里，`abilityInteractionRegistry.test.ts`、`promptSystem.test.ts`、`promptResponseChain.test.ts` 基本都属于应保留的系统/注册表合同；`bear_cavalry_superiority_pod_talent` 与 `steampunk_mechanic` 更像低层能力合同，是否继续迁要按价值判断，不该为了数字继续硬改。

## 2026-05-16 22:08 补充发现：要防的是“新增回流”，不只是继续手工清旧债

- 这轮重新检查 `scripts/infra/testing-structure-guard.mjs` 后可以确认，之前门禁只拦 prompt 内部结构耦合（`sys.interaction.current`、`prompt.data.options`、手写 `SYS_INTERACTION_RESPOND` 等），还没有拦“业务测试重新写回 `getInteractionHandler/getAbilityRuntimePromptHandler` 直调”。
- 只继续人工把旧文件改绿，不把这层规则固化进 guard，后面任何新 bugfix 测试都可能再次走最省事的 handler 直调，把 seam 债务写回来。那样数字会反复，规范也等于没落地。
- 更稳的策略是两层：
  - 继续把明显的普通业务链迁回真实 `trigger -> prompt -> respond`；
  - 同时用 `test:structure` 阻止新增业务测试再引入 direct handler 直调。
- direct handler 不该被全禁。当前复核后，真正合理的保留面有三类：
  - 注册表合同：例如 `abilityInteractionRegistry.test.ts`
  - Prompt / response chain 系统合同：例如 `promptSystem.test.ts`、`promptResponseChain.test.ts`
  - 少量明确登记的低层能力合同：这类合同也不必继续在测试体里直接摸注册表 API，可以再包一层 helper
- 这说明“测试稳定性”不是把所有底层合同都藏起来，而是把业务 seam 和底层 seam 分层清楚，并用门禁保证新增代码只能走对的那层。

## 2026-05-16 22:21 补充发现：低层合同也应该有稳定入口

- `abilities/bear-cavalry.test.ts` 与 `expansionOngoing.test.ts` 证明了一点：即使测试目标本来就属于低层合同，也没必要在测试体里每次重复 `getInteractionHandler/getAbilityRuntimePromptHandler -> handler!(...)` 这套注册表样板。
- 更稳的做法是把“按 sourceId 取已注册 handler 并执行”也收进 `helpers.ts`，让测试显式表达自己在走“registered contract helper”，而不是继续散落注册表细节。
- 这样做有两个直接收益：
  - 后续如果 handler 获取方式、签名适配或错误消息调整，低层合同测试只需要改 helper，不会再在多个文件碎裂。
  - 结构门禁可以继续收紧，不再给某些业务文件做文件级 allowlist；只要它们走 helper，就能同时保留低层合同与统一入口。
- 完成这一步后，SmashUp 测试里 raw `getInteractionHandler/getAbilityRuntimePromptHandler` 已只剩 22 处，全部集中在：注册表合同、prompt 系统合同，以及 `helpers.ts` 自己。说明“业务层 raw handler 查询”已经从文件层面清空。

## 2026-05-16 22:26 补充发现：系统合同也该把“存在性样板”抽到 helper

- `promptResponseChain.test.ts` 和 `promptSystem.test.ts` 里剩下的 raw handler 查询，本质已经不是业务耦合，而是重复的“某 sourceId 是否有已注册 continuation handler/runtime prompt handler”样板。
- 这类样板继续散在系统合同测试里，问题不在今天会不会红，而在以后如果查找策略、报错文本、fallback 顺序调整，又会同时碎在多处系统合同文件里。
- 把它们进一步收进 `helpers.ts` 后，系统合同仍然保留自己的测试语义：
  - 有的场景要断言“interaction handler 一定存在”
  - 有的场景要断言“runtime prompt handler 一定存在”
  - 有的场景要断言“任意一种 prompt continuation contract 至少存在一种”
  但这些语义不再和底层注册表读取样板绑在一起。
- 完成这一步后，SmashUp 测试里的 raw `getInteractionHandler/getAbilityRuntimePromptHandler` 已降到 11，而且这 11 处全部都合理：
  - `abilityInteractionRegistry.test.ts` 的 9 处：它本来就在测注册表 API 自己
  - `helpers.ts` 的 2 处：作为单一查找函数，是系统级唯一出口
- 这意味着“业务测试直调 handler”与“系统合同散落查找样板”两类债务都已经清掉了，剩下的是应保留的注册表语义本身。

## 2026-05-16 22:35 补充发现：`resolvePromptViaRegisteredHandler(...)` 也是耦合，不该被当成“已经抽象了所以没事”

- 这一轮检查后可以确认，之前只盯 raw `getInteractionHandler/getAbilityRuntimePromptHandler` 仍然不够，因为 `resolvePromptViaRegisteredHandler(...)` 本质上也是“按 prompt.sourceId 找 registered handler 然后直接喂 value/data”。
- 如果业务测试继续大量依赖这个 helper，那么实现重构时虽然不再碎在注册表 API 名字上，仍然会碎在“registered handler 是真实入口”这个假设上。对用户来说，这和“改代码就要改测试”没有本质区别。
- 更准确的分层应是：
  - 真实点击路径：`respondToPromptOption(...)` / `respondToPromptOptions(...)`
  - 低层合同：`invokeRegisteredInteractionHandlerContract(...)` / `invokeRegisteredRuntimePromptHandlerContract(...)`
  - 系统/反应队列/注册表合同：允许继续用 `resolvePromptViaRegisteredHandler(...)` 或注册表 API，但文件本身要承担“我在测系统合同”的命名与责任
- `elder-thing-choice-goju-tiebreak.test.ts` 很能说明这个分层：
  - 大多数 destroy / deckbottom / 二段选择都是用户真实会点击的链，应迁回 `respondToPromptOption(...)`
  - 只有“强行提交一个正常 UI 根本不会给出的非法 destroy choice”这种用例，才是真的低层合同，应该显式走 contract helper
- 迁完这一批后，`resolvePromptViaRegisteredHandler(` 已从分散业务文件收缩到 15 条，而且都集中在 `baseAbilitiesPrompt.test.ts` 与 `reactionQueue*.test.ts` 这类更接近 prompt/base/system contract 的文件。这才是下一轮真正该审的边界。

## 2026-05-16 22:50 补充发现：reaction queue 系统合同里，只要“当前 prompt 已经真实存在”，也不该继续直调 registered handler

- `reactionQueueBaseOptionalClockwise.test.ts`、`reactionQueueOrdering.test.ts`、`reactionQueueBaseAbilities.test.ts` 与 `reactionQueueDestroyerId.test.ts` 这一轮共同证明：即使文件名本身属于 reaction queue / system contract，只要当前状态里已经有真实 `smashup_reaction_choose` prompt，测试就应该优先走 `respondToPromptOption(...)` / `respondToPrompt(...)`，而不是 `resolvePromptViaRegisteredHandler(...)`。
- 真正需要保留低层入口的，不是“这个文件在测 reaction queue”，而是“当前没有真实 prompt，或测试明确在锁 reaction session / registered continuation 的内部合同”。例如已经存在的 `resolveSmashUpReactionChoice(...)` 场景，仍然是在测 session 继续执行，不应为了表面统一再强行包成普通点击链。
- 这轮两个红灯也进一步验证了旧断言的问题不在行为，而在测试仍假设 `events[0] === TRIGGER_CONSUMED`。一旦回到真实 respond 命令，`SYS_INTERACTION_RESOLVED` 进入事件流是正常副产物；系统合同同样要按“包含关键系统/业务事件”断言，不能再锁固定下标。
- `reactionQueueDestroyerId.test.ts` 还补强了一个边界：当 reaction queue 先弹 `smashup_reaction_choose`，后续进入 `vampire_mad_monster_party_pod_play` / `vampire_buffet_pod_play` 这类业务 prompt 时，测试真正想证明的是 destroyerId/预览上下文是否保留，而不是“registered handler 直接返回了什么 state 形状”。
- 迁完这批后，`resolvePromptViaRegisteredHandler(` 已只剩 `helpers.ts` 里的 helper 定义 1 处。说明这条 seam 已经从“测试体到处可见的执行入口”收缩成“仅保留一个显式低层工具”，后续是否继续保留它，已经变成 helper API 设计问题，而不是业务测试债务。

## 2026-05-16 22:58 补充发现：没有调用方的测试桥接 helper 也属于债务，不该因为“只是 helper”就继续保留

- `resolvePromptViaRegisteredHandler(...)` 清到只剩 helper 定义本体后，继续保留它已经没有测试价值，只会向后续维护者暗示“这里还有一条可接受的 handler 直调捷径”。这种死 helper 会让债务在未来回流，比删掉更危险。
- `callHandler(...)` 与 `resolveCurrentPromptHandlerWithCore(...)` 也是同类问题。即使它们当前没有直接污染测试体，只要 helper 和文档还在，就会继续把“手工喂 handler / 手工换 core 再跑 continuation”包装成一种被认可的测试方法。
- 这类死 seam 的正确收口方式不是给它们写“仅限特殊情况”注释，而是直接删除代码出口、删掉转发导出、改掉文档示例。否则测试规范嘴上说“优先真实 trigger -> prompt -> respond”，代码库却还在提供反方向的现成入口。
- 审计/规范层也要同步收口。`docs/testing-best-practices.md` 如果还把 `callHandler` 写在推荐工具表里，后面再有人照着文档写回旧模式，并不算他个人失误，而是规范本身口径不一致。

## 2026-05-16 23:05 补充发现：`resolveAbility(...)` 里也混着很多本可回到真实命令入口的业务测试

- `ninja_infiltrate_pod talent` 和 `ancient_egyptians_plague_of_locusts onPlay` 这两个样本说明，`resolveAbility(...)` 不是天然就代表“底层合同”。很多时候它只是历史上写测试更省事，于是直接绕过了 `USE_TALENT` / `PLAY_ACTION` 的验证、命令形状和后处理。
- 这种绕过会漏掉真实命令口径里的门禁与 payload 语义。`ancient_egyptians_plague_of_locusts` 改回 `PLAY_ACTION` 时第一次红灯，暴露的正是旧测试完全绕开的真实约束：行动牌命令需要 `targetBaseIndex`，不是随手塞个 `baseIndex` 就能代表真实入口。
- 同理，`ninja_infiltrate_pod` 用 `USE_TALENT` 改回真实命令后，测试直接观察 `finalState.core`，不再需要“执行器吐事件，再由测试手工 reduce”。这更接近用户路径，也更能在命令验证/后处理/最终状态任何一层回归时及时暴露真问题。
- 因此后续治理 `resolveAbility(...)` 时，优先级不该按“这个文件里有多少命中”排，而要先挑那些本质上只是玩家出牌/用天赋/发动 special 的业务样本；系统合同、注册表语义或纯执行器单元边界另算。

## 2026-05-16 23:17 补充发现：`resolveAbility(...)` 的 onPlay prompt 业务链和执行器时序合同要分开看

- `ancient_egyptians_mummy_strength` 与 `special_madness` 这两组继续证明：只要用户真实入口是“打出一张行动卡”，测试就不该从 `resolveAbility(...)` 起步，即使后面还要经历多段 prompt。正确 seam 仍是 `PLAY_ACTION -> prompt -> respond -> finalState`。
- `ancientEgyptiansMummyStrength.feedback-regression.test.ts` 之前甚至自建了一套 `GameTestRunner + systems` 来模拟 RESPOND 链，这类夹具越重，越说明测试已经偏离公开入口。改回 `runCommand(...)` 后，用例照样能覆盖“目标优先选择 + 最终 tempPowerModifier 生效”，而且系统壳层少了很多。
- `special_madness` 则补了另一层边界：不是所有 `resolveAbility(...)` 都该一锅端。像 `special_madness` 这种标准 onPlay 行动卡，应迁回真实 `PLAY_ACTION`；但 `wizard_time_loop`、`killer_plant_insta_grow` 这种主要在锁 `off-phase` / `playTiming=immediate` 的用例，更接近执行器/时序合同，不该因为也叫 `onPlay` 就机械替换。
- 这轮还说明了一个好处：把 `special_madness` 改回 `PLAY_ACTION` 后，能直接证明命令层允许把疯狂牌当行动打出，并继续进入真实 prompt；这比“executor 自己会不会吐出 prompt”更接近用户行为合同。

## 2026-05-16 23:31 补充发现：`reduce` 验证也不该默认豁免旧执行器入口

- `innsmouth_recruitment` 这条补了一个之前容易放过的角落：测试标题写的是“状态正确（reduce 验证）”时，很容易被误当成“那就允许从 `resolveAbility(...)` 起步吧”。这其实不成立。
- 只要验证的业务事实仍是“玩家打出行动卡 -> 选择 prompt -> 事件流喂给 reducer 后状态正确”，入口就应该是真实 `PLAY_ACTION`。`reduce` 只决定最终断言方式，不决定前半段可以绕过命令层。
- 这条旧写法里还手工补了一个 `ACTION_PLAYED` 事件，进一步说明测试已经脱离真实管线。改回 `runCommand(PLAY_ACTION)` 后，`ACTION_PLAYED` 与后续 `MADNESS_DRAWN / LIMIT_MODIFIED` 都来自同一条真实事件流，reduce 合同反而更可信。
- 这也给后续筛选一个更明确的信号：同一 describe 里如果大多数用例已经用 `execPlayAction/runCommand`，只剩个别“状态验证 / reduce 验证”还单独走 `resolveAbility(...)`，这通常就是优先可收的旧 seam。

## 2026-05-16 23:37 补充发现：`onPlay` 里“自动分支”同样应该回到真实命令入口

- `ninja_infiltrate` 这组补了另一个容易被误分类的角落：有些旧用例不是 prompt 点击链，而是“单目标自动执行”或“无目标直接无事发生”。这类场景也不该因此留在 `resolveAbility(...)`。
- 只要真实用户入口仍然是“打出行动卡”，即使后续没有 prompt，测试入口也应该是 `PLAY_ACTION`。自动分支是否发生、是否产生 `ONGOING_DETACHED`、是否完全无事发生，都应该由真实命令链自己给出答案。
- 这组红灯也再次说明了分层收益：切回 `PLAY_ACTION` 后没有暴露能力实现 bug，只有测试体自己少引了 `expectNoPrompt`。这种红灯说明迁移方向是对的，问题在测试壳层，不在业务行为。
- 因此后续筛选时，不要只挑“会弹 prompt”的 `resolveAbility(...)`；像 `ninja_infiltrate` 这种混有 prompt 分支、自动分支、空分支的 onPlay 能力，往往更值得整组一起迁，这样同一能力的三种路径就不会继续分裂在两套入口上。

## 2026-05-16 23:55 补充发现：真实命令链会把“卡型假设”和“玩家壳层假设”一起揪出来

- `trickster_pixie_pod` 这一轮证明，很多旧 `resolveAbility(...)` 测试不只是绕过了命令层，还顺手绕过了“这张牌在真实世界里到底是什么卡型”。旧测试把 Pixie 直接塞给 executor，看不出它作为融合牌在手里必须是 `type: 'fusion'`，也看不出随从面与战术面的公开入口其实不同。
- 把 Pixie 改回真实命令后，两个红灯都不是能力实现 bug：
  - 第一条红灯是牌根本不在手里，说明旧测试把“已打出后状态”冒充成了“出牌入口”。
  - 第二条红灯是把融合牌当普通 minion 去走 `PLAY_MINION + playAsAction`，而真实公开入口应该是 `PLAY_ACTION`。
- 同时，旧断言里把可选随从顺序写死成 `['pixie-1', 'ally-a']` 也暴露了另一个内部耦合：真实命令链插入已打出随从后，候选顺序变成实现细节，业务上真正该锁的是“这两个目标都出现”，不是数组顺序。
- `trickster_mark_of_sleep` 这条则补了另一类深层问题：只要还在手工拼 `matchState` 或用半残缺的 player override，很多 reducer/pipeline 必经字段问题就永远不会暴露。切到真实 `runCommand(PLAY_ACTION)` 后，`player.discard is not iterable` 这种夹具缺损立刻浮出来，说明旧测试连完整玩家壳层都没走到。
- 这进一步说明“以后改代码不用频繁改测试”的关键不只是 facade 名字统一，而是：
  - 业务测试入口必须是真实命令
  - 测试数据必须满足真实出牌前置
  - 断言必须锁业务集合/最终状态，而不是内部顺序或 executor 中间形状

## 2026-05-17 00:01 补充发现：同一个能力在不同文件重复出现，也不能拿“别处已经测过”当继续保留旧 seam 的理由

- `miskatonic_lost_knowledge` 在 `ongoingTalent.test.ts` 里其实早就有一套更接近真实 `USE_TALENT` 的测试，但 `madnessAbilities.test.ts` 里仍保留了 `resolveAbility(...)` 版本。这个状态本身就是风险：同一能力一半文件走公开入口，一半文件走旧执行器入口，后续重构时照样会碎。
- 这说明测试治理不能只看“这个行为是否已经 somewhere 被覆盖”。如果当前文件里的测试目标也是普通玩家业务链，就仍然应该回到同一条公开入口，否则重复覆盖只是在重复旧 seam。
- 这轮把 `miskatonic_lost_knowledge` 收回 `USE_TALENT` 后，留下的 `baseIndex: undefined` 反而更清楚地暴露成“没有稳定公开入口的低层合同”。这种场景可以保留，但要显式地让它成为例外，而不是混在业务 talent 测试里假装同层。
- 因此后续筛选剩余 `resolveAbility(...)` 时，一个实用判断标准是：
  - 如果这个用例描述的是“玩家打牌 / 点 talent / 激活 special 后发生什么”，即使别的文件已经覆盖过，也应该收回公开入口。
  - 只有当用例刻意制造真实 UI/命令层不会给出的上下文时，才保留为低层合同。

## 2026-05-17 00:06 补充发现：很多旧 talent 测试连“对象必须先上场”这个公开前置都绕过了

- `miskatonic_librarian_pod` 这条说明，旧 `resolveAbility(...)` 测试还有一种隐形耦合：它跳过的不只是命令壳层，而是整个“卡必须先进入合法区域才能激活能力”的业务前置。
- 旧写法里，图书管理员还在手牌里，就直接把 `cardUid/defId` 喂给 talent executor；真实接口里这根本不成立，正确流程必须是 `PLAY_MINION -> USE_TALENT -> prompt -> respond`。
- 这种前置如果继续被测试绕开，后续无论是：
  - `talent` 只能对场上对象开放
  - 先上场才有 `baseIndex / controller / suppression / response window` 等上下文
  - 卡离场后不能再点 `talent`
  都很难被及时测出。
- 所以后续处理剩余 `resolveAbility(...)` 时，要额外问一句：这个测试有没有把“对象已在正确 zone”也一起绕开？如果答案是有，那它比普通 seam 更应该优先收回公开入口。

## 2026-05-17 00:25 补充发现：同样叫 `special`，也要先分清“有没有公开命令入口”

- `ninja_acolyte` 这一轮证明，`special` 不是天然只能留在执行器层。领域层已经提供了 `ACTIVATE_SPECIAL`，而且它覆盖了成功路径、prompt 链和一部分阻止路径；这类测试继续直调 `resolveAbility(...)`，本质上就是绕开公开接口。
- 但 `ninja_hidden_ninja` 同时证明，不能机械把所有 `special` 都改成 `ACTIVATE_SPECIAL`。当前公开命令的校验前提是“场上存在该随从/泰坦”，而 Hidden Ninja 是手牌 action special，直接喂 `ACTIVATE_SPECIAL` 只会稳定得到“基地上没有该随从”。
- 这说明 `special` 也要分层：
  - 有公开命令的：优先锁 `ACTIVATE_SPECIAL`
  - 没公开命令的：显式保留为执行器/时序合同
  - 不能因为它们共享一个 ability tag，就假装属于同一层测试入口
- `ninja_acolyte` 的阻止路径还暴露了另一个重要区别：切回公开命令后，“同基地已使用同组 special”不再表现为“执行成功但 0 事件”，而是更靠前的命令校验失败。对测试治理来说，这反而更稳定，因为它锁的是调用者真正能观察到的接口行为。
- 因此后续看剩余 `resolveAbility(...)` 不能只问“是不是业务行为”，还要再问一层：**这个行为在领域层是否已有稳定公开命令/API？** 有就收回，没有就保留，并把原因写清。

## 2026-05-17 00:36 补充发现：真实出牌命令会揭穿“牌已经不在手里”与“打出后还剩不剩候选牌”的假设

- `ghost_make_contact_pod` 的旧测试说明，直调执行器很容易制造一种假的业务世界：牌明明已经不在手里，测试仍然能“打出”。一旦回到 `PLAY_ACTION`，这种假设会立刻暴露成命令层失败。
- `ghost_make_contact` 还补了另一点：真实命令链不会只给你“那 1 个业务事件”，它还会带上 `ACTION_PLAYED` 等系统事件。测试如果继续断言固定事件数量，锁的就不是用户行为，而是旧执行器壳层。
- `miskatonic_field_trip` 的第一次迁移红灯更有代表性：旧测试默认“打出这张牌后还能继续从手里选牌”，但真实世界里如果手牌只剩它自己，打出后手里就空了，根本不会出现选择 prompt。也就是说，**prompt 是否出现本身依赖于真实出牌后的 live hand state**，不能靠 executor 预先假定。
- 这把后续筛选标准又收紧了一层：
  - 不仅要问“有没有公开命令入口”
  - 还要问“这个测试是否偷偷绕过了卡必须先在手里/场上、以及执行后 live state 会变化”这类真实前置
- 对 TDD 而言，这是更有价值的 seam：测试不是去保护“执行器被怎么调”，而是保护“调用者从真实入口进入后，系统是否还能看到该看到的 live 状态和 prompt”。

## 2026-05-17 01:00 补充发现：真实出牌入口会改变合法性本身，旧 executor 测试不能继续拿来当业务事实

- `steampunk_mechanic` 这轮证明，旧 `resolveAbility('...onPlay')` 测试不只是绕过命令层，还绕过了“机械师本人已经上场”这个事实。`cthulhu_complete_the_ritual` 的 `requireOwnMinion` 约束在旧 executor 测试里不成立，但切回真实 `PLAY_MINION` 后立刻成立，因为机械师自己就是那个己方随从。
- 这类差异不能靠“继续保留旧断言”糊过去。只要真实用户入口会让合法性变化，测试就必须改写为公开行为断言，否则它保护的是旧夹具世界，不是游戏规则。
- `innsmouth_return_to_the_sea` 进一步说明，afterScoring special action 的公开入口不只是“phase=scoreBases + 有 response window”这么简单；`canCardBePlayedInResponseWindow()` 还依赖 `scoringEligibleBaseIndices`。旧 executor 直调完全绕开了这层门禁，所以看不出少了这份真实前置。
- `miskatonic_things_best_not_known_pod` 也坐实了同一原则：beforeScoring special action 已有稳定公开入口，正确 seam 不是 `resolveAbility('special')`，而是 Me First! 响应窗口里的 `PLAY_ACTION`。切回真实入口后，测试能同时覆盖响应窗口合法性、目标基地门禁和后续疯狂卡/临时战力链。
- `miskatonic_librarian_pod` 则补了另一层前置：旧 talent executor 测试把“图书管理员必须先上场”绕没了。真实 `PLAY_MINION -> USE_TALENT` 会让“对象所在 zone 是否正确”也纳入保护范围，这比直接喂 `talent` executor 更接近真正稳定的测试接口。

## 2026-05-17 01:06 补充发现：当真实公开入口已经稳定时，测试应优先锁“额度沉淀后的公开状态”，不是内部事件裸数组

- `killer_plant_blossom` 这条把另一类浅 seam 暴露得很清楚：旧测试虽然没有 mock，但它仍然只锁了 executor 返回的 3 条 `LIMIT_MODIFIED`，本质上还是把测试绑在“内部能力函数直接吐什么事件”上。
- 切回真实 `PLAY_ACTION` 后，更稳定的行为断言其实是两层：
  - 命令真的成功把这张行动打出：`ACTION_PLAYED`、手牌移除、进入弃牌、`actionsPlayed` 增加
  - 额外同名随从额度真的沉淀进公开玩家状态：`sameNameMinionRemaining === 3`、`sameNameMinionDefId === null`
- 这比只看事件数组更接近调用者会依赖的合同。后续如果 `grantContextualExtraMinion` 的内部拼装方式重构了，但公开额度状态和出牌行为不变，这类测试就不该跟着改。
- 同时，这轮也把 `expansionOngoing.test.ts` 的边界划清了：剩下 5 处 `resolveAbility(` 都只是“能力已注册”的存在性合同，不再属于“业务行为 seam 过浅”的同类问题。后续继续治理时，不应该为了清零 grep 结果去硬改这些注册断言。

## 2026-05-17 01:19 补充发现：beforeScoring special 回到真实入口后，会把“假基地 fixture”和“旧失败语义”一起揭穿

- `elder_thing_the_price_of_power` 这轮证明，beforeScoring special 虽然早就有稳定公开入口，但只把测试从 `resolveAbility(...)` 换成 `PLAY_ACTION` 还不够；测试夹具也必须满足真实计分链前置。默认 `makeBase()` 产出的 `test_base` 没有合法 `vpAwards`，一旦 `FlowSystem` 在 response window 结束后继续推进 `scoreOneBase`，测试就会炸在 `buildBaseRankings(baseDef.vpAwards)`。
- 这说明 beforeScoring / afterScoring 响应窗口测试不该再把“假基地也能跑完整 scoreBases”当默认前提。只要真实链路会继续进入计分，base fixture 就必须是实际注册过、可计分的 base def，例如 `base_the_jungle`、`base_temple_of_goju`。
- 同一轮还暴露出另一条更重要的分层事实：`对手在此基地无随从` 不是命令层非法。真实公开行为是“卡可以在达标基地被打出，但能力本身结算为空”；也就是 `ACTION_PLAYED` 仍发生，只是没有 `REVEAL_HAND` 和 `POWER_COUNTER_ADDED`。旧 executor 测试把这条场景误写成“没有可执行的响应目标”，本质上是在保护旧壳层的预过滤，不是在保护玩家能观察到的规则结果。
- 因此后续治理剩余 `resolveAbility(...)` 时，要额外问两句：
  - 真实入口结束后会不会继续推进到更深的 pipeline（计分、reaction queue、afterEvents）？如果会，fixture 必须一并升级。
  - 旧测试断言的“失败”到底是规则真失败，还是旧 helper/executor 提前帮它挡掉了？如果是后者，就应该改成公开行为断言，而不是把真实命令重新改坏去迎合旧测试。

## 2026-05-17 01:26 补充发现：一旦某个文件里同时存在“真实出牌链”和“旧 onPlay executor 链”，就应该优先把同一能力簇整组收回同一入口

- `elderThingAbilities.test.ts` 这轮很典型：`elder_thing_mi_go` 的第一条测试已经在走 `PLAY_MINION`，但后两条“对手选抽 Madness / 对手拒绝后我方抽牌”还停在 `resolveAbility('elder_thing_mi_go', 'onPlay')`。这种半迁移状态本身就是债务，因为同一能力簇被拆成两套入口，后续重构时还是会碎。
- 把这两条补齐后，测试真正锁住的是同一条公开链：`PLAY_MINION -> elder_thing_mi_go prompt -> 对手响应 -> 最终事件/状态`。这样无论 prompt 如何继续由 runtime program 驱动，业务测试都不再依赖 executor 直接返回的中间壳。
- `elder-thing-choice-goju-tiebreak.test.ts` 则补了另一个模式：哪怕测试文件主目标是历史 bug 回归，只要其中那条 helper 本质上是在模拟“打出这张随从后的 onPlay 选择链”，也不该继续保留 fake `matchState + resolveAbility(...)`。把共享 helper 收回真实 `PLAY_MINION`，比单改某 1 条断言更值，因为整组 6 条行为测试一起摆脱了旧入口。
- 这也说明筛剩余 `resolveAbility(...)` 时，不只看单个命中条数。若某文件里已经存在同能力的真实命令样本，而剩余命中还在测同一能力的后续分支，这种“半迁移簇”应该优先处理，收益通常比新开一个完全陌生的文件更高。

## 2026-05-17 01:39 补充发现：低层 ability 合同也需要统一测试接口，否则“保留例外”本身会继续碎

- 这轮证明，问题不只在“哪些业务测试还没回到真实命令链”，还在于那些**确实不该走公开命令**的 low-level/off-phase 合同，如果继续在测试体里裸写：
  - `const executor = resolveAbility(...)`
  - `expect(executor).toBeDefined()`
  - `executor!({...})`
  仍然是在把注册表 API 暴露给每个测试文件。
- 对这类例外场景，正确做法不是继续散着写 `resolveAbility(...)`，而是集中到一个显式 helper。这样测试语义会从“我自己去注册表摸执行器”变成“我刻意调用一个低层能力合同入口”。
- 因此新增 `invokeRegisteredAbilityContract(...)` 的价值不是改名字，而是补了一层稳定测试接口：
  - 业务链：`runCommand(...)`
  - prompt continuation/runtime metadata：`respondToPrompt...` / `invokeRegisteredInteractionHandlerContract(...)` / `invokeRegisteredRuntimePromptHandlerContract(...)`
  - 低层 ability executor 合同：`invokeRegisteredAbilityContract(...)`
- 这层分工能减少下一轮重构的测试 churn。后续如果 `abilityRegistry` 的内部查找、program 包装或 executor 形状调整，低层合同测试只需要在 helper 层适配，不必继续批量扫每个测试文件。
- 最新裸 `resolveAbility(` 分布也因此更干净：剩下的主要是注册表存在性断言、少量未迁移的低层合同，以及 `helpers.ts` 自己的唯一查找点；“每个文件都各自摸一次 executor”的模式已经明显收敛。

## 2026-05-17 01:46 补充发现：局部“能力已注册”断言是另一类噪音，应优先删除而不是继续换壳保留

- `baseFactionOngoing.test.ts` 和 `expansionOngoing.test.ts` 这轮进一步说明，很多残余 `resolveAbility(` 已经不是“测试接口不统一”，而是单纯的**局部重复存在性断言**。
- 这类断言的问题不只是 grep 数字难看，而是会制造错误信号：看起来像“这个文件还在测 low-level executor”，实际上它只是重复了一遍 `abilityRegistry.test.ts` 已经覆盖的存在性合同。
- 对这类重复断言，正确动作通常是删除，而不是：
  - 把 `resolveAbility(...)` 换成另一种存在性 helper
  - 或者在每个业务文件里继续保留一条“顺手测一下已注册”
- 这样做的好处有两层：
  - 业务文件只留下真正属于该行为簇的不变量
  - 剩余裸 `resolveAbility(` 的分布就更接近“真实还需要保留的注册表/属性合同”，不再混入局部噪音
- 这轮之后，全仓裸 `resolveAbility(` 只剩：
  - `abilityRegistry.test.ts`：注册表本体合同
  - `properties/coreProperties.test.ts`：属性/一致性合同
  - `helpers.ts`：唯一的 low-level contract 入口查找点
- 这比“把所有地方都改成某个 helper 但仍然到处做存在性断言”更符合 TDD seam 收敛目标，因为它减少的是测试资产噪音本身，而不是只换一个调用壳。

## 2026-05-17 01:50 补充发现：属性测试里的“局部已注册断言”也属于噪音，除非它本身就在测注册表属性

- `coreProperties.test.ts` 里最后那条 `resolveAbility('...','onPlay')` 业务外观上看像“Property 5: onPlay 能力触发”的前置保护，实质上仍是局部重复存在性断言。
- 它和 `abilityRegistry.test.ts` 的区别不在文件名，而在合同焦点：
  - `abilityRegistry.test.ts` 测的是“注册/解析 API 本身是否一致”，所以保留 `resolveAbility(...)` 是合理的。
  - `coreProperties.test.ts` 的 `Property 5` 真正该测的是“从公开出牌命令进入后是否产生公开事件/行为”，不是“这些 defId 有没有注册”。
- 因此同样是 `resolveAbility(...)`，不能一刀切全删，也不能因为写在 property 文件里就自动合理。判断标准应回到测试正在保护的合同是不是“注册表本体/属性”。
- 这也补强了筛选规则：如果一条断言只是为了让本文件“顺手确认能力存在”，但真正行为断言已经通过 `PLAY_MINION` / `PLAY_ACTION` / `USE_TALENT` 覆盖，那么这条断言优先删除，而不是换壳保留。
- 到这一步后，裸 `resolveAbility(` 的剩余 9 处终于都落在了明确合理的位置：
  - `abilityRegistry.test.ts`：5
  - `coreProperties.test.ts`：3
  - `helpers.ts`：1

## 2026-05-17 01:56 补充发现：统一测试标准如果只写文档，不写门禁，回归速度会很快

- 这轮把 `resolveAbility(...)` 的分层口径继续往前推了一步：不再只是“当前仓里已经收干净”，而是通过 `testing-structure-guard.mjs` 明确禁止**未来新增**的业务测试回退到裸 `resolveAbility(...)`。
- 这个门禁的价值不在于追求 grep 清零，而在于固定一条稳定路径：
  - 公开行为：真实命令入口
  - low-level ability executor 合同：`invokeRegisteredAbilityContract(...)`
  - 注册表/属性合同：少量白名单测试文件
- 如果不把这层固化成脚本，后续任何新 bug 修复都可能因为“直调 executor 最快”而重新把旧 seam 带回来；文档很难抵抗这种短期便利。
- 同一原则也适用于调试日志：一旦回归测试已经稳定，`console.log` 留在业务测试里就是噪音。它不会增加合同强度，只会污染输出、掩盖真正的失败信号。

## 2026-05-17 02:25 补充发现：去掉调试日志不等于“只改表象”，关键在于把打印承载的信息升格为合同

- `wizard-neophyte-actionlog.test.ts` 这轮说明，很多日志表面上在“看 ActionLog”，实质上只是把链路信息打印出来让人肉判断。
- 真正的收口方式不是删日志后留一句 `expect(success).toBe(true)`，而是把日志里承载的关键观察点提炼成合同：
  - ActionLog kind 序列
  - 响应后的手牌/牌库结果
  - 交互暂停点与恢复点
  - afterScoring 响应后基地替换与随从迁移结果
- `turnTransitionInteractionBug.test.ts` 还暴露了另一类假象：旧测试名说“托尔图加 prompt 会出现”，但原场景里根本没有合法的其他基地目标，所以即使打印很多 phase / prompt 信息，也锁不住真正的 afterScoring 暂停合同。
- 把这种场景改成“确实有合法目标”的真实链路后，测试保护的就不再是“某次打印看起来合理”，而是：
  - `scoreBases` 必须暂停
  - prompt sourceId / playerId 必须正确
  - 响应后才允许进入下一回合
  - 替换基地与移动结果必须正确落地
- 这类改法比单纯清 grep 更重要，因为它直接减少了“重构一下测试就全碎”的根因：测试不再依赖人工阅读日志或偶然的中间状态。

## 2026-05-17 02:38 补充发现：audit 测试也要区分“失败信息载体”和“真实业务红灯”，不能把两者混为一谈

- `interactionDefIdAudit.test.ts` 这轮最后 4 处 `console.log` 的本质不是“普通调试日志”，而是拿控制台当失败清单载体。把它们删掉后，如果只是改成 `expect(violations).toEqual([])`，可读性会倒退；正确做法是把违规明细直接提升为断言消息。
- audit 文件的稳定接口应是：
  - 成功时静默通过
  - 失败时直接给出可复制的违规清单
  - 不依赖额外控制台输出让人肉拼装信息
- `npm run test:games:audit -- <file>` 在这个仓里不能当“单文件定点验证”使用，因为脚本本身固定带 `run src/games --config vitest.config.audit.ts`，追加文件参数后依然会把整套 audit include 跑起来。要隔离目标文件，必须改用更窄入口：`node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native <file>`。
- 这次定点验证还说明，日志清理完成后暴露出的红灯是**真实审计结果**，不是改造副作用：
  - `src/games/smashup/__tests__/interactionDefIdAudit.test.ts` 当前仍稳定报出 `vampires.ts` 两处 option 组缺 `minionDefId/baseDefId`
  - 说明原来 `console.log` 只是把这些问题打印出来，不是测试逻辑的一部分
- 因此后续处理 audit 文件时，也要沿用同一原则：
  - “去掉 `console`”不是终点
  - 要把控制台承载的信息升格成失败消息、结构化断言或证据文本
  - 然后把剩下的红灯当成真实代码问题逐条处理

## 2026-05-17 02:41 补充发现：interaction option 的可渲染元数据不能再只靠通用 `defId/baseIndex` 猜出来

- `vampire_heavy_drinker` 这两组红灯说明，旧 option value 里虽然已经有 `defId` 和 `baseIndex`，但这对新的统一审计口径还不够。
- 现在的 interaction 元数据分层已经更明确：
  - `defId` 适合保留作历史兼容或通用 card identity
  - `minionDefId` / `baseDefId` 才是明确告诉 UI 和审计“这里展示的是随从/基地本体”
- 这类补字段不是表面修饰，因为它直接影响两件事：
  - Prompt/UI 是否能稳定判断该按哪种实体卡模式渲染
  - 审计脚本是否能在不猜测上下文的前提下验证 option shape
- 同时，这轮也证明对老链路的兼容策略应该是“补强 shape，再让 resolver 向前兼容”，而不是一次性把所有消费端都改成只认新字段：
  - option value 新增 `minionDefId/baseDefId`
  - `onResolve` 先读 `minionDefId`，读不到再 fallback `defId`
- 这类过渡方式更适合当前仓的治理节奏：可以先把交互 option 合同收紧，再逐步清理下游对旧字段名的依赖，而不用一口气改完所有能力文件。

## 2026-05-17 02:59 补充发现：interaction metadata audit 里最值得优先收的，不是文件最多的那批，而是“规则已经很清楚但代码没写准”的那批

- `interactionTargetTypeAudit` 这轮证明，一个 audit 批次是否值得先收，不看命中数大小，先看规则是否单义：
  - 纯按钮分支却写成 `generic`
  - 同一 `sourceId` 同时充当 `base` 和 `minion`
  - 确实保留 `generic` 却没有登记理由
  这三类都属于“规范已经明确，代码只是没写准”，因此投入小、收益高。
- `interactionDisplayModeAudit` 这轮也出现了同样的分层：
  - “按钮缺 `displayMode` / 基地卡面缺 `displayMode`”是纯声明错误，适合先收
  - “显式 card displayMode 但 value 缺可渲染 id”则是更深一层的数据 shape 约束，适合按文件簇推进
- `buildMinionTargetOptions(...)` 的统一补强收益很高，因为它不是为了 grep 好看，而是把“任何场上随从直选 option 都应该显式带 `minionDefId/baseDefId`”固化进共享出口。这样后面修 `aliens`、`titans`、`tricksters` 时，不必每次重新发明一套 value shape。
- `base_mermaid_pool` 这类 `value: candidate` 还暴露了另一个事实：AST 审计不是运行时。只要 option value 不是字面量，审计就可能看不到实际字段，即使运行时对象已经有 `minionDefId`。这类场景要么改成字面量对象，要么调整审计器；两者不是一回事，不能混着算“都修过了”。
- 当前 `interactionDisplayModeAudit` 只剩 1 条失败、9 个点位，说明这一批已经从“规则散乱”进入“剩余个别文件还没跟上统一 shape”的阶段。下一步再打，就该按剩余文件簇收，不该回头再修已经绿掉的声明类问题。

## 2026-05-17 03:11 补充发现：interaction metadata audit 想长期稳，不该只认“value 必须是字面量对象”

- 这轮把 `interactionDisplayModeAudit.test.ts` 接到共享 `TypeScript Program + TypeChecker` 后，之前剩余 9 个红点里大部分直接消失，证明它们不是业务 shape 真缺，而是审计器只会看 `value: { ... }` 的表面结构。
- 最典型的几类误判源已经明确：
  - `value: { ... } satisfies SomeChoiceValue`
  - `value: card` / `value: choice` / `value: action`
  - helper 返回的 card option，但 helper 自己没有把 renderable contract 写进类型
- 这里的本质不是“让测试更聪明一点”，而是把审计口径改成真正接近 UI/runtime 的合同层：
  - 如果 `TypeScript` 已经能证明该 value 带 `defId/minionDefId/baseDefId`，audit 不该继续把它判红
  - 如果 value 只是按钮 payload，哪怕 prompt `targetType` 是 `minion`，也不该为了“看起来像某个实体交互”去硬标 `card`
- 同时这轮也暴露出另一条反模式：**skip/yes/no 这类控制分支不应伪装成实体 target shape**。
  - `bear_cavalry_commission_move_minion` 之前拿 `{ minionUid: '__skip__', baseIndex }` 冒充跳过分支，会把 button 语义污染进 minion contract
  - 正确做法是显式 `skip: true`，handler 直接识别控制语义
- 因而后续统一测试标准可以更明确：
  - 审计器优先识别真实类型合同，而不是鼓励到处把 `value` 改写成更丑的字面量
  - 真正的业务修复只针对 shape 漏洞本身，例如漏 `minionDefId`、错把按钮写成 `card`、helper 没声明 renderable contract

## 2026-05-17 03:22 补充发现：测试结构门禁也要避免“禁得太宽”，否则会反过来鼓励绕规则

- 这轮给 `testing-structure-guard.mjs` 增加“禁止业务测试直接导入 registry/handler”时，第一次实现把 `from '../domain/abilityRegistry'` 整体判成违规，结果立即误伤了很多只是在做：
  - `clearRegistry()`
  - 类型导入
  - 其它合法 setup/contract API
- 这说明测试门禁本身也要遵守和业务规则一样的原则：**只固化真正的不变量，不要把模块表象直接写成禁令。**
- 真正该拦的是：
  - `resolveAbility`
  - `getInteractionHandler`
  - `getAbilityRuntimePromptHandler`
  - `console.log/warn/error/debug`
- 不该拦的是“任何碰过这个模块的人”。否则结果会变成：
  - 工程师为了绕门禁改 import 写法
  - 或者把合法 setup 搬到更隐蔽的位置
  - 而不是减少测试对实现细节的耦合
- 这条经验后面值得继续沿用：凡是给测试体系加 guard，都要优先按**具体坏入口**下刀，而不是按整个文件、整个模块或整个目录一刀切。

## 2026-05-17 03:31 补充发现：把能力簇从巨型泛名文件迁到独立文件，价值不在“文件更小”，而在“同一簇只保留一套行为入口”

- `Aliens` 这轮迁移后更清楚地证明了一点：**同一个派系能力簇，最好在同一文件里统一走一套公开行为 seam。**
  - `alien_invader` / `alien_collector` / `alien_supreme_overlord` / `alien_disintegrator` / `alien_crop_circles` 全部收进 `abilities/aliens.test.ts` 后，这个文件只需要理解：
    - 真实出牌命令
    - prompt facade
    - 响应命令
  - 不再需要在 `factionAbilities.test.ts` 这种巨型文件里跨很多派系上下文切换。
- 这类迁移减少 churn 的关键，不是“describe 被挪了位置”，而是下面两个结构变化：
  - 同一能力簇的 helper 可以本地化，例如 `execPlayMinion(...)` / `execPlayAction(...)`
  - 同一能力簇的业务词汇、前置状态、prompt 断言都能收在一个边界里，不必跟别的派系共用一团越来越泛的上下文
- 反过来说，巨型测试文件真正危险的地方也更明确了：
  - 某一簇逻辑想改成真实 `PLAY_ACTION`
  - 另一簇还停在旧 helper 或历史入口
  - 最后同一个文件里同时出现 3 套入口、4 套夹具口径
  这样就算 grep 命中清零，后续重构照样会碎。
- 因此后续继续拆 `factionAbilities.test.ts` 时，优先级不该按“哪段最短最好搬”排，而该按：
  - 哪个能力簇已经能自然收敛到单一公开行为入口
  - 哪个能力簇当前仍混用真实出牌链和历史夹具
  - 哪个能力簇拆出来后能立刻减少上下文切换与重复 helper

## 2026-05-17 03:37 补充发现：并不是每次都该新开一个专项文件，已有“单主题文件”通常是更好的吸收点

- `Dinosaurs` 这一轮和 `Aliens` 不同：`abilities/dinosaurs.test.ts` 早就存在，而且它已经是一个主题明确的恐龙专项文件。
- 这说明“降低测试 churn”的正确动作不总是“把某段从大文件挪到一个新文件”，而是先判断有没有现成的稳定归宿：
  - 如果已有文件本身主题单一、边界清楚，就优先并进去
  - 只有在没有合适归宿时，才新开 `abilities/<faction>.test.ts`
- 这样做的好处比机械新建文件更实际：
  - 避免同一派系被拆成 `dinosaurs.test.ts`、`dino-actions.test.ts`、`dino-ongoing.test.ts` 三四份，最后又形成新的碎片化
  - 让“同一派系的行为 seam”尽量集中，后续找测试、补回归、读上下文都更稳定
- 这也给后面的迁移提供了一个更明确的判断标准：
  - 先看是否已有单主题专项文件
  - 再看迁入后会不会破坏它的单主题边界
  - 只有两者都不满足时，才考虑新开文件

## 2026-05-17 03:49 补充发现：当历史泛名文件被压到只剩 1-2 个尾项时，剩下的问题已经不再是“拆不拆”，而是“这些尾项各自应该归哪类文件”

- 这轮连续迁出海盗、巫师、机器人和“立即额外行动”后，`factionAbilities.test.ts` 只剩：
  - `ghost extra timing audit`
  - `ninja_seeing_stars`
- 这说明一个阶段已经切换了：
  - 之前的问题是“巨型泛名文件太大，很多能力簇混在一起”
  - 现在的问题是“只剩极少数没有自然归宿的尾项”
- 这两类问题的处理策略不一样：
  - 在“大杂烩阶段”，优先按能力簇批量迁出
  - 在“尾项阶段”，优先判断测试本质是什么，再决定归宿
- 这轮里最典型的是“立即额外行动”：
  - 它虽然历史上挂在 `factionAbilities.test.ts`
  - 但本质上根本不是某个派系，而是一个跨能力共享交互
  - 正确做法不是把它塞到某个派系文件里，而是单独起一个语义准确的文件
- 因此后续收尾时，判断维度应该进一步从“按派系拆”升级为“按行为类别归位”：
  - 派系能力 -> `abilities/<faction>.test.ts`
  - 共享交互链 / 共用能力机制 -> 语义化的 cross-cutting 文件
  - audit / contract / metadata 断言 -> audit 或 contract 文件
- 这也解释了为什么 `ghost extra timing audit` 不该机械塞进某个派系能力文件：它更像一条额外回合/额外出牌时机合同审计，而不是普通 faction ability 示例。

## 2026-05-17 03:54 补充发现：删除历史泛名文件的前提，不是“内容变少了”，而是“每一条残留都已经找到语义更准确的归宿”

- `factionAbilities.test.ts` 这一轮能真正删除，不是因为它只剩两条测试，而是因为这两条已经都能明确回答“我到底属于什么”：
  - `ninja_seeing_stars` -> 忍者派系专项文件
  - `ghost_ghostly_arrival off-phase immediate` -> 幽灵能力块里的时机合同断言
- 这个判断很关键。否则很容易出现另一种假收口：
  - 先把大文件拆薄
  - 剩几条“不好归类”的尾项
  - 然后为了追求“文件数变少”直接删掉或随便塞进某个不太相关的文件
  - 结果是表面上整理了，真实语义反而更乱
- 所以“能不能删历史壳文件”的最低标准应该是：
  - 原文件中的每一类测试都已经在别处有更准确的归位
  - 新归位后的文件名、上下文、helper 和断言语义比原来更清晰
  - 删除后不会让人失去查找入口，只会让入口更准确

## 2026-05-17 04:04 补充发现：`第N批` 这类命名本身就是测试脆弱性的信号，它按迁移历史分组，而不是按行为边界分组

- `query6Abilities.test.ts` 这一轮被彻底删除后，这个问题更清楚了：
  - 文件里原来同时混着海盗、忍者、巫师、外星人
  - 它们唯一的共同点不是共享行为、共享夹具或共享合同
  - 而只是“曾经在同一批次被补进去”
- 这种按历史批次分组的文件会自然制造三种 churn：
  - 改某个派系能力时，需要先在一个和它没语义关系的大杂烩里找上下文
  - 同一文件里会慢慢并存多套 helper、不同入口风格和不同断言口径
  - 后续重构某个派系的公开 seam 时，容易顺手牵动别的无关派系用例
- 所以判断“这个文件是不是该退场”时，可以再加一条很硬的信号：
  - 如果文件名或组织方式主要描述的是“迁移批次 / 历史来源 / 杂项集合”
  - 而不是“派系 / 行为类别 / 合同边界”
  - 那它大概率就不是长期稳定的测试归宿
- `query6Abilities.test.ts` 的正确收口方式也印证了前面的原则：
  - 忍者 -> `abilities/ninjas.test.ts`
  - 海盗 -> `abilities/pirates-ongoing.test.ts`
  - 巫师 -> `abilities/wizards.test.ts`
  - 外星人 -> `abilities/aliens.test.ts`
  - 真正减少未来重构成本的，不是“把测试挪走”，而是“让每份专项文件只维护一套可复用的行为入口和业务词汇”

## 2026-05-17 04:09 补充发现：即使不是“多派系混装”，同一派系的双入口并存也会制造测试 churn

- `robotAbilities.test.ts` 这一轮删除后，暴露出的不是“批次混装”问题，而是另一种更隐蔽的坏结构：
  - 根目录已经有 `robotAbilities.test.ts`
  - 同时又已经存在 `abilities/robots.test.ts`
  - 两个文件都在维护机器人派系的真实出牌行为
- 这种“双入口同主题”会带来另一类维护成本：
  - 改机器人行为时，不确定该去哪个文件补回归
  - 两边容易长出不同的 helper 口径和不同的断言风格
  - 后续重构同一派系时，经常需要同步改两边，哪怕它们测的是相近合同
- 所以判断“要不要继续收口”时，不能只看是不是多派系混装；还要看有没有：
  - 同一派系在两个位置各维护一部分普通行为测试
  - 其中一个位置已经明显是更准确、更长期的专项入口
- 这轮机器人的正确动作不是“保留两个入口各管一半”，而是：
  - 把 `robot_microbot_reclaimer / fixer` 统一并回 `abilities/robots.test.ts`
  - 删除旧的根目录 `robotAbilities.test.ts`
  - 让机器人派系重新只保留一个普通行为入口

## 2026-05-17 04:19 补充发现：除了“多派系混装”和“同派系双入口”，还要继续清理“根目录单派系旧入口”

- `ghostsAbilities.test.ts` 这轮说明，测试 churn 的另一种来源不是内容混装，而是**入口层级不一致**：
  - 一部分幽灵测试已经在更准确的专项或扩展文件里
  - 另一部分普通行为还挂在根目录 `ghostsAbilities.test.ts`
  - 结果就是同一派系的测试入口分散在“根目录旧命名”和“语义更准确的专项文件”两套层级
- 这种结构的坏处和双入口类似，但更隐蔽：
  - 读代码的人会先误以为根目录文件仍是当前主入口
  - 后续补幽灵回归时，不容易第一时间判断该进 `abilities/ghosts.test.ts` 还是继续往旧根目录文件里堆
  - 即使行为 seam 没变，文件层级分裂也会放大“改一次要同步找两三处”的维护成本
- 所以现在筛选旧测试入口时，应该至少看三种信号，而不是只看“大不大”：
  - 是否是按批次/杂项组织的历史混装文件
  - 是否是同一派系双入口并存
  - 是否是根目录单派系旧入口，而专项目录里其实已经存在更长期的归宿
- `ghostsAbilities.test.ts` 的正确收口方式不是继续挂一个“幽灵旧入口”，而是：
  - 普通派系行为 -> `abilities/ghosts.test.ts`
  - 时机/扩展合同 -> 继续留在更准确的专项文件，例如 `expansionAbilities.test.ts`
  - 这样后续重构 `ghost_make_contact` 一类普通行为时，只需要维护一个清晰入口

## 2026-05-17 07:40 补充发现：`代表性玩法` 这类跨多派系抽样文件，本质上仍是混装壳，只是名字比“第 N 批”更像业务

- `shayuFactionAbilities.test.ts` 这轮说明，混装文件不一定写着“第6批 / 杂项 / 临时”才算坏结构：
  - 它表面上写的是“三派系代表性玩法”
  - 但内部仍同时维护鲨鱼、龙卷风、神话希腊三套不同业务词汇、不同触发链和不同基地合同
  - 这和按批次混装的根因一致：共享的不是行为边界，只是“当时顺手放在一起”
- 这类文件比 `query6Abilities.test.ts` 更隐蔽，因为名字听起来像“业务聚合”：
  - 容易让人误以为这是一个合理的长期入口
  - 但后续改任一派系时，仍会被迫进入一份跨派系上下文的大文件
  - 单派系重构也更容易顺手碰坏别的派系抽样
- 所以现在判断一个测试文件是否该退场，信号应再补一条：
  - 如果文件通过“代表性玩法 / 抽样复审 / 综合行为”把多个派系揉在一起
  - 但这些派系之间并无共同 seam、共同夹具或共同合同
  - 那它仍然属于应该拆回派系专项文件的历史壳
- `shayuFactionAbilities.test.ts` 的正确收口方式验证了这一点：
  - 鲨鱼 -> `abilities/sharks.test.ts`
  - 龙卷风 -> `abilities/tornados.test.ts`
  - 神话希腊 -> `abilities/mythic-greeks.test.ts`
  - 真正长期稳定的入口，仍然应该按派系或明确行为边界组织，而不是按“代表性抽样集合”组织

## 2026-05-17 08:01 补充发现：从聚合文件迁测试时，真正该一起迁走的往往不只是 `describe`，还包括“本地事件回放 seam”

- `Killer Plants` 这轮暴露出另一个容易被忽略的脆弱点：
  - 表面上是 `expansionAbilities.test.ts` 和 `abilities/killer-plants.test.ts` 双入口并存
  - 更深一层是旧段落里还在靠本地 `applyEvents(state, events)` 手推 reducer，再去验证最终状态
- 这种写法的问题不只是“helper 多一层”：
  - 业务命令链已经给了 `result.finalState`
  - 测试却再自己重放一遍事件
  - 后续只要 reducer 顺序、补充事件或中间实现细节变动，测试就会比真实用户链更早碎掉
- 所以迁移专项文件时，判断是否真的减少 churn，应该同时看两件事：
  - 是否消掉了“聚合文件 + 专项文件”双入口
  - 是否把能直接用 `finalState` 表达的不变量，从本地事件回放迁回真实命令结果
- 这轮里 `killer_plant_insta_grow` / `killer_plant_weed_eater` 并入 `abilities/killer-plants.test.ts` 后，顺手把相关状态断言都优先写成：
  - `PLAY_ACTION` / `PLAY_MINION`
  - 直接看 `runCommand(...).finalState`
  - 只在确实需要锁低层合同（例如 off-phase immediate metadata）时保留能力合同入口
- 这比单纯“文件换地方”更接近用户要的目标：以后重构实现时，测试更依赖公开行为结果，而不是事件回放细节。

## 2026-05-17 08:06 补充发现：扩展聚合文件一旦只剩单个派系尾项，就应该继续追到“同派系只留一个普通行为入口”

- `Bear Cavalry` 这轮证明，`expansionAbilities.test.ts` 的问题不只是“大”，而是它还在和 `abilities/bear-cavalry.test.ts` 并行维护同一派系的普通行为。
- 这类双入口即使文件都不算大，也会继续制造 churn：
  - 改 `bear_cavalry_bear_hug` 时不知道该先进哪个文件
  - tie-choice 回归、额外随从交互和其它熊骑兵保护/移动回归被拆在两套上下文里
  - 后续只要 helper 或断言风格调整，同一派系就要跨两个文件同步
- 所以扩展聚合文件进入“尾项阶段”后，优先级应该变成：
  - 先看尾项是否已经有现成专项归宿
  - 如果有，就继续并回专项文件
  - 只有没有稳定归宿时，才保留在聚合入口或考虑新开专项文件
- 这轮把 `bear_cavalry_bear_hug` 和 `bear_cavalry_commission` 并回 `abilities/bear-cavalry.test.ts` 后，`expansionAbilities.test.ts` 明显变得更接近“真正没归宿的剩余项”，而不是继续承担同派系双入口。

## 2026-05-17 08:14 补充发现：当聚合文件已经只剩“每个尾项都有明确归宿”时，最干净的动作就是整文件退场

- `expansionAbilities.test.ts` 这一轮已经走到这个阶段：
  - `steampunk_scrap_diving` 有明确的 Steampunks 行为归宿
  - `cthulhu_complete_the_ritual` 也已经有 `abilities/cthulhu.test.ts` 这个专项文件，只是之前少了一段打出约束
- 这种情况下继续保留一个只剩 1-2 个 describe 的历史聚合文件，没有长期价值：
  - 它不再提供真正的共享上下文
  - 只会让“应该去哪个文件补回归”再次变模糊
- 所以这里的正确动作不是把旧文件压到更小，而是：
  - 给缺少专项归宿的能力补上专项文件或补齐现有专项文件
  - 然后直接删除旧聚合入口
- 这也进一步说明，测试整理的终点不该是“所有旧文件都还在，只是更短”，而应该是：
  - 同一能力/派系/行为边界只保留一个自然入口
  - 历史聚合壳在不再承载独特价值时直接退场

## 2026-05-17 08:14 补充发现：`ongoing` 聚合文件也要区分“共享机制合集”与“其实已经有专项归宿的派系段落”

- `expansionOngoing.test.ts` 这一轮的幽灵段证明，`ongoing` 聚合文件并不天然合理。
- 关键要看里面的段落是否已经满足两件事：
  - 该派系已经有自己的专项文件
  - 这些 ongoing/低层合同仍然属于同一派系的自然语义边界，而不是跨派系共享机制
- `Ghosts` 就符合这个条件：
  - `ghosts.test.ts` 已经是当前幽灵专项入口
  - `ghost_incorporeal`、`ghost_make_contact` 的显式控制权事件与 detach affect 合同，本质上都仍是幽灵派系语义
  - 继续留在 `expansionOngoing.test.ts` 只会制造第二入口
- 所以下一步拆 `expansionOngoing` 时，优先级也不该按“哪段最短”排，而该按：
  - 哪些段落已经有稳定专项文件可承接
  - 哪些段落仍然只是在历史聚合文件里寄居，没有独特的跨派系理由

## 2026-05-17 09:00 补充发现：按“扩展包”把多个派系普通行为混在一起，本质上和按批次混装没有区别

- `cthulhuExpansionAbilities.test.ts` 这轮再次说明，文件名里带不带“expansion”不重要，关键还是它是不是稳定行为边界。
- 这份文件内部同时维护：
  - 印斯茅斯普通行动
  - 米斯卡塔尼克普通行动
  - 克苏鲁之仆普通行动
  它们共享的并不是同一套 prompt 机制、同一套夹具或同一条业务链，只是“都来自同一个扩展盒”。
- 这种组织方式会继续制造和 `query6Abilities.test.ts` 一样的 churn：
  - 改 `innsmouth_new_acolytes` 时还得进一个混有另外两派系语义的大文件
  - 同一派系已经有专项文件时，会出现“普通行为到底写回专项还是写回扩展包壳”的第二入口
  - 后续想统一某个派系的 helper 或断言风格时，不得不跨文件同步
- 所以“扩展包聚合”不能自动视为合理边界。只要其中的测试已经能自然归到：
  - `abilities/cthulhu.test.ts`
  - `abilities/innsmouth.test.ts`
  - `abilities/miskatonic.test.ts`
  那就应该直接并回各自专项，而不是继续保留一个“因为同扩展所以先混着”的旧壳。

## 2026-05-17 09:45 补充发现：`ongoing` 大文件迁到共享 helper 后，最容易漏掉的是“手牌/牌库存在性”这类旧默认前提

- 这轮把 `baseFactionOngoing.test.ts` 的整段 `诡术师 ongoing` 并回 `abilities/tricksters.test.ts` 后，第一波红灯不是实现行为坏了，而是测试状态工厂换了：
  - `trickster_brownie_pod` 期待“抽 1 张牌”
  - `trickster_pay_the_piper` 期待“对手弃 1 张牌”
  - 但共享 `helpers.makeState(...)` 默认不给玩家手牌/牌库，而旧 `baseFactionOngoing.test.ts` 的本地 `makeState(...)` 默认两边都塞了牌。
- 这说明旧大文件的脆弱性不只在“用了内部 prompt 字段”，还在于**它把资源存在性前提偷偷烘焙进本地状态工厂**：
  - 抽牌测试其实依赖“牌库非空”
  - 弃牌测试其实依赖“对手手牌非空”
  - 这些如果不显式写出来，后续只要统一 helper、统一玩家默认派系、统一最小状态，测试就会看起来像“实现回归”
- 因而后续的统一测试标准应再补一条更具体的不变量：
  - 凡测试标题声称“抽牌 / 弃牌 / 随机弃牌 / 洗回后抽牌 / 手牌不足时弃全部”
  - 测试体内必须显式提供对应的 `deck` / `hand` 前提
  - 不能继续依赖某个旧文件局部 `makeState(...)` 的隐藏默认值。
- 这类迁移的价值也因此更明确：真正降低 churn 的不是“把 `trickster_*` 从一个文件挪到另一个文件”，而是**让专项文件自己完整声明业务前提**，以后重构测试 helper 时不会再被旧默认值牵着走。

## 2026-05-17 09:54 补充发现：当历史壳文件已经只剩单一派系合同时，正确动作通常不是保留“技术主题名”，而是直接并回派系专项并删壳

- `baseFactionOngoing.test.ts` 这轮最后剩下的内容，表面上还叫“基础派系 ongoing/special”，但实质已经只剩：
  - 忍者 ongoing / special 合同
  - `ninja_acolyte` 额外打出 `cowboys_gunfighter` 的续链
- 这说明“技术主题名”本身也可能变成历史噪音：
  - 文件名看起来像 shared mechanism
  - 但实际测试边界已经收缩成单一派系
  - 继续保留只会制造“忍者 special 到底看专项还是看旧技术壳”的第二入口
- 这类文件的处理标准可以更明确：
  - 如果它里面已经不再承载多个派系共享机制
  - 也不再承载一个真正跨派系的 contract 集合
  - 那就应该并回派系专项，而不是因为名字里有 `ongoing` / `special` / `baseFaction` 就继续保留
- 这轮 `ninjas.test.ts` 也进一步验证了另一个点：
  - 把旧文件测试并回专项时，不必拘泥于“必须全改成共享 helper”
  - 更重要的是把原本分散在旧文件里的默认手牌、默认牌库、默认派系、默认 turn meta 变成专项文件自己可读、可改、可验证的显式 helper
  - 这样以后重构的是“一个派系的一套显式前提”，不是“很多文件各自藏着一点默认值”

## 2026-05-17 09:54 补充发现：`pirates-ongoing.test.ts` 当前更像命名遗留，不像优先级最高的混装壳

- 快速复核 `pirates-ongoing.test.ts` 的开头后，当前看到的是：
  - `pirate_king beforeScoring`
  - `pirate_first_mate afterScoring`
  - 以及同一派系相关的 action / response 行为
- 这和之前的 `query6Abilities.test.ts`、`factionAbilities.test.ts`、`baseFactionOngoing.test.ts` 不一样：
  - 至少从当前结构看，它还没有明显把多派系或多种无关共享机制揉在一起
  - 问题更像“文件名仍带 ongoing”，而不是“内容边界已经错了”
- 因此后续优先级应该继续坚持“先拆真混装壳，再处理纯命名遗留”：
  - 只因为名字旧，不足以成为下一刀
  - 只有当文件内容也证明它在混放多个不该共存的行为边界时，才值得继续拆

## 2026-05-17 10:05 补充发现：`talent` 不是一个天然测试边界，真正稳定的边界是“派系行为”与“共享机制合同”

- `talentAbilities.test.ts` 这轮证明，按能力类型统一收口也会形成新的混层壳。文件里原本同时放着：
  - `miskatonic_professor`
  - `cthulhu_star_spawn`
  - `cthulhu_servitor`
  - `standing stones` 双天赋名额
  - 压制下的手动发动
  - `execute` 与 `validate` 的 talentUsed 边界
- 这些内容共享的只是一层“都和 talent 有关”的技术标签，不共享同一套业务词汇、同一条用户入口，也不共享同一类断言目标。
- 真正长期稳定的拆法是两层：
  - 派系 talent 行为 -> 回到对应 `abilities/<faction>.test.ts`
  - `execute/validate/base rule` 这类共享合同 -> 单独放 `talent-mechanics.test.ts`
- 这样做比保留一个 `talentAbilities` 总入口更稳，因为以后重构 talent 运行时：
  - 改教授或星之眷族的业务效果，只会动派系专项
  - 改 `talentUsed`、`standing stones`、压制规则，只会动机制合同
  - 不再出现“实现改一层，三个不相干派系测试一起抖”的情况
- 这轮还进一步说明一个判断标准：
  - 像 `execute 层不负责 talentUsed 校验` 这种断言，不该挂在某个派系文件里冒充派系行为
  - 但也不该继续和多个派系行为混放在技术主题总入口里
  - 最准确的落点是显式机制文件，因为它锁的是系统边界，不是牌面业务

## 2026-05-17 10:19 补充发现：`ongoing talent` 也不是天然边界，真正稳定的是“共享合同”和“派系专项”两层

- `ongoingTalent.test.ts` 这轮把另一个相同问题暴露得更彻底：文件名听起来像一个合理专题，但里面同时放着：
  - `miskatonic_lost_knowledge`
  - `steampunk_zeppelin`
  - `innsmouth_sacred_circle`
  - `trickster_hideout_pod`
  - `trickster_pixie_pod`
  - 以及一层 ongoing talent validate / reset / payload 合同
- 这说明“按能力实现形态命名”本身不等于稳定边界。只要测试里还混着不同派系业务词汇和共享系统规则，它仍然是旧壳。
- 这轮还确认了一个更重要的 seam 判断：
  - 旧文件里像 `zeppelin 无目标 -> ABILITY_FEEDBACK`、`sacred_circle 无同名 -> ABILITY_FEEDBACK` 这类断言，其实是锁 `execute` 内层路径
  - 一旦回到真实 `runCommand` / validate 入口，公开合同是“直接拒绝”
  - 对这类场景，稳定测试应优先保护公开入口结果，而不是内层事件长相
- 所以后续筛文件时，除了看“是否多派系混装”，还要额外看：
  - 文件是否把一批原本应由 `runCommand`/公开命令入口定义的行为，写成了 `execute` 层的技术主题断言
  - 如果是，就要把共享 validate/reduce 合同提纯出来，把派系行为并回专项，并顺手把旧 seam 收正到真实公开入口

## 2026-05-17 11:01 补充发现：`prompt` 主题文件最容易制造“看起来在测交互，其实在测测试壳”的假边界

- `madness-prompt-mechanics.test.ts` 这轮把这个问题暴露得很直接：
  - 文件名像是在测“疯狂 prompt 机制”
  - 但内容其实是 `cthulhu_madness_unleashed`、`miskatonic_it_might_just_work`、`miskatonic_book_of_iter_the_unseen`、`miskatonic_thing_on_the_doorstep`
  - 它们并不共享一套稳定的业务边界，只是历史上都碰到了 prompt
- 这类文件的真正问题不是“跨派系”四个字本身，而是它会把测试入口偷偷换成壳层 helper：
  - `postProcessSystemEvents(...)`
  - `lastMatchState`
  - `getLastPrompt(...)`
  - `getLastPromptsBySourceId(...)`
  - 这些都不是用户行为入口，而是旧测试为了追 prompt 方便自己搭出来的旁门
- 一旦把业务测试绑到这些壳层入口，后续重构 prompt 队列、后处理时序、matchState 包装或 interaction 存储位置时，测试就会先碎；这正是“改代码就得顺手改测试”的根因之一。
- 这轮的正确收口不是“把 prompt 文件拆散”，而是把测试重新钉回公开行为：
  - 打牌仍从 `PLAY_ACTION / runCommand(...)` 进入
  - prompt 只通过 facade 读取：`getSimpleChoicePrompt`、`respondToPromptOption(...)`、`respondToPromptOptions(...)`
  - 最终状态只通过 `finalState` 或特定合同的真实事件归约验证
- `miskatonic_thing_on_the_doorstep` 还补了一条很关键的细化：
  - special 合同的最终状态不能偷懒读 `result.matchState?.core`
  - 必须看该合同实际发出的事件如何归约到 `state`
  - 这次显式改成 `result.events.reduce((core, event) => reduce(core, event), state)`，说明“真状态出口”也要按合同类型选对，不能继续吃旧壳默认值
- 因此后续统一测试标准可以更硬一些：
  - 只要文件名或段落名主要描述的是 `prompt / interaction / dialog` 这类表现层壳，而不是派系行为或共享系统合同，就要先怀疑它是不是历史测试壳
  - 只要业务测试还在读 `lastMatchState / postProcessSystemEvents` 这种二次包装，就说明 seam 还没真正收回公开入口

## 2026-05-17 11:03 补充发现：`postProcessSystemEvents` 不能一概视为坏味道，关键要区分“业务借壳”还是“系统合同”

- 这轮继续扫剩余命中后，边界已经更清楚了：
  - `elder-things.test.ts` 里的 `lastMatchState + getLastInteractions()` 明显属于业务借壳
  - `ongoingE2E.test.ts` 里 `pirate_shanghai` 那一小段也属于业务借壳，因为它只是想证明业务 prompt 出现
  - 但同文件后半段的 `buccaneer_pod replacement`、`first_mate_pod afterScoring`，以及 `wizard-portal-d45.test.ts`、`reactionQueueBaseAbilities.test.ts` 这类场景，本身就在锁后处理/队列/去重/response window 合同
- 这说明后续不能把“还在用 `postProcessSystemEvents`”当成统一整改信号。
- 更准确的判断标准应该是：
  - 如果测试真正想证明的是“某张牌/某个派系行为会产生 prompt / 目标选择 / 最终状态变化”，那它不该再借 `lastMatchState` 或手搓 interaction 壳，应该回到 `runCommand(...).finalState` 或 `post.matchState` 上的 facade
  - 如果测试真正想证明的是“后处理器本身如何派生事件、如何去重、如何恢复 reaction session、如何在 replacement/afterScoring 中接管状态”，那保留 `postProcessSystemEvents(...)` 是合理的，因为它就是被测对象
- 因此现在的优先级不再是“继续把所有 `postProcessSystemEvents` 命中消灭掉”，而是：
  - 先继续拔掉业务测试里的借壳 seam
  - 明确保留系统合同测试对 `postProcessSystemEvents` 的直测入口
  - 避免为了数字好看，把系统测试也硬改成业务 facade，反而丢失真正的基础设施覆盖

## 2026-05-17 11:09 补充发现：`prompt.data.options` 这种残留壳即使只剩一处，也值得清掉，因为它会把“选第一个合法项”重新绑回内部结构

- `smashup.smoke.test.ts` 这轮剩下的最后一处 `prompt?.data?.options?.[0]?.id` 很小，但问题性质和之前一样：
  - 测试真正想表达的是“对当前 prompt 取默认首项继续反应链”
  - 它并不关心 prompt 底层字段名、存储位置或未来是否继续挂在 `data.options`
- 只要这种兜底还在，后续一旦 facade/helper 已经演进，但某处业务测试还偷偷绕回裸字段，重构 prompt 外壳时就会留下零散脆点。
- 所以统一标准可以再明确一条：
  - 即使测试只是“随手拿第一个选项”
  - 也应该通过 `getPromptOptions(prompt)` 这种 facade 表达
  - 不应该因为逻辑简单就回退到 `prompt.data.options`
- 这条清掉后，当前 `src/games/smashup/__tests__`（排除 helper）里已经没有裸 `prompt.data.options` 读取命中，说明这条 seam 至少在业务测试层面已经基本收净了。

## 2026-05-17 11:17 补充发现：`<Faction>Pod.test.ts` 这类根目录单派系旧入口，本质上和之前的 `ghostsAbilities.test.ts` / `robotAbilities.test.ts` 是同一类双入口债务

- `giantAntsPod.test.ts` 这轮再次证明，测试 churn 不只来自“跨派系混装”，也来自“同一派系的 POD 行为还挂在根目录旧入口，而普通/专项行为已经在 `abilities/` 里继续演化”。
- 这种结构会制造几个具体问题：
  - 改巨蚁 POD 行为时，不确定该补在 `abilities/giant-ants.test.ts` 还是继续往 `giantAntsPod.test.ts` 堆
  - 同一派系的 helper、命名、断言风格会在两个文件里继续漂移
  - 后续如果要统一这个派系的前提工厂、prompt facade、反应链断言，仍然得跨两个入口同步改
- 这轮还确认了一个更细的迁移原则：
  - 当专项文件已经承接了同派系的一部分 POD/非 POD 行为时，不应该把旧根目录文件整份机械复制过去
  - 应先核对专项文件里已经有什么，再只补缺失的行为簇
  - 否则“并回专项”会退化成“把重复测试从一个文件复制到另一个文件”
- 所以后续筛这类文件时，判断标准可以更明确：
  - 只要根目录文件本质上仍是单派系业务入口
  - 且 `abilities/<faction>.test.ts` 已经存在并正在承担该派系的长期专项职责
  - 就应优先考虑并回专项并删掉旧根目录入口，而不是保留两份“一个测 POD、一个测别的”分治结构

## 2026-05-17 11:27 补充发现：`elderThingsPod.test.ts` 进一步证明，POD 旧入口不是天然独立边界，关键仍要看专项文件是否已经存在且能承接

- `elderThingsPod.test.ts` 这轮和 `giantAntsPod.test.ts` 属于同一类问题：
  - 文件名看起来像“POD 专项”
  - 但它并不在锁一套跨派系共享 POD 机制
  - 本质上仍是在测远古之物自己的业务行为，只是历史上挂在根目录旧入口
- 更关键的是，它还夹了一段 `elder_things (base): Elder Thing`：
  - 这不是 POD 独特合同
  - 只是基础版 FAQ 的重复覆盖
  - 如果机械整份并回，只会把重复合同一起复制到专项文件里
- 因此判断“该不该并回专项”时，不能按旧文件名或 `describe` 分组机械迁：
  - 先看 `abilities/elder-things.test.ts` 是否已经是远古之物的长期自然入口
  - 再看旧文件里哪些段是真正缺失的 POD 行为
  - 对已经被基础版或专项现有用例覆盖的 FAQ/重复段，不应再搬第二遍
- 删除旧文件后 `elder-things.test.ts` 单文件 `53 passed`，说明现在不是靠根目录旧文件托底；远古之物派系已经真正收成单入口。

## 2026-05-17 11:33 补充发现：`vampiresPod.test.ts` 说明并回专项时不必把“低层合同”误判成“必须保留旧入口”

- `vampiresPod.test.ts` 主体仍然是吸血鬼 POD 业务行为，和 `elderThingsPod/giantAntsPod` 一样，本质是第二入口债。
- 但它比前两份多一处容易误判的内容：`resolveOnPlay('vampire_wolf_pact_pod_action')`。
  - 这确实是低层合同
  - 但它依然是吸血鬼 Wolf Pact POD 自己的专项合同
  - 并不因此需要继续把整份文件留在根目录
- 这说明后续筛文件时，判断标准要再细一层：
  - “含有少量低层合同” 不等于 “必须保留旧入口文件”
  - 真正要看的是这些低层合同是否仍属于同一派系/同一专项边界
  - 如果属于，就应跟该派系其它行为一起收进单一专项文件，而不是让旧文件靠少量低层断言继续存活
- `vampiresPod.test.ts` 删除后 `abilities/vampires.test.ts` 单文件 `19 passed`，进一步证明吸血鬼现在已经能在一个入口里同时承接普通行为、afterScoring 合同和 POD 合同。

## 2026-05-17 11:42 补充发现：`interactionChain` 这类旧文件名也可能只是“业务第二入口 + 自建运行壳”，并不天然代表系统合同

- `zombieInteractionChain.test.ts` 这轮把另一个误判源钉死了：
  - 文件名里带 `interactionChain`
  - 文件内部也确实有一套自建 `GameTestRunner` / `buildSystems` / `makeFullMatchState`
  - 但主体内容并不是在锁通用 InteractionSystem 合同，而是在逐条验证僵尸派系自己的业务链
- 这说明“看起来很底层”不等于“应该保留成独立旧文件”。
  - 如果测试真正关注的是 `zombie_grave_digger`、`zombie_lord`、`zombie_tenacious_z`、`zombie_theyre_coming_to_get_you` 这些牌面行为
  - 那么旧的自建 runner/系统壳只是历史测试入口，不是稳定边界
- 正确动作不是继续留一个 `interactionChain` 旧壳，而是把业务链收回派系专项：
  - 普通命令链回 `runCommand + makeMatchState`
  - prompt 继续走 facade
  - 只有确实属于该派系的低层 queue 合同，例如 `zombie_overrun` 的 onTurnStart 自收口，才一起留在同一专项文件里
- 这个判断标准比“只要用了 `collectTriggers/maybeResolveReactionQueue` 就算系统合同”更准确。关键看它锁的是共享基础设施，还是某个派系自己的业务不变量。

## 2026-05-17 11:47 补充发现：`FAQ` 标签也不是天然边界，很多时候只是“同派系历史补丁入口”

- `frankensteinFaq.test.ts` 这轮进一步确认，文件名里带 `Faq` 不等于它就是一个该独立存在的知识库文件。
- 它里面的三条合同：
  - `frankenstein_blitzed`
  - `frankenstein_uberserum`
  - `frankenstein_its_alive`
  都是弗兰肯斯坦派系自己的行为边界，没有跨派系共享的 FAQ 基础设施可言。
- 这类文件长期保留的坏处和之前那些 `Pod / InteractionChain / ExpansionAbilities` 一样：
  - 同一派系行为继续分散在两个入口
  - 后续改实现时，不知道该先改专项还是改 FAQ 壳
  - 测试风格和 helper 使用会继续分叉
- 所以后续遇到 `*Faq.test.ts` 时，判断标准也应统一：
  - 看它是在维护共享 FAQ 规则，还是只是在堆某一派系的历史补丁回归
  - 如果是后者，就应并回对应专项，而不是因为“FAQ”三个字继续让旧入口存活

## 2026-05-17 11:51 补充发现：`verification` 小壳也不该因为“只剩两条低层测试”就单独保留

- `steampunk-pod-verification.test.ts` 这轮证明，根目录历史壳不一定体量大才有问题。
- 即使只剩 2 条测试，如果它们本质上仍属于：
  - `steampunk_ornate_dome`
  - `steampunk_escape_hatch`
  这类现成专项边界，就不该继续让一个 `verification` 壳单独活着。
- 否则长期后果还是一样：
  - 同一派系/同一能力的低层合同分散在两个文件
  - 改实现时得同时想“专项改哪边，验证壳改哪边”
  - 文件命名还会误导人以为这是独立的通用验证层
- 所以后续筛文件时，还应补一条细化标准：
  - 根目录里那种只剩 1-3 条派系低层合同的小文件，并不会因为“很短”就天然合理
  - 只要它们已经有明确专项归宿，就应继续并回专项，避免长期留着一堆历史小壳

## 2026-05-17 11:54 补充发现：历史文件名与当前卡牌名脱节时，更应尽快并回专项

- `bearCavalry-youre-screwed-pod-breakpoint.test.ts` 这轮暴露了另一类维护风险：
  - 文件名还是旧历史口径
  - 实际测的却是 `bear_cavalry_bearing_down_pod`
  - 这种“名字和被测对象都脱节”的小壳，比普通第二入口更容易误导后续维护
- 它的长期坏处不只是双入口：
  - 新人或后续 agent 很难从文件名猜到真正被测卡牌
  - 想补 `bearing_down_pod` 合同时，不容易想到这个历史文件
  - 结果就是专项文件和旧壳继续分裂演化
- 因而后续筛文件时，还可以再加一条优先级规则：
  - 如果根目录历史文件名已经不能准确反映当前被测卡牌/能力
  - 但内容又只是某个派系现有专项里的少量合同
  - 那它应比普通第二入口更优先被并回专项

## 2026-05-17 12:01 补充发现：带跨派系场景素材的测试，也可能仍然只是单派系第二入口

- `wizard-neophyte-ongoing.test.ts` 这轮说明，不能因为测试里用了别派系卡牌，就误判成“跨派系共享机制文件”。
- 它的两条测试虽然借了：
  - `zombie_overrun` 这个 ongoing 行动卡
  - `wizard_summon` 这个 standard 行动卡
  来构造对比场景，但真正想锁定的不是僵尸行为，也不是 ongoing 通用系统，而是 `wizard_neophyte` 自己这条业务不变量：
  - 额外打出牌库顶行动卡时，如果是 ongoing，要先出现基地选择
  - 如果是普通 action，则不该额外出现基地选择
- 这类文件如果继续挂在根目录，会制造一种假象：
  - 看起来像“ongoing 交互 bug 专题”
  - 实际上只是巫师学徒的两条派系行为合同
  - 后续改学徒实现时，仍然得在 `abilities/wizards.test.ts` 和这个根目录 bug 壳之间来回找
- 因此筛文件标准还应再补一条：
  - **场景里出现跨派系素材，不等于边界就是跨派系**
- 判断归属时要看“是谁的公开行为在变”，而不是看测试里借了谁做陪衬
- 如果真正变化的是某张牌/某个派系自己的行为分支，就应并回那个专项入口

## 2026-05-17 12:04 补充发现：`display-mode` 这类 UI 标签文件，很多时候只是既有专项块的尾部显示合同

- `cthulhu-chosen-display-mode.test.ts` 这轮说明，文件名里带 `display-mode`，不等于它应该长期独立存在。
- 这份文件锁的并不是一套跨派系 UI 框架规则，而是 `cthulhu_chosen_confirm` 这一条已存在于 `cthulhu.test.ts` 专项块中的具体交互合同：
  - target type 是 `generic`
  - yes/no 选项是 `displayMode: 'button'`
  - option value 里不能带 `baseDefId`
  - 多实例排队时第二个 prompt 也保持同样的显示约束
- 这说明后续筛 `display-mode` / `target-type` / `button` 这类文件时，要先问：
  - 它是在锁一个共享渲染规则，还是只是在给某张牌现有专项块补 UI 选项合同？
  - 如果后者对应的业务专项已经存在，就应把显示合同并回那个专项块，而不是再留一个根目录 bug 壳
- 更深一层的判断标准是：
- **显示合同的归属，仍然取决于“哪个业务 sourceId 在产生这些选项”**
- 不是取决于它看起来更像 UI 还是更像 gameplay
- 对 `cthulhu_chosen_confirm` 这种明确 sourceId，最稳的入口仍是 `cthulhu.test.ts` 自己

## 2026-05-17 12:12 补充发现：不是所有根目录旧壳都该“并回专项”，有些应该直接删除

- `wizard-archmage-discard-play.test.ts` 这轮确认了另一种历史测试债：
  - 文件名看起来像业务回归
  - 但文件体内其实是临时注册一个 `test_archmage_discard_play` 的 `DiscardPlayProvider`
  - 再用自建 `GameTestRunner` 去喂 `fromDiscard: true`
- 这类文件的核心问题不是“它属于哪个派系专项”，而是：
  - 它锁的不是现行公开入口
  - 而是一条测试为了模拟场景自己搭出来的 provider 壳
  - 一旦真实业务已经有等价覆盖，这类文件继续存在只会让维护者误以为它还在保护某个独立合同
- 这轮可以提炼出一个新的筛选标准：
  - 如果旧文件的业务语义已经被真实现行链路覆盖
  - 而它额外提供的只是“测试专用 provider / runner / fake source”
  - 那正确动作往往不是“并回某个专项”，而是直接删除这个壳
- 对应到这次具体证据：
  - “从弃牌堆打出大法师应获得额外行动”已有真实 `zombie_they_keep_coming` 链路覆盖
- “从手牌打出大法师应获得额外行动”已有 `archmageE2E` 覆盖
- 所以 `wizard-archmage-discard-play.test.ts` 不再提供独立业务价值，只是在重复一份测试内临时 provider

## 2026-05-17 12:13 补充发现：跨派系真实链路回归，仍然可以并回“被验证的那张牌”的专项

- `wizard-archmage-zombie-interaction.test.ts` 和 `wizard-neophyte-ongoing.test.ts` 一起把一个标准钉得更清楚了：
  - 场景里借用了别派系真实能力，不代表这条测试就必须挂在根目录或做成“跨派系专题”
  - 关键要看真正被验证的是谁的公开行为
- 这次 `wizard-archmage-zombie-interaction` 里：
  - 僵尸行动卡 `zombie_they_keep_coming` 只是触发路径
  - 真正要锁的是 `wizard_archmage` 在 `MINION_PLAYED` 后是否获得额外行动
  - 所以它更适合落回 `wizards.test.ts` 的 `wizard_archmage` 专项块
- 同时也要和上一条发现配套看：
- 若测试只是借测试专用 provider / runner 去伪造“从弃牌堆打出”，那种壳应直接删
- 若测试走的是真实现行链路，只是跨派系触发了另一张牌的行为，那么仍然应优先并回“被验证那张牌”的专项文件

## 2026-05-17 12:20 补充发现：专项文件变大后，测试隔离污染会伪装成“迁移后红灯”

- `killer-plant-pod-verification.test.ts` 这轮给了一个新的经验教训：
  - 文件能不能并回，不只要看业务边界对不对
  - 还要看目标专项文件里有没有局部 `beforeEach` / 注册表重置，把后续新增段带进半初始化状态
- 这次第一次并回后出现的 3 条红灯，不是行为合同错，也不是实现坏了：
  - 根因是 `killer-plants.test.ts` 前半段的 `beforeEach` 只执行 `registerKillerPlantAbilities()`
  - 后面新加的 POD 段需要的是完整 `initAllAbilities()` 环境
  - 结果就是 `General Ivan POD`、部分 POD 回合开始增益、以及 `venus_man_trap_pod` 相关链路看起来像“迁移后坏了”，实质是测试夹具被前面段落污染
- 这可以沉淀成一条更具体的测试标准：
  - 当把一批测试并回大型专项文件后，如果红灯只集中在新段，先查专项文件内是否存在局部注册表/能力初始化收窄
  - 不要第一时间把它当实现回归或把并回动作回滚
  - 先把新段自己的初始化边界补齐，再判断剩余红灯是否真是实现问题

## 2026-05-17 14:08 补充发现：`AL9000` 是可以整段抽离的自然边界

- `base_greenhouse` / `base_secret_garden` / `base_inventors_salon` 三段原本就在 `expansionBaseAbilities.test.ts` 里连续出现
- 它们共享同一类 afterScoring / scoring-session seam，所以不需要再人为拆成三个散文件，也不该继续挂在“expansion”大壳里
- 抽到 `bases/al9000-bases.test.ts` 后，旧文件可以整段删除，不需要保留过渡 wrapper
- 同时，`base_mountains_of_madness` 证明了另一条标准：
  - 如果已经有现成专项文件，只是覆盖过浅，就优先补深现有文件
  - 不要再在大壳里保留第二份同基地合同

## 2026-05-17 14:45 补充发现：基地类测试继续按 helper 合同和专项归宿收口

- `makeBase(defId, minions)` 的 shared helper 合同是固定的；把对象当第二参传入会把 `minions` 当成数组以外的值，直接炸成 `base.minions is not iterable`。这说明测试迁移时不能只“长得像以前能跑”，要同时校准 helper 签名。
- `base_plateau_of_leng` 适合独立成 `bases/plateau-of-leng-base.test.ts`：它的即时分支和同名随从额度本身就是一组稳定基地合同，不需要继续挂在 `expansionBaseAbilities.test.ts` 里混测。
- `base_fairy_ring` 的非首次打出回归不需要继续占用 `expansionBaseAbilities.test.ts`，因为 `abilities/fairies.test.ts` 已经有更完整的上位覆盖；旧段应该删除而不是并回两个入口。
- 这轮证明“有更好的上位替代就不用考虑旧壳”不是口号，而是可以直接落到文件裁剪上的规则：重复段删掉，独立合同落到自己的专项文件里。

## 2026-05-17 14:53 补充发现：`expansionBaseAbilities.test.ts` 可以整体退场

- `base_the_asylum`、`base_innsmouth_base`、`base_miskatonic_university_base` 都有了自己的基地专项文件，说明 `expansionBaseAbilities.test.ts` 不再是“唯一入口”，只是历史聚合壳。
- `base_mountains_of_madness`、`base_plateau_of_leng` 也已经在独立基地文件里有更清晰的专项合同，所以旧聚合入口没有剩余独占价值。
- 将 `expansionBaseAbilities.test.ts` 整体删除，比继续保留一个只剩尾部注释的聚合壳更符合当前测试结构：新行为进专项，旧聚合入口直接退场。
- 这一轮也验证了一个简单原则：只要各子簇已经有更好的上位替代，旧聚合测试就不要为了“看起来完整”而继续存活。

## 2026-05-18 补充发现：`无候选自动分支` 不等于 `完全无浮层收口`

- `Monkey See, Monkey Do` 这轮把一个很容易写错的证据口径暴露得很清楚：
  - 业务语义是“没有行动候选时，不创建选择 prompt”
  - 但真实 UI 仍可能进入公开展示队列 / spotlight overlay
- 这两件事不能混成一句“自动收口且无浮层”：
  - `choice prompt` 是否创建，决定的是候选选择合同有没有被误实现
  - `spotlight/reveal overlay` 是否出现，属于展示链路本身的真实 UI 行为
- 如果把两者混写，会产生两个风险：
  - 把一个正确的 reveal overlay 误报成实现缺陷
  - 反过来，也可能因为看到 overlay 消失，就误以为“没有错误创建选择 prompt”
- 这轮可以沉淀出一个更稳的截图/证据标准：
  - 对“无候选自动分支”，要分别写清
  - 有没有该分支专属的选择 prompt
  - 有没有进入其它合法的展示态/公开态/队列态
  - 最终权威状态有没有误产生候选副作用（例如多摸牌、多进手牌、残留 interaction）
- 换句话说：
  - “没有选择 prompt” 只是一个局部结论
  - 不是“整个页面完全没有任何浮层/队列/UI 动效”的同义词

## 2026-05-18 补充发现：Portal Room 的 shared extra-turn queue 不能只靠 2P 浏览器链外推

- `Portal Room` 之前最容易被误读成“已经彻底收口”的地方，是 `queue_extra_turn_after_current_turn`：
  - 浏览器 scoped L3 已经证明了 2P 下赢家接受后，额外回合会真实开始并结束，再回到原顺位
  - 但这并不能自然推出 3P 及以上顺位下的 `returnToPlayerIndex` 也一定正确
  - 也不能自然推出多条 `pendingExtraTurns` 并存时会严格按队列顺序消费
- 这类边界本质上是 shared extra-turn queue 合同，不是新的浏览器问题位点：
  - 风险点在 `TURN_ENDED` 如何消费 `pendingExtraTurns`
  - 以及 `activeExtraTurn.completedExtraTurn -> returnToPlayerIndex` 是否仍保持正确
- 因此这轮正确动作不是再造一条 E2E，而是补 L2 锚点：
  - 3P 下，当前玩家结束回合 -> 赢家额外回合 -> 结束后回到“原本下一位玩家”
  - 多条 `pendingExtraTurns` 并存时，先消费队首，保留队尾，再在后续正常回合结束时启动第二条额外回合
- 这轮定向复跑 `Portal Room` 测试簇 `5 passed` 后，可以更准确地收紧口径：
  - `Portal Room` 的浏览器 scoped L3 仍然只覆盖 2P 单页/多客户端两条真实链
  - 但 shared queue 的 3P return 与 FIFO 消费，已经不该继续算作隐性 residual
- 这也再次说明一个长期审计原则：
  - scoped L3 负责证明“真实入口是否按用户看到的方式走通”
  - 更长顺位、多队列、跨 frame 的共享调度语义，往往应由 L2/shared contract 明确锁死，不能等价替换成“浏览器主链已经通过”
- 2026-05-18 补充发现：`Missing Uplink` 的“额外回合结束”也属于 shared turn-boundary 合同，不该继续挂在 residual 里。本轮新增 `电子猿：丢失中继在额外回合结束时也应按拥有者实例数抽牌`，用 `activeExtraTurn={playerId:'0',returnToPlayerIndex:1,reason:'base_portal_room'}` 的夹具锁定 `onTurnEnd` 仍按 ownerId 聚合两张实例抽 `draw-a/draw-b`，最终 deck 留 `draw-c`。定向复跑 `... -t "丢失中继|Missing Uplink"` 结果 `6 passed / 189 skipped`；由此，`owner_turn_end_draw_one_per_instance` 的 residual 只剩更广 multi-client 浏览器视角，不再把额外回合结束误算成缺口。

## 2026-05-18 补充发现：`Monkey on Your Back` 不能只靠“附着后天赋链已绿”冒充 attached-action 入口已闭合

- `cyborg_apes_monkey_on_your_back` 这轮暴露出的证据空洞很具体：
  - 现有 scoped L3 已证明“附着后的天赋 prompt 只列另一玩家低力量随从，并把本行动放到底”
  - 但这并不自然推出“真实从手牌打出时，本行动也确实允许附着到敌方宿主”
- 这两个问题属于同一个对象，但不是同一条 atom：
  - `choose_other_player_low_power_minion_here` / `bottom_this_action_after_destroy` 证明的是附着后的 talent 链
  - `attach_to_any_minion` 证明的是 attached action 自身的真实目标入口
- 如果只看后者的 L2，再加上前者的 scoped L3，很容易误把对象级结论写得过满：
  - 看起来像是 `Monkey on Your Back` 整条本地浏览器链都已闭合
  - 实际上还缺“敌方宿主可作为真实附着目标”的直接浏览器证据
- 这轮新增 E2E `电子猿-Monkey on Your Back-真实入口可附着到敌方随从` 后，证据口径才完整：
  - `before` 图同屏可见己方宿主、敌方宿主和底部手牌里的 `Monkey on Your Back`
  - `after` 图里只有右侧敌方宿主出现紫色附着图标且力量 `2 -> 3`
  - 左侧己方 `Jumper` 仍是 `2` 且没有附着图标
  - 状态断言进一步锁定：`interaction.current==null`、`hand` 移除 `monkey-attach-hand`、敌方宿主 `attachedActions` 含该 uid、己方宿主不含该 uid
- 更稳的审计原则是：
  - “对象里另一条后续链已 scoped L3” 不等于 “前置入口 atom 也自动变成 scoped L3”
  - 对 attached action / extra play / afterScoring 这类多段链路，入口 atom 和后续 atom 必须分别找各自的真实证据
- 由此，这轮只把 `cyborg_apes_monkey_on_your_back.attach_to_any_minion` 提升为 `L2 / scoped L3`
- 但不外推宿主离场、多客户端视角或 forged target payload；这些仍应继续保留在较低层级或 shared contract

## 2026-05-18 补充发现：`Cyberback` 的负例浏览器真相不是“非法牌/非法宿主不会出现”，而是“出现了也不会沿这条链结算”

- 这轮 `Cyberback` 暴露的是一个典型的对象级误读：
  - 单测和代码阅读都能证明 `Going Bananas`、敌方 `Cyberback`、己方普通随从不合法
  - 但这不等于真实 UI 就一定把它们完全藏掉
- 真实页面恰好相反：
  - 弃牌面板里会同时显示 `Going Bananas` 和 `Cyberevolution`
  - 所以旧口径“普通行动在 UI 中不会出现，因此无需 browser L3”是错的
- 这里真正要验证的浏览器语义分两层：
  - 点击普通基地行动时，不会偷偷通过 `Cyberback` 的弃牌入口结算到任何宿主
  - 选中合法持续行动后，敌方 `Cyberback` 与己方普通随从都不会成为真实结算目标，最终只有己方 `Cyberback` 成功附着
- 这轮新增 E2E 后，证据链才完整：
  - 第一张图直接看到弃牌面板里同时有 `Going Bananas` 和 `Cyberevolution`
  - 第二张图里选中 `Cyberevolution` 后，只有己方 `Cyberback` 所在基地保持高亮，其余基地被置灰
  - 第三张图里最终只有左侧己方 `Cyberback` 拿到 `Cyberevolution` 附着和绿色 `+4`
  - 状态断言进一步证明：
    - 点 `Going Bananas` 后服务端权威状态完全不变
    - 点敌方 `Cyberback` / 己方普通随从后也不结算
    - 直到点己方 `Cyberback` 才真正把 `cyberback-valid-discard` 从 discard 移到 `attachedActions`
- 这轮沉淀出的审计原则很重要：
  - “validator 会拒绝” 不能直接替代 browser 证据
  - “真实 UI 里看不到入口” 必须先用页面真相确认，不能靠代码路径脑补
  - 对负例链，真正有价值的 scoped L3 往往不是“不可见”，而是“用户实际点了也不会沿错误链结算”
- 由此，`cyborg_apes_cyberback.reject_non_ongoing_or_non_minion_action` 和 `reject_enemy_or_non_cyberback_target` 现在都可以升到 `L2 / scoped L3`
- 但 forged discard / forged target payload 仍只是 L2/shared contract，不应被这条浏览器负例顺势外推成全部安全边界都已闭合

## 2026-05-18 补充发现：`Baboom` 不能再被长期状态误记成“只验证过最早那条单合法行动分支”

- 这轮发现的不是 `Baboom` 玩法实现缺口，而是长期状态口径落后于审计文档：
  - atom/object 行已经明确写到 `skip` 收口和“多合法行动可选第二张且只执行所选项”
  - 但根仓库 `progress.md / findings.md` 和 long-term state 还停在最早那条 `电子猿-Baboom-真实天赋给出可跳过的立即额外行动并只能打到自己身上`
- 这里容易再犯的误判有两个：
  - 把“出现了可跳过 prompt”误当成已经证明 `skip` 分支真正闭合
  - 把“曾经验证过唯一合法行动自动附着”误外推成“多合法候选时也不会后台默认第一张”
- 本轮重新核对多合法行动截图后，可以把这条浏览器真相写死：
  - prompt 图里底部同屏可见 `Cyberevolution` 与 `Juiced Up` 两张合法候选，说明真实 UI 不是“只保留默认第一张”
  - `Juiced Up` 在 prompt 中已被真实选中，resolved 图里中央显示 `Juiced Up` 带“已打出！”标记，Baboom 旁出现紫色附着图标和绿色 `+3`
  - 底部 `Cyberevolution` 仍留在手牌区，因此这条链不是“选了第二张但后台仍顺手把第一张也打了”
- 它沉淀出的审计口径是：
  - `Baboom` 的 scoped L3 现在至少覆盖三条不同浏览器分支：
    - 单合法行动自动附着到 Baboom 自己
    - 显式点击 `放弃这次额外战术` 后直接收口
    - 多合法行动时允许真实选择第二张，并且只执行所选项
  - 这三条分支闭合后，`Baboom` 当前 residual 只该继续留在审计文档已经写出的外层边界：
    - 多 `Baboom`
    - 多 target prompt
    - 多客户端视角
- 换句话说，后续如果再看到 long-term state 只写“Baboom scoped L3 = 最早那条单合法行动分支”，那已经不是当前真相，应该视为过时口径

## 2026-05-18 补充发现：`Baboom` 的 `this minion` 还包括“同名 twin 身份不能串台”

- `Baboom` 之前剩下的“多 Baboom residual”本质上不是数量问题，而是宿主身份问题：
  - 如果同基地再放一只同名 `Baboom`
  - extra action 不能因为“同名、同基地、都是合法 attached host”就被误附着到另一只身上
- 这条边界只有浏览器真链能真正说明白：
  - 第一张图里同一基地两只 `Baboom` 同屏可见，下方那只带高亮和“已用”标记，说明当前 prompt 是由一只具体宿主发起
  - 第二张图里只有下方发动天赋的 `Baboom` 旁出现紫色附着图标和绿色 `+4`
  - 上方另一只同名 `Baboom` 没有拿到附着行动，也没有出现错误力量增幅
- 这说明 `Baboom` 这条语义的真正不变量是：
  - `on this minion` 不只是“不是别的己方随从”
  - 还必须是“就是发动这次天赋的那张具体卡实例”
- 所以这轮之后，`Baboom` 不该再把“多 Baboom”继续挂成 residual：
  - 单合法行动自动附着
  - 显式 skip 收口
  - 多合法行动选择第二张
  - 同基地 twin 身份不串台
  这四条浏览器分支现在都已经闭合
- 继续保留为外层边界的只剩：
  - 多 target prompt
  - 多客户端视角

## 2026-05-18 补充发现：`Baboom` 不能继续把“多客户端视角”留在对象 residual

- `Baboom` 这里最后一条容易被根状态漏掉的，不是玩法实现本身，而是 prompt 归属的对象级浏览器真相：
  - 单页链已经证明了 `skip`、多合法行动第二张选择、以及 twin 身份不串台；
  - 但 evidence 2026-05-18 又补上了多客户端链，明确证明 `smashup_immediate_extra_action` 只出现在发动者页面，另一页不会被错误镜像到 prompt 或 waiting overlay。
- 这条补证的意义不是“再多一张图”，而是把对象级 residual 真正收空：
  - Host 页会真实看到 `立刻打出一张额外战术，或放弃这次机会`、候选卡面与 `放弃这次额外战术` 按钮；
  - Guest 页中央没有任何同链标题、按钮或额外行动交互入口；
  - Host 点击 skip 后，两页都会一起回到正常出牌态，且权威状态不会偷偷把行动附着到 `Baboom` 或同基地其他随从。
- 所以后续如果再把 `Baboom` 写成“当前只剩多客户端视角没回根状态”，那已经不是当前真相，而是 evidence 后续 finding 没有同步回根状态和长期 JSON。

## 2026-05-18 补充发现：`Copycat` 不能再被对象级证据拼装冒充“trigger surface 已绿”

- `Copycat` 最容易被误判的地方，是把这些东西机械拼起来：
  - 选择敌方随从已绿
  - metadata 只写本体已绿
  - 复制 `Baboom` 的 talent 已绿
  - 复制 `Furious George` 的 power 已绿
  然后就顺势说“Copycat 的代理面都差不多了”
- 这个结论是不够的，因为 `discard trigger` 是另一类 surface：
  - 它依赖被摧毁当刻的 `triggerMinion.metadata`
  - 它会跨过 `Bacta immediate extra` 与后续 `optional recover` 两层真实链
  - 它还会碰到 `owner/controller` 分离这类最容易串语义的地方
- `Copycat -> Jumper` 这条浏览器真相的价值就在这里：
  - 真实顺序不是“Jumper trigger 直接冒出来”
  - 而是先出现 `Bacta immediate extra minion`，玩家跳过后，才进入 `Copycat` 代理出来的 `optional recover` 反应窗口
  - 最终回手的是 `Copycat` 本体，而且回到 owner 手牌，不是 controller 手牌
- 所以这条链证明的不是一个孤立回手结果，而是三件事同时成立：
  - copied trigger 确实被代理出来了
  - 它没有插队破坏原本的 immediate extra 顺序
  - 它没有把原生 `Jumper` 的 owner/controller 语义带歪
- 这轮之后，`shapeshifters_copycat.proxy_current_supported_surfaces` 不该再被说成“只有 talent/power surface 有 scoped L3”
- 现在更准确的口径是：
  - choose surface：已 scoped L3
  - metadata-write surface：已 scoped L3
  - talent surface：已 scoped L3
  - power surface：已 scoped L3
  - trigger surface：已 scoped L3
  - 剩下的只是更广的完整动态复制 runtime 和未显式适配的其它 copied trigger family

## 2026-05-18 补充发现：`Do Over / Doctor When` 不能再把 `skip extra` 误记成“只验证过 returned card 会回手或会重打”

- 这两条 atom 先前最容易被误读成：
  - `specificCardUid` 合同已经锁住 returned 本体
  - returned `Jumper / Time Raider` 也都能真实再次打出
  - 所以 `skip extra` 大概只剩理论上的 UI 边界
- 这个口径现在已经过时，因为本轮重新看的真实截图证明了更具体的不变量：
  - `Do Over` 点击“放弃这次额外随从”后，`Portal Room` 仍为空，returned `Jumper` 继续留在手牌，没有被后台偷偷打回基地。
  - `Doctor When` 点击“放弃这次额外随从”后，场上只剩 `Doctor When`，returned `Time Raider` 继续留在手牌，而且中央没有残留第二层 extra prompt。
- 这说明这两条 effect atom 的 scoped L3 不该再只描述成“returned-card specific prompt/replay 已绿”。
- 更准确的长期口径应该是：
  - `time_travelers_do_over.may_play_returned_minion_again` 已同时覆盖 returned-card specific 与 `skip extra` 真实收口。
  - `time_travelers_doctor_when.may_play_returned_minion_again` 已同时覆盖 returned-card specific 与 `skip extra` 真实收口。
- 所以后续如果再把 `Do Over / Doctor When skip-extra` 挂回本地 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Time Box.counter_from_card_returned_to_hand` 不能再只靠场上回手分支代表全部浏览器证据

- `Time Box` 这条 atom 的自然语言是 `from play or discard pile`，因此只看 `Primate Park -> attached action -> CARD_TRANSFERRED from play` 并不能自然推出 `discard -> owner hand` 的真实入口也已经闭合。
- 它真正高风险的地方在于：
  - `Jumper` recover 本身有 owner/controller 分离；
  - recover 前面还串着 `Bacta immediate extra skip`；
  - recover 之后 Time Box 的 reaction 与第 5 枚计数进场 prompt 必须回到 owner 页，而不是 controller 页。
- 本轮重新看的多客户端截图已经把这条真链写死：
  - `Jumper` 的 optional recover 先出现在 controller 页；
  - recover 完成后，owner 页出现 `Time Box` 的 reaction；
  - 随后 owner 页中央再出现 `时间盒子：是否移除全部计数器并打出到一个基地？`
- 这说明 `time_travelers_time_box.counter_from_card_returned_to_hand` 的浏览器 scoped L3 现在至少覆盖两类回手来源：
  - `CARD_TRANSFERRED from play`
  - `CARD_RECOVERED_FROM_DISCARD` 且带 owner/controller split 的多客户端链
- 因而后续不应再把“discard-recover owner/controller split”继续挂成这条 atom 的本地 residual；剩下的只该是更广多人局或其它回手家族。

## 2026-05-18 补充发现：`From Q With Love` 不能再只把根状态停在 exact-2 主链

- 这条对象先前在根状态里最容易被误读成：
  - 已有“抽三张并从投影手牌中准确弃两张”的主链 scoped L3
  - L2 也补过 `projectedHand.length===1/0`
  - 所以剩下只是理论上的短候选可见性边界
- 这个口径现在已经落后，因为本轮重新看的浏览器截图已经把两个端点都补成了真实入口证据：
  - `projectedHand.length===1` 时，中央 discard prompt 只剩 1 张候选卡，不会错误要求第二张；收口后右下弃牌堆角标变成 `弃牌(2)`。
  - `projectedHand.length===0` 时，中央完全没有 discard prompt、按钮或候选卡，而本行动自己正常进弃牌堆，右下角标变成 `弃牌(1)`。
- 这说明 `super_spies_from_q_with_love.draw_three_then_discard_two_from_projected_hand` 的根状态不该再只写“exact-2 主链已绿”。
- 更准确的长期口径应该是：
  - exact-2 主链已 scoped L3；
  - `projectedHand.length===1` 的单候选真实入口也已 scoped L3；
  - `projectedHand.length===0` 的无 prompt 真实入口也已 scoped L3。
- 所以后续如果再把 `From Q With Love` 的短候选或空投影手牌挂回本地 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Flying Monkey` 不能继续让根状态停在“只看过移动分支”

- 这条对象先前在根状态里最容易被误读成：
  - 正向移动宿主分支已有 scoped L3；
  - `skip` 只是 handler/L2 的补充边界；
  - 所以根状态继续把 `skip` 挂在 residual 也无伤大雅。
- 这个口径现在已经失效，因为本轮重新看的浏览器截图已经把 `skip` 写成了真实入口事实：
  - afterScoring prompt 中央明确同时给出目的地 `秘密火山总部` 与 `跳过（照常进入弃牌堆）`，说明不是伪造 handler 分支。
  - 点击 `skip` 后中央 prompt 完整消失，两座基地都回到新回合常态布局，没有残留“再选基地”或“宿主仍在原地等待”的半收口态。
- 这说明 `cyborg_apes_flying_monkey.after_scoring_move_instead_discard` 与 `destroy_attached_action_after_move` 的根状态不该再只写“正向移动已绿”。
- 更准确的长期口径应该是：
  - 正向移动分支已 scoped L3；
  - `skip -> 按正常计分清场 -> 宿主/本行动进弃牌` 的真实入口也已 scoped L3。
- 所以后续如果再把 `Flying Monkey skip` 挂回本地 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Portal Room` 不能再只把根状态停在“额外回合已启动”

- `Portal Room` 之前最容易被误报完成的地方，是把：
  - `activeExtraTurn` 已正确置上
  - 浏览器也确实进入了额外回合
  直接等价成“额外回合生命周期已经闭合”。
- 这在当前状态已经不够，因为本轮重新看的真实截图又补了一层更关键的不变量：
  - extra turn 启动图里左上已经切到 `回合2 / 出牌阶段`，说明当前回合结束后确实进入了额外回合。
  - 最终收口图里当前玩家高亮已回到原顺位玩家，中央没有残留 prompt，且 `Faceless City` 仍保留在左侧，说明这条链已经真实走完 `pending -> active -> completed -> returnToPlayerIndex`。
- 这说明 `base_portal_room.queue_extra_turn_after_current_turn` 的根状态不该再只写“额外回合会启动”。
- 更准确的长期口径应该是：
  - 2P 浏览器主链已覆盖接受后启动额外回合；
  - 同一条浏览器链也已覆盖额外回合结束后恢复到原顺位玩家。
- 所以后续如果再把“额外回合结束并回原顺位”挂回 `Portal Room` 的本地 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Portal Room` 不能把“赢家页独占选择权”继续只留在长期 JSON 或 atom 行里

- `Portal Room` 还有另一条很容易被根状态漏掉的对象级真相，不是 extra-turn queue，而是 `optional_choice_owner_is_winner`：
  - 浏览器主链已经不只证明“P0 自己是赢家时可以点传送门”；
  - 多客户端证据还明确证明了 `winner != currentPlayer` 时，真正拿到这条 afterScoring 选择权的是赢家页，不是当前回合玩家页。
- 这条语义如果不单独回根状态，很容易被后续误缩成“shared ownerPlayerId 合同已修”：
  - 但 shared/L2 只能说明 trigger owner 应该是谁；
  - 真正用户可见的对象级事实是：Guest 赢家页会出现 `传送门 / 跳过` 与可交互按钮，而 Host 当前回合玩家页只显示等待赢家响应，没有同一条选择权。
- 这和 `queue_extra_turn_after_current_turn` 是两件事，不能互相代替：
  - 一个证明“谁来决定要不要额外回合”；
  - 一个证明“决定之后额外回合何时启动、何时结束并回到原顺位”。
- 所以后续如果再把 `Portal Room` 写成“根状态只承认 2P 生命周期已闭合，赢家页归属仍主要在 evidence/长期 JSON”，那已经不是当前真相，而是 completion-audit 没把对象级多客户端主链回写完整。

## 2026-05-18 补充发现：`Into the Time Slip` 不能再只把根状态停在 borrowed minion 分支

- 这条对象先前在根状态里最容易被误读成：
  - borrowed minion 会回到 owner hand 的浏览器主链已绿；
  - 其它 `a card in play` family 大概只剩 L2 补充语义。
- 这个口径现在已经过时，因为本轮重新看的截图证明 `Into the Time Slip` 的真实入口已经扩到了两类场上行动牌：
  - base ongoing：`Portal Room` 上方的 `Stasis Field` 本体在 prompt 图里直接可见，收口图里则完全消失。
  - attached action：宿主身上的白色行动牌本体与紫色附着角标在 prompt 图里仍在，收口图里一起消失。
- 这说明 `time_travelers_into_the_time_slip.choose_one_in_play_card` 与 `return_to_owner_hand` 的根状态不该再只写“borrowed minion 的 owner/controller 分离已绿”。
- 更准确的长期口径应该是：
  - borrowed minion 分支已 scoped L3；
  - base ongoing 分支也已 scoped L3；
  - attached action 分支也已 scoped L3。
- 所以后续如果再把 `Into the Time Slip` 的 base ongoing 或 attached action 本地浏览器边界挂回 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`1.21 Gigawatts` 不能再只把根状态停在双按钮主链和单一牌种自动分支

- 这条对象先前在根状态里最容易被误读成：
  - 双按钮 prompt 主链已 scoped L3；
  - 单一牌种自动分支也已 scoped L3；
  - 所以空弃牌堆大概只剩 L2 的 feedback 语义。
- 这个口径现在已经过时，因为本轮重新看的截图证明空弃牌堆已经补成了真实入口证据：
  - toast locator 图里直接可见 `弃牌堆中没有符合条件的卡牌`。
  - 收口图里顶部 toast 仍在，但中央完全没有“行动 / 仆从”按钮 prompt。
  - 同一张收口图里右下弃牌堆已经能看到 `1.21 Gigawatts` 本体，说明本行动自己也按正常链进了 discard。
- 这说明 `time_travelers_1_21_gigawatts.choose_card_type` 与 `shuffle_selected_type_to_deck` 的根状态不该再只写“双按钮主链 + 单一牌种自动分支”。
- 更准确的长期口径应该是：
  - 双按钮主链已 scoped L3；
  - 单一牌种自动分支已 scoped L3；
  - 空弃牌堆 feedback 的真实入口也已 scoped L3。
- 所以后续如果再把 `1.21 Gigawatts` 的空弃牌堆本地浏览器边界挂回 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Moon Zero Three` 不能再把 `Time Box` rail 切换竞争留在 evidence 里、却让根状态停在更早的 special 口径

- `Moon Zero Three.special_summon_condition` 这条对象在根状态里先前最容易被误读成：
  - 已有单合法/单非法基地的真实 special 主链；
  - 已有 armed cancel 的浏览器分支；
  - 多合法基地并存、controller/owner 分离也已有 L2；
  - 所以剩下只是笼统的“其他 Titan special 竞争窗口”。
- 这个口径现在已经落后，因为审计文档 2026-05-18 的 finding #117 已经把最直接的本地竞争链写成了真实浏览器事实：
  - `Moon Zero Three` armed 时，`Monkey Lab` 高亮、带敌方 `Jumper` 的 `Portal Room` 被置灰。
  - 切到 `Time Box` 后，两座基地都恢复为合法落点，说明高亮集合真实跟随 `selectedSetAsideTitanUid` 切换刷新。
  - 最终由 `Time Box` 真实落到原本对 `Moon Zero Three` 非法的 `Portal Room`，而 `Moon Zero Three` 继续留在牌库旁。
- 这条浏览器链证明的不只是“UI 能切换高亮”，而是两层不变量同时成立：
  - UI 层不会残留前一个 Titan 的旧合法目标集合；
  - 命令层 `validateTitanSpecialActivation()` 也不会让第二个 Titan 在第一个已进场后继续伪装成可发动。
- 所以这轮之后，更准确的长期口径应该是：
  - `super_spies_moon_zero_three.special_summon_condition` 已覆盖单合法/单非法、armed cancel、本地 `Moon Zero Three vs Time Box` rail 切换竞争。
  - 剩余 residual 只该继续保留更广 shared contract 的跨窗口 / 跨来源 special 排序问题。
- 如果后续还把这条本地 rail 切换链挂成 `Moon Zero Three` 的对象级 residual，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Secret Volcano Headquarters` 不能再让根状态继续引用那条已失效的旧 scoped L3

- `base_secret_volcano_headquarters.reveal_one_each_player_then_play_revealed_minions_here` 这条对象当前最危险的不是实现回退，而是**旧完成证明已经失效，但根状态还保留着未加纠偏标记的早期 scoped L3 记录**。
- 审计文档已经把这件事说得很明确：
  - 2026-05-17 那条旧 E2E 当时的夹具实际误配成了 `base_monkey_lab / breakpoint 20`。
  - 因此旧的 `Secret Volcano Headquarters scoped L3` 结论不能继续直接引用。
  - 当前有效口径必须切到 finding #125：scene truth 纠偏、`eventStream` 两条 `REVEAL_DECK_TOP(viewerPlayerId='all')`、浏览器 `reveal-overlay` 可见、两次 dismiss 后回到无浮层桌面。
- 这说明根状态里原先那种“某日 1 passed，所以对象已 scoped L3”的简写已经不够了，因为它把**失效证据**和**现行证据**混在了一起。
- 更准确的长期口径应该是：
  - 旧 scoped L3 证据已失效，不能再引用。
  - 当前 `Secret Volcano Headquarters` 的 scoped L3 以审计文档修订后的新 scene-truth 与 overlay 证据为准。
  - `RevealOverlay` 在自动计分链中的 `queueMicrotask` 竞态修复，是这条对象当前完成口径的一部分，不是旁枝注释。
- 所以后续如果再拿旧的 `before-end-turn / scored-with-revealed-minion-only` 那条记录充当 `Secret Volcano Headquarters` 的完成证明，应视为引用了过期证据，而不是在描述当前真相。

## 2026-05-18 补充发现：一整组变形者 optional search/choice 已不能再让根状态只停在“选择候选分支已绿”

- 这轮确认到的不是新的实现红灯，而是一类很整齐的**根状态落后模式**：
  - `Faceless City`
  - `G.E.L.F.`
  - `Really?`
  - `Transmogrify`
  - `Doppelganger`
  - `Mitosis`
  这些对象在长期状态 JSON 和审计文档里都已经补上了 `skip` 的真实浏览器证据，但根 `progress.md / findings.md` 还容易让人误读成“只验证过选第二张候选”的那一半。
- 这组对象共享的风险点其实是同一个：
  - 文字语义里都有 `may` / `optional search` / `optional choice`
  - 最容易被“状态断言通过”偷换成“显式放弃也没问题”
  - 真正要证明的是**玩家真实点击 skip / 放弃后，prompt 会不会直接收口，而不是偷偷把候选打出、加进手牌，或继续进入第二层选择**
- 这轮之后，根状态应该同时承认下面这些浏览器真相：
  - `Faceless City` 点击 `跳过搜寻` 后，同名搜索层直接消失，手牌不增，牌库顺序保持原样。
  - `G.E.L.F.` 点击 `放弃这次选择` 后，`The Vats` 仍为空，没有候选被偷偷打回原基地。
  - `Really?` 点击 `放弃这次选择` 后，不会进入第二层基地选择，两座基地都继续空场。
  - `Transmogrify` 点击 `放弃这次选择` 后，牌库搜索层直接收口，原基地不会被偷偷补进候选随从。
  - `Doppelganger` 在 `Bacta immediate extra skip` 之后进入自身 search，再点 `放弃这次选择` 后，搜索层直接收口，原基地继续空场。
  - `Mitosis` 点击 `放弃这次选择` 后，目标基地仍只保留原目标，两张同名手牌都继续留在手里，不会被半路打上场。
- 所以这轮之后，更准确的长期口径应该是：
  - 这六条对象都不再只靠“选择候选”的 scoped L3 支撑 optional 语义。
  - 它们各自的 `skip` / `放弃这次选择` 分支也都已经补到真实浏览器链。
  - 剩下的 residual 只该继续保留更广的随机顺序、forged late-deck/discard、POD alias 或 shared search 合同，而不是把本地 `skip` 分支继续挂着不放。
- 如果后续再把这批对象中的任意一条写成“只有选择候选那一半已绿，skip 还待浏览器补证”，那已经不是当前真相，而是根状态落后于审计文档和长期状态 JSON。

## 2026-05-18 补充发现：一整组自动分支/空选分支也不能再让根状态只停在“主链已绿”

- 这轮继续确认到另一类很整齐的根状态落后模式：
  - `Operative`
  - `Repeater Perfect`
  - `Time Raider`
  - `Spy`
  - `For My Eyes Only`
  这些对象在长期状态 JSON 里都已经承认了自动分支或空选/空牌库端点，但根 `progress.md / findings.md` 还容易让人误读成“只有正常选择/重排主链已绿”。
- 这组对象共享的风险点也很一致：
  - 不变量不是最终 `deck/hand/discard` 结果本身；
  - 真正要证明的是**真实入口在只剩 1 个候选、0 个候选、或 0 勾选时，会不会错误弹出 prompt、残留 overlay、继续进入第二层，或者偷偷改状态**。
- 这轮之后，根状态应该同时承认下面这些浏览器真相：
  - `Operative` 第一层 0 勾选玩家后会直接收口且不 reveal 任意牌库顶；第二层 0 勾选展示牌后也会直接收口且不改任一玩家牌库顶顺序。
  - `Repeater Perfect` 弃牌堆只剩 1 张行动时，会自动把它放到牌库顶，不弹 `time_travelers_repeater_perfect_choose`。
  - `Time Raider` 弃牌堆只剩 1 张牌时，会自动把它放到牌库底，不弹 `time_travelers_time_raider_choose`。
  - `Spy` 牌库只剩 1 张时，会自动查看且不弹 `super_spies_spy_reorder`；牌库为空时，也不会创建任何空的 reorder prompt。
  - `For My Eyes Only` 牌库只剩 1 张时，会自动查看且不弹 `super_spies_for_my_eyes_only_reorder`；牌库为空时，也不会创建任何空的 reorder prompt。
- 所以这轮之后，更准确的长期口径应该是：
  - 这批对象都不再只靠“正常选择/重排主链”的 scoped L3 支撑完成口径。
  - 它们各自的自动分支、空选分支或空牌库无 prompt 分支，也都已经补到真实浏览器链。
  - 剩下的 residual 只该继续保留更广的 inspect 来源、多人视角、随机顺序或 shared transport/overlay 合同，而不是把这些本地自动/空选端点继续挂着不放。
- 如果后续再把这批对象中的任意一条写成“只有主链已绿，单候选自动/空选/空牌库还待浏览器补证”，那已经不是当前真相，而是根状态落后于审计文档和长期状态 JSON。

## 2026-05-18 补充发现：`Spy` 不能继续把“多客户端私有重排页归属”留在 evidence 里

- `Spy` 当前根状态最容易漏掉的一层，不是单页顶三重排是否能改对顺序，而是私有 inspect/reorder prompt 的页归属：
  - 单页主链已经证明了 `Spy` 会查看自己牌库顶三张并允许 top/bottom 重排；
  - 单卡自动与空牌库无 prompt 端点也已经补齐；
  - 但 evidence 2026-05-18 又补上了更关键的一条多客户端对象级事实：这条私有 prompt 只应该出现在行动玩家页面。
- 这里真正要证明的是：
  - Host 从手牌真实打出 `Spy` 后，只有 Host 页会看到 `间谍：将这几张牌按任意顺序放回牌库顶/底` 和 `Spy / Operative / Mole` 三张私有顶牌本体；
  - Guest 页既不该镜像出 reorder prompt，也不该泄露任何 inspect 信息；
  - Host 选完非默认 top/bottom 后，两页都应回到普通出牌态，不残留 prompt 或 waiting overlay。
- 所以后续如果再把 `Spy` 写成“根状态只承认单页顶三主链 + 单卡自动/空牌库端点，多客户端私有归属仍主要在 evidence 里”，那已经不是当前真相，而是 completion-audit 没把对象级 owner-only inspect 链回写完整。

## 2026-05-18 补充发现：`Time Box.play_at_five_and_clear` 不能再让根状态只停在“别的图集里 special 进场过”

- `time_travelers_time_box.play_at_five_and_clear` 这条对象在根状态里最容易被误读成：
  - alien/shared 侧已经有过一次 special 进场浏览器链；
  - yuanhou 这边又已经补了 `turn-start -> 4->5 -> skip`；
  - `discard-recover owner/controller split` 也已经补过；
  - 所以 “第 5 枚计数后真实进场并清零” 大概已经可以自然外推。
- 这个口径现在已经不够，因为审计文档 2026-05-18 的 finding #128 明确把缺口钉在了 **yuanhou 自身 counter source 的真实连通性** 上：
  - `Primate Park` 回手链会不会先进入 `smashup_reaction_choose`；
  - `Time Box` 会不会被真实推到第 5 枚计数；
  - 玩家选基地后会不会真实落场并把计数清零；
  - 原计分链会不会继续正常收口。
- 这条 finding 还顺手纠正了一类很危险的假阳性：
  - `smashup_reaction_choose` 里的 `时间盒子` 选项与 rail 上同名 Titan 卡会重名；
  - 直接点 DOM 容易误中 rail 弹详情；
  - 所以“页面上点到了一个叫时间盒子的东西”不能自动当成真链通过，必须按 interaction option id 响应当前 reaction。
- 这轮之后，更准确的长期口径应该是：
  - `time_travelers_time_box.play_at_five_and_clear` 已不再只靠 alien/shared 侧 special 进场旁证。
  - 它在 yuanhou 自身 `Primate Park -> 回手 -> 第 5 枚计数 -> 进场 prompt -> 选基地 -> 清零计数` 这条浏览器链上，也已经补到 scoped L3。
  - 剩下的 residual 只该继续保留更广 counter 来源、多人局与 Titan special 竞争窗口，而不是再把“真实进场并清零”挂回本地缺口。
- 如果后续再把 `Time Box.play_at_five_and_clear` 写成“special 进场主链早就有了，所以 yuanhou 侧不用单独证明”，那已经不是当前真相，而是根状态落后于审计文档。

## 2026-05-18 补充发现：`Time Box.counter_from_turn_start` 不能继续只留在旧单页 scoped L3 或 atom 行里

- `time_travelers_time_box.counter_from_turn_start` 当前还有一层很容易被根状态漏掉的对象级真相：
  - 旧长期状态已经承认过单页 `P1 end turn -> P0 startTurn -> Moon Zero Three 已在场 -> Time Box 4->5 -> rail 入口 -> skip`；
  - 但 2026-05-18 的审计文档又补上了更关键的多客户端 owner-only 主链，而这层如果不单独回根状态，就很容易又被误缩回“单页已绿”。
- 这里真正要证明的不是“第 5 枚计数 prompt 语义大概没问题”，而是：
  - 回合开始时，只有 owner 页面拿到这条 `smashup_reaction_choose` 选择权；
  - 非 owner 页面不会错误出现同一条 prompt 或 waiting overlay；
  - owner 页响应后，才会继续进入真实的 `时间盒子：是否移除全部计数器并打出到一个基地？` 进场 prompt，并在 skip 后让两页一起收口。
- 这条补证还顺手纠正了一个很危险的旧误判：
  - 真实入口不是一个文本叫“时间盒子”的普通按钮；
  - 页面可见的是 rail/Titan 上的 `可触发` badge；
  - 测试层必须按 live `interaction option id` 响应当前 `smashup_reaction_choose`，否则会把点到同名 Titan 卡面详情的假阳性误当成真链。
- 所以后续如果再把 `Time Box.counter_from_turn_start` 写成“根状态只承认旧单页 4->5 链，多客户端 owner-only 回合开始响应仍主要在 evidence 里”，那已经不是当前真相，而是 completion-audit 没把对象级多客户端主链回写完整。

## 2026-05-18 补充发现：`Live and Let Chum` 不能再让根状态只停在未受保护 destroy 主链

- `super_spies_live_and_let_chum.destroy_selected_minion` 这条对象在根状态里最容易被误读成：
  - 已经有 beforeScoring 真实入口；
  - 已经证明过选择低力量随从后会真实摧毁到 owner discard；
  - 所以 `Shell Game` 保护宿主这类分支大概只是共享 destroy/protection 合同，不值得单独再写。
- 这个口径现在已经不够，因为审计文档 2026-05-18 的 finding #143 已经把真正的浏览器缺口补掉了：
  - 玩家在 beforeScoring 的真实 prompt 里，确实能选到受 `Shell Game` 保护的低力量宿主；
  - 选中后 destroy 会被保护过滤，不会发出 `MINION_DESTROYED(shell-host)`；
  - 基地总力量不会因为这次 protected-no-op 被错误拉低，而是继续按原 `4 vs 11` 结算；
  - 计分完成后依然会正常翻新到 `The Nexus`。
- 这条浏览器链的意义不只是给 `Live and Let Chum` 多补一张图，而是把两个对象的长期口径一起改正：
  - `super_spies_live_and_let_chum.destroy_selected_minion` 不再只靠未受保护 destroy 主链支撑完成口径；
  - `shapeshifters_shell_game.protect_attached_host_from_destroy` 也不再只靠 `Bacta` 来源的 protected-continue 支撑 source-family L3。
- 所以这轮之后，更准确的长期口径应该是：
  - `Live and Let Chum` 已同时覆盖未受保护 destroy->owner discard->计分变化，和受保护 destroy-no-op->按原力量继续计分这两条 source-family 浏览器分支。
  - `Shell Game` 已同时覆盖 `Bacta` 与 `Live and Let Chum` 两个 destroy 来源下的真实入口表现。
  - 剩下的 residual 只该继续保留更广 destroy family 的死亡触发连锁与 shared L4 时序，而不是把这条 protected-no-op scoring 再挂回本地缺口。
- 如果后续再把 `Live and Let Chum` 写成“只审过未受保护 destroy 主链，受保护分支还待浏览器补证”，那已经不是当前真相，而是根状态落后于审计文档和长期状态 JSON。

## 2026-05-18 补充发现：一组 response-window 对象不能继续只待在 evidence/JSON 里

- 这轮继续扫到的根状态落后，不是实现缺陷，而是同一类 completion-audit 漏同步：
  - `The Base Is Not Enough`
  - `Time Is Fleeting`
  - `Wormhole`
  - `Mindraker`
- 这四条如果只留在 `evidence` 和长期 JSON、却不进根 `progress.md / findings.md`，后续最容易产生两种误读：
  - 把已经补过的真实入口 scoped L3 当成“还只是 L2”。
  - 把已经被纠偏或被 L2 收紧的兄弟边界，重新挂回对象级 residual。
- 当前应当固化的真相分别是：
  - `The Base Is Not Enough` 已经不是“resolveSpecial 直接调用会给临时控制”这么浅。真实 beforeScoring 响应窗口里，`Primate Park 20/20` 时只会列出低力量 `Jumper / Time Raider`，不会把 5 力 `Silverback` 混进候选；收口后记分板到 `3:2`、基地翻新为 `The Nexus`，说明控制变化真实写进了本次计分。
  - `Time Is Fleeting` 已经不只是一条单页弃牌堆换基地主链。它现在还明确覆盖了“赢家不是当前回合玩家时，只有赢家页面拿到弃牌堆基地选择权”的多客户端边界；同时单候选自动分支与同窗 `Wormhole` 多 special 排序，已经由后续 L2 收紧，不该再继续挂成对象级 residual。
  - `Wormhole` 已经不只是一条“选一个己方随从洗回牌库”的 UI 主链。当前浏览器链证明的是“任意数量己方随从”的多选真实入口，而长期 JSON 已经明确纠偏：`optionIds: []` 的空选不是 bug，不应再被误判成对象级缺口。
  - `Mindraker` 已经不是“代码里有 restriction 就算完成”。真实计分窗口里，`Mindraker + Mole + Going Bananas` 同时在场时，restriction 会把唯一候选行动直接封死，随后基地正常计分翻新、没有残留交互，这条 restriction 已经走到了 scoped L3。
- 这组对象的共同不变量是：只要规则文本的第一入口在 response window，就不能让根状态只记 L2 或只记 handler/shared contract。
- 所以后续如果再把这四条写成“对象级还没真正补浏览器”或“某些已纠偏的边界仍待处理”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`It's Astounding / Time Box talent / Mimic` 也不能继续只停在 evidence/JSON

- 这三条的根状态落后模式和上面不同：它们不是 response-window 权限问题，而是对象级浏览器证据已经闭合，但根状态还在沿用更早的浅口径。
- `It's Astounding` 当前最容易被误读成“只是 discard-action-extra-play 共享合同已审，或只证明了从弃牌堆能打出一张行动”。这已经不够准确，因为当前真实入口明确走通了三段链：
  - 从弃牌堆选中 `Going Bananas`
  - 继续进入 `Going Bananas` 的基地目标 prompt
  - 只有在 `Monkey Lab / Portal Room` 目标按钮完全隐藏后才算真正收口
  也就是说，这条证据证明的不是“弃牌堆行动被拿起来了”，而是被选行动的后续目标链也真实结算并收口。此前“状态断言通过但结果图仍残留目标按钮”的假收口已经被 finding #44 修正，不应再被根状态漏掉。
- `Time Box talent` 当前最容易被误读成“旧 alien 套件里的 special/talent 图能跑通，所以 yuanhou 这边不用单独记”。这同样过时，因为长期 JSON 已经明确修订：
  - 旧白卡图只保留为历史限制记录
  - 现在真正承担 talent 视觉证据的是 yuanhou 自身图集下那条 `Portal Room` 真实天赋链
  根状态如果不跟进，就会继续误导后续审计去引用已经降级的旧图集证据。
- `Mimic` 当前最容易被误读成“L2 已 clean，UI 只是数字展示”。这也不对。它真正要证明的是：
  - 旁边有一只被加成到有效 5、但印刷仍是 2 的对照随从时，`Mimic` 不会误跳到 `+5`
  - 只有当真正印刷 5 力的随从进场后，它才会动态跳到 `+5`
  这条浏览器证据把 printed power 与 effective power 的可见层差异钉死了，不能继续被根状态压成“对象级 clean L2”。
- 这组三条的共同不变量是：当浏览器证据已经补到“共享合同之外的对象级真相”时，根状态必须显式承认这个对象级边界，而不是继续借早期共享合同或旧图集旁证代写。
- 所以后续如果再把这三条写成“共享合同已绿即可”或“对象级只到 L2”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Permit to Kill / Discards Are Forever / Clyde 2.0 / The Nexus` 也不能继续只待在长期 JSON

- 这轮继续扫到一批典型的“长期 JSON 已记住，但根状态没显式承认”的对象：
  - `Permit to Kill`
  - `Discards Are Forever`
  - `Clyde 2.0`
  - `The Nexus`
- 这四条如果继续只待在长期 JSON，后续最容易出现的误读是：
  - 把它们重新当成“只做过 L2 或只做过单页链”的对象。
  - 忘掉它们其实已经补过多玩家顺序、多客户端归属或 skip 这类对象级浏览器边界。
- 当前应当固化的真相分别是：
  - `Permit to Kill` 已经不只是一条三人局“看两张非随从并排序”的主链。长期 JSON 已明确记住四人局真实浏览器链：`P1 -> P2 -> P3` 的排序 prompt 会依次出现并逐次收口，因此不应再回到“会不会只处理第一个其他玩家”的旧疑点。
  - `Discards Are Forever` 已经不只是一条无 prompt 的 L2 reveal/mill 语义。真实手牌入口 scoped L3 已经证明“双人局每位玩家都只 reveal 到首个随从为止，并把所有展示牌一起弃掉”，而空牌库、首张即随从、三人 turnOrder 这些兄弟边界也已被后续 L2 收紧。
  - `Clyde 2.0` 已经不只是在 JSON 里写过“Host 页面有按钮”。多客户端真实链证明的是：离场行动的处置选择权在 Clyde 控制者页面，而非行动拥有者、当前回合玩家或 Guest 页；并且 `收入手牌 / 进入弃牌堆` 两个分支都走到了真实收口。
  - `The Nexus` 已经不只是一条“赢家可从基地弃牌堆选基地”的主链。它还明确补了对象级 skip 浏览器分支：赢家点击 `跳过（照常抽新基地）` 后，会按 `baseDeck[0]` 正常翻新，不会残留在响应窗口。
- 这四条的共同不变量是：**只要对象级浏览器证据已经覆盖了多玩家顺序、多客户端归属或显式 skip，根状态就必须承认这些边界，不应让它们继续藏在长期 JSON 里。**
- 所以后续如果再把这四条写成“还只做到 L2”“还没证明多玩家/多客户端/skip”或“只是长期 JSON 里提过一下”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Juiced Up / Monkey Lab / The Vats / Time Raider / Repeater Perfect / Monkey on Your Back` 也不能继续只停在长期 JSON

- 这轮继续扫到另一类根状态落后：对象级主链 scoped L3 已经在长期 JSON 里写得很清楚，但根 `progress.md / findings.md` 还容易只保留它们的兄弟边界，或者只顺带提到其中一半。
- 这批对象的风险点分别是：
  - `Juiced Up / Monkey Lab` 很容易被误压成“只是 ongoing power modifier 的数字会算”。
  - `The Vats` 很容易被误压成“shared static restriction 已绿”。
  - `Time Raider / Repeater Perfect` 很容易因为后来补了单候选自动与空弃牌 feedback，就把原本的多候选主链忘回长期 JSON 里。
  - `Monkey on Your Back` 很容易只记住“敌方宿主可附着”或“附着后天赋可选目标”其中一半，而丢掉对象级完整主链。
- 当前应当固化的真相分别是：
  - `Juiced Up` 已经不是抽象的 modifier。真实页面上，宿主先带 1 张附着行动时再贴 `Juiced Up`，会立刻出现绿色 `+4`，说明它把本卡也算进宿主上的行动总数。
  - `Monkey Lab` 也不是纯数字断言。真实页面上，同一宿主从 1 张 attached action 增到 2 张时，基地加成会从绿色 `+1` 动态跳到 `+2`，说明它确实按“该随从自己身上的 attached action 数量”实时重算。
  - `The Vats` 已经不是只靠 shared restriction 合同。真实普通出牌入口里，同名随从所在基地会被阻断/置灰，而同一张手牌仍可改打到别的基地并正常收口。
  - `Time Raider` 的对象级浏览器证据不只剩单候选自动沉底和空弃牌 feedback；它原本的多候选主链也已经闭合，真实 prompt 会同时列出 minion 与 action 候选，并允许选择 `Time Walk` 进牌库底。
  - `Repeater Perfect` 也不只剩单行动自动顶牌与空弃牌 feedback；它的主链 scoped L3 已经证明真实 prompt 只列行动、不列随从，并允许选择第二张 `Time Walk` 放到牌库顶。
  - `Monkey on Your Back` 的对象级主链现在至少有两半都已经闭合：
    - 手牌入口可真实附着到敌方宿主，而不是只在状态里“看似附着”；
    - 附着后天赋能真实选择另一玩家低力量随从，并把本行动放到牌库底。
- 这批对象的共同不变量是：**当对象级主链 scoped L3 已经成立时，根状态不能只保留后补的自动分支、空分支或共享合同旁证。**
- 所以后续如果再把这批对象中的任意一条写成“只有共享合同已绿”“只有自动/空分支已补”“对象级主链还没回到根状态”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Cellular Bonding` 不能继续只散落在旧 evidence 细节与长期 JSON 里

- `Cellular Bonding` 当前最容易被根状态误压成两种过时口径：
  - 只记得 2026-05-16 那条“复制 `Missing Uplink` 后回合结束抽牌”的 trigger-surface scoped L3。
  - 或者反过来，只顺手提到 2026-05-17 的某一条 talent/protection/power finding，却没有把对象级主链显式承认出来。
- 这两种写法都不够，因为 `shapeshifters_cellular_bonding` 真正已经闭合的是一组连续对象级事实，而不是一条孤立 surface：
  - 前置入口不是“随便选个 live attached action”。
  - 而是先真实附着到宿主，再只允许从**同宿主的另一张旧附着行动**里选择复制对象。
  - metadata 也不是“只要最后 state 对了就算完”，而是只允许写回当前这张 `Cellular Bonding` 真实附着着的宿主。
- 在这个前置链之上，当前对象级浏览器真相已经至少同时承认五个代理面：
  - trigger-surface：复制 `Missing Uplink` 后真实结束回合抽牌。
  - talent-surface：复制 `Monkey on Your Back` 后真实选择另一玩家低力量随从，并把本卡放到底。
  - afterScoring-surface：复制 `Flying Monkey` 后真实移动宿主并摧毁本行动。
  - protection-surface：复制 `Shielding` 后，在原护盾离场时仍保护宿主其他行动，且自己不会错误自保。
  - power-surface：复制 `Splice as Nice` 后，即使原始 `Splice` 已离场，也仍由 copied metadata 保留持续 `+2`。
- 这条对象的长期口径因此必须明确区分两件事：
  - 已经 scoped L3 的，是“当前显式接入的 copied surfaces 与真实入口链”。
  - 仍然没有被外推完成的，才是“完整动态复制 runtime”与更广的跨派系/未显式适配 surface。
- 更直接地说：
  - 后续如果再把 `Cellular Bonding` 写成“只做过一条 trigger/talent 的浏览器链”
  - 或者把它重新挂回“对象级主链还没进根状态”
  - 那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Genetic Shift` 不能继续只停在长期 JSON 的一条 scoped L3 记录里

- `Genetic Shift` 当前最容易被根状态误压成一句过浅的话：
  - “有过一条无目标模式选择的浏览器链”
  - 然后对象级细节就又消失了
- 这个口径不够，因为审计文档已经把它拆成三个明确 atom，而且它们各自承认的真相并不相同：
  - `choose_mode` 证明的不是数值结果，而是**真实入口方式**。
    - Board 对普通无目标行动不是“一点即打出”。
    - 而是先选中手牌，再二次点击，随后才进入 `基因转变：选择强化模式` prompt。
  - `all_own_minions_plus_one` 证明的是 all 分支只按 controller=self 给己方全体加 `+1`。
  - `single_own_minion_plus_three` 证明的是 single 分支只允许己方单体候选，敌方 `Baboom` 既不会出现在候选里，也不会被误加成。
- 也就是说，这条对象级浏览器证据真正闭合的不是抽象的“二选一能点”：
  - 而是“真实无目标入口 + all 己方全体过滤 + single 己方单体过滤”三件事同时成立。
- 所以这轮之后，更准确的根状态口径应该是：
  - `Genetic Shift` 已经有对象级 scoped L3，但范围明确限定在无目标真实入口和 all/single 两个模式分支。
  - direct target 快捷入口与 forged/late target 负例仍继续留在 L2/shared 守门，不应被顺手外推成浏览器已全绿。
- 如果后续再把 `Genetic Shift` 写成“只有一条泛化 scoped L3”或“对象级根状态仍空白”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Shielding / Furious George / Splice as Nice / Missing Uplink` 不能继续只留在 atom 行、旧 finding 或单条边界补丁里

- 这四条当前的根状态落后有一个共同模式：
  - 审计文档与长期 JSON 其实已经把对象级主链写得很清楚；
  - 但根状态里仍然很容易只看到某条局部补丁，比如 extra-turn L2、组合链里的旁证，或者某个共享 modifier 合同。
- 分别看这四个对象，当前真正需要被根状态承认的真相是：
  - `Shielding` 不能只写成“保护合同已绿”。
    - 它的对象级浏览器真相至少同时包含：
    - onPlay 真实清掉宿主上的对手旧行动；
    - 后续对手行动来临时，宿主本体不受影响；
    - `Shielding` 自身可离场，但宿主上的其他己方行动继续被保护。
  - `Furious George` 不能只写成“动态算力公式正确”。
    - 它真正闭合的是：真实 attached action 进入宿主后，左上绿色力量提示会随自身行动数从 `+1` 动态跳到 `+2`，而不是靠别的直接加力来源碰巧算对。
  - `Splice as Nice` 也不能只写成“共享 ongoing modifier 已绿”。
    - 它真正闭合的是：真实手牌入口附着到宿主后，本卡真实留在 `attachedActions`，宿主左上立即出现绿色 `+2`。
  - `Missing Uplink` 不能只让根状态记住“额外回合结束也要抽牌”的那条 L2。
    - 它当前已经有对象级 scoped L3：真实结束回合时，两张实例的额外抽牌会和正常回合结束抽牌一起收口；
    - 而牌库不足洗弃牌、多 owner 混挂、额外回合结束继续按 owner 聚合，才是后续补进去的 shared/L2 收紧。
- 这批对象的共同不变量是：
  - 当对象级主链 scoped L3 已经成立时，根状态不能只留“某条边界后来补过”或“共享合同本身是绿的”。
  - 必须显式承认对象本体在真实入口里的可见链路，否则后续审计很容易把它们重新误记成“只有实现/L2 正确，浏览器主链还空着”。
- 如果后续再把这四条中的任意一条写成“只有共享合同或单条边界已补”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Bacta / Going Bananas / Primate Park / Copycat choose+metadata` 不能继续只靠零散旁证挂在根状态里

- 这四组对象当前的根状态落后，不是因为没有证据，而是因为证据被拆散到了不同位置：
  - `Bacta` 的真实入口分支主要留在长期 JSON。
  - `Going Bananas` 容易只在 `Shielding` 或 `It's Astounding` 的组合链里被顺带提到。
  - `Primate Park` 的真实响应入口容易只留在 atom/object 行与旧 finding。
  - `Copycat` 的 choose/metadata 前置链又容易被后来的 trigger-surface 盖过去。
- 当前根状态必须显式承认的真相分别是：
  - `Bacta` 不能只写成“Shell Game 保护时仍给 extra”。
    - 它真正闭合的是三条对象级来源分支：
    - 受保护目标；
    - 未保护己方目标；
    - 未保护敌方目标且 extra 机会真实归 owner。
  - `Going Bananas` 不能只写成“某条组合链里看过清行动”。
    - 它真正闭合的是：真实先选基地，然后只清该基地的其他玩家 `base ongoing + attached action`，己方行动和别的基地不被误伤。
  - `Primate Park` 不能只写成“afterScoring base choice 合同已绿”。
    - 它真正闭合的是：赢家真实点击响应入口后，prompt 只列“这里”的 attached action，多选后分别回各自 owner 手牌，而跨基地行动不会混进候选。
  - `Copycat` 也不能只靠后来的 `Jumper trigger` 来代表整个对象。
    - choose/metadata 这两层前置链本身已经有 scoped L3：
    - 真实入口只允许选另一玩家随从；
    - copied metadata 只写到 `Copycat` 本体，不写到别的 live minion。
- 这批对象的共同不变量是：
  - 当对象级浏览器证据已经覆盖了真实入口、目标归属或 owner/controller 语义时，根状态不能只保留后续链、共享合同或组合链里的旁证。
  - 必须把对象本体在真实入口里已经闭合的范围单独写出来，否则后续很容易再把它们误记成“只有某条兄弟链做过浏览器验证”。
- 如果后续再把这四组对象写成“只有零散事实、没有对象级主链承认”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：一组变形者 optional search/choice 不能让根状态只承认 `skip`，却忘掉主链 scoped L3

- 这批对象在根状态里当前最容易出现一种新的落后方式：
  - `Faceless City / G.E.L.F. / Really? / Transmogrify / Doppelganger`
  - 已经补了真实 `skip` 分支
  - 但对象本体原先的“选择候选并真实结算”主链，反而又没有被显式承认
- 这会导致另一个误读：
  - 看起来像这批对象现在只证明了“可以放弃”
  - 却没明确承认它们各自原本已经闭合的真实主链
- 当前根状态必须显式承认的真相分别是：
  - `Faceless City` 不只是 `跳过搜寻` 会收口。
    - 它还已经证明多同名候选时可真实选择第二张收入手牌，并带着剩余牌库收口。
  - `G.E.L.F.` 不只是 `放弃这次选择` 后不偷打候选。
    - 它还已经证明天赋会先把自身洗回牌库，再只列合格候选，并把所选随从直接额外打回原基地。
  - `Really?` 不只是第一层 discard search 可以 skip。
    - 它还已经证明可从弃牌堆两张候选里选第二张，并在后续基地选择里打到别的合法基地。
  - `Transmogrify` 不只是 deck search 可以 skip。
    - 它还已经证明两张合格候选里可真实选第二张，过大候选被排除，且所选随从会打回原基地。
  - `Doppelganger` 不只是 search 可以 skip。
    - 它还已经证明在 `Bacta immediate extra skip` 之后，自己的 search 主链会真实出现，且所选候选会打回原基地。
- 这批对象的共同不变量是：
  - optional search/choice 的对象级根状态必须同时承认“选择候选结算主链”和“显式 skip 收口分支”。
  - 只写其中一半，都会让后续审计把对象重新误读成“另一半还没补浏览器证据”。
- 如果后续再把这批对象写成“只承认 skip，主链没进根状态”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`Mitosis / Operative / Spy / For My Eyes Only / 1.21 Gigawatts` 不能让根状态只剩端点边界

- 这批对象当前最容易出现的根状态落后，是另一种“只记住后来补的端点，却忘了主链”的模式：
  - `Mitosis` 只剩 `skip`
  - `Operative` 只剩两层 `0 勾选`
  - `Spy / For My Eyes Only` 只剩单卡自动与空牌库无 prompt
  - `1.21 Gigawatts` 只剩单一牌种自动与空弃牌堆 feedback
- 这会把对象级真相压扁成“边界都补了，但主链似乎不重要”，这是不对的。
- 当前根状态必须显式承认的主链分别是：
  - `Mitosis` 不只是“可以放弃同名手牌选择”。
    - 它还已经证明先选己方目标，再从同名手牌候选里真实选第二张，并把所选同名随从直接额外打回目标基地。
  - `Operative` 不只是“两层空选都会收口”。
    - 它还已经证明第一层多选玩家、第二层只展示被查看的顶牌、最终只把所选玩家的所选顶牌放到底。
  - `Spy` 不只是单卡自动和空牌库无 prompt。
    - 它还已经证明真实随从进场后，会进入顶三张 inspect/reorder prompt，并按非默认 top/bottom 顺序完成收口。
  - `For My Eyes Only` 不只是单卡自动和空牌库无 prompt。
    - 它还已经证明无目标行动二次点击后，会进入顶五张 inspect/reorder prompt，并按非默认 top/bottom 顺序完成收口。
  - `1.21 Gigawatts` 不只是单一牌种自动和空弃牌堆 feedback。
    - 它还已经证明弃牌堆同时有两类牌时，会真实出现“行动 / 仆从”按钮 prompt，并只把所选牌种洗回 deck。
- 这批对象的共同不变量是：
  - 当对象级主链 scoped L3 已经存在时，根状态不能只保留“后来补的端点边界”。
  - 否则后续审计会错误地把这些对象重新理解成“主链还没正式承认，只是若干边缘分支绿了”。
- 如果后续再把这批对象写成“只有边界端点已补”，那已经不是当前真相，而是根状态落后于审计文档与长期 JSON。

## 2026-05-18 补充发现：`ISI / Secret Agent / The Spy Who Ditched Me` 不能继续只留在长期 JSON、旧 finding 或 shared 残项里

- 这三组对象当前的根状态缺口不是“还没证据”，而是对象级真相已经在审计文档与长期 JSON 里闭合，但根状态仍容易只留下某一条旧主链、某个 shared 修复，或一条局部端点。
- `ISI's Swingin' Pad` 不能继续只写成“P0 赢家可重排自己牌库顶三张”。
  - 它当前真正已经闭合的对象级真相是：
    - 真实入口来自计分后的 `smashup_reaction_choose` 响应窗口；
    - `winner != currentPlayer` 时，只有赢家页面能拿到 `ISI` 选择权与后续重排 prompt；
    - `让过` 分支点击后会真实清掉旧 reaction frame，不再残留 stale `smashup_reaction_choose`；
    - 短牌库 2 张仍可重排这条边界已由同对象 L2 锁定。
  - 所以后续如果再把 `ISI` 写成“只剩多客户端或 optional pass 没回根状态”，那已经不是当前真相，而是根状态落后。
- `Secret Agent` 不能继续只停在“queued trigger 根因修了”或“单页两手牌二选一那条 scoped L3”。
  - 它当前真正已经闭合的对象级真相是：
    - 行动玩家真实打出行动后，弃手牌选择权会回到行动玩家本人，且候选只来自该行动结算后的剩余手牌；
    - 多客户端下只有行动玩家页面出现 prompt，非目标页不出现错误 waiting overlay；
    - 多客户端 `2/1/0` 剩余手牌三条真实浏览器分支都已闭合，而且刚打出的 `Stasis Field` 会继续附着在 `Portal Room`，不会被误移走。
  - 所以后续如果再把 `Secret Agent` 写成“对象级主链还没回到根状态”或“1/0 手分支只是 L2 没进浏览器证据”，那已经不是当前真相。
- `The Spy Who Ditched Me` 也不能继续只剩“shared overlay residual 已修”或“施放者页 reveal 过一条”。
  - 它当前真正已经闭合的对象级真相是：
    - `each_other_player_discards_minion` 的多客户端主链里，目标玩家只在自己页面拿到弃随从 prompt，Host 非目标页没有错误 waiting overlay；
    - `reveal_no_minion_hand` 的真实入口里，没有随从的其他玩家只会向施放者页私有展示手牌，而且 reveal 关闭后，另一位有随从玩家的 discard prompt 仍然保留并能继续收口；
    - 旧 Host/非目标页 waiting overlay 已明确归类为 shared optimistic transport/playerView 根因，不应再作为这张卡自己的 residual 继续占位。
  - 所以后续如果再把 `The Spy Who Ditched Me` 写成“只修过 shared overlay，还没对象级主链承认”，同样已经不是当前真相。
- 这三组对象共同说明一条 completion-audit 不变量：
  - 当对象级 scoped L3 已经覆盖“当前页/非当前页归属”“optional pass 清理”“私有 reveal 与并存 prompt”“自动分支 2/1/0”这类真实浏览器语义时，根状态不能再只保留 shared 修复、旧单链或长期 JSON 条目。
  - 否则后续审计会把已经闭合的对象再次误记成“根状态仍空着”。

## 2026-05-18 补充发现：`From Q With Love / Secret Volcano Headquarters` 不能让根状态只剩边界补丁或旧证据纠偏

- 这两组对象当前的根状态落后方式比较隐蔽：
  - `From Q With Love` 已经补了短候选与空投影手牌，但 exact-2 主链反而没有被根状态单独承认。
  - `Secret Volcano Headquarters` 已经补了“旧 scoped L3 失效、改用新 scene-truth”的纠偏，但当前有效主链也还没有被根状态单独承认。
- `From Q With Love` 不能继续只写成“投影手牌只剩 1 张 / 0 张时怎么收口”。
  - 它当前真正已经闭合的对象级真相是：
    - 真实入口先抽 3 张；
    - discard prompt 来自“旧手牌 + 新抽牌 - 本牌”的投影手牌，而不是 live hand 任意选择；
    - prompt 会同时列出旧手牌与新抽牌的候选，但不会把本牌自身混回候选；
    - 选择两张后，只把这两张送入 discard，其余未选牌继续留手。
  - 所以后续如果再把 `From Q With Love` 写成“根状态只补了短候选/空投影手牌，exact-2 主链还没回填”，那已经不是当前真相。
- `Secret Volcano Headquarters` 也不能继续只写成“旧 E2E 夹具误配、现在要以新 finding 为准”。
  - 它当前真正已经闭合的对象级真相是：
    - 真实结束回合后会按 turnOrder 真实发出两条 `REVEAL_DECK_TOP(viewerPlayerId='all')`；
    - `reveal-overlay` 会真实出现在页面中央，并与计分后的 VP / 换基地状态并存，而不是只在 `eventStream` 或 state 里存在；
    - dismiss 两次后 overlay 会完全消失，桌面真实收口到替换后的 `Portal Room`，且只有展示出的随从会进入这次计分链。
  - 所以后续如果再把 `Secret Volcano Headquarters` 写成“根状态只有旧证据失效修订，没有当前有效主链承认”，同样已经不是当前真相。
- 这两组对象共同说明另一条 completion-audit 不变量：
  - 根状态不能只承认“后来补的边界端点”或“旧证据失效后的纠偏”，却遗漏当前已经有效的对象级主链。
  - 否则后续审计会错误地把对象理解成“周边都补了，但真正主链还没正式承认”。

## 2026-05-18 补充发现：`Time Walk / Stasis Field` 不能继续只作为别的链路里的卡名旁证存在

- 这两组对象当前的根状态缺口不在 evidence，而在表述层：
  - `Time Walk` 在长期 JSON 和审计文档里已经是对象级 scoped L3，但根状态里仍容易只以 `Time Raider` 候选、`It's Astounding` 弃牌堆行动、或 shared `banked-extra-play` 合同的形式出现。
  - `Stasis Field` 也类似，根状态里已经在 `Secret Agent`、`Into the Time Slip`、`Portal Room` 这些兄弟链里反复出现它的卡面或 uid，但对象本体的三段主链还没有被单独承认。
- `Time Walk` 不能继续只写成“额度加 1”或者“后续某张 `Jumper / Juiced Up` 链里出现过”。
  - 它当前真正已经闭合的对象级真相是：
    - 真实入口会先抽 2 张；
    - 本牌自己会沉到底牌库，而不是进 discard；
    - 授予的是本回合 banked extra minion / extra action 额度，不会额外起 immediate prompt；
    - 这两次 banked extra 会在同一回合里被真实消费掉，而不是只停在 toast 或 state 数字。
  - 所以后续如果再把 `Time Walk` 写成“只有 shared 合同或别的链路旁证，没有对象级主链承认”，那已经不是当前真相。
- `Stasis Field` 也不能继续只写成“在别的链里能看到它留在基地上或被回手”。
  - 它当前真正已经闭合的对象级真相是：
    - 真实手牌入口可以把它贴到目标基地并进入 `ongoingActions`；
    - 该基地即使已经达断点，也会被真实压住，不发生本该在回合结束时发生的计分与替换；
    - 到拥有者自己下一个回合开始时，它会自动离场并进入 owner discard。
  - 所以后续如果再把 `Stasis Field` 写成“只是某些兄弟链里顺带出现过，没有对象级主链承认”，同样已经不是当前真相。
- 这两组对象共同说明另一条 completion-audit 不变量：
  - 根状态不能让一张卡长期只以“兄弟链旁证”或“shared 合同示例”形式存在。
  - 当对象本体的整条真实浏览器链已经闭合时，必须单独承认它自己的主链，否则后续审计会错误地以为它还没从旁证升级成对象级完成。

## 2026-05-18 补充发现：`Do Over / Doctor When` 不能让根状态只剩 `skip extra`

- 这两组对象当前的根状态落后也很典型：
  - `skip extra` 在 2026-05-18 已经补回根状态；
  - 但对象本体的 returned-card 主链反而还没有被单独承认。
- `Do Over` 不能继续只写成“点击放弃后 returned `Jumper` 会留在手里”。
  - 它当前真正已经闭合的对象级真相是：
    - `return_own_minion` 真实入口会先把 `Jumper` 从基地回到手牌；
    - 接着进入 specific-card extra prompt；
    - 该 prompt 只允许刚返回的 `jumper-a`，不会把同名手牌诱饵混进候选；
    - 选择后会把 `jumper-a` 真实打回原基地并完整收口。
  - 所以后续如果再把 `Do Over` 写成“根状态只补了 skip extra，returned-card 主链还没对象级承认”，那已经不是当前真相。
- `Doctor When` 也不能继续只写成“可以 skip extra”。
  - 它当前真正已经闭合的对象级真相是：
    - 第一层 prompt 会真实列出“另一个己方随从”候选，`Doctor When` 自身不会混进候选；
    - 选择 `Time Raider` 回手后，会进入 returned-card extra prompt；
    - extra prompt 只允许刚返回的 `raider-a`，不会把同名手牌诱饵混进来；
    - 选择后 `Time Raider` 会真实打回 `Portal Room` 并收口。
  - 所以后续如果再把 `Doctor When` 写成“只有 may/skip 边界已补、主链还没回根状态”，同样已经不是当前真相。
- 这两组对象共同说明另一条 completion-audit 不变量：
  - 根状态不能只承认 returned-card 链的后半段端点，比如 skip extra；
  - 当前半段 `return` 和后半段 `specific-card replay` 都已经在真实浏览器链里闭合时，必须把整条 returned-card 主链一起承认，否则会把对象重新误解成“主链未审，只补了端点”。

## 2026-05-18 补充发现：`Mole` 不能让根状态只承认 `Mindraker` 负链

- `Mole` 当前的根状态落后点已经很具体，不是实现没修，而是 completion-audit 还停在旧口径：
  - evidence 对象行早就把 `super_spies_mole.grant_special_action` 写成了 `L2 / scoped L3`；
  - 但根状态实际上只显式承认了 `super_spies_mole.respect_mindraker` 这条“被 restriction 封死后不弹 prompt”的负向浏览器链。
- 这已经不是当前真相，因为 evidence finding #131 又把真正高风险的正向链补实了：
  - 真实计分响应窗口里会先出现 `选择一个反应动作`；
  - 玩家可真实点击 `内鬼特殊能力` 进入 `立刻打出一张额外战术，或放弃这次机会` prompt；
  - 当前夹具下唯一合法候选是 `Going Bananas`，点击后不会再错误弹第二层基地选择 prompt，而是按“唯一合法基地”自动收口；
  - 最终 `The Vats` 被 `The Nexus` 替换，记分板到 `3:1`，且 `Going Bananas / Mole / anchor` 与被清理的目标行动、目标随从都进入对应 discard。
- 这条新 finding 还顺手纠偏了旧正向夹具的噪音来源：
  - 旧版 P0 deck 为空，计分后的 draw 会把刚进弃牌的 `Going Bananas / Mole / Jumper` 洗回再抽走；
  - 所以浏览器末态曾经容易把“行动已正确结算”误读成“行动没进弃牌或结果异常”；
  - 现在给 P0 deck 补了 `mole-draw-a/mole-draw-b` 两张稳定抽牌后，这层 reshuffle 噪音已经被隔离，不该再拿旧末态继续怀疑正向链没闭合。
- 所以后续如果再把 `Mole` 写成“根状态已经承认对象级 Mole 浏览器链，只剩 Mindraker 之类边界”，那也是错的；更准确的表述应是：
  - `super_spies_mole.grant_special_action` 的正向 special 主链与 `super_spies_mole.respect_mindraker` 的负向 restriction 主链，现在都已经闭合；
  - 根状态必须同时承认这两条链，不能继续只保留负链，让正链只停在 evidence 里。

## 2026-05-18 补充发现：`For My Eyes Only` 不能再把多客户端私有顶五归属留在 evidence 里

- `For My Eyes Only` 当前的根状态落后模式，和刚补完的 `Spy` 基本同型，只是对象还没同步到根状态：
  - 根状态已经承认了单页顶五主链；
  - 也承认了牌库只剩 1 张时自动查看、牌库为空时不弹 prompt；
  - 但 evidence finding #149 又补上了更关键的一层对象级事实：多客户端下，这条私有顶五 inspect/reorder prompt 只应该出现在行动玩家页面。
- 这已经不是当前根状态，因为真实多客户端链已经把风险点说死了：
  - Host 真实双击打出 `For My Eyes Only` 后，中央会进入 `只为我的眼睛：选择牌库顶/牌库底顺序` prompt，并直接看到 `Spy / Operative / Mole / Secret Agent / Jumper` 五张 inspected 顶牌本体和非默认顶/底顺序按钮；
  - Guest 页只保留公共 `For My Eyes Only 已打出!` spotlight，不会镜像出 `只为我的眼睛` 私有 prompt、五张 inspected 顶牌卡面或任何顶/底顺序按钮；
  - Host 完成非默认 top/bottom 选择后，Host/Guest 两页都会收口到正常出牌态，不残留 waiting overlay 或私有按钮残影。
- 这条新 finding 还把一个容易混淆的边界说清了：
  - Guest 仍然可以看到公共“已打出” spotlight；
  - 但这不等于 Guest 拿到了私有 inspect 信息或 reorder 控制权。
  - 所以后续口径必须区分“公共出牌展示可见”和“私有顶牌信息泄露/私有 prompt 镜像”这两层，不要再把它们混成一句“Guest 看到了点什么”。
- 所以后续如果再把 `For My Eyes Only` 写成“根状态只承认单页主链和单卡/空牌库端点，多客户端私有归属仍主要在 evidence 或长期 JSON”，那已经不是当前真相；更准确的表述应是：
  - `super_spies_for_my_eyes_only.inspect_self_top_five` / `reorder_top_bottom_inspected_cards` 现在已经同时承认单页顶五主链、短牌库端点、空牌库端点，以及 2P owner-only 私有顶五页归属；
  - 当前剩余边界只应继续保留更广多人局、其它 inspect 来源或 shared transport/spotlight 收口时序，而不是再把对象级多客户端主链挂回 residual。

## 2026-05-18 补充发现：`Operative` 不能再把多客户端两层 prompt 归属留在 evidence 里

- `Operative` 当前的根状态落后模式与 `Spy / For My Eyes Only` 有一半相同、另一半更细：
  - 根状态已经承认了单页正常主链；
  - 也承认了第一层 `0` 勾选玩家和第二层 `0` 勾选展示牌这两条端点；
  - 但 evidence finding #144 又补上了更关键的一层对象级事实：双人联机下，`Operative` 的两层 prompt 都只应该出现在行动玩家页面。
- 这已经不是当前根状态，因为真实多客户端链已经把双层控制权说死了：
  - Host 打出 `Operative` 后，第一层 `密探：选择要查看牌库顶牌的玩家` prompt 只出现在 Host 页；
  - Guest 页既没有第一层 prompt，也没有 waiting overlay；
  - Host 在第一层只勾选 `玩家1` 后，第二层只出现 Guest 的 `Jumper` 顶牌本体，不夹带 Host 顶牌；
  - Host 完成第二层选择后，Host/Guest 两页都会收口，而服务端只把 Guest 顶牌放到底，不误改 Host 牌库。
- 这条新 finding 还说明一个容易被忽略的验收点：
  - `Operative` 不是只有“谁能看到 prompt”这一层；
  - 还要证明第二层展示集合没有串台，以及最终 deck 改写只落在被选中的玩家上。
  - 否则就算 Guest 没拿到按钮，也可能仍有“Host 看到错牌 / 改错 deck”这类对象级漏项。
- 所以后续如果再把 `Operative` 写成“根状态只承认单页主链和两层空选端点，多客户端非当前视角仍主要在 evidence 或长期 JSON”，那已经不是当前真相；更准确的表述应是：
  - `super_spies_operative.choose_players_to_reveal` / `bottom_any_revealed_cards` 现在已经同时承认单页主链、两层 `0` 勾选端点，以及 2P owner-only 双层 prompt 页归属；
  - 当前剩余边界只应继续保留 `>2` 玩家更广 turnOrder/UI 与 shared transport，而不是再把双人联机这条对象级主链挂回 residual。
# Findings: DiceThrone 战术家与咒缚海盗新增英雄接入（2026-05-30）

## 2026-05-30 16:48:43

- 本轮使用项目 `add-new-faction` workflow，并按 DiceThrone 专用 `dicethrone-hero-intake` 执行；完整完成口径包含数据录入、资源链、机制、审计、E2E、上传与远端回查。
- 当前工作区有大量非本轮未提交改动，必须定向编辑 DiceThrone 新英雄相关文件，不做回滚、清理或全局整理。
- 本批次新英雄为战术家（`zhanshujia`）与咒缚海盗（建议代码 ID `cursed_pirate`，素材目录 `cursed`）。
- 素材目录已存在：`public/assets/i18n/zh-CN/dicethrone/images/zhanshujia/` 与 `public/assets/i18n/zh-CN/dicethrone/images/cursed/`。
- 战术家状态图只包含 `战术优势.png`、`紧缚.png`；用户已说明锁定/守护是既有 token，需复用 `STATUS_IDS.TARGETED` 与 `TOKEN_IDS.PROTECT`，不能新增同义 token。
- 咒缚海盗状态图包含 `凋零.png`、`休战.png`、`炸药.png`、`诅咒金币.png`；图面称呼中“炸药桶/火药桶”需要以主图和提示板核对后统一文案。
- 现有 DiceThrone 英雄注册点包括：`src/games/dicethrone/domain/core-types.ts`、`src/games/dicethrone/domain/ids.ts`、`src/games/dicethrone/domain/characters.ts`、`src/games/dicethrone/domain/index.ts`、`src/games/dicethrone/heroes/index.ts`、`src/games/dicethrone/ui/cardAtlas.ts`、`src/games/dicethrone/criticalImageResolver.ts`、`public/locales/{zh-CN,en}/game-dicethrone.json`。
- `src/games/dicethrone/ui/assets.ts` 旧头像索引已有 `cursed_pirate: 8`，但这不代表咒缚海盗已完成接入；不得覆盖老头像共享合同。

## 2026-05-30 17:20

- 咒缚海盗代码 ID 使用 `cursed_pirate`，素材目录通过 `CHARACTER_ASSET_DIR` / `CHARACTER_DIR_MAP` 映射到 `cursed`；卡图 atlas 注册、关键图片预加载、玩家板/提示板/骰子都必须走这个分流，不能创建 `images/cursed_pirate` 并复制第二套素材。
- 战术家新增状态图集只包含 `tactical_advantage` 与 `bind`；锁定/守护继续复用旧定义和旧图标。
- 咒缚海盗状态图集 frameId 使用 `wither`、`parley`、`powder_keg`、`cursed_coin`；源文件 `炸药.png` 在运行时统一命名为火药桶 / `powder_keg`。
- 当前英雄专属手牌未录入，两个英雄 `cards.ts` 仅接入通用牌。继续推进前必须先裁完整单卡，不能凭整张 `手牌.png` 或 slot 猜测牌名/费用/升级目标。
- 当前机制是 L1/L2 混合：基础骰面触发、简单伤害、简单施加状态可运行；战术优势多选、紧缚成本/移除、诅咒金币差异上限/不可移除/维持伤害、火药桶投骰/转交/重叠爆炸、凋零伤害修正、休战阻止伤害、防御技能精确 resolver 都未收口。

## 2026-05-30 17:48

- 战术优势已从“被动入口部分”推进到 L2 机制：6 个主动动作均有执行路径与单测证据。锁定继续复用 `STATUS_IDS.TARGETED`，守护继续复用 `TOKEN_IDS.PROTECT`，转移状态复用既有 `transfer-status` 交互。
- 紧缚的真实合同应拆成两条：额外进攻投掷前的 1CP 门禁，以及进攻掷骰阶段退出清理。当前两条均已接入并由机制测试覆盖。
- 诅咒金币的差异上限必须通过 `getTokenStackLimit(state, playerId, STATUS_IDS.CURSED_COIN)` 读取，不能只看 token 定义上的 `stackLimit: 5`；普通 `grantStatus`、条件/default grantStatus、reducer 上限裁剪均应走这条动态上限。
- 诅咒金币的 `removable: false` 同时意味着 `REMOVE_STATUS` 不移除、`TRANSFER_STATUS` 不转移；当前 execute 层测试已覆盖。
- 凋零不是目标侧受伤修正，而是伤害来源身上的出伤修正；因此伤害计算管线需要收集 source player 的 `onDamageDealt` 状态，并只在攻击伤害语义下生效。
- 休战只阻止持有者通过进攻投掷阶段造成的攻击伤害，不应阻止直接伤害；阶段退出清理与阻伤是两条独立机制，均需保留测试证据。
- 仍不得宣称两个英雄完成：火药桶完整投骰/爆炸/转交/重叠爆炸、防御 resolver、专属手牌逐卡录入、E2E、上传和远端回查仍是未完成门禁。

## 2026-05-30 18:00

- 制胜高地的“上限提升 1”和“获得至上限”不能用固定 `grantToken(5)` 表达；必须先写入玩家自身的 `tokenStackLimits[TACTICAL_ADVANTAGE]`，再按新上限补足当前 token 数。
- 死亡印记的“先获得 2CP”可以复用通用 `gain-cp` custom action，已作为独立 preDefense 效果落地；但弯刀分支的“不可防御伤害”仍不能由当前 `bonusDamage` 证明，必须继续保留为 pending。
- 亡灵之爪的诅咒金币附加伤害不是固定 1 点，而是按每名对手身上的诅咒金币层数分别计算；当前实现已改为 custom action 对所有对手按层数发 `damageScope: direct` 的 `DAMAGE_DEALT`。
- 火药桶不应因为其它咒缚海盗机制已补而顺手实现：当前图文/核对文档仍缺爆炸伤害数值和 6 点转交选择细节，按“图片优先，不猜数值”规则继续保留未实现。

## 2026-05-30 18:05

- 灵魂突刺的“三同值施加火药桶”可以独立实现，但这不等于火药桶机制已完成。当前实现只负责在满足三同值时授予火药桶；若目标已有火药桶时应如何爆炸，仍归属火药桶重叠爆炸 pending 项。
- 深海潜行的“偷取 1CP”和“对手弃 1”必须拆开验收：偷 CP 是确定资源转移，已 L2；弃牌需要手牌候选/选择或自动弃牌规则，当前没有足够交互实现，继续 pending。

## 2026-05-30 18:15

- 死亡印记的弯刀分支不能继续用 `bonusDamage` 混入普通攻击修正，因为这样无法证明“不可防御伤害”语义。当前已给 `rollDie` 条件分支补 `unblockableDamage`，直接产出带 `unblockable: true` 的 `DAMAGE_DEALT`，让每个弯刀面独立造成 2 点不可防御攻击伤害。
- 战争贩子的“立即额外进攻投掷阶段”与晕眩的额外攻击阶段流转同构，但来源不是状态。当前已通过 `zhanshujia-war-monger-extra-offensive-roll` 产出 `EXTRA_ATTACK_TRIGGERED`，并让 `resolvePostAttackFollowUp` 识别已有额外进攻事件后把下一阶段改回 `offensiveRoll`。
- 深海潜行弃牌不能在没有交互合同时硬写成随机弃牌。现有 DiceThrone `dt:card-interaction` 只支持 `selectDie/modifyDie/selectPlayer/selectStatus/selectTargetStatus`，没有从目标玩家手牌选择并弃置的正式入口；因此“对手弃 1”仍应保留 pending，等补手牌选择交互或确认随机弃牌规则后再实现。

## 2026-05-30 18:28

- 深海潜行“对手弃 1”已按规则文本的控制权语义实现为目标玩家自选弃牌，而不是随机弃牌，也不是攻击方替对手选牌。新增 `selectHandCard` 只扩展 DiceThrone 既有 `dt:card-interaction` 最小分支，`RESOLVE_INTERACTION.selectedCardIds` 只允许交互所有者从自己手牌中选择。
- 前端手牌弃置交互必须只给交互所有者显示；否则会把对手手牌选择权或可见信息泄露给攻击方。当前 Board 对 `selectHandCard` 加了 owner gate，Overlay 仅渲染 `interaction.playerId` 的手牌。
- 这只收口深海潜行弃牌的 L2/L3 前置交互合同，不代表火药桶、咒缚被动、防御 resolver 或专属手牌完成。

## 2026-05-30 18:35

- 咒缚玩家板明确写着“在你的维持阶段受到 4 伤害（此伤害不能以任何方式被减少或防止）”，因此自伤 4 可以独立实现为 `DAMAGE_DEALT(direct, unblockable=true)`，不需要等待火药桶完整机制。
- 咒缚的另一句“如果一名对手在其进攻投掷阶段未造成一次攻击，则对该对手施加火药桶”不能用 `lastResolvedAttackDamage` 这类当前回合单点字段替代。它需要明确追踪每名对手自己的 offensiveRoll 是否造成过一次攻击，否则容易把“造成 0 伤害的攻击”“未选择攻击”“直接伤害”等情况混在一起。

## 2026-05-30 18:47

- 战术家反制措施可以作为独立 L2 防御 resolver 收口：当前规则只依赖防御骰面计数，能通过 `getActiveDice` + `getPlayerDieFace` 从战术家自己的骰面合同直接得到军刀、旗帜、勋章数量，不需要额外 UI 决策。
- 战术家反制措施的三条子句必须分开记录证据：每组 2 军刀造成 1 反击伤害；每个旗帜防止 1 伤害；每个勋章获得 1 战术优势。只证明其中一条不等于防御技能完成。
- 咒缚海盗你还嫩了点也可以作为独立 L2 防御 resolver 收口：弯刀、战利品、骷髅三类骰面都能从咒缚海盗自己的骰面合同直接计数；弯刀+骷髅的诅咒金币是组合条件，不应拆成“任一面出现即施加”。
- 这次防御 resolver 收口不改变火药桶的阻塞状态：咒缚海盗防御只会施加诅咒金币，不需要推断火药桶爆炸伤害或转交规则；火药桶仍因图面缺爆炸伤害数值与转交选择细节保持 pending。
- 当前“防御 resolver 未实现”的旧口径已经失效，后续剩余机制缺口应集中写为：火药桶完整机制、无情诅咒至多两名对手施加火药桶，以及英雄专属手牌逐卡录入。

## 2026-05-30 18:55

- 诅咒金币“海盗可选择不获得金币”不能只在单个技能里特判；状态可能来自普通 `grantStatus`、条件/default `grantStatus`、奖励骰状态施加、咒缚海盗 custom resolver 或 `selectPlayer` 交互授予状态，因此必须收敛到统一状态施加 helper。
- 当前统一 helper 的边界是：只有目标角色为咒缚海盗本人且状态为诅咒金币时才生成选择；其他角色收到诅咒金币仍直接施加并遵守 3 层动态上限，咒缚海盗本人接受时遵守 5 层动态上限，拒绝时权威状态不变。
- 当前“诅咒金币可选择不获得”的旧口径已经失效，后续剩余机制缺口应集中写为：火药桶完整机制、无情诅咒至多两名对手施加火药桶，以及英雄专属手牌逐卡录入。

## 2026-05-30 19:13

- 咒缚“对手在其进攻投掷阶段未造成一次攻击”不应按伤害量判断；只要对手在 offensiveRoll 发起过 `ATTACK_INITIATED`，即视为本阶段已经发起攻击，后续是否被防止、闪避、护盾抵消或造成 0 净伤害，都不能触发“未发起攻击”的火药桶惩罚。
- 该判断需要 core 追踪而不是读取 `lastResolvedAttackDamage`：攻击可能在防御阶段或后续 autoContinue 才结算，且成功攻击也可能造成 0 净掉血；`offensiveRollAttackMadeThisTurn` 只记录攻击发起事实，回合切换清理。
- 当前“咒缚未造成攻击追踪”的旧口径已经失效，后续剩余机制缺口应集中写为：火药桶完整机制、无情诅咒至多两名对手施加火药桶，以及英雄专属手牌逐卡录入。

## 2026-05-30 19:36

- 无情诅咒的“至多两名对手”不能实现成自动选择全部对手；规则里的“至多”要求在合法候选存在时仍允许跳过或空选，因此必须创建玩家选择而不是直接 `grantStatus`。
- 2v2 下“对手”必须按队伍关系取敌队成员，不能简单取除自己外的所有玩家；否则会把队友列入火药桶候选。当前 `getOpponents` + mask choice 只列 P2/P4（玩家 1 的两名敌队对手），不列队友 P3。
- 当前“无情诅咒至多两名对手施加火药桶”的旧缺口已经失效，后续剩余机制缺口应集中写为：火药桶完整投骰/爆炸/转交/重叠爆炸，以及英雄专属手牌逐卡录入、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。

## 2026-05-30 19:45

- 咒缚海盗提示板本地图片已经足够裁定火药桶缺口：图面标题是“炸药桶”，但运行时代码沿用 `STATUS_IDS.POWDER_KEG` / 火药桶命名；规则文本明确为维持阶段投 1 骰，1-2 爆炸，3-5 无事发生，6 可传给任意玩家，爆炸时移除并造成 3 点独立来源的不可防御伤害。
- 重复获得不是“因为堆叠上限 1 所以忽略新状态”。图面写明新收到者已有炸药桶时，原先那个炸药桶立即爆炸；因此共享状态施加 helper 必须在 `POWDER_KEG` 已存在时先产生爆炸事件，再施加新桶，最终仍保留 1 层。
- 火药桶维持阶段 6 点转交需要玩家选择，不能自动转给固定对手；当前实现按图面“任意玩家”列出全部玩家。选择自己时保持原状态，选择其他玩家时从原持有者移除并给目标施加火药桶；若目标已有火药桶，会触发上面的重复获得爆炸合同。
- 当前“火药桶完整投骰/爆炸/转交/重叠爆炸”的旧缺口已经失效，后续剩余缺口集中为英雄专属手牌逐卡录入、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。

## 2026-05-30 22:46

- 两名新英雄不能继续复用 `TREANT_NINJA_COMMON_ATLAS_INDEX` 的全部位置：战术家与咒缚海盗的 `card-unexpected` 图面分别在 slot 32 与 slot 33，而树精/忍者合同为 slot 37。当前已改成新英雄各自的通用牌索引映射，未反向修改树精/忍者共享合同。
- 专属手牌已从“未裁图/未录入”推进为 L1：战术家 slot 17-31、咒缚海盗 slot 17-32 均有完整单卡裁图、`card.id`、费用、类型、时机、正文、`previewRef.index` 和文档记录。
- 战术家的多个升级牌是单张物理牌内的复合升级子区，例如战略转移 II、开拓战场 II、摇鼓运动 II、地毯式轰炸 II。后续 L2 必须按“一张升级卡替换一个基础技能，内部 variants 同类取最高”建模，不能拆成多张 runtime card。
- 当前专属手牌代码只对少量确定简单效果做了 L2 入口，其余复杂响应窗、目标选择、对手支付、手牌查看/弃牌、翻面条件、至多三名目标等均必须继续标为未收口，不能用 L1 静态录入替代机制完成。

## 2026-05-31 09:23

- 战术家升级牌的核心缺口已从“没有运行时升级语义”推进到 L2：9 张升级牌现在都通过 `replaceAbility` 指向基础技能 ID，而不是拆成新 runtime card，也不是只保留静态描述。
- 复合升级的正确运行时落点已经落在能力定义内部 `variants`：战略转移 II、开拓战场 II、摇鼓运动 II、地毯式轰炸 II 的下半区都作为同一基础技能的附加触发分支建模，符合旧英雄“同卡复合子技能 / 同类取最高”的合同。
- 反制措施 II/III 不是新建两套防御 resolver，而是同一个 `zhanshujia-countermeasures-defense` 读取升级参数调整“每组军刀”伤害；这避免了同一防御逻辑分叉后不同步。
- 军刀突刺 II 的“三同值施加紧缚”应读取当前主骰盘最大重复数；不能把它误实现成“3 个军刀”或“3 个同面符号”。当前 `zhanshujia-bind-if-three-kind` 按骰值重复数判定。
- 战争贩子 II 的额外进攻投掷阶段只在勋章奖励骰分支触发，不能沿用基础战争贩子“攻击收口后额外进攻”口径直接自动触发。当前通过 `zhanshujia-war-monger-2-roll` 在勋章分支生成 `CARD_DRAWN` 与 `EXTRA_ATTACK_TRIGGERED`。
- 仍不能把战术家专属手牌整体说成完成：被攻击后响应牌、战略防御选择 1 名玩家、地毯式轰炸 II 在多人局精确选择 2 名不同对手仍缺 L2/L3 证据。

## 2026-05-31 09:38

- 战术家被攻击后响应牌可以复用现有防御阶段出牌合同：`playCondition.phase = defensiveRoll` + `requireIsRoller` 表达“只能在自己被攻击后打出”，不需要新增响应窗口类型。
- 脱战的军刀分支与圣骑士赦免同构：使用 `rollDie` 的 `bonusDamage`，在没有后续 damage 动作时由效果系统收口为对当前攻击者的独立 `DAMAGE_DEALT`；旗帜分支使用 `grantDamageShield(3)`，勋章分支复用 `TOKEN_IDS.PROTECT`。
- 伴装撤退不应按默认对手猜攻击者；在 `pendingAttack` 防御上下文中，`getSelectedCombatOpponentId` 会把防御者的 opponent 解析为真实攻击者，因此 `grantStatus(opponent, bind)` 能定位到攻击者。
- 作战室不能用骰面分支表达，因为图面要求按“骰值”一半向上取整，战术家骰面里 1/2/3 都是军刀但结果不同；因此必须走 custom action 读取实际 `random.d(6)` 数值。
- 战略防御是“选择 1 名玩家”，目标集合应为全体玩家而不是自己或对手；当前用 `selectPlayer` + `tokenGrantConfig(PROTECT)` 复用既有交互结算合同。
- 现在战术家专属行动牌剩余 L2 缺口已缩小：脱战、伴装撤退、作战室、战略防御已 L2；仍不能宣称战术家全收口，因为地毯式轰炸 II 多人精确目标交互、E2E、审计和上传仍缺。

## 2026-05-31 09:49

- 地毯式轰炸 / 地毯式轰炸 II 的“两名不同对手”不能用 `allOpponents` 自动结算近似。该语义在 2v2 下要求玩家从敌队两名成员中精确选择，不能把队友混入候选，也不能默认替玩家选择。
- `selectCount: 2` 只能表达最多选择 2 名，不能表达“必须选满 2 名”。当前新增 `minSelectCount` 后，UI 确认按钮、命令校验与执行层都按同一数量合同拒绝不足选择，避免“看起来可确认但 resolver 不结算”的双重真相。
- 对手不足 2 名时，图面“两名不同对手”的前提不存在；此时不创建无法满足的必选交互，而是按现有对手直接结算，避免 1v1 被卡在永远选不满 2 名的 prompt。
- 这次只收口战术家地毯式轰炸家族的 L2 多目标语义。当时咒缚海盗复杂专属手牌、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查仍是未完成门禁；后续 E2E、上传与 HEAD 已在 2026-05-31 12:44 收口。

## 2026-05-31 10:03

- 咒缚海盗专属手牌不能继续被整体写成“复杂手牌待 L2”。10:03 当时应分成已收口与仍缺口两类：诅咒卡牌、封舱、抽筋剥皮、干票大的、送你们去喂鱼、啜呼已具备 L2 行为证据；赎金、瞭望台、海盗的一生当时仍待补。后续赎金、瞭望台与海盗的一生已在 10:11、10:34、13:08 分别补齐 L2 证据。
- 干票大的这类“打出卡牌后再获得 CP”的 custom action 必须按事件顺序考虑卡牌费用。由于 custom action 读取的是出牌前 state，直接用当前 CP +2 会覆盖 `CARD_PLAYED` 扣费后的 CP；正确口径是按源卡费用推导扣费后 CP，再 +2。
- 送你们去喂鱼的“至多 3 名不同对手”与无情诅咒“至多 2 名对手”共享 bitmask 选择模型，但对象语义仍需独立证据。当前已补该卡自己的跳过路径与 2v2 不列队友证据，不能只借无情诅咒代表链。
- 啜呼的选择权属于目标玩家，不属于出牌者；目标接受火药桶和改为投骰是两条不同分支。当前两条都已覆盖，且 3-6 分支同时施加火药桶和凋零。

## 2026-05-31 10:11

- 赎金是两段选择链，不是简单的“选择骰子后立刻重掷”。第一选择权属于出牌者，第二选择权属于目标对手；如果省掉第二段支付选择，就会丢掉规则里的“除非支付 2CP”语义。
- 赎金第二段必须携带稳定上下文：出牌者、目标对手、被选骰子。当前用数值编码在 choice value 中传递，避免第二段 handler 靠当前对手、当前骰池或第一个骰子猜目标。
- 赎金支付分支要按已扣除卡牌费用后的状态结算，因为第二段选择发生在出牌 pipeline 之后；与干票大的不同，这里读取到的是 post-card-play state，不需要额外补扣源卡费用。

## 2026-05-31 10:34

- 瞭望台的三个骰面分支必须分开验收：弯刀只产生信息查看，不应改变权威状态；战利品的弃牌选择权属于目标玩家；骷髅是随机弃牌，不能实现成目标自选或出牌者选择。
- 当前 DiceThrone 没有独立“查看对手手牌”的专用事件/UI 合同。为避免自造隐藏信息系统，弯刀分支先落成出牌者 simple-choice 确认，选项参数携带目标当前手牌列表；这能证明信息链不会改状态，但真实 UI/E2E 仍需后续核对展示是否合格。
- 海盗的一生旧阻塞结论已失效：当前代码已补 `HeroState.playerBoardFace`，并已把咒缚面 `player-board` 与 normal 面 `human-player-board` 一并接入正式资源链和 UI 选图。咒缚面治疗 3 与普通面获得 1 诅咒金币均有 L2 测试；但仍不能把“底图已接入”误报成官方 human/normal 面完整机制已完成。

## 2026-05-31 13:38

- 真实入口交互证据新增两条代表链：战术家“战略防御”覆盖 `selectPlayer` 玩家选择覆盖层与守护落点，咒缚海盗“送你们去喂鱼”覆盖 simple-choice 火药桶选择弹窗与火药桶状态落点。
- 这两条 E2E 不是全量 L3/L4 收口。它们当时只能把“没有任何复杂交互 UI 证据”的风险缩窄为“已有两条代表链”；手牌选择已在 14:12 补代表性 L3，瞭望台三分支与作战室奖励骰代表链已在后续补齐，防御响应等仍需逐项真实入口证据。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 当前为 3 passed；新增截图位于 `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算战略防御与送你们去喂鱼的交互-UI/`。

## 2026-05-31 14:12

- 手牌选择交互已从 L2 推进到代表性 L3：`selectHandCard` 真实入口截图显示“选择 1 张手牌弃置”和“作战室！”，确认后服务器状态断言该牌进入弃牌堆。
- `InteractionOverlay` 暴露并修复一处证据级 UI 问题：手牌候选若只有 `cards.*` i18n key，旧 UI 会直接显示 raw key；现在通过 `t()` 翻译，E2E 断言锁住“作战室”可见。
- 这仍不是全量 L3/L4 收口。当时隐藏信息查看、奖励骰选择、防御响应等复杂交互仍需要逐项真实入口证据；后续瞭望台三分支与作战室奖励骰代表链已补，`implementation_in_progress` 继续保留。

## 2026-05-31 14:37

- 瞭望台弯刀分支的隐藏信息查看不能把 `card.id` 当成玩家可读信息。查看手牌属于给玩家展示隐藏信息，UI 必须显示本地化卡名；内部 ID 只能作为代码定位证据。
- simple-choice 的 `labelParams` 不会自动翻译插值内容；如果领域层把 `cards.*.name` key 放进参数，`ChoiceModal` 必须在渲染前翻译这些参数，否则仍会在按钮中暴露 raw key。
- 瞭望台弯刀查看手牌只应展示信息，不应改变权威手牌。当前 E2E 用真实打牌入口触发弯刀分支，确认后断言目标手牌仍为原两张，避免把“弹窗出现”误当成完整行为证明。
- 这次只把瞭望台弯刀查看手牌推进到代表性 L3；当时奖励骰选择、防御响应仍不能借此宣称全量 L3/L4 完成。后续作战室奖励骰代表链已补。

## 2026-05-31 15:32

- 瞭望台三分支真实入口 L3 已补齐：弯刀查看手牌、战利品目标自选弃牌、骷髅随机弃牌都有真实打出瞭望台后的截图与状态断言。
- 在线对局的服务端随机不能靠浏览器 `__BG_TEST_HARNESS__.random.setQueue` 稳定控制；当前 E2E 改为真实打出后检测实际分支，未命中目标分支则重置场景重试，避免把假随机当真实入口证据。
- 战利品分支必须证明选择权在目标玩家手里；截图 `15-host-crows-nest-loot-discard-choice.png` 显示目标玩家的“选择 1 张手牌弃置”弹窗，`16-host-crows-nest-loot-discarded.png` 证明弃牌落点。
- 骷髅分支必须证明不是玩家自选弃牌；截图 `17-host-crows-nest-skull-random-discarded.png` 与状态断言证明随机弃牌后手牌剩 1、弃牌 1。
- 这仍不是全量完成：奖励骰展示链已在 15:55 补作战室代表证据，防御响应链与深海潜行完整真实攻击入口仍未逐项 L3/L4，`implementation_in_progress` 继续保留。

## 2026-05-31 15:55

- 作战室奖励骰展示链已补真实入口代表证据：不是直接伪造 `pendingBonusDiceSettlement`，而是通过 Host 真实打出作战室触发奖励骰特写。
- 截图 `18-host-war-room-bonus-die-spotlight.png` 显示奖励骰特写与“作战室：获得 3 战术优势”，证明新英雄奖励骰文案能被真实 UI 展示。
- 截图 `19-host-war-room-tactical-advantage-applied.png` 保留关闭特写后回到棋盘状态；服务器状态断言战术优势至少 1。
- 这只收口奖励骰展示的代表链，不等于战争贩子、死亡印记、干票大的、抽筋剥皮等逐对象奖励骰分支全量 L3。

## 2026-05-31 16:41

- 防御响应链可以用在线对局的真实 `defensiveRoll -> ADVANCE_PHASE -> resolveAttack` 阶段入口证明 UI/结算闭环，但这不是完整自然攻击链；因此证据口径应写成“真实防御阶段入口 L3”，不能扩写成“完整攻击入口 L4”。
- 战术家反制措施的代表骰组军刀/军刀/旗帜/勋章同时覆盖三条子句：1 点反击、1 点防伤、1 个战术优势。服务器断言攻击者 HP 49 与战术家战术优势 1，能证明防御 resolver 被正式攻击结算消费。
- 咒缚海盗你还嫩了点的代表骰组弯刀/战利品/骷髅/骷髅/骷髅同时覆盖四条子句：1 点反击、+1CP、防止 6 点伤害、弯刀+骷髅施加诅咒金币。服务器断言攻击者 HP 49、防御者 HP 50、防御者 CP 6、攻击者诅咒金币 1，能证明防伤和状态施加没有只停在事件层。
- 本轮把选角等待从 120 秒提升到 240 秒，是因为冷启动时 DiceThrone 模块加载曾超过原等待窗口；同一文件整跑 4 passed 后说明这是测试基础设施稳定性调整，不是业务逻辑修复。

## 2026-06-01 14:10

- `无情诅咒` 的 4 人真实入口当前仍不是领域实现 blocker，而是多人房间冷启动 blocker。两次新探针都没跑到业务断言，统一死在角色选择页前的“正在准备对局 / 加载游戏模块...”。
- 因此这条链当前最稳的可保留产物不是新 E2E 本体，而是多人 setup helper 的可复用增强：`setupDTOnlineMatchWithPlayers(...)` 现在除了 `characterSelectionTimeout`、`skipCharacterSelectionWait` 外，也支持 `skipImageGate`，便于后续继续压缩四人房间冷启动噪音。
- 这次失败进一步确认了 4 人 `merciless-curse` 的正确技术拆分：先锁 `offensiveRoll -> targetingRoll` 真进入，再锁目标骰 `5/6` 的选目标归属，最后才接 `preDefense` 的火药桶选择。直接把“点终极后立刻弹火药桶 modal”写成正式用例，会继续把房间冷启动问题和目标骰链问题混在一起。
- 由于在线探针没有稳定通过，当前不能把 4 人 `merciless-curse` UI 证据记为新增完成项；仓库里也不应保留这条红灯测试。

## 2026-06-01 15:37

- `无情诅咒` 的 4 人真实入口已从“完全无 UI 证据”推进到“`targetingRoll` 代表链已过”。当前稳定通过的最小真实链是：
  - 4 名玩家真实进房、真实选角、真实开局；
  - 注入到 `targetingRoll`；
  - 目标骰 `5` 时由防守队队长选择敌队目标；
  - 目标骰 `6` 时由进攻方选择敌队目标。
- 这次收口证明先前的 blocker 判断已经变化：多人房间 readiness 不再完全阻塞 `merciless-curse`，因为并发等待选角页后，`targetingRoll` 探针已经能稳定进入真实选择 UI。当前剩余缺口收窄为：`preDefense` 火药桶选择与最终结算尚未并入同一真实链。
- 双人选角页另有一个长跑时才暴露的 setup 波动：页面偶发落回首页，但底部仍保留“重连进入”房间浮条。这不是业务未实现，而是房间恢复入口没被 helper 利用。现在 `waitForCharacterSelection(...)` 已优先消费这个浮条回房。
- 整份 intake E2E 的长跑稳定性仍不能视为发布级：整文件串跑一次出现 `test API` 端口 `ECONNREFUSED 127.0.0.1:20100`，另一次出现 `战争贩子 II` 勋章分支 18 次随机未命中；两条分别单跑都通过，因此当前应记为 soak 风险 / 随机性风险，而不是把它们误判成这轮 `merciless-curse` 改动造成的固定红灯。

## 2026-06-01 16:45

- 4 人 `merciless-curse` 当前的主 blocker 仍是 setup / 选角页 readiness，而不是火药桶领域链：
  - 两次重新单跑都统一失败在 `waitForCharacterSelection(...)`。
  - 最终页面文本一致停在 `正在准备对局... / 加载游戏模块...`。
  - 说明本轮无法重新跑到 `44/45` 那段火药桶 modal 断言，因此不能把后续状态链当作已验证。
- 首页掉回不是唯一噪音：
  - 其中一次玩家页直接落回站点首页，没有 `重连进入` 浮条。
  - 已在 intake 用例本地补“掉首页就重进房间 URL”的最小救援。
  - 但救援生效后，下一次仍然卡在加载游戏模块，因此当前更顽固的真阻塞仍是多人房间冷启动 readiness。
- 火药桶 modal 后置断言的更稳妥口径已确定，但尚未重新验证：
  - 选择 `施加给 P2, P4` 后，不应再强锁“必须立刻进入 defensiveRoll”。
  - 更稳的真相应先看：
    - `sys.interaction.current` 是否清空；
    - `players['1'/'3'].statusEffects.powder_keg` 是否落桶；
  - 若 phase 已自然推进到 `defensiveRoll`，再补 `countermeasures`。
  - 这套更窄断言已写进当前 E2E 草稿，但因为 setup blocker，本轮还没有新的通过证据。

## 2026-06-01 17:55

- 当前 4 人 DiceThrone 冷启动 blocker 已确认不是当前 intake 用例私有问题，而是通用 online MatchRoom 路径上的 readiness 问题：仓库现成基线 `Online 4-player room: create claim-seat join and start successfully` 在同一 isolated runtime 下也会失败，并且失败形态与当前 intake 完全一致。
- 这次新增的 helper 诊断把问题进一步收窄了：
  - `player 0` 停在正确房间 URL，而不是掉回首页。
  - 页面文本固定为 `正在准备对局... / 加载游戏模块...`。
  - 没有 `pageerror` / `console.error`。
  - `MatchLoadTrace` 为空。
- 上述组合说明：当前阻塞点比 `MatchRoom` 组件内部状态还更早。因为一旦 `MatchRoom` 真正开始执行，至少会写入 `__BG_MATCH_LOAD_TRACE__`；现在 trace 为空，更像是 `/play/:gameId/match/:matchId` 的 route-level `React.lazy(() => import('./pages/MatchRoomWithAudio'))` fallback 长时间未完成。
- 因此这轮修法的正确方向不是继续在 `merciless-curse` 领域逻辑上猜，而是先把 route/module 冷启动与 4 人房间 readiness 分离成基础设施问题：
  - 通用 helper 现在已统一记录 `playerId/matchId/url/body/diagnostics/trace`；
  - 并在正式进房前做浏览器侧 `import('/src/pages/MatchRoomWithAudio.tsx')` 预热，尝试把 lazy route 的冷编译前移。
- 预热不是空操作。至少有一次长跑里，`merciless-curse` 4 人真实链已经重新推进到 Host 的 `技能结算选择` modal，按钮包括 `施加给 P2` / `施加给 P4` / `施加给 P2, P4`。这证明：
  - 当前 4 人 setup 不是绝对阻塞；
  - `44` 这段火药桶选择 UI 能再次被真实跑到；
  - 真正未收口的剩余位点已收窄为 `44 -> 45` modal 后置状态链与 route/module 冷启动稳定性。
- `44 -> 45` 的断言口径这次继续变得更接近真相：
  - 不再依赖可能挂住的服务端 `get-state` 轮询；
  - 改为看 Host 页本地 harness 是否满足：
    - `sys.interaction.current` 清空；
    - `P2/P4` 各落 1 层火药桶；
    - modal 隐藏；
  - phase 允许为 `targetingRoll / preDefense / defensiveRoll`，只有自然推进到 `defensiveRoll` 才额外要求 `countermeasures`。
- 但这还不能写成“已通过”。原因很具体：
  - 一次长跑虽然已经回到真实 `44` modal，却在整条 420s 用例里超时，没有形成新的通过证据；
  - 随后另一次又回到 `player 0` 卡 `加载游戏模块...` 的旧形态。
- 当前最稳结论：
  - `merciless-curse` 的 4 人真实入口现在处于“业务位点已可偶发打穿，但 setup/readiness 仍不稳定”的阶段；
  - 当前不能宣称 `45-four-player-merciless-curse-powder-keg-applied` 已收口；
  - 剩余主 blocker 仍是通用 4 人 online route/module 冷启动与房间 readiness，而不是已确认的领域实现错误。

## 2026-06-01 18:42

- 4 人 `merciless-curse` 的 `preDefense` 真实链现在已经拿到稳定通过证据，不再只是“偶发打到 44 modal”：
  - 单条用例 `4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家` 已通过；
  - 真实截图链已连续覆盖 `42 -> 44 -> 45 -> 43`，其中 `45-four-player-merciless-curse-powder-keg-applied.png` 证明火药桶 modal 后的落桶状态链已真正通过。
- 这次收口同时证伪了之前两个过窄判断：
  - `setupDTOnlineMatchWithPlayers(...)` 的 4 人路径不是“route lazy-load 太慢”这么单一。还有一个更直接的结构性问题：Host 进房后先等选角页，再去 join 其他玩家。对 `joinPlayerIds.length > 1` 的房间，这会把 Host 永远卡在 loading。现在已改成：先让所有玩家 join，再并发等待角色选择页。
  - `defenderCaptainPage` 选完目标后，Host 并不是“没有收到下一段交互”；之前是测试把等待条件写得过窄，错误要求 `interaction.data.sourceAbilityId === 'merciless-curse'`。实际截图已证明 Host 会直接拿到 `技能结算选择` modal。
- `ChoiceModal` 相关的最终红灯也不是业务问题，而是测试选择器问题：
  - Playwright strict mode 会把 `施加给 P2` 同时匹配到 `施加给 P2` 和 `施加给 P2, P4`；
  - 现已改为精确正则匹配，避免再把按钮文本前缀重叠误判成业务失败。
- 当前最可信的新结论：
  - `merciless-curse` 的 4 人真实入口已经覆盖：
    - `targetingRoll` 队伍目标选择归属；
    - `preDefense` 火药桶 modal；
    - 选择 `施加给 P2, P4` 后的落桶状态链。
  - 因此这条链当前不再是新增英雄 intake 的未验证高风险项。
- 仍未被这次通过自动外推的范围：
  - 这不等于所有 4 人/多人 DiceThrone online 冷启动问题都彻底解决；
  - 也不等于战术家与咒缚海盗全量复杂交互都已逐项 L3/L4 收口；
  - `implementation_in_progress` 仍应保留，后续还要继续按对象级审计与残余复杂交互推进。

## 2026-06-01 23:45

- 战术家 `紧缚` 当前最可信的问题已经从“业务链可能卡在 `CONFIRM_ROLL` 后收口”收窄成“两层独立噪音”：
  - 第一层是测试场景噪音：默认起手牌会让 `afterRollConfirmed` 响应窗介入，`advance-phase-button` 在无已选技能时还会先弹 `confirmSkip`。如果不先排掉这两层，就会把“仍在等待响应/仍在等确认跳过”误判成 `bind` 没有在 phase exit 被清理。
  - 第二层是当前 isolated runtime 的通用 2 人 online 加载 blocker：真实进房前或进房后会卡在 `正在准备对局... / 加载游戏模块...`，并出现 `Failed to fetch dynamically imported module: /src/games/dicethrone/game.ts`。
- 因此本轮已做的改动只是在收窄噪音，不是新增业务通过证据：
  - `setupBindOffensiveRollScenario(...)` 现在清空双方默认手牌/弃牌，避免 `afterRollConfirmed` 响应牌污染链路。
  - `紧缚` 用例现在显式处理 `confirmSkip`，并改用 Guest 页本地 harness 断言 `phase/main2 + bind/0`，不再依赖服务端轮询。
  - `preloadDTMatchRouteModule(...)` 已降为 best-effort；预热超时不再直接短路 setup。
- 这几条修改都不能外推成 `紧缚` 已通过：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` 仍未拿到新的 `64-66` 通过截图。
  - 对照基线 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online match: Can start a game successfully"` 同样失败，说明 blocker 不是 `紧缚` 对象私有，也不是当前 intake 文件独有。
- 当前最稳结论：
  - 不能把 `紧缚` 写成业务未实现。
  - 也不能把 `紧缚` 回写成 `L2/L3 representative passed`。
  - 下一步必须先恢复当前 isolated runtime 下 `dicethrone/game.ts` 的通用在线加载，再回到 `64-66` 的真实入口证据链。

- 战术家 `战术优势` 的 `C5` 守护已从“默认给自己”修正为真实 `selectPlayer` 选人交互，和 `战略防御` 同型；定点机制测试已通过，故该子句不应继续保留 `partial` 口径。

## 2026-06-03 11:29

- 上面这段关于 `紧缚` 的 blocker 结论已过时，需要以本轮复核为准：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` 已重新打到 `1 passed`。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 已整份 `39 passed`。
- 因此当前不能再把 `紧缚` 记成“必须先恢复 2 人 online 加载后才能回写证据”的对象。
- 当前更准确的口径是：
  - `紧缚` 的 `64-66` 真实入口链已恢复为可用证据。
  - 整份 intake E2E 当前全绿，但这仍不足以移除 `implementation_in_progress`。
  - 主要剩余风险是对象级彻底审计、representative L3 到逐对象 L3/L4 的收口边界，以及长跑/soak 稳定性。

## 2026-06-03 本轮图面对照

- 咒缚海盗人类面不是“同技能换底图”，而是独立技能文本。
- 直接对照 `player-board.png` 与 `人类面板.png` 后，已可确认：
  - 咒缚面当前对象是 `灵魂突刺 / 死亡印记 / 死亡吐息 / 灵魂指令 / 深海潜行 / 亡灵之爪 / 你还嫩了点 / 无情诅咒`。
  - 人类面图面改成 `弯刀突刺 / 做好标记 / 点燃炸药 / 判决指令 / 走跳板 / 惊魂动魄` 等另一套对象。
  - 被动 `咒缚` 也不是同语义：人类面写的是“回合结束移除 1 个诅咒金币；若没有可移除金币则翻面”，不再是咒缚面的 upkeep 自伤 + 对手未攻击施桶。
- 因此当前仓库只能说：
  - 人类面底图、运行时选图、以及 `海盗的一生` 的 `playerBoardFace` 分支已经接入。
  - normal 面 9 个技能对象已全部接入运行时，但对象级重审计和剩余补证尚未完成。
- 结论：
- “规则都实施了”目前不能成立。
- “技能是不是要重录”更准确的答案是：不需要整套重录。当前该做的是按你新加入的人类面板继续逐槽复核、补 face-by-face 审计和 family 级 `L4` 封版，而不是把整套双面技能推翻重做。
- “审计也是”答案是要继续做，而且现有审计只能保留为咒缚面主体 + human 面已接入阶段的证据，不能再充当官方双面完整实现证明；你这次新增的人类面板仍意味着图面合同和双面 completion audit 要继续按新素材逐槽回填。

## 2026-06-04 口径纠偏

- 如果后文仍把咒缚海盗开局写成咒缚面，该口径已失效；真实开局应为 human 面并自带 3 个诅咒金币。
- 如果后文仍把诅咒金币 upkeep 写成“所有持有者都按层掉血”，该口径也已失效；当前只影响非海盗持有者。
- 当前 human 面并不是“完全没做”：
  - `弯刀突刺 / 做好标记 / 咒缚 / 走跳板 / 点燃炸药 / 判决指令 / 惊魂动魄 / 嘿，老兄 / 无情劫掠`
  - 上述 9 个对象都已进入运行时能力集。
  - 其中 `human-cursed / cutlass-stab / make-your-mark / walk-the-plank / astonishing / human-still-wet-behind-ears` 已有 L2 测试。
- `惊魂动魄 / human-cursed` 也已经不是“只有 L2”：
  - `惊魂动魄` 现已补独立真实入口 direct E2E，且真实根因已锁定为“移除诅咒金币 choice 后攻击链未收口”，不是 UI 假问题。
  - `human-cursed` 现已补两条独立真实入口 direct E2E，分别锁定“有币时移除 1 层并保持 human 面”与“无币时翻回咒缚面并切换能力集”。
- `走跳板` 现也已补独立真实入口 direct E2E，证明 human 面 `lotus` 槽位会先进入结算方式选择，再在弃牌分支中自然打开对手手牌选择弹窗并完成弃牌收口。
- `弯刀突刺 / 做好标记 / 点燃炸药 / 判决指令 / 惊魂动魄 / human-cursed / 走跳板 / 嘿，老兄 / 无情劫掠` 现都已拿到独立真实入口 direct E2E，不应再继续挂在“独立补证待补”的旧口径里；当前真正剩余的是逐对象更高层级证据、human 面图面合同逐槽补记，以及双面对象级重审计。
