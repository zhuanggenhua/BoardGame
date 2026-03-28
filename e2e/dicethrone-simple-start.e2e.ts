/**
 * DiceThrone 简单开局 E2E 测试
 * 目标：覆盖双人与四人房间的创建、占座、加入与开局主链路。
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
import { waitForTestHarness } from './helpers/common';
import { getMatchState, injectMatchState } from './helpers/state-injection';
import { COMMON_CARDS } from '../src/games/dicethrone/domain/commonCards';
import { PALADIN_DICE_FACE_IDS, TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import { getAvailableAbilityIds } from '../src/games/dicethrone/domain/rules';
import { registerDiceThroneConditions } from '../src/games/dicethrone/conditions';
import { GUNSLINGER_CARDS } from '../src/games/dicethrone/heroes/gunslinger/cards';
import { VENGEANCE_2 } from '../src/games/dicethrone/heroes/paladin/abilities';
import { PALADIN_CARDS } from '../src/games/dicethrone/heroes/paladin/cards';
import { SAMURAI_CARDS } from '../src/games/dicethrone/heroes/samurai/cards';
import {
    cleanupDTMatch,
    readyAndStartGame,
    readyMultiplePlayersAndStartGame,
    selectCharacter,
    setupDTOnlineMatch,
    setupDTOnlineMatchWithPlayers,
    waitForGameBoard,
} from './helpers/dicethrone';
import { getGameServerBaseURL } from './helpers/common';

registerDiceThroneConditions();

const MONK_FIST_ATTACK_ID = 'fist-technique-5';
const RESPONSE_WINDOW_CARD_ID = 'card-surprise';
const RESPONSE_WINDOW_CARD = COMMON_CARDS.find((card) => card.id === RESPONSE_WINDOW_CARD_ID);
const REMOVE_SINGLE_STATUS_CARD_ID = 'card-get-away';
const REMOVE_SINGLE_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_SINGLE_STATUS_CARD_ID);
const REMOVE_ALL_STATUS_CARD_ID = 'card-what-status';
const REMOVE_ALL_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_ALL_STATUS_CARD_ID);
const TRANSFER_STATUS_CARD_ID = 'card-transfer-status';
const TRANSFER_STATUS_CARD = COMMON_CARDS.find((card) => card.id === TRANSFER_STATUS_CARD_ID);
const THE_LAW_CARD_ID = 'card-the-law';
const THE_LAW_CARD = GUNSLINGER_CARDS.find((card) => card.id === THE_LAW_CARD_ID);
const PISTOL_WHIP_CARD_ID = 'card-pistol-whip';
const PISTOL_WHIP_CARD = GUNSLINGER_CARDS.find((card) => card.id === PISTOL_WHIP_CARD_ID);
const WANTED_CARD_ID = 'card-wanted';
const WANTED_CARD = GUNSLINGER_CARDS.find((card) => card.id === WANTED_CARD_ID);
const HIGH_NOON_CARD_ID = 'card-high-noon';
const HIGH_NOON_CARD = GUNSLINGER_CARDS.find((card) => card.id === HIGH_NOON_CARD_ID);
const CONSECRATE_CARD_ID = 'card-consecrate';
const CONSECRATE_CARD = PALADIN_CARDS.find((card) => card.id === CONSECRATE_CARD_ID);
const PALADIN_VENGEANCE_2_CARD_ID = 'card-vengeance-2';
const PALADIN_VENGEANCE_2_CARD = PALADIN_CARDS.find((card) => card.id === PALADIN_VENGEANCE_2_CARD_ID);
const SAMURAI_ASHAMED_CARD_ID = 'card-you-should-be-ashamed';
const SAMURAI_ASHAMED_CARD = SAMURAI_CARDS.find((card) => card.id === SAMURAI_ASHAMED_CARD_ID);

const saveEvidenceScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
};

const waitForHarnessPages = async (pages: Page[]) => {
    for (const page of pages) {
        await waitForTestHarness(page, 15000);
    }
};

const readHarnessState = async <T = any>(page: Page): Promise<T> => page.evaluate(() => {
    return (window as any).__BG_TEST_HARNESS__!.state.get();
});

const applyOnlineMatchState = async (
    matchId: string,
    page: Page,
    updater: (state: any) => any,
) => {
    const currentState = await getMatchState(matchId, page);
    const nextState = normalizeInjectedMatchState(matchId, updater(currentState));
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(800);
};

const normalizeInjectedMatchState = (matchId: string, state: any) => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.core?.turnOrder)
        ? [...next.core.turnOrder]
        : Object.keys(next.core?.players ?? {});
    const currentPlayerIndex = typeof next.sys?.currentPlayerIndex === 'number'
        ? next.sys.currentPlayerIndex
        : typeof next.core?.currentPlayerIndex === 'number'
            ? next.core.currentPlayerIndex
            : Math.max(0, fallbackTurnOrder.indexOf(next.core?.activePlayerId ?? '0'));

    next.sys = {
        ...next.sys,
        matchId,
        turnOrder: Array.isArray(next.sys?.turnOrder) ? next.sys.turnOrder : fallbackTurnOrder,
        currentPlayerIndex,
    };
    next.core = {
        ...next.core,
        phase: typeof next.core?.phase === 'string' ? next.core.phase : next.sys.phase,
    };

    return next;
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        (window as any).__BG_TEST_HARNESS__!.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
};

const waitForPhase = async (page: Page, phase: string, timeout = 15000) => {
    await page.waitForFunction((expectedPhase) => {
        return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.phase === expectedPhase;
    }, phase, { timeout });
};

const waitForPendingDefender = async (page: Page, defenderId: string, timeout = 15000) => {
    await page.waitForFunction((expectedDefenderId) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingAttack?.defenderId === expectedDefenderId;
    }, defenderId, { timeout });
};

const buildFourPlayerNoResponseState = (state: any) => {
    const next = structuredClone(state);
    for (const player of Object.values<any>(next.core.players ?? {})) {
        player.hand = [];
    }
    next.core.pendingBonusDiceSettlement = undefined;
    next.core.pendingDamage = null;
    next.sys.responseWindow = {
        ...next.sys.responseWindow,
        current: undefined,
    };
    next.sys.interaction = {
        ...next.sys.interaction,
        current: undefined,
        queue: [],
    };
    next.sys.gameover = undefined;
    return next;
};

const buildTargetingRollState = (state: any, targetingValue: number) => {
    const next = buildFourPlayerNoResponseState(state);
    next.core.activePlayerId = '0';
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 1;
    next.core.rollConfirmed = true;
    next.core.selectedAbilityId = MONK_FIST_ATTACK_ID;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: undefined,
        targetingSelectionPending: false,
        targetingSelectionResolved: false,
        isDefendable: true,
        damage: 6,
        sourceAbilityId: MONK_FIST_ATTACK_ID,
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.sys.phase = 'targetingRoll';
    next.sys.flowHalted = false;
    next.core.dice = next.core.dice.map((die: any, index: number) => ({
        ...die,
        value: index === 0 ? targetingValue : die.value ?? 1,
        isKept: false,
    }));
    return next;
};

const _buildResponseWindowTriggerState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const enemyResponseCard = RESPONSE_WINDOW_CARD;
    const allyResponseCard = RESPONSE_WINDOW_CARD;
    if (!RESPONSE_WINDOW_CARD) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造四人响应窗口场景`);
    }

    if (!enemyResponseCard || !allyResponseCard) {
        throw new Error('未找到可用于 afterRollConfirmed 的响应卡，无法构造 4 人响应窗口场景');
    }

    next.core.players['1'].hand = [structuredClone(RESPONSE_WINDOW_CARD)];
    next.core.players['2'].hand = [structuredClone(RESPONSE_WINDOW_CARD)];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 10);
    next.core.players['2'].resources.cp = Math.max(next.core.players['2'].resources.cp ?? 0, 10);
    next.core.activePlayerId = '0';
    next.core.rollCount = 1;
    next.core.rollLimit = 3;
    next.core.rollDiceCount = 5;
    next.core.rollConfirmed = false;
    next.core.pendingAttack = null;
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.dice = (next.core.dice.length > 0
        ? next.core.dice
        : Array.from({ length: 5 }, (_, index) => ({
            id: index,
            definitionId: 'monk-dice',
            value: 1,
            symbol: 'fist',
            symbols: ['fist'],
            isKept: false,
        }))).map((die: any) => ({
        ...die,
        value: 1,
        isKept: false,
    }));
    return next;
};

const buildDefensiveRollResolutionState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    next.sys.phase = 'defensiveRoll';
    next.sys.flowHalted = false;
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.rollConfirmed = true;
    next.core.dice = next.core.dice.map((die: any) => ({
        ...die,
        value: 1,
        isKept: false,
    }));
    return next;
};

const buildDefensiveResponseWindowTriggerState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const attackerResponseCard = RESPONSE_WINDOW_CARD;
    const defenderTeammateResponseCard = RESPONSE_WINDOW_CARD;

    if (!attackerResponseCard || !defenderTeammateResponseCard) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造防守响应窗口场景`);
    }

    next.core.players['0'].hand = [structuredClone(attackerResponseCard)];
    next.core.players['2'].hand = [structuredClone(defenderTeammateResponseCard)];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 10);
    next.core.players['2'].resources.cp = Math.max(next.core.players['2'].resources.cp ?? 0, 10);
    next.core.activePlayerId = '0';
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.rollConfirmed = false;
    next.core.selectedAbilityId = MONK_FIST_ATTACK_ID;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '3',
        targetingSelectionPending: false,
        targetingSelectionResolved: true,
        isDefendable: true,
        damage: 6,
        sourceAbilityId: MONK_FIST_ATTACK_ID,
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.sys.phase = 'defensiveRoll';
    next.sys.flowHalted = false;
    next.core.dice = Array.from({ length: 5 }, (_, index) => ({
        id: index,
        definitionId: 'paladin-dice',
        value: 1,
        symbol: 'sword',
        symbols: ['sword'],
        isKept: false,
    }));
    return next;
};

const buildTwoPlayerTransferTokenState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const transferCard = TRANSFER_STATUS_CARD;
    if (!transferCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 2 人转移 token 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-2p-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    return next;
};

const buildFourPlayerTransferTokenState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const transferCard = TRANSFER_STATUS_CARD;
    if (!transferCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 4 人转移 token 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerTheLawState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const theLawCard = THE_LAW_CARD;
    if (!theLawCard) {
        throw new Error(`未找到稳定枪手卡 ${THE_LAW_CARD_ID}，无法构造 4 人 The Law 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(theLawCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 2);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.EVASIVE]: 0,
    };

    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            [TOKEN_IDS.BOUNTY]: 0,
        };
        next.core.players[pid].statusEffects = {
            ...(next.core.players[pid].statusEffects ?? {}),
            knockdown: 0,
        };
    }

    return next;
};

const buildFourPlayerWantedState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const wantedCard = WANTED_CARD;
    if (!wantedCard) {
        throw new Error(`未找到稳定枪手卡 ${WANTED_CARD_ID}，无法构造 4 人 Wanted 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(wantedCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };

    return next;
};

const buildFourPlayerPistolWhipState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const pistolWhipCard = PISTOL_WHIP_CARD;
    if (!pistolWhipCard) {
        throw new Error(`未找到稳定枪手卡 ${PISTOL_WHIP_CARD_ID}，无法构造 4 人 Pistol Whip 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(pistolWhipCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.EVASIVE]: 0,
    };

    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            protect: 0,
        };
        next.core.players[pid].statusEffects = {
            ...(next.core.players[pid].statusEffects ?? {}),
            knockdown: 0,
        };
    }

    return next;
};

const buildFourPlayerHighNoonState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const highNoonCard = HIGH_NOON_CARD;
    if (!highNoonCard) {
        throw new Error(`未找到稳定枪手卡 ${HIGH_NOON_CARD_ID}，无法构造 4 人 High Noon 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.pendingBonusDiceSettlement = null;
    next.core.players['0'].hand = [{ ...structuredClone(highNoonCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);

    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            [TOKEN_IDS.BOUNTY]: 0,
        };
        next.core.players[pid].statusEffects = {
            ...(next.core.players[pid].statusEffects ?? {}),
            knockdown: 0,
        };
    }

    return next;
};

const buildFourPlayerSamuraiAshamedState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const ashamedCard = SAMURAI_ASHAMED_CARD;
    if (!ashamedCard) {
        throw new Error(`未找到稳定武士卡 ${SAMURAI_ASHAMED_CARD_ID}，无法构造 4 人耻辱牌场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(ashamedCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.SHAME]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.SHAME]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.SHAME]: 0,
    };

    return next;
};

const buildFourPlayerConsecrateState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const consecrateCard = CONSECRATE_CARD;
    if (!consecrateCard) {
        throw new Error(`未找到稳定授 token 卡 ${CONSECRATE_CARD_ID}，无法构造 4 人 Consecrate 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(consecrateCard), id: 'consecrate-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 10);
    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            [TOKEN_IDS.PROTECT]: 0,
            [TOKEN_IDS.RETRIBUTION]: 0,
            [TOKEN_IDS.CRIT]: 0,
            [TOKEN_IDS.ACCURACY]: 0,
        };
    }
    return next;
};

const buildFourPlayerVengeance2State = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const vengeanceUpgradeCard = PALADIN_VENGEANCE_2_CARD;
    if (!vengeanceUpgradeCard) {
        throw new Error(`未找到稳定升级卡 ${PALADIN_VENGEANCE_2_CARD_ID}，无法构造 4 人 Vengeance II 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = true;
    next.core.rollCount = 1;
    next.core.rollLimit = 3;
    next.core.rollDiceCount = 5;
    next.core.players['0'].resources.cp = 1;
    next.core.players['0'].abilityLevels = {
        ...(next.core.players['0'].abilityLevels ?? {}),
        vengeance: 2,
    };
    next.core.players['0'].abilities = (next.core.players['0'].abilities ?? []).map((ability: any) =>
        ability?.id === 'vengeance' ? structuredClone(VENGEANCE_2) : ability
    );
    next.core.players['0'].upgradeCardByAbilityId = {
        ...(next.core.players['0'].upgradeCardByAbilityId ?? {}),
        vengeance: { cardId: vengeanceUpgradeCard.id, cpCost: vengeanceUpgradeCard.cpCost },
    };
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.RETRIBUTION]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.RETRIBUTION]: 0,
    };
    next.core.dice = (next.core.dice.length > 0
        ? next.core.dice
        : Array.from({ length: 5 }, (_, index) => ({
            id: index,
            definitionId: 'paladin-dice',
            value: 1,
            symbol: 'sword',
            symbols: ['sword'],
            isKept: false,
        }))).map((die: any, index: number) => ({
        ...die,
        value: index < 3 ? 3 : index === 3 ? 6 : 1,
        symbol: index < 3
            ? PALADIN_DICE_FACE_IDS.HELM
            : index === 3
                ? PALADIN_DICE_FACE_IDS.PRAY
                : PALADIN_DICE_FACE_IDS.SWORD,
        symbols: [index < 3
            ? PALADIN_DICE_FACE_IDS.HELM
            : index === 3
                ? PALADIN_DICE_FACE_IDS.PRAY
                : PALADIN_DICE_FACE_IDS.SWORD],
        isKept: false,
    }));
    return next;
};

const buildFourPlayerRemoveSingleStatusState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const removeSingleStatusCard = REMOVE_SINGLE_STATUS_CARD;
    if (!removeSingleStatusCard) {
        throw new Error(`未找到稳定移除单状态卡 ${REMOVE_SINGLE_STATUS_CARD_ID}，无法构造 4 人 remove-status-1 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(removeSingleStatusCard), id: 'remove-single-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 6);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerRemoveAllStatusState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const removeAllStatusCard = REMOVE_ALL_STATUS_CARD;
    if (!removeAllStatusCard) {
        throw new Error(`未找到稳定移除全部状态卡 ${REMOVE_ALL_STATUS_CARD_ID}，无法构造 4 人 remove-all-status 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(removeAllStatusCard), id: 'remove-all-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 6);
    next.core.players['1'].statusEffects = {
        ...(next.core.players['1'].statusEffects ?? {}),
        burn: 2,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['2'].statusEffects = {
        ...(next.core.players['2'].statusEffects ?? {}),
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].statusEffects = {
        ...(next.core.players['3'].statusEffects ?? {}),
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerMeteorAllOpponentsState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);

    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        targetingSelectionPending: false,
        targetingSelectionResolved: true,
        isDefendable: false,
        damage: 4,
        sourceAbilityId: 'meteor',
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.core.selectedAbilityId = 'meteor';
    next.core.rollConfirmed = true;
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.FIRE_MASTERY]: 0,
    };
    for (const pid of ['0', '1', '2', '3']) {
        next.core.players[pid].resources = {
            ...(next.core.players[pid].resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
    }

    return next;
};

test.describe('DiceThrone Simple Start', () => {
    test('Online match: Can start a game successfully', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage } = setup;

        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-host-game-started');

        await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });
        await expect(guestPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });

        await cleanupDTMatch(setup);
    });

    test('Online 2-player transfer token: transfer phase keeps locked source card and target card', async ({ browser, workerPorts }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = `http://127.0.0.1:${workerPorts.frontend}`;
        const gameServerBaseURL = `http://127.0.0.1:${workerPorts.gameServer}`;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'shadow_thief');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerTransferTokenState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-2p-inst' });

        await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });
        await hostPage.getByTestId('dt-status-effect-1-crit').click();

        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-locked', 'true');
        await expect(hostPage.getByTestId('dt-transfer-source-effect-crit')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.locator('[data-testid^="dt-status-owner-"]')).toHaveCount(0);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-two-player-transfer-token-target-selection');

        await hostPage.getByTestId('dt-transfer-target-0').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 1
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });
        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 1
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const guestState = await readHarnessState<any>(guestPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(guestState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(guestState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player room: create claim-seat join and start successfully', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const gameServerBaseURL = getGameServerBaseURL();

        const beforeStartResponse = await hostPage.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
        expect(beforeStartResponse.ok()).toBe(true);
        const beforeStartMatch = await beforeStartResponse.json() as {
            players: Array<{ id: number; name?: string }>;
            status?: string;
        };
        expect(beforeStartMatch.players.map((player) => player.id)).toEqual([0, 1, 2, 3]);
        expect(beforeStartMatch.players.every((player) => !!player.name)).toBe(true);
        expect(beforeStartMatch.status).toBe('playing');

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');

        await readyMultiplePlayersAndStartGame(
            hostPage,
            players.slice(1).map((player) => player.page),
        );

        for (const player of players) {
            await waitForGameBoard(player.page, 30000);
        }

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '02-four-player-host-game-started');

        const afterStartResponse = await hostPage.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
        expect(afterStartResponse.ok()).toBe(true);
        const afterStartMatch = await afterStartResponse.json() as {
            players: Array<{ id: number; name?: string }>;
            status?: string;
        };
        expect(afterStartMatch.players).toHaveLength(4);
        expect(afterStartMatch.status).toBe('playing');
        await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });

        await cleanupDTMatch(setup);
    });

    test('Online 4-player seating panel: host can move to empty slot and occupied seat is rejected', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage } = setup;

        await expect(hostPage.getByText('2v2 Seating')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByText('Team A')).toBeVisible({ timeout: 5000 });
        await expect(hostPage.getByText('P1 / P3')).toBeVisible({ timeout: 5000 });
        await expect(hostPage.getByText('Team B')).toBeVisible({ timeout: 5000 });
        await expect(hostPage.getByText('P2 / P4')).toBeVisible({ timeout: 5000 });

        const seatOneButton = hostPage.locator('button')
            .filter({ hasText: 'Seat 1' })
            .filter({ hasText: 'P1' })
            .first();
        await expect(seatOneButton).toBeVisible({ timeout: 5000 });
        await seatOneButton.click();

        await expect(hostPage.getByText('P1 selected. Click an empty slot to finish the move.')).toBeVisible({ timeout: 5000 });

        const occupiedSeatButton = hostPage.locator('button')
            .filter({ hasText: 'P2' })
            .first();
        await expect(occupiedSeatButton).toBeVisible({ timeout: 5000 });
        await occupiedSeatButton.click();

        await expect(hostPage.getByText('That position is already occupied. Seat swapping is not supported.')).toBeVisible({ timeout: 5000 });

        const emptySeatThreeButton = hostPage.locator('button')
            .filter({ hasText: 'Empty' })
            .filter({ hasText: 'Seat 3' })
            .first();
        await expect(emptySeatThreeButton).toBeVisible({ timeout: 5000 });
        await emptySeatThreeButton.click();

        await expect(hostPage.getByText('Click a player first, then click an empty slot to move them. Swapping seats is not allowed.')).toBeVisible({ timeout: 5000 });
        await expect(hostPage.getByText('P2 / P1')).toBeVisible({ timeout: 5000 });
        await expect(hostPage.getByText('P3 / P4')).toBeVisible({ timeout: 5000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '03-four-player-seating-panel-moved');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player board: top headers show ally and enemy tones correctly', async ({ browser }) => {
        test.setTimeout(120000);
        const baseURL = test.info().project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, players } = setup;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        const headerLocator = hostPage.locator('[data-testid^="dt-top-header-"]');
        await expect(headerLocator).toHaveCount(3, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1');
        await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-player-id', '2');
        await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-player-id', '3');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 2));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '3');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 4));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '1');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 5));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await defenderCaptainPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '3';
        }, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-choice-panel')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.locator('[data-testid^="dt-target-option-"]')).toHaveCount(3, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-option-1')).toHaveAttribute('data-team-tone', 'ally');
        await expect(defenderCaptainPage.getByTestId('dt-target-option-2')).toHaveAttribute('data-team-tone', 'enemy');
        await defenderCaptainPage.getByTestId('dt-target-option-1').click();
        await defenderCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-choice-panel')).toBeHidden({ timeout: 10000 });

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '0';
        }, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.locator('[data-testid^="dt-target-option-"]')).toHaveCount(3, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-target-option-2')).toHaveAttribute('data-team-tone', 'ally');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '04-four-player-target-choice-panel-host');

        await hostPage.getByTestId('dt-target-option-1').click();
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeHidden({ timeout: 10000 });

        await cleanupDTMatch(setup);
    });

    test('Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTransferTokenState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-owner-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });

        await hostPage.getByTestId('dt-status-effect-1-crit').click();
        await expect(hostPage.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-locked', 'true');
        await expect(hostPage.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06-four-player-transfer-token-target-selection');

        await hostPage.getByTestId('dt-transfer-target-2').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0
                && (state?.core?.players?.['2']?.tokens?.crit ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.core.players['2'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(allyState.core.players['2'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;

        await selectCharacter(players[0].page, 'paladin');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerConsecrateState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'consecrate-inst' });
        await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '07-four-player-consecrate-target-selection');

        await hostPage.getByTestId('dt-player-target-2').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const allyTokens = state?.core?.players?.['2']?.tokens ?? {};
            return !state?.sys?.interaction?.current
                && (allyTokens.protect ?? 0) === 1
                && (allyTokens.retribution ?? 0) === 1
                && (allyTokens.crit ?? 0) === 1
                && (allyTokens.accuracy ?? 0) === 1;
        }, undefined, { timeout: 10000 });
        await allyPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const allyTokens = state?.core?.players?.['2']?.tokens ?? {};
            return (allyTokens.protect ?? 0) === 1
                && (allyTokens.retribution ?? 0) === 1
                && (allyTokens.crit ?? 0) === 1
                && (allyTokens.accuracy ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        for (const tokenId of [TOKEN_IDS.PROTECT, TOKEN_IDS.RETRIBUTION, TOKEN_IDS.CRIT, TOKEN_IDS.ACCURACY]) {
            expect(hostState.core.players['2'].tokens[tokenId] ?? 0).toBe(1);
            expect(allyState.core.players['2'].tokens[tokenId] ?? 0).toBe(1);
        }
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTheLawState);
        await waitForPhase(hostPage, 'main1');

        const theLawCard = hostPage.locator('[data-card-id="card-the-law"]').first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        await expect(theLawCard).toBeVisible({ timeout: 5000 });
        await theLawCard.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            const targetPlayerIds = current?.targetPlayerIds ?? [];
            return current?.sourceCardId === 'card-the-law'
                && targetPlayerIds.length === 2
                && targetPlayerIds.includes('1')
                && targetPlayerIds.includes('3')
                && !targetPlayerIds.includes('2')
                && state?.core?.players?.['0']?.hand?.every((card: any) => card.id !== 'card-the-law')
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '10-four-player-the-law-enemy-only-selection');

        await enemyOne.click();
        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 1
                && (state?.core?.players?.['2']?.tokens?.bounty ?? 0) === 0
                && (state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0) === 0
                && (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });
        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await saveEvidenceScreenshot(hostPage, testInfo, '11-four-player-the-law-resolved-on-enemies');

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        const enemyCaptainState = await readHarnessState<any>(enemyCaptainPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(1);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(1);
        expect(hostState.core.players['1'].statusEffects.knockdown ?? 0).toBe(1);
        expect(hostState.core.players['2'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(0);
        expect(hostState.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        expect(hostState.core.players['3'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(1);
        expect(hostState.core.players['3'].statusEffects.knockdown ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(allyState.core.players['2'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(0);
        expect(allyState.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        expect(enemyCaptainState.core.players['3'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(1);
        expect(enemyCaptainState.core.players['3'].statusEffects.knockdown ?? 0).toBe(1);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player Wanted: real hand play only offers enemies in 2v2 and grants Bounty to selected enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerWantedState);
        await waitForPhase(hostPage, 'main1');

        const wantedCard = hostPage.locator(`[data-card-id="${WANTED_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        await expect(wantedCard).toBeVisible({ timeout: 5000 });
        await wantedCard.click({ force: true });

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            return {
                sourceCardId: current?.sourceCardId ?? null,
                resolveCustomActionId: current?.resolveCustomActionId ?? null,
                targetPlayerIds: current?.targetPlayerIds ?? [],
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-wanted',
            resolveCustomActionId: 'gunslinger-card-wanted-resolve',
            targetPlayerIds: ['1', '3'],
        });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '12-four-player-wanted-enemy-only-selection');

        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 0
                && (state?.core?.players?.['2']?.tokens?.bounty ?? 0) === 0
                && (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });
        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await saveEvidenceScreenshot(hostPage, testInfo, '13-four-player-wanted-resolved-on-selected-enemy');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player Samurai Shame card: real hand play only offers enemies in 2v2 and applies Shame to selected enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'samurai');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'gunslinger');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerSamuraiAshamedState);
        await waitForPhase(hostPage, 'main1');

        const ashamedCard = hostPage.locator(`[data-card-id="${SAMURAI_ASHAMED_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        await expect(ashamedCard).toBeVisible({ timeout: 5000 });
        await ashamedCard.click({ force: true });

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            const targetPlayerIds = current?.targetPlayerIds ?? [];
            return current?.sourceCardId === 'card-you-should-be-ashamed'
                && current?.resolveCustomActionId === 'samurai-card-you-should-be-ashamed-resolve'
                && targetPlayerIds.length === 2
                && targetPlayerIds.includes('1')
                && targetPlayerIds.includes('3')
                && !targetPlayerIds.includes('2');
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '14-four-player-samurai-shame-enemy-only-selection');

        await enemyOne.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.shame ?? 0) === 2
                && (state?.core?.players?.['2']?.tokens?.shame ?? 0) === 0
                && (state?.core?.players?.['3']?.tokens?.shame ?? 0) === 0;
        }, undefined, { timeout: 10000, polling: 200 });
        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.tokens?.shame ?? 0) === 0;
        }, undefined, { timeout: 10000, polling: 200 });

        await saveEvidenceScreenshot(hostPage, testInfo, '15-four-player-samurai-shame-resolved-on-selected-enemy');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player Pistol Whip: real hand play only offers enemies in 2v2 and applies knockdown plus undefendable damage to selected enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerPistolWhipState);
        await waitForPhase(hostPage, 'main1');

        const pistolWhipCard = hostPage.locator(`[data-card-id="${PISTOL_WHIP_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        const beforeState = await readHarnessState<any>(hostPage);
        const enemyHpBefore = beforeState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0;

        await expect(pistolWhipCard).toBeVisible({ timeout: 5000 });
        await pistolWhipCard.click({ force: true });

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            return {
                sourceCardId: current?.sourceCardId ?? null,
                resolveCustomActionId: current?.resolveCustomActionId ?? null,
                targetPlayerIds: current?.targetPlayerIds ?? [],
                hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-pistol-whip',
            resolveCustomActionId: 'gunslinger-card-pistol-whip-resolve',
            targetPlayerIds: ['1', '3'],
            hand: [],
        });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '18-four-player-pistol-whip-enemy-only-selection');

        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction((baselineHp) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1
                && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 0
                && (state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0) === 0
                && (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1
                && baselineHp - (state?.core?.players?.['3']?.resources?.hp ?? 0) === 1;
        }, enemyHpBefore, { timeout: 10000, polling: 200 });

        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        const stateAfter = await readHarnessState<any>(hostPage);
        expect(stateAfter.core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(1);
        expect(stateAfter.core.players['1'].statusEffects.knockdown ?? 0).toBe(0);
        expect(stateAfter.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        expect(stateAfter.core.players['3'].statusEffects.knockdown ?? 0).toBe(1);
        expect(enemyHpBefore - (stateAfter.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0)).toBe(1);

        await saveEvidenceScreenshot(hostPage, testInfo, '19-four-player-pistol-whip-resolved-on-selected-enemy');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player High Noon: real hand play only offers enemies in 2v2 and resolves the rolled branch on selected enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerHighNoonState);
        await waitForPhase(hostPage, 'main1');

        const highNoonCard = hostPage.locator(`[data-card-id="${HIGH_NOON_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        const beforeState = await readHarnessState<any>(hostPage);
        const enemyHpBefore = beforeState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0;

        await expect(highNoonCard).toBeVisible({ timeout: 5000 });
        await highNoonCard.click({ force: true });

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            return {
                sourceCardId: current?.sourceCardId ?? null,
                resolveCustomActionId: current?.resolveCustomActionId ?? null,
                targetPlayerIds: current?.targetPlayerIds ?? [],
                hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-high-noon',
            resolveCustomActionId: 'gunslinger-card-high-noon-resolve',
            targetPlayerIds: ['1', '3'],
            hand: [],
        });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '16-four-player-high-noon-enemy-only-selection');

        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
            return latestBonusDieEvent?.event?.payload?.effectKey ?? '';
        }), { timeout: 15000, intervals: [200, 400, 800] }).toMatch(
            /^bonusDie\.effect\.gunslingerHighNoon(Bullet|Dash|Bullseye)$/
        );

        await expect.poll(async () => enemyCaptainPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
            return latestBonusDieEvent?.event?.payload?.effectKey ?? '';
        }), { timeout: 15000, intervals: [200, 400, 800] }).toMatch(
            /^bonusDie\.effect\.gunslingerHighNoon(Bullet|Dash|Bullseye)$/
        );

        const stateAfter = await hostPage.evaluate((baselineHp) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
            return {
                effectKey: latestBonusDieEvent?.event?.payload?.effectKey ?? null,
                enemyOneBounty: state?.core?.players?.['1']?.tokens?.bounty ?? 0,
                allyBounty: state?.core?.players?.['2']?.tokens?.bounty ?? 0,
                enemyTwoBounty: state?.core?.players?.['3']?.tokens?.bounty ?? 0,
                enemyOneKnockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
                allyKnockdown: state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0,
                enemyTwoKnockdown: state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0,
                enemyTwoHp: state?.core?.players?.['3']?.resources?.hp ?? 0,
                enemyTwoDamage: baselineHp - (state?.core?.players?.['3']?.resources?.hp ?? 0),
            };
        }, enemyHpBefore);

        expect(stateAfter.enemyOneBounty).toBe(0);
        expect(stateAfter.allyBounty).toBe(0);
        expect(stateAfter.enemyOneKnockdown).toBe(0);
        expect(stateAfter.allyKnockdown).toBe(0);

        if (stateAfter.effectKey === 'bonusDie.effect.gunslingerHighNoonBullet') {
            expect(stateAfter.enemyTwoDamage).toBe(2);
            expect(stateAfter.enemyTwoBounty).toBe(0);
            expect(stateAfter.enemyTwoKnockdown).toBe(0);
        } else if (stateAfter.effectKey === 'bonusDie.effect.gunslingerHighNoonDash') {
            expect(stateAfter.enemyTwoDamage).toBe(0);
            expect(stateAfter.enemyTwoBounty).toBe(0);
            expect(stateAfter.enemyTwoKnockdown).toBe(1);
        } else {
            expect(stateAfter.effectKey).toBe('bonusDie.effect.gunslingerHighNoonBullseye');
            expect(stateAfter.enemyTwoDamage).toBe(0);
            expect(stateAfter.enemyTwoBounty).toBe(1);
            expect(stateAfter.enemyTwoKnockdown).toBe(0);
        }

        await saveEvidenceScreenshot(hostPage, testInfo, '17-four-player-high-noon-resolved-on-selected-enemy');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;

        await selectCharacter(players[0].page, 'paladin');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerVengeance2State);
        await waitForPhase(hostPage, 'offensiveRoll');

        const vengeanceDebugState = await readHarnessState<any>(hostPage);
        const availableAbilities = vengeanceDebugState.core.players['0'].abilities.map((ability: any) => ({
            id: ability.id,
            variantIds: (ability.variants ?? []).map((variant: any) => variant.id),
        }));
        const availableAbilityIds = getAvailableAbilityIds(
            vengeanceDebugState.core,
            '0',
            vengeanceDebugState.sys.phase,
        );
        testInfo.annotations.push({
            type: 'vengeance-debug',
            description: JSON.stringify({ availableAbilities, availableAbilityIds }),
        });
        expect(availableAbilityIds, `Vengeance II 可用技能集异常: ${JSON.stringify({ availableAbilities, availableAbilityIds })}`)
            .toContain('vengeance-2-main');

        await dispatchHarnessCommand(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' });
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
            return current?.kind === 'dt:card-interaction' && current?.playerId === '0';
        }, undefined, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '10-four-player-vengeance-2-target-selection');

        await hostPage.getByTestId('dt-player-target-2').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['2']?.tokens?.retribution ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        expect(hostState.core.players['2'].tokens[TOKEN_IDS.RETRIBUTION] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const targetPage = players[1].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerRemoveSingleStatusState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'remove-single-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-owner-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-status-owner-3')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '08-four-player-remove-single-status-selection');

        await hostPage.getByTestId('dt-status-effect-1-crit').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });
        await targetPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const targetState = await readHarnessState<any>(targetPage);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(targetState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const targetPage = players[1].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerRemoveAllStatusState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'remove-all-inst' });
        await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        const confirmButton = hostPage.getByRole('button', { name: /Confirm|确认/i }).last();
        await expect(confirmButton).toBeDisabled();
        await hostPage.getByTestId('dt-player-target-2').click();
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '09-four-player-remove-all-status-selection');

        await hostPage.getByTestId('dt-player-target-1').click();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.statusEffects?.burn ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });
        await targetPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['1']?.statusEffects?.burn ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const targetState = await readHarnessState<any>(targetPage);
        expect(hostState.core.players['1'].statusEffects.burn ?? 0).toBe(0);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(targetState.core.players['1'].statusEffects.burn ?? 0).toBe(0);
        expect(targetState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'pyromancer');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerMeteorAllOpponentsState);
        await waitForPhase(hostPage, 'offensiveRoll');

        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const players = state?.core?.players ?? {};
            return (players['1']?.resources?.hp ?? 0) === 44
                && (players['2']?.resources?.hp ?? 0) === 50
                && (players['3']?.resources?.hp ?? 0) === 44;
        }, undefined, { timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '11-four-player-meteor-all-opponents-resolution');

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        const enemyCaptainState = await readHarnessState<any>(enemyCaptainPage);

        expect(hostState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0).toBe(44);
        expect(hostState.core.players['2'].resources[RESOURCE_IDS.HP] ?? 0).toBe(50);
        expect(hostState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0).toBe(44);
        expect(allyState.core.players['2'].resources[RESOURCE_IDS.HP] ?? 0).toBe(50);
        expect(enemyCaptainState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0).toBe(44);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const defenderPage = players[1].page;
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildDefensiveResponseWindowTriggerState);
        await waitForPhase(hostPage, 'defensiveRoll');

        await dispatchHarnessCommand(defenderCaptainPage, 'CONFIRM_ROLL', '3');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
            return state?.sys?.phase === 'defensiveRoll' && queue.length === 1 && queue[0] === '0';
        }, { timeout: 10000 });

        const responseState = await readHarnessState<any>(hostPage);
        expect(responseState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        expect(responseState.sys.responseWindow?.current?.responderQueue).not.toContain('2');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.getByTestId('dt-target-option-1').click();
        await defenderPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });

        await applyOnlineMatchState(matchId, hostPage, buildDefensiveRollResolutionState);
        await waitForPhase(defenderPage, 'defensiveRoll');
        await dispatchHarnessCommand(defenderPage, 'ADVANCE_PHASE', '1');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'main2' && !state?.core?.pendingAttack;
        }, { timeout: 10000 });

        const resolvedState = await readHarnessState<any>(hostPage);
        expect(resolvedState.sys.phase).toBe('main2');
        expect(resolvedState.core.pendingAttack).toBeFalsy();

        const victoryState = structuredClone(resolvedState);
        victoryState.core.teamHealth = { A: victoryState.core.teamHealth?.A ?? 50, B: 0 };
        victoryState.core.players['1'].resources.hp = 0;
        victoryState.core.players['3'].resources.hp = 0;
        victoryState.sys.gameover = { winner: '0' };
        await injectMatchState(matchId, normalizeInjectedMatchState(matchId, victoryState), hostPage);

        await expect(hostPage.getByTestId('dt-endgame-title')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByTestId('dt-endgame-title')).toContainText('Victory');
        await expect(defenderPage.getByTestId('dt-endgame-title')).toContainText('Defeat');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '05-four-player-team-victory-ui');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player direct dice ally: teammate stays out of responder queue but can still open modify interaction', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildDefensiveResponseWindowTriggerState);
        await waitForPhase(hostPage, 'defensiveRoll');

        await dispatchHarnessCommand(defenderCaptainPage, 'CONFIRM_ROLL', '3');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
            return state?.sys?.phase === 'defensiveRoll' && queue.length === 1 && queue[0] === '0';
        }, { timeout: 10000 });

        const queuedState = await readHarnessState<any>(hostPage);
        expect(queuedState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        expect(queuedState.sys.responseWindow?.current?.responderQueue).not.toContain('2');

        await dispatchHarnessCommand(allyPage, 'PLAY_CARD', '2', { cardId: RESPONSE_WINDOW_CARD_ID });

        await allyPage.waitForFunction((responseWindowCardId: string) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
            const interaction = state?.sys?.interaction?.current;
            const allyDiscard = state?.core?.players?.['2']?.discard ?? [];
            return interaction?.playerId === '2'
                && interaction?.kind === 'multistep-choice'
                && queue.length === 1
                && queue[0] === '0'
                && !queue.includes('2')
                && allyDiscard.some((card: any) => card.id === responseWindowCardId);
        }, RESPONSE_WINDOW_CARD_ID, { timeout: 10000 });
        await expect(allyPage.getByRole('button', { name: /Confirm|确认/i }).last()).toBeVisible({ timeout: 10000 });

        const allyState = await readHarnessState<any>(allyPage);
        expect(allyState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        expect(allyState.sys.responseWindow?.current?.responderQueue).not.toContain('2');
        expect(allyState.sys.interaction.current?.playerId).toBe('2');
        expect(allyState.sys.interaction.current?.kind).toBe('multistep-choice');
        expect(allyState.core.players['2'].discard.some((card: any) => card.id === RESPONSE_WINDOW_CARD_ID)).toBe(true);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(allyPage, testInfo, '12-four-player-direct-dice-ally-interaction');

        await cleanupDTMatch(setup);
    });
});
