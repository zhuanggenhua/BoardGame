# Pre-Push Hook Test Failures Analysis

## Summary
- **Total**: 15 failed | 3060 passed | 9 skipped (3084 tests)
- **Status**: ❌ Pre-push hook will FAIL

## Failed Tests

### 1. baseAbilitiesPrompt.test.ts
- **Test**: base_tortuga 计分后亚军移动随从 > 亚军有随从时生成 Prompt
- **Issue**: Interaction/Prompt generation issue

### 2. baseAbilityIntegrationE2E.test.ts
- **Test**: base_tortuga 托尔图加 (afterScoring) > 基地达标且有亚军随从 → Interaction 亚军移动随从
- **Issue**: Integration test failure

### 3. cthulhuExpansionAbilities.test.ts
- **Test**: 印斯茅斯派系能力 > innsmouth_the_deep_ones (深潜者：力量≥3随从+1力量)
- **Error**: `expected +0 to be 1` - Power modifier not applied
- **Issue**: Power modifier reduce verification failed

### 4. duplicateInteractionRespond.test.ts
- **Test**: 同一交互重复 respond 防护 > 第二次 SYS_INTERACTION_RESPOND 对已消费的交互应被拒绝
- **Error**: `expected 1 to be +0` - Duplicate response not blocked
- **Issue**: Interaction system should reject duplicate responses

### 5. expansionAbilities.test.ts
- **Test**: cthulhu_complete_the_ritual 打出约束 > 目标基地有自己随从时可以打出
- **Issue**: Card play validation issue

### 6. interactionChainE2E.test.ts
- **Test**: P3: pirate_first_mate (大副) 触发链 > 通过直接设置交互测试：选随从 → 选基地 → 移动
- **Issue**: Interaction chain E2E test failure

### 7. madnessAbilities.test.ts
- **Test**: 米斯卡托尼克大学 - 疯狂卡能力 > miskatonic_mandatory_reading (最好不知道的事：special，选随从 抽疯狂卡+力量加成)
- **Issue**: State verification failed after drawing madness cards

### 8. newBaseAbilities.test.ts (2 failures)
- **Test 1**: base_laboratorium 实验工坊 - 基地全局首次随从 > 本回合该基地已被其他玩家打过随从时不应再次触发
- **Error**: `expected 1 to be +0` - Trigger fired when it shouldn't
- **Test 2**: base_moot_site 集会场 - 基地全局首次随从 > 本回合该基地已被其他玩家打过随从时不应再次触发
- **Error**: `expected 1 to be +0` - Same issue
- **Issue**: "First minion on base this turn" tracking broken

### 9. newFactionAbilities.test.ts (3 failures)
- **Test 1**: 巨蜂派系能力 > 兵蜂：onPlay 放1指示物；talent 移除1并转移1个指示物给另一个随从
- **Error**: `Cannot read properties of undefined (reading 'data')`
- **Issue**: Undefined data access in counter/token system
- **Test 2**: 巨蜂派系能力 > 雄蜂：防止失败（指示物耗尽）时重新发出 MINION_DESTROYED
- **Issue**: Event emission issue
- **Test 3**: 科学怪人派系能力 > 怪物：天赋移除指示物并额外打出随从
- **Error**: `expected undefined to be defined`
- **Issue**: Undefined value in talent ability

### 10. robot-hoverbot-chain.test.ts (2 failures)
- **Test 1**: 盘旋机器人链式打出 > 应该正确处理连续打出两个盘旋机器人
- **Error**: `expected 'hoverbot-2' to be 'zapbot-1'` - Wrong card revealed
- **Issue**: Deck top card tracking broken
- **Test 2**: 盘旋机器人链式打出 > 应该阻止打出已经不在牌库顶的卡
- **Error**: `expected true to be false` - Validation not blocking invalid play
- **Issue**: Validation should prevent playing card no longer on deck top

### 11. zombieInteractionChain.test.ts
- **Test**: zombie_theyre_coming_to_get_you (它们为你而来) 弃牌堆出牌 > 消耗正常随从顺序
- **Error**: `expected +0 to be 1` - Discard pile consumption order wrong
- **Issue**: Discard pile card consumption logic broken

## Root Causes

### Category 1: Power Modifier System (1 failure)
- cthulhuExpansionAbilities.test.ts - Power modifier not applied in reduce

### Category 2: Interaction System (4 failures)
- baseAbilitiesPrompt.test.ts - Prompt generation
- baseAbilityIntegrationE2E.test.ts - Integration
- duplicateInteractionRespond.test.ts - Duplicate response protection
- interactionChainE2E.test.ts - Chain handling

### Category 3: Counter/Token System (3 failures)
- newFactionAbilities.test.ts (3 tests) - Undefined data access, event emission, talent ability

### Category 4: Deck/Discard Tracking (3 failures)
- robot-hoverbot-chain.test.ts (2 tests) - Deck top tracking
- zombieInteractionChain.test.ts - Discard pile consumption

### Category 5: Base Ability Triggers (2 failures)
- newBaseAbilities.test.ts (2 tests) - "First minion this turn" tracking

### Category 6: Card Play Validation (1 failure)
- expansionAbilities.test.ts - Play validation

### Category 7: State Verification (1 failure)
- madnessAbilities.test.ts - State after drawing cards

## Impact on Push
❌ **Cannot push** - Pre-push hook requires all core tests to pass

## Recommendation
These failures appear to be pre-existing issues, not caused by our recent changes. We have two options:

1. **Fix all 15 failures** (time-consuming, may introduce new issues)
2. **Skip pre-push hook** using `SKIP_SIMPLE_GIT_HOOKS=1 git push` (not recommended for production)
3. **Check if these failures existed before our changes** using git stash + test

## Next Steps
1. Verify these are pre-existing failures (git stash our changes, run tests)
2. If pre-existing, discuss with team about push strategy
3. If caused by our changes, need to fix before pushing
