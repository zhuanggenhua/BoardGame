/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplendorEndgameContent, renderSplendorButton, type SplendorEndgameStanding } from '../ui/EndgamePanel';
import commonLocale from '../../../../public/locales/zh-CN/common.json';
import splendorLocale from '../../../../public/locales/zh-CN/game-splendor.json';

type TranslationTree = Record<string, string | TranslationTree>;

function resolve(tree: TranslationTree, key: string, options?: Record<string, unknown>): string {
    const resolved = key.split('.').reduce<string | TranslationTree | undefined>((value, segment) => {
        if (!value || typeof value === 'string') return undefined;
        return value[segment];
    }, tree);
    if (typeof resolved !== 'string') return key;
    return resolved.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? ''));
}

vi.mock('react-i18next', () => ({
    useTranslation: (namespace?: string) => ({
        t: (key: string, options?: Record<string, unknown>) => (
            namespace === 'common'
                ? resolve(commonLocale as TranslationTree, key, options)
                : resolve(splendorLocale as TranslationTree, key, options)
        ),
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const STANDINGS: SplendorEndgameStanding[] = [
    { id: '0', name: '玩家1', score: 16, cardCount: 9, isWinner: true },
    { id: '1', name: '玩家2', score: 14, cardCount: 11, isWinner: false },
];

describe('璀璨宝石终局面板', () => {
    it('胜者视角显示胜利与最终排名', () => {
        render(<SplendorEndgameContent result={{ winner: '0', winners: ['0'] }} playerID="0" standings={STANDINGS} />);

        expect(screen.getByTestId('splendor-endgame-title').textContent).toBe('胜利');
        expect(screen.getByTestId('splendor-endgame-standing-0').textContent).toContain('16 分');
        expect(screen.getByTestId('splendor-endgame-standing-1').textContent).toContain('11 张发展卡');
    });

    it('败者视角显示失败', () => {
        render(<SplendorEndgameContent result={{ winner: '0', winners: ['0'] }} playerID="1" standings={STANDINGS} />);
        expect(screen.getByTestId('splendor-endgame-title').textContent).toBe('失败');
    });

    it('平分同卡数时显示平局而不是某位获胜', () => {
        const drawStandings = STANDINGS.map((standing) => ({ ...standing, isWinner: true }));
        render(<SplendorEndgameContent result={{ draw: true, winners: ['0', '1'] }} playerID="0" standings={drawStandings} />);
        expect(screen.getByTestId('splendor-endgame-title').textContent).toBe('平局');
    });

    it('再来一局按钮透传点击回调', () => {
        const onClick = vi.fn();
        render(<>{renderSplendorButton({ role: 'playAgain', label: '再来一局', onClick })}</>);
        fireEvent.click(screen.getByTestId('splendor-endgame-playAgain'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
