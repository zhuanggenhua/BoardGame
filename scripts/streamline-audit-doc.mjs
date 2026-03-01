import { readFileSync, writeFileSync } from 'fs';

const content = readFileSync('docs/ai-rules/testing-audit.md', 'utf-8');
const lines = content.split('\n');

// 保留的部分：
// 1. 核心原则（前 20 行）
// 2. D1-D47 表格（简化版）
// 3. 测试工具选型（简化）
// 4. 删除所有详细展开的维度说明
// 5. 删除具体代码示例
// 6. 删除历史 bug 详细复现

const streamlined = [];
let inDimensionExpansion = false;
let inCodeExample = false;
let skipUntilNextSection = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // 保留标题和核心原则
  if (i < 130) {
    streamlined.push(line);
    continue;
  }
  
  // 跳过"需要展开的关键维度"部分
  if (line.includes('### 需要展开的关键维度') || line.includes('## 需要展开的关键维度')) {
    skipUntilNextSection = true;
    continue;
  }
  
  // 遇到新的主要章节，停止跳过
  if (skipUntilNextSection && line.match(/^## [一二三四五]/)) {
    skipUntilNextSection = false;
  }
  
  if (skipUntilNextSection) continue;
  
  // 跳过具体代码示例（包含 > **示例 的段落）
  if (line.startsWith('> **示例') || line.startsWith('> **典型案例')) {
    inCodeExample = true;
    continue;
  }
  
  if (inCodeExample && (line.startsWith('**D') || line.startsWith('## ') || line.trim() === '')) {
    inCodeExample = false;
  }
  
  if (inCodeExample) continue;
  
  // 保留其他内容
  streamlined.push(line);
}

writeFileSync('docs/ai-rules/testing-audit.md', streamlined.join('\n'), 'utf-8');
console.log(`精简完成：${lines.length} 行 → ${streamlined.length} 行`);
