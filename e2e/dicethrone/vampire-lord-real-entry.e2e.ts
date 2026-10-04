// e2e-harness-boundary: representative-state
import type { Browser, Locator, Page, TestInfo } from '@playwright/test';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    dispatchDiceThroneCommand,
    applyPendingBonusDiceValues,
    applyDiceValues,
    readyAndStartGame,
    selectCharacter,
    setDiceThroneBonusDiceValues,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    expectRightTrayBonusDiceConfirmation,
    getRightTrayDiceTray,
    settleCurrentBonusDice,
    waitForDiceThroneVisualIdle,
} from './bonus-dice-flow';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS, VAMPIRE_LORD_DICE_FACE_IDS } from '../../src/games/dicethrone/domain/ids';
import { buildHeroAbilitiesForFace, initHeroState } from '../../src/games/dicethrone/domain/characters';
import { getPendingAttackExpectedDamage } from '../../src/games/dicethrone/domain/utils';
import { VAMPIRE_LORD_CARDS } from '../../src/games/dicethrone/heroes/vampire_lord/cards';

const VAMPIRE_LORD_QUERY = { playerID: '0', disableLocalAiAutomation: true };
const VAMPIRE_LORD_DEFENSE_QUERY = { playerID: '1', disableLocalAiAutomation: true };
const VAMPIRE_LORD_HERO_ID = 'vampire_lord';
const TIANSHI_HERO_ID = 'tianshi';
const VISIBLE_HOST_HERO_ID = 'monk';
const VISIBLE_GUEST_HERO_ID = 'barbarian';
const VAMPIRE_LORD_CARD_ATLAS_ID = 'dicethrone:vampire_lord-cards';
const TIANSHI_CARD_ATLAS_ID = 'dicethrone:tianshi-cards';
const VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID = 'card-vampire-lord-blood-from-above';
const VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID = 'card-vampire-lord-gushing-blood';
const VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS = VAMPIRE_LORD_CARDS
    .map((card) => card.id)
    .filter((cardId) => cardId !== VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);
const VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE = VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS.length;
const VAMPIRE_LORD_PROOF_HAND = [
    { id: 'card-vampire-lord-blood-surge', atlasIndex: 17 },
    { id: 'card-vampire-lord-gushing-blood', atlasIndex: 21 },
    { id: 'upgrade-vampire-lord-blood-thirst-2-blood-river', atlasIndex: 23 },
    { id: 'card-vampire-lord-bloodstone', atlasIndex: 32 },
    { id: 'card-unexpected', atlasIndex: 33 },
] as const;
const VAMPIRE_LORD_DICE_VALUES = [1, 2, 3, 4, 6] as const;
const VAMPIRE_LORD_DICE_FACE_BY_VALUE: Record<number, string> = {
    1: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
    2: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
    3: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
    4: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
    5: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
    6: VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
};
const VAMPIRE_LORD_BONUS_DICE_OWNER = {
    expectedOwnerId: '0',
    expectedDefinitionId: 'vampire_lord-dice',
    expectedOwnerName: /吸血鬼领主|Vampire Lord/,
} as const;
const FIXED_E2E_RANDOM = {
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (min: number, _max: number) => min,
    shuffle: <T>(array: T[]) => array,
};

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const asRecord = (value: unknown): JsonRecord => (
    value && typeof value === 'object' ? value as JsonRecord : {}
);

const asRecordMap = (value: unknown): Record<string, JsonRecord> => (
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {}
);

const closeDebugPanelIfVisible = async (page: any): Promise<void> => {
    const panel = page.getByTestId('debug-panel');
    if (!await panel.isVisible({ timeout: 500 }).catch(() => false)) return;

    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeHidden({ timeout: 5000 });
};

const ensureManualResponseWindowEnabled = async (page: Page): Promise<void> => {
    const toggle = page.getByTestId('auto-response-toggle');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    if (await toggle.getAttribute('aria-pressed') !== 'true') {
        await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
};

const getLastEventTypes = (state: any): string[] => (
    (state?.sys?.eventStream?.entries ?? [])
        .slice(-10)
        .map((entry: any) => entry?.event?.type)
        .filter(Boolean)
);

const CANONICAL_FEEDBACK_SCREENSHOT_SUBDIR = 'dicethrone/feedback/6aade546639a0ce440f3ee7d';
const CANONICAL_FEEDBACK_SCREENSHOT_FILENAMES = [
    '01-催眠改第4颗骰-提示完整.jpg',
    '02-催眠改第4颗骰-行动日志5到4.jpg',
] as const;

const getCanonicalFeedbackScreenshotPath = (testInfo: TestInfo, filename: string): string => (
    getEvidenceScreenshotPath(testInfo, filename, {
        subdir: CANONICAL_FEEDBACK_SCREENSHOT_SUBDIR,
        filename,
    })
);

const createCanonicalFeedbackScreenshotStage = async (testInfo: TestInfo): Promise<string> => {
    const canonicalDir = dirname(getCanonicalFeedbackScreenshotPath(testInfo, CANONICAL_FEEDBACK_SCREENSHOT_FILENAMES[0]));
    const stageDir = join(dirname(canonicalDir), `.${testInfo.workerIndex}-${process.pid}-${Date.now()}-pending`);
    await rm(stageDir, { recursive: true, force: true });
    await mkdir(stageDir, { recursive: true });
    for (const metadataFilename of ['.e2e-image-index.json', 'index.html']) {
        const sourcePath = join(canonicalDir, metadataFilename);
        const stagePath = join(stageDir, metadataFilename);
        await copyFile(sourcePath, stagePath).catch((error: unknown) => {
            if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') throw error;
        });
    }
    return stageDir;
};

const saveCanonicalFeedbackScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    stageDir: string,
    filename: typeof CANONICAL_FEEDBACK_SCREENSHOT_FILENAMES[number],
): Promise<void> => {
    const stagePath = join(stageDir, filename);
    await page.screenshot({ path: stagePath, fullPage: false });
};

const publishCanonicalFeedbackScreenshots = async (testInfo: TestInfo, stageDir: string): Promise<void> => {
    const canonicalDir = dirname(getCanonicalFeedbackScreenshotPath(testInfo, CANONICAL_FEEDBACK_SCREENSHOT_FILENAMES[0]));
    const previousDir = join(dirname(canonicalDir), `.${testInfo.workerIndex}-${process.pid}-${Date.now()}-previous`);
    await rm(previousDir, { recursive: true, force: true });
    const hadCanonicalDir = existsSync(canonicalDir);
    try {
        if (hadCanonicalDir) {
            await rename(canonicalDir, previousDir);
        }
        await rename(stageDir, canonicalDir);
    } catch (error) {
        if (!existsSync(canonicalDir) && existsSync(previousDir)) {
            await rename(previousDir, canonicalDir).catch(() => undefined);
        }
        throw error;
    }
    await rm(previousDir, { recursive: true, force: true });
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.jpg` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const dismissAttackShowcaseIfVisible = async (page: Page): Promise<void> => {
    const continueButton = page.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i }).first();
    if (!await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) return;

    await continueButton.click();
    await expect(continueButton).toBeHidden({ timeout: 5000 }).catch(() => undefined);
};

const waitForImage = async (page: Page, testId: string): Promise<void> => {
    const image = page.getByTestId(testId);
    await expect(image).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => image.evaluate((node) => ({
        complete: (node as HTMLImageElement).complete,
        naturalWidth: (node as HTMLImageElement).naturalWidth,
    })), { timeout: 15000 }).toEqual({
        complete: true,
        naturalWidth: expect.any(Number),
    });
    const naturalWidth = await image.evaluate((node) => (node as HTMLImageElement).naturalWidth);
    expect(naturalWidth, `${testId} 应加载正式图片`).toBeGreaterThan(0);
};

const setupInProgressMatchWithVampireLord = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await expect(match.hostPage.locator(`[data-character-id="${VAMPIRE_LORD_HERO_ID}"]`)).toHaveCount(1);
    await expect(match.hostPage.getByTestId(`character-badge-${VAMPIRE_LORD_HERO_ID}-implementation_in_progress`)).toHaveCount(1);
    await expect(match.guestPage.locator(`[data-character-id="${VAMPIRE_LORD_HERO_ID}"]`)).toHaveCount(1);
    await selectCharacter(match.hostPage, VAMPIRE_LORD_HERO_ID);
    await selectCharacter(match.guestPage, VISIBLE_GUEST_HERO_ID);
    return match;
};

const cloneVampireLordCard = (cardId: string) => {
    const card = VAMPIRE_LORD_CARDS.find((item) => item.id === cardId);
    if (!card) {
        throw new Error(`吸血鬼领主牌库缺少 E2E 证明用卡牌: ${cardId}`);
    }
    return structuredClone(card);
};

const buildVampireLordDiceForValues = (values: readonly number[]) => values.map((value, index) => {
    const symbol = VAMPIRE_LORD_DICE_FACE_BY_VALUE[value];
    return {
        id: index,
        value,
        symbol,
        symbols: [symbol],
        isKept: false,
        ownerId: '0',
        definitionId: 'vampire_lord-dice',
    };
});
const buildVampireLordProofDice = () => buildVampireLordDiceForValues(VAMPIRE_LORD_DICE_VALUES);

const injectVampireLordMainProofState = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecordMap(core.players);
    const host = asRecord(players['0']);
    const guest = asRecord(players['1']);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(players);
    const vampireBase = initHeroState('0', VAMPIRE_LORD_HERO_ID, FIXED_E2E_RANDOM);
    const proofCardIds = VAMPIRE_LORD_PROOF_HAND.map((card) => card.id);
    const proofHand = proofCardIds.map(cloneVampireLordCard);
    const deck = [...vampireBase.hand, ...vampireBase.deck]
        .filter((card) => !proofCardIds.includes(card.id));

    nextRoot.core = {
        ...core,
        phase: 'main1',
        activePlayerId: '0',
        selectedCharacters: {
            ...asRecord(core.selectedCharacters),
            '0': VAMPIRE_LORD_HERO_ID,
            '1': VISIBLE_GUEST_HERO_ID,
        },
        hostStarted: true,
        rollCount: 0,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: false,
        dice: [],
        currentRollContext: undefined,
        pendingAttack: null,
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        passiveActionUsedThisTurn: {
            ...asRecord(core.passiveActionUsedThisTurn),
            '0': {},
        },
        players: {
            ...players,
            '0': {
                ...vampireBase,
                id: typeof host.id === 'string' ? host.id : vampireBase.id,
                characterId: VAMPIRE_LORD_HERO_ID,
                resources: {
                    ...vampireBase.resources,
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
                tokens: {
                    ...vampireBase.tokens,
                    [TOKEN_IDS.BLOOD_POWER]: 4,
                    [TOKEN_IDS.MESMERIZE]: 1,
                },
                statusEffects: {
                    ...vampireBase.statusEffects,
                    [STATUS_IDS.BLEED]: 1,
                },
                hand: proofHand,
                deck,
            },
            '1': {
                ...guest,
                characterId: VISIBLE_GUEST_HERO_ID,
                resources: {
                    ...asRecord(guest.resources),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
        },
    };
    nextRoot.sys = {
        ...sys,
        phase: 'main1',
        turnOrder,
        currentPlayerIndex: 0,
        interaction: {
            ...asRecord(sys.interaction),
            current: null,
            queue: [],
        },
    };

    await injectMatchState(matchId, next as never, page);
};

const expectHandCardPreview = async (
    page: Page,
    cardId: string,
    expectedAtlasId: string,
    expectedAtlasIndex: number,
    expectedSrcPattern: RegExp,
): Promise<void> => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const atlasFrame = card.locator(`[data-card-atlas-id="${expectedAtlasId}"]`).first();
    await expect(atlasFrame).toBeVisible({ timeout: 15000 });
    await expect(atlasFrame).toHaveAttribute('data-card-atlas-index', String(expectedAtlasIndex));
    const atlasImage = atlasFrame.locator('img[data-card-atlas-img="true"]').first();
    await expect(atlasImage).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => atlasImage.evaluate((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
        }),
        { timeout: 15000 },
    ).toBe(true);
    await expect.poll(
        async () => atlasImage.getAttribute('src'),
        { timeout: 15000 },
    ).toMatch(expectedSrcPattern);
};

const expectVampireLordCardPreview = async (
    page: Page,
    cardId: string,
    expectedAtlasIndex: number,
): Promise<void> => expectHandCardPreview(
    page,
    cardId,
    VAMPIRE_LORD_CARD_ATLAS_ID,
    expectedAtlasIndex,
    /dicethrone\/images\/xixuegui\/(?:compressed\/)?ability-cards\.webp/i,
);

const openMagnifiedHandCardPreview = async (
    page: Page,
    cardId: string,
    expectedAtlasId: string,
    expectedAtlasIndex: number,
    expectedSrcPattern: RegExp,
): Promise<void> => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.hover();
    await card.click();

    const overlay = page.getByTestId('board-magnify-overlay');
    await expect(overlay).toBeVisible({ timeout: 10000 });
    const atlasFrame = overlay.locator(`[data-card-atlas-id="${expectedAtlasId}"]`).first();
    await expect(atlasFrame).toBeVisible({ timeout: 15000 });
    await expect(atlasFrame).toHaveAttribute('data-card-atlas-index', String(expectedAtlasIndex));
    const atlasImage = atlasFrame.locator('img[data-card-atlas-img="true"]').first();
    await expect(atlasImage).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => atlasImage.evaluate((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
        }),
        { timeout: 15000 },
    ).toBe(true);
    await expect.poll(
        async () => atlasImage.getAttribute('src'),
        { timeout: 15000 },
    ).toMatch(expectedSrcPattern);
};

const injectVampireLordMesmerizeNaturalDefenseStart = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecordMap(core.players);
    const host = asRecord(players['0']);
    const guest = asRecord(players['1']);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(players);
    const vampireBase = initHeroState('0', VAMPIRE_LORD_HERO_ID, FIXED_E2E_RANDOM);
    const defenderBase = initHeroState('1', VISIBLE_GUEST_HERO_ID, FIXED_E2E_RANDOM);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);

    nextRoot.core = {
        ...core,
        phase: 'offensiveRoll',
        activePlayerId: '0',
        selectedCharacters: {
            ...asRecord(core.selectedCharacters),
            '0': VAMPIRE_LORD_HERO_ID,
            '1': VISIBLE_GUEST_HERO_ID,
        },
        hostStarted: true,
        rollCount: 0,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: false,
        dice: buildVampireLordDiceForValues([1, 1, 1, 1, 1]),
        currentRollContext: undefined,
        pendingAttack: null,
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        passiveActionUsedThisTurn: {
            ...asRecord(core.passiveActionUsedThisTurn),
            '0': {},
        },
        players: {
            ...players,
            '0': {
                ...vampireBase,
                id: typeof host.id === 'string' ? host.id : vampireBase.id,
                characterId: VAMPIRE_LORD_HERO_ID,
                hand: [],
                deck: [],
                discard: [],
                resources: {
                    ...vampireBase.resources,
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
                tokens: {
                    ...vampireBase.tokens,
                    [TOKEN_IDS.BLOOD_POWER]: 0,
                    [TOKEN_IDS.MESMERIZE]: 1,
                },
            },
            '1': {
                ...defenderBase,
                id: typeof guest.id === 'string' ? guest.id : defenderBase.id,
                characterId: VISIBLE_GUEST_HERO_ID,
                hand: [],
                deck: [],
                discard: [],
                resources: {
                    ...defenderBase.resources,
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
        },
    };
    nextRoot.sys = {
        ...sys,
        phase: 'offensiveRoll',
        turnOrder,
        currentPlayerIndex: Math.max(0, turnOrder.indexOf('0')),
        interaction: {
            ...asRecord(sys.interaction),
            current: null,
            queue: [],
        },
        responseWindow: {
            ...asRecord(sys.responseWindow),
            current: null,
            queue: [],
        },
    };

    await injectMatchState(matchId, next as never, page);
};

const closeMagnifiedCardPreview = async (page: Page): Promise<void> => {
    const overlay = page.getByTestId('board-magnify-overlay');
    if (!(await overlay.isVisible().catch(() => false))) {
        return;
    }

    await page.getByTestId('board-magnify-overlay-close').click();
    await expect(overlay).toBeHidden({ timeout: 10000 });
};

const expectTianshiCardPreview = async (
    page: Page,
    cardId: string,
    expectedAtlasIndex: number,
): Promise<void> => expectHandCardPreview(
    page,
    cardId,
    TIANSHI_CARD_ATLAS_ID,
    expectedAtlasIndex,
    /dicethrone\/images\/tianshi\/(?:compressed\/)?ability-cards\.webp/i,
);

const expectCardSpotlightPreview = async (
    page: Page,
    cardId: string,
    expectedPlayerId: string,
    expectedAtlasId: string,
    expectedAtlasIndex: number,
    expectedSrcPattern: RegExp,
): Promise<void> => {
    const spotlight = page.getByTestId('card-spotlight-overlay');
    await expect(spotlight).toBeVisible({ timeout: 15000 });
    await expect(spotlight).toHaveAttribute('data-card-id', cardId);
    await expect(spotlight).toHaveAttribute('data-player-id', expectedPlayerId);
    const atlasFrame = spotlight.locator(`[data-card-atlas-id="${expectedAtlasId}"]`).first();
    await expect(atlasFrame).toBeVisible({ timeout: 15000 });
    await expect(atlasFrame).toHaveAttribute('data-card-atlas-index', String(expectedAtlasIndex));
    const atlasImage = atlasFrame.locator('img[data-card-atlas-img="true"]').first();
    await expect(atlasImage).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => atlasImage.evaluate((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
        }),
        { timeout: 15000 },
    ).toBe(true);
    await expect.poll(
        async () => atlasImage.getAttribute('src'),
        { timeout: 15000 },
    ).toMatch(expectedSrcPattern);
};

const expectVampireLordCardChoicePreview = async (
    page: Page,
    cardId: string,
    expectedAtlasIndex: number,
): Promise<void> => {
    const option = page.getByTestId(`dt-deck-card-option-${cardId}`);
    await expect(option).toBeVisible({ timeout: 15000 });
    await expect(option).toHaveAttribute('data-card-pool-mode', 'preview');
    await expect(option).toHaveAttribute('data-card-preview-ready', 'true');
    await expect(option).not.toContainText(/血潮|畅饮|涌血|血流如注|action|CP/i);
    const previewShell = page.getByTestId(`dt-card-choice-preview-${cardId}`);
    await expect(previewShell).toBeVisible({ timeout: 15000 });
    const atlasFrame = option.locator(`[data-card-atlas-id="${VAMPIRE_LORD_CARD_ATLAS_ID}"]`).first();
    await expect(atlasFrame).toBeVisible({ timeout: 15000 });
    await expect(atlasFrame).toHaveAttribute('data-card-atlas-index', String(expectedAtlasIndex));
    const atlasImage = atlasFrame.locator('img[data-card-atlas-img="true"]').first();
    await expect(atlasImage).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => atlasImage.getAttribute('src'),
        { timeout: 15000 },
    ).toMatch(/dicethrone\/images\/xixuegui\/(?:compressed\/)?ability-cards\.webp/i);
};

const expectVisibleUsableTokenAction = async (token: Locator, hitTarget: Locator): Promise<void> => {
    await expect(token).toBeVisible({ timeout: 10000 });
    await expect(token).toHaveAttribute('data-token-clickable', 'true');
    await expect(token.locator('[data-dicethrone-token-halo="available"]')).toBeVisible({ timeout: 10000 });
    await expect(token.locator('[data-dicethrone-token-body="available"]')).toBeVisible({ timeout: 10000 });
    await expect(hitTarget).toBeVisible({ timeout: 10000 });
    await expect(hitTarget).toBeEnabled();
    await expect.poll(async () => hitTarget.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
        const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
        const hit = document.elementFromPoint(centerX, centerY);
        const tokenRoot = element.closest('[data-token-id]');
        return {
            visibleSize: rect.width >= 44 && rect.height >= 44,
            pointerEvents: style.pointerEvents,
            cursorAllowsClick: style.cursor.includes('pointer'),
            hitSelf: hit === element || element.contains(hit),
            tokenMarkedClickable: tokenRoot?.getAttribute('data-token-clickable') === 'true',
        };
    }), { timeout: 10000 }).toEqual({
        visibleSize: true,
        pointerEvents: 'auto',
        cursorAllowsClick: true,
        hitSelf: true,
        tokenMarkedClickable: true,
    });
};

const dragHandCardToPlay = async (page: Page, cardId: string): Promise<void> => {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    await expect(handCard).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });

    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;

        const rect = node.getBoundingClientRect();
        const startX = rect.x + (rect.width / 2);
        const startY = rect.y + (rect.height * 0.78);
        const hit = document.elementFromPoint(startX, startY) as HTMLElement | null;

        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            hitCardId: hit?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null,
        };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0 || cardBox.hitCardId !== cardId) {
        throw new Error(`未能获取手牌 ${cardId} 的真实拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    const draggedCardBox = await handCard.boundingBox();
    if (!draggedCardBox || cardBox.y - draggedCardBox.y < 150) {
        throw new Error(`手牌 ${cardId} 没有真实拖出到打出距离`);
    }
    await page.mouse.up();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(450);
};

const dragVampireLordHandCardToPlay = async (page: Page, cardId: string): Promise<void> => {
    await dragHandCardToPlay(page, cardId);
};

const closeCardSpotlight = async (page: Page): Promise<void> => {
    const root = page.getByTestId('spotlight-container-root');
    await expect(root).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(250);
    await root.click({ position: { x: 8, y: 8 } });
    await expect(root).toBeHidden({ timeout: 10000 });
};

async function openFabPanel(page: Page, panelId: string): Promise<void> {
    const panel = page.locator(`[data-testid="fab-panel-${panelId}"]`).first();
    if (await panel.isVisible().catch(() => false)) {
        return;
    }

    const panelButton = page.locator(`[data-fab-id="${panelId}"]`).first();
    if (!(await panelButton.isVisible().catch(() => false))) {
        const mainButton = page.locator('[data-testid="fab-menu"] [data-fab-id]').first();
        await expect(mainButton).toBeVisible({ timeout: 10000 });
        await mainButton.click();
        await expect(panelButton).toBeVisible({ timeout: 10000 });
    }

    await panelButton.click();
    await expect(panel).toBeVisible({ timeout: 10000 });
}

async function closeFabPanel(page: Page, panelId: string): Promise<void> {
    const panel = page.locator(`[data-testid="fab-panel-${panelId}"]`).first();
    if (!(await panel.isVisible().catch(() => false))) {
        return;
    }
    await page.locator(`[data-fab-id="${panelId}"]`).first().click();
    await expect(panel).toBeHidden({ timeout: 10000 });
}

async function expectActionLogContains(
    page: Page,
    parts: string[],
): Promise<void> {
    await openFabPanel(page, 'action-log');
    const rows = page.locator('[data-testid="hud-action-log-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await expect.poll(
        async () => {
            const texts = (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
            return texts.find((text) => parts.every((part) => text.includes(part))) ?? '';
        },
        { timeout: 15000 },
    ).not.toBe('');
}

async function expectActionLogCardTooltipPreview(
    page: Page,
    parts: string[],
    cardText: RegExp,
    expectedAtlasId: string,
    expectedAtlasIndex: number,
    expectedSrcPattern: RegExp,
): Promise<void> {
    await openFabPanel(page, 'action-log');
    const rows = page.locator('[data-testid="hud-action-log-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const row = rows
        .filter({ hasText: parts[0] ?? '' })
        .filter({ hasText: parts[1] ?? '' })
        .first();
    await expect(row).toBeVisible({ timeout: 15000 });

    const cardAnchor = row.getByTestId('card-preview-tooltip-anchor').filter({ hasText: cardText }).first();
    await expect(cardAnchor).toBeVisible({ timeout: 10000 });
    await cardAnchor.hover();

    const tooltip = page.getByTestId('card-preview-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 10000 });
    const atlasFrame = tooltip.locator(`[data-card-atlas-id="${expectedAtlasId}"]`).first();
    await expect(atlasFrame).toBeVisible({ timeout: 15000 });
    await expect(atlasFrame).toHaveAttribute('data-card-atlas-index', String(expectedAtlasIndex));
    const atlasImage = atlasFrame.locator('img[data-card-atlas-img="true"]').first();
    await expect(atlasImage).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => atlasImage.evaluate((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
        }),
        { timeout: 15000 },
    ).toBe(true);
    await expect.poll(
        async () => atlasImage.getAttribute('src'),
        { timeout: 15000 },
    ).toMatch(expectedSrcPattern);

    const tooltipLayering = await tooltip.evaluate((node) => {
        const element = node as HTMLElement;
        const panel = document.querySelector('[data-testid="fab-panel-action-log"]') as HTMLElement | null;
        const readStackingZIndex = (target: HTMLElement | null): number | null => {
            let current: HTMLElement | null = target;
            while (current) {
                const raw = window.getComputedStyle(current).zIndex;
                if (raw !== 'auto') {
                    const parsed = Number(raw);
                    if (Number.isFinite(parsed)) return parsed;
                }
                current = current.parentElement;
            }
            return null;
        };
        const rect = element.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            tooltipZIndex: readStackingZIndex(element),
            actionLogPanelZIndex: readStackingZIndex(panel),
            inViewport: rect.width > 0
                && rect.height > 0
                && rect.right > 0
                && rect.bottom > 0
                && rect.left < window.innerWidth
                && rect.top < window.innerHeight,
        };
    });
    expect(tooltipLayering.inViewport, '行动日志卡图 hover 浮层应位于当前视口内').toBe(true);
    expect(tooltipLayering.tooltipZIndex, '行动日志卡图 hover 浮层必须高于操作日志面板').toBeGreaterThan(
        tooltipLayering.actionLogPanelZIndex ?? 0,
    );
}

const readVampireLordCardPoolMetrics = async (page: Page) => (
    page.getByTestId('dt-card-pool-selection').locator('[data-card-pool-mode="preview"]').evaluateAll((options) => {
        const panel = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-panel"]');
        const surface = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-surface"]');
        const title = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-title"]');
        const selection = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-selection"]');
        const actions = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-actions"]');
        const cards = options.map((option) => {
            const frame = option.querySelector<HTMLElement>('[data-card-atlas-frame="true"]');
            const shell = option.querySelector<HTMLElement>('[data-testid^="dt-card-choice-preview-"]');
            if (!frame) return null;
            const rect = frame.getBoundingClientRect();
            const aspectRatio = Number(frame.getAttribute('data-card-atlas-aspect-ratio') ?? '0');
            return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
                ratioDelta: aspectRatio > 0 ? Math.abs((rect.width / rect.height) - aspectRatio) : 999,
                hasForcedAspect: String(shell?.className ?? '').includes('aspect-[0.61]'),
            };
        }).filter((card): card is NonNullable<typeof card> => Boolean(card));
        const panelRect = panel?.getBoundingClientRect();
        const surfaceRect = surface?.getBoundingClientRect();
        const titleRect = title?.getBoundingClientRect();
        const selectionRect = selection?.getBoundingClientRect();
        const actionsRect = actions?.getBoundingClientRect();

        if (cards.length === 0) {
            return {
                count: 0,
                widthDelta: 999,
                heightDelta: 999,
                minWidth: 0,
                minHeight: 0,
                maxRatioDelta: 999,
                hasForcedAspect: true,
                rowCount: 0,
                firstRowCount: 0,
                maxRowTopDelta: 999,
                maxRowCenterDelta: 999,
                hasVerticalBrowse: false,
                panelCenterDelta: 999,
                surfaceCenterDelta: 999,
                titleCenterDelta: 999,
                firstRowCenterDelta: 999,
                titleToCardsGap: -999,
                cardsToActionsGap: -999,
                panelInsideViewport: Boolean(
                    panelRect
                    && panelRect.left >= -1
                    && panelRect.right <= window.innerWidth + 1
                    && panelRect.top >= 0
                    && panelRect.bottom <= window.innerHeight + 1
                ),
                selectionInsideViewport: Boolean(
                    selectionRect
                    && selectionRect.left >= -1
                    && selectionRect.right <= window.innerWidth + 1
                    && selectionRect.top >= 0
                    && selectionRect.bottom <= window.innerHeight + 1
                ),
            };
        }

        const viewportCenter = window.innerWidth / 2;
        const sortedCards = [...cards].sort((a, b) => a.top - b.top || a.left - b.left);
        const rows: Array<{ top: number; bottom: number; left: number; right: number; count: number; topDelta: number; centerDelta: number }> = [];
        for (const card of sortedCards) {
            const row = rows.find(candidate => Math.abs(candidate.top - card.top) < 4);
            if (row) {
                row.topDelta = Math.max(row.topDelta, Math.abs(row.top - card.top));
                row.top = Math.min(row.top, card.top);
                row.bottom = Math.max(row.bottom, card.bottom);
                row.left = Math.min(row.left, card.left);
                row.right = Math.max(row.right, card.right);
                row.count += 1;
                row.centerDelta = Math.abs((row.left + row.right) / 2 - viewportCenter);
            } else {
                rows.push({
                    top: card.top,
                    bottom: card.bottom,
                    left: card.left,
                    right: card.right,
                    count: 1,
                    topDelta: 0,
                    centerDelta: Math.abs((card.left + card.right) / 2 - viewportCenter),
                });
            }
        }
        const firstRow = rows[0];
        const visibleCards = selectionRect
            ? cards.filter(card => card.bottom > selectionRect.top && card.top < selectionRect.bottom)
            : cards;
        const visibleCardBottom = visibleCards.length > 0
            ? Math.max(...visibleCards.map((card) => Math.min(card.bottom, selectionRect?.bottom ?? card.bottom)))
            : (selectionRect?.top ?? 0);

        return {
            count: cards.length,
            widthDelta: Math.max(...cards.map((card) => card.width)) - Math.min(...cards.map((card) => card.width)),
            heightDelta: Math.max(...cards.map((card) => card.height)) - Math.min(...cards.map((card) => card.height)),
            minWidth: Math.min(...cards.map((card) => card.width)),
            minHeight: Math.min(...cards.map((card) => card.height)),
            maxRatioDelta: Math.max(...cards.map((card) => card.ratioDelta)),
            hasForcedAspect: cards.some((card) => card.hasForcedAspect),
            rowCount: rows.length,
            firstRowCount: firstRow?.count ?? 0,
            maxRowTopDelta: Math.max(...rows.map((row) => row.topDelta)),
            maxRowCenterDelta: Math.max(...rows.map((row) => row.centerDelta)),
            hasVerticalBrowse: Boolean(selection && selection.scrollHeight > selection.clientHeight + 4),
            panelCenterDelta: panelRect ? Math.abs((panelRect.left + panelRect.right) / 2 - viewportCenter) : 999,
            surfaceCenterDelta: surfaceRect ? Math.abs((surfaceRect.left + surfaceRect.right) / 2 - viewportCenter) : 999,
            titleCenterDelta: titleRect ? Math.abs((titleRect.left + titleRect.right) / 2 - viewportCenter) : 999,
            firstRowCenterDelta: firstRow ? firstRow.centerDelta : 999,
            titleToCardsGap: titleRect && firstRow ? firstRow.top - titleRect.bottom : -999,
            cardsToActionsGap: actionsRect ? actionsRect.top - visibleCardBottom : -999,
            panelInsideViewport: Boolean(
                panelRect
                && panelRect.left >= -1
                && panelRect.right <= window.innerWidth + 1
                && panelRect.top >= 0
                && panelRect.bottom <= window.innerHeight + 1
            ),
            selectionInsideViewport: Boolean(
                selectionRect
                && selectionRect.left >= -1
                && selectionRect.right <= window.innerWidth + 1
                && selectionRect.top >= 0
                && selectionRect.bottom <= window.innerHeight + 1
            ),
        };
    })
);

const expectVampireLordCardPoolLayout = async (
    page: Page,
    expectedVisibleCount: number,
    options: { requireCenteredCards?: boolean } = {},
): Promise<void> => {
    const requireCenteredCards = options.requireCenteredCards ?? expectedVisibleCount <= 5;
    await expect(page.getByTestId('dt-card-pool-overlay')).toHaveAttribute('data-card-pool-layout', 'center-stage');
    await expect(page.getByTestId('dt-card-pool-overlay')).toHaveAttribute('data-card-pool-hand-protection', 'shared-stage-visible-hand');
    await expect(page.getByTestId('dt-card-pool-overlay')).toHaveAttribute('data-card-pool-browse-mode', 'grid-scroll');
    await expect(page.getByTestId('dt-card-pool-panel')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-surface')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-title')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-actions')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-selection')).toHaveClass(/scrollbar-thin/);
    await expect(page.getByTestId('dt-card-pool-selection')).toHaveAttribute('data-card-pool-visible-rows', 'two');

    await expect.poll(async () => {
        const metrics = await readVampireLordCardPoolMetrics(page);
        return (
            metrics.count === expectedVisibleCount
            && metrics.minWidth > 80
            && metrics.minHeight > 120
            && metrics.widthDelta < 2
            && metrics.heightDelta < 2
            && metrics.maxRatioDelta < 0.02
            && !metrics.hasForcedAspect
            && metrics.rowCount >= (expectedVisibleCount > 6 ? 2 : 1)
            && metrics.firstRowCount >= (expectedVisibleCount > 6 ? 5 : expectedVisibleCount)
            && metrics.maxRowTopDelta < 4
            && (expectedVisibleCount <= 6 || metrics.hasVerticalBrowse || metrics.rowCount > 1)
            && metrics.panelCenterDelta < 2
            && metrics.surfaceCenterDelta < 2
            && metrics.titleCenterDelta < 2
            && (!requireCenteredCards || metrics.firstRowCenterDelta < 2)
            && metrics.titleToCardsGap >= 6
            && metrics.cardsToActionsGap >= 6
            && metrics.panelInsideViewport
            && metrics.selectionInsideViewport
        );
    }, { timeout: 15000 }).toBe(true);
};

const expectVampireLordCardPoolKeepsHandVisible = async (page: Page, cardId: string): Promise<void> => {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(page.getByTestId('hand-area')).toHaveAttribute('data-hand-hidden', 'false');
    await expect(handCard).toBeVisible({ timeout: 10000 });

    let lastMetrics: Record<string, unknown> | null = null;
    try {
        await expect.poll(async () => page.evaluate((protectedCardId) => {
            const panel = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-panel"]');
            const card = document.querySelector<HTMLElement>(`[data-testid="hand-area"] [data-card-id="${protectedCardId}"]`);
            const visual = card?.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? card;
            if (!panel || !visual) {
                return {
                    panel: null,
                    hand: null,
                    overlaps: null,
                    gap: null,
                    valid: false,
                };
            }

            const panelRect = panel.getBoundingClientRect();
            const handRect = visual.getBoundingClientRect();
            const overlaps = !(
                panelRect.right <= handRect.left
                || panelRect.left >= handRect.right
                || panelRect.bottom <= handRect.top
                || panelRect.top >= handRect.bottom
            );

            return {
                panel: {
                    left: panelRect.left,
                    top: panelRect.top,
                    right: panelRect.right,
                    bottom: panelRect.bottom,
                    width: panelRect.width,
                    height: panelRect.height,
                },
                hand: {
                    left: handRect.left,
                    top: handRect.top,
                    right: handRect.right,
                    bottom: handRect.bottom,
                    width: handRect.width,
                    height: handRect.height,
                },
                overlaps,
                gap: handRect.top - panelRect.bottom,
                valid: handRect.width > 40
                    && handRect.height > 60
                    && handRect.bottom > 0
                    && handRect.bottom <= window.innerHeight + 1
                    && handRect.top < window.innerHeight
                    && handRect.left < window.innerWidth
                    && handRect.right > 0
                    && handRect.top - panelRect.bottom >= 4
                    && !overlaps,
            };
        }, cardId).then((metrics) => {
            lastMetrics = metrics as Record<string, unknown>;
            return Boolean(metrics.valid);
        }), { timeout: 15000 }).toBe(true);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message}\nhandProtectionMetrics=${JSON.stringify(lastMetrics)}`);
    }

    await expect.poll(async () => page.evaluate((protectedCardId) => {
        const overlay = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-overlay"]');
        const panel = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-panel"]');
        const card = document.querySelector<HTMLElement>(`[data-testid="hand-area"] [data-card-id="${protectedCardId}"]`);
        const visual = card?.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? card;
        if (!overlay || !panel || !visual) return false;

        const overlayStyle = getComputedStyle(overlay);
        const panelStyle = getComputedStyle(panel);
        const visualStyle = getComputedStyle(visual);

        return overlayStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
            && overlayStyle.backgroundImage === 'none'
            && panelStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
            && panelStyle.backgroundImage === 'none'
            && visualStyle.opacity === '1'
            && visualStyle.filter === 'none'
            && visualStyle.visibility === 'visible';
    }, cardId), { timeout: 15000 }).toBe(true);

    await expect.poll(async () => page.evaluate((protectedCardId) => {
        const card = document.querySelector<HTMLElement>(`[data-testid="hand-area"] [data-card-id="${protectedCardId}"]`);
        const visual = card?.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? card;
        if (!card || !visual) return false;

        const rect = visual.getBoundingClientRect();
        const hit = document.elementFromPoint(
            Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2)),
            Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2)),
        );
        return hit?.closest(`[data-testid="hand-area"] [data-card-id="${protectedCardId}"]`) === card;
    }, cardId), { timeout: 15000 }).toBe(true);
};

const expectStatusAtlasSprite = async (
    page: Page,
    type: 'token' | 'status',
    id: string,
    playerId = '0',
): Promise<void> => {
    const badge = page.getByTestId(`dt-player-${playerId}-${type}-${id}`);
    await expect(badge).toBeVisible({ timeout: 15000 });
    const sprite = badge.locator('img[data-status-source-url]').first();
    await expect(sprite).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => sprite.getAttribute('data-status-source-url'),
        { timeout: 15000 },
    ).toMatch(/dicethrone\/images\/xixuegui\/(?:compressed\/)?status-icons-atlas/i);
};

const expectVampireLordDiceSprites = async (page: Page): Promise<void> => {
    await expect.poll(async () => (
        page.getByTestId('dice-2d').evaluateAll((dice) => dice.map((die) => {
            const rect = die.getBoundingClientRect();
            return {
                face: die.getAttribute('data-face-value'),
                spriteReady: die.getAttribute('data-sprite-ready'),
                spriteUrl: die.getAttribute('data-sprite-url'),
                visible: rect.width > 0 && rect.height > 0,
            };
        }).filter((die) => die.visible))
    ), { timeout: 15000 }).toEqual([
        expect.objectContaining({ face: '1', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
        expect.objectContaining({ face: '2', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
        expect.objectContaining({ face: '3', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
        expect.objectContaining({ face: '4', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
        expect.objectContaining({ face: '6', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
    ]);
};

const expectVampireLordDiceSpritesForValues = async (page: Page, values: readonly number[]): Promise<void> => {
    const diceTray = getRightTrayDiceTray(page);
    await expect.poll(async () => (
        diceTray.getByTestId('dice-2d').evaluateAll((dice) => dice.map((die) => {
            const rect = die.getBoundingClientRect();
            return {
                face: die.getAttribute('data-face-value'),
                spriteReady: die.getAttribute('data-sprite-ready'),
                spriteUrl: die.getAttribute('data-sprite-url'),
                visible: rect.width > 0 && rect.height > 0,
            };
        }).filter((die) => die.visible))
    ), { timeout: 15000 }).toEqual(values.map((value) => (
        expect.objectContaining({
            face: String(value),
            spriteReady: 'true',
            spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/'),
        })
    )));
};

const buildVampireLordBloodthirstyClaws3Player = () => {
    const player = initHeroState('0', VAMPIRE_LORD_HERO_ID, FIXED_E2E_RANDOM);
    const abilityLevels = {
        ...player.abilityLevels,
        'bloodthirsty-claws': 3,
    };

    return {
        ...player,
        hand: [],
        deck: [],
        discard: [],
        resources: {
            ...player.resources,
            [RESOURCE_IDS.CP]: 2,
            [RESOURCE_IDS.HP]: 50,
        },
        tokens: {
            ...player.tokens,
            [TOKEN_IDS.BLOOD_POWER]: 0,
            [TOKEN_IDS.MESMERIZE]: 0,
        },
        statusEffects: {
            ...player.statusEffects,
            [STATUS_IDS.BLEED]: 0,
        },
        abilities: buildHeroAbilitiesForFace(VAMPIRE_LORD_HERO_ID, player.playerBoardFace, abilityLevels),
        abilityLevels,
        upgradeCardByAbilityId: {
            ...player.upgradeCardByAbilityId,
            'bloodthirsty-claws': {
                cardId: 'upgrade-vampire-lord-bloodthirsty-claws-3',
                cpCost: 3,
            },
        },
    };
};

const buildBarbarianDefensePlayer = () => {
    const player = initHeroState('1', VISIBLE_GUEST_HERO_ID, FIXED_E2E_RANDOM);

    return {
        ...player,
        hand: [],
        deck: [],
        discard: [],
        resources: {
            ...player.resources,
            [RESOURCE_IDS.CP]: 2,
            [RESOURCE_IDS.HP]: 50,
        },
    };
};

const clickResolvedAbilitySlot = async (
    page: Page,
    slotId: string,
    expectedBaseAbilityId: string,
    expectedAbilityId: string,
): Promise<void> => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-base-ability-id', expectedBaseAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-available-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });

    const clickPoint = await page.evaluate((targetSlotId: string) => {
        const element = document.querySelector(
            `[data-testid="player-board-surface"] [data-ability-slot="${targetSlotId}"]`,
        ) as HTMLElement | null;
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const xFractions = [0.18, 0.5, 0.82];
        const yFractions = [0.12, 0.28, 0.5, 0.72, 0.88];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.left + rect.width * xFraction;
                const y = rect.top + rect.height * yFraction;
                const topElement = document.elementFromPoint(x, y);
                const hitSlot = topElement?.closest?.('[data-ability-slot]');
                if (hitSlot === element) {
                    return { x, y };
                }
            }
        }

        return null;
    }, slotId);

    if (clickPoint) {
        await page.mouse.click(clickPoint.x, clickPoint.y);
        return;
    }

    await slot.click({ force: true });
};

test.describe('DiceThrone 吸血鬼领主真实入口', () => {
    test('鲜血之力 1 档应通过玩家板按钮给当前攻击加 3 点', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 1 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 6, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'blood-thirst',
                    settlementStage: 'preDamage',
                    isDefendable: true,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        const bloodPowerButton = page.getByTestId('passive-action-vampire-lord-blood-power-0');
        const diceTray = getRightTrayDiceTray(page);
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeEnabled();
        await expect(bloodPowerButton).not.toContainText('消耗1');
        const bloodPowerToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`);
        await expect(bloodPowerToken).toHaveAttribute('data-token-amount', '1');
        await expect.poll(async () => (
            diceTray.getByTestId('dice-2d').evaluateAll((dice) => dice.map((die) => ({
                face: die.getAttribute('data-face-value'),
                spriteReady: die.getAttribute('data-sprite-ready'),
                spriteUrl: die.getAttribute('data-sprite-url'),
            })))
        ), { timeout: 10000 }).toEqual([
            expect.objectContaining({ face: '1', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
            expect.objectContaining({ face: '2', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
            expect.objectContaining({ face: '3', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
            expect.objectContaining({ face: '4', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
            expect.objectContaining({ face: '6', spriteReady: 'true', spriteUrl: expect.stringContaining('/dicethrone/images/xixuegui/') }),
        ]);
        await game.screenshot('吸血鬼领主-鲜血之力入口-使用前', testInfo);

        await bloodPowerButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? null,
                hasTokenConsumed: getLastEventTypes(state).includes('TOKEN_CONSUMED'),
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            bonusDamage: 3,
            attackModifierBonusDamage: 3,
            hasTokenConsumed: true,
            events: expect.arrayContaining(['BONUS_DAMAGE_ADDED']),
        });
        await expect(bloodPowerButton).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeDisabled();
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveCount(0);
        await game.screenshot('吸血鬼领主-鲜血之力加伤后', testInfo);
    });

    test('鲜血之力 2 档在无可移除状态时仍显示为禁用入口且不重复显示成本', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 2 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
            },
        });
        await closeDebugPanelIfVisible(page);

        const removeStatusButton = page.getByTestId('passive-action-vampire-lord-blood-power-1');
        const passiveActionBar = page.getByTestId('passive-ability-action-bar');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(passiveActionBar).toBeVisible({ timeout: 10000 });
        await expect(passiveActionBar.locator('[data-testid="passive-action-vampire-lord-blood-power-1"]')).toHaveCount(1);
        await expect(removeStatusButton).toBeVisible({ timeout: 10000 });
        await expect(removeStatusButton).toBeDisabled();
        await expect(removeStatusButton).not.toContainText('消耗2');
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`))
            .toHaveAttribute('data-token-amount', '2');
        await game.screenshot('吸血鬼领主-鲜血之力四档入口-第2档禁用但可见', testInfo);
    });

    test('魔血附身基础版的奖励骰应显示为吸血鬼领主本人投出的骰子', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 0, [TOKEN_IDS.MESMERIZE]: 0 },
            },
            player1: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: buildVampireLordProofDice(),
                currentRollContext: undefined,
                pendingAttack: null,
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
            },
        });
        await closeDebugPanelIfVisible(page);

        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expectVampireLordDiceSpritesForValues(page, [1, 2, 3, 4, 6]);
        await clickResolvedAbilitySlot(page, 'combo', 'blood-possessed', 'blood-possessed');

        await expect.poll(async () => {
            const state = await game.getState();
            const pendingAttack = state?.core?.pendingAttack;
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                defenderId: pendingAttack?.defenderId ?? null,
                expectedDamage: pendingAttack ? getPendingAttackExpectedDamage(state.core, pendingAttack, 0) : null,
                attackDiceValues: pendingAttack?.attackDiceValues ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            sourceAbilityId: 'blood-possessed',
            defenderId: '1',
            expectedDamage: 7,
            attackDiceValues: [1, 2, 3, 4, 6],
        });
        await game.screenshot('吸血鬼领主-魔血附身-槽位触发后', testInfo);

        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await dismissAttackShowcaseIfVisible(page);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                rollDiceCount: state?.core?.rollDiceCount ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'defensiveRoll',
            sourceAbilityId: 'blood-possessed',
            defenseAbilityId: 'thick-skin',
            rollDiceCount: 3,
            rollConfirmed: false,
        });

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3]);
        });
        await dispatchDiceThroneCommand(page, { type: 'ROLL_DICE', playerId: '1' });
        await dispatchDiceThroneCommand(page, { type: 'CONFIRM_ROLL', playerId: '1' });
        await setDiceThroneBonusDiceValues(page, [1]);
        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '1' });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const currentDice = state?.core?.currentRollContext?.dice ?? [];
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                bonusValue: settlement?.dice?.[0]?.value ?? null,
                bonusFace: settlement?.dice?.[0]?.face ?? null,
                currentRollOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
                firstVisibleOwner: currentDice[0]?.ownerId ?? null,
                firstVisibleDefinition: currentDice[0]?.definitionId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'defensiveRoll',
            sourceAbilityId: 'blood-possessed',
            attackerId: '0',
            targetId: '1',
            bonusValue: 1,
            bonusFace: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
            currentRollOwner: '0',
            firstVisibleOwner: '0',
            firstVisibleDefinition: 'vampire_lord-dice',
        });
        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
            sourceAbilityId: 'blood-possessed',
            ...VAMPIRE_LORD_BONUS_DICE_OWNER,
        });
        await expectVampireLordDiceSpritesForValues(page, [1]);
        await game.screenshot('吸血鬼领主-魔血附身-奖励骰显示真实归属', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), {
            sourceAbilityId: 'blood-possessed',
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderBleed: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.BLEED] ?? 0,
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            defenderHp: 43,
            defenderBleed: 1,
            pendingSettlement: null,
            events: expect.arrayContaining(['BONUS_DICE_SETTLED', 'STATUS_APPLIED']),
        });
    });

    test('催眠应在对手确认骰后打开响应窗口，并通过点击 token 本体改对手骰', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.MESMERIZE]: 1 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'defensiveRoll',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 1,
                rollDiceCount: 2,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 6, isKept: false, ownerId: '1', definitionId: 'monk-dice' },
                    { id: 1, value: 5, isKept: false, ownerId: '1', definitionId: 'monk-dice' },
                ],
                currentRollContext: {
                    id: 'e2e-vampire-lord-opponent-defense-roll',
                    kind: 'defensive',
                    ownerPlayerId: '1',
                    targetPlayerId: '0',
                    sourceAbilityId: 'meditation',
                    phase: 'defensiveRoll',
                    dice: [
                        { id: 0, value: 6, symbol: 'lotus', symbols: ['lotus'], isKept: false, ownerId: '1', definitionId: 'monk-dice' },
                        { id: 1, value: 5, symbol: 'taiji', symbols: ['taiji'], isKept: false, ownerId: '1', definitionId: 'monk-dice' },
                    ],
                    status: 'open',
                    policy: {
                        modifiableBy: 'owner',
                        rerollableBy: 'owner',
                        allowPassiveReroll: true,
                        allowDiceCardTargeting: true,
                        ultimateLocked: false,
                        blocksPhaseFlow: true,
                    },
                    settlement: { mode: 'damage' },
                    display: { surface: 'diceTray', replayOnly: false },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'blood-thirst',
                    defenseAbilityId: 'meditation',
                    isDefendable: true,
                    damage: 4,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                    settlementStage: 'preDamage',
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        const mesmerizeToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}`);
        const mesmerizeTokenHitTarget = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}-hit-target`);
        const diceTray = getRightTrayDiceTray(page);
        const firstOpponentDie = diceTray.getByTestId('die-button-0').first();
        await expect(page.getByTestId('passive-action-vampire-lord-mesmerize-0')).toHaveCount(0);
        await expect(mesmerizeToken).toBeVisible({ timeout: 10000 });
        await expect(mesmerizeToken).toHaveAttribute('data-token-clickable', 'false');
        await expect(page.getByTestId('dicethrone-response-window-hint')).toHaveCount(0);
        await expect(firstOpponentDie).toBeVisible({ timeout: 10000 });
        await expect(firstOpponentDie).toHaveAttribute('data-owner-id', '1');
        await expect(firstOpponentDie).toHaveAttribute('data-display-value', '6');
        await expect(firstOpponentDie).toHaveAttribute('data-clickable', 'false');

        await dispatchDiceThroneCommand(page, { type: 'CONFIRM_ROLL', playerId: '1' });

        await expect.poll(async () => {
            const state = await game.getState();
            const responseWindow = state?.sys?.responseWindow?.current;
            return {
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                windowType: responseWindow?.windowType ?? null,
                currentResponderId: responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null,
                responderQueue: responseWindow?.responderQueue ?? [],
                currentRollOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
                currentRollStatus: state?.core?.currentRollContext?.status ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            rollConfirmed: true,
            windowType: 'afterRollConfirmed',
            currentResponderId: '0',
            responderQueue: ['0'],
            currentRollOwner: '1',
            currentRollStatus: 'settling',
        });
        await expect(page.getByTestId('dicethrone-response-window-hint')).toBeVisible({ timeout: 10000 });
        await expectVisibleUsableTokenAction(mesmerizeToken, mesmerizeTokenHitTarget);
        await expect(mesmerizeTokenHitTarget).toHaveAccessibleName(/催眠|Mesmerize/);
        await game.screenshot('吸血鬼领主-催眠响应窗口-token本体高亮', testInfo);

        await setDiceThroneBonusDiceValues(page, [6]);
        await mesmerizeTokenHitTarget.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                mesmerize: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.MESMERIZE] ?? null,
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                bonusValue: settlement?.dice?.[0]?.value ?? null,
                bonusFace: settlement?.dice?.[0]?.face ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            mesmerize: 0,
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
            bonusValue: 6,
            bonusFace: 'blood_drop',
        });
        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
            ...VAMPIRE_LORD_BONUS_DICE_OWNER,
        });
        await game.screenshot('吸血鬼领主-催眠响应窗口-临时骰确认前', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), {
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const current = state?.sys?.interaction?.current;
            return {
                kind: current?.kind ?? null,
                playerId: current?.playerId ?? null,
                dtType: current?.data?.meta?.dtType ?? null,
                targetOpponentDice: current?.data?.meta?.targetOpponentDice ?? null,
                diceOwnerId: current?.data?.meta?.diceOwnerId ?? null,
                allowedDieIds: current?.data?.allowedDieIds ?? [],
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                currentRollOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
                currentDiceValues: (state?.core?.currentRollContext?.dice ?? []).map((die: any) => die.value),
            };
        }, { timeout: 10000 }).toEqual({
            kind: 'multistep-choice',
            playerId: '0',
            dtType: 'selectDie',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0, 1],
            pendingSettlement: null,
            currentRollOwner: '1',
            currentDiceValues: [6, 5],
        });
        await expect(firstOpponentDie).toHaveAttribute('data-clickable', 'true', { timeout: 10000 });
        await game.screenshot('吸血鬼领主-催眠响应窗口-选择对手骰', testInfo);

        await firstOpponentDie.click();
        await expect(firstOpponentDie).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await setDiceThroneBonusDiceValues(page, [2]);
        await game.screenshot('吸血鬼领主-催眠响应窗口-对手骰已选待确认', testInfo);

        const confirmButton = page.getByTestId('dice-interaction-confirm-button');
        await expect(confirmButton).toBeVisible({ timeout: 5000 });
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const firstDie = state?.core?.currentRollContext?.dice?.find((die: any) => die.id === 0);
            return {
                firstDieValue: firstDie?.value ?? null,
                firstDieOwner: firstDie?.ownerId ?? null,
                mesmerize: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.MESMERIZE] ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            firstDieValue: 2,
            firstDieOwner: '1',
            mesmerize: 0,
            interactionKind: null,
            events: expect.arrayContaining(['DIE_REROLLED']),
        });
        await expect(firstOpponentDie).toHaveAttribute('data-display-value', '2', { timeout: 10000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.sys?.responseWindow?.current ?? null;
        }, { timeout: 10000 }).toBeNull();
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-催眠响应窗口-重掷后收口', testInfo);
    });

    test('催眠应在对手进攻投掷确认后打开响应窗口，重掷后仍允许对手声明攻击', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const canonicalScreenshotStageDir = await createCanonicalFeedbackScreenshotStage(testInfo);
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.MESMERIZE]: 1 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '1',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '1',
                rollCount: 1,
                rollLimit: 1,
                rollDiceCount: 5,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 1, value: 3, isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 2, value: 3, isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 3, value: 5, isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                    { id: 4, value: 1, isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                ],
                currentRollContext: {
                    id: 'e2e-vampire-lord-opponent-offensive-roll',
                    kind: 'offensive',
                    ownerPlayerId: '1',
                    targetPlayerId: '0',
                    phase: 'offensiveRoll',
                    dice: [
                        { id: 0, value: 1, symbol: 'sword', symbols: ['sword'], isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                        { id: 1, value: 3, symbol: 'sword', symbols: ['sword'], isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                        { id: 2, value: 3, symbol: 'sword', symbols: ['sword'], isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                        { id: 3, value: 5, symbol: 'heart', symbols: ['heart'], isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                        { id: 4, value: 1, symbol: 'heart', symbols: ['heart'], isKept: false, ownerId: '1', definitionId: 'barbarian-dice' },
                    ],
                    status: 'open',
                    policy: {
                        modifiableBy: 'owner',
                        rerollableBy: 'owner',
                        allowPassiveReroll: true,
                        allowDiceCardTargeting: true,
                        ultimateLocked: false,
                        blocksPhaseFlow: true,
                    },
                    settlement: { mode: 'selectAttack' },
                    display: { surface: 'diceTray', replayOnly: false },
                },
                pendingAttack: null,
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
            },
        });
        await closeDebugPanelIfVisible(page);

        const mesmerizeToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}`);
        const mesmerizeTokenHitTarget = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}-hit-target`);
        const diceTray = getRightTrayDiceTray(page);
        const fourthOpponentDie = diceTray.getByTestId('die-button-3').first();

        await expect(mesmerizeToken).toBeVisible({ timeout: 10000 });
        await expect(mesmerizeToken).toHaveAttribute('data-token-clickable', 'false');
        await expect(fourthOpponentDie).toBeVisible({ timeout: 10000 });
        await expect(fourthOpponentDie).toHaveAttribute('data-owner-id', '1');
        await expect(fourthOpponentDie).toHaveAttribute('data-display-value', '5');

        await dispatchDiceThroneCommand(page, { type: 'CONFIRM_ROLL', playerId: '1' });

        await expect.poll(async () => {
            const state = await game.getState();
            const responseWindow = state?.sys?.responseWindow?.current;
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                windowType: responseWindow?.windowType ?? null,
                currentResponderId: responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null,
                currentRollOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            rollConfirmed: true,
            pendingAttack: null,
            windowType: 'afterRollConfirmed',
            currentResponderId: '0',
            currentRollOwner: '1',
        });
        await expectVisibleUsableTokenAction(mesmerizeToken, mesmerizeTokenHitTarget);
        await game.screenshot('吸血鬼领主-催眠-对手进攻骰确认后响应窗口', testInfo);

        await setDiceThroneBonusDiceValues(page, [6]);
        await mesmerizeTokenHitTarget.click();
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                mesmerize: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.MESMERIZE] ?? null,
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                bonusValue: settlement?.dice?.[0]?.value ?? null,
                bonusFace: settlement?.dice?.[0]?.face ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            mesmerize: 0,
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
            bonusValue: 6,
            bonusFace: VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
        });
        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
            ...VAMPIRE_LORD_BONUS_DICE_OWNER,
        });
        await settleCurrentBonusDice(page, () => game.getState(), {
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const current = state?.sys?.interaction?.current;
            return {
                kind: current?.kind ?? null,
                playerId: current?.playerId ?? null,
                targetOpponentDice: current?.data?.meta?.targetOpponentDice ?? null,
                diceOwnerId: current?.data?.meta?.diceOwnerId ?? null,
                allowedDieIds: current?.data?.allowedDieIds ?? [],
                responseWindow: state?.sys?.responseWindow?.current ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            kind: 'multistep-choice',
            playerId: '0',
            targetOpponentDice: true,
            diceOwnerId: '1',
            allowedDieIds: [0, 1, 2, 3, 4],
            responseWindow: expect.objectContaining({
                windowType: 'afterRollConfirmed',
                pendingInteractionId: expect.any(String),
            }),
        });
        const diceInteractionHint = page.getByTestId('dice-interaction-hint');
        await expect(diceInteractionHint).toBeVisible({ timeout: 10000 });
        await expect(diceInteractionHint).toContainText('选择对手的骰子（0/1）');
        await expect.poll(async () => diceInteractionHint.evaluate((element) => {
            const node = element as HTMLElement;
            const rect = node.getBoundingClientRect();
            return {
                fullyRendered: node.scrollWidth <= node.clientWidth + 1
                    && node.scrollHeight <= node.clientHeight + 1,
                insideViewport: rect.left >= 0
                    && rect.top >= 0
                    && rect.right <= window.innerWidth + 1
                    && rect.bottom <= window.innerHeight + 1,
            };
        }), { timeout: 10000 }).toEqual({
            fullyRendered: true,
            insideViewport: true,
        });
        await game.screenshot('吸血鬼领主-催眠-改第4颗骰提示完整', testInfo);
        await saveCanonicalFeedbackScreenshot(page, testInfo, canonicalScreenshotStageDir, '01-催眠改第4颗骰-提示完整.jpg');

        await expect(fourthOpponentDie).toHaveAttribute('data-clickable', 'true', { timeout: 10000 });

        await fourthOpponentDie.click();
        await expect(fourthOpponentDie).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await setDiceThroneBonusDiceValues(page, [4]);
        const rerollConfirmButton = page.getByTestId('dice-interaction-confirm-button');
        await expect(rerollConfirmButton).toBeVisible({ timeout: 5000 });
        await expect(rerollConfirmButton).toBeEnabled({ timeout: 5000 });
        await rerollConfirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const currentRollContext = state?.core?.currentRollContext;
            const fourthDie = currentRollContext?.dice?.find((die: any) => die.id === 3);
            return {
                fourthDieValue: fourthDie?.value ?? null,
                fourthDieOwner: fourthDie?.ownerId ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                responseWindow: state?.sys?.responseWindow?.current ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                attackDeclarationGate: state?.core?.afterRollResponseWindowRequiresAttackDeclaration ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            fourthDieValue: 4,
            fourthDieOwner: '1',
            interactionKind: null,
            responseWindow: null,
            pendingAttack: null,
            attackDeclarationGate: true,
            events: expect.arrayContaining(['DIE_REROLLED']),
        });
        await expect(fourthOpponentDie).toHaveAttribute('data-display-value', '4', { timeout: 10000 });
        await expectActionLogContains(page, ['重投骰子 #4', '5 → 4']);
        await game.screenshot('吸血鬼领主-催眠-改第4颗骰行动日志显示5到4', testInfo);
        await saveCanonicalFeedbackScreenshot(page, testInfo, canonicalScreenshotStageDir, '02-催眠改第4颗骰-行动日志5到4.jpg');
        await closeFabPanel(page, 'action-log');
        await game.screenshot('吸血鬼领主-催眠-对手进攻骰重掷后仍等待声明攻击', testInfo);

        await dispatchDiceThroneCommand(page, {
            type: 'SELECT_ABILITY',
            playerId: '1',
            payload: { abilityId: 'slap-3' },
        });
        await expect.poll(async () => {
            const state = await game.getState();
            const pendingAttack = state?.core?.pendingAttack;
            return {
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                attackerId: pendingAttack?.attackerId ?? null,
                defenderId: pendingAttack?.defenderId ?? null,
                phase: state?.sys?.phase ?? null,
                pendingAttackStillExists: Boolean(pendingAttack),
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: 'slap-3',
            attackerId: '1',
            defenderId: '0',
            phase: 'offensiveRoll',
            pendingAttackStillExists: true,
        });
        await game.screenshot('吸血鬼领主-催眠-重掷后对手攻击已重新建立', testInfo);
        await publishCanonicalFeedbackScreenshots(testInfo, canonicalScreenshotStageDir);
    });

    test('催眠从真实防御确认按钮后应打开响应窗口，临时骰后攻击不能被跳过', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupInProgressMatchWithVampireLord(browser, baseURL);
        const hostPage = match.hostPage;
        const guestPage = match.guestPage;
        const readRootState = async (): Promise<JsonRecord> => {
            const current = await getMatchState(match.matchId, hostPage) as JsonRecord;
            return asRecord(current.G ?? current);
        };

        try {
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            await waitForDiceThroneHarness(hostPage);
            await waitForDiceThroneHarness(guestPage);
            await hostPage.setViewportSize({ width: 1280, height: 720 });
            await guestPage.setViewportSize({ width: 1280, height: 720 });
            await closeDebugPanelIfOpen(hostPage);
            await closeDebugPanelIfOpen(guestPage);
            await ensureManualResponseWindowEnabled(hostPage);

            await injectVampireLordMesmerizeNaturalDefenseStart(match.matchId, hostPage);
            await guestPage.waitForTimeout(500);

            const hostRollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]').first();
            const hostConfirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]').first();
            await expect(hostPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
            await expect(hostRollButton).toBeVisible({ timeout: 10000 });
            await expect(hostRollButton).toBeEnabled();
            await hostRollButton.click();
            await applyDiceValues(hostPage, [1, 1, 1, 4, 5]);
            await expect.poll(async () => {
                const root = await readRootState();
                const core = asRecord(root.core);
                const currentRollContext = asRecord(core.currentRollContext);
                return {
                    rollCount: core.rollCount ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    dice: Array.isArray(currentRollContext.dice)
                        ? currentRollContext.dice.slice(0, 5).map((die: any) => die?.value ?? null)
                        : Array.isArray(core.dice)
                            ? core.dice.slice(0, 5).map((die: any) => die?.value ?? null)
                            : [],
                };
            }, { timeout: 10000 }).toEqual({
                rollCount: 1,
                rollConfirmed: false,
                dice: [1, 1, 1, 4, 5],
            });
            await expectVampireLordDiceSpritesForValues(hostPage, [1, 1, 1, 4, 5]);
            await expect(hostConfirmButton).toBeEnabled({ timeout: 5000 });
            await hostConfirmButton.click();

            await expect.poll(async () => {
                const root = await readRootState();
                const core = asRecord(root.core);
                return {
                    phase: asRecord(root.sys).phase ?? core.phase ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    responseWindow: asRecord(asRecord(root.sys).responseWindow).current ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'offensiveRoll',
                rollConfirmed: true,
                responseWindow: null,
            });

            await clickResolvedAbilitySlot(hostPage, 'fist', 'bloodthirsty-claws', 'bloodthirsty-claws-3');

            await expect.poll(async () => {
                const root = await readRootState();
                const core = asRecord(root.core);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    sourceAbilityId: pendingAttack.sourceAbilityId ?? null,
                    defenderId: pendingAttack.defenderId ?? null,
                    isDefendable: pendingAttack.isDefendable ?? null,
                    damageResolved: pendingAttack.damageResolved ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                sourceAbilityId: 'bloodthirsty-claws-3',
                defenderId: '1',
                isDefendable: true,
                damageResolved: false,
            });

            const settleAttackButton = hostPage.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
            await expect(settleAttackButton).toBeVisible({ timeout: 10000 });
            await expect(settleAttackButton).toBeEnabled({ timeout: 10000 });
            await settleAttackButton.click();
            await dismissAttackShowcaseIfVisible(guestPage);

            await expect.poll(async () => {
                const current = await getMatchState(match.matchId, guestPage) as JsonRecord;
                const root = asRecord(current.G ?? current);
                const core = asRecord(root.core);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: asRecord(root.sys).phase ?? core.phase ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                    rollDiceCount: core.rollDiceCount ?? null,
                    rollCount: core.rollCount ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'defensiveRoll',
                defenseAbilityId: 'thick-skin',
                rollDiceCount: 3,
                rollCount: 0,
                rollConfirmed: false,
            });

            const guestRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]').first();
            const guestConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]').first();
            await expect(guestRollButton).toBeVisible({ timeout: 10000 });
            await expect(guestRollButton).toBeEnabled();
            await guestRollButton.click();
            await applyDiceValues(guestPage, [1, 2, 3]);
            await expect.poll(async () => {
                const current = await getMatchState(match.matchId, guestPage) as JsonRecord;
                const root = asRecord(current.G ?? current);
                const core = asRecord(root.core);
                const currentRollContext = asRecord(core.currentRollContext);
                return {
                    rollCount: core.rollCount ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    dice: Array.isArray(currentRollContext.dice)
                        ? currentRollContext.dice.slice(0, 3).map((die: any) => die?.value ?? null)
                        : Array.isArray(core.dice)
                            ? core.dice.slice(0, 3).map((die: any) => die?.value ?? null)
                            : [],
                };
            }, { timeout: 10000 }).toEqual({
                rollCount: 1,
                rollConfirmed: false,
                dice: [1, 2, 3],
            });
            await expect(guestConfirmButton).toBeEnabled({ timeout: 5000 });
            await guestConfirmButton.click();

            const mesmerizeToken = hostPage.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}`);
            const mesmerizeTokenHitTarget = hostPage.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}-hit-target`);
            const diceTray = getRightTrayDiceTray(hostPage);
            const firstOpponentDie = diceTray.getByTestId('die-button-0').first();
            await expect.poll(async () => {
                const root = await readRootState();
                const core = asRecord(root.core);
                const responseWindow = asRecord(asRecord(root.sys).responseWindow).current;
                const windowRecord = asRecord(responseWindow);
                const currentRollContext = asRecord(core.currentRollContext);
                return {
                    phase: asRecord(root.sys).phase ?? core.phase ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    windowType: windowRecord.windowType ?? null,
                    currentResponderId: Array.isArray(windowRecord.responderQueue)
                        ? windowRecord.responderQueue[Number(windowRecord.currentResponderIndex ?? 0)]
                        : null,
                    currentRollOwner: currentRollContext.ownerPlayerId ?? null,
                    currentDiceValues: Array.isArray(currentRollContext.dice)
                        ? currentRollContext.dice.map((die: any) => die.value)
                        : [],
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'defensiveRoll',
                rollConfirmed: true,
                windowType: 'afterRollConfirmed',
                currentResponderId: '0',
                currentRollOwner: '1',
                currentDiceValues: [1, 2, 3],
            });
            await expect(hostPage.getByTestId('dicethrone-response-window-hint')).toBeVisible({ timeout: 10000 });
            await expectVisibleUsableTokenAction(mesmerizeToken, mesmerizeTokenHitTarget);
            await saveEvidenceScreenshot(hostPage, testInfo, '吸血鬼领主-催眠真实防御确认后响应窗口-token本体高亮');

            await setDiceThroneBonusDiceValues(hostPage, [6]);
            await mesmerizeTokenHitTarget.click();
            await applyPendingBonusDiceValues(hostPage, [6]);
            await expect.poll(async () => {
                const root = await readRootState();
                const settlement = asRecord(asRecord(root.core).pendingBonusDiceSettlement);
                const die = Array.isArray(settlement.dice) ? asRecord(settlement.dice[0]) : {};
                return {
                    sourceAbilityId: settlement.sourceAbilityId ?? null,
                    bonusValue: die.value ?? null,
                    bonusFace: die.face ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                sourceAbilityId: TOKEN_IDS.MESMERIZE,
                bonusValue: 6,
                bonusFace: VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
            });
            await expectRightTrayBonusDiceConfirmation(hostPage, readRootState, {
                sourceAbilityId: TOKEN_IDS.MESMERIZE,
                ...VAMPIRE_LORD_BONUS_DICE_OWNER,
            });
            await saveEvidenceScreenshot(hostPage, testInfo, '吸血鬼领主-催眠真实防御确认后临时骰确认前');
            await settleCurrentBonusDice(hostPage, readRootState, {
                sourceAbilityId: TOKEN_IDS.MESMERIZE,
            });

            await expect.poll(async () => {
                const root = await readRootState();
                const current = asRecord(asRecord(root.sys).interaction).current;
                const meta = asRecord(asRecord(current).data).meta;
                return {
                    kind: asRecord(current).kind ?? null,
                    playerId: asRecord(current).playerId ?? null,
                    dtType: asRecord(meta).dtType ?? null,
                    targetOpponentDice: asRecord(meta).targetOpponentDice ?? null,
                    diceOwnerId: asRecord(meta).diceOwnerId ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                kind: 'multistep-choice',
                playerId: '0',
                dtType: 'selectDie',
                targetOpponentDice: true,
                diceOwnerId: '1',
            });
            await expect(firstOpponentDie).toHaveAttribute('data-clickable', 'true', { timeout: 10000 });
            await saveEvidenceScreenshot(hostPage, testInfo, '吸血鬼领主-催眠真实防御确认后选择对手骰');

            await firstOpponentDie.click();
            await expect(firstOpponentDie).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
            const confirmRerollButton = hostPage.getByTestId('dice-interaction-confirm-button');
            await expect(confirmRerollButton).toBeVisible({ timeout: 5000 });
            await expect(confirmRerollButton).toBeEnabled({ timeout: 5000 });
            await confirmRerollButton.click();

            await expect.poll(async () => {
                const root = await readRootState();
                const core = asRecord(root.core);
                const currentRollContext = asRecord(core.currentRollContext);
                const firstDie = Array.isArray(currentRollContext.dice)
                    ? currentRollContext.dice.find((die: any) => die.id === 0)
                    : null;
                const eventTypes = getLastEventTypes(root);
                return {
                    phase: asRecord(root.sys).phase ?? core.phase ?? null,
                    firstDieValueIsValid: typeof firstDie?.value === 'number' && firstDie.value >= 1 && firstDie.value <= 6,
                    firstDieOwner: firstDie?.ownerId ?? null,
                    mesmerize: asRecord(asRecord(core.players)['0']).tokens
                        ? asRecord(asRecord(asRecord(core.players)['0']).tokens)[TOKEN_IDS.MESMERIZE] ?? null
                        : null,
                    responseWindow: asRecord(asRecord(root.sys).responseWindow).current ?? null,
                    interactionKind: asRecord(asRecord(root.sys).interaction).current
                        ? asRecord(asRecord(asRecord(root.sys).interaction).current).kind ?? null
                        : null,
                    pendingAttackSource: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                    damageResolved: asRecord(core.pendingAttack).damageResolved ?? null,
                    attackResolved: eventTypes.includes('ATTACK_RESOLVED'),
                    dieRerolled: eventTypes.includes('DIE_REROLLED'),
                    defenderHp: asRecord(asRecord(asRecord(core.players)['1']).resources)[RESOURCE_IDS.HP] ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'defensiveRoll',
                firstDieValueIsValid: true,
                firstDieOwner: '1',
                mesmerize: 0,
                responseWindow: null,
                interactionKind: null,
                pendingAttackSource: 'bloodthirsty-claws-3',
                damageResolved: false,
                attackResolved: false,
                dieRerolled: true,
                defenderHp: 50,
            });
            await expect.poll(async () => {
                const displayValue = await firstOpponentDie.getAttribute('data-display-value');
                const numericValue = Number(displayValue);
                return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 6;
            }, { timeout: 10000 }).toBe(true);
            await saveEvidenceScreenshot(hostPage, testInfo, '吸血鬼领主-催眠真实防御确认后重掷未跳过攻击');

            const endDefenseButton = guestPage.getByRole('button', { name: /结束防御|End Defense/i }).first();
            await expect(endDefenseButton).toBeEnabled({ timeout: 10000 });
            await endDefenseButton.click();

            await expect.poll(async () => {
                const root = await readRootState();
                const core = asRecord(root.core);
                const events = (asRecord(asRecord(root.sys).eventStream).entries as any[] | undefined ?? [])
                    .map((entry: any) => entry?.event)
                    .filter(Boolean)
                    .reverse();
                const attackDamage = events.find((event: any) => (
                    event.type === 'DAMAGE_DEALT'
                    && event.payload?.targetId === '1'
                    && event.payload?.sourceAbilityId === 'bloodthirsty-claws-3'
                ));
                return {
                    phase: asRecord(root.sys).phase ?? core.phase ?? null,
                    pendingAttack: core.pendingAttack ?? null,
                    attackPayload: attackDamage?.payload ?? null,
                    events: getLastEventTypes(root),
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'main2',
                pendingAttack: null,
                attackPayload: expect.objectContaining({
                    targetId: '1',
                    sourceAbilityId: 'bloodthirsty-claws-3',
                    damageScope: 'attack',
                }),
                events: expect.arrayContaining(['DIE_REROLLED', 'DAMAGE_DEALT', 'ATTACK_RESOLVED']),
            });
            await saveEvidenceScreenshot(hostPage, testInfo, '吸血鬼领主-催眠真实防御确认后结束防御才结算攻击');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupOnlineMatch(browser, baseURL, {
            skipImageGate: true,
            characterSelectionTimeout: 240000,
        });
        if (!match) {
            test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
            return;
        }

        const getHeroCard = (playerState: { hand?: unknown[]; deck?: unknown[]; discard?: unknown[] }, cardId: string) => {
            const card = [...(playerState.hand ?? []), ...(playerState.deck ?? []), ...(playerState.discard ?? [])]
                .find((item) => asRecord(item).id === cardId);
            if (!card) {
                throw new Error(`角色牌库缺少 E2E 证明用卡牌: ${cardId}`);
            }
            return structuredClone(card);
        };

        const readRoot = (state: JsonRecord): JsonRecord => asRecord(state.G ?? state);
        const resetInteractionState = (sys: JsonRecord): JsonRecord => ({
            ...sys,
            responseWindow: {
                ...asRecord(sys.responseWindow),
                current: null,
            },
            interaction: {
                ...asRecord(sys.interaction),
                current: null,
                queue: [],
                isBlocked: false,
            },
        });
        const injectGetAwayScene = async (activePlayerId: '0' | '1') => {
            const current = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
            const next = structuredClone(current) as JsonRecord;
            const root = readRoot(next);
            const core = asRecord(root.core);
            const sys = asRecord(root.sys);
            const players = asRecordMap(core.players);
            const vampireBase = initHeroState('0', VAMPIRE_LORD_HERO_ID, FIXED_E2E_RANDOM);
            const tianshiBase = initHeroState('1', TIANSHI_HERO_ID, FIXED_E2E_RANDOM);

            const vampireGetAway = getHeroCard(vampireBase, 'card-get-away');
            const tianshiGetAway = getHeroCard(tianshiBase, 'card-get-away');

            root.core = {
                ...core,
                phase: 'main1',
                activePlayerId,
                selectedCharacters: {
                    ...asRecord(core.selectedCharacters),
                    '0': VAMPIRE_LORD_HERO_ID,
                    '1': TIANSHI_HERO_ID,
                },
                hostStarted: true,
                rollCount: 0,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: false,
                dice: [],
                currentRollContext: undefined,
                pendingAttack: null,
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
                passiveActionUsedThisTurn: {
                    ...asRecord(core.passiveActionUsedThisTurn),
                    [activePlayerId]: {},
                },
                players: {
                    ...players,
                    '0': {
                        ...vampireBase,
                        id: '0',
                        characterId: VAMPIRE_LORD_HERO_ID,
                        resources: {
                            ...vampireBase.resources,
                            [RESOURCE_IDS.HP]: 50,
                            [RESOURCE_IDS.CP]: 2,
                        },
                        tokens: {
                            ...vampireBase.tokens,
                            [TOKEN_IDS.BLOOD_POWER]: 0,
                            [TOKEN_IDS.MESMERIZE]: 1,
                        },
                        statusEffects: {
                            ...vampireBase.statusEffects,
                            [STATUS_IDS.DAZZLE]: activePlayerId === '1' ? 1 : 0,
                        },
                        hand: activePlayerId === '0' ? [vampireGetAway] : [],
                        deck: [],
                        discard: [],
                    },
                    '1': {
                        ...tianshiBase,
                        id: '1',
                        characterId: TIANSHI_HERO_ID,
                        resources: {
                            ...tianshiBase.resources,
                            [RESOURCE_IDS.HP]: 50,
                            [RESOURCE_IDS.CP]: 2,
                        },
                        tokens: {
                            ...tianshiBase.tokens,
                            [TOKEN_IDS.DIVINE_ARRIVAL]: activePlayerId === '0' ? 1 : 0,
                        },
                        statusEffects: {
                            ...tianshiBase.statusEffects,
                            [STATUS_IDS.ENTANGLE]: activePlayerId === '0' ? 1 : 0,
                        },
                        hand: activePlayerId === '1' ? [tianshiGetAway] : [],
                        deck: [],
                        discard: [],
                    },
                },
            };
            const turnOrder = ['0', '1'];
            root.sys = {
                ...resetInteractionState(sys),
                phase: 'main1',
                turnOrder,
                currentPlayerIndex: turnOrder.indexOf(activePlayerId),
            };

            await injectMatchState(match.matchId, next as never, match.hostPage);
            await Promise.all([match.hostPage, match.guestPage].map((targetPage) => (
                targetPage.waitForFunction((expectedActivePlayerId) => {
                    const state = window.__BG_TEST_HARNESS__?.state?.get?.();
                    return state?.core?.activePlayerId === expectedActivePlayerId
                        && state?.sys?.phase === 'main1'
                        && state?.core?.selectedCharacters?.['0'] === 'vampire_lord'
                        && state?.core?.selectedCharacters?.['1'] === 'tianshi';
                }, activePlayerId, { timeout: 15000, polling: 200 })
            )));
        };

        try {
            await selectCharacter(match.hostPage, VAMPIRE_LORD_HERO_ID);
            await selectCharacter(match.guestPage, TIANSHI_HERO_ID);
            await readyAndStartGame(match.hostPage, match.guestPage);
            await Promise.all([
                waitForGameBoard(match.hostPage),
                waitForGameBoard(match.guestPage),
                waitForDiceThroneHarness(match.hostPage),
                waitForDiceThroneHarness(match.guestPage),
            ]);
            await closeDebugPanelIfOpen(match.hostPage);
            await closeDebugPanelIfOpen(match.guestPage);
            await match.hostPage.setViewportSize({ width: 1280, height: 720 });
            await match.guestPage.setViewportSize({ width: 1280, height: 720 });

            await injectGetAwayScene('0');
            await expectVampireLordCardPreview(match.hostPage, 'card-get-away', 11);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-吸血鬼领主-起开手牌卡图可见');

            await dragHandCardToPlay(match.hostPage, 'card-get-away');
            await expect.poll(async () => {
                const state = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = readRoot(state);
                const current = asRecord(asRecord(root.sys).interaction).current as JsonRecord | undefined;
                return {
                    kind: current?.kind ?? null,
                    playerId: current?.playerId ?? null,
                    interactionType: asRecord(current?.data).type ?? null,
                    targetPlayerIds: asRecord(current?.data).targetPlayerIds ?? [],
                    sourceId: asRecord(current?.data).sourceId ?? null,
                };
            }, { timeout: 15000 }).toEqual({
                kind: 'dt:card-interaction',
                playerId: '0',
                interactionType: 'selectStatus',
                targetPlayerIds: ['0', '1'],
                sourceId: 'card-get-away',
            });
            const tianshiStatusOwner = match.hostPage.getByTestId('dt-status-owner-1');
            const entangleOption = tianshiStatusOwner.getByTestId(`dt-status-effect-1-${STATUS_IDS.ENTANGLE}`);
            const divineArrivalOption = tianshiStatusOwner.getByTestId(`dt-status-effect-1-${TOKEN_IDS.DIVINE_ARRIVAL}`);
            await expect(entangleOption).toBeVisible({ timeout: 10000 });
            await expect(divineArrivalOption).toHaveCount(0);
            await entangleOption.click();
            const hostConfirmButton = match.hostPage.getByRole('button', { name: /确认|Confirm/i }).last();
            await expect(hostConfirmButton).toBeEnabled({ timeout: 5000 });
            await hostConfirmButton.click();
            await expect.poll(async () => {
                const state = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = readRoot(state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                return {
                    entangle: asRecord(p1.statusEffects)[STATUS_IDS.ENTANGLE] ?? 0,
                    divineArrival: asRecord(p1.tokens)[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
                    vampireCp: asRecord(p0.resources)[RESOURCE_IDS.CP] ?? null,
                    interactionKind: asRecord(asRecord(sys.interaction).current).kind ?? null,
                    handContainsGetAway: Array.isArray(p0.hand)
                        ? p0.hand.some((card) => asRecord(card).id === 'card-get-away')
                        : null,
                    discardContainsGetAway: Array.isArray(p0.discard)
                        ? p0.discard.some((card) => asRecord(card).id === 'card-get-away')
                        : null,
                };
            }, { timeout: 15000 }).toEqual({
                entangle: 0,
                divineArrival: 1,
                vampireCp: 1,
                interactionKind: null,
                handContainsGetAway: false,
                discardContainsGetAway: true,
            });
            await expectActionLogContains(match.hostPage, ['起开', '缠绕']);
            await expectActionLogCardTooltipPreview(
                match.hostPage,
                ['起开', '缠绕'],
                /起开/,
                VAMPIRE_LORD_CARD_ATLAS_ID,
                11,
                /dicethrone\/images\/xixuegui\/(?:compressed\/)?ability-cards\.webp/i,
            );
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-吸血鬼视角-自己起开行动日志卡图预览可见');
            await closeFabPanel(match.hostPage, 'action-log');

            await injectGetAwayScene('1');
            await expectTianshiCardPreview(match.guestPage, 'card-get-away', 11);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '03-天使视角-起开手牌卡图可见');

            await dragHandCardToPlay(match.guestPage, 'card-get-away');
            await expectCardSpotlightPreview(
                match.hostPage,
                'card-get-away',
                '1',
                TIANSHI_CARD_ATLAS_ID,
                11,
                /dicethrone\/images\/tianshi\/(?:compressed\/)?ability-cards\.webp/i,
            );
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-吸血鬼视角-对手起开打出特写卡图可见');
            await closeCardSpotlight(match.hostPage);

            await expect.poll(async () => {
                const state = await getMatchState(match.matchId, match.guestPage) as JsonRecord;
                const root = readRoot(state);
                const current = asRecord(asRecord(root.sys).interaction).current as JsonRecord | undefined;
                return {
                    kind: current?.kind ?? null,
                    playerId: current?.playerId ?? null,
                    interactionType: asRecord(current?.data).type ?? null,
                    targetPlayerIds: asRecord(current?.data).targetPlayerIds ?? [],
                    sourceId: asRecord(current?.data).sourceId ?? null,
                };
            }, { timeout: 15000 }).toEqual({
                kind: 'dt:card-interaction',
                playerId: '1',
                interactionType: 'selectStatus',
                targetPlayerIds: ['0', '1'],
                sourceId: 'card-get-away',
            });

            const vampireStatusOwner = match.guestPage.getByTestId('dt-status-owner-0');
            const mesmerizeOption = vampireStatusOwner.getByTestId(`dt-status-effect-0-${TOKEN_IDS.MESMERIZE}`);
            const dazzleOption = vampireStatusOwner.getByTestId(`dt-status-effect-0-${STATUS_IDS.DAZZLE}`);
            await expect(mesmerizeOption).toBeVisible({ timeout: 10000 });
            await expect(dazzleOption).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '05-天使视角-起开可选择催眠且眩光仍可见');

            await mesmerizeOption.click();
            const confirmButton = match.guestPage.getByRole('button', { name: /确认|Confirm/i }).last();
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            await expect.poll(async () => {
                const state = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = readRoot(state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const eventEntries = asRecord(sys.eventStream).entries;
                const events = Array.isArray(eventEntries)
                    ? (eventEntries as Array<{ event?: JsonRecord }>)
                        .map((entry) => entry.event)
                        .filter(Boolean)
                    : [];
                const consumed = events.find((event) => (
                    event?.type === 'TOKEN_CONSUMED'
                    && asRecord(event.payload).tokenId === TOKEN_IDS.MESMERIZE
                    && asRecord(event.payload).playerId === '0'
                ));
                const confirmed = events.find((event) => (
                    event?.type === 'SYS_INTERACTION_CONFIRMED'
                    && asRecord(event.payload).sourceId === 'card-get-away'
                ));
                return {
                    mesmerize: asRecord(p0.tokens)[TOKEN_IDS.MESMERIZE] ?? 0,
                    dazzle: asRecord(p0.statusEffects)[STATUS_IDS.DAZZLE] ?? 0,
                    tianshiCp: asRecord(p1.resources)[RESOURCE_IDS.CP] ?? null,
                    interactionKind: asRecord(asRecord(sys.interaction).current).kind ?? null,
                    consumedSourceCommandType: consumed?.sourceCommandType ?? null,
                    consumedAmount: asRecord(consumed?.payload).amount ?? null,
                    confirmedPlayerId: asRecord(confirmed?.payload).playerId ?? null,
                };
            }, { timeout: 15000 }).toEqual({
                mesmerize: 0,
                dazzle: 1,
                tianshiCp: 1,
                interactionKind: null,
                consumedSourceCommandType: 'REMOVE_STATUS',
                consumedAmount: 1,
                confirmedPlayerId: '1',
            });

            await expect(match.hostPage.getByTestId(`dt-player-0-token-${TOKEN_IDS.MESMERIZE}`)).toHaveCount(0);
            await expect(match.hostPage.getByTestId(`dt-player-0-status-${STATUS_IDS.DAZZLE}`)).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06-吸血鬼视角-起开后催眠移除眩光仍在');
            await expectActionLogContains(match.hostPage, ['起开', '催眠']);
            await expectActionLogCardTooltipPreview(
                match.hostPage,
                ['起开', '催眠'],
                /起开/,
                TIANSHI_CARD_ATLAS_ID,
                11,
                /dicethrone\/images\/tianshi\/(?:compressed\/)?ability-cards\.webp/i,
            );
            await saveEvidenceScreenshot(match.hostPage, testInfo, '07-吸血鬼视角-对手起开行动日志卡图预览可见');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('鲜血之力 2 档应通过状态选择移除流血', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 2 },
                statusEffects: { [STATUS_IDS.BLEED]: 1 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
            },
        });
        await closeDebugPanelIfVisible(page);

        const removeStatusButton = page.getByTestId('passive-action-vampire-lord-blood-power-1');
        const passiveActionBar = page.getByTestId('passive-ability-action-bar');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(passiveActionBar).toBeVisible({ timeout: 10000 });
        await expect(passiveActionBar.locator('[data-testid="passive-action-vampire-lord-blood-power-1"]')).toHaveCount(1);
        await expect(removeStatusButton).toBeVisible({ timeout: 10000 });
        await expect(removeStatusButton).toBeEnabled();
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveAttribute('data-token-amount', '2');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                bleed: state?.core?.players?.['0']?.statusEffects?.[STATUS_IDS.BLEED] ?? null,
            };
        }, { timeout: 10000 }).toEqual({ bloodPower: 2, bleed: 1 });
        await game.screenshot('吸血鬼领主-鲜血之力移除状态入口-按钮可见', testInfo);

        await removeStatusButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const current = state?.sys?.interaction?.current;
            return {
                kind: current?.kind ?? null,
                playerId: current?.playerId ?? null,
                interactionType: current?.data?.type ?? null,
                targetPlayerIds: current?.data?.targetPlayerIds ?? [],
                sourceId: current?.data?.sourceId ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                bleed: state?.core?.players?.['0']?.statusEffects?.[STATUS_IDS.BLEED] ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            kind: 'dt:card-interaction',
            playerId: '0',
            interactionType: 'selectStatus',
            targetPlayerIds: ['0', '1'],
            sourceId: 'vampire-lord-blood-power',
            bloodPower: 0,
            bleed: 1,
        });

        const bleedOption = page.getByTestId('dt-status-owner-0').getByTestId('dt-status-effect-0-bleed');
        await expect(bleedOption).toBeVisible({ timeout: 10000 });
        await game.screenshot('吸血鬼领主-鲜血之力状态选择-流血可选', testInfo);

        await bleedOption.click();
        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await game.screenshot('吸血鬼领主-鲜血之力状态选择-流血已选', testInfo);
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const events = getLastEventTypes(state);
            const entryEvents = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean)
                .reverse();
            const removed = entryEvents.find((event: any) => event.type === 'STATUS_REMOVED');
            const consumed = entryEvents.find((event: any) => (
                event.type === 'TOKEN_CONSUMED'
                && event.payload?.tokenId === TOKEN_IDS.BLOOD_POWER
            ));
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                bleed: state?.core?.players?.['0']?.statusEffects?.[STATUS_IDS.BLEED] ?? null,
                hasTokenConsumed: getLastEventTypes(state).includes('TOKEN_CONSUMED'),
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                removedPayload: removed?.payload ?? null,
                consumedPayload: consumed?.payload ?? null,
                events,
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            bleed: 0,
            hasTokenConsumed: true,
            interactionKind: null,
            removedPayload: expect.objectContaining({ targetId: '0', statusId: STATUS_IDS.BLEED, stacks: 1 }),
            consumedPayload: expect.objectContaining({
                tokenId: TOKEN_IDS.BLOOD_POWER,
                amount: 2,
                newTotal: 0,
            }),
            events: expect.arrayContaining(['STATUS_REMOVED']),
        });
        await expect(page.getByTestId('dt-status-effect-0-bleed')).toHaveCount(0);
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveCount(0);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力移除状态后收口', testInfo);
    });

    test('鲜血之力 3 档应通过玩家板按钮抽 2 张牌', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                deck: [
                    'card-vampire-lord-blood-surge',
                    'card-vampire-lord-gushing-blood',
                ],
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 3 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
            },
        });
        await closeDebugPanelIfVisible(page);

        const drawButton = page.getByTestId('passive-action-vampire-lord-blood-power-2');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(drawButton).toBeVisible({ timeout: 10000 });
        await expect(drawButton).toBeEnabled();
        await expect(drawButton).not.toContainText('消耗3');
        await expect(page.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(0);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hand: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                deck: (state?.core?.players?.['0']?.deck ?? []).map((card: any) => card.id),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 3,
            hand: [],
            deck: [
                'card-vampire-lord-blood-surge',
                'card-vampire-lord-gushing-blood',
            ],
        });
        await game.screenshot('吸血鬼领主-鲜血之力抽牌入口-使用前', testInfo);

        await drawButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hand: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                deck: (state?.core?.players?.['0']?.deck ?? []).map((card: any) => card.id),
                hasTokenConsumed: getLastEventTypes(state).includes('TOKEN_CONSUMED'),
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            hand: [
                'card-vampire-lord-blood-surge',
                'card-vampire-lord-gushing-blood',
            ],
            deck: [],
            hasTokenConsumed: true,
            events: expect.arrayContaining(['CARD_DRAWN']),
        });
        await expect(drawButton).toBeVisible({ timeout: 10000 });
        await expect(drawButton).toBeDisabled();
        await expect(page.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(2, { timeout: 10000 });
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveCount(0);
        await expectVampireLordCardPreview(page, 'card-vampire-lord-blood-surge', 17);
        await expectVampireLordCardPreview(page, 'card-vampire-lord-gushing-blood', 21);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力抽牌后收口', testInfo);
    });

    test('血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);

        await test.step('血潮汹涌应先出现奖励骰，确认后血滴才获得 3 个鲜血之力', async () => {
            const cardId = 'card-vampire-lord-blood-surge';
            await game.setupScene({
                gameId: 'dicethrone',
                player0: {
                    hand: [cardId],
                    deck: ['card-vampire-lord-gushing-blood'],
                    resources: { CP: 2, HP: 50 },
                    tokens: { [TOKEN_IDS.BLOOD_POWER]: 0 },
                },
                player1: {
                    resources: { CP: 2, HP: 50 },
                },
                currentPlayer: '0',
                phase: 'main1',
                extra: {
                    selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                    hostStarted: true,
                    activePlayerId: '0',
                    dice: [],
                    currentRollContext: undefined,
                    pendingAttack: null,
                    pendingBonusDiceSettlement: undefined,
                },
            });
            await closeDebugPanelIfVisible(page);
            await setDiceThroneBonusDiceValues(page, [6]);
            await expectVampireLordCardPreview(page, cardId, 17);

            await dragVampireLordHandCardToPlay(page, cardId);

            await expect.poll(async () => {
                const state = await game.getState();
                const player = state?.core?.players?.['0'];
                const settlement = state?.core?.pendingBonusDiceSettlement;
                return {
                    handHasCard: (player?.hand ?? []).some((card: any) => card.id === cardId),
                    discardHasCard: (player?.discard ?? []).some((card: any) => card.id === cardId),
                    cp: player?.resources?.[RESOURCE_IDS.CP] ?? null,
                    bloodPower: player?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? 0,
                    sourceAbilityId: settlement?.sourceAbilityId ?? null,
                    diceValues: (settlement?.dice ?? []).map((die: any) => die.value),
                    diceFaces: (settlement?.dice ?? []).map((die: any) => die.face),
                    events: getLastEventTypes(state),
                };
            }, { timeout: 10000 }).toEqual({
                handHasCard: false,
                discardHasCard: true,
                cp: 2,
                bloodPower: 0,
                sourceAbilityId: cardId,
                diceValues: [6],
                diceFaces: [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP],
                events: expect.arrayContaining(['CARD_PLAYED', 'BONUS_DIE_ROLLED']),
            });
            await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
                sourceAbilityId: cardId,
                ...VAMPIRE_LORD_BONUS_DICE_OWNER,
            });
            await game.screenshot('吸血鬼领主-血潮汹涌-奖励骰待确认', testInfo);

            await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: cardId });

            await expect.poll(async () => {
                const state = await game.getState();
                const player = state?.core?.players?.['0'];
                return {
                    cp: player?.resources?.[RESOURCE_IDS.CP] ?? null,
                    bloodPower: player?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? 0,
                    handIds: (player?.hand ?? []).map((card: any) => card.id),
                    discardIds: (player?.discard ?? []).map((card: any) => card.id),
                    events: getLastEventTypes(state),
                };
            }, { timeout: 10000 }).toEqual({
                cp: 2,
                bloodPower: 3,
                handIds: [],
                discardIds: [cardId],
                events: expect.arrayContaining(['BONUS_DICE_SETTLED', 'TOKEN_GRANTED']),
            });
            await waitForDiceThroneVisualIdle(page);
            await game.screenshot('吸血鬼领主-血潮汹涌-血滴结算后获得3血力', testInfo);
        });

        await test.step('血从天降应先出现奖励骰，确认后按骰值一半向上取整获得鲜血之力', async () => {
            const cardId = 'card-vampire-lord-blood-from-above';
            await game.setupScene({
                gameId: 'dicethrone',
                player0: {
                    hand: [cardId],
                    resources: { CP: 2, HP: 50 },
                    tokens: { [TOKEN_IDS.BLOOD_POWER]: 0 },
                },
                player1: {
                    resources: { CP: 2, HP: 50 },
                },
                currentPlayer: '0',
                phase: 'main1',
                extra: {
                    selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                    hostStarted: true,
                    activePlayerId: '0',
                    dice: [],
                    currentRollContext: undefined,
                    pendingAttack: null,
                    pendingBonusDiceSettlement: undefined,
                },
            });
            await closeDebugPanelIfVisible(page);
            await setDiceThroneBonusDiceValues(page, [5]);
            await expectVampireLordCardPreview(page, cardId, 18);

            await dragVampireLordHandCardToPlay(page, cardId);

            await expect.poll(async () => {
                const state = await game.getState();
                const player = state?.core?.players?.['0'];
                const settlement = state?.core?.pendingBonusDiceSettlement;
                const die = settlement?.dice?.[0];
                return {
                    handHasCard: (player?.hand ?? []).some((card: any) => card.id === cardId),
                    discardHasCard: (player?.discard ?? []).some((card: any) => card.id === cardId),
                    bloodPower: player?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? 0,
                    sourceAbilityId: settlement?.sourceAbilityId ?? null,
                    bonusValue: die?.value ?? null,
                    bonusFace: die?.face ?? null,
                    bonusAmount: die?.effectParams?.amount ?? null,
                    events: getLastEventTypes(state),
                };
            }, { timeout: 10000 }).toEqual({
                handHasCard: false,
                discardHasCard: true,
                bloodPower: 0,
                sourceAbilityId: cardId,
                bonusValue: 5,
                bonusFace: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
                bonusAmount: 3,
                events: expect.arrayContaining(['CARD_PLAYED', 'BONUS_DIE_ROLLED']),
            });
            await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
                sourceAbilityId: cardId,
                ...VAMPIRE_LORD_BONUS_DICE_OWNER,
            });
            await game.screenshot('吸血鬼领主-血从天降-奖励骰待确认', testInfo);

            await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: cardId });

            await expect.poll(async () => {
                const state = await game.getState();
                const player = state?.core?.players?.['0'];
                return {
                    bloodPower: player?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? 0,
                    cp: player?.resources?.[RESOURCE_IDS.CP] ?? null,
                    discardIds: (player?.discard ?? []).map((card: any) => card.id),
                    events: getLastEventTypes(state),
                };
            }, { timeout: 10000 }).toEqual({
                bloodPower: 3,
                cp: 1,
                discardIds: [cardId],
                events: expect.arrayContaining(['BONUS_DICE_SETTLED', 'TOKEN_GRANTED']),
            });
            await waitForDiceThroneVisualIdle(page);
            await game.screenshot('吸血鬼领主-血从天降-结算后获得3血力', testInfo);
        });

        await test.step('饮血如酒应打开花费鲜血之力选择，确认后按花费数量获得 CP', async () => {
            const cardId = 'card-vampire-lord-drink-up';
            await game.setupScene({
                gameId: 'dicethrone',
                player0: {
                    hand: [cardId],
                    resources: { CP: 0, HP: 50 },
                    tokens: { [TOKEN_IDS.BLOOD_POWER]: 4 },
                },
                player1: {
                    resources: { CP: 2, HP: 50 },
                },
                currentPlayer: '0',
                phase: 'main1',
                extra: {
                    selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                    hostStarted: true,
                    activePlayerId: '0',
                    dice: [],
                    currentRollContext: undefined,
                    pendingAttack: null,
                    pendingBonusDiceSettlement: undefined,
                },
            });
            await closeDebugPanelIfVisible(page);
            await expectVampireLordCardPreview(page, cardId, 31);

            await dragVampireLordHandCardToPlay(page, cardId);

            await expect.poll(async () => {
                const state = await game.getState();
                const player = state?.core?.players?.['0'];
                const interaction = state?.sys?.interaction?.current;
                const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                    ? interaction.data.options
                    : [];
                return {
                    handHasCard: (player?.hand ?? []).some((card: any) => card.id === cardId),
                    discardHasCard: (player?.discard ?? []).some((card: any) => card.id === cardId),
                    interactionKind: interaction?.kind ?? null,
                    sourceId: interaction?.data?.sourceId ?? null,
                    optionValues: options.map((option: any) => option?.value?.value),
                    optionCustomIds: options.map((option: any) => option?.value?.customId),
                    bloodPower: player?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                    cp: player?.resources?.[RESOURCE_IDS.CP] ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                handHasCard: false,
                discardHasCard: true,
                interactionKind: 'simple-choice',
                sourceId: cardId,
                optionValues: [0, 1, 2],
                optionCustomIds: [
                    'vampire-lord-drink-up-spend',
                    'vampire-lord-drink-up-spend',
                    'vampire-lord-drink-up-spend',
                ],
                bloodPower: 4,
                cp: 0,
            });
            const modalRoot = page.locator('#modal-root');
            await expect(modalRoot.getByRole('heading', { name: '技能结算选择' })).toBeVisible({ timeout: 5000 });
            await expect(modalRoot.getByText('饮血如酒：选择花费的鲜血之力')).toBeVisible({ timeout: 5000 });
            await expect(modalRoot.locator('button[data-option-id="option-0"]')).toContainText('不花费');
            await expect(modalRoot.locator('button[data-option-id="option-1"]')).toContainText('花费 1 个鲜血之力');
            await expect(modalRoot.locator('button[data-option-id="option-2"]')).toContainText('花费 2 个鲜血之力');
            await game.screenshot('吸血鬼领主-饮血如酒-花费血力选择', testInfo);

            await modalRoot.locator('button[data-option-id="option-2"]').click();

            await expect.poll(async () => {
                const state = await game.getState();
                const player = state?.core?.players?.['0'];
                return {
                    interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                    bloodPower: player?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                    cp: player?.resources?.[RESOURCE_IDS.CP] ?? null,
                    discardIds: (player?.discard ?? []).map((card: any) => card.id),
                    events: getLastEventTypes(state),
                };
            }, { timeout: 10000 }).toEqual({
                interactionKind: null,
                bloodPower: 2,
                cp: 4,
                discardIds: [cardId],
                events: expect.arrayContaining(['CHOICE_RESOLVED', 'TOKEN_CONSUMED', 'CP_CHANGED']),
            });
            await waitForDiceThroneVisualIdle(page);
            await game.screenshot('吸血鬼领主-饮血如酒-花费2血力获得4CP', testInfo);
        });
    });

    test('死无全尸真实入口应按 2 个利爪加 2 伤害，并竖直显示总伤害 5 到 7', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const cardId = 'card-vampire-lord-total-demise';
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [cardId],
                deck: [],
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 0 },
            },
            player1: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: buildVampireLordDiceForValues([1, 2, 3, 4, 6]),
                currentRollContext: undefined,
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'blood-thirst',
                    settlementStage: 'preDamage',
                    isDefendable: true,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                },
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
            },
        });
        await closeDebugPanelIfVisible(page);
        await setDiceThroneBonusDiceValues(page, [1, 2, 4, 5, 6]);
        await expectVampireLordCardPreview(page, cardId, 19);

        await dragVampireLordHandCardToPlay(page, cardId);

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                diceValues: (settlement?.dice ?? []).map((die: any) => die.value),
                diceFaces: (settlement?.dice ?? []).map((die: any) => die.face),
                handHasCard: (state?.core?.players?.['0']?.hand ?? []).some((card: any) => card.id === cardId),
                discardHasCard: (state?.core?.players?.['0']?.discard ?? []).some((card: any) => card.id === cardId),
                cp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.CP] ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: cardId,
            diceValues: [1, 2, 4, 5, 6],
            diceFaces: [
                VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
                VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
                VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
                VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
                VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
            ],
            handHasCard: false,
            discardHasCard: true,
            cp: 1,
            events: expect.arrayContaining(['CARD_PLAYED', 'BONUS_DIE_ROLLED']),
        });
        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
            sourceAbilityId: cardId,
            ...VAMPIRE_LORD_BONUS_DICE_OWNER,
        });
        await game.screenshot('吸血鬼领主-死无全尸-奖励骰2利爪待确认-这是攻击修正来源', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: cardId });

        await expect.poll(async () => {
            const state = await game.getState();
            const events = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean)
                .reverse();
            const settled = events.find((event: any) => event.type === 'BONUS_DICE_SETTLED');
            const bonusDamage = events.find((event: any) => event.type === 'BONUS_DAMAGE_ADDED');
            return {
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderBleed: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.BLEED] ?? 0,
                settledPayload: settled?.payload ?? null,
                bonusDamagePayload: bonusDamage?.payload ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            pendingBonusDiceSettlement: null,
            bonusDamage: 2,
            attackModifierBonusDamage: 2,
            defenderHp: 50,
            defenderBleed: 0,
            settledPayload: expect.objectContaining({
                sourceAbilityId: cardId,
                totalDamage: 2,
            }),
            bonusDamagePayload: expect.objectContaining({
                sourceCardId: cardId,
                amount: 2,
            }),
                events: expect.arrayContaining(['BONUS_DICE_SETTLED', 'BONUS_DAMAGE_ADDED']),
        });
        await expect.poll(async () => {
            const state = await game.getState();
            return (state?.core?.dice ?? []).map((die: any) => die.value);
        }, { timeout: 5000 }).toEqual([1, 2, 3, 4, 6]);
        await waitForDiceThroneVisualIdle(page);
        const totalDamageBadge = page.getByTestId('current-total-damage-badge');
        const totalDamageLabel = page.getByTestId('current-total-damage-label');
        const damageChange = page.getByTestId('current-total-damage-change');
        const modifierBadge = page.getByTestId('active-modifier-badge').first();
        await expect(totalDamageBadge).toBeVisible({ timeout: 5000 });
        await expect(totalDamageBadge).toHaveAttribute('data-current-damage', '7');
        await expect(totalDamageBadge).toHaveAttribute('data-original-damage', '5');
        await expect(totalDamageLabel).toBeVisible({ timeout: 5000 });
        await expect(totalDamageLabel).toHaveText('总伤害');
        await expect(damageChange).toBeVisible({ timeout: 5000 });
        await expect(damageChange).toHaveAttribute('aria-label', '5→7');
        await expect(damageChange).toHaveText('5↓7');
        const damageLabelGeometry = await page.evaluate(() => {
            const label = document.querySelector<HTMLElement>('[data-testid="current-total-damage-label"]');
            if (!label) return null;
            return Array.from(label.children).map((child) => {
                const rect = child.getBoundingClientRect();
                return { top: rect.top, bottom: rect.bottom };
            });
        });
        expect(damageLabelGeometry).not.toBeNull();
        expect(damageLabelGeometry).toHaveLength(3);
        expect(damageLabelGeometry![0].top).toBeLessThan(damageLabelGeometry![1].top);
        expect(damageLabelGeometry![1].top).toBeLessThan(damageLabelGeometry![2].top);
        const damageLabelFontSize = await totalDamageLabel.evaluate((element) => (
            Number.parseFloat(getComputedStyle(element).fontSize)
        ));
        expect(damageLabelFontSize).toBeGreaterThanOrEqual(16);
        const damageChangeFontSizes = await damageChange.locator(':scope > span').evaluateAll((elements) => (
            elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
        ));
        expect(damageChangeFontSizes).toHaveLength(3);
        expect(new Set(damageChangeFontSizes).size).toBe(1);
        expect(damageChangeFontSizes.every((fontSize) => fontSize >= 16)).toBe(true);
        const damageChangeColors = await damageChange.locator(':scope > span').evaluateAll((elements) => (
            elements.map((element) => getComputedStyle(element).color)
        ));
        expect(damageChangeColors).toHaveLength(3);
        expect(damageChangeColors[0]).not.toBe(damageChangeColors[2]);
        await expect(modifierBadge).toBeVisible({ timeout: 5000 });
        await expect(modifierBadge).toHaveAttribute('data-bonus-damage', '2');
        const damageChangeGeometry = await page.evaluate(() => {
            const total = document.querySelector<HTMLElement>('[data-testid="current-total-damage-badge"]');
            const change = document.querySelector<HTMLElement>('[data-testid="current-total-damage-change"]');
            if (!total || !change) return null;
            const totalRect = total.getBoundingClientRect();
            const changeRects = Array.from(change.children).map((child) => {
                const rect = child.getBoundingClientRect();
                return { top: rect.top, bottom: rect.bottom };
            });
            return {
                total: { left: totalRect.left, right: totalRect.right, top: totalRect.top, bottom: totalRect.bottom },
                change: changeRects,
            };
        });
        expect(damageChangeGeometry).not.toBeNull();
        expect(damageChangeGeometry!.change).toHaveLength(3);
        expect(damageChangeGeometry!.change[0].top).toBeLessThan(damageChangeGeometry!.change[1].top);
        expect(damageChangeGeometry!.change[1].top).toBeLessThan(damageChangeGeometry!.change[2].top);
        const rightTray = getRightTrayDiceTray(page);
        const modifierPlacement = await page.evaluate(() => {
            const modifier = document.querySelector<HTMLElement>('[data-testid="active-modifier-badge"]');
            const tray = document.querySelector<HTMLElement>('[data-testid="dicethrone-2d-dice-tray"]');
            if (!modifier || !tray) return null;
            const modifierRect = modifier.getBoundingClientRect();
            const trayRect = tray.getBoundingClientRect();
            return {
                modifierBottom: modifierRect.bottom,
                trayTop: trayRect.top,
            };
        });
        expect(modifierPlacement).not.toBeNull();
        expect(modifierPlacement!.modifierBottom).toBeLessThanOrEqual(modifierPlacement!.trayTop + 4);
        await expect(rightTray).toBeVisible({ timeout: 5000 });
        await modifierBadge.hover();
        const modifierTooltip = page.getByTestId('info-tooltip').last();
        await expect(modifierTooltip).toBeVisible({ timeout: 5000 });
        await expect(modifierTooltip).not.toContainText('已激活的攻击修正牌');
        await expect(modifierTooltip).not.toContainText('攻击修正：');
        await expect(modifierTooltip).not.toContainText('Attack modifier:');
        await expect(modifierTooltip).toContainText('死无全尸！');
        await expect(modifierTooltip).toContainText('投掷 5 颗骰子');
        const modifierTooltipGeometry = await modifierTooltip.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
                position: style.position,
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                placement: element.getAttribute('data-tooltip-placement'),
            };
        });
        expect(modifierTooltipGeometry.position).toBe('fixed');
        expect(modifierTooltipGeometry.left).toBeGreaterThanOrEqual(0);
        expect(modifierTooltipGeometry.top).toBeGreaterThanOrEqual(0);
        expect(modifierTooltipGeometry.right).toBeLessThanOrEqual(modifierTooltipGeometry.viewportWidth);
        expect(modifierTooltipGeometry.bottom).toBeLessThanOrEqual(modifierTooltipGeometry.viewportHeight);
        expect(['left', 'right']).toContain(modifierTooltipGeometry.placement);
        const modifierTooltipContentGeometry = await modifierTooltip.evaluate((element) => {
            const tooltipRect = element.getBoundingClientRect();
            const lines = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="info-tooltip-content-line"]'))
                .map((line) => {
                    const rect = line.getBoundingClientRect();
                    return {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        scrollWidth: line.scrollWidth,
                        clientWidth: line.clientWidth,
                    };
                });
            return {
                tooltipRect: {
                    left: tooltipRect.left,
                    right: tooltipRect.right,
                    top: tooltipRect.top,
                    bottom: tooltipRect.bottom,
                },
                lines,
            };
        });
        for (const line of modifierTooltipContentGeometry.lines) {
            expect(
                line.scrollWidth,
                '攻击修正 tip 的正文行不能横向溢出并被裁掉',
            ).toBeLessThanOrEqual(line.clientWidth + 1);
            expect(line.left).toBeGreaterThanOrEqual(modifierTooltipContentGeometry.tooltipRect.left - 1);
            expect(line.right).toBeLessThanOrEqual(modifierTooltipContentGeometry.tooltipRect.right + 1);
            expect(line.top).toBeGreaterThanOrEqual(modifierTooltipContentGeometry.tooltipRect.top - 1);
            expect(line.bottom).toBeLessThanOrEqual(modifierTooltipContentGeometry.tooltipRect.bottom + 1);
        }
        await game.screenshot('吸血鬼领主-死无全尸-结算后基础攻击骰3爪-奖励骰2爪已转为攻击修正2-总伤害5到7竖排', testInfo);
        await page.mouse.move(4, 4);
        await expectActionLogContains(page, ['死无全尸']);
        await expectActionLogContains(page, ['利爪 2 个', '+2']);
    });

    test('基础魅惑之力不可防御攻击后进入主要阶段 2，并允许鲜血之力 4 档主动吸血', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 40 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 4 },
            },
            player1: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: buildVampireLordDiceForValues([4, 4, 4, 1, 1]),
                currentRollContext: undefined,
                pendingAttack: null,
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
            },
        });
        await closeDebugPanelIfVisible(page);

        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expectVampireLordDiceSpritesForValues(page, [4, 4, 4, 1, 1]);
        await clickResolvedAbilitySlot(page, 'chi', 'mesmerize-power', 'mesmerize-power');

        await expect.poll(async () => {
            const state = await game.getState();
            const pendingAttack = state?.core?.pendingAttack;
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                defenderId: pendingAttack?.defenderId ?? null,
                isDefendable: pendingAttack?.isDefendable ?? null,
                expectedDamage: pendingAttack ? getPendingAttackExpectedDamage(state.core, pendingAttack, 0) : null,
                attackDiceValues: pendingAttack?.attackDiceValues ?? [],
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            sourceAbilityId: 'mesmerize-power',
            defenderId: '1',
            isDefendable: false,
            expectedDamage: 4,
            attackDiceValues: [4, 4, 4, 1, 1],
            bloodPower: 4,
        });
        await game.screenshot('吸血鬼领主-魅惑之力不可防御攻击已选中', testInfo);

        const settleAttackButton = page.locator('[data-tutorial-id="advance-phase-button"]').first();
        await expect(settleAttackButton).toBeVisible({ timeout: 10000 });
        await expect(settleAttackButton).toBeEnabled({ timeout: 5000 });
        await expect(settleAttackButton).toHaveText(/结算攻击|Settle Attack/i);
        await settleAttackButton.click();

        const bloodPowerButton = page.getByTestId('passive-action-vampire-lord-blood-power-3');
        await expect.poll(async () => {
            const state = await game.getState();
            const eventTypes = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event?.type)
                .filter(Boolean);
            return {
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                attackerCp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.CP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                mesmerize: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.MESMERIZE] ?? 0,
                phase: state?.sys?.phase ?? null,
                hasPendingAttack: Boolean(state?.core?.pendingAttack),
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                damageDealt: eventTypes.includes('DAMAGE_DEALT'),
                attackResolved: eventTypes.includes('ATTACK_RESOLVED'),
            };
        }, { timeout: 10000 }).toEqual({
            attackerHp: 40,
            attackerCp: 3,
            defenderHp: 46,
            bloodPower: 4,
            mesmerize: 1,
            phase: 'main2',
            hasPendingAttack: false,
            lastResolvedAttackDamage: 4,
            damageDealt: true,
            attackResolved: true,
        });
        await expect(bloodPowerButton).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeEnabled();
        await expect(bloodPowerButton).toHaveAttribute('data-passive-action-usable', 'true');
        await expect(bloodPowerButton).toHaveClass(/ring-emerald-300\/80/);
        await expect(page.getByTestId('dicethrone-passive-opportunity-modal')).toHaveCount(0);
        await game.screenshot('吸血鬼领主-魅惑之力攻击后主要阶段二吸血按钮高亮', testInfo);

        await bloodPowerButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const events = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean);
            const healed = [...events].reverse().find((event: any) => event.type === 'HEAL_APPLIED');
            const consumed = [...events].reverse().find((event: any) => (
                event.type === 'TOKEN_CONSUMED'
                && event.payload?.tokenId === TOKEN_IDS.BLOOD_POWER
            ));
            const eventTypes = events.map((event: any) => event.type);
            return {
                phase: state?.sys?.phase ?? null,
                hasPendingAttack: Boolean(state?.core?.pendingAttack),
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                healedPayload: healed?.payload ?? null,
                consumedPayload: consumed?.payload ?? null,
                damageDealt: eventTypes.includes('DAMAGE_DEALT'),
                healApplied: eventTypes.includes('HEAL_APPLIED'),
                tokenConsumed: eventTypes.includes('TOKEN_CONSUMED'),
                attackResolved: eventTypes.includes('ATTACK_RESOLVED'),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            hasPendingAttack: false,
            attackerHp: 44,
            defenderHp: 46,
            bloodPower: 0,
            lastResolvedAttackDamage: 4,
            healedPayload: expect.objectContaining({
                targetId: '0',
                amount: 4,
                sourceAbilityId: 'vampire-lord-blood-power',
            }),
            consumedPayload: expect.objectContaining({
                tokenId: TOKEN_IDS.BLOOD_POWER,
                amount: 4,
                newTotal: 0,
            }),
            damageDealt: true,
            healApplied: true,
            tokenConsumed: true,
            attackResolved: true,
        });
        await expect(bloodPowerButton).toBeDisabled();
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveCount(0);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-魅惑之力不可防御攻击后鲜血之力治疗后收口', testInfo);
    });

    test('鲜血之力 4 档在主要阶段 2 通过常驻按钮按伤害记录治疗并收口', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 38 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 4 },
            },
            player1: {
                resources: { CP: 2, HP: 43 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
                pendingAttack: null,
                lastResolvedAttackDamage: 7,
            },
        });
        await closeDebugPanelIfVisible(page);

        const bloodPowerButton = page.getByTestId('passive-action-vampire-lord-blood-power-3');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeEnabled();
        await expect(bloodPowerButton).toHaveAttribute('data-passive-action-usable', 'true');
        await expect(bloodPowerButton).toHaveClass(/ring-emerald-300\/80/);
        await expect(page.getByTestId('dicethrone-passive-opportunity-modal')).toHaveCount(0);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                phase: state?.sys?.phase ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 4,
            hp: 38,
            phase: 'main2',
            lastResolvedAttackDamage: 7,
        });
        await game.screenshot('吸血鬼领主-鲜血之力常驻按钮-伤害记录可用', testInfo);

        await bloodPowerButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const entryEvents = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean)
                .reverse();
            const healed = entryEvents.find((event: any) => event.type === 'HEAL_APPLIED');
            const consumed = entryEvents.find((event: any) => (
                event.type === 'TOKEN_CONSUMED'
                && event.payload?.tokenId === TOKEN_IDS.BLOOD_POWER
            ));
            return {
                phase: state?.sys?.phase ?? null,
                hasPendingAttack: Boolean(state?.core?.pendingAttack),
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                hasTokenConsumed: getLastEventTypes(state).includes('TOKEN_CONSUMED'),
                healedPayload: healed?.payload ?? null,
                consumedPayload: consumed?.payload ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            hasPendingAttack: false,
            bloodPower: 0,
            hp: 45,
            lastResolvedAttackDamage: 7,
            hasTokenConsumed: true,
            healedPayload: expect.objectContaining({
                targetId: '0',
                amount: 7,
                sourceAbilityId: 'vampire-lord-blood-power',
            }),
            consumedPayload: expect.objectContaining({
                tokenId: TOKEN_IDS.BLOOD_POWER,
                amount: 4,
                newTotal: 0,
            }),
            events: expect.arrayContaining(['HEAL_APPLIED']),
        });
        await expect(bloodPowerButton).toBeDisabled();
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveCount(0);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力治疗后收口', testInfo);
    });

    test('鲜血之力 4 档未点击时保持主要阶段 2 可用且不强制弹窗', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 38 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 4 },
            },
            player1: {
                resources: { CP: 2, HP: 43 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'vampire_lord', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '0',
                pendingAttack: null,
                lastResolvedAttackDamage: 7,
            },
        });
        await closeDebugPanelIfVisible(page);

        const bloodPowerButton = page.getByTestId('passive-action-vampire-lord-blood-power-3');
        await expect(bloodPowerButton).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeEnabled();
        await expect(page.getByTestId('dicethrone-passive-opportunity-modal')).toHaveCount(0);
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasPendingAttack: Boolean(state?.core?.pendingAttack),
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            hasPendingAttack: false,
            bloodPower: 4,
            hp: 38,
            lastResolvedAttackDamage: 7,
        });
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力未点击仍可继续操作', testInfo);
    });

    test('血色杀戮应通过玩家板终极技打开抽牌堆搜牌交互并结算', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        expect(VAMPIRE_LORD_CARDS.length).toBeGreaterThan(30);
        expect(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE).toBe(VAMPIRE_LORD_CARDS.length - 1);
        expect(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS).toContain(VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID);
        expect(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS).not.toContain(VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);
        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID],
                deck: VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS,
                resources: { CP: 2, HP: 50 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 0 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: Array.from({ length: 5 }, (_, id) => ({
                    id,
                    value: 6,
                    symbol: VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
                    symbols: [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP],
                    isKept: false,
                    ownerId: '0',
                    definitionId: 'vampire_lord-dice',
                })),
                currentRollContext: undefined,
                pendingAttack: null,
            },
        });
        await closeDebugPanelIfVisible(page);

        const ultimateSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="ultimate"]').first();
        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expectVampireLordDiceSpritesForValues(page, [6, 6, 6, 6, 6]);
        await expect(ultimateSlot).toHaveAttribute('data-base-ability-id', 'bloody-slaughter', { timeout: 10000 });
        await expect(ultimateSlot).toHaveAttribute('data-resolved-ability-id', 'bloody-slaughter', { timeout: 10000 });
        await expect(ultimateSlot).toHaveAttribute('data-available-ability-id', 'bloody-slaughter', { timeout: 10000 });
        await expect(ultimateSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
        await expect(page.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(1);
        await expect(page.locator(`[data-testid="hand-area"] [data-card-id="${VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID}"]`))
            .toBeVisible({ timeout: 10000 });
        await game.screenshot('01-血色杀戮触发前-五个血滴终极技可点', testInfo);

        await clickResolvedAbilitySlot(page, 'ultimate', 'bloody-slaughter', 'bloody-slaughter');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                isUltimate: state?.core?.pendingAttack?.isUltimate ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: 'bloody-slaughter',
            defenderId: '1',
            isUltimate: true,
        });

        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await dismissAttackShowcaseIfVisible(page);
        await expect.poll(async () => {
            const state = await game.getState();
            const current = state?.sys?.interaction?.current;
            return {
                kind: current?.kind ?? null,
                playerId: current?.playerId ?? null,
                interactionType: current?.data?.type ?? null,
                sourceId: current?.data?.sourceId ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hand: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                deckSize: state?.core?.players?.['0']?.deck?.length ?? 0,
                deckHasTarget: (state?.core?.players?.['0']?.deck ?? [])
                    .some((card: any) => card.id === VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID),
                deckHasProtectedCard: (state?.core?.players?.['0']?.deck ?? [])
                    .some((card: any) => card.id === VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID),
            };
        }, { timeout: 10000 }).toEqual({
            kind: 'dt:card-interaction',
            playerId: '0',
            interactionType: 'selectDeckCard',
            sourceId: 'bloody-slaughter',
            bloodPower: 2,
            hand: [VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID],
            deckSize: VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE,
            deckHasTarget: true,
            deckHasProtectedCard: false,
        });

        const targetCardOption = page.getByTestId(`dt-deck-card-option-${VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID}`);
        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        const searchInput = page.getByTestId('dt-card-pool-search-input');
        const resultCount = page.getByTestId('dt-card-pool-result-count');
        const cardOptions = page.getByTestId('dt-card-pool-selection').locator('[data-card-pool-mode="preview"]');
        await expect(page.getByText('从牌库选择 1 张牌加入手牌')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('dt-deck-card-option-card-vampire-lord-blood-surge')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('dt-card-pool-selection')).toHaveAttribute('data-card-pool-kind', 'deck');
        await expect(cardOptions).toHaveCount(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE);
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await expect(resultCount).toHaveText(new RegExp(`显示\\s+${VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE}\\s*/\\s*${VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE}`));
        await expect(page.getByTestId('prompt-card-search-input')).toHaveCount(0);
        await expectVampireLordCardChoicePreview(page, 'card-vampire-lord-blood-surge', 17);
        await expectVampireLordCardPoolLayout(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE, { requireCenteredCards: false });
        await page.mouse.move(20, 20);
        await expectVampireLordCardPoolKeepsHandVisible(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);
        await expect(confirmButton).toBeDisabled();
        await game.screenshot('02-血色杀戮搜牌窗口-真实抽牌堆大牌库可搜索', testInfo);

        await searchInput.fill('不存在的血牌');
        await expect(cardOptions).toHaveCount(0);
        await expect(resultCount).toHaveText(new RegExp(`显示\\s+0\\s*/\\s*${VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE}`));
        await expect(page.getByTestId('dt-card-pool-empty')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('dt-card-pool-empty')).toContainText('没有匹配的牌');
        await expectVampireLordCardPoolKeepsHandVisible(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);
        await game.screenshot('03-血色杀戮搜牌窗口-空搜索无匹配候选', testInfo);

        await searchInput.fill('血流如注');
        await expect(cardOptions).toHaveCount(1);
        await expect(resultCount).toHaveText(new RegExp(`显示\\s+1\\s*/\\s*${VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE}`));
        await expect(page.getByTestId('dt-card-pool-empty')).toHaveCount(0);
        await expect(targetCardOption).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('dt-deck-card-option-card-vampire-lord-blood-surge')).toHaveCount(0);
        await expectVampireLordCardChoicePreview(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID, 21);
        await expectVampireLordCardPoolLayout(page, 1, { requireCenteredCards: true });
        await expectVampireLordCardPoolKeepsHandVisible(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);
        await game.screenshot('04-血色杀戮搜牌窗口-血流如注过滤命中', testInfo);

        await targetCardOption.click();
        await expect(targetCardOption).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(targetCardOption).toHaveAttribute('aria-pressed', 'true');
        await expect(targetCardOption).toHaveClass(/-translate-y-2/);
        await page.mouse.move(20, 20);
        await expectVampireLordCardPoolKeepsHandVisible(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await game.screenshot('05-血色杀戮已选择血流如注-待确认加入手牌', testInfo);
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hand: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                deckSize: state?.core?.players?.['0']?.deck?.length ?? 0,
                deckHasTarget: (state?.core?.players?.['0']?.deck ?? [])
                    .some((card: any) => card.id === VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID),
                deckHasProtectedCard: (state?.core?.players?.['0']?.deck ?? [])
                    .some((card: any) => card.id === VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID),
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 15000 }).toEqual({
            phase: 'main2',
            interactionKind: null,
            bloodPower: 2,
            hand: [
                VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID,
                VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID,
            ],
            deckSize: VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE - 1,
            deckHasTarget: false,
            deckHasProtectedCard: false,
            defenderHp: 40,
            pendingAttack: null,
            events: expect.arrayContaining(['CARD_DRAWN', 'DECK_SHUFFLED', 'DAMAGE_DEALT', 'ATTACK_RESOLVED']),
        });
        await expect(page.locator(`[data-testid="hand-area"] [data-card-id="${VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID}"]`))
            .toBeVisible({ timeout: 10000 });
        await expectVampireLordCardPreview(page, VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID, 21);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('06-血色杀戮结算后-血流如注入手并造成十点伤害', testInfo);
    });

    test('血色杀戮造成伤害后应通过真实入口允许花费4个鲜血之力吸血', async ({ page, game }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        expect(VAMPIRE_LORD_CARDS.length).toBeGreaterThan(30);
        expect(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_SIZE).toBe(VAMPIRE_LORD_CARDS.length - 1);
        expect(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS).toContain(VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID);
        expect(VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS).not.toContain(VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID);

        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID],
                deck: VAMPIRE_LORD_BLOODY_SLAUGHTER_DECK_CARD_IDS,
                resources: { CP: 2, HP: 40 },
                tokens: { [TOKEN_IDS.BLOOD_POWER]: 2 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: Array.from({ length: 5 }, (_, id) => ({
                    id,
                    value: 6,
                    symbol: VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
                    symbols: [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP],
                    isKept: false,
                    ownerId: '0',
                    definitionId: 'vampire_lord-dice',
                })),
                currentRollContext: undefined,
                pendingAttack: null,
            },
        });
        await closeDebugPanelIfVisible(page);

        const ultimateSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="ultimate"]').first();
        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expectVampireLordDiceSpritesForValues(page, [6, 6, 6, 6, 6]);
        await expect(ultimateSlot).toHaveAttribute('data-base-ability-id', 'bloody-slaughter', { timeout: 10000 });
        await expect(ultimateSlot).toHaveAttribute('data-resolved-ability-id', 'bloody-slaughter', { timeout: 10000 });
        await expect(ultimateSlot).toHaveAttribute('data-available-ability-id', 'bloody-slaughter', { timeout: 10000 });
        await expect(ultimateSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
        await expect(page.locator(`[data-testid="hand-area"] [data-card-id="${VAMPIRE_LORD_BLOODY_SLAUGHTER_PROTECTED_HAND_CARD_ID}"]`))
            .toBeVisible({ timeout: 10000 });
        await game.screenshot('01-血色杀戮终极触发前-五个血滴可见且大招可点', testInfo);

        await clickResolvedAbilitySlot(page, 'ultimate', 'bloody-slaughter', 'bloody-slaughter');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                isUltimate: state?.core?.pendingAttack?.isUltimate ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: 'bloody-slaughter',
            defenderId: '1',
            isUltimate: true,
        });

        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await dismissAttackShowcaseIfVisible(page);

        const searchInput = page.getByTestId('dt-card-pool-search-input');
        const targetCardOption = page.getByTestId(`dt-deck-card-option-${VAMPIRE_LORD_BLOODY_SLAUGHTER_TARGET_CARD_ID}`);
        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        await expect(page.getByText('从牌库选择 1 张牌加入手牌')).toBeVisible({ timeout: 10000 });
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await expect(targetCardOption).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('dt-card-pool-selection')).toHaveAttribute('data-card-pool-kind', 'deck');
        await expect(confirmButton).toBeDisabled();
        await game.screenshot('02-血色杀戮真实搜牌窗口-大招后可搜索抽牌堆', testInfo);

        await searchInput.fill('血流如注');
        await expect(targetCardOption).toBeVisible({ timeout: 10000 });
        await expect(targetCardOption).toHaveAttribute('data-selected', 'false');
        await targetCardOption.click();
        await expect(targetCardOption).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'main2',
            attackerHp: 40,
            defenderHp: 40,
            bloodPower: 4,
            lastResolvedAttackDamage: 10,
            pendingAttack: null,
        });

        const bloodPowerButton = page.getByTestId('passive-action-vampire-lord-blood-power-3');
        await expect(bloodPowerButton).toBeVisible({ timeout: 10000 });
        await expect(bloodPowerButton).toBeEnabled();
        await expect(bloodPowerButton).toHaveAttribute('data-passive-action-usable', 'true');
        await expect(bloodPowerButton).toHaveClass(/ring-emerald-300\/80/);
        await expect(page.locator('#modal-root').getByTestId('dicethrone-passive-opportunity-modal')).toHaveCount(0);
        await game.screenshot('03-血色杀戮结算后-主要阶段二吸血按钮高亮', testInfo);

        await bloodPowerButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const events = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean);
            return {
                phase: state?.sys?.phase ?? null,
                hasPendingAttack: Boolean(state?.core?.pendingAttack),
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                healed: events.some((event: any) => event.type === 'HEAL_APPLIED'),
                tokenConsumed: events.some((event: any) => (
                    event.type === 'TOKEN_CONSUMED'
                    && event.payload?.tokenId === TOKEN_IDS.BLOOD_POWER
                    && event.payload?.amount === 4
                )),
                attackResolved: events.some((event: any) => event.type === 'ATTACK_RESOLVED'),
            };
        }, { timeout: 15000 }).toEqual({
            phase: 'main2',
            hasPendingAttack: false,
            attackerHp: 50,
            defenderHp: 40,
            bloodPower: 0,
            lastResolvedAttackDamage: 10,
            healed: true,
            tokenConsumed: true,
            attackResolved: true,
        });
        await expect(bloodPowerButton).toBeDisabled();
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('04-血色杀戮吸血结算后-生命五十血力归零按钮收口', testInfo);
    });

    test('嗜血之爪 III 5 利爪三同应通过真实投骰获得鲜血之力并造成 8 点攻击伤害', async ({ page, game }, testInfo) => {
        const vampireLord = buildVampireLordBloodthirstyClaws3Player();
        const barbarian = buildBarbarianDefensePlayer();

        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': VISIBLE_GUEST_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 0,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: false,
                dice: buildVampireLordProofDice(),
                currentRollContext: undefined,
                pendingAttack: null,
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
                passiveActionUsedThisTurn: {
                    '0': {},
                },
                players: {
                    '0': vampireLord,
                    '1': barbarian,
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]').first();
        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expect(rollButton).toBeVisible({ timeout: 10000 });
        await expect(rollButton).toBeEnabled();
        await game.screenshot('吸血鬼领主-嗜血之爪III入口-投骰前', testInfo);

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice), undefined, { timeout: 5000 });
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 1, 1, 2, 3]);
        });
        await rollButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollCount: state?.core?.rollCount ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                dice: (state?.core?.dice ?? []).slice(0, 5).map((die: any) => die?.value ?? null),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            rollCount: 1,
            rollConfirmed: false,
            dice: [1, 1, 1, 2, 3],
        });
        await expectVampireLordDiceSpritesForValues(page, [1, 1, 1, 2, 3]);
        await game.screenshot('吸血鬼领主-嗜血之爪III已投5利爪且三同', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                abilityLevel: state?.core?.players?.['0']?.abilityLevels?.['bloodthirsty-claws'] ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            rollConfirmed: true,
            abilityLevel: 3,
        });

        const bloodthirstyClawsSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="fist"]').first();
        await expect(bloodthirstyClawsSlot).toHaveAttribute('data-base-ability-id', 'bloodthirsty-claws', { timeout: 10000 });
        await expect(bloodthirstyClawsSlot).toHaveAttribute('data-resolved-ability-id', 'bloodthirsty-claws-3-5', { timeout: 10000 });
        await expect(bloodthirstyClawsSlot).toHaveAttribute('data-available-ability-id', 'bloodthirsty-claws-3-5', { timeout: 10000 });
        await expect(bloodthirstyClawsSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
        await game.screenshot('吸血鬼领主-嗜血之爪III槽位可触发', testInfo);

        await clickResolvedAbilitySlot(page, 'fist', 'bloodthirsty-claws', 'bloodthirsty-claws-3-5');

        await expect.poll(async () => {
            const state = await game.getState();
            const pendingAttack = state?.core?.pendingAttack;
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                defenderId: pendingAttack?.defenderId ?? null,
                isDefendable: pendingAttack?.isDefendable ?? null,
                expectedDamage: pendingAttack ? getPendingAttackExpectedDamage(state.core, pendingAttack, 0) : null,
                attackDiceValues: pendingAttack?.attackDiceValues ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            sourceAbilityId: 'bloodthirsty-claws-3-5',
            defenderId: '1',
            isDefendable: true,
            expectedDamage: 8,
            attackDiceValues: [1, 1, 1, 2, 3],
        });
        await game.screenshot('吸血鬼领主-嗜血之爪III槽位触发后', testInfo);

        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await dismissAttackShowcaseIfVisible(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                rollDiceCount: state?.core?.rollDiceCount ?? null,
                rollLimit: state?.core?.rollLimit ?? null,
                rollCount: state?.core?.rollCount ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'defensiveRoll',
            sourceAbilityId: 'bloodthirsty-claws-3-5',
            defenseAbilityId: 'thick-skin',
            rollDiceCount: 3,
            rollLimit: 1,
            rollCount: 0,
            rollConfirmed: false,
        });
        await game.screenshot('吸血鬼领主-嗜血之爪III进入防御', testInfo);

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3]);
        });
        await dispatchDiceThroneCommand(page, { type: 'ROLL_DICE', playerId: '1' });
        await dispatchDiceThroneCommand(page, { type: 'CONFIRM_ROLL', playerId: '1' });
        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '1' });

        await expect.poll(async () => {
            const state = await game.getState();
            const entryEvents = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean)
                .reverse();
            const attackDamage = entryEvents.find((event: any) => (
                event.type === 'DAMAGE_DEALT'
                && event.payload?.targetId === '1'
                && event.payload?.sourceAbilityId === 'bloodthirsty-claws-3-5'
            ));
            const bloodPowerGranted = entryEvents.find((event: any) => (
                event.type === 'TOKEN_GRANTED'
                && event.payload?.targetId === '0'
                && event.payload?.tokenId === TOKEN_IDS.BLOOD_POWER
                && event.payload?.sourceAbilityId === 'bloodthirsty-claws-3-5'
            ));
            return {
                phase: state?.sys?.phase ?? null,
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                attackPayload: attackDamage?.payload ?? null,
                bloodPowerPayload: bloodPowerGranted?.payload ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            attackerHp: 50,
            defenderHp: 42,
            bloodPower: 1,
            pendingAttack: null,
            attackPayload: expect.objectContaining({
                targetId: '1',
                amount: 8,
                actualDamage: 8,
                sourceAbilityId: 'bloodthirsty-claws-3-5',
                damageScope: 'attack',
            }),
            bloodPowerPayload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.BLOOD_POWER,
                amount: 1,
                newTotal: 1,
                sourceAbilityId: 'bloodthirsty-claws-3-5',
            }),
            events: expect.arrayContaining(['DAMAGE_DEALT', 'TOKEN_GRANTED', 'ATTACK_RESOLVED']),
        });
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-嗜血之爪III结算后血力增加', testInfo);
    });

    test('不死防御应通过真实防御按钮投 4 骰并结算反击与自疗', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone', VAMPIRE_LORD_DEFENSE_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                hand: [],
                deck: [],
                resources: { CP: 2, HP: 42 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'barbarian', '1': 'vampire_lord' },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, definitionId: 'barbarian-dice', value: 1, isKept: false, ownerId: '0' },
                    { id: 1, definitionId: 'barbarian-dice', value: 2, isKept: false, ownerId: '0' },
                    { id: 2, definitionId: 'barbarian-dice', value: 3, isKept: false, ownerId: '0' },
                    { id: 3, definitionId: 'barbarian-dice', value: 4, isKept: false, ownerId: '0' },
                    { id: 4, definitionId: 'barbarian-dice', value: 5, isKept: false, ownerId: '0' },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'slap-3',
                    settlementStage: 'preDamage',
                    isDefendable: true,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await dismissAttackShowcaseIfVisible(page);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]').first();
        const endDefenseButton = page.getByRole('button', { name: /结束防御|End Defense/i }).first();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                rollDiceCount: state?.core?.rollDiceCount ?? null,
                rollLimit: state?.core?.rollLimit ?? null,
                rollCount: state?.core?.rollCount ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'defensiveRoll',
            defenderId: '1',
            defenseAbilityId: 'undying',
            rollDiceCount: 4,
            rollLimit: 1,
            rollCount: 0,
            rollConfirmed: false,
            attackerHp: 50,
            defenderHp: 42,
        });
        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expect(rollButton).toBeVisible({ timeout: 10000 });
        await expect(rollButton).toBeEnabled();
        await game.screenshot('吸血鬼领主-不死防御入口-投骰前', testInfo);

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice), undefined, { timeout: 5000 });
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3, 6]);
        });
        await rollButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                rollCount: state?.core?.rollCount ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                dice: (state?.core?.dice ?? []).slice(0, 4).map((die: any) => die?.value ?? null),
            };
        }, { timeout: 10000 }).toEqual({
            rollCount: 1,
            rollConfirmed: false,
            dice: [1, 2, 3, 6],
        });
        await expectVampireLordDiceSpritesForValues(page, [1, 2, 3, 6]);
        await game.screenshot('吸血鬼领主-不死防御已投4骰', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                responseWindow: state?.sys?.responseWindow?.current ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'defensiveRoll',
            rollConfirmed: true,
            responseWindow: null,
        });
        await game.screenshot('吸血鬼领主-不死防御骰面确认后', testInfo);

        await expect(endDefenseButton).toBeEnabled({ timeout: 5000 });
        await endDefenseButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const entryEvents = (state?.sys?.eventStream?.entries ?? [])
                .map((entry: any) => entry?.event)
                .filter(Boolean)
                .reverse();
            const counterDamage = entryEvents.find((event: any) => (
                event.type === 'DAMAGE_DEALT'
                && event.payload?.targetId === '0'
                && event.payload?.sourceAbilityId === 'undying'
            ));
            const attackDamage = entryEvents.find((event: any) => (
                event.type === 'DAMAGE_DEALT'
                && event.payload?.targetId === '1'
                && event.payload?.sourceAbilityId === 'slap-3'
            ));
            const healed = entryEvents.find((event: any) => (
                event.type === 'HEAL_APPLIED'
                && event.payload?.targetId === '1'
                && event.payload?.sourceAbilityId === 'undying'
            ));
            return {
                phase: state?.sys?.phase ?? null,
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                counterPayload: counterDamage?.payload ?? null,
                attackPayload: attackDamage?.payload ?? null,
                healedPayload: healed?.payload ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            attackerHp: 49,
            defenderHp: 39,
            pendingAttack: null,
            counterPayload: expect.objectContaining({
                targetId: '0',
                amount: 1,
                actualDamage: 1,
                sourceAbilityId: 'undying',
                damageScope: 'direct',
            }),
            attackPayload: expect.objectContaining({
                targetId: '1',
                amount: 4,
                actualDamage: 4,
                sourceAbilityId: 'slap-3',
            }),
            healedPayload: expect.objectContaining({
                targetId: '1',
                amount: 1,
                sourceAbilityId: 'undying',
            }),
            events: expect.arrayContaining(['DAMAGE_DEALT', 'HEAL_APPLIED', 'ATTACK_RESOLVED']),
        });
        await game.screenshot('吸血鬼领主-不死防御结算后收口', testInfo);
        await waitForDiceThroneVisualIdle(page);
    });

    test('真实在线玩家选角入口应显示实施中的吸血鬼领主并可进入牌桌', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupInProgressMatchWithVampireLord(browser, baseURL);

        try {
            await expect(match.hostPage.locator(`[data-character-id="${VAMPIRE_LORD_HERO_ID}"]`)).toHaveCount(1);
            await expect(match.hostPage.getByTestId(`character-badge-${VAMPIRE_LORD_HERO_ID}-implementation_in_progress`)).toHaveCount(1);
            await expect(match.guestPage.locator(`[data-character-id="${VISIBLE_GUEST_HERO_ID}"]`)).toContainText(/P2/i);
            await expect(match.hostPage.locator(`[data-character-id="${VAMPIRE_LORD_HERO_ID}"]`)).toContainText(/P1/i);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-选角-吸血鬼领主实施中可见且可选');

            await readyAndStartGame(match.hostPage, match.guestPage);
            await waitForGameBoard(match.hostPage);
            await waitForGameBoard(match.guestPage);
            await waitForDiceThroneHarness(match.hostPage);
            await waitForDiceThroneHarness(match.guestPage);
            await closeDebugPanelIfOpen(match.hostPage);
            await closeDebugPanelIfOpen(match.guestPage);
            await match.hostPage.setViewportSize({ width: 1280, height: 720 });
            await match.guestPage.setViewportSize({ width: 1280, height: 720 });

            const hostBoard = match.hostPage.getByTestId('player-board-surface');
            await expect(hostBoard).toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 15000 });
            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', VISIBLE_GUEST_HERO_ID, { timeout: 15000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-牌桌-可见角色正常进入牌桌');

            await injectVampireLordMainProofState(match.matchId, match.hostPage);

            await expect(hostBoard).toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 15000 });
            await waitForImage(match.hostPage, 'player-board-image');
            await expect(match.hostPage.getByTestId('player-board-image'))
                .toHaveAttribute('data-debug-current-src', /dicethrone\/images\/xixuegui\/compressed\/player-board\.webp/i);
            await waitForImage(match.hostPage, 'tip-board-image');
            await expect(match.hostPage.getByTestId('tip-board-image'))
                .toHaveAttribute('data-debug-current-src', /dicethrone\/images\/xixuegui\/compressed\/tip\.webp/i);

            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]'))
                .toHaveCount(VAMPIRE_LORD_PROOF_HAND.length, { timeout: 15000 });
            for (const card of VAMPIRE_LORD_PROOF_HAND) {
                await expectVampireLordCardPreview(match.hostPage, card.id, card.atlasIndex);
            }
            await openMagnifiedHandCardPreview(
                match.hostPage,
                'card-unexpected',
                VAMPIRE_LORD_CARD_ATLAS_ID,
                33,
                /dicethrone\/images\/xixuegui\/(?:compressed\/)?ability-cards\.webp/i,
            );
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-牌桌-吸血鬼意不意外通用牌slot33放大卡图可见');
            await closeMagnifiedCardPreview(match.hostPage);

            const statusTokens = match.hostPage.locator('[data-tutorial-id="status-tokens"]');
            await expect(statusTokens).toBeVisible({ timeout: 15000 });
            await expectStatusAtlasSprite(match.hostPage, 'token', TOKEN_IDS.BLOOD_POWER);
            await expectStatusAtlasSprite(match.hostPage, 'token', TOKEN_IDS.MESMERIZE);
            await expectStatusAtlasSprite(match.hostPage, 'status', STATUS_IDS.BLEED);
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-1')).toBeVisible({ timeout: 15000 });
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-1')).toBeEnabled();
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-2')).toBeVisible({ timeout: 15000 });
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-2')).toBeEnabled();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-牌桌-吸血鬼领主资源链与状态图标');

            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', VISIBLE_GUEST_HERO_ID, { timeout: 15000 });
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 15000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '05-牌桌-可见对手角色视角已进入');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
