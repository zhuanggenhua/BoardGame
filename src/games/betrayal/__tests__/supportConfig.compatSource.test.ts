import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const GAME_DIR = resolve(__dirname, '..');
const SRC_DIR = resolve(GAME_DIR, '..', '..');
const TOOLS_DIR = resolve(SRC_DIR, 'tools');

const readGameSource = (fileName: string) => readFileSync(resolve(GAME_DIR, fileName), 'utf8');

describe('山屋惊魂调试配置源码守卫', () => {
    it('局内棋盘必须挂载共享调试面板并透传 AI 与人数配置', () => {
        const source = readGameSource('Board.tsx');

        expect(source).toContain('GameDebugPanel');
        expect(source).toContain('function BetrayalDebugPanel');
        expect(source).toContain('<GameDebugPanel');
        expect(source).toContain('aiSupport={BETRAYAL_MANIFEST.ai}');
        expect(source).toContain('playerOptions={BETRAYAL_MANIFEST.playerOptions}');
        expect(source).toContain('<BetrayalDebugPanel G={G} dispatch={dispatch} playerID={playerID} />');
    });

    it('领域引擎必须接入共享作弊系统作为开发态调试入口', () => {
        const source = readGameSource('game.ts');

        expect(source).toContain("import { createCheatSystem } from '../../engine/systems';");
        expect(source).toContain('createCheatSystem<BetrayalCore>()');
    });

    it('游戏专属调试配置不得注册成大厅全局工具', () => {
        const toolDirectoryNames = existsSync(TOOLS_DIR)
            ? readdirSync(TOOLS_DIR, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
            : [];

        expect(toolDirectoryNames).not.toContain('betrayal');
    });
});
