import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const testDir = 'src/games/smashup/__tests__';

function getAllTestFiles(dir) {
    const files = [];
    const items = readdirSync(dir);
    
    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            files.push(...getAllTestFiles(fullPath));
        } else if (item.endsWith('.test.ts') || item.endsWith('.test.tsx')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

function fixMinionDefinitions(content) {
    let modified = false;
    
    // Pattern 1: basePower: X, powerModifier: Y, talentUsed (missing powerCounters and tempPowerModifier)
    const pattern1 = /basePower:\s*(\d+),\s*powerModifier:\s*(-?\d+),\s*talentUsed:/g;
    if (pattern1.test(content)) {
        content = content.replace(
            /basePower:\s*(\d+),\s*powerModifier:\s*(-?\d+),\s*talentUsed:/g,
            'basePower: $1, powerCounters: 0, powerModifier: $2, tempPowerModifier: 0, talentUsed:'
        );
        modified = true;
    }
    
    // Pattern 2: basePower: X, powerModifier: Y, tempPowerModifier: Z, talentUsed (missing powerCounters)
    const pattern2 = /basePower:\s*(\d+),\s*powerModifier:\s*(-?\d+),\s*tempPowerModifier:\s*(-?\d+),\s*talentUsed:/g;
    if (pattern2.test(content)) {
        content = content.replace(
            /basePower:\s*(\d+),\s*powerModifier:\s*(-?\d+),\s*tempPowerModifier:\s*(-?\d+),\s*talentUsed:/g,
            'basePower: $1, powerCounters: 0, powerModifier: $2, tempPowerModifier: $3, talentUsed:'
        );
        modified = true;
    }
    
    return { content, modified };
}

const files = getAllTestFiles(testDir);
let fixedCount = 0;

for (const file of files) {
    try {
        const content = readFileSync(file, 'utf-8');
        const { content: newContent, modified } = fixMinionDefinitions(content);
        
        if (modified) {
            writeFileSync(file, newContent, 'utf-8');
            console.log(`✓ Fixed: ${file}`);
            fixedCount++;
        }
    } catch (err) {
        console.error(`✗ Error processing ${file}:`, err.message);
    }
}

console.log(`\nTotal files fixed: ${fixedCount}`);
