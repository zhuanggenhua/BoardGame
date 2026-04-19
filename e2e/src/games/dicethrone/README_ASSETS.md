# Dice Throne 素材使用规范

本文档只描述 `dicethrone` 当前真实生效的素材链路，用于新增英雄、重录卡图、审计 atlas 索引和排查预览问题。

## 1. 当前结论

- Dice Throne 手牌预览统一走 `previewRef.type = 'atlas'`。
- 基础技能不再渲染 `base-ability-cards`；玩家面板 `player-board` 自带基础技能图，覆盖层只负责点击区域和升级卡叠加。
- 运行时不再使用 `hand-cards-atlas`。
- 录入时为了看清文字额外做的后处理图，一律是中间产物，必须放 `temp/`，不能放进 `public/assets/.../crops/**` 伪装成正式资源。
- 新角色是否能继续沿用老派系 atlas 契约，必须回到原始 `compressed/ability-cards.webp` 与老角色同位对照后再裁定；不能拿历史核对图直接下结论。
- 复合升级默认先按老派系能力合同理解：一张升级卡替换一个基础技能，内部 `variants` / 子效果同类取最高；这不自动等于图片层要拆成多张正式手牌图。
- 新角色默认必须优先复用老派系已经跑通的共享运行时逻辑：同类档位自动取最高，同卡复合子技能再选择。除非已证伪老派系合同，否则禁止为新角色单独发明新的选择规则、手牌模型或 atlas 语义。

## 2. 单一真实来源

### 2.1 图片资源

- 角色资源目录：`public/assets/i18n/zh-CN/dicethrone/images/<hero>/`
- 通用资源目录：`public/assets/i18n/zh-CN/dicethrone/images/Common/`
- 常见文件：
  - `ability-cards.webp|png`
  - `player-board.webp|png`
  - `tip.webp|png`
  - `dice.webp|png`
  - `status-icons-atlas.webp|png`

补充强制规则：

- `public/assets/.../crops/**` 不再是 Dice Throne 的默认正式目录语义。
- 只要某张图是为了 OCR / 录入核对 / 局部放大 / 上下拆分额外生成的，就必须落 `temp/dicethrone-intake/<hero>/...`。
- 如果仓库里已经存在 `public/assets/.../crops/**` 的历史文件，排查时必须先确认它是不是后处理中间产物，不能默认拿来当主真相源或正式运行时合同。

### 2.2 图集配置

- 默认卡牌 atlas 配置：`src/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json`
- 当前真实实现不是“所有英雄永远共享同一份配置”，而是：
  - `monk / barbarian / pyromancer / shadow_thief / moon_elf / paladin / gunslinger / samurai` 全部复用公共网格
- `src/assets/atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json` 现仅作为历史错误实现留档，不再是正式运行时配置
- 是否允许引入新的 per-hero atlas json，必须先由“原始图 + 老角色同位对照 + 真实 UI 消费链”共同证实；禁止无证据扩表。

### 2.3 路径帮助函数

- `src/games/dicethrone/ui/assets.ts`
- 运行时图片路径统一从 `ASSETS` 取：
  - `ASSETS.CARDS_ATLAS(charId)`
  - `ASSETS.PLAYER_BOARD(charId)`
  - `ASSETS.TIP_BOARD(charId)`
  - `ASSETS.DICE_SPRITE(charId)`
  - `ASSETS.EFFECT_ICONS(charId)`
- 当前仍保留一个历史例外：`barbarian` 资源路径会追加 `.png`。改动前先确认是否真的要消除此兼容分支。

## 3. 老派系真实做法

### 3.1 专属卡

- 老派系 `monk / barbarian / pyromancer / shadow_thief / moon_elf / paladin` 的专属卡，都是直接在各自 `heroes/<hero>/cards.ts` 里写死 `previewRef: { type: 'atlas', atlasId, index }`。
- 这条规则同样适用于枪手和武士的专属卡。
- 不能靠“代码里的卡顺序”推断 atlas 顺序，必须逐格看图确认。

### 3.2 通用卡

- 通用卡定义集中在 `src/games/dicethrone/domain/commonCards.ts` 的 `COMMON_CARDS`。
- 各英雄不能手写 18 张通用卡的 `previewRef`，必须统一走 `injectCommonCardPreviewRefs(...)` 注入。

当前通用卡 atlas 映射分两类：

- 老派系默认映射：`DEFAULT_COMMON_ATLAS_INDEX`
  - 适用于 `barbarian / monk / pyromancer / shadow_thief / moon_elf / paladin`
- 新派系反向映射：`GUNSLINGER_COMMON_ATLAS_INDEX`、`SAMURAI_COMMON_ATLAS_INDEX`
  - 枪手和武士的通用牌区顺序与老派系不同，经逐格看图确认后需要单独映射

### 3.3 预览查询

- `src/games/dicethrone/ui/cardPreviewHelper.ts` 会遍历每个英雄的 `getStartingDeck()` 建立预览映射。
- 通用卡在不同英雄图集里的索引可能不同，所以只知道 `cardId` 不够，优先传 `characterId` 给 `getDiceThroneCardPreviewRef(cardId, characterId)`。
- 任何新 UI 如果直接按 `cardId` 反查预览，都要先确认是否会误用到别的英雄的通用卡索引。

## 4. 枪手 / 武士新增规则

### 4.1 先区分三层对象，再谈索引

Dice Throne 新英雄录入时，至少要区分下面三层，禁止混写：

- `物理卡 / 手牌卡`：玩家真正抽到、打出、弃掉的卡对象；`card.id` 与 `previewRef` 都服务这一层。
- `技能槽 / 基础技能`：玩家面板上的基础能力槽位；升级卡的 `targetAbilityId` 只允许指向这一层的基础技能 ID。
- `技能变体 / 技能子集`：同一基础技能下的 `variants`、分支触发、阈值档位；它们属于能力执行合同，不会生成新的手牌卡图索引。

强制约束：

- `action` 卡是“打出后直接结算自己的 `effects` / `customAction` / `rollDie`”，不是替换技能槽。
- `upgrade` 卡才允许用 `replaceAbility(...)` 改写玩家面板上的基础技能。
- 一张升级卡可以替换一个基础技能定义，并且该技能定义内部可以包含多个 `variants`。
- 但这不代表“一张升级卡存在多个手牌对象”或“一个技能变体要占一个新 card index”。
- 老派系里更常见的真实模式是“复合升级，但不是复合手牌”：
  - `monk/card-thrust-punch-2/3 -> fist-technique`
  - `barbarian/upgrade-slap-2/3 -> slap`
  - `paladin/upgrade-righteous-combat-2/3 -> righteous-combat`
  - `paladin/upgrade-holy-defense-2/3 -> holy-defense`
  - `samurai/upgrade-katana-slice-2/3 -> katana-slice`
- 这些升级内部都可能含多个 `variants`、多个阈值或同类取最高的子效果，但运行时仍是一张升级卡、一个基础技能目标。
- `targetAbilityId` 必须始终是基础技能 ID；`newAbilityDef.id` 也必须与该基础技能 ID 一致。
- 如果某个新角色只能靠新增特判才能“看起来正常”，默认先怀疑录入模型错了；在证伪老派系共享逻辑之前，不得先给新角色开分叉。

老派系基线，必须按这个口径对新角色逐张比：

- `monk/card-buddha-light`、`monk/card-palm-strike`：都是 `type: 'action'`，打出后直接获得 token / 施加状态，不会升级技能。
- `shadow_thief/action-sneaky-sneaky`、`shadow_thief/action-card-trick`：也是直接结算行动牌，不会写 `replaceAbility`。
- `monk/card-thrust-punch-2`、`barbarian/upgrade-slap-3`：升级后虽然内部按档位拆 `variants`，但升级目标仍是基础技能。
- `paladin/upgrade-righteous-combat-2/3`：II / III 两张升级卡都指向同一个基础技能 ID。
- `paladin/upgrade-holy-defense-2`、`paladin/upgrade-tithes-2`：防御/偏被动技能升级也不例外，仍只替换基础技能。

### 4.2 武士：标准 full-card atlas

- 武士的 `ability-cards.webp` 继续沿用标准 full-card atlas 语义。
- `slot-18 ~ slot-31` 一张正式卡对应一个运行时 `previewRef.index`。
- `slot-00 ~ slot-17` 是反向排列的通用卡区，不得回退到老角色默认顺序。

### 4.3 新角色：先证伪核对图，再裁定 atlas 合同

- 枪手 / 武士这类新角色排查时，不能先拿 `public/assets/.../crops/ability-cards/*.webp` 当铁证。
- 任何“看起来一格里有两张”“看起来只裁到上半张”“看起来不像老派系”的结论，都必须先回到原始 `compressed/ability-cards.webp` 与老派系同位裁图对照。
- 如果核对图是经过上下拆分、放大、normalized preview、拼接等后处理生成的，它只服务人工辨认，不代表 atlas 真相源本体。
- 因此必须同时区分三层：
  - `原始真相源`：`compressed/ability-cards.webp`
  - `临时核对图`：录入时为看清文字生成的后处理图，统一放 `temp/`
  - `正式运行时资源`：代码真实引用、已进 manifest 的 atlas 或正式单图
- 当前硬规则：
  - 不得从历史核对图直接反推“枪手某 slot 是复合位”
  - 不得从历史核对图直接反推“武士某 slot 需要改单卡图”
  - 不得因为一张升级牌素材里有上下子区、多个标题或相关技能名，就直接把它拆成多个 runtime frame
  - atlas 是否失配，必须由原始图 + 老角色同位对照 + 真实 UI 消费链共同裁定
  - 一旦证据闭环成立，运行时合同必须显式落到 atlas 配置里，不能继续用临时单卡图硬接线
  - 一旦证据闭环指向“同一张物理牌里的复合子区”，必须立刻停止继续修 UI / 测试 / atlas 接线，先回到录入模型裁定；禁止用“当前链路能跑通”继续掩盖错误数据模型

### 4.3.1 复合物理牌的强制裁定顺序

当枪手 / 武士或后续新角色出现“同一张物理牌上下子区”时，必须按下面顺序处理：

1. 先裁定它是不是一张物理牌
2. 再对照老派系同类升级，判断是否属于“一个基础技能目标 + 内部同类取最高”的复合升级
3. 最后才允许修改 `cards.ts`、`previewRef`、atlas 或 E2E

禁止倒序：

- 不能先改显示再反推素材语义
- 不能先写两张牌数据再靠文档兜底
- 不能先用 E2E 证明“当前看起来没问题”，再把这当成录入正确

### 4.4 调试 / 作弊入口仍不能把 source slot 当成唯一 card identity

- 调试发牌、索引速查、测试注入如果只传 `source slot`，在枪手 `slot-22 / 23 / 24` 这类共享源位上会出现多候选。
- 因此需要精确发牌或精确验图时，必须改用 `cardId` 或精确 `deckIndex`，不能把共享 `source slot` 当唯一 card identity。
- 不要把人工核对时拆出来的上半 / 下半辅助图，误当成正式运行时资源或主真相源。

## 5. 运行时加载链路

### 5.1 卡牌 atlas 注册

- 文件：`src/games/dicethrone/ui/cardAtlas.ts`
- 当前是模块加载时同步注册，不再走 `Board.tsx` 内的异步 `loadAtlas()`。
- 注册逻辑：
  - 遍历 `DICETHRONE_CARD_ATLAS_IDS`
  - 用 `ASSETS.CARDS_ATLAS(charId)` 作为图片路径
  - 默认绑定 `ability-cards-common.atlas.json`
  - 当前全部角色绑定 `ability-cards-common.atlas.json`

### 5.2 状态图标 atlas

- 每个英雄在 `src/games/dicethrone/domain/characters.ts` 里声明：
  - `statusAtlasId`
  - `statusAtlasPath`
- `statusAtlasPath` 必须是 JSON 路径，不是图片路径。

### 5.3 关键图片预加载

- Dice Throne 的关键图预加载走 `criticalImageResolver`。
- 回归要求：
  - 不能重新把 `hand-cards-atlas` 放回 `critical` 或 `warm`
  - 新英雄接入后，`player-board / tip / ability-cards / dice / status-icons-atlas` 这些真正运行时会看到的素材要进入正确的预加载集合

## 6. 新增英雄 / 重录素材的标准步骤

### 6.1 素材准备

- 准备角色目录下的 `ability-cards / player-board / tip / dice / status-icons-atlas`
- 先确认图片进入 `public/assets/i18n/zh-CN/dicethrone/images/<hero>/`
- 如有原图，按项目统一规范压缩到 `compressed/`

### 6.2 代码接线

1. 在 `domain/ids.ts` 注册：
   - `DICETHRONE_CARD_ATLAS_IDS.<HERO>`
   - `DICETHRONE_STATUS_ATLAS_IDS.<HERO>`
2. 在 `domain/characters.ts` 注册：
   - `getStartingDeck`
   - `statusAtlasId`
   - `statusAtlasPath`
3. 在 `heroes/<hero>/cards.ts`：
   - 专属卡逐张写 `previewRef`
   - 通用卡统一 `...injectCommonCardPreviewRefs(COMMON_CARDS, atlasId, indexMap?)`
4. 如涉及升级叠加显示或槽位高亮，更新对应的 UI 槽位映射文件，而不是在卡牌数据里偷塞布局状态

### 6.3 索引核对

- 先按整图逐格编号
- 再把 `cards.ts` 的 `previewRef.index` 与逐格图一一对应
- 如遇复合排版：
  - 先区分“原图 slot”和“正式运行时合同”
  - 先核老派系与当前运行时是否本来就允许共享 `slot/index`
  - 如果共享的是源图位而不是运行时卡面，应该把差异落成专属 frame atlas，而不是继续保留临时单卡图
  - 把结论写进对应英雄的 `rule/*卡牌录入核对.md`
  - 补审计文档，不要只在代码里默许

## 7. 审计与验证

### 7.1 必审项

- `previewRef` 是否都指向 `atlas`
- 通用卡是否走统一注入，而不是手写散落
- 新英雄是否错误复用了别的英雄通用牌索引
- 是否残留 `hand-cards-atlas`、单卡运行时裁图或过期路径
- 若存在复合排版，是否已经明确共享索引合同，而不是又被代码偷偷拆成半张 frame
- 若争议点是复合升级，是否已经先和老派系同类升级逐张对照，而不是只看新角色自己的图

### 7.2 建议验证命令

```powershell
npx vitest run --config vitest.config.audit.ts --configLoader native src/games/dicethrone/__tests__/card-cross-audit.test.ts
npx vitest run src/games/dicethrone/__tests__/criticalImageResolver.test.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1 -t "作弊发牌源图 atlas 索引保护"
```

如果本轮只改了某个英雄，也至少要补一条该英雄自己的索引/预览回归，不要只靠肉眼扫图。

## 8. 禁止事项

- 禁止把 `hand-cards-atlas` 当成回退方案重新接回来
- 禁止把人工核对裁图或后处理核对图直接当运行时素材
- 禁止把 `public/assets/.../crops/**` 当成“后处理图的正式归宿”
- 禁止按代码顺序猜 atlas 索引
- 禁止给通用卡逐张手写 `previewRef`
- 禁止在新 UI 里只按 `cardId` 反查通用卡预览，却不传 `characterId`
- 禁止把原图 slot、技能子集或技能变体误当成手牌卡图索引

## 9. 文档落点要求

- 英雄专项卡图/索引核对：写到 `src/games/dicethrone/rule/<英雄>卡牌录入核对.md`
- 真相源与裁图来源：写到 `src/games/dicethrone/rule/<英雄>真相源表.md`
- 对外宣称“审计完成”时，必须在 `evidence/` 下留审计文档
- 如果后续发现旧审计漏了复合位、调试入口或预加载链路，必须回写原审计文档，不能保留旧结论继续充当收口证据

---

最后更新：`2026-04-06`
