import { describe, expect, it } from 'vitest';
import { applyPlayerViewToState, resolveNextLocalAiAction } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import manifest from '../manifest';
import { fantasyRealmsAiRuntime } from '../ai';
import { engineConfig } from '../game';
import { evaluateFantasyRealmsScore, FantasyRealmsDomain } from '../domain';
import type { FantasyRealmsCommand, FantasyRealmsCore } from '../domain';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../data/cards';

const random = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

const stateOf = (core: FantasyRealmsCore): MatchState<FantasyRealmsCore> => ({
    core,
    sys: {
        interaction: {
            current: null,
            queue: [],
        },
        responseWindow: null,
        actionLog: { entries: [] },
        undo: { snapshots: [], aiSeatIds: [] },
        rematch: { requests: {} },
        tutorial: null,
        eventStream: { entries: [] },
        gameover: null,
    } as any,
});

const byId = (cardId: string) => {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown card: ${cardId}`);
    }
    return { ...card };
};

const summarize = (hand: ReturnType<typeof byId>[], discardPile: ReturnType<typeof byId>[]) => {
    const evaluation = evaluateFantasyRealmsScore(hand, discardPile);
    return {
        score: evaluation.totalScore,
        scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
    };
};

const applyCommand = (core: FantasyRealmsCore, command: FantasyRealmsCommand) => {
    const events = FantasyRealmsDomain.execute(stateOf(core), command, random);
    return events.reduce((nextCore, event) => FantasyRealmsDomain.reduce(nextCore, event), core);
};

function createDiscardDecisionCore(): FantasyRealmsCore {
    const dragon = byId('beast-dragon');
    const rangers = byId('army-rangers');
    const warhorse = byId('beast-warhorse');
    const forest = byId('land-forest');
    const princess = byId('leader-princess');
    const shield = byId('artifact-shield-of-keth');
    const gem = byId('artifact-gem-of-order');
    const lightning = byId('flame-lightning');
    const hand = [dragon, rangers, warhorse, forest, princess, shield, gem, lightning];
    const discardPile: ReturnType<typeof byId>[] = [];
    const summary = summarize(hand, discardPile);

    return {
        playerIds: ['0', '1'],
        currentPlayer: '0',
        turn: 3,
        stage: 'discard',
        drawPile: [byId('weather-smoke'), byId('weather-rainstorm')],
        discardPile,
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand,
                ...summary,
            },
            '1': {
                id: '1',
                name: '玩家2',
                hand: [],
                ...summarize([], discardPile),
            },
        },
        focusCardId: dragon.id,
    };
}

function createDiscardTiebreakDecisionCore(): FantasyRealmsCore {
    const rangers = byId('army-rangers');
    const archers = byId('army-elven-archers');
    const infantry = byId('army-dwarvish-infantry');
    const cavalry = byId('army-light-cavalry');
    const knights = byId('army-celestial-knights');
    const protectionRune = byId('artifact-protection-rune');
    const book = byId('artifact-book-of-changes');
    const lightning = byId('flame-lightning');
    const hand = [rangers, archers, infantry, cavalry, knights, protectionRune, book, lightning];
    const discardPile: ReturnType<typeof byId>[] = [];
    const summary = summarize(hand, discardPile);

    return {
        playerIds: ['0', '1'],
        currentPlayer: '0',
        turn: 5,
        stage: 'discard',
        drawPile: [byId('weather-smoke'), byId('leader-king')],
        discardPile,
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand,
                ...summary,
            },
            '1': {
                id: '1',
                name: '玩家2',
                hand: [],
                ...summarize([], discardPile),
            },
        },
        focusCardId: rangers.id,
    };
}

function createDrawDecisionCore(): FantasyRealmsCore {
    const hydra = byId('beast-hydra');
    const warhorse = byId('beast-warhorse');
    const princess = byId('leader-princess');
    const shield = byId('artifact-shield-of-keth');
    const gem = byId('artifact-gem-of-order');
    const forest = byId('land-forest');
    const lightning = byId('flame-lightning');
    const swamp = byId('flood-swamp');
    const smoke = byId('weather-smoke');
    const hand = [hydra, warhorse, princess, shield, gem, forest, lightning];
    const discardPile = [swamp];
    const summary = summarize(hand, discardPile);

    return {
        playerIds: ['0', '1', '2'],
        currentPlayer: '0',
        turn: 2,
        stage: 'draw',
        drawPile: [smoke, byId('leader-king'), byId('leader-queen')],
        discardPile,
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand,
                ...summary,
            },
            '1': {
                id: '1',
                name: '玩家2',
                hand: [],
                ...summarize([], discardPile),
            },
            '2': {
                id: '2',
                name: '玩家3',
                hand: [],
                ...summarize([], discardPile),
            },
        },
        focusCardId: hydra.id,
    };
}

function createDuelFullHandTakeDiscardDecisionCore(): FantasyRealmsCore {
    const aiLongbow = byId('weapon-elven-longbow');
    const aiNecromancer = byId('wizard-necromancer');
    const aiBellTower = byId('land-bell-tower');
    const aiSword = byId('weapon-sword-of-keth');
    const aiMirage = byId('wild-mirage');
    const aiCollector = byId('wizard-collector');
    const aiRainstorm = byId('weather-rainstorm');
    const discardAir = byId('weather-air-elemental');
    const discardBook = byId('artifact-book-of-changes');
    const hostDragon = byId('beast-dragon');
    const hostRangers = byId('army-rangers');
    const hostForge = byId('flame-forge');
    const hostKing = byId('leader-king');
    const hostQueen = byId('leader-queen');
    const hostUnicorn = byId('beast-unicorn');
    const hostBellTower = byId('land-bell-tower');
    const worldTree = byId('artifact-world-tree');
    const warlockLord = byId('wizard-warlock-lord');
    const warship = byId('weapon-warship');

    const aiHand = [aiLongbow, aiNecromancer, aiBellTower, aiSword, aiMirage, aiCollector, aiRainstorm];
    const hostHand = [hostDragon, hostRangers, hostForge, hostKing, hostQueen, hostUnicorn, hostBellTower];
    const discardPile = [discardAir, discardBook];
    const summaryAi = summarize(aiHand, discardPile);
    const summaryHost = summarize(hostHand, discardPile);

    return {
        playerIds: ['0', '1'],
        currentPlayer: '1',
        turn: 4,
        stage: 'draw',
        drawPile: [worldTree, warlockLord, warship],
        discardPile,
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand: hostHand,
                ...summaryHost,
            },
            '1': {
                id: '1',
                name: '玩家2',
                hand: aiHand,
                ...summaryAi,
            },
        },
        focusCardId: discardAir.id,
    };
}

function createBlindDrawOrderInvariantCores() {
    const hand = [
        byId('wizard-elemental-enchantress'),
        byId('weapon-sword-of-keth'),
        byId('wizard-beastmaster'),
        byId('weather-smoke'),
        byId('flame-forge'),
        byId('artifact-protection-rune'),
        byId('land-underground-caverns'),
    ];
    const discardPile = [byId('army-celestial-knights')];
    const drawPileA = [
        byId('weather-whirlwind'),
        byId('land-earth-elemental'),
        byId('weather-air-elemental'),
        byId('weapon-warship'),
    ];
    const drawPileB = [
        byId('land-earth-elemental'),
        byId('weather-whirlwind'),
        byId('weather-air-elemental'),
        byId('weapon-warship'),
    ];
    const summaryPlayer = summarize(hand, discardPile);
    const baseCore: Omit<FantasyRealmsCore, 'drawPile'> = {
        playerIds: ['0', '1', '2'],
        currentPlayer: '0',
        turn: 2,
        stage: 'draw',
        discardPile,
        players: {
            '0': { id: '0', name: '玩家1', hand, ...summaryPlayer },
            '1': { id: '1', name: '玩家2', hand: [], ...summarize([], discardPile) },
            '2': { id: '2', name: '玩家3', hand: [], ...summarize([], discardPile) },
        },
        focusCardId: hand[0]!.id,
    };

    return [
        { ...baseCore, drawPile: drawPileA },
        { ...baseCore, drawPile: drawPileB },
    ] as const;
}

function createDuelBlindDrawOrderInvariantCores() {
    const hand = [
        byId('artifact-book-of-changes'),
        byId('flood-island'),
        byId('leader-king'),
        byId('wild-doppelganger'),
        byId('land-underground-caverns'),
    ];
    const discardPile = [byId('army-dwarvish-infantry')];
    const drawPileA = [
        byId('land-forest'),
        byId('beast-dragon'),
        byId('artifact-gem-of-order'),
        byId('beast-hydra'),
        byId('wild-mirage'),
    ];
    const drawPileB = [
        byId('land-forest'),
        byId('artifact-gem-of-order'),
        byId('beast-dragon'),
        byId('beast-hydra'),
        byId('wild-mirage'),
    ];
    const summaryPlayer = summarize(hand, discardPile);
    const baseCore: Omit<FantasyRealmsCore, 'drawPile'> = {
        playerIds: ['0', '1'],
        currentPlayer: '0',
        turn: 2,
        stage: 'draw',
        discardPile,
        players: {
            '0': { id: '0', name: '玩家1', hand, ...summaryPlayer },
            '1': { id: '1', name: '玩家2', hand: [], ...summarize([], discardPile) },
        },
        focusCardId: hand[0]!.id,
    };

    return [
        { ...baseCore, drawPile: drawPileA },
        { ...baseCore, drawPile: drawPileB },
    ] as const;
}

function createHiddenAllocationInvariantCores() {
    const viewerHand = [
        byId('weapon-elven-longbow'),
        byId('wizard-necromancer'),
        byId('land-bell-tower'),
        byId('weapon-sword-of-keth'),
        byId('wild-mirage'),
        byId('wizard-collector'),
        byId('weather-rainstorm'),
    ];
    const discardPile = [byId('weather-air-elemental')];
    const hiddenStrong = byId('artifact-book-of-changes');
    const hiddenWeak = byId('weapon-warship');
    const hiddenThird = byId('leader-king');
    const hiddenFourth = byId('leader-queen');
    const viewerSummary = summarize(viewerHand, discardPile);
    const baseCore: Omit<FantasyRealmsCore, 'drawPile' | 'players'> = {
        playerIds: ['0', '1'],
        currentPlayer: '0',
        turn: 4,
        stage: 'draw',
        discardPile,
        focusCardId: discardPile[0]!.id,
    };

    const coreA: FantasyRealmsCore = {
        ...baseCore,
        drawPile: [hiddenStrong, hiddenWeak, hiddenThird],
        players: {
            '0': { id: '0', name: '玩家1', hand: viewerHand, ...viewerSummary },
            '1': { id: '1', name: '玩家2', hand: [hiddenFourth], ...summarize([hiddenFourth], discardPile) },
        },
    };
    const coreB: FantasyRealmsCore = {
        ...baseCore,
        drawPile: [hiddenFourth, hiddenWeak, hiddenThird],
        players: {
            '0': { id: '0', name: '玩家1', hand: viewerHand, ...viewerSummary },
            '1': { id: '1', name: '玩家2', hand: [hiddenStrong], ...summarize([hiddenStrong], discardPile) },
        },
    };

    return [coreA, coreB] as const;
}

describe('FantasyRealms AI runtime', () => {
    it('manifest 已开启本地 AI', () => {
        expect(manifest.ai?.localAi).toBe(true);
    });

    it('draw 阶段会生成摸牌与公开弃牌拿牌动作', () => {
        const core = createDrawDecisionCore();
        const actions = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(core),
            playerId: '0',
        });

        expect(actions.map((action) => action.kind)).toEqual(['draw-deck', 'take-discard']);
        expect(actions[1]?.metadata).toMatchObject({
            cardId: 'flood-swamp',
        });
    });

    it('discard 阶段会为每张手牌生成一个弃牌动作', () => {
        const core = createDiscardDecisionCore();
        const actions = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(core),
            playerId: '0',
        });

        expect(actions).toHaveLength(8);
        expect(actions.every((action) => action.kind === 'discard-card')).toBe(true);
    });

    it('基线策略在 draw 阶段会优先拿能显著提高总分的公开弃牌', async () => {
        const core = createDrawDecisionCore();
        const actions = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(core),
            playerId: '0',
        });
        const decision = await fantasyRealmsAiRuntime.localPolicies?.baseline.decide({
            gameId: 'fantasyrealms',
            matchId: 'local:fantasyrealms-draw',
            playerId: '0',
            visibleState: stateOf(core),
            interaction: null,
            responseWindow: null,
            legalActions: actions,
            rulesVersion: null,
            decisionBudgetMs: 1000,
            source: 'local',
            difficulty: { level: 'normal' },
        });

        const selectedAction = actions.find((action) => action.actionId === decision?.actionId);
        expect(selectedAction?.kind).toBe('take-discard');
        expect(selectedAction?.metadata).toMatchObject({ cardId: 'flood-swamp' });
    });

    it('基线策略在 duel 满手代表态下会优先拿公开弃牌，而不是回退到摸牌', async () => {
        const core = createDuelFullHandTakeDiscardDecisionCore();
        const actions = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(core),
            playerId: '1',
        });
        const decision = await fantasyRealmsAiRuntime.localPolicies?.baseline.decide({
            gameId: 'fantasyrealms',
            matchId: 'local:fantasyrealms-duel-full-hand-take-discard',
            playerId: '1',
            visibleState: stateOf(core),
            interaction: null,
            responseWindow: null,
            legalActions: actions,
            rulesVersion: null,
            decisionBudgetMs: 1000,
            source: 'local',
            difficulty: { level: 'normal' },
        });

        const selectedAction = actions.find((action) => action.actionId === decision?.actionId);
        expect(selectedAction?.kind).toBe('take-discard');
        expect(selectedAction?.metadata).toMatchObject({ cardId: 'weather-air-elemental' });
    });

    it('draw 阶段不会因为多人局牌库顶牌顺序变化而改掉同一副剩余牌的决策', async () => {
        const [coreA, coreB] = createBlindDrawOrderInvariantCores();

        const actionsA = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(coreA),
            playerId: '0',
        });
        const actionsB = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(coreB),
            playerId: '0',
        });

        const decisionA = await fantasyRealmsAiRuntime.localPolicies?.baseline.decide({
            gameId: 'fantasyrealms',
            matchId: 'local:fantasyrealms-blind-draw-order-a',
            playerId: '0',
            visibleState: stateOf(coreA),
            interaction: null,
            responseWindow: null,
            legalActions: actionsA,
            rulesVersion: null,
            decisionBudgetMs: 1000,
            source: 'local',
            difficulty: { level: 'normal' },
        });
        const decisionB = await fantasyRealmsAiRuntime.localPolicies?.baseline.decide({
            gameId: 'fantasyrealms',
            matchId: 'local:fantasyrealms-blind-draw-order-b',
            playerId: '0',
            visibleState: stateOf(coreB),
            interaction: null,
            responseWindow: null,
            legalActions: actionsB,
            rulesVersion: null,
            decisionBudgetMs: 1000,
            source: 'local',
            difficulty: { level: 'normal' },
        });

        const selectedActionA = actionsA.find((action) => action.actionId === decisionA?.actionId);
        const selectedActionB = actionsB.find((action) => action.actionId === decisionB?.actionId);

        expect(selectedActionB?.kind).toBe(selectedActionA?.kind);
        expect(selectedActionB?.metadata?.cardId ?? null).toBe(selectedActionA?.metadata?.cardId ?? null);
    });

    it('duel 摸2弃1阶段也不会因为剩余牌顺序变化而偷看顶两张改决策', async () => {
        const [coreA, coreB] = createDuelBlindDrawOrderInvariantCores();

        const actionsA = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(coreA),
            playerId: '0',
        });
        const actionsB = fantasyRealmsAiRuntime.buildLegalActions({
            state: stateOf(coreB),
            playerId: '0',
        });

        const decisionA = await fantasyRealmsAiRuntime.localPolicies?.baseline.decide({
            gameId: 'fantasyrealms',
            matchId: 'local:fantasyrealms-duel-blind-draw-order-a',
            playerId: '0',
            visibleState: stateOf(coreA),
            interaction: null,
            responseWindow: null,
            legalActions: actionsA,
            rulesVersion: null,
            decisionBudgetMs: 1000,
            source: 'local',
            difficulty: { level: 'normal' },
        });
        const decisionB = await fantasyRealmsAiRuntime.localPolicies?.baseline.decide({
            gameId: 'fantasyrealms',
            matchId: 'local:fantasyrealms-duel-blind-draw-order-b',
            playerId: '0',
            visibleState: stateOf(coreB),
            interaction: null,
            responseWindow: null,
            legalActions: actionsB,
            rulesVersion: null,
            decisionBudgetMs: 1000,
            source: 'local',
            difficulty: { level: 'normal' },
        });

        const selectedActionA = actionsA.find((action) => action.actionId === decisionA?.actionId);
        const selectedActionB = actionsB.find((action) => action.actionId === decisionB?.actionId);

        expect(selectedActionB?.kind).toBe(selectedActionA?.kind);
        expect(selectedActionB?.metadata?.cardId ?? null).toBe(selectedActionA?.metadata?.cardId ?? null);
    });

    it('本地 AI 不会因为隐藏牌在牌库与对手手牌之间的分配差异而改掉同一可见局面的决策', async () => {
        const [coreA, coreB] = createHiddenAllocationInvariantCores();
        const visibleA = applyPlayerViewToState(engineConfig as any, stateOf(coreA), '0') as MatchState<FantasyRealmsCore>;
        const visibleB = applyPlayerViewToState(engineConfig as any, stateOf(coreB), '0') as MatchState<FantasyRealmsCore>;

        expect(visibleA.core.drawPile.map((card) => card.id)).toEqual(visibleB.core.drawPile.map((card) => card.id));
        expect(visibleA.core.players['1']?.hand.map((card) => card.id)).toEqual(visibleB.core.players['1']?.hand.map((card) => card.id));
        expect(visibleA.core.players['1']?.hand.every((card) => !OFFICIAL_FANTASY_REALMS_CARDS.some((entry) => entry.id === card.id))).toBe(true);

        const resolutionA = await resolveNextLocalAiAction({
            engineConfig,
            state: stateOf(coreA),
            matchId: 'local:fantasyrealms-hidden-allocation-a',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });
        const resolutionB = await resolveNextLocalAiAction({
            engineConfig,
            state: stateOf(coreB),
            matchId: 'local:fantasyrealms-hidden-allocation-b',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolutionB?.action.kind).toBe(resolutionA?.action.kind);
        expect((resolutionB?.action.metadata as { cardId?: string } | undefined)?.cardId ?? null)
            .toBe((resolutionA?.action.metadata as { cardId?: string } | undefined)?.cardId ?? null);
    });

    it('本地 AI runner 在 discard 阶段会给出真实可执行的弃牌命令', async () => {
        const core = createDiscardDecisionCore();

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: stateOf(core),
            matchId: 'local:fantasyrealms-discard',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.source).toBe('local-ai');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'DISCARD_CARD',
            payload: { cardId: 'beast-dragon' },
        });

        const nextCore = applyCommand(core, {
            type: 'DISCARD_CARD',
            playerId: '0',
            payload: { cardId: 'beast-dragon' },
        });
        const chosenScore = nextCore.players['0']?.score ?? Number.NEGATIVE_INFINITY;
        const alternativeScores = core.players['0']!.hand
            .filter((card) => card.id !== 'beast-dragon')
            .map((card) => applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: card.id },
            }).players['0']?.score ?? Number.NEGATIVE_INFINITY);
        expect(alternativeScores.every((score) => chosenScore >= score)).toBe(true);
    });

    it('discard 阶段若总分相同，会继续按正式 tiebreak 选择更优弃牌', async () => {
        const core = createDiscardTiebreakDecisionCore();

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: stateOf(core),
            matchId: 'local:fantasyrealms-discard-tiebreak',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'DISCARD_CARD',
            payload: { cardId: 'flame-lightning' },
        });

        const discardProtectionRune = evaluateFantasyRealmsScore(
            core.players['0']!.hand.filter((card) => card.id !== 'artifact-protection-rune'),
            [],
        );
        const discardLightning = evaluateFantasyRealmsScore(
            core.players['0']!.hand.filter((card) => card.id !== 'flame-lightning'),
            [],
        );

        expect(discardProtectionRune.totalScore).toBe(discardLightning.totalScore);
        expect(discardLightning.tiebreakBaseScore).toBeLessThan(discardProtectionRune.tiebreakBaseScore);
    });
});

