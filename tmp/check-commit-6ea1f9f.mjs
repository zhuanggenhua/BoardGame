#!/usr/bin/env node
/**
 * 检查提交 6ea1f9f 中可能导致 bug 的修改
 * 
 * 使用方法：
 * node scripts/check-commit-6ea1f9f.mjs
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const COMMIT = '6ea1f9f';

console.log('🔍 开始分析提交', COMMIT);
console.log('');

// 关键文件列表
const keyFiles = [
  'src/games/smashup/domain/reducer.ts',
  'src/games/smashup/domain/index.ts',
  'src/games/smashup/domain/reduce.ts',
  'src/games/smashup/domain/types.ts',
  'src/games/smashup/domain/commands.ts',
  'src/games/smashup/abilities/ninjas.ts',
  'src/games/smashup/abilities/pirates.ts',
  'src/games/smashup/abilities/dinosaurs.ts',
];

// 可疑模式列表
const suspiciousPatterns = [
  { name: 'powerModifier 重复', pattern: /powerModifier.*push/gi },
  { name: 'afterScoring 重复', pattern: /afterScoring.*forEach/gi },
  { name: '直接修改状态', pattern: /\w+\.\w+\s*=(?!=)/g },
  { name: '缺少结构共享', pattern: /return\s+core(?!\.)/g },
  { name: '未初始化字段', pattern: /\?\s*:\s*\w+\[\]/g },
  { name: 'switch 缺少 default', pattern: /switch\s*\([^)]+\)\s*{[^}]*}(?!.*default:)/gs },
  { name: '事件未处理', pattern: /case\s+'[^']+':(?!\s*return)/g },
];

const results = {
  fileChanges: {},
  suspiciousCode: [],
  summary: {
    totalFiles: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    suspiciousCount: 0,
  }
};

console.log('📊 分析关键文件修改...\n');

for (const file of keyFiles) {
  try {
    // 获取文件的修改统计
    const stat = execSync(`git show ${COMMIT} --stat -- ${file}`, { encoding: 'utf-8' });
    const statMatch = stat.match(/(\d+)\s+insertion.*?(\d+)\s+deletion/);
    
    if (statMatch) {
      const additions = parseInt(statMatch[1] || 0);
      const deletions = parseInt(statMatch[2] || 0);
      
      results.fileChanges[file] = { additions, deletions };
      results.summary.totalAdditions += additions;
      results.summary.totalDeletions += deletions;
      results.summary.totalFiles++;
      
      console.log(`✓ ${file}`);
      console.log(`  +${additions} -${deletions}`);
    }
    
    // 获取文件的具体修改内容
    const diff = execSync(`git show ${COMMIT} -- ${file}`, { encoding: 'utf-8' });
    
    // 检查可疑模式
    for (const { name, pattern } of suspiciousPatterns) {
      const matches = diff.match(pattern);
      if (matches && matches.length > 0) {
        results.suspiciousCode.push({
          file,
          pattern: name,
          count: matches.length,
          samples: matches.slice(0, 3), // 只保留前3个示例
        });
        results.summary.suspiciousCount++;
        console.log(`  ⚠️  发现可疑模式: ${name} (${matches.length} 处)`);
      }
    }
    
    console.log('');
  } catch (error) {
    console.error(`❌ 无法分析文件: ${file}`);
    console.error(error.message);
  }
}

console.log('\n📋 汇总报告\n');
console.log(`总计修改文件: ${results.summary.totalFiles}`);
console.log(`总计新增行数: ${results.summary.totalAdditions}`);
console.log(`总计删除行数: ${results.summary.totalDeletions}`);
console.log(`发现可疑模式: ${results.summary.suspiciousCount} 处`);

if (results.suspiciousCode.length > 0) {
  console.log('\n⚠️  可疑代码详情:\n');
  for (const item of results.suspiciousCode) {
    console.log(`文件: ${item.file}`);
    console.log(`模式: ${item.pattern}`);
    console.log(`出现次数: ${item.count}`);
    console.log(`示例:`);
    item.samples.forEach((sample, i) => {
      console.log(`  ${i + 1}. ${sample.trim()}`);
    });
    console.log('');
  }
}

// 保存结果到文件
const reportPath = 'docs/bugs/6ea1f9f-analysis-report.json';
writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
console.log(`\n💾 详细报告已保存到: ${reportPath}`);

// 生成检查清单
console.log('\n✅ 下一步检查清单:\n');
console.log('1. 查看详细 diff:');
keyFiles.forEach(file => {
  console.log(`   git show ${COMMIT} -- ${file}`);
});

console.log('\n2. 运行测试:');
console.log('   npm test -- smashup');
console.log('   npm test -- alien-scout-no-duplicate-scoring');
console.log('   npm test -- steampunk-aggromotive-fix');

console.log('\n3. 检查特定问题:');
console.log('   - Power Modifier 重复: 搜索 reducer.ts 中的 powerModifier');
console.log('   - 计分重复触发: 搜索 index.ts 中的 afterScoring');
console.log('   - 状态字段缺失: 检查 types.ts 新增字段是否初始化');

console.log('\n4. 如果发现严重问题:');
console.log('   git revert 6ea1f9f');
console.log('   或');
console.log('   git checkout -b fix/6ea1f9f-bugs 6ea1f9f^');

console.log('\n✨ 分析完成！');
