# DiceThrone 攻击音效玩家特定问题调试

## 问题描述

用户反馈：攻击方（attacking player）听不到攻击音效，但防御方（defending player）能正常听到所有音效。

## 问题分析

### 事件流程

1. 玩家选择技能 → `SELECT_ABILITY` 命令
2. `execute.ts` 生成两个事件：
   - `ABILITY_ACTIVATED`（技能激活）
   - `ATTACK_INITIATED`（攻击发起）

### 音效配置

```typescript
// events.ts
ABILITY_ACTIVATED: { audio: 'immediate', sound: ABILITY_ACTIVATE_KEY }
ATTACK_INITIATED: { audio: 'immediate', sound: ATTACK_INITIATE_KEY }
```

### feedbackResolver 处理

```typescript
// audio.config.ts

// ABILITY_ACTIVATED：返回 null（技能音效由 FX 系统在动画 onImpact 时播放）
if (type === 'ABILITY_ACTIVATED') {
    return null;
}

// ATTACK_INITIATED：没有特殊处理，回退到框架默认音效
// 应该播放 ATTACK_INITIATE_KEY
```

### 可能的原因

1. **事件过滤问题**：`ATTACK_INITIATED` 事件可能被 `isLocalUIEvent` 标记过滤掉
2. **玩家特定过滤**：可能有某种机制根据 `currentPlayerId` 过滤事件
3. **事件广播问题**：攻击方的事件可能没有正确广播到自己的客户端

## 调试日志

已添加以下调试日志：

1. **`useGameAudio.ts`**：
   - 记录 `ATTACK_INITIATED` 事件的过滤情况
   - 记录 `ATTACK_INITIATED` 事件的音效解析结果

2. **`audio.config.ts`**：
   - 记录 `ATTACK_INITIATED` 事件的 payload 和 currentPlayerId

## 手动测试步骤

由于 E2E 测试环境复杂，建议手动测试：

### 步骤 1：启动开发环境

```bash
npm run dev
```

### 步骤 2：创建在线对局

1. 打开两个浏览器窗口（或使用无痕模式）
2. 在第一个窗口创建房间（作为 Host，玩家 0）
3. 在第二个窗口加入房间（作为 Guest，玩家 1）
4. 选择英雄并开始游戏

### 步骤 3：触发攻击

1. 在 Host 窗口（玩家 0）：
   - 进入进攻投骰阶段
   - 投骰子并确认
   - 选择一个技能（触发攻击）

2. 观察两个窗口的控制台日志

### 步骤 4：分析日志

查找以下日志：

```
[Audio Debug] ATTACK_INITIATED event processing
[Audio Debug] ATTACK_INITIATED feedback resolution
[DT Audio Debug] ATTACK_INITIATED
```

对比两个窗口的日志，确认：
- 攻击方（Host）是否收到 `ATTACK_INITIATED` 事件
- 防御方（Guest）是否收到 `ATTACK_INITIATED` 事件
- 事件是否被 `isLocalUIEvent` 过滤
- `feedbackResolver` 返回的音效 key 是什么
- `currentPlayerId` 是否正确传递

### 步骤 5：记录结果

将控制台日志复制到 `evidence/dicethrone-attack-sound-debug-logs.txt`

## 预期结果

- 攻击方和防御方都应该听到攻击音效（挥剑音效）
- 技能专属音效在伤害动画 onImpact 时播放（由 FX 系统处理）

## 下一步

根据手动测试的日志结果，确定问题根因并修复。
