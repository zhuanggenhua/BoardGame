#!/usr/bin/env node
/**
 * 快速测试 POD 占位符注册是否生效
 */

import { execSync } from 'child_process';

console.log('🧪 Testing POD stub registrations...\n');

// 只运行 ongoing 行动卡注册覆盖测试
try {
    const output = execSync(
        'npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "所有 ongoing 行动卡都有对应的效果注册" 2>&1',
        { encoding: 'utf-8', timeout: 60000 }
    );
    
    if (output.includes('1 passed')) {
        console.log('✅ POD stub registrations working!');
        console.log('\nTest passed: All ongoing action cards have effect registrations');
        process.exit(0);
    } else if (output.includes('failed')) {
        console.log('❌ Test still failing');
        // 提取失败信息
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('未注册') || line.includes('expected')) {
                console.log(line);
            }
        }
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Test execution failed');
    console.log(error.message);
    process.exit(1);
}
