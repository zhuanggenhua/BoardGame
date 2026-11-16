/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
    FantasyRealmsEndgameContent,
    renderFantasyRealmsButton,
} from '../ui/EndgameContent';
import { RematchActions } from '../../../components/game/framework/widgets/RematchActions';
import commonLocale from '../../../../public/locales/zh-CN/common.json';
import frLocale from '../../../../public/locales/zh-CN/game-fantasyrealms.json';

type TranslationTree = Record<string, string | TranslationTree>;

function makeTranslate(bundle: TranslationTree) {
    return function translate(key: string, options?: Record<string, unknown>): string {
        const resolved = key.split('.').reduce<string | TranslationTree | undefined>((value, segment) => {
            if (!value || typeof value === 'string') return undefined;
            return value[segment];
        }, bundle);
        if (typeof resolved !== 'string') return key;
        return resolved.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? ''));
    };
}

const frNs = (frLocale as TranslationTree) ?? {};
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: makeTranslate(commonLocale as TranslationTree),
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// 测试用排名数据
const STANDINGS = [
    { id: '0', name: '艾莉丝', score: 42, isWinner: true },
    { id: '1', name: '鲍勃', score: 35, isWinner: false },
];

function makeResult(overrides?: Partial<{ winner: string; winners: string[]; draw: boolean }>) {
    return { winner: '0', winners: ['0'], draw: false, scores: { '0': 42, '1': 35 }, ...overrides };
}

describe('幻想国度终局内容面板', () => {
    it('胜利态：渲染标题、排名与获胜者皇冠高亮', () => {
        render(
            <MemoryRouter>
                <FantasyRealmsEndgameContent
                    result={makeResult()}
                    playerID="0"
                    standings={STANDINGS}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('fantasyrealms-endgame-content')).toBeTruthy();
        expect(screen.getByTestId('fantasyrealms-endgame-title').textContent).toBe('胜利');
        expect(screen.getByTestId('fantasyrealms-endgame-standing-0')).toBeTruthy();
        expect(screen.getByTestId('fantasyrealms-endgame-standing-1')).toBeTruthy();
        // 获胜者行存在皇冠（lucide 渲染为 svg）
        const winnerRow = screen.getByTestId('fantasyrealms-endgame-standing-0');
        expect(winnerRow.querySelector('svg')).toBeTruthy();
    });

    it('失败态：标题为失败，无皇冠', () => {
        render(
            <MemoryRouter>
                <FantasyRealmsEndgameContent
                    result={makeResult({ winner: '1', winners: ['1'] })}
                    playerID="0"
                    standings={[
                        { id: '1', name: '鲍勃', score: 42, isWinner: true },
                        { id: '0', name: '艾莉丝', score: 35, isWinner: false },
                    ]}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('fantasyrealms-endgame-title').textContent).toBe('失败');
        // 失败者行无皇冠
        const loserRow = screen.getByTestId('fantasyrealms-endgame-standing-0');
        expect(loserRow.querySelector('svg')).toBeNull();
    });

    it('平局态：标题为平局，双方均无皇冠', () => {
        render(
            <MemoryRouter>
                <FantasyRealmsEndgameContent
                    result={makeResult({ draw: true, winner: '', winners: [] })}
                    playerID="0"
                    standings={[
                        { id: '0', name: '艾莉丝', score: 42, isWinner: false },
                        { id: '1', name: '鲍勃', score: 42, isWinner: false },
                    ]}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('fantasyrealms-endgame-title').textContent).toBe('平局');
        expect(screen.getByTestId('fantasyrealms-endgame-standing-0').querySelector('svg')).toBeNull();
        expect(screen.getByTestId('fantasyrealms-endgame-standing-1').querySelector('svg')).toBeNull();
    });
});

describe('幻想国度终局按钮（renderFantasyRealmsButton）', () => {
    function renderActions(options?: {
        isMultiplayer?: boolean;
        reset?: () => void;
        onVote?: () => void;
        rematchState?: { votes: Record<string, boolean>; ready: boolean; revision: number };
    }) {
        return render(
            <MemoryRouter>
                <RematchActions
                    playerID="0"
                    reset={options?.reset}
                    isMultiplayer={options?.isMultiplayer ?? false}
                    totalPlayers={2}
                    rematchState={options?.rematchState}
                    onVote={options?.onVote}
                    renderButton={renderFantasyRealmsButton}
                />
            </MemoryRouter>,
        );
    }

    it('单人模式：再来一局调用 reset', () => {
        const reset = vi.fn();
        renderActions({ reset });
        fireEvent.click(screen.getByTestId('fantasyrealms-endgame-playAgain'));
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('多人模式：投票调用 onVote 而非 reset', () => {
        const reset = vi.fn();
        const onVote = vi.fn();
        renderActions({
            isMultiplayer: true,
            reset,
            onVote,
            rematchState: { votes: {}, ready: false, revision: 0 },
        });
        fireEvent.click(screen.getByTestId('fantasyrealms-endgame-vote'));
        expect(onVote).toHaveBeenCalledTimes(1);
        expect(reset).not.toHaveBeenCalled();
    });

    it('已投票后显示取消投票并调用 onVote', () => {
        const onVote = vi.fn();
        renderActions({
            isMultiplayer: true,
            onVote,
            rematchState: { votes: { '0': true }, ready: false, revision: 1 },
        });
        fireEvent.click(screen.getByTestId('fantasyrealms-endgame-cancelVote'));
        expect(onVote).toHaveBeenCalledTimes(1);
    });
});
