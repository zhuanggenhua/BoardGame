#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// 获取所有文件的变更统计
const numstat = execSync('git diff --numstat 6ea1f9f^..6ea1f9f', { encoding: 'utf-8' });
const lines = numstat.trim().split('\n');

const files = [];
for (const line of lines) {
  const parts = line.split(/\s+/);
  if (parts.length >= 3) {
    const add = parts[0] === '-' ? 0 : parseInt(parts[0]) || 0;
    const del = parts[1] === '-' ? 0 : parseInt(parts[1]) || 0;
    const path = parts.slice(2).join(' ');
    files.push({ path, add, del, net: add - del });
  }
}

console.log(`总文件数: ${files.length}`);

// 按模块分组
const modules = {
  'DiceThrone': [],
  'SmashUp': [],
  'SummonerWars': [],
  'Engine': [],
  'Server': [],
  'Framework': [],
  'Core': [],
  'i18n': [],
  'Components': [],
  'Pages': [],
  'Services': [],
  'Lib': [],
  'UGC': [],
  'TicTacToe': [],
  'Contexts': [],
  'Hooks': [],
  'Other': []
};

for (const file of files) {
  if (file.path.startsWith('src/games/dicethrone/')) modules.DiceThrone.push(file);
  else if (file.path.startsWith('src/games/smashup/')) modules.SmashUp.push(file);
  else if (file.path.startsWith('src/games/summonerwars/')) modules.SummonerWars.push(file);
  else if (file.path.startsWith('src/engine/')) modules.Engine.push(file);
  else if (file.path.startsWith('src/server/')) modules.Server.push(file);
  else if (file.path.startsWith('src/components/game/framework/')) modules.Framework.push(file);
  else if (file.path.startsWith('src/core/')) modules.Core.push(file);
  else if (file.path.startsWith('public/locales/')) modules.i18n.push(file);
  else if (file.path.startsWith('src/components/')) modules.Components.push(file);
  else if (file.path.startsWith('src/pages/')) modules.Pages.push(file);
  else if (file.path.startsWith('src/services/')) modules.Services.push(file);
  else if (file.path.startsWith('src/lib/')) modules.Lib.push(file);
  else if (file.path.startsWith('src/contexts/')) modules.Contexts.push(file);
  else if (file.path.startsWith('src/hooks/')) modules.Hooks.push(file);
  else if (file.path.startsWith('src/ugc/') || file.path.startsWith('src/games/ugc-wrapper/')) modules.UGC.push(file);
  else if (file.path.startsWith('src/games/tictactoe/')) modules.TicTacToe.push(file);
  else modules.Other.push(file);
}

// 生成 Markdown
let md = `# POD 提交完整审查范围文档

## 文档说明

本文档记录 POD 提交（6ea1f9f）中每个文件的审查状态。

**创建时间**: 2026-03-04  
**总文件数**: ${files.length} 个

---

## 审查状态说明

| 符号 | 含义 |
|------|------|
| ✅ | 已审查，变更合理 |
| ❌ | 已审查，需要恢复 |
| ⏳ | 待审查 |
| 🔍 | 审查中 |

---

`;

// 统计已审查的模块
const auditedModules = ['DiceThrone', 'SmashUp', 'SummonerWars', 'Engine', 'Server', 'Framework', 'Core'];

for (const [moduleName, moduleFiles] of Object.entries(modules)) {
  if (moduleFiles.length === 0) continue;
  
  const totalAdd = moduleFiles.reduce((sum, f) => sum + f.add, 0);
  const totalDel = moduleFiles.reduce((sum, f) => sum + f.del, 0);
  const totalNet = totalAdd - totalDel;
  const isAudited = auditedModules.includes(moduleName);
  
  md += `### ${moduleName} (${moduleFiles.length} files)\n\n`;
  md += `**总变更**: +${totalAdd} -${totalDel} (净: ${totalNet >= 0 ? '+' : ''}${totalNet})\n`;
  md += `**审查状态**: ${isAudited ? '✅ 已审查' : '⏳ 待审查'}\n\n`;
  
  md += `| 文件 | 变更 | 净变更 | 审查状态 |\n`;
  md += `|------|------|--------|----------|\n`;
  
  for (const file of moduleFiles) {
    const netStr = file.net >= 0 ? `+${file.net}` : `${file.net}`;
    const status = isAudited ? '✅' : '⏳';
    md += `| \`${file.path}\` | +${file.add} -${file.del} | ${netStr} | ${status} |\n`;
  }
  
  md += `\n---\n\n`;
}

// 添加统计摘要
const totalAudited = auditedModules.reduce((sum, name) => sum + (modules[name]?.length || 0), 0);
const totalRemaining = files.length - totalAudited;

md += `## 审查进度统计

| 状态 | 文件数 | 百分比 |
|------|--------|--------|
| ✅ 已审查 | ${totalAudited} | ${(totalAudited / files.length * 100).toFixed(1)}% |
| ⏳ 待审查 | ${totalRemaining} | ${(totalRemaining / files.length * 100).toFixed(1)}% |
| **总计** | **${files.length}** | **100%** |

---

## 待审查模块清单

`;

for (const [moduleName, moduleFiles] of Object.entries(modules)) {
  if (moduleFiles.length === 0 || auditedModules.includes(moduleName)) continue;
  md += `- **${moduleName}**: ${moduleFiles.length} 文件\n`;
}

writeFileSync('evidence/_shared/audit-scope-complete.md', md, 'utf-8');
console.log('✅ 已生成完整审查范围文档: evidence/_shared/audit-scope-complete.md');
console.log(`已审查: ${totalAudited} 文件 (${(totalAudited / files.length * 100).toFixed(1)}%)`);
console.log(`待审查: ${totalRemaining} 文件 (${(totalRemaining / files.length * 100).toFixed(1)}%)`);
