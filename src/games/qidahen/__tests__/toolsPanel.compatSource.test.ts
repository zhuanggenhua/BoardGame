import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const GAME_DIR = resolve(__dirname, '..');

const readGameSource = (fileName: string) => readFileSync(resolve(GAME_DIR, fileName), 'utf8');

describe('Qidahen tools panel compatibility source guards', () => {
    it('局内棋盘必须挂载共享调试面板和七大恨专项工具', () => {
        const source = readGameSource('Board.tsx');

        expect(source).toContain("import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';");
        expect(source).toContain("import { QidahenDebugConfig } from './debug-config';");
        expect(source).toContain('<QidahenDebugConfig G={G} />');
    });

    it('七大恨专项调试工具必须暴露区域编辑器和运行时预览入口', () => {
        const source = readGameSource('debug-config.tsx');

        expect(source).toContain("href: '/dev/qidahen-region-mask'");
        expect(source).toContain("href: '/dev/qidahen-runtime-preview'");
        expect(source).toContain('data-testid="qidahen-debug-tools"');
        expect(source).toContain('data-testid={tool.testId}');
    });
});
