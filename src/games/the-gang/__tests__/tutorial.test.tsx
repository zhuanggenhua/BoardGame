/* @vitest-environment happy-dom */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { ToastProvider } from '../../../contexts/ToastContext';
import { ToastViewport } from '../../../components/system/ToastViewport';
import Board from '../Board';
import { TheGangDomain } from '../domain';
import { execute, reduce } from '../domain/reducer';
import { THE_GANG_COMMANDS, THE_GANG_EVENTS, type TheGangCore } from '../domain/types';
import TheGangTutorial from '../tutorial';

vi.mock('../../../lib/audio/useGameAudio', () => ({
    useGameAudio: () => undefined,
}));

const fixedRandom = { random: () => 0 };

const stateOf = (core: TheGangCore): MatchState<TheGangCore> => ({
    core,
    sys: {
        tutorial: {
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        },
    } as MatchState<TheGangCore>['sys'],
});

const tutorialTargets = () =>
    TheGangTutorial.steps
        .map((step) => step.highlightTarget)
        .filter((target): target is string => Boolean(target));

const stableTutorialTargets = () =>
    tutorialTargets().filter((target) => ![
        'the-gang-next-round',
        'the-gang-reveal-showdown',
        'the-gang-showdown-result',
        'the-gang-showdown-community-cards',
        'the-gang-showdown-hole-cards',
    ].includes(target));

const renderWithToast = (ui: React.ReactElement) =>
    render(
        <ToastProvider>
            {ui}
            <ToastViewport />
        </ToastProvider>,
    );

const tutorialTakeLowestAvailableChipPayload = {
    chip: 1,
    tutorialChipMode: 'lowest-unoccupied',
    tutorialOnlyIfMissing: true,
} as const;

describe('The Gang tutorial', () => {
    test('基础教程包含真实步骤和命令/事件约束', () => {
        expect(TheGangTutorial.id).toBe('the-gang-basic');
        expect(TheGangTutorial.numPlayers).toBe(3);
        expect(TheGangTutorial.steps.length).toBeGreaterThanOrEqual(8);
        expect(TheGangTutorial.steps.map((step) => step.id)).toEqual([
            'intro',
            'goal-track',
            'hand',
            'hand-rank-reference',
            'start-heist',
            'chip-choice',
            'table-response',
            'take-player-chip',
            'advance-round',
            'community-cards',
            'yellow-chip',
            'yellow-response',
            'turn-round',
            'turn-card',
            'orange-chip',
            'orange-response',
            'river-round',
            'final-chip',
            'final-response',
            'reveal-showdown',
            'showdown',
            'showdown-reading',
            'finish',
        ]);

        const handRankStep = TheGangTutorial.steps.find((step) => step.id === 'hand-rank-reference');
        expect(handRankStep).toMatchObject({
            infoStep: true,
            highlightTarget: 'the-gang-hand-rank-reference',
        });

        const startHeistStep = TheGangTutorial.steps.find((step) => step.id === 'start-heist');
        expect(startHeistStep).toMatchObject({
            requireAction: true,
            highlightTarget: 'the-gang-start-heist',
            allowedCommands: [THE_GANG_COMMANDS.START_HEIST],
            advanceOnEvents: [{ type: THE_GANG_EVENTS.HEIST_STARTED }],
        });

        const chipStep = TheGangTutorial.steps.find((step) => step.id === 'chip-choice');
        expect(chipStep).toMatchObject({
            requireAction: true,
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
            advanceOnEvents: [{ type: THE_GANG_EVENTS.CHIP_TAKEN, match: { playerId: '0' } }],
        });

        const tableResponseStep = TheGangTutorial.steps.find((step) => step.id === 'table-response');
        expect(tableResponseStep).toMatchObject({
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
            autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '1', payload: tutorialTakeLowestAvailableChipPayload },
                { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '2', payload: tutorialTakeLowestAvailableChipPayload },
            ],
        });
        expect(tableResponseStep?.infoStep).not.toBe(true);

        const takePlayerChipStep = TheGangTutorial.steps.find((step) => step.id === 'take-player-chip');
        expect(takePlayerChipStep).toMatchObject({
            highlightTarget: 'the-gang-opponent-state',
            requireAction: true,
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
            advanceOnEvents: [{ type: THE_GANG_EVENTS.CHIP_TAKEN, match: { playerId: '0' } }],
        });

        const advanceRoundStep = TheGangTutorial.steps.find((step) => step.id === 'advance-round');
        expect(advanceRoundStep).toMatchObject({
            requireAction: true,
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP, THE_GANG_COMMANDS.END_ROUND],
            aiActions: [
                { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '1', payload: tutorialTakeLowestAvailableChipPayload },
                { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '2', payload: tutorialTakeLowestAvailableChipPayload },
                { commandType: THE_GANG_COMMANDS.END_ROUND, playerId: '1', payload: {} },
                { commandType: THE_GANG_COMMANDS.END_ROUND, playerId: '2', payload: {} },
            ],
            advanceOnEvents: [{ type: THE_GANG_EVENTS.ROUND_ENDED }],
        });

        for (const stepId of ['yellow-chip', 'orange-chip']) {
            const chipStep = TheGangTutorial.steps.find((step) => step.id === stepId);
            expect(chipStep).toMatchObject({
                requireAction: true,
                allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
                advanceOnEvents: [{ type: THE_GANG_EVENTS.CHIP_TAKEN, match: { playerId: '0' } }],
            });
        }

        for (const stepId of ['yellow-response', 'orange-response']) {
            const responseStep = TheGangTutorial.steps.find((step) => step.id === stepId);
            expect(responseStep).toMatchObject({
                allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
                autoAdvanceAfterAi: false,
                aiActions: [
                    { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '1', payload: tutorialTakeLowestAvailableChipPayload },
                    { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '2', payload: tutorialTakeLowestAvailableChipPayload },
                ],
            });
            expect(responseStep?.infoStep).not.toBe(true);
        }

        for (const stepId of ['turn-round', 'river-round']) {
            const roundStep = TheGangTutorial.steps.find((step) => step.id === stepId);
            expect(roundStep).toMatchObject({
                requireAction: true,
                allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP, THE_GANG_COMMANDS.END_ROUND],
                aiActions: [
                    { commandType: THE_GANG_COMMANDS.END_ROUND, playerId: '1', payload: {} },
                    { commandType: THE_GANG_COMMANDS.END_ROUND, playerId: '2', payload: {} },
                ],
                advanceOnEvents: [{ type: THE_GANG_EVENTS.ROUND_ENDED }],
            });
        }

        const finalChipStep = TheGangTutorial.steps.find((step) => step.id === 'final-chip');
        expect(finalChipStep).toMatchObject({
            requireAction: true,
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
            advanceOnEvents: [{ type: THE_GANG_EVENTS.CHIP_TAKEN, match: { playerId: '0' } }],
        });

        const finalResponseStep = TheGangTutorial.steps.find((step) => step.id === 'final-response');
        expect(finalResponseStep).toMatchObject({
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP],
            autoAdvanceAfterAi: false,
            aiActions: [
                { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '1', payload: tutorialTakeLowestAvailableChipPayload },
                { commandType: THE_GANG_COMMANDS.TAKE_CHIP, playerId: '2', payload: tutorialTakeLowestAvailableChipPayload },
            ],
        });
        expect(finalResponseStep?.infoStep).not.toBe(true);

        const revealShowdownStep = TheGangTutorial.steps.find((step) => step.id === 'reveal-showdown');
        expect(revealShowdownStep).toMatchObject({
            requireAction: true,
            allowedCommands: [THE_GANG_COMMANDS.TAKE_CHIP, THE_GANG_COMMANDS.REVEAL_SHOWDOWN],
            aiActions: [
                { commandType: THE_GANG_COMMANDS.REVEAL_SHOWDOWN, playerId: '1', payload: {} },
                { commandType: THE_GANG_COMMANDS.REVEAL_SHOWDOWN, playerId: '2', payload: {} },
            ],
            advanceOnEvents: [{ type: THE_GANG_EVENTS.SHOWDOWN_REVEALED }],
        });

        const showdownReadingStep = TheGangTutorial.steps.find((step) => step.id === 'showdown-reading');
        expect(showdownReadingStep).toMatchObject({
            infoStep: true,
            highlightTarget: 'the-gang-showdown-hole-cards',
        });
        expect(TheGangTutorial.steps.find((step) => step.id === 'showdown')).toMatchObject({
            infoStep: true,
            highlightTarget: 'the-gang-showdown-result',
        });
    });

    test('教程高亮目标在 Board 中都有真实锚点', () => {
        const core = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        renderWithToast(
            <Board
                G={stateOf(core)}
                dispatch={() => undefined}
                playerID="0"
                matchData={[
                    { id: 0, name: '玩家 1', isConnected: true },
                    { id: 1, name: '玩家 2', isConnected: true },
                    { id: 2, name: '玩家 3', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(document.querySelector('[data-tutorial-id="the-gang-title"]')).not.toBeNull();
        for (const target of new Set(stableTutorialTargets())) {
            expect(document.querySelector(`[data-tutorial-id="${target}"]`)).not.toBeNull();
        }
        expect(document.querySelector('[data-tutorial-id="the-gang-hand-rank-reference"]')).not.toBeNull();
    });

    test('教程主动作覆盖选筹码、推进公共牌和摊牌反馈闭环', () => {
        let core = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const dispatch = () => undefined;
        const matchData = [
            { id: 0, name: '玩家 1', isConnected: true },
            { id: 1, name: '玩家 2', isConnected: true },
            { id: 2, name: '玩家 3', isConnected: true },
        ];
        const renderBoard = () =>
            renderWithToast(
                <Board
                    G={stateOf(core)}
                    dispatch={dispatch}
                    playerID="0"
                    matchData={matchData}
                    isConnected
                />,
            );

        const startHeist = () => {
            const events = execute(stateOf(core), {
                type: THE_GANG_COMMANDS.START_HEIST,
                playerId: '0',
                payload: {},
                timestamp: 0,
            }, fixedRandom);
            for (const event of events) core = reduce(core, event);
        };

        const takeChip = (playerId: string, chip: number) => {
            const events = execute(stateOf(core), {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip },
                timestamp: 0,
            }, fixedRandom);
            for (const event of events) core = reduce(core, event);
        };
        const approveProgressForAllPlayers = (
            type: typeof THE_GANG_COMMANDS.END_ROUND | typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
        ) => {
            for (const [index, playerId] of core.playerIds.entries()) {
                const events = execute(stateOf(core), {
                    type,
                    playerId,
                    payload: {},
                    timestamp: index,
                }, fixedRandom);
                for (const event of events) core = reduce(core, event);
            }
        };

        startHeist();
        takeChip('0', 1);
        takeChip('1', 2);
        takeChip('2', 3);

        const readyForNextRound = renderBoard();
        expect(document.querySelector('[data-tutorial-id="the-gang-next-round"]')).not.toBeNull();
        readyForNextRound.unmount();

        approveProgressForAllPlayers(THE_GANG_COMMANDS.END_ROUND);
        expect(core.round).toBe(2);
        expect(core.communityCards).toHaveLength(3);
        expect(core.roundHistory).toHaveLength(1);

        takeChip('0', 1);
        takeChip('1', 2);
        takeChip('2', 3);
        approveProgressForAllPlayers(THE_GANG_COMMANDS.END_ROUND);
        takeChip('0', 1);
        takeChip('1', 2);
        takeChip('2', 3);
        approveProgressForAllPlayers(THE_GANG_COMMANDS.END_ROUND);
        takeChip('0', 1);
        takeChip('1', 2);
        takeChip('2', 3);

        const readyForShowdown = renderBoard();
        expect(document.querySelector('[data-tutorial-id="the-gang-reveal-showdown"]')).not.toBeNull();
        readyForShowdown.unmount();

        approveProgressForAllPlayers(THE_GANG_COMMANDS.REVEAL_SHOWDOWN);

        expect(core.phase).toBe('showdown');
        expect(core.communityCards).toHaveLength(5);
        expect(core.lastShowdown?.results).toHaveLength(3);

        const { unmount } = renderBoard();
        expect(document.querySelector('[data-tutorial-id="the-gang-reveal-showdown"]')).toBeNull();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-area"]')).not.toBeNull();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-result"]')).not.toBeNull();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-community-cards"]')).not.toBeNull();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-hole-cards"]')).not.toBeNull();
        expect(document.querySelector('[data-bgg-zone="reveal-zone"]')).not.toBeNull();
        unmount();
    });
});
