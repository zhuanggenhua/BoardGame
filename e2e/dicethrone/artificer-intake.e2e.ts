/**
 * DiceThrone 工匠真实入口证据。
 *
 * 范围：真实在线双玩家选角/开局，以及工坊按钮驱动的纳米机器人引爆链。
 */

import type { Browser, Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, maybePassResponse, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForDiceThroneHarness, waitForGameBoard } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import '../../src/games/dicethrone/domain';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const HOST_HERO_ID = 'artificer';
const GUEST_HERO_ID = 'monk';
const CHARACTER_SELECTION_TIMEOUT = 240000;

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const setupArtificerMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
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
    await closeDebugPanelIfOpen(match.hostPage);
    await closeDebugPanelIfOpen(match.guestPage);
    await match.hostPage.setViewportSize({ width: 1280, height: 720 });
    await match.guestPage.setViewportSize({ width: 1280, height: 720 });
    await match.hostPage.waitForTimeout(800);
    await match.guestPage.waitForTimeout(800);
    return match;
};

const injectArtificerNanobotUpkeep = async (matchId: string, page: Page) => {
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

    nextRoot.core = {
        ...core,
        phase: 'upkeep',
        activePlayerId: '0',
        turnOrder,
        players: {
            ...players,
            '0': {
                ...host,
                resources: {
                    ...asRecord(host.resources),
                    [RESOURCE_IDS.HP]: 50,
                },
                tokens: {
                    ...asRecord(host.tokens),
                    [TOKEN_IDS.SYNTH]: 2,
                    [TOKEN_IDS.NANOBOT]: 1,
                    [TOKEN_IDS.SHOCK_BOT]: 0,
                    [TOKEN_IDS.HEAL_BOT]: 0,
                },
                statusEffects: {
                    ...asRecord(host.statusEffects),
                    [STATUS_IDS.NANOBOMB]: 0,
                },
                tokenStackLimits: {
                    ...asRecord(host.tokenStackLimits),
                    [TOKEN_IDS.NANOBOT]: 1,
                },
                artificerBotState: {
                    ...asRecord(host.artificerBotState),
                    [TOKEN_IDS.NANOBOT]: {
                        built: true,
                        upgraded: false,
                        activationsUsedThisTurn: 0,
                    },
                    [TOKEN_IDS.SHOCK_BOT]: {
                        ...asRecord(asRecord(host.artificerBotState)[TOKEN_IDS.SHOCK_BOT]),
                        built: false,
                        upgraded: false,
                        activationsUsedThisTurn: 0,
                    },
                    [TOKEN_IDS.HEAL_BOT]: {
                        ...asRecord(asRecord(host.artificerBotState)[TOKEN_IDS.HEAL_BOT]),
                        built: false,
                        upgraded: false,
                        activationsUsedThisTurn: 0,
                    },
                },
            },
            '1': {
                ...guest,
                resources: {
                    ...asRecord(guest.resources),
                    [RESOURCE_IDS.HP]: 50,
                },
                statusEffects: {
                    ...asRecord(guest.statusEffects),
                    [STATUS_IDS.NANOBOMB]: 2,
                },
            },
        },
    };
    nextRoot.sys = {
        ...sys,
        phase: 'upkeep',
        turnOrder,
        currentPlayerIndex: 0,
    };

    await injectMatchState(matchId, next as never, page);
};

const injectArtificerShockBotPreDamageChoice = async (
    matchId: string,
    page: Page,
    options: { includeChoice?: boolean } = {},
) => {
    const includeChoice = options.includeChoice ?? true;
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

    nextRoot.core = {
        ...core,
        phase: 'offensiveRoll',
        activePlayerId: '0',
        currentChoiceSourceAbilityId: includeChoice ? 'shock-bot' : undefined,
        turnOrder,
        players: {
            ...players,
            '0': {
                ...host,
                resources: {
                    ...asRecord(host.resources),
                    [RESOURCE_IDS.HP]: 50,
                },
                tokens: {
                    ...asRecord(host.tokens),
                    [TOKEN_IDS.SYNTH]: 2,
                    [TOKEN_IDS.SHOCK_BOT]: 1,
                    [TOKEN_IDS.NANOBOT]: 0,
                    [TOKEN_IDS.HEAL_BOT]: 0,
                },
                tokenStackLimits: {
                    ...asRecord(host.tokenStackLimits),
                    [TOKEN_IDS.SHOCK_BOT]: 1,
                },
                artificerBotState: {
                    ...asRecord(host.artificerBotState),
                    [TOKEN_IDS.SHOCK_BOT]: {
                        built: true,
                        upgraded: false,
                        activationsUsedThisTurn: 0,
                    },
                    [TOKEN_IDS.NANOBOT]: {
                        ...asRecord(asRecord(host.artificerBotState)[TOKEN_IDS.NANOBOT]),
                        built: false,
                        upgraded: false,
                        activationsUsedThisTurn: 0,
                    },
                    [TOKEN_IDS.HEAL_BOT]: {
                        ...asRecord(asRecord(host.artificerBotState)[TOKEN_IDS.HEAL_BOT]),
                        built: false,
                        upgraded: false,
                        activationsUsedThisTurn: 0,
                    },
                },
            },
            '1': {
                ...guest,
                resources: {
                    ...asRecord(guest.resources),
                    [RESOURCE_IDS.HP]: 50,
                },
            },
        },
        pendingAttack: {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
            bonusDamage: 0,
            preDefenseResolved: true,
            settlementStage: 'preDamage',
        },
    };
    nextRoot.sys = {
        ...sys,
        phase: 'offensiveRoll',
        turnOrder,
        currentPlayerIndex: 0,
        interaction: includeChoice
            ? {
                ...asRecord(sys.interaction),
                current: {
                    id: 'artificer-online-shock-bot-pre-damage-choice',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        sourceId: 'shock-bot',
                        title: 'choices.artificerBotActivation.titleSingle',
                        titleKey: 'choices.artificerBotActivation.titleSingle',
                        options: [
                            {
                                id: 'activate-shock-bot',
                                label: 'choices.artificerBotActivation.activateShockBotFree',
                                labelKey: 'choices.artificerBotActivation.activateShockBotFree',
                                value: {
                                    customId: 'artificer-activate-bot-resolve',
                                    sourceAbilityId: 'shock-bot',
                                    value: 202,
                                },
                            },
                            {
                                id: 'skip-bot-activation',
                                label: 'choices.artificerBotActivation.skip',
                                labelKey: 'choices.artificerBotActivation.skip',
                                value: {
                                    customId: 'artificer-activate-bot-resolve',
                                    sourceAbilityId: 'shock-bot',
                                    value: 0,
                                },
                            },
                        ],
                    },
                },
            }
            : {
                ...asRecord(sys.interaction),
                current: null,
            },
    };

    await injectMatchState(matchId, next as never, page);
};

test.describe('DiceThrone 工匠真实入口', () => {
    test('工匠真实开局应自动穿过维护阶段进入主要阶段', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupArtificerMatch(browser, baseURL);

        try {
            await expect.poll(async () => {
                const state = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(state.G ?? state);
                const sys = asRecord(root.sys);
                return sys.phase ?? null;
            }, {
                timeout: 5000,
                message: '工匠真实开局后应自动从 upkeep 进入主要阶段',
            }).toBe('main1');

            await expect(match.hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.locator('[data-tutorial-id="advance-phase-button"]')).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '00-工匠开局-自动进入主要阶段');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实在线双玩家应能选择工匠并看到玩家板、技能槽与手牌', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupArtificerMatch(browser, baseURL);

        try {
            const hostBoard = match.hostPage.getByTestId('player-board-surface');
            await expect(hostBoard.locator('[data-ability-slot="fist"]').first()).toHaveAttribute('data-base-ability-id', 'wrench-strike');
            await expect(hostBoard.locator('[data-ability-slot="lightning"]').first()).toHaveAttribute('data-base-ability-id', 'overclock');
            await expect(hostBoard.locator('[data-ability-slot="ultimate"]').first()).toHaveAttribute('data-base-ability-id', 'maximum-power');
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 10000 });
            const statusTokens = match.hostPage.locator('[data-tutorial-id="status-tokens"]');
            await expect(statusTokens).toBeVisible({ timeout: 10000 });
            const synthBadge = statusTokens.locator('.group').first();
            await expect(synthBadge).toBeVisible({ timeout: 10000 });
            await synthBadge.hover();
            await expect(match.hostPage.getByText('合成器 4/7', { exact: true })).toBeVisible({ timeout: 10000 });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-工匠在线开局-玩家板与手牌');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口应通过工坊按钮激活纳米机器人并引爆纳米爆弹', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupArtificerMatch(browser, baseURL);

        try {
            await injectArtificerNanobotUpkeep(match.matchId, match.hostPage);

            const activateNanobotButton = match.hostPage.getByTestId('passive-action-artificer-workshop-0');
            await expect(activateNanobotButton).toBeVisible({ timeout: 10000 });
            await expect(activateNanobotButton).toContainText(/纳米机器人|Nanobot/i);

            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-工坊-纳米机器人引爆前');

            await activateNanobotButton.click();
            await match.hostPage.waitForTimeout(1200);

            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                return {
                    hostSynth: Number(asRecord(host.tokens)[TOKEN_IDS.SYNTH] ?? -1),
                    hostNanobot: Number(asRecord(host.tokens)[TOKEN_IDS.NANOBOT] ?? -1),
                    guestNanobomb: Number(asRecord(guest.statusEffects)[STATUS_IDS.NANOBOMB] ?? -1),
                    guestHp: Number(asRecord(guest.resources)[RESOURCE_IDS.HP] ?? -1),
                };
            }, { timeout: 15000 }).toEqual({
                hostSynth: 0,
                hostNanobot: 1,
                guestNanobomb: 0,
                guestHp: 47,
            });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-工坊-纳米机器人引爆后');

            const advanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeVisible({ timeout: 10000 });
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-引爆后-推进按钮可手动收口');

            await advanceButton.click();
            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const sys = asRecord(root.sys);
                return sys.phase ?? null;
            }, {
                timeout: 15000,
                message: '纳米机器人引爆后点击推进按钮应离开维护阶段并进入主要阶段',
            }).toBe('main1');

            await expect(match.hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-手动推进后进入主要阶段');
        } finally {
            await cleanupDTMatch(match);
        }
    });

    test('真实入口技能赠送的电能机器人应在伤害前免费激活并把加伤并入当前攻击', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupArtificerMatch(browser, baseURL);

        try {
            await injectArtificerShockBotPreDamageChoice(match.matchId, match.hostPage, { includeChoice: false });

            const baseDamageBadge = match.hostPage.getByTestId('current-total-damage-badge');
            await expect(baseDamageBadge).toBeVisible({ timeout: 10000 });
            await expect(baseDamageBadge).toHaveAttribute('data-current-damage', '9');
            await expect(baseDamageBadge).toHaveAttribute('data-original-damage', '9');
            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: asRecord(root.sys).phase ?? null,
                    sourceAbilityId: pendingAttack.sourceAbilityId ?? null,
                    bonusDamage: Number(pendingAttack.bonusDamage ?? -1),
                    currentInteraction: asRecord(asRecord(root.sys).interaction).current ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'offensiveRoll',
                sourceAbilityId: 'shock-bot',
                bonusDamage: 0,
                currentInteraction: null,
            });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-选择机器人前基础九点伤害');

            await injectArtificerShockBotPreDamageChoice(match.matchId, match.hostPage);

            const choiceModal = match.hostPage.locator('#modal-root');
            await expect(choiceModal.getByRole('heading', { name: '技能结算选择' })).toBeVisible({ timeout: 10000 });
            await expect(choiceModal.getByText('选择要激活的机器人', { exact: true })).toBeVisible({ timeout: 10000 });

            const activateShockBotButton = choiceModal.getByRole('button', { name: /免费激活电能机器人|Activate Shock Bot for free/i });
            await expect(activateShockBotButton).toBeVisible({ timeout: 10000 });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-选择免费激活电能机器人');

            await activateShockBotButton.click();
            await match.hostPage.waitForTimeout(1200);

            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const host = asRecord(players['0']);
                const guest = asRecord(players['1']);
                const hostBotState = asRecord(asRecord(host.artificerBotState)[TOKEN_IDS.SHOCK_BOT]);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    hostSynth: Number(asRecord(host.tokens)[TOKEN_IDS.SYNTH] ?? -1),
                    hostShockBot: Number(asRecord(host.tokens)[TOKEN_IDS.SHOCK_BOT] ?? -1),
                    shockBotBuilt: Boolean(hostBotState.built ?? false),
                    shockBotUsed: Number(hostBotState.activationsUsedThisTurn ?? -1),
                    guestHp: Number(asRecord(guest.resources)[RESOURCE_IDS.HP] ?? -1),
                    bonusDamage: Number(pendingAttack.bonusDamage ?? -1),
                    interactionKind: asRecord(root.sys).interaction && asRecord(asRecord(root.sys).interaction).current
                        ? String(asRecord(asRecord(asRecord(root.sys).interaction).current).kind ?? '')
                        : null,
                };
            }, { timeout: 15000 }).toEqual({
                hostSynth: 2,
                hostShockBot: 1,
                shockBotBuilt: true,
                shockBotUsed: 1,
                guestHp: 50,
                bonusDamage: 3,
                interactionKind: null,
            });

            const boostedDamageBadge = match.hostPage.getByTestId('current-total-damage-badge');
            await expect(boostedDamageBadge).toBeVisible({ timeout: 10000 });
            await expect(boostedDamageBadge).toHaveAttribute('data-current-damage', '12');
            await expect(boostedDamageBadge).toHaveAttribute('data-original-damage', '9');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06-电能机器人激活后总伤害十二');

            const advanceButton = match.hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeVisible({ timeout: 10000 });
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await advanceButton.click();

            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    phase: sys.phase ?? null,
                    sourceAbilityId: pendingAttack.sourceAbilityId ?? null,
                    defenseAbilityId: pendingAttack.defenseAbilityId ?? null,
                    bonusDamage: Number(pendingAttack.bonusDamage ?? -1),
                    guestHp: Number(asRecord(asRecord(asRecordMap(core.players)['1']).resources)[RESOURCE_IDS.HP] ?? -1),
                };
            }, { timeout: 15000 }).toEqual({
                phase: 'defensiveRoll',
                sourceAbilityId: 'shock-bot',
                defenseAbilityId: 'meditation',
                bonusDamage: 3,
                guestHp: 50,
            });

            const startDefenseButton = match.guestPage.getByRole('button', { name: /开始防御|Start Defense/i }).first();
            if (await startDefenseButton.isVisible({ timeout: 1500 }).catch(() => false)) {
                await startDefenseButton.click();
                await expect(startDefenseButton).toBeHidden({ timeout: 5000 }).catch(() => {});
            }

            const defenseRollButton = match.guestPage.locator('[data-tutorial-id="dice-roll-button"]').first();
            await expect(defenseRollButton).toBeVisible({ timeout: 10000 });
            await expect(defenseRollButton).toBeEnabled({ timeout: 10000 });
            await defenseRollButton.click();

            const defenseConfirmButton = match.guestPage.locator('[data-tutorial-id="dice-confirm-button"]').first();
            await expect(defenseConfirmButton).toBeVisible({ timeout: 10000 });
            await expect(defenseConfirmButton).toBeEnabled({ timeout: 10000 });
            await defenseConfirmButton.click();

            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                return {
                    phase: asRecord(root.sys).phase ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    rollCount: core.rollCount ?? null,
                    diceCount: Array.isArray(core.dice) ? core.dice.slice(0, 4).length : 0,
                };
            }, { timeout: 15000 }).toEqual({
                phase: 'defensiveRoll',
                rollConfirmed: true,
                rollCount: 1,
                diceCount: 4,
            });

            await saveEvidenceScreenshot(match.guestPage, testInfo, '07-防御方正式防御掷骰后');

            const skippedDefenseResponse = await maybePassResponse(match.guestPage, 3000);
            if (skippedDefenseResponse) {
                await expect.poll(async () => {
                    const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                    const root = asRecord(latest.G ?? latest);
                    return asRecord(asRecord(root.sys).interaction).current ?? null;
                }, { timeout: 10000 }).toBeNull();
            }

            const endDefenseButton = match.guestPage.locator('[data-tutorial-id="advance-phase-button"]').first();
            await expect(endDefenseButton).toBeVisible({ timeout: 10000 });
            await expect(endDefenseButton).toBeEnabled({ timeout: 10000 });
            await endDefenseButton.click();

            let pendingDamageId: string | null = null;
            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const pendingDamage = asRecord(core.pendingDamage);
                pendingDamageId = typeof pendingDamage.id === 'string' ? pendingDamage.id : null;
                return {
                    currentDamage: Number(pendingDamage.currentDamage ?? -1),
                    responderId: pendingDamage.responderId ?? null,
                    interactionKind: asRecord(asRecord(sys.interaction).current).kind ?? null,
                };
            }, { timeout: 15000 }).toEqual({
                currentDamage: 12,
                responderId: '1',
                interactionKind: 'dt:token-response',
            });

            expect(pendingDamageId).toBeTruthy();
            await expect(match.guestPage.getByTestId('dicethrone-response-window-hint')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByTestId('dicethrone-response-window-hint')).toHaveAttribute('data-response-kind', 'token');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '08-电能机器人进入十二点伤害响应');

            const passed = await maybePassResponse(match.guestPage, 10000);
            expect(passed).toBe(true);

            await expect.poll(async () => {
                const latest = await getMatchState(match.matchId, match.hostPage) as JsonRecord;
                const root = asRecord(latest.G ?? latest);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const guest = asRecord(players['1']);
                return {
                    phase: sys.phase ?? null,
                    guestHp: Number(asRecord(guest.resources)[RESOURCE_IDS.HP] ?? -1),
                    pendingAttack: core.pendingAttack ?? null,
                    pendingDamage: core.pendingDamage ?? null,
                    interactionKind: asRecord(asRecord(sys.interaction).current).kind ?? null,
                };
            }, { timeout: 15000 }).toEqual({
                phase: 'main2',
                guestHp: 38,
                pendingAttack: null,
                pendingDamage: null,
                interactionKind: null,
            });

            await expect(match.hostPage.getByTestId('dt-top-header-1-hp-value')).toHaveText('38', { timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '09-防御方正式跳过响应后生命值三十八');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
