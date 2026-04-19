# 大杀四方 generic 交互可变引用源审计 2026-04-05

## 审计范围

- 代码范围：
  - `src/engine/systems/InteractionSystem.ts`
  - `src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts`
  - `src/games/smashup/abilities/*.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
- 审计对象：`targetType: 'generic'` 的交互，重点排查会引用可变对象的候选来源。
- 本轮关注四类来源：
  - 埋葬牌 `buried`
  - 弃牌堆 `discard`
  - 手牌 + 弃牌堆混合来源 `hand + discard`
  - 牌库顶 / 静态快照 / 场上快照

## 审计方法

- 先按 `createSimpleChoice(..., { targetType: 'generic' })` 全量检索。
- 再按选项来源分桶：
  - `_source: 'discard'`
  - `_source: 'deck'`
  - `_source: 'static'`
  - `value` 中携带 `cardUid / defId / baseIndex / minionUid`
- 判定是否属于“活引用”：
  - 玩家响应时，该对象仍可能因为前置交互、同链事件、其他效果而离开原位置。
- 对活引用要求：
  - 必须显式声明 `autoRefresh`
  - 必须显式声明 `responseValidationMode: 'live'`

## 本轮结论

### A. 已统一收口的来源

#### 1. 埋葬牌

- 已覆盖 sourceId：
  - `ancient_egyptians_pyramid_engineer_uncover`
  - `ancient_egyptians_pharaoh_before_scoring`
  - `ancient_egyptians_lost_knowledge_uncover`
  - `ancient_egyptians_seal_the_tomb_uncover`
  - `titan_sphinx_start_turn`
  - `titan_sphinx_after_scoring`
  - `bury_uncover_start_turn`
- 统一语义：
  - `autoRefresh: 'buried'`
  - `responseValidationMode: 'live'`

#### 2. 弃牌堆

- 本轮新增接入 sourceId：
  - `cthulhu_recruit_by_force`
  - `cthulhu_it_begins_again`
  - `cthulhu_servitor`
  - `elder_thing_begin_the_summoning`
  - `elder_thing_begin_the_summoning_pod`
  - `elder_thing_spreading_horror_pod_choose_minion`
  - `robot_microbot_reclaimer`
  - `steampunk_scrap_diving`
  - `zombie_grave_digger`
  - `zombie_grave_robbing`
  - `zombie_not_enough_bullets`
  - `zombie_lend_a_hand`
  - `vampire_crack_of_dusk`
  - `vampire_wolf_pact_pod_action`
  - `titan_ghosts_creampuff_man_play`
- 统一语义：
  - `autoRefresh: 'discard'`
  - `responseValidationMode: 'live'`
- 共享层补强：
  - `discard` 刷新逻辑现在不仅支持按 `cardUid` 校验，也支持按 `defId` 校验分组选项。
  - 这样像 `zombie_not_enough_bullets` 这类“同名分组”不再只能走快照。

#### 3. 手牌 + 弃牌堆混合来源

- 本轮新增接入 sourceId：
  - `vampire_fledgling_vampire_pod_bury_source`
  - `titan_penguins_emperor_penguin_talent`
- 统一语义：
  - `autoRefresh: 'hand_or_discard'`
  - `responseValidationMode: 'live'`
- 共享层补强：
  - `InteractionSystem` 新增 `hand_or_discard` 刷新语义。
  - 会优先根据 `value.zone / value.from / value.sourceZone` 判定应留在哪个区域。

### B. 已审且已转为 live 失效校验的来源

#### 1. 牌库顶单卡活引用

- `robot_hoverbot`
- 结论：
  - 这不是纯“揭示快照”。
  - 交互处理时真正消费的是“当前仍在牌库顶的那一张牌”。
  - 如果牌库顶在响应前已被别的效果改写，旧的 `play` 选项必须失效，只能保留 `skip`。
- 已收口方式：
  - `responseValidationMode: 'live'`
  - `optionsGenerator` 改为按当前 `deck[0]` 重建，而不是只信任 `continuationContext`
- 已补回归：
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - `src/games/smashup/__tests__/robot-hoverbot-button-disabled.test.ts`

#### 2. 牌库顶揭示块活引用

- 已覆盖 sourceId：
  - `vikings_cast_the_runes_order`
  - `vikings_raiding_party_choice`
  - `cowboys_gold_in_them_thar_hills`
  - `cowboys_gold_in_them_thar_hills_order`
  - `wizard_mass_enchantment`
  - `wizard_portal_order`
  - `base_wizard_academy`
- 结论：
  - 这些交互虽然看起来像“揭示快照排序/选择”，但真正合法的候选只应该来自“当前仍连续位于牌库顶的那一段揭示块”。
  - 如果前置 handler 已经改写牌库顶，旧快照里的牌不应继续保留在候选中，更不能在后续 `DECK_REORDERED` 里把当前真实牌库外的牌误带回去。
  - `wizard_mass_enchantment` 还额外带有“按不同对手各自牌库顶取候选”的跨玩家上下文，不能只校验“牌还在 deck 任意位置”。
- 已收口方式：
  - `responseValidationMode: 'live'`
  - `optionsGenerator` 改为按当前顶端揭示块重建，而不是继续信任 `remainingDeckUids / remainingCards`
  - handler 也统一基于同一份 live 顶端揭示块落地，避免 stale choice 进入下一段链
  - 共享层已新增顶部连续揭示块 helper，统一承载 deck / baseDeck 顶快照过滤语义，减少后续 sourceId 级复制实现
- 已补回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - `src/games/smashup/__tests__/query6Abilities.test.ts`
  - `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts`

### C. 已审但暂不加 live 刷新的来源

- 这类 sourceId 多数不是“活引用当前区域对象”，而是“静态快照 + continuationContext”模型：
- 当前判断：
  - 它们主要消费的是“揭示当下的快照”而不是“持续读取该区域的最新集合”。
  - 因此目前仍不把它们统一抽象成共享 `deck` 刷新语义，而是保留 `generic + reason`。
- 残留风险：
  - 虽然 `wizard_mass_enchantment`、`wizard_portal_order`、`base_wizard_academy` 已完成 source 级 live 过滤，但共享层仍未统一抽象成 `deck_top_snapshot / revealed_snapshot / base_deck_top_snapshot` 语义；如果后续出现更多同类链式交互，应该上收到共享层，而不是继续逐个 sourceId 手工兜。

## 审计文档登记补全

- 本轮补全了 `interactionTargetTypeAudit.test.ts` 中一批此前缺失的 `generic` 保留原因。
- 新增 / 更新的重点包括：
  - 弃牌堆活引用类
  - 手牌+弃牌堆混合来源类
  - 牌库顶揭示块 live 过滤类
  - 一批静态快照类 `generic` 的保留理由

## 验证证据

### 通过

```powershell
npx vitest run src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts
```

结果：

- 17/17 通过
- 新覆盖点：
  - `discard` 分组选项按 `defId` 刷新
  - `hand_or_discard` 混合来源 live 校验

### 通过（有 1 条仓库既有失败）

```powershell
npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts
```

结果：

- 本轮新增的 `vikings_* / cowboys_*` live 登记已被审计文件识别。
- 当前仍有 1 条仓库既有失败，与本轮 stale-source 扩审无关：
  - `base_the_asylum` 在审计期望中登记为 `button`，源码当前实际是 `hand`

### 通过

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/query6Abilities.test.ts --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts --configLoader native
```

结果：

- `InteractionSystem-auto-injection.test.ts`：`20 passed`
- `query6Abilities.test.ts`：`28 passed`
- `baseAbilitiesPrompt.test.ts`：`33 passed`
- 新覆盖点：
  - `InteractionSystem` 新增“顶部连续快照”共享 helper，并验证会按当前顶部顺序保留仍属于原揭示集合的连续块
  - `wizard_mass_enchantment` 在对手牌库顶变化后不再保留旧行动卡候选
  - `wizard_portal_order` 在牌库顶被插入新牌后不再继续暴露旧揭示排序项
  - `base_wizard_academy` 在 baseDeck 顶变化后不再继续暴露旧的重排候选

### 相关已通过的真实业务 E2E

- 见：
  - `evidence/smashup-sphinx-start-turn-buried-refresh-e2e-test.md`
- 该 E2E 已证明：
  - `titan_sphinx_start_turn -> bury_uncover_start_turn` 这条真实链路里，刚被回手的埋葬牌不会残留到后续交互。

## 命中的审计维度

- D5：交互完整
- D8：时序正确
- D9：幂等与重入
- D24：Handler 共返状态一致性
- D35：交互上下文快照完整性
- D47：E2E 测试覆盖完整性

## 未覆盖风险

- 虽然 `robot_hoverbot`、`vikings_*`、`cowboys_*`、`wizard_mass_enchantment`、`wizard_portal_order`、`base_wizard_academy` 已完成按当前牌库顶 / baseDeck 顶 live 过滤，但共享层仍没有统一的 `deck_top_snapshot / revealed_snapshot / base_deck_top_snapshot` 语义；后续新增同类交互仍可能再次漏配。
- `targetPlayerId` 指向他人牌堆/弃牌堆/手牌的 `generic` 交互，本轮没有统一扩展成“按目标玩家区域 live 校验”的共享能力。
- `base_the_asylum` 属于仓库既有审计债务，不在本轮 stale-source 修复范围内。

## 修订记录

- 2026-04-05：
  - 从“只修埋葬牌 stale”扩展到 generic 可变引用源的系统性审计。
  - 新增 `hand_or_discard` 共享刷新语义。
  - 批量补齐弃牌堆活引用类 sourceId 的 `autoRefresh/live`。
  - 复核后确认 `robot_hoverbot` 属于“当前牌库顶活引用”而非纯静态快照，调整为 live 失效校验。
  - 继续扩审 `vikings_*` / `cowboys_*` 揭示块交互，确认它们同样需要按当前牌库顶 live 过滤候选与落地排序，并补齐回归。
  - 再扩审 `wizard_mass_enchantment` / `wizard_portal_order` / `base_wizard_academy`，确认它们同样属于揭示块 live 引用，而不是可长期信任的静态快照。
