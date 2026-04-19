# P1 审计补查记录（2026-03-10）

## 范围

- 本轮继续复核 POD 混入提交 `9c9dd78`
- 目标是把旧进度表里仍挂着 `⏳ 待审计` 的 `SummonerWars` 与通用 UI/组件项逐个关掉
- 原则仍然是：**只做无侵入审计，只有确认是 POD 回滚残留才修改代码**

## 本轮结论

- 本轮未发现新的明确 POD 回滚点
- **业务代码改动：无**
- **仅文档更新**：
  - `evidence/dicethrone-audit-followup-2026-03-10.md`
  - `evidence/p1-audit-followup-2026-03-10.md`

---

## 一、SummonerWars 复核结果

### 1. 领域层

本轮复核文件：

- `src/games/summonerwars/domain/execute.ts`
- `src/games/summonerwars/domain/reduce.ts`
- `src/games/summonerwars/domain/validate.ts`
- `src/games/summonerwars/config/factions/barbaric.ts`
- `src/games/summonerwars/domain/events.ts`
- `src/games/summonerwars/domain/index.ts`
- `src/games/summonerwars/domain/types.ts`
- `src/games/summonerwars/game.ts`

复核结论：

- 未发现新的明确 POD 回滚点
- `execute / reduce / validate / flow / interaction` 链路与现有测试保持一致
- `index.ts / game.ts` 的系统装配、注册与导出链路本轮未见功能性删除

验证命令：

```bash
npx vitest run src/games/summonerwars/__tests__/validate.test.ts src/games/summonerwars/__tests__/reduce.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts
npx vitest run src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/flowHooks.test.ts
```

---

### 2. UI 层

本轮复核文件：

- `src/games/summonerwars/ui/BoardGrid.tsx`
- `src/games/summonerwars/ui/EnergyBar.tsx`
- `src/games/summonerwars/ui/FactionSelectionAdapter.tsx`
- `src/games/summonerwars/ui/useCellInteraction.ts`
- `src/games/summonerwars/ui/useGameEvents.ts`

复核结论：

- 未发现新的明确 POD 回滚点
- `BoardGrid` 的棋盘格渲染、教程锚点、放大入口仍在
- `useCellInteraction` 的选牌 / 选格 / 技能模式 / 事件模式分流仍在
- `useGameEvents` 的事件流消费与视觉状态缓冲链路正常
- `FactionSelectionAdapter`、`EnergyBar` 当前实现未见被删坏的关键节点

验证命令：

```bash
npx vitest run src/games/summonerwars/ui/__tests__/FactionSelectionAdapter.test.tsx src/games/summonerwars/__tests__/useGameEvents.test.ts
npx vitest run src/games/summonerwars/__tests__/grab-ui-interaction.test.ts src/games/summonerwars/__tests__/interaction-flow-e2e.test.ts
npx vitest run src/games/summonerwars/__tests__/tutorialIds.test.ts src/games/summonerwars/__tests__/tutorialProperties.test.ts
```

说明：

- `FactionSelectionAdapter.test.tsx` 里仍会输出若干 `act(...)` warning，但测试本身通过；本轮未把它当作 POD 回滚问题处理

---

## 二、通用组件 / Lobby / Social / System 复核结果

### 1. 本轮复核文件

- `src/components/common/animations/FlyingEffect.tsx`
- `src/components/common/media/CardPreview.tsx`
- `src/components/common/overlays/BreakdownTooltip.tsx`
- `src/components/lobby/GameDetailsModal.tsx`
- `src/components/lobby/RoomList.tsx`
- `src/components/lobby/roomActions.ts`
- `src/components/social/SystemNotificationView.tsx`
- `src/components/social/UserMenu.tsx`
- `src/components/social/FriendList.tsx`
- `src/components/social/MatchHistoryModal.tsx`
- `src/components/system/AboutModal.tsx`
- `src/components/system/FeedbackModal.tsx`

### 2. 复核结论

- 本轮未发现新的明确 POD 回滚点
- `CardPreview` 的 atlas / renderer 注册、locale 路径回退、fallback 逻辑仍在
- `BreakdownTooltip` 的 portal 渲染、定位与 hover 分支仍在
- `RoomList / roomActions / GameDetailsModal` 的开房 / 入房 / 强退 / 确认链路未见功能性删除
- `UserMenu / FriendList / MatchHistoryModal / SystemNotificationView / AboutModal / FeedbackModal` 当前未见被删掉关键 UI 节点或主交互入口
- `FlyingEffect` 仍保留飞行动画、impact、FxBus 配合与图层入口

验证命令：

```bash
npx vitest run src/components/common/media/__tests__/CardPreview.i18n.test.tsx
npx vitest run src/components/system/__tests__/FeedbackModal.test.tsx
npx vitest run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts
```

说明：

- `CardPreview.i18n.test.tsx` 仍会输出 `NO_I18NEXT_INSTANCE` 警告，但测试通过；本轮未把它当作 POD 回滚问题处理

---

## 当前状态

- `DiceThrone`：旧表里残留的待审项，本轮前后两批已经逐个复核并补记录
- `SummonerWars`：旧表里的待审项，本轮已补复核
- `通用组件`：旧表里的待审项，本轮已补复核

---

## 三、SmashUp 本轮只读补查

### 1. 本轮复核文件

- `src/games/smashup/domain/index.ts`
- `src/games/smashup/domain/systems.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/abilities/pirates.ts`

### 2. 复核方式

- 仅做只读审查
- 不直接修改用户当前正在调整的 `SmashUp` 文件
- 以现有回归测试做交叉验证

### 3. 验证结果

单文件串行通过：

```bash
npx vitest run src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts
npx vitest run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts
npx vitest run src/games/smashup/__tests__/newOngoingAbilities.test.ts
npx vitest run src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts
```

复核结论：

- 本轮聚焦的 `afterScoring / 多基地计分 / 海盗相关 Prompt` 链路未发现新的明确 POD 回滚点
- 多文件一起跑时出现过 `vitest` worker timeout，改为单文件串行后通过；该现象本轮判断为测试基础设施问题，不作为逻辑回退结论
- 由于这些文件当前处于用户活跃修改区，本轮继续保持**只读**，未直接改代码

## 后续提醒

- `evidence/p1-audit-progress.md` 里的老表仍保留大量历史 `⏳` 标记，**不要再直接把这些旧行当作真实未审状态**
- 继续交接时，应以以下文档为准：
  - `evidence/dicethrone-audit-followup-2026-03-10.md`
  - `evidence/p1-audit-followup-2026-03-10.md`
