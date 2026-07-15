import { describe, expect, it } from 'vitest';
import {
    createActionLogSystem,
    createEventStreamSystem,
    createInitialSystemState,
    createInteractionSystem,
    createRematchSystem,
    createSimpleChoiceSystem,
    createTutorialSystem,
    executePipeline,
    TUTORIAL_COMMANDS,
} from '../../../engine';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
    createRespondToPromptCommand,
    getCurrentInteractionSummary,
    getPromptOptions,
} from '../../../engine/testing/interactionTestFacade';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import QIDAHEN_TUTORIALS from '../tutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { QidahenDomain } from '../domain';
import { createQidahenInteractionSystem } from '../domain/interactionSystem';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from '../domain/ordinaryHandCardIdentities';
import { QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION } from '../domain/handCardState';

const random: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: <T,>(arr: T[]) => [...arr],
};

const systems = [
    createActionLogSystem(),
    createInteractionSystem(),
    createTutorialSystem(),
    createEventStreamSystem(),
    createSimpleChoiceSystem(),
    createQidahenInteractionSystem(),
    createRematchSystem(),
] as const;

const playerIds = ['0', '1', '2'];

const buildStateForTutorial = (tutorialId: string): MatchState<unknown> => {
    const setup = buildQidahenTutorialSetupData(tutorialId);
    if (!setup) {
        throw new Error(`missing tutorial setup for ${tutorialId}`);
    }
    const core = QidahenDomain.setup(playerIds, random, setup.setupData);
    const sys = createInitialSystemState(playerIds, [...systems], 'qidahen-tutorial-flow-test');
    const initialState = { sys, core };
    return QidahenDomain.normalizeRuntimeState
        ? QidahenDomain.normalizeRuntimeState(initialState)
        : initialState;
};

const dispatch = (state: MatchState<unknown>, command: Command): MatchState<unknown> => {
    const result = executePipeline(
        {
            domain: QidahenDomain,
            systems: [...systems],
        },
        state as MatchState<any>,
        command as any,
        random,
        playerIds,
    );
    expect(result.success, result.error ?? `command failed: ${command.type}`).toBe(true);
    return result.state;
};

const getPromptSummary = (state: MatchState<unknown>) => getCurrentInteractionSummary(state);

const getPromptOptionIds = (state: MatchState<unknown>) => (
    getPromptOptions(state).map((option) => option.id)
);

const respondToPrompt = (
    state: MatchState<unknown>,
    playerId: string,
    args: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
): MatchState<unknown> => dispatch(
    state,
    createRespondToPromptCommand(state, { playerId, ...args }) as Command,
);

const advanceAttackAndBattleTutorialToPendingBattle = (
    state: MatchState<unknown>,
): MatchState<unknown> => {
    state = dispatch(state, {
        type: TUTORIAL_COMMANDS.NEXT,
        playerId: '0',
        payload: { reason: 'manual' },
    });
    expect(state.sys.tutorial.step?.id).toBe('choose-action');
    expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-action-raid');
    expect(state.sys.tutorial.step?.allowedTargets).toEqual(['raid']);
    expect((state.core as any).turnPhase).toBe('action-window');
    expect((state.core as any).factionActionUsed).toBe(false);
    expect((state.core as any).pendingTargetAction).toBeNull();

    state = dispatch(state, {
        type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
        playerId: '0',
        payload: { actionId: 'raid' },
    });
    expect(state.sys.tutorial.step?.id).toBe('pay-raid');
    expect((state.core as any).confirmedActionId).toBe('raid');
    expect((state.core as any).payment.required).toBe(1);

    const paymentCard = (state.core as any).handCards.find((card: any) => (
        card.faction === 'ming'
        && card.status !== 'disabled'
        && card.cardKind !== 'tactic'
    ));
    expect(paymentCard).toBeTruthy();
    state = dispatch(state, {
        type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
        playerId: '0',
        payload: { cardId: paymentCard.id },
    });
    state = dispatch(state, {
        type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
        playerId: '0',
        payload: {},
    });

    expect(state.sys.tutorial.step?.id).toBe('border-width');
    expect((state.core as any).turnPhase).toBe('resolve-pending');
    expect((state.core as any).pendingTargetAction?.actionId).toBe('raid');
    expect((state.core as any).pendingTargetAction?.sourceRegionId).toBe('city-region-16');
    expect((state.core as any).pendingTargetAction?.targetRegionId).toBe('city-region-14');
    return state;
};

describe('qidahen tutorial flow', () => {
    it('教程目录用 6 个玩家主章节串起隐藏续章，并保留关键步骤合同', () => {
        const tutorials = QIDAHEN_TUTORIALS.tutorials;
        const visibleTutorialIds = Object.entries(tutorials)
            .filter(([, tutorial]) => !tutorial.hiddenFromCatalog)
            .map(([tutorialId]) => tutorialId);
        const hiddenTutorialIds = Object.entries(tutorials)
            .filter(([, tutorial]) => tutorial.hiddenFromCatalog)
            .map(([tutorialId]) => tutorialId);
        const collectNextTutorialChain = (tutorialId: string): string[] => {
            const chain: string[] = [];
            let nextTutorialId = tutorials[tutorialId]?.nextTutorialId;
            while (nextTutorialId) {
                expect(chain).not.toContain(nextTutorialId);
                chain.push(nextTutorialId);
                nextTutorialId = tutorials[nextTutorialId]?.nextTutorialId;
            }
            return chain;
        };
        const stepIdsOf = (tutorialId: string): string[] => (
            tutorials[tutorialId]?.manifest.steps.map((step) => step.id) ?? []
        );

        expect(visibleTutorialIds).toEqual([
            'basic-opening',
            'attack-and-battle',
            'siege-and-occupation',
            'wheel-shared-cost',
            'year-and-characters',
            'korea-and-special-map-rules',
        ]);
        expect(hiddenTutorialIds).toEqual([
            'retreat-and-rout',
            'cavalry-evasion',
            'cavalry-plunder',
            'neutral-invasion',
            'water-dispatch',
            'wheel-reclaim',
            'wheel-military-farm',
            'wheel-recruit-train',
            'armament-upgrade',
            'event-action',
            'diplomacy-and-hire',
        ]);
        expect(collectNextTutorialChain('attack-and-battle')).toEqual([
            'retreat-and-rout',
            'cavalry-evasion',
            'cavalry-plunder',
            'neutral-invasion',
            'water-dispatch',
        ]);
        expect(collectNextTutorialChain('wheel-shared-cost')).toEqual([
            'wheel-reclaim',
            'wheel-military-farm',
            'wheel-recruit-train',
            'armament-upgrade',
            'event-action',
            'diplomacy-and-hire',
        ]);
        expect(collectNextTutorialChain('siege-and-occupation')).toEqual([]);
        expect(collectNextTutorialChain('year-and-characters')).toEqual([]);
        expect(collectNextTutorialChain('korea-and-special-map-rules')).toEqual([]);
        expect(stepIdsOf('basic-opening')).toEqual(expect.arrayContaining([
            'hand-limit',
            'wheel-move',
            'pick-action',
            'choose-grant-pardon-target',
            'pay-cards',
        ]));
        expect(stepIdsOf('attack-and-battle')).toEqual(expect.arrayContaining([
            'choose-action',
            'pay-raid',
            'tactic-window',
            'battle-damage',
            'retreat-and-defeat',
        ]));
        expect(stepIdsOf('cavalry-plunder')).toEqual(expect.arrayContaining([
            'choose-plunder',
            'plunder-result',
        ]));
        expect(stepIdsOf('cavalry-evasion')).toEqual(expect.arrayContaining([
            'choose-evasion',
            'evasion-result',
        ]));
        expect(stepIdsOf('neutral-invasion')).toEqual(expect.arrayContaining([
            'resolve-neutral',
            'neutral-result',
        ]));
        expect(stepIdsOf('water-dispatch')).toEqual(expect.arrayContaining([
            'choose-water-target',
            'water-boundary',
        ]));
        expect(stepIdsOf('siege-and-occupation')).toEqual(expect.arrayContaining([
            'defend-city',
            'city-battle',
            'besiege-choice',
        ]));
        expect(stepIdsOf('wheel-shared-cost')).toEqual(expect.arrayContaining([
            'choose-move',
            'draw-result',
            'dispatch-ready',
        ]));
        expect(stepIdsOf('year-and-characters')).toEqual(expect.arrayContaining([
            'advance-midyear',
            'new-year-tribute',
            'new-year-maintenance',
            'chronology-score',
        ]));
        expect(stepIdsOf('korea-and-special-map-rules')).toEqual(expect.arrayContaining([
            'korea-region',
            'water-limit',
            'korea-attrition',
        ]));
    });

    it('基础教程从正式开局真实示范手牌上限、公共轮盘推进、一次手牌行动和一次轮盘落点行动', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['basic-opening']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('basic-opening');
        const initialMingHandCards = (state.core as any).handCards
            .filter((card: any) => card.faction === 'ming')
            .slice(0, 4);
        const expectedAtlas05Cards = QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming.slice(0, 4).map((atlasIndex) => (
            QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((card) => card.atlasIndex === atlasIndex)!
        ));
        expect(initialMingHandCards.map((card: any) => card.label)).toEqual(
            expectedAtlas05Cards.map((card) => card.displayName),
        );
        expect(initialMingHandCards.map((card: any) => card.cardDefId)).toEqual(
            expectedAtlas05Cards.map((card) => card.cardDefId),
        );
        expect(initialMingHandCards.map((card: any) => card.cardKind)).toEqual(
            expectedAtlas05Cards.map((card) => card.cardKind),
        );
        expect(initialMingHandCards.map((card: any) => card.label).join('|')).not.toMatch(/教程|大明事件牌|大明战术牌|银两牌/);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('welcome');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('hand-limit');
        expect((state.core as any).turnPhase).toBe('hand-limit-discard');
        expect((state.core as any).handLimitDiscardSelection?.requiredDiscardCount).toBe(1);
        const [discardCardId] = (state.core as any).handLimitDiscardSelection?.candidateCardIds ?? [];
        expect(discardCardId).toBeTruthy();

        const handLimitInteraction = state.sys.interaction.current;
        expect(handLimitInteraction?.kind).toBe('simple-choice');
        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: handLimitInteraction?.id,
                optionIds: [discardCardId],
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-first');
        expect((state.core as any).turnPhase).toBe('action-window');
        expect((state.core as any).handLimitDiscardSelection).toBeNull();
        expect((state.core as any).factions.ming.handCount).toBe((state.core as any).factions.ming.handLimit);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-move');
        expect((state.core as any).wheelActionUsed).toBe(false);
        expect((state.core as any).factionActionUsed).toBe(false);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('after-wheel');
        expect((state.core as any).wheelActionUsed).toBe(true);
        expect((state.core as any).factionActionUsed).toBe(false);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('hand-resource');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('pick-action');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-cards');
        expect((state.core as any).turnPhase).toBe('action-window');
        expect((state.core as any).payment.required).toBe(3);
        expect((state.core as any).grantPardonSelection).toBeNull();

        const paymentCardIds = (state.core as any).handCards
            .filter((card: any) => card.faction === 'ming' && card.status !== 'disabled')
            .slice(0, 3)
            .map((card: any) => card.id);
        expect(paymentCardIds).toHaveLength(3);
        for (const cardId of paymentCardIds) {
            state = dispatch(state, {
                type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
                playerId: '0',
                payload: { cardId },
            });
        }
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-grant-pardon-target');
        expect((state.core as any).turnPhase).toBe('grant-pardon-choice');
        expect((state.core as any).grantPardonSelection?.choices.map((choice: any) => choice.id)).toContain('jinzhou->city-region-25');
        expect(getPromptSummary(state).kind).toBe('simple-choice');
        expect(getPromptOptionIds(state)).toContain('jinzhou->city-region-25');

        state = respondToPrompt(state, '0', { optionId: 'jinzhou->city-region-25' });
        expect(state.sys.tutorial.step?.id).toBe('action-result');
        expect(((state.core as any).actionLog ?? []).map((entry: any) => entry.text).join(' | ')).toContain('赐印招安');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('morale-level');
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-action');
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('进攻与野战教程从行动窗口选择突袭作战并支付后，再进入边界说明', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['attack-and-battle']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('attack-and-battle');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = advanceAttackAndBattleTutorialToPendingBattle(state);
        expect(state.sys.tutorial.step?.id).toBe('border-width');
    });

    it('进攻与野战教程在结算野战前会先走边界与战术时机，再依次进入战果、战败标记与战后收口步骤', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['attack-and-battle']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('attack-and-battle');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        state = advanceAttackAndBattleTutorialToPendingBattle(state);
        expect(state.sys.tutorial.step?.id).toBe('border-width');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-open');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('tactic-window');

        const tacticCard = (state.core as any).handCards.find((card: any) => card.cardDefId === 'qidahen-atlas05-1618-cavalry-charge');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-atlas05-1618-cavalry-charge');
        expect((state.core as any).pendingTargetAction?.movementProfileId).toBeNull();
        expect((state.core as any).pendingTargetAction?.committedTroops).toBeGreaterThan(0);
        expect(tacticCard?.cardKind).toBe('tactic');
        expect(tacticCard?.label).toBe('骑兵冲锋');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: tacticCard.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-damage');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-resolve-pending-action');
        expect((state.core as any).handCards.some((card: any) => card.id === tacticCard.id)).toBe(false);
        expect((state.core as any).lastSeasonSummary?.title).toBe('战术牌');
        expect((state.core as any).lastSeasonSummary?.lines.join(' ')).toContain('打出战术牌');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                retreatLossMode: 'rear-guard',
                attackerCasualtyPriority: 'lowest-level',
                defenderCasualtyPriority: 'highest-level',
                committedTroops: 5,
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-result');
        expect((state.core as any).postBattleSelection).toBeTruthy();
        expect((state.core as any).factions.jin.defeatMarkers).toBe(1);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('retreat-and-defeat');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-finish');
    });

    it('战败撤退教程在选择溃退后会看到残部清空与战败标记', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['retreat-and-rout']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('retreat-and-rout');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-rout');
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('field');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                retreatLossMode: 'rout',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('rout-result');
        expect((state.core as any).postBattleSelection).toBeNull();
        expect((state.core as any).factions.ming.defeatMarkers).toBe(1);
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-16')?.troops).toBe(0);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('轮盘代价教程在走 3 格后会让两家对手各抽 2，并进入进攻调度', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['wheel-shared-cost']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('wheel-shared-cost');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-move');
        expect((state.core as any).actionWheelPosition).toBe('wheel-military-farm');
        expect((state.core as any).factions.mongol.handCount).toBe(6);
        expect((state.core as any).factions.jin.handCount).toBe(10);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-3-all-opponents',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('draw-result');
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');
        expect((state.core as any).actionWheelPosition).toBe('wheel-hire');
        expect((state.core as any).factions.mongol.handCount).toBe(8);
        expect((state.core as any).factions.jin.handCount).toBe(12);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('dispatch-ready');
        expect((state.core as any).selectedRegionId).toBe('city-region-24');
    });

    it('轮盘开垦教程会从真实轮盘入口进入，并把己方控制区人口加 1', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['wheel-reclaim']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('wheel-reclaim');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-move');
        expect((state.core as any).actionWheelPosition).toBe('wheel-new-year');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).actionWheelPosition).toBe('wheel-reclaim');
        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘开垦');
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-24')?.population).toBe(7);
    });

    it('轮盘军屯教程会从真实轮盘入口进入，并同时补牌和加兵', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['wheel-military-farm']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('wheel-military-farm');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-move');
        expect((state.core as any).actionWheelPosition).toBe('wheel-reclaim');

        const handBefore = (state.core as any).factions.ming.handCount;
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).actionWheelPosition).toBe('wheel-military-farm');
        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘军屯');
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-24')?.troops).toBe(3);
        expect((state.core as any).factions.ming.handCount).toBe(handBefore + 2);
    });

    it('轮盘征兵训练教程会从真实轮盘入口进入，并把加兵与炮兵训练一起结算', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['wheel-recruit-train']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('wheel-recruit-train');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-move');
        expect((state.core as any).actionWheelPosition).toBe('wheel-military-farm');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).actionWheelPosition).toBe('wheel-recruit-train');
        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-24')?.troops).toBe(4);
        expect(
            (state.core as any).regions.find((region: any) => region.id === 'city-region-24')?.note,
        ).toContain('轮盘征兵训练将');
    });

    it('升级军备教程会从当前正式行动入口进入，并把火炮技术升到 2 级', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['armament-upgrade']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('armament-upgrade');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-action');
        expect((state.core as any).factions.ming.armaments.find((armament: any) => armament.id === 'artillery-tech')?.level).toBe(1);
        const mingArmamentCard = (state.core as any).handCards.find((card: any) => card.cardDefId === 'qidahen-atlas05-1626-artillery-tech');
        const artilleryTechIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((card) => (
            card.cardDefId === 'qidahen-atlas05-1626-artillery-tech'
        ));
        expect(mingArmamentCard?.cardKind).toBe('armament');
        expect(mingArmamentCard?.label).toBe('火炮技术');
        expect(mingArmamentCard?.previewRef?.index).toBe(artilleryTechIdentity?.atlasIndex);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament', sourceHandCardId: mingArmamentCard.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-cards');
        expect((state.core as any).payment.required).toBe(2);

        const mingCards = (state.core as any).handCards.filter((card: any) => card.faction === 'ming');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: mingCards[0].id },
        });
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: mingCards[1].id },
        });
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).lastSeasonSummary?.title).toBe('升级军备');
        expect((state.core as any).factions.ming.armaments.find((armament: any) => armament.id === 'artillery-tech')?.level).toBe(2);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('大汗令箭教程会从当前正式行动入口进入，并把这次效果结算成一次征兵训练', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['event-action']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('event-action');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '1',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-action');
        expect((state.core as any).selectedActionId).toBe('khan-edict');
        expect((state.core as any).actionChoices.map((action: any) => action.id)).toContain('khan-edict');
        expect((state.core as any).handCards.map((card: any) => card.label).join('|')).not.toMatch(/大汗令箭事件牌|蒙古银两牌|蒙古战术牌/);
        const mongolSilverIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((card) => (
            card.cardDefId === 'qidahen-atlas05-1643-silver'
        ));
        const firstMongolCard = (state.core as any).handCards.find((card: any) => card.cardDefId === 'qidahen-atlas05-1643-silver');
        expect(firstMongolCard?.label).toBe('银两');
        expect(firstMongolCard?.previewRef?.index).toBe(mongolSilverIdentity?.atlasIndex);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-cards');
        expect((state.core as any).payment.required).toBe(1);

        const mongolCards = (state.core as any).handCards.filter((card: any) => card.faction === 'mongol');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '1',
            payload: { cardId: mongolCards[0].id },
        });
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-effect');
        expect((state.core as any).turnPhase).toBe('khan-edict-choice');
        expect((state.sys as any).interaction?.current?.id).toContain('qidahen-khan-edict-');

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'recruit-train',
                choiceId: 'recruit-train',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).lastSeasonSummary?.title).toBe('大汗令箭');
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-25')?.troops).toBe(4);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('外交雇佣教程在友好标记后选择仅雇佣会推进到 finish', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['diplomacy-and-hire']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('diplomacy-and-hire');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-entry');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-target');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('friendly-mark');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: {
                regionId: 'city-region-24',
            },
        });
        expect((state.core as any).selectedRegionId).toBe('city-region-25');
        expect((state.core as any).explicitRegionId).toBe('city-region-24');

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'place-friendly',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('tribute-mark');

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'flip-vassal',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('remove-mark');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: {
                regionId: 'city-region-22',
            },
        });
        expect((state.core as any).explicitRegionId).toBe('city-region-22');
        expect(
            (state.sys.interaction?.current?.data as { options?: Array<{ id: string }> } | undefined)
                ?.options?.map((option) => option.id),
        ).toContain('remove-marker');

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'remove-marker',
            },
        });

        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘外交/雇佣');
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('攻城教程会先走真实守城宣告，再进入城战待结算和围城选择', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['siege-and-occupation']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('siege-and-occupation');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('defend-city');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-resolve-pending-action-defender-hold-city');
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('field');
        expect((state.core as any).pendingTargetAction?.title).toContain('守城宣告');
        expect((state.sys as any).interaction?.current?.data?.options?.some((option: any) => option.id === 'defender-hold-city')).toBe(true);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                defenderHoldCity: true,
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('city-battle');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-resolve-pending-action');
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('city');
        expect((state.core as any).pendingTargetAction?.title).toContain('城战待结算');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                attackerCasualtyPriority: 'highest-level',
                defenderCasualtyPriority: 'highest-level',
                committedTroops: 4,
            },
        });
        expect((state.core as any).pendingTargetAction).toBeNull();
        expect((state.core as any).postBattleSelection?.battleMode).toBe('city');
        expect(state.sys.tutorial.step?.id).toBe('city-result');
        const cityBattleSummaryText = ((state.core as any).lastSeasonSummary?.lines ?? []).join(' ');
        expect(cityBattleSummaryText).toContain('战斗掷骰（城战）');
        expect(cityBattleSummaryText).toContain('骑步');
        expect(cityBattleSummaryText).toMatch(/\d+->\d+/);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('besiege-choice');
    });

    it('骑兵劫掠教程会走真实劫掠按钮，并写入结算摘要', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['cavalry-plunder']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('cavalry-plunder');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-plunder');
        const options = (state.sys as any).interaction?.current?.data?.options ?? [];
        expect(options.some((option: any) => option.id === 'cavalry-plunder-defender')).toBe(true);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                attackerCavalryPlunder: true,
                attackerCavalryPlunderSource: 'defender',
            },
        });

        expect(state.sys.tutorial.step?.id).toBe('plunder-result');
        expect((state.core as any).pendingTargetAction).toBeNull();
        expect((state.core as any).lastSeasonSummary?.title).toBeTruthy();
        expect(((state.core as any).lastSeasonSummary?.lines ?? []).join(' ')).toContain('骑兵劫掠');
    });

    it('骑兵避战教程会走真实避战按钮，并把骑兵撤到相邻友方区', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['cavalry-evasion']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('cavalry-evasion');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-evasion');
        const options = (state.sys as any).interaction?.current?.data?.options ?? [];
        expect(options.some((option: any) => option.id === 'cavalry-evasion:city-region-19')).toBe(true);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                defenderCavalryEvasion: true,
                defenderCavalryEvasionRegionId: 'city-region-19',
            },
        });

        expect(state.sys.tutorial.step?.id).toBe('evasion-result');
        expect((state.core as any).pendingTargetAction).toBeNull();
        expect((state.core as any).lastSeasonSummary?.title).toBeTruthy();
        const summaryText = ((state.core as any).lastSeasonSummary?.lines ?? []).join(' ');
        expect(summaryText).toContain('守方骑兵避战');
        expect(summaryText).toContain('撤至');
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-19')).toMatchObject({
            controller: 'jin',
            troops: 3,
        });
    });

    it('中立入侵教程会走真实待结算按钮，并生成中立守军', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['neutral-invasion']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('neutral-invasion');
        expect((state.core as any).pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            targetRuntimeRegionId: 'city-region-20',
            defenderFactionId: 'neutral',
        });

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('resolve-neutral');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect((state.core as any).pendingTargetAction).toBeNull();
        const summaryText = ((state.core as any).lastSeasonSummary?.lines ?? []).join(' ');
        expect(summaryText).toContain('中立守军');
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 2,
        });
    });

    it('水路调度教程会走真实调度目标，锁定海岸水路限 2，并排除水路后接陆路', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['water-dispatch']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('water-dispatch');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });

        expect(state.sys.tutorial.step?.id).toBe('choose-water-target');
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');
        expect((state.core as any).selectedRegionId).toBe('song-jin');
        const interactionData = state.sys.interaction?.current?.data as {
            options?: Array<{ id: string; description?: string }>;
            qidahenWheelDispatchSelection?: {
                candidates?: Array<{
                    targetRegionId: string;
                    pathRegionIds: string[];
                    resolutionHint?: string;
                }>;
            };
        } | undefined;
        const options = interactionData
            ?.options ?? [];
        const waterOption = options.find((option) => option.id === 'city-region-22');
        expect(waterOption?.description).toContain('海岸/水路 2');
        expect(waterOption?.description).toContain('限2');
        const followOnWaterOption = options.find((option) => option.id === 'city-region-32');
        expect(followOnWaterOption?.description).toContain('皮岛 → 东江 →');
        expect(followOnWaterOption?.description).toContain('海岸/水路 2');
        expect(options.map((option) => option.id)).not.toEqual(expect.arrayContaining([
            'city-region-25',
            'jinzhou',
        ]));

        const candidates = interactionData?.qidahenWheelDispatchSelection?.candidates ?? [];
        expect(candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-22',
                pathRegionIds: ['song-jin', 'city-region-22'],
            }),
            expect.objectContaining({
                targetRegionId: 'city-region-32',
                pathRegionIds: ['song-jin', 'city-region-22', 'city-region-32'],
            }),
        ]));
        expect(candidates.map((candidate) => candidate.targetRegionId)).not.toEqual(expect.arrayContaining([
            'city-region-25',
            'jinzhou',
        ]));

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'city-region-22',
                choiceId: 'city-region-22',
            },
        });

        expect(state.sys.tutorial.step?.id).toBe('water-boundary');
        expect((state.core as any).pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'song-jin',
            targetRuntimeRegionId: 'city-region-22',
            attackBoundaryType: 'coast',
            boundaryUnitCap: 2,
            battleWidth: 2,
            committedTroops: 2,
        });
    });

    it('年中新年教程在推进到新年后，会先进入朝鲜朝贡，再进入防线维护', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['year-and-characters']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('year-and-characters');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '1',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('advance-midyear');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '1',
            payload: {
                moveId: 'move-2-one-opponent',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('midyear-tax');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('midyear-characters');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('advance-new-year');

        const newYearPlayerId = (state.core as any).currentPlayer;
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: newYearPlayerId,
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('new-year-tribute');
        expect((state.core as any).turnPhase).toBe('season-resolution');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: newYearPlayerId,
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('new-year-maintenance');
    });

    it('朝鲜与地图特例教程会从真实新年入口开始，并在维护后看到朝鲜耗损结果', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['korea-and-special-map-rules']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('korea-and-special-map-rules');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('korea-region');
        expect((state.core as any).turnPhase).toBe('season-resolution');
        expect((state.core as any).actionWheelPosition).toBe('wheel-new-year');
        expect((state.core as any).koreaDeckCount).toBe(9);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('hanseong-vp');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('water-limit');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('new-year-maintenance');

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'auto-pay',
                choiceId: 'auto-pay',
                mergedValue: { attritionPriority: 'lowest-level' },
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('korea-attrition');
        expect((state.core as any).lastSeasonSummary?.title).toBe('新年结算');
        expect(((state.core as any).lastSeasonSummary?.lines ?? []).join(' ')).toContain('朝鲜耗损');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('shanhaiguan');
    });
});
