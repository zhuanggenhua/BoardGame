# Cardia 音频系统设计文档

## 概述

本文档定义 Cardia 游戏的音频系统设计，包括 BGM 选择、事件音效映射、音频配置文件结构、预加载策略和集成方案。

Cardia 是一个策略卡牌游戏，主题是魔法城市中四大派系争夺权力。游戏核心机制是双方同时出牌进行遭遇战，通过影响力对比决定胜负，率先获得5个印戒获胜。

### 设计目标

1. **主题一致性**：选择符合魔法城市主题的 BGM 和音效
2. **事件驱动**：基于游戏事件自动播放音效，无需手动触发
3. **性能优化**：通过预加载策略确保音效快速响应
4. **可维护性**：使用 `defineEvents()` 和 `feedbackResolver` 架构，集中管理音效映射

### 技术约束

- 必须使用项目现有的音频注册表（不新增音频文件）
- 遵循 `defineEvents()` 和 `feedbackResolver` 架构
- 音效策略：`immediate`（即时反馈）、`fx`（动画驱动）、`silent`（无音效）
- 禁止在游戏层定义 `basePath` 或 `sounds` 字段

---

## 架构

### 音频系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Cardia 游戏引擎                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EventStreamSystem                                    │  │
│  │  - 发射游戏事件（CARD_PLAYED, ENCOUNTER_RESOLVED...）│  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  audio.config.ts                                      │  │
│  │  - defineEvents(CARDIA_EVENTS)                        │  │
│  │  - feedbackResolver(event) → SoundKey | null          │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AudioManager                                         │  │
│  │  - play(soundKey)                                     │  │
│  │  - preloadKeys([...])                                 │  │
│  │  - BGM 管理（切换 normal/battle）                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              音频注册表（registry.json）                     │
│  - 所有音频资源的唯一来源                                   │
│  - key → 物理路径映射                                       │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **游戏事件发射**：游戏逻辑执行后，通过 `EventStreamSystem` 发射事件
2. **音效解析**：`feedbackResolver` 根据事件类型和上下文返回音效 key
3. **音效播放**：`AudioManager` 根据 key 从注册表查找路径并播放
4. **BGM 切换**：根据游戏阶段（normal/battle）自动切换 BGM 组

---

## 组件和接口

### 1. 事件定义（domain/events.ts）

使用 `defineEvents()` 定义音频策略：

```typescript
import { defineEvents } from '../../../lib/audio/defineEvents';

export const CARDIA_EVENTS = defineEvents({
    // 即时反馈音效（immediate）
    CARD_PLAYED: { audio: 'immediate', sound: 'card.handling.card_take_001' },
    CARD_DRAWN: { audio: 'immediate', sound: 'card.handling.card_take_001' },
    SIGNET_GRANTED: { audio: 'immediate', sound: 'coins.small_reward_001' },
    MODIFIER_TOKEN_PLACED: { audio: 'immediate', sound: (event) => {
        const value = event.payload?.value ?? 0;
        return value > 0 
            ? 'status.positive_buffs_and_cures.charged_001'
            : 'status.mental_and_magical_debuffs.cursed_001';
    }},
    CARDS_DISCARDED: { audio: 'immediate', sound: 'card.fx_discard_001' },
    DECK_SHUFFLED: { audio: 'immediate', sound: 'card.handling.card_shuffle_001' },
    GAME_WON: { audio: 'immediate', sound: 'stinger.stinger.action_win' },
    
    // 动画驱动音效（fx）
    ENCOUNTER_RESOLVED: { audio: 'fx' },
    ABILITY_ACTIVATED: { audio: 'fx' },
    
    // 无音效（silent）
    ABILITY_SKIPPED: { audio: 'silent' },
    ABILITY_INTERACTION_REQUESTED: { audio: 'silent' },
    ABILITY_NO_VALID_TARGET: { audio: 'silent' },
    // ... 其他事件
});
```

### 2. 音频配置文件（audio.config.ts）

```typescript
import type { GameAudioConfig, SoundKey } from '../../lib/audio/types';
import { createFeedbackResolver, collectPreloadKeys } from '../../lib/audio/defineEvents';
import { CARDIA_EVENTS } from './domain/events';

// BGM 常量
const BGM_FANTASY_VOL7 = 'bgm.fantasy.fantasy_music_pack_vol.fantasy_vol7';
const BGM_ETHEREAL_CATHEDRAL = 'bgm.ethereal.cloud_cathedral_rt';
// ... 其他 BGM

export const CARDIA_AUDIO_CONFIG: GameAudioConfig = {
    // 关键音效预加载（自动收集 + 手动补充）
    criticalSounds: [
        ...collectPreloadKeys(CARDIA_EVENTS),
        // 手动补充高频音效
        'card.handling.card_take_001',
        'card.handling.card_shuffle_001',
    ],
    
    // BGM 列表
    bgm: [
        { key: BGM_FANTASY_VOL7, name: 'Fantasy Vol7', src: '', volume: 0.5, category: { group: 'bgm', sub: 'normal' } },
        { key: BGM_ETHEREAL_CATHEDRAL, name: 'Cloud Cathedral', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        // ... 其他 BGM
    ],
    
    // BGM 分组
    bgmGroups: {
        normal: [BGM_FANTASY_VOL7, /* ... */],
        battle: [BGM_ETHEREAL_CATHEDRAL, /* ... */],
    },
    
    // 事件音效解析器
    feedbackResolver: createFeedbackResolver(CARDIA_EVENTS),
    
    // BGM 切换规则
    bgmRules: [
        {
            when: (context) => {
                const phase = context.G?.phase;
                return phase === 'encounter' || phase === 'resolution';
            },
            key: BGM_ETHEREAL_CATHEDRAL,
            group: 'battle',
        },
        {
            when: () => true,
            key: BGM_FANTASY_VOL7,
            group: 'normal',
        },
    ],
};
```

### 3. 游戏集成（game.ts）

```typescript
import { CARDIA_AUDIO_CONFIG } from './audio.config';

export const Cardia = createGameEngine<CardiaCore, CardiaCommand, CardiaEvent>({
    domain: CardiaDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes,
    audioConfig: CARDIA_AUDIO_CONFIG, // 注册音频配置
});
```

---

## 数据模型

### BGM 选择方案

从现有音频注册表中选择符合魔法城市主题的曲目：

#### Normal 组（普通阶段，4 首）

| Key | 名称 | 风格 | 理由 |
|-----|------|------|------|
| `bgm.fantasy.fantasy_music_pack_vol.fantasy_vol7` | Fantasy Vol7 | 奇幻、神秘 | 主题曲，适合魔法城市氛围 |
| `bgm.ethereal.cloud_cathedral_rt` | Cloud Cathedral | 空灵、庄严 | 适合策略思考阶段 |
| `bgm.fantasy.fantasy_music_pack_vol.my_kingdom_rt_2.fantasy_vol5_my_kingdom_main` | My Kingdom | 史诗、权力 | 契合权力争夺主题 |
| `bgm.fantasy.fantasy_music_pack_vol.stormborn_destiny_rt_6.fantasy_vol7_stormborn_destiny_main` | Stormborn Destiny | 命运、史诗 | 适合战略布局 |

#### Battle 组（战斗阶段，4 首）

| Key | 名称 | 风格 | 理由 |
|-----|------|------|------|
| `bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main` | Dragon Dance | 激烈、战斗 | 适合遭遇战阶段 |
| `bgm.fantasy.fantasy_music_pack_vol.shields_and_spears_rt_2.fantasy_vol5_shields_and_spears_main` | Shields and Spears | 战斗、紧张 | 适合影响力对比 |
| `bgm.fantasy.fantasy_music_pack_vol.hang_them_rt_3.fantasy_vol5_hang_them_intensity_2` | Hang Them (Intensity 2) | 激烈、决战 | 适合关键遭遇 |
| `bgm.fantasy.fantasy_music_pack_vol.fireborn_rt_2.fantasy_vol8_fireborn_main` | Fireborn | 魔法、火焰 | 契合魔法主题 |

### 事件音效映射表

| 事件类型 | 音效 Key | 策略 | 说明 |
|---------|---------|------|------|
| `CARD_PLAYED` | `card.handling.card_take_001` | immediate | 卡牌打出 |
| `CARD_DRAWN` | `card.handling.card_take_001` | immediate | 卡牌抽取 |
| `ENCOUNTER_RESOLVED` | 动态选择 | fx | 根据胜负选择音效 |
| `ABILITY_ACTIVATED` | 动态选择 | fx | 根据能力类型选择音效 |
| `SIGNET_GRANTED` | `coins.small_reward_001` | immediate | 印戒获得 |
| `MODIFIER_TOKEN_PLACED` | 动态选择 | immediate | 根据正负值选择增益/减益音效 |
| `MODIFIER_TOKEN_REMOVED` | `status.positive_buffs_and_cures.purged_001` | immediate | 修正标记移除 |
| `CARD_REPLACED` | `card.fx_discard_001` | immediate | 卡牌替换 |
| `CARDS_DISCARDED` | `card.fx_discard_001` | immediate | 卡牌弃掉 |
| `DECK_SHUFFLED` | `card.handling.card_shuffle_001` | immediate | 牌库混洗 |
| `GAME_WON` | `stinger.stinger.action_win` | immediate | 游戏胜利 |
| `ABILITY_SKIPPED` | 无 | silent | 能力跳过 |
| `ABILITY_INTERACTION_REQUESTED` | 无 | silent | 能力交互请求 |
| `ABILITY_NO_VALID_TARGET` | 无 | silent | 能力无有效目标 |

### 动态音效选择逻辑

#### ENCOUNTER_RESOLVED（遭遇结算）

```typescript
feedbackResolver: (event) => {
    if (event.type === 'ENCOUNTER_RESOLVED') {
        const { winner, loser } = event.payload;
        if (winner === 'tie') {
            return 'ui.general.neutral_pop_up_001';
        }
        // 根据当前玩家是否获胜选择音效
        const isWinner = winner === currentPlayerId;
        return isWinner 
            ? 'stinger.stinger.action_win'
            : 'stinger.stinger.action_lose';
    }
    // ...
}
```

#### ABILITY_ACTIVATED（能力激活）

```typescript
feedbackResolver: (event) => {
    if (event.type === 'ABILITY_ACTIVATED') {
        const { abilityId, isInstant, isOngoing } = event.payload;
        
        // 根据能力类型选择音效
        if (isInstant) {
            return 'magic.arcane_blast_001';
        }
        if (isOngoing) {
            return 'magic.aura_of_vitality_001';
        }
        return 'magic.mystic_trigger_001';
    }
    // ...
}
```

#### MODIFIER_TOKEN_PLACED（修正标记放置）

```typescript
feedbackResolver: (event) => {
    if (event.type === 'MODIFIER_TOKEN_PLACED') {
        const { value } = event.payload;
        return value > 0 
            ? 'status.positive_buffs_and_cures.charged_001'
            : 'status.mental_and_magical_debuffs.cursed_001';
    }
    // ...
}
```

---

## 错误处理

### 音效缺失处理

- **问题**：音效 key 在注册表中不存在
- **处理**：`AudioManager` 自动降级为静默，不阻塞游戏逻辑
- **日志**：开发模式下输出警告日志

### BGM 切换失败处理

- **问题**：BGM 文件加载失败
- **处理**：继续播放当前 BGM，不中断游戏
- **日志**：记录错误日志，便于排查

### 预加载超时处理

- **问题**：预加载时间过长
- **处理**：设置超时时间（5 秒），超时后继续启动游戏
- **降级**：首次播放时可能有延迟，但不阻塞游戏启动

---

## 测试策略

### 单元测试

1. **事件定义测试**
   - 验证 `CARDIA_EVENTS` 中所有事件的音频策略正确
   - 验证 `collectPreloadKeys()` 正确收集 immediate 音效

2. **feedbackResolver 测试**
   - 验证每个事件类型返回正确的音效 key
   - 验证动态选择逻辑（胜负、正负值）
   - 验证 silent 事件返回 null

3. **BGM 规则测试**
   - 验证 `bgmRules` 根据游戏阶段返回正确的 BGM
   - 验证默认 BGM 规则生效

### 集成测试

1. **音效播放测试**
   - 验证游戏事件触发后音效正确播放
   - 验证音效不重复播放（每个事件只在一个地方播放）

2. **BGM 切换测试**
   - 验证游戏阶段切换时 BGM 正确切换
   - 验证 BGM 循环播放

3. **预加载测试**
   - 验证 `criticalSounds` 在游戏启动后预加载
   - 验证预加载不阻塞游戏启动

### E2E 测试

1. **完整游戏流程测试**
   - 验证从游戏开始到结束的音效播放
   - 验证 BGM 在不同阶段的切换

2. **音效验证**
   - 使用 `/dev/audio` 页面预览所有音效
   - 验证音效 key 在注册表中存在
   - 验证中文友好名显示正确

---

## 部署和维护

### 部署步骤

1. **创建音频配置文件**
   ```bash
   # 创建 src/games/cardia/audio.config.ts
   ```

2. **更新事件定义**
   ```bash
   # 修改 src/games/cardia/domain/events.ts
   # 使用 defineEvents() 定义音频策略
   ```

3. **集成到游戏引擎**
   ```bash
   # 修改 src/games/cardia/game.ts
   # 注册 audioConfig
   ```

4. **验证音效**
   ```bash
   # 访问 /dev/audio 页面
   # 验证所有音效 key 存在
   ```

5. **运行测试**
   ```bash
   npm run test:e2e -- cardia-audio
   ```

### 维护指南

#### 新增音效

1. 在 `CARDIA_EVENTS` 中定义事件的音频策略
2. 如果需要动态选择，在 `feedbackResolver` 中添加逻辑
3. 更新 `criticalSounds` 列表（如果是高频音效）
4. 运行测试验证

#### 新增 BGM

1. 在 `bgm` 数组中添加 BGM 配置
2. 更新 `bgmGroups` 分组
3. 如果需要自动切换，更新 `bgmRules`
4. 验证 BGM key 在注册表中存在

#### 调整音效映射

1. 修改 `CARDIA_EVENTS` 中的 `sound` 字段
2. 或在 `feedbackResolver` 中修改动态选择逻辑
3. 运行测试验证

---

## 附录

### A. 完整事件列表

参考 `src/games/cardia/domain/events.ts` 中的 `CARDIA_EVENTS` 常量表。

### B. 音频注册表结构

参考 `docs/audio/audio-catalog.md` 和 `docs/audio/common-audio-assets.md`。

### C. 音频架构文档

参考 `docs/audio/add-audio.md` 和 `docs/audio/audio-usage.md`。

### D. 相关规范

- `.spec/knowledge/standards/asset-pipeline.md` — 音频资源引用规范
- `.spec/knowledge/standards/engine-systems.md` — 引擎系统规范
- `.spec/knowledge/standards/ui-ux.md` — UI/UX 规范
