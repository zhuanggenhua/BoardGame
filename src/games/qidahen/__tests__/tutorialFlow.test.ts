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
import { QIDAHEN_COMMANDS } from '../domain/commands';
import QIDAHEN_TUTORIALS from '../tutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { QidahenDomain } from '../domain';
import { createQidahenInteractionSystem } from '../domain/interactionSystem';

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
    expect(result.success).toBe(true);
    return result.state;
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
            'wheel-reclaim',
            'wheel-military-farm',
            'wheel-recruit-train',
            'armament-upgrade',
            'event-action',
            'diplomacy-and-hire',
        ]);
        expect(collectNextTutorialChain('attack-and-battle')).toEqual([
            'retreat-and-rout',
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
            'wheel-move',
            'pick-action',
            'pay-cards',
        ]));
        expect(stepIdsOf('attack-and-battle')).toEqual(expect.arrayContaining([
            'move-entry',
            'tactic-window',
            'battle-damage',
            'retreat-and-defeat',
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

    it('基础教程会先把轮盘真实选择作为首回合的第一个主操作，再进入手牌行动', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['basic-opening']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('basic-opening');

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

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('wheel-first');

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
    });

    it('进攻与野战教程在真实点选进攻目标后会先进入边界说明，再进入战斗阶段', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['attack-and-battle']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('attack-and-battle');

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
        expect(state.sys.tutorial.step?.id).toBe('move-entry');
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');
        expect((state.core as any).pendingTargetAction).toBeNull();

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: 'qidahen-dispatch-targeting-ming-city-region-16',
                optionId: 'city-region-14',
                choiceId: 'city-region-14',
            },
        });

        expect((state.core as any).turnPhase).toBe('resolve-pending');
        expect((state.core as any).pendingTargetAction?.targetRegionId).toBe('city-region-14');
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
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: 'qidahen-dispatch-targeting-ming-city-region-16',
                optionId: 'city-region-14',
                choiceId: 'city-region-14',
            },
        });
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

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-damage');

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
        const mingArmamentCard = (state.core as any).handCards.find((card: any) => card.cardDefId === 'tutorial-ming-artillery-tech-upgrade');
        expect(mingArmamentCard?.cardKind).toBe('armament');

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
        const mongolEventCard = (state.core as any).handCards.find((card: any) => card.cardDefId === 'tutorial-mongol-khan-edict-event');
        expect(mongolEventCard?.cardKind).toBe('event');

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
        expect((state.core as any).selectedRegionId).toBe('city-region-24');

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
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('remove-mark');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('hire-only');
        expect((state.core as any).diplomacyProgress?.resolvedSteps).toHaveLength(1);

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'hire-only',
                choiceId: 'hire-only',
            },
        });

        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘外交/雇佣');
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('攻城教程会从城战待结算入口开始，并在结算后推进到围城选择', () => {
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
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('city');
        expect((state.core as any).pendingTargetAction?.title).toContain('城战待结算');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('city-battle');

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

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('besiege-choice');
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
