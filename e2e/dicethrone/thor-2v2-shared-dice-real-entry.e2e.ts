import type { Page, TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { test, expect } from '../framework';
import {
    createEvidenceScreenshotRun,
    promoteEvidenceScreenshotRun,
    type EvidenceScreenshotRun,
} from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    continueAttackShowcaseIfVisible,
    dragDiceThroneHandCardToPlay,
    readyMultiplePlayersAndStartGame,
    selectCharacter,
    setupDTOnlineMatchWithPlayers,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { expectDiceHintSurface, finalizeThorEvidenceSourceIdentity, shot, waitForCardSpotlightToClose, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';
import { createMainRollContext } from '../../src/games/dicethrone/domain/rollContext';
import { getDieFaceByDefinition } from '../../src/games/dicethrone/domain/rules';
import { areTeammates } from '../../src/games/dicethrone/domain/rollContextPolicy';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupDTOnlineMatchWithPlayers>>>;
type RerollPhase = 'offensiveRoll' | 'defensiveRoll';
type EvidenceAssertion = { name: string; actual: unknown; expected: unknown };
type EvidenceSnapshot = { visible: Record<string, unknown>; authoritative: Record<string, unknown> };
type EvidenceMedia = {
    path: string;
    stepId: string;
    description: string;
    transition: string;
    uiChange: 'layout' | 'panel' | 'interaction-mode' | 'target-highlight' | 'error' | 'empty' | 'animation-phase';
    uiChangeReason: string;
    viewportSize: string;
    sha256: string;
};
type ThorEvidenceCapture = {
    chainId: string;
    title: string;
    info: TestInfo;
    fixtureBoundary: Record<string, unknown>;
    run: EvidenceScreenshotRun;
    sourceRevision?: string;
    steps: Array<Record<string, unknown>>;
    media: EvidenceMedia[];
    pages: Set<Page>;
};

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

const asStrings = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

const getRoot = (state: JsonRecord): JsonRecord => asRecord(state.G ?? state);

const moveOwnActualCardToHand = (players: JsonRecord, playerId: string, cardId: string) => {
    const player = asRecord(players[playerId]);
    for (const zone of ['hand', 'deck', 'discard']) {
        const cards = asRecords(player[zone]);
        const index = cards.findIndex(card => card.id === cardId);
        if (index < 0) continue;
        const [card] = cards.splice(index, 1);
        player[zone] = cards;
        player.hand = [...asRecords(player.hand), card];
        players[playerId] = player;
        return;
    }
    throw new Error(`${playerId}号玩家的正式牌库中没有可转入手牌的真实卡牌：${cardId}`);
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

const makeMonkDice = (values: number[], ownerId: string) => values.map((value, index) => {
    const symbol = getDieFaceByDefinition('monk-dice', value);
    if (!symbol) throw new Error(`僧侣骰面未注册：value=${value}`);
    return {
        id: index,
        value,
        symbol,
        symbols: [symbol],
        isKept: false,
        definitionId: 'monk-dice',
        ownerId,
    };
});

const readOnlineRoot = async (match: MatchSetup, page: Page = match.hostPage) => {
    const state = await getMatchState(match.matchId, page) as unknown as JsonRecord;
    return getRoot(state);
};

const createThorEvidenceCapture = async (
    info: TestInfo,
    chainFolder: string,
    title: string,
    fixtureBoundary: Record<string, unknown>,
): Promise<ThorEvidenceCapture> => {
    const run = await createEvidenceScreenshotRun(info, {
        requireChineseName: true,
        subdir: chainFolder,
    });
    return {
        chainId: `${chainFolder}-${run.runId}`,
        title,
        info,
        fixtureBoundary,
        run,
        steps: [],
        media: [],
        pages: new Set<Page>(),
    };
};

const readThorEvidenceSnapshot = async (match: MatchSetup, page: Page): Promise<EvidenceSnapshot> => {
    const root = await readOnlineRoot(match, page);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const rollContext = asRecord(core.currentRollContext);
    const interaction = asRecord(asRecord(sys.interaction).current);
    const responseWindow = asRecord(asRecord(sys.responseWindow).current);
    const responderQueue = Array.isArray(responseWindow.responderQueue)
        ? responseWindow.responderQueue.map(String)
        : [];
    const currentResponderIndex = typeof responseWindow.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    const players = asRecord(core.players);
    const visible = await page.evaluate(() => {
        const selectors: Record<string, string> = {
            board: '[data-testid="dicethrone-board-root"]',
            hand: '[data-testid="hand-area"]',
            diceHint: '[data-testid="dice-interaction-hint"]',
            diceHintTitle: '[data-testid="dice-interaction-hint-title"]',
            diceConfirm: '[data-testid="dice-interaction-confirm-button"]',
            rollButton: '[data-tutorial-id="dice-roll-button"]',
            targetChoice: '[data-testid="dt-defender-choice-panel"]',
            damageBadge: '[data-testid="current-total-damage-badge"]',
            responsePass: '[data-testid="dicethrone-response-pass-button"]',
            spotlight: '[data-testid="card-spotlight-overlay"]',
            attackShowcase: '[data-testid="attack-showcase-overlay"]',
        };
        const visibleElement = (element: Element) => {
            const html = element as HTMLElement;
            const rect = html.getBoundingClientRect();
            const style = window.getComputedStyle(html);
            const visible = style.display !== 'none' && style.visibility !== 'hidden'
                && Number(style.opacity || 1) > 0.02 && rect.width > 0 && rect.height > 0;
            return {
                visible,
                text: visible ? (html.innerText || html.getAttribute('aria-label') || '').trim().slice(0, 240) : '',
                bounds: visible ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
                count: html.querySelectorAll('[data-testid^="die-button-"]').length,
            };
        };
        const elements = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
            const matches = Array.from(document.querySelectorAll(selector));
            return [key, matches.map(visibleElement)];
        }));
        return {
            url: location.pathname + location.search,
            viewport: { width: innerWidth, height: innerHeight },
            visibleText: (document.body.innerText || '').trim().slice(0, 1800),
            elements,
        };
    });
    const authoritative = {
        phase: sys.phase ?? core.phase ?? null,
        activePlayerId: core.activePlayerId ?? null,
        rollConfirmed: core.rollConfirmed ?? null,
        rollContext: {
            id: rollContext.id ?? null,
            kind: rollContext.kind ?? null,
            status: rollContext.status ?? null,
            phase: rollContext.phase ?? null,
            ownerPlayerId: rollContext.ownerPlayerId ?? null,
            dice: asRecords(rollContext.dice).map(die => ({ id: die.id ?? null, value: die.value ?? null, isKept: die.isKept ?? null })),
        },
        interaction: {
            id: interaction.id ?? null,
            kind: interaction.kind ?? null,
            playerId: interaction.playerId ?? null,
            sourceId: asRecord(interaction.data).sourceId ?? null,
        },
        responseWindow: {
            id: responseWindow.id ?? null,
            windowType: responseWindow.windowType ?? null,
            responderQueue,
            currentResponderIndex,
            currentResponderId: responderQueue[currentResponderIndex] ?? null,
            passedPlayers: Array.isArray(responseWindow.passedPlayers) ? responseWindow.passedPlayers.map(String) : [],
            pendingInteractionId: responseWindow.pendingInteractionId ?? null,
        },
        eventStream: asRecords(asRecord(sys.eventStream).entries).slice(-40).map(entry => {
            const event = asRecord(entry.event);
            const payload = asRecord(event.payload);
            return { id: entry.id ?? null, type: event.type ?? null, dieId: payload.dieId ?? null };
        }),
        pendingAttack: core.pendingAttack ?? null,
        pendingDamage: core.pendingDamage ?? null,
        players: Object.fromEntries(Object.entries(players).map(([playerId, playerValue]) => {
            const player = asRecord(playerValue);
            return [playerId, {
                characterId: player.characterId ?? null,
                hp: asRecord(player.resources).hp ?? null,
                cp: asRecord(player.resources).cp ?? null,
                hand: asRecords(player.hand).map(card => card.id),
                discard: asRecords(player.discard).map(card => card.id),
                shields: asRecords(player.damageShields).map(shield => ({ sourceId: shield.sourceId ?? null, value: shield.value ?? null })),
            }];
        })),
    };
    return { visible, authoritative };
};

const recordThorEvidenceStep = async (
    match: MatchSetup,
    capture: ThorEvidenceCapture,
    page: Page,
    id: string,
    action: string,
    runAction: () => Promise<void>,
    expected: Array<{ name: string; expected: unknown; read: (snapshot: EvidenceSnapshot) => unknown }>,
) => {
    const before = await readThorEvidenceSnapshot(match, page);
    await runAction();
    const after = await readThorEvidenceSnapshot(match, page);
    const assertions: EvidenceAssertion[] = expected.map(assertion => ({
        name: assertion.name,
        actual: assertion.read(after),
        expected: assertion.expected,
    }));
    for (const assertion of assertions) {
        expect(assertion.actual, `${id}: ${assertion.name}`).toEqual(assertion.expected);
    }
    capture.steps.push({
        id,
        action,
        before,
        after,
        assertions,
        browserContextId: `${match.matchId}:player-${new URL(page.url()).searchParams.get('playerID') ?? 'unknown'}`,
    });
    capture.pages.add(page);
    return after;
};

const captureThorEvidenceScreen = async (
    capture: ThorEvidenceCapture,
    page: Page,
    label: string,
    stepId: string,
    uiChange: EvidenceMedia['uiChange'],
    uiChangeReason: string,
    transition: string,
    options: NonNullable<Parameters<typeof shot>[3]> = {},
) => {
    const fileName = `${String(capture.media.length + 1).padStart(2, '0')}-合法代表态-${label}`;
    await shot(page, capture.info, fileName, { ...options, destinationDirectory: capture.run.stagingDir });
    const imagePath = join(capture.run.stagingDir, `${fileName}.png`);
    const sidecar = JSON.parse(await readFile(`${imagePath}.state.json`, 'utf8')) as JsonRecord;
    const viewport = asRecord(asRecord(sidecar.visible).viewport);
    const sourceRevision = typeof sidecar.sourceRevision === 'string' ? sidecar.sourceRevision : undefined;
    if (!sourceRevision) throw new Error(`Thor 截图缺少源码身份：${fileName}`);
    capture.sourceRevision = sourceRevision;
    capture.pages.add(page);
    capture.media.push({
        path: imagePath,
        stepId,
        description: label,
        transition,
        uiChange,
        uiChangeReason,
        viewportSize: `${viewport.width ?? 0}x${viewport.height ?? 0}`,
        sha256: createHash('sha256').update(await readFile(imagePath)).digest('hex'),
    });
};

const promoteThorEvidenceCapture = async (capture: ThorEvidenceCapture) => {
    if (!capture.sourceRevision || capture.media.length === 0 || capture.steps.length === 0) {
        throw new Error(`Thor 行为链证据不完整：${capture.chainId}`);
    }
    const trace = {
        gameId: 'dicethrone',
        evidenceCategory: 'independent',
        acceptanceMode: 'behavioral-chain',
        chainId: capture.chainId,
        sourceRun: capture.run.runId,
        sourceRevision: capture.sourceRevision,
        status: 'PASS',
        visualStatus: 'pending',
        outcome: capture.title,
        fixtureBoundary: capture.fixtureBoundary,
        steps: capture.steps,
        uiStates: capture.media.map((media, index) => ({
            id: `${capture.chainId}-ui-${index + 1}`,
            stepId: media.stepId,
            change: media.uiChange,
            viewport: 'desktop',
            viewportSize: media.viewportSize,
            sha256: media.sha256,
        })),
    };
    await writeFile(join(capture.run.stagingDir, `${capture.chainId}.trace.json`), `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
    await promoteEvidenceScreenshotRun(capture.run, {
        gameId: 'dicethrone',
        evidenceCategory: 'independent',
        capturePolicy: 'distinct-ui-state',
        media: capture.media.map((media, index) => ({
            path: relative(process.cwd(), join(capture.run.stableDir, relative(capture.run.stagingDir, media.path))).replace(/\\/g, '/'),
            chainId: capture.chainId,
            chainStep: index + 1,
            stage: '独特界面态',
            role: 'main-flow',
            viewport: 'desktop',
            viewportSize: media.viewportSize,
            transition: media.transition,
            description: media.description,
            uiStateId: `${capture.chainId}-ui-${index + 1}`,
            uiChange: media.uiChange,
            uiChangeReason: media.uiChangeReason,
            behaviorStepId: media.stepId,
            sourceRevision: capture.sourceRevision,
            requirements: [capture.title],
        })),
    });
};

const dismissCardSpotlightsForAllPlayers = async (match: MatchSetup) => {
    for (const [playerIndex, { page }] of match.players.entries()) {
        await continueAttackShowcaseIfVisible(page);
        const spotlight = page.getByTestId('card-spotlight-overlay');
        if (await spotlight.count() === 0) {
            await spotlight.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
        }
        if (await spotlight.isVisible().catch(() => false)) {
            const root = page.getByTestId('spotlight-container-root');
            await root.click({ position: { x: 15, y: 15 }, timeout: 5000 }).catch((error) => {
                throw new Error(`第 ${playerIndex} 位玩家的卡牌特写遮罩无法关闭：${String(error)}`);
            });
        }
        await expect(spotlight).toHaveCount(0, { timeout: 5000 });
    }
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
    moveOwnActualCardToHand(players, '2', input.cardId);
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

const injectNaturalAttackStart = async (match: MatchSetup) => {
    const stored = await getMatchState(match.matchId, match.hostPage) as unknown as JsonRecord;
    const state = structuredClone(stored);
    const root = getRoot(state);
    const currentCore = asRecord(root.core);
    const players = asRecord(currentCore.players);
    moveOwnActualCardToHand(players, '0', CARD_NEXT_TIME);
    moveOwnActualCardToHand(players, '2', CARD_NEXT_TIME);
    for (const playerId of Object.keys(players)) {
        const player = asRecord(players[playerId]);
        if (playerId !== '0' && playerId !== '2') {
            player.deck = [...asRecords(player.deck), ...asRecords(player.hand)];
            player.hand = [];
        }
        player.resources = {
            ...asRecord(player.resources),
            ...(playerId === '0' || playerId === '2' ? { hp: 50, cp: 5 } : {}),
        };
        players[playerId] = player;
    }
    keepOnlyCardInTestHand(players, '0', CARD_NEXT_TIME);
    keepOnlyCardInTestHand(players, '2', CARD_NEXT_TIME);
    const activePlayerId = '1';
    const dice = makeMonkDice([6, 6, 6, 6, 1], activePlayerId);
    const diceThroneCore = {
        ...currentCore,
        players,
        activePlayerId,
        phase: 'offensiveRoll',
        turnPhase: 'offensiveRoll',
        rollCount: 1,
        rollConfirmed: true,
        rollDiceCount: dice.length,
        dice,
        pendingAttack: null,
        pendingDamage: undefined,
        currentRollContext: createMainRollContext({
            ...currentCore,
            players,
            activePlayerId,
            phase: 'offensiveRoll',
            turnPhase: 'offensiveRoll',
            rollCount: 1,
            rollConfirmed: true,
            rollDiceCount: dice.length,
            dice,
            pendingAttack: null,
        } as DiceThroneCore, { phase: 'offensiveRoll', ownerPlayerId: activePlayerId, dice }),
    };
    const sys = asRecord(root.sys);
    const turnOrder = Array.isArray(sys.turnOrder) ? sys.turnOrder.map(String) : Object.keys(players);
    root.core = diceThroneCore;
    root.sys = {
        ...sys,
        phase: 'offensiveRoll',
        turnOrder,
        currentPlayerIndex: Math.max(0, turnOrder.findIndex(playerId => String(playerId) === activePlayerId)),
        interaction: {
            ...asRecord(sys.interaction),
            current: undefined,
            queue: [],
        },
        responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
        flowHalted: false,
    };
    await injectMatchState(match.matchId, state as never, match.hostPage);
};

const playRerollCardAsTeammate = async (
    match: MatchSetup,
    capture: ThorEvidenceCapture,
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
    const representativeStart = await readThorEvidenceSnapshot(match, teammatePage);
    capture.steps.push({
        id: 'representative-start',
        action: '从真实开局后注入的合法骰子与手牌代表态开始；不声称此前回合自然形成',
        before: representativeStart,
        after: representativeStart,
        assertions: [
            { name: 'roller-player', actual: asRecord(representativeStart.authoritative.rollContext).ownerPlayerId, expected: '0' },
            { name: 'current-phase', actual: representativeStart.authoritative.phase, expected: input.phase },
        ],
        browserContextId: `${match.matchId}:player-2`,
    });
    await captureThorEvidenceScreen(
        capture,
        teammatePage,
        `${input.label}-队友持有真实卡牌与掷骰归属可见`,
        'representative-start',
        'interaction-mode',
        '真实在线四人开局后进入已注明的合法代表态，队友手牌和索尔的五颗骰子均可见',
        '从真实牌桌开局进入本次预置的合法骰子与手牌前态',
    );

    await recordThorEvidenceStep(match, capture, teammatePage, 'play-shared-reroll-card', '队友从自己的正式手牌拖放共享重掷牌', async () => {
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
    }, [
        { name: 'choice-kind', expected: 'multistep-choice', read: snapshot => asRecord(snapshot.authoritative.interaction).kind },
        { name: 'choice-owner', expected: '0', read: snapshot => asRecord(snapshot.authoritative.interaction).playerId },
        { name: 'choice-source-card', expected: input.cardId, read: snapshot => asRecord(snapshot.authoritative.interaction).sourceId },
    ]);
    if (input.phase === 'defensiveRoll') {
        const attackShowcase = thorPage.getByTestId('attack-showcase-overlay');
        await expect(attackShowcase).toBeVisible();
        await continueAttackShowcaseIfVisible(thorPage);
    }
    const hint = thorPage.getByTestId('dice-interaction-hint');
    const hintTitle = thorPage.getByTestId('dice-interaction-hint-title');
    const hintDetail = thorPage.getByTestId('dice-interaction-hint-detail');
    await expect(hint).toBeVisible();
    await expectDiceHintSurface(thorPage, 'game-hints-top-center');
    await expect(hintTitle).toHaveText(input.repeatedDie ? '选择重投骰子（0/2）' : '选择重投骰子（0/5）');
    await expect(hintDetail).toHaveCount(0);
    await expect(thorPage.locator('[data-testid^="die-button-"]')).toHaveCount(5);
    await expect(teammatePage.getByTestId('dice-interaction-hint')).toBeHidden();
    await expect(teammatePage.getByTestId('dice-interaction-confirm-button')).toBeHidden();
    await expect(thorPage.getByTestId('card-spotlight-overlay')).toBeVisible();
    await expect(thorPage.getByTestId('card-spotlight-overlay')).toHaveAttribute('data-card-id', input.cardId);
    await captureThorEvidenceScreen(capture, thorPage, `${input.label}-队友出牌后的卡牌特写`, 'play-shared-reroll-card', 'panel', '队友真实打出卡牌后出现卡牌特写及索尔本人骰盘提示', '队友真实拖放卡牌后系统打开卡牌特写和索尔的骰盘选骰交互', {
        preservePointer: true,
        settleMs: 0,
        observeSourcesBeforeScreenshot: false,
        captureCardSpotlight: true,
    });
    await recordThorEvidenceStep(match, capture, thorPage, 'dismiss-card-spotlight', '索尔点击既有特写遮罩关闭卡牌阅读层', async () => {
        await thorPage.mouse.move(15, 15);
        await dismissCardSpotlightsForAllPlayers(match);
        await expect(thorPage.getByTestId('card-spotlight-overlay')).toHaveCount(0);
    }, [
        { name: 'card-spotlight-closed', expected: false, read: snapshot => asRecords(asRecord(snapshot.visible.elements).spotlight)[0]?.visible ?? false },
        { name: 'dice-hint-retained', expected: true, read: snapshot => asRecords(asRecord(snapshot.visible.elements).diceHint)[0]?.visible ?? false },
    ]);
    await expect(hint).toBeVisible();
    await captureThorEvidenceScreen(capture, thorPage, `${input.label}-队友出牌后索尔本人操作旧骰盘选骰`, 'dismiss-card-spotlight', 'interaction-mode', '卡牌特写退出后提示留在骰盘操作现场，索尔本人仍可选择骰子', '关闭阅读特写后回到原有骰盘选骰流程');

    await recordThorEvidenceStep(match, capture, thorPage, 'select-reroll-dice', '索尔直接点击原骰盘骰子完成本卡要求的选择', async () => {
        if (input.repeatedDie) {
            await thorPage.locator('[data-testid="die-button-0"]').click();
            await expect(hintTitle).toHaveText('选择重投骰子（1/2）');
            await expect(hintDetail).toHaveCount(0);
            await thorPage.locator('[data-testid="die-button-0"]').click();
            await expect(thorPage.locator('[data-testid="die-button-0"]')).toHaveAttribute('data-selection-count', '2');
            await expect(hintTitle).toHaveText('选择重投骰子（2/2）');
        } else {
            await thorPage.locator('[data-testid="die-button-0"]').click();
            await thorPage.locator('[data-testid="die-button-1"]').click();
            await expect(hintTitle).toHaveText('选择重投骰子（2/5）');
        }
    }, [
        { name: 'visible-selection-progress', expected: input.repeatedDie ? '选择重投骰子（2/2）' : '选择重投骰子（2/5）', read: snapshot => asRecords(asRecord(snapshot.visible.elements).diceHintTitle)[0]?.text ?? null },
    ]);
    await captureThorEvidenceScreen(capture, thorPage, `${input.label}-原有进度提示和双按钮确认`, 'select-reroll-dice', 'target-highlight', '索尔直接点选骰子后，原有进度提示和确认入口同步更新', '原骰盘骰子本体被选中，提示表达当前已选数量');
    await expect(thorPage.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
    await expect(thorPage.getByTestId('dice-interaction-confirm-button')).toHaveText('确认');
    await recordThorEvidenceStep(match, capture, thorPage, 'confirm-reroll-dice', '索尔按原确认按钮提交并等待服务端骰子重掷事件', async () => {
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
        await waitForCardSpotlightToClose(thorPage);
    }, [
        { name: 'reroll-interaction-closed', expected: null, read: snapshot => asRecord(snapshot.authoritative.interaction).id },
        { name: 'card-consumed-to-discard', expected: true, read: snapshot => asStrings(asRecord(asRecord(snapshot.authoritative.players)['2']).discard).includes(input.cardId) },
        { name: 'rerolled-dice-ids', expected: input.repeatedDie ? [0, 0] : [0, 1], read: snapshot => asRecords(snapshot.authoritative.eventStream)
            .filter(event => !initialEventIds.has(String(asRecord(event).id)) && asRecord(event).type === 'DIE_REROLLED')
            .map(event => asRecord(event).dieId) },
    ]);
    await captureThorEvidenceScreen(capture, thorPage, `${input.label}-服务端记录对应骰子重掷并关闭选骰交互`, 'confirm-reroll-dice', 'interaction-mode', '确认后选骰提示退出，正式服务端事件记录本次重掷', '索尔确认后骰子重掷结算，原选骰界面收口');
};

test('索尔2v2合法代表态：真实入口复用选骰、随机目标与队友护盾', async ({ browser, baseURL }, info) => {
    test.setTimeout(540000);
    const match = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 4,
        gameServerBaseURL: getGameServerBaseURL(),
        skipImageGate: true,
        characterSelectionTimeout: 240000,
        sourceIdentityStartAtMatchRoute: true,
    });
    if (!match || match.players.length !== 4) {
        if (match) await cleanupDTMatch(match);
        test.skip(true, '游戏服务器不可用或未能建立四人 DiceThrone 对局');
        return;
    }

    const captures: ThorEvidenceCapture[] = [];
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

        const rerollCases = [
            {
                folder: '01-不愧是我同骰两次',
                cardId: CARD_WORTHY_OF_ME,
                phase: 'offensiveRoll' as const,
                label: '不愧是我同骰两次',
                repeatedDie: true,
                cpCost: 1,
            },
            {
                folder: '02-我又行了任选两骰',
                cardId: CARD_I_CAN_AGAIN,
                phase: 'offensiveRoll' as const,
                label: '我又行了任选两骰',
                repeatedDie: false,
                cpCost: 1,
            },
            {
                folder: '03-就这防御骰重掷',
                cardId: CARD_JUST_THIS,
                phase: 'defensiveRoll' as const,
                label: '就这防御骰重掷',
                repeatedDie: false,
                cpCost: 0,
            },
        ];
        for (const input of rerollCases) {
            const capture = await createThorEvidenceCapture(
                info,
                input.folder,
                '索尔队友共享重掷：' + input.label,
                {
                    entry: '真实在线四人对局后进入合法代表态',
                    preparedState: '使用队友本人正式卡库中的卡牌与索尔本人骰子；骰面和阶段为测试预置代表态',
                    playerAction: '队友拖放正式手牌，索尔沿用旧骰盘交互选择并确认',
                    randomControl: '本代表链只证明选骰合同，不控制或伪造服务端随机结果',
                },
            );
            captures.push(capture);
            await playRerollCardAsTeammate(match, capture, input);
        }

        const capture = await createThorEvidenceCapture(
            info,
            '04-真实目标骰与索尔队友护盾',
            '索尔2v2真实目标骰分支与队友护盾消费',
            {
                entry: '真实在线四人对局、真实僧侣能力槽和正式玩家投骰入口',
                preparedState: '对局开局后预置僧侣莲花掌可用骰面与两名友方各自牌库中的一张下次一定；此为合法代表态',
                randomControl: 'targetingRoll 由正式服务端随机源掷出，测试读取实际结果并处理自动目标或手选目标分支',
                playerAction: '僧侣点选莲花掌、掷目标骰；必要时按正式候选 UI 选索尔；索尔队友从本人手牌打出护盾并继续结算',
            },
        );
        captures.push(capture);
        await injectNaturalAttackStart(match);
        const attackerPage = match.players[1]!.page;
        const participantPages = match.players.map(player => player.page);
        await expect.poll(async () => {
            const root = await readOnlineRoot(match);
            const core = asRecord(root.core);
            return { phase: asRecord(root.sys).phase ?? core.phase, activePlayerId: core.activePlayerId, pendingAttack: core.pendingAttack ?? null, pendingDamage: core.pendingDamage ?? null };
        }).toEqual({ phase: 'offensiveRoll', activePlayerId: '1', pendingAttack: null, pendingDamage: null });

        const lotusPalmAbilitySlot = attackerPage.locator('[data-ability-slot="lightning"][data-resolved-ability-id="lotus-palm"][data-can-click="true"]');
        await expect(lotusPalmAbilitySlot).toBeVisible({ timeout: 10000 });
        await expect(lotusPalmAbilitySlot).toBeEnabled({ timeout: 10000 });
        const attackReady = await readThorEvidenceSnapshot(match, attackerPage);
        capture.steps.push({
            id: 'representative-attack-ready',
            action: '真实在线对局后进入已注明的莲花掌合法骰面代表态；不声称这些骰面由本链先前动作自然形成',
            before: attackReady,
            after: attackReady,
            assertions: [
                { name: 'active-attacker', actual: attackReady.authoritative.activePlayerId, expected: '1' },
                { name: 'attack-phase', actual: attackReady.authoritative.phase, expected: 'offensiveRoll' },
                { name: 'no-pending-attack', actual: attackReady.authoritative.pendingAttack, expected: null },
            ],
            browserContextId: match.matchId + ':player-1',
        });
        await captureThorEvidenceScreen(capture, attackerPage, '僧侣莲花掌合法骰面代表态与真实技能槽', 'representative-attack-ready', 'layout', '正式玩家板上的莲花掌技能槽可见，攻击骰来自已注明的代表态', '真实四人牌桌开局后进入本次合法代表态');

        await recordThorEvidenceStep(match, capture, attackerPage, 'select-lotus-palm', '僧侣在正式技能槽点击莲花掌发起攻击', async () => {
            await lotusPalmAbilitySlot.click({ timeout: 10000 });
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                const pendingAttack = asRecord(asRecord(root.core).pendingAttack);
                return { sourceAbilityId: pendingAttack.sourceAbilityId, attackerId: pendingAttack.attackerId };
            }).toEqual({ sourceAbilityId: 'lotus-palm', attackerId: '1' });
            for (const page of participantPages) await continueAttackShowcaseIfVisible(page);
        }, [
            { name: 'attack-source', expected: 'lotus-palm', read: snapshot => asRecord(snapshot.authoritative.pendingAttack).sourceAbilityId },
            { name: 'attack-owner', expected: '1', read: snapshot => asRecord(snapshot.authoritative.pendingAttack).attackerId },
            { name: 'attack-not-defendable', expected: false, read: snapshot => asRecord(snapshot.authoritative.pendingAttack).isDefendable },
        ]);
        await captureThorEvidenceScreen(capture, attackerPage, '僧侣真实点选莲花掌后待掷目标骰', 'select-lotus-palm', 'interaction-mode', '正式能力动作生成莲花掌攻击，目标骰仍待玩家投掷', '僧侣在自己的玩家板点击莲花掌');

        const advanceAttackButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceAttackButton).toBeEnabled({ timeout: 10000 });
        await recordThorEvidenceStep(match, capture, attackerPage, 'enter-targeting-roll', '僧侣推进莲花掌攻击到目标骰阶段', async () => {
            await advanceAttackButton.click();
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                return asRecord(root.sys).phase ?? asRecord(root.core).phase;
            }, { timeout: 10000 }).toBe('targetingRoll');
        }, [
            { name: 'targeting-roll-phase', expected: 'targetingRoll', read: snapshot => snapshot.authoritative.phase },
            { name: 'targeting-roll-actor', expected: '1', read: snapshot => snapshot.authoritative.activePlayerId },
            { name: 'formal-target-roll-button-visible', expected: true, read: snapshot => asRecords(asRecord(snapshot.visible.elements).rollButton)[0]?.visible ?? false },
        ]);
        await captureThorEvidenceScreen(capture, attackerPage, '莲花掌进入正式目标骰投掷界面', 'enter-targeting-roll', 'interaction-mode', '僧侣的正式掷骰按钮和目标骰阶段可见', '僧侣推进莲花掌攻击后系统进入目标骰阶段');

        const targetingRollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(targetingRollButton).toBeVisible({ timeout: 10000 });
        await expect(targetingRollButton).toBeEnabled({ timeout: 10000 });
        let targetRoll = 0;
        await recordThorEvidenceStep(match, capture, attackerPage, 'roll-natural-target-die', '僧侣点击正式目标骰按钮并读取服务端自然结果', async () => {
            await targetingRollButton.click();
            const targetingConfirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(targetingConfirmButton).toBeEnabled({ timeout: 10000 });
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                const rollContext = asRecord(asRecord(root.core).currentRollContext);
                const die = asRecords(rollContext.dice)[0];
                return typeof die?.value === 'number' ? die.value : null;
            }, { timeout: 15000 }).not.toBeNull();
            const root = await readOnlineRoot(match);
            const rollContext = asRecord(asRecord(root.core).currentRollContext);
            targetRoll = Number(asRecord(asRecords(rollContext.dice)[0]).value);
            expect(targetRoll).toBeGreaterThanOrEqual(1);
            expect(targetRoll).toBeLessThanOrEqual(6);
        }, [
            { name: 'targeting-roll-phase', expected: 'targetingRoll', read: snapshot => snapshot.authoritative.phase },
            { name: 'one-real-target-die-visible', expected: 1, read: snapshot => asRecords(asRecord(snapshot.authoritative.rollContext).dice).length },
        ]);
        const naturalRollStep = capture.steps.at(-1)!;
        (naturalRollStep.assertions as EvidenceAssertion[]).push({
            name: 'service-target-die-result-in-range',
            actual: targetRoll >= 1 && targetRoll <= 6,
            expected: true,
        });
        await captureThorEvidenceScreen(capture, attackerPage, '僧侣正式投掷得到真实随机目标骰点数', 'roll-natural-target-die', 'animation-phase', '目标骰结果由服务端实际随机源产生，点数在1至6之间', '僧侣在正式目标骰阶段点击掷骰');

        const targetingConfirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(targetingConfirmButton).toBeEnabled({ timeout: 10000 });
        await recordThorEvidenceStep(match, capture, attackerPage, 'confirm-natural-target-die', '僧侣确认本次服务端自然投出的目标骰结果', async () => {
            await targetingConfirmButton.click();
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                return asRecord(root.core).rollConfirmed;
            }, { timeout: 10000 }).toBe(true);
        }, [
            { name: 'targeting-roll-phase', expected: 'targetingRoll', read: snapshot => snapshot.authoritative.phase },
            { name: 'roll-confirmed', expected: true, read: snapshot => snapshot.authoritative.rollConfirmed },
            { name: 'confirmed-die-value', expected: targetRoll, read: snapshot => asRecords(asRecord(snapshot.authoritative.rollContext).dice)[0]?.value },
        ]);

        let rollResponsePasses = 0;
        let responseWindowRoot = await readOnlineRoot(match);
        let currentRollResponse = asRecord(asRecord(responseWindowRoot.sys).responseWindow);
        let currentRollResponseWindow = asRecord(currentRollResponse.current);
        if (currentRollResponseWindow.id) {
            expect(currentRollResponseWindow.windowType).toBe('afterRollConfirmed');
            const responseQueue = Array.isArray(currentRollResponseWindow.responderQueue)
                ? currentRollResponseWindow.responderQueue.map(String)
                : [];
            const responseIndex = typeof currentRollResponseWindow.currentResponderIndex === 'number'
                ? currentRollResponseWindow.currentResponderIndex
                : 0;
            const firstResponderId = responseQueue[responseIndex];
            expect(firstResponderId, '目标骰确认后的响应窗口必须有正式当前响应者').toBeTruthy();
            const firstResponderPage = match.players[Number(firstResponderId)]!.page;
            const responseSnapshot = await readThorEvidenceSnapshot(match, firstResponderPage);
            capture.steps.push({
                id: 'target-roll-response-window',
                action: '僧侣确认目标骰后，正式 afterRollConfirmed 响应窗口交给服务端队列中的当前玩家',
                before: responseSnapshot,
                after: responseSnapshot,
                assertions: [
                    { name: 'response-window-type', actual: asRecord(responseSnapshot.authoritative.responseWindow).windowType, expected: 'afterRollConfirmed' },
                    { name: 'current-responder', actual: asRecord(responseSnapshot.authoritative.responseWindow).currentResponderId, expected: firstResponderId },
                ],
                browserContextId: match.matchId + ':player-' + firstResponderId,
            });
            capture.pages.add(firstResponderPage);
            await expect(firstResponderPage.getByTestId('dicethrone-response-pass-button')).toBeVisible({ timeout: 10000 });
            await captureThorEvidenceScreen(capture, firstResponderPage, '自然目标骰确认后出现正式响应窗口', 'target-roll-response-window', 'panel', '服务端响应队列指定当前玩家，可真实响应或按原有按钮跳过', '僧侣确认本次服务端自然投出的目标骰');

            while (rollResponsePasses < 8) {
                responseWindowRoot = await readOnlineRoot(match);
                currentRollResponse = asRecord(asRecord(responseWindowRoot.sys).responseWindow);
                currentRollResponseWindow = asRecord(currentRollResponse.current);
                if (!currentRollResponseWindow.id) break;
                const queue = Array.isArray(currentRollResponseWindow.responderQueue)
                    ? currentRollResponseWindow.responderQueue.map(String)
                    : [];
                const index = typeof currentRollResponseWindow.currentResponderIndex === 'number'
                    ? currentRollResponseWindow.currentResponderIndex
                    : 0;
                const responderId = queue[index];
                if (!responderId) throw new Error('目标骰响应窗口缺少当前响应者');
                const responderPage = match.players[Number(responderId)]!.page;
                const responsePassButton = responderPage.getByTestId('dicethrone-response-pass-button');
                const windowId = String(currentRollResponseWindow.id);
                await expect(responsePassButton).toBeVisible({ timeout: 10000 });
                await expect(responsePassButton).toBeEnabled({ timeout: 10000 });
                const stepId = 'pass-target-roll-response-' + String(rollResponsePasses + 1).padStart(2, '0');
                await recordThorEvidenceStep(match, capture, responderPage, stepId, '响应队列中的' + responderId + '号玩家使用正式跳过按钮放弃本轮目标骰响应', async () => {
                    await responsePassButton.click();
                    await expect.poll(async () => {
                        const root = await readOnlineRoot(match);
                        const window = asRecord(asRecord(asRecord(root.sys).responseWindow).current);
                        const nextQueue = Array.isArray(window.responderQueue) ? window.responderQueue.map(String) : [];
                        const nextIndex = typeof window.currentResponderIndex === 'number' ? window.currentResponderIndex : 0;
                        return !window.id || String(window.id) !== windowId || nextQueue[nextIndex] !== responderId;
                    }, { timeout: 10000 }).toBe(true);
                }, [
                    { name: 'response-queue-advanced', expected: true, read: snapshot => {
                        const window = asRecord(snapshot.authoritative.responseWindow);
                        return window.id === null || window.id !== windowId || window.currentResponderId !== responderId;
                    } },
                ]);
                rollResponsePasses += 1;
            }
            responseWindowRoot = await readOnlineRoot(match);
            currentRollResponseWindow = asRecord(asRecord(responseWindowRoot.sys).responseWindow).current;
            expect(asRecord(currentRollResponseWindow).id, '目标骰确认后的响应窗口必须由当前队列自然收口').toBeFalsy();
            expect(asRecord(asRecord(responseWindowRoot.sys).interaction).current, '目标骰响应收口后不能遗留交互').toBeFalsy();
            await captureThorEvidenceScreen(capture, attackerPage, '所有目标骰响应者通过后回到确认目标界面', 'pass-target-roll-response-' + String(rollResponsePasses).padStart(2, '0'), 'interaction-mode', '响应窗口关闭，目标骰点数保留，原有确认目标按钮恢复可用', '当前响应者依次使用正式跳过按钮，服务端关闭 afterRollConfirmed 窗口');
        } else {
            await captureThorEvidenceScreen(capture, attackerPage, '僧侣确认自然目标骰后准备解析目标', 'confirm-natural-target-die', 'interaction-mode', '实际目标点数已确认，玩家仍需推进攻击解析', '僧侣点击原有目标骰确认按钮');
        }

        const advanceTargetingButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceTargetingButton).toBeEnabled({ timeout: 10000 });
        await recordThorEvidenceStep(match, capture, attackerPage, 'resolve-natural-target-choice', '僧侣推进真实随机目标结果；系统按目标骰决定自动目标或生成正式选人界面', async () => {
            await advanceTargetingButton.click();
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                const sys = asRecord(root.sys);
                const core = asRecord(root.core);
                const interaction = asRecord(asRecord(sys.interaction).current);
                const attack = asRecord(core.pendingAttack);
                return interaction.kind === 'dt:defender-choice' || typeof attack.defenderId === 'string';
            }, { timeout: 15000 }).toBe(true);
        }, [
            { name: 'target-resolution-started', expected: true, read: snapshot => asRecord(asRecord(snapshot.authoritative.interaction)).kind === 'dt:defender-choice' || typeof asRecord(snapshot.authoritative.pendingAttack).defenderId === 'string' },
        ]);

        let targetId: string;
        const targetingRoot = await readOnlineRoot(match);
        const targetingSys = asRecord(targetingRoot.sys);
        const targetingCore = asRecord(targetingRoot.core);
        const defenderChoice = asRecord(asRecord(targetingSys.interaction).current);
        if (defenderChoice.kind === 'dt:defender-choice') {
            expect([5, 6]).toContain(targetRoll);
            const chooserId = String(defenderChoice.playerId);
            const chooserPage = match.players[Number(chooserId)]!.page;
            await expect(chooserPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 10000 });
            await expect(chooserPage.getByTestId('dt-defender-choice-option-0')).toBeVisible();
            await expect(chooserPage.getByTestId('dt-defender-choice-option-2')).toBeVisible();
            await captureThorEvidenceScreen(capture, chooserPage, '自然结果进入正式目标候选界面', 'resolve-natural-target-choice', 'panel', '正式目标选择面板显示索尔与队友两个候选；本次代表链由玩家点选索尔', '服务端随机目标骰结果要求玩家选择受击目标');
            const selectThorOption = chooserPage.getByTestId('dt-defender-choice-option-0');
            await recordThorEvidenceStep(match, capture, chooserPage, 'choose-thor-as-target', '目标选择权持有者在正式候选界面点选索尔', async () => {
                await selectThorOption.click();
                await expect.poll(async () => {
                    const root = await readOnlineRoot(match);
                    const core = asRecord(root.core);
                    return asRecord(core.pendingAttack).defenderId ?? null;
                }, { timeout: 10000 }).toBe('0');
            }, [
                { name: 'defender-choice-closed', expected: true, read: snapshot => asRecord(asRecord(snapshot.authoritative.interaction)).kind !== 'dt:defender-choice' },
                { name: 'damage-response-takes-over', expected: 'dt:token-response', read: snapshot => asRecord(asRecord(snapshot.authoritative.interaction)).kind },
                { name: 'damage-responder-is-selected-target', expected: '0', read: snapshot => asRecord(asRecord(snapshot.authoritative.interaction)).playerId },
                { name: 'selected-defender', expected: '0', read: snapshot => asRecord(snapshot.authoritative.pendingAttack).defenderId },
            ]);
            targetId = '0';
        } else {
            const expectedAutoTarget = targetRoll <= 2 ? '0' : targetRoll <= 4 ? '2' : null;
            expect(expectedAutoTarget, '5或6点必须进入正式手选目标界面').not.toBeNull();
            targetId = String(asRecord(targetingCore.pendingAttack).defenderId ?? '');
            expect(targetId, '服务端自动目标必须符合实际目标骰规则').toBe(expectedAutoTarget);
            const selectionStep = capture.steps.at(-1)!;
            (selectionStep.assertions as EvidenceAssertion[]).push({
                name: 'auto-target-matches-natural-die',
                actual: targetId,
                expected: expectedAutoTarget,
            });
            await captureThorEvidenceScreen(capture, attackerPage, '自然目标骰自动锁定索尔或队友', 'resolve-natural-target-choice', 'target-highlight', '系统按本次真实目标骰结果自动确定合法受击者', '僧侣推进目标骰阶段后系统按正式规则解析自动目标');
        }

        const targetPage = match.players[Number(targetId)]!.page;
        const cardOwnerId = targetId === '0' ? '2' : '0';
        const teammatePage = match.players[Number(cardOwnerId)]!.page;
        await recordThorEvidenceStep(match, capture, targetPage, 'natural-attack-damage-window', '系統按正式攻击与目标规则生成莲花掌伤害响应窗口', async () => {
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                const core = asRecord(root.core);
                const pendingDamage = asRecord(core.pendingDamage);
                return {
                    targetId: pendingDamage.targetPlayerId ?? null,
                    sourceAbilityId: pendingDamage.sourceAbilityId ?? null,
                    damage: pendingDamage.currentDamage ?? null,
                    responderId: pendingDamage.responderId ?? null,
                };
            }, { timeout: 15000 }).toEqual({ targetId, sourceAbilityId: 'lotus-palm', damage: 5, responderId: targetId });
            await continueAttackShowcaseIfVisible(targetPage);
        }, [
            { name: 'damage-source', expected: 'lotus-palm', read: snapshot => asRecord(snapshot.authoritative.pendingDamage).sourceAbilityId },
            { name: 'damage-target', expected: targetId, read: snapshot => asRecord(snapshot.authoritative.pendingDamage).targetPlayerId },
            { name: 'damage-before-shield', expected: 5, read: snapshot => asRecord(snapshot.authoritative.pendingDamage).currentDamage },
            { name: 'target-hp-before-shield', expected: 50, read: snapshot => asRecord(asRecord(snapshot.authoritative.players)[targetId]).hp },
        ]);
        await expect.poll(async () => {
            const root = await readOnlineRoot(match);
            const core = asRecord(root.core);
            const pendingDamage = asRecord(core.pendingDamage);
            return {
                cardOwnerHasCard: asRecords(asRecord(asRecord(core.players)[cardOwnerId]).hand).some(card => card.id === CARD_NEXT_TIME),
                cardOwnerCp: asRecord(asRecord(asRecord(core.players)[cardOwnerId]).resources).cp,
                responderId: pendingDamage.responderId,
            };
        }).toEqual({ cardOwnerHasCard: true, cardOwnerCp: 5, responderId: targetId });
        await expect(targetPage.getByTestId('current-total-damage-badge')).toHaveAttribute('data-current-damage', '5');
        await captureThorEvidenceScreen(capture, targetPage, '莲花掌五点伤害到达索尔或队友的响应窗口', 'natural-attack-damage-window', 'interaction-mode', '同一受击目标、莲花掌来源、五点待结算伤害和队友正式护盾卡同时成立', '服务端自然投骰与目标规则结算后进入受击响应窗口');

        await recordThorEvidenceStep(match, capture, teammatePage, 'play-teammate-shield-card', '未受击的索尔队友先按原入口继续并关闭本视角攻击展示（若存在），再从自己的正式手牌拖放下次一定', async () => {
            await continueAttackShowcaseIfVisible(teammatePage);
            await dragDiceThroneHandCardToPlay(teammatePage, CARD_NEXT_TIME);
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                const core = asRecord(root.core);
                const players = asRecord(core.players);
                const target = asRecord(players[targetId]);
                const owner = asRecord(players[cardOwnerId]);
                return {
                    hp: asRecord(target.resources).hp,
                    damage: asRecord(core.pendingDamage).currentDamage,
                    shield: asRecords(target.damageShields).some(shield => shield.sourceId === CARD_NEXT_TIME),
                    cardInDiscard: asRecords(owner.discard).some(card => card.id === CARD_NEXT_TIME),
                    cardInHand: asRecords(owner.hand).some(card => card.id === CARD_NEXT_TIME),
                    cp: asRecord(owner.resources).cp,
                };
            }, { timeout: 15000 }).toEqual({ hp: 50, damage: 0, shield: true, cardInDiscard: true, cardInHand: false, cp: 4 });
            await expect(targetPage.getByTestId('card-spotlight-overlay')).toBeVisible({ timeout: 10000 });
            await expect(targetPage.getByTestId('card-spotlight-overlay')).toHaveAttribute('data-card-id', CARD_NEXT_TIME);
        }, [
            { name: 'damage-after-shield', expected: 0, read: snapshot => asRecord(snapshot.authoritative.pendingDamage).currentDamage },
            { name: 'target-hp-preserved', expected: 50, read: snapshot => asRecord(asRecord(snapshot.authoritative.players)[targetId]).hp },
            { name: 'target-shield-created', expected: true, read: snapshot => asRecords(asRecord(asRecord(snapshot.authoritative.players)[targetId]).shields).some(shield => asRecord(shield).sourceId === CARD_NEXT_TIME) },
            { name: 'owner-card-discarded', expected: true, read: snapshot => asStrings(asRecord(asRecord(snapshot.authoritative.players)[cardOwnerId]).discard).includes(CARD_NEXT_TIME) },
            { name: 'owner-cp-spent', expected: 4, read: snapshot => asRecord(asRecord(snapshot.authoritative.players)[cardOwnerId]).cp },
        ]);
        await captureThorEvidenceScreen(capture, targetPage, '队友打出下次一定后显示卡牌原文与伤害归零', 'play-teammate-shield-card', 'panel', '正式卡牌特写显示下次一定原文；同一受击目标的五点待结算伤害已降为零', '索尔的队友真实拖放本人手牌中的下次一定', {
            preservePointer: true,
            observeSourcesBeforeScreenshot: false,
            captureCardSpotlight: true,
        });
        await recordThorEvidenceStep(match, capture, targetPage, 'dismiss-shield-card-spotlight', '索尔关闭既有卡牌特写后回到受伤响应操作现场', async () => {
            await dismissCardSpotlightsForAllPlayers(match);
            await expect(targetPage.getByTestId('card-spotlight-overlay')).toHaveCount(0);
            await expect(targetPage.getByTestId('current-total-damage-badge')).toHaveAttribute('data-current-damage', '0');
        }, [
            { name: 'card-spotlight-closed', expected: false, read: snapshot => asRecords(asRecord(snapshot.visible.elements).spotlight)[0]?.visible ?? false },
            { name: 'zero-damage-remains', expected: 0, read: snapshot => asRecord(snapshot.authoritative.pendingDamage).currentDamage },
        ]);
        await captureThorEvidenceScreen(capture, targetPage, '退出卡牌特写后仍可从旧响应界面继续结算', 'dismiss-shield-card-spotlight', 'interaction-mode', '卡牌阅读层退出，原有响应按钮和零伤害状态仍在', '索尔点按既有特写遮罩关闭卡牌阅读层');

        const continueDamageButton = targetPage.getByTestId('dicethrone-response-pass-button');
        await expect(continueDamageButton).toBeEnabled();
        await recordThorEvidenceStep(match, capture, targetPage, 'continue-zero-damage-response', '受击者按原有继续按钮收口零伤害响应', async () => {
            await continueDamageButton.click();
            await expect.poll(async () => {
                const root = await readOnlineRoot(match);
                const core = asRecord(root.core);
                const target = asRecord(asRecord(core.players)[targetId]);
                const owner = asRecord(asRecord(core.players)[cardOwnerId]);
                const currentInteraction = asRecord(asRecord(asRecord(root.sys).interaction).current);
                return {
                    hp: asRecord(target.resources).hp,
                    pendingDamage: core.pendingDamage ?? null,
                    interactionKind: currentInteraction.kind ?? null,
                    shieldCount: asRecords(target.damageShields).length,
                    cardInDiscard: asRecords(owner.discard).some(card => card.id === CARD_NEXT_TIME),
                    cp: asRecord(owner.resources).cp,
                };
            }, { timeout: 15000 }).toEqual({ hp: 50, pendingDamage: null, interactionKind: null, shieldCount: 0, cardInDiscard: true, cp: 4 });
            await waitForDamageNumbersToSettle(targetPage);
            await continueAttackShowcaseIfVisible(targetPage);
        }, [
            { name: 'target-hp-remains-50', expected: 50, read: snapshot => asRecord(asRecord(snapshot.authoritative.players)[targetId]).hp },
            { name: 'damage-window-closed', expected: null, read: snapshot => snapshot.authoritative.pendingDamage },
            { name: 'shield-cleaned-after-response', expected: 0, read: snapshot => asRecords(asRecord(asRecord(snapshot.authoritative.players)[targetId]).shields).length },
            { name: 'teammate-card-consumed', expected: true, read: snapshot => asStrings(asRecord(asRecord(snapshot.authoritative.players)[cardOwnerId]).discard).includes(CARD_NEXT_TIME) },
        ]);
        await captureThorEvidenceScreen(capture, targetPage, '确认继续后五点伤害均被防止且索尔生命保持五十', 'continue-zero-damage-response', 'interaction-mode', '响应窗口收口，受击者生命仍为50，伤害未落地，队友卡牌已消耗', '受击者点击正式继续按钮，服务端结算并清理一次性护盾');

        const sourcePages = new Set<Page>();
        for (const evidence of captures) for (const page of evidence.pages) sourcePages.add(page);
        let finalSourceRevision: string | undefined;
        for (const page of sourcePages) {
            const revision = await finalizeThorEvidenceSourceIdentity(page);
            if (finalSourceRevision && revision !== finalSourceRevision) {
                throw new Error('同一 Thor 运行内收口源码身份不一致');
            }
            finalSourceRevision = revision;
        }
        if (!finalSourceRevision) throw new Error('Thor 证据没有可收口的浏览器源码身份');
        for (const evidence of captures) evidence.sourceRevision = finalSourceRevision;
        for (const evidence of captures) await promoteThorEvidenceCapture(evidence);
    } finally {
        await cleanupDTMatch(match);
    }
});
