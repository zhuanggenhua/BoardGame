# 测试隔离配置总结

## 当前状态

✅ **审计测试已完全隔离**

## 配置文件

### 1. `vitest.config.ts` (默认配置)
- **用途**: 运行所有常规测试
- **命令**: `npm test` 或 `npm run test:watch`
- **排除**: 
  - 审计测试 (`**/*audit*.test.{ts,tsx}`, `**/*Audit*.test.{ts,tsx}`)
  - 属性测试 (`**/*.property.test.{ts,tsx}`)
  - 调试测试 (`**/*debug*.test.{ts,tsx}`, `**/*Debug*.test.{ts,tsx}`)

### 2. `vitest.config.core.ts` (核心功能测试)
- **用途**: 快速验证核心功能
- **命令**: `npm run test:games:core`
- **包含**: `src/games/**/__tests__/**/*.test.{ts,tsx}`
- **排除**: 
  - 审计测试
  - 属性测试
  - E2E 测试
  - 调试测试

### 3. `vitest.config.audit.ts` (审计测试)
- **用途**: 代码审计、完整性检查
- **命令**: `npm run test:games:audit`
- **包含**: 
  - 审计测试 (`**/*audit*.test.{ts,tsx}`, `**/*Audit*.test.{ts,tsx}`)
  - 属性测试 (`**/*.property.test.{ts,tsx}`)

## 审计测试文件列表

### SmashUp
- `abilityBehaviorAudit.test.ts` - 技能行为审计
- `interactionTargetTypeAudit.test.ts` - 交互目标类型审计
- `interactionDisplayModeAudit.test.ts` - 交互显示模式审计
- `interactionDefIdAudit.test.ts` - 交互定义ID审计
- `interactionCompletenessAudit.test.ts` - 交互完整性审计
- `ongoingMinionTriggerAudit.test.ts` - 持续随从触发器审计
- `pirate-broadside-d1-audit.test.ts` - 海盗宽边炮D1审计
- `audit-ongoing-coverage.property.test.ts` - 持续效果覆盖属性测试

### SummonerWars
- `triggerEntryAudit.test.ts` - 触发器入口审计
- `interactionChainAudit.test.ts` - 交互链审计

### DiceThrone
- `defense-trigger-audit.test.ts` - 防御触发器审计
- `card-playCondition-audit.test.ts` - 卡牌打出条件审计
- `card-cross-audit.test.ts` - 卡牌交叉审计
- `ability-customaction-audit.test.ts` - 技能自定义动作审计

## 使用指南

### 日常开发
```bash
# 运行常规测试（不包含审计测试）
npm test

# 运行特定游戏的测试
npm run test:smashup
npm run test:summonerwars
npm run test:dicethrone

# 运行核心功能测试（最快）
npm run test:games:core
```

### 代码审计
```bash
# 运行所有审计测试
npm run test:games:audit
```

### 持续集成 (CI)
```bash
# pre-push 钩子运行核心测试
npm run test:games:core
```

## 验证隔离效果

### 验证默认测试不包含审计测试
```bash
npm test 2>&1 | Select-String -Pattern "audit|Audit"
# 应该没有输出（或只有非测试文件的匹配）
```

### 验证审计测试可以单独运行
```bash
npm run test:games:audit
# 应该只运行审计测试
```

## 修改记录

### 2025-01-XX
- ✅ 在 `vitest.config.ts` 中添加 `exclude` 配置
- ✅ 排除审计测试 (`**/*audit*.test.{ts,tsx}`, `**/*Audit*.test.{ts,tsx}`)
- ✅ 排除属性测试 (`**/*.property.test.{ts,tsx}`)
- ✅ 排除调试测试 (`**/*debug*.test.{ts,tsx}`, `**/*Debug*.test.{ts,tsx}`)

## 注意事项

1. **命名规范**: 审计测试文件必须包含 `audit` 或 `Audit` 关键字
2. **属性测试**: 使用 `.property.test.ts` 后缀的测试也会被归类为审计测试
3. **调试测试**: 使用 `debug` 或 `Debug` 关键字的测试会被排除
4. **CI 集成**: pre-push 钩子只运行核心测试，不运行审计测试

## 相关文档

- `docs/automated-testing.md` - 自动化测试文档
- `docs/ai-rules/testing-audit.md` - 测试审计规范
- `vitest.config.ts` - 默认测试配置
- `vitest.config.core.ts` - 核心测试配置
- `vitest.config.audit.ts` - 审计测试配置
