/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EndgameScreen } from '../endgameScreen';
import { playFirstScenarioToSurvivorVictory, playMummyScenarioToTraitorVictory } from '../testing/firstScenarioTestUtils';
import betrayalLocale from '../../../../public/locales/zh-CN/game-betrayal.json';

type TranslationTree = Record<string, string | TranslationTree>;

function translate(key: string, options?: Record<string, unknown>): string {
    const resolved = key.split('.').reduce<string | TranslationTree | undefined>((value, segment) => {
        if (!value || typeof value === 'string') return undefined;
        return value[segment];
    }, betrayalLocale as TranslationTree);
    if (typeof resolved !== 'string') return key;
    return resolved.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? ''));
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: translate, i18n: { language: 'zh-CN' } }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

function renderScreen(options?: {
    rematch?: { label: string; onClick: () => void; disabled?: boolean; hint?: string } | null;
    onBackToLobby?: () => void;
}) {
    return render(
        <EndgameScreen
            core={playFirstScenarioToSurvivorVictory()}
            viewerPlayerId="0"
            effectiveLocale="zh-CN"
            rematch={options && 'rematch' in options ? options.rematch : { label: '再来一局', onClick: vi.fn() }}
            onBackToLobby={options?.onBackToLobby}
        />,
    );
}

describe('山屋惊魂终局操作', () => {
    it('同一结局的胜负标题以当前座位为准，旁观者看到胜方', () => {
        const core = playMummyScenarioToTraitorVictory();
        const winner = core.endgameResult!.winners[0];
        const loser = core.playerIds.find(id => !core.endgameResult!.winners.includes(id))!;
        const { rerender } = render(<EndgameScreen core={core} effectiveLocale="zh-CN" viewerPlayerId={winner} />);
        fireEvent.click(screen.getByTestId('betrayal-endgame-ending-continue'));
        expect(screen.getAllByText('胜利', { exact: true })).toHaveLength(2);
        expect(core.endgameResult?.survivorsEscaped).toEqual([]);
        expect(screen.getByTestId(`betrayal-endgame-survivor-${loser}`)).toBeTruthy();
        expect(screen.queryByTestId(`betrayal-endgame-survivor-${winner}`)).toBeNull();
        rerender(<EndgameScreen core={core} effectiveLocale="zh-CN" viewerPlayerId={loser} />);
        expect(screen.getAllByText('失败', { exact: true })).toHaveLength(2);
        rerender(<EndgameScreen core={core} effectiveLocale="zh-CN" viewerPlayerId={null} />);
        expect(screen.queryByText('失败', { exact: true })).toBeNull();
        expect(screen.getAllByText('叛徒得逞', { exact: true }).length).toBeGreaterThan(0);
    });
    it('再来一局与返回大厅按钮接通回调', () => {
        const onRematch = vi.fn();
        const onBackToLobby = vi.fn();
        renderScreen({ rematch: { label: '再来一局', onClick: onRematch }, onBackToLobby });

        fireEvent.click(screen.getByTestId('betrayal-endgame-ending-continue'));
        fireEvent.click(screen.getByTestId('betrayal-endgame-rematch'));
        expect(onRematch).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('betrayal-endgame-lobby'));
        expect(onBackToLobby).toHaveBeenCalledTimes(1);
    });

    it('日志按钮重新打开终局朗读', () => {
        renderScreen();

        fireEvent.click(screen.getByTestId('betrayal-endgame-ending-continue'));
        expect(screen.queryByTestId('betrayal-endgame-ending-stage')).toBeNull();
        fireEvent.click(screen.getByTestId('betrayal-endgame-logs'));
        expect(screen.getByTestId('betrayal-endgame-ending-stage')).toBeTruthy();
    });

    it('多人投票等待时展示提示并支持取消投票', () => {
        const onVote = vi.fn();
        renderScreen({ rematch: { label: '取消投票', onClick: onVote, hint: '等待对手确认…' } });

        fireEvent.click(screen.getByTestId('betrayal-endgame-ending-continue'));
        expect(screen.getByTestId('betrayal-endgame-rematch-hint').textContent).toBe('等待对手确认…');
        fireEvent.click(screen.getByTestId('betrayal-endgame-rematch'));
        expect(onVote).toHaveBeenCalledTimes(1);
    });

    it('旁观者隐藏重赛按钮但保留返回大厅', () => {
        const onBackToLobby = vi.fn();
        renderScreen({ rematch: null, onBackToLobby });

        fireEvent.click(screen.getByTestId('betrayal-endgame-ending-continue'));
        expect(screen.queryByTestId('betrayal-endgame-rematch')).toBeNull();
        fireEvent.click(screen.getByTestId('betrayal-endgame-lobby'));
        expect(onBackToLobby).toHaveBeenCalledTimes(1);
    });
});
