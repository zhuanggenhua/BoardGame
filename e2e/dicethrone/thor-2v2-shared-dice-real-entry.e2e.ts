import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    dragDiceThroneHandCardToPlay,
    readyMultiplePlayersAndStartGame,
    selectCharacter,
    setupDTOnlineMatchWithPlayers,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { expectDiceHintSurface, shot } from '../helpers/dicethroneThorEvidence';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { areTeammates } from '../../src/games/dicethrone/domain/rollContextPolicy';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupDTOnlineMatchWithPlayers>>>;
type RerollPhase = 'offensiveRoll' | 'defensiveRoll';

const CARD_WORTHY_OF_ME = 'card-worthy-of-me';
const CARD_I_CAN_AGAIN = 'card-i-can-again';
const CARD_JUST_THIS = 'card-just-this';
const CARD_NEXT_TIME = 'card-next-time';
const TEAM_HEROES = ['thor', 'monk', 'treant', 'paladin'];

const isRecord = (value: unknown): value is JsonRecord => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const asRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const asRecords = (value: unknown): JsonRecord[] => (
    Array.isArray(value) ? value.filter(isRecord) : []
);

const getRoot = (state: JsonRecord): JsonRecord => asRecord(state.G ?? state);

const moveActualCardToHand = (players: JsonRecord, targetPlayerId: string, cardId: string) => {
    const target = asRecord(players[targetPlayerId]);
    for (const zone of ['hand', 'deck', 'discard']) {
        const cards = asRecords(target[zone]);
        const index = cards.findIndex(card => card.id === cardId);
        if (index >= 0) {
            const [card] = cards.splice(index, 1);
            target[zone] = cards;
            target.hand = [...asRecords(target.hand), card];
            players[targetPlayerId] = target;
            return;
        }
    }

    for (const [sourcePlayerId, rawPlayer] of Object.entries(players)) {
        if (sourcePlayerId === targetPlayerId) continue;
        const source = asRecord(rawPlayer);
        for (const zone of ['hand', 'deck', 'discard']) {
            const cards = asRecords(source[zone]);
            const index = cards.findIndex(card => card.id === cardId);
            if (index < 0) continue;
            const [card] = cards.splice(index, 1);
            source[zone] = cards;
            players[sourcePlayerId] = source;
            target.hand = [...asRecords(target.hand), card];
            players[targetPlayerId] = target;
            return;
        }
    }

    throw new Error(`四人线上对局没有真实卡牌对象可供转移：${cardId}`);
};

const keepOnlyCardInTestHand = (players: JsonRecord, playerId: string, cardId: string) => {
    const player = asRecord(players[playerId]);
    const hand = asRecords(player.hand);
    const kept = hand.filter(card => card.id === cardId);
    const returnedToDeck = hand.filter(card => card.id !== cardId);
    player.hand = kept;
    player.deck = [...asRecords(player.deck), ...returnedToDeck];
    players[playerId] = player;
};

const makeThorDice = (values: number[], ownerId: string) => values.map((value, index) => ({
    id: index,
    value,
    symbol: 'hammer',
    symbols: ['hammer'],
    isKept: false,
    definitionId: 'thor-dice',
    ownerId,
}));

const readOnlineRoot = async (match: MatchSetup, page: Page = match.hostPage) => {
    const state = await getMatchState(match.matchId, page) as unknown as JsonRecord;
    return getRoot(state);
};

const continueAttackShowcaseIfVisible = async (page: Page) => {
    const showcase = page.getByTestId('attack-showcase-overlay');
    if (!(await showcase.isVisible({ timeout: 1000 }).catch(() => false))) return;
    const continueButton = showcase.getByRole('button', { name: /^(开始防御|继续|Start Defense|Continue)$/i }).first();
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    await expect(showcase).toBeHidden({ timeout: 10000 });
};

const injectRerollStart = async (
    match: MatchSetup,
    input: { cardId: string; phase: RerollPhase; values?: number[] },
) => {
    const stored = await getMatchState(match.matchId, match.hostPage) as unknown as JsonRecord;
    const state = structuredClone(stored);
    const root = getRoot(state);
    const currentCore = asRecord(root.core);
    const players = asRecord(currentCore.players);
    moveActualCardToHand(players, '2', input.cardId);
    for (const playerId of Object.keys(players)) {
        if (playerId === '2') continue;
        const player = asRecord(players[playerId]);
        player.deck = [...asRecords(player.deck), ...asRecords(player.hand)];
        player.hand = [];
        players[playerId] = player;
    }
    keepOnlyCardInTestHand(players, '2', input.cardId);
    const teammate = asRecord(players['2']);
    teammate.resources = { ...asRecord(teammate.resources), cp: 5 };
    players['2'] = teammate;
    const ownerId = '0';
    const activePlayerId = input.phase === 'defensiveRoll' ? '1' : '0';
    const dice = makeThorDice(input.values ?? [1, 2, 3, 4, 5], ownerId);
    const pendingAttack = input.phase === 'defensiveRoll'
        ? {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'fist-technique-5',
            damage: 8,
            bonusDamage: 0,
            isDefendable: true,
            preDefenseResolved: true,
            offensiveRollEndTokenResolved: true,
        }
        : null;
    const nextCore = {
        ...currentCore,
        players,
        activePlayerId,
        phase: input.phase,
        turnPhase: input.phase,
        rollCount: 1,
        rollConfirmed: false,
        rollDiceCount: dice.length,
        dice,
        pendingAttack,
        pendingDamage: undefined,
        currentRollContext: createMainRollContext({
            ...currentCore,
            players,
            activePlayerId,
            phase: input.phase,
            turnPhase: input.phase,
            rollCount: 1,
            rollConfirmed: false,
            rollDiceCount: dice.length,
            dice,
            pendingAttack,
        } as DiceThroneCore, { phase: input.phase, ownerPlayerId: ownerId, dice }),
    };
    const sys = asRecord(root.sys);
    const responseWindow = asRecord(sys.responseWindow);
    const turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder.map(String) : Object.keys(players);
    root.core = nextCore;
    root.sys = {
        ...sys,
        phase: input.phase,
        turnOrder,
        currentPlayerIndex: Math.max(0, turnOrder.findIndex(playerId => String(playerId) === activePlayerId)),
        interaction: { ...asRecord(sys.interaction), current: undefined, queue: [] },
        responseWindow: { ...responseWindow, current: undefined },
    };
    await injectMatchState(match.matchId, state as never, match.hostPage);
};

const injectDamageResponseStart = async (match: MatchSetup) => {
    const stored = await getMatchState(match.matchId, match.hostPage) as unknown as JsonRecord;
    const state = structuredClone(stored);
    const root = getRoot(state);
    const currentCore = asRecord(root.core);
    const players = asRecord(currentCore.players);
    moveActualCardToHand(players, '2', CARD_NEXT_TIME);
    for (const playerId of Object.keys(players)) {
        const player = asRecord(players[playerId]);
        if (playerId !== '2') {
            player.deck = [...asRecords(player.deck), ...asRecords(player.hand)];
            player.hand = [];
        }
        player.resources = {
            ...asRecord(player.resources),
            ...(playerId === '0' ? { hp: 50 } : {}),
            ...(playerId === '2' ? { cp: 5 } : {}),
        };
        players[playerId] = player;
    }
    keepOnlyCardInTestHand(players, '2', CARD_NEXT_TIME);
    const dice = makeThorDice([1, 2, 3, 4, 5], '0');
    const pendingDamageId = 'thor-2v2-next-time-damage';
    const pendingAttack = {
        attackerId: '1',
        defenderId: '0',
        sourceAbilityId: 'fist-technique-5',
        damage: 8,
        bonusDamage: 0,
        isDefendable: false,
        preDefenseResolved: true,
        offensiveRollEndTokenResolved: true,
        settlementStage: 'preDamage',
    };
    const diceThroneCore = {
        ...currentCore,
        players,
        activePlayerId: '1',
        phase: 'defensiveRoll',
        turnPhase: 'defensiveRoll',
        rollCount: 1,
        rollConfirmed: true,
        rollDiceCount: dice.length,
        dice,
        pendingAttack,
        pendingDamage: {
            id: pendingDamageId,
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 8,
            currentDamage: 8,
            sourceAbilityId: 'fist-technique-5',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        },
        currentRollContext: createMainRollContext({
            ...currentCore,
            players,
            activePlayerId: '1',
            phase: 'defensiveRoll',
            turnPhase: 'defensiveRoll',
            rollCount: 1,
            rollConfirmed: true,
            rollDiceCount: dice.length,
            dice,
            pendingAttack,
        } as DiceThroneCore, { phase: 'defensiveRoll', ownerPlayerId: '0', dice }),
    };
    const sys = asRecord(root.sys);
    const turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder.map(String) : Object.keys(players);
    root.core = diceThroneCore;
    root.sys = {
        ...sys,
        phase: 'defensiveRoll',
        turnOrder,
        currentPlayerIndex: Math.max(0, turnOrder.findIndex(playerId => String(playerId) === '1')),
        interaction: {
            ...asRecord(sys.interaction),
            current: {
                id: `dt-token-response-${pendingDamageId}`,
                kind: 'dt:token-response',
                playerId: '0',
                data: { pendingDamageId },
            },
            queue: [],
        },
        responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
    };
    await injectMatchState(match.matchId, state as never, match.hostPage);
};

const playRerollCardAsTeammate = async (
    match: MatchSetup,
    info: TestInfo,
    input: { cardId: string; phase: RerollPhase; label: string; repeatedDie: boolean; cpCost: number },
) => {
    await injectRerollStart(match, input);
    const thorPage = match.players[0]!.page;
    const teammatePage = match.players[2]!.page;
    const initialRoot = await readOnlineRoot(match);
    const initialEvents = asRecords(asRecord(asRecord(initialRoot.sys).eventStream).entries);
    const initialEventIds = new Set(initialEvents.map(event => String(event.id)));
    await expect.poll(async () => {
        const root = await readOnlineRoot(match);
        return asRecord(asRecord(root.core).currentRollContext).ownerPlayerId;
    }).toBe('0');
    if (input.phase === 'defensiveRoll') {
        const attackShowcase = teammatePage.getByTestId('attack-showcase-overlay');
        await expect(attackShowcase).toBeVisible();
        await continueAttackShowcaseIfVisible(teammatePage);
    }
    await shot(teammatePage, info, `${input.label}-队友持有真实卡牌与掷骰归属可见`);

    await dragDiceThroneHandCardToPlay(teammatePage, input.cardId);
    await expect.poll(async () => {
        const root = await readOnlineRoot(match);
        const interaction = asRecord(asRecord(asRecord(root.sys).interaction).current);
        const core = asRecord(root.core);
        const cardOwner = asRecord(asRecord(core.players)['2']);
        const interactionData = asRecord(interaction.data);
        return {
            kind: interaction.kind,
            playerId: interaction.playerId,
            sourceId: interactionData.sourceId,
            allowedDieIds: interactionData.allowedDieIds,
            cp: asRecord(cardOwner.resources).cp,
            cardInDiscard: asRecords(cardOwner.discard).some(card => card.id === input.cardId),
            cardInHand: asRecords(cardOwner.hand).some(card => card.id === input.cardId),
            rollerDiceCount: asRecords(asRecord(core.currentRollContext).dice).length || asRecords(core.dice).length,
            rollerPlayerId: asRecord(asRecord(core.currentRollContext)).ownerPlayerId,
        };
    }).toMatchObject({
        kind: 'multistep-choice',
        playerId: '0',
        sourceId: input.cardId,
        allowedDieIds: [0, 1, 2, 3, 4],
        cp: 5 - input.cpCost,
        cardInDiscard: true,
        cardInHand: false,
        rollerDiceCount: 5,
        rollerPlayerId: '0',
    });
    if (input.phase === 'defensiveRoll') {
        const attackShowcase = thorPage.getByTestId('attack-showcase-overlay');
        await expect(attackShowcase).toBeVisible();
        await continueAttackShowcaseIfVisible(thorPage);
    }
    const hint = thorPage.getByTestId('dice-interaction-hint');
    await expect(hint).toBeVisible();
    await expectDiceHintSurface(thorPage, 'viewport');
    await expect(hint).toHaveText(input.repeatedDie ? '选择骰子（0/2）' : '选择骰子（0/5）');
    await expect(thorPage.locator('[data-testid^="die-button-"]')).toHaveCount(5);
    await expect(teammatePage.getByTestId('dice-interaction-hint')).toBeHidden();
    await expect(teammatePage.getByTestId('dice-interaction-confirm-button')).toBeHidden();
    await shot(thorPage, info, `${input.label}-队友出牌后索尔本人操作旧骰盘选骰`);

    if (input.repeatedDie) {
        await thorPage.locator('[data-testid="die-button-0"]').click();
        await expect(hint).toHaveText('选择骰子（1/2）');
        await thorPage.locator('[data-testid="die-button-0"]').click();
        await expect(thorPage.locator('[data-testid="die-button-0"]')).toHaveAttribute('data-selection-count', '2');
        await expect(hint).toHaveText('完成');
    } else {
        await thorPage.locator('[data-testid="die-button-0"]').click();
        await thorPage.locator('[data-testid="die-button-1"]').click();
        await expect(hint).toHaveText('选择骰子（2/5）');
    }
    await shot(thorPage, info, `${input.label}-原骰盘显示所选次数与强制操作提示`);
    await expect(thorPage.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
    await thorPage.getByTestId('dice-interaction-confirm-button').click();

    await expect.poll(async () => {
        const root = await readOnlineRoot(match);
        const interaction = asRecord(asRecord(asRecord(root.sys).interaction).current);
        const core = asRecord(root.core);
        const p2 = asRecord(asRecord(core.players)['2']);
        const rerolledDiceIds = asRecords(asRecord(asRecord(root.sys).eventStream).entries)
            .filter(entry => !initialEventIds.has(String(entry.id)))
            .map(entry => asRecord(entry.event))
            .filter(event => event.type === 'DIE_REROLLED')
            .map(event => asRecord(event.payload).dieId);
        return {
            interactionId: interaction?.id ?? null,
            sourceCardInDiscard: asRecords(p2.discard).some(card => card.id === input.cardId),
            cardStillInHand: asRecords(p2.hand).some(card => card.id === input.cardId),
            cp: asRecord(p2.resources).cp,
            diceCount: asRecords(asRecord(core.currentRollContext).dice).length || asRecords(core.dice).length,
            rerolledDiceIds,
        };
    }).toMatchObject({
        interactionId: null,
        sourceCardInDiscard: true,
        cardStillInHand: false,
        cp: 5 - input.cpCost,
        diceCount: 5,
        rerolledDiceIds: input.repeatedDie ? [0, 0] : [0, 1],
    });
    await shot(thorPage, info, `${input.label}-服务端记录对应骰子重掷并关闭选骰交互`);
};

test('索尔与队友通过真实2v2手牌入口复用选骰及伤害防护交互', async ({ browser, baseURL }, info) => {
    test.setTimeout(360000);
    await clearEvidenceScreenshotsForTest(info);
    const match = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 4,
        gameServerBaseURL: getGameServerBaseURL(),
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match || match.players.length !== 4) {
        if (match) await cleanupDTMatch(match);
        test.skip(true, '游戏服务器不可用或未能建立四人 DiceThrone 对局');
        return;
    }

    try {
        for (const [index, heroId] of TEAM_HEROES.entries()) {
            await selectCharacter(match.players[index]!.page, heroId);
        }
        await readyMultiplePlayersAndStartGame(match.hostPage, match.players.slice(1).map(player => player.page));
        await Promise.all(match.players.map(async player => {
            await waitForGameBoard(player.page);
            await waitForDiceThroneHarness(player.page);
            await player.page.setViewportSize({ width: 1920, height: 1080 });
            await closeDebugPanelIfOpen(player.page);
        }));

        const initialRoot = await readOnlineRoot(match);
        const initialCore = asRecord(initialRoot.core);
        const initialPlayers = asRecord(initialCore.players);
        expect(areTeammates(initialCore as DiceThroneCore, '0', '2'), '0号索尔与2号队友必须位于同一队').toBe(true);
        expect(asRecord(initialPlayers['0']).characterId).toBe('thor');
        expect(asRecord(initialPlayers['2']).characterId).toBe('treant');

        await playRerollCardAsTeammate(match, info, {
            cardId: CARD_WORTHY_OF_ME,
            phase: 'offensiveRoll',
            label: '01-不愧是我同骰两次',
            repeatedDie: true,
            cpCost: 1,
        });
        await playRerollCardAsTeammate(match, info, {
            cardId: CARD_I_CAN_AGAIN,
            phase: 'offensiveRoll',
            label: '02-我又行了任选两骰',
            repeatedDie: false,
            cpCost: 1,
        });
        await playRerollCardAsTeammate(match, info, {
            cardId: CARD_JUST_THIS,
            phase: 'defensiveRoll',
            label: '03-就这防御骰重掷',
            repeatedDie: false,
            cpCost: 0,
        });

        await injectDamageResponseStart(match);
        const thorPage = match.players[0]!.page;
        const teammatePage = match.players[2]!.page;
        await continueAttackShowcaseIfVisible(thorPage);
        await expect(thorPage.getByTestId('current-total-damage-badge')).toHaveAttribute('data-current-damage', '8');
        await expect.poll(async () => {
            const root = await readOnlineRoot(match);
            return asRecord(asRecord(root.core).pendingDamage).responderId;
        }).toBe('0');
        await expect.poll(async () => {
            const root = await readOnlineRoot(match);
            const core = asRecord(root.core);
            const players = asRecord(core.players);
            return {
                targetId: asRecord(core.pendingDamage).targetPlayerId,
                targetHp: asRecord(asRecord(players['0']).resources).hp,
                teammateCp: asRecord(asRecord(players['2']).resources).cp,
                teammateHasCard: asRecords(asRecord(players['2']).hand).some(card => card.id === CARD_NEXT_TIME),
            };
        }).toEqual({ targetId: '0', targetHp: 50, teammateCp: 5, teammateHasCard: true });
        await shot(thorPage, info, '04-下次一定触发前索尔本人处于八点受伤响应');

        await continueAttackShowcaseIfVisible(teammatePage);
        await dragDiceThroneHandCardToPlay(teammatePage, CARD_NEXT_TIME);
        await expect.poll(async () => {
            const root = await readOnlineRoot(match);
            const core = asRecord(root.core);
            const players = asRecord(core.players);
            const p0 = asRecord(players['0']);
            const p2 = asRecord(players['2']);
            return {
                hp: asRecord(p0.resources).hp,
                damage: asRecord(core.pendingDamage).currentDamage,
                shield: asRecords(p0.damageShields).some(shield => shield.sourceId === CARD_NEXT_TIME),
                cardInDiscard: asRecords(p2.discard).some(card => card.id === CARD_NEXT_TIME),
                cardInHand: asRecords(p2.hand).some(card => card.id === CARD_NEXT_TIME),
                cp: asRecord(p2.resources).cp,
            };
        }).toEqual({ hp: 50, damage: 2, shield: true, cardInDiscard: true, cardInHand: false, cp: 4 });
        await shot(thorPage, info, '05-队友打出下次一定后索尔待结算伤害从八降至二');

        const continueDamageButton = thorPage.getByTestId('dicethrone-response-pass-button');
        await expect(continueDamageButton).toBeEnabled();
        await continueDamageButton.click();
        await expect.poll(async () => {
            const root = await readOnlineRoot(match);
            const core = asRecord(root.core);
            const players = asRecord(core.players);
            const p0 = asRecord(players['0']);
            const p2 = asRecord(players['2']);
            const currentInteraction = asRecord(asRecord(asRecord(root.sys).interaction).current);
            return {
                hp: asRecord(p0.resources).hp,
                pendingDamage: core.pendingDamage ?? null,
                interactionKind: currentInteraction.kind ?? null,
                shieldCount: asRecords(p0.damageShields).length,
                cardInDiscard: asRecords(p2.discard).some(card => card.id === CARD_NEXT_TIME),
                cp: asRecord(p2.resources).cp,
            };
        }).toEqual({ hp: 48, pendingDamage: null, interactionKind: null, shieldCount: 0, cardInDiscard: true, cp: 4 });
        await shot(thorPage, info, '06-索尔确认继续受伤后只扣除剩余二点生命');
    } finally {
        await cleanupDTMatch(match);
    }
});
