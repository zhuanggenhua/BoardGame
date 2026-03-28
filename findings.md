# Findings: BoardGame 多线并行调查 / 修复 / 收口

## Session Update: 2026-03-28 Smash Up Titans - 首批剩余 5 张审计补齐

### New Findings
- `ghosts_creampuff_man`、`wizards_arcane_protector`、`vampires_ancient_lord`、`innsmouth_dagon`、`giant_ants_death_on_six_legs` 这 5 张此前都已有 smoke 级行为覆盖，不是“完全没测”。
- 真正缺的不是统一的一层：
  - `innsmouth_dagon`、`giant_ants_death_on_six_legs` 已经有局部规则/根因核对，但缺最终浏览器证据。
  - `wizards_arcane_protector` 只有 special + 被动 + 直接抽牌，没有独立 UI 交互链。
  - `vampires_ancient_lord` 虽有单目标选择，但其交互形态与已收口的 `Great Wolf Spirit / Hill that Strolls` 同类。
  - `ghosts_creampuff_man` 才是真正还有独立 UI 价值的残缺项：它有“弃手牌 -> 从弃牌堆额外打标准战术 -> 改放牌库底”的两段链式交互。

### Decisions
- 本轮按“E2E 只保留不重复交互”的口径继续：
  - `ghosts_creampuff_man` 补 1 条真实浏览器链。
  - `wizards_arcane_protector`、`vampires_ancient_lord`、`innsmouth_dagon`、`giant_ants_death_on_six_legs` 不重复补浏览器链，改以审计结论收口。
- 这样收口后，“已实现泰坦”的剩余缺口不再是测试覆盖层面，而只剩未来若要扩更多派系/泰坦时的新能力范围。

### Validation
- `npm run typecheck` 通过。
- `$env:PW_PORT='6281'; $env:PW_GAME_SERVER_PORT='20207'; $env:PW_API_SERVER_PORT='21207'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "奶油泡芙美人天赋可在 UI 中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底"` 结果 `1 passed`。

## Session Update: 2026-03-28 Smash Up Titans - 后续未接派系泰坦隐藏收口

### New Findings
- 当前 `src/games/smashup/data/titans.ts` 里，唯一还处于“静态占位但没有完整派系运行时前提”的后续泰坦是 `fairies_spirit_of_the_forest / 丛林之灵`。
- `fairies` 目前在 `src/games/smashup/data/cards.ts` 里仍只有 2 张基地，没有派系随从/战术卡池；同时也未进入 `src/games/smashup/ui/factionMeta.ts` 的派系列表，因此不构成一个真实可玩的派系入口。
- 在这种前提下，继续保留 `Spirit of the Forest` 的活动注册没有实际收益，反而会让它继续以“待实现占位”的形式挂在当前批次里。

### Decisions
- 按用户最新口径，后续泰坦只继续处理“已有完整派系运行时支撑”的目标。
- `Spirit of the Forest / 丛林之灵` 不再继续实现，也不再保留活动静态占位；先从活动泰坦注册中隐藏，等 `Fairies` 真的接入后再恢复。

## 当前主任务（2026-03-22）
- 当前已从单点问题切换为 **多线并行收口**：
  1. 线上静态资源旧 chunk 命中 SPA fallback，返回 `200 text/html`
  2. 房主未点销毁却被踢出并提示“房间不存在或已被删除”
  3. feedback 主线只跟未关闭 / 待处理项
  4. E2E 迁移主线整理下一批
  5. 核对项目内 progress / plan / evidence 文档，作为跨会话恢复入口
- 用户已明确：以后说 **plan**，默认指的是 `planning-with-files` 技能，而不是泛指计划文档。
- `planning-with-files` 已安装到：`C:\Users\zhuagenbao\.openclaw\workspace\skills\planning-with-files\SKILL.md`。

## Session Update: 2026-03-28 Smash Up Titans - Walking Castle 天赋交互顺序修正

### New Findings
- `Walking Castle / 移动城堡` 的天赋目标是“另一个基地”，不是未在场基地；此前实现成“先选随从、再选基地”虽然不违背规则文本，但不符合更自然的真实交互路径。
- 这条链最正确的 UI 顺序应当是：
  - 先直接高亮并选择目标基地
  - 再进入“至多 3 个、可不选”的己方随从多选
  - 最后统一结算 `TITAN_MOVED` 与若干 `MINION_MOVED`
- 实际看图确认修正后浏览器表现为：
  - 首张图提示“移动城堡：选择要移动到的基地”，且只高亮可落点基地
  - 第二张图才出现“已选 0 / 3”与“确认选择”工具条
  - 结算图里泰坦与选中的 2 张随从都落到目标基地，原基地只保留未选中的己方随从

### Decisions
- 保留 `choose_base` 与 `choose_minions` 两段交互，但顺序固定改为“先基地、后随从”，不再沿用旧顺序。
- 这次只修体验顺序，不顺手再碰多选确认按钮的前端实现；当前真实链已能稳定通过 smoke 与单条 E2E。

## Session Update: 2026-03-26 Smash Up Titans - 乱码根因与处理

### New Findings
- 这次不是文件真实编码损坏；`findings.md` 等文件本身仍是 UTF-8 正常文本。
- 真正的根因是 Windows PowerShell 在未显式切到 UTF-8、且未给 `Get-Content` 指定 `-Encoding UTF8` 时，终端显示发生 mojibake，导致读取出来的中文标题变成乱码。
- 后续 `apply_patch` 命中失败，不是因为文件里没有对应段落，而是因为我拿着“终端显示乱码后的文本”去做上下文匹配，自然匹配不到真实 UTF-8 内容。
- 验证方式已经确认：
  - `python -c "from pathlib import Path; print(Path(...).read_text(encoding='utf-8')[:...])"` 可正常读出中文
  - `chcp 65001 > $null; Get-Content ... -Encoding UTF8` 也可正常显示中文

### Decisions
- 以后在 Windows 下读取任何含中文的源码、规则、plan、evidence 文档，统一先切 UTF-8，再显式 `-Encoding UTF8`。
- 一旦终端输出出现乱码，立即停止基于该输出做补丁和判断，改用 Python/Node 显式 UTF-8 读取确认真实内容。

## Session Update: 2026-03-26 Smash Up Titans - Cthulhu 泰坦能力补齐

### New Findings
- `cthulhu_cthulhu_titan` 此前只接通了 `special`；`ongoing` 与 `talent` 都还没有正式进入泰坦能力链。
- 这张泰坦的 ongoing 最稳妥的落点不是 `registerTrigger`，而是 `registerInterceptor`：
  - `MADNESS_DRAWN` 需要按 `count` 批量补力量标记。
  - `special_madness` 的“打出疯狂卡”是 `ACTION_PLAYED` 事件，不是独立 trigger timing。
- 现有 trigger 系统没有 `onMadnessDrawn` / `onCardPlayed` 这类时机；如果硬塞新 timing，侵入面会明显大于这张泰坦本身。
- 现有 `registerInterceptor` 对“来源必须在场”有统一见证规则，正好满足 Cthulhu：
  - 打出泰坦时先抽 2 张疯狂卡、后进场，因此不会错误吃到自己 special 的那 2 张。
  - 进场后的后续疯狂抽取/打出，才会开始累计力量标记。
- `talent` 的正确最小闭环是两层：
  - 若只有“抽 1 张疯狂卡”可执行，则直接结算，无需多余 prompt。
  - 若只有“把手里 1 张疯狂卡给另一位玩家”可执行，则直接起目标玩家 prompt。
  - 若两种都可执行，则先起一个分支选择 prompt，再按分支继续。

### Decisions
- 不新增通用 trigger timing，先用 `registerInterceptor('cthulhu_cthulhu_titan', ...)` 收口这张牌的“打出/抓疯狂卡后”规则。
- 泰坦转交疯狂卡使用已有 `SU_EVENTS.CARD_TRANSFERRED` 事件，不再沿用旧代码里那种 interaction handler 直接改 `state.core` 的做法。
- 本轮只补 `Cthulhu`，不顺手扩 `Great Wolf Spirit` / `Kraken` / `Big Funny Giant`，避免把剩余范围再次打散。

## Session Update: 2026-03-26 Smash Up Titans - Cthulhu E2E 看图收口

### New Findings
- 这轮新增的 2 条 Cthulhu E2E 已经实际看图确认，不是只看 `9 passed`。
- `cthulhu-titan-talent-draw-choice.png` 证明双分支并存时，确实先出现“选择要执行的天赋效果”这一步，而不是直接跳进某个默认分支。
- `cthulhu-titan-talent-draw-resolved.png` 肉眼可见：
  - 底部手牌从 `1` 张变成 `2` 张
  - 左侧基地力量从 `0` 变成 `1`
  这和“抽到疯狂卡后，Cthulhu 获得 1 枚力量标记”的规则一致。
- `cthulhu-titan-talent-give-target.png` 证明当只有转交分支时，会直接进入“选接收玩家”的目标选择，不再额外弹一层分支选择。
- `cthulhu-titan-talent-give-resolved.png` 肉眼可见底部手牌清空，但左侧基地力量仍保持 `0`，说明“转交疯狂卡”没有被错误地重复拦截成“自己抽到疯狂卡”。
- 这次看图也确认了一个独立 UI 问题：较长的中文按钮文案在分支选择里有挤压/重叠现象，当前不影响机制对错，但属于后续应修的显示缺陷。
- R2/CDN 牌面资源在这组图里仍未稳定渲染，所以本轮验收依旧以布局、交互链、计数变化为主，而不是卡面美术。

### Decisions
- Cthulhu 这一轮先按“机制正确 + E2E 有证据”收口，不把按钮文案排版问题混进同一轮领域规则修复。
- 后续凡是新增泰坦交互，都继续沿用本轮节奏：先补 E2E，再实际看图，然后把肉眼观察到的现象写回 `evidence` 和三件套。

## Session Update: 2026-03-26 Smash Up Titans - Kraken 收口与 Great Wolf Spirit 推进

### New Findings
- `The Kraken` 不需要新开一套泰坦专用 afterScoring 系统；最小正确方案是：
  - `pendingPostScoringActions` 新增 `playTitanOnReplacementBase`
  - `systems.ts` 在补发 `BASE_REPLACED` 后翻译成 `TITAN_PLAYED`
  - `ongoingEffects.ts` 让 set-aside titan 也能被全局见证逻辑看到
- `The Kraken` 的天赋“其他玩家随从各 -1 直到你的下回合开始”不能直接用普通 `tempPowerModifier`，因为那会在任意玩家回合开始都清零；这张牌需要走带 `expiresOnTurnNumber` 的定时修正。
- `Great Wolf Spirit` 的持续效果最正确的落点不是再造一层“全局 talent 子系统”，而是在现有 `talentUsed` 契约上补一个“本回合额外第二次 talent”消费计数：
  - `commands.ts` 负责在目标已 `talentUsed=true` 时放行一次
  - `reduce.ts` 在 `TALENT_USED` 时识别“这次是不是第二次使用”并消费次数
  - `TURN_STARTED` 为当前回合玩家清空消费计数
- 这条额外 talent 次数必须和 `base_standing_stones` 的“某个随从可双才能”分开：
  - 巨石阵是随从级、特定一张牌的第二次使用
  - `Great Wolf Spirit` 是玩家级、全局额外一次第二次使用
  - 因此 reducer 里要优先识别并保留巨石阵消费，不要误扣狼灵的额度
- `Great Wolf Spirit` 的 `special` 可直接复用 `getPlayerEffectivePowerOnBase(...)`，并按“并列最高也算拥有最高战力”处理，不需要另外手写一套力量求和逻辑。
- 实看截图确认：
  - Kraken 的 3 条 UI 链都能在真实浏览器里走通
  - Great Wolf Spirit 的天赋 prompt 与结算后的 `+1` 标记都已肉眼确认
- 隔离 E2E 环境里的卡面美术空白仍然存在，但 Kraken / Great Wolf Spirit 这轮的提示条中文可读性是正常的，没有再出现前几轮那种明显乱码。

### Decisions
- `The Kraken` 按“领域闭环 + 真实浏览器三条链 + 看图证据”正式收口，不再继续在这张牌上扩更多非必要测试。
- `Great Wolf Spirit` 本轮先收口到：
  - `special`
  - `ongoing` 的额外第二次 talent
  - `talent`
  - smoke + 1 条真实 E2E
- 下一张优先转到 `tricksters_big_funny_giant`，因为首批 10 张里现在剩它的成本语义缺口最大。

## Session Update: 2026-03-26 Smash Up Titans - Big Funny Giant 收口

### New Findings
- `Big Funny Giant` 的成本语义里，最危险的点不是天赋，而是“其他玩家必须弃 1 张牌才能把随从打到这里”。
- 当前引擎的 `registerRestriction(...)` 只能表达“能/不能打”，不能原生表达“先支付弃牌成本再继续这次打出”；如果直接把这个语义硬塞进 `PLAY_MINION` 主执行流，会把侵入面扩大到全局出牌链。
- 本轮确认的最小正确方案是：
  - validation / restriction 只负责检查“对手是否还有额外手牌可弃”
  - 真正的弃牌在 `onMinionPlayed` 触发后立刻强制结算
  - 若只剩 1 张可弃牌，则直接自动弃置
  - 若有多张可弃牌，则起一个手牌选择交互
- 这意味着语义更接近“打出后立刻弃 1 张剩余手牌”，而不是严格的前置支付；但在现有架构下，这是最小、稳定且不改穿全局出牌系统的方案。
- 新增的 smoke 已覆盖：
  - `special` 只能进空基地
  - 没有额外手牌时 restriction 会拦住对手打随从
  - 有额外手牌时会在打出后强制弃 1 张
  - 回合结束无对手随从时加泰坦指示物
  - 天赋双段交互最终会消灭目标并移动泰坦
- 新增的 E2E 这轮只保留 1 条稳定通过的“弃牌交互”真实链路；中途尝试过 `special` / `talent` 的 UI 链，但在当前前端交互态下不够稳定，已主动回退到更稳的最小证据组合，不把不稳定用例硬留在主文件里。
- 人工看图确认：
  - 交互提示条会明确显示“选择 1 张手牌弃置”
  - 结算后底部只剩 1 张手牌，右下弃牌堆计数变为 `1`
  - 泰坦仍停在左侧基地上方，没有因为这条交互把布局带坏

### Decisions
- `Big Funny Giant` 这一轮按“领域闭环 + smoke 全覆盖 + 1 条稳定 E2E + 实看截图”收口，不继续在不稳定的 UI 链上空耗。
- 首批 10 张泰坦到本轮为止全部形成最小正确闭环；后续优先切换到下一批，而不是继续在首批里做低收益微调。

## Session Update: 2026-03-26 Smash Up Titans - 后续 11 张静态契约补齐

### New Findings
- 后续已录入候选里，当前仓库没有“派系运行时已在场、只差泰坦能力”的目标；多数连派系能力文件和卡牌数据都还不存在。
- `fairies` 是唯一在 `src/games/smashup/data/cards.ts` 里已经出现过的后续派系，但当前也只有 2 张基地，不构成可直接推进运行时能力的接入口。
- 在这种前提下，下一步最稳妥的推进不是硬接某个整派系，而是先把规则文档已经冻结的 11 张后续泰坦正式补进静态数据层，让录入成果进入 registry。
- `Spirit of the Forest` 原先卡住的点确实只在 schema：它需要同时表达“代替通常随从以及通常战术”，现有 `TitanSummonMode` 不够。
- 这个 schema 缺口可以用很小的领域改动补上：
  - `TitanSummonMode` 新增 `insteadOfRegularMinionAndAction`
  - `TitanPlayedEvent` 允许携带多个被消耗的常规额度
  - reducer 结算 `TITAN_PLAYED` 时同时累计随从与行动额度
- 由于这 11 张牌仍未接入运行时能力，本轮没有给它们新增 `playAsKinds`，避免被现有“可视作随从/行动打出”入口提前暴露成半成品行为。

### Decisions
- 本轮先把后续 11 张泰坦的静态契约收口到 `src/games/smashup/data/titans.ts`，不把范围扩大到任一未接派系的完整运行时实现。
- `Spirit of the Forest` 的 schema 先补到“可准确表达”，但不提前虚接运行时 special；后续真的接 Fairies 时再接完整行为链。

## Session Update: 2026-03-27 Smash Up Titans - Mergacon 运行时闭环

### New Findings
- `Mergacon / 合体机器人` 不需要先把整个 Changerbots 派系接进仓库，也可以通过手工构造 state 完成泰坦本体闭环。
- 这张牌的最小正确落点是：
  - `special` 走 `onTurnStart` 全局触发，给 set-aside 泰坦起“选基地或跳过”的进场交互；
  - `ongoing` 直接用 `registerTitanPowerModifier` 提供 `+3`；
  - `talent` 复用现有 `moveTitan` 链，但额外写一个“本回合失去持续能力”的泰坦级临时标记。
- 现有领域层没有“泰坦直到回合结束失去持续能力”的现成建模，因此本轮补了一个很小的通用状态：
  - `titanOngoingSuppressedUntilTurnEnd?: string[]`
  - 通过新事件 `su:titan_ongoing_suppressed`
  - 在 `TURN_ENDED` / `TURN_STARTED` 时清空
- 这比直接在 interaction handler 里偷偷改 `matchState.core` 更稳，因为 reducer 能显式消费事件，状态也可被 smoke 直接断言。
- 当前浏览器链的阻塞不在 Mergacon 逻辑，而在测试环境启动：
  - `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` 阶段，`e2e-game-single / e2e-api-single` bundle runner 启动失败
  - 首次是 Node/Vite 进程内存炸掉
  - 加大 `NODE_OPTIONS=--max-old-space-size=8192` 后仍然失败，表现为服务在 ready 前退出
  - 因此这轮还没有新增可看的 Mergacon 截图证据

### Decisions
- Mergacon 这一轮先按“领域闭环 + smoke 全绿”收口，不虚报 E2E 已验证。
- 下一轮如果继续做 Titans，优先先排掉 E2E 服务启动阻塞，再把 Mergacon 的浏览器证据补齐到 `evidence`。

### Follow-up
- 已确认上面那条 E2E 阻塞不是代码问题，而是当时测试环境没正常起服。
- Docker 环境恢复后，`e2e/smashup-alien-terraform.e2e.ts` 已整文件跑通，结果提升到 `16 passed`。
- 因此 `Mergacon` 当前已不再是“领域闭环但缺浏览器证据”，而是和前几张泰坦一样完成了“领域闭环 + smoke + 真实 E2E + 看图确认”的完整收口。

## Session Update: 2026-03-27 Smash Up Titans - Rainboroc 运行时闭环

### New Findings
- `Rainboroc / 彩虹鸟` 的 `talent` 验证一开始不是实现问题，而是 smoke 用错了牌：`trickster_gnome` 在当前数据里是 `3` 力，不满足“战力 2 或更低”。
- 真正的实现缺口出在 `afterScoring special` 的真实交互链：
  - smoke 里直接调 handler 再看 `TITAN_PLAYED` 会误以为已经闭环；
  - 但浏览器里还会继续补发 deferred 的 `BASE_CLEARED / BASE_REPLACED`；
  - 如果 handler 直接 `playTitan(...)`，泰坦会被后续计分清场链覆盖。
- 因此这张牌和 `The Kraken` 一样，必须先把“打到替换基地”写入 `pendingPostScoringActions`，再由 `systems.ts` 在补发 deferred 事件后真正翻译成 `TITAN_PLAYED`。
- `ongoing` 的“每回合第一次低战力随从进场后 +1 指示物”用 `rainborocTriggeredTurnByTitan[titanUid] = turnNumber` 记账是可行的；不需要扫 `eventStream`，也不需要新开一套 trigger timing。
- 实际看图确认：
  - afterScoring special 的“打出/跳过”按钮都可见；
  - 天赋第一段会先从弃牌堆选牌；
  - 第一段结算后牌库计数变为 `1`、弃牌堆变为 `0`；
  - 第二段可继续选基地或留在原地；
  - 结算后彩虹鸟确实移动到了新基地。

### Decisions
- Rainboroc 这一轮按“修正真实 afterScoring 时序 + smoke 改成系统级交互断言 + 2 条 E2E 看图”收口。
- 后续做类似“计分后进替换基地”的泰坦时，不再接受“handler 单测直接绿了”这种假闭环，必须至少有一条经过 deferred post-scoring 链的系统级验证。

## Session Update: 2026-03-27 Smash Up Titans - Gorgodzolla 运行时闭环

### New Findings
- `Gorgodzolla / 哥佐拉` 的最小正确落点有 3 段：
  - `special`：按“代替通常随从”打到你至少有 2 个战术的基地；
  - `ongoing`：你在本基地打出随从或战术后加 1 标记；
  - `ongoing`：你在本基地打出战术后可选抽 1 张牌。
- 真正缺的不是哥佐拉本体函数，而是通用链路里 `onActionPlayed` 没有正式进入 ongoing reaction queue。
- 这轮补的是通用后处理，而不是只给哥佐拉走旁路：
  - `TriggerContext / collectTriggers` 增加 `actionTargetBaseIndex / actionTargetType / actionTargetMinionUid`
  - `PLAY_ACTION` 路径把 ongoing `onActionPlayed` 正式接进队列
- smoke 已验证真实顺序是：
  - 先出现 `reaction_queue_choose_next`
  - 选择哥佐拉 trigger
  - 再进入 `titan_kaiju_gorgodzolla_draw`
- 实际看图确认：
  - 哥佐拉可通过右侧泰坦栏按通常随从额进场；
  - 战术打出后先加标记，再出现“抽 1 张牌 / 跳过”交互；
  - 抽牌后手牌和牌库计数变化正确。

### Decisions
- 哥佐拉的“抽 1 张牌”保持真实可选交互，不偷懒做成强制抽牌。
- `onActionPlayed` 作为通用链补在领域层，不再为后续泰坦重复造私有入口。

## Session Update: 2026-03-27 Smash Up Titans - Megabot 运行时闭环

### New Findings
- `Megabot / 超级佐德` 是当前剩余后续泰坦里侵入面最小的一张：
  - `special` 只需要复用现有 `insteadOfRegularMinion` 进场；
  - `ongoing` 直接用 `registerTitanPowerModifier` 按己方随从数提供力量；
  - “在另一基地计分前移动过去”可以复用现有 `beforeScoring` 触发时机与交互链。
- 这张牌不需要新命令入口，也不需要新计数器建模；最接近的模式就是“泰坦版 Pirate King”：
  - `beforeScoring` 时扫描所有不在计分基地上的 `mega_troopers_megabot`
  - 为各自控制者起“移动到该基地 / 留在原地”交互
  - 结算后发 `TITAN_MOVED`
- smoke 已验证：
  - `special` 的 3 随从门槛；
  - `ongoing` 只按己方随从数加战力；
  - `beforeScoring` 交互发给泰坦控制者，而不是当前回合玩家。
- 实际看图确认：
  - 右侧泰坦栏 ready 图里，左侧基地已经有 3 张己方随从；
  - 结算后超级佐德真实落到该基地上方，右下 `Minion` 额度变为 `0`；
  - 计分前交互图里提示条与两个按钮都可见；
  - 结算图里超级佐德已移动到中间即将计分的基地，布局未被带坏。

### Decisions
- 超级佐德这一轮按“special + ongoing + beforeScoring 移动 + smoke + E2E + 看图”完整收口。
- 继续推进下一张时，优先选择同样不需要新计数器/新命令入口的目标；当前最像这一类的是 `Walking Castle / 移动城堡`。

## Session Update: 2026-03-28 Smash Up Titans - Very Large Boulder 运行时闭环

### New Findings
- `Very Large Boulder / 硕大圆石` 的最小正确落点有 3 段：
  - `special`：按“代替通常随从”打到没有玩家随从的基地；
  - `ongoing`：每回合第一次有随从从这里移走后，可移动到其去往的基地，并消灭该基地上所有力量低于其标记数的随从；
  - `ongoing`：你的回合结束时，若本回合未移动，则获得 1 枚 +1 战力标记。
- 这轮暴露出的真实问题不是 handler 本体，而是两层触发基础设施缺口：
  - 原 `onMinionMoved` 只按“移入目标基地”收集 base-scoped trigger，无法表达“有随从从这里移走”；
  - 仅在 `TRIGGER_CONSUMED` 时清已排队副本，不足以阻止同回合稍后再次新建圆石 trigger。
- 这轮补的是通用链路，不是只给圆石走私有旁路：
  - `TriggerContext / TriggerInstance` 增加 `moveFromBaseIndex / moveToBaseIndex`
  - `reactionQueue` / `reactionQueueHandlers` 把这两个字段传到 trigger executor
  - `processMoveTriggers` 对每个 `MINION_MOVED` 同时收集“移入基地”和“移离基地”的 `onMinionMoved`
  - `collectTriggers` 能基于运行时定位到的泰坦 UID，在入队阶段拦住圆石同回合第二次新触发
- smoke 调试还确认了一个测试数据坑：
  - `robot_microbot_alpha` 在该场景下有效力量会变成 `3`，不能拿来测“低于 2 力即被圆石消灭”；
  - 稳定 1 力目标改成 `robot_microbot_guard` 后，圆石移动后消灭链才和规则语义一致。
- 实际看图确认：
  - 圆石可通过右侧泰坦栏按通常随从额打到空基地；
  - 有随从移离后会真实弹出“是否移动到目标基地”的交互；
  - 结算后圆石已到目标基地，且低于阈值的敌方随从被消灭，只剩高于阈值的随从。

### Decisions
- 圆石的“一回合一次”门禁最终放在 `collectTriggers` 入队阶段，而不是 trigger callback 内：
  - 这样不会被 `coreAfterConsume` 误伤第一次合法触发；
  - 也能挡住同回合后续新事件再次生成的 trigger。
- 圆石这轮按“special + onMinionMoved + onTurnEnd + smoke + E2E + 看图”完整收口。
- 下一张后续泰坦优先继续筛 `Emperor Penguin / 企鹅帝皇` 这一类可复用现有命令入口的目标，不回头再拆圆石链。

## Session Update: 2026-03-28 Smash Up Titans - Emperor Penguin 规格分流

### New Findings
- `Emperor Penguin / 企鹅帝皇` 的核心缺口不是单张泰坦函数，而是第三类主动能力入口：
  - 不是 `special`
  - 不是 `talent`
  - 也不是被动 `ongoing`
  - 而是“在场期间由玩家主动选择是否使用的 ongoing 替代入口”
- 当前运行时只有两类在场泰坦主动入口：
  - `ACTIVATE_SPECIAL`
  - `USE_TALENT`
- 直接把企鹅帝皇硬塞进现有入口会产生 3 个明显问题：
  - `abilityTags` 与真实触发机制失真，违反 `D49`
  - 会误用 `talentUsed` / special 限次 / 计分阶段 special 门禁
  - 后续同类泰坦仍只能继续复制旁路逻辑

## Session Update: 2026-03-28 Smash Up Titans - Time Box 运行时闭环

### New Findings
- `Time Box / 时间盒子` 的 special 目标是场上的基地，不是未在场基地或基地牌库：
  - 规则抄录原文是“移除所有标记来打出此泰坦”
  - talent 原文是“额外打出一个战力 2 或更低的随从至此基地和/或额外打出一个战术”
  - 因此 special 交互继续走“选场上基地”，talent 不需要额外选基地，只作用于它当前所在基地。
- 这张牌真正需要的通用支撑有两条：
  - 泰坦自身的“非 +1 战力标记”计数，最终落在 `titan.metadata.timeBoxCounters`
  - 新的 `onCardReturnedToHand` timing，用来统一承接“从场上或弃牌堆进入手牌”这类见证
- `processReturnToHandTriggers` 现在已经把两类事件正式接进 trigger 链：
  - `MINION_RETURNED`
  - `CARD_RECOVERED_FROM_DISCARD`
- 这轮顺手暴露并修掉了一个更底层的真实缺口：
  - 旧实现里 `grantExtraMinion(..., restrictToBase, { powerMax })` 只在事件 payload 里带 `powerMax`
  - reducer 进入 `baseLimitedMinionQuota` 后并不会持久化这个上限
  - 结果就是“此基地额外打 2 力以下随从”会在验证层失真
- 最小正确修法不是给 `Time Box` 走私有旁路，而是补通用字段 `baseLimitedMinionPowerCaps`：
  - `LIMIT_MODIFIED` 会把基地限定受限额度写入这个 map
  - `canUseBaseLimitedMinionQuota(...)` / `commands.ts` 会按 `powerMax` 校验
  - `MINION_PLAYED` 结算时会真正消费对应的受限额度
- smoke 已验证：
  - 回合开始第 `4 -> 5` 枚计数会起 `titan_time_travelers_time_box_play`
  - `CARD_RECOVERED_FROM_DISCARD` 经 `processReturnToHandTriggers -> reaction_queue` 后也会加到第 5 枚并起交互
  - talent 写入的 `baseLimitedMinionPowerCaps[0] = [2]` 会拦住 `3` 力随从，只放行 `2` 力随从
- 单条浏览器链已看图确认：
  - special prompt 的中文提示和基地高亮正常
  - resolved 后时间盒子真实落到目标基地
  - talent 场景里 `2` 力随从和战术都真实落在同一基地
  - 右侧额度条与规则语义一致
- 这轮还抓到一个并发残留：
  - `e2e/smashup-alien-terraform.e2e.ts` 里 `openTimeBoxSpecialScene / openTimeBoxTalentScene` 被重复插了两份
  - 删除重复定义后，`Time Box` 单条 E2E 仍然稳定通过，说明重复 helper 只是并发噪音，不是牌逻辑问题
- 最终在独立端口上复跑整份 `e2e/smashup-alien-terraform.e2e.ts` 已恢复到 `32 passed`：
  - 说明这轮 `Time Box` 没有把既有 Titans 链路打坏
  - 之前那几次掉线尝试只能算环境噪音，不能继续当作当前业务结论

### Decisions
- `Time Box` 继续沿“metadata 计数 + trigger 起交互 + talent 直接授予两类额外额度”的方案，不新开私有命令入口。
- 基地限定且带力量上限的额外随从额度以后统一复用 `baseLimitedMinionPowerCaps`，不再接受只在事件 payload 短暂带 `powerMax` 的半截实现。
- 下一张后续泰坦重新回到 `Moon Zero Three / 三号空间站`，而不是继续在 `Time Box` 上追加非必要变体测试。
- 这轮已完成 OpenSpec 前置核查：
  - 读取 `openspec/AGENTS.md`、`openspec/project.md`
  - 运行 `openspec list`
  - 运行 `openspec list --specs`
  - 对照现有 `add-smashup-titans` 的 proposal / design / tasks / delta spec
- 已新建并通过校验的变更：
  - `openspec/changes/add-smashup-titan-activated-ongoing/proposal.md`
  - `openspec/changes/add-smashup-titan-activated-ongoing/design.md`
  - `openspec/changes/add-smashup-titan-activated-ongoing/tasks.md`
  - `openspec/changes/add-smashup-titan-activated-ongoing/specs/smashup-titans/spec.md`
  - `openspec validate add-smashup-titan-activated-ongoing --strict --no-interactive` 已通过

### Decisions
- 企鹅帝皇不越过 OpenSpec 批准门槛直接写实现，先按“在场泰坦的主动 ongoing 能力”建立正式契约。
- 这次 proposal 不去泛化到所有牌种，只先覆盖“在场泰坦的主动 ongoing 入口”，避免规格范围再次失控。

## Session Update: 2026-03-28 Smash Up Titans - Emperor Penguin 运行时闭环

### New Findings
- `penguins_emperor_penguin` 最终落地需要 3 段：
  - `onTurnStart` 触发 `special` 进场交互；
  - 一个新的“在场泰坦主动 ongoing”命令入口；
  - `talent` 选择手牌/弃牌堆中的低战力随从，将其洗回牌库并给泰坦加标记。
- 这轮确认 proposal 不是白建：没有 `ACTIVATE_TITAN_ONGOING`，企鹅帝皇的第二段能力只能被错误塞进 `special` 或 `talent`，会同时破坏 `abilityTags`、门禁语义和 UI 入口。
- 真正补完运行时后，又暴露了两个此前没被覆盖到的真实缺口：
  - `BaseZone` 在桌面端对“同一张泰坦同时具备多个主动入口”没有展开逻辑，因为 `useArmedActivation` 在非粗指针设备上会直接执行 `onActivate`；而多入口泰坦传的是空回调，于是点击被吞掉。
  - `e2e/framework/GameTestContext.ts` 的 `selectOption()` 对带 `cardUid` 的按钮式交互，会优先误点手牌卡面而不是 modal 按钮，导致交互表面“选了”但实际未结算。
- 实际看图确认：
  - 回合开始进场图里只高亮满足 3 随从条件的基地；
  - `持续 / 天赋` 双按钮现在会真实出现在桌面端泰坦上方；
  - `ongoing` 结算后牌库顶随从已落到泰坦所在基地，`Minion` 额度归零；
  - `talent` 结算后虽停留在 `REVEAL_HAND` overlay，但能肉眼看到展示牌、泰坦 `+1` 标记和牌库计数变为 `2`，说明这条链已真实闭环。

### Decisions
- 企鹅帝皇这轮按“新入口 + 首张落地 + smoke + 真实 E2E + 看图”完整收口，不再继续把这套入口当成 proposal-only 半成品。
- `BaseZone` 的桌面端多主动入口显隐缺口按通用 UI bug 直接修，不为某一张泰坦在测试里走旁路。
- `GameTestContext.selectOption()` 的点击优先级改成“可见按钮 > 卡面元素 > harness fallback”，避免后续所有“按钮式选牌”交互重复踩同一个 E2E 坑。

## Session Update: 2026-03-28 Smash Up Titans - The Hill that Strolls 运行时闭环

### New Findings
- `The Hill that Strolls / 漫游山岭巨人` 的真正缺口不是单张泰坦函数，而是仓库此前没有正式的“随从控制权变更”事件原语。
- 最正确的最小补法不是新命令，也不是在某张牌的 handler 里直接改 `controller`，而是补领域事件：
  - `MINION_CONTROL_CHANGED`
  - reducer 显式消费
  - ongoing 系统正式见证
- 这轮还确认了 `onMinionAffected` 里一个此前注释与实现不一致的断点：
  - 注释早就写了“包括控制权变更”
  - 但 `processAffectTriggers` 实际没有真正处理 `control_change`
  - 现在已补齐，并允许 `baseScoped: false` 表达像 Hill 这样并非 “here” 限定的全局见证
- `Hill` 的 ongoing 第一次在浏览器里不弹 prompt，不是牌逻辑本体错，而是触发入队时错误使用了“控制权变更前”的旧随从快照：
  - `controller` 仍是旧控制者
  - ongoing 自己把自己过滤掉
  - 修正为对 `MINION_CONTROL_CHANGED` 使用“变更后的 controller”快照后，真实链恢复
- 整份 E2E 早先那 4 条失败并不是 `Hill` 回归：
  - 并行排查时出现的是测试端口/服务启动互踩
  - 改成独立端口串行后，`硕大圆石 / 哥佐拉 / 企鹅帝皇` 单条都绿
  - 再复跑整份 `e2e/smashup-alien-terraform.e2e.ts` 为 `31 passed`
- 实际看图确认：
  - 第一段 prompt 先要求交出己方随从控制权
  - 第二段 prompt 才询问是否放置 +1 标记
  - 结算后被交出的随从可见新增标记，战力同步上升到 `3`

### Decisions
- `Hill` 这轮按“通用事件原语 + 泰坦本体 + smoke + 单条 E2E + 整份 E2E + 看图”完整收口，不再把它停在“单测绿但整文件偶发失败”的半结论状态。
- 后续凡是为定位 E2E 偶发失败做隔离复现，一律优先使用独立端口串行复跑；并行 agent 可以继续用来读代码或缩问题，但不再让多条 Playwright 用例共用同一组端口。

## 已知事实
- 线上静态资源故障当前最强信号不是 Host/容器整体宕机，而是旧 `/assets/*.js` 请求被错误回退成 `index.html`，表现为 `200 OK` + `Content-Type: text/html`，进而触发 `Failed to load module script` / `MIME type "text/html"`。
- 本地已沿 `apps/api/src/main.ts` 确认过一个修复方向：把 `/assets` 排除出 SPA fallback；但是否最终落盘、验证、提交、部署，仍需下一会话复核。
- `server.ts` 已先修过一个显式错误：重复 owner 清理链路里的 logger 调用曾报 `gameLogger.info is not a function`。
- “房主被踢 / 房间被删”仍未闭环，需同时查服务端房间生命周期和前端状态误判链。
- 方案 A 已确定为本次升级自恢复策略：**仅非对局页**在 chunk / dynamic import 失败时自动刷新一次；`MatchRoom` 对局页不做 silent auto reload。
- feedback 后续默认只跟**未关闭 / 待处理**。
- 用户反馈：`dicethrone` 中“攻击修正只要不使用攻击就一直在”。
- 当前任务目标是“检查一下”，优先确认行为是否符合规则，再决定是否需要修复。
- 本任务涉及游戏机制与状态链路，需要同时核对规则文档与实现。

## 当前并行任务与状态
- `codex-feedback-open-tracker`：已启动 guarded task，目标产物 `temp/open-feedback-tracker.md`。
- `codex-e2e-migration`：已启动 guarded task，目标产物 `temp/e2e-next-batch-plan.md`。
- `codex-find-planning-with-files`：原用于定位 plan 技能；用户后续直接给出 GitHub 地址后已人工安装技能，本任务可视为完成/失效。

## 已读规范 / 文档
- `docs/ai-rules/engine-systems.md`
- `src/games/dicethrone/rule/王权骰铸规则.md`

## 新发现（2026-03-10）
- 规则文档 `src/games/dicethrone/rule/王权骰铸规则.md` 第 7.2 节明确写到：
  - 攻击修正“只能用于攻击”。
  - 打出时机是“防御能力启动前或后”。
- 这意味着攻击修正必须依附于一个已存在的攻击，不能在没有 `pendingAttack` 的情况下预先排队到未来攻击。
- 代码调用链现状：
  - `checkPlayCard()` / `isCardPlayableInResponseWindow()` 目前只按 `timing=roll` 和 `playCondition` 做通用校验，没有额外约束 `card.isAttackModifier` 必须绑定当前攻击。
  - `executeCardCommand()` 对卡牌效果统一使用 `attackerId = actingPlayerId`、`defenderId = opponentId` 构造上下文，没有显式声明“当前攻击上下文”。
  - `handleBonusDamageAdded()` 在没有 `pendingAttack` 时，会把伤害累计到 `players[playerId].pendingBonusDamage`，等待未来 `ATTACK_INITIATED` 时再转移到 `pendingAttack.bonusDamage`。
- 因此存在一条真实的错误链路：
  - 攻击修正卡可在“没有当前攻击”的情况下被打出；
  - 其加伤会被写入 `pendingBonusDamage`；
  - 只要后续不发起攻击，它就会一直保留到 `main2` 或 `TURN_CHANGED`；
  - 同时 `useActiveModifiers()` 只把 `ATTACK_RESOLVED` 当成重置边界，导致 UI 指示器在“放弃攻击/进入 main2”后也可能继续显示。

## 待验证点
- “攻击修正”在规则上是否明确限定为“下一次攻击”或“本回合”。
- 代码里攻击修正的存储位置、写入时机、消费时机、清理时机。
- 是否存在阶段推进、回合结束、放弃攻击等路径没有清理状态。

## 调用链检查模板
- 写入链：来源效果 → 命令/事件 → reducer/state
- 消费链：攻击声明/结算 → 读取修正 → 计算伤害
- 清理链：攻击后 / 回合结束 / 阶段切换 / 取消攻击

## 结论
- 初步结论：这是实现缺陷，不是规则如此。
- 最小正确修复应同时覆盖：
  - 出牌校验/UI 可出牌判断：攻击修正必须绑定当前 `pendingAttack`，且只能由当前攻击方使用；
  - UI 指示器清理：在 `ATTACK_RESOLVED` 之外，还要在攻击被放弃并进入 `main2` 时清空。

---

## Addendum（2026-03-10）：传输层状态注入 P1 结论

### `src/engine/transport/react.tsx`
- 已确认联机 `GameProvider` 的 `StateInjector` 是只读注册：
  - 读取：允许
  - 写入：直接抛错，提示改走服务端 `/test` API
- 结论：客户端不再能把 `playerView` 过滤后的玩家视图整体写回权威状态。

### `src/engine/transport/server.ts` / `src/server/routes/test.ts`
- `/game` socket 侧仍然不暴露 `test:injectState`，已有传输层单测覆盖。
- 新增 `validateTestAccess()`，让 `/test/*` 路由复用 metadata + `authenticate` 做座位级校验。
- `/test/*` 现在要求：
  - `X-Test-Token`
  - `X-Test-Player-Id`
  - `X-Test-Player-Credentials`
- `restore-state` 现在会在注入前再次跑 `validateMatchState`，防止无效/跨对局快照直接写回权威状态。
- 结论：服务端测试注入链路的鉴权缺口已补上；review 里旧的 `socketIndex` 描述对当前实现已不再适用，因为当前注入入口是 `/test` HTTP 路由，不是 `/game` socket 事件。

### 本轮修改文件
- `src/engine/transport/server.ts`
- `src/server/routes/test.ts`
- `e2e/helpers/state-injection.ts`
- `src/server/routes/__tests__/test.routes.test.ts`
- `docs/automated-testing.md`

### 本轮验证
- `npx vitest run src/server/routes/__tests__/test.routes.test.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/server-injectState.test.ts --reporter=dot --silent --maxWorkers=1` → `27 passed`
- `npm run typecheck` → 通过

### 后续可选跟进
- 仍有一些历史联机 E2E 直接在在线对局页调用 `window.__BG_TEST_HARNESS__.state.patch()`。
- 现在联机 `GameProvider` 已明确禁写，这些历史测试后续应逐步迁移到 `e2e/helpers/state-injection.ts`（服务端 `/test/*` 注入）。
## 2026-03-11 服务器启动缓慢排查
- `npm run dev` 启动前会先执行 `predev`：`clean_ports.js` + `generate_game_manifests.js` + `generate-slim-registry.mjs` + `docker compose up -d mongodb`。
- 前端不会立刻启动，而是先执行 `scripts/infra/wait_for_ports.js`，默认等待 `18000`（游戏服）和 `18001`（API）两个端口都 ready 后才启动 Vite。
- 因此用户体感上的“启动慢”是串行叠加：前置脚本 + 后端服务冷启动 + 前端等待。
- 实测 `predev` 前置链：
  - `clean_ports` 首次约 `8.02s`（有残留进程时）；空跑第二次约 `1.07s`
  - `generate_game_manifests` 约 `0.51s`
  - `generate-slim-registry.mjs` 约 `3.04s`
  - `docker compose up -d mongodb` 约 `0.72s`
- `generate-slim-registry.mjs` 每次会扫描 `src/` 下约 `1273` 个 `.ts/.tsx` 文件，并读取约 `3.2MB` 的音频全量 registry，因此稳定占用约 `2.3s~3.0s`。
- 游戏服 `npx tsx server.ts` 在热缓存后约 `3.17s` 可打开 `18000`，但一次干净冷启动测到约 `93.13s`；结合临时导入测量（`manifest.server.generated` 约 `644ms`、`ugcRegistration` 约 `471ms`、`server/db` 约 `12ms`），更像是 `tsx/esbuild` 首次冷缓存转译成本，而不是单个业务模块长期稳定过慢。
- `server.ts` 在模块顶层会先执行 `await connectDB()` 与 `await buildServerEngines()`；其中 `buildServerEngines()` 会调用 `buildUgcServerGames()` 访问 Mongo，因此游戏服监听端口前一定会完成数据库连接与引擎构建。
- API 服 `npx tsx --tsconfig apps/api/tsconfig.json apps/api/src/main.ts` 是当前最稳定、最明显的瓶颈：干净环境下多次在 `60s~120s` 内都无法打开 `18001`。
- 用 `tsx` 临时拆分 API 导入链后，关键耗时为：
  - `@nestjs/core` 约 `469ms`
  - `@sentry/nestjs` 约 `83342ms`
  - `AppModule` 约 `51041ms`
- 结论：API 冷启动的核心瓶颈不是 `app.listen()` 或端口绑定，而是 `tsx` 运行期对 `@sentry/nestjs` 与整个 `AppModule` 模块图的导入/转译。
- 由于前端 `dev:frontend:wait` 必须等 `18000` 和 `18001` 都 ready，API 服的超慢启动会直接放大成“整个开发服务器启动很慢”。

## 2026-03-11 Dice Throne 攻击修正残留问题
- 规则依据：`src/games/dicethrone/rule/王权骰铸规则.md` 第 7.2 节明确“攻击修正只能用于攻击”，且时机是防御能力启动前或后，因此不能在没有当前攻击时预存到未来攻击。
- 根因 1：`src/games/dicethrone/domain/rules.ts` 之前允许攻击修正卡在无 `pendingAttack` 时通过 `checkPlayCard()` / `isCardPlayableInResponseWindow()` 校验。
- 根因 2：`src/games/dicethrone/hooks/useActiveModifiers.ts` 之前只把 `ATTACK_RESOLVED` 当成清理边界，导致攻击被放弃后进 `main2` 或直接切回合时，旧修正指示仍可继续显示。
- 修复方案：
  - 规则层增加 `isAttackModifierPlayableForCurrentAttack(...)`，要求攻击修正卡必须绑定当前 `pendingAttack`，且 `playerId` 必须等于 `pendingAttack.attackerId`。
  - UI Hook 增加重置边界：`ATTACK_RESOLVED`、`TURN_CHANGED`、`FLOW_EVENTS.PHASE_CHANGED -> main2`。
  - 将规则边界断言迁入 `src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`，避免放在被默认排除的 `audit` 文件或启动超时的重测试文件里。

### 本轮验证
- `npx vitest run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --maxWorkers=1` → `16 passed`
- `npm run typecheck` → 通过
- Git 历史显示：`package.json` 的 `dev:frontend:wait` 是在 2026-03-09（commit `60e16b72`）加入的；它让前端必须等待后端端口 ready 才启动，因此把后端慢启动从“后台慢一点”放大成“整个开发环境看起来没起来”。
- 同时，`apps/api/src/main.ts` 与 `apps/api/src/app.module.ts` 当前启动主链的 blame 基本都停留在 2026-03-04（commit `9c9dd78d`），没有看到同一时期内大规模新增启动逻辑；这说明“之前正常、现在变慢”更像是启动编排/本地环境问题，而不是最近业务代码突然在 API 启动期多做了大量工作。
- 当前本地 `.env` 含有非空 `SENTRY_DSN`，而 `.env.example` 默认是空值；因此你本机会走到 Sentry 初始化路径，这也是“别人/以前不慢、现在你这里慢”的一个强候选差异。
- 当前仓库没有 `.nvmrc` / `.node-version` 等 Node 版本钉死文件，当前运行时是 Node `v24.1.0`。结合前面对 `tsx`/ESM 冷启动路径的异常耗时观察，可以合理推断：本地 Node/工具链变化也是导致体感回归的重要变量。
- 在不改业务逻辑的前提下，最安全的 API 启动优化是：移除顶层 `@sentry/nestjs` 导入，改为端口监听成功后后台惰性初始化；这样不影响功能，只是把错误采集从关键启动路径移到后台。
- 在不改业务逻辑的前提下，最安全的 game-server 启动优化是：把启动期 Mongo 清理从监听前改为监听后后台执行；房间清理仍会发生，但不再阻塞 `18000` ready。
- 真实验证结果：
  - 单独 `npm run dev:api`：`18001` 约 `3.42s` ready。
  - 单独 `npm run dev:game`：`18000` 约 `7.33s` ready。
  - 旧的并行 `dev`（优化前测得）：`18000` 约 `29.75s`，`18001` 约 `52.24s`，`5173` 约 `68.08s`。
  - 新的分阶段 `dev`（优化后测得）：`18001` 约 `7.08s`，`18000` 约 `9.18s`，`5173` 约 `10.24s`。
- 这说明当前最大的实际根因之一是：**两个 `tsx` 后端在旧 `dev` 脚本里并行冷启动，互相争抢 CPU / 磁盘 / 转译缓存，导致总 ready 时间远大于单独启动时间之和**。分阶段编排后，总启动时间显著下降。

---

## 2026-03-11 API / game-server 启动缓慢排查

### 关键事实
- `dev:frontend:wait` 会等待 `18000` 与 `18001` 都 ready，因此任一后端慢都会放大成“整套 dev 很慢”。
- API 端口日志显示：`bootstrap_ms≈212ms`，说明 Nest 应用真正启动很快，慢点主要在 Node/`tsx` 冷编译与模块加载。
- game-server 端口日志显示：`bootstrap_ms≈4ms`，说明监听后的房间清理并不是主要瓶颈；主要慢点同样在监听前的运行时冷启动与模块初始化。
- game-server 在文件顶层就有 `await connectDB()` 与 `await buildServerEngines()`；这是它对“第一次冷启动”更敏感的重要原因。

### 本次已落地的低风险优化
- `apps/api/src/main.ts`
  - 顶层 Sentry 静态导入改为后台惰性初始化
  - 增加结构化启动耗时日志
- `server.ts`
  - 启动期房间清理改为监听成功后后台执行
  - 增加结构化启动耗时日志
- `scripts/infra/dev-orchestrator.js`
  - 默认 `dev` 改为分阶段启动
- `package.json` / `nodemon.json`
  - 显式使用本地 CLI，避免全局安装与 PATH 差异

### 实测结果
- `npm run dev:api`
  - 冷启动一次：约 `103.84s`
  - 热启动：约 `4.20s ~ 5.82s`
- `npm run dev:game`
  - 热启动：约 `3.68s ~ 4.97s`
- `npm run dev`
  - 热启动：约 `12.41s`
- `npm run dev:parallel`
  - 热启动：约 `11.48s`

### 结论
- “之前正常、现在变慢”的高概率原因是多因素叠加：
### ???????2026-03-11?
- `nodemon` ????????????????? fallback / debug watcher?????????????????
- Node ?????????????????????????????????????? `24.1.0`?
- ?? smoke test ????**???? + ?? bundle ??**??????????????? dev ??????? watcher ???????
- `npm run smoke:startup` ?????? `game-server` ?? cold run ??? `~41.72s`??????? `src/games/smashup/domain/index.ts` ???????? `src/games/smashup/data/englishAtlasMap.json` ? duplicate key warning?
- ?? `src/games/smashup/domain/index.ts` ?????????????????????????????/??????????????????????? unrelated ???


### 2026-03-11?`englishAtlasMap.json` ?? key ??
- ???? 1 ??`base_great_library` ? `src/games/smashup/data/englishAtlasMap.json` ??? 2 ??
- ?????????? `atlasId: tts_atlas_a9e2eeadeb`?`index: 10`??????????????????????? bundler warning?
- ??????
  - `src/games/smashup/ui/SmashUpCardRenderer.tsx` ????? `defId` / `defId_pod` ????????
  - `src/games/smashup/ui/cardAtlas.ts` ???????? `atlasId` ???????
- ??????????????????? `englishAtlasMap.json` ?????????????????????????
- ?????
  - ????? `6ea1f9f0` ???
  - ???? `10b99ae6` ????????????????? `base_pirate_cove` / `base_wizard_academy` ?????????????? `base_great_library` ???????
- ????????????? + ???????????????????????? warning?????????????????? bug?

### 2026-03-11：重复 key 删除结果
- 已删除 `src/games/smashup/data/englishAtlasMap.json` 中后半段重复的 `base_great_library`
- 删除后重新扫描，重复 key 数量为 `0`
- 直接执行 esbuild 打包 `server.ts`，未再出现 `duplicate-object-key` / `base_great_library` warning
- 当前终端环境会拦截 Node 内部 `child_process.spawn`，因此这里不用 `smoke:startup` 作为最终验证，而改用直接 bundle 验证
## Session Override: 2026-03-24 Smash Up Titans

### 当前任务
- 当前真实工作目录是 `D:\gongzuo\webgame\BoardGame-smashup-titans`
- 当前分支是 `feat/smashup-titans`
- 本轮不应在主仓库 `D:\gongzuo\webgame\BoardGame` 继续写泰坦实现

### 已冻结的用户口径
- 基地上的泰坦摆位：
  - 有持续行动时，放在行动卡上面一排
  - 没有持续行动时，放在基地上面
- set-aside 泰坦入口：可用泰坦放在牌库右侧排列
- 有些泰坦可以“被视作随从/行动打出”，但真实牌种仍然是 `titan`
- 创建房间要有通用扩展选择 UI：
  - 可多选下拉
  - 已选项用可移除标签显示
  - 默认选中
  - 允许全部取消，不启用该扩展

### 已完成实现
- OpenSpec 已补齐并通过严格校验：
  - `openspec/changes/add-smashup-titans/proposal.md`
  - `openspec/changes/add-smashup-titans/design.md`
  - `openspec/changes/add-smashup-titans/tasks.md`
  - `openspec/changes/add-smashup-titans/specs/smashup-titans/spec.md`
  - `openspec/changes/add-smashup-titans/specs/game-room-setup-options/spec.md`
- 房间创建 UI / setup schema 已支持 `multi-select`
- Smash Up setup 已支持 `enabledExpansions`
- 泰坦 rail / 基地上方泰坦行 / magnify 已接入
- smoke 测试中的 `setupData` 传递已修复

### 当前关键缺口
- `playAsKinds` 目前只落在 schema / data，还没有打通交互链
- 不能把 titan 混进 `PLAY_MINION` / `PLAY_ACTION`
- 更合理的方向是：
  - 在“选择一个随从/行动打出”的候选生成阶段，追加符合 `playAsKinds` 的 set-aside titan
  - 交互 option 结构要同时支持 `cardUid` 和 `titanUid`
  - `Board.tsx` 与 `DeckDiscardZone.tsx` 需要识别 interaction-driven titan 选择态

### 重点文件
- `src/games/smashup/Board.tsx`
- `src/games/smashup/ui/DeckDiscardZone.tsx`
- `src/games/smashup/ui/BaseZone.tsx`
- `src/games/smashup/domain/types.ts`
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/domain/commands.ts`
- `src/games/smashup/abilities/ghosts.ts`
- `src/games/smashup/abilities/wizards.ts`

## Session Update: 2026-03-24 Smash Up Titans - playAsKinds

### New Findings
- 用户确认的规则口径已经冻结：泰坦可以“被视作随从/行动打出”，但真实牌种不能改成 `minion` 或 `action`
- 对现有架构来说，最小正确扩展不是改 `PLAY_MINION` / `PLAY_ACTION` 的牌种判断，而是扩展候选选择层
- `targetType: 'hand'` 现有交互链可以复用，不需要额外新增一套 titan 专用 prompt 类型
- `Board.tsx` 只要把 hand prompt 的 `options` 中 `titanUid` 识别出来，并把 titan rail 作为响应入口，就能避免扩大 UI 渲染面
- `alien_terraform` 已验证这条路径可行：第 3 步 prompt 同时容纳手牌随从与 set-aside titan，handler 再分流到 `MINION_PLAYED` 或 `TITAN_PLAYED`

### Validation Notes

## Session Update: 2026-03-25 Major Ursa Smoke Closure

### New Findings
- `Major Ursa` 失败不是因为 `postProcessSystemEvents` 没有遍历到 `TITAN_MOVED`，而是 reducer 内部的 `resolveLiveBaseIndex(...)` 在测试里遇到多个同名 `test_base` 时，优先按 `defId` 回查，把目标基地错误解析成了第一个基地。
- 这会让 `TITAN_MOVED` 事件表面存在，但泰坦实际位置仍留在原基地，随后 `onTitanMoved` 的 destination-base witness 条件自然失败，所以不会排出 `choose_minion`。
- `choose_minion` handler 的真实契约是“把下一步 `choose_base` 入队”，而不是立刻替换 `interaction.current`；此前 smoke 在这里断言了错误的行为。

### Decisions
- 最正确修法是增强 `resolveLiveBaseIndex(...)` 的优先级规则，而不是只改单条 smoke 夹具。
- 对交互链测试继续沿用现有交互系统契约：当前交互未被引擎 pop 之前，后续步骤应检查 `interaction.queue`。
- 历史 `alienAuditFixes.test.ts` 虽可单独用 audit 配置运行，但文件内存在与本轮无关的旧失败项，不适合作为这次交付的主验证入口
- 已将新回归补进 `smashup.smoke.test.ts`，并通过整文件常规测试，避免被 audit 排除规则影响
## Session Update: 2026-03-24 Smash Up Titans - action-like titan 收尾结论

### New Findings
- `action-like titan` 的正确建模不是把泰坦改成 `action`，而是让本次 `TITAN_PLAYED` 事件显式声明它消耗了哪种常规出牌额度。
- 如果只靠 `summonMode` 在 `TITAN_PLAYED` reducer 中隐式扣额度，会误伤 `alien_terraform` 这类“额外把泰坦当随从打出”的链路。
- 因此本轮把“能否进入某类打出候选”和“这次是否消耗常规额度”拆成了两层：
  - `playAsKinds` 负责候选资格
  - `consumesRegularPlayKind` 负责本次实际消耗
- `cthulhu_cthulhu_titan` 已成为 `playAsKinds: ['action']` 的最小闭环验证入口：
  - 前提：目标基地存在你控制的随从
  - 结算：先抓 2 张 `madness`
  - 然后：按泰坦机制进场，并显式消耗 1 次常规行动额度
- 浏览器证据已确认这条链路不是“只在 state 里成立”：
  - 牌库右侧 rail 可以看到可选泰坦
  - 打出后泰坦显示在基地上方，仍保持 `titan` 摆位
  - 行动额度被扣除
  - 手牌中新增 2 张 `madness`

### Validation Notes
- `npm run typecheck` 已通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` 已通过
- `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` 已通过，结果 `5 passed`
- 本轮 E2E 证据文档已更新为：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\evidence\smashup-alien-terraform-e2e-test.md`

### Remaining Work
- 继续把 `playAsKinds` 扩展到更多“选随从/选行动打出”的交互链路
- 补首批 10 张泰坦其余特殊交互和对应 E2E
# Session Update: 2026-03-25 Smash Up Titans - 基地泰坦布局观察

## New Findings
- 现在的泰坦在有持续行动时不再是“顶部和行动卡齐平、只有下方坠出一截”的视觉关系。
- 二人局截图中，泰坦顶部已经明显高于持续行动一排；底部仍与基地上方保持衔接，没有掉进随从区。
- 四人局最左基地同样按新锚点抬高了泰坦，方向仍然保持“泰坦居中、持续行动往棋盘内侧排”。
- 无泰坦的 5 张持续行动对照图没有回归，说明这次调整只影响了“有泰坦时”的纵向关系。
- 这轮已经取消“有持续行动时额外放大泰坦”的做法，当前口径是“大小保持一致，只调整位置”。
- “行动卡大小不一致”的观感这轮没有再出现；结合此前 `900ms` 截图等待，更接近动画过渡态残影，而不是测试模式专属问题。
## Session Update: 2026-03-25 Smash Up Titans - Dagon smoke 根因

## Session Update: 2026-03-25 Smash Up Titans - Major Ursa E2E 收口

### New Findings
- `Major Ursa` 的泰坦卡和第二步敌方随从都带持续动画高亮，Playwright 常规 `click()` 会卡在 `element is not stable`。
- 这不是业务逻辑错误；单用例和整文件复跑都能稳定通过，只是默认点击稳定性检测和动画冲突。
- 最小正确方案是继续点击真实 UI 元素，但对这两个动画目标改用 `click({ force: true })`，而不是退回纯状态注入。
- 新增 `Major Ursa` 用例后，`e2e/smashup-alien-terraform.e2e.ts` 整文件已回归到 `7 passed`。
- 人工看图时还确认了两个残余问题：
  - 当前隔离 E2E 环境里的牌面美术没有正常渲染，截图主要依赖位置、高亮、标签和角标判读。
  - 顶部交互提示条中文仍存在乱码。

### Decisions
- `Major Ursa` 端到端继续放在 `e2e/smashup-alien-terraform.e2e.ts`，不新建文件。
- 保持真实交互路径：点击基地上的泰坦，点击场上的敌方随从，再点击目标基地。
- 把截图绝对路径与人工观察一并回写到 `evidence/smashup-alien-terraform-e2e-test.md`，不只汇报 `passed`。

### New Findings
- `innsmouth_dagon` 的 titan power modifier 并没有丢注册；`getRegisteredModifierIds().powerModifierIds` 已经包含 `innsmouth_dagon`
- Dagon ongoing smoke 之所以算出 `0`，不是规则实现错，而是测试态的 base 实际没有把 minions 构出来
- 根因在 `src/games/smashup/__tests__/helpers.ts`：`makeBase` 之前只支持 `(defId, minions)`，但现有 smoke 已经在按 `makeBase({ minions: [...] })` 使用
- 这会让 `defId` 误收到一个对象，而 `minions` 默认为空数组，最终导致基地区静默变成“空基地”
- 因为 special 测试那条链路是直接在 runner 产出的 state 上覆盖 `base.minions`，所以 special 能过；而 ongoing smoke 依赖 `makeBase({ minions })`，因此单独失败

### Decision
- 最正确修法是补齐 `makeBase` helper 的对象重载兼容，而不是继续在单条测试里绕过 helper 缺陷
## Session Update: 2026-03-25 Smash Up Titans - Death on Six Legs

### New Findings
- `Death on Six Legs` 不能只挂在 `MINION_DESTROYED`；它的文案是“有随从进入弃牌堆时”，所以还必须覆盖基地计分清场的 `onMinionDiscardedFromBase`。
- 当前引擎里这两条链路是分开的：
  - 被消灭进弃牌堆：走 `MINION_DESTROYED`，适合用 `registerInterceptor`
  - 基地计分清场弃置：走 `onMinionDiscardedFromBase`，适合用 `registerTrigger`
- 对这个泰坦来说，不需要先显式移除随从上的 1 枚力量标记再加到泰坦上，因为随从本身已经要离场；只要在离场前读取它是否有 `powerCounters > 0`，再给泰坦补 1 枚即可。
- `grantExtraAction` 已经是稳定公共原语，所以 `Death on Six Legs` 的 talent 不需要单独造新事件。

### Validation Notes
- `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts` 当前通过，结果 `29 passed`
- `npm run typecheck` 当前通过

### Remaining Recommendation
- 下一个最适合继续的是 `bear_cavalry_major_ursa`，因为它更偏复用现有移动/目标选择链。
- `werewolves_great_wolf_spirit` 适合作为再下一张，用来补“额外 talent 次数”这类通用限制层。

## Session Update: 2026-03-28 Smash Up Titans - Moon Zero Three 根因收口

### New Findings
- `super_spies_moon_zero_three` 浏览器链末尾不加标记，根因不在 `reactionQueue`，而在更早的 deck inspection 归属。
- 旧实现里 `peekDeckTop(...)` 会把 `playerId` 同时当成“被查看牌库拥有者”和“实际查看者”；当三号空间站查看对手牌库时，`DECK_INSPECTED.inspectorPlayerId` 被错误写成了对手。
- 这会导致 `collectTriggers(..., 'onDeckInspected', ...)` 把 `ownerPlayerId` 也错误归给对手，随后 `superSpiesMoonZeroThreeOnDeckInspected(...)` 用错误的 `ctx.playerId` 去找己方泰坦，自然找不到触发源。
- 用完整 pipeline 复刻 `USE_TALENT -> RESPOND -> RESPOND` 后，旧链只会停在：
  - `SYS_INTERACTION_RESOLVED`
  - `su:deck_inspected`
  - `su:trigger_queued`
  - `su:trigger_consumed`
  不会出现 `su:titan_power_counter_added`
- 把 `peekDeckTop(...)` 改成可显式传入 `inspectorPlayerId` 后，Moon Zero talent 的第一段响应已经稳定变成：
  - `DECK_INSPECTED`
  - `TRIGGER_QUEUED`
  - `TRIGGER_CONSUMED`
  - `TITAN_POWER_COUNTER_ADDED`

### Decisions
- 最正确修法不是给 `super_spies_moon_zero_three` 私有补标记，也不是继续在 `systems.ts` 猜 reaction queue 时序。
- 正确层级是修通用 helper：`peekDeckTop(...)` 新增可选 `inspectorPlayerId`，默认保持 `playerId` 以兼容原有“查看自己牌库”的所有入口；Moon Zero 这类“查看别人的牌库”场景显式传操作者。
- smoke 额外补了 `DECK_INSPECTED.payload.inspectorPlayerId === '0'` 断言，避免以后再把“牌库拥有者”误当“查看者”。

### Validation Notes
- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "三号空间站"` 结果 `3 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` 结果 `81 passed`
- `$env:PW_PORT='6280'; $env:PW_GAME_SERVER_PORT='20206'; $env:PW_API_SERVER_PORT='21206'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "三号空间站"` 结果 `2 passed`
- `$env:PW_PORT='6280'; $env:PW_GAME_SERVER_PORT='20206'; $env:PW_API_SERVER_PORT='21206'; npm run test:e2e:ci -- e2e/smashup-alien-terraform.e2e.ts` 结果 `34 passed`

### Next Recommendation
- 下一张后续泰坦优先切到 `Very Large Boulder / 硕大圆石` 或用户明确指定的目标；`Moon Zero Three` 这一张已经达到“领域 + smoke + E2E + 看图”完整收口。
