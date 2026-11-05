import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const screenSource = readFileSync(resolve(__dirname, '..', 'ui', 'QidahenFactionSelectionScreen.tsx'), 'utf-8');
const cssSource = readFileSync(resolve(__dirname, '..', 'qidahen-board.css'), 'utf-8');

describe('七大恨派系选择页结构', () => {
    it('剧本菜单默认关闭，主舞台是三列阵营', () => {
        expect(screenSource).toContain('useState(false)');
        expect(screenSource).toContain('data-testid="qidahen-scenario-menu-open"');
        expect(screenSource).toContain('data-testid="qidahen-faction-selection-screen"');
        expect(screenSource).toContain('QIDAHEN_FACTION_SELECT_IDS.map');
        expect(screenSource).toContain('scenarioMenuOpen ? (');
        expect(screenSource).toContain('defaultValue: \'起始剧本设置卡\'');
        expect(screenSource).toContain('board.factionSelection.confirmScenarioFirst');
        expect(screenSource).not.toContain('board.scenarioVote.selectCard');
        expect(screenSource).not.toContain('待确认');
        expect(screenSource).not.toContain('待锁定');
        expect(screenSource).not.toContain('资源紧张');
    });

    it('势力行动悬停提示和印刷剧本卡样式落在派系选择 CSS 里', () => {
        expect(cssSource).toContain('.qidahen-faction-select__act:hover .qidahen-faction-select__tip');
        expect(cssSource).toContain('top: calc(100% + 8px)');
        expect(cssSource).toContain('width: 92px');
        expect(cssSource).toContain('clip-path: circle(47% at 50% 50%)');
        expect(cssSource).toContain('width: 420px');
        expect(cssSource).toContain('height: 582px');
        expect(cssSource).toContain('translateY(-8px)');
        expect(cssSource).not.toContain('border-radius: 999px');
    });
});
