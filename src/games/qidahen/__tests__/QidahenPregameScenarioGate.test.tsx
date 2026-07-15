/* @vitest-environment happy-dom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QidahenPregameScenarioGate } from '../QidahenPregameScenarioGate';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string; count?: number }) => {
            if (typeof options?.defaultValue === 'string') {
                return options.defaultValue.replace('{{count}}', String(options.count ?? ''));
            }
            return key;
        },
    }),
}));

describe('QidahenPregameScenarioGate', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('普通入口不再展示剧本预选页，而是直接进入局内剧本选择模式', () => {
        const onSearchParamsChange = vi.fn();
        render(
            <QidahenPregameScenarioGate
                searchParams={new URLSearchParams('setup.scenario=shanhaiguan-1622')}
                onSearchParamsChange={onSearchParamsChange}
            >
                {({ numPlayers, setupSelections, setupData }) => (
                    <div data-testid="qidahen-ready-board">
                        {String(numPlayers)}
                        |
                        {String(setupSelections.qidahenInMatchScenarioVote)}
                        |
                        {String(setupData.qidahenInMatchScenarioVote)}
                    </div>
                )}
            </QidahenPregameScenarioGate>,
        );

        expect(screen.queryByTestId('qidahen-scenario-pregame-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('qidahen-ready-board')).toHaveTextContent('3|enabled|enabled');
        expect(onSearchParamsChange).not.toHaveBeenCalled();
    });

    it('兼容 URL 里带齐旧前置结果时，也不会绕过局内剧本投票', () => {
        const onSearchParamsChange = vi.fn();
        render(
            <QidahenPregameScenarioGate
                searchParams={new URLSearchParams([
                    ['setup.scenario', 'shanhaiguan-1622'],
                    ['players', '3'],
                    ['setup.shanhaiguan-1622:ming:character:0', 'ming-xiong-tingbi'],
                    ['setup.shanhaiguan-1622:jin:character:0', 'jin-fan-wencheng'],
                    ['setup.shanhaiguan-1622:jin:character:1', 'jin-manggultai'],
                    ['setup.shanhaiguan-1622:ming:armament:0', 'artillery-tech'],
                    ['setup.shanhaiguan-1622:ming:armament:1', 'long-barreled-musket'],
                ])}
                onSearchParamsChange={onSearchParamsChange}
            >
                {({ numPlayers, setupSelections, setupData }) => (
                    <div data-testid="qidahen-ready-board">
                        {String(numPlayers)}
                        |
                        {String(setupSelections.scenario ?? '')}
                        |
                        {String(setupData.setupSelections && typeof setupData.setupSelections === 'object'
                            ? (setupData.setupSelections as Record<string, unknown>).qidahenInMatchScenarioVote
                            : '')}
                    </div>
                )}
            </QidahenPregameScenarioGate>,
        );

        expect(screen.queryByTestId('qidahen-scenario-pregame-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('qidahen-ready-board')).toHaveTextContent('3||enabled');
        expect(onSearchParamsChange).not.toHaveBeenCalled();
    });

    it('普通入口仍允许直接请求二人房，但二人剧本也要到棋盘内由房主选择', () => {
        const onSearchParamsChange = vi.fn();
        render(
            <QidahenPregameScenarioGate
                searchParams={new URLSearchParams('players=2')}
                onSearchParamsChange={onSearchParamsChange}
            >
                {({ numPlayers, setupSelections }) => (
                    <div data-testid="qidahen-ready-board">
                        {String(numPlayers)}|{String(setupSelections.qidahenInMatchScenarioVote)}
                    </div>
                )}
            </QidahenPregameScenarioGate>,
        );

        expect(screen.queryByTestId('qidahen-scenario-pregame-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('qidahen-ready-board')).toHaveTextContent('2|enabled');
        expect(onSearchParamsChange).not.toHaveBeenCalled();
    });

    it('教程默认路由未显式带子教程 id 时，也会落到基础教程预设', () => {
        const onSearchParamsChange = vi.fn();
        render(
            <QidahenPregameScenarioGate
                searchParams={new URLSearchParams('')}
                tutorialMode
                onSearchParamsChange={onSearchParamsChange}
            >
                {({ numPlayers, setupData }) => (
                    <div data-testid="qidahen-tutorial-ready-board">
                        {String(numPlayers)}|{typeof setupData.qidahenTutorialCoreTransform}
                    </div>
                )}
            </QidahenPregameScenarioGate>,
        );

        expect(screen.queryByTestId('qidahen-scenario-pregame-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('qidahen-tutorial-ready-board')).toHaveTextContent('3|function');
        expect(onSearchParamsChange).not.toHaveBeenCalled();
    });
});
