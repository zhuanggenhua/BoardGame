import { beforeAll, describe, expect, it } from 'vitest';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { buildAiDecisionContext, registerGameAiRuntime } from '../../../engine/ai';
import type { SmashUpReactionSession } from '../domain/types';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities } from '../abilities';
import {
    makeBase,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPrompt,
} from './helpers';

beforeAll(() => {
    initAllAbilities();
    registerGameAiRuntime(smashUpAiRuntime);
});

describe('SmashUp AI reaction choice validation', () => {
    it('smashup_reaction_choose 已有当前交互 live 选项时，AI 只提交 live session 与当前交互共同接受的动作', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
            })],
        });
        const reactionSession: SmashUpReactionSession = {
            frameId: 'score-after:0:prefer-current-live-options',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        };
        const stateForAi = startSmashUpReactionSession(makeMatchState(core), reactionSession);
        stateForAi.sys.phase = 'scoreBases' as any;

        stateForAi.core.triggerQueue = [{
            id: 'live-trigger',
            frameId: 'score-after:0:prefer-current-live-options',
            timing: 'afterScoring',
            sourceDefId: 'alien_scout',
            ownerPlayerId: '0',
            mandatory: false,
            resolutionClass: 'optional',
        } as any];

        const interaction = createSimpleChoice(
            'prefer-current-live-options',
            '0',
            '选择响应',
            [
                {
                    id: 'trigger:live-trigger',
                    label: '当前交互仍接受的 live 触发',
                    value: { kind: 'trigger', triggerId: 'live-trigger' },
                    displayMode: 'button',
                },
                {
                    id: 'pass',
                    label: 'Pass',
                    value: { kind: 'pass' },
                    displayMode: 'button',
                },
            ],
            {
                sourceId: 'smashup_reaction_choose',
                targetType: 'field-source-action',
                responseValidationMode: 'live',
            },
        );
        (interaction.data as any).optionsGenerator = () => [
            {
                id: 'trigger:live-trigger',
                label: '当前交互刷新后仍接受的 live 触发',
                value: { kind: 'trigger', triggerId: 'live-trigger' },
                displayMode: 'button',
            },
            {
                id: 'trigger:stale-visible-choice',
                label: '刷新候选里的旧触发',
                value: { kind: 'trigger', triggerId: 'stale-visible-choice' },
                displayMode: 'button',
            },
            {
                id: 'pass',
                label: 'Pass',
                value: { kind: 'pass' },
                displayMode: 'button',
            },
        ];
        stateForAi.sys.interaction = {
            current: interaction,
            queue: [],
            isBlocked: false,
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });

        expect(legalActions.some((action) => action.metadata?.optionId === 'trigger:live-trigger')).toBe(true);
        expect(legalActions.some((action) => action.metadata?.optionId === 'trigger:stale-visible-choice')).toBe(false);

        const chosenAction = legalActions.find(
            (action) => action.metadata?.optionId === 'trigger:live-trigger',
        );
        expect(chosenAction).toBeDefined();
        const resolved = respondToPrompt(stateForAi, 'trigger:live-trigger', '0');
        expect(resolved.success).toBe(true);

        expect(chosenAction?.commands[0]?.payload).toMatchObject({
            interactionId: interaction.id,
            optionId: 'trigger:live-trigger',
        });
    });

    it('smashup_reaction_choose live 校验时，AI 不应提交当前交互已不接受的刷新选项', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_tabletop',
            })],
        });
        const reactionSession: SmashUpReactionSession = {
            frameId: 'score-after:0:visible-stale-live-trigger',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        };
        const stateForAi = startSmashUpReactionSession(makeMatchState(core), reactionSession);
        stateForAi.sys.phase = 'scoreBases' as any;

        stateForAi.core.triggerQueue = [{
            id: 'live-trigger',
            frameId: 'score-after:0:visible-stale-live-trigger',
            timing: 'afterScoring',
            sourceDefId: 'alien_scout',
            ownerPlayerId: '0',
            mandatory: false,
            resolutionClass: 'optional',
        } as any];

        const interaction = createSimpleChoice(
            'visible-stale-live-trigger',
            '0',
            '选择响应',
            [
                {
                    id: 'trigger:stale-visible-choice',
                    label: '当前交互仍展示的触发',
                    value: { kind: 'trigger', triggerId: 'stale-visible-choice' },
                    displayMode: 'button',
                },
                {
                    id: 'pass',
                    label: 'Pass',
                    value: { kind: 'pass' },
                    displayMode: 'button',
                },
            ],
            {
                sourceId: 'smashup_reaction_choose',
                targetType: 'field-source-action',
                responseValidationMode: 'live',
            },
        );
        (interaction.data as any).optionsGenerator = () => [
            {
                id: 'trigger:live-trigger',
                label: '刷新后但当前交互不接受的触发',
                value: { kind: 'trigger', triggerId: 'live-trigger' },
                displayMode: 'button',
            },
            {
                id: 'pass',
                label: 'Pass',
                value: { kind: 'pass' },
                displayMode: 'button',
            },
        ];
        stateForAi.sys.interaction = {
            current: interaction,
            queue: [],
            isBlocked: false,
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });

        expect(legalActions.some((action) => action.metadata?.optionId === 'trigger:live-trigger')).toBe(false);
        expect(legalActions.some((action) => action.metadata?.optionId === 'pass')).toBe(true);

        const passAction = legalActions.find((action) => action.metadata?.optionId === 'pass');
        expect(passAction?.commands[0]?.payload).toMatchObject({
            interactionId: interaction.id,
            optionId: 'pass',
        });
    });

    it('smashup_reaction_choose live 刷新临时为空时，AI 应保留当前让过选项而不是紧急取消', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({
                defId: 'base_tabletop',
            })],
        });
        const reactionSession: SmashUpReactionSession = {
            frameId: 'score-after:0:empty-refresh-keeps-pass',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '1',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        };
        const stateForAi = startSmashUpReactionSession(makeMatchState(core), reactionSession);
        stateForAi.sys.phase = 'scoreBases' as any;

        const interaction = createSimpleChoice(
            'empty-refresh-keeps-pass',
            '1',
            '选择响应',
            [
                {
                    id: 'trigger:onMinionDiscardedFromBase:time_travelers_jumper:onMinionDiscardedFromBase:0:0',
                    label: 'cards.time_travelers_jumper.name',
                    value: {
                        kind: 'trigger',
                        triggerId: 'onMinionDiscardedFromBase:time_travelers_jumper:onMinionDiscardedFromBase:0:0',
                    },
                    displayMode: 'button',
                },
                {
                    id: 'pass',
                    label: 'Pass',
                    value: { kind: 'pass' },
                    displayMode: 'button',
                },
            ],
            {
                sourceId: 'smashup_reaction_choose',
                targetType: 'field-source-action',
                responseValidationMode: 'live',
            },
        );
        (interaction.data as any).optionsGenerator = () => [];
        stateForAi.sys.interaction = {
            current: interaction,
            queue: [],
            isBlocked: false,
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: stateForAi,
        });

        expect(legalActions.some((action) => action.kind === 'interaction-cancel')).toBe(false);
        const passAction = legalActions.find((action) => action.metadata?.optionId === 'pass');
        expect(passAction).toBeDefined();
        expect(passAction?.commands[0]?.payload).toMatchObject({
            interactionId: interaction.id,
            optionId: 'pass',
        });

        const resolved = respondToPrompt(stateForAi, 'pass', '1');
        expect(resolved.success).toBe(true);
    });

    it('smashup_reaction_choose 反馈包里的 play_action 与 pass 快照不应让在线 AI 合法动作变成 0', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2', {
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.INNSMOUTH],
                }),
            },
            bases: [
                makeBase({ defId: 'base_the_jungle' }),
                makeBase({ defId: 'base_great_library' }),
                makeBase({ defId: 'base_the_hill' }),
                makeBase({ defId: 'base_tabletop' }),
            ],
        });
        const stateForAi = makeMatchState(core);
        stateForAi.sys.phase = 'scoreBases' as any;
        stateForAi.sys.interaction = {
            current: createSimpleChoice(
                'smashup_reaction_score-after-3-0_2_1786721555780',
                '2',
                'ui.reaction_choose_optional_title',
                [
                    {
                        id: 'play_action:c113:3:0',
                        label: '计分时效果牌',
                        value: {
                            kind: 'play_action',
                            playerId: '2',
                            cardUid: 'c113',
                            targetBaseIndex: 3,
                        },
                        displayMode: 'card',
                    },
                    {
                        id: 'pass:0',
                        label: 'Pass',
                        value: { kind: 'pass' },
                        displayMode: 'button',
                    },
                ],
                {
                    sourceId: 'smashup_reaction_choose',
                    targetType: 'field-source-action',
                    responseValidationMode: 'live',
                },
            ),
            queue: [],
            isBlocked: false,
        } as any;

        const context = buildAiDecisionContext({
            gameId: 'smashup',
            matchId: 'feedback-6a7f3514ea9fc1b152ff3d5b',
            playerId: '2',
            visibleState: stateForAi,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'online',
        });

        expect(context.legalActions.length).toBeGreaterThan(0);
        expect(context.legalActions.some(action => action.metadata?.optionId === 'play_action:c113:3:0')).toBe(true);
        expect(context.legalActions.some(action => action.metadata?.optionId === 'pass:0')).toBe(true);
    });
});
