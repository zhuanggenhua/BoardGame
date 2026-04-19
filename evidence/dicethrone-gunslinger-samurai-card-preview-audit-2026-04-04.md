# DiceThrone 枪手 / 武士手牌预览图集审计（2026-04-04）

## 审计范围

- 适用游戏：`dicethrone`
- 审计对象：`gunslinger`、`samurai` 手牌预览图接线
- 核对目标：
  - 是否回到和老角色一致的 `previewRef.type = 'atlas'` 规格
  - `ability-cards.webp` 的 `slot-00 ~ slot-31` 是否与代码索引一致
  - 是否还残留 `hand-cards-atlas` 或误生成单卡图进入正式运行时链路

## 权威来源

- 枪手整图：`public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/ability-cards.webp`
- 武士整图：`public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/ability-cards.webp`
- 枪手逐格裁图：`public/assets/i18n/zh-CN/dicethrone/images/gunslinger/crops/ability-cards/slot-00.webp` ~ `slot-31.webp`
- 武士逐格裁图：`public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/ability-cards/slot-00.webp` ~ `slot-31.webp`
- 运行时代码：
  - `src/games/dicethrone/heroes/gunslinger/cards.ts`
  - `src/games/dicethrone/heroes/samurai/cards.ts`
  - `src/games/dicethrone/domain/commonCards.ts`

## 审计方法

1. 逐格查看两边 `slot-00 ~ slot-31` 裁图，确认卡名与真实卡位。
2. 对照 `cards.ts` 的 `previewRef` 与 `commonCards.ts` 的共享索引映射。
3. 检查运行时是否还引用 `hand-cards-atlas`。
4. 检查 `assets-manifest.json` 是否还保留误生成的武士单卡裁图条目。

## 通用牌区复核结果

两边 `slot-00 ~ slot-17` 完全同序，且都与 `COMMON_CARDS` 的自然定义顺序相反。

| atlas 位 | 汉化卡名 | 对应 card id |
| --- | --- | --- |
| `slot-00` | 移轉！ | `card-transfer-status` |
| `slot-01` | 效果指示物是啥？ | `card-what-status` |
| `slot-02` | 來賭一場吧！ | `card-one-throw-fortune` |
| `slot-03` | 趕走它！ | `card-get-away` |
| `slot-04` | 三倍抽取！ | `card-super-double` |
| `slot-05` | 加倍抽取！ | `card-double` |
| `slot-06` | 拜啦！ | `card-bye-bye` |
| `slot-07` | 喬一下！ | `card-flick` |
| `slot-08` | 拿點報酬！ | `card-boss-generous` |
| `slot-09` | 這次不算！ | `card-next-time` |
| `slot-10` | 兩倍費用！ | `card-unexpected` |
| `slot-11` | 來，再試一次！ | `card-worthy-of-me` |
| `slot-12` | 讓它變萬用！ | `card-surprise` |
| `slot-13` | 同調！ | `card-me-too` |
| `slot-14` | 再來一次！ | `card-i-can-again` |
| `slot-15` | 幫一把！ | `card-give-hand` |
| `slot-16` | 下次會更好！ | `card-just-this` |
| `slot-17` | 666！ | `card-play-six` |

## 枪手专属区复核结果

| atlas 位 | 真实卡面 | 运行时 card id | 审计结论 |
| --- | --- | --- | --- |
| `slot-18` | 左輪手槍 II | `upgrade-revolver-2` | 一致 |
| `slot-19` | 賞金獵人 II | `upgrade-bounty-hunter-2` | 一致 |
| `slot-20` | 槍戰決鬥 II | `upgrade-showdown-2` | 一致 |
| `slot-21` | 槍戰決鬥 III | `upgrade-showdown-3` | 一致 |
| `slot-22` | 左輪速射 II / 槍托擊打 | `upgrade-fan-the-hammer-2` / `card-pistol-whip` | 复合展示位，共用 `index 22` 为正确旧规格 |
| `slot-23` | 掩護射擊 II / 標記目標 | `upgrade-take-cover-2` / `card-mark-the-target` | 复合展示位，共用 `index 23` 为正确旧规格 |
| `slot-24` | 死亡之眼 II / 執法者 | `upgrade-deadeye-2` / `card-the-law` | 复合展示位，共用 `index 24` 为正确旧规格 |
| `slot-25` | 對決 II | `upgrade-duel-2` | 一致 |
| `slot-26` | 快速拔槍 | `upgrade-quick-draw` | 一致 |
| `slot-27` | 通緝逮捕！ | `card-wanted` | 一致 |
| `slot-28` | 轉動彈槽！ | `card-spin-the-chamber` | 一致 |
| `slot-29` | 賭命輪盤！ | `card-high-noon` | 一致 |
| `slot-30` | 荒野西部！ | `card-wild-west` | 一致 |
| `slot-31` | 吃我的鉛彈！ | `card-eat-my-lead` | 一致 |

## 武士专属区复核结果

| atlas 位 | 真实卡面 | 运行时 card id | 审计结论 |
| --- | --- | --- | --- |
| `slot-18` | 太刀斬 II | `upgrade-katana-slice-2` | 一致 |
| `slot-19` | 太刀斬 III | `upgrade-katana-slice-3` | 一致 |
| `slot-20` | 脇差 II | `upgrade-wakizashi-2` | 一致 |
| `slot-21` | 脇差 III | `upgrade-wakizashi-3` | 一致 |
| `slot-22` | 肅穆之儀 II | `upgrade-solemnity-2` | 一致 |
| `slot-23` | 武道 II | `upgrade-budo-2` | 一致 |
| `slot-24` | 正宗 II | `upgrade-masamune-2` | 一致 |
| `slot-25` | 葉隱之心 II | `upgrade-slot-06-2` | 一致 |
| `slot-26` | 昂首無畏 II | `upgrade-stand-tall-2` | 一致 |
| `slot-27` | 武士榮耀！ | `card-samurai-honor` | 一致 |
| `slot-28` | 你真可恥！ | `card-you-should-be-ashamed` | 一致 |
| `slot-29` | 不退縮！ | `card-no-retreat` | 一致 |
| `slot-30` | 捨身取義！ | `card-righteousness` | 一致 |
| `slot-31` | 殘心！ | `card-zanshin` | 一致 |

## 本轮发现与修正

1. 武士通用牌共享索引之前误写成正向顺序，这是实际 bug。
2. 重新逐格看图后，已确认武士通用牌必须和枪手一样使用反向映射，现已在 `src/games/dicethrone/domain/commonCards.ts` 修正。
3. `hand-cards-atlas` 已从运行时、预加载和资源定义里移除；当前正确方案是直接使用 `ability-cards` atlas。
4. 武士误生成的 3 张单卡裁图：
   - `upgrade-solemnity-2.webp`
   - `upgrade-masamune-2.webp`
   - `upgrade-slot-06-2.webp`
   已从 `public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/ability-cards/` 及 `compressed/` 子目录删除，并重新生成 `assets-manifest.json`。
5. `2026-04-05` 追加修正：本审计原先只核对了 `previewRef.index` 与图集卡位的一致性，但漏审了“共享 atlas 位的调试发牌契约”。
6. 枪手 `slot-22 / 23 / 24` 虽然继续共用 `index` 是正确运行时规格，但调试面板曾错误地仅按 `atlasIndex` 发牌，导致点击 `upgrade-deadeye-2` 一行时可能把同槽位的 `card-the-law` 发进手牌。
7. 已在 `src/games/dicethrone/domain/cheatModifier.ts` 增加“共享索引拒绝模糊发牌”保护，并在 `src/games/dicethrone/debug-config.tsx` 改为按精确 `deckIndex` 发牌；因此旧结论“复合位继续共用 atlas index 即可收口”不再完整，需连同调试入口一起审计。
8. `2026-04-05` 再次修订：用户反馈的“正常对局里升级牌像是触发了子技能效果”并非领域层把 `upgrade-deadeye-2` 执行成了 `deadeye` 伤害，而是 UI 特写层把同一轮的 `CARD_PLAYED` 与 `ABILITY_REPLACED` 都当成“新打出一张牌”。
9. 旧审计结论“正常对局无额外风险，只需关注 atlas 索引/调试发牌”因此失效；还必须审计升级事件在 `useCardSpotlight` 的消费契约，否则一次升级会被拆成两次卡牌特写，和真正技能结算信号混淆。
10. 已在 `src/games/dicethrone/hooks/useCardSpotlight.ts` 增加升级事件去重：同一玩家、同一卡牌、同批次时间窗内的 `ABILITY_REPLACED` 不再重复入队；并在 `src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx` 补了正常对局事件链回归。

## 命中审计维度

- `D15 UI 状态同步`：手牌预览图与真实卡面资源是否同步
- `D23 架构假设一致性`：枪手 / 武士是否回到与老角色一致的 atlas 契约
- `D43 重构完整性检查`：移除 `hand-cards-atlas` 后，代码、预加载、资源清单是否一起收口
- `D47 E2E 测试覆盖完整性`：运行时预览链路是否有 UI 级验证

## 验证命令

```powershell
npm run test -- src/games/dicethrone/__tests__/criticalImageResolver.test.ts
npx vitest run --config vitest.config.audit.ts --configLoader native src/games/dicethrone/__tests__/card-cross-audit.test.ts -t "枪手 / 武士卡图接线一致性"
```

## 验证结果

- `criticalImageResolver.test.ts` 通过：确认 `setup/playing` 阶段不再预加载 `hand-cards-atlas`
- `card-cross-audit.test.ts -t "枪手 / 武士卡图接线一致性"` 通过：确认两边 `previewRef` 都直接指向 `ability-cards` atlas
- `basic-commands-coverage.test.ts -t "作弊发牌共享 atlas 索引保护"` 通过：确认 `slot-24` 这类共享索引不会再模糊发牌，且仍可按精确 `deckIndex` 发出 `upgrade-deadeye-2`
- `cross-hero.test.ts -t "upgrade-deadeye-2 从正常牌库抽到手后，打出仍应走升级而不是其他效果"` 通过：确认正常对局领域链路仍是升级，不是真执行成 `deadeye` 子效果
- `BonusDieOverlay.test.tsx -t "升级牌的 CARD_PLAYED 与 ABILITY_REPLACED 不应被拆成两次卡牌特写"` 通过：确认正常对局里升级牌不会再被 UI 特写层重复消费

## 最终结论

- 当前正确规格不是“再做一套 hand atlas”或“给每张牌单独切运行时图”，而是和老角色一致，继续直接使用 `ability-cards` atlas。
- 当前证据不支持“需要整批重录枪手/武士卡牌效果数据”。本轮命中的正常对局问题是升级事件展示契约，而不是 `upgrade-deadeye-2` 领域执行错成了 `deadeye` 子效果。
- 枪手 `slot-22 / 23 / 24` 的复合展示位继续共用 atlas index 仍是预期行为；真正的 bug 是调试发牌入口把共享索引误当成“唯一卡标识”。
- 本轮审计修订后，枪手 / 武士手牌预览链路、调试发牌链路，以及升级牌正常对局的卡牌特写链路都已回到统一 atlas / 事件契约；现存风险只剩未来如果产品要“每张复合位都显示独立缩略图”，那将是新需求，不是当前缺陷。
