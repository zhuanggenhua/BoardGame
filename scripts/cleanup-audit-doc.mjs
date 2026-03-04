import { readFileSync, writeFileSync } from 'fs';

const content = readFileSync('docs/ai-rules/testing-audit.md', 'utf-8');

// Strategy: Keep structure, remove verbose examples
// 1. Keep D1-D47 dimension table (core framework)
// 2. Keep dimension selection guide (task → dimensions mapping)
// 3. Keep 描述→实现全链路审查规范 (audit workflow)
// 4. Simplify "需要展开的关键维度" sections - keep principles, remove code examples
// 5. Replace 教训附录 table with a brief reference

let result = content;

// Remove verbose code examples in D-dimension subsections
// Pattern: Keep the header and core principle, remove detailed examples
const dimensionPattern = /(\*\*D\d+[^*]*\*\*[^]*?)(```[\s\S]*?```|示例：[\s\S]*?(?=\n\*\*|$))/g;
result = result.replace(dimensionPattern, (match, header) => {
    // Keep header and first paragraph, remove code blocks and long examples
    const lines = header.split('\n');
    const keep = [];
    let inExample = false;
    for (const line of lines) {
        if (line.includes('示例：') || line.includes('**典型') || line.includes('**排查信号')) {
            inExample = true;
        }
        if (!inExample || line.startsWith('**')) {
            keep.push(line);
        }
        if (line.trim() === '') {
            inExample = false;
        }
    }
    return keep.join('\n') + '\n\n';
});

// Simplify the 教训附录 table
const lessonTableStart = result.indexOf('## 教训附录');
if (lessonTableStart !== -1) {
    const beforeTable = result.substring(0, lessonTableStart);
    result = beforeTable + `## 教训附录

> 审查时用 D1-D47 维度，此表仅供类似场景参考。

**核心教训**：
- 语义保真（D1）：实现必须忠实于权威描述，禁止添加/删除/修改描述中不存在的限定条件
- 边界完整（D2）：所有限定条件必须全程约束，不得只在入口检查
- 数据流闭环（D3）：定义→注册→执行→状态→验证→UI→i18n→测试 必须闭环
- 查询一致性（D4）：可被 buff/光环动态修改的属性必须走统一查询入口
- 交互完整（D5）：玩家决策点都有对应 UI，交互模式与描述语义匹配
- 时序正确（D8）：写入时机必须在消费窗口内，阶段结束交互必须 halt 推进
- Reducer 消耗路径（D11）：多来源并存时消耗优先级必须正确
- 写入-消耗对称（D12）：写入路径和消费路径的条件分支必须对称
- 回合清理完整（D14）：临时状态必须在回合/阶段结束时正确清理
- UI 状态同步（D15）：UI 读取的字段必须与 reducer 写入的字段一致

详细案例见 git history 和 docs/bugs/ 目录。
`;
}

writeFileSync('docs/ai-rules/testing-audit.md', result, 'utf-8');

const originalLines = content.split('\n').length;
const newLines = result.split('\n').length;
console.log(`Streamlined from ${originalLines} lines to ${newLines} lines (${Math.round((1 - newLines/originalLines) * 100)}% reduction)`);
