# Smash Up Anansi Tales / Russian Fairy Tales POD intake 与实现证据

日期：2026-08-10
分支：`codex/smashup-anansi-fairy-tales-pod`
OpenSpec：`add-smashup-anansi-russian-fairy-tales-pod`

## 1. 范围与批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E/真实链 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `anansi_tales_pod` | passed | passed-local | passed | passed-automated | blocked-remote | local-complete |
| `russian_fairy_tales_pod` | passed | passed-local | passed | passed-automated | blocked-remote | local-complete |

本轮只处理上述两个 POD 派系。经典版对象只作为字段与玩法对照，不改其 atlas、ID、metadata 或实现状态。

## 2. 真相源表

| 对象 | 主真相源 | SHA-256 | 尺寸/布局 | 用途 | 对照源 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| Anansi Tales POD | `C:/Users/Dqm/.codex/attachments/8cf7c9be-1c67-4d40-ae20-5bf18dfd5a69/image-1.png` | `A828EBF063D338A057877F487E9D04F778A3FF76060B644A94A3F835ACDBFBDB` | `1876 x 2100`, `4 x 5` | 卡名、力量、规则正文、实体数量、slot | `anansi_tales.ts`、en/zh-CN locale、经典版能力测试 | locked |
| Russian Fairy Tales POD | `C:/Users/Dqm/.codex/attachments/8cf7c9be-1c67-4d40-ae20-5bf18dfd5a69/image-2.png` | `C8EC5256EED93594B1A6A298D6C62D9C70BE69D56A79296BD8CFFCDAEBA710CC` | `1876 x 2100`, `4 x 5` | 卡名、力量、规则正文、实体数量、slot | `russian_fairy_tales.ts`、en/zh-CN locale、经典版能力测试 | locked |

图片是本轮 POD 卡图与印刷文本主真相源。经典版代码、locale 和测试只用于证明规则一致与共享链，不得覆盖清晰卡图。

## 3. 裁图与可视合同

- 列边界：`x = [0, 375, 750, 1126, 1501, 1876]`
- 行边界：`y = [0, 525, 1050, 1575, 2100]`
- slot：`index = row * 5 + col`，row-major，`0..19`
- 运行时不保存 40 张独立裁图；使用一个 `4 x 5` atlas 与卡牌定义的 `previewRef.index`。
- 人工代表槽位检查覆盖四角、跨行边界和中部重复牌；卡名、力量与规则区无跨格。

### 3.1 Anansi Tales POD 20 槽合同

| slot | 图上对象 | runtime defId | copy | 交互状态 |
| ---: | --- | --- | ---: | --- |
| 0 | Pot of Wisdom | `anansi_tales_pot_of_wisdom_pod` | 1/1 | action |
| 1 | Ear of Corn | `anansi_tales_ear_of_corn_pod` | 1/1 | action |
| 2 | Collecting Stories | `anansi_tales_collecting_stories_pod` | 1/2 | action |
| 3 | Collecting Stories | `anansi_tales_collecting_stories_pod` | 2/2 | action |
| 4 | Pot of Beans | `anansi_tales_pot_of_beans_pod` | 1/2 | action |
| 5 | Pot of Beans | `anansi_tales_pot_of_beans_pod` | 2/2 | action |
| 6 | The Perfect Gift | `anansi_tales_the_perfect_gift_pod` | 1/1 | action |
| 7 | Let it be Full and Eat | `anansi_tales_let_it_be_full_and_eat_pod` | 1/1 | action |
| 8 | Feather Gifts | `anansi_tales_feather_gifts_pod` | 1/1 | action |
| 9 | Trading Stories | `anansi_tales_trading_stories_pod` | 1/1 | action |
| 10 | Mboro Hornet | `anansi_tales_mboro_hornet_pod` | 1/4 | minion |
| 11 | Mboro Hornet | `anansi_tales_mboro_hornet_pod` | 2/4 | minion |
| 12 | Mboro Hornet | `anansi_tales_mboro_hornet_pod` | 3/4 | minion |
| 13 | Mboro Hornet | `anansi_tales_mboro_hornet_pod` | 4/4 | minion |
| 14 | Akye the Turtle | `anansi_tales_akye_the_turtle_pod` | 1/3 | minion |
| 15 | Akye the Turtle | `anansi_tales_akye_the_turtle_pod` | 2/3 | minion |
| 16 | Akye the Turtle | `anansi_tales_akye_the_turtle_pod` | 3/3 | minion |
| 17 | Onini the Python | `anansi_tales_onini_the_python_pod` | 1/1 | minion |
| 18 | Osebo the Leopard | `anansi_tales_osebo_the_leopard_pod` | 1/1 | minion |
| 19 | Anansi the Spider | `anansi_tales_anansi_the_spider_pod` | 1/1 | minion |

### 3.2 Russian Fairy Tales POD 20 槽合同

| slot | 图上对象 | runtime defId | copy | 交互状态 |
| ---: | --- | --- | ---: | --- |
| 0 | The Frog Princess | `russian_fairy_tales_the_frog_princess_pod` | 1/1 | ongoing action |
| 1 | The Water of Life | `russian_fairy_tales_the_water_of_life_pod` | 1/2 | action |
| 2 | The Water of Life | `russian_fairy_tales_the_water_of_life_pod` | 2/2 | action |
| 3 | Transformation | `russian_fairy_tales_transformation_pod` | 1/2 | action |
| 4 | Transformation | `russian_fairy_tales_transformation_pod` | 2/2 | action |
| 5 | Bewitched | `russian_fairy_tales_bewitched_pod` | 1/1 | ongoing action |
| 6 | Go See My Sister | `russian_fairy_tales_go_see_my_sister_pod` | 1/1 | ongoing action |
| 7 | Go I Know Not Whither | `russian_fairy_tales_go_i_know_not_whither_pod` | 1/1 | action |
| 8 | Fetch I Know Not What | `russian_fairy_tales_fetch_i_know_not_what_pod` | 1/1 | action |
| 9 | Mass Transformation | `russian_fairy_tales_mass_transformation_pod` | 1/1 | action |
| 10 | Toad | `russian_fairy_tales_toad_pod` | 1/1 | minion |
| 11 | The Birch | `russian_fairy_tales_the_birch_pod` | 1/1 | minion |
| 12 | Tsar Eagle | `russian_fairy_tales_tsar_eagle_pod` | 1/2 | minion |
| 13 | Tsar Eagle | `russian_fairy_tales_tsar_eagle_pod` | 2/2 | minion |
| 14 | The Gray Wolf | `russian_fairy_tales_the_gray_wolf_pod` | 1/1 | minion |
| 15 | Foolish Magician | `russian_fairy_tales_foolish_magician_pod` | 1/2 | minion |
| 16 | Foolish Magician | `russian_fairy_tales_foolish_magician_pod` | 2/2 | minion |
| 17 | The Birch Woman | `russian_fairy_tales_the_birch_woman_pod` | 1/1 | minion |
| 18 | Finist the Falcon | `russian_fairy_tales_finist_the_falcon_pod` | 1/1 | minion |
| 19 | Baba Yaga | `russian_fairy_tales_baba_yaga_pod` | 1/1 | minion |

## 4. 29 个唯一对象录入与规则子句合同

`C1`=入口/时机，`C2`=目标/选择，`C3`=主效果，`C4`=额外/可选/清理。字段结论以 POD 图面为主，经典版对象为逐字段对照。

| POD defId | 类型/力量 | count | slot | 子句合同 | 经典对照 | 结论 |
| --- | --- | ---: | ---: | --- | --- | --- |
| `anansi_tales_anansi_the_spider_pod` | minion/5 | 1 | 19 | C1 talent; C2 deck standard action; C3 extra play; C4 give away + same-name lock | `anansi_tales_anansi_the_spider` | locked-identical |
| `anansi_tales_osebo_the_leopard_pod` | minion/4 | 1 | 18 | C1 ongoing after give; C2 self; C3 +1 counter | `anansi_tales_osebo_the_leopard` | locked-identical |
| `anansi_tales_onini_the_python_pod` | minion/4 | 1 | 17 | C1 ongoing foreign-card play/discard; C2 one own minion; C3 optional +1 counter | `anansi_tales_onini_the_python` | locked-identical |
| `anansi_tales_akye_the_turtle_pod` | minion/3 | 3 | 14 | C1 onPlay optional; C2 card + other player; C3 transfer; C4 draw 2 | `anansi_tales_akye_the_turtle` | locked-identical |
| `anansi_tales_mboro_hornet_pod` | minion/2 | 4 | 10 | C1 special foreign-card event; C2 self hand; C3 optional extra minion | `anansi_tales_mboro_hornet` | locked-identical |
| `anansi_tales_the_perfect_gift_pod` | action | 1 | 6 | C1 onPlay; C2 deck standard action + player; C3 extra play; C4 redirect to hand | `anansi_tales_the_perfect_gift` | locked-identical |
| `anansi_tales_pot_of_beans_pod` | action | 2 | 4 | C1 onPlay; C2 minions total 2 counters; C3 add; C4 give card | `anansi_tales_pot_of_beans` | locked-identical |
| `anansi_tales_collecting_stories_pod` | action | 2 | 2 | C1 onPlay; C2 other hand/owned card; C3 optional extra card | `anansi_tales_collecting_stories` | locked-identical |
| `anansi_tales_ear_of_corn_pod` | action | 1 | 1 | C1 onPlay; C2 up to 3 discard actions; C3 shuffle + extra action; C4 give card | `anansi_tales_ear_of_corn` | locked-identical |
| `anansi_tales_pot_of_wisdom_pod` | action | 1 | 0 | C1 onPlay; C2 each other player; C3 draw/give; C4 extra action | `anansi_tales_pot_of_wisdom` | locked-identical |
| `anansi_tales_trading_stories_pod` | action | 1 | 9 | C1 onPlay optional; C2 up to 3 cards/other hands; C3 give and draw each | `anansi_tales_trading_stories` | locked-identical |
| `anansi_tales_let_it_be_full_and_eat_pod` | action | 1 | 7 | C1 onPlay; C2 other player; C3 draw 2; C4 give card | `anansi_tales_let_it_be_full_and_eat` | locked-identical |
| `anansi_tales_feather_gifts_pod` | action | 1 | 8 | C1 onPlay; C2 own minion + another base/player; C3 move; C4 give card | `anansi_tales_feather_gifts` | locked-identical |
| `russian_fairy_tales_the_birch_woman_pod` | minion/4 | 1 | 17 | C1 ongoing leaves play to discard; C2 Birch across zones; C3 hand or extra play | `russian_fairy_tales_the_birch_woman` | locked-identical |
| `russian_fairy_tales_finist_the_falcon_pod` | minion/4 | 1 | 18 | C1 special before scoring; C2 scoring/other base; C3 move or return+extra play | `russian_fairy_tales_finist_the_falcon` | locked-identical |
| `russian_fairy_tales_baba_yaga_pod` | minion/5 | 1 | 19 | C1 talent; C2 another minion here; C3 bottom deck + top-deck extra minion; C4 shuffle | `russian_fairy_tales_baba_yaga` | locked-identical |
| `russian_fairy_tales_the_frog_princess_pod` | ongoing action | 1 | 0 | C1 play on own minion/talent; C2 attached minion; C3 bottom deck + top extra minion; C4 transfer + shuffle | `russian_fairy_tales_the_frog_princess` | locked-identical |
| `russian_fairy_tales_the_water_of_life_pod` | action | 2 | 1 | C1 onPlay; C2 discard minion; C3 top deck; C4 optional extra action | `russian_fairy_tales_the_water_of_life` | locked-identical |
| `russian_fairy_tales_fetch_i_know_not_what_pod` | action | 1 | 8 | C1 onPlay; C2 reveal to 2 actions; C3 choose any to hand; C4 shuffle rest | `russian_fairy_tales_fetch_i_know_not_what` | locked-identical |
| `russian_fairy_tales_go_i_know_not_whither_pod` | action | 1 | 7 | C1 onPlay; C2 base + each opponent random minion; C3 shuffle to owner decks | `russian_fairy_tales_go_i_know_not_whither` | locked-identical |
| `russian_fairy_tales_go_see_my_sister_pod` | ongoing action | 1 | 6 | C1 play on base/after own minion arrives; C2 attached base; C3 optional draw | `russian_fairy_tales_go_see_my_sister` | locked-identical |
| `russian_fairy_tales_bewitched_pod` | ongoing action | 1 | 5 | C1 play on minion/ongoing; C2 attached then another minion; C3 +2; C4 transfer on leave | `russian_fairy_tales_bewitched` | locked-identical |
| `russian_fairy_tales_transformation_pod` | action | 2 | 3 | C1 onPlay; C2 minion; C3 bottom deck + top extra minion; C4 shuffle | `russian_fairy_tales_transformation` | locked-identical |
| `russian_fairy_tales_the_birch_pod` | minion/2 | 1 | 11 | C1 ongoing turn start optional; C2 self + Birch Woman across zones; C3 destroy then hand/extra play | `russian_fairy_tales_the_birch` | locked-identical |
| `russian_fairy_tales_tsar_eagle_pod` | minion/2 | 2 | 12 | C1 onPlay OR; C2 self draw or opponent discard minion; C3 draw/top deck | `russian_fairy_tales_tsar_eagle` | locked-identical |
| `russian_fairy_tales_the_gray_wolf_pod` | minion/3 | 1 | 14 | C1 talent; C2 self + extra minion here; C3 top deck + play; C4 +1 counter | `russian_fairy_tales_the_gray_wolf` | locked-identical |
| `russian_fairy_tales_foolish_magician_pod` | minion/3 | 2 | 15 | C1 onPlay; C2 3 hand cards; C3 draw 3; C4 order top/bottom | `russian_fairy_tales_foolish_magician` | locked-identical |
| `russian_fairy_tales_toad_pod` | minion/0 | 1 | 10 | C1 onPlay optional; C2 other player + their other minion; C3 give control + shuffle target | `russian_fairy_tales_toad` | locked-identical |
| `russian_fairy_tales_mass_transformation_pod` | action | 1 | 9 | C1 onPlay; C2 every player; C3 hand to bottom; C4 draw equal count | `russian_fairy_tales_mass_transformation` | locked-identical |

数量对账：Anansi `13` 唯一对象 / `20` 实体牌；Russian `16` 唯一对象 / `20` 实体牌；合计 `29` / `40`。

## 5. 对照表与冲突表

| 对照面 | Anansi Tales POD | Russian Fairy Tales POD | 结论 |
| --- | --- | --- | --- |
| 名称 | 13/13 与经典英文名一致 | 16/16 与经典英文名一致 | shared |
| 类型/力量 | 逐卡一致 | 逐卡一致 | shared |
| count | 20 张实体牌与经典牌组数量一致 | 20 张实体牌与经典牌组数量一致 | shared |
| 规则正文 | 图片逐卡与现有英文 locale 一致 | 图片逐卡与现有英文 locale 一致 | shared |
| atlas slot | POD 独立 row-major 槽位 | POD 独立 row-major 槽位 | separate asset |
| 基地图 | 未提供 | 未提供 | 不创建 POD 基地；basePool shared |

冲突待裁定表：空。没有读不清字段、图片/对照源冲突或未知槽位。

## 6. 实现决策与共享消费者

### 6.1 共享 surface

| surface | 关系 | 消费者/证据入口 |
| --- | --- | --- |
| ability | shared | `abilityRegistry` alias |
| interaction | shared | `abilityInteractionHandlers` alias |
| ongoing | shared | `ongoingEffects` alias |
| powerModifier | shared | `ongoingModifiers` alias |
| baseAbility | shared | 经典基地 ID，不生成 POD 基地 |
| basePool | shared | `getBaseDefIdsForFactions` / expansion-set base pool |

### 6.2 不变量

- 新 faction/card IDs 必须独立，经典对象不能改指 POD atlas。
- `previewRef` 是唯一必须和经典对象不同的静态字段；`id`、`faction` 也按 POD 身份变化。
- 不用运行时自动 clone 数据对象；每张 POD 卡显式定义完整字段。
- 不创建 `base_*_pod`，不修改经典基地资源。
- POD metadata 不限制 locale；英文卡图按既有 POD 模式同时提供 `en` / `zh-CN` 路径。

## 7. L0-L4 验收矩阵

| 对象 | L0 素材 | L1 数据/i18n/atlas | L2 领域行为 | L3 真实 UI/入口 | L4 完整链与最终状态 | 当前结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Anansi Tales POD 13 卡 | passed | passed | passed | passed-automated | blocked-remote-asset | local-complete |
| Russian Fairy Tales POD 16 卡 | passed | passed | passed | passed-automated | blocked-remote-asset | local-complete |
| 双语 PNG/WebP | passed-source | passed-local | n/a | passed-resolver | blocked-remote | local-complete |
| shared classic bases | passed-contract | passed | passed | passed-automated | not-applicable | passed |

`passed-automated` 表示注册、locale、预加载解析和代表性能力链已由集成测试覆盖；本轮没有运行浏览器截图型 E2E。`blocked-remote` 仅指正式资源服务器上传与公开 URL 验证未完成，不影响代码和二进制资源随 PR 交付。

## 8. 最终资源证据

四份 PNG 与四份 WebP 已落到 `en`、`zh-CN` 的正式运行时目录；两种 locale 使用同一英文 POD 卡图。所有文件尺寸均为 `1876 x 2100`，未缩小像素尺寸。

| 对象 | SHA-256 | 字节数 |
| --- | --- | ---: |
| Anansi PNG（en/zh-CN 相同） | `a828ebf063d338a057877f487e9d04f778a3ff76060b644a94a3f835acdbfbdb` | 6,213,661 |
| Russian PNG（en/zh-CN 相同） | `c8ec5256eed93594b1a6a298d6c62d9c70be69d56a79296bd8cffcdaeba710cc` | 6,438,382 |
| Anansi WebP（en/zh-CN 相同） | `6a6153d99941a1c34f820f763d22f5bc489c6193c107fe6adba6a861b545968d` | 1,645,714 |
| Russian WebP（en/zh-CN 相同） | `a56263957139e0dad7714754ad2ada2e47aa5e2580452fd0733d69e09d4c8507` | 1,489,418 |

增量 manifest 校验通过：

- `public/assets/i18n/en/smashup/assets-manifest.json`：`basePrefix = official/i18n/en/smashup/`
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`：`basePrefix = official/i18n/zh-CN/smashup/`
- 根 i18n manifest 已包含 8 个新增 PNG/WebP 路径；两份游戏级 manifest 的增量校验通过。

## 9. 验证结果

- `openspec validate add-smashup-anansi-russian-fairy-tales-pod --strict`：通过。
- 定向 Vitest：4 个文件、34 项测试全部通过，包括 POD 集成 7 项、经典 Anansi 14 项、经典 Russian Fairy Tales 11 项、POD 自动映射 2 项。
- 变更 TypeScript 定向 ESLint：0 error。
- `git diff --check`：通过；仅有仓库既有的 Windows 换行转换提示。
- locale 与相关 manifest JSON 解析：通过；集成测试同时验证双语名称、卡牌字段、metadata、预加载引用和共享基地池。
- `npm run i18n:check`：本次运行数分钟无输出后终止，因此不记为通过；JSON 解析和定向 locale 断言已通过，但完整 i18n 门禁仍是残余风险。

## 10. 正式资源上传阻塞

本地 dry-run 精确得到 4 个需要上传的运行时对象：

- `official/i18n/en/smashup/cards/compressed/anansi_tales_pod.webp`
- `official/i18n/en/smashup/cards/compressed/russian_fairy_tales_pod.webp`
- `official/i18n/zh-CN/smashup/cards/compressed/anansi_tales_pod.webp`
- `official/i18n/zh-CN/smashup/cards/compressed/russian_fairy_tales_pod.webp`

当前环境没有 `ASSET_SERVER_UPLOAD_URL`、上传 token 或可用 SSH key；对默认服务器 `admin@8.148.71.102` 的 SSH 探测返回 `Permission denied (publickey,gssapi-keyex,gssapi-with-mic)`。因此没有执行正式上传，也没有公开 URL 的 HEAD 200/hash 证据。该项必须由具备资源服务器凭据的维护者在合并或部署前补做，不能标记为已完成。
