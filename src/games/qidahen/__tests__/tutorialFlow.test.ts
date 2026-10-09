import { readFileSync } from 'node:fs';
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
import {
    buildQidahenTutorialSetupData,
    QIDAHEN_TUTORIAL_SETUP_CONTRACTS,
} from '../tutorialSetup';
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
    it('教程设置按入口类型声明正式前因，不允许把代表态伪装成自然开局', () => {
        expect(QIDAHEN_TUTORIAL_SETUP_CONTRACTS['basic-opening']).toMatchObject({
            entryKind: 'natural-opening',
            startingPoint: 'formal-opening',
            formalEntryPhase: 'action-window',
            currentActorFaction: 'ming',
            precedingAtoms: ['setup-complete'],
            firstRealDecision: 'choose-wheel-move',
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
            const setup = buildQidahenTutorialSetupData(tutorialId);
            expect(setup?.setupData.qidahenTutorialContract, tutorialId).toEqual(contract);
            if (contract.entryKind !== 'natural-opening') {
                expect(contract.startingPoint, tutorialId).toBe('representative-state');
                expect(contract.injectedDifferences.length, tutorialId).toBeGreaterThan(0);
            }
        }
    });

    it('教程目录保留 6 个玩家主章节，隐藏专题独立入口且保留关键步骤合同', () => {
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
        expect(collectNextTutorialChain('attack-and-battle')).toEqual([]);
        expect(collectNextTutorialChain('wheel-shared-cost')).toEqual([]);
        expect(collectNextTutorialChain('siege-and-occupation')).toEqual([]);
        expect(collectNextTutorialChain('year-and-characters')).toEqual([]);
        expect(collectNextTutorialChain('korea-and-special-map-rules')).toEqual([]);
        expect(stepIdsOf('basic-opening')).toEqual([
            'welcome',
            'turn-flow',
            'wheel-first',
            'wheel-rule',
            'wheel-move',
            'wheel-branch-recovery',
            'wheel-result',
            'hand-action-order',
            'grant-pardon-rule',
            'pick-action',
            'pay-cards',
            'choose-grant-pardon-target',
            'choose-grant-pardon-source',
            'action-result',
            'finish',
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

    it('全教程结果步骤回到正式承接物，不再把结算摘要当教程主焦点', () => {
        const allSteps = Object.values(QIDAHEN_TUTORIALS.tutorials)
            .flatMap((tutorial) => tutorial.manifest.steps);
        expect(allSteps.some((step) => step.highlightTarget === 'qidahen-season-summary')).toBe(false);

        const directResultStepIds = new Set([
            'action-result',
            'battle-finish',
            'occupy-choice',
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
        const directResultSteps = allSteps.filter((step) => directResultStepIds.has(step.id));
        expect(directResultSteps.length).toBeGreaterThanOrEqual(13);
        expect(directResultSteps.every((step) => step.highlightTarget && step.highlightTarget !== 'qidahen-season-summary')).toBe(true);
        expect(directResultSteps.some((step) => step.highlightTarget === 'qidahen-map-result-feedback')).toBe(true);
        expect(directResultSteps.some((step) => step.highlightTarget === 'qidahen-player-float')).toBe(true);
    });

    it('教程卡避让正式承接区，不遮支付面板、玩家条和右侧动作区', () => {
        const allSteps = Object.values(QIDAHEN_TUTORIALS.tutorials)
            .flatMap((tutorial) => tutorial.manifest.steps);
        const hasSelector = (step: (typeof allSteps)[number], selector: string) =>
            step.avoidOverlapSelectors?.includes(selector) ?? false;

        expect(allSteps.filter((step) => step.id === 'pay-cards')
            .every((step) => hasSelector(step, '[data-testid="qidahen-action-payment-panel"]'))).toBe(true);
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
    });

    it('基础教程从正式开局进入轮盘推进，读取自动落点结算，再示范一次手牌行动', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['basic-opening']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('basic-opening');
        const initialMingHandCards = (state.core as any).handCards
            .filter((card: any) => card.faction === 'ming');
        const expectedAtlas05Cards = QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming.slice(0, 3).map((atlasIndex) => (
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
        expect(state.sys.tutorial.step?.id).toBe('turn-flow');
        expect((state.core as any).turnPhase).toBe('action-window');
        expect((state.core as any).wheelActionUsed).toBe(false);
        expect((state.core as any).factionActionUsed).toBe(false);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-first');
        expect((state.core as any).turnPhase).toBe('action-window');
        expect((state.core as any).handLimitDiscardSelection).toBeNull();
        expect((state.core as any).factions.ming.handCount)
            .toBeLessThanOrEqual((state.core as any).factions.ming.handLimit);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-rule');

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
        expect(state.sys.tutorial.step?.id).toBe('wheel-result');
        expect(state.sys.tutorial.step?.hideOverlay).toBeUndefined();
        expect((state.core as any).wheelActionUsed).toBe(true);
        expect((state.core as any).factionActionUsed).toBe(false);
        expect((state.core as any).actionWheelPosition).toBe('wheel-recruit-train');
        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘征兵/训练');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('hand-action-order');
        expect(state.sys.tutorial.step?.highlightTarget).toBe('qidahen-actions-zone');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('grant-pardon-rule');
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
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: paymentCardIds[0] },
        });
        expect((state.core as any).selectedPaymentCardIds).toEqual([paymentCardIds[0]]);
        for (const cardId of paymentCardIds) {
            if (cardId === paymentCardIds[0]) continue;
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
        expect((state.core as any).grantPardonSelection?.targetRegionId).toBeNull();
        expect((state.core as any).grantPardonSelection?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceRegionId: 'jinzhou',
                sourceFactionId: 'jin',
                targetRegionId: 'city-region-25',
                sourceTokenId: expect.any(String),
                sourcePieceId: expect.any(String),
            }),
        ]));
        expect(getPromptSummary(state).kind).toBe('simple-choice');
        expect(getPromptOptionIds(state)).toContain('region:city-region-25');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-grant-pardon-source');
        expect((state.core as any).grantPardonSelection?.targetRegionId).toBe('city-region-25');
        expect((state.core as any).grantPardonSelection?.opponentFactionId).toBe('jin');
        const jinPlayerId = (state.core as any).factions.jin.playerId as string;
        expect(state.sys.interaction?.current?.playerId).toBe(jinPlayerId);
        const sourceChoice = (state.core as any).grantPardonSelection?.choices.find((choice: any) => (
            choice.sourceRegionId === 'jinzhou'
            && choice.sourceFactionId === 'jin'
            && choice.targetRegionId === 'city-region-25'
        ));
        expect(sourceChoice).toBeDefined();
        expect(getPromptOptionIds(state)).toContain(sourceChoice.id);

        const selectedSourceToken = (state.core as any).mapTokens.find((token: any) => (
            token.type === 'army' && token.faction === 'jin' && token.regionId === 'jinzhou'
        ));
        expect(selectedSourceToken).toBeDefined();
        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: jinPlayerId,
            payload: { regionId: 'jinzhou', tokenId: selectedSourceToken.id },
        });
        expect(state.sys.tutorial.step?.id).toBe('action-result');
        expect(((state.core as any).actionLog ?? []).map((entry: any) => entry.text).join(' | ')).toContain('赐印招安');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step).toBeNull();
    });

    it('七大恨教程文案必须先解释规则结果，不能用实现词冒充教学', () => {
        const zh = JSON.parse(readFileSync('public/locales/zh-CN/game-qidahen.json', 'utf8')) as {
            tutorial: Record<string, unknown>;
        };
        const en = JSON.parse(readFileSync('public/locales/en/game-qidahen.json', 'utf8')) as {
            tutorial: Record<string, unknown>;
        };
        const zhTutorialText = JSON.stringify(zh.tutorial);
        const enTutorialText = JSON.stringify(en.tutorial);
        const basic = (zh.tutorial.basic as { steps: Record<string, string> }).steps;

        expect(basic.wheelFirst).toContain('3 张手牌');
        expect(basic.wheelFirst).toContain('15 张');
        expect(basic.wheelFirst).toContain('不需要弃牌');
        expect(basic.wheelRule).toContain('前进 1、2 或 3 格');
        expect(basic.wheelRule).toContain('三种走法都是合法选择');
        expect(basic.wheelRule).not.toContain('进入征兵训练');
        expect(basic.wheelMove).toBe('点击轮盘上高亮的“征兵训练”区域。');
        expect(zhTutorialText).not.toMatch(/免费走\s*1/);
        expect(enTutorialText).not.toContain('Move 1 for free');
        expect(enTutorialText).not.toContain('Move 1 for Free');
        const wheelActionPrompts = [
            (zh.tutorial as any).wheelSharedCost.steps.chooseMove,
            (zh.tutorial as any).wheelReclaim.steps.chooseMove,
            (zh.tutorial as any).wheelMilitaryFarm.steps.chooseMove,
            (zh.tutorial as any).wheelRecruitTrain.steps.chooseMove,
            (zh.tutorial as any).diplomacy.steps.wheelEntry,
            (zh.tutorial as any).yearAndCharacters.steps.advanceMidyear,
            (zh.tutorial as any).yearAndCharacters.steps.advanceNewYear,
        ] as string[];
        expect(wheelActionPrompts.every((text) => text.includes('点击轮盘') && text.includes('高亮'))).toBe(true);
        expect(wheelActionPrompts.every((text) => !/免费走\s*1/.test(text))).toBe(true);
        expect(enTutorialText).not.toMatch(/Move 1\s+for\s+free/i);
        expect(basic.wheelResult).toContain('正规军 2→4');
        expect(basic.wheelResult).not.toContain('查看地图');
        expect(basic.wheelResult).not.toContain('先看');
        const wheelRecruitTrainResult = (zh.tutorial as any).wheelRecruitTrain.steps.result as string;
        const englishWheelRecruitTrainResult = (en.tutorial as any).wheelRecruitTrain.steps.result as string;
        expect(wheelRecruitTrainResult).toContain('宣府正规军 2→4');
        expect(wheelRecruitTrainResult).toContain('炮兵 1→2 级');
        expect(wheelRecruitTrainResult).not.toContain('地图新增');
        expect(englishWheelRecruitTrainResult).toContain('Xuanfu regular troops increase from 2 to 4');
        expect(englishWheelRecruitTrainResult).toContain('artillery increases from level 1 to 2');
        expect(englishWheelRecruitTrainResult).not.toContain('look at the map');
        expect(basic.chooseGrantPardonTarget).toContain('点击地图上高亮的山海关');
        expect(basic.chooseGrantPardonSource).toContain('后金玩家亲自点击锦州');
        const manifest = QIDAHEN_TUTORIALS.tutorials['basic-opening']?.manifest;
        expect(manifest?.steps.find((step) => step.id === 'wheel-result')?.hideOverlay).toBeUndefined();
        expect(manifest?.steps.find((step) => step.id === 'wheel-branch-recovery')).toEqual(expect.objectContaining({
            hiddenAutomation: expect.objectContaining({
                kind: 'branch-recovery',
                recoveryStepId: 'wheel-move',
            }),
        }));
        expect(basic.turnFlow).toContain('顺序由玩家决定');
        expect(basic.turnFlow).not.toContain('示范路径');
        expect(basic.handActionOrder).toContain('手牌行动每回合选 1 项');
        expect(basic.handActionOrder).toContain('没有固定先后');
        expect(basic.handActionOrder).not.toContain('示例顺序不代表规则顺序');
        expect(basic.handActionOrder).toContain('突袭作战');
        expect(basic.handActionOrder).toContain('征召军队');
        expect(basic.handActionOrder).toContain('赐印招安');
        expect(basic.handActionOrder).toContain('驱虎吞狼');
        expect(basic.handActionOrder).not.toContain('弃 1');
        expect(basic.handActionOrder).not.toContain('弃 3');
        expect(basic.grantPardonRule).toContain('赐印招安：弃 3 张手牌');
        expect(basic.grantPardonRule).toContain('由被指定的玩家选择一支与大明控制区相邻的部队');
        expect(basic.pickAction).toBe('点击右侧的“赐印招安”行动。');
        expect(basic.actionResult).toContain('锦州部队 2→1');
        expect(basic.actionResult).toContain('山海关部队 2→3');
        expect(basic.actionResult).toContain('被选部队归大明');

        for (const text of [zhTutorialText, enTutorialText]) {
            expect(text).not.toContain('正式效果已经结算');
            expect(text).not.toContain('若画面仍有调度或其它选择');
            expect(text).not.toContain('按正式提示完成');
            expect(text).not.toContain('手牌资源换成了直接的版图控制');
            expect(text).not.toContain('formal result has resolved');
            expect(text).not.toContain('pending-resolution button');
            expect(text).not.toContain('another system gate');
            expect(text).not.toContain('点击“上一步”');
            expect(text).not.toContain('Click Previous');
            expect(text).not.toContain('本教程');
            expect(text).not.toContain('This tutorial');
            expect(text).not.toContain('本章示范');
            expect(text).not.toContain('This chapter demonstrates');
            expect(text).not.toContain('本示范');
            expect(text).not.toContain('This example');
            expect(text).not.toContain('当前路径');
            expect(text).not.toContain('current path');
            expect(text).not.toContain('示例固定');
            expect(text).not.toContain('example fixes');
            expect(text).not.toContain('路径结束');
            expect(text).not.toContain('path ends');
        }
        expect(zhTutorialText).not.toContain('结算摘要');
        expect(enTutorialText).not.toContain('resolution summary');
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
        expect(state.sys.tutorial.step?.id).toBe('post-battle-choice');

        const occupyChoiceId = (state.core as any).postBattleSelection?.choices
            ?.find((choice: any) => choice.mode === 'occupy')?.id;
        expect(occupyChoiceId).toBeTruthy();
        expect(getPromptOptionIds(state)).toContain(occupyChoiceId);
        state = respondToPrompt(state, '0', { optionId: occupyChoiceId });
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

    it('基础教程允许正式合法的走3分支，并由隐藏恢复机制回到轮盘选择', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['basic-opening']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('basic-opening');
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
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });

        expect(state.sys.tutorial.step?.id).toBe('wheel-move');
        expect(state.sys.tutorial.step?.allowedTargets).toBeUndefined();

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(state.sys.tutorial.step?.id).toBe('wheel-branch-recovery');
        expect((state.core as any).wheelActionUsed).toBe(true);
        expect((state.core as any).wheelMoveSummary).toBeTruthy();
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.PREVIOUS,
            playerId: '0',
            payload: { __tutorialAiCommand: true },
            skipValidation: true,
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-move');
        expect((state.core as any).wheelActionUsed).toBe(false);
        expect((state.core as any).actionWheelPosition).toBe('wheel-military-farm');
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
        expect(state.sys.tutorial.step?.hideOverlay).toBeUndefined();
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
