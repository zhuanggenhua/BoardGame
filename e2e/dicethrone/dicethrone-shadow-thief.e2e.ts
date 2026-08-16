/**
 * 暗影刺客 (Shadow Thief) E2E 交互测试
 *
 * 覆盖交互面：
 * - 角色选择 + 基础攻击流程
 * - Sneak 免伤触发
 * - 双防御技能选择
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;

import {
    setupOnlineMatch,
    advanceToOffensiveRoll,
    applyDiceValues,
    getPlayerIdFromUrl,
    readCoreState,
    applyCoreStateDirect,
    getModalContainerByHeading,
    readMatchState,
    waitForPhase,
    dispatchDiceThroneCommandWithTimeout,
} from '../helpers/dicethrone';
import { injectMatchState } from '../helpers/state-injection';

const getShadowThiefMainBoardSlot = (page: Page, slotId: string, baseAbilityId: string) => (
    page.locator(
        `[data-testid="player-board-surface"] [data-ability-slot-scope="main-board"][data-ability-slot="${slotId}"][data-base-ability-id="${baseAbilityId}"]`,
    ).first()
);

const getShadowThiefStealSlot = (page: Page) => getShadowThiefMainBoardSlot(page, 'sky', 'steal');
const getShadowThiefDaggerStrikeSlot = (page: Page) => getShadowThiefMainBoardSlot(page, 'fist', 'dagger-strike');

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readString = (value: Record<string, unknown>, key: string): string | null => (
    typeof value[key] === 'string' ? value[key] : null
);

const readNumber = (value: Record<string, unknown>, key: string): number | null => (
    typeof value[key] === 'number' ? value[key] : null
);

const readBoolean = (value: Record<string, unknown>, key: string): boolean | null => (
    typeof value[key] === 'boolean' ? value[key] : null
);

const readOnlineMatchId = async (page: Page): Promise<string> => {
    const matchId = await page.evaluate(() => (
        window.location.pathname.match(/\/match\/([^/?#]+)/)?.[1] ?? null
    ));
    if (!matchId) {
        throw new Error(`无法从页面 URL 读取在线对局 ID: ${page.url()}`);
    }
    return matchId;
};

const readStealRuntimeSnapshot = async (page: Page) => {
    const state = await readMatchState(page) as unknown;
    const root = isRecord(state) ? state : {};
    const core = isRecord(root.core) ? root.core : {};
    const sys = isRecord(root.sys) ? root.sys : {};
    const responseWindow = isRecord(sys.responseWindow) ? sys.responseWindow : {};
    const currentResponse = isRecord(responseWindow.current) ? responseWindow.current : null;
    const interactionRoot = isRecord(sys.interaction) ? sys.interaction : {};
    const currentInteraction = isRecord(interactionRoot.current) ? interactionRoot.current : null;
    const pendingAttack = isRecord(core.pendingAttack) ? core.pendingAttack : null;
    const pendingDamage = isRecord(core.pendingDamage) ? core.pendingDamage : null;
    const currentRollContext = isRecord(core.currentRollContext) ? core.currentRollContext : null;
    const responderQueue = currentResponse && Array.isArray(currentResponse.responderQueue)
        ? currentResponse.responderQueue.map(String)
        : [];
    const currentResponderIndex = currentResponse ? readNumber(currentResponse, 'currentResponderIndex') ?? 0 : 0;
    return {
        phase: readString(sys, 'phase') ?? readString(core, 'phase'),
        flowHalted: readBoolean(sys, 'flowHalted'),
        roll: {
            confirmed: readBoolean(core, 'rollConfirmed'),
            count: readNumber(core, 'rollCount'),
            limit: readNumber(core, 'rollLimit'),
            diceCount: readNumber(core, 'rollDiceCount'),
        },
        responseWindow: currentResponse
            ? {
                windowType: readString(currentResponse, 'windowType'),
                responderQueue,
                currentResponderIndex,
                currentResponderId: responderQueue[currentResponderIndex] ?? null,
                pendingInteractionId: readString(currentResponse, 'pendingInteractionId'),
                requiredInteractionId: readString(currentResponse, 'requiredInteractionId'),
            }
            : null,
        interaction: currentInteraction
            ? {
                id: readString(currentInteraction, 'id'),
                kind: readString(currentInteraction, 'kind'),
                type: readString(currentInteraction, 'type'),
                playerId: readString(currentInteraction, 'playerId'),
                sourceId: readString(currentInteraction, 'sourceId'),
            }
            : null,
        pendingAttack: pendingAttack
            ? {
                attackerId: readString(pendingAttack, 'attackerId'),
                defenderId: readString(pendingAttack, 'defenderId'),
                sourceAbilityId: readString(pendingAttack, 'sourceAbilityId'),
                defenseAbilityId: readString(pendingAttack, 'defenseAbilityId'),
                isDefendable: readBoolean(pendingAttack, 'isDefendable'),
                settlementStage: readString(pendingAttack, 'settlementStage'),
                preDefenseResolved: readBoolean(pendingAttack, 'preDefenseResolved'),
                offensiveRollEndTokenResolved: readBoolean(pendingAttack, 'offensiveRollEndTokenResolved'),
            }
            : null,
        pendingDamage: pendingDamage
            ? {
                responderId: readString(pendingDamage, 'responderId'),
                responseType: readString(pendingDamage, 'responseType'),
                currentDamage: readNumber(pendingDamage, 'currentDamage'),
            }
            : null,
        currentRollContext: currentRollContext
            ? {
                kind: readString(currentRollContext, 'kind'),
                ownerPlayerId: readString(currentRollContext, 'ownerPlayerId'),
            }
            : null,
    };
};

const readStealBoardSnapshot = async (page: Page) => page.evaluate(() => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core ?? {};
    const sys = state?.sys ?? {};
    const activeDice = core.currentRollContext?.dice ?? core.dice ?? [];
    const slots = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-testid="player-board-surface"] [data-ability-slot]',
    )).map((node) => ({
        slot: node.getAttribute('data-ability-slot'),
        scope: node.getAttribute('data-ability-slot-scope'),
        base: node.getAttribute('data-base-ability-id'),
        available: node.getAttribute('data-available-ability-id'),
        resolved: node.getAttribute('data-resolved-ability-id'),
        selected: node.getAttribute('data-selected-ability-id'),
        canClick: node.getAttribute('data-can-click'),
        shouldHighlight: node.getAttribute('data-should-highlight'),
    }));

    return {
        url: window.location.href,
        phase: sys.phase ?? core.phase,
        activePlayerId: core.activePlayerId,
        rollConfirmed: core.rollConfirmed,
        currentRollContext: core.currentRollContext
            ? {
                kind: core.currentRollContext.kind,
                ownerPlayerId: core.currentRollContext.ownerPlayerId,
                dice: Array.isArray(core.currentRollContext.dice)
                    ? core.currentRollContext.dice.map((die: Record<string, unknown>) => ({
                        value: die.value,
                        symbol: die.symbol,
                        symbols: die.symbols,
                    }))
                    : null,
            }
            : null,
        dice: Array.isArray(activeDice)
            ? activeDice.map((die: Record<string, unknown>) => ({
                value: die.value,
                symbol: die.symbol,
                symbols: die.symbols,
            }))
            : null,
        slots,
    };
});

const expectStealSlotAvailable = async (
    page: Page,
    expectedAbilityId: string,
    label: string,
) => {
    const slot = getShadowThiefStealSlot(page);
    try {
        await expect(slot, `${label}: sky 槽必须仍是扒窃真实槽位`).toBeVisible({ timeout: 5000 });
        await expect(slot, `${label}: 当前骰面必须解析为 ${expectedAbilityId}`).toHaveAttribute('data-available-ability-id', expectedAbilityId, { timeout: 5000 });
        await expect(slot, label).toHaveAttribute('data-should-highlight', 'true', { timeout: 5000 });
    } catch (error) {
        const boardSnapshot = await readStealBoardSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const runtimeSnapshot = await readStealRuntimeSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${label}: ${reason}; board=${JSON.stringify(boardSnapshot)}; runtime=${JSON.stringify(runtimeSnapshot)}`);
    }
    return slot;
};

const expectDaggerStrikeSlotAvailable = async (
    page: Page,
    expectedAbilityId: string,
    label: string,
) => {
    const slot = getShadowThiefDaggerStrikeSlot(page);
    try {
        await expect(slot, `${label}: fist 槽必须仍是匕首打击真实槽位`).toBeVisible({ timeout: 5000 });
        await expect(slot, `${label}: 当前骰面必须解析为 ${expectedAbilityId}`).toHaveAttribute('data-available-ability-id', expectedAbilityId, { timeout: 5000 });
        await expect(slot, label).toHaveAttribute('data-can-click', 'true', { timeout: 5000 });
        await expect(slot, label).toHaveAttribute('data-should-highlight', 'true', { timeout: 5000 });
    } catch (error) {
        const boardSnapshot = await readStealBoardSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const runtimeSnapshot = await readStealRuntimeSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${label}: ${reason}; board=${JSON.stringify(boardSnapshot)}; runtime=${JSON.stringify(runtimeSnapshot)}`);
    }
    return slot;
};

const getFirstClickableMainBoardAbilitySlot = (page: Page) => (
    page.locator(
        '[data-testid="player-board-surface"] [data-ability-slot-scope="main-board"][data-ability-slot][data-can-click="true"][data-should-highlight="true"]',
    )
);

const clickFirstClickableMainBoardAbilitySlot = async (page: Page, label: string) => {
    const slots = getFirstClickableMainBoardAbilitySlot(page);
    try {
        await expect(slots.first(), label).toBeVisible({ timeout: 8000 });
    } catch (error) {
        const boardSnapshot = await readStealBoardSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const runtimeSnapshot = await readStealRuntimeSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${label}: 找不到真实可点击的主板技能槽; ${reason}; board=${JSON.stringify(boardSnapshot)}; runtime=${JSON.stringify(runtimeSnapshot)}`);
    }
    await slots.first().click();
    return slots.first();
};

const clickResolveAttackButton = async (page: Page, label: string) => {
    const resolveAttackButton = page.getByRole('button', { name: /Resolve Attack|结算攻击/i }).first();
    try {
        await expect(resolveAttackButton, `${label}: 选择攻击后必须出现结算攻击按钮`).toBeVisible({ timeout: 10000 });
        await expect(resolveAttackButton, `${label}: 结算攻击按钮必须可点击`).toBeEnabled({ timeout: 5000 });
        await resolveAttackButton.click({ timeout: 5000 });
    } catch (error) {
        const boardSnapshot = await readStealBoardSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const runtimeSnapshot = await readStealRuntimeSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const controls = await readVisibleControlSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${label}: 无法通过真实页面点击结算攻击; ${reason}; controls=${JSON.stringify(controls)}; board=${JSON.stringify(boardSnapshot)}; runtime=${JSON.stringify(runtimeSnapshot)}`);
    }
};

const resetToAttackerOffensiveRoll = async (page: Page, attackerId: string) => {
    const matchId = await readOnlineMatchId(page);
    const state = await readMatchState(page) as Record<string, unknown>;
    const core = isRecord(state.core) ? state.core : {};
    const sys = isRecord(state.sys) ? state.sys : {};
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : isRecord(core.players)
            ? Object.keys(core.players)
            : [attackerId];
    const currentPlayerIndex = Math.max(0, turnOrder.indexOf(attackerId));
    const interaction = isRecord(sys.interaction) ? sys.interaction : {};
    const responseWindow = isRecord(sys.responseWindow) ? sys.responseWindow : {};

    await injectMatchState(matchId, {
        ...state,
        core: {
            ...core,
            activePlayerId: attackerId,
            activatingAbilityId: undefined,
            currentChoiceContext: undefined,
            currentChoiceSourceAbilityId: undefined,
            currentRollContext: undefined,
            phase: 'offensiveRoll',
            pendingAttack: null,
            pendingBonusDiceSettlement: undefined,
            pendingDamage: undefined,
            rollConfirmed: false,
            rollCount: 0,
        },
        sys: {
            ...sys,
            currentPlayerIndex,
            flowHalted: false,
            interaction: {
                ...interaction,
                current: undefined,
                isBlocked: false,
                queue: [],
            },
            phase: 'offensiveRoll',
            responseWindow: {
                ...responseWindow,
                current: undefined,
            },
            turnOrder,
        },
    } as never, page);
    await waitForPhaseWithStealSnapshot(page, 'offensiveRoll', 5000, '第二段扒窃前应回到攻击者进攻投骰阶段');
};

const waitForPhaseWithStealSnapshot = async (
    page: Page,
    phase: string,
    timeout: number,
    label: string,
) => {
    try {
        await waitForPhase(page, phase, timeout);
    } catch (error) {
        const snapshot = await readStealRuntimeSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${label}: ${reason}; runtime=${JSON.stringify(snapshot)}`);
    }
};

const waitForAttackCloseoutWithStealSnapshot = async (
    page: Page,
    label: string,
    timeout = 15000,
) => {
    try {
        await expect.poll(async () => {
            const snapshot = await readStealRuntimeSnapshot(page);
            return Boolean(
                !snapshot.flowHalted
                && !snapshot.responseWindow
                && !snapshot.interaction
                && !snapshot.pendingAttack
                && !snapshot.pendingDamage
            );
        }, {
            message: label,
            timeout,
        }).toBe(true);
    } catch (error) {
        const snapshot = await readStealRuntimeSnapshot(page).catch((snapshotError) => ({
            snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        }));
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${label}: ${reason}; runtime=${JSON.stringify(snapshot)}`);
    }
};

const tryClickSharedResponsePass = async (page: Page, timeout = 700): Promise<boolean> => {
    await dismissAttackShowcaseIfVisible(page);
    const passButton = page.getByTestId('dicethrone-response-pass-button')
        .or(page.getByRole('button', { name: /^(Pass|跳过|让过|确认)$/i }))
        .first();
    const visible = await passButton.isVisible({ timeout }).catch(() => false);
    if (!visible) {
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

const passResponsesUntilIdle = async (
    pages: Page[],
    statePage: Page,
    label: string,
    maxAttempts = 8,
) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        for (const page of pages) {
            await dismissAttackShowcaseIfVisible(page);
        }

        const snapshot = await readStealRuntimeSnapshot(statePage);
        if (!snapshot.responseWindow) {
            if (!snapshot.pendingDamage && snapshot.interaction?.kind !== 'dt:token-response') {
                return;
            }
            if (snapshot.interaction?.kind === 'dt:token-response' && snapshot.interaction.playerId) {
                let skippedByUi = false;
                for (const page of pages) {
                    skippedByUi = (await tryClickSharedResponsePass(page)) || skippedByUi;
                }
                if (skippedByUi) {
                    await statePage.waitForTimeout(350);
                    continue;
                }

                const responderId = snapshot.interaction.playerId;
                const responderPage = pages.find(page => getPlayerIdFromUrl(page) === responderId) ?? statePage;
                const result = await dispatchDiceThroneCommandWithTimeout(responderPage, {
                    type: 'SKIP_TOKEN_RESPONSE',
                    playerId: responderId,
                    payload: {},
                }, 3000);
                if (result !== 'ok') {
                    const controls = await readVisibleControlSnapshot(responderPage).catch((snapshotError) => ({
                        snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
                    }));
                    throw new Error(`${label}: Token/状态伤害响应跳过失败：${result}; attempt=${attempt}; controls=${JSON.stringify(controls)}; runtime=${JSON.stringify(snapshot)}`);
                }
                await responderPage.waitForTimeout(350);
                continue;
            }
            await statePage.waitForTimeout(350);
            continue;
        }

        if (snapshot.responseWindow.pendingInteractionId || snapshot.responseWindow.requiredInteractionId) {
            const controls = await readVisibleControlSnapshot(statePage).catch((snapshotError) => ({
                snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
            }));
            throw new Error(`${label}: 响应窗口仍被交互锁定，不能直接让过; attempt=${attempt}; controls=${JSON.stringify(controls)}; runtime=${JSON.stringify(snapshot)}`);
        }

        let passedByUi = false;
        for (const page of pages) {
            passedByUi = (await tryClickSharedResponsePass(page)) || passedByUi;
        }
        if (passedByUi) {
            await statePage.waitForTimeout(350);
            continue;
        }

        const responderId = snapshot.responseWindow.currentResponderId;
        if (!responderId) {
            throw new Error(`${label}: 响应窗口缺少当前响应者，不能让过; attempt=${attempt}; runtime=${JSON.stringify(snapshot)}`);
        }

        const responderPage = pages.find(page => getPlayerIdFromUrl(page) === responderId) ?? statePage;
        const result = await dispatchDiceThroneCommandWithTimeout(responderPage, {
            type: 'RESPONSE_PASS',
            playerId: responderId,
            payload: { forPlayerId: responderId },
        }, 3000);
        if (result !== 'ok') {
            const controls = await readVisibleControlSnapshot(responderPage).catch((snapshotError) => ({
                snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
            }));
            throw new Error(`${label}: 响应者 ${responderId} 让过失败：${result}; attempt=${attempt}; controls=${JSON.stringify(controls)}; runtime=${JSON.stringify(snapshot)}`);
        }

        await responderPage.waitForTimeout(350);
        const afterPass = await readStealRuntimeSnapshot(statePage);
        if (!afterPass.responseWindow && !afterPass.pendingDamage) {
            return;
        }
    }

    const snapshot = await readStealRuntimeSnapshot(statePage);
    const controls = await readVisibleControlSnapshot(statePage).catch((snapshotError) => ({
        snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
    }));
    throw new Error(`${label}: 响应窗口未关闭; controls=${JSON.stringify(controls)}; runtime=${JSON.stringify(snapshot)}`);
};

const dismissAttackShowcaseIfVisible = async (page: Page) => {
    const continueButton = page.getByRole('button', { name: /^(开始防御|继续|Start Defense|Continue|Defend|防御)$/i }).first();
    if (await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueButton.click();
        await page.waitForTimeout(300);
    }
};

const readVisibleControlSnapshot = async (page: Page) => page.evaluate(() => {
    const ids = ['dice-roll-button', 'dice-confirm-button', 'advance-phase-button'];
    return ids.map((id) => Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-id="${id}"]`)).map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
            id,
            text: node.innerText,
            disabled: node instanceof HTMLButtonElement ? node.disabled : node.getAttribute('aria-disabled'),
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
    })).flat();
});

const resolveDefenseRollIfStarted = async (
    defenderPage: Page,
    attackerPage: Page,
    label: string,
) => {
    const firstSnapshot = await readStealRuntimeSnapshot(attackerPage);
    if (firstSnapshot.phase !== 'defensiveRoll') {
        return false;
    }

    await dismissAttackShowcaseIfVisible(defenderPage);
    await dismissAttackShowcaseIfVisible(attackerPage);

    const defenseSlot = getFirstClickableMainBoardAbilitySlot(defenderPage);
    if (await defenseSlot.first().isVisible({ timeout: 2500 }).catch(() => false)) {
        await defenseSlot.first().click();
        await defenderPage.waitForTimeout(300);
    }

    const rollButton = defenderPage.locator('[data-tutorial-id="dice-roll-button"]:visible').first();
    if (await rollButton.isEnabled({ timeout: 8000 }).catch(() => false)) {
        await rollButton.click();
        await expect.poll(async () => (await readStealRuntimeSnapshot(attackerPage)).roll.count, {
            message: `${label}: 防御方点击投骰后，权威状态必须记录防御投骰次数`,
            timeout: 5000,
        }).toBe(1);
    }

    await dismissAttackShowcaseIfVisible(defenderPage);
    const afterRollSnapshot = await readStealRuntimeSnapshot(attackerPage);
    const confirmButton = defenderPage.locator('[data-tutorial-id="dice-confirm-button"]:visible').first();
    if (afterRollSnapshot.phase === 'defensiveRoll' && afterRollSnapshot.roll.count && !afterRollSnapshot.roll.confirmed) {
        try {
            await expect(confirmButton, `${label}: 防御骰已投出后必须能点击可见确认按钮`).toBeEnabled({ timeout: 10000 });
        } catch (error) {
            const controls = await readVisibleControlSnapshot(defenderPage).catch((snapshotError) => ({
                snapshotError: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
            }));
            const runtime = await readStealRuntimeSnapshot(attackerPage);
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`${label}: 防御确认按钮不可用; ${reason}; controls=${JSON.stringify(controls)}; runtime=${JSON.stringify(runtime)}`);
        }
        await confirmButton.click();
        await expect.poll(async () => (await readStealRuntimeSnapshot(attackerPage)).roll.confirmed, {
            message: `${label}: 点击防御确认后权威状态必须记录已确认`,
            timeout: 5000,
        }).toBe(true);
        await passResponsesUntilIdle([attackerPage, defenderPage], defenderPage, `${label}: 防御骰确认后的响应窗口`);
    }

    const advanceButton = defenderPage.locator('[data-tutorial-id="advance-phase-button"]:visible').first();
    if (await advanceButton.isEnabled({ timeout: 10000 }).catch(() => false)) {
        await advanceButton.click();
        await passResponsesUntilIdle([attackerPage, defenderPage], defenderPage, `${label}: 结束防御后的响应窗口`);
        return true;
    }

    const snapshot = await readStealRuntimeSnapshot(attackerPage);
    if (snapshot.phase === 'main2') {
        return true;
    }
    throw new Error(`${label}: 防御阶段未能通过真实页面按钮收口; runtime=${JSON.stringify(snapshot)}`);
};

const confirmEndOffensiveRollIfShown = async (page: Page) => {
    const confirmDialog = getModalContainerByHeading(page, /End offensive roll\?|确认结束攻击掷骰？/i);
    if (await confirmDialog.isVisible({ timeout: 4000 }).catch(() => false)) {
        await confirmDialog.getByRole('button', { name: /^(Confirm|确认|确定结束)$/i }).click();
    }
};

test.describe('DiceThrone Shadow Thief E2E', () => {

    test('Online match: Shadow Thief Steal CP ability (with and without Shadow)', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext } = match!;

        try {
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!hostIsActive) test.skip(true, '非预期起始玩家，无法构造偷窃场景');

            const attackerPage = hostPage;
            const defenderId = getPlayerIdFromUrl(guestPage, '1');
            const attackerId = getPlayerIdFromUrl(hostPage, '0');

            // 场景1：无 Shadow，只从银行获得 CP
            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);

            // 设置骰子为 2 个 Bag (value 3, 4)，无 Shadow
            await applyDiceValues(attackerPage, [3, 4, 1, 2, 5]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, '无暗影扒窃：确认进攻骰后的响应窗口');

            // 读取初始 CP
            const coreStateBefore = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersBefore = coreStateBefore?.players as Record<string, Record<string, unknown>> | undefined;
            const attackerBefore = playersBefore?.[attackerId];
            const defenderBefore = playersBefore?.[defenderId];
            const attackerCpBefore = (attackerBefore?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
            const defenderCpBefore = (defenderBefore?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

            // 选择扒窃技能（steal-2）。当前玩家面板技能名来自底图，不是 DOM 文本，必须用热点数据属性定位。
            const stealAbility = await expectStealSlotAvailable(attackerPage, 'steal-2', '2 个钱袋骰面必须让扒窃槽位可用');
            await stealAbility.click();
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, '无暗影扒窃：选定技能后的响应窗口');
            
            await clickResolveAttackButton(attackerPage, '无暗影扒窃');
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, '无暗影扒窃：攻击结算后的响应窗口');

            // 等待技能执行完成
            await attackerPage.waitForTimeout(1000);

            // 验证：攻击者获得 2 CP，防御者 CP 不变（无 Shadow）
            const coreStateAfter1 = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersAfter1 = coreStateAfter1?.players as Record<string, Record<string, unknown>> | undefined;
            const attackerAfter1 = playersAfter1?.[attackerId];
            const defenderAfter1 = playersAfter1?.[defenderId];
            const attackerCpAfter1 = (attackerAfter1?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
            const defenderCpAfter1 = (defenderAfter1?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

            expect(attackerCpAfter1).toBe(attackerCpBefore + 2); // 从银行获得 2 CP
            expect(defenderCpAfter1).toBe(defenderCpBefore); // 对手 CP 不变

            await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-steal-no-shadow.png'), fullPage: false });

            // 等待第一段扒窃回到主要阶段（2），证明本次攻击已正常收口。
            await waitForPhaseWithStealSnapshot(attackerPage, 'main2', 15000, '无暗影扒窃结算后应回到主要阶段（2）');

            // 第二段只验证“有 Shadow 骰面时从对手偷 CP”的同一能力分支。
            // 不依赖对手 AI 替我们跑完整轮转，避免把 AI 自动推进噪声混进扒窃能力验收。
            await resetToAttackerOffensiveRoll(attackerPage, attackerId);

            // 场景2：有 Shadow，从对手偷取 CP
            const rollButton2 = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton2).toBeEnabled({ timeout: 5000 });
            await rollButton2.click();
            await attackerPage.waitForTimeout(300);

            // 设置骰子为 2 个 Bag + 1 个 Shadow (value 3, 4, 6)
            await applyDiceValues(attackerPage, [3, 4, 6, 1, 2]);

            const confirmButton2 = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton2).toBeEnabled({ timeout: 5000 });
            await confirmButton2.click();
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, '有暗影扒窃：确认进攻骰后的响应窗口');

            // 读取第二次攻击前的 CP
            const coreStateBefore2 = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersBefore2 = coreStateBefore2?.players as Record<string, Record<string, unknown>> | undefined;
            const attackerBefore2 = playersBefore2?.[attackerId];
            const defenderBefore2 = playersBefore2?.[defenderId];
            const attackerCpBefore2 = (attackerBefore2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
            const defenderCpBefore2 = (defenderBefore2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

            // 选择扒窃技能
            const stealAbility2 = await expectStealSlotAvailable(attackerPage, 'steal-2', '2 个钱袋 + 暗影骰面必须让扒窃槽位可用');
            await stealAbility2.click();
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, '有暗影扒窃：选定技能后的响应窗口');
            
            await clickResolveAttackButton(attackerPage, '有暗影扒窃');
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, '有暗影扒窃：攻击结算后的响应窗口');

            // 等待技能执行完成
            await attackerPage.waitForTimeout(1000);

            // 验证：攻击者获得 2 CP；有 Shadow 时，一级扒窃最多从对手偷 1 CP，其余从银行获得
            const coreStateAfter2 = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersAfter2 = coreStateAfter2?.players as Record<string, Record<string, unknown>> | undefined;
            const attackerAfter2 = playersAfter2?.[attackerId];
            const defenderAfter2 = playersAfter2?.[defenderId];
            const attackerCpAfter2 = (attackerAfter2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
            const defenderCpAfter2 = (defenderAfter2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

            expect(attackerCpAfter2).toBe(attackerCpBefore2 + 2); // 获得 2 CP
            expect(defenderCpAfter2).toBe(Math.max(0, defenderCpBefore2 - 1)); // 一级扒窃对手最多失去 1 CP

            await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-steal-with-shadow.png'), fullPage: false });

        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Online match: Shadow Thief character selection and basic attack flow', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'monk');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext } = match!;

        try {
            await hostPage.waitForTimeout(2000);
            const hostHandArea = hostPage.getByTestId('hand-area');
            await expect(hostHandArea).toBeVisible();
            await expect(hostHandArea.locator('[data-card-id]')).toHaveCount(4, { timeout: 15000 });

            let attackerPage: Page;
            let defenderPage: Page;
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            if (await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false)) {
                attackerPage = hostPage; defenderPage = guestPage;
            } else {
                attackerPage = guestPage; defenderPage = hostPage;
            }

            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);
            await applyDiceValues(attackerPage, [1, 1, 1, 1, 1]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await passResponsesUntilIdle([attackerPage, defenderPage], attackerPage, '基础攻击流程：确认进攻骰后的响应窗口');

            const daggerStrike = await expectDaggerStrikeSlotAvailable(
                attackerPage,
                'dagger-strike-5',
                '5 个匕首骰面必须让匕首打击可用',
            );
            await daggerStrike.click();
            await clickResolveAttackButton(attackerPage, '基础攻击流程');

            for (let i = 0; i < 5; i++) {
                let choiceModal: ReturnType<typeof attackerPage.locator> | null = null;
                try { choiceModal = await getModalContainerByHeading(attackerPage, /Ability Resolution Choice|技能结算选择/i, 1500); } catch { choiceModal = null; }
                if (!choiceModal) break;
                const btn = choiceModal.getByRole('button').filter({ hasText: /\S+/ }).first();
                if (await btn.isVisible({ timeout: 500 }).catch(() => false)) { await btn.click(); await attackerPage.waitForTimeout(500); }
            }

            await resolveDefenseRollIfStarted(defenderPage, attackerPage, '基础攻击流程');

            await waitForPhaseWithStealSnapshot(attackerPage, 'main2', 15000, '基础攻击流程应回到主要阶段（2）');
            await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-attack-flow.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });


    test('Online match: Shadow Thief Sneak prevents damage', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'shadow_thief');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext } = match!;

        try {
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!hostIsActive) test.skip(true, '非预期起始玩家，无法构造 Sneak 防御场景');

            const attackerPage = hostPage;
            const defenderId = getPlayerIdFromUrl(guestPage, '1');

            const coreState = await readCoreState(attackerPage) as Record<string, unknown>;
            const players = coreState?.players as Record<string, Record<string, unknown>> | undefined;
            const defenderState = players?.[defenderId];
            if (!defenderState) test.skip(true, '无法读取防御方状态');

            const resources = defenderState!.resources as Record<string, number> | undefined;
            const hpBefore = resources?.[RESOURCE_IDS.HP] ?? 0;
            const nextCoreState = {
                ...coreState,
                players: {
                    ...players,
                    [defenderId]: {
                        ...defenderState,
                        tokens: {
                            ...((defenderState!.tokens as Record<string, unknown>) ?? {}),
                            [TOKEN_IDS.SNEAK]: 1,
                        },
                    },
                },
            };

            await applyCoreStateDirect(attackerPage, nextCoreState);
            await attackerPage.waitForTimeout(300);

            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);
            await applyDiceValues(attackerPage, [6, 6, 6, 6, 1]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await passResponsesUntilIdle([attackerPage, guestPage], attackerPage, 'Sneak 防御场景：确认进攻骰后的响应窗口');

            await clickFirstClickableMainBoardAbilitySlot(attackerPage, 'Sneak 防御场景必须先选中一个真实可点击的攻击技能');

            await clickResolveAttackButton(attackerPage, 'Sneak 防御场景');
            await resolveDefenseRollIfStarted(guestPage, attackerPage, 'Sneak 防御场景');

            await waitForAttackCloseoutWithStealSnapshot(attackerPage, 'Sneak 防御场景应完成攻击收口');

            const coreAfter = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersAfter = coreAfter?.players as Record<string, Record<string, unknown>> | undefined;
            const defenderAfter = playersAfter?.[defenderId];
            const resourcesAfter = defenderAfter?.resources as Record<string, number> | undefined;
            expect(resourcesAfter?.[RESOURCE_IDS.HP] ?? 0).toBe(hpBefore);
            const tokensAfter = defenderAfter?.tokens as Record<string, number> | undefined;
            expect(tokensAfter?.[TOKEN_IDS.SNEAK] ?? 0).toBe(1);

            await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-sneak-prevent.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Online match: Shadow Thief defense ability selection (dual defense)', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'shadow_thief');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext } = match!;

        try {
            let attackerPage: Page;
            let defenderPage: Page;
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            if (await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false)) {
                attackerPage = hostPage; defenderPage = guestPage;
            } else {
                attackerPage = guestPage; defenderPage = hostPage;
            }

            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);
            await applyDiceValues(attackerPage, [1, 1, 1, 4, 5]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await passResponsesUntilIdle([attackerPage, defenderPage], attackerPage, '双防御技能场景：确认进攻骰后的响应窗口');

            const attackSlot = getFirstClickableMainBoardAbilitySlot(attackerPage);
            if (await attackSlot.first().isVisible({ timeout: 5000 }).catch(() => false)) {
                await attackSlot.first().click();
                await clickResolveAttackButton(attackerPage, '双防御技能场景');
            } else {
                const advanceButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
                await advanceButton.click();
                await confirmEndOffensiveRollIfShown(attackerPage);
            }

            for (let i = 0; i < 5; i++) {
                let choiceModal: ReturnType<typeof attackerPage.locator> | null = null;
                try { choiceModal = await getModalContainerByHeading(attackerPage, /Ability Resolution Choice|技能结算选择/i, 1500); } catch { choiceModal = null; }
                if (!choiceModal) break;
                const btn = choiceModal.getByRole('button').filter({ hasText: /\S+/ }).first();
                if (await btn.isVisible({ timeout: 500 }).catch(() => false)) { await btn.click(); await attackerPage.waitForTimeout(500); }
            }

            if ((await readStealRuntimeSnapshot(attackerPage)).phase === 'defensiveRoll') {
                await dismissAttackShowcaseIfVisible(defenderPage);
                await defenderPage.screenshot({ path: testInfo.outputPath('shadow-thief-defense-selection.png'), fullPage: false });
            }
            await resolveDefenseRollIfStarted(defenderPage, attackerPage, '双防御技能场景');

            await waitForAttackCloseoutWithStealSnapshot(attackerPage, '双防御技能场景应完成攻击收口');
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
