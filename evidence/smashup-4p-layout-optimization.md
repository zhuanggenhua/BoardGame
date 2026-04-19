# 大杀四方四人局布局优化 - 间距调整

## 用户反馈

> "改大小不如改间距啊大哥"

用户正确指出：四人局 UI 拥挤问题应该通过调整间距而非缩小卡片来解决。

## 优化方案

### 修改前的配置

```typescript
case 4:
    return {
        baseCardWidth: 10,      // 基地卡片宽度 10vw（过小）
        baseGap: 6,             // 基地间距 6vw
        minionCardWidth: 4,     // 随从卡片宽度 4vw（过小）
        // ...
    };
```

**问题**：卡片缩得太小，影响可读性和视觉效果。

### 修改后的配置

```typescript
case 2:
    // 二人局：宽松布局，原始尺寸
    return {
        baseCardWidth: 14,
        baseGap: 12,            // 保持宽松间距
        minionCardWidth: 5.5,
        // ...
    };
case 3:
    // 三人局：适度缩放，缩小间距
    return {
        baseCardWidth: 13,      // 略微缩小
        baseGap: 4,             // 大幅缩小间距（12 → 4）
        minionCardWidth: 5,     // 略微缩小
        // ...
    };
case 4:
    // 四人局：紧凑布局，最小间距
    return {
        baseCardWidth: 12,      // 适度缩小（保持可读性）
        baseGap: 2,             // 最小间距（6 → 2）
        minionCardWidth: 4.5,   // 适度缩小（保持可读性）
        // ...
    };
```

## 优化策略

1. **优先调整间距**：
   - 二人局：baseGap = 12vw（宽松）
   - 三人局：baseGap = 4vw（紧凑）
   - 四人局：baseGap = 2vw（最小）

2. **适度缩小卡片**：
   - 基地卡片：14vw → 13vw → 12vw（渐进式缩小）
   - 随从卡片：5.5vw → 5vw → 4.5vw（保持可读性）

3. **保持视觉平衡**：
   - 卡片不会缩得太小
   - 间距调整为主要优化手段
   - 确保四人局仍然清晰可读

## 测试方法

### 手动测试步骤

1. 在开发环境创建四人局：
   ```
   http://localhost:3000
   → 点击"大杀四方"
   → 创建房间
   → 选择 4 人局
   → 开始游戏
   ```

2. 使用调试面板（按 ` 键）注入测试状态：
   - 切换到"状态注入"标签
   - 粘贴测试状态（见下方）
   - 点击"应用状态"

3. 观察布局效果：
   - 基地之间的间距是否合理
   - 卡片大小是否清晰可读
   - 整体布局是否紧凑但不拥挤

### 测试状态（JSON）

```json
{
  "players": {
    "0": {
      "id": "0",
      "vp": 8,
      "hand": [
        { "uid": "h0-1", "defId": "alien_invader", "type": "minion", "owner": "0" },
        { "uid": "h0-2", "defId": "alien_scout", "type": "minion", "owner": "0" },
        { "uid": "h0-3", "defId": "pirate_first_mate", "type": "minion", "owner": "0" }
      ],
      "deck": [],
      "discard": [],
      "minionsPlayed": 1,
      "minionLimit": 1,
      "actionsPlayed": 0,
      "actionLimit": 1,
      "factions": ["aliens", "pirates"]
    },
    "1": {
      "id": "1",
      "vp": 6,
      "hand": [
        { "uid": "h1-1", "defId": "ninja_shinobi", "type": "minion", "owner": "1" },
        { "uid": "h1-2", "defId": "dino_king_rex", "type": "minion", "owner": "1" }
      ],
      "deck": [],
      "discard": [],
      "minionsPlayed": 1,
      "minionLimit": 1,
      "actionsPlayed": 0,
      "actionLimit": 1,
      "factions": ["ninjas", "dinosaurs"]
    },
    "2": {
      "id": "2",
      "vp": 5,
      "hand": [
        { "uid": "h2-1", "defId": "wizard_chronomage", "type": "minion", "owner": "2" }
      ],
      "deck": [],
      "discard": [],
      "minionsPlayed": 1,
      "minionLimit": 1,
      "actionsPlayed": 0,
      "actionLimit": 1,
      "factions": ["wizards", "zombies"]
    },
    "3": {
      "id": "3",
      "vp": 4,
      "hand": [
        { "uid": "h3-1", "defId": "robot_microbot_alpha", "type": "minion", "owner": "3" }
      ],
      "deck": [],
      "discard": [],
      "minionsPlayed": 1,
      "minionLimit": 1,
      "actionsPlayed": 0,
      "actionLimit": 1,
      "factions": ["robots", "tricksters"]
    }
  },
  "turnOrder": ["0", "1", "2", "3"],
  "currentPlayerIndex": 0,
  "bases": [
    {
      "defId": "base_the_homeworld",
      "minions": [
        { "uid": "m1", "defId": "alien_invader", "controller": "0", "owner": "0", "basePower": 4, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] },
        { "uid": "m2", "defId": "pirate_first_mate", "controller": "0", "owner": "0", "basePower": 3, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] },
        { "uid": "m3", "defId": "ninja_shinobi", "controller": "1", "owner": "1", "basePower": 2, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] }
      ],
      "ongoingActions": []
    },
    {
      "defId": "base_the_jungle_oasis",
      "minions": [
        { "uid": "m4", "defId": "dino_king_rex", "controller": "1", "owner": "1", "basePower": 5, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] },
        { "uid": "m5", "defId": "wizard_chronomage", "controller": "2", "owner": "2", "basePower": 3, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] }
      ],
      "ongoingActions": []
    },
    {
      "defId": "base_the_tar_pits",
      "minions": [
        { "uid": "m6", "defId": "zombie_walker", "controller": "2", "owner": "2", "basePower": 2, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] },
        { "uid": "m7", "defId": "robot_microbot_alpha", "controller": "3", "owner": "3", "basePower": 2, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] }
      ],
      "ongoingActions": []
    },
    {
      "defId": "base_the_maze_of_the_minotaur",
      "minions": [
        { "uid": "m8", "defId": "trickster_leprechaun", "controller": "3", "owner": "3", "basePower": 3, "powerCounters": 0, "powerModifier": 0, "tempPowerModifier": 0, "talentUsed": false, "attachedActions": [] }
      ],
      "ongoingActions": []
    },
    {
      "defId": "base_the_temple_of_goju",
      "minions": [],
      "ongoingActions": []
    }
  ],
  "baseDeck": ["base_haunted_house"],
  "turnNumber": 3,
  "nextUid": 100
}
```

## 修改文件

- `src/games/smashup/ui/layoutConfig.ts`

## 下一步

请在开发环境手动测试四人局布局，确认：
1. 基地之间的间距是否合理（不会太挤）
2. 卡片大小是否清晰可读（不会太小）
3. 整体布局是否美观（紧凑但不拥挤）

如需调整，可以继续微调 `baseGap` 和 `baseCardWidth` 的值。

---

**修改日期**：2026-03-04
**分支**：feat/smashup-4p-responsive-ui
**状态**：待测试
