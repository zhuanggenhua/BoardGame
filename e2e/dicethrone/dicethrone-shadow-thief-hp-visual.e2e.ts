import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import {
    advanceToOffensiveRoll,
    applyCoreStateDirect,
    applyDiceValues,
    closeDebugPanelIfOpen,
    dispatchDiceThroneCommand,
    maybePassResponse,
    readCoreState,
    readMatchState,
    setDiceThroneDiceValues,
    setupOnlineMatch,
    selectCharacter,
    readyAndStartGame,
    waitForDiceThroneHarness,
    waitForDiceThronePhase,
    waitForGameBoard,
} from '../helpers/dicethrone';
import {
    expectRightTrayBonusDiceConfirmation,
    settleCurrentBonusDice,
    waitForDiceThroneVisualIdle,
} from './bonus-dice-flow';

const OPEN_TIMEOUT_MS = 180000;

type HarnessState = {
    core?: {
        activePlayerId?: string | null;
        pendingAttack?: unknown;
        pendingBonusDiceSettlement?: unknown;
        pendingDamage?: unknown;
        players?: Record<string, {
            resources?: Record<string, number | null>;
            tokens?: Record<string, number | null>;
        }>;
    };
    sys?: {
        phase?: string | null;
        eventStream?: {
            entries?: Array<{
                event?: {
                    type?: string;
                    payload?: Record<string, unknown>;
                };
            }>;
        };
        interaction?: {
            current?: unknown;
        };
        responseWindow?: {
            current?: unknown;
        };
    };
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, fullPage: false, timeout: 20000 }));
    return path;
};

type ShadowThiefVsSamuraiSceneOptions = {
    attackerCp?: number;
    attackerHp?: number;
    attackerShame?: number;
    attackerSneakAttack?: number;
    defenderHp?: number;
    defenderBackStrike?: number;
};

const prepareShadowThiefVsSamuraiScene = async (
    page: Page,
    {
        attackerCp = 6,
        attackerHp = 50,
        attackerShame = 2,
        attackerSneakAttack = 0,
        defenderHp = 49,
        defenderBackStrike = 1,
    }: ShadowThiefVsSamuraiSceneOptions = {},
) => {
    await page.evaluate(async ({
        hpId,
        cpId,
        shameId,
        sneakAttackId,
        backStrikeId,
        attackerCp,
        attackerHp,
        attackerShame,
        attackerSneakAttack,
        defenderHp,
        defenderBackStrike,
    }) => {
        const harness = (window as Window).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness?.state?.set || !state) {
            throw new Error('DiceThrone TestHarness state not ready');
        }

        const [{ initHeroState, createCharacterDice, ALL_TOKEN_DEFINITIONS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
        ]);
        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };
        const shadowThief = initHeroState('0', 'shadow_thief', random as never);
        const samurai = initHeroState('1', 'samurai', random as never);

        harness.state.set({
            ...state,
            core: {
                ...(state.core ?? {}),
                activePlayerId: '0',
                activatingAbilityId: undefined,
                currentChoiceContext: undefined,
                currentChoiceSourceAbilityId: undefined,
                currentRollContext: undefined,
                dice: createCharacterDice('shadow_thief'),
                pendingAttack: undefined,
                pendingBonusDiceSettlement: undefined,
                pendingDamage: undefined,
                rollConfirmed: false,
                rollCount: 0,
                rollLimit: 3,
                rollDiceCount: 5,
                selectedCharacters: { '0': 'shadow_thief', '1': 'samurai' },
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
                players: {
                    '0': {
                        ...shadowThief,
                        hand: [],
                        discard: [],
                        damageShields: [],
                        resources: {
                            ...shadowThief.resources,
                            [hpId]: attackerHp,
                            [cpId]: attackerCp,
                        },
                        tokens: {
                            ...shadowThief.tokens,
                            [shameId]: attackerShame,
                            [sneakAttackId]: attackerSneakAttack,
                        },
                    },
                    '1': {
                        ...samurai,
                        hand: [],
                        discard: [],
                        damageShields: [],
                        resources: {
                            ...samurai.resources,
                            [hpId]: defenderHp,
                            [cpId]: 0,
                        },
                        tokens: {
                            ...samurai.tokens,
                            [backStrikeId]: defenderBackStrike,
                        },
                    },
                },
            },
            sys: {
                ...(state.sys ?? {}),
                currentPlayerIndex: 0,
                flowHalted: false,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                phase: 'offensiveRoll',
                responseWindow: {
                    current: undefined,
                },
                turnOrder: ['0', '1'],
            },
        });
    }, {
        hpId: RESOURCE_IDS.HP,
        cpId: RESOURCE_IDS.CP,
        shameId: TOKEN_IDS.SHAME,
        sneakAttackId: TOKEN_IDS.SNEAK_ATTACK,
        backStrikeId: TOKEN_IDS.SAMURAI_RETRIBUTION,
        attackerCp,
        attackerHp,
        attackerShame,
        attackerSneakAttack,
        defenderHp,
        defenderBackStrike,
    });
};

const readHarnessMatchState = async (page: Page) => page.evaluate(() => (
    (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as Record<string, any>
));

const setHarnessRandomQueue = async (page: Page, values: number[]): Promise<void> => {
    await page.evaluate((queue) => {
        const harness = (window as Window).__BG_TEST_HARNESS__;
        if (!harness?.random?.setQueue) {
            throw new Error('DiceThrone TestHarness random queue 不可用');
        }
        harness.random.setQueue(queue);
    }, values);
};

const randomValueForDieFace = (value: number): number => {
    const normalized = Math.max(1, Math.min(6, Math.floor(value)));
    return ((normalized - 1) / 6) + 0.001;
};

const readHpVisualSummary = async (page: Page) => page.evaluate(() => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as HarnessState | null | undefined;
    const entries = state?.sys?.eventStream?.entries ?? [];
    const damageEvents = entries
        .map((entry) => entry.event)
        .filter((event) => event?.type === 'DAMAGE_DEALT')
        .map((event) => ({
            targetId: event?.payload?.targetId ?? null,
            amount: event?.payload?.amount ?? null,
            actualDamage: event?.payload?.actualDamage ?? null,
            sourceAbilityId: event?.payload?.sourceAbilityId ?? null,
        }));
    const visibleDamageTexts = Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'))
        .map((element) => {
            const node = element as HTMLElement;
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                text: node.textContent?.trim() ?? '',
                visible: rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0',
            };
        })
        .filter((entry) => entry.visible)
        .map((entry) => entry.text);
    return {
        phase: state?.sys?.phase ?? null,
        coreSelfHp: state?.core?.players?.['0']?.resources?.hp ?? null,
        coreOpponentHp: state?.core?.players?.['1']?.resources?.hp ?? null,
        coreSelfCp: state?.core?.players?.['0']?.resources?.cp ?? null,
        coreOpponentBackStrike: state?.core?.players?.['1']?.tokens?.samurai_retribution ?? null,
        uiOpponentHp: document.querySelector('[data-testid="dt-top-header-1-hp-value"]')?.textContent?.trim() ?? null,
        opponentHeaderPlayerId: document.querySelector('[data-testid="dt-top-header-1"]')?.getAttribute('data-player-id') ?? null,
        pendingAttack: Boolean(state?.core?.pendingAttack),
        pendingBonusDiceSettlement: Boolean(state?.core?.pendingBonusDiceSettlement),
        pendingDamage: Boolean(state?.core?.pendingDamage),
        interaction: Boolean(state?.sys?.interaction?.current),
        responseWindow: Boolean(state?.sys?.responseWindow?.current),
        visibleDamageTexts,
        damageEvents,
    };
});

const readVisibleDamageTexts = async (page: Page) => page.evaluate(() => (
    Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'))
        .map((element) => {
            const node = element as HTMLElement;
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                text: node.textContent?.trim() ?? '',
                visible: rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0',
            };
        })
        .filter((entry) => entry.visible)
        .map((entry) => entry.text)
));

const readShadowShankSneakSummary = async (page: Page) => page.evaluate(({ hpId, cpId, sneakAttackId, shameId }) => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as HarnessState | null | undefined;
    const core = state?.core;
    const pendingDamage = core?.pendingDamage as Record<string, any> | undefined;
    const pendingBonusDiceSettlement = core?.pendingBonusDiceSettlement as Record<string, any> | undefined;
    const entries = state?.sys?.eventStream?.entries ?? [];
    const events = entries.map((entry) => entry.event).filter(Boolean);

    return {
        phase: state?.sys?.phase ?? null,
        attackerHp: core?.players?.['0']?.resources?.[hpId] ?? null,
        attackerCp: core?.players?.['0']?.resources?.[cpId] ?? null,
        defenderHp: core?.players?.['1']?.resources?.[hpId] ?? null,
        attackerSneakAttack: core?.players?.['0']?.tokens?.[sneakAttackId] ?? null,
        attackerShame: core?.players?.['0']?.tokens?.[shameId] ?? null,
        uiDefenderHp: document.querySelector('[data-testid="dt-top-header-1-hp-value"]')?.textContent?.trim() ?? null,
        pendingDamageId: typeof pendingDamage?.id === 'string' ? pendingDamage.id : null,
        pendingDamageCurrentDamage: typeof pendingDamage?.currentDamage === 'number' ? pendingDamage.currentDamage : null,
        pendingDamageResponderId: pendingDamage?.responderId ?? null,
        pendingDamageResponseType: pendingDamage?.responseType ?? null,
        pendingBonusDiceSource: pendingBonusDiceSettlement?.sourceAbilityId ?? null,
        pendingAttack: Boolean(core?.pendingAttack),
        pendingBonusDiceSettlement: Boolean(core?.pendingBonusDiceSettlement),
        pendingDamage: Boolean(core?.pendingDamage),
        interaction: Boolean(state?.sys?.interaction?.current),
        responseWindow: Boolean(state?.sys?.responseWindow?.current),
        damageEvents: events
            .filter((event) => event?.type === 'DAMAGE_DEALT')
            .map((event) => ({
                targetId: event?.payload?.targetId ?? null,
                amount: event?.payload?.amount ?? null,
                actualDamage: event?.payload?.actualDamage ?? null,
                sourceAbilityId: event?.payload?.sourceAbilityId ?? null,
                modifiers: Array.isArray(event?.payload?.modifiers)
                    ? event.payload.modifiers.map((modifier: Record<string, unknown>) => ({
                        sourceId: modifier.sourceId ?? null,
                        value: modifier.value ?? null,
                    }))
                    : [],
            })),
        bonusDieEvents: events
            .filter((event) => event?.type === 'BONUS_DIE_ROLLED')
            .map((event) => ({
                value: event?.payload?.value ?? null,
                pendingDamageBonus: event?.payload?.pendingDamageBonus ?? null,
                effectKey: event?.payload?.effectKey ?? null,
            })),
        tokenConsumedEvents: events
            .filter((event) => event?.type === 'TOKEN_CONSUMED')
            .map((event) => ({
                playerId: event?.payload?.playerId ?? null,
                tokenId: event?.payload?.tokenId ?? null,
                amount: event?.payload?.amount ?? null,
                newTotal: event?.payload?.newTotal ?? null,
            })),
    };
}, {
    hpId: RESOURCE_IDS.HP,
    cpId: RESOURCE_IDS.CP,
    sneakAttackId: TOKEN_IDS.SNEAK_ATTACK,
    shameId: TOKEN_IDS.SHAME,
});

const readDamageVisualDiagnostics = async (page: Page) => page.evaluate(() => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as HarnessState | null | undefined;
    const entries = state?.sys?.eventStream?.entries ?? [];
    return {
        phase: state?.sys?.phase ?? null,
        coreSelfHp: state?.core?.players?.['0']?.resources?.hp ?? null,
        coreOpponentHp: state?.core?.players?.['1']?.resources?.hp ?? null,
        uiOpponentHp: document.querySelector('[data-testid="dt-top-header-1-hp-value"]')?.textContent?.trim() ?? null,
        fxLayers: Array.from(document.querySelectorAll<HTMLElement>('[data-fx-active-count]')).map((node) => ({
            activeCount: node.getAttribute('data-fx-active-count'),
            activeCues: node.getAttribute('data-fx-active-cues'),
        })),
        flyingEffects: Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="flying-effect-"]')).map((node) => ({
            testId: node.getAttribute('data-testid'),
            text: node.textContent?.trim() ?? '',
            rect: (() => {
                const rect = node.getBoundingClientRect();
                return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
            })(),
        })),
        floatingTexts: Array.from(document.querySelectorAll<HTMLElement>('[data-floating-text-preset]')).map((node) => {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                preset: node.getAttribute('data-floating-text-preset'),
                text: node.textContent?.trim() ?? '',
                rect: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
            };
        }),
        damageEvents: entries
            .map((entry) => entry.event)
            .filter((event) => event?.type === 'DAMAGE_DEALT')
            .map((event) => ({
                targetId: event?.payload?.targetId ?? null,
                amount: event?.payload?.amount ?? null,
                actualDamage: event?.payload?.actualDamage ?? null,
                sourceAbilityId: event?.payload?.sourceAbilityId ?? null,
            })),
    };
});

const expectVisibleDamageText = async (page: Page, expectedText: string, timeout = 10000) => {
    try {
        await expect.poll(async () => readVisibleDamageTexts(page), {
            message: `必须看到真实掉血飘字 ${expectedText}`,
            timeout,
            polling: 100,
        }).toContain(expectedText);
    } catch (error) {
        const diagnostics = await readDamageVisualDiagnostics(page).catch((diagnosticError) => ({
            diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
        }));
        throw new Error(`${error instanceof Error ? error.message : String(error)}\n伤害动画诊断=${JSON.stringify(diagnostics, null, 2)}`);
    }
};

const dispatch = async (page: Page, type: string, playerId: string, payload: Record<string, unknown> = {}) => {
    await dispatchDiceThroneCommand(page, { type, playerId, payload });
};

const dismissAttackShowcaseIfVisible = async (page: Page) => {
    const showcase = page.getByTestId('attack-showcase-overlay');
    if (!(await showcase.isVisible({ timeout: 1500 }).catch(() => false))) return;

    const continueButton = showcase.getByRole('button', { name: /^(开始防御|继续|Start Defense|Continue)$/i }).first();
    await expect(continueButton).toBeVisible({ timeout: 5000 });
    await continueButton.click();
    await expect(showcase).toBeHidden({ timeout: 5000 }).catch(() => undefined);
};

const clickDefendEntryIfVisible = async (page: Page) => {
    const defendEntryButton = page.getByRole('button', { name: /^(DEFEND|Defend|防御|开始防御)$/i }).first();
    if (await defendEntryButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await defendEntryButton.click();
    }
};

const clickAbilitySlot = async (page: Page, abilityId: string) => {
    const readMatchingSlotId = async () => page.evaluate((expectedAbilityId) => {
        const slots = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="player-board-surface"] [data-ability-slot]',
        ));
        const matchesAbility = (value: string | null) => (
            typeof value === 'string'
            && (value === expectedAbilityId || value.startsWith(`${expectedAbilityId}-`))
        );
        const slot = slots.find((candidate) => (
            (
                candidate.getAttribute('data-can-click') === 'true'
                || candidate.getAttribute('data-should-highlight') === 'true'
            )
            && (
                matchesAbility(candidate.getAttribute('data-available-ability-id'))
                || matchesAbility(candidate.getAttribute('data-resolved-ability-id'))
                || matchesAbility(candidate.getAttribute('data-base-ability-id'))
            )
        ));
        return slot?.getAttribute('data-ability-slot') ?? null;
    }, abilityId);

    try {
        await expect.poll(readMatchingSlotId, {
            message: `技能 ${abilityId} 必须映射到真实可点或高亮技能槽`,
            timeout: 15000,
        }).not.toBeNull();
    } catch (error) {
        const slots = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="player-board-surface"] [data-ability-slot]',
        )).map((node) => ({
            slot: node.getAttribute('data-ability-slot'),
            available: node.getAttribute('data-available-ability-id'),
            resolved: node.getAttribute('data-resolved-ability-id'),
            base: node.getAttribute('data-base-ability-id'),
            canClick: node.getAttribute('data-can-click'),
            shouldHighlight: node.getAttribute('data-should-highlight'),
            selected: node.getAttribute('data-is-selected'),
        })));
        throw new Error(`技能 ${abilityId} 没有映射到真实可点击面板槽位；当前技能槽=${JSON.stringify(slots)}；原始错误=${error instanceof Error ? error.message : String(error)}`);
    }

    const slotId = await readMatchingSlotId();
    if (!slotId) throw new Error(`技能 ${abilityId} 没有映射到真实可点击面板槽位`);

    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
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
    } else {
        await slot.click({ force: true });
    }
    await page.waitForTimeout(700);
};

const readTopHeaderHpForPlayer = async (page: Page, playerId: string) => page.evaluate((targetPlayerId) => {
    const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="dt-top-header-"]'));
    const header = headers.find((node) => node.getAttribute('data-player-id') === targetPlayerId) ?? null;
    const hpValue = header?.querySelector<HTMLElement>('[data-testid$="-hp-value"]')?.textContent?.trim() ?? null;
    return {
        playerId: header?.getAttribute('data-player-id') ?? null,
        hpValue,
    };
}, playerId);

const readSelfStatsHp = async (page: Page) => page.evaluate(() => {
    const healthNode = document.querySelector<HTMLElement>(
        '[data-testid="dt-player-stats-panel"] [data-dicethrone-resource="health"]',
    );
    const text = healthNode?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    const match = text?.match(/(\d+)\s*$/);
    return {
        text,
        hpValue: match?.[1] ?? null,
    };
});

const readLocalHarnessHpSummary = async (page: Page) => page.evaluate(({ hpId, cpId, backStrikeId }) => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as HarnessState | null | undefined;
    return {
        phase: state?.sys?.phase ?? null,
        player0Hp: state?.core?.players?.['0']?.resources?.[hpId] ?? null,
        player0Cp: state?.core?.players?.['0']?.resources?.[cpId] ?? null,
        player1Hp: state?.core?.players?.['1']?.resources?.[hpId] ?? null,
        player1BackStrike: state?.core?.players?.['1']?.tokens?.[backStrikeId] ?? null,
        pendingAttack: Boolean(state?.core?.pendingAttack),
        pendingDamage: Boolean(state?.core?.pendingDamage),
        pendingBonusDiceSettlement: Boolean(state?.core?.pendingBonusDiceSettlement),
        interaction: Boolean(state?.sys?.interaction?.current),
        responseWindow: Boolean(state?.sys?.responseWindow?.current),
    };
}, {
    hpId: RESOURCE_IDS.HP,
    cpId: RESOURCE_IDS.CP,
    backStrikeId: TOKEN_IDS.SAMURAI_RETRIBUTION,
});

const patchOnlineShadowThiefScene = async (page: Page) => {
    const core = await readCoreState(page) as Record<string, any>;
    const nextCore = structuredClone(core);
    const shadow = nextCore.players?.['0'];
    const samurai = nextCore.players?.['1'];
    if (!shadow || !samurai) {
        throw new Error('线上暗影刺客/武士场景玩家状态不存在');
    }

    nextCore.activePlayerId = '0';
    nextCore.activatingAbilityId = undefined;
    nextCore.currentChoiceContext = undefined;
    nextCore.currentChoiceSourceAbilityId = undefined;
    nextCore.currentRollContext = undefined;
    nextCore.pendingAttack = undefined;
    nextCore.pendingBonusDiceSettlement = undefined;
    nextCore.pendingDamage = undefined;
    nextCore.rollConfirmed = false;
    nextCore.rollCount = 0;
    nextCore.rollLimit = 3;
    nextCore.rollDiceCount = 5;
    nextCore.selectedCharacters = { ...(nextCore.selectedCharacters ?? {}), '0': 'shadow_thief', '1': 'samurai' };

    shadow.hand = [];
    shadow.discard = [];
    shadow.damageShields = [];
    shadow.resources = {
        ...(shadow.resources ?? {}),
        [RESOURCE_IDS.HP]: 50,
        [RESOURCE_IDS.CP]: 6,
    };
    shadow.tokens = {
        ...(shadow.tokens ?? {}),
        [TOKEN_IDS.SHAME]: 2,
    };

    samurai.hand = [];
    samurai.discard = [];
    samurai.damageShields = [];
    samurai.resources = {
        ...(samurai.resources ?? {}),
        [RESOURCE_IDS.HP]: 49,
        [RESOURCE_IDS.CP]: 0,
    };
    samurai.tokens = {
        ...(samurai.tokens ?? {}),
        [TOKEN_IDS.SAMURAI_RETRIBUTION]: 1,
    };

    await applyCoreStateDirect(page, nextCore);
};

test.describe('DiceThrone Shadow Thief HP visual update', () => {
    test('暗影刺客小顺子打武士后，对手顶部血量稳定刷新到正式扣血值', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await game.openTestGame('dicethrone', {}, OPEN_TIMEOUT_MS);
        await waitForDiceThroneHarness(page, 40000);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: { resources: { CP: 6, HP: 50 } },
            player1: { resources: { CP: 0, HP: 49 } },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                hostStarted: true,
                selectedCharacters: { '0': 'shadow_thief', '1': 'samurai' },
                rollConfirmed: false,
                rollCount: 0,
                rollLimit: 3,
            },
        });
        await prepareShadowThiefVsSamuraiScene(page);
        await expect(page.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1', { timeout: 10000 });
        await expect(page.getByTestId('dt-top-header-1-hp-value')).toHaveText('49', { timeout: 10000 });
        const beforePath = await saveEvidenceScreenshot(page, testInfo, '暗影刺客小顺子前-武士血量49');

        await setDiceThroneDiceValues(page, [2, 1, 3, 4, 6]);
        await dispatch(page, 'ROLL_DICE', '0');
        await dispatch(page, 'CONFIRM_ROLL', '0');
        await dispatch(page, 'SELECT_ABILITY', '0', { abilityId: 'pickpocket' });
        await dispatch(page, 'ADVANCE_PHASE', '0');
        await waitForDiceThronePhase(page, 'defensiveRoll', 10000);

        await setDiceThroneDiceValues(page, [3, 3, 5]);
        await dispatch(page, 'ROLL_DICE', '1');
        await dispatch(page, 'CONFIRM_ROLL', '1');
        await dispatch(page, 'ADVANCE_PHASE', '1');

        await dispatch(page, 'USE_TOKEN', '1', { tokenId: TOKEN_IDS.SAMURAI_RETRIBUTION, amount: 1 });
        const impactTextPromise = expectVisibleDamageText(page, '-2', 15000);
        const didPassTokenResponse = await maybePassResponse(page, 10000);
        expect(didPassTokenResponse).toBe(true);
        await impactTextPromise;
        const impactPath = await saveEvidenceScreenshot(page, testInfo, '暗影刺客小顺子命中飘字-2');

        await page.waitForFunction(() => {
            const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as HarnessState | null | undefined;
            const floats = Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'));
            const allDamageFloatsHidden = floats.every((element) => {
                const node = element as HTMLElement;
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return rect.width === 0
                    || rect.height === 0
                    || style.display === 'none'
                    || style.visibility === 'hidden'
                    || style.opacity === '0';
            });
            const uiOpponentHp = document.querySelector('[data-testid="dt-top-header-1-hp-value"]')?.textContent?.trim();
            const coreOpponentHp = state?.core?.players?.['1']?.resources?.hp;
            return state?.sys?.phase === 'main2'
                && typeof coreOpponentHp === 'number'
                && coreOpponentHp < 49
                && state?.core?.players?.['0']?.resources?.cp === 9
                && !state?.core?.pendingAttack
                && !state?.core?.pendingDamage
                && !state?.core?.pendingBonusDiceSettlement
                && !state?.sys?.interaction?.current
                && !state?.sys?.responseWindow?.current
                && allDamageFloatsHidden
                && Number(uiOpponentHp) === coreOpponentHp;
        }, undefined, { timeout: 15000, polling: 100 });

        const finalSummary = await readHpVisualSummary(page);
        expect(finalSummary.phase).toBe('main2');
        expect(finalSummary.coreSelfCp).toBe(9);
        expect(finalSummary.opponentHeaderPlayerId).toBe('1');
        expect(finalSummary.pendingAttack).toBe(false);
        expect(finalSummary.pendingBonusDiceSettlement).toBe(false);
        expect(finalSummary.pendingDamage).toBe(false);
        expect(finalSummary.interaction).toBe(false);
        expect(finalSummary.responseWindow).toBe(false);
        expect(finalSummary.coreOpponentHp).not.toBeNull();
        expect(finalSummary.coreOpponentHp).toBeLessThan(49);
        expect(finalSummary.uiOpponentHp).toBe(String(finalSummary.coreOpponentHp));
        await expect(page.getByTestId('dt-top-header-1-hp-value')).toHaveText(String(finalSummary.coreOpponentHp), { timeout: 5000 });
        const finalPath = await saveEvidenceScreenshot(page, testInfo, `暗影刺客小顺子后-武士血量${finalSummary.coreOpponentHp}`);

        const pickpocketDamage = finalSummary.damageEvents.filter((event) => (
            event.targetId === '1'
            && event.sourceAbilityId === 'pickpocket'
        ));
        expect(pickpocketDamage.length).toBeGreaterThanOrEqual(1);
        expect(pickpocketDamage.some((event) => Number(event.actualDamage ?? 0) > 0)).toBe(true);

        testInfo.annotations.push({
            type: 'evidence',
            description: `暗影刺客小顺子 UI 血量更新截图：${beforePath}；${impactPath}；${finalPath}`,
        });
    });

    test('暗影穿刺带伏击和耻辱时，伏击骰计入总伤害且攻击后耻辱移除', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await game.openTestGame('dicethrone', {}, OPEN_TIMEOUT_MS);
        await waitForDiceThroneHarness(page, 40000);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: { resources: { CP: 6, HP: 50 } },
            player1: { resources: { CP: 0, HP: 50 } },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                hostStarted: true,
                selectedCharacters: { '0': 'shadow_thief', '1': 'samurai' },
                rollConfirmed: false,
                rollCount: 0,
                rollLimit: 3,
            },
        });
        await prepareShadowThiefVsSamuraiScene(page, {
            attackerCp: 6,
            attackerShame: 2,
            attackerSneakAttack: 1,
            defenderHp: 50,
            defenderBackStrike: 0,
        });

        await expect(page.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1', { timeout: 10000 });
        await expect(page.getByTestId('dt-top-header-1-hp-value')).toHaveText('50', { timeout: 10000 });
        await expect.poll(async () => readShadowShankSneakSummary(page), { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            attackerCp: 6,
            defenderHp: 50,
            attackerSneakAttack: 1,
            attackerShame: 2,
            pendingAttack: false,
            pendingDamage: false,
        });
        const beforePath = await saveEvidenceScreenshot(page, testInfo, '暗影穿刺伏击前-暗影刺客有伏击和耻辱');

        await setDiceThroneDiceValues(page, [6, 6, 6, 6, 6]);
        await dispatch(page, 'ROLL_DICE', '0');
        await dispatch(page, 'CONFIRM_ROLL', '0');
        await dispatch(page, 'SELECT_ABILITY', '0', { abilityId: 'shadow-shank' });
        await dispatch(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => readShadowShankSneakSummary(page), { timeout: 10000 }).toMatchObject({
            attackerCp: 9,
            defenderHp: 50,
            attackerSneakAttack: 1,
            attackerShame: 0,
            pendingDamageCurrentDamage: 14,
            pendingDamageResponderId: '0',
            pendingDamageResponseType: 'beforeDamageDealt',
            pendingAttack: true,
            pendingDamage: true,
        });
        const tokenResponseSummary = await readShadowShankSneakSummary(page);
        const pendingDamageId = tokenResponseSummary.pendingDamageId;
        expect(pendingDamageId).toBeTruthy();
        const tokenResponsePath = await saveEvidenceScreenshot(page, testInfo, '暗影穿刺响应窗口-基础伤害14且伏击可用');

        await setHarnessRandomQueue(page, [randomValueForDieFace(3)]);
        await dispatch(page, 'USE_TOKEN', '0', {
            tokenId: TOKEN_IDS.SNEAK_ATTACK,
            amount: 1,
            pendingDamageId,
        });

        await expect.poll(async () => readShadowShankSneakSummary(page), { timeout: 10000 }).toMatchObject({
            attackerCp: 9,
            defenderHp: 50,
            attackerSneakAttack: 0,
            attackerShame: 0,
            pendingDamageCurrentDamage: 14,
            pendingDamageResponderId: '0',
            pendingDamageResponseType: 'beforeDamageDealt',
            pendingAttack: true,
            pendingDamage: true,
            pendingBonusDiceSettlement: true,
            pendingBonusDiceSource: 'shadow-thief-sneak-attack',
        });
        await expect(page.getByTestId('dicethrone-response-pass-button')).toHaveCount(0, { timeout: 5000 });
        await expectRightTrayBonusDiceConfirmation(
            page,
            () => readHarnessMatchState(page),
            { sourceAbilityId: 'shadow-thief-sneak-attack' },
        );
        const bonusRollPath = await saveEvidenceScreenshot(page, testInfo, '暗影穿刺伏击骰-掷到3待确认');

        await settleCurrentBonusDice(
            page,
            () => readHarnessMatchState(page),
            { sourceAbilityId: 'shadow-thief-sneak-attack' },
        );

        await expect.poll(async () => readShadowShankSneakSummary(page), { timeout: 10000 }).toMatchObject({
            attackerCp: 9,
            defenderHp: 50,
            attackerSneakAttack: 0,
            attackerShame: 0,
            pendingDamageCurrentDamage: 17,
            pendingDamageResponderId: '0',
            pendingDamageResponseType: 'beforeDamageDealt',
            pendingAttack: true,
            pendingDamage: true,
            pendingBonusDiceSettlement: false,
        });
        const bonusSettledPath = await saveEvidenceScreenshot(page, testInfo, '暗影穿刺伏击确认后-总伤害17');

        await dispatch(page, 'SKIP_TOKEN_RESPONSE', '0', { pendingDamageId });
        await expect.poll(async () => readShadowShankSneakSummary(page), { timeout: 15000 }).toMatchObject({
            phase: 'main2',
            attackerCp: 9,
            defenderHp: 33,
            attackerSneakAttack: 0,
            attackerShame: 0,
            uiDefenderHp: '33',
            pendingAttack: false,
            pendingDamage: false,
            pendingBonusDiceSettlement: false,
            interaction: false,
            responseWindow: false,
        });
        await waitForDiceThroneVisualIdle(page);

        const finalSummary = await readShadowShankSneakSummary(page);
        const damageEvent = finalSummary.damageEvents.find((event) => (
            event.targetId === '1'
            && event.sourceAbilityId === 'shadow-shank'
        ));
        expect(damageEvent).toMatchObject({
            amount: 17,
            actualDamage: 17,
        });
        expect(damageEvent?.modifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: TOKEN_IDS.SNEAK_ATTACK, value: 3 }),
        ]));
        expect(damageEvent?.modifiers ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: TOKEN_IDS.SHAME }),
        ]));
        expect(finalSummary.bonusDieEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({ value: 3, pendingDamageBonus: 3 }),
        ]));
        expect(finalSummary.tokenConsumedEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({ playerId: '0', tokenId: TOKEN_IDS.SHAME, amount: 2, newTotal: 0 }),
        ]));
        const finalPath = await saveEvidenceScreenshot(page, testInfo, '暗影穿刺结算后-武士血量33且耻辱清除');

        testInfo.annotations.push({
            type: 'evidence',
            description: `暗影穿刺 + 伏击 + 耻辱 E2E 截图：${beforePath}；${tokenResponsePath}；${bonusRollPath}；${bonusSettledPath}；${finalPath}`,
        });
    });

    test('线上双端暗影刺客小顺子结算后，对手顶部血量稳定显示正式扣血值', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupOnlineMatch(browser, baseURL, {
            skipImageGate: true,
            characterSelectionTimeout: 90000,
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            await selectCharacter(hostPage, 'shadow_thief');
            await selectCharacter(guestPage, 'samurai');
            await readyAndStartGame(hostPage, guestPage);
            await Promise.all([
                waitForGameBoard(hostPage),
                waitForGameBoard(guestPage),
            ]);

            await advanceToOffensiveRoll(hostPage);
            await patchOnlineShadowThiefScene(hostPage);
            await closeDebugPanelIfOpen(hostPage);
            await closeDebugPanelIfOpen(guestPage);

            await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1', { timeout: 10000 });
            await expect(hostPage.getByTestId('dt-top-header-1-hp-value')).toHaveText('49', { timeout: 10000 });
            const beforePath = await saveEvidenceScreenshot(hostPage, testInfo, '线上小顺子前-攻击方视角武士血量49');

            const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]').first();
            await expect(rollButton).toBeEnabled({ timeout: 10000 });
            await rollButton.click();
            await applyDiceValues(hostPage, [2, 1, 3, 4, 6]);
            await closeDebugPanelIfOpen(hostPage);

            const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]').first();
            await expect(confirmButton).toBeEnabled({ timeout: 10000 });
            await confirmButton.click();
            await maybePassResponse(guestPage, 10000);

            await clickAbilitySlot(hostPage, 'pickpocket');
            await dismissAttackShowcaseIfVisible(guestPage);
            await maybePassResponse(hostPage, 10000);
            await maybePassResponse(guestPage);

            const resolveAttackButton = hostPage.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
            await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
            await expect(resolveAttackButton).toBeEnabled({ timeout: 10000 });
            await resolveAttackButton.click();
            await dismissAttackShowcaseIfVisible(guestPage);
            await clickDefendEntryIfVisible(guestPage);

            const defenseRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]').first();
            await expect(defenseRollButton).toBeEnabled({ timeout: 10000 });
            await defenseRollButton.click();
            await applyDiceValues(guestPage, [3, 3, 5]);
            await closeDebugPanelIfOpen(guestPage);

            const defenseConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]').first();
            await expect(defenseConfirmButton).toBeEnabled({ timeout: 10000 });
            await defenseConfirmButton.click();
            await maybePassResponse(hostPage);
            await maybePassResponse(guestPage, 10000);

            const defenseAdvanceButton = guestPage.locator('[data-tutorial-id="advance-phase-button"]').first();
            await expect(defenseAdvanceButton).toBeEnabled({ timeout: 10000 });
            await defenseAdvanceButton.click();

            const backStrikeToken = guestPage.getByTestId(`dt-player-1-token-${TOKEN_IDS.SAMURAI_RETRIBUTION}`);
            const sharedResponsePrompt = guestPage.getByTestId('dicethrone-response-window-hint');
            await expect(sharedResponsePrompt).toBeVisible({ timeout: 10000 });
            await expect(sharedResponsePrompt).toHaveAttribute('data-response-kind', 'token');
            await expect(backStrikeToken).toBeVisible({ timeout: 5000 });
            await expect(backStrikeToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 5000 });
            await backStrikeToken.click();

            const impactTextPromise = expectVisibleDamageText(hostPage, '-2', 15000);
            const didPassTokenResponse = await maybePassResponse(guestPage, 10000);
            expect(didPassTokenResponse).toBe(true);
            await impactTextPromise;
            const impactPath = await saveEvidenceScreenshot(hostPage, testInfo, '线上小顺子命中飘字-2');
            await expect(guestPage.getByTestId('dicethrone-response-window-hint')).toHaveCount(0, { timeout: 10000 });
            await expect.poll(async () => {
                const match = await readMatchState(guestPage) as Record<string, any>;
                const core = match?.core ?? match;
                const sys = match?.sys ?? {};
                return {
                    pendingDamage: Boolean(core?.pendingDamage),
                    bonusSourceAbilityId: core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
                    interactionKind: sys?.interaction?.current?.kind ?? null,
                };
            }, { timeout: 10000 }).toMatchObject({
                pendingDamage: false,
                bonusSourceAbilityId: 'samurai-back-strike-reflect',
                interactionKind: 'dt:bonus-dice',
            });
            await settleCurrentBonusDice(
                guestPage,
                () => guestPage.evaluate(() => (window as Window).__BG_TEST_HARNESS__?.state?.get?.() as Record<string, any>),
                { sourceAbilityId: 'samurai-back-strike-reflect' },
            );

            await expect.poll(async () => {
                const match = await readMatchState(hostPage) as Record<string, any>;
                const core = match?.core ?? match;
                const sys = match?.sys ?? {};
                return {
                    phase: sys?.phase ?? core?.phase ?? null,
                    defenderHp: core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                    attackerCp: core?.players?.['0']?.resources?.[RESOURCE_IDS.CP] ?? null,
                    pendingAttack: Boolean(core?.pendingAttack),
                    pendingDamage: Boolean(core?.pendingDamage),
                    pendingBonusDiceSettlement: Boolean(core?.pendingBonusDiceSettlement),
                    samuraiRetribution: core?.players?.['1']?.tokens?.[TOKEN_IDS.SAMURAI_RETRIBUTION] ?? null,
                };
            }, { timeout: 15000 }).toMatchObject({
                phase: 'main2',
                defenderHp: 47,
                attackerCp: 9,
                pendingAttack: false,
                pendingDamage: false,
                pendingBonusDiceSettlement: false,
                samuraiRetribution: 0,
            });

            await Promise.all([
                waitForDiceThroneVisualIdle(hostPage),
                waitForDiceThroneVisualIdle(guestPage),
            ]);

            const core = await readCoreState(hostPage) as Record<string, any>;
            const hostOpponentHeader = await readTopHeaderHpForPlayer(hostPage, '1');
            const guestSelfStats = await readSelfStatsHp(guestPage);
            const hostLocalState = await readLocalHarnessHpSummary(hostPage);
            const guestLocalState = await readLocalHarnessHpSummary(guestPage);
            const hpSyncDiagnostics = {
                server: {
                    player0Hp: core.players['0'].resources[RESOURCE_IDS.HP],
                    player0Cp: core.players['0'].resources[RESOURCE_IDS.CP],
                    player1Hp: core.players['1'].resources[RESOURCE_IDS.HP],
                    player1BackStrike: core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION],
                },
                hostLocalState,
                guestLocalState,
                hostOpponentHeader,
                guestSelfStats,
            };
            const damageEvents = ((await hostPage.evaluate(() => (
                (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.eventStream?.entries ?? []
            ))) as Array<{ event?: { type?: string; payload?: Record<string, unknown> } }>)
                .map((entry) => entry.event)
                .filter((event) => (
                    event?.type === 'DAMAGE_DEALT'
                    && event.payload?.targetId === '1'
                    && event.payload?.sourceAbilityId === 'pickpocket'
                ))
                .map((event) => ({
                    amount: event?.payload?.amount ?? null,
                    actualDamage: event?.payload?.actualDamage ?? null,
                }));

            expect(hostOpponentHeader, JSON.stringify(hpSyncDiagnostics, null, 2))
                .toMatchObject({ playerId: '1', hpValue: String(core.players['1'].resources[RESOURCE_IDS.HP]) });
            expect(guestSelfStats.hpValue, JSON.stringify(hpSyncDiagnostics, null, 2))
                .toBe(String(core.players['1'].resources[RESOURCE_IDS.HP]));
            expect(damageEvents, JSON.stringify(hpSyncDiagnostics, null, 2))
                .toEqual([{ amount: 3, actualDamage: 2 }]);

            const finalPath = await saveEvidenceScreenshot(hostPage, testInfo, `线上小顺子后-攻击方视角武士血量${core.players['1'].resources[RESOURCE_IDS.HP]}`);
            const guestFinalPath = await saveEvidenceScreenshot(guestPage, testInfo, `线上小顺子后-武士自己视角血量${core.players['1'].resources[RESOURCE_IDS.HP]}`);

            testInfo.annotations.push({
                type: 'evidence',
                description: `线上双端暗影刺客小顺子血量 UI 截图：${beforePath}；${impactPath}；${finalPath}；${guestFinalPath}`,
            });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
