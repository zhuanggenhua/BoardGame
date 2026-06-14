#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

// 读取所有修改的文件
const allFiles = readFileSync('tmp/all-modified-files.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);

console.log(`Total files in POD commit: ${allFiles.length}`);

// 已审计的模块
const auditedModules = {
  'Phase 1-8 (Engine)': [
    'src/engine/adapter.ts',
    'src/engine/pipeline.ts',
    'src/engine/types.ts',
    'src/engine/transport/client.ts',
    'src/engine/transport/server.ts',
    'src/engine/transport/protocol.ts',
    'src/engine/transport/react.tsx',
    'src/engine/transport/latency/optimisticEngine.ts',
    'src/engine/transport/latency/types.ts',
    'src/engine/systems/InteractionSystem.ts',
    'src/engine/systems/ResponseWindowSystem.ts',
    'src/engine/systems/UndoSystem.ts',
    'src/engine/systems/index.ts',
    'src/engine/primitives/ability.ts',
    'src/engine/primitives/tags.ts',
    'src/engine/primitives/modifier.ts',
    'src/engine/primitives/damageCalculation.ts',
    'src/engine/primitives/actionLogHelpers.ts',
    'src/engine/primitives/index.ts',
    'src/server/storage/MongoStorage.ts',
  ],
  'Phase B (DiceThrone)': 'src/games/dicethrone/',
  'Phase C (SmashUp)': 'src/games/smashup/',
  'Phase D (SummonerWars)': 'src/games/summonerwars/',
  'Phase E (Engine supplement)': [
    'src/engine/testing/auditFactories.ts',
    'src/engine/testing/entityIntegrity.ts',
    'src/engine/testing/interactionChain.ts',
    'src/engine/testing/interactionCompleteness.ts',
    'src/engine/testing/index.ts',
    'src/engine/testing/types.ts',
    'src/core/types.ts',
    'src/core/AssetLoader.ts',
    'src/core/ui/GameBoardProps.ts',
    'src/core/ui/index.ts',
    'src/core/index.ts',
  ],
  'Phase F (Framework)': [
    'src/components/game/framework/GameHUD.tsx',
    'src/components/game/framework/GameBoard.tsx',
    'src/components/game/framework/PlayerHand.tsx',
    'src/components/game/framework/TurnIndicator.tsx',
    'src/components/game/framework/index.ts',
  ],
  'Phase G (Server)': [
    'src/server/storage/MongoStorage.ts',
    'src/server/storage/HybridStorage.ts',
    'src/server/storage/__tests__/hybridStorage.test.ts',
    'src/server/storage/__tests__/mongoStorage.test.ts',
    'src/server/claimSeat.ts',
    'src/server/models/MatchRecord.ts',
  ],
};

// 检查文件是否已审计
function isAudited(file) {
  for (const [phase, patterns] of Object.entries(auditedModules)) {
    if (Array.isArray(patterns)) {
      if (patterns.includes(file)) {
        return { audited: true, phase };
      }
    } else {
      if (file.startsWith(patterns)) {
        return { audited: true, phase };
      }
    }
  }
  return { audited: false, phase: null };
}

// 分类文件
const remaining = [];
const auditedByPhase = {};

for (const file of allFiles) {
  const { audited, phase } = isAudited(file);
  if (audited) {
    if (!auditedByPhase[phase]) {
      auditedByPhase[phase] = [];
    }
    auditedByPhase[phase].push(file);
  } else {
    remaining.push(file);
  }
}

// 统计
console.log('\n=== Audited Files by Phase ===');
let totalAudited = 0;
for (const [phase, files] of Object.entries(auditedByPhase)) {
  console.log(`${phase}: ${files.length} files`);
  totalAudited += files.length;
}

console.log(`\nTotal audited: ${totalAudited} files (${(totalAudited / allFiles.length * 100).toFixed(1)}%)`);
console.log(`Remaining: ${remaining.length} files (${(remaining.length / allFiles.length * 100).toFixed(1)}%)`);

// 按目录分组剩余文件
const remainingByDir = {};
for (const file of remaining) {
  const dir = file.split('/').slice(0, 2).join('/');
  if (!remainingByDir[dir]) {
    remainingByDir[dir] = [];
  }
  remainingByDir[dir].push(file);
}

console.log('\n=== Remaining Files by Directory ===');
const sortedDirs = Object.entries(remainingByDir).sort((a, b) => b[1].length - a[1].length);
for (const [dir, files] of sortedDirs) {
  console.log(`${dir}: ${files.length} files`);
}

// 输出剩余文件清单
const output = [
  '# Phase H: 剩余文件清单',
  '',
  '## 总体统计',
  '',
  `- **总文件数**: ${allFiles.length}`,
  `- **已审计**: ${totalAudited} (${(totalAudited / allFiles.length * 100).toFixed(1)}%)`,
  `- **剩余**: ${remaining.length} (${(remaining.length / allFiles.length * 100).toFixed(1)}%)`,
  '',
  '## 按目录分组',
  '',
];

for (const [dir, files] of sortedDirs) {
  output.push(`### ${dir} (${files.length} files)`);
  output.push('');
  for (const file of files.sort()) {
    output.push(`- ${file}`);
  }
  output.push('');
}

writeFileSync('evidence/_shared/phase-h-remaining-files-detailed.md', output.join('\n'));
console.log('\n✅ Detailed list written to evidence/_shared/phase-h-remaining-files-detailed.md');

// 输出简单列表
writeFileSync('tmp/phase-h-remaining-files.txt', remaining.join('\n'));
console.log('✅ Simple list written to tmp/phase-h-remaining-files.txt');
