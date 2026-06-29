/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

    it('缺少剧本前置结果时先展示前置页，并把确认结果写回搜索参数', () => {
        const onSearchParamsChange = vi.fn();
        render(
            <QidahenPregameScenarioGate
                searchParams={new URLSearchParams('setup.scenario=shanhaiguan-1622')}
                onSearchParamsChange={onSearchParamsChange}
            >
                {() => <div data-testid="qidahen-ready-board">ready</div>}
            </QidahenPregameScenarioGate>,
        );

        expect(screen.getByTestId('qidahen-scenario-pregame-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('qidahen-ready-board')).not.toBeInTheDocument();
        expect(screen.getByTestId('qidahen-scenario-pregame-player-count')).toHaveTextContent('3 人剧本');
        expect(screen.getByTestId('qidahen-pregame-choice-fields')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('qidahen-pregame-confirm'));

        expect(onSearchParamsChange).toHaveBeenCalledTimes(1);
        const nextSearchParams = onSearchParamsChange.mock.calls[0]?.[0] as URLSearchParams;
        expect(nextSearchParams.get('setup.scenario')).toBe('shanhaiguan-1622');
        expect(nextSearchParams.get('players')).toBe('3');
        expect(nextSearchParams.get('setup.shanhaiguan-1622:ming:character:0')).toBe('ming-wang-huazhen');
        expect(nextSearchParams.get('setup.shanhaiguan-1622:jin:character:0')).toBe('jin-eidu');
        expect(nextSearchParams.get('setup.shanhaiguan-1622:jin:character:1')).toBe('jin-amin');
        expect(nextSearchParams.get('setup.shanhaiguan-1622:ming:armament:0')).toBe('cavalry-armor');
        expect(nextSearchParams.get('setup.shanhaiguan-1622:ming:armament:1')).toBe('cavalry-firearm');
    });

    it('当前入口已经带齐剧本前置结果时直接进入正式棋盘', () => {
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
                {({ numPlayers, setupSelections }) => (
                    <div data-testid="qidahen-ready-board">
                        {String(numPlayers)}|{String(setupSelections['setup.scenario'] ?? setupSelections.scenario ?? '')}
                    </div>
                )}
            </QidahenPregameScenarioGate>,
        );

        expect(screen.queryByTestId('qidahen-scenario-pregame-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('qidahen-ready-board')).toHaveTextContent('3|shanhaiguan-1622');
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
