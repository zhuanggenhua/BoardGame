#!/usr/bin/env node
/**
 * 检查 ActionLog 事件覆盖率
 * 
 * 对比 events.ts 中定义的所有事件类型和 actionLog.ts 中处理的事件类型，
 * 找出未处理的事件。
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 读取 events.ts
const eventsPath = join(rootDir, 'src/games/smashup/domain/events.ts');
const eventsContent = readFileSync(eventsPath, 'utf-8');

// 读取 actionLog.ts
const actionLogPath = join(rootDir, 'src/games/smashup/actionLog.ts');
const actionLogContent = readFileSync(actionLogPath, 'utf-8');

// 提取所有定义的事件类型（从 SU_EVENT_TYPES）
const eventTypesMatch = eventsContent.match(/export const SU_EVENT_TYPES = \{([\s\S]*?)\} as const;/);
if (!eventTypesMatch) {
    console.error('❌ 无法找到 SU_EVENT_TYPES 定义');
    process.exit(1);
}

const eventTypesBlock = eventTypesMatch[1];
const definedEvents = [];
const eventLines = eventTypesBlock.split('\n');
for (const line of eventLines) {
    const match = line.match(/^\s*([A-Z_]+):\s*SU_EVENTS\['([^']+)'\]\.type,/);
    if (match) {
        definedEvents.push(match[1]);
    }
}

// 提取 actionLog.ts 中处理的事件类型
const handledEvents = [];
const caseMatches = actionLogContent.matchAll(/case SU_EVENTS\.([A-Z_]+):/g);
for (const match of caseMatches) {
    handledEvents.push(match[1]);
}

// 找出未处理的事件
const unhandledEvents = definedEvents.filter(e => !handledEvents.includes(e));

// 找出可能不需要记录的事件（silent 或内部状态）
const silentEvents = [];
const eventDefinitions = eventsContent.match(/export const SU_EVENTS = defineEvents\(\{([\s\S]*?)\}\);/);
if (eventDefinitions) {
    const eventsBlock = eventDefinitions[1];
    const eventEntries = eventsBlock.split('\n');
    for (const line of eventEntries) {
        const match = line.match(/'([^']+)':\s*'silent'/);
        if (match) {
            const eventKey = match[1].replace('su:', '').toUpperCase().replace(/:/g, '_');
            silentEvents.push(eventKey);
        }
    }
}

console.log('📊 大杀四方 ActionLog 事件覆盖率检查\n');
console.log(`✅ 已定义事件：${definedEvents.length} 个`);
console.log(`✅ 已处理事件：${handledEvents.length} 个`);
console.log(`❌ 未处理事件：${unhandledEvents.length} 个\n`);

if (unhandledEvents.length > 0) {
    console.log('⚠️  未处理的事件类型：\n');
    for (const event of unhandledEvents) {
        const isSilent = silentEvents.some(s => event.includes(s));
        const marker = isSilent ? '🔇' : '❗';
        console.log(`  ${marker} ${event}${isSilent ? ' (silent/内部状态)' : ''}`);
    }
    
    const nonSilentUnhandled = unhandledEvents.filter(e => 
        !silentEvents.some(s => e.includes(s))
    );
    
    if (nonSilentUnhandled.length > 0) {
        console.log(`\n⚠️  需要处理的非 silent 事件：${nonSilentUnhandled.length} 个`);
        process.exit(1);
    } else {
        console.log('\n✅ 所有非 silent 事件都已处理');
        process.exit(0);
    }
} else {
    console.log('✅ 所有事件都已处理！');
    process.exit(0);
}
