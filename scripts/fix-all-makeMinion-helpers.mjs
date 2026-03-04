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

function fixHelperFunctions(content) {
    let modified = false;
    
    // Pattern: helper function returning minion without powerCounters
    // Matches: basePower: X, powerModifier: Y, tempPowerModifier: Z, talentUsed
    // But NOT if powerCounters already exists
    const helperPattern = /(\s+basePower:\s*\w+,\s*)powerModifier:\s*(-?\d+),\s*tempPowerModifier:\s*(-?\d+),\s*talentUsed:/g;
    
    if (content.match(helperPattern) && !content.includes('powerCounters:')) {
        content = content.replace(
            helperPattern,
            '$1powerCounters: 0, powerModifier: $2, tempPowerModifier: $3, talentUsed:'
        );
        modified = true;
    }
    
    // Also fix cases where tempPowerModifier is missing
    const pattern2 = /(\s+basePower:\s*\w+,\s*)powerModifier:\s*(-?\d+),\s*talentUsed:/g;
    if (content.match(pattern2)) {
        content = content.replace(
            pattern2,
            '$1powerCounters: 0, powerModifier: $2, tempPowerModifier: 0, talentUsed:'
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
        const { content: newContent, modified } = fixHelperFunctions(content);
        
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
