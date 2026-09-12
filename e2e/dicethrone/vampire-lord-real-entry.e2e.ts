import type { Browser, Locator, Page, TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    dispatchDiceThroneCommand,
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

const getLastEventTypes = (state: any): string[] => (
    (state?.sys?.eventStream?.entries ?? [])
        .slice(-10)
        .map((entry: any) => entry?.event?.type)
        .filter(Boolean)
);

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

const buildVampireLordProofDice = () => VAMPIRE_LORD_DICE_VALUES.map((value, index) => {
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

async function expectActionLogContains(
    page: Page,
    parts: string[],
): Promise<void> {
    await openFabPanel(page, 'action-log');
    const rows = page.locator('[data-testid="hud-action-log-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const texts = (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
    const matched = texts.find((text) => parts.every((part) => text.includes(part)));
    expect(
        matched,
        `ActionLog 面板未找到预期记录: ${parts.join(' / ')}; 实际=${JSON.stringify(texts)}`,
    ).toBeTruthy();
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
    await expect(page.getByTestId('dt-card-pool-overlay')).toHaveAttribute('data-card-pool-hand-protection', 'preserve-visible-hand');
    await expect(page.getByTestId('dt-card-pool-overlay')).toHaveAttribute('data-card-pool-browse-mode', 'grid-scroll');
    await expect(page.getByTestId('dt-card-pool-panel')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-surface')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-title')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-actions')).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-selection')).toHaveClass(/scrollbar-thin/);

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

    await expect.poll(async () => page.evaluate((protectedCardId) => {
        const panel = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-panel"]');
        const card = document.querySelector<HTMLElement>(`[data-testid="hand-area"] [data-card-id="${protectedCardId}"]`);
        const visual = card?.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? card;
        if (!panel || !visual) {
            return false;
        }

        const panelRect = panel.getBoundingClientRect();
        const handRect = visual.getBoundingClientRect();
        const overlaps = !(
            panelRect.right <= handRect.left
            || panelRect.left >= handRect.right
            || panelRect.bottom <= handRect.top
            || panelRect.top >= handRect.bottom
        );

        return handRect.width > 40
            && handRect.height > 60
            && handRect.bottom > 0
            && handRect.bottom <= window.innerHeight + 1
            && handRect.top < window.innerHeight
            && handRect.left < window.innerWidth
            && handRect.right > 0
            && handRect.top - panelRect.bottom >= 4
            && !overlaps;
    }, cardId), { timeout: 15000 }).toBe(true);

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

            await injectGetAwayScene('1');
            await expectTianshiCardPreview(match.guestPage, 'card-get-away', 11);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '02-天使视角-起开手牌卡图可见');

            await dragHandCardToPlay(match.guestPage, 'card-get-away');
            await expectCardSpotlightPreview(
                match.hostPage,
                'card-get-away',
                '1',
                TIANSHI_CARD_ATLAS_ID,
                11,
                /dicethrone\/images\/tianshi\/(?:compressed\/)?ability-cards\.webp/i,
            );
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-吸血鬼视角-对手起开打出特写卡图可见');
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
            await saveEvidenceScreenshot(match.guestPage, testInfo, '04-天使视角-起开可选择催眠且眩光仍可见');

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
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-吸血鬼视角-起开后催眠移除眩光仍在');
            await expectActionLogContains(match.hostPage, ['起开', '催眠']);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06-吸血鬼视角-行动日志写清起开移除催眠');
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

        await test.step('血潮汹涌应先出现奖励骰，确认后利爪才获得 3 个鲜血之力', async () => {
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
            await setDiceThroneBonusDiceValues(page, [1]);
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
                diceValues: [1],
                diceFaces: [VAMPIRE_LORD_DICE_FACE_IDS.CLAW],
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
            await game.screenshot('吸血鬼领主-血潮汹涌-利爪结算后获得3血力', testInfo);
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
                optionValues: [2, 3, 4],
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
            await expect(modalRoot.locator('button[data-option-id="option-0"]')).toContainText('花费 2 个鲜血之力');
            await expect(modalRoot.locator('button[data-option-id="option-2"]')).toContainText('花费 4 个鲜血之力');
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
                bloodPower: 0,
                cp: 8,
                discardIds: [cardId],
                events: expect.arrayContaining(['CHOICE_RESOLVED', 'TOKEN_CONSUMED', 'CP_CHANGED']),
            });
            await waitForDiceThroneVisualIdle(page);
            await game.screenshot('吸血鬼领主-饮血如酒-花费4血力获得8CP', testInfo);
        });
    });

    test('鲜血之力 4 档应通过玩家板按钮按已造成伤害治疗', async ({ page, game }, testInfo) => {
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
                    settlementStage: 'postDamagePending',
                    isDefendable: true,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: true,
                    resolvedDamage: 7,
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        const healButton = page.getByTestId('passive-action-vampire-lord-blood-power-3');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(healButton).toBeVisible({ timeout: 10000 });
        await expect(healButton).toBeEnabled();
        await expect(healButton).not.toContainText('消耗4');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                resolvedDamage: state?.core?.pendingAttack?.resolvedDamage ?? null,
                damageResolved: state?.core?.pendingAttack?.damageResolved ?? null,
            };
        }, { timeout: 10000 }).toEqual({
                bloodPower: 4,
            hp: 38,
            resolvedDamage: 7,
            damageResolved: true,
        });
        await game.screenshot('吸血鬼领主-鲜血之力治疗入口-使用前', testInfo);

        await healButton.click();

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
                bloodPower: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BLOOD_POWER] ?? null,
                hp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                hasTokenConsumed: getLastEventTypes(state).includes('TOKEN_CONSUMED'),
                healedPayload: healed?.payload ?? null,
                consumedPayload: consumed?.payload ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            hp: 45,
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
        await expect(healButton).toBeVisible({ timeout: 10000 });
        await expect(healButton).toBeDisabled();
        await expect(page.getByTestId(`dt-player-0-token-${TOKEN_IDS.BLOOD_POWER}`)).toHaveCount(0);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力治疗后收口', testInfo);
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
        await expect(page.getByText('从抽牌堆选择 1 张牌加入手牌')).toBeVisible({ timeout: 10000 });
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

            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 15000 });
            for (const card of VAMPIRE_LORD_PROOF_HAND) {
                await expectVampireLordCardPreview(match.hostPage, card.id, card.atlasIndex);
            }

            const statusTokens = match.hostPage.locator('[data-tutorial-id="status-tokens"]');
            await expect(statusTokens).toBeVisible({ timeout: 15000 });
            await expectStatusAtlasSprite(match.hostPage, 'token', TOKEN_IDS.BLOOD_POWER);
            await expectStatusAtlasSprite(match.hostPage, 'token', TOKEN_IDS.MESMERIZE);
            await expectStatusAtlasSprite(match.hostPage, 'status', STATUS_IDS.BLEED);
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-1')).toBeVisible({ timeout: 15000 });
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-1')).toBeEnabled();
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-2')).toBeVisible({ timeout: 15000 });
            await expect(match.hostPage.getByTestId('passive-action-vampire-lord-blood-power-2')).toBeEnabled();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-牌桌-吸血鬼领主资源链与状态图标');

            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', VISIBLE_GUEST_HERO_ID, { timeout: 15000 });
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 15000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '04-牌桌-可见对手角色视角已进入');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
