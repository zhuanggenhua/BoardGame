# Smash Up Phase 3 - 可选测试任务实施计划

## 📋 概述

本文档列出了 Smash Up Phase 3 spec 中标记为可选（`*`）的测试任务。这些测试可以在后续迭代中补充，以提高代码覆盖率和回归验证能力。

---

## 🎯 测试任务清单

### 1. Complete the Ritual 测试 (任务 1.2)

**优先级**: 中  
**预估工作量**: 30 分钟

**测试文件**: `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts`

**测试用例**:
```typescript
describe('Complete the Ritual 放牌库底', () => {
    it('触发后所有随从产生 CARD_TO_DECK_BOTTOM 事件', () => {
        // 设置：基地上有 Complete the Ritual + 多个随从
        // 执行：拥有者回合开始
        // 验证：所有随从产生 CARD_TO_DECK_BOTTOM 事件（不是 MINION_RETURNED）
    });

    it('触发后所有 ongoing 行动卡产生 CARD_TO_DECK_BOTTOM 事件', () => {
        // 设置：基地上有 Complete the Ritual + 其他 ongoing 卡
        // 执行：拥有者回合开始
        // 验证：所有 ongoing 产生 CARD_TO_DECK_BOTTOM 事件（不是 ONGOING_DETACHED）
    });

    it('触发后基地被替换', () => {
        // 验证：BASE_REPLACED 事件产生
    });
});
```

**参考文件**: `src/games/smashup/abilities/cthulhu.ts:295-350`

---

### 2. 母星力量校验测试 (任务 2.2)

**优先级**: 高  
**预估工作量**: 20 分钟

**测试文件**: 新建 `src/games/smashup/__tests__/homeworldRestriction.test.ts`

**测试用例**:
```typescript
describe('母星（The Homeworld）力量≤2 限制', () => {
    it('力量≤2 的随从可以打出', () => {
        // 设置：母星基地，手牌有力量 2 的随从
        // 执行：PLAY_MINION 到母星
        // 验证：命令成功，随从打出
    });

    it('力量>2 的随从被拒绝', () => {
        // 设置：母星基地，手牌有力量 3 的随从
        // 执行：PLAY_MINION 到母星
        // 验证：命令被拒绝，错误信息包含"力量"
    });

    it('力量修正后>2 的随从被拒绝', () => {
        // 设置：母星基地，手牌有基础力量 2 但有 +1 修正的随从
        // 执行：PLAY_MINION 到母星
        // 验证：命令被拒绝
    });
});
```

**参考文件**: `src/games/smashup/domain/baseAbilities.ts` (搜索 `base_the_homeworld`)

---

### 3. Full Sail 测试 (任务 4.2)

**优先级**: 中  
**预估工作量**: 45 分钟

**测试文件**: 新建 `src/games/smashup/__tests__/pirateFullSail.test.ts`

**测试用例**:
```typescript
describe('Full Sail 多步移动', () => {
    it('移动 1 个随从后选择完成', () => {
        // 设置：多个基地，每个基地有己方随从
        // 执行：打出 Full Sail，选择移动 1 个随从，选择"完成"
        // 验证：1 个 MINION_MOVED 事件，无后续 Prompt
    });

    it('移动多个随从（continuation 链）', () => {
        // 设置：多个基地，每个基地有己方随从
        // 执行：打出 Full Sail，选择移动随从 A，选择移动随从 B，选择"完成"
        // 验证：2 个 MINION_MOVED 事件，movedUids 正确累积
    });

    it('无己方随从时产生空事件', () => {
        // 设置：所有基地都没有己方随从
        // 执行：打出 Full Sail
        // 验证：无 Prompt，无 MINION_MOVED 事件
    });

    it('不能重复移动同一个随从', () => {
        // 设置：只有 1 个己方随从
        // 执行：打出 Full Sail，移动随从 A
        // 验证：后续 Prompt 的选项中不包含随从 A
    });
});
```

**参考文件**: `src/games/smashup/abilities/pirates.ts:120-185`

---

### 4. Furthering the Cause 属性测试 (任务 5.2)

**优先级**: 低  
**预估工作量**: 40 分钟

**测试文件**: `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts`

**测试用例**:
```typescript
describe('Furthering the Cause 属性测试', () => {
    it('Property: 本回合消灭对手随从 → 获得 1 VP', () => {
        // 使用 fast-check 生成随机场景
        // 验证：turnDestroyedMinions 包含对手随从 → VP_AWARDED 事件
    });

    it('Property: turnDestroyedMinions 正确追踪', () => {
        // 验证：MINION_DESTROYED 事件 → turnDestroyedMinions 更新
    });

    it('Property: 回合切换时 turnDestroyedMinions 清空', () => {
        // 验证：TURN_CHANGED 事件 → turnDestroyedMinions 清空
    });

    it('本回合未消灭对手随从 → 不获得 VP', () => {
        // 设置：turnDestroyedMinions 为空或只有己方随从
        // 验证：无 VP_AWARDED 事件
    });
});
```

**参考文件**: `src/games/smashup/abilities/cthulhu.ts:250-280`

---

### 5. 基础版基地能力测试 (任务 6.5)

**优先级**: 高  
**预估工作量**: 60 分钟

**测试文件**: `src/games/smashup/__tests__/newBaseAbilities.test.ts`（已存在，需补充）

**测试用例**:
```typescript
describe('海盗湾（Pirate Cove）afterScoring', () => {
    it('非冠军玩家生成移动随从 Prompt', () => {
        // 设置：P0 冠军，P1 非冠军，P1 有随从
        // 验证：P1 收到 Prompt，选项包含 P1 的随从
    });

    it('冠军不生成 Prompt', () => {
        // 设置：P0 冠军
        // 验证：P0 无 Prompt
    });

    it('非冠军无随从时跳过', () => {
        // 设置：P1 非冠军但无随从
        // 验证：无 Prompt
    });
});

describe('托尔图加（Tortuga）afterScoring', () => {
    it('亚军生成移动随从到替换基地 Prompt', () => {
        // 设置：P0 冠军，P1 亚军，P1 有随从，有替换基地
        // 验证：P1 收到 Prompt，目标基地为替换基地
    });

    it('无替换基地时跳过', () => {
        // 设置：P1 亚军但无替换基地
        // 验证：无 Prompt
    });
});

describe('巫师学院（Wizard Academy）afterScoring', () => {
    it('冠军查看基地牌库顶 3 张并排列', () => {
        // 设置：P0 冠军，基地牌库≥3 张
        // 验证：P0 收到 Prompt，选项为 3 张卡的排列
    });

    it('基地牌库<3 张时展示所有', () => {
        // 设置：基地牌库只有 2 张
        // 验证：Prompt 选项为 2 张卡的排列
    });
});

describe('蘑菇王国（Mushroom Kingdom）onTurnStart', () => {
    it('选择对手随从移动到蘑菇王国', () => {
        // 设置：其他基地有对手随从
        // 验证：生成 Prompt，选项包含对手随从
    });

    it('无对手随从时跳过', () => {
        // 设置：所有基地都没有对手随从
        // 验证：无 Prompt
    });
});
```

**参考文件**: `src/games/smashup/domain/baseAbilities.ts` (搜索对应基地 ID)

---

### 6. 克苏鲁扩展基地测试 (任务 8.6)

**优先级**: 中  
**预估工作量**: 60 分钟

**测试文件**: 新建 `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`

**测试用例**:
```typescript
describe('疯人院（The Asylum）onMinionPlayed', () => {
    it('有疯狂卡时生成返回 Prompt', () => {
        // 设置：玩家手牌/牌库/弃牌堆有疯狂卡
        // 验证：生成 Prompt，选项包含疯狂卡
    });

    it('无疯狂卡时跳过', () => {
        // 验证：无 Prompt
    });
});

describe('印斯茅斯基地（Innsmouth Base）onMinionPlayed', () => {
    it('弃牌堆有卡时生成选择 Prompt', () => {
        // 设置：弃牌堆有多张卡
        // 验证：生成 Prompt，选项包含弃牌堆的卡
    });

    it('弃牌堆为空时跳过', () => {
        // 验证：无 Prompt
    });
});

describe('密大基地（Miskatonic University Base）afterScoring', () => {
    it('有随从的玩家返回疯狂卡', () => {
        // 设置：P0 有随从 + 疯狂卡，P1 有随从 + 疯狂卡
        // 验证：两个玩家都生成 Prompt
    });

    it('无随从的玩家跳过', () => {
        // 设置：P0 有随从，P1 无随从
        // 验证：只有 P0 生成 Prompt
    });
});

describe('冷原高地（Plateau of Leng）onMinionPlayed', () => {
    it('手牌有同名随从时生成打出 Prompt', () => {
        // 设置：打出随从 A，手牌还有另一张随从 A
        // 验证：生成 Prompt，选项包含手牌中的随从 A
    });

    it('手牌无同名随从时跳过', () => {
        // 验证：无 Prompt
    });
});
```

**参考文件**: `src/games/smashup/domain/baseAbilities_expansion.ts`

---

### 7. AL9000 扩展基地测试 (任务 9.4)

**优先级**: 中  
**预估工作量**: 45 分钟

**测试文件**: `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`（续）

**测试用例**:
```typescript
describe('温室（Greenhouse）afterScoring', () => {
    it('冠军搜牌库选随从打出到新基地', () => {
        // 设置：P0 冠军，牌库有随从，有替换基地
        // 验证：生成 Prompt，选项包含牌库中的随从
    });

    it('牌库无随从时跳过', () => {
        // 验证：无 Prompt
    });
});

describe('神秘花园（Secret Garden）onTurnStart', () => {
    it('授予额外出牌机会', () => {
        // 验证：LIMIT_MODIFIED 事件，minionLimit +1 或 actionLimit +1
    });

    it('力量>2 的随从被拒绝', () => {
        // 设置：手牌有力量 3 的随从
        // 执行：PLAY_MINION 到神秘花园
        // 验证：命令被拒绝
    });
});

describe('发明家沙龙（Inventors Salon）afterScoring', () => {
    it('冠军从弃牌堆选行动卡放入手牌', () => {
        // 设置：P0 冠军，弃牌堆有行动卡
        // 验证：生成 Prompt，选项包含弃牌堆中的行动卡
    });

    it('弃牌堆无行动卡时跳过', () => {
        // 验证：无 Prompt
    });
});
```

**参考文件**: `src/games/smashup/domain/baseAbilities_expansion.ts`

---

### 8. Pretty Pretty 扩展基地测试 (任务 10.6)

**优先级**: 中  
**预估工作量**: 60 分钟

**测试文件**: `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`（续）

**测试用例**:
```typescript
describe('诡猫巷（Cat Fanciers Alley）talent', () => {
    it('消灭己方随从抽卡（每回合一次）', () => {
        // 设置：基地上有己方随从
        // 执行：使用 talent
        // 验证：MINION_DESTROYED + CARDS_DRAWN 事件
    });

    it('每回合只能使用一次', () => {
        // 设置：已使用过 talent
        // 验证：talentUsed 标记，无法再次使用
    });
});

describe('九命之屋（House of Nine Lives）interceptor', () => {
    it('拦截 MINION_DESTROYED 提供移动选项', () => {
        // 设置：己方随从被消灭，九命之屋基地存在
        // 验证：MINION_DESTROYED 被替换为 MINION_MOVED
    });

    it('无九命之屋基地时不拦截', () => {
        // 验证：MINION_DESTROYED 正常执行
    });
});

describe('魔法林地（Enchanted Glade）onActionPlayed', () => {
    it('附着行动到随从后抽 1 卡', () => {
        // 设置：打出附着行动卡
        // 验证：CARDS_DRAWN 事件
    });

    it('非附着行动不触发', () => {
        // 验证：无 CARDS_DRAWN 事件
    });
});

describe('仙灵之环（Fairy Ring）onMinionPlayed', () => {
    it('首次打出随从后授予额外出牌机会', () => {
        // 设置：minionsPlayed = 0
        // 执行：打出随从
        // 验证：LIMIT_MODIFIED 事件
    });

    it('非首次打出不触发', () => {
        // 设置：minionsPlayed = 1
        // 验证：无 LIMIT_MODIFIED 事件
    });
});

describe('平衡之地（Land of Balance）onMinionPlayed', () => {
    it('选择移动己方其他基地随从', () => {
        // 设置：其他基地有己方随从
        // 验证：生成 Prompt，选项包含其他基地的己方随从
    });

    it('无其他基地随从时跳过', () => {
        // 验证：无 Prompt
    });
});
```

**参考文件**: `src/games/smashup/domain/baseAbilities_expansion.ts`

---

### 9. 被动保护类基地测试 (任务 12.3)

**优先级**: 高  
**预估工作量**: 30 分钟

**测试文件**: `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`（续）

**测试用例**:
```typescript
describe('美丽城堡（Beautiful Castle）保护', () => {
    it('力量≥5 的随从免疫 affect', () => {
        // 设置：美丽城堡基地，力量 5 的随从
        // 执行：尝试 affect 该随从
        // 验证：affect 被阻止
    });

    it('力量<5 的随从不受保护', () => {
        // 设置：力量 4 的随从
        // 验证：affect 正常执行
    });
});

describe('小马乐园（Pony Paradise）保护', () => {
    it('基地有 2+ 随从时所有随从免疫 destroy', () => {
        // 设置：小马乐园基地，2 个随从
        // 执行：尝试 destroy 随从
        // 验证：destroy 被阻止
    });

    it('基地只有 1 个随从时不受保护', () => {
        // 设置：只有 1 个随从
        // 验证：destroy 正常执行
    });
});
```

**参考文件**: `src/games/smashup/domain/baseAbilities_expansion.ts`

---

### 10. 卡牌展示系统 E2E 测试 (任务 13.9)

**优先级**: 低  
**预估工作量**: 90 分钟

**说明**: 当前已有 Vitest 集成测试（`revealSystem.test.ts`），E2E 测试为可选增强。

**测试文件**: 新建 `e2e/smashup-card-reveal.e2e.ts`

**挑战**:
- SmashUp 的 `allowLocalMode: false`，需要双人联机设置
- Alien Probe/Scout Ship 需要选 Aliens 派系 + 随机抽到对应卡牌
- 可靠性低，建议优先使用 Vitest 测试

**测试用例**（如果实施）:
```typescript
test('Alien Probe 展示对手手牌', async ({ browser }) => {
    // 1. 创建双人对局
    // 2. P0 选 Aliens 派系
    // 3. 使用 CHEAT_COMMANDS.MERGE_STATE 注入 Alien Probe 到 P0 手牌
    // 4. P0 打出 Alien Probe
    // 5. 验证：CardRevealOverlay 出现，显示 P1 手牌
    // 6. 点击"确认"按钮
    // 7. 验证：CardRevealOverlay 消失
});
```

**参考文件**: 
- `e2e/smashup/smashup-helpers.ts` - 双人对局设置
- `src/games/smashup/tutorial.ts` - CHEAT_COMMANDS 使用示例

---

## 📊 优先级总结

### 高优先级（建议优先实施）
1. 母星力量校验测试 (任务 2.2) - 20 分钟
2. 基础版基地能力测试 (任务 6.5) - 60 分钟
3. 被动保护类基地测试 (任务 12.3) - 30 分钟

**总计**: 110 分钟（约 2 小时）

### 中优先级
4. Complete the Ritual 测试 (任务 1.2) - 30 分钟
5. Full Sail 测试 (任务 4.2) - 45 分钟
6. 克苏鲁扩展基地测试 (任务 8.6) - 60 分钟
7. AL9000 扩展基地测试 (任务 9.4) - 45 分钟
8. Pretty Pretty 扩展基地测试 (任务 10.6) - 60 分钟

**总计**: 240 分钟（约 4 小时）

### 低优先级
9. Furthering the Cause 属性测试 (任务 5.2) - 40 分钟
10. 卡牌展示系统 E2E 测试 (任务 13.9) - 90 分钟

**总计**: 130 分钟（约 2 小时）

---

## 🛠️ 实施建议

### 批量实施策略
1. **第一批**（高优先级）：先实施任务 2.2, 6.5, 12.3，快速提升核心功能覆盖率
2. **第二批**（中优先级）：实施任务 1.2, 4.2, 8.6, 9.4, 10.6，完善扩展包功能测试
3. **第三批**（低优先级）：根据需要实施任务 5.2, 13.9

### 测试模式参考
- 参考现有测试文件的模式：`newBaseAbilities.test.ts`, `cthulhuExpansionAbilities.test.ts`
- 使用 `helpers.ts` 中的工厂函数：`makeState`, `makePlayer`, `makeMinion`, `makeCard`
- 使用 `GameTestRunner` 进行集成测试（参考 `revealSystem.test.ts`）

### 验证清单
每个测试任务完成后：
- [ ] 测试文件创建/更新
- [ ] 所有测试用例通过
- [ ] 覆盖正常路径 + 边界情况
- [ ] 运行 `npx vitest run src/games/smashup/` 确保无回归

---

## 📝 备注

- 所有测试任务都是可选的，核心功能已通过现有测试验证
- 测试补充的主要价值在于提高回归验证能力和代码可维护性
- 如果时间有限，建议优先实施高优先级测试任务
