/**
 * DiceThrone Ninja 技能本体真实入口证据。
 *
 * 覆盖 Ninja 基础/升级技能从玩家板槽位选择、命令写入、不可防御/utility/终极结算和奖励骰展示。
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../framework';
import type { Browser, Page } from '@playwright/test';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    closeDebugPanelIfOpen,
    dispatchDiceThroneCommand,
    dispatchDiceThroneCommandWithTimeout,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import type { Die } from '../../src/games/dicethrone/domain/types';
import type { AbilityDef } from '../../src/games/dicethrone/domain/combat';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import {
    BLINK_2,
    DEATH_BLOSSOM_2,
    GOING_FORWARD_2,
    POISON_BLADE_2,
    SHADOW_FANG_2,
    SHADOW_STEP_2,
    SLASH_2,
    SMOKE_SCREEN_2,
} from '../../src/games/dicethrone/heroes/ninja/abilities';
import { expectRightTrayBonusDiceConfirmation, settleCurrentBonusDice } from './bonus-dice-flow';
import '../../src/games/dicethrone/domain';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'dicethrone-ninja-ability-real-entry.e2e',
);

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, fileName);
    await page.screenshot({ path, fullPage: false });
    return path;
};

const closeMatchContexts = async (match: MatchSetup) => {
    const closeWithTimeout = async (close: () => Promise<void>) => {
        await Promise.race([
            close().catch(() => undefined),
            new Promise<void>(resolve => setTimeout(resolve, 3000)),
        ]);
    };
    await Promise.all([
        closeWithTimeout(() => match.hostContext.close()),
        closeWithTimeout(() => match.guestContext.close()),
    ]);
};

const setupNinjaMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 90000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用');
        throw new Error('Game server unavailable');
    }
    await selectCharacter(match.hostPage, 'treant');
    await selectCharacter(match.guestPage, 'ninja');
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

const applyOnlineMatchState = async (
    matchId: string,
    page: Page,
    updater: (state: JsonRecord) => JsonRecord,
    waitMs = 800,
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
    await page.waitForTimeout(waitMs);
};

const forceFixedDieQueue = (sys: JsonRecord, values: number[]): JsonRecord => ({
    ...sys,
    tutorial: {
        ...asRecord(sys.tutorial),
        active: true,
        randomPolicy: { mode: 'sequence', values, cursor: 0 },
    },
});

const createNinjaDiceWithValues = (values: number[]) =>
    createCharacterDice('ninja').map((die: Die, index: number) => {
        const value = values[index] ?? 1;
        const symbol = getHeroDieFace('ninja', value);
        return {
            ...die,
            id: index,
            isKept: false,
            isLocked: false,
            value,
            symbol,
            symbols: symbol ? [symbol] : [],
            playerId: '1',
        };
    });

const readHarnessCoreState = async (page: Page): Promise<JsonRecord> => {
    const state = await page.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get());
    return asRecord(state?.core ?? state?.G?.core);
};

const readHarnessState = async (page: Page): Promise<JsonRecord> => {
    const state = await page.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get());
    return asRecord(state?.G ?? state);
};

const readAttackCloseoutSnapshot = async (page: Page): Promise<JsonRecord> => {
    const state = await readHarnessState(page);
    const core = asRecord(state.core);
    const sys = asRecord(state.sys);
    const pendingAttack = asRecord(core.pendingAttack);
    const pendingDamage = asRecord(core.pendingDamage);
    const currentInteraction = asRecord(asRecord(sys.interaction).current);
    const currentInteractionData = asRecord(currentInteraction.data);
    const currentInteractionOptions = Array.isArray(currentInteractionData.options)
        ? currentInteractionData.options.map((option) => {
            const optionRecord = asRecord(option);
            const value = asRecord(optionRecord.value);
            return {
                id: optionRecord.id,
                disabled: optionRecord.disabled,
                customId: value.customId,
                value: value.value,
            };
        })
        : undefined;
    return {
        pendingAttack: Boolean(core.pendingAttack),
        pendingDamage: Boolean(core.pendingDamage),
        pendingBonusDiceSettlement: Boolean(core.pendingBonusDiceSettlement),
        pendingDamageResponderId: pendingDamage.responderId,
        phase: sys.phase ?? core.phase,
        settlementStage: pendingAttack.settlementStage,
        preDefenseResolved: pendingAttack.preDefenseResolved,
        defenseResolved: pendingAttack.defenseResolved,
        isDefendable: pendingAttack.isDefendable,
        bonusDamage: pendingAttack.bonusDamage,
        currentInteractionId: currentInteraction.id,
        currentInteractionKind: currentInteraction.kind,
        currentInteractionPlayerId: currentInteraction.playerId,
        currentInteractionSourceId: currentInteractionData.sourceId,
        currentInteractionOptions,
        currentResponseWindowType: asRecord(asRecord(sys.responseWindow).current).windowType,
        currentRollKind: asRecord(core.currentRollContext).kind,
        currentRollStatus: asRecord(core.currentRollContext).status,
        activeResolutionFrameId: asRecord(sys.resolution).activeFrameId,
        resolutionFrames: Array.isArray(asRecord(sys.resolution).frames)
            ? asRecord(sys.resolution).frames
            : undefined,
    };
};

const readCurrentInteraction = async (page: Page): Promise<JsonRecord | null> => {
    const state = await readHarnessState(page);
    const current = asRecord(asRecord(asRecord(state.sys).interaction).current);
    return Object.keys(current).length > 0 ? current : null;
};

const readCurrentResponseWindow = async (page: Page): Promise<JsonRecord | null> => {
    const state = await readHarnessState(page);
    const current = asRecord(asRecord(asRecord(state.sys).responseWindow).current);
    return Object.keys(current).length > 0 ? current : null;
};

const getResponseWindowCurrentResponderId = (responseWindow: JsonRecord): string | null => {
    const responderQueue = Array.isArray(responseWindow.responderQueue)
        ? responseWindow.responderQueue.map(String)
        : [];
    const currentResponderIndex = typeof responseWindow.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    return responderQueue[currentResponderIndex] ?? null;
};

const getPagePlayerId = (page: Page): string | null => {
    const playerId = new URL(page.url()).searchParams.get('playerID');
    return playerId ? String(playerId) : null;
};

const findOpenResponseWindow = async (
    pages: Page[],
    timeoutMs: number,
): Promise<{ page: Page; current: JsonRecord } | null> => {
    const deadline = Date.now() + timeoutMs;
    do {
        for (const page of pages) {
            const current = await readCurrentResponseWindow(page).catch(() => null);
            if (current) {
                return { page, current };
            }
        }
        await pages[0]?.waitForTimeout(100);
    } while (Date.now() < deadline);
    return null;
};

const findOpenInteraction = async (
    pages: Page[],
    timeoutMs: number,
): Promise<{ page: Page; current: JsonRecord } | null> => {
    const deadline = Date.now() + timeoutMs;
    do {
        for (const page of pages) {
            const current = await readCurrentInteraction(page).catch(() => null);
            if (current) {
                return { page, current };
            }
        }
        await pages[0]?.waitForTimeout(100);
    } while (Date.now() < deadline);
    return null;
};

const didPhaseAdvanceAffectState = (before: JsonRecord, after: JsonRecord): boolean =>
    JSON.stringify(before) !== JSON.stringify(after);

const closeCardSpotlightIfOpen = async (page: Page) => {
    const closeButton = page.getByRole('button', { name: /关闭特写|Close/i }).first();
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(200);
    }
};

const chooseVariantByLabelIfVisible = async (page: Page, label: RegExp) => {
    const variantTitle = page.getByRole('heading', { name: '选择发动变体' }).first();
    if (!await variantTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
        return;
    }
    const optionButton = page.getByRole('button', { name: label }).first();
    await expect(optionButton).toBeVisible({ timeout: 5000 });
    await optionButton.click();
    await expect(variantTitle).toBeHidden({ timeout: 10000 }).catch(() => {});
};

const dismissAttackShowcaseIfVisible = async (page: Page) => {
    const foregroundModal = page.locator('#modal-root [role="dialog"]');
    if (await foregroundModal.first().isVisible({ timeout: 300 }).catch(() => false)) {
        return;
    }

    const continueButton = page.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i }).first();
    if (await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueButton.click({ timeout: 1500 }).catch(() => undefined);
        await expect(continueButton).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
};

const tryPassResponseByUi = async (page: Page, timeout = 500): Promise<boolean> => {
    await dismissAttackShowcaseIfVisible(page);
    const passButton = page.getByTestId('dicethrone-response-pass-button')
        .or(page.getByRole('button', { name: /^(Pass|跳过|让过)$/i }))
        .first();
    if (!await passButton.isVisible({ timeout }).catch(() => false)) {
        return false;
    }

    const clicked = await passButton.click({ timeout }).then(() => true).catch(async () => {
        await dismissAttackShowcaseIfVisible(page);
        return false;
    });
    if (!clicked) {
        return false;
    }

    await page.waitForTimeout(300);
    return true;
};

const resolveDefenseOnPage = async (page: Page) => {
    await dismissAttackShowcaseIfVisible(page);

    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
    const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]').first();
    const rootedChoiceTitle = page.getByText('扎根：选择额外效果');

    if (await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice), { timeout: 5000 }).then(() => true).catch(() => false)) {
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3]);
        }).catch(() => {});
    }

    if (await startDefenseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await startDefenseButton.click();
        await expect(startDefenseButton).toBeHidden({ timeout: 10000 }).catch(() => {});
    }

    if (await rollButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await rollButton.click();
        await page.waitForTimeout(300);
    }

    const beforeConfirm = await readHarnessCoreState(page);
    if (beforeConfirm.rollCount && !beforeConfirm.rollConfirmed) {

        const confirmVisible = await confirmButton.isVisible({ timeout: 5000 }).catch(() => false);
        const confirmEnabled = confirmVisible
            ? await confirmButton.isEnabled({ timeout: 2000 }).catch(() => false)
            : false;
        if (confirmVisible && confirmEnabled) {
            await confirmButton.click().catch(() => {});
        }
        await page.waitForTimeout(400);

        const afterUiClick = await readHarnessCoreState(page);
        if (!afterUiClick.rollConfirmed) {
            await dispatchDiceThroneCommandWithTimeout(page, {
                type: 'CONFIRM_ROLL',
                playerId: '0',
                payload: {},
            }, 5000);
            await page.waitForTimeout(400);
        }

        await expect.poll(async () => (await readHarnessCoreState(page)).rollConfirmed, { timeout: 5000 }).toBe(true);
    }

    await clickAdvancePhase(page, '0');

    const afterDefenseAdvance = await readHarnessCoreState(page);
    if (afterDefenseAdvance.pendingBonusDiceSettlement) {
        await settleCurrentBonusDice(page, () => readHarnessCoreState(page), {});
    }

    const rootedChoiceVisible = await rootedChoiceTitle.isVisible({ timeout: 3000 }).catch(() => false);
    if (rootedChoiceVisible) {
        const rootedChoiceButton = page.getByRole('button', { name: /养成后：幼种 1/i }).first();
        const lifeSapChoiceButton = page.getByRole('button', { name: /获得生命源泉/i }).first();
        if (await rootedChoiceButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            await rootedChoiceButton.click();
        } else if (await lifeSapChoiceButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            await lifeSapChoiceButton.click();
        } else {
            await page.getByRole('button').filter({ hasText: /\S+/ }).first().click();
        }
        await expect(rootedChoiceTitle).toBeHidden({ timeout: 10000 });
        await page.waitForTimeout(300);
        if ((await readHarnessCoreState(page)).pendingAttack) {
            await clickAdvancePhase(page, '0');
        }
    }
};

const drainResponseWindows = async (...pages: Page[]) => {
    for (let round = 0; round < 8; round += 1) {
        for (const page of pages) {
            await dismissAttackShowcaseIfVisible(page);
        }

        const observed = await findOpenResponseWindow(pages, round === 0 ? 1200 : 500);
        if (!observed) {
            return;
        }

        if (observed.current.pendingInteractionId || observed.current.requiredInteractionId) {
            throw new Error(`响应窗口仍被交互锁定，不能直接让过：${JSON.stringify(observed.current)}`);
        }

        let passedByUi = false;
        for (const page of pages) {
            // 某些攻击会在结束防御后进入 token/response 窗口；不显式 pass 会导致 pendingAttack 卡住不收口。
            const didPass = await tryPassResponseByUi(page, 700);
            passedByUi = passedByUi || didPass;
        }
        if (passedByUi) {
            await observed.page.waitForTimeout(350);
            continue;
        }

        const responderId = getResponseWindowCurrentResponderId(observed.current);
        if (!responderId) {
            throw new Error(`响应窗口缺少当前响应者，不能让过：${JSON.stringify(observed.current)}`);
        }

        const responderPage = pages.find(page => getPagePlayerId(page) === responderId) ?? observed.page;
        const result = await dispatchDiceThroneCommandWithTimeout(responderPage, {
            type: 'RESPONSE_PASS',
            playerId: responderId,
            payload: { forPlayerId: responderId },
        }, 3000);
        if (result !== 'ok') {
            throw new Error(`响应者 ${responderId} 让过失败：${result}; 窗口=${JSON.stringify(observed.current)}`);
        }
        await responderPage.waitForTimeout(350);
    }

    const remaining = await findOpenResponseWindow(pages, 200);
    if (remaining) {
        throw new Error(`响应窗口超过最大让过轮次仍未关闭：${JSON.stringify(remaining.current)}`);
    }
};

const isEnabledPromptOption = (option: JsonRecord): boolean => option.disabled !== true;

const getPromptOptionCustomId = (option: JsonRecord): string | undefined => {
    const value = asRecord(option.value);
    return typeof value.customId === 'string' ? value.customId : undefined;
};

const getPromptOptionNumericValue = (option: JsonRecord): number | undefined => {
    const value = asRecord(option.value).value;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const chooseSimpleChoiceOptionId = (interaction: JsonRecord): string | null => {
    const data = asRecord(interaction.data);
    const options = Array.isArray(data.options)
        ? data.options.map(asRecord).filter(isEnabledPromptOption)
        : [];
    if (options.length === 0) return null;

    const sourceId = typeof data.sourceId === 'string' ? data.sourceId : undefined;
    const playerId = typeof interaction.playerId === 'string' ? interaction.playerId : undefined;
    if (sourceId === 'smoke-screen-2-main' && playerId !== undefined) {
        const playerNumber = Number(playerId);
        if (Number.isFinite(playerNumber)) {
            const selfSmokeScreenOptionValue = (playerNumber + 1) * 10 + 1;
            const selfSmokeScreenOption = options.find(option =>
                getPromptOptionCustomId(option) === 'ninja-smoke-screen-2-choice'
                && getPromptOptionNumericValue(option) === selfSmokeScreenOptionValue,
            );
            if (typeof selfSmokeScreenOption?.id === 'string') {
                return selfSmokeScreenOption.id;
            }
        }
    }

    const skipOption = options.find(option =>
        getPromptOptionCustomId(option) === 'skip'
        || option.id === 'skip'
        || option.labelKey === 'tokenResponse.skip',
    );
    if (typeof skipOption?.id === 'string') return skipOption.id;

    const firstOption = options.find(option => typeof option.id === 'string');
    return typeof firstOption?.id === 'string' ? firstOption.id : null;
};

const settleBlockingInteractionIfNeeded = async (
    actors: Array<{ page: Page; playerId: string }>,
): Promise<boolean> => {
    const pages = actors.map(actor => actor.page);
    for (let round = 0; round < 6; round += 1) {
        const observed = await findOpenInteraction(pages, round === 0 ? 250 : 100);
        if (!observed) {
            return round > 0;
        }

        const kind = observed.current.kind;
        const responderId = typeof observed.current.playerId === 'string'
            ? observed.current.playerId
            : null;
        if (!responderId) {
            throw new Error(`当前交互缺少决策玩家，不能收口：${JSON.stringify(observed.current)}`);
        }

        const responderPage = actors.find(actor => actor.playerId === responderId)?.page ?? observed.page;
        for (const page of pages) {
            await dismissAttackShowcaseIfVisible(page);
        }

        if (kind === 'dt:token-response') {
            const result = await dispatchDiceThroneCommandWithTimeout(responderPage, {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: responderId,
                payload: {},
            }, 3000);
            if (result !== 'ok') {
                throw new Error(`Token 响应跳过失败：${result}; 交互=${JSON.stringify(observed.current)}`);
            }
            await responderPage.waitForTimeout(300);
            continue;
        }

        if (kind === 'dt:bonus-dice') {
            const result = await dispatchDiceThroneCommandWithTimeout(responderPage, {
                type: 'SKIP_BONUS_DICE_REROLL',
                playerId: responderId,
                payload: {},
            }, 3000);
            if (result !== 'ok') {
                throw new Error(`奖励骰确认失败：${result}; 交互=${JSON.stringify(observed.current)}`);
            }
            await responderPage.waitForTimeout(300);
            continue;
        }

        if (kind === 'simple-choice') {
            const optionId = chooseSimpleChoiceOptionId(observed.current);
            if (!optionId) {
                throw new Error(`simple-choice 没有可用选项，不能收口：${JSON.stringify(observed.current)}`);
            }

            const result = await dispatchDiceThroneCommandWithTimeout(responderPage, {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: responderId,
                payload: {
                    interactionId: observed.current.id,
                    optionId,
                },
            }, 3000);
            if (result !== 'ok') {
                throw new Error(`simple-choice 响应失败：${result}; optionId=${optionId}; 交互=${JSON.stringify(observed.current)}`);
            }
            await responderPage.waitForTimeout(300);
            continue;
        }

        return round > 0;
    }

    const remaining = await findOpenInteraction(pages, 100);
    if (remaining) {
        throw new Error(`交互超过最大收口轮次仍未关闭：${JSON.stringify(remaining.current)}`);
    }
    return true;
};

const clickAdvancePhase = async (page: Page, playerId: string) => {
    await closeDebugPanelIfOpen(page);
    await closeCardSpotlightIfOpen(page);
    const before = await readAttackCloseoutSnapshot(page).catch(() => ({}));
    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
    if (
        await advanceButton.isVisible({ timeout: 2000 }).catch(() => false)
        && await advanceButton.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        const clicked = await advanceButton.click({ timeout: 2000 }).then(() => true).catch(() => false);
        if (clicked) {
            await page.waitForTimeout(500);
            const after = await readAttackCloseoutSnapshot(page).catch(() => ({}));
            if (didPhaseAdvanceAffectState(before, after)) return;
        }
    }
    await dispatchDiceThroneCommand(page, {
        type: 'ADVANCE_PHASE',
        playerId,
        payload: {},
    });
};

const tryAdvancePhase = async (page: Page, playerId: string): Promise<boolean> => {
    await closeDebugPanelIfOpen(page);
    await closeCardSpotlightIfOpen(page);
    const before = await readAttackCloseoutSnapshot(page).catch(() => ({}));
    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
    if (
        await advanceButton.isVisible({ timeout: 1000 }).catch(() => false)
        && await advanceButton.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        const clicked = await advanceButton.click({ timeout: 1500 }).then(() => true).catch(() => false);
        if (clicked) {
            await page.waitForTimeout(500);
            const after = await readAttackCloseoutSnapshot(page).catch(() => ({}));
            if (didPhaseAdvanceAffectState(before, after)) return true;
        }
    }

    const result = await dispatchDiceThroneCommandWithTimeout(page, {
        type: 'ADVANCE_PHASE',
        playerId,
        payload: {},
    }, 3000);
    if (result === 'ok') {
        await page.waitForTimeout(500);
    }
    return result === 'ok';
};

const settlePendingAttackIfNeeded = async (
    actors: Array<{ page: Page; playerId: string }>,
) => {
    for (let round = 0; round < 6; round += 1) {
        const core = await readHarnessCoreState(actors[0].page);
        if (!core.pendingAttack && !core.pendingDamage) return;

        const settledInteraction = await settleBlockingInteractionIfNeeded(actors);
        if (settledInteraction) {
            await actors[0].page.waitForTimeout(350);
            continue;
        }
        await drainResponseWindows(...actors.map(actor => actor.page));

        const afterDrain = await readHarnessCoreState(actors[0].page);
        if (!afterDrain.pendingAttack && !afterDrain.pendingDamage) return;

        const settledAfterDrain = await settleBlockingInteractionIfNeeded(actors);
        if (settledAfterDrain) {
            await actors[0].page.waitForTimeout(350);
            continue;
        }

        let advanced = false;
        for (const actor of actors) {
            advanced = await tryAdvancePhase(actor.page, actor.playerId) || advanced;
        }
        if (!advanced) {
            break;
        }
        await actors[0].page.waitForTimeout(500);
    }

    const finalSnapshot = await readAttackCloseoutSnapshot(actors[0].page);
    if (finalSnapshot.pendingAttack || finalSnapshot.pendingDamage) {
        throw new Error(`攻击未收口状态快照：${JSON.stringify(finalSnapshot, null, 2)}`);
    }
};

const advanceOutOfOffensiveRollAfterAttackIfNeeded = async (page: Page, playerId: string) => {
    await expect.poll(async () => {
        const core = await readHarnessCoreState(page);
        return Boolean(core.pendingAttack);
    }, { timeout: 15000 }).toBe(false);

    const state = await readHarnessState(page);
    const core = asRecord(state.core);
    const sys = asRecord(state.sys);
    if ((sys.phase ?? core.phase) === 'offensiveRoll') {
        await clickAdvancePhase(page, playerId);
    }

    await expect.poll(async () => {
        const nextState = await readHarnessState(page);
        const nextCore = asRecord(nextState.core);
        const nextSys = asRecord(nextState.sys);
        return {
            stillOffensiveRoll: (nextSys.phase ?? nextCore.phase) === 'offensiveRoll',
            pendingAttack: Boolean(nextCore.pendingAttack),
        };
    }, { timeout: 10000 }).toEqual({ stillOffensiveRoll: false, pendingAttack: false });
};

const clickResolvedAbilitySlot = async (
    page: Page,
    slotId: string,
    expectedAbilityId: string,
) => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await clickAbilitySlot(page, slotId);
};

const clickAbilitySlot = async (
    page: Page,
    slotId: string,
) => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    const clickPoint = await page.evaluate((targetSlotId) => {
        const element = document.querySelector(
            `[data-testid="player-board-surface"] [data-ability-slot="${targetSlotId}"]`,
        ) as HTMLElement | null;
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const xFractions = [0.5, 0.28, 0.72, 0.18, 0.82];
        const yFractions = [0.5, 0.68, 0.34, 0.82, 0.18];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.left + rect.width * xFraction;
                const y = rect.top + rect.height * yFraction;
                const topElement = document.elementFromPoint(x, y);
                if (topElement?.closest?.('button')) {
                    continue;
                }
                const hitSlot = topElement?.closest?.('[data-ability-slot]');
                if (hitSlot === element) {
                    return { x, y };
                }
            }
        }

        return null;
    }, slotId);

    expect(clickPoint, `${slotId} 槽位必须存在真实可点击点`).not.toBeNull();
    await page.mouse.click(clickPoint!.x, clickPoint!.y);
};

const chooseFirstSimpleChoiceIfVisible = async (page: Page, title: RegExp, buttonLabel: RegExp) => {
    const modalTitle = page.locator('#modal-root').getByText(title).first();
    if (!await modalTitle.isVisible({ timeout: 1200 }).catch(() => false)) {
        return false;
    }
    const optionButton = page.locator('#modal-root').getByRole('button', { name: buttonLabel }).first();
    await expect(optionButton).toBeVisible({ timeout: 5000 });
    await optionButton.click();
    return true;
};

const upgradeDefinitions: Record<string, { cardId: string; def: AbilityDef }> = {
    blink: { cardId: 'upgrade-blink-2', def: BLINK_2 },
    'death-blossom': { cardId: 'upgrade-death-blossom-2', def: DEATH_BLOSSOM_2 },
    'going-forward': { cardId: 'upgrade-going-forward-2', def: GOING_FORWARD_2 },
    'poison-blade': { cardId: 'upgrade-poison-blade-2', def: POISON_BLADE_2 },
    'shadow-fang': { cardId: 'upgrade-shadow-fang-2', def: SHADOW_FANG_2 },
    'shadow-step': { cardId: 'upgrade-shadow-step-2', def: SHADOW_STEP_2 },
    slash: { cardId: 'upgrade-slash-2', def: SLASH_2 },
    'smoke-screen': { cardId: 'upgrade-smoke-screen-2', def: SMOKE_SCREEN_2 },
};

const setNinjaScenario = async (
    match: MatchSetup,
    values: number[],
    options: { upgradedAbilityIds?: string[]; randomValues?: number[]; defenderSneak?: number } = {},
) => {
    await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
        const root = asRecord(state.G ?? state);
        const core = asRecord(root.core);
        const sys = asRecord(root.sys);
        const players = asRecordMap(core.players);
        const p0 = asRecord(players['0']);
        const p1 = asRecord(players['1']);
        const p0Tokens = asRecord(p0.tokens);
        const p0Resources = asRecord(p0.resources);
        const p1Tokens = asRecord(p1.tokens);
        const p1Resources = asRecord(p1.resources);
        const upgradedIds = options.upgradedAbilityIds ?? [];
        let abilities = Array.isArray(p1.abilities) ? [...p1.abilities] : [];
        const abilityLevels = { ...asRecord(p1.abilityLevels) };
        const upgradeCardByAbilityId = { ...asRecord(p1.upgradeCardByAbilityId) };

        for (const abilityId of upgradedIds) {
            const upgrade = upgradeDefinitions[abilityId];
            if (!upgrade) continue;
            abilities = abilities.map(ability => asRecord(ability).id === abilityId ? structuredClone(upgrade.def) : ability);
            abilityLevels[abilityId] = 2;
            upgradeCardByAbilityId[abilityId] = { cardId: upgrade.cardId, cpCost: 2 };
        }

        players['0'] = {
            ...p0,
            resources: { ...p0Resources, [RESOURCE_IDS.HP]: 30 },
            tokens: {
                ...p0Tokens,
                [TOKEN_IDS.DELAYED_POISON]: 0,
                [TOKEN_IDS.THORN]: 0,
                [TOKEN_IDS.SNEAK]: options.defenderSneak ?? 0,
            },
            damageShields: [],
        };
        players['1'] = {
            ...p1,
            abilities,
            abilityLevels,
            upgradeCardByAbilityId,
            resources: { ...p1Resources, [RESOURCE_IDS.HP]: 30, [RESOURCE_IDS.CP]: 3 },
            tokens: {
                ...p1Tokens,
                [TOKEN_IDS.SMOKE_BOMB]: 0,
                [TOKEN_IDS.NINJUTSU]: 0,
            },
            pendingBonusDamage: 0,
            damageShields: [],
        };
        root.core = {
            ...core,
            players,
            activePlayerId: '1',
            phase: 'offensiveRoll',
            rollCount: 1,
            rollConfirmed: true,
            dice: createNinjaDiceWithValues(values),
            pendingAttack: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: undefined,
            currentRollContext: undefined,
            activatingAbilityId: undefined,
            currentChoiceSourceAbilityId: undefined,
            currentChoiceContext: undefined,
            afterRollResponseWindowSequence: undefined,
            afterRollResponseWindowSignature: undefined,
        };
        root.sys = forceFixedDieQueue({
            ...sys,
            phase: 'offensiveRoll',
            currentPlayerIndex: 1,
            interaction: { ...asRecord(sys.interaction), current: undefined, queue: [], isBlocked: false },
            responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
            resolution: undefined,
        }, options.randomValues ?? values);
        return state;
    });
    await closeDebugPanelIfOpen(match.guestPage);
    await closeCardSpotlightIfOpen(match.guestPage);
    await dismissAttackShowcaseIfVisible(match.guestPage);
    await dismissAttackShowcaseIfVisible(match.hostPage);
    await expect.poll(async () => {
        const snapshot = await readAttackCloseoutSnapshot(match.guestPage);
        return {
            pendingAttack: snapshot.pendingAttack,
            pendingDamage: snapshot.pendingDamage,
            pendingBonusDiceSettlement: snapshot.pendingBonusDiceSettlement,
            currentInteractionKind: snapshot.currentInteractionKind ?? null,
            currentResponseWindowType: snapshot.currentResponseWindowType ?? null,
        };
    }, { timeout: 10000 }).toEqual({
        pendingAttack: false,
        pendingDamage: false,
        pendingBonusDiceSettlement: false,
        currentInteractionKind: null,
        currentResponseWindowType: null,
    });
    await expect(match.guestPage.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'ninja', { timeout: 10000 });
};

test.describe('DiceThrone Ninja 技能本体真实入口', () => {
    test('基础与升级技能应从真实玩家板槽位进入正确 sourceAbilityId', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const match = await setupNinjaMatch(browser, testInfo.project.use.baseURL as string | undefined);
        const testName = '基础与升级技能应从真实玩家板槽位进入正确 sourceAbilityId';
        const directCases = [
            { label: 'slash-2', values: [1, 1, 2, 2, 3], slot: 'fist', expected: 'slash-2-5', upgrades: ['slash'] },
            { label: 'shadow-fang-2', values: [1, 2, 3, 4, 5], slot: 'calm', expected: 'shadow-fang-2-main', upgrades: ['shadow-fang'] },
            { label: 'assassinate', values: [6, 6, 6, 6, 6], slot: 'ultimate', expected: 'ninja-assassinate', upgrades: [] },
        ];

        try {
            for (let index = 0; index < directCases.length; index += 1) {
                const item = directCases[index];
                await setNinjaScenario(match, item.values, { upgradedAbilityIds: item.upgrades });
                await screenshot(match.guestPage, testName, `${String(index + 1).padStart(2, '0')}-${item.label}-before-click.png`);
                await clickResolvedAbilitySlot(match.guestPage, item.slot, item.expected);
                await expect.poll(async () => {
                    const core = await readHarnessCoreState(match.guestPage);
                    return asRecord(core.pendingAttack).sourceAbilityId;
                }, { timeout: 10000 }).toBe(item.expected);
                await screenshot(match.guestPage, testName, `${String(index + 1).padStart(2, '0')}-${item.label}-after-click.png`);
            }

            await setNinjaScenario(match, [4, 4, 5, 5, 6], { upgradedAbilityIds: ['going-forward'] });
            await screenshot(match.guestPage, testName, '04-going-forward-2-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'chi', 'going-forward-2-main');
            await chooseVariantByLabelIfVisible(match.guestPage, /一往无前 II（4个手里剑）/);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return asRecord(core.pendingAttack).sourceAbilityId;
            }, { timeout: 10000 }).toBe('going-forward-2-main');
            await screenshot(match.guestPage, testName, '04-going-forward-2-after-click.png');

            await setNinjaScenario(match, [6, 6, 6, 6, 1], { upgradedAbilityIds: ['shadow-step'] });
            await screenshot(match.guestPage, testName, '05-shadow-step-2-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'lightning', 'shadow-step-2-main');
            await chooseVariantByLabelIfVisible(match.guestPage, /暗影步 II（4个面具）/);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return asRecord(core.pendingAttack).sourceAbilityId;
            }, { timeout: 10000 }).toBe('shadow-step-2-main');
            await screenshot(match.guestPage, testName, '05-shadow-step-2-after-click.png');

            await setNinjaScenario(match, [1, 4, 5, 6, 1], { upgradedAbilityIds: ['smoke-screen'] });
            await screenshot(match.guestPage, testName, '06-smoke-screen-2-before-click.png');
            const smokeScreenSlot = match.guestPage.locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]').first();
            await expect(smokeScreenSlot).toHaveAttribute('data-base-ability-id', 'smoke-screen', { timeout: 10000 });
            await expect(smokeScreenSlot).toHaveAttribute('data-resolved-ability-id', 'smoke-screen-2-main', { timeout: 10000 });
            await clickAbilitySlot(match.guestPage, 'lotus');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return asRecord(core.pendingAttack).sourceAbilityId;
            }, { timeout: 10000 }).toBe('smoke-screen-2-main');
            await screenshot(match.guestPage, testName, '06-smoke-screen-2-after-click.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('不可防御、utility 与终极技能应从真实槽位结算到权威状态', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const match = await setupNinjaMatch(browser, testInfo.project.use.baseURL as string | undefined);
        const testName = '不可防御、utility 与终极技能应从真实槽位结算到权威状态';

        try {
            await setNinjaScenario(match, [6, 6, 6, 6, 1], { upgradedAbilityIds: ['shadow-step'] });
            await screenshot(match.guestPage, testName, '01-shadow-step-2-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'lightning', 'shadow-step-2-main');
            await chooseVariantByLabelIfVisible(match.guestPage, /暗影步 II（4个面具）/);
            await clickAdvancePhase(match.guestPage, '1');
            await settlePendingAttackIfNeeded([
                { page: match.guestPage, playerId: '1' },
                { page: match.hostPage, playerId: '0' },
            ]);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                const p1Tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    delayedPoison: p0Tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    smokeBomb: p1Tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    pendingAttack: Boolean(core.pendingAttack),
                };
            }, { timeout: 15000 }).toEqual({
                opponentHp: 25,
                delayedPoison: 2,
                smokeBomb: 1,
                pendingAttack: false,
            });
            await advanceOutOfOffensiveRollAfterAttackIfNeeded(match.guestPage, '1');
            await screenshot(match.guestPage, testName, '02-shadow-step-2-after-resolve.png');

            await setNinjaScenario(match, [1, 4, 5, 6, 1], { upgradedAbilityIds: ['smoke-screen'] });
            await screenshot(match.guestPage, testName, '03-smoke-screen-2-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'lotus', 'smoke-screen-2-main');
            await clickAdvancePhase(match.guestPage, '1');
            await chooseFirstSimpleChoiceIfVisible(match.guestPage, /选择烟雾阵 II 的目标/i, /令2号玩家获得|2号玩家获得|P2/i);
            await settlePendingAttackIfNeeded([
                { page: match.guestPage, playerId: '1' },
                { page: match.hostPage, playerId: '0' },
            ]);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                const p1Tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    delayedPoison: p0Tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    smokeBomb: p1Tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    ninjutsu: p1Tokens[TOKEN_IDS.NINJUTSU] ?? 0,
                    pendingAttack: Boolean(core.pendingAttack),
                };
            }, { timeout: 15000 }).toEqual({
                opponentHp: 30,
                delayedPoison: 1,
                smokeBomb: 1,
                ninjutsu: 3,
                pendingAttack: false,
            });
            await advanceOutOfOffensiveRollAfterAttackIfNeeded(match.guestPage, '1');
            await screenshot(match.guestPage, testName, '04-smoke-screen-2-after-resolve.png');

            await setNinjaScenario(match, [6, 6, 6, 6, 6]);
            await screenshot(match.guestPage, testName, '05-assassinate-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'ultimate', 'ninja-assassinate');
            await clickAdvancePhase(match.guestPage, '1');
            await settlePendingAttackIfNeeded([
                { page: match.guestPage, playerId: '1' },
                { page: match.hostPage, playerId: '0' },
            ]);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                const p1Tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    delayedPoison: p0Tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    smokeBomb: p1Tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    pendingAttack: Boolean(core.pendingAttack),
                };
            }, { timeout: 15000 }).toEqual({
                opponentHp: 20,
                delayedPoison: 2,
                smokeBomb: 1,
                pendingAttack: false,
            });
            await advanceOutOfOffensiveRollAfterAttackIfNeeded(match.guestPage, '1');
            await screenshot(match.guestPage, testName, '06-assassinate-after-resolve.png');

        } finally {
            await closeMatchContexts(match);
        }
    });

    test('毒刃 II 在奖励骰投出面具时应从真实槽位收口到 2 慢性中毒 + 5 点伤害', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const match = await setupNinjaMatch(browser, testInfo.project.use.baseURL as string | undefined);
        const testName = '毒刃 II 在奖励骰投出面具时应从真实槽位收口到 2 慢性中毒 + 5 点伤害';

        try {
            await setNinjaScenario(match, [1, 2, 3, 4, 5], {
                upgradedAbilityIds: ['poison-blade'],
                randomValues: [6, 1, 6, 6],
            });
            await screenshot(match.guestPage, testName, '01-poison-blade-2-mask-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'combo', 'poison-blade');
            await drainResponseWindows(match.hostPage, match.guestPage);
            await clickAdvancePhase(match.guestPage, '1');

            await expectRightTrayBonusDiceConfirmation(match.guestPage, () => readHarnessCoreState(match.guestPage), {});
            await screenshot(match.guestPage, testName, '02-poison-blade-2-right-tray-before-confirm.png');
            await settleCurrentBonusDice(match.guestPage, () => readHarnessCoreState(match.guestPage), {});
            await resolveDefenseOnPage(match.hostPage);
            await drainResponseWindows(match.hostPage, match.guestPage);
            await settlePendingAttackIfNeeded([
                { page: match.hostPage, playerId: '0' },
                { page: match.guestPage, playerId: '1' },
            ]);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                return {
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    delayedPoison: p0Tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    pendingAttack: Boolean(core.pendingAttack),
                };
            }, { timeout: 15000 }).toEqual({
                opponentHp: 28,
                delayedPoison: 2,
                pendingAttack: false,
            });
            await advanceOutOfOffensiveRollAfterAttackIfNeeded(match.guestPage, '1');
            await screenshot(match.guestPage, testName, '04-poison-blade-2-mask-after-resolve.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('死亡盛放 II 应从真实槽位进入右侧奖励骰盘并收口', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const match = await setupNinjaMatch(browser, testInfo.project.use.baseURL as string | undefined);
        const testName = '死亡盛放 II 应从真实槽位进入右侧奖励骰盘并收口';

        try {
            await setNinjaScenario(match, [1, 2, 3, 4, 5], {
                upgradedAbilityIds: ['death-blossom'],
                randomValues: [1, 4, 5, 6, 6],
            });
            await screenshot(match.guestPage, testName, '01-death-blossom-2-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'sky', 'death-blossom');
            await drainResponseWindows(match.hostPage, match.guestPage);
            await clickAdvancePhase(match.guestPage, '1');
            await expectRightTrayBonusDiceConfirmation(match.guestPage, () => readHarnessCoreState(match.guestPage), {});
            await screenshot(match.guestPage, testName, '02-death-blossom-2-right-tray-before-confirm.png');
            await settleCurrentBonusDice(match.guestPage, () => readHarnessCoreState(match.guestPage), {});
            await settlePendingAttackIfNeeded([
                { page: match.guestPage, playerId: '1' },
                { page: match.hostPage, playerId: '0' },
            ]);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                const p1Tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    settlementOpen: Boolean(core.pendingBonusDiceSettlement),
                    ninjutsu: p1Tokens[TOKEN_IDS.NINJUTSU] ?? 0,
                    delayedPoison: p0Tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    pendingAttack: Boolean(core.pendingAttack),
                };
            }, { timeout: 10000 }).toEqual({
                settlementOpen: false,
                ninjutsu: 0,
                delayedPoison: 1,
                opponentHp: 25,
                pendingAttack: false,
            });
            await screenshot(match.guestPage, testName, '04-death-blossom-2-after-closeout.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

});
