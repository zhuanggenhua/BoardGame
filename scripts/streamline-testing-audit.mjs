import { readFileSync, writeFileSync } from 'fs';

const content = readFileSync('docs/ai-rules/testing-audit.md', 'utf-8');
const lines = content.split('\n');

const output = [];
let skipMode = false;
let skipUntilNextSection = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Keep section headers
    if (line.startsWith('##') || line.startsWith('###') || line.startsWith('####')) {
        skipMode = false;
        skipUntilNextSection = false;
        output.push(line);
        continue;
    }
    
    // Skip detailed code examples in "需要展开的关键维度" sections
    if (line.includes('**D') && line.includes('子项：')) {
        output.push(line);
        // Keep the next few lines (description), but skip long code blocks
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('**D') && !lines[j].startsWith('##')) {
            const nextLine = lines[j];
            // Skip code blocks
            if (nextLine.trim().startsWith('```') || nextLine.trim().startsWith('- ❌') || nextLine.trim().startsWith('- ✅')) {
                skipMode = true;
            }
            if (!skipMode) {
                output.push(nextLine);
            }
            if (nextLine.trim() === '```' && skipMode) {
                skipMode = false;
            }
            j++;
        }
        i = j - 1;
        continue;
    }
    
    // Skip the long 教训附录 table at the end
    if (line.includes('## 教训附录')) {
        output.push(line);
        output.push('');
        output.push('> 审查时用 D1-D47，此表仅供类似场景参考。详细案例见 git history 和 bug 文档。');
        output.push('');
        break; // Stop processing after this
    }
    
    // Keep everything else
    if (!skipMode && !skipUntilNextSection) {
        output.push(line);
    }
}

writeFileSync('docs/ai-rules/testing-audit.md', output.join('\n'), 'utf-8');
console.log(`Streamlined from ${lines.length} lines to ${output.length} lines`);
