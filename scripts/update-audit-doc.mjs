import { readFileSync, writeFileSync } from 'fs';

const filePath = 'evidence/giant-ants-complex-audit-2026-02-22.md';
const content = readFileSync(filePath, 'utf-8');

const oldText = `## 仍需关注的架构级差距（非本轮回归缺陷）
- \`承受压力\` 与 \`我们乃最强\` 文案含"计分前/计分后"时机语义，
  但当前卡牌定义是 \`subtype: 'standard'\` + \`abilityTags: ['talent']\`：
  - @src/games/smashup/data/factions/giant-ants.ts#93-100
  - @src/games/smashup/data/factions/giant-ants.ts#125-132
- 现有验证层对 \`special\` 的约束是"仅计分前 Me First 窗口可打出"：
  - @src/games/smashup/domain/commands.ts#190-193
- 因此"计分后 special"尚无通用窗口，属于引擎时机模型缺口（需要单独设计）。`;

const newText = `## 仍需关注的架构级差距（非本轮回归缺陷）
- ✅ **已修复（2026-03-04）**：\`承受压力\` 与 \`我们乃最强\` 文案含"计分前/计分后"时机语义，
  但当前卡牌定义缺少 \`specialTiming\` 字段：
  - 修复：为"我们乃最强"添加 \`specialTiming: 'afterScoring'\` 字段
  - 证据：\`evidence/smashup/smashup-we-are-the-champions-timing-fix.md\`
  - @src/games/smashup/data/factions/giant-ants.ts#93-100
  - @src/games/smashup/data/factions/giant-ants.ts#125-132
- ✅ **已实现**：现有验证层对 \`special\` 的约束支持 \`specialTiming: 'beforeScoring'\` 和 \`specialTiming: 'afterScoring'\`：
  - @src/games/smashup/domain/commands.ts#190-193
  - "计分后 special"通过 \`afterScoring\` 触发器实现，已有完整的引擎支持`;

const newContent = content.replace(oldText, newText);
writeFileSync(filePath, newContent, 'utf-8');
console.log('✅ 文档已更新');
