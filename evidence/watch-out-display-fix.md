# 看箭（Watch Out）特写描述修复

## 问题结论

- 本次错误不是翻译缺失，而是 **`Watch Out` 事件语义被回滚成了通用 key**。
- `git blame` 定位到 `src/games/dicethrone/domain/customActions/moon_elf.ts:590` 的错误写法来自提交 **`9c9dd78`**：
  - `Merge pull request #7 from zhuanggenhua/fix/restore-p1-deletions`
- 该提交把 `Watch Out` 的 `BONUS_DIE_ROLLED.payload.effectKey` 固定成了 `bonusDie.effect.watchOut`，导致特写只拿到通用描述，无法按骰面显示实际效果。

## 正确行为

`Watch Out` 投 1 颗奖励骰后，特写文案必须和实际骰面一致：

- `bow` → `bonusDie.effect.watchOut.bow`
- `foot` → `bonusDie.effect.watchOut.foot`
- `moon` → `bonusDie.effect.watchOut.moon`

对应文案在 locale 中原本就已经存在：

- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`

## 实际修复

### 1. 事件层修复

文件：`src/games/dicethrone/domain/customActions/moon_elf.ts`

将 `handleWatchOut` 从固定通用 key：

```ts
effectKey: 'bonusDie.effect.watchOut'
```

改为按骰面派发：

```ts
const effectKey = face === FACE.BOW
    ? 'bonusDie.effect.watchOut.bow'
    : face === FACE.FOOT
        ? 'bonusDie.effect.watchOut.foot'
        : face === FACE.MOON
            ? 'bonusDie.effect.watchOut.moon'
            : 'bonusDie.effect.watchOut';
```

### 2. 现有测试更新

- `src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
  - 将 `Watch Out` 特写用例改为断言 `bonusDie.effect.watchOut.bow`
- `src/games/dicethrone/__tests__/moon_elf-behavior.test.ts`
  - 为 `bow / foot / moon` 三个分支补充 `BONUS_DIE_ROLLED.payload.effectKey` 断言
- `e2e/dicethrone-watch-out-spotlight.e2e.ts`
  - 补充 UI 文案校验，要求特写文本与实际 `effectKey` 分支一致
  - 同时断言不能再回退到通用 key

## 验证结果

### 命令结果

```bash
npm run typecheck
npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx src/games/dicethrone/__tests__/moon_elf-behavior.test.ts
PW_USE_DEV_SERVERS=true npx playwright test e2e/dicethrone-watch-out-spotlight.e2e.ts
```

结果：全部通过。

### 截图证据

#### 1. 初始场景

![初始场景](../test-results/dicethrone-watch-out-spotlight.e2e.ts-自己打出-Watch-Out-应显示骰子特写-chromium/01-initial-state.png)

分析：

- 处于 `Offensive Roll Phase`
- 玩家手里存在 `Watch Out`
- 已进入可打出攻击修正卡的时机

#### 2. 打出后特写

![打出后特写](../test-results/dicethrone-watch-out-spotlight.e2e.ts-自己打出-Watch-Out-应显示骰子特写-chromium/02-after-play-card.png)

分析：

- 奖励骰特写成功弹出
- 特写底部文案显示为具体分支效果：`Moon🌙: Inflict Blinded`
- 这说明当前事件已不再使用通用 `bonusDie.effect.watchOut`，而是正确落到了 `bonusDie.effect.watchOut.moon`

#### 3. 最终状态

![最终状态](../test-results/dicethrone-watch-out-spotlight.e2e.ts-自己打出-Watch-Out-应显示骰子特写-chromium/03-final-state.png)

分析：

- 特写仍保持可见，便于用户确认奖励骰结果
- E2E 同时校验了事件流中存在 `BONUS_DIE_ROLLED`
- 且 `effectKey` 必须匹配 `bonusDie.effect.watchOut.(bow|foot|moon)`，不会再退回通用 key

## 本次修复范围

- 只修 `Watch Out` 奖励骰特写描述链路
- 未改动其他 Dice Throne 卡牌逻辑
- 未动用户当前其余审计/恢复中的其他游戏与 UI 修改
