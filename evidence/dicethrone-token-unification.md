# DiceThrone Token 统一化修复

## 修订（2026-04-05）

- 旧结论失效：
  - 文档原先把 `EVASIVE` 记为“已共享统一”
  - 这与当前真实 runtime 不符，因为武僧、月精灵、枪手都走各自本地 `activeUse`
- 失效原因：
  - 历史上曾保留过一份共享 `EVASIVE.passiveTrigger`，但它没有真实消费者
  - 继续把它当共享 token，会误导后续对被动与 token 运行时链路的审计
- 本次修正：
  - 已从 `src/games/dicethrone/domain/sharedTokens.ts` 删除共享 `EVASIVE`
  - `shared-state-consistency.test.ts` 明确锁定 `monk / moon_elf / gunslinger` 的 `Evasive` 必须走本地 `activeUse`
- 新裁决：
  - 当前真正共享的 token 只有 `KNOCKDOWN` 与 `DAZE`
  - `Evasive` 不是共享 runtime token，而是多个英雄各自维护、语义一致的本地定义

## 问题描述

用户发现狂战士的 Daze（晕眩）token 和火法师的 Stun（眩晕）token 实际上是同一个效果，但代码中实现成了两个不同的 token。此外，还有其他角色重复定义了相同的 token（Knockdown、Evasive）。

## 修复内容

### 1. 创建共享 Token 定义文件

创建 `src/games/dicethrone/domain/sharedTokens.ts`，统一定义以下共享 token：

- **KNOCKDOWN（击倒）** - 使用角色：火法师、武僧、枪手、武士
- **DAZE（晕眩）** - 使用角色：狂战士、火法师

### 2. 统一 STUN → DAZE

- 删除 `STATUS_IDS.STUN` 定义（`src/games/dicethrone/domain/ids.ts`）
- 将所有引用 `STATUS_IDS.STUN` 的地方改为 `STATUS_IDS.DAZE`
- 更新测试文件和 Wiki 快照

### 3. 修改各角色的 tokens.ts

#### 火法师（Pyromancer）
- 移除 KNOCKDOWN 和 STUN 的定义
- 从 `sharedTokens` 导入 KNOCKDOWN 和 DAZE
- 更新 `PYROMANCER_INITIAL_TOKENS` 使用 `STATUS_IDS.DAZE`

#### 狂战士（Barbarian）
- 移除 DAZE 的定义
- 从 `sharedTokens` 导入 DAZE

#### 武僧（Monk）
- 移除 KNOCKDOWN 的定义
- 从 `sharedTokens` 导入 KNOCKDOWN
- 保留自己的 EVASIVE 定义（有 activeUse 配置）

#### 枪手（Gunslinger）
- 移除 KNOCKDOWN 的定义
- EVASIVE 保留本地定义（运行时走 activeUse）

#### 武士（Samurai）
- 移除 KNOCKDOWN 的定义
- 从 `sharedTokens` 导入

#### 月精灵（Moon Elf）
- 保留自己的 EVASIVE 定义（有 activeUse 配置，与共享版本不同）

### 4. 更新测试

- `pyromancer-tokens.test.ts`：将 "Stun（眩晕）— debuff, onPhaseEnter" 改为 "Daze（晕眩）— debuff, onAttackEnd"
- 其他测试文件：将 `STATUS_IDS.STUN` 替换为 `STATUS_IDS.DAZE`

### 5. 更新文档

修改 `AGENTS.md` 中的 "Git 变更回退与暂存规范"，明确：
- 修复 bug 时必须使用编辑工具（strReplace/editCode/fsWrite）
- 禁止用 git restore/git checkout 等 git 命令恢复文件
- 可以用 `git diff` 查看差异来辅助定位问题

## 技术细节

### Daze vs Stun 的区别

根据卡牌描述，两者效果相同：
- 攻击结算后，如果防御方有眩晕，立即移除眩晕
- 攻击方获得额外攻击机会

代码实现：
- `timing: 'onAttackEnd'`（攻击结束时触发）
- `actions: [{ type: 'extraAttack', target: 'self' }]`
- 实际逻辑在 `flowHooks.ts` 的 `checkDazeExtraAttack` 函数中

### 为什么 Evasive 不再作为共享 token 保留？

月精灵、武僧、枪手的 EVASIVE 都走本地 `activeUse`（投掷判定），共享版本没有真实运行时消费者：

```typescript
// 月精灵/武僧的 EVASIVE
activeUse: {
    timing: ['beforeDamageReceived'],
    consumeAmount: 1,
    effect: {
        type: 'rollToNegate',
        rollSuccess: { range: [1, 2] },
    },
}

```

## 测试结果

所有测试通过：
```
✓ src/games/dicethrone/__tests__/pyromancer-tokens.test.ts (9 tests)
```

## 教训

1. **遵守 AGENTS.md 规范**：修复 bug 时必须使用编辑工具，不能用 git restore
2. **DRY 原则**：相同的 token 应该统一定义，避免重复
3. **面向百游戏设计**：共享的 token 应该提取到公共文件，方便复用
4. **文档同步**：代码修改后必须同步更新测试和文档
5. **共享定义必须有真实消费者**：没有运行时消费者的共享定义应删除，而不是继续挂在公共文件里误导审计

## 影响范围

- 7 个角色的 tokens.ts 文件
- 6 个测试文件
- 1 个 Wiki 快照文件
- 1 个 flowHooks.ts 文件
- 1 个 ids.ts 文件
- 1 个 sharedTokens.ts 文件
- 1 个 AGENTS.md 文档

## 后续工作

`EVASIVE` 的“共享统一”结论已废弃；当前应以本地 `activeUse` 裁决为准。
