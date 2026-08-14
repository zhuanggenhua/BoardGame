/**
 * DiceThrone 战术家 / 咒缚海盗新增英雄真实入口证据。
 *
 * 范围：真实在线双玩家选角与开局；手牌卡图只做开局后的状态注入视觉证据，不替代机制 L2 单测。
 */

import type { Browser, Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import '../../src/games/dicethrone/domain';
import {
    closeDebugPanelIfOpen,
    cleanupDTMatch,
    dispatchDiceThroneCommand,
    dispatchDiceThroneCommandWithTimeout,
    maybePassResponse,
    readyAndStartGame,
    readyMultiplePlayersAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    setupDTOnlineMatchWithPlayers,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import {
    CURSED_PIRATE_DICE_FACE_IDS,
    STATUS_IDS,
    TOKEN_IDS,
    ZHANSHUJIA_DICE_FACE_IDS,
} from '../../src/games/dicethrone/domain/ids';
import { getCharacterAbilitiesForFace } from '../../src/games/dicethrone/domain/characters';
import { CURSED_PIRATE_CARDS } from '../../src/games/dicethrone/heroes/cursed_pirate/cards';
import { ZHANSHUJIA_CARDS } from '../../src/games/dicethrone/heroes/zhanshujia/cards';
import {
    CARPET_BOMBING_2,
    COUNTERMEASURES_2,
    COUNTERMEASURES_3,
    DRUM_MOVEMENT_2,
    EXPAND_BATTLEFIELD_2,
    FLANKING_2,
    SABRE_THRUST_2,
    STRATEGIC_SHIFT_2,
    WAR_MONGER_2,
} from '../../src/games/dicethrone/heroes/zhanshujia/abilities';
import {
    expectRightTrayBonusDiceConfirmation,
    getRightTrayDiceTray,
    settleCurrentBonusDice,
} from './bonus-dice-flow';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;
type FourPlayerMatchSetup = NonNullable<Awaited<ReturnType<typeof setupDTOnlineMatchWithPlayers>>>;

const HOST_HERO_ID = 'zhanshujia';
const GUEST_HERO_ID = 'cursed_pirate';
const FOUR_PLAYER_HOST_HERO_ID = 'cursed_pirate';
const FOUR_PLAYER_ENEMY_FRONT_HERO_ID = 'zhanshujia';
const FOUR_PLAYER_ALLY_HERO_ID = 'monk';
const FOUR_PLAYER_ENEMY_CAPTAIN_HERO_ID = 'treant';
const HOST_CARD_ID = 'card-zhanshujia-war-room';
const GAIN_UPPER_HAND_CARD_ID = 'card-zhanshujia-gain-the-upper-hand';
const AMBUSH_CARD_ID = 'card-zhanshujia-ambush';
const GUEST_CARD_ID = 'card-cursed-pirate-pirates-life';
const COMMON_UNEXPECTED_CARD_ID = 'card-unexpected';
const WEIGH_ANCHOR_CARD_ID = 'card-cursed-pirate-weigh-anchor';
const CURSE_CARD_ID = 'card-cursed-pirate-curse-card';
const BATTEN_DOWN_CARD_ID = 'card-cursed-pirate-batten-down';
const SHARK_BAIT_CARD_ID = 'card-cursed-pirate-shark-bait';
const SCURVY_CARD_ID = 'card-cursed-pirate-scurvy';
const PILLAGE_CARD_ID = 'card-cursed-pirate-pillage';
const PARLEY_CARD_ID = 'card-cursed-pirate-parley';
const STRATEGIC_DEFENSE_CARD_ID = 'card-zhanshujia-strategic-defense';
const GO_FISH_CARD_ID = 'card-cursed-pirate-go-fish';
const GIVE_ME_SOME_CARD_ID = 'card-cursed-pirate-give-me-some';
const HAND_SELECTION_CARD_ID = 'card-zhanshujia-war-room';
const CROWS_NEST_CARD_ID = 'card-cursed-pirate-crows-nest';
const HEFTY_CARD_ID = 'card-cursed-pirate-hefty';
const BLUSTER_CARD_ID = 'card-cursed-pirate-bluster';
const FLAY_CARD_ID = 'card-cursed-pirate-flay';
const RANSOM_CARD_ID = 'card-cursed-pirate-ransom';
const SIP_CARD_ID = 'card-cursed-pirate-sip';
const DISENGAGE_CARD_ID = 'card-zhanshujia-disengage';
const TACTICAL_RETREAT_CARD_ID = 'card-zhanshujia-tactical-retreat';
const WAR_MONGER_2_UPGRADE_CARD_ID = 'upgrade-zhanshujia-war-monger-2';
const CHARACTER_SELECTION_TIMEOUT = 240000;
const ATTACK_DAMAGE_FOR_DEFENSE_EVIDENCE = 6;
const DEEP_SEA_DIVE_TARGET_CARD_ID = STRATEGIC_DEFENSE_CARD_ID;
const WALK_THE_PLANK_TARGET_CARD_ID = STRATEGIC_DEFENSE_CARD_ID;
const ZHANSHUJIA_UPGRADE_CARD_PROOFS = [
    {
        cardId: 'upgrade-zhanshujia-countermeasures-3',
        targetAbilityId: 'countermeasures',
        expectedLevel: 3,
        expectedCp: 0,
        screenshotPrefix: 'countermeasures-3-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-countermeasures-2',
        targetAbilityId: 'countermeasures',
        expectedLevel: 2,
        expectedCp: 2,
        screenshotPrefix: 'countermeasures-2-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-strategic-shift-2',
        targetAbilityId: 'strategic-shift',
        expectedLevel: 2,
        expectedCp: 3,
        screenshotPrefix: 'strategic-shift-2-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-expand-battlefield-2',
        targetAbilityId: 'expand-battlefield',
        expectedLevel: 2,
        expectedCp: 3,
        screenshotPrefix: 'expand-battlefield-2-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-flanking-2',
        targetAbilityId: 'flanking',
        expectedLevel: 2,
        expectedCp: 3,
        screenshotPrefix: 'flanking-2-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-drum-movement-2',
        targetAbilityId: 'drum-movement',
        expectedLevel: 2,
        expectedCp: 3,
        screenshotPrefix: 'drum-movement-2-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-carpet-bombing-2',
        targetAbilityId: 'carpet-bombing',
        expectedLevel: 2,
        expectedCp: 3,
        screenshotPrefix: 'carpet-bombing-2-upgrade-card',
    },
    {
        cardId: 'upgrade-zhanshujia-sabre-thrust-2',
        targetAbilityId: 'sabre-thrust',
        expectedLevel: 2,
        expectedCp: 4,
        screenshotPrefix: 'sabre-thrust-2-upgrade-card',
    },
] as const;

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const cloneCard = (cards: readonly JsonRecord[], cardId: string): JsonRecord => {
    const card = cards.find(item => item.id === cardId);
    if (!card) throw new Error(`找不到 DiceThrone 卡牌: ${cardId}`);
    return structuredClone(card);
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const setHarnessRandomQueue = async (page: Page, values: number[]): Promise<void> => {
    await page.evaluate((queueValues) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { random?: { setQueue?: (nextValues: number[]) => void } };
        }).__BG_TEST_HARNESS__;
        harness?.random?.setQueue?.(queueValues);
    }, values);
};

const setHarnessDiceValues = async (page: Page, values: number[]): Promise<void> => {
    await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice), { timeout: 5000 });
    await page.evaluate((diceValues) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { dice?: { setValues?: (nextValues: number[]) => void } };
        }).__BG_TEST_HARNESS__;
        harness?.dice?.setValues?.(diceValues);
    }, values);
};

const repeatRandomValue = (value: number, count: number): number[] =>
    Array.from({ length: count }, () => value);

const withTutorialRandomPolicy = (sys: JsonRecord, values: number[]): JsonRecord => ({
    ...sys,
    tutorial: {
        ...asRecord(sys.tutorial),
        active: true,
        randomPolicy: { mode: 'sequence', values, cursor: 0 },
    },
});

const setupNewHeroMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: CHARACTER_SELECTION_TIMEOUT,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await selectCharacter(match.hostPage, HOST_HERO_ID);
    await selectCharacter(match.guestPage, GUEST_HERO_ID);
    await readyAndStartGame(match.hostPage, match.guestPage);
    await waitForGameBoard(match.hostPage);
    await waitForGameBoard(match.guestPage);
    await waitForDiceThroneHarness(match.hostPage);
    await waitForDiceThroneHarness(match.guestPage);

    await match.hostPage.setViewportSize({ width: 1280, height: 720 });
    await match.guestPage.setViewportSize({ width: 1280, height: 720 });
    await match.hostPage.waitForTimeout(800);
    await match.guestPage.waitForTimeout(800);
    return match;
};

const setupNewHeroFourPlayerMatch = async (
    browser: Browser,
    baseURL: string | undefined,
): Promise<FourPlayerMatchSetup> => {
    const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 4,
        gameServerBaseURL: getGameServerBaseURL(),
        skipImageGate: true,
        characterSelectionTimeout: CHARACTER_SELECTION_TIMEOUT,
    });
    if (!setup) {
        test.skip(true, '游戏服务器不可用或创建 4 人 DiceThrone 房间失败');
        throw new Error('DiceThrone four-player online setup failed');
    }

    await selectCharacter(setup.players[0].page, FOUR_PLAYER_HOST_HERO_ID);
    await selectCharacter(setup.players[1].page, FOUR_PLAYER_ENEMY_FRONT_HERO_ID);
    await selectCharacter(setup.players[2].page, FOUR_PLAYER_ALLY_HERO_ID);
    await selectCharacter(setup.players[3].page, FOUR_PLAYER_ENEMY_CAPTAIN_HERO_ID);

    await readyMultiplePlayersAndStartGame(
        setup.hostPage,
        setup.players.slice(1).map((player) => player.page),
    );

    await Promise.all(setup.players.map(async (player) => {
        await waitForGameBoard(player.page);
        await waitForDiceThroneHarness(player.page);
        await player.page.setViewportSize({ width: 1280, height: 720 });
        await player.page.waitForTimeout(800);
    }));

    return setup;
};

const applyOnlineMatchState = async (
    matchId: string,
    page: Page,
    updater: (state: JsonRecord) => JsonRecord,
) => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const next = updater(structuredClone(current));
    const root = asRecord(next.G ?? next);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(asRecordMap(core.players));

    root.core = {
        ...core,
        phase: typeof core.phase === 'string' ? core.phase : sys.phase,
    };
    root.sys = {
        ...sys,
        matchId,
        turnOrder,
        currentPlayerIndex: typeof sys.currentPlayerIndex === 'number' ? sys.currentPlayerIndex : 0,
    };

    await injectMatchState(matchId, next, page);
    await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
    });
    await page.waitForTimeout(1000);
};

const waitForSelectedHeroes = async (page: Page) => {
    await expect.poll(async () => page.evaluate(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.selectedCharacters ?? state?.G?.core?.selectedCharacters ?? null;
    }), { timeout: 15000 }).toMatchObject({
        '0': HOST_HERO_ID,
        '1': GUEST_HERO_ID,
    });
};

const buildMercilessCurseTargetingRollState = (
    state: JsonRecord,
    targetingValue: number,
): JsonRecord => {
    const root = asRecord(state.G ?? state);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecordMap(core.players);
    const host = asRecord(players['0']);

    players['0'] = {
        ...host,
        playerBoardFace: 'cursed',
        abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
    };

    root.core = {
        ...core,
        activePlayerId: '0',
        phase: 'targetingRoll',
        rollCount: 1,
        rollLimit: 1,
        rollDiceCount: 1,
        rollConfirmed: true,
        selectedAbilityId: 'merciless-curse',
        activatingAbilityId: undefined,
        pendingBonusDiceSettlement: undefined,
        currentChoiceSourceAbilityId: undefined,
        pendingAttack: {
            attackerId: '0',
            defenderId: undefined,
            targetingSelectionPending: false,
            targetingSelectionResolved: false,
            isDefendable: true,
            damage: 0,
            sourceAbilityId: 'merciless-curse',
            defenseAbilityId: undefined,
            preDefenseResolved: false,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
            offensiveRollEndTokenResolved: false,
            bonusDiceResolved: false,
        },
        players,
        dice: (Array.isArray(core.dice) ? core.dice : []).map((die, index) => ({
            ...asRecord(die),
            value: index === 0 ? targetingValue : Number(asRecord(die).value ?? 1),
            isKept: false,
        })),
    };
    root.sys = {
        ...sys,
        phase: 'targetingRoll',
        flowHalted: false,
        interaction: { current: undefined, queue: [] },
    };
    return state;
};

const buildCarpetBombingFourPlayerState = (state: JsonRecord): JsonRecord => {
    const root = asRecord(state.G ?? state);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecordMap(core.players);

    for (const playerId of Object.keys(players)) {
        const player = asRecord(players[playerId]);
        const resources = asRecord(player.resources);
        players[playerId] = {
            ...player,
            hand: [],
            discard: [],
            tokens: {},
            statusEffects: {},
            damageShields: [],
            resources: {
                ...resources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
    }

    root.core = {
        ...core,
        activePlayerId: '1',
        phase: 'offensiveRoll',
        rollCount: 1,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: true,
        selectedAbilityId: undefined,
        activatingAbilityId: undefined,
        pendingAttack: undefined,
        pendingBonusDiceSettlement: undefined,
        pendingDamage: undefined,
        extraAttackInProgress: undefined,
        players,
        dice: buildDiceForValues('zhanshujia-dice', [1, 2, 4, 5, 6], {
            1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            4: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            5: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            6: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
        }),
    };
    root.sys = {
        ...sys,
        phase: 'offensiveRoll',
        currentPlayerIndex: 1,
        flowHalted: false,
        interaction: { current: undefined, queue: [] },
        responseWindow: { current: undefined },
    };
    return state;
};

const expectCharacterCardVisible = async (page: Page, characterId: string) => {
    const card = page.locator(`[data-character-id="${characterId}"], [data-char-id="${characterId}"]`).first();
    await expect(card).toBeAttached({ timeout: 15000 });
    await card.scrollIntoViewIfNeeded({ timeout: 15000 });
    await expect(card).toBeVisible({ timeout: 15000 });
};

const waitForHandCardVisualReady = async (page: Page, cardId: string) => {
    await page.waitForFunction((expectedCardId) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        const card = handArea.querySelector(`[data-card-id="${expectedCardId}"]`);
        if (!card) return false;
        const atlasFrame = card.querySelector('[data-card-atlas-frame="true"]') as HTMLElement | null;
        return card.getAttribute('data-is-flipped') === 'true'
            && atlasFrame != null
            && !atlasFrame.classList.contains('atlas-shimmer')
            && atlasFrame.style.backgroundImage.includes('url(');
    }, cardId, { timeout: 60000, polling: 200 });
    await page.waitForTimeout(500);
};

const dragHandCardToPlay = async (page: Page, cardId: string) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });
    const dragStart = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const xFractions = [0.5, 0.35, 0.65];
        const yFractions = [0.78, 0.62, 0.46, 0.3];
        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.x + (rect.width * xFraction);
                const y = rect.y + (rect.height * yFraction);
                const hit = document.elementFromPoint(x, y);
                if (hit && (hit === node || node.contains(hit))) {
                    return { x, y };
                }
            }
        }
        return {
            x: rect.x + (rect.width / 2),
            y: rect.y + (rect.height / 2),
            hitTag: document.elementFromPoint(
                rect.x + (rect.width / 2),
                rect.y + (rect.height / 2),
            )?.tagName ?? null,
        };
    }, cardId);
    if (!dragStart || 'hitTag' in dragStart) {
        throw new Error(`未能找到手牌 ${cardId} 的可拖拽命中点: ${JSON.stringify(dragStart)}`);
    }

    const startX = dragStart.x;
    const startY = dragStart.y;
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const waitForBoardImageReady = async (page: Page, testId: string) => {
    try {
        await page.waitForFunction((expectedTestId) => {
            const image = document.querySelector(`[data-testid="${expectedTestId}"]`) as HTMLImageElement | null;
            if (!image) return false;
            const style = window.getComputedStyle(image);
            return image.complete
                && image.naturalWidth > 0
                && image.naturalHeight > 0
                && Number(style.opacity) > 0.95
                && style.visibility !== 'hidden'
                && style.display !== 'none';
        }, testId, { timeout: 60000, polling: 200 });
    } catch (error) {
        const debug = await page.evaluate((expectedTestId) => {
            const image = document.querySelector(`[data-testid="${expectedTestId}"]`) as HTMLImageElement | null;
            if (!image) return { testId: expectedTestId, found: false };
            const style = window.getComputedStyle(image);
            return {
                testId: expectedTestId,
                found: true,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                opacity: style.opacity,
                display: style.display,
                visibility: style.visibility,
                src: image.getAttribute('src'),
                currentSrc: image.currentSrc,
                debugCurrentSrc: image.getAttribute('data-debug-current-src'),
                debugRenderedSrc: image.getAttribute('data-debug-rendered-src'),
                debugObjectUrl: image.getAttribute('data-debug-object-url'),
                debugLocalFetch: image.getAttribute('data-debug-local-fetch'),
            };
        }, testId);
        throw new Error(`DiceThrone 证据截图等待图片失败: ${JSON.stringify(debug)}`, { cause: error });
    }
    await page.waitForTimeout(300);
};

const waitForCursedPirateBoardFaceReady = async (
    page: Page,
    face: 'normal' | 'cursed',
) => {
    const boardSurface = page.getByTestId('player-board-surface').first();
    const boardImage = page.getByTestId('player-board-image').first();
    await expect(boardSurface).toHaveAttribute('data-character-id', 'cursed_pirate', { timeout: 10000 });
    await waitForBoardImageReady(page, 'player-board-image');

    if (face === 'normal') {
        await expect(boardImage).toHaveAttribute('data-debug-current-src', /human-player-board/, { timeout: 10000 });
        await expect(boardSurface.locator('[data-ability-slot="sky"]').first()).toHaveAttribute('data-base-ability-id', 'human-cursed', { timeout: 10000 });
        await expect(boardSurface.locator('[data-ability-slot="combo"]').first()).toHaveAttribute('data-base-ability-id', 'light-the-fuse', { timeout: 10000 });
    } else {
        await expect(boardImage).toHaveAttribute('data-debug-current-src', /\/player-board(?:[./?#]|$)/, { timeout: 10000 });
        await expect(boardSurface.locator('[data-ability-slot="fist"]').first()).toHaveAttribute('data-base-ability-id', 'soul-stab', { timeout: 10000 });
        await expect(boardSurface.locator('[data-ability-slot="sky"]').first()).toHaveAttribute('data-base-ability-id', 'cursed', { timeout: 10000 });
    }
};

const readServerCore = async (matchId: string, page: Page): Promise<JsonRecord> => {
    const state = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(state.G ?? state);
    return asRecord(root.core);
};

const readServerCoreForPage = (match: MatchSetup, page: Page) => () =>
    readServerCore(match.matchId, page);

const expectRightTrayBonusDiceOnPage = async (
    match: MatchSetup,
    page: Page,
    options: { diceCount?: number; sourceAbilityId?: string } = {},
): Promise<void> => {
    await expectRightTrayBonusDiceConfirmation(page, readServerCoreForPage(match, page), {
        sourceAbilityId: options.sourceAbilityId,
    });
    if (typeof options.diceCount === 'number') {
        await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(options.diceCount, { timeout: 10000 });
    }
};

const settleBonusDiceOnPage = async (
    match: MatchSetup,
    page: Page,
    options: { sourceAbilityId?: string } = {},
): Promise<void> => {
    await settleCurrentBonusDice(page, readServerCoreForPage(match, page), options);
};

const readServerRoot = async (matchId: string, page: Page): Promise<{ core: JsonRecord; sys: JsonRecord }> => {
    const state = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(state.G ?? state);
    return {
        core: asRecord(root.core),
        sys: asRecord(root.sys),
    };
};

const waitForTokenStack = async (
    matchId: string,
    page: Page,
    playerId: string,
    tokenId: string,
    expectedStack: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const tokens = asRecord(player.tokens);
        return tokens[tokenId] ?? 0;
    }, { timeout: 10000 }).toBe(expectedStack);
};

const waitForTokenAtLeast = async (
    matchId: string,
    page: Page,
    playerId: string,
    tokenId: string,
    minimumStack: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const tokens = asRecord(player.tokens);
        return tokens[tokenId] ?? 0;
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(minimumStack);
};

const waitForTokenLimit = async (
    matchId: string,
    page: Page,
    playerId: string,
    tokenId: string,
    expectedLimit: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const tokenStackLimits = asRecord(player.tokenStackLimits);
        return tokenStackLimits[tokenId] ?? null;
    }, { timeout: 10000 }).toBe(expectedLimit);
};

const waitForStatusStack = async (
    matchId: string,
    page: Page,
    playerId: string,
    statusId: string,
    expectedStack: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const statusEffects = asRecord(player.statusEffects);
        return statusEffects[statusId] ?? 0;
    }, { timeout: 10000 }).toBe(expectedStack);
};

const waitForResourceValue = async (
    matchId: string,
    page: Page,
    playerId: string,
    resourceId: string,
    expectedValue: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const resources = asRecord(player.resources);
        return resources[resourceId] ?? null;
    }, { timeout: 10000 }).toBe(expectedValue);
};

const waitForDefensePhase = async (
    matchId: string,
    page: Page,
    expectedDefenderId: string,
    expectedDefenseAbilityId: string,
) => {
    await expect.poll(async () => {
        const { core, sys } = await readServerRoot(matchId, page);
        const pendingAttack = asRecord(core.pendingAttack);
        return {
            phase: sys.phase ?? core.phase ?? null,
            defenderId: pendingAttack.defenderId ?? null,
            defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
            rollConfirmed: core.rollConfirmed ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'defensiveRoll',
        defenderId: expectedDefenderId,
        defenseAbilityId: expectedDefenseAbilityId,
        rollConfirmed: true,
    });
};

const waitForAttackResolved = async (matchId: string, page: Page) => {
    await expect.poll(async () => {
        const { core, sys } = await readServerRoot(matchId, page);
        return {
            phase: sys.phase ?? core.phase ?? null,
            hasPendingAttack: Boolean(core.pendingAttack),
        };
    }, { timeout: 10000 }).toMatchObject({
        hasPendingAttack: false,
    });
};

const waitForPendingAttack = async (
    matchId: string,
    page: Page,
    expected: {
        attackerId: string;
        defenderId?: string;
        sourceAbilityId: string;
        damage?: number;
    },
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const pendingAttack = asRecord(core.pendingAttack);
        const actual = {
            attackerId: pendingAttack.attackerId ?? null,
            defenderId: pendingAttack.defenderId ?? null,
            sourceAbilityId: pendingAttack.sourceAbilityId ?? null,
        };
        if (expected.damage !== undefined) {
            return {
                ...actual,
                damage: pendingAttack.damage ?? null,
            };
        }
        return actual;
    }, { timeout: 10000 }).toMatchObject(expected);
};

const advancePhaseForActivePlayer = async (match: MatchSetup) => {
    const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
    const pendingAttack = asRecord(core.pendingAttack);
    const defensiveRollDefenderId = sys.phase === 'defensiveRoll' && typeof pendingAttack.defenderId === 'string'
        ? pendingAttack.defenderId
        : null;
    const actingPlayerId = String(defensiveRollDefenderId ?? core.activePlayerId ?? '');
    if (actingPlayerId !== '0' && actingPlayerId !== '1') {
        throw new Error(`缺少有效 actingPlayerId，无法推进阶段: ${JSON.stringify({
            actingPlayerId,
            activePlayerId: core.activePlayerId ?? null,
            defenderId: pendingAttack.defenderId ?? null,
            phase: sys.phase ?? core.phase ?? null,
            hasPendingAttack: Boolean(core.pendingAttack),
        })}`);
    }

    const activePage = actingPlayerId === '0' ? match.hostPage : match.guestPage;
    await dispatchDiceThroneCommand(activePage, {
        type: 'ADVANCE_PHASE',
        playerId: actingPlayerId,
        payload: {},
    });
    await activePage.waitForTimeout(250);
};

const closeCombatChainUntilSettled = async (match: MatchSetup, page: Page, maxRounds = 6) => {
    let lastSnapshot: Record<string, unknown> | null = null;
    for (let round = 0; round < maxRounds; round += 1) {
        const state = await readServerRoot(match.matchId, page);
        const pendingDamage = asRecord(state.core.pendingDamage);
        const pendingDamageResponderId = typeof pendingDamage.responderId === 'string'
            ? pendingDamage.responderId
            : null;
        const hasPendingAttack = Boolean(state.core.pendingAttack);
        const hasPendingDamage = Boolean(state.core.pendingDamage);
        const hasInteraction = Boolean(asRecord(state.sys.interaction).current);
        const hasResponseWindow = Boolean(asRecord(state.sys.responseWindow).current);
        const pendingAttack = asRecord(state.core.pendingAttack);
        const interaction = asRecord(state.sys.interaction).current;
        const responseWindow = asRecord(state.sys.responseWindow).current;

        lastSnapshot = {
            round,
            phase: state.sys.phase ?? state.core.phase ?? null,
            activePlayerId: state.core.activePlayerId ?? null,
            hasPendingAttack,
            pendingAttackSourceId: pendingAttack.sourceAbilityId ?? null,
            pendingAttackDefenseAbilityId: pendingAttack.defenseAbilityId ?? null,
            hasPendingDamage,
            pendingDamageResponderId,
            hasInteraction,
            interactionKind: interaction && typeof interaction === 'object' ? interaction.kind ?? null : null,
            hasResponseWindow,
            responseWindowStep: responseWindow && typeof responseWindow === 'object' ? responseWindow.step ?? null : null,
        };

        if (!hasPendingAttack && !hasPendingDamage && !hasInteraction && !hasResponseWindow) {
            return;
        }

        if (pendingDamageResponderId) {
            const responderPage = pendingDamageResponderId === '0' ? match.hostPage : match.guestPage;
            await dispatchDiceThroneCommand(responderPage, {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: pendingDamageResponderId,
                payload: {},
            });
            await responderPage.waitForTimeout(250);
            continue;
        }

        if (await maybePassResponse(match.hostPage) || await maybePassResponse(match.guestPage)) {
            continue;
        }

        await advancePhaseForActivePlayer(match);
    }

    throw new Error(`战斗链在限定轮次内未收口: ${JSON.stringify(lastSnapshot)}`);
};

const waitForDiscardContains = async (
    matchId: string,
    page: Page,
    playerId: string,
    cardId: string,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const discard = Array.isArray(player.discard) ? player.discard as JsonRecord[] : [];
        return discard.some(card => card.id === cardId);
    }, { timeout: 10000 }).toBe(true);
};

const waitForHandIds = async (
    matchId: string,
    page: Page,
    playerId: string,
    expectedCardIds: string[],
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const hand = Array.isArray(player.hand) ? player.hand as JsonRecord[] : [];
        return hand.map(card => card.id);
    }, { timeout: 10000 }).toEqual(expectedCardIds);
};

const waitForHandCount = async (
    matchId: string,
    page: Page,
    playerId: string,
    expectedCount: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const hand = Array.isArray(player.hand) ? player.hand as JsonRecord[] : [];
        return hand.length;
    }, { timeout: 10000 }).toBe(expectedCount);
};

const waitForDiscardCount = async (
    matchId: string,
    page: Page,
    playerId: string,
    expectedCount: number,
) => {
    await expect.poll(async () => {
        const core = await readServerCore(matchId, page);
        const players = asRecordMap(core.players);
        const player = asRecord(players[playerId]);
        const discard = Array.isArray(player.discard) ? player.discard as JsonRecord[] : [];
        return discard.length;
    }, { timeout: 10000 }).toBe(expectedCount);
};

const dismissCardSpotlightIfPresent = async (page: Page) => {
    const spotlight = page.getByTestId('card-spotlight-overlay');
    if (await spotlight.isVisible({ timeout: 1500 }).catch(() => false)) {
        await spotlight.click({ timeout: 3000, force: true }).catch(() => {});
        await expect(spotlight).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
};

const dismissAttackShowcaseIfVisible = async (page: Page) => {
    const foregroundModal = page.locator('#modal-root [role="dialog"]');
    const hasForegroundModal = await foregroundModal.first().isVisible({ timeout: 1000 }).catch(() => false);
    if (hasForegroundModal) return;

    const dismissButton = page
        .getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i })
        .last();
    const isVisible = await dismissButton.isVisible({ timeout: 1500 }).catch(() => false);
    if (!isVisible) return;
    await dismissButton.click();
    await expect(dismissButton).toBeHidden({ timeout: 5000 });
};

const dismissDefenseShowcaseIfPresent = async (page: Page) => {
    const continueButton = page.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i });
    if (await continueButton.first().isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueButton.first().click();
        await expect(continueButton.first()).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
};

const buildDiceForValues = (
    definitionId: string,
    values: number[],
    faceByValue: Record<number, string>,
): JsonRecord[] => values.map((value, index) => ({
    id: index,
    definitionId,
    value,
    symbol: faceByValue[value],
    symbols: [faceByValue[value]],
    isKept: false,
}));

const setupDefenseEvidenceScenario = async (
    match: MatchSetup,
    options: {
        attackerId: string;
        defenderId: string;
        sourceAbilityId: string;
        defenseAbilityId: string;
        defenderDiceDefinitionId: string;
        defenderDiceValues: number[];
        defenderFaceByValue: Record<number, string>;
    },
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const attacker = asRecord(players[options.attackerId]);
        const defender = asRecord(players[options.defenderId]);
        const attackerResources = asRecord(attacker.resources);
        const defenderResources = asRecord(defender.resources);
        const attackerAbilityLevels = asRecord(attacker.abilityLevels);
        const defenderAbilityLevels = asRecord(defender.abilityLevels);

        players[options.attackerId] = {
            ...attacker,
            ...(options.attackerId === '1' && options.sourceAbilityId === 'soul-stab-3'
                ? {
                    playerBoardFace: 'cursed',
                    abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
                    abilityLevels: attackerAbilityLevels,
                }
                : {}),
            resources: {
                ...attackerResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };
        players[options.defenderId] = {
            ...defender,
            discard: [],
            ...(options.defenderId === '1' && options.defenseAbilityId === 'still-wet-behind-ears'
                ? {
                    playerBoardFace: 'cursed',
                    abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
                    abilityLevels: defenderAbilityLevels,
                }
                : {}),
            resources: {
                ...defenderResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: options.defenderId,
            phase: 'defensiveRoll',
            dice: buildDiceForValues(
                options.defenderDiceDefinitionId,
                options.defenderDiceValues,
                options.defenderFaceByValue,
            ),
            rollCount: 1,
            rollLimit: 1,
            rollDiceCount: options.defenderDiceValues.length,
            rollConfirmed: true,
            selectedAbilityId: options.sourceAbilityId,
            activatingAbilityId: options.defenseAbilityId,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            pendingAttack: {
                attackerId: options.attackerId,
                defenderId: options.defenderId,
                isDefendable: true,
                damage: ATTACK_DAMAGE_FOR_DEFENSE_EVIDENCE,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                sourceAbilityId: options.sourceAbilityId,
                defenseAbilityId: options.defenseAbilityId,
                preDefenseResolved: true,
                damageResolved: false,
                resolvedDamage: 0,
                offensiveRollEndTokenResolved: true,
                bonusDiceResolved: false,
            },
        };
        root.sys = {
            ...sys,
            phase: 'defensiveRoll',
            currentPlayerIndex: Number(options.defenderId),
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHighGroundScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {
                [TOKEN_IDS.TACTICAL_ADVANTAGE]: 2,
            },
            tokenStackLimits: {
                [TOKEN_IDS.TACTICAL_ADVANTAGE]: 5,
            },
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6, 6], {
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupSabreThrustScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 6, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                6: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupCursedSoulStabScenario = async (
    match: MatchSetup,
    options?: {
        guestWitherStacks?: number;
    },
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: options?.guestWitherStacks
                ? {
                    [STATUS_IDS.WITHER]: options.guestWitherStacks,
                }
                : {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed_pirate-dice', [1, 1, 1, 4, 5], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupSabreThrust2Scenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'sabre-thrust'
                        ? { ...structuredClone(SABRE_THRUST_2 as unknown as JsonRecord), id: 'sabre-thrust' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'sabre-thrust': 2,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 1, 1, 6, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                6: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupTacticalAdvantageTransferScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {
                [TOKEN_IDS.TACTICAL_ADVANTAGE]: 4,
            },
            statusEffects: {
                [STATUS_IDS.BIND]: 1,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'main1',
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupTacticalAdvantageTargetedScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {
                [TOKEN_IDS.TACTICAL_ADVANTAGE]: 3,
            },
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'main1',
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupBindOffensiveRollScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };
        players['1'] = {
            ...guest,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {
                [STATUS_IDS.BIND]: 1,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed_pirate-dice', [1, 2, 3, 4, 5], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                2: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                3: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupDefenseResponseCardAttackScenario = async (
    match: MatchSetup,
    defenderCardId: string,
) => {
    const defenderCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], defenderCardId);
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [defenderCard],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed_pirate-dice', [1, 1, 1, 4, 5], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            lastResolvedAttackDamage: 0,
            attackResolvedSequence: Number(core.attackResolvedSequence ?? 0),
            afterAttackResponseWindowSequence: Number(core.afterAttackResponseWindowSequence ?? 0),
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupDeepSeaDiveAttackScenario = async (
    match: MatchSetup,
    targetCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [targetCard],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed_pirate-dice', [1, 4, 5, 6, 2], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                2: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

type CrowsNestBranch = 'view' | 'loot' | 'skull';

const detectCrowsNestBranch = async (
    matchId: string,
    page: Page,
): Promise<CrowsNestBranch | null> => {
    const state = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(state.G ?? state);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const currentInteraction = asRecord(asRecord(sys.interaction).current);
    const currentData = asRecord(currentInteraction.data);
    const kind = currentInteraction.kind;
    const sourceId = currentData.sourceId ?? currentData.sourceCardId;

    if (kind === 'simple-choice' && sourceId === CROWS_NEST_CARD_ID) {
        return 'view';
    }
    if (kind === 'dt:card-interaction' && currentData.sourceCardId === CROWS_NEST_CARD_ID && currentData.type === 'selectHandCard') {
        return 'loot';
    }

    const players = asRecordMap(core.players);
    const host = asRecord(players['0']);
    const hostDiscard = Array.isArray(host.discard) ? host.discard as JsonRecord[] : [];
    if (hostDiscard.length > 0) {
        return 'skull';
    }

    return null;
};

const waitForCrowsNestBranch = async (
    matchId: string,
    page: Page,
): Promise<CrowsNestBranch> => {
    await expect.poll(async () => detectCrowsNestBranch(matchId, page), {
        timeout: 10000,
        message: '等待瞭望台真实打出后进入任一骰面分支',
    }).not.toBeNull();
    const branch = await detectCrowsNestBranch(matchId, page);
    if (!branch) {
        throw new Error('瞭望台分支检测在 poll 通过后仍为空');
    }
    return branch;
};

const setupCrowsNestScenario = async (
    match: MatchSetup,
    crowsNestCard: JsonRecord,
    targetCards: JsonRecord[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: targetCards,
            discard: [],
        };
        players['1'] = {
            ...guest,
            hand: [crowsNestCard],
            resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
        };
        return state;
    });
};

const setupHeftyScenario = async (
    match: MatchSetup,
    heftyCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
        };
        players['1'] = {
            ...guest,
            hand: [heftyCard],
            discard: [],
            resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupBlusterScenario = async (
    match: MatchSetup,
    blusterCard: JsonRecord,
    drawCards: JsonRecord[],
    randomValues: number[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);
        const hostResources = asRecord(host.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.HP]: 50,
                [RESOURCE_IDS.CP]: 5,
            },
        };
        players['1'] = {
            ...guest,
            hand: [blusterCard],
            deck: drawCards,
            discard: [],
            resources: { ...guestResources, [RESOURCE_IDS.CP]: 5, [RESOURCE_IDS.HP]: 50 },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = withTutorialRandomPolicy({
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        }, randomValues);
        return state;
    });
};

const setupGainUpperHandScenario = async (
    match: MatchSetup,
    gainUpperHandCard: JsonRecord,
    drawCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [gainUpperHandCard],
            deck: [drawCard],
            discard: [],
            tokens: {},
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupAmbushScenario = async (
    match: MatchSetup,
    ambushCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [ambushCard],
            discard: [],
            tokens: {},
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupCurseCardScenario = async (
    match: MatchSetup,
    curseCard: JsonRecord,
    drawCards: JsonRecord[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [curseCard],
            deck: drawCards,
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupWeighAnchorScenario = async (
    match: MatchSetup,
    weighAnchorCard: JsonRecord,
    drawCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [weighAnchorCard],
            deck: [drawCard],
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupBattenDownScenario = async (
    match: MatchSetup,
    battenDownCard: JsonRecord,
    extraHandCards: JsonRecord[],
    drawCards: JsonRecord[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [battenDownCard, ...extraHandCards],
            deck: drawCards,
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupGiveMeSomeScenario = async (
    match: MatchSetup,
    giveMeSomeCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [giveMeSomeCard],
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupSimpleCursedPirateMainCardScenario = async (
    match: MatchSetup,
    card: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [card],
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupPiratesLifeScenario = async (
    match: MatchSetup,
    piratesLifeCard: JsonRecord,
    options: {
        face: 'normal' | 'cursed';
        hp: number;
        cursedCoin: number;
    },
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [piratesLifeCard],
            discard: [],
            playerBoardFace: options.face,
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', options.face) as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            statusEffects: options.cursedCoin > 0 ? { [STATUS_IDS.CURSED_COIN]: options.cursedCoin } : {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: options.hp,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupRansomScenario = async (
    match: MatchSetup,
    ransomCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [ransomCard],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed_pirate-dice', [6, 4, 5, 1, 2], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                2: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupSipScenario = async (
    match: MatchSetup,
    sipCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [sipCard],
            discard: [],
            statusEffects: {},
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main1',
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupFlayScenario = async (
    match: MatchSetup,
    flayCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
        };
        players['1'] = {
            ...guest,
            hand: [flayCard],
            discard: [],
            resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'test-attack',
                isDefendable: true,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
            },
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupSharkBaitScenario = async (
    match: MatchSetup,
    sharkBaitCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...asRecord(host.resources),
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [sharkBaitCard],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed_pirate-dice', [1, 1, 1, 4, 5], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            lastResolvedAttackDamage: 0,
            attackResolvedSequence: Number(core.attackResolvedSequence ?? 0),
            afterAttackResponseWindowSequence: Number(core.afterAttackResponseWindowSequence ?? 0),
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupMarkedForDeathScenario = async (
    match: MatchSetup,
    drawCards: JsonRecord[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            statusEffects: {},
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
        };
        players['1'] = {
            ...guest,
            hand: [],
            deck: drawCards,
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 4, 4, 4, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupUndeadClawScenario = async (
    match: MatchSetup,
    cursedCoinCount: number,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {
                [STATUS_IDS.CURSED_COIN]: cursedCoinCount,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 4, 6, 6, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupSoulCommandScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 6, 6, 6, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupBreathOfDeathScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 2, 3, 4, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanVerdictCommandScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 6, 6, 6, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanLightTheFuseScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 2, 3, 4, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanMercilessPlunderScenario = async (
    match: MatchSetup,
    options: { withHostUnexpected?: boolean } = {},
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: options.withHostUnexpected
                ? [cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], COMMON_UNEXPECTED_CARD_ID)]
                : [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [6, 6, 6, 6, 6], {
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanAstonishingScenario = async (
    match: MatchSetup,
    cursedCoinCount: number,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {
                [STATUS_IDS.CURSED_COIN]: cursedCoinCount,
            },
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 4, 6, 6, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanCursedEndTurnScenario = async (
    match: MatchSetup,
    cursedCoinCount: number,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: cursedCoinCount > 0
                ? { [STATUS_IDS.CURSED_COIN]: cursedCoinCount }
                : {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'main2',
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main2',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanWalkThePlankScenario = async (
    match: MatchSetup,
    targetCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [targetCard],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 2, 4, 5, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                2: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanMakeYourMarkScenario = async (
    match: MatchSetup,
    drawCards: JsonRecord[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            deck: drawCards,
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [4, 4, 4, 1, 6], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanCutlassStabScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('cursed-pirate-dice', [1, 1, 1, 1, 4], {
                1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupHumanStillWetBehindEarsScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            abilities: structuredClone(getCharacterAbilitiesForFace('zhanshujia') as unknown as JsonRecord[]),
            abilityLevels: hostAbilityLevels,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'normal',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 1, 1, 4, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupCursedCoinUpkeepScenario = async (
    match: MatchSetup,
    cursedCoinCount: number,
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {
                [STATUS_IDS.CURSED_COIN]: cursedCoinCount,
            },
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'discard',
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'discard',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupPowderKegUpkeepScenario = async (
    match: MatchSetup,
    powderKegCount: number,
    guestPowderKegCount = 0,
    guestCursedCoinCount = 0,
    randomValues?: number[],
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {
                [STATUS_IDS.POWDER_KEG]: powderKegCount,
            },
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {
                ...(guestPowderKegCount > 0
                    ? {
                        [STATUS_IDS.POWDER_KEG]: guestPowderKegCount,
                    }
                    : {}),
                ...(guestCursedCoinCount > 0
                    ? {
                        [STATUS_IDS.CURSED_COIN]: guestCursedCoinCount,
                    }
                    : {}),
            },
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'discard',
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            currentChoiceSourceAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
        };
        root.sys = randomValues && randomValues.length > 0
            ? withTutorialRandomPolicy({
                ...sys,
                phase: 'discard',
                currentPlayerIndex: 1,
                flowHalted: false,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            }, randomValues)
            : {
                ...sys,
                phase: 'discard',
                currentPlayerIndex: 1,
                flowHalted: false,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            };
        return state;
    });
};

const setupCursedUpkeepSelfDamageScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'discard',
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            offensiveRollAttackMadeThisTurn: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'discard',
            currentPlayerIndex: 1,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupCursedNoAttackPowderKegScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestAbilityLevels = asRecord(guest.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            playerBoardFace: 'cursed',
            abilities: structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'cursed') as unknown as JsonRecord[]),
            abilityLevels: guestAbilityLevels,
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 4, 5], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABER,
                2: ZHANSHUJIA_DICE_FACE_IDS.FLAG,
                3: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                4: ZHANSHUJIA_DICE_FACE_IDS.FLAG,
                5: ZHANSHUJIA_DICE_FACE_IDS.SABER,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            offensiveRollAttackMadeThisTurn: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupWarMonger2Scenario = async (
    match: MatchSetup,
    drawCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            deck: [drawCard],
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'war-monger'
                        ? { ...structuredClone(WAR_MONGER_2 as unknown as JsonRecord), id: 'war-monger' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'war-monger': 2,
            },
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 4, 4, 4, 2], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupStrategicShift2Scenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'strategic-shift'
                        ? { ...structuredClone(STRATEGIC_SHIFT_2 as unknown as JsonRecord), id: 'strategic-shift' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'strategic-shift': 2,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6, 1], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupStrategicShiftScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6, 1], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupDrumMovementScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 6, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupDrumMovement2Scenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'drum-movement'
                        ? { ...structuredClone(DRUM_MOVEMENT_2 as unknown as JsonRecord), id: 'drum-movement' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'drum-movement': 2,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 6, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupCarpetBombing2StrategyScenario = async (
    match: MatchSetup,
    drawCards: JsonRecord[],
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            deck: drawCards,
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'carpet-bombing'
                        ? { ...structuredClone(CARPET_BOMBING_2 as unknown as JsonRecord), id: 'carpet-bombing' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'carpet-bombing': 2,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [4, 4, 4, 4, 1], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupExpandBattlefieldScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [2, 3, 4, 5, 6], {
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                5: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupFlankingScenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 4, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                4: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupFlanking2Scenario = async (match: MatchSetup) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'flanking'
                        ? { ...structuredClone(FLANKING_2 as unknown as JsonRecord), id: 'flanking' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                flanking: 2,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 4, 6], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                4: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupExpandBattlefield2Scenario = async (match: MatchSetup) => {
    const drawCards = [
        cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID),
        cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], GAIN_UPPER_HAND_CARD_ID),
    ];
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            deck: drawCards,
            discard: [],
            abilities: Array.isArray(host.abilities)
                ? (host.abilities as JsonRecord[]).map((ability) => (
                    ability.id === 'expand-battlefield'
                        ? { ...structuredClone(EXPAND_BATTLEFIELD_2 as unknown as JsonRecord), id: 'expand-battlefield' }
                        : ability
                ))
                : host.abilities,
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'expand-battlefield': 2,
            },
            damageShields: [],
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [2, 3, 4, 5, 6], {
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                3: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                5: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupWarMongerScenario = async (
    match: MatchSetup,
    drawCard: JsonRecord,
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostAbilityLevels = asRecord(host.abilityLevels);

        players['0'] = {
            ...host,
            hand: [],
            deck: [drawCard],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                ...hostAbilityLevels,
                'war-monger': 1,
            },
            upgradeCardByAbilityId: {},
        };
        players['1'] = {
            ...guest,
            hand: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            dice: buildDiceForValues('zhanshujia-dice', [1, 4, 4, 4, 2], {
                1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            }),
            rollCount: 1,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupZhanshujiaUpgradeCardScenario = async (
    match: MatchSetup,
    upgradeCard: JsonRecord,
    targetAbilityId: string,
) => {
    await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);

        players['0'] = {
            ...host,
            abilities: structuredClone(getCharacterAbilitiesForFace('zhanshujia') as unknown as JsonRecord[]),
            hand: [upgradeCard],
            deck: [],
            discard: [],
            resources: {
                ...hostResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            abilityLevels: {
                [targetAbilityId]: 1,
            },
            upgradeCardByAbilityId: {},
        };
        players['1'] = {
            ...guest,
            hand: [],
            deck: [],
            discard: [],
            resources: {
                ...guestResources,
                [RESOURCE_IDS.CP]: 5,
                [RESOURCE_IDS.HP]: 50,
            },
            tokens: {},
            statusEffects: {},
            damageShields: [],
        };

        root.core = {
            ...core,
            players,
            activePlayerId: '0',
            phase: 'main1',
            rollConfirmed: true,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            extraAttackInProgress: undefined,
        };
        root.sys = {
            ...sys,
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        };
        return state;
    });
};

const setupWarMonger2UpgradeCardScenario = async (
    match: MatchSetup,
    upgradeCard: JsonRecord,
) => setupZhanshujiaUpgradeCardScenario(match, upgradeCard, 'war-monger');

const playHeftyUntilLoot = async (
    match: MatchSetup,
    heftyCard: JsonRecord,
    testInfo: TestInfo,
): Promise<void> => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
        await setupHeftyScenario(match, heftyCard);
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: HEFTY_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
        await saveEvidenceScreenshot(match.guestPage, testInfo, '27-guest-hefty-bonus-die-right-tray-loot');
        await settleBonusDiceOnPage(match, match.guestPage);

        let lootResolved = true;
        try {
            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const guestResources = asRecord(guest.resources);
                const guestHand = Array.isArray(guest.hand) ? guest.hand as JsonRecord[] : [];
                const guestDiscard = Array.isArray(guest.discard) ? guest.discard as JsonRecord[] : [];
                return guestResources[RESOURCE_IDS.CP] === 5
                    && guestHand.length === 2
                    && guestDiscard.some(card => card.id === HEFTY_CARD_ID);
            }, { timeout: 5000 }).toBe(true);
        } catch {
            lootResolved = false;
        }

        if (lootResolved) {
            return;
        }
    }

    throw new Error('8 次真实打出干票大的后仍未命中奖励骰战利品分支');
};

const playBlusterUntilCutlass = async (
    match: MatchSetup,
    blusterCard: JsonRecord,
    drawCards: JsonRecord[],
    testInfo: TestInfo,
): Promise<void> => {
    const rolledFaces: string[] = [];

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupBlusterScenario(match, blusterCard, drawCards, Array.from({ length: 16 }, () => 1));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, BLUSTER_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: BLUSTER_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
        await expect.poll(async () => {
            const core = await readServerCore(match.matchId, match.guestPage);
            const settlement = asRecord(core.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            return dice.length;
        }, {
            timeout: 10000,
            message: '等待虚张声势奖励骰结算状态出现',
        }).toBe(1);

        const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        const rolledFace = String(asRecord(dice[0]).face ?? '');
        rolledFaces.push(rolledFace || '<empty>');

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '95-guest-bluster-bonus-die-right-tray-cutlass');
        }

        await settleBonusDiceOnPage(match, match.guestPage);
        await waitForDiscardContains(match.matchId, match.guestPage, '1', BLUSTER_CARD_ID);

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) {
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 48);
            await waitForHandCount(match.matchId, match.guestPage, '1', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '96-host-bluster-cutlass-applied');
            return;
        }

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.LOOT) {
            await waitForHandCount(match.matchId, match.guestPage, '1', 2);
        } else if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForHandCount(match.matchId, match.guestPage, '1', 0);
        }
    }

    throw new Error(`12 次真实打出虚张声势后仍未命中奖励骰弯刀分支；实际骰面序列: ${rolledFaces.join(', ')}`);
};

const playBlusterUntilLoot = async (
    match: MatchSetup,
    blusterCard: JsonRecord,
    drawCards: JsonRecord[],
    testInfo: TestInfo,
): Promise<void> => {
    const rolledFaces: string[] = [];

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupBlusterScenario(match, blusterCard, drawCards, Array.from({ length: 16 }, () => 4));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, BLUSTER_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: BLUSTER_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
        await expect.poll(async () => {
            const core = await readServerCore(match.matchId, match.guestPage);
            const settlement = asRecord(core.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            return dice.length;
        }, {
            timeout: 10000,
            message: '等待虚张声势战利品分支奖励骰结算状态出现',
        }).toBe(1);

        const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        const rolledFace = String(asRecord(dice[0]).face ?? '');
        rolledFaces.push(rolledFace || '<empty>');

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.LOOT) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '149-guest-bluster-bonus-die-right-tray-loot');
        }

        await settleBonusDiceOnPage(match, match.guestPage);
        await waitForDiscardContains(match.matchId, match.guestPage, '1', BLUSTER_CARD_ID);

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.LOOT) {
            await waitForHandIds(match.matchId, match.guestPage, '1', drawCards.map(card => card.id as string));
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '150-guest-bluster-loot-applied');
            return;
        }

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) {
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 48);
        } else if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
        }
    }

    throw new Error(`12 次真实打出虚张声势后仍未命中奖励骰战利品分支；实际骰面序列: ${rolledFaces.join(', ')}`);
};

const playBlusterUntilSkull = async (
    match: MatchSetup,
    blusterCard: JsonRecord,
    drawCards: JsonRecord[],
    testInfo: TestInfo,
): Promise<void> => {
    const rolledFaces: string[] = [];

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupBlusterScenario(match, blusterCard, drawCards, Array.from({ length: 16 }, () => 6));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, BLUSTER_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: BLUSTER_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
        await expect.poll(async () => {
            const core = await readServerCore(match.matchId, match.guestPage);
            const settlement = asRecord(core.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            return dice.length;
        }, {
            timeout: 10000,
            message: '等待虚张声势骷髅分支奖励骰结算状态出现',
        }).toBe(1);

        const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        const rolledFace = String(asRecord(dice[0]).face ?? '');
        rolledFaces.push(rolledFace || '<empty>');

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '151-guest-bluster-bonus-die-right-tray-skull');
        }

        await settleBonusDiceOnPage(match, match.guestPage);
        await waitForDiscardContains(match.matchId, match.guestPage, '1', BLUSTER_CARD_ID);

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForHandCount(match.matchId, match.guestPage, '1', 0);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '152-host-bluster-skull-applied');
            return;
        }

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) {
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 48);
        } else if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.LOOT) {
            await waitForHandCount(match.matchId, match.guestPage, '1', 2);
        }
    }

    throw new Error(`12 次真实打出虚张声势后仍未命中奖励骰骷髅分支；实际骰面序列: ${rolledFaces.join(', ')}`);
};

const playSharkBaitModifier = async (
    match: MatchSetup,
    sharkBaitCard: JsonRecord,
    testInfo: TestInfo,
): Promise<void> => {
    await setupSharkBaitScenario(match, sharkBaitCard);
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);

    const soulStabSlot = match.guestPage
        .locator('[data-testid="player-board-surface"] [data-resolved-ability-id="soul-stab-3"]')
        .first();
    await expect(soulStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    await saveEvidenceScreenshot(match.guestPage, testInfo, '97-guest-shark-bait-attack-entry');
    await soulStabSlot.click();
    await waitForPendingAttack(match.matchId, match.guestPage, {
        attackerId: '1',
        defenderId: '0',
        sourceAbilityId: 'soul-stab-3',
    });

    await waitForHandCardVisualReady(match.guestPage, SHARK_BAIT_CARD_ID);
    await dispatchDiceThroneCommand(match.guestPage, {
        type: 'PLAY_CARD',
        playerId: '1',
        payload: { cardId: SHARK_BAIT_CARD_ID },
    });

    const modifierBadge = match.guestPage.getByTestId('active-modifier-badge');
    await expect(modifierBadge).toBeVisible({ timeout: 10000 });

    await expect.poll(async () => {
        const core = await readServerCore(match.matchId, match.guestPage);
        const pendingAttack = asRecord(core.pendingAttack);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(asRecordMap(core.players)['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const guestDiscard = Array.isArray(guest.discard) ? guest.discard as JsonRecord[] : [];
        return {
            phase: String(core.phase ?? ''),
            attackerId: pendingAttack.attackerId ?? null,
            defenderId: pendingAttack.defenderId ?? null,
            sourceAbilityId: pendingAttack.sourceAbilityId ?? null,
            hostHp: Number(hostResources[RESOURCE_IDS.HP] ?? 0),
            guestCp: Number(guestResources[RESOURCE_IDS.CP] ?? 0),
            discardIds: guestDiscard.map(card => card.id),
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'offensiveRoll',
        attackerId: '1',
        defenderId: '0',
        sourceAbilityId: 'soul-stab-3',
        hostHp: 48,
        guestCp: 4,
        discardIds: expect.arrayContaining([SHARK_BAIT_CARD_ID]),
    });

    await saveEvidenceScreenshot(match.guestPage, testInfo, '98-guest-shark-bait-modifier-active');
    await saveEvidenceScreenshot(match.hostPage, testInfo, '99-host-shark-bait-attack-damage-applied');
};

const playGainUpperHandUntilMedal = async (
    match: MatchSetup,
    gainUpperHandCard: JsonRecord,
    drawCard: JsonRecord,
    testInfo: TestInfo,
): Promise<void> => {
    const rolledFaces: string[] = [];

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupGainUpperHandScenario(match, gainUpperHandCard, drawCard);
        await setHarnessDiceValues(match.hostPage, Array.from({ length: 16 }, () => 6));
        await setHarnessRandomQueue(match.hostPage, repeatRandomValue(0.99, 8));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.hostPage, GAIN_UPPER_HAND_CARD_ID);
        await dispatchDiceThroneCommand(match.hostPage, {
            type: 'PLAY_CARD',
            playerId: '0',
            payload: { cardId: GAIN_UPPER_HAND_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.hostPage);
        await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1 });
        await expect.poll(async () => {
            const core = await readServerCore(match.matchId, match.hostPage);
            const settlement = asRecord(core.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            return dice.length;
        }, {
            timeout: 10000,
            message: '等待占得上风奖励骰结算状态出现',
        }).toBe(1);

        const coreWithSettlement = await readServerCore(match.matchId, match.hostPage);
        const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        const rolledFace = String(asRecord(dice[0]).face ?? '');
        rolledFaces.push(rolledFace || '<empty>');

        if (rolledFace === ZHANSHUJIA_DICE_FACE_IDS.MEDAL) {
            await saveEvidenceScreenshot(match.hostPage, testInfo, '72-host-gain-upper-hand-bonus-die-right-tray-medal');
        }

        await settleBonusDiceOnPage(match, match.hostPage);
        await waitForDiscardContains(match.matchId, match.hostPage, '0', GAIN_UPPER_HAND_CARD_ID);

        if (rolledFace === ZHANSHUJIA_DICE_FACE_IDS.MEDAL) {
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 4);
            await waitForHandCount(match.matchId, match.hostPage, '0', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '73-host-gain-upper-hand-medal-applied');
            return;
        }

        await waitForHandCount(match.matchId, match.hostPage, '0', 1);
    }

    throw new Error(`12 次真实打出占得上风后仍未命中奖励骰勋章分支；实际骰面序列: ${rolledFaces.join(', ')}`);
};

const playMarkedForDeathBonusBranch = async (
    match: MatchSetup,
    drawCards: JsonRecord[],
    testInfo: TestInfo,
): Promise<{
    cutlassCount: number;
    lootCount: number;
    skullCount: number;
    guestCp: number;
    guestHandCount: number;
    hostCursedCoin: number;
    hostHp: number;
}> => {
    const markedForDeathSlot = match.guestPage
        .locator('[data-testid="player-board-surface"] [data-resolved-ability-id="marked-for-death"]')
        .first();

    await setupMarkedForDeathScenario(match, drawCards);
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);

    await expect(markedForDeathSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    await markedForDeathSlot.click();

    const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advanceButton).toBeEnabled({ timeout: 10000 });
    await advanceButton.click();

    await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 4 });
    await saveEvidenceScreenshot(match.guestPage, testInfo, '33-guest-marked-for-death-bonus-dice-right-tray');

    await expect.poll(async () => {
        const core = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(core.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        return dice.length;
    }, {
        timeout: 10000,
        message: '等待死亡印记奖励骰结算状态出现',
    }).toBe(4);

    const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
    const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
    const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
    const cutlassCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS).length;
    const lootCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.LOOT).length;
    const skullCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.SKULL).length;

    await settleBonusDiceOnPage(match, match.guestPage);

    await expect.poll(async () => {
        const core = await readServerCore(match.matchId, match.guestPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const hostStatuses = asRecord(host.statusEffects);
        const guestResources = asRecord(guest.resources);
        const guestHand = Array.isArray(guest.hand) ? guest.hand as JsonRecord[] : [];
        return {
            guestCp: Number(guestResources[RESOURCE_IDS.CP] ?? 0),
            guestHandCount: guestHand.length,
            hostCursedCoin: Number(hostStatuses[STATUS_IDS.CURSED_COIN] ?? 0),
            hostHp: Number(hostResources[RESOURCE_IDS.HP] ?? 0),
        };
    }, { timeout: 10000 }).toEqual({
        guestCp: 7,
        guestHandCount: lootCount,
        hostCursedCoin: skullCount,
        hostHp: 50 - (2 * cutlassCount),
    });

    return {
        cutlassCount,
        lootCount,
        skullCount,
        guestCp: 7,
        guestHandCount: lootCount,
        hostCursedCoin: skullCount,
        hostHp: 50 - (2 * cutlassCount),
    };
};

const playFlayBonusBranch = async (
    match: MatchSetup,
    flayCard: JsonRecord,
    testInfo: TestInfo,
): Promise<{
    cutlassCount: number;
    bonusDamage: number;
    hostPowderKeg: number;
    guestCp: number;
}> => {
    await setupFlayScenario(match, flayCard);
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);

    await dispatchDiceThroneCommand(match.guestPage, {
        type: 'PLAY_CARD',
        playerId: '1',
        payload: { cardId: FLAY_CARD_ID },
    });

    await dismissCardSpotlightIfPresent(match.guestPage);
    await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 5 });
    await saveEvidenceScreenshot(match.guestPage, testInfo, '31-guest-flay-bonus-dice-right-tray');

    await expect.poll(async () => {
        const core = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(core.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        return dice.length;
    }, {
        timeout: 10000,
        message: '等待抽筋剥皮奖励骰结算状态出现',
    }).toBe(5);

    const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
    const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
    const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
    const cutlassCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS).length;

    await settleBonusDiceOnPage(match, match.guestPage);

    await expect.poll(async () => {
        const core = await readServerCore(match.matchId, match.guestPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);
        const guestDiscard = Array.isArray(guest.discard) ? guest.discard as JsonRecord[] : [];
        const hostStatuses = asRecord(host.statusEffects);
        const pendingAttack = asRecord(core.pendingAttack);
        return {
            bonusDamage: Number(pendingAttack.bonusDamage ?? 0),
            hostPowderKeg: Number(hostStatuses[STATUS_IDS.POWDER_KEG] ?? 0),
            guestCp: Number(guestResources[RESOURCE_IDS.CP] ?? 0),
            discardContainsFlay: guestDiscard.some(card => card.id === FLAY_CARD_ID),
        };
    }, { timeout: 10000 }).toEqual({
        bonusDamage: cutlassCount,
        hostPowderKeg: cutlassCount >= 3 ? 1 : 0,
        guestCp: 3,
        discardContainsFlay: true,
    });

    return {
        cutlassCount,
        bonusDamage: cutlassCount,
        hostPowderKeg: cutlassCount >= 3 ? 1 : 0,
        guestCp: 3,
    };
};

const playWarMonger2BonusBranch = async (
    match: MatchSetup,
    drawCard: JsonRecord,
    testInfo: TestInfo,
): Promise<{
    extraRollValue: number;
    hostHandIds: string[];
    hostTacticalAdvantage: number;
    guestHp: number;
    extraAttackAttackerId: string | null;
    pendingAttackSourceId: string | null;
    pendingAttackDamage: number;
    pendingAttackIsDefendable: boolean | null;
    phase: string | null;
}> => {
    const warMongerSlot = match.hostPage.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
    await setupWarMonger2Scenario(match, drawCard);
    await setHarnessRandomQueue(match.hostPage, repeatRandomValue(0.99, 8));
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);

    await expect(warMongerSlot).toHaveAttribute('data-resolved-ability-id', 'war-monger', { timeout: 10000 });
    await expect(warMongerSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    await warMongerSlot.click();

    await waitForPendingAttack(match.matchId, match.hostPage, {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'war-monger',
    });

    const advanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advanceButton).toBeEnabled({ timeout: 10000 });
    await advanceButton.click();

    await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1, sourceAbilityId: 'war-monger' });
    await saveEvidenceScreenshot(match.hostPage, testInfo, '29-host-war-monger-2-bonus-die-right-tray-branch');
    const pendingBonusCore = await readServerCore(match.matchId, match.hostPage);
    const pendingBonusSettlement = asRecord(pendingBonusCore.pendingBonusDiceSettlement);
    const pendingBonusDice = Array.isArray(pendingBonusSettlement.dice) ? pendingBonusSettlement.dice as JsonRecord[] : [];
    const pendingBonusDie = asRecord(pendingBonusDice[0]);
    const bonusRollValue = Number(pendingBonusDie.value ?? 0);
    const bonusSettlementSourceAbilityId = String(pendingBonusSettlement.sourceAbilityId ?? 'war-monger');
    await settleBonusDiceOnPage(match, match.hostPage, { sourceAbilityId: 'war-monger' });

    const deadline = Date.now() + 5000;
    let lastSnapshot: JsonRecord | null = null;
    while (Date.now() < deadline) {
        const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
        const hostTokens = asRecord(host.tokens);
        const guestResources = asRecord(guest.resources);
        const extraAttack = asRecord(core.extraAttackInProgress);
        const pendingAttack = asRecord(core.pendingAttack);
        lastSnapshot = {
            handIds: hostHand.map(card => card.id),
            extraAttackAttackerId: extraAttack.attackerId ?? null,
            pendingAttack,
            hostTacticalAdvantage: hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0,
            guestHp: guestResources[RESOURCE_IDS.HP] ?? 0,
            phase: sys.phase ?? core.phase ?? null,
            bonusRollValue,
        };
        if (bonusRollValue > 0) {
            if (bonusRollValue === 6 && extraAttack.attackerId !== '0') {
                await match.hostPage.waitForTimeout(250);
                continue;
            }
            return {
                extraRollValue: bonusRollValue,
                hostHandIds: hostHand.map(card => card.id as string),
                hostTacticalAdvantage: Number(hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0),
                guestHp: Number(guestResources[RESOURCE_IDS.HP] ?? 0),
                extraAttackAttackerId: typeof extraAttack.attackerId === 'string' ? extraAttack.attackerId : null,
                pendingAttackSourceId: typeof pendingAttack.sourceAbilityId === 'string' ? pendingAttack.sourceAbilityId : bonusSettlementSourceAbilityId,
                pendingAttackDamage: Number(pendingAttack.damage ?? 0),
                pendingAttackIsDefendable: typeof pendingAttack.isDefendable === 'boolean' ? pendingAttack.isDefendable : null,
                phase: typeof (sys.phase ?? core.phase) === 'string' ? String(sys.phase ?? core.phase) : null,
            };
        }
        await match.hostPage.waitForTimeout(250);
    }

    throw new Error(`战争贩子 II 奖励骰分支状态未达预期: ${JSON.stringify(lastSnapshot)}`);
};

const playWarMongerBonusBranch = async (
    match: MatchSetup,
    drawCard: JsonRecord,
    testInfo: TestInfo,
): Promise<{
    extraRollValue: number;
    hostHandIds: string[];
    hostTacticalAdvantage: number;
    guestHp: number;
    extraAttackAttackerId: string | null;
    pendingAttackSourceId: string | null;
    pendingAttackDamage: number;
    pendingAttackIsDefendable: boolean | null;
    phase: string | null;
}> => {
    const warMongerSlot = match.hostPage.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
    await setupWarMongerScenario(match, drawCard);
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);

    await expect(warMongerSlot).toHaveAttribute('data-resolved-ability-id', 'war-monger', { timeout: 10000 });
    await expect(warMongerSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    await warMongerSlot.click();

    await waitForPendingAttack(match.matchId, match.hostPage, {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'war-monger',
    });

    const advanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advanceButton).toBeEnabled({ timeout: 10000 });
    await advanceButton.click();

    await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1, sourceAbilityId: 'war-monger' });
    await saveEvidenceScreenshot(match.hostPage, testInfo, '78-host-war-monger-bonus-die-right-tray-branch');
    const pendingBonusCore = await readServerCore(match.matchId, match.hostPage);
    const pendingBonusSettlement = asRecord(pendingBonusCore.pendingBonusDiceSettlement);
    const pendingBonusDice = Array.isArray(pendingBonusSettlement.dice) ? pendingBonusSettlement.dice as JsonRecord[] : [];
    const pendingBonusDie = asRecord(pendingBonusDice[0]);
    const bonusRollValue = Number(pendingBonusDie.value ?? 0);
    const bonusSettlementSourceAbilityId = String(pendingBonusSettlement.sourceAbilityId ?? 'war-monger');
    await settleBonusDiceOnPage(match, match.hostPage, { sourceAbilityId: 'war-monger' });

    const deadline = Date.now() + 5000;
    let lastSnapshot: JsonRecord | null = null;
    while (Date.now() < deadline) {
        const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
        const hostTokens = asRecord(host.tokens);
        const guestResources = asRecord(guest.resources);
        const extraAttack = asRecord(core.extraAttackInProgress);
        const pendingAttack = asRecord(core.pendingAttack);
        lastSnapshot = {
            handIds: hostHand.map(card => card.id),
            extraAttackAttackerId: extraAttack.attackerId ?? null,
            pendingAttack,
            hostTacticalAdvantage: hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0,
            guestHp: guestResources[RESOURCE_IDS.HP] ?? 0,
            phase: sys.phase ?? core.phase ?? null,
            bonusRollValue,
        };
        if (bonusRollValue > 0) {
            return {
                extraRollValue: bonusRollValue,
                hostHandIds: hostHand.map(card => card.id as string),
                hostTacticalAdvantage: Number(hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0),
                guestHp: Number(guestResources[RESOURCE_IDS.HP] ?? 0),
                extraAttackAttackerId: typeof extraAttack.attackerId === 'string' ? extraAttack.attackerId : null,
                pendingAttackSourceId: typeof pendingAttack.sourceAbilityId === 'string' ? pendingAttack.sourceAbilityId : bonusSettlementSourceAbilityId,
                pendingAttackDamage: Number(pendingAttack.damage ?? 0),
                pendingAttackIsDefendable: typeof pendingAttack.isDefendable === 'boolean' ? pendingAttack.isDefendable : null,
                phase: typeof (sys.phase ?? core.phase) === 'string' ? String(sys.phase ?? core.phase) : null,
            };
        }
        await match.hostPage.waitForTimeout(250);
    }

    throw new Error(`战争贩子奖励骰分支状态未达预期: ${JSON.stringify(lastSnapshot)}`);
};

const playWeighAnchorUntilSkull = async (
    match: MatchSetup,
    weighAnchorCard: JsonRecord,
    drawCard: JsonRecord,
    testInfo: TestInfo,
): Promise<void> => {
    const rolledFaces: string[] = [];

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupWeighAnchorScenario(match, weighAnchorCard, drawCard);
        await setHarnessDiceValues(match.guestPage, Array.from({ length: 16 }, () => 6));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, WEIGH_ANCHOR_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: WEIGH_ANCHOR_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
        await expect.poll(async () => {
            const core = await readServerCore(match.matchId, match.guestPage);
            const settlement = asRecord(core.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            return dice.length;
        }, {
            timeout: 10000,
            message: '等待起锚奖励骰结算状态出现',
        }).toBe(1);

        const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        const rolledFace = String(asRecord(dice[0]).face ?? '');
        rolledFaces.push(rolledFace || '<empty>');

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '74-guest-weigh-anchor-bonus-die-right-tray-skull');
        }

        await settleBonusDiceOnPage(match, match.guestPage);
        await waitForDiscardContains(match.matchId, match.guestPage, '1', WEIGH_ANCHOR_CARD_ID);

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForHandCount(match.matchId, match.guestPage, '1', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '75-host-weigh-anchor-parley-applied');
            return;
        }

        await waitForHandCount(match.matchId, match.guestPage, '1', 1);
    }

    throw new Error(`12 次真实打出起锚后仍未命中奖励骰骷髅分支；实际骰面序列: ${rolledFaces.join(', ')}`);
};

const playWeighAnchorUntilDraw = async (
    match: MatchSetup,
    weighAnchorCard: JsonRecord,
    drawCard: JsonRecord,
    testInfo: TestInfo,
): Promise<void> => {
    const rolledFaces: string[] = [];

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupWeighAnchorScenario(match, weighAnchorCard, drawCard);
        await setHarnessDiceValues(match.guestPage, Array.from({ length: 16 }, () => 1));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, WEIGH_ANCHOR_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: WEIGH_ANCHOR_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
        await expect.poll(async () => {
            const core = await readServerCore(match.matchId, match.guestPage);
            const settlement = asRecord(core.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            return dice.length;
        }, {
            timeout: 10000,
            message: '等待起锚默认分支奖励骰结算状态出现',
        }).toBe(1);

        const coreWithSettlement = await readServerCore(match.matchId, match.guestPage);
        const settlement = asRecord(coreWithSettlement.pendingBonusDiceSettlement);
        const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
        const rolledFace = String(asRecord(dice[0]).face ?? '');
        rolledFaces.push(rolledFace || '<empty>');

        if (rolledFace !== CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '143-guest-weigh-anchor-bonus-die-right-tray-draw');
        }

        await settleBonusDiceOnPage(match, match.guestPage);
        await waitForDiscardContains(match.matchId, match.guestPage, '1', WEIGH_ANCHOR_CARD_ID);

        if (rolledFace !== CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await waitForHandIds(match.matchId, match.guestPage, '1', [drawCard.id as string]);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 0);
            await waitForHandCardVisualReady(match.guestPage, drawCard.id as string);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '144-guest-weigh-anchor-draw-applied');
            return;
        }

        await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
    }

    throw new Error(`12 次真实打出起锚后仍未命中默认抽牌分支；实际骰面序列: ${rolledFaces.join(', ')}`);
};

const playPowderKegUpkeepUntilExplode = async (
    match: MatchSetup,
    powderKegCount: number,
    testInfo: TestInfo,
): Promise<void> => {
    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupPowderKegUpkeepScenario(match, powderKegCount);
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        if (attempt === 1) {
            await saveEvidenceScreenshot(match.hostPage, testInfo, '56-host-powder-keg-upkeep-before-advance');
        }

        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
        });

        let resolution: {
            phase: string;
            hostHp: number;
            hostPowderKeg: number;
            interactionSourceAbilityId: string;
        } | null = null;
        for (let waitStep = 0; waitStep < 50; waitStep += 1) {
            const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
            const players = asRecordMap(core.players);
            const host = asRecord(players['0']);
            const resources = asRecord(host.resources);
            const statusEffects = asRecord(host.statusEffects);
            const interaction = asRecord(asRecord(sys.interaction).current);
            resolution = {
                phase: String(sys.phase ?? core.phase ?? ''),
                hostHp: Number(resources[RESOURCE_IDS.HP] ?? 0),
                hostPowderKeg: Number(statusEffects[STATUS_IDS.POWDER_KEG] ?? 0),
                interactionSourceAbilityId: String(interaction.sourceAbilityId ?? ''),
            };
            if (
                resolution.phase !== 'discard'
                || resolution.hostHp !== 50
                || resolution.hostPowderKeg !== powderKegCount
                || resolution.interactionSourceAbilityId !== ''
            ) {
                break;
            }
            await match.hostPage.waitForTimeout(200);
        }

        if (!resolution) {
            throw new Error('读取火药桶维持阶段结算状态失败');
        }

        if (resolution.hostHp === 47 && resolution.hostPowderKeg === 0) {
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '57-host-powder-keg-upkeep-exploded');
            return;
        }
    }

    throw new Error('12 次真实推进火药桶维持阶段后仍未命中爆炸分支');
};

const playPowderKegUpkeepTransfer = async (
    match: MatchSetup,
    guestPowderKegCount: number,
    testInfo: TestInfo,
    screenshotPrefix: {
        before: string;
        choice: string;
        applied: string;
    },
) => {
    await setupPowderKegUpkeepScenario(match, 1, guestPowderKegCount, 1, repeatRandomValue(6, 8));
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);
    await expect.poll(async () => {
        const root = await readServerRoot(match.matchId, match.hostPage);
        const interaction = asRecord(asRecord(root.sys.interaction).current);
        const players = asRecordMap(root.core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostStatuses = asRecord(host.statusEffects);
        const guestStatuses = asRecord(guest.statusEffects);
        const interactionData = asRecord(interaction.data);
        return {
            phase: String(root.sys.phase ?? root.core.phase ?? ''),
            activePlayerId: String(root.core.activePlayerId ?? ''),
            sourceAbilityId: String(interactionData.sourceId ?? ''),
            type: String(interaction.kind ?? ''),
            hostPowderKeg: Number(hostStatuses[STATUS_IDS.POWDER_KEG] ?? 0),
            guestPowderKeg: Number(guestStatuses[STATUS_IDS.POWDER_KEG] ?? 0),
            guestCursedCoin: Number(guestStatuses[STATUS_IDS.CURSED_COIN] ?? 0),
            currentChoiceSourceAbilityId: String(root.core.currentChoiceSourceAbilityId ?? ''),
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'upkeep',
        activePlayerId: '0',
        sourceAbilityId: 'upkeep-powder-keg',
        type: 'simple-choice',
        hostPowderKeg: 1,
    });

    await saveEvidenceScreenshot(match.hostPage, testInfo, screenshotPrefix.before);

    const transferTargetButton = match.hostPage.getByRole('button', { name: /转交给 P2|P2|对手|Opponent/i }).first();
    await expect(transferTargetButton).toBeVisible({ timeout: 10000 });
    await saveEvidenceScreenshot(match.hostPage, testInfo, screenshotPrefix.choice);

    await transferTargetButton.click();

    await expect.poll(async () => {
        const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostResources = asRecord(host.resources);
        const guestResources = asRecord(guest.resources);
        const hostStatuses = asRecord(host.statusEffects);
        const guestStatuses = asRecord(guest.statusEffects);
        const interaction = asRecord(asRecord(sys.interaction).current);
        const interactionData = asRecord(interaction.data);
        return {
            hostHp: Number(hostResources[RESOURCE_IDS.HP] ?? 0),
            guestHp: Number(guestResources[RESOURCE_IDS.HP] ?? 0),
            hostPowderKeg: Number(hostStatuses[STATUS_IDS.POWDER_KEG] ?? 0),
            guestPowderKeg: Number(guestStatuses[STATUS_IDS.POWDER_KEG] ?? 0),
            interactionSourceAbilityId: String(interactionData.sourceId ?? ''),
        };
    }, { timeout: 10000 }).toMatchObject({
        hostHp: 50,
        guestHp: guestPowderKegCount > 0 ? 47 : 50,
        hostPowderKeg: 0,
        guestPowderKeg: 1,
        interactionSourceAbilityId: '',
    });

    await saveEvidenceScreenshot(match.hostPage, testInfo, screenshotPrefix.applied);
};

const enterWarMongerMedalExtraAttackPhase = async (match: MatchSetup) => {
    let lastSnapshot: JsonRecord | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
        const extraAttack = asRecord(core.extraAttackInProgress);
        lastSnapshot = {
            phase: sys.phase ?? core.phase ?? null,
            activePlayerId: core.activePlayerId ?? null,
            extraAttackAttackerId: extraAttack.attackerId ?? null,
            extraAttackPhaseEntered: extraAttack.phaseEntered ?? null,
            hasPendingAttack: Boolean(core.pendingAttack),
        };

        if (
            lastSnapshot.phase === 'offensiveRoll'
            && lastSnapshot.activePlayerId === '0'
            && lastSnapshot.extraAttackAttackerId === '0'
            && lastSnapshot.extraAttackPhaseEntered === true
            && lastSnapshot.hasPendingAttack === false
        ) {
            return;
        }

        await advancePhaseForActivePlayer(match);
    }

    throw new Error(`战争贩子勋章分支未进入额外进攻投掷阶段: ${JSON.stringify(lastSnapshot)}`);
};

const finishWarMongerSabreDefenseAndReturnGuestHp = async (
    match: MatchSetup,
    expectedDamage: number,
): Promise<number> => {
    await expect.poll(async () => {
        const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
        const pendingAttack = asRecord(core.pendingAttack);
        return {
            phase: sys.phase ?? core.phase ?? null,
            defenderId: pendingAttack.defenderId ?? null,
            sourceAbilityId: pendingAttack.sourceAbilityId ?? null,
            damage: Number(pendingAttack.damage ?? 0),
            isDefendable: pendingAttack.isDefendable ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'defensiveRoll',
        defenderId: '1',
        sourceAbilityId: 'war-monger',
        damage: expectedDamage,
        isDefendable: true,
    });

    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        root.core = {
            ...core,
            dice: buildDiceForValues('cursed_pirate-dice', [6, 4, 4, 4], {
                4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
            }),
            rollCount: 1,
            rollLimit: 1,
            rollDiceCount: 4,
            rollConfirmed: true,
        };
        return state;
    });

    await dismissDefenseShowcaseIfPresent(match.guestPage);

    const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advanceButton).toBeEnabled({ timeout: 10000 });
    await advanceButton.click();

    await closeCombatChainUntilSettled(match, match.hostPage, 10);

    return expect.poll(async () => {
        const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);
        return {
            phase: sys.phase ?? core.phase ?? null,
            hasPendingAttack: Boolean(core.pendingAttack),
            guestHp: Number(guestResources[RESOURCE_IDS.HP] ?? 0),
        };
    }, { timeout: 15000 }).toMatchObject({
        phase: 'main2',
        hasPendingAttack: false,
    }).then(async () => {
        const { core } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const guest = asRecord(players['1']);
        const guestResources = asRecord(guest.resources);
        return Number(guestResources[RESOURCE_IDS.HP] ?? 0);
    });
};

const playWarMonger2UntilMedalBranch = async (
    match: MatchSetup,
    drawCard: JsonRecord,
    testInfo: TestInfo,
): Promise<{
    hostHandIds: string[];
    extraAttackAttackerId: string | null;
    pendingAttackSourceId: string | null;
    phase: string | null;
    activePlayerId: string | null;
}> => {
    let lastBranch: Awaited<ReturnType<typeof playWarMonger2BonusBranch>> | null = null;

    for (let attempt = 1; attempt <= 18; attempt += 1) {
        const branch = await playWarMonger2BonusBranch(match, drawCard, testInfo);
        lastBranch = branch;
        if (branch.extraRollValue === 6) {
            await enterWarMongerMedalExtraAttackPhase(match);
            const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
            const players = asRecordMap(core.players);
            const host = asRecord(players['0']);
            const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
            const extraAttack = asRecord(core.extraAttackInProgress);
            return {
                hostHandIds: hostHand.map(card => card.id as string),
                extraAttackAttackerId: typeof extraAttack.attackerId === 'string' ? extraAttack.attackerId : null,
                pendingAttackSourceId: branch.pendingAttackSourceId,
                phase: typeof (sys.phase ?? core.phase) === 'string' ? String(sys.phase ?? core.phase) : null,
                activePlayerId: typeof core.activePlayerId === 'string' ? String(core.activePlayerId) : null,
            };
        }
    }

    throw new Error(`18 次真实触发战争贩子 II 后仍未命中勋章分支: ${JSON.stringify(lastBranch)}`);
};

const playCrowsNestUntilBranch = async (
    match: MatchSetup,
    crowsNestCard: JsonRecord,
    targetCards: JsonRecord[],
    targetBranch: CrowsNestBranch,
): Promise<void> => {
    for (let attempt = 1; attempt <= 30; attempt += 1) {
        await setupCrowsNestScenario(match, crowsNestCard, targetCards);
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: CROWS_NEST_CARD_ID },
        });

        const branch = await waitForCrowsNestBranch(match.matchId, match.guestPage);
        if (branch === targetBranch) {
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);
            return;
        }
    }

    throw new Error(`30 次真实打出瞭望台后仍未命中 ${targetBranch} 分支`);
};

test.describe('DiceThrone 战术家 / 咒缚海盗新增英雄 intake', () => {
    test('真实在线双玩家应能选择战术家和咒缚海盗并看到面板、提示板、手牌与 HUD', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, {
            skipImageGate: true,
            characterSelectionTimeout: CHARACTER_SELECTION_TIMEOUT,
        });
        if (!match) {
            test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
            return;
        }

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await expectCharacterCardVisible(match.hostPage, HOST_HERO_ID);
            await expectCharacterCardVisible(match.hostPage, GUEST_HERO_ID);
            await expectCharacterCardVisible(match.guestPage, HOST_HERO_ID);
            await expectCharacterCardVisible(match.guestPage, GUEST_HERO_ID);

            await selectCharacter(match.hostPage, HOST_HERO_ID);
            await selectCharacter(match.guestPage, GUEST_HERO_ID);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-host-selection-zhanshujia-cursed-pirate');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '02-guest-selection-zhanshujia-cursed-pirate');

            await readyAndStartGame(match.hostPage, match.guestPage);
            await waitForGameBoard(match.hostPage);
            await waitForGameBoard(match.guestPage);
            await waitForDiceThroneHarness(match.hostPage);
            await waitForDiceThroneHarness(match.guestPage);
            await waitForSelectedHeroes(match.hostPage);
            await waitForSelectedHeroes(match.guestPage);

            await expect(match.hostPage.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', HOST_HERO_ID, { timeout: 10000 });
            await expect(match.guestPage.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', GUEST_HERO_ID, { timeout: 10000 });
            await expect(match.hostPage.getByTestId('tip-board-surface')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByTestId('tip-board-surface')).toBeVisible({ timeout: 10000 });
            await waitForBoardImageReady(match.hostPage, 'player-board-image');
            await waitForBoardImageReady(match.hostPage, 'tip-board-image');
            await waitForBoardImageReady(match.guestPage, 'player-board-image');
            await waitForBoardImageReady(match.guestPage, 'tip-board-image');
            await expect(match.hostPage.getByTestId('hand-area')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByTestId('hand-area')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 10000 });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-host-gameplay-zhanshujia-board-tip-hud');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '04-guest-gameplay-cursed-pirate-board-tip-hud');

            const hostCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], HOST_CARD_ID);
            const hostCommonCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], COMMON_UNEXPECTED_CARD_ID);
            const guestCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GUEST_CARD_ID);
            const guestCommonCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], COMMON_UNEXPECTED_CARD_ID);
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                const hostResources = asRecord(host.resources);
                const guestResources = asRecord(guest.resources);

                players['0'] = {
                    ...host,
                    hand: [hostCard, hostCommonCard],
                    resources: { ...hostResources, [RESOURCE_IDS.CP]: 5 },
                };
                players['1'] = {
                    ...guest,
                    hand: [guestCard, guestCommonCard],
                    resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
                };

                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                };
                return state;
            });

            await waitForHandCardVisualReady(match.hostPage, HOST_CARD_ID);
            await waitForHandCardVisualReady(match.hostPage, COMMON_UNEXPECTED_CARD_ID);
            await waitForHandCardVisualReady(match.guestPage, GUEST_CARD_ID);
            await waitForHandCardVisualReady(match.guestPage, COMMON_UNEXPECTED_CARD_ID);
            await expect(match.hostPage.locator(`[data-testid="hand-area"] [data-card-id="${HOST_CARD_ID}"]`).first()).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.locator(`[data-testid="hand-area"] [data-card-id="${COMMON_UNEXPECTED_CARD_ID}"]`).first()).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.locator(`[data-testid="hand-area"] [data-card-id="${GUEST_CARD_ID}"]`).first()).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.locator(`[data-testid="hand-area"] [data-card-id="${COMMON_UNEXPECTED_CARD_ID}"]`).first()).toBeVisible({ timeout: 10000 });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-host-zhanshujia-hand-card-atlas');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '06-guest-cursed-pirate-hand-card-atlas');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算战术家升级牌的共享替换链', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);
        const warMongerUpgradeCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], WAR_MONGER_2_UPGRADE_CARD_ID);

        try {
            await setupWarMonger2UpgradeCardScenario(match, warMongerUpgradeCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const warMongerSlot = match.hostPage
                .getByTestId('player-board-surface')
                .locator('[data-ability-slot="sky"]')
                .first();

            await waitForHandCardVisualReady(match.hostPage, WAR_MONGER_2_UPGRADE_CARD_ID);
            await expect(warMongerSlot).toHaveAttribute('data-base-ability-id', 'war-monger', { timeout: 10000 });
            await expect(warMongerSlot).toHaveAttribute('data-upgrade-card-interactive', 'false', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '76-host-war-monger-upgrade-card-before-play');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'PLAY_UPGRADE_CARD',
                playerId: '0',
                payload: {
                    cardId: WAR_MONGER_2_UPGRADE_CARD_ID,
                    targetAbilityId: 'war-monger',
                },
            });

            await dismissCardSpotlightIfPresent(match.hostPage);
            await waitForHandCount(match.matchId, match.hostPage, '0', 0);

            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.hostPage);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const resources = asRecord(host.resources);
                const abilityLevels = asRecord(host.abilityLevels);
                const upgradeCardByAbilityId = asRecord(host.upgradeCardByAbilityId);
                const warMongerUpgrade = asRecord(upgradeCardByAbilityId['war-monger']);
                const discard = Array.isArray(host.discard) ? host.discard as JsonRecord[] : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    warMongerLevel: abilityLevels['war-monger'],
                    upgradeCardId: warMongerUpgrade.cardId,
                    discardIds: discard.map(card => card.id),
                };
            }, {
                timeout: 10000,
                message: '等待战争贩子 II 升级牌真实写入 abilityLevels / upgradeCardByAbilityId',
            }).toEqual({
                cp: 3,
                warMongerLevel: 2,
                upgradeCardId: WAR_MONGER_2_UPGRADE_CARD_ID,
                discardIds: [],
            });

            await expect(warMongerSlot).toHaveAttribute('data-upgrade-card-interactive', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '77-host-war-monger-upgrade-card-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应逐张把其余战术家升级牌写入对应升级槽位', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            for (const [index, proof] of ZHANSHUJIA_UPGRADE_CARD_PROOFS.entries()) {
                const upgradeCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], proof.cardId);
                const beforeScreenshot = `${186 + index * 2}-host-${proof.screenshotPrefix}-before-play`;
                const afterScreenshot = `${187 + index * 2}-host-${proof.screenshotPrefix}-applied`;

                await test.step(`升级牌真实打出：${proof.cardId}`, async () => {
                    await setupZhanshujiaUpgradeCardScenario(match, upgradeCard, proof.targetAbilityId);
                    await dismissCardSpotlightIfPresent(match.hostPage);
                    await dismissCardSpotlightIfPresent(match.guestPage);

                    const upgradeSlot = match.hostPage
                        .getByTestId('player-board-surface')
                        .locator(`[data-base-ability-id="${proof.targetAbilityId}"]`)
                        .first();

                    await waitForHandCardVisualReady(match.hostPage, proof.cardId);
                    await expect(
                        match.hostPage.locator(`[data-testid="hand-area"] [data-card-id="${proof.cardId}"]`).first(),
                    ).toBeVisible({ timeout: 10000 });
                    await expect(upgradeSlot).toHaveAttribute('data-base-ability-id', proof.targetAbilityId, { timeout: 10000 });
                    await expect(upgradeSlot).toHaveAttribute('data-upgrade-card-interactive', 'false', { timeout: 10000 });
                    await saveEvidenceScreenshot(match.hostPage, testInfo, beforeScreenshot);

                    await dispatchDiceThroneCommand(match.hostPage, {
                        type: 'PLAY_UPGRADE_CARD',
                        playerId: '0',
                        payload: {
                            cardId: proof.cardId,
                            targetAbilityId: proof.targetAbilityId,
                        },
                    });

                    await dismissCardSpotlightIfPresent(match.hostPage);
                    await waitForHandCount(match.matchId, match.hostPage, '0', 0);

                    await expect.poll(async () => {
                        const core = await readServerCore(match.matchId, match.hostPage);
                        const players = asRecordMap(core.players);
                        const host = asRecord(players['0']);
                        const resources = asRecord(host.resources);
                        const abilityLevels = asRecord(host.abilityLevels);
                        const upgradeCardByAbilityId = asRecord(host.upgradeCardByAbilityId);
                        const upgradeRecord = asRecord(upgradeCardByAbilityId[proof.targetAbilityId]);
                        const discard = Array.isArray(host.discard) ? host.discard as JsonRecord[] : [];
                        return {
                            cp: resources[RESOURCE_IDS.CP],
                            abilityLevel: abilityLevels[proof.targetAbilityId],
                            upgradeCardId: upgradeRecord.cardId,
                            discardIds: discard.map(card => card.id),
                        };
                    }, {
                        timeout: 10000,
                        message: `等待升级牌 ${proof.cardId} 真实写入 abilityLevels / upgradeCardByAbilityId`,
                    }).toEqual({
                        cp: proof.expectedCp,
                        abilityLevel: proof.expectedLevel,
                        upgradeCardId: proof.cardId,
                        discardIds: [],
                    });

                    await expect(upgradeSlot).toHaveAttribute('data-upgrade-card-interactive', 'true', { timeout: 10000 });
                    await saveEvidenceScreenshot(match.hostPage, testInfo, afterScreenshot);
                });
            }
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实在线开局状态应保持战术家和咒缚海盗的角色绑定', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await waitForSelectedHeroes(match.hostPage);
            await waitForSelectedHeroes(match.guestPage);
            const hostCharacterId = await match.hostPage.getByTestId('player-board-surface').getAttribute('data-character-id');
            const guestCharacterId = await match.guestPage.getByTestId('player-board-surface').getAttribute('data-character-id');
            expect(hostCharacterId).toBe(HOST_HERO_ID);
            expect(guestCharacterId).toBe(GUEST_HERO_ID);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算战略防御与送你们去喂鱼的交互 UI', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const strategicDefenseCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID);
            const goFishCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID);

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                const hostResources = asRecord(host.resources);
                const guestResources = asRecord(guest.resources);

                players['0'] = {
                    ...host,
                    hand: [strategicDefenseCard],
                    tokens: {},
                    resources: { ...hostResources, [RESOURCE_IDS.CP]: 5 },
                };
                players['1'] = {
                    ...guest,
                    hand: [],
                    tokens: {},
                    statusEffects: {},
                    resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
                };

                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                };
                return state;
            });

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: STRATEGIC_DEFENSE_CARD_ID },
            });
            await expect(match.hostPage.getByTestId('dt-player-target-0')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('dt-player-target-1')).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '07-host-strategic-defense-target-choice');

            await match.hostPage.getByTestId('dt-player-target-1').click();
            await match.hostPage.locator('#modal-root').getByRole('button', { name: /确认|Confirm/i }).click();
            await waitForTokenStack(match.matchId, match.hostPage, '1', TOKEN_IDS.PROTECT, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '08-host-strategic-defense-protect-applied');

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                const hostResources = asRecord(host.resources);
                const guestResources = asRecord(guest.resources);

                players['0'] = {
                    ...host,
                    statusEffects: {},
                    resources: { ...hostResources, [RESOURCE_IDS.CP]: 5 },
                };
                players['1'] = {
                    ...guest,
                    hand: [goFishCard],
                    statusEffects: {},
                    resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
                };

                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                };
                return state;
            });

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: GO_FISH_CARD_ID },
            });
            await expect(match.guestPage.locator('#modal-root').getByText(/至多三名对手|powder keg/i)).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '09-guest-go-fish-powder-keg-choice');

            await match.guestPage.locator('#modal-root').getByRole('button', { name: /P1|对手|Opponent/i }).first().click();
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '10-guest-go-fish-powder-keg-applied');

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                const hostResources = asRecord(host.resources);
                const guestResources = asRecord(guest.resources);

                players['0'] = {
                    ...host,
                    statusEffects: {},
                    resources: { ...hostResources, [RESOURCE_IDS.CP]: 5 },
                };
                players['1'] = {
                    ...guest,
                    hand: [goFishCard],
                    statusEffects: {},
                    resources: { ...guestResources, [RESOURCE_IDS.CP]: 5 },
                };

                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                };
                return state;
            });

            const goFishSkipModal = match.guestPage.locator('#modal-root');
            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: GO_FISH_CARD_ID },
            });
            const goFishApplyOpponentButton = goFishSkipModal.getByRole('button', { name: /^施加给 P1$/ });
            const goFishSkipButton = goFishSkipModal.getByRole('button', { name: /^不施加火药桶$/ });
            await expect(goFishSkipModal).toContainText('选择至多三名对手获得火药桶', { timeout: 10000 });
            await expect(goFishApplyOpponentButton).toBeVisible({ timeout: 10000 });
            await expect(goFishSkipButton).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '159-guest-go-fish-skip-choice');
            await goFishSkipButton.click({ force: true });
            await expect(goFishSkipModal).toBeHidden({ timeout: 10000 });
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 0);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.POWDER_KEG, 0);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '160-guest-go-fish-skip-applied');

            const handSelectionCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], HAND_SELECTION_CARD_ID);
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const hostResources = asRecord(host.resources);

                players['0'] = {
                    ...host,
                    hand: [handSelectionCard],
                    discard: [],
                    resources: { ...hostResources, [RESOURCE_IDS.CP]: 5 },
                };

                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                    interaction: {
                        current: {
                            id: 'dt-interaction-e2e-select-hand-card',
                            kind: 'dt:card-interaction',
                            playerId: '0',
                            data: {
                                id: 'e2e-select-hand-card',
                                playerId: '0',
                                sourceCardId: 'deep-sea-dive',
                                sourceId: 'deep-sea-dive',
                                type: 'selectHandCard',
                                titleKey: 'interaction.selectHandCardToDiscard',
                                selectCount: 1,
                                selected: [],
                                targetPlayerIds: ['0'],
                            },
                        },
                        queue: [],
                    },
                };
                return state;
            });

            await expect(match.hostPage.locator('#modal-root')).toContainText('选择 1 张手牌弃置', { timeout: 10000 });
            await expect(match.hostPage.getByTestId(`dt-hand-card-option-${HAND_SELECTION_CARD_ID}`)).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId(`dt-hand-card-option-${HAND_SELECTION_CARD_ID}`)).toContainText('作战室');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '11-host-select-hand-card-choice');
            await match.hostPage.getByTestId(`dt-hand-card-option-${HAND_SELECTION_CARD_ID}`).click();
            await match.hostPage.locator('#modal-root').getByRole('button', { name: /确认|Confirm/i }).click();
            await waitForDiscardContains(match.matchId, match.hostPage, '0', HAND_SELECTION_CARD_ID);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '12-host-select-hand-card-discarded');

            const crowsNestCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID);
            const crowsNestTargetCards = [
                cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], HAND_SELECTION_CARD_ID),
                cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID),
            ];
            await playCrowsNestUntilBranch(match, crowsNestCard, crowsNestTargetCards, 'view');
            const crowsNestModal = match.guestPage.locator('#modal-root');
            await expect(crowsNestModal).toContainText('瞭望台：查看手牌', { timeout: 10000 });
            await expect(crowsNestModal).toContainText('作战室', { timeout: 10000 });
            await expect(crowsNestModal).toContainText('战略防御', { timeout: 10000 });
            await expect(crowsNestModal).not.toContainText(HAND_SELECTION_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '13-guest-crows-nest-view-hand');

            await crowsNestModal.getByRole('button', { name: /已查看|Checked/i }).click();
            await waitForHandIds(match.matchId, match.guestPage, '0', [HAND_SELECTION_CARD_ID, STRATEGIC_DEFENSE_CARD_ID]);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '14-guest-crows-nest-confirmed-hand-unchanged');

            await playCrowsNestUntilBranch(match, crowsNestCard, crowsNestTargetCards, 'loot');
            await expect(match.hostPage.locator('#modal-root')).toContainText('选择 1 张手牌弃置', { timeout: 10000 });
            await expect(match.hostPage.getByTestId(`dt-hand-card-option-${HAND_SELECTION_CARD_ID}`)).toContainText('作战室', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '15-host-crows-nest-loot-discard-choice');

            await match.hostPage.getByTestId(`dt-hand-card-option-${HAND_SELECTION_CARD_ID}`).click();
            await match.hostPage.locator('#modal-root').getByRole('button', { name: /确认|Confirm/i }).click();
            await waitForDiscardContains(match.matchId, match.hostPage, '0', HAND_SELECTION_CARD_ID);
            await waitForHandIds(match.matchId, match.hostPage, '0', [STRATEGIC_DEFENSE_CARD_ID]);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '16-host-crows-nest-loot-discarded');

            await playCrowsNestUntilBranch(match, crowsNestCard, crowsNestTargetCards, 'skull');
            await waitForHandCount(match.matchId, match.guestPage, '0', 1);
            await waitForDiscardCount(match.matchId, match.guestPage, '0', 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '17-host-crows-nest-skull-random-discarded');

            const warRoomCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], HOST_CARD_ID);
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const hostResources = asRecord(host.resources);

                players['0'] = {
                    ...host,
                    hand: [warRoomCard],
                    discard: [],
                    tokens: {},
                    resources: { ...hostResources, [RESOURCE_IDS.CP]: 5 },
                };

                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                    interaction: { current: undefined, queue: [] },
                };
                return state;
            });

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: HOST_CARD_ID },
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '18-host-war-room-bonus-die-right-tray');

            await settleBonusDiceOnPage(match, match.hostPage);
            await waitForTokenAtLeast(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '19-host-war-room-tactical-advantage-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实防御阶段入口应展示并结算反制措施与你还嫩了点', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDefenseEvidenceScenario(match, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
                defenseAbilityId: 'countermeasures',
                defenderDiceDefinitionId: 'zhanshujia-dice',
                defenderDiceValues: [1, 2, 4, 6],
                defenderFaceByValue: {
                    1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                    2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                    4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                    6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                },
            });
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '20-host-countermeasures-defense-before-resolve');
            await advancePhaseForActivePlayer(match);
            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 49);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '21-host-countermeasures-defense-resolved');

            await setupDefenseEvidenceScenario(match, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'sabre-thrust-3',
                defenseAbilityId: 'still-wet-behind-ears',
                defenderDiceDefinitionId: 'cursed_pirate-dice',
                defenderDiceValues: [1, 4, 6, 6, 6],
                defenderFaceByValue: {
                    1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                    4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
                },
            });
            await waitForDefensePhase(match.matchId, match.guestPage, '1', 'still-wet-behind-ears');
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '22-guest-still-wet-behind-ears-defense-before-resolve');

            await advancePhaseForActivePlayer(match);
            await closeCombatChainUntilSettled(match, match.guestPage, 8);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 49);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 6);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.CURSED_COIN, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '23-guest-still-wet-behind-ears-defense-resolved');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实防御阶段入口应展示并结算反制措施 II 与 III 的升级参数链', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDefenseEvidenceScenario(match, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
                defenseAbilityId: 'countermeasures',
                defenderDiceDefinitionId: 'zhanshujia-dice',
                defenderDiceValues: [1, 2, 4, 6, 6],
                defenderFaceByValue: {
                    1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                    2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                    4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                    6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                },
            });
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                players['0'] = {
                    ...host,
                    abilities: Array.isArray(host.abilities)
                        ? (host.abilities as JsonRecord[]).map((ability) => (
                            ability.id === 'countermeasures'
                                ? { ...structuredClone(COUNTERMEASURES_2 as unknown as JsonRecord), id: 'countermeasures' }
                                : ability
                        ))
                        : host.abilities,
                    abilityLevels: {
                        ...asRecord(host.abilityLevels),
                        countermeasures: 2,
                    },
                };
                root.core = {
                    ...core,
                    players,
                };
                return state;
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                    abilityLevel: asRecord(host.abilityLevels).countermeasures ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
                abilityLevel: 2,
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '177-host-countermeasures-2-defense-entry');
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 49);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '178-host-countermeasures-2-resolved');

            await setupDefenseEvidenceScenario(match, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
                defenseAbilityId: 'countermeasures',
                defenderDiceDefinitionId: 'zhanshujia-dice',
                defenderDiceValues: [1, 2, 4, 6, 6],
                defenderFaceByValue: {
                    1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                    2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                    4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                    6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                },
            });
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                players['0'] = {
                    ...host,
                    abilities: Array.isArray(host.abilities)
                        ? (host.abilities as JsonRecord[]).map((ability) => (
                            ability.id === 'countermeasures'
                                ? { ...structuredClone(COUNTERMEASURES_3 as unknown as JsonRecord), id: 'countermeasures' }
                                : ability
                        ))
                        : host.abilities,
                    abilityLevels: {
                        ...asRecord(host.abilityLevels),
                        countermeasures: 3,
                    },
                };
                root.core = {
                    ...core,
                    players,
                };
                return state;
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                    abilityLevel: asRecord(host.abilityLevels).countermeasures ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
                abilityLevel: 3,
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '179-host-countermeasures-3-defense-entry');
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 48);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '180-host-countermeasures-3-resolved');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过咒缚面 fist 槽位触发并结算灵魂突刺的三同值火药桶链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupCursedSoulStabScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const soulStabSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(soulStabSlot).toHaveAttribute('data-base-ability-id', 'soul-stab', { timeout: 10000 });
            await expect(soulStabSlot).toHaveAttribute('data-resolved-ability-id', 'soul-stab-3', { timeout: 10000 });
            await expect(soulStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '135-guest-cursed-soul-stab-entry');

            await soulStabSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6], {
                        6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '136-host-cursed-soul-stab-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 45);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '137-host-cursed-soul-stab-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在持有凋零时通过咒缚面 fist 槽位触发并减少灵魂突刺的攻击伤害', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupCursedSoulStabScenario(match, { guestWitherStacks: 1 });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.WITHER, 1);
            const soulStabSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(soulStabSlot).toHaveAttribute('data-base-ability-id', 'soul-stab', { timeout: 10000 });
            await expect(soulStabSlot).toHaveAttribute('data-resolved-ability-id', 'soul-stab-3', { timeout: 10000 });
            await expect(soulStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '204-guest-cursed-soul-stab-wither-entry');

            await soulStabSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6], {
                        6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '205-host-cursed-soul-stab-wither-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 46);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.WITHER, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '206-host-cursed-soul-stab-wither-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在持有凋零时通过咒缚面 combo 槽位触发并减少死亡吐息的攻击伤害', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupBreathOfDeathScenario(match);
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const guestStatuses = asRecord(guest.statusEffects);
                players['1'] = {
                    ...guest,
                    statusEffects: {
                        ...guestStatuses,
                        [STATUS_IDS.WITHER]: 1,
                    },
                };
                root.core = {
                    ...core,
                    players,
                };
                return state;
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.WITHER, 1);
            const breathOfDeathSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]')
                .first();
            await expect(breathOfDeathSlot).toHaveAttribute('data-base-ability-id', 'breath-of-death', { timeout: 10000 });
            await expect(breathOfDeathSlot).toHaveAttribute('data-resolved-ability-id', 'breath-of-death-small', { timeout: 10000 });
            await expect(breathOfDeathSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '216-guest-breath-of-death-wither-entry');

            await breathOfDeathSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'breath-of-death-small',
            });

            await match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6], {
                        6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '217-host-breath-of-death-wither-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 44);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.WITHER, 1);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.WITHER, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '218-host-breath-of-death-wither-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过 ultimate 槽位触发并结算制胜高地的前置链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHighGroundScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const highGroundSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="ultimate"]')
                .first();
            await expect(highGroundSlot).toHaveAttribute('data-resolved-ability-id', 'high-ground', { timeout: 10000 });
            await expect(highGroundSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '58-host-high-ground-offensive-entry');

            await highGroundSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'high-ground',
            });

            const advanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await waitForTokenLimit(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 6);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 6);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.TARGETED, 1);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '59-host-high-ground-pre-defense-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并进入军刀突刺的攻击链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupSabreThrustScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const sabreThrustSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(sabreThrustSlot).toHaveAttribute('data-base-ability-id', 'sabre-thrust', { timeout: 10000 });
            await expect(sabreThrustSlot).toHaveAttribute('data-resolved-ability-id', 'sabre-thrust-3', { timeout: 10000 });
            await expect(sabreThrustSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '82-host-sabre-thrust-offensive-entry');

            await sabreThrustSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'sabre-thrust-3',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '83-guest-sabre-thrust-defense-entry');

            await match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').click();
            await closeCombatChainUntilSettled(match, match.guestPage, 8);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 46);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '84-host-sabre-thrust-resolved');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算军刀突刺 II 的三同值紧缚链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupSabreThrust2Scenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const sabreThrustSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(sabreThrustSlot).toHaveAttribute('data-base-ability-id', 'sabre-thrust', { timeout: 10000 });
            await expect(sabreThrustSlot).toHaveAttribute('data-resolved-ability-id', 'sabre-thrust-2-3', { timeout: 10000 });
            await expect(sabreThrustSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '100-host-sabre-thrust-2-entry');

            await sabreThrustSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'sabre-thrust-2-3',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '101-guest-sabre-thrust-2-defense-entry');

            for (let step = 0; step < 8; step += 1) {
                const core = await readServerCore(match.matchId, match.hostPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const guestStatusEffects = asRecord(guest.statusEffects);
                const guestAbilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];

                if (
                    guest.playerBoardFace === 'cursed'
                    && !guestAbilities.includes('human-cursed')
                    && guestAbilities.includes('soul-stab')
                    && Number(guestStatusEffects[STATUS_IDS.CURSED_COIN] ?? 0) === 0
                ) {
                    break;
                }

                const activePlayerId = String(core.activePlayerId ?? '');
                if (activePlayerId !== '0' && activePlayerId !== '1') {
                    throw new Error(`human-cursed 无币翻面链缺少有效 activePlayerId: ${JSON.stringify({
                        activePlayerId,
                        playerBoardFace: guest.playerBoardFace ?? null,
                        cursedCoin: guestStatusEffects[STATUS_IDS.CURSED_COIN] ?? 0,
                    })}`);
                }

                const activePage = activePlayerId === '0' ? match.hostPage : match.guestPage;
                await dispatchDiceThroneCommand(activePage, {
                    type: 'ADVANCE_PHASE',
                    playerId: activePlayerId,
                    payload: {},
                });
                await activePage.waitForTimeout(250);
            }
            await closeCombatChainUntilSettled(match, match.guestPage, 8);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 45);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '102-host-sabre-thrust-2-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算地毯式轰炸 II 的旗帜分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const drawCards = [
                cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID),
                cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], GAIN_UPPER_HAND_CARD_ID),
            ];
            await setupCarpetBombing2StrategyScenario(match, drawCards);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const carpetBombingSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="chi"]')
                .first();
            await expect(carpetBombingSlot).toHaveAttribute('data-base-ability-id', 'carpet-bombing', { timeout: 10000 });
            await expect(carpetBombingSlot).toHaveAttribute('data-resolved-ability-id', 'carpet-bombing-2-strategy', { timeout: 10000 });
            await expect(carpetBombingSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '103-host-carpet-bombing-2-strategy-entry');

            await carpetBombingSlot.click();
            const advanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            if (await advanceButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
                await advanceButton.click();
            }

            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 3);
            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.hostPage);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const hand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
                const handIds = hand.map(card => String(card.id ?? '')).sort();
                return {
                    handCount: hand.length,
                    handIds,
                    pendingAttack: Boolean(asRecord(core.pendingAttack).sourceAbilityId),
                };
            }, { timeout: 10000 }).toMatchObject({
                handCount: 2,
                handIds: [GAIN_UPPER_HAND_CARD_ID, STRATEGIC_DEFENSE_CARD_ID].sort(),
                pendingAttack: false,
            });
            await waitForHandCardVisualReady(match.hostPage, STRATEGIC_DEFENSE_CARD_ID);
            await waitForHandCardVisualReady(match.hostPage, GAIN_UPPER_HAND_CARD_ID);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '104-host-carpet-bombing-2-strategy-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算战略转移 II 的主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupStrategicShift2Scenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const strategicShiftSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="calm"]')
                .first();
            await expect(strategicShiftSlot).toHaveAttribute('data-base-ability-id', 'strategic-shift', { timeout: 10000 });
            await expect(strategicShiftSlot).toHaveAttribute('data-resolved-ability-id', 'strategic-shift-2-main', { timeout: 10000 });
            await expect(strategicShiftSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '85-host-strategic-shift-2-entry');

            await strategicShiftSlot.click();
            const variantModal = match.hostPage.locator('#modal-root');
            await expect(variantModal).toContainText(/选择发动变体/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/战略转移 II（4个勋章）/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/战略转移 II（3个勋章）/i, { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '86-host-strategic-shift-2-variant-choice');

            await variantModal.getByRole('button', { name: /战略转移 II（4个勋章）/i }).click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'strategic-shift-2-main',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 5);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 45);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '87-host-strategic-shift-2-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算战略转移 II 的侦察分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupStrategicShift2Scenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const strategicShiftSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="calm"]')
                .first();
            await expect(strategicShiftSlot).toHaveAttribute('data-base-ability-id', 'strategic-shift', { timeout: 10000 });
            await expect(strategicShiftSlot).toHaveAttribute('data-resolved-ability-id', 'strategic-shift-2-main', { timeout: 10000 });
            await expect(strategicShiftSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '207-host-strategic-shift-2-recon-entry');

            await strategicShiftSlot.click();
            const variantModal = match.hostPage.locator('#modal-root');
            await expect(variantModal).toContainText(/选择发动变体/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/战略转移 II（4个勋章）/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/战略转移 II（3个勋章）/i, { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '208-host-strategic-shift-2-recon-choice');

            await variantModal.getByRole('button', { name: /战略转移 II（3个勋章）/i }).click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'strategic-shift-2-recon',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 5);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 0);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                const interaction = asRecord(asRecord((await readServerRoot(match.matchId, match.hostPage)).sys).interaction);
                return {
                    pendingAttackSource: pendingAttack.sourceAbilityId ?? null,
                    currentInteraction: asRecord(interaction.current).type ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                pendingAttackSource: null,
                currentInteraction: null,
            });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '209-host-strategic-shift-2-recon-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的间接接敌分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDrumMovement2Scenario(match);
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [1, 2, 3, 4, 6], {
                        1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                        2: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                        3: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                        4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                        6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                };
                return state;
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const drumMovementSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]')
                .first();
            await expect(drumMovementSlot).toHaveAttribute('data-base-ability-id', 'drum-movement', { timeout: 10000 });
            await expect(drumMovementSlot).toHaveAttribute('data-resolved-ability-id', 'drum-movement-2-indirect', { timeout: 10000 });
            await expect(drumMovementSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '210-host-drum-movement-2-indirect-entry');

            await drumMovementSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'drum-movement-2-indirect',
            });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '211-host-drum-movement-2-indirect-choice');
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 2);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 0);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 48);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '212-host-drum-movement-2-indirect-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算开拓战场 II 的全面封锁分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupExpandBattlefield2Scenario(match);
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [1, 4, 4, 5, 6], {
                        1: ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                        4: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                        5: ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                        6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                };
                return state;
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const expandBattlefieldSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lightning"]')
                .first();
            await expect(expandBattlefieldSlot).toHaveAttribute('data-base-ability-id', 'expand-battlefield', { timeout: 10000 });
            await expect(expandBattlefieldSlot).toHaveAttribute('data-resolved-ability-id', 'expand-battlefield-2-lockdown', { timeout: 10000 });
            await expect(expandBattlefieldSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '213-host-expand-battlefield-2-lockdown-entry');

            await expandBattlefieldSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'expand-battlefield-2-lockdown',
            });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '214-host-expand-battlefield-2-lockdown-choice');
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForHandCount(match.matchId, match.hostPage, '0', 2);
            await waitForHandCardVisualReady(match.hostPage, STRATEGIC_DEFENSE_CARD_ID);
            await waitForHandCardVisualReady(match.hostPage, GAIN_UPPER_HAND_CARD_ID);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '215-host-expand-battlefield-2-lockdown-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算战略转移的基础主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupStrategicShiftScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const strategicShiftSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="calm"]')
                .first();
            await expect(strategicShiftSlot).toHaveAttribute('data-base-ability-id', 'strategic-shift', { timeout: 10000 });
            await expect(strategicShiftSlot).toHaveAttribute('data-resolved-ability-id', 'strategic-shift', { timeout: 10000 });
            await expect(strategicShiftSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '163-host-strategic-shift-entry');

            await strategicShiftSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'strategic-shift',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 5);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 0);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 45);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '164-host-strategic-shift-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算摇鼓运动的基础主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDrumMovementScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const drumMovementSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]')
                .first();
            await expect(drumMovementSlot).toHaveAttribute('data-base-ability-id', 'drum-movement', { timeout: 10000 });
            await expect(drumMovementSlot).toHaveAttribute('data-resolved-ability-id', 'drum-movement', { timeout: 10000 });
            await expect(drumMovementSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '165-host-drum-movement-entry');

            await drumMovementSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'drum-movement',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '166-guest-drum-movement-defense-entry');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForTokenStack(match.matchId, match.guestPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 0);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 43);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '167-host-drum-movement-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDrumMovement2Scenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const drumMovementSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]')
                .first();
            await expect(drumMovementSlot).toHaveAttribute('data-base-ability-id', 'drum-movement', { timeout: 10000 });
            await expect(drumMovementSlot).toHaveAttribute('data-resolved-ability-id', 'drum-movement-2-main', { timeout: 10000 });
            await expect(drumMovementSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '88-host-drum-movement-2-entry');

            await drumMovementSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'drum-movement-2-main',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '89-guest-drum-movement-2-defense-entry');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForTokenStack(match.matchId, match.guestPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 1);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 43);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '90-host-drum-movement-2-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupExpandBattlefieldScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const expandBattlefieldSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lightning"]')
                .first();
            await expect(expandBattlefieldSlot).toHaveAttribute('data-base-ability-id', 'expand-battlefield', { timeout: 10000 });
            await expect(expandBattlefieldSlot).toHaveAttribute('data-resolved-ability-id', 'expand-battlefield', { timeout: 10000 });
            await expect(expandBattlefieldSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '168-host-expand-battlefield-entry');

            await expandBattlefieldSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'expand-battlefield',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '169-guest-expand-battlefield-defense-entry');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForTokenStack(match.matchId, match.guestPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 2);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 41);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '170-host-expand-battlefield-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算包夹侧翼的基础主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupFlankingScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const flankingSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]')
                .first();
            await expect(flankingSlot).toHaveAttribute('data-base-ability-id', 'flanking', { timeout: 10000 });
            await expect(flankingSlot).toHaveAttribute('data-resolved-ability-id', 'flanking', { timeout: 10000 });
            await expect(flankingSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '171-host-flanking-entry');

            await flankingSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'flanking',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '172-guest-flanking-defense-entry');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForTokenStack(match.matchId, match.guestPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 44);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '173-host-flanking-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过升级后的玩家板槽位触发并结算包夹侧翼 II 的参数链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupFlanking2Scenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const flankingSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]')
                .first();
            await expect(flankingSlot).toHaveAttribute('data-base-ability-id', 'flanking', { timeout: 10000 });
            await expect(flankingSlot).toHaveAttribute('data-resolved-ability-id', 'flanking', { timeout: 10000 });
            await expect(flankingSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '181-host-flanking-2-entry');

            await flankingSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'flanking',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '182-guest-flanking-2-defense-entry');

            await match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').click();
            await closeCombatChainUntilSettled(match, match.guestPage, 8);
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 2);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 44);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '183-host-flanking-2-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过玩家板槽位触发并结算开拓战场 II 的大顺主分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupExpandBattlefield2Scenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const expandBattlefieldSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lightning"]')
                .first();
            await expect(expandBattlefieldSlot).toHaveAttribute('data-base-ability-id', 'expand-battlefield', { timeout: 10000 });
            await expect(expandBattlefieldSlot).toHaveAttribute('data-resolved-ability-id', 'expand-battlefield-2-large-straight', { timeout: 10000 });
            await expect(expandBattlefieldSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '91-host-expand-battlefield-2-entry');

            await expandBattlefieldSlot.click();
            const variantModal = match.hostPage.locator('#modal-root');
            await expect(variantModal).toContainText(/选择发动变体/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/开拓战场 II/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/大顺子/i, { timeout: 10000 });
            await expect(variantModal).toContainText(/军刀.*旗帜.*勋章/i, { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '92-host-expand-battlefield-2-variant-choice');

            await variantModal.getByRole('button', { name: /开拓战场 II.*大顺子/i }).click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'expand-battlefield-2-large-straight',
            });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed_pirate-dice', [4, 4, 4, 4, 4], {
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 5,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '93-guest-expand-battlefield-2-defense-entry');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForTokenStack(match.matchId, match.guestPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 3);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 41);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '94-host-expand-battlefield-2-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过战术优势被动按钮完成转移状态双阶段交互', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupTacticalAdvantageTransferScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const transferPassiveButton = match.hostPage.getByTestId('passive-action-zhanshujia-tactical-advantage-5');
            await expect(transferPassiveButton).toBeVisible({ timeout: 10000 });
            await expect(transferPassiveButton).toContainText(/转移|Transfer/i);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '60-host-tactical-advantage-transfer-entry');

            await transferPassiveButton.click();

            const hostModal = match.hostPage.locator('#modal-root');
            await expect(hostModal).toContainText(/选择要转移的状态效果|select/i, { timeout: 10000 });
            const hostBindEffect = match.hostPage.getByTestId('dt-status-effect-0-bind');
            await expect(hostBindEffect).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '61-host-tactical-advantage-select-bind');

            await hostBindEffect.click();
            await expect(match.hostPage.getByTestId('dt-transfer-source-locked-0')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('dt-transfer-target-1')).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '62-host-tactical-advantage-select-target');

            await match.hostPage.getByTestId('dt-transfer-target-1').click();
            await hostModal.getByRole('button', { name: /确认|Confirm/i }).click();

            await expect(hostModal).toBeHidden({ timeout: 10000 });
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 0);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.BIND, 0);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.BIND, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '63-host-tactical-advantage-transfer-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过战术优势被动按钮施加锁定并收口到对手状态区', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupTacticalAdvantageTargetedScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const targetedPassiveButton = match.hostPage.getByTestId('passive-action-zhanshujia-tactical-advantage-3');
            await expect(targetedPassiveButton).toBeVisible({ timeout: 10000 });
            await expect(targetedPassiveButton).toContainText(/锁定|Targeted/i);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '202-host-tactical-advantage-targeted-entry');

            await targetedPassiveButton.click();

            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 0);
            await waitForStatusStack(match.matchId, match.hostPage, '1', STATUS_IDS.TARGETED, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '203-host-tactical-advantage-targeted-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupBindOffensiveRollScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const rollButton = match.guestPage.locator('[data-tutorial-id="dice-roll-button"]');
            const confirmButton = match.guestPage.locator('[data-tutorial-id="dice-confirm-button"]');

            await expect(rollButton).toBeVisible({ timeout: 10000 });
            await expect(rollButton).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '64-guest-bind-extra-roll-before-reroll');

            await setHarnessDiceValues(match.guestPage, [1, 1, 4, 6, 6, 1, 1, 4, 6, 6]);
            await rollButton.click();
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 4);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '65-guest-bind-extra-roll-cp-spent');

            await expect(confirmButton).toBeEnabled({ timeout: 10000 });
            await confirmButton.click();
            await expect.poll(async () => match.guestPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const root = (state?.G ?? state) as { core?: { rollConfirmed?: boolean }; sys?: { phase?: string } } | undefined;
                return {
                    phase: root?.sys?.phase ?? null,
                    rollConfirmed: root?.core?.rollConfirmed ?? null,
                };
            }), { timeout: 10000 }).toMatchObject({
                phase: 'offensiveRoll',
                rollConfirmed: true,
            });
            const advancePhaseStatus = await dispatchDiceThroneCommandWithTimeout(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
            });
            expect(advancePhaseStatus).toBe('ok');
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.BIND, 0);
            await expect.poll(async () => {
                const { sys } = await readServerRoot(match.matchId, match.guestPage);
                return sys.phase ?? null;
            }, { timeout: 10000 }).not.toBe('offensiveRoll');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '66-guest-bind-cleared-after-phase-exit');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实防御阶段入口应通过真实攻击流打出并结算伴装撤退', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDefenseResponseCardAttackScenario(match, TACTICAL_RETREAT_CARD_ID);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const soulStabSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-resolved-ability-id="soul-stab-3"]')
                .first();
            await expect(soulStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await soulStabSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            await expect.poll(async () => match.hostPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase ?? state?.core?.phase ?? null,
                    defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                };
            }), { timeout: 10000 }).toEqual({
                phase: 'defensiveRoll',
                defenderId: '0',
            });

            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await waitForHandCardVisualReady(match.hostPage, TACTICAL_RETREAT_CARD_ID);
            await closeDebugPanelIfOpen(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '67-host-tactical-retreat-defense-before-play');

            await match.hostPage.evaluate(() => {
                (window as Window & { __BG_LAST_COMMAND_REJECTED__?: unknown }).__BG_LAST_COMMAND_REJECTED__ = null;
            });
            await dragHandCardToPlay(match.hostPage, TACTICAL_RETREAT_CARD_ID);

            await match.hostPage.waitForFunction((cardId) => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const reject = (window as Window & { __BG_LAST_COMMAND_REJECTED__?: { commandType?: string } | null }).__BG_LAST_COMMAND_REJECTED__ ?? null;
                const handIds = state?.core?.players?.['0']?.hand?.map((card: { id?: string }) => card?.id) ?? [];
                const discardIds = state?.core?.players?.['0']?.discard?.map((card: { id?: string }) => card?.id) ?? [];
                return (reject?.commandType === 'PLAY_CARD') || (!handIds.includes(cardId) && discardIds.includes(cardId));
            }, TACTICAL_RETREAT_CARD_ID, { timeout: 10000 });

            const rejected = await match.hostPage.evaluate(() => {
                return (window as Window & { __BG_LAST_COMMAND_REJECTED__?: unknown }).__BG_LAST_COMMAND_REJECTED__ ?? null;
            });
            expect(rejected).toBeNull();

            await expect.poll(async () => match.hostPage.evaluate((bindStatusId) => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const hostDiscardIds = state?.core?.players?.['0']?.discard?.map((card: { id?: string }) => card?.id) ?? [];
                const hostDamageShields = state?.core?.players?.['0']?.damageShields ?? [];
                return {
                    discardIds: hostDiscardIds,
                    attackerBind: state?.core?.players?.['1']?.statusEffects?.[bindStatusId] ?? 0,
                    hostShieldValue: hostDamageShields[0]?.value ?? 0,
                };
            }, STATUS_IDS.BIND), { timeout: 10000 }).toMatchObject({
                discardIds: expect.arrayContaining([TACTICAL_RETREAT_CARD_ID]),
                attackerBind: 1,
                hostShieldValue: 3,
            });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '68-host-tactical-retreat-defense-resolved');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实防御阶段入口应通过真实攻击流打出并结算脱战', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupDefenseResponseCardAttackScenario(match, DISENGAGE_CARD_ID);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const soulStabSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-resolved-ability-id="soul-stab-3"]')
                .first();
            await expect(soulStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await soulStabSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-stab-3',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            await expect.poll(async () => match.hostPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase ?? state?.core?.phase ?? null,
                    defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                };
            }), { timeout: 10000 }).toEqual({
                phase: 'defensiveRoll',
                defenderId: '0',
            });

            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await waitForHandCardVisualReady(match.hostPage, DISENGAGE_CARD_ID);
            await closeDebugPanelIfOpen(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '69-host-disengage-defense-before-play');

            await match.hostPage.evaluate(() => {
                (window as Window & { __BG_LAST_COMMAND_REJECTED__?: unknown }).__BG_LAST_COMMAND_REJECTED__ = null;
            });
            await dragHandCardToPlay(match.hostPage, DISENGAGE_CARD_ID);

            await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '70-host-disengage-bonus-die-right-tray');

            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.hostPage);
                const settlement = asRecord(core.pendingBonusDiceSettlement);
                const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
                const firstDie = asRecord(dice[0]);
                return {
                    count: dice.length,
                    value: Number(firstDie.value ?? 0),
                    face: String(firstDie.face ?? ''),
                };
            }, { timeout: 10000 }).toMatchObject({
                count: 1,
            });

            const settlementCore = await readServerCore(match.matchId, match.hostPage);
            const settlement = asRecord(settlementCore.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            const firstDie = asRecord(dice[0]);
            const rolledFace = String(firstDie.face ?? '');
            expect([
                ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            ]).toContain(rolledFace);

            await settleBonusDiceOnPage(match, match.hostPage);

            const rejected = await match.hostPage.evaluate(() => {
                return (window as Window & { __BG_LAST_COMMAND_REJECTED__?: unknown }).__BG_LAST_COMMAND_REJECTED__ ?? null;
            });
            expect(rejected).toBeNull();

            await expect.poll(async () => match.hostPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const hostDiscardIds = state?.core?.players?.['0']?.discard?.map((card: { id?: string }) => card?.id) ?? [];
                const hostDamageShields = state?.core?.players?.['0']?.damageShields ?? [];
                const hostProtect = state?.core?.players?.['0']?.tokens?.protect ?? 0;
                const guestHp = state?.core?.players?.['1']?.resources?.hp ?? null;
                return {
                    discardIds: hostDiscardIds,
                    hostShieldValue: hostDamageShields[0]?.value ?? 0,
                    hostProtect,
                    guestHp,
                };
            }), { timeout: 10000 }).toMatchObject({
                discardIds: expect.arrayContaining([DISENGAGE_CARD_ID]),
            });

            const resolvedSnapshot = await match.hostPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const hostDiscardIds = state?.core?.players?.['0']?.discard?.map((card: { id?: string }) => card?.id) ?? [];
                const hostDamageShields = state?.core?.players?.['0']?.damageShields ?? [];
                const hostProtect = state?.core?.players?.['0']?.tokens?.protect ?? 0;
                const guestHp = state?.core?.players?.['1']?.resources?.hp ?? null;
                return {
                    discardIds: hostDiscardIds,
                    hostShieldValue: hostDamageShields[0]?.value ?? 0,
                    hostProtect,
                    guestHp,
                };
            });

            expect(resolvedSnapshot.discardIds).toContain(DISENGAGE_CARD_ID);
            if (rolledFace === ZHANSHUJIA_DICE_FACE_IDS.SABRE) {
                expect(resolvedSnapshot).toMatchObject({
                    hostShieldValue: 0,
                    hostProtect: 0,
                    guestHp: 48,
                });
            } else if (rolledFace === ZHANSHUJIA_DICE_FACE_IDS.BANNER) {
                expect(resolvedSnapshot).toMatchObject({
                    hostShieldValue: 3,
                    hostProtect: 0,
                    guestHp: 50,
                });
            } else {
                expect(resolvedSnapshot).toMatchObject({
                    hostShieldValue: 0,
                    hostProtect: 1,
                    guestHp: 50,
                });
            }

            await saveEvidenceScreenshot(match.hostPage, testInfo, '71-host-disengage-branch-resolved');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const targetCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], DEEP_SEA_DIVE_TARGET_CARD_ID);
            await setupDeepSeaDiveAttackScenario(match, targetCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const deepSeaDiveSlot = match.guestPage.locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]').first();
            await expect(deepSeaDiveSlot).toHaveAttribute('data-resolved-ability-id', 'deep-sea-dive', { timeout: 10000 });
            await expect(deepSeaDiveSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '24-guest-deep-sea-dive-offensive-entry');

            await deepSeaDiveSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'deep-sea-dive',
            });

            const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await expect(match.hostPage.locator('#modal-root')).toContainText('选择 1 张手牌弃置', { timeout: 10000 });
            await expect(match.hostPage.getByTestId(`dt-hand-card-option-${DEEP_SEA_DIVE_TARGET_CARD_ID}`)).toContainText('战略防御', { timeout: 10000 });
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.CP, 4);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.CP, 6);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.WITHER, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '25-host-deep-sea-dive-discard-choice');

            await match.hostPage.getByTestId(`dt-hand-card-option-${DEEP_SEA_DIVE_TARGET_CARD_ID}`).click();
            await match.hostPage.locator('#modal-root').getByRole('button', { name: /确认|Confirm/i }).click();
            await waitForDiscardContains(match.matchId, match.hostPage, '0', DEEP_SEA_DIVE_TARGET_CARD_ID);
            await waitForHandCount(match.matchId, match.hostPage, '0', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '26-host-deep-sea-dive-discarded');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算干票大的奖励骰分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const heftyCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], HEFTY_CARD_ID);
            await playHeftyUntilLoot(match, heftyCard, testInfo);

            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 5);
            await waitForHandCount(match.matchId, match.guestPage, '1', 2);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', HEFTY_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '28-guest-hefty-loot-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并结算占得上风的勋章分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const gainUpperHandCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], GAIN_UPPER_HAND_CARD_ID);
            const drawCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID);
            await playGainUpperHandUntilMedal(match, gainUpperHandCard, drawCard, testInfo);

            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 4);
            await waitForDiscardContains(match.matchId, match.hostPage, '0', GAIN_UPPER_HAND_CARD_ID);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算埋伏的即时战术优势链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const ambushCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], AMBUSH_CARD_ID);
            await setupAmbushScenario(match, ambushCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.hostPage, AMBUSH_CARD_ID);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '184-host-ambush-before-play');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: AMBUSH_CARD_ID },
            });

            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 2);
            await waitForDiscardContains(match.matchId, match.hostPage, '0', AMBUSH_CARD_ID);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '185-host-ambush-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并结算起锚的骷髅分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const weighAnchorCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], WEIGH_ANCHOR_CARD_ID);
            const drawCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID);
            await playWeighAnchorUntilSkull(match, weighAnchorCard, drawCard, testInfo);

            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', WEIGH_ANCHOR_CARD_ID);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并结算起锚的默认抽牌分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const weighAnchorCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], WEIGH_ANCHOR_CARD_ID);
            const drawCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID);
            await playWeighAnchorUntilDraw(match, weighAnchorCard, drawCard, testInfo);

            await waitForHandIds(match.matchId, match.guestPage, '1', [GO_FISH_CARD_ID]);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', WEIGH_ANCHOR_CARD_ID);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 0);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并结算虚张声势的弯刀分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const blusterCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], BLUSTER_CARD_ID);
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
            ];
            await playBlusterUntilCutlass(match, blusterCard, drawCards, testInfo);

            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 48);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', BLUSTER_CARD_ID);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并结算虚张声势的战利品抽 2 分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const blusterCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], BLUSTER_CARD_ID);
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
            ];
            await playBlusterUntilLoot(match, blusterCard, drawCards, testInfo);

            await waitForHandIds(match.matchId, match.guestPage, '1', [
                GO_FISH_CARD_ID,
                CROWS_NEST_CARD_ID,
            ]);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', BLUSTER_CARD_ID);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并结算虚张声势的骷髅施加火药桶分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const blusterCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], BLUSTER_CARD_ID);
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
            ];
            await playBlusterUntilSkull(match, blusterCard, drawCards, testInfo);

            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', BLUSTER_CARD_ID);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算诱饵的 2 点攻击伤害', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const sharkBaitCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], SHARK_BAIT_CARD_ID);
            await playSharkBaitModifier(match, sharkBaitCard, testInfo);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算诅咒卡牌的自伤抽牌分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const curseCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CURSE_CARD_ID);
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], HEFTY_CARD_ID),
            ];
            await setupCurseCardScenario(match, curseCard, drawCards);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: CURSE_CARD_ID },
            });

            const guestModal = match.guestPage.locator('#modal-root');
            const damage4Draw3Button = guestModal.getByRole('button', { name: /受到 4 点伤害并抽 3 张牌|Take 4 damage and draw 3 cards/i });
            await expect(guestModal).toContainText('诅咒卡牌：选择结算效果', { timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /抽 1 张牌|Draw 1 card/i })).toBeVisible({ timeout: 10000 });
            await expect(damage4Draw3Button).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '46-guest-curse-card-choice');

            await damage4Draw3Button.click();
            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 46);
            await waitForHandIds(match.matchId, match.guestPage, '1', [
                GO_FISH_CARD_ID,
                CROWS_NEST_CARD_ID,
                HEFTY_CARD_ID,
            ]);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', CURSE_CARD_ID);
            await waitForHandCardVisualReady(match.guestPage, GO_FISH_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '47-guest-curse-card-damage4draw3-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算诅咒卡牌的抽 1 张牌分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const curseCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CURSE_CARD_ID);
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
            ];
            await setupCurseCardScenario(match, curseCard, drawCards);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: CURSE_CARD_ID },
            });

            const guestModal = match.guestPage.locator('#modal-root');
            const drawOneButton = guestModal.getByRole('button', { name: /抽 1 张牌|Draw 1 card/i });
            await expect(guestModal).toContainText('诅咒卡牌：选择结算效果', { timeout: 10000 });
            await expect(drawOneButton).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '145-guest-curse-card-draw1-choice');

            await drawOneButton.click();
            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await waitForHandIds(match.matchId, match.guestPage, '1', [GO_FISH_CARD_ID]);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', CURSE_CARD_ID);
            await waitForHandCardVisualReady(match.guestPage, GO_FISH_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '146-guest-curse-card-draw1-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算诅咒卡牌的受 2 伤害抽 2 分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const curseCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CURSE_CARD_ID);
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
            ];
            await setupCurseCardScenario(match, curseCard, drawCards);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: CURSE_CARD_ID },
            });

            const guestModal = match.guestPage.locator('#modal-root');
            const damage2Draw2Button = guestModal.getByRole('button', { name: /受到 2 点伤害并抽 2 张牌|Take 2 damage and draw 2 cards/i });
            await expect(guestModal).toContainText('诅咒卡牌：选择结算效果', { timeout: 10000 });
            await expect(damage2Draw2Button).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '147-guest-curse-card-damage2draw2-choice');

            await damage2Draw2Button.click();
            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 48);
            await waitForHandIds(match.matchId, match.guestPage, '1', [
                GO_FISH_CARD_ID,
                CROWS_NEST_CARD_ID,
            ]);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', CURSE_CARD_ID);
            await waitForHandCardVisualReady(match.guestPage, GO_FISH_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '148-guest-curse-card-damage2draw2-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算封舱的弃手重抽链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const battenDownCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], BATTEN_DOWN_CARD_ID);
            const extraHandCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
            ];
            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], HEFTY_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], FLAY_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], RANSOM_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], SIP_CARD_ID),
            ];
            await setupBattenDownScenario(match, battenDownCard, extraHandCards, drawCards);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, BATTEN_DOWN_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '48-guest-batten-down-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: BATTEN_DOWN_CARD_ID },
            });

            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 1);
            await waitForHandIds(match.matchId, match.guestPage, '1', [
                HEFTY_CARD_ID,
                FLAY_CARD_ID,
                RANSOM_CARD_ID,
                SIP_CARD_ID,
            ]);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', BATTEN_DOWN_CARD_ID);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', GO_FISH_CARD_ID);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', CROWS_NEST_CARD_ID);
            await waitForDiscardCount(match.matchId, match.guestPage, '1', 3);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await waitForHandCardVisualReady(match.guestPage, HEFTY_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '49-guest-batten-down-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算分点给我的单目标火药桶链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const giveMeSomeCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GIVE_ME_SOME_CARD_ID);
            await setupGiveMeSomeScenario(match, giveMeSomeCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, GIVE_ME_SOME_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '50-guest-give-me-some-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: GIVE_ME_SOME_CARD_ID },
            });

            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', GIVE_ME_SOME_CARD_ID);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '51-guest-give-me-some-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算坏血病的自伤加凋零链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const scurvyCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], SCURVY_CARD_ID);
            await setupSimpleCursedPirateMainCardScenario(match, scurvyCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, SCURVY_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '153-guest-scurvy-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: SCURVY_CARD_ID },
            });

            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 49);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.WITHER, 1);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', SCURVY_CARD_ID);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '154-guest-scurvy-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算强取豪夺的偷取 CP 链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const pillageCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], PILLAGE_CARD_ID);
            await setupSimpleCursedPirateMainCardScenario(match, pillageCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, PILLAGE_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '155-guest-pillage-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: PILLAGE_CARD_ID },
            });

            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 6);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.CP, 4);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', PILLAGE_CARD_ID);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '156-guest-pillage-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算停战协议的单目标休战链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const parleyCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], PARLEY_CARD_ID);
            await setupSimpleCursedPirateMainCardScenario(match, parleyCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, PARLEY_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '157-guest-parley-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: PARLEY_CARD_ID },
            });

            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', PARLEY_CARD_ID);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '158-guest-parley-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算海盗的一生在咒缚面的治疗分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const piratesLifeCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GUEST_CARD_ID);
            await setupPiratesLifeScenario(match, piratesLifeCard, {
                face: 'cursed',
                hp: 45,
                cursedCoin: 1,
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, GUEST_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '210-guest-pirates-life-cursed-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: GUEST_CARD_ID },
            });

            const guestModal = match.guestPage.locator('#modal-root');
            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 48);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 1);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', GUEST_CARD_ID);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '211-guest-pirates-life-cursed-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算海盗的一生在普通面的诅咒金币选择链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const piratesLifeCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GUEST_CARD_ID);
            await setupPiratesLifeScenario(match, piratesLifeCard, {
                face: 'normal',
                hp: 50,
                cursedCoin: 1,
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await waitForHandCardVisualReady(match.guestPage, GUEST_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '212-guest-pirates-life-normal-before-play');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: GUEST_CARD_ID },
            });

            const guestModal = match.guestPage.locator('#modal-root');
            await expect(guestModal).toContainText('是否获得诅咒金币？', { timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^获得诅咒金币$/ })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '213-guest-pirates-life-normal-choice');
            await guestModal.getByRole('button', { name: /^获得诅咒金币$/ }).click();

            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 2);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', GUEST_CARD_ID);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '214-guest-pirates-life-normal-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在攻击者带有休战时阻断攻击伤害并在阶段结束清理状态', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanCutlassStabScenario(match);
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const guestStatuses = asRecord(guest.statusEffects);
                players['1'] = {
                    ...guest,
                    statusEffects: {
                        ...guestStatuses,
                        [STATUS_IDS.PARLEY]: 1,
                    },
                };
                root.core = {
                    ...core,
                    players,
                };
                return state;
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const cutlassStabSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(cutlassStabSlot).toHaveAttribute('data-base-ability-id', 'cutlass-stab', { timeout: 10000 });
            await expect(cutlassStabSlot).toHaveAttribute('data-resolved-ability-id', 'cutlass-stab-4', { timeout: 10000 });
            await expect(cutlassStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.PARLEY, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '174-guest-parley-block-before-attack');

            await cutlassStabSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'cutlass-stab-4',
            });

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [5, 5, 5, 5], {
                        5: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '175-host-parley-block-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.PARLEY, 0);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '176-host-parley-block-cleared');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在攻击者带有休战时通过咒缚面 combo 槽位阻断死亡吐息的攻击伤害并在阶段结束清理状态', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupBreathOfDeathScenario(match);
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const guestStatuses = asRecord(guest.statusEffects);
                players['1'] = {
                    ...guest,
                    statusEffects: {
                        ...guestStatuses,
                        [STATUS_IDS.PARLEY]: 1,
                    },
                };
                root.core = {
                    ...core,
                    players,
                };
                return state;
            });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const breathOfDeathSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]')
                .first();
            await expect(breathOfDeathSlot).toHaveAttribute('data-base-ability-id', 'breath-of-death', { timeout: 10000 });
            await expect(breathOfDeathSlot).toHaveAttribute('data-resolved-ability-id', 'breath-of-death-small', { timeout: 10000 });
            await expect(breathOfDeathSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.PARLEY, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '219-guest-breath-of-death-parley-entry');

            await breathOfDeathSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'breath-of-death-small',
            });

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [5, 5, 5, 5], {
                        5: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '220-host-breath-of-death-parley-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.PARLEY, 0);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.WITHER, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '221-host-breath-of-death-parley-cleared');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算赎金的跨玩家双步选择链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const ransomCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], RANSOM_CARD_ID);
            await setupRansomScenario(match, ransomCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: RANSOM_CARD_ID },
            });

            const guestModal = match.guestPage.locator('#modal-root');
            await expect(guestModal).toContainText('赎金：选择一颗对手骰子', { timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /骰子 1|Die 1/i })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '36-guest-ransom-die-choice');

            await guestModal.getByRole('button', { name: /骰子 1|Die 1/i }).click();

            const hostModal = match.hostPage.locator('#modal-root');
            await expect(hostModal).toContainText('赎金：是否支付 2CP？', { timeout: 10000 });
            await expect(hostModal.getByRole('button', { name: /支付 2CP|Pay 2 CP/i })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '37-host-ransom-pay-or-reroll');

            await hostModal.getByRole('button', { name: /支付 2CP|Pay 2 CP/i }).click();
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 6);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.CP, 3);
            await waitForDiscardContains(match.matchId, match.guestPage, '1', RANSOM_CARD_ID);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '38-guest-ransom-paid-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算啜呼的目标选择与奖励骰分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const sipCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], SIP_CARD_ID);
            await setupSipScenario(match, sipCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'PLAY_CARD',
                playerId: '1',
                payload: { cardId: SIP_CARD_ID },
            });

            const hostModal = match.hostPage.locator('#modal-root');
            await expect(hostModal).toContainText('啜呼：选择是否改为投骰', { timeout: 10000 });
            await expect(hostModal.getByRole('button', { name: /不获得火药桶|roll 1 die/i })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '39-host-sip-choice');

            await hostModal.getByRole('button', { name: /不获得火药桶|roll 1 die/i }).click();

            await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '40-host-sip-bonus-die-right-tray');

            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.hostPage);
                const settlement = asRecord(core.pendingBonusDiceSettlement);
                const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
                return dice.length;
            }, { timeout: 10000 }).toBe(1);

            const settlementCore = await readServerCore(match.matchId, match.hostPage);
            const settlement = asRecord(settlementCore.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            const rolledValue = Number(asRecord(dice[0]).value ?? 0);

            await settleBonusDiceOnPage(match, match.hostPage);
            await waitForDiscardContains(match.matchId, match.hostPage, '1', SIP_CARD_ID);

            if (rolledValue >= 3) {
                await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
                await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.WITHER, 1);
            } else {
                await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 0);
                await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.WITHER, 0);
            }
            await saveEvidenceScreenshot(match.hostPage, testInfo, '41-host-sip-branch-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算战争贩子 II 的奖励骰分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const drawCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID);
            const branch = await playWarMonger2BonusBranch(match, drawCard, testInfo);

            expect(branch.pendingAttackSourceId).toBe('war-monger');
            if (branch.extraRollValue === 6) {
                expect(branch.extraAttackAttackerId).toBe('0');
                expect(branch.hostHandIds).toContain(STRATEGIC_DEFENSE_CARD_ID);
            } else if (branch.extraRollValue === 4 || branch.extraRollValue === 5) {
                expect(branch.hostTacticalAdvantage).toBe(5);
                expect(branch.extraAttackAttackerId).toBeNull();
            } else {
                expect(branch.phase).toBe('defensiveRoll');
                expect(branch.pendingAttackDamage).toBe(6);
                expect(branch.pendingAttackIsDefendable).toBe(true);
                expect(branch.guestHp).toBe(50);
                const guestHpAfterDefense = await finishWarMongerSabreDefenseAndReturnGuestHp(match, 6);
                expect(guestHpAfterDefense).toBe(46);
            }
            await saveEvidenceScreenshot(match.hostPage, testInfo, '30-host-war-monger-2-branch-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算战争贩子的奖励骰分支与额外进攻阶段', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const drawCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID);
            const branch = await playWarMongerBonusBranch(match, drawCard, testInfo);

            expect(branch.pendingAttackSourceId).toBe('war-monger');
            if (branch.extraRollValue === 6) {
                expect(branch.extraAttackAttackerId).toBe('0');
                expect(branch.hostHandIds).toContain(STRATEGIC_DEFENSE_CARD_ID);
            } else if (branch.extraRollValue === 4 || branch.extraRollValue === 5) {
                expect(branch.hostTacticalAdvantage).toBe(5);
            } else {
                expect(branch.phase).toBe('defensiveRoll');
                expect(branch.pendingAttackDamage).toBe(5);
                expect(branch.pendingAttackIsDefendable).toBe(true);
                expect(branch.guestHp).toBe(50);
                const guestHpAfterDefense = await finishWarMongerSabreDefenseAndReturnGuestHp(match, 5);
                expect(guestHpAfterDefense).toBe(47);
            }

            if (branch.extraRollValue === 6) {
                await enterWarMongerMedalExtraAttackPhase(match);
            }
            await saveEvidenceScreenshot(match.hostPage, testInfo, '79-host-war-monger-extra-attack-phase');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应命中并保留战争贩子 II 勋章专门链的额外进攻阶段', async ({ browser }, testInfo) => {
        test.setTimeout(600000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const drawCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], STRATEGIC_DEFENSE_CARD_ID);
            const medalBranch = await playWarMonger2UntilMedalBranch(match, drawCard, testInfo);

            expect(medalBranch.pendingAttackSourceId).toBe('war-monger');
            expect(medalBranch.extraAttackAttackerId).toBe('0');
            expect(medalBranch.hostHandIds).toContain(STRATEGIC_DEFENSE_CARD_ID);
            expect(medalBranch.phase).toBe('offensiveRoll');
            expect(medalBranch.activePlayerId).toBe('0');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '35-host-war-monger-2-medal-extra-attack');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算抽筋剥皮的奖励骰分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const flayCard = cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], FLAY_CARD_ID);
            const branch = await playFlayBonusBranch(match, flayCard, testInfo);

            expect(branch.bonusDamage).toBe(branch.cutlassCount);
            expect(branch.guestCp).toBe(3);
            expect(branch.hostPowderKeg).toBe(branch.cutlassCount >= 3 ? 1 : 0);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '32-guest-flay-branch-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算死亡印记的奖励骰分支', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GUEST_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], HEFTY_CARD_ID),
            ];
            const branch = await playMarkedForDeathBonusBranch(match, drawCards, testInfo);

            expect(branch.guestCp).toBe(7);
            expect(branch.guestHandCount).toBe(branch.lootCount);
            expect(branch.hostCursedCoin).toBe(branch.skullCount);
            expect(branch.hostHp).toBe(50 - (2 * branch.cutlassCount));
            await saveEvidenceScreenshot(match.guestPage, testInfo, '34-guest-marked-for-death-branch-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算亡灵之爪的诅咒金币追加直伤链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupUndeadClawScenario(match, 3);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const undeadClawSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="calm"]')
                .first();
            await expect(undeadClawSlot).toHaveAttribute('data-resolved-ability-id', 'undead-claw', { timeout: 10000 });
            await expect(undeadClawSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '52-guest-undead-claw-before-attack');

            await undeadClawSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'undead-claw',
            });

            const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await closeCombatChainUntilSettled(match, match.guestPage);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 39);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.CURSED_COIN, 3);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '53-host-undead-claw-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过咒缚面 lightning 槽位触发并结算灵魂指令的多状态不可防御链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupSoulCommandScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const soulCommandSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lightning"]')
                .first();
            await expect(soulCommandSlot).toHaveAttribute('data-base-ability-id', 'soul-command', { timeout: 10000 });
            await expect(soulCommandSlot).toHaveAttribute('data-resolved-ability-id', 'soul-command', { timeout: 10000 });
            await expect(soulCommandSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '138-guest-soul-command-entry');

            await soulCommandSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'soul-command',
            });

            const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 42);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.WITHER, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '139-host-soul-command-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过咒缚面 combo 槽位触发并结算死亡吐息的小顺子多状态链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupBreathOfDeathScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const breathOfDeathSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]')
                .first();
            await expect(breathOfDeathSlot).toHaveAttribute('data-base-ability-id', 'breath-of-death', { timeout: 10000 });
            await expect(breathOfDeathSlot).toHaveAttribute('data-resolved-ability-id', 'breath-of-death-small', { timeout: 10000 });
            await expect(breathOfDeathSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '140-guest-breath-of-death-entry');

            await breathOfDeathSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'breath-of-death-small',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [6, 6, 6, 6], {
                        6: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '141-host-breath-of-death-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 43);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.WITHER, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '142-host-breath-of-death-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 lightning 槽位触发并结算判决指令的诅咒金币选择链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanVerdictCommandScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const verdictCommandSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lightning"]')
                .first();
            await expect(verdictCommandSlot).toHaveAttribute('data-resolved-ability-id', 'verdict-command', { timeout: 10000 });
            await expect(verdictCommandSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });

            await verdictCommandSlot.click();

            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'verdict-command',
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                const pendingAttack = asRecord(core.pendingAttack);

                return {
                    phase: sys.phase ?? core.phase ?? null,
                    activePlayerId: core.activePlayerId ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    selectedAbilityId: core.selectedAbilityId ?? null,
                    activatingAbilityId: core.activatingAbilityId ?? null,
                    abilityIds: abilities,
                    pendingAttackSourceAbilityId: pendingAttack.sourceAbilityId ?? null,
                    pendingAttackIsDefendable: pendingAttack.isDefendable ?? null,
                    pendingAttackPreDefenseResolved: pendingAttack.preDefenseResolved ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'offensiveRoll',
                activePlayerId: '1',
                playerBoardFace: 'normal',
                activatingAbilityId: 'verdict-command',
                pendingAttackSourceAbilityId: 'verdict-command',
                pendingAttackIsDefendable: true,
                pendingAttackPreDefenseResolved: null,
            });

            const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const interactionCurrent = asRecord(asRecord(sys.interaction).current);
                const interactionData = asRecord(interactionCurrent.data);
                const options = Array.isArray(interactionData.options)
                    ? interactionData.options.map((option) => {
                        const optionRecord = asRecord(option);
                        return optionRecord.labelKey ?? optionRecord.label ?? null;
                    })
                    : [];

                return {
                    phase: sys.phase ?? core.phase ?? null,
                    pendingAttackSourceAbilityId: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                    currentChoiceSourceAbilityId: core.currentChoiceSourceAbilityId ?? null,
                    interactionKind: interactionCurrent.kind ?? null,
                    interactionPlayerId: interactionCurrent.playerId ?? null,
                    interactionTitleKey: interactionData.titleKey ?? interactionData.title ?? null,
                    optionLabels: options,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'offensiveRoll',
                pendingAttackSourceAbilityId: 'verdict-command',
                currentChoiceSourceAbilityId: 'verdict-command',
                interactionKind: 'simple-choice',
                interactionPlayerId: '1',
                interactionTitleKey: 'choices.cursedCoinGain.title',
                optionLabels: [
                    'choices.cursedCoinGain.accept',
                    'choices.cursedCoinGain.decline',
                ],
            });

            const guestModal = match.guestPage.locator('#modal-root');
            const acceptCursedCoinButton = guestModal.getByRole('button', { name: /^获得诅咒金币$/ });
            await expect(guestModal).toContainText('是否获得诅咒金币？', { timeout: 10000 });
            await expect(acceptCursedCoinButton).toBeVisible({ timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^不获得$/ })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '105-guest-human-verdict-command-choice');

            await acceptCursedCoinButton.click();

            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 1);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 43);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '106-host-human-verdict-command-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 combo 槽位触发并结算点燃炸药的小顺子链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanLightTheFuseScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const lightTheFuseSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]')
                .first();
            await expect(lightTheFuseSlot).toHaveAttribute('data-base-ability-id', 'light-the-fuse', { timeout: 10000 });
            await expect(lightTheFuseSlot).toHaveAttribute('data-resolved-ability-id', 'light-the-fuse-small', { timeout: 10000 });
            await expect(lightTheFuseSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '107-guest-human-light-the-fuse-entry');

            await lightTheFuseSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'light-the-fuse-small',
            });

            const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [5, 5, 5, 5], {
                        5: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '108-host-human-light-the-fuse-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 43);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '109-host-human-light-the-fuse-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 ultimate 槽位触发并结算无情劫掠的诅咒金币续结链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanMercilessPlunderScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const mercilessPlunderSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="ultimate"]')
                .first();
            await expect(mercilessPlunderSlot).toHaveAttribute('data-base-ability-id', 'merciless-plunder', { timeout: 10000 });
            await expect(mercilessPlunderSlot).toHaveAttribute('data-resolved-ability-id', 'merciless-plunder', { timeout: 10000 });
            await expect(mercilessPlunderSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '110-guest-human-merciless-plunder-entry');

            await mercilessPlunderSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'merciless-plunder',
            });

            const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            const guestModal = match.guestPage.locator('#modal-root');
            const acceptCursedCoinButton = guestModal.getByRole('button', { name: /^获得诅咒金币$/ });
            await expect(guestModal).toContainText('是否获得诅咒金币？', { timeout: 10000 });
            await expect(acceptCursedCoinButton).toBeVisible({ timeout: 10000 });
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 38);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 0);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 0);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '111-guest-human-merciless-plunder-choice');

            await acceptCursedCoinButton.click();

            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 2);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 38);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '112-host-human-merciless-plunder-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 calm 槽位触发并结算惊魂动魄的移除诅咒金币链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanAstonishingScenario(match, 3);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const astonishingSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="calm"]')
                .first();
            await expect(astonishingSlot).toHaveAttribute('data-resolved-ability-id', 'astonishing', { timeout: 10000 });
            await expect(astonishingSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '113-guest-human-astonishing-entry');

            await astonishingSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'astonishing',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            const guestModal = match.guestPage.locator('#modal-root');
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const interactionCurrent = asRecord(asRecord(sys.interaction).current);
                const interactionData = asRecord(interactionCurrent.data);
                const options = Array.isArray(interactionData.options)
                    ? interactionData.options.map((option) => {
                        const optionRecord = asRecord(option);
                        return optionRecord.labelKey ?? optionRecord.label ?? null;
                    })
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    pendingAttackSourceAbilityId: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                    currentChoiceSourceAbilityId: core.currentChoiceSourceAbilityId ?? null,
                    interactionKind: interactionCurrent.kind ?? null,
                    interactionPlayerId: interactionCurrent.playerId ?? null,
                    interactionTitleKey: interactionData.titleKey ?? interactionData.title ?? null,
                    optionLabels: options,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'offensiveRoll',
                pendingAttackSourceAbilityId: 'astonishing',
                currentChoiceSourceAbilityId: 'astonishing',
                interactionKind: 'simple-choice',
                interactionPlayerId: '1',
                interactionTitleKey: 'choices.cursedPirateHumanRemoveCoins.title',
            });

            await expect(guestModal).toContainText('惊魂动魄：你可以移除任意数量的诅咒金币', { timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^不移除$/ })).toBeVisible({ timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^移除 2 个诅咒金币$/ })).toBeVisible({ timeout: 10000 });
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 43);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '114-guest-human-astonishing-choice');

            await guestModal.getByRole('button', { name: /^移除 2 个诅咒金币$/ }).click();

            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 1);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 43);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '115-guest-human-astonishing-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在 human-cursed 有诅咒金币时于回合结束移除 1 个并保持人类面', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanCursedEndTurnScenario(match, 3);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    hasHumanCursed: abilities.includes('human-cursed'),
                    cursedCoin: Number(asRecord(guest.statusEffects)[STATUS_IDS.CURSED_COIN] ?? 0),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'main2',
                playerBoardFace: 'normal',
                hasHumanCursed: true,
                cursedCoin: 3,
            });
            await waitForCursedPirateBoardFaceReady(match.guestPage, 'normal');

            await saveEvidenceScreenshot(match.guestPage, testInfo, '117-guest-human-cursed-before-end-turn');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 3);
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    hasHumanCursed: abilities.includes('human-cursed'),
                    hasSoulStab: abilities.includes('soul-stab'),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'discard',
                playerBoardFace: 'normal',
                hasHumanCursed: true,
                hasSoulStab: false,
            });
            await waitForCursedPirateBoardFaceReady(match.guestPage, 'normal');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '117b-guest-human-cursed-discard-phase');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 2);
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    hasHumanCursed: abilities.includes('human-cursed'),
                    hasSoulStab: abilities.includes('soul-stab'),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'main1',
                playerBoardFace: 'normal',
                hasHumanCursed: true,
                hasSoulStab: false,
            });
            await waitForCursedPirateBoardFaceReady(match.guestPage, 'normal');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '118-guest-human-cursed-coin-removed');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在 human-cursed 无诅咒金币时于回合结束翻回咒缚面', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanCursedEndTurnScenario(match, 0);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    hasHumanCursed: abilities.includes('human-cursed'),
                    cursedCoin: Number(asRecord(guest.statusEffects)[STATUS_IDS.CURSED_COIN] ?? 0),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'main2',
                playerBoardFace: 'normal',
                hasHumanCursed: true,
                cursedCoin: 0,
            });
            await waitForCursedPirateBoardFaceReady(match.guestPage, 'normal');

            await saveEvidenceScreenshot(match.guestPage, testInfo, '119-guest-human-cursed-flip-before-end-turn');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    hasHumanCursed: abilities.includes('human-cursed'),
                    cursedCoin: Number(asRecord(guest.statusEffects)[STATUS_IDS.CURSED_COIN] ?? 0),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'discard',
                playerBoardFace: 'normal',
                hasHumanCursed: true,
                cursedCoin: 0,
            });
            await waitForCursedPirateBoardFaceReady(match.guestPage, 'normal');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '119b-guest-human-cursed-discard-phase');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities)
                    ? guest.abilities.map((ability) => asRecord(ability).id ?? null)
                    : [];
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    playerBoardFace: guest.playerBoardFace ?? null,
                    hasHumanCursed: abilities.includes('human-cursed'),
                    hasSoulStab: abilities.includes('soul-stab'),
                    cursedCoin: Number(asRecord(guest.statusEffects)[STATUS_IDS.CURSED_COIN] ?? 0),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'main1',
                playerBoardFace: 'cursed',
                hasHumanCursed: false,
                hasSoulStab: true,
                cursedCoin: 0,
            });
            await waitForCursedPirateBoardFaceReady(match.guestPage, 'cursed');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '120-guest-human-cursed-flipped');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 lotus 槽位触发并结算走跳板的弃牌分支', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const targetCard = cloneCard(ZHANSHUJIA_CARDS as unknown as JsonRecord[], WALK_THE_PLANK_TARGET_CARD_ID);
            await setupHumanWalkThePlankScenario(match, targetCard);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const walkThePlankSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]')
                .first();
            await expect(walkThePlankSlot).toHaveAttribute('data-base-ability-id', 'walk-the-plank', { timeout: 10000 });
            await expect(walkThePlankSlot).toHaveAttribute('data-resolved-ability-id', 'walk-the-plank', { timeout: 10000 });
            await expect(walkThePlankSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '121-guest-human-walk-the-plank-entry');

            await walkThePlankSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'walk-the-plank',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            const guestModal = match.guestPage.locator('#modal-root');
            await expect(guestModal).toContainText('走跳板：选择结算方式', { timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^偷取 1CP$/ })).toBeVisible({ timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^令对手选择弃掉 1 张牌$/ })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '122-guest-human-walk-the-plank-choice');

            await guestModal.getByRole('button', { name: /^令对手选择弃掉 1 张牌$/ }).click();

            await expect(match.hostPage.locator('#modal-root')).toContainText('选择 1 张手牌弃置', { timeout: 10000 });
            await expect(match.hostPage.getByTestId(`dt-hand-card-option-${WALK_THE_PLANK_TARGET_CARD_ID}`)).toContainText('战略防御', { timeout: 10000 });
            await match.hostPage.getByTestId(`dt-hand-card-option-${WALK_THE_PLANK_TARGET_CARD_ID}`).click();
            await match.hostPage.locator('#modal-root').getByRole('button', { name: /确认|Confirm/i }).click();

            await waitForDiscardContains(match.matchId, match.hostPage, '0', WALK_THE_PLANK_TARGET_CARD_ID);
            await waitForHandCount(match.matchId, match.hostPage, '0', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '123-host-human-walk-the-plank-discarded');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 chi 槽位触发并结算做好标记的奖励骰与诅咒金币链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const drawCards = [
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GUEST_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], GO_FISH_CARD_ID),
                cloneCard(CURSED_PIRATE_CARDS as unknown as JsonRecord[], CROWS_NEST_CARD_ID),
            ];
            await setupHumanMakeYourMarkScenario(match, drawCards);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const makeYourMarkSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="chi"]')
                .first();
            await expect(makeYourMarkSlot).toHaveAttribute('data-base-ability-id', 'make-your-mark', { timeout: 10000 });
            await expect(makeYourMarkSlot).toHaveAttribute('data-resolved-ability-id', 'make-your-mark', { timeout: 10000 });
            await expect(makeYourMarkSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '127-guest-human-make-your-mark-entry');

            await makeYourMarkSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'make-your-mark',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await guestAdvanceButton.click();

            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.guestPage);
                const settlement = asRecord(core.pendingBonusDiceSettlement);
                const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
                return dice.length;
            }, {
                timeout: 10000,
                message: '等待做好标记奖励骰结算状态出现',
            }).toBe(3);

            await saveEvidenceScreenshot(match.guestPage, testInfo, '128-guest-human-make-your-mark-bonus-dice');

            const settlementCore = await readServerCore(match.matchId, match.guestPage);
            const settlement = asRecord(settlementCore.pendingBonusDiceSettlement);
            const dice = Array.isArray(settlement.dice) ? settlement.dice as JsonRecord[] : [];
            const cutlassCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS).length;
            const lootCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.LOOT).length;
            const skullCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.SKULL).length;

            await settleCurrentBonusDice(match.guestPage, () => readServerCore(match.matchId, match.guestPage), {
                sourceAbilityId: 'make-your-mark',
            });

            if (skullCount > 0) {
                const guestModal = match.guestPage.locator('#modal-root');
                await expect(guestModal).toContainText('是否获得诅咒金币？', { timeout: 10000 });
                await expect(guestModal.getByRole('button', { name: /^获得诅咒金币$/ })).toBeVisible({ timeout: 10000 });
                await saveEvidenceScreenshot(match.guestPage, testInfo, '129-guest-human-make-your-mark-choice');
                await guestModal.getByRole('button', { name: /^获得诅咒金币$/ }).click();
                await expect(guestModal).toBeHidden({ timeout: 10000 });
            }

            await expect.poll(async () => {
                const core = await readServerCore(match.matchId, match.guestPage);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                const hostResources = asRecord(host.resources);
                const guestResources = asRecord(guest.resources);
                const guestStatuses = asRecord(guest.statusEffects);
                const guestHand = Array.isArray(guest.hand) ? guest.hand as JsonRecord[] : [];
                return {
                    guestCp: Number(guestResources[RESOURCE_IDS.CP] ?? 0),
                    guestHandCount: guestHand.length,
                    guestCursedCoin: Number(guestStatuses[STATUS_IDS.CURSED_COIN] ?? 0),
                    hostHp: Number(hostResources[RESOURCE_IDS.HP] ?? 0),
                };
            }, { timeout: 10000 }).toEqual({
                guestCp: 6,
                guestHandCount: lootCount,
                guestCursedCoin: skullCount,
                hostHp: 50 - (2 * cutlassCount),
            });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '130-guest-human-make-your-mark-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过人类面 fist 槽位触发并结算弯刀突刺的四同值火药桶链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanCutlassStabScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const cutlassStabSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(cutlassStabSlot).toHaveAttribute('data-base-ability-id', 'cutlass-stab', { timeout: 10000 });
            await expect(cutlassStabSlot).toHaveAttribute('data-resolved-ability-id', 'cutlass-stab-4', { timeout: 10000 });
            await expect(cutlassStabSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '124-guest-human-cutlass-stab-entry');

            await cutlassStabSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'cutlass-stab-4',
            });

            const guestAdvanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(guestAdvanceButton).toBeEnabled({ timeout: 10000 });
            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '0',
                defenseAbilityId: 'countermeasures',
            });

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('zhanshujia-dice', [5, 5, 5, 5], {
                        5: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '125-host-human-cutlass-stab-defense-entry');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForAttackResolved(match.matchId, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 48);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '126-host-human-cutlass-stab-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实防御阶段入口应通过真实攻击流触发并结算人类面嘿，老兄的防御链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanStillWetBehindEarsScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const sabreThrustSlot = match.hostPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]')
                .first();
            await expect(sabreThrustSlot).toHaveAttribute('data-base-ability-id', 'sabre-thrust', { timeout: 10000 });
            await expect(sabreThrustSlot).toHaveAttribute('data-resolved-ability-id', 'sabre-thrust-3', { timeout: 10000 });
            await expect(sabreThrustSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '131-host-human-still-wet-behind-ears-attack-entry');

            await sabreThrustSlot.click();
            await waitForPendingAttack(match.matchId, match.hostPage, {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'sabre-thrust-3',
            });

            const hostAdvanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(hostAdvanceButton).toBeEnabled({ timeout: 10000 });
            await hostAdvanceButton.click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'defensiveRoll',
                defenderId: '1',
                defenseAbilityId: 'human-still-wet-behind-ears',
            });

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                root.core = {
                    ...core,
                    dice: buildDiceForValues('cursed-pirate-dice', [1, 1, 4, 6], {
                        1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
                        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
                        6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
                    }),
                    rollCount: 1,
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollConfirmed: true,
                };
                return state;
            });
            await dismissDefenseShowcaseIfPresent(match.guestPage);
            await expect(match.guestPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '132-guest-human-still-wet-behind-ears-defense-entry');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            const guestModal = match.guestPage.locator('#modal-root');
            await expect(guestModal).toContainText('是否获得诅咒金币？', { timeout: 10000 });
            await expect(guestModal.getByRole('button', { name: /^获得诅咒金币$/ })).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '133-guest-human-still-wet-behind-ears-choice');
            await guestModal.getByRole('button', { name: /^获得诅咒金币$/ }).click();

            await expect(guestModal).toBeHidden({ timeout: 10000 });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 48);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 48);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 6);
            await waitForStatusStack(match.matchId, match.guestPage, '1', STATUS_IDS.CURSED_COIN, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '134-guest-human-still-wet-behind-ears-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算诅咒金币的维持阶段掉血链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupCursedCoinUpkeepScenario(match, 3);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await saveEvidenceScreenshot(match.hostPage, testInfo, '54-host-cursed-coin-upkeep-before-advance');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 47);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.CURSED_COIN, 3);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '55-host-cursed-coin-upkeep-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算火药桶的维持阶段爆炸链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await playPowderKegUpkeepUntilExplode(match, 1, testInfo);
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('无情劫掠正式发动前应允许对手用意不意外改骰并取消大招选择', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupHumanMercilessPlunderScenario(match, { withHostUnexpected: true });
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            const mercilessPlunderSlot = match.guestPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="ultimate"]')
                .first();
            await expect(mercilessPlunderSlot).toHaveAttribute('data-base-ability-id', 'merciless-plunder', { timeout: 10000 });
            await expect(mercilessPlunderSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await mercilessPlunderSlot.click();
            await waitForPendingAttack(match.matchId, match.guestPage, {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'merciless-plunder',
            });
            await dismissAttackShowcaseIfVisible(match.hostPage);
            await dismissAttackShowcaseIfVisible(match.guestPage);

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const responseWindow = asRecord(asRecord(sys.responseWindow).current);
                const responderQueue = Array.isArray(responseWindow.responderQueue)
                    ? responseWindow.responderQueue.map(String)
                    : [];
                const currentResponderIndex = typeof responseWindow.currentResponderIndex === 'number'
                    ? responseWindow.currentResponderIndex
                    : 0;
                return {
                    windowType: responseWindow.windowType ?? null,
                    currentResponderId: responderQueue[currentResponderIndex] ?? null,
                    pendingAttackSourceId: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                windowType: 'afterRollConfirmed',
                currentResponderId: '0',
                pendingAttackSourceId: 'merciless-plunder',
                rollConfirmed: true,
            });

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const host = asRecord(asRecordMap(core.players)['0']);
                const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
                const interaction = asRecord(asRecord(sys.interaction).current);
                const meta = asRecord(asRecord(interaction.data).meta);
                if (interaction.kind === 'multistep-choice' && meta.dtType === 'modifyDie') {
                    return 'interaction';
                }
                if (hostHand.some(card => card.id === COMMON_UNEXPECTED_CARD_ID)) {
                    return 'hand';
                }
                return 'pending';
            }, { timeout: 10000 }).toMatch(/^(hand|interaction)$/);

            const waitForUnexpectedResponseEntry = async (): Promise<'hand' | 'interaction'> => {
                const deadline = Date.now() + 15000;
                let lastDiagnostics: JsonRecord = {};
                while (Date.now() < deadline) {
                    const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                    const host = asRecord(asRecordMap(core.players)['0']);
                    const hand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
                    const discard = Array.isArray(host.discard) ? host.discard as JsonRecord[] : [];
                    const interaction = asRecord(asRecord(sys.interaction).current);
                    const meta = asRecord(asRecord(interaction.data).meta);
                    const responseWindow = asRecord(asRecord(sys.responseWindow).current);
                    const responderQueue = Array.isArray(responseWindow.responderQueue)
                        ? responseWindow.responderQueue.map(String)
                        : [];
                    const currentResponderIndex = typeof responseWindow.currentResponderIndex === 'number'
                        ? responseWindow.currentResponderIndex
                        : 0;
                    const cardState = await match.hostPage.evaluate((cardId) => {
                        const card = document.querySelector(
                            `[data-testid="hand-area"] [data-card-id="${cardId}"]`,
                        );
                        return {
                            exists: card != null,
                            canDrag: card?.getAttribute('data-can-drag') ?? null,
                            isFlipped: card?.getAttribute('data-is-flipped') ?? null,
                            atlasFrameReady: !!card?.querySelector(
                                '[data-card-atlas-frame="true"]:not(.atlas-shimmer)',
                            ),
                        };
                    }, COMMON_UNEXPECTED_CARD_ID);

                    if (interaction.kind === 'multistep-choice' && meta.dtType === 'modifyDie') {
                        return 'interaction';
                    }
                    if (
                        hand.some(card => card.id === COMMON_UNEXPECTED_CARD_ID)
                        && cardState.exists
                        && cardState.canDrag === 'true'
                    ) {
                        return 'hand';
                    }

                    lastDiagnostics = {
                        handIds: hand.map(card => card.id),
                        discardIds: discard.map(card => card.id),
                        interactionKind: interaction.kind ?? null,
                        interactionPlayerId: interaction.playerId ?? null,
                        interactionDtType: meta.dtType ?? null,
                        responseWindowType: responseWindow.windowType ?? null,
                        currentResponderId: responderQueue[currentResponderIndex] ?? null,
                        pendingAttackSourceId: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                        rollConfirmed: core.rollConfirmed ?? null,
                        cardState,
                    };
                    await match.hostPage.waitForTimeout(250);
                }
                throw new Error(`意不意外响应入口未就绪: ${JSON.stringify(lastDiagnostics)}`);
            };

            const responseEntry = await waitForUnexpectedResponseEntry();
            if (responseEntry === 'hand') {
                const unexpectedCard = match.hostPage
                    .locator(`[data-testid="hand-area"] [data-card-id="${COMMON_UNEXPECTED_CARD_ID}"]`)
                    .first();
                await expect(unexpectedCard).toBeVisible({ timeout: 10000 });
                await saveEvidenceScreenshot(match.hostPage, testInfo, '110a-无情劫掠发动前-对手可打出意不意外');
                await dragHandCardToPlay(match.hostPage, COMMON_UNEXPECTED_CARD_ID);
            }

            const waitForUnexpectedInteraction = async (): Promise<void> => {
                const deadline = Date.now() + 10000;
                let lastDiagnostics: JsonRecord = {};
                while (Date.now() < deadline) {
                    const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                    const host = asRecord(asRecordMap(core.players)['0']);
                    const hand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
                    const discard = Array.isArray(host.discard) ? host.discard as JsonRecord[] : [];
                    const interaction = asRecord(asRecord(sys.interaction).current);
                    const meta = asRecord(asRecord(interaction.data).meta);
                    const responseWindow = asRecord(asRecord(sys.responseWindow).current);
                    const responderQueue = Array.isArray(responseWindow.responderQueue)
                        ? responseWindow.responderQueue.map(String)
                        : [];
                    const currentResponderIndex = typeof responseWindow.currentResponderIndex === 'number'
                        ? responseWindow.currentResponderIndex
                        : 0;
                    const eventEntries = Array.isArray(asRecord(sys.eventStream).entries)
                        ? asRecord(sys.eventStream).entries as JsonRecord[]
                        : [];
                    const cardState = await match.hostPage.evaluate((cardId) => {
                        const card = document.querySelector(
                            `[data-testid="hand-area"] [data-card-id="${cardId}"]`,
                        );
                        return {
                            exists: card != null,
                            canDrag: card?.getAttribute('data-can-drag') ?? null,
                            isFlipped: card?.getAttribute('data-is-flipped') ?? null,
                        };
                    }, COMMON_UNEXPECTED_CARD_ID);

                    if (
                        interaction.kind === 'multistep-choice'
                        && interaction.playerId === '0'
                        && meta.dtType === 'modifyDie'
                        && meta.selectCount === 2
                    ) {
                        return;
                    }

                    lastDiagnostics = {
                        handIds: hand.map(card => card.id),
                        discardIds: discard.map(card => card.id),
                        interactionKind: interaction.kind ?? null,
                        interactionPlayerId: interaction.playerId ?? null,
                        interactionDtType: meta.dtType ?? null,
                        interactionSelectCount: meta.selectCount ?? null,
                        responseWindowType: responseWindow.windowType ?? null,
                        currentResponderId: responderQueue[currentResponderIndex] ?? null,
                        pendingAttackSourceId: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                        rollConfirmed: core.rollConfirmed ?? null,
                        recentEventTypes: eventEntries.slice(-8).map(entry => asRecord(entry.event).type ?? null),
                        cardState,
                    };
                    await match.hostPage.waitForTimeout(250);
                }
                throw new Error(`意不意外未进入改骰交互: ${JSON.stringify(lastDiagnostics)}`);
            };
            await waitForUnexpectedInteraction();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '110a-无情劫掠发动前-意不意外已进入改骰交互');

            const firstDieDecrement = match.hostPage.getByTestId('die-adjust-decrement-0');
            const secondDieDecrement = match.hostPage.getByTestId('die-adjust-decrement-1');
            await expect(firstDieDecrement).toBeVisible({ timeout: 10000 });
            await expect(secondDieDecrement).toBeVisible({ timeout: 10000 });
            await firstDieDecrement.click();
            await secondDieDecrement.click();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '110b-意不意外-两颗骰子改为5待确认');
            await match.hostPage.getByRole('button', { name: /确认|Confirm/i }).click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const dice = Array.isArray(core.dice) ? core.dice as JsonRecord[] : [];
                return {
                    diceValues: dice.map(die => die.value),
                    pendingAttackSourceId: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    interactionKind: asRecord(asRecord(sys.interaction).current).kind ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                diceValues: [5, 5, 6, 6, 6],
                pendingAttackSourceId: null,
                rollConfirmed: false,
                interactionKind: null,
            });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '110c-改骰确认后-大招选择已取消');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在火药桶维持阶段投出 1 时先展示右侧奖励骰骰盘再正常结算', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await setupPowderKegUpkeepScenario(match, 1, 0, 0, repeatRandomValue(1, 8));
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '222-host-powder-keg-upkeep-roll-1-before-advance');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

            await expectRightTrayBonusDiceOnPage(match, match.hostPage, { diceCount: 1 });
            await expectRightTrayBonusDiceOnPage(match, match.guestPage, { diceCount: 1 });
            const die = getRightTrayDiceTray(match.hostPage).getByTestId('dice-2d').first();
            await expect(die).toBeVisible({ timeout: 10000 });
            await expect(die).toHaveAttribute('data-sprite-ready', 'true', { timeout: 10000 });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '223-host-powder-keg-upkeep-roll-1-bonus-die-right-tray');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '223b-guest-powder-keg-upkeep-roll-1-bonus-die-right-tray');

            await settleBonusDiceOnPage(match, match.hostPage);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 47);
            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 0);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '224-host-powder-keg-upkeep-roll-1-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算火药桶维持阶段投 6 后的转交链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await playPowderKegUpkeepTransfer(match, 0, testInfo, {
                before: '216-host-powder-keg-transfer-before-advance',
                choice: '217-host-powder-keg-transfer-choice',
                applied: '218-host-powder-keg-transfer-applied',
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算火药桶转交给已持有者时的原桶爆炸链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await playPowderKegUpkeepTransfer(match, 1, testInfo, {
                before: '219-host-powder-keg-overlap-before-advance',
                choice: '220-host-powder-keg-overlap-choice',
                applied: '221-host-powder-keg-overlap-applied',
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应展示并结算咒缚的维持阶段自伤链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupCursedUpkeepSelfDamageScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);
            await expect.poll(async () => {
                const root = await readServerRoot(match.matchId, match.hostPage);
                const players = asRecordMap(root.core.players);
                const guest = asRecord(players['1']);
                const abilities = Array.isArray(guest.abilities) ? guest.abilities : [];
                return {
                    phase: root.sys.phase ?? root.core.phase ?? null,
                    activePlayerId: root.core.activePlayerId ?? null,
                    guestPlayerBoardFace: guest.playerBoardFace ?? null,
                    hasCursedAbility: abilities.some(ability => asRecord(ability).id === 'cursed'),
                    hasHumanCursedAbility: abilities.some(ability => asRecord(ability).id === 'human-cursed'),
                };
            }, { timeout: 10000 }).toMatchObject({
                phase: 'main1',
                activePlayerId: '0',
                guestPlayerBoardFace: 'cursed',
                hasCursedAbility: true,
                hasHumanCursedAbility: false,
            });
            await expect.poll(async () => match.hostPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const root = (state?.G ?? state) as {
                    core?: {
                        phase?: string;
                        activePlayerId?: string;
                        players?: Record<string, { playerBoardFace?: string; abilities?: Array<{ id?: string }> }>;
                    };
                    sys?: { phase?: string };
                } | undefined;
                const guest = root?.core?.players?.['1'];
                const abilities = Array.isArray(guest?.abilities) ? guest.abilities : [];
                return {
                    phase: root?.sys?.phase ?? root?.core?.phase ?? null,
                    activePlayerId: root?.core?.activePlayerId ?? null,
                    guestPlayerBoardFace: guest?.playerBoardFace ?? null,
                    hasCursedAbility: abilities.some(ability => ability?.id === 'cursed'),
                    hasHumanCursedAbility: abilities.some(ability => ability?.id === 'human-cursed'),
                };
            }), { timeout: 10000 }).toMatchObject({
                phase: 'main1',
                activePlayerId: '0',
                guestPlayerBoardFace: 'cursed',
                hasCursedAbility: true,
                hasHumanCursedAbility: false,
            });

            await saveEvidenceScreenshot(match.guestPage, testInfo, '76-guest-cursed-upkeep-before-advance');

            for (let step = 0; step < 8; step += 1) {
                const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                const guestResources = asRecord(guest.resources);
                const guestHp = Number(guestResources[RESOURCE_IDS.HP] ?? 0);

                if (guestHp === 46) {
                    break;
                }

                const activePlayerId = String(core.activePlayerId ?? '');
                if (activePlayerId !== '0' && activePlayerId !== '1') {
                    throw new Error(`咒缚 upkeep 自伤链缺少有效 activePlayerId: ${JSON.stringify({
                        phase: sys.phase ?? core.phase ?? null,
                        activePlayerId,
                    })}`);
                }

                const activePage = activePlayerId === '0' ? match.hostPage : match.guestPage;
                const advancePhaseStatus = await dispatchDiceThroneCommandWithTimeout(activePage, {
                    type: 'ADVANCE_PHASE',
                    playerId: activePlayerId,
                    payload: {},
                });
                expect(advancePhaseStatus).toBe('ok');
                await activePage.waitForTimeout(250);
            }

            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 46);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '77-guest-cursed-upkeep-self-damage-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应在对手未发起攻击时由咒缚施加火药桶', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupCursedNoAttackPowderKegScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await saveEvidenceScreenshot(match.hostPage, testInfo, '78-host-cursed-no-attack-before-advance');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await waitForStatusStack(match.matchId, match.hostPage, '0', STATUS_IDS.POWDER_KEG, 1);
            await waitForResourceValue(match.matchId, match.hostPage, '0', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.hostPage, '1', RESOURCE_IDS.HP, 50);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '79-host-cursed-no-attack-powder-keg-applied');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家', async ({ browser }, testInfo) => {
        test.setTimeout(420000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupNewHeroFourPlayerMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const { hostPage, matchId, players } = setup;
            const defenderFrontPage = players[1].page;
            const defenderCaptainPage = players[3].page;

            await applyOnlineMatchState(matchId, hostPage, (state) => buildMercilessCurseTargetingRollState(state, 5));
            await expect.poll(async () => {
                const root = await readServerRoot(matchId, hostPage);
                return root.sys.phase ?? root.core.phase ?? null;
            }, { timeout: 10000 }).toBe('targetingRoll');

            await dispatchDiceThroneCommand(hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await defenderCaptainPage.waitForFunction(() => (
                (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '3'
            ), { timeout: 10000 });
            await expect(defenderCaptainPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 10000 });
            await expect(defenderCaptainPage.locator('[data-testid^="dt-defender-choice-option-"]')).toHaveCount(2, { timeout: 10000 });
            await expect(defenderCaptainPage.getByTestId('dt-defender-choice-option-1')).toBeVisible({ timeout: 10000 });
            await expect(defenderCaptainPage.getByTestId('dt-defender-choice-option-3')).toBeVisible({ timeout: 10000 });
            await expect(defenderCaptainPage.getByTestId('dt-defender-choice-option-2')).toHaveCount(0);
            await saveEvidenceScreenshot(defenderCaptainPage, testInfo, '42-four-player-merciless-curse-defender-team-choice');

            await defenderCaptainPage.getByTestId('dt-defender-choice-option-1').click();

            const mercilessCurseModal = hostPage.locator('#modal-root');
            const applyPlayer2Button = mercilessCurseModal.getByRole('button', { name: /^施加给 P2$/ });
            const applyPlayer4Button = mercilessCurseModal.getByRole('button', { name: /^施加给 P4$/ });
            const applyBothOpponentsButton = mercilessCurseModal.getByRole('button', { name: /^施加给 P2, P4$/ });
            const skipPowderKegButton = mercilessCurseModal.getByRole('button', { name: /^不施加火药桶$/ });
            await expect(mercilessCurseModal).toContainText('选择至多两名对手获得火药桶', { timeout: 10000 });
            await expect(applyPlayer2Button).toBeVisible({ timeout: 10000 });
            await expect(applyPlayer4Button).toBeVisible({ timeout: 10000 });
            await expect(applyBothOpponentsButton).toBeVisible({ timeout: 10000 });
            await expect(skipPowderKegButton).toBeVisible({ timeout: 10000 });
            await expect(mercilessCurseModal).not.toContainText('P3');
            await saveEvidenceScreenshot(hostPage, testInfo, '44-four-player-merciless-curse-powder-keg-choice');

            await expect(applyBothOpponentsButton).toBeEnabled({ timeout: 10000 });
            await applyBothOpponentsButton.click({ force: true });

            let powderKegResolutionSnapshot: {
                phase: unknown;
                defenderId: unknown;
                defenseAbilityId: unknown;
                interactionKind: unknown;
                player1PowderKeg: unknown;
                player3PowderKeg: unknown;
            } | null = null;
            await hostPage.waitForFunction((powderKegId) => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const core = state?.core;
                const sys = state?.sys;
                const player1PowderKeg = core?.players?.['1']?.statusEffects?.[powderKegId] ?? 0;
                const player3PowderKeg = core?.players?.['3']?.statusEffects?.[powderKegId] ?? 0;
                return !sys?.interaction?.current
                    && core?.pendingAttack?.defenderId === '1'
                    && player1PowderKeg === 1
                    && player3PowderKeg === 1;
            }, STATUS_IDS.POWDER_KEG, { timeout: 10000 });
            await expect(mercilessCurseModal).toBeHidden({ timeout: 10000 });
            powderKegResolutionSnapshot = await hostPage.evaluate((powderKegId) => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const core = state?.core ?? {};
                const sys = state?.sys ?? {};
                const player1PowderKeg = core?.players?.['1']?.statusEffects?.[powderKegId] ?? 0;
                const player3PowderKeg = core?.players?.['3']?.statusEffects?.[powderKegId] ?? 0;
                return {
                    phase: sys?.phase ?? core?.phase ?? null,
                    defenderId: core?.pendingAttack?.defenderId ?? null,
                    defenseAbilityId: core?.pendingAttack?.defenseAbilityId ?? null,
                    interactionKind: sys?.interaction?.current?.kind ?? null,
                    player1PowderKeg,
                    player3PowderKeg,
                };
            }, STATUS_IDS.POWDER_KEG);
            expect(powderKegResolutionSnapshot).not.toBeNull();
            expect(['targetingRoll', 'preDefense', 'defensiveRoll']).toContain(String(powderKegResolutionSnapshot?.phase ?? ''));
            if (powderKegResolutionSnapshot?.phase === 'defensiveRoll') {
                expect(powderKegResolutionSnapshot.defenseAbilityId).toBe('countermeasures');
            }
            await saveEvidenceScreenshot(hostPage, testInfo, '45-four-player-merciless-curse-powder-keg-applied');

            await applyOnlineMatchState(matchId, hostPage, (state) => {
                const next = buildMercilessCurseTargetingRollState(state, 6);
                const root = asRecord(next.G ?? next);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const defenderFront = asRecord(players['1']);
                const defenderCaptain = asRecord(players['3']);

                players['1'] = {
                    ...defenderFront,
                    statusEffects: {},
                };
                players['3'] = {
                    ...defenderCaptain,
                    statusEffects: {},
                };
                root.core = {
                    ...core,
                    players,
                };
                return next;
            });
            await expect.poll(async () => {
                const root = await readServerRoot(matchId, hostPage);
                return root.sys.phase ?? root.core.phase ?? null;
            }, { timeout: 10000 }).toBe('targetingRoll');

            await dispatchDiceThroneCommand(hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });

            await hostPage.waitForFunction(() => (
                (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '0'
            ), { timeout: 10000 });
            await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 10000 });
            await expect(hostPage.locator('[data-testid^="dt-defender-choice-option-"]')).toHaveCount(2, { timeout: 10000 });
            await expect(hostPage.getByTestId('dt-defender-choice-option-1')).toHaveAttribute('data-team-tone', 'enemy');
            await expect(hostPage.getByTestId('dt-defender-choice-option-3')).toHaveAttribute('data-team-tone', 'enemy');
            await expect(hostPage.getByTestId('dt-defender-choice-option-2')).toHaveCount(0);
            await saveEvidenceScreenshot(hostPage, testInfo, '43-four-player-merciless-curse-attacker-choice');

            await expect(defenderFrontPage.getByTestId('dt-defender-choice-panel')).toHaveCount(0);

            await hostPage.getByTestId('dt-defender-choice-option-1').click();

            await expect(mercilessCurseModal).toContainText('选择至多两名对手获得火药桶', { timeout: 10000 });
            await expect(applyPlayer2Button).toBeVisible({ timeout: 10000 });
            await expect(applyPlayer4Button).toBeVisible({ timeout: 10000 });
            await expect(skipPowderKegButton).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(hostPage, testInfo, '161-four-player-merciless-curse-skip-choice');

            await skipPowderKegButton.click({ force: true });
            await expect(mercilessCurseModal).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(matchId, hostPage);
                const playersMap = asRecordMap(core.players);
                const player1 = asRecord(playersMap['1']);
                const player3 = asRecord(playersMap['3']);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    defenderId: asRecord(core.pendingAttack).defenderId ?? null,
                    player1PowderKeg: asRecord(player1.statusEffects)[STATUS_IDS.POWDER_KEG] ?? 0,
                    player3PowderKeg: asRecord(player3.statusEffects)[STATUS_IDS.POWDER_KEG] ?? 0,
                    hasInteraction: Boolean(asRecord(asRecord(sys.interaction).current).id),
                };
            }, { timeout: 10000 }).toMatchObject({
                defenderId: '1',
                player1PowderKeg: 0,
                player3PowderKeg: 0,
                hasInteraction: false,
            });
            await saveEvidenceScreenshot(hostPage, testInfo, '162-four-player-merciless-curse-skip-applied');
        } finally {
            await cleanupDTMatch(setup);
        }
    });

    test('4 人真实入口应展示并结算地毯式轰炸的双敌目标链', async ({ browser }, testInfo) => {
        test.setTimeout(420000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupNewHeroFourPlayerMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const { matchId, hostPage, players } = setup;
            const zhanshujiaPage = players[1].page;

            await applyOnlineMatchState(matchId, zhanshujiaPage, buildCarpetBombingFourPlayerState);
            await expect.poll(async () => {
                const root = await readServerRoot(matchId, zhanshujiaPage);
                return root.sys.phase ?? root.core.phase ?? null;
            }, { timeout: 10000 }).toBe('offensiveRoll');

            const carpetBombingSlot = zhanshujiaPage
                .locator('[data-testid="player-board-surface"] [data-ability-slot="chi"]')
                .first();
            await expect(carpetBombingSlot).toHaveAttribute('data-resolved-ability-id', 'carpet-bombing', { timeout: 10000 });
            await expect(carpetBombingSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await carpetBombingSlot.click();

            await waitForPendingAttack(matchId, zhanshujiaPage, {
                attackerId: '1',
                sourceAbilityId: 'carpet-bombing',
            });

            const advanceButton = zhanshujiaPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();
            await expect.poll(async () => {
                const root = await readServerRoot(matchId, zhanshujiaPage);
                return root.sys.phase ?? root.core.phase ?? null;
            }, { timeout: 10000 }).toBe('targetingRoll');

            const targetingRollButton = zhanshujiaPage.locator('[data-tutorial-id="dice-roll-button"]');
            const targetingConfirmButton = zhanshujiaPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(targetingRollButton).toBeEnabled({ timeout: 10000 });
            await targetingRollButton.click();
            await expect(targetingConfirmButton).toBeEnabled({ timeout: 10000 });
            await targetingConfirmButton.click();
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            let targetingSnapshot: {
                phase: unknown;
                interactionKind: unknown;
                interactionType: unknown;
                interactionPlayerId: unknown;
                defenderId: unknown;
            } | null = null;
            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(matchId, zhanshujiaPage);
                const interactionCurrent = asRecord(asRecord(sys.interaction).current);
                const interactionData = asRecord(interactionCurrent.data);
                targetingSnapshot = {
                    phase: sys.phase ?? core.phase ?? null,
                    interactionKind: interactionCurrent.kind ?? null,
                    interactionType: interactionData.type ?? null,
                    interactionPlayerId: interactionCurrent.playerId ?? null,
                    defenderId: asRecord(core.pendingAttack).defenderId ?? null,
                };
                return Boolean(
                    targetingSnapshot.interactionKind === 'dt:defender-choice'
                    || (
                        targetingSnapshot.interactionKind === 'dt:card-interaction'
                        && targetingSnapshot.interactionType === 'selectPlayer'
                    )
                    || targetingSnapshot.defenderId
                );
            }, { timeout: 10000 }).toBe(true);

            if (targetingSnapshot?.interactionKind === 'dt:defender-choice') {
                const chooserPlayerId = String(targetingSnapshot.interactionPlayerId ?? '');
                const chooserPage = setup.players[Number(chooserPlayerId)]?.page;
                if (!chooserPage) {
                    throw new Error(`地毯式轰炸 targetingRoll 选择者页缺失: ${JSON.stringify(targetingSnapshot)}`);
                }

                await expect(chooserPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 10000 });
                await expect(chooserPage.getByTestId('dt-defender-choice-option-0')).toBeVisible({ timeout: 10000 });
                await expect(chooserPage.getByTestId('dt-defender-choice-option-2')).toBeVisible({ timeout: 10000 });
                await expect(chooserPage.getByTestId('dt-defender-choice-option-3')).toHaveCount(0);
                await chooserPage.getByTestId('dt-defender-choice-option-0').click();
            }

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(matchId, zhanshujiaPage);
                const interactionCurrent = asRecord(asRecord(sys.interaction).current);
                const interactionData = asRecord(interactionCurrent.data);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    interactionKind: interactionCurrent.kind ?? null,
                    interactionType: interactionData.type ?? null,
                    interactionPlayerId: interactionCurrent.playerId ?? null,
                    defenderId: asRecord(core.pendingAttack).defenderId ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                interactionKind: 'dt:card-interaction',
                interactionType: 'selectPlayer',
                interactionPlayerId: '1',
            });

            await expect(zhanshujiaPage.getByTestId('dt-player-target-0')).toBeVisible({ timeout: 10000 });
            await expect(zhanshujiaPage.getByTestId('dt-player-target-2')).toBeVisible({ timeout: 10000 });
            await expect(zhanshujiaPage.getByTestId('dt-player-target-3')).toHaveCount(0);
            await saveEvidenceScreenshot(zhanshujiaPage, testInfo, '80-player2-carpet-bombing-target-choice');

            await zhanshujiaPage.getByTestId('dt-player-target-0').click();
            await zhanshujiaPage.getByTestId('dt-player-target-2').click();
            await zhanshujiaPage.locator('#modal-root').getByRole('button', { name: /确认|Confirm/i }).click();

            await expect.poll(async () => {
                const { core, sys } = await readServerRoot(matchId, hostPage);
                const playersMap = asRecordMap(core.players);
                const player0 = asRecord(playersMap['0']);
                const player2 = asRecord(playersMap['2']);
                const player3 = asRecord(playersMap['3']);
                const resources0 = asRecord(player0.resources);
                const resources2 = asRecord(player2.resources);
                const resources3 = asRecord(player3.resources);
                const teamHealth = asRecord(core.teamHealth);
                return {
                    phase: sys.phase ?? core.phase ?? null,
                    teamA: Number(teamHealth.A ?? 0),
                    player0Hp: Number(resources0[RESOURCE_IDS.HP] ?? 0),
                    player2Hp: Number(resources2[RESOURCE_IDS.HP] ?? 0),
                    player3Hp: Number(resources3[RESOURCE_IDS.HP] ?? 0),
                    hasInteraction: Boolean(asRecord(asRecord(sys.interaction).current).id),
                };
            }, { timeout: 10000 }).toMatchObject({
                teamA: 46,
                player0Hp: 46,
                player2Hp: 46,
                player3Hp: 50,
                hasInteraction: false,
            });

            await saveEvidenceScreenshot(zhanshujiaPage, testInfo, '81-player2-carpet-bombing-applied');
        } finally {
            await cleanupDTMatch(setup);
        }
    });
});
