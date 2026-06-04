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
import { CARPET_BOMBING_2, DRUM_MOVEMENT_2, EXPAND_BATTLEFIELD_2, SABRE_THRUST_2, STRATEGIC_SHIFT_2, WAR_MONGER_2 } from '../../src/games/dicethrone/heroes/zhanshujia/abilities';

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
const GUEST_CARD_ID = 'card-cursed-pirate-pirates-life';
const COMMON_UNEXPECTED_CARD_ID = 'card-unexpected';
const WEIGH_ANCHOR_CARD_ID = 'card-cursed-pirate-weigh-anchor';
const CURSE_CARD_ID = 'card-cursed-pirate-curse-card';
const BATTEN_DOWN_CARD_ID = 'card-cursed-pirate-batten-down';
const SHARK_BAIT_CARD_ID = 'card-cursed-pirate-shark-bait';
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

const repeatRandomValue = (value: number, count: number): number[] =>
    Array.from({ length: count }, () => value);

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
    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
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

const readServerCore = async (matchId: string, page: Page): Promise<JsonRecord> => {
    const state = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(state.G ?? state);
    return asRecord(root.core);
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
        phase: 'main2',
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

        players[options.attackerId] = {
            ...attacker,
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
            activePlayerId: options.attackerId,
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
            currentPlayerIndex: Number(options.attackerId),
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
            currentPlayerIndex: 0,
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

const setupWarMonger2UpgradeCardScenario = async (
    match: MatchSetup,
    upgradeCard: JsonRecord,
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
                ...asRecord(host.abilityLevels),
                'war-monger': 1,
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

const playHeftyUntilLoot = async (
    match: MatchSetup,
    heftyCard: JsonRecord,
    testInfo: TestInfo,
): Promise<void> => {
    const overlay = match.guestPage.getByTestId('bonus-die-overlay');
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
        await expect(overlay).toBeVisible({ timeout: 10000 });
        await saveEvidenceScreenshot(match.guestPage, testInfo, '27-guest-hefty-bonus-die-loot');
        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });

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
    const overlay = match.guestPage.getByTestId('bonus-die-overlay');

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupBlusterScenario(match, blusterCard, drawCards);
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, BLUSTER_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: BLUSTER_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expect(overlay).toBeVisible({ timeout: 10000 });
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

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '95-guest-bluster-bonus-die-cutlass');
        }

        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
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

    throw new Error('12 次真实打出虚张声势后仍未命中奖励骰弯刀分支');
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
    const overlay = match.hostPage.getByTestId('bonus-die-overlay');

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupGainUpperHandScenario(match, gainUpperHandCard, drawCard);
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.hostPage, GAIN_UPPER_HAND_CARD_ID);
        await dispatchDiceThroneCommand(match.hostPage, {
            type: 'PLAY_CARD',
            playerId: '0',
            payload: { cardId: GAIN_UPPER_HAND_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.hostPage);
        await expect(overlay).toBeVisible({ timeout: 10000 });
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

        if (rolledFace === ZHANSHUJIA_DICE_FACE_IDS.MEDAL) {
            await saveEvidenceScreenshot(match.hostPage, testInfo, '72-host-gain-upper-hand-bonus-die-medal');
        }

        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
        await waitForDiscardContains(match.matchId, match.hostPage, '0', GAIN_UPPER_HAND_CARD_ID);

        if (rolledFace === ZHANSHUJIA_DICE_FACE_IDS.MEDAL) {
            await waitForTokenStack(match.matchId, match.hostPage, '0', TOKEN_IDS.TACTICAL_ADVANTAGE, 4);
            await waitForHandCount(match.matchId, match.hostPage, '0', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '73-host-gain-upper-hand-medal-applied');
            return;
        }

        await waitForHandCount(match.matchId, match.hostPage, '0', 1);
    }

    throw new Error('12 次真实打出占得上风后仍未命中奖励骰勋章分支');
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
    const overlay = match.guestPage.getByTestId('bonus-die-overlay');
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

    await expect(overlay).toBeVisible({ timeout: 10000 });
    await saveEvidenceScreenshot(match.guestPage, testInfo, '33-guest-marked-for-death-bonus-dice');

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

    await overlay.click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 5000 });

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
    const overlay = match.guestPage.getByTestId('bonus-die-overlay');
    await setupFlayScenario(match, flayCard);
    await dismissCardSpotlightIfPresent(match.hostPage);
    await dismissCardSpotlightIfPresent(match.guestPage);

    await dispatchDiceThroneCommand(match.guestPage, {
        type: 'PLAY_CARD',
        playerId: '1',
        payload: { cardId: FLAY_CARD_ID },
    });

    await dismissCardSpotlightIfPresent(match.guestPage);
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await saveEvidenceScreenshot(match.guestPage, testInfo, '31-guest-flay-bonus-dice');

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

    await overlay.click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 5000 });

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
}> => {
    const overlay = match.hostPage.getByTestId('bonus-die-overlay');
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

    await expect(overlay).toBeVisible({ timeout: 10000 });
    await saveEvidenceScreenshot(match.hostPage, testInfo, '29-host-war-monger-2-bonus-die-branch');
    await overlay.click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 5000 });

    const deadline = Date.now() + 5000;
    let lastSnapshot: JsonRecord | null = null;
    while (Date.now() < deadline) {
        const { core } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
        const hostTokens = asRecord(host.tokens);
        const guestResources = asRecord(guest.resources);
        const extraAttack = asRecord(core.extraAttackInProgress);
        const pendingAttack = asRecord(core.pendingAttack);
        const extraRoll = asRecord(pendingAttack.extraRoll);
        lastSnapshot = {
            handIds: hostHand.map(card => card.id),
            extraAttackAttackerId: extraAttack.attackerId ?? null,
            pendingAttack,
            hostTacticalAdvantage: hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0,
            guestHp: guestResources[RESOURCE_IDS.HP] ?? 0,
        };
        const extraRollValue = extraRoll.value;
        if (typeof extraRollValue === 'number') {
            if (extraRollValue === 6 && extraAttack.attackerId !== '0') {
                await match.hostPage.waitForTimeout(250);
                continue;
            }
            return {
                extraRollValue,
                hostHandIds: hostHand.map(card => card.id as string),
                hostTacticalAdvantage: Number(hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0),
                guestHp: Number(guestResources[RESOURCE_IDS.HP] ?? 0),
                extraAttackAttackerId: typeof extraAttack.attackerId === 'string' ? extraAttack.attackerId : null,
                pendingAttackSourceId: typeof pendingAttack.sourceAbilityId === 'string' ? pendingAttack.sourceAbilityId : null,
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
}> => {
    const overlay = match.hostPage.getByTestId('bonus-die-overlay');
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

    await expect(overlay).toBeVisible({ timeout: 10000 });
    await saveEvidenceScreenshot(match.hostPage, testInfo, '78-host-war-monger-bonus-die-branch');
    await overlay.click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 5000 });

    const deadline = Date.now() + 5000;
    let lastSnapshot: JsonRecord | null = null;
    while (Date.now() < deadline) {
        const { core } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const guest = asRecord(players['1']);
        const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
        const hostTokens = asRecord(host.tokens);
        const guestResources = asRecord(guest.resources);
        const extraAttack = asRecord(core.extraAttackInProgress);
        const pendingAttack = asRecord(core.pendingAttack);
        const extraRoll = asRecord(pendingAttack.extraRoll);
        lastSnapshot = {
            handIds: hostHand.map(card => card.id),
            extraAttackAttackerId: extraAttack.attackerId ?? null,
            pendingAttack,
            hostTacticalAdvantage: hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0,
            guestHp: guestResources[RESOURCE_IDS.HP] ?? 0,
        };
        const extraRollValue = extraRoll.value;
        if (typeof extraRollValue === 'number') {
            return {
                extraRollValue,
                hostHandIds: hostHand.map(card => card.id as string),
                hostTacticalAdvantage: Number(hostTokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0),
                guestHp: Number(guestResources[RESOURCE_IDS.HP] ?? 0),
                extraAttackAttackerId: typeof extraAttack.attackerId === 'string' ? extraAttack.attackerId : null,
                pendingAttackSourceId: typeof pendingAttack.sourceAbilityId === 'string' ? pendingAttack.sourceAbilityId : null,
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
    const overlay = match.guestPage.getByTestId('bonus-die-overlay');

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        await setupWeighAnchorScenario(match, weighAnchorCard, drawCard);
        await setHarnessRandomQueue(match.guestPage, repeatRandomValue(0.99, 8));
        await dismissCardSpotlightIfPresent(match.hostPage);
        await dismissCardSpotlightIfPresent(match.guestPage);

        await waitForHandCardVisualReady(match.guestPage, WEIGH_ANCHOR_CARD_ID);
        await dispatchDiceThroneCommand(match.guestPage, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: WEIGH_ANCHOR_CARD_ID },
        });

        await dismissCardSpotlightIfPresent(match.guestPage);
        await expect(overlay).toBeVisible({ timeout: 10000 });
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

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await saveEvidenceScreenshot(match.guestPage, testInfo, '74-guest-weigh-anchor-bonus-die-skull');
        }

        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
        await waitForDiscardContains(match.matchId, match.guestPage, '1', WEIGH_ANCHOR_CARD_ID);

        if (rolledFace === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.PARLEY, 1);
            await waitForHandCount(match.matchId, match.guestPage, '1', 0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '75-host-weigh-anchor-parley-applied');
            return;
        }

        await waitForHandCount(match.matchId, match.guestPage, '1', 1);
    }

    throw new Error('12 次真实打出起锚后仍未命中奖励骰骷髅分支');
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

const finishWarMongerDefenseAndWaitForExtraAttack = async (match: MatchSetup) => {
    await expect.poll(async () => {
        const { core, sys } = await readServerRoot(match.matchId, match.guestPage);
        const pendingAttack = asRecord(core.pendingAttack);
        return {
            phase: sys.phase ?? core.phase ?? null,
            defenderId: pendingAttack.defenderId ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'defensiveRoll',
        defenderId: '1',
    });

    await dismissDefenseShowcaseIfPresent(match.guestPage);

    const rollButton = match.guestPage.locator('[data-tutorial-id="dice-roll-button"]');
    if (await rollButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();
    }

    const confirmButton = match.guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(confirmButton).toBeEnabled({ timeout: 10000 });
        await confirmButton.click();
    }

    const advanceButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advanceButton).toBeEnabled({ timeout: 10000 });
    await advanceButton.click();

    await expect.poll(async () => {
        const { core, sys } = await readServerRoot(match.matchId, match.hostPage);
        const players = asRecordMap(core.players);
        const host = asRecord(players['0']);
        const hostHand = Array.isArray(host.hand) ? host.hand as JsonRecord[] : [];
        const extraAttack = asRecord(core.extraAttackInProgress);
        return {
            phase: sys.phase ?? core.phase ?? null,
            activePlayerId: core.activePlayerId ?? null,
            extraAttackAttackerId: extraAttack.attackerId ?? null,
            hasPendingAttack: Boolean(core.pendingAttack),
            hostHandIds: hostHand.map(card => card.id),
        };
    }, { timeout: 15000 }).toMatchObject({
        phase: 'offensiveRoll',
        activePlayerId: '0',
        extraAttackAttackerId: '0',
        hasPendingAttack: false,
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
            await finishWarMongerDefenseAndWaitForExtraAttack(match);
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
            const bonusDieOverlay = match.hostPage.getByTestId('bonus-die-overlay');
            await expect(bonusDieOverlay).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('bonus-die-spotlight-content')).toHaveAttribute('data-is-rolling', 'false', { timeout: 10000 });
            await expect(bonusDieOverlay).toContainText('作战室', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '18-host-war-room-bonus-die-spotlight');

            await bonusDieOverlay.click({ force: true });
            await expect(bonusDieOverlay).toBeHidden({ timeout: 5000 });
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
            await waitForDefensePhase(match.matchId, match.hostPage, '0', 'countermeasures');
            await dismissDefenseShowcaseIfPresent(match.hostPage);
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '20-host-countermeasures-defense-before-resolve');

            await dispatchDiceThroneCommand(match.hostPage, {
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {},
            });
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

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 49);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.CP, 6);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.CURSED_COIN, 1);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '23-guest-still-wet-behind-ears-defense-resolved');
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
                defenseAbilityId: 'still-wet-behind-ears',
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

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
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
                defenseAbilityId: 'still-wet-behind-ears',
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

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
            await waitForAttackResolved(match.matchId, match.guestPage);
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
                defenseAbilityId: 'still-wet-behind-ears',
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
                defenseAbilityId: 'still-wet-behind-ears',
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

            await expect.poll(async () => match.guestPage.evaluate((bindStatusId) => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const root = (state?.G ?? state) as {
                    core?: {
                        phase?: string;
                        players?: Record<string, { statusEffects?: Record<string, number> }>;
                    };
                    sys?: { phase?: string };
                } | undefined;
                const guestStatusEffects = root?.core?.players?.['1']?.statusEffects ?? {};
                return {
                    phase: root?.sys?.phase ?? root?.core?.phase ?? null,
                    bind: guestStatusEffects[bindStatusId] ?? 0,
                };
            }, STATUS_IDS.BIND), { timeout: 10000 }).toMatchObject({
                bind: 0,
            });
            await expect.poll(async () => match.guestPage.evaluate(() => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const root = (state?.G ?? state) as { core?: { phase?: string }; sys?: { phase?: string } } | undefined;
                return root?.sys?.phase ?? root?.core?.phase ?? null;
            }), { timeout: 10000 }).not.toBe('offensiveRoll');
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

            const overlay = match.hostPage.getByTestId('bonus-die-overlay');
            await expect(overlay).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '70-host-disengage-bonus-die');

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

            await overlay.click({ force: true });
            await expect(overlay).toBeHidden({ timeout: 5000 });

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

            const overlay = match.hostPage.getByTestId('bonus-die-overlay');
            await expect(overlay).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '40-host-sip-bonus-die');

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

            await overlay.click({ force: true });
            await expect(overlay).toBeHidden({ timeout: 5000 });
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
                expect(branch.guestHp).toBe(44);
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
                expect(branch.hostHandIds).toContain(STRATEGIC_DEFENSE_CARD_ID);
            } else if (branch.extraRollValue === 4 || branch.extraRollValue === 5) {
                expect(branch.hostTacticalAdvantage).toBe(5);
            } else {
                expect(branch.guestHp).toBe(45);
            }

            await finishWarMongerDefenseAndWaitForExtraAttack(match);
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

            await waitForAttackResolved(match.matchId, match.guestPage);
            await waitForResourceValue(match.matchId, match.guestPage, '0', RESOURCE_IDS.HP, 39);
            await waitForResourceValue(match.matchId, match.guestPage, '1', RESOURCE_IDS.HP, 50);
            await waitForStatusStack(match.matchId, match.guestPage, '0', STATUS_IDS.CURSED_COIN, 3);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '53-host-undead-claw-applied');
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

    test('真实入口应展示并结算咒缚的维持阶段自伤链', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNewHeroMatch(browser, baseURL);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await setupCursedUpkeepSelfDamageScenario(match);
            await dismissCardSpotlightIfPresent(match.hostPage);
            await dismissCardSpotlightIfPresent(match.guestPage);

            await saveEvidenceScreenshot(match.guestPage, testInfo, '76-guest-cursed-upkeep-before-advance');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });

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

            await applyOnlineMatchState(matchId, hostPage, (state) => buildMercilessCurseTargetingRollState(state, 6));
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
