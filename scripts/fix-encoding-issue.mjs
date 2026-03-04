import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/pirate-buccaneer-first-mate-d31.test.ts';
const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// 修复第 21 行（索引 20）
if (lines[20] && lines[20].includes('???')) {
    lines[20] = "describe('D31: pirate_buccaneer 拦截路径完整性', () => {";
    console.log('Fixed line 21');
}

// 检查其他可能的截断
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('???') || lines[i].includes('�')) {
        console.log(`Found potential encoding issue at line ${i + 1}: ${lines[i].substring(0, 80)}`);
    }
}

writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log('File fixed');
