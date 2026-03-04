#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/abilities/ninjas.ts',
    'src/games/smashup/abilities/pirates.ts',
];

for (const file of files) {
    console.log(`Processing ${file}...`);
    let content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const newLines = [];
    let skipNext = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip console.log/error/trace lines (but keep console.warn in podStubs.ts)
        if (line.includes('console.log(') || line.includes('console.error(') || line.includes('console.trace(')) {
            // Check if it's a multi-line console statement
            if (!line.trim().endsWith(');')) {
                // Skip until we find the closing );
                while (i < lines.length && !lines[i].includes(');')) {
                    i++;
                }
                continue;
            }
            continue;
        }
        
        newLines.push(line);
    }
    
    writeFileSync(file, newLines.join('\n'), 'utf-8');
    console.log(`✓ Cleaned ${file}`);
}

console.log('\n✓ All files cleaned');
