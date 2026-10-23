#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateE2EImageIndex } from './e2e-image-index-contract.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestArgumentIndex = process.argv.indexOf('--manifest');
const manifestReference = manifestArgumentIndex >= 0 ? process.argv[manifestArgumentIndex + 1] : process.argv[2] ?? null;

if (!manifestReference) {
    console.error('用法: node scripts/verify/validate-e2e-evidence.mjs <PASS清单.json>');
    process.exit(2);
}

const manifestPath = path.resolve(PROJECT_ROOT, manifestReference);
if (!existsSync(manifestPath)) {
    console.error(`PASS 清单不存在: ${manifestPath}`);
    process.exit(2);
}

let manifest;
try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
    console.error(`PASS 清单不是有效 JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
}

try {
    const result = validateE2EImageIndex({
        manifest,
        manifestPath,
        projectRoot: PROJECT_ROOT,
    });
    if (result === null) {
        throw new Error('PASS 清单没有 display.finalPassBeforeOpen=true，不能作为最终交付验收');
    }
    const scope = result.acceptanceMode === 'visual-only' ? '独立纯视觉验收通过' : 'E2E 证据验收通过';
    const groups = result.acceptanceMode === 'visual-only' ? '组独立代表态' : result.capturePolicy === 'distinct-ui-state' ? '条行为证据链（媒体为独特界面状态）' : '条旧三阶段媒体链';
    console.log(`${scope}: ${result.mediaCount} 张媒体, ${result.chainCount} ${groups}, ${result.visualReview?.mediaCount ?? 0} 张逐图视觉审计, ${result.outOfScopeMediaCount ?? 0} 张合同外媒体已显式登记`);
} catch (error) {
    console.error(`E2E 证据验收失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}
