# POD Commit 审计 - 下一步行动计划

**创建时间**: 2026-03-04  
**当前状态**: P0/P1/P2 审计完成，P0 需要重新验证

---

## 快速回答：现在应该做什么？

### 选项 1：重新验证 P0（推荐）⭐

**原因**：
- P0 是核心业务逻辑文件（最重要）
- 使用了与 P1 相同的错误方法（100% 误报率）
- 必须确保没有遗漏关键功能

**工作量**：2-3 小时

**方法**：使用正确的审计方法（读取当前文件验证）

---

### 选项 2：P3 抽样审计（可选）

**原因**：
- P3 是页面和服务文件（优先级低于 P0）
- 可以使用抽样验证快速得出结论
- 基于 P1/P2 经验，预期大部分是误报

**工作量**：1-2 小时

---

### 选项 3：结束审计（不推荐）

**原因**：
- P0 的 20 个"需要恢复"文件未验证
- 可能存在遗漏的关键功能

**风险**：高

---

## 推荐方案：重新验证 P0

### 为什么必须重新验证 P0？

1. **P0 是核心逻辑**：
   - Engine 层（引擎核心）
   - Server 层（服务端存储）
   - Framework 层（游戏框架）
   - 游戏核心逻辑（SmashUp/DiceThrone/SummonerWars）

2. **审计方法有缺陷**：
   - P1 使用错误方法 → 100% 误报（4/4）
   - P2 使用错误方法 → 100% 误报（2/2 样本）
   - P0 使用相同方法 → 预期也有高误报率

3. **已知的恢复情况**：
   - 手动恢复：1 个文件（Matches.tsx）
   - 自动恢复：7 个文件（在后续 commit 中）
   - 误报：多个文件（功能从未存在）
   - **待验证：13 个文件**

### P0 重新验证计划

#### 阶段 1：准备工作（15 分钟）

1. **读取 P0 审计报告**
   ```bash
   cat evidence/p0-audit-final-complete.md
   ```

2. **提取"需要恢复"的文件列表**
   - 排除已恢复的 8 个文件（1 手动 + 7 自动）
   - 排除已确认误报的文件
   - 得到待验证的文件列表（约 13 个）

3. **创建验证脚本**
   ```javascript
   // scripts/verify-p0-files.mjs
   // 自动读取文件并搜索关键代码段
   ```

#### 阶段 2：逐文件验证（2 小时）

对于每个文件，执行以下步骤：

1. **查看 POD commit 的删除**
   ```bash
   git show 6ea1f9f -- <file>
   ```
   - 记录删除的关键代码段（函数名、变量名、注释）

2. **读取当前文件**
   ```bash
   cat <file> | grep -A 10 "<关键代码段>"
   ```
   - 搜索删除的代码段
   - 确认代码是否存在

3. **记录验证结果**
   - ✅ 代码存在 → 无需恢复
   - ❌ 代码缺失 → 需要恢复
   - ⚠️ 部分缺失 → 需要部分恢复

4. **更新验证报告**
   ```markdown
   ## 文件: <file_path>
   
   ### 验证结果
   - **当前代码库状态**: ✅ 存在 / ❌ 缺失
   - **代码位置**: 第 X-Y 行
   - **代码完整性**: ✅ 完整 / ⚠️ 部分缺失 / ❌ 完全缺失
   
   ### 结论
   - ✅ 无需恢复 / ❌ 需要恢复
   ```

#### 阶段 3：恢复缺失的文件（时间取决于缺失数量）

如果发现确实缺失的文件：

1. **提取旧版本代码**
   ```bash
   git show 53da949:<file> > temp_<file>
   ```

2. **手动恢复**
   - 使用 `strReplace` 或 `editCode` 恢复代码
   - 确保代码与当前代码库兼容

3. **验证恢复**
   ```bash
   npx eslint <file>
   npx tsc --noEmit
   ```

4. **运行相关测试**
   ```bash
   npm run test -- <相关测试文件>
   ```

#### 阶段 4：生成最终报告（30 分钟）

1. **创建 P0 验证完成报告**
   - 验证结果统计
   - 误报率分析
   - 实际恢复的文件列表
   - 结论和建议

2. **更新审计覆盖范围总结**
   - 更新 P0 验证状态
   - 更新实际恢复情况
   - 更新统计数据

---

## P0 待验证文件列表（预估）

基于 P0 审计报告，以下文件需要重新验证：

### 高风险文件（3 个）- 已处理

1. ✅ `src/games/smashup/domain/reducer.ts` - 已自动恢复
2. ✅ `src/games/dicethrone/domain/reduceCombat.ts` - 已自动恢复
3. ✅ `src/pages/admin/Matches.tsx` - 已手动恢复

### 中风险文件（约 13 个）- 待验证

4. ⏳ `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
5. ⏳ `src/games/smashup/__tests__/factionAbilities.test.ts`
6. ⏳ `src/games/dicethrone/__tests__/monk-coverage.test.ts`
7. ⏳ `public/locales/en/game-dicethrone.json`
8. ⏳ `public/locales/zh-CN/game-dicethrone.json`
9. ⏳ `src/games/dicethrone/Board.tsx`
10. ⏳ `src/games/smashup/ui/BaseZone.tsx`
11. ⏳ `src/games/dicethrone/game.ts`
12. ⏳ `src/games/smashup/domain/index.ts`
13. ⏳ `src/games/dicethrone/hooks/useAnimationEffects.ts`
14. ⏳ `src/games/smashup/domain/abilityHelpers.ts`
15. ⏳ `src/games/dicethrone/domain/attack.ts`
16. ⏳ 其他文件...

**注意**：实际列表需要从 P0 审计报告中提取，排除已恢复和已确认误报的文件。

---

## 验证脚本模板

### scripts/verify-p0-files.mjs

```javascript
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// 待验证的文件列表
const filesToVerify = [
  {
    path: 'src/games/smashup/__tests__/newOngoingAbilities.test.ts',
    keywords: ['General Ivan', 'Pirate First Mate', 'Pirate Buccaneer'],
  },
  {
    path: 'src/games/dicethrone/Board.tsx',
    keywords: ['autoResponseEnabled', 'buildVariantToBaseIdMap', 'tokenUsableOverrides'],
  },
  // ... 其他文件
];

// 验证函数
function verifyFile(file) {
  console.log(`\n验证文件: ${file.path}`);
  
  try {
    // 读取当前文件
    const content = readFileSync(file.path, 'utf-8');
    
    // 搜索关键词
    const results = file.keywords.map(keyword => {
      const found = content.includes(keyword);
      return { keyword, found };
    });
    
    // 输出结果
    const allFound = results.every(r => r.found);
    console.log(`  状态: ${allFound ? '✅ 完整存在' : '❌ 部分或完全缺失'}`);
    results.forEach(r => {
      console.log(`    ${r.found ? '✅' : '❌'} ${r.keyword}`);
    });
    
    return { path: file.path, allFound, results };
  } catch (error) {
    console.log(`  状态: ❌ 文件不存在或无法读取`);
    return { path: file.path, allFound: false, error: error.message };
  }
}

// 执行验证
console.log('开始 P0 文件验证...\n');
const verificationResults = filesToVerify.map(verifyFile);

// 生成报告
console.log('\n\n=== 验证报告 ===\n');
const needRestore = verificationResults.filter(r => !r.allFound);
const noRestore = verificationResults.filter(r => r.allFound);

console.log(`总文件数: ${verificationResults.length}`);
console.log(`✅ 无需恢复: ${noRestore.length} (${(noRestore.length / verificationResults.length * 100).toFixed(1)}%)`);
console.log(`❌ 需要恢复: ${needRestore.length} (${(needRestore.length / verificationResults.length * 100).toFixed(1)}%)`);

if (needRestore.length > 0) {
  console.log('\n需要恢复的文件:');
  needRestore.forEach(r => console.log(`  - ${r.path}`));
}
```

---

## 预期结果

基于 P1/P2 的经验，预期 P0 重新验证的结果：

### 乐观预期（最可能）

- ✅ 无需恢复：10-12 个文件（77-92%）
- ❌ 需要恢复：1-3 个文件（8-23%）
- **误报率**：77-92%

### 中性预期

- ✅ 无需恢复：7-9 个文件（54-69%）
- ❌ 需要恢复：4-6 个文件（31-46%）
- **误报率**：54-69%

### 悲观预期（不太可能）

- ✅ 无需恢复：<7 个文件（<54%）
- ❌ 需要恢复：>6 个文件（>46%）
- **误报率**：<54%

**最可能的结果**：大部分文件是误报，只有少数文件需要恢复。

---

## 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 准备工作 | 15 分钟 |
| 2 | 逐文件验证（13 个文件） | 2 小时 |
| 3 | 恢复缺失文件（1-3 个） | 30-90 分钟 |
| 4 | 生成最终报告 | 30 分钟 |
| **总计** | | **3.25-4.5 小时** |

---

## 决策建议

### 如果时间充足（推荐）

1. ✅ 重新验证 P0（3.25-4.5 小时）
2. ✅ P3 抽样审计（1-2 小时）
3. ✅ 生成最终审计报告（1 小时）
4. **总计**：5.25-7.5 小时

### 如果时间有限

1. ✅ 重新验证 P0（3.25-4.5 小时）
2. ⏭️ 跳过 P3 审计
3. ✅ 生成最终审计报告（1 小时）
4. **总计**：4.25-5.5 小时

### 如果非常紧急（不推荐）

1. ⏭️ 跳过 P0 重新验证
2. ⏭️ 跳过 P3 审计
3. ✅ 基于现有结果生成最终报告（30 分钟）
4. **总计**：30 分钟
5. **风险**：可能遗漏关键功能

---

## 下一步行动（立即执行）

### 选择方案

**我推荐：选择"如果时间充足"方案**

**原因**：
1. P0 是核心逻辑，必须验证
2. P3 抽样审计工作量小，可以快速完成
3. 完整的审计报告对未来有参考价值

### 执行步骤

1. **确认方案**：用户确认选择哪个方案
2. **开始 P0 验证**：创建验证脚本，逐文件验证
3. **恢复缺失文件**：如果发现缺失，立即恢复
4. **生成最终报告**：汇总所有审计结果

---

## 相关文档

- `evidence/audit-final-status.md` - 审计最终状态报告
- `evidence/audit-methodology.md` - 审计方法论
- `evidence/p0-audit-final-complete.md` - P0 审计报告
- `evidence/p1-verification-complete.md` - P1 验证报告
- `evidence/p2-verification-complete.md` - P2 验证报告

---

**创建时间**: 2026-03-04  
**状态**: ⏳ 等待用户确认方案

