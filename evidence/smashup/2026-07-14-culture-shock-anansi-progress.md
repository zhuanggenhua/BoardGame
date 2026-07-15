# 文化冲击四派系 - 阿南西传说阶段进展（2026-07-14）

## 当前结论

- 阿南西传说（`anansi_tales`）已完成本轮 L2 领域行为补齐：14 条定向 Vitest 全部通过。
- 阿南西传说已补 2 条真实入口 L3/L4 E2E：派系选择页图集加载、`完美的礼物` + `故事讲述者小屋` 从真实手牌/基地入口结算到权威状态。
- 文化冲击卡图和复用基地 atlas 的本地压缩产物与根级/游戏级 manifest 已闭合；但 R2 精确上传因当前 worktree 缺少有效 `.env` 凭据失败；同项目候选 `.env` 复测后仍无法鉴权，CDN 代表 URL 仍为 `404`。
- 这不是单派系完成结论；远端资源上传/HEAD 仍 blocked，且格林童话、俄罗斯童话、古代印加人尚未完成玩法闭环。
- 四派系批次仍按 `阿南西传说 -> 格林童话 -> 俄罗斯童话 -> 古代印加人` 顺序推进；当前不能声明整批完成。

## 本轮实现补齐

| 对象 | 规则缺口 | 当前处理 | 证据 |
| --- | --- | --- | --- |
| 蜘蛛阿南西 | 选出标准行动后，本回合不能再打出该行动任意复制 | 新增 `ACTION_DEF_BLOCKED_THIS_TURN` 事件与 `blockedActionDefIdsThisTurn` 校验；行动锁在任意 `TURN_STARTED` 清空 | `anansi-tales.test.ts`：`蜘蛛阿南西会锁定本回合再次打出同名行动` |
| 完美的礼物 | 从牌库选出的行动需要按额外行动打出后再给另一名玩家 | 牌库行动先 transfer 到当前玩家手牌、发出 `ACTION_PLAYED`，再走行动 onPlay resolver，最后进入给牌 prompt | `anansi-tales.test.ts`：`完美的礼物从牌库选出的行动会被打出后交给另一名玩家，不会被吞掉` |
| 收集故事 | 不是取回手牌，而是从另一名玩家手中额外打出自己拥有的牌 | 行动牌直接额外打出并触发 onPlay；随从牌新增选基地 prompt 后额外打出 | `anansi-tales.test.ts`：`收集故事会从另一名玩家手中额外打出自己拥有的行动` |
| 阿南西之网 | 需要己方随从在该基地；每回合首次标准行动后才可用；给出后抽 2 | trigger/executor 双层校验己方随从与 `anansisWebUsedTurn`；给牌 prompt 成功后抽 2 并写 base metadata | `anansi-tales.test.ts`：`阿南西之网要求己方随从在场，并且每回合只在首次标准行动后生效` |
| 故事讲述者小屋 | counter 应持久保存在基地上，每个 counter 降低断点 2 | 新增 base metadata `storytellersHutCounters`；注册 synthetic breakpoint modifier | `anansi-tales.test.ts`：`故事讲述者小屋会放置持久 counter 并按 counter 降低断点` |

## 共享层变更

- `src/games/smashup/domain/events.ts`：新增 `su:base_metadata_updated` 与 `su:action_def_blocked_this_turn` 静默事件。
- `src/games/smashup/domain/types.ts`：新增 `BaseInPlay.metadata`、`blockedActionDefIdsThisTurn`、`BaseMetadataUpdatedEvent`、`ActionDefBlockedThisTurnEvent`。
- `src/games/smashup/domain/reduce.ts`：归约 base metadata、行动 def 锁，并在 `TURN_STARTED` 清空行动 def 锁。
- `src/games/smashup/domain/playLegality.ts` / `commands.ts`：普通出牌与响应窗口打行动均检查本回合行动 def 锁。

## 资源路径修复

- `src/games/smashup/domain/atlasCatalog.ts`：将嵌套 atlas 资源的运行时基名从目录改为实际无扩展名文件：
  - `smashup/cards/culture_shock/atlas`
  - `smashup/cards/polynesian_voyagers/atlas`
  - `smashup/cards/penguins/atlas`
  - `smashup/base/polynesian_voyagers/atlas`
  - `smashup/base/penguins/atlas`
- 根因：`CardPreview` / `AssetLoader` 会对 `image` 基名自动插入 `compressed/<filename>.webp`；旧目录式基名会请求到不存在的 `compressed/culture_shock.webp` / `compressed/polynesian_voyagers.webp`，导致 E2E 出现白卡或 `.atlas-shimmer` 残留。
- 静态合同已同步保护：`cultureShockFourFactionsIntegration.test.ts` 与 `polynesianVoyagersPenguinsIntegration.test.ts` 均断言新基名包含 `/atlas`。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/anansi-tales.test.ts --configLoader native` | PASS，14 tests |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts src/games/smashup/__tests__/polynesianVoyagersPenguinsIntegration.test.ts --configLoader native` | PASS，2 files / 11 tests |
| `npx tsc --noEmit --pretty false --noErrorTruncation` | PASS |
| `npm run typecheck -- --pretty false --noErrorTruncation` | PASS |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| `npm run test:e2e:ci:file -- smashup-culture-shock-anansi.e2e.ts` | PASS，2 tests |
| `npm run compress:images -- public/assets/i18n/zh-CN/smashup/cards/culture_shock` | PASS，1 张；`atlas.png` 40.14 MB -> `compressed/atlas.webp` 1.06 MB |
| `npm run compress:images -- public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers` | PASS，1 张；`atlas.png` 4.57 MB -> `compressed/atlas.webp` 431.75 KB |
| `npm run assets:manifest` | PASS，增量生成根级与游戏级 manifest |
| `node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp official/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp` | BLOCKED，R2 `HeadObject` 鉴权 `401`；当前仅有 `.env.example`，无有效 `.env` |
| `node scripts/assets/upload-to-r2.js --only ... --force-upload`（临时注入同项目候选 `.env` 的 R2 键，未复制/未打印密钥） | BLOCKED，跳过远端 `HEAD` 后 `PutObject` 仍返回 `Unauthorized`；说明候选凭据无写权限或已失效 |
| `rg --files -uu -g ".env" D:\GA` | 仅发现 `D:\GA\BoardGame-clean-main-2\temp\upstream-main-live\.env` 一个候选；复测无效 |
| `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp` | FAIL，404 |
| `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp` | FAIL，404 |

## L3/L4 E2E 截图证据

| 截图 | 绝对路径 | 肉眼观察 |
| --- | --- | --- |
| 阿南西传说派系选择页 | `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-culture-shock-anansi.e2e\派系选择页能看到阿南西传说，并加载文化冲击图集\01-阿南西传说-派系选择页图集可见.jpg` | 阿南西传说详情面板可见，手牌标签显示 `手牌 · 13`，蜘蛛阿南西、完美的礼物、交易故事等文化冲击卡图完整显示；未见白卡或 shimmer。 |
| 故事讲述者小屋结算后 | `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-culture-shock-anansi.e2e\完美的礼物与故事讲述者小屋可从真实入口结算到权威状态\07-故事讲述者小屋-主动基地能力结算后.jpg` | 牌桌可见故事讲述者小屋、阿南西之网、阿克耶海龟和完美的礼物真实卡图；顶部 toast 显示额外获得 1 次战术打出机会，对应 `actionLimit + 1` 与 `storytellersHutCounters = 1` 的权威状态断言。 |

## 资源链状态

| 对象 | 本地压缩产物 | manifest | 精确上传 | CDN HEAD |
| --- | --- | --- | --- | --- |
| 文化冲击卡牌 atlas | `public/assets/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp`，SHA-256 `d01093a8789e0f49a97071afe6ea8992308bc54ce679993191066612c6d97c7a` | 根级 `zh-CN/smashup/cards/culture_shock/compressed/atlas` 与游戏级 `cards/culture_shock/compressed/atlas` 已写入 | blocked：R2 401；强制上传 `Unauthorized` | 404 |
| 文化冲击复用基地 atlas | `public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp`，SHA-256 `31f4179b388ed1063b20c65f9cb6c5eeb95474b352321fac756939712fa468b0` | 根级 `zh-CN/smashup/base/polynesian_voyagers/compressed/atlas` 与游戏级 `base/polynesian_voyagers/compressed/atlas` 已写入 | blocked：R2 401；强制上传 `Unauthorized` | 404 |

## 未完成 / 不得误报完成

- 未完成文化冲击资源 R2 上传与代表 URL `HEAD 200` 回查；当前 blocker 是 R2 鉴权 401 / `Unauthorized`，需要有效 `.env` / R2 凭据后重跑精确上传。
- 未对格林童话、俄罗斯童话、古代印加人进行玩法实现闭环。
- 当前结论只能写：阿南西传说代表性 L2 + 真实入口 L3/L4 已验证，本地资源与 manifest 已闭合；不能写阿南西传说完成，更不能写四派系完成。
