import type { Browser, Page, TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
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
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import { VAMPIRE_LORD_CARDS } from '../../src/games/dicethrone/heroes/vampire_lord/cards';

const VAMPIRE_LORD_QUERY = { playerID: '0', disableLocalAiAutomation: true };
const INTERNAL_VAMPIRE_LORD_HERO_ID = 'vampire_lord';
const VISIBLE_HOST_HERO_ID = 'monk';
const VISIBLE_GUEST_HERO_ID = 'barbarian';
const VAMPIRE_LORD_CARD_ATLAS_ID = 'dicethrone:vampire_lord-cards';
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
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
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

const setupVisibleMatchWithHiddenVampire = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await expect(match.hostPage.locator(`[data-character-id="${INTERNAL_VAMPIRE_LORD_HERO_ID}"]`)).toHaveCount(0);
    await expect(match.guestPage.locator(`[data-character-id="${INTERNAL_VAMPIRE_LORD_HERO_ID}"]`)).toHaveCount(0);
    await selectCharacter(match.hostPage, VISIBLE_HOST_HERO_ID);
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
    const vampireBase = initHeroState('0', INTERNAL_VAMPIRE_LORD_HERO_ID, FIXED_E2E_RANDOM);
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
            '0': INTERNAL_VAMPIRE_LORD_HERO_ID,
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
                characterId: INTERNAL_VAMPIRE_LORD_HERO_ID,
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

const injectVampireLordDiceProofState = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecordMap(core.players);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(players);
    const dice = buildVampireLordProofDice();

    nextRoot.core = {
        ...core,
        phase: 'offensiveRoll',
        activePlayerId: '0',
        rollCount: 1,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: false,
        dice,
        currentRollContext: {
            id: 'e2e-vampire-lord-online-offensive-roll',
            kind: 'offensive',
            ownerPlayerId: '0',
            targetPlayerId: '1',
            sourceAbilityId: 'e2e-vampire-lord-dice-proof',
            phase: 'offensiveRoll',
            dice,
            status: 'open',
            policy: {
                modifiableBy: 'owner',
                rerollableBy: 'owner',
                allowPassiveReroll: true,
                allowDiceCardTargeting: true,
                ultimateLocked: false,
                blocksPhaseFlow: true,
            },
            settlement: { mode: 'ability' },
            display: { surface: 'diceTray', replayOnly: false },
        },
    };
    nextRoot.sys = {
        ...sys,
        phase: 'offensiveRoll',
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

const expectVampireLordCardPreview = async (
    page: Page,
    cardId: string,
    expectedAtlasIndex: number,
): Promise<void> => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const atlasFrame = card.locator(`[data-card-atlas-id="${VAMPIRE_LORD_CARD_ATLAS_ID}"]`).first();
    await expect(atlasFrame).toBeVisible({ timeout: 15000 });
    await expect(atlasFrame).toHaveAttribute('data-card-atlas-index', String(expectedAtlasIndex));
    const atlasImage = atlasFrame.locator('img[data-card-atlas-img="true"]').first();
    await expect(atlasImage).toBeVisible({ timeout: 15000 });
    await expect.poll(
        async () => atlasImage.getAttribute('src'),
        { timeout: 15000 },
    ).toMatch(/dicethrone\/images\/xixuegui\/(?:compressed\/)?ability-cards\.webp/i);
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
                usedThisTurn: state?.core?.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-attack-bonus'] ?? false,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            bonusDamage: 3,
            attackModifierBonusDamage: 3,
            usedThisTurn: true,
            events: expect.arrayContaining(['TOKEN_CONSUMED', 'BONUS_DAMAGE_ADDED']),
        });
        await expect(bloodPowerButton).toBeHidden({ timeout: 10000 });
        await game.screenshot('吸血鬼领主-鲜血之力加伤后', testInfo);
    });

    test('催眠应通过玩家按钮投临时骰并选择对手骰重掷', async ({ page, game }, testInfo) => {
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
                rollConfirmed: true,
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

        const mesmerizeButton = page.getByTestId('passive-action-vampire-lord-mesmerize-0');
        const diceTray = getRightTrayDiceTray(page);
        const firstOpponentDie = diceTray.getByTestId('die-button-0').first();
        await expect(mesmerizeButton).toBeVisible({ timeout: 10000 });
        await expect(mesmerizeButton).toBeEnabled();
        await expect(firstOpponentDie).toBeVisible({ timeout: 10000 });
        await expect(firstOpponentDie).toHaveAttribute('data-owner-id', '1');
        await expect(firstOpponentDie).toHaveAttribute('data-display-value', '6');
        await expect(firstOpponentDie).toHaveAttribute('data-clickable', 'false');
        await game.screenshot('吸血鬼领主-催眠入口-对手骰重掷前', testInfo);

        await setDiceThroneBonusDiceValues(page, [6]);
        await mesmerizeButton.click();

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
            sourceAbilityId: 'vampire-lord-mesmerize',
            bonusValue: 6,
            bonusFace: 'blood_drop',
        });
        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
            sourceAbilityId: 'vampire-lord-mesmerize',
        });
        await game.screenshot('吸血鬼领主-催眠临时骰-确认前', testInfo);

        await settleCurrentBonusDice(page, () => game.getState(), {
            sourceAbilityId: 'vampire-lord-mesmerize',
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
        await game.screenshot('吸血鬼领主-催眠选择对手骰', testInfo);

        await firstOpponentDie.click();
        await expect(firstOpponentDie).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
        await setDiceThroneBonusDiceValues(page, [2]);
        await game.screenshot('吸血鬼领主-催眠对手骰已选待确认', testInfo);

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
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-催眠重掷后收口', testInfo);
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
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(removeStatusButton).toBeVisible({ timeout: 10000 });
        await expect(removeStatusButton).toBeEnabled();
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
                usedThisTurn: state?.core?.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-remove-status'] ?? false,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                removedPayload: removed?.payload ?? null,
                consumedPayload: consumed?.payload ?? null,
                events,
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            bleed: 0,
            usedThisTurn: true,
            interactionKind: null,
            removedPayload: expect.objectContaining({ targetId: '0', statusId: STATUS_IDS.BLEED, stacks: 1 }),
            consumedPayload: expect.objectContaining({ playerId: '0', tokenId: TOKEN_IDS.BLOOD_POWER, amount: 2, newTotal: 0 }),
            events: expect.arrayContaining(['TOKEN_CONSUMED', 'STATUS_REMOVED']),
        });
        await expect(page.getByTestId('dt-status-effect-0-bleed')).toHaveCount(0);
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
                passiveActionUsedThisTurn: {
                    '0': {},
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        const drawButton = page.getByTestId('passive-action-vampire-lord-blood-power-2');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(drawButton).toBeVisible({ timeout: 10000 });
        await expect(drawButton).toBeEnabled();
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
                usedThisTurn: state?.core?.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-draw'] ?? false,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            hand: [
                'card-vampire-lord-blood-surge',
                'card-vampire-lord-gushing-blood',
            ],
            deck: [],
            usedThisTurn: true,
            events: expect.arrayContaining(['TOKEN_CONSUMED', 'CARD_DRAWN']),
        });
        await expect(drawButton).toBeHidden({ timeout: 10000 });
        await expect(page.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(2, { timeout: 10000 });
        await expectVampireLordCardPreview(page, 'card-vampire-lord-blood-surge', 17);
        await expectVampireLordCardPreview(page, 'card-vampire-lord-gushing-blood', 21);
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力抽牌后收口', testInfo);
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
                passiveActionUsedThisTurn: {
                    '0': {},
                },
            },
        });
        await closeDebugPanelIfVisible(page);

        const healButton = page.getByTestId('passive-action-vampire-lord-blood-power-3');
        await expect(page.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
        await expect(healButton).toBeVisible({ timeout: 10000 });
        await expect(healButton).toBeEnabled();
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
                usedThisTurn: state?.core?.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-heal'] ?? false,
                healedPayload: healed?.payload ?? null,
                consumedPayload: consumed?.payload ?? null,
                events: getLastEventTypes(state),
            };
        }, { timeout: 10000 }).toEqual({
            bloodPower: 0,
            hp: 45,
            usedThisTurn: true,
            healedPayload: expect.objectContaining({
                targetId: '0',
                amount: 7,
                sourceAbilityId: 'vampire-lord-blood-power',
            }),
            consumedPayload: expect.objectContaining({
                playerId: '0',
                tokenId: TOKEN_IDS.BLOOD_POWER,
                amount: 4,
                newTotal: 0,
            }),
            events: expect.arrayContaining(['TOKEN_CONSUMED', 'HEAL_APPLIED']),
        });
        await expect(healButton).toBeHidden({ timeout: 10000 });
        await waitForDiceThroneVisualIdle(page);
        await game.screenshot('吸血鬼领主-鲜血之力治疗后收口', testInfo);
    });

    test('真实在线玩家选角入口应隐藏吸血鬼领主，内部注入仍能验证资源链', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupVisibleMatchWithHiddenVampire(browser, baseURL);

        try {
            await expect(match.hostPage.locator(`[data-character-id="${INTERNAL_VAMPIRE_LORD_HERO_ID}"]`)).toHaveCount(0);
            await expect(match.hostPage.locator(`[data-character-id="${VISIBLE_HOST_HERO_ID}"]`)).toContainText(/P1/i);
            await expect(match.guestPage.locator(`[data-character-id="${VISIBLE_GUEST_HERO_ID}"]`)).toContainText(/P2/i);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-选角-玩家入口隐藏吸血鬼领主');

            await readyAndStartGame(match.hostPage, match.guestPage);
            await waitForGameBoard(match.hostPage);
            await waitForGameBoard(match.guestPage);
            await waitForDiceThroneHarness(match.hostPage);
            await waitForDiceThroneHarness(match.guestPage);
            await closeDebugPanelIfOpen(match.hostPage);
            await closeDebugPanelIfOpen(match.guestPage);
            await match.hostPage.setViewportSize({ width: 1280, height: 720 });
            await match.guestPage.setViewportSize({ width: 1280, height: 720 });

            await injectVampireLordMainProofState(match.matchId, match.hostPage);

            const hostBoard = match.hostPage.getByTestId('player-board-surface');
            await expect(hostBoard).toHaveAttribute('data-character-id', INTERNAL_VAMPIRE_LORD_HERO_ID, { timeout: 15000 });
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
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-牌桌-内部注入吸血鬼领主资源链');

            await injectVampireLordDiceProofState(match.matchId, match.hostPage);
            await expectVampireLordDiceSprites(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-牌桌-吸血鬼领主骰面与关键入口');

            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', VISIBLE_GUEST_HERO_ID, { timeout: 15000 });
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 15000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '04-牌桌-可见对手角色视角已进入');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
