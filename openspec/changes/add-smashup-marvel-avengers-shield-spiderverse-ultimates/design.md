## Context

当前 Smash Up 运行时已经具备派系注册、atlas、卡牌定义、能力注册、持续效果、响应窗口、simple-choice、移动、摧毁、抽弃牌和额外打出等通用机制。

本批漫威素材的特殊点是：

- 单张 `9 x 6` atlas 混排四个派系。
- 54 个唯一卡面对应四副各 20 张的实体牌组。
- 复仇者有 18 个唯一卡面，其余三个派系各有 12 个唯一卡面。
- 素材只有中文卡牌图，没有漫威基地卡图。
- 当前工作区同时存在另一批 Smash Up 改动，多个共享注册文件已经被修改。

## Goals / Non-Goals

### Goals

- 四派系在正式派系选择入口可选，并能与现有任意派系组合。
- 每副牌严格为 20 张，唯一卡面、重复数量、力量和图片索引正确。
- 54 个唯一卡面的所有规则子句都有明确的领域实现或显式 blocker。
- 可选能力存在合法候选时仍允许跳过。
- 每个派系独立完成 L0-L4 审计、真实入口 E2E 和截图证据。
- 正式资源通过统一压缩、manifest 和预加载链路进入 PR；远端 CDN 发布与 URL 回查由作者合并/发布后完成。

### Non-Goals

- 不接入 Hydra、Kree、Masters of Evil、Sinister Six。
- 不猜测或生成漫威专属基地。
- 不修改旧派系的既有规则语义，除非发现当前漫威规则确实需要共享机制扩展。
- 不在提案批准前修改运行时代码。

## Decisions

### Decision: 使用一个 `9 x 6` 共享 atlas

新增一个漫威卡牌 atlas ID，四派系的 `previewRef.index` 直接使用 `0-53` 的全局 row-major 索引。

不把原图复制成四张派系图集，避免重复资源、重复压缩和索引漂移。

### Decision: 四派系使用独立业务前缀

- `avengers_*`
- `shield_*`
- `spider_verse_*`
- `ultimates_*`

每个派系拥有独立的数据文件和 ability 模块。共享机制通过 domain helper 或既有 registry 复用，不通过跨派系 CardDef 继承。

### Decision: 规则合同锁定后再实施

每张卡先从完整单卡裁图锁定中文原文并拆成 effect atom。implementation 只能消费已标记 `locked` 的卡牌合同。

任何看不清的限定词只阻塞该卡或该子句，不允许由 TTS 名称、既有相似卡或记忆补齐。

### Decision: 按单派系闭环

实施顺序：

1. 复仇者
2. 神盾局
3. 蜘蛛宇宙
4. 终极战队

每个派系依次完成静态数据、能力、L2、L3/L4 和 evidence，再进入下一个派系。

### Decision: 漫威基地单独处理

本 change 不需要漫威专属基地才能让派系进入现有公共基地池并可玩。

如果用户后续提供基地 atlas，则创建独立 change 或在实施前经明确范围变更纳入，不在当前卡牌图上推断基地名称、断点或能力。

### Decision: 共享文件采用增量合并

修改 `ids.ts`、`atlasCatalog.ts`、`cards.ts`、`abilities/index.ts`、`factionMeta.ts`、locale 和 manifest 前，重新读取当前文件与 diff，只追加本 change 的注册项。

不得用预制整文件替换当前并行 POD 改动。

## Risks / Trade-offs

- 中文卡图的部分小字可能不可读。
  - 缓解：完整单卡裁图加局部放大；只把具体字段标记为 `blocked/partial`。
- 四派系共用 atlas，错误索引会跨派系污染。
  - 缓解：以 TTS `CardID 19600-19653` 和自动生成的 `atlas-index.json` 做合同测试。
- 漫威卡牌可能需要新的响应窗口或计分交互。
  - 缓解：先反查现有 shared mechanism；确有缺口时只做可复用扩展，并补旧消费者回归。
- 当前工作区有并行 Smash Up 改动。
  - 缓解：共享文件写前重读，使用小范围 patch，并在每次写后核对双方注册项仍存在。

## Validation

- `openspec validate add-smashup-marvel-avengers-shield-spiderverse-ultimates --strict --no-interactive`
- atlas 索引与牌组数量合同测试
- card/i18n/faction registry/critical image resolver 定向 Vitest
- 每个新增或修改的 `.ts/.tsx` 文件执行 ESLint
- 每派系至少一条真实打牌或真实触发 E2E
- 新交互类型必须有首条 direct E2E 和截图
- 图片压缩、manifest 重建和本地资源键校验；PR 合并/发布后再执行代表 URL `HEAD 200`
