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
import QIDAHEN_TUTORIALS, {
    QIDAHEN_PLAYER_TUTORIALS,
    QIDAHEN_TEST_TUTORIALS,
} from '../tutorial';
import {
    buildQidahenTutorialSetupData,
    QIDAHEN_TUTORIAL_SETUP_CONTRACTS,
} from '../tutorialSetup';
import { QidahenDomain } from '../domain';
import { getQidahenWheelRecruitTrainChoices } from '../domain/wheelRecruitTrain';
import { createQidahenInteractionSystem } from '../domain/interactionSystem';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from '../domain/ordinaryHandCardIdentities';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';

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
    const setup = buildQidahenTutorialSetupData(tutorialId, true);
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
    expect(state.sys.tutorial.step?.id).toBe('action-overview');
    expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-actions-zone');
    expect((state.core as any).actionChoices.map((choice: any) => choice.id)).toEqual([
        'raid',
        'recruit',
        'grant-pardon',
        'drive-tiger',
    ]);

    state = dispatch(state, {
        type: TUTORIAL_COMMANDS.NEXT,
        playerId: '0',
        payload: { reason: 'manual' },
    });
    expect(state.sys.tutorial.step?.id).toBe('choose-action');
    expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-action-raid');
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

    state = dispatch(state, {
        type: QIDAHEN_COMMANDS.SELECT_REGION,
        playerId: '0',
        payload: { regionId: 'city-region-14' },
    });

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
    expect(state.sys.tutorial.step?.id).toBe('pay-raid');
    expect((state.core as any).payment.selected).toBe(1);
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
    it('重构过的教程章节递增进度 revision，避免恢复旧步骤快照', () => {
        expect(QIDAHEN_TEST_TUTORIALS.tutorials['basic-opening']?.manifest.revision).toBe(15);
        for (const tutorialId of [
            'wheel-shared-cost',
            'wheel-recruit-train',
            'event-action',
            'siege-and-occupation',
            'retreat-and-rout',
        ]) {
            expect(QIDAHEN_TEST_TUTORIALS.tutorials[tutorialId]?.manifest.revision).toBe(1);
        }
    });

    it('正式开局先让玩家看辽东与叶赫部，再进入有局面用途的轮盘行动', () => {
        const steps = QIDAHEN_TEST_TUTORIALS.tutorials['basic-opening']?.manifest.steps ?? [];
        expect(steps[0]).toMatchObject({ id: 'frontier', highlightTarget: 'qidahen-map-layer' });
        expect(steps[1]).toMatchObject({
            id: 'select-farm-region',
            highlightTarget: 'qidahen-map-region-focus-city-region-15-liaodong',
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
        });
    });

    it('教程设置按入口类型声明正式前因，不允许把代表态伪装成自然开局', () => {
        expect(QIDAHEN_TUTORIAL_SETUP_CONTRACTS['basic-opening']).toMatchObject({
            entryKind: 'natural-opening',
            startingPoint: 'formal-opening',
            formalEntryPhase: 'action-window',
            currentActorFaction: 'ming',
            precedingAtoms: ['setup-complete'],
            firstRealDecision: 'choose-region',
            scope: 'mainline',
        });
        expect(QIDAHEN_TUTORIAL_SETUP_CONTRACTS['event-action']).toMatchObject({
            firstRealDecision: 'choose-hand-action',
            precedingAtoms: ['setup-complete', 'hand-limit'],
        });
        expect(QIDAHEN_TUTORIAL_SETUP_CONTRACTS['year-and-characters']).toMatchObject({
            firstRealDecision: 'choose-wheel-move',
            precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        });
        expect(QIDAHEN_TUTORIAL_SETUP_CONTRACTS['wheel-shared-cost']).toMatchObject({
            firstRealDecision: 'choose-wheel-move',
            precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        });

        for (const [tutorialId, contract] of Object.entries(QIDAHEN_TUTORIAL_SETUP_CONTRACTS)) {
            const setup = buildQidahenTutorialSetupData(tutorialId, true);
            expect(setup?.setupData.qidahenTutorialContract, tutorialId).toEqual(contract);
            if (contract.entryKind !== 'natural-opening') {
                expect(contract.startingPoint, tutorialId).toBe('representative-state');
                expect(contract.injectedDifferences.length, tutorialId).toBeGreaterThan(0);
            }
        }
    });

    it('教程目录只呈现一条入门主线，补充练习不与主线平铺', () => {
        const tutorials = QIDAHEN_TEST_TUTORIALS.tutorials;
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
        ]);
        expect(Object.keys(QIDAHEN_PLAYER_TUTORIALS.tutorials)).toEqual(['basic-opening']);
        expect(Object.keys(QIDAHEN_TUTORIALS.tutorials)).toEqual(['basic-opening']);
        expect(hiddenTutorialIds).toEqual([
            'attack-and-battle',
            'siege-and-occupation',
            'retreat-and-rout',
            'cavalry-evasion',
            'cavalry-plunder',
            'neutral-invasion',
            'water-dispatch',
            'wheel-shared-cost',
            'wheel-reclaim',
            'wheel-military-farm',
            'wheel-recruit-train',
            'armament-upgrade',
            'event-action',
            'diplomacy-and-hire',
            'year-and-characters',
            'korea-and-special-map-rules',
        ]);
        expect(collectNextTutorialChain('attack-and-battle')).toEqual([]);
        expect(collectNextTutorialChain('wheel-shared-cost')).toEqual([]);
        expect(collectNextTutorialChain('siege-and-occupation')).toEqual([]);
        expect(collectNextTutorialChain('year-and-characters')).toEqual([]);
        expect(collectNextTutorialChain('korea-and-special-map-rules')).toEqual([]);
        expect(stepIdsOf('basic-opening')).toEqual([
            'frontier', 'select-farm-region', 'wheel-move', 'wheel-opponent', 'wheel-result',
            'choose-raid', 'action-branch-recovery', 'choose-target', 'pay-raid', 'payment-branch-recovery', 'confirm-raid-payment',
            'battle-open', 'play-tactic', 'resolve-battle', 'battle-branch-recovery', 'battle-result',
            'occupy', 'occupation-branch-recovery', 'finish',
        ]);
        expect(stepIdsOf('attack-and-battle')).toEqual(expect.arrayContaining([
            'action-overview',
            'choose-action',
            'pay-raid',
            'tactic-window',
            'battle-damage',
            'retreat-and-defeat',
            'post-battle-choice',
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
            'choose-post-battle-outcome',
            'besiege-result',
            'occupy-result',
            'withdraw-result',
        ]));
        const siegeSteps = QIDAHEN_TEST_TUTORIALS.tutorials['siege-and-occupation']?.manifest.steps ?? [];
        expect(siegeSteps.filter((step) => [
            'defend-city',
            'choose-post-battle-outcome',
            'besiege-result',
            'occupy-result',
            'withdraw-result',
        ].includes(step.id)).every((step) => (
            step.avoidOverlapSelectors?.includes('[data-testid="qidahen-actions-zone"]')
        ))).toBe(true);
        expect(stepIdsOf('wheel-shared-cost')).toEqual(expect.arrayContaining([
            'choose-move',
            'draw-result',
            'dispatch-rule',
            'pay-dispatch',
        ]));
        const dispatchPaymentStep = QIDAHEN_TEST_TUTORIALS.tutorials['wheel-shared-cost']?.manifest.steps
            .find((step) => step.id === 'pay-dispatch');
        expect(dispatchPaymentStep?.requireAction).toBe(true);
        expect(dispatchPaymentStep?.allowedCommands).toEqual(expect.arrayContaining([
            QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            QIDAHEN_COMMANDS.CONFIRM_WHEEL_DISPATCH_PAYMENT,
        ]));
        expect(dispatchPaymentStep?.advanceOnEvents).toEqual([
            { type: 'WHEEL_DISPATCH_PAYMENT_RESOLVED' },
        ]);
        expect(dispatchPaymentStep?.avoidOverlapSelectors).toEqual(expect.arrayContaining([
            '[data-testid="qidahen-hand-zone"]',
            '[data-testid="qidahen-wheel-dispatch-payment-panel"]',
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

    it('教程结果步骤聚焦真实结果承接物，轮盘落点优先聚焦当前行动标记', () => {
        const allSteps = Object.values(QIDAHEN_TEST_TUTORIALS.tutorials)
            .flatMap((tutorial) => tutorial.manifest.steps);
        const wheelResult = allSteps.find((step) => step.id === 'wheel-result');
        expect(wheelResult?.highlightTarget).toBe('qidahen-season-summary');
        expect(QIDAHEN_TEST_TUTORIALS.tutorials['basic-opening']?.manifest.steps
            .find((step) => step.id === 'choose-target')?.highlightTarget).toBe('qidahen-map-region-focus-city-region-7');
        const seasonSummarySteps = allSteps.filter((step) => step.highlightTarget === 'qidahen-season-summary');
        expect(seasonSummarySteps.length).toBeGreaterThan(0);
        expect(seasonSummarySteps.every((step) => [
            'action-result', 'wheel-result',
            'result', 'finish',
        ].includes(step.id))).toBe(true);

        const directResultStepIds = new Set([
            'action-result',
            'battle-finish',
            'occupy-result',
            'rout-result',
            'plunder-result',
            'evasion-result',
            'neutral-result',
            'draw-result',
            'result',
            'midyear-tax',
            'midyear-characters',
            'new-year-attrition',
            'korea-attrition',
        ]);
        const directResultSteps = allSteps.filter((step) => (
            directResultStepIds.has(step.id)
        ));
        expect(directResultSteps.length).toBeGreaterThanOrEqual(13);
        const summaryResultContent = new Set([
            'game-qidahen:tutorial.basic.steps.actionResult',
            'game-qidahen:tutorial.wheelRecruitTrain.steps.result',
            'game-qidahen:tutorial.eventAction.steps.result',
        ]);
        expect(directResultSteps.filter((step) => step.highlightTarget === 'qidahen-season-summary')
            .every((step) => summaryResultContent.has(step.content))).toBe(true);
        expect(directResultSteps.filter((step) => !summaryResultContent.has(step.content))
            .every((step) => step.highlightTarget && step.highlightTarget !== 'qidahen-season-summary')).toBe(true);
        expect(directResultSteps.some((step) => step.highlightTarget === 'qidahen-map-result-feedback')).toBe(true);
        expect(directResultSteps.some((step) => step.highlightTarget === 'qidahen-player-float')).toBe(true);
    });

    it('教程卡避让正式承接区，不遮支付面板、玩家条和右侧动作区', () => {
        const allSteps = Object.values(QIDAHEN_TEST_TUTORIALS.tutorials)
            .flatMap((tutorial) => tutorial.manifest.steps);
        const hasSelector = (step: (typeof allSteps)[number], selector: string) =>
            step.avoidOverlapSelectors?.includes(selector) ?? false;

        expect(allSteps.filter((step) => step.id === 'pay-cards')
            .every((step) => hasSelector(step, '[data-testid="qidahen-action-payment-panel"]'))).toBe(true);
        expect(allSteps.find((step) => step.id === 'pay-raid'))
            .toEqual(expect.objectContaining({
                avoidOverlapSelectors: expect.arrayContaining([
                    '[data-testid="qidahen-action-payment-panel"]',
                    '[data-testid="qidahen-hand-interaction-tray"]',
                ]),
            }));
        expect(allSteps.filter((step) => step.highlightTarget === 'qidahen-player-float')
            .every((step) => hasSelector(step, '[data-testid="qidahen-actions-zone"]'))).toBe(true);
        expect(allSteps.find((step) => step.id === 'shanhaiguan'))
            .toEqual(expect.objectContaining({
                avoidOverlapSelectors: expect.arrayContaining([
                    '[data-testid="qidahen-actions-zone"]',
                    '[data-testid="qidahen-player-float"]',
                    '[data-testid="qidahen-hand-zone"]',
                ]),
            }));
        expect(allSteps.find((step) => step.id === 'result'
            && step.content === 'game-qidahen:tutorial.wheelReclaim.steps.result'))
            .toEqual(expect.objectContaining({
                avoidOverlapSelectors: expect.arrayContaining([
                    '[data-testid="qidahen-actions-zone"]',
                ]),
            }));
        expect(allSteps.find((step) => step.id === 'wheel-result'))
            .toEqual(expect.objectContaining({
                position: 'left',
                avoidOverlapSelectors: expect.arrayContaining([
                    '[data-testid="qidahen-actions-zone"]',
                ]),
            }));
    });

    it('进攻与野战教程从行动窗口选择突袭作战并支付后，再进入边界说明', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['attack-and-battle']?.manifest;
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
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['attack-and-battle']?.manifest;
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
            ...createRespondToPromptCommand(state, { playerId: '2', optionId: 'defender-fight' }),
            skipValidation: true,
        } as Command);
        state = dispatch(state, { type: TUTORIAL_COMMANDS.AI_CONSUMED, playerId: '0', payload: { stepId: 'battle-open' } });

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
                attackerCasualtyPriority: 'highest-level',
                defenderCasualtyPriority: 'highest-level',
                committedTroops: 5,
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-result');
        expect((state.core as any).lastSeasonSummary?.mapResult).toMatchObject({
            regionId: 'city-region-14',
            troopDelta: -1,
            beforeTroops: 1,
            afterTroops: 0,
        });
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
        expect(state.sys.tutorial.step?.id).toBe('post-battle-choice');

        const occupyChoiceId = (state.core as any).postBattleSelection?.choices
            ?.find((choice: any) => choice.mode === 'occupy')?.id;
        expect(occupyChoiceId).toBeTruthy();
        expect(getPromptOptionIds(state)).toContain(occupyChoiceId);
        state = respondToPrompt(state, '0', { optionId: occupyChoiceId });
        expect(state.sys.tutorial.step?.id).toBe('battle-finish');
    });

    it('战败撤退教程在选择溃退后会看到残部清空与战败标记', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['retreat-and-rout']?.manifest;
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

    it('轮盘代价教程在走 3 格后让两家对手各抽 2，实际弃牌支付后保留部队调度入口', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['wheel-shared-cost']?.manifest;
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
        expect(state.sys.tutorial.step?.id).toBe('dispatch-rule');
        expect((state.core as any).selectedRegionId).toBe('city-region-24');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-dispatch');
        expect((state.core as any).payment.required).toBe(1);
        const currentFactionId = getCurrentFactionId(state.core as any);
        const currentFactionHandBeforePayment = (state.core as any).factions[currentFactionId].handCount;
        const currentFactionDiscardBeforePayment = (state.core as any).factions[currentFactionId].discardPileCount ?? 0;

        const paymentCard = (state.core as any).handCards.find((card: any) => (
            card.faction === currentFactionId && card.status !== 'disabled'
        ));
        expect(paymentCard).toBeTruthy();
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: paymentCard.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-dispatch');
        expect((state.core as any).selectedPaymentCardIds).toEqual([paymentCard.id]);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.CONFIRM_WHEEL_DISPATCH_PAYMENT,
            playerId: '0',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
        expect((state.core as any).payment.required).toBe(0);
        expect((state.core as any).selectedPaymentCardIds).toEqual([]);
        expect((state.core as any).factions[currentFactionId].handCount).toBe(currentFactionHandBeforePayment - 1);
        expect((state.core as any).factions[currentFactionId].discardPileCount).toBe(currentFactionDiscardBeforePayment + 1);
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');
        expect((state.core as any).actionWheelPosition).toBe('wheel-hire');
    });

    it('轮盘开垦教程会从真实轮盘入口进入，并把己方控制区人口加 1', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['wheel-reclaim']?.manifest;
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
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['wheel-military-farm']?.manifest;
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

    it('轮盘征兵训练教程会真实支付、选择训练与征兵、执行额外训练并结束后继续对局', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['wheel-recruit-train']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('wheel-recruit-train');
        const next = () => {
            state = dispatch(state, {
                type: TUTORIAL_COMMANDS.NEXT,
                playerId: '0',
                payload: { reason: 'manual' },
            });
        };

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');
        next();
        expect(state.sys.tutorial.step?.id).toBe('rule-payment');
        next();
        expect(state.sys.tutorial.step?.id).toBe('choose-move');
        expect((state.core as any).actionWheelPosition).toBe('wheel-military-farm');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-initial');
        expect(state.sys.tutorial.step?.hideOverlay).toBeUndefined();
        expect((state.core as any).currentPlayer).toBe('0');
        expect((state.core as any).actionWheelPosition).toBe('wheel-recruit-train');
        expect((state.core as any).lastSeasonSummary).toBeNull();

        const mingCard = (state.core as any).handCards.find((card: any) => card.faction === 'ming' && card.status !== 'disabled');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: mingCard.id },
        });
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT,
            playerId: '0',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('actions-rule');
        next();
        expect(state.sys.tutorial.step?.id).toBe('choose-training');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: 'action:train' },
        });
        expect(state.sys.tutorial.step?.id).toBe('artillery-rule');
        next();
        expect(state.sys.tutorial.step?.id).toBe('choose-training-target');
        const artillery = getQidahenWheelRecruitTrainChoices(state.core as any)
            .find((choice) => choice.regionId === 'city-region-24' && choice.troopKind === 'artillery');
        expect(artillery).toBeTruthy();
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: artillery!.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('training-result');
        expect((state.core as any).wheelRecruitTrainProgress.actionsCompleted).toBe(1);

        next();
        expect(state.sys.tutorial.step?.id).toBe('choose-recruit');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: 'action:recruit' },
        });
        expect(state.sys.tutorial.step?.id).toBe('recruit-homeland-rule');
        next();
        expect(state.sys.tutorial.step?.id).toBe('choose-recruit-target');
        const recruitTarget = getQidahenWheelRecruitTrainChoices(state.core as any)[0];
        expect(recruitTarget?.kind).toBe('recruit-target');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: recruitTarget!.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('recruit-result');
        expect((state.core as any).wheelRecruitTrainProgress.actionsCompleted).toBe(2);

        next();
        expect(state.sys.tutorial.step?.id).toBe('extra-training-rule');
        next();
        expect(state.sys.tutorial.step?.id).toBe('choose-extra-training');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: 'extra-training' },
        });
        expect(state.sys.tutorial.step?.id).toBe('pay-extra');
        const extraCard = (state.core as any).handCards.find((card: any) => card.faction === 'ming' && card.status !== 'disabled');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: extraCard.id },
        });
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT,
            playerId: '0',
            payload: {},
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-extra-training-target');
        const extraTarget = getQidahenWheelRecruitTrainChoices(state.core as any)
            .find((choice) => choice.regionId === 'city-region-24' && choice.troopKind === 'infantry' && choice.level === 2);
        expect(extraTarget).toBeTruthy();
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: extraTarget!.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('extra-training-result');
        expect((state.core as any).wheelRecruitTrainProgress).toMatchObject({
            actionsCompleted: 2,
            extraTrainingsCompleted: 1,
        });
        next();
        expect(state.sys.tutorial.step?.id).toBe('finish-action');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '0',
            payload: { choiceId: 'finish' },
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).wheelRecruitTrainProgress).toBeNull();
        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        next();
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('升级军备教程会从当前正式行动入口进入，并把火炮技术升到 2 级', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['armament-upgrade']?.manifest;
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
        expect(state.sys.tutorial.step?.id).toBe('action-overview');
        expect((state.core as any).actionChoices.map((choice: any) => choice.id)).toEqual([
            'raid',
            'recruit',
            'grant-pardon',
            'drive-tiger',
        ]);

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

    it('大汗令箭教程会支付一次行动费，再真实选择本土征兵并结束效果', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['event-action']?.manifest;
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
        expect(state.sys.tutorial.step?.id).toBe('action-overview');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-actions-zone');
        expect((state.core as any).actionChoices.map((action: any) => action.id)).toEqual([
            'upgrade-armament',
            'raid',
            'ma-shi-trade',
            'khan-edict',
        ]);

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
        expect(state.sys.tutorial.step?.id).toBe('recruit-train-actions-rule');
        expect((state.core as any).wheelRecruitTrainProgress).toMatchObject({ source: 'khan-edict', phase: 'choose-action' });

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-recruit');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '1',
            payload: { choiceId: 'action:recruit' },
        });
        expect(state.sys.tutorial.step?.id).toBe('recruit-homeland-rule');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-recruit-target');
        const recruitTarget = getQidahenWheelRecruitTrainChoices(state.core as any)[0];
        expect(recruitTarget?.kind).toBe('recruit-target');
        const troopsBeforeRecruit = (state.core as any).factions.mongol.troops;
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '1',
            payload: { choiceId: recruitTarget!.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('recruit-result');
        expect((state.core as any).factions.mongol.troops).toBe(troopsBeforeRecruit + 1);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish-recruit-train');
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
            playerId: '1',
            payload: { choiceId: 'finish' },
        });
        expect(state.sys.tutorial.step?.id).toBe('result');
        expect((state.core as any).lastSeasonSummary?.title).toBe('大汗令箭 · 征兵训练');
        expect((state.core as any).wheelRecruitTrainProgress).toBeNull();

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '1',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('外交雇佣教程在友好标记后选择仅雇佣会推进到 finish', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['diplomacy-and-hire']?.manifest;
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
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['siege-and-occupation']?.manifest;
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
        expect(state.sys.tutorial.step?.avoidOverlapSelectors).toContain('[data-testid="qidahen-actions-zone"]');
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('field');
        expect((state.core as any).pendingTargetAction?.title).toContain('守城宣告');
        expect((state.sys as any).interaction?.current?.data?.options?.some((option: any) => option.id === 'defender-hold-city')).toBe(true);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
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
        expect(state.sys.tutorial.step?.id).toBe('choose-post-battle-outcome');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-post-battle-selection');
        expect(state.sys.tutorial.step?.advanceOnEvents).toEqual([
            { type: 'POST_BATTLE_DECISION_RESOLVED' },
        ]);
        expect(state.sys.tutorial.step?.avoidOverlapSelectors).toContain('[data-testid="qidahen-actions-zone"]');
        const postBattleChoices = (state.core as any).postBattleSelection?.choices ?? [];
        expect(postBattleChoices.some((choice: any) => choice.id === 'occupy' && choice.mode === 'occupy')).toBe(true);
        expect(postBattleChoices.some((choice: any) => choice.id === 'besiege' && choice.mode === 'besiege')).toBe(true);
        expect(postBattleChoices.some((choice: any) => choice.id === 'withdraw:city-region-24' && choice.mode === 'withdraw')).toBe(true);
    });

    it('骑兵劫掠教程会走真实劫掠按钮，并写入结算摘要', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['cavalry-plunder']?.manifest;
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
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['cavalry-evasion']?.manifest;
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
            playerId: '2',
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
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['neutral-invasion']?.manifest;
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
            troops: 3,
        });
    });

    it('水路调度教程会走真实调度目标，锁定海岸水路限 2，并排除水路后接陆路', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['water-dispatch']?.manifest;
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

    it('年中新年教程在推进到新年后，会先进入朝鲜朝贡，再进入维护并自动进入耗损结果', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['year-and-characters']?.manifest;
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
                opponentFactionId: 'ming',
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

        const maintenanceInteraction = state.sys.interaction?.current;
        expect((maintenanceInteraction?.data as { sourceId?: string } | undefined)?.sourceId)
            .toBe('qidahen:fortification-maintenance');
        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: maintenanceInteraction?.playerId ?? newYearPlayerId,
            payload: {
                interactionId: maintenanceInteraction?.id,
                optionId: 'auto-pay',
                mergedValue: { attritionPriority: 'lowest-level' },
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('new-year-attrition');
        expect((state.core as any).lastSeasonSummary?.title).toBe('新年结算');
    });

    it('朝鲜与地图特例教程会从真实新年入口开始，并在维护后看到朝鲜耗损结果', () => {
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['korea-and-special-map-rules']?.manifest;
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
        expect((state.core as any).lastSeasonSummary?.mapResult).toMatchObject({
            regionId: 'city-region-29',
            troopDelta: -1,
            beforeTroops: 1,
            afterTroops: 0,
        });

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('shanhaiguan');
    });
});
