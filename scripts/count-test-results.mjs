#!/usr/bin/env node
/**
 * 统计测试结果
 */

import { execSync } from 'child_process';

console.log('🧪 Running SmashUp tests and counting results...\n');

try {
    const output = execSync(
        'npx vitest run --reporter=json src/games/smashup/__tests__/ 2>&1',
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 180000 }
    );
    
    // 解析 JSON 输出
    const lines = output.split('\n');
    let jsonLine = null;
    
    // 找到包含 testResults 的 JSON 行
    for (const line of lines) {
        if (line.trim().startsWith('{') && line.includes('testResults')) {
            jsonLine = line;
            break;
        }
    }
    
    if (jsonLine) {
        const result = JSON.parse(jsonLine);
        const { numTotalTests, numPassedTests, numFailedTests, numTotalTestSuites, numPassedTestSuites, numFailedTestSuites } = result;
        
        console.log('📊 Test Results Summary:');
        console.log('========================\n');
        console.log(`Test Suites: ${numPassedTestSuites} passed | ${numFailedTestSuites} failed | ${numTotalTestSuites} total`);
        console.log(`Tests:       ${numPassedTests} passed | ${numFailedTests} failed | ${numTotalTests} total`);
        console.log(`\nPass Rate:   ${((numPassedTests / numTotalTests) * 100).toFixed(1)}%`);
        
        if (numFailedTests > 0) {
            console.log(`\n⚠️  ${numFailedTests} tests still failing`);
        } else {
            console.log('\n✅ All tests passing!');
        }
    } else {
        console.log('❌ Could not parse test results');
    }
} catch (error) {
    console.error('❌ Error running tests:', error.message);
    process.exit(1);
}
