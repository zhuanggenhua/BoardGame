import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(resolve(TEST_DIR, '..', 'ArchitectureView.tsx'), 'utf8');

describe('ArchitectureView compatibility source guards', () => {
    it('移动窄屏用户故事视图应收紧为紧凑布局并隐藏右侧关联标签', () => {
        const source = readSource();

        expect(source).toContain("const isCompactViewport = viewport.width > 0 && viewport.width <= 900;");
        expect(source).toContain('const showRelatedTags = !isCompactViewport;');
        expect(source).toContain("maxHeight={isCompactViewport ? 'none' : 'calc(100vh - 120px)'}");
    });

    it('用户故事阶段卡应暴露稳定 test id 供移动端 E2E 校验首尾阶段可见性', () => {
        const source = readSource();

        expect(source).toContain('data-testid={`arch-story-step-${i}`}');
    });
});
