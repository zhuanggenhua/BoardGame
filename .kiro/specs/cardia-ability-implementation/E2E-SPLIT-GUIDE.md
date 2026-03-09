# Cardia E2E 测试拆分指南

## 拆分完成 ✅

已将原始的 `e2e/cardia-deck1-characters.e2e.ts`（1187 行）拆分成 **16 个独立的测试文件**，每个角色一个文件。

## 文件结构

```
e2e/
├── helpers/
│   ├── cardia.ts                          # Cardia 测试基础设施
│   └── cardia-test-helpers.ts             # 共享辅助函数（新增）
├── cardia-deck1-card01-mercenary-swordsman.e2e.ts  # 雇佣剑士
├── cardia-deck1-card02-void-mage.e2e.ts            # 虚空法师
├── cardia-deck1-card03-surgeon.e2e.ts              # 外科医生
├── cardia-deck1-card04-mediator.e2e.ts             # 调停者
├── cardia-deck1-card05-saboteur.e2e.ts             # 破坏者
├── cardia-deck1-card06-diviner.e2e.ts              # 占卜师
├── cardia-deck1-card07-court-guard.e2e.ts          # 宫廷卫士
├── cardia-deck1-card08-judge.e2e.ts                # 审判官
├── cardia-deck1-card09-ambusher.e2e.ts             # 伏击者
├── cardia-deck1-card10-puppeteer.e2e.ts            # 傀儡师
├── cardia-deck1-card11-clockmaker.e2e.ts           # 钟表匠
├── cardia-deck1-card12-treasurer.e2e.ts            # 财务官
├── cardia-deck1-card13-swamp-guard.e2e.ts          # 沼泽守卫
├── cardia-deck1-card14-governess.e2e.ts            # 女导师
├── cardia-deck1-card15-inventor.e2e.ts             # 发明家
└── cardia-deck1-card16-elf.e2e.ts                  # 精灵
```

## 拆分的好处

### 1. 并行执行 🚀
Playwright 可以并行运行多个测试文件，显著加快测试速度：
- **拆分前**：16 个测试串行执行，总时间 = 16 × 单个测试时间
- **拆分后**：16 个文件并行执行，总时间 ≈ 单个测试时间（取决于 worker 数量）

### 2. 隔离性更好 🛡️
- 每个测试文件独立运行，失败不会影响其他测试
- 更容易定位问题（文件名直接对应角色）
- 减少测试间的状态污染风险

### 3. 更易维护 🔧
- 每个文件只关注一个角色，代码更清晰
- 修改某个角色的测试不会影响其他角色
- 文件大小合理（每个文件约 70-150 行）

### 4. 更易调试 🐛
- 可以单独运行某个角色的测试
- 失败时只需关注一个文件
- 日志输出更清晰（不会被其他测试干扰）

### 5. 更好的 CI/CD 集成 ⚙️
- 可以配置不同的测试策略（如只运行失败的测试）
- 更容易实现测试分片（test sharding）
- 失败重试更精确（只重试失败的文件）

## 运行测试

### 运行所有 Cardia 一号牌组测试
```bash
npm run test:e2e -- cardia-deck1
```

### 运行单个角色测试
```bash
# 运行雇佣剑士测试
npm run test:e2e -- cardia-deck1-card01

# 运行外科医生测试
npm run test:e2e -- cardia-deck1-card03

# 运行精灵测试
npm run test:e2e -- cardia-deck1-card16
```

### 并行运行（推荐）
```bash
# 使用 4 个 worker 并行运行
npm run test:e2e -- cardia-deck1 --workers=4

# 使用最大 worker 数（CPU 核心数）
npm run test:e2e -- cardia-deck1 --workers=100%
```

### 只运行失败的测试
```bash
npm run test:e2e -- cardia-deck1 --last-failed
```

## 共享辅助函数

所有测试文件共享 `e2e/helpers/cardia-test-helpers.ts` 中的辅助函数：

```typescript
// 等待进入能力阶段
await waitForAbilityPhase(page, expectedLoserId);

// 按索引打出卡牌
await playCardByIndex(page, 0);

// 按影响力打出卡牌
await playCardByInfluence(page, 3);

// 跳过能力阶段
await skipAbility(page);

// 结束回合
await endTurn(page);
```

## 测试改进进度

当前已改进 6/16 个测试（38%）：
- ✅ 影响力1 - 雇佣剑士
- ✅ 影响力2 - 虚空法师
- ✅ 影响力3 - 外科医生
- ✅ 影响力4 - 调停者
- ✅ 影响力5 - 破坏者
- ✅ 影响力6 - 占卜师
- ⏳ 影响力7-16（待改进）

## 下一步工作

1. **继续改进剩余 10 个测试**：
   - 为每个测试添加 TestHarness 手牌注入
   - 增强断言（核心功能 + 副作用 + 负路径）
   - 添加详细日志

2. **添加边界测试**（可选）：
   - 牌库不足场景
   - 手牌为空场景
   - 多次激活能力场景

3. **性能优化**：
   - 调整 Playwright 配置以最大化并行度
   - 优化测试设置时间（如复用浏览器上下文）

## 拆分脚本

如果需要重新拆分或拆分其他测试文件，可以参考 `scripts/split-cardia-tests.mjs`。

## 参考文档

- `docs/automated-testing.md` - TestHarness 使用文档
- `docs/ai-rules/testing-audit.md` - 测试审计规范
- `.kiro/specs/cardia-ability-implementation/E2E-DECK1-SUMMARY.md` - 测试总结
