/**
 * Watch Out / 濠电姰鍨归悥銏ゅ礃閳轰讲鍋撹椤潡宕奸崱妤€鏆欓柣?闂備胶绮〃鍫ュ箠閹捐鐤?E2E 婵犵數鍋炲娆擃敄閸儲鍎? *
 * 闂佽崵鍠愬ú鏍涘☉妯忕儤绻濋崘顏佹灃婵犮垼娉涢鍡涙嫃鐎ｎ喗鈷戦柣鎰靛墮缁€鍐煟椤撱垻鐣洪柡? * 1. 闂備胶鍘ч〃搴㈢濠婂懏宕插〒姘ｅ亾妤犵偛绉归獮姗€宕橀崣澶屾 Watch Out 闂備礁鎼崯鎶筋敊閹邦喗顫曟繝闈涙处閸庣喖鏌￠崘銊モ偓鍦不濞嗘挻鐓曢柟鐑樻尰缁惰尙鈧娲滈崰鎰般€冮妷鈺佺妞ゆ梻鈷堝Λ妤呮⒑? * 2. 闂備礁鎼Λ娆忣焽濞嗘挸鍚规い鏇楀亾鐎规洩缍侀、鏃堝礋閸偅绶梻浣告啞濮婄粯鎱ㄩ悽绋跨劦妞ゆ帒鍠氶崬鐑樼節绾版ê浜鹃梺璇叉捣椤㈠﹤鈻嶉弴鐑嗘富闁稿瞼鍋為弲顒勬倶閻愯泛浜归柣鐔哥箞楠炴牜鈧稒蓱椤ュ牓鏌℃担闈╁姛闁归濞€椤㈡稑鈽夊▎灞剧亙缂傚倷璁查崑鎾绘煟閹寸倖鎴﹀汲娴煎瓨鐓曢柟杈剧秵閸炴椽鏌熸笟鍨妞ゎ偁鍨介弫鎰板川椤栨粌鎹剁紓? * 3. P1 闂備胶鎳撻悘姘跺箰閹间礁鍚规い鎾跺枎缁剁偟鎲稿澶婄畺闊洦鏌ㄧ欢鐐垫喐瀹ュ鏄ラ柛鏇ㄥ灠缁秹鎮规担鍛婅础缂佲偓婵? 闂備礁鎲￠悷顖涚濠婂懓濮抽柡灞诲劜閸庢垿鎮楅敐搴濈盎闁绘挸鍊块弻娑樜旂€ｎ剛锛熸繝鈷€鍕疄闁诡啫鍥ㄥ仭闁哄瀵у▍銏ゆ⒑閹稿海鈽夊┑鍌涙⒒缁厽寰勭€ｎ偄鍔呴梺鍝勫暙閻楀棗鈻嶉姀鐙€鐔嗛悹楦挎鑲栧┑鐘亾闁告稒娼欑粈?bonus overlay
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import type { Locator, Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import { BARBARIAN_CARDS } from '../../src/games/dicethrone/heroes/barbarian/cards';
import { GUNSLINGER_CARDS } from '../../src/games/dicethrone/heroes/gunslinger/cards';
import { NINJA_CARDS } from '../../src/games/dicethrone/heroes/ninja/cards';
import { SAMURAI_CARDS } from '../../src/games/dicethrone/heroes/samurai/cards';
import {
    advanceToOffensiveRoll,
    applyCoreStateDirect,
    disableFabMenu,
    ensureDebugPanelClosed,
    ensureDebugStateTab,
    readyAndStartGame,
    readCoreState,
    selectCharacter,
    setupDTOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { setChineseLocale, waitForTestHarness } from '../helpers/common';
import {
    expectNoCentralBonusDicePresentation,
    expectRightTrayBonusDiceConfirmation,
    expectRightTrayBonusDiceReadOnlyReview,
    getRightTrayDiceTray,
    getRightTrayDie,
    settleCurrentBonusDice,
} from './bonus-dice-flow';

const DICETHRONE_OPEN_TIMEOUT_MS = 180000;
const DICETHRONE_TEST_TIMEOUT_MS = 300000;
const DICETHRONE_ONLINE_TEST_TIMEOUT_MS = 240000;
const FIXED_RANDOM = {
    random: () => 0.5,
    d: (max: number) => Math.min(max, 1),
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function buildOnlineCommonCardSceneState(
    baseState: Record<string, any>,
    options: {
        actorCharacter: 'samurai' | 'gunslinger';
        actorCardId: 'card-boss-generous' | 'card-next-time';
        actorCp: number;
        responseScene?: {
            pendingDamage: number;
            responseWindowType: 'afterAttackResolved';
        };
    },
) {
    const viewerBase = initHeroState('0', 'monk', FIXED_RANDOM as any);
    const actorBase = initHeroState('1', options.actorCharacter, FIXED_RANDOM as any);
    const actorCards = options.actorCharacter === 'samurai' ? SAMURAI_CARDS : GUNSLINGER_CARDS;
    const actorCard = actorCards.find((card) => card.id === options.actorCardId);
    if (!actorCard) {
        throw new Error(`Card ${options.actorCardId} not found for ${options.actorCharacter}`);
    }

    const nextState = cloneJson(baseState);
    const isResponseScene = !!options.responseScene;

    nextState.core = {
        ...(nextState.core ?? {}),
        activePlayerId: isResponseScene ? '0' : '1',
        hostStarted: true,
        selectedCharacters: {
            ...(nextState.core?.selectedCharacters ?? {}),
            '0': 'monk',
            '1': options.actorCharacter,
        },
        readyPlayers: {
            ...(nextState.core?.readyPlayers ?? {}),
            '0': true,
            '1': true,
        },
        players: {
            ...(nextState.core?.players ?? {}),
            '0': {
                ...viewerBase,
                hand: [],
                discard: [],
                resources: {
                    ...viewerBase.resources,
                    cp: 2,
                    hp: 50,
                },
            },
            '1': {
                ...actorBase,
                hand: [cloneJson(actorCard)],
                discard: [],
                resources: {
                    ...actorBase.resources,
                    cp: options.actorCp,
                    hp: 50,
                },
            },
        },
        pendingAttack: isResponseScene
            ? {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'monk-test-attack',
                damage: options.responseScene!.pendingDamage,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
                preDefenseResolved: false,
                offensiveRollEndTokenResolved: false,
            }
            : null,
        pendingDamage: isResponseScene
            ? {
                id: `common-card-${options.actorCardId}-pending-damage`,
                sourcePlayerId: '0',
                targetPlayerId: '1',
                originalDamage: options.responseScene!.pendingDamage,
                currentDamage: options.responseScene!.pendingDamage,
                sourceAbilityId: 'monk-test-attack',
                responseType: 'beforeDamageReceived',
                responderId: '1',
                isFullyEvaded: false,
            }
            : undefined,
        rollCount: Math.max(nextState.core?.rollCount ?? 0, 1),
        rollConfirmed: true,
    };
    nextState.sys = {
        ...(nextState.sys ?? {}),
        phase: 'main1',
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
        },
        responseWindow: isResponseScene
            ? {
                current: {
                    id: `common-card-${options.actorCardId}-response-window`,
                    windowType: options.responseScene!.responseWindowType,
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            }
            : { current: undefined },
    };
    return nextState;
}

async function readMatchStateFromDebugPanel(page: Page): Promise<Record<string, any>> {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    return JSON.parse(raw) as Record<string, any>;
}

async function applyFullStateDirect(page: Page, state: Record<string, any>): Promise<void> {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(state));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
}

async function waitForHandCardVisualReady(page: Page, cardId: string): Promise<void> {
    await page.waitForFunction((expectedCardId) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        const card = handArea.querySelector(`[data-card-id="${expectedCardId}"]`);
        if (!card) return false;
        return card.getAttribute('data-is-flipped') === 'true'
            && handArea.querySelectorAll('.atlas-shimmer').length === 0;
    }, cardId, { timeout: 15000, polling: 100 });
    await page.waitForTimeout(900);
}

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
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
}

async function expectMinBoundingBox(locator: Locator, label: string, minWidth: number, minHeight: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(minWidth);
    expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(minHeight);
}

async function expectMaxBoundingBox(locator: Locator, label: string, maxWidth: number, maxHeight: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.width, `${label} width`).toBeLessThanOrEqual(maxWidth);
    expect(box!.height, `${label} height`).toBeLessThanOrEqual(maxHeight);
}

async function expectElementInsideViewport(
    locator: Locator,
    label: string,
    viewportWidth: number,
    viewportHeight: number,
): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
    expect(box!.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(viewportWidth + 1);
    expect(box!.y + box!.height, `${label} bottom edge`).toBeLessThanOrEqual(viewportHeight + 1);
}

async function expectMaxViewportWidthRatio(
    locator: Locator,
    label: string,
    viewportWidth: number,
    maxRatio: number,
): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.width / viewportWidth, `${label} width ratio`).toBeLessThanOrEqual(maxRatio);
}

async function expectMinViewportWidthRatio(
    locator: Locator,
    label: string,
    viewportWidth: number,
    minRatio: number,
): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.width / viewportWidth, `${label} width ratio`).toBeGreaterThanOrEqual(minRatio);
}

async function expectCombinedHorizontalCenter(
    locators: Locator[],
    label: string,
    viewportWidth: number,
    tolerancePx: number,
): Promise<void> {
    const boxes = (await Promise.all(locators.map((locator) => locator.boundingBox())))
        .filter((box): box is NonNullable<typeof box> => box !== null);

    expect(boxes.length, `${label} should expose bounding boxes`).toBeGreaterThan(0);

    const left = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const combinedCenter = left + ((right - left) / 2);
    const viewportCenter = viewportWidth / 2;

    expect(
        Math.abs(combinedCenter - viewportCenter),
        `${label} combined center should stay near viewport center`,
    ).toBeLessThanOrEqual(tolerancePx);
}

async function expectCardSpotlightClearOfCriticalAreas(page: Page): Promise<void> {
    const layout = await page.evaluate(() => {
        type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
        const toRect = (element: Element): Rect => {
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };
        };
        const hasArea = (rect: Rect) => rect.width > 0 && rect.height > 0;
        const overlaps = (a: Rect, b: Rect) => !(
            a.right <= b.left ||
            a.left >= b.right ||
            a.bottom <= b.top ||
            a.top >= b.bottom
        );
        const spotlightNode = document.querySelector('[data-testid="card-spotlight-overlay"]');
        const spotlight = spotlightNode ? toRect(spotlightNode) : null;
        const targets = [
            { label: '当前阶段提示', selector: '[data-testid="dt-active-phase-indicator"]' },
            { label: '生命/CP 面板', selector: '[data-testid="dt-player-stats-panel"]' },
            { label: '玩家面板', selector: '[data-testid="player-board-surface"]' },
            { label: '提示板', selector: '[data-testid="tip-board-surface"]' },
            { label: '右侧 2D 骰盘', selector: '[data-testid="dicethrone-2d-dice-tray"]' },
            { label: '弃牌堆', selector: '[data-testid="discard-pile"]' },
        ].flatMap(({ label, selector }) => Array.from(document.querySelectorAll(selector))
            .map((element) => ({ label, rect: toRect(element) }))
            .filter(({ rect }) => hasArea(rect)));

        return {
            spotlight,
            overlaps: spotlight
                ? targets.filter((target) => overlaps(spotlight, target.rect))
                : [],
        };
    });

    expect(layout.spotlight, '对手卡牌特写必须真实可见').not.toBeNull();
    expect(layout.overlaps, '对手卡牌特写不得压住当前阶段提示、生命/CP 面板、玩家面板、提示板、骰盘或弃牌堆').toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const metrics = await page.evaluate(() => {
        const root = document.getElementById('root');
        const gamePage = document.querySelector('[data-game-page="true"]');
        const shell = document.querySelector('.mobile-board-shell');
        const shellRect = shell ? shell.getBoundingClientRect() : null;
        return {
            innerWidth: window.innerWidth,
            docScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            rootScrollWidth: root ? root.scrollWidth : null,
            gamePageClientWidth: gamePage ? gamePage.clientWidth : null,
            shellRect: shellRect
                ? { left: shellRect.left, right: shellRect.right, width: shellRect.width }
                : null,
        };
    });

    const maxAllowed = metrics.innerWidth + 1;
    expect(metrics.docScrollWidth, 'documentElement should not overflow horizontally').toBeLessThanOrEqual(maxAllowed);
    expect(metrics.bodyScrollWidth, 'body should not overflow horizontally').toBeLessThanOrEqual(maxAllowed);
    if (metrics.rootScrollWidth !== null) {
        expect(metrics.rootScrollWidth, '#root should not overflow horizontally').toBeLessThanOrEqual(maxAllowed);
    }
    if (metrics.shellRect && metrics.gamePageClientWidth !== null) {
        expect(metrics.shellRect.left, 'mobile board shell left edge should stay in viewport').toBeGreaterThanOrEqual(-1);
        expect(metrics.shellRect.right, 'mobile board shell right edge should stay in viewport')
            .toBeLessThanOrEqual(metrics.gamePageClientWidth + 1);
    }
}

const SAMURAI_PLAYER_BOARD_ASPECT_RATIO = 2048 / 1248;

async function injectPyromancerAttackModifierScene(
    page: Page,
    options: { sourceAbilityId?: string | null },
): Promise<void> {
    await page.evaluate(async ({ sourceAbilityId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };
        const [{ initHeroState }, { PYROMANCER_CARDS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/heroes/pyromancer/cards.ts'),
        ]);
        const pyromancerBase = initHeroState('0', 'pyromancer', random as any);
        const barbarianBase = initHeroState('1', 'barbarian', random as any);
        const redHot = PYROMANCER_CARDS.find((card: any) => card.id === 'card-red-hot');
        if (!redHot) {
            throw new Error('card-red-hot not found');
        }

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'pyromancer',
                    '1': 'barbarian',
                },
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 2, isKept: false, playerId: '0' },
                    { id: 1, value: 2, isKept: false, playerId: '0' },
                    { id: 2, value: 3, isKept: false, playerId: '0' },
                    { id: 3, value: 4, isKept: false, playerId: '0' },
                    { id: 4, value: 5, isKept: false, playerId: '0' },
                ],
                players: {
                    ...state.core.players,
                    '0': {
                        ...pyromancerBase,
                        hand: [JSON.parse(JSON.stringify(redHot))],
                        discard: [],
                        resources: {
                            ...pyromancerBase.resources,
                            CP: 2,
                            HP: 50,
                        },
                        tokens: {
                            ...pyromancerBase.tokens,
                            fire_mastery: 2,
                        },
                        pendingBonusDamage: undefined,
                    },
                    '1': {
                        ...barbarianBase,
                        resources: {
                            ...barbarianBase.resources,
                            HP: 50,
                        },
                    },
                },
                pendingAttack: sourceAbilityId
                    ? {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId,
                        damage: 5,
                        bonusDamage: 0,
                        attackModifierBonusDamage: 0,
                        damageResolved: false,
                        resolvedDamage: 0,
                        preDefenseResolved: false,
                        offensiveRollEndTokenResolved: false,
                    }
                    : null,
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForPyromancerAttackModifierScene(
    page: Page,
    options: { sourceAbilityId?: string | null },
): Promise<void> {
    await page.waitForFunction(({ sourceAbilityId }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.hostStarted === true
            && state?.core?.selectedCharacters?.['0'] === 'pyromancer'
            && state?.core?.selectedCharacters?.['1'] === 'barbarian'
            && state?.core?.players?.['0']?.resources?.CP === 2
            && state?.core?.players?.['0']?.hand?.length === 1
            && state?.core?.players?.['0']?.hand?.[0]?.id === 'card-red-hot'
            && (sourceAbilityId
                ? state?.core?.pendingAttack?.sourceAbilityId === sourceAbilityId
                : state?.core?.pendingAttack == null);
    }, options, { timeout: 30000, polling: 200 });
}

async function injectPyromancerPyroBlast2DisplayScene(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };
        const [{ initHeroState }, { PYRO_BLAST_2 }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/heroes/pyromancer/abilities.ts'),
        ]);
        const pyromancerBase = initHeroState('0', 'pyromancer', random as any);
        const shadowThiefBase = initHeroState('1', 'shadow_thief', random as any);

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                },
                responseWindow: {
                    current: undefined,
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'pyromancer',
                    '1': 'shadow_thief',
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 1,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, symbol: 'fire', isKept: false, playerId: '0' },
                    { id: 1, value: 1, symbol: 'fire', isKept: false, playerId: '0' },
                    { id: 2, value: 1, symbol: 'fire', isKept: false, playerId: '0' },
                    { id: 3, value: 6, symbol: 'meteor', isKept: false, playerId: '0' },
                    { id: 4, value: 5, symbol: 'fiery_soul', isKept: false, playerId: '0' },
                ],
                players: {
                    ...state.core.players,
                    '0': {
                        ...pyromancerBase,
                        hand: [],
                        discard: [],
                        abilities: pyromancerBase.abilities.map((ability: any) => (
                            ability.id === 'pyro-blast' ? JSON.parse(JSON.stringify(PYRO_BLAST_2)) : ability
                        )),
                        resources: {
                            ...pyromancerBase.resources,
                            CP: 2,
                            HP: 50,
                        },
                    },
                    '1': {
                        ...shadowThiefBase,
                        resources: {
                            ...shadowThiefBase.resources,
                            HP: 50,
                        },
                        tokens: {
                            ...shadowThiefBase.tokens,
                            sneak: 1,
                        },
                    },
                },
                pendingAttack: null,
                pendingBonusDiceSettlement: undefined,
                sneakGainedTurn: {
                    ...(state.core.sneakGainedTurn ?? {}),
                    '1': 1,
                },
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    });
}

async function waitForPyromancerPyroBlast2DisplayScene(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const pyroBlast = state?.core?.players?.['0']?.abilities?.find((ability: any) => ability.id === 'pyro-blast');
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.hostStarted === true
            && state?.core?.selectedCharacters?.['0'] === 'pyromancer'
            && state?.core?.selectedCharacters?.['1'] === 'shadow_thief'
            && state?.core?.players?.['1']?.tokens?.sneak === 1
            && pyroBlast?.effects?.some((effect: any) => (
                effect?.action?.customActionId === 'pyro-blast-2-roll'
            ));
    }, { timeout: 30000, polling: 200 });
}

async function injectSamuraiAttackModifierScene(
    page: Page,
    options: {
        cardId: 'card-righteousness' | 'card-zanshin';
        defenderCharacter: 'monk' | 'paladin';
        sourceAbilityId?: string | null;
        diceValues?: number[];
    },
): Promise<void> {
    await page.evaluate(async ({ cardId, defenderCharacter, sourceAbilityId, diceValues }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        if (Array.isArray(diceValues) && diceValues.length > 0) {
            harness.dice.setValues(diceValues);
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };
        const [{ initHeroState }, { SAMURAI_CARDS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/heroes/samurai/cards.ts'),
        ]);
        const samuraiBase = initHeroState('0', 'samurai', random as any);
        const defenderBase = initHeroState('1', defenderCharacter, random as any);
        const attackModifierCard = SAMURAI_CARDS.find((card: any) => card.id === cardId);
        if (!attackModifierCard) {
            throw new Error(`${cardId} not found`);
        }

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'samurai',
                    '1': defenderCharacter,
                },
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false, playerId: '0' },
                    { id: 1, value: 1, isKept: false, playerId: '0' },
                    { id: 2, value: 1, isKept: false, playerId: '0' },
                    { id: 3, value: 4, isKept: false, playerId: '0' },
                    { id: 4, value: 4, isKept: false, playerId: '0' },
                ],
                players: {
                    ...state.core.players,
                    '0': {
                        ...samuraiBase,
                        hand: [JSON.parse(JSON.stringify(attackModifierCard))],
                        discard: [],
                        resources: {
                            ...samuraiBase.resources,
                            CP: 2,
                            HP: 50,
                        },
                    },
                    '1': {
                        ...defenderBase,
                        resources: {
                            ...defenderBase.resources,
                            HP: 50,
                        },
                    },
                },
                pendingAttack: sourceAbilityId
                    ? {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId,
                        damage: 6,
                        bonusDamage: 0,
                        attackModifierBonusDamage: 0,
                        damageResolved: false,
                        resolvedDamage: 0,
                        preDefenseResolved: false,
                        offensiveRollEndTokenResolved: false,
                    }
                    : null,
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForSamuraiAttackModifierScene(
    page: Page,
    options: {
        cardId: 'card-righteousness' | 'card-zanshin';
        defenderCharacter: 'monk' | 'paladin';
        sourceAbilityId?: string | null;
    },
): Promise<void> {
    await page.waitForFunction(({ cardId, defenderCharacter, sourceAbilityId }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.hostStarted === true
            && state?.core?.selectedCharacters?.['0'] === 'samurai'
            && state?.core?.selectedCharacters?.['1'] === defenderCharacter
            && state?.core?.players?.['0']?.resources?.CP === 2
            && state?.core?.players?.['0']?.hand?.length === 1
            && state?.core?.players?.['0']?.hand?.[0]?.id === cardId
            && (sourceAbilityId
                ? state?.core?.pendingAttack?.sourceAbilityId === sourceAbilityId
                : state?.core?.pendingAttack == null);
    }, options, { timeout: 30000, polling: 200 });
}

async function injectGunslingerHandCardScene(
    page: Page,
    options: {
        cardId: 'card-spin-the-chamber' | 'card-eat-my-lead';
        phase: 'main1' | 'offensiveRoll';
        diceValues?: number[];
    },
): Promise<void> {
    await page.evaluate(async ({ cardId, phase, diceValues }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        if (Array.isArray(diceValues) && diceValues.length > 0) {
            harness.dice.setValues(diceValues);
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [{ initHeroState }, { GUNSLINGER_CARDS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/heroes/gunslinger/cards.ts'),
        ]);

        const gunslingerBase = initHeroState('0', 'gunslinger', random as any);
        const monkBase = initHeroState('1', 'monk', random as any);
        const card = GUNSLINGER_CARDS.find((item: any) => item.id === cardId);
        if (!card) {
            throw new Error(`${cardId} not found`);
        }

        const values = Array.isArray(diceValues) && diceValues.length > 0
            ? diceValues
            : [1, 2, 3, 4, 5];
        const isOffensiveRoll = phase === 'offensiveRoll';

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase,
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'gunslinger',
                    '1': 'monk',
                },
                readyPlayers: {
                    ...(state.core.readyPlayers ?? {}),
                    '0': true,
                    '1': true,
                },
                players: {
                    ...state.core.players,
                    '0': {
                        ...gunslingerBase,
                        hand: [JSON.parse(JSON.stringify(card))],
                        discard: [],
                        resources: {
                            ...gunslingerBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                    },
                    '1': {
                        ...monkBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...monkBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                    },
                },
                pendingAttack: isOffensiveRoll
                    ? {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId: 'showdown',
                        damage: 6,
                        bonusDamage: 0,
                        attackModifierBonusDamage: 0,
                        damageResolved: false,
                        resolvedDamage: 0,
                        preDefenseResolved: false,
                        offensiveRollEndTokenResolved: false,
                    }
                    : null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                rollCount: isOffensiveRoll ? 1 : 0,
                rollConfirmed: isOffensiveRoll,
                dice: values.map((value: number, index: number) => ({
                    id: index,
                    value,
                    isKept: false,
                    playerId: '0',
                })),
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForGunslingerHandCardScene(
    page: Page,
    options: { cardId: 'card-spin-the-chamber' | 'card-eat-my-lead'; phase: 'main1' | 'offensiveRoll' },
): Promise<void> {
    await page.waitForFunction(({ cardId, phase }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === phase
            && state?.core?.activePlayerId === '0'
            && state?.core?.selectedCharacters?.['0'] === 'gunslinger'
            && state?.core?.selectedCharacters?.['1'] === 'monk'
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === cardId);
    }, options, { timeout: 30000, polling: 200 });
}

async function openForceActionsPanel(page: Page): Promise<void> {
    const mainFabButton = page.locator('[data-fab-id="chat"]');
    await expect(mainFabButton).toBeVisible({ timeout: 10000 });
    await mainFabButton.click();

    const forceActionsButton = page.locator('[data-fab-id="force-actions"]');
    await expect(forceActionsButton).toBeVisible({ timeout: 5000 });
    await forceActionsButton.click();

    await expect(page.getByTestId('fab-panel-force-actions')).toBeVisible({ timeout: 5000 });
}

async function closeCardSpotlightByRealClickIfVisible(page: Page): Promise<void> {
    const cardSpotlight = page.getByTestId('card-spotlight-overlay');
    const appeared = await cardSpotlight.waitFor({ state: 'visible', timeout: 2500 })
        .then(() => true)
        .catch(() => false);
    if (!appeared) return;

    const closeButton = cardSpotlight.getByRole('button', { name: /关闭特写|Close Spotlight|Close/i });
    await expect(closeButton).toBeVisible({ timeout: 3000 });
    await closeButton.click();
    await expect(cardSpotlight).toBeHidden({ timeout: 5000 });
}

async function injectSamuraiTokenResponseScene(
    page: Page,
    options: {
        mode: 'honor' | 'samurai-retribution';
        incomingDamage?: number;
        rollValues?: number[];
    },
): Promise<void> {
    await page.evaluate(async ({ mode, incomingDamage, rollValues }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        if (Array.isArray(rollValues) && rollValues.length > 0) {
            harness.dice.setValues(rollValues);
        }

        const damage = incomingDamage ?? (mode === 'honor' ? 4 : 5);
        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [{ initHeroState, ALL_TOKEN_DEFINITIONS }, { TOKEN_IDS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/domain/ids.ts'),
        ]);

        const samuraiBase = initHeroState('0', 'samurai', random as any);
        const opponentCharacter = mode === 'honor' ? 'monk' : 'paladin';
        const opponentBase = initHeroState('1', opponentCharacter, random as any);
        const samuraiTokens = {
            ...samuraiBase.tokens,
            // 真相源（tip.webp）标注荣誉（honor）堆叠上限为 2；E2E 注入场景也应保持“真实可达状态”。
            [TOKEN_IDS.HONOR]: mode === 'honor' ? 2 : 0,
            [TOKEN_IDS.SHAME]: 0,
            [TOKEN_IDS.SAMURAI_RETRIBUTION]: mode === 'samurai-retribution' ? 1 : 0,
        };

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: mode === 'honor' ? '0' : '1',
                hostStarted: true,
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'samurai',
                    '1': opponentCharacter,
                },
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false, playerId: mode === 'honor' ? '0' : '1' },
                    { id: 1, value: 2, isKept: false, playerId: mode === 'honor' ? '0' : '1' },
                    { id: 2, value: 3, isKept: false, playerId: mode === 'honor' ? '0' : '1' },
                    { id: 3, value: 4, isKept: false, playerId: mode === 'honor' ? '0' : '1' },
                    { id: 4, value: 5, isKept: false, playerId: mode === 'honor' ? '0' : '1' },
                ],
                players: {
                    ...state.core.players,
                    '0': {
                        ...samuraiBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...samuraiBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                        tokens: samuraiTokens,
                    },
                    '1': {
                        ...opponentBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...opponentBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                    },
                },
                pendingAttack: {
                    attackerId: mode === 'honor' ? '0' : '1',
                    defenderId: mode === 'honor' ? '1' : '0',
                    isDefendable: true,
                    sourceAbilityId: mode === 'honor' ? 'katana-slice-3' : 'revolver',
                    damage,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: false,
                    offensiveRollEndTokenResolved: false,
                },
                pendingDamage: {
                    id: `samurai-${mode}-window`,
                    sourcePlayerId: mode === 'honor' ? '0' : '1',
                    targetPlayerId: mode === 'honor' ? '1' : '0',
                    originalDamage: damage,
                    currentDamage: damage,
                    sourceAbilityId: mode === 'honor' ? 'katana-slice-3' : 'revolver',
                    responseType: mode === 'honor' ? 'beforeDamageDealt' : 'beforeDamageReceived',
                    responderId: '0',
                    isFullyEvaded: false,
                },
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForSamuraiTokenResponseScene(
    page: Page,
    options: { mode: 'honor' | 'samurai-retribution' },
): Promise<void> {
    await page.waitForFunction(({ mode }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingDamage?.id === `samurai-${mode}-window`
            && state?.core?.players?.['0']?.characterId === 'samurai'
            && Array.isArray(state?.core?.tokenDefinitions)
            && state.core.tokenDefinitions.length > 0;
    }, options, { timeout: 30000, polling: 200 });
}

async function injectGunslingerLoadedChoiceScene(
    page: Page,
    options: { quickDrawUpgraded?: boolean; sourceAbilityId?: string } = {},
): Promise<void> {
    await page.evaluate(async ({ quickDrawUpgraded, sourceAbilityId = 'revolver-3' }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        harness.dice.setValues([1]);

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [{ initHeroState, ALL_TOKEN_DEFINITIONS }, { TOKEN_IDS }, { QUICK_DRAW_UPGRADED }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/domain/ids.ts'),
            import('/src/games/dicethrone/heroes/gunslinger/abilities.ts'),
        ]);

        const gunslingerBase = initHeroState('0', 'gunslinger', random as any);
        const monkBase = initHeroState('1', 'monk', random as any);
        const gunslingerAbilities = quickDrawUpgraded
            ? gunslingerBase.abilities.map((ability: any) => ability.id === 'quick-draw' ? QUICK_DRAW_UPGRADED : ability)
            : gunslingerBase.abilities;

        const currentInteraction = {
            id: 'dt-interaction-gunslinger-loaded-scene',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: 'offensiveRollEndToken.title',
                sourceId: sourceAbilityId,
                options: [
                    {
                        id: 'loaded-option',
                        label: 'tokens.loaded.name',
                        value: { tokenId: TOKEN_IDS.LOADED, customId: 'use-loaded', value: 1 },
                    },
                    {
                        id: 'skip-option',
                        label: 'tokenResponse.skip',
                        value: { customId: 'skip', value: 0 },
                    },
                ],
            },
        };

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                flowHalted: true,
                interaction: {
                    current: currentInteraction,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'gunslinger',
                    '1': 'monk',
                },
                readyPlayers: {
                    ...(state.core.readyPlayers ?? {}),
                    '0': true,
                    '1': true,
                },
                players: {
                    ...state.core.players,
                    '0': {
                        ...gunslingerBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...gunslingerBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                        abilityLevels: {
                            ...gunslingerBase.abilityLevels,
                            ...(quickDrawUpgraded ? { 'quick-draw': 2 } : {}),
                        },
                        abilities: gunslingerAbilities,
                        tokens: {
                            ...gunslingerBase.tokens,
                            [TOKEN_IDS.LOADED]: 1,
                        },
                    },
                    '1': {
                        ...monkBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...monkBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                    },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId,
                    damage: 4,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: false,
                },
                pendingDamage: null,
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false, playerId: '0' },
                    { id: 1, value: 2, isKept: false, playerId: '0' },
                    { id: 2, value: 3, isKept: false, playerId: '0' },
                    { id: 3, value: 4, isKept: false, playerId: '0' },
                    { id: 4, value: 5, isKept: false, playerId: '0' },
                ],
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForGunslingerLoadedChoiceScene(page: Page, options: { sourceAbilityId?: string } = {}): Promise<void> {
    await page.waitForFunction(({ sourceAbilityId }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.players?.['0']?.characterId === 'gunslinger'
            && state?.core?.players?.['0']?.tokens?.loaded === 1
            && state?.sys?.interaction?.current?.id === 'dt-interaction-gunslinger-loaded-scene'
            && state?.core?.pendingAttack?.sourceAbilityId === (sourceAbilityId ?? 'revolver-3');
    }, options, { timeout: 30000, polling: 200 });
}

async function injectGunslingerTheLawInteractionScene(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [{ initHeroState }, { TOKEN_IDS, STATUS_IDS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/domain/ids.ts'),
        ]);

        const gunslinger = {
            ...initHeroState('0', 'gunslinger', random as any),
            nickname: '枪手',
        };
        const monk = {
            ...initHeroState('1', 'monk', random as any),
            nickname: '僧侣-A',
        };
        const paladin = {
            ...initHeroState('2', 'paladin', random as any),
            nickname: '圣骑士-B',
        };

        const currentInteraction = {
            id: 'dt-interaction-the-law-scene',
            kind: 'dt:card-interaction',
            playerId: '0',
            data: {
                id: 'the-law-scene',
                playerId: '0',
                sourceCardId: 'the-law',
                sourceId: 'the-law',
                type: 'selectPlayer',
                titleKey: 'interaction.gunslingerTheLaw',
                selectCount: 2,
                selected: [],
                targetPlayerIds: ['1', '2'],
                tokenGrantConfig: { tokenId: TOKEN_IDS.BOUNTY, amount: 1 },
                statusGrantConfig: { statusId: STATUS_IDS.KNOCKDOWN, amount: 1 },
            },
        };

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'main1',
                interaction: {
                    current: currentInteraction,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'gunslinger',
                    '1': 'monk',
                    '2': 'paladin',
                },
                readyPlayers: {
                    ...(state.core.readyPlayers ?? {}),
                    '0': true,
                    '1': true,
                    '2': true,
                },
                players: {
                    ...state.core.players,
                    '0': gunslinger,
                    '1': monk,
                    '2': paladin,
                },
                pendingAttack: null,
                rollCount: 0,
                rollConfirmed: false,
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    });
}

async function injectGunslingerTheLawPlayScene(
    page: Page,
    options: { multiplayer: boolean },
): Promise<void> {
    await page.evaluate(async ({ multiplayer }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [
            { initHeroState, createCharacterDice },
            { DEADEYE_2 },
            { GUNSLINGER_CARDS },
            { GUNSLINGER_DICE_FACE_IDS, TOKEN_IDS },
        ] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/heroes/gunslinger/abilities.ts'),
            import('/src/games/dicethrone/heroes/gunslinger/cards.ts'),
            import('/src/games/dicethrone/domain/ids.ts'),
        ]);

        const deadeyeUpgrade = GUNSLINGER_CARDS.find((card: any) => card.id === 'upgrade-deadeye-2');
        if (!deadeyeUpgrade) {
            throw new Error('upgrade-deadeye-2 not found');
        }

        const faceByValue: Record<number, string> = {
            1: GUNSLINGER_DICE_FACE_IDS.BULLET,
            2: GUNSLINGER_DICE_FACE_IDS.BULLET,
            3: GUNSLINGER_DICE_FACE_IDS.BULLET,
            4: GUNSLINGER_DICE_FACE_IDS.DASH,
            5: GUNSLINGER_DICE_FACE_IDS.DASH,
            6: GUNSLINGER_DICE_FACE_IDS.BULLSEYE,
        };
        const gunslinger = {
            ...initHeroState('0', 'gunslinger', random as any),
            nickname: '枪手',
            hand: [],
            discard: [],
            resources: {
                cp: 2,
                hp: 50,
            },
            tokens: {
                ...initHeroState('0', 'gunslinger', random as any).tokens,
                [TOKEN_IDS.LOADED]: 0,
                [TOKEN_IDS.EVASIVE]: 0,
            },
            abilityLevels: {
                ...initHeroState('0', 'gunslinger', random as any).abilityLevels,
                deadeye: 2,
            },
            abilities: initHeroState('0', 'gunslinger', random as any).abilities.map((ability: any) =>
                ability?.id === 'deadeye' ? JSON.parse(JSON.stringify(DEADEYE_2)) : ability
            ),
            upgradeCardByAbilityId: {
                ...initHeroState('0', 'gunslinger', random as any).upgradeCardByAbilityId,
                deadeye: { cardId: deadeyeUpgrade.id, cpCost: deadeyeUpgrade.cpCost },
            },
        };
        const monk = {
            ...initHeroState('1', 'monk', random as any),
            nickname: multiplayer ? '僧侣-A' : '僧侣',
            resources: {
                cp: 2,
                hp: 50,
            },
        };

        const players: Record<string, any> = {
            ...state.core.players,
            '0': gunslinger,
            '1': monk,
        };
        const selectedCharacters: Record<string, string> = {
            ...(state.core.selectedCharacters ?? {}),
            '0': 'gunslinger',
            '1': 'monk',
        };
        const readyPlayers: Record<string, boolean> = {
            ...(state.core.readyPlayers ?? {}),
            '0': true,
            '1': true,
        };

        if (multiplayer) {
            players['2'] = {
                ...initHeroState('2', 'paladin', random as any),
                nickname: '圣骑士-B',
                resources: {
                    cp: 2,
                    hp: 50,
                },
            };
            selectedCharacters['2'] = 'paladin';
            readyPlayers['2'] = true;
        }

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters,
                readyPlayers,
                players,
                pendingAttack: null,
                pendingDamage: undefined,
                phase: 'offensiveRoll',
                rollConfirmed: true,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                dice: createCharacterDice('gunslinger').map((die: any, index: number) => {
                    const values = [6, 6, 6, 1, 1];
                    const value = values[index];
                    const face = faceByValue[value];
                    return {
                        ...die,
                        value,
                        symbol: face,
                        symbols: [face],
                        isKept: false,
                    };
                }),
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForGunslingerTheLawPlayScene(
    page: Page,
    options: { multiplayer: boolean },
): Promise<void> {
    await page.waitForFunction(({ multiplayer }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.players?.['0']?.upgradeCardByAbilityId?.deadeye?.cardId === 'upgrade-deadeye-2'
            && state?.core?.selectedCharacters?.['0'] === 'gunslinger'
            && state?.core?.selectedCharacters?.['1'] === 'monk'
            && (multiplayer ? state?.core?.selectedCharacters?.['2'] === 'paladin' : !state?.core?.players?.['2']);
    }, options, { timeout: 30000, polling: 200 });
}

async function injectGunslingerMarkTheTargetPlayScene(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [
            { initHeroState, createCharacterDice },
            { TAKE_COVER_2 },
            { GUNSLINGER_CARDS },
            { GUNSLINGER_DICE_FACE_IDS, TOKEN_IDS },
        ] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/heroes/gunslinger/abilities.ts'),
            import('/src/games/dicethrone/heroes/gunslinger/cards.ts'),
            import('/src/games/dicethrone/domain/ids.ts'),
        ]);

        const takeCoverUpgrade = GUNSLINGER_CARDS.find((card: any) => card.id === 'upgrade-take-cover-2');
        if (!takeCoverUpgrade) {
            throw new Error('upgrade-take-cover-2 not found');
        }

        const faceByValue: Record<number, string> = {
            1: GUNSLINGER_DICE_FACE_IDS.BULLET,
            2: GUNSLINGER_DICE_FACE_IDS.BULLET,
            3: GUNSLINGER_DICE_FACE_IDS.BULLET,
            4: GUNSLINGER_DICE_FACE_IDS.DASH,
            5: GUNSLINGER_DICE_FACE_IDS.DASH,
            6: GUNSLINGER_DICE_FACE_IDS.BULLSEYE,
        };
        const values = [4, 4, 4, 1, 1];
        const gunslingerBase = initHeroState('0', 'gunslinger', random as any);
        const monkBase = initHeroState('1', 'monk', random as any);
        const paladinBase = initHeroState('2', 'paladin', random as any);
        const gunslinger = {
            ...gunslingerBase,
            nickname: '枪手',
            hand: [],
            discard: [],
            resources: {
                ...gunslingerBase.resources,
                cp: 2,
                hp: 50,
            },
            tokens: {
                ...gunslingerBase.tokens,
                [TOKEN_IDS.EVASIVE]: 0,
            },
            abilityLevels: {
                ...gunslingerBase.abilityLevels,
                'take-cover': 2,
            },
            abilities: gunslingerBase.abilities.map((ability: any) =>
                ability?.id === 'take-cover' ? JSON.parse(JSON.stringify(TAKE_COVER_2)) : ability
            ),
            upgradeCardByAbilityId: {
                ...gunslingerBase.upgradeCardByAbilityId,
                'take-cover': { cardId: takeCoverUpgrade.id, cpCost: takeCoverUpgrade.cpCost },
            },
        };

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': 'gunslinger',
                    '1': 'monk',
                    '2': 'paladin',
                },
                readyPlayers: {
                    ...(state.core.readyPlayers ?? {}),
                    '0': true,
                    '1': true,
                    '2': true,
                },
                players: {
                    ...state.core.players,
                    '0': gunslinger,
                    '1': {
                        ...monkBase,
                        nickname: '僧侣-A',
                        resources: { ...monkBase.resources, cp: 2, hp: 50 },
                    },
                    '2': {
                        ...paladinBase,
                        nickname: '圣骑士-B',
                        resources: { ...paladinBase.resources, cp: 2, hp: 50 },
                    },
                },
                pendingAttack: null,
                pendingDamage: undefined,
                phase: 'offensiveRoll',
                rollConfirmed: true,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                dice: createCharacterDice('gunslinger').map((die: any, index: number) => {
                    const value = values[index];
                    const face = faceByValue[value];
                    return {
                        ...die,
                        value,
                        symbol: face,
                        symbols: [face],
                        isKept: false,
                    };
                }),
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    });
}

async function waitForGunslingerMarkTheTargetPlayScene(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.selectedCharacters?.['0'] === 'gunslinger'
            && state?.core?.selectedCharacters?.['1'] === 'monk'
            && state?.core?.selectedCharacters?.['2'] === 'paladin'
            && state?.core?.players?.['0']?.upgradeCardByAbilityId?.['take-cover']?.cardId === 'upgrade-take-cover-2'
            && (state?.core?.players?.['0']?.abilityLevels?.['take-cover'] ?? 0) === 2;
    }, { timeout: 30000, polling: 200 });
}

async function dispatchHarnessCommand(
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> {
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
}

async function saveLocatorEvidenceScreenshot(
    locator: Locator,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
    name: string,
    filename: string,
): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename });
    await mkdir(dirname(path), { recursive: true });
    await locator.screenshot({ path });
    return path;
}

async function savePageEvidenceScreenshot(
    page: Page,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
    name: string,
    filename: string,
): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
}

async function injectHeroHandScreenshotScene(
    page: Page,
    options: {
        heroId: 'samurai' | 'gunslinger' | 'barbarian' | 'monk';
        opponentId: 'monk' | 'barbarian';
        handCardIds: string[];
    },
): Promise<void> {
    await page.evaluate(async ({ heroId, opponentId, handCardIds }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state) {
            throw new Error('TestHarness state not ready');
        }

        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [{ initHeroState }, heroModule] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            heroId === 'samurai'
                ? import('/src/games/dicethrone/heroes/samurai/cards.ts')
                : heroId === 'gunslinger'
                    ? import('/src/games/dicethrone/heroes/gunslinger/cards.ts')
                    : heroId === 'monk'
                        ? import('/src/games/dicethrone/heroes/monk/cards.ts')
                        : import('/src/games/dicethrone/heroes/barbarian/cards.ts'),
        ]);

        const heroCards = heroId === 'samurai'
            ? (heroModule as any).SAMURAI_CARDS
            : heroId === 'gunslinger'
                ? (heroModule as any).GUNSLINGER_CARDS
                : heroId === 'monk'
                    ? (heroModule as any).MONK_CARDS
                    : (heroModule as any).BARBARIAN_CARDS;

        const hand = handCardIds.map((cardId: string) => {
            const card = heroCards.find((entry: any) => entry.id === cardId);
            if (!card) {
                throw new Error(`Card ${cardId} not found for ${heroId}`);
            }
            return JSON.parse(JSON.stringify(card));
        });

        const heroBase = initHeroState('0', heroId, random as any);
        const opponentBase = initHeroState('1', opponentId, random as any);

        const nextState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'main1',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
            core: {
                ...state.core,
                activePlayerId: '0',
                hostStarted: true,
                selectedCharacters: {
                    ...(state.core.selectedCharacters ?? {}),
                    '0': heroId,
                    '1': opponentId,
                },
                readyPlayers: {
                    ...(state.core.readyPlayers ?? {}),
                    '0': true,
                    '1': true,
                },
                players: {
                    ...state.core.players,
                    '0': {
                        ...heroBase,
                        hand,
                        discard: [],
                        resources: {
                            ...heroBase.resources,
                            cp: 8,
                            hp: 50,
                        },
                    },
                    '1': {
                        ...opponentBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...opponentBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                    },
                },
                pendingAttack: null,
                pendingDamage: undefined,
                rollCount: 0,
                rollConfirmed: false,
            },
        };

        harness.state.set(nextState);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);
}

async function waitForHeroHandScreenshotScene(
    page: Page,
    options: {
        heroId: 'samurai' | 'gunslinger' | 'barbarian' | 'monk';
        handCardIds: string[];
    },
): Promise<void> {
    await page.waitForFunction(({ heroId, handCardIds }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const handIds = state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [];
        return state?.sys?.phase === 'main1'
            && state?.core?.selectedCharacters?.['0'] === heroId
            && handIds.length === handCardIds.length
            && handCardIds.every((cardId: string, index: number) => handIds[index] === cardId);
    }, options, { timeout: 30000, polling: 200 });
}

async function waitForHandCardsFlipped(
    page: Page,
    expectedCount: number,
): Promise<void> {
    await page.waitForFunction((count) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        const cards = Array.from(handArea.querySelectorAll('[data-card-id]'));
        const hasAtlasShimmer = handArea.querySelector('.atlas-shimmer') !== null;
        return cards.length === count
            && cards.every((card) => card.getAttribute('data-is-flipped') === 'true')
            && !hasAtlasShimmer;
    }, expectedCount, { timeout: 10000, polling: 100 });
    await page.waitForTimeout(300);
}

async function waitForHandCardFrontFacesReady(
    page: Page,
    expectedCount: number,
    expectedAssetFragment = 'ability-cards.webp',
): Promise<void> {
    await page.waitForFunction(({ count, assetFragment }) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        const cards = Array.from(handArea.querySelectorAll('[data-card-id]'));
        if (cards.length !== count) return false;

        return cards.every((card) => {
            const frontFace = card.querySelector('[data-card-face="front"]');
            if (!(frontFace instanceof HTMLElement)) return false;

            const previewNode = Array.from(frontFace.querySelectorAll('*')).find((node) => {
                if (!(node instanceof HTMLElement)) return false;
                const bgImage = window.getComputedStyle(node).backgroundImage;
                return Boolean(bgImage) && bgImage !== 'none' && bgImage.includes(assetFragment);
            });

            if (!(previewNode instanceof HTMLElement)) return false;

            const previewStyle = window.getComputedStyle(previewNode);
            const previewRect = previewNode.getBoundingClientRect();
            const faceStyle = window.getComputedStyle(frontFace);

            return previewRect.width > 0
                && previewRect.height > 0
                && previewStyle.backgroundImage !== 'none'
                && !previewStyle.backgroundImage.includes('gradient(')
                && faceStyle.backfaceVisibility === 'hidden';
        });
    }, { count: expectedCount, assetFragment: expectedAssetFragment }, { timeout: 10000, polling: 100 });
}

test('self watch out should show right-tray bonus dice confirmation', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['watch-out'],
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            currentRollContext: {
                id: 'roll:offensive:0:1',
                kind: 'offensive',
                ownerPlayerId: '0',
                targetPlayerId: '1',
                phase: 'offensiveRoll',
                dice: [1, 2, 3, 4, 5].map((value, index) => ({
                    id: index,
                    definitionId: 'moon_elf-dice',
                    value,
                    symbol: null,
                    symbols: [],
                    isKept: false,
                    ownerId: '0',
                })),
                status: 'settling',
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
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'lunar-eclipse',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'watch-out');
    }, { timeout: 10000 });

    await game.screenshot('01-initial-state', testInfo);

    const handArea = page.locator('[data-testid="hand-area"]');
    const handCards = handArea.locator('[data-card-id]');
    await expect(handCards).toHaveCount(1, { timeout: 10000 });

    const watchOutCard = page.locator('[data-card-id="watch-out"]').first();
    await watchOutCard.waitFor({ state: 'visible', timeout: 10000 });
    await dragHandCardToPlay(page, 'watch-out');

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
    const rightTray = getRightTrayDiceTray(page);
    await expect(rightTray.getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });
    await page.waitForTimeout(400);
    await expect(rightTray).toBeVisible({ timeout: 1000 });

    const afterClickState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const bonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
        return {
            player0Hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id),
            lastEventTypes: entries.slice(-4).map((entry: any) => entry.event?.type),
            bonusDieEffectKey: bonusDieEvent?.event?.payload?.effectKey,
        };
    });

    expect(afterClickState.bonusDieEffectKey).toMatch(/^bonusDie\.effect\.watchOut\.(bow|foot|moon)$/);

    await game.screenshot('02-after-play-card', testInfo);
    await game.screenshot('03-final-state', testInfo);

    expect(afterClickState.player0Hand).not.toContain('watch-out');
    expect(afterClickState.lastEventTypes).toContain('BONUS_DIE_ROLLED');
});

test('samurai and gunslinger hand area should show corrected hand card images', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);

    const handArea = page.locator('[data-testid="hand-area"]');

    await injectHeroHandScreenshotScene(page, {
        heroId: 'samurai',
        opponentId: 'monk',
        handCardIds: ['upgrade-solemnity-2', 'upgrade-masamune-2', 'upgrade-slot-06-2'],
    });
    await waitForHeroHandScreenshotScene(page, {
        heroId: 'samurai',
        handCardIds: ['upgrade-solemnity-2', 'upgrade-masamune-2', 'upgrade-slot-06-2'],
    });
    await expect(handArea.locator('[data-card-id]')).toHaveCount(3, { timeout: 10000 });
    await waitForHandCardsFlipped(page, 3);
    await waitForHandCardFrontFacesReady(page, 3);
    await saveLocatorEvidenceScreenshot(
        handArea,
        testInfo,
        '10-samurai-hand-area',
        '10-samurai-hand-area.png',
    );

    await injectHeroHandScreenshotScene(page, {
        heroId: 'gunslinger',
        opponentId: 'monk',
        handCardIds: [
            'upgrade-fan-the-hammer-2',
            'upgrade-take-cover-2',
            'upgrade-deadeye-2',
            'card-wanted',
            'card-spin-the-chamber',
            'card-high-noon',
        ],
    });
    await waitForHeroHandScreenshotScene(page, {
        heroId: 'gunslinger',
        handCardIds: [
            'upgrade-fan-the-hammer-2',
            'upgrade-take-cover-2',
            'upgrade-deadeye-2',
            'card-wanted',
            'card-spin-the-chamber',
            'card-high-noon',
        ],
    });
    await expect(handArea.locator('[data-card-id]')).toHaveCount(6, { timeout: 10000 });
    await waitForHandCardsFlipped(page, 6);
    await waitForHandCardFrontFacesReady(page, 6);
    await saveLocatorEvidenceScreenshot(
        handArea,
        testInfo,
        '11-gunslinger-hand-area',
        '11-gunslinger-hand-area.png',
    );

    await injectHeroHandScreenshotScene(page, {
        heroId: 'monk',
        opponentId: 'barbarian',
        handCardIds: ['card-enlightenment', 'card-inner-peace', 'card-deep-thought'],
    });
    await waitForHeroHandScreenshotScene(page, {
        heroId: 'monk',
        handCardIds: ['card-enlightenment', 'card-inner-peace', 'card-deep-thought'],
    });
    await expect(handArea.locator('[data-card-id]')).toHaveCount(3, { timeout: 10000 });
    await waitForHandCardsFlipped(page, 3);
    await waitForHandCardFrontFacesReady(page, 3);
    await saveLocatorEvidenceScreenshot(
        handArea,
        testInfo,
        '12-monk-hand-area-reference',
        '12-monk-hand-area-reference.png',
    );
});

test('gunslinger hand area should recover after first atlas load failure without manual refresh', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);

    await page.evaluate(() => {
        (window as any).__BG_ASSET_CACHE__?.preloadedImages?.clear?.();
        const OriginalImage = window.Image;
        if ((window as any).__BG_FAIL_GUNSLINGER_ATLAS_PATCHED__) {
            (window as any).__BG_GUNSLINGER_ATLAS_FAIL_COUNT__ = 0;
            return;
        }

        let failed = false;
        class FailFirstGunslingerAtlasImage extends OriginalImage {
            get src() {
                return super.src;
            }

            set src(value: string) {
                if (!failed && typeof value === 'string' && value.includes('/dicethrone/images/gunslinger/compressed/ability-cards.webp')) {
                    failed = true;
                    (window as any).__BG_GUNSLINGER_ATLAS_FAIL_COUNT__ = ((window as any).__BG_GUNSLINGER_ATLAS_FAIL_COUNT__ ?? 0) + 1;
                    window.setTimeout(() => {
                        this.onerror?.(new Event('error'));
                    }, 0);
                    return;
                }
                super.src = value;
            }
        }

        (window as any).__BG_FAIL_GUNSLINGER_ATLAS_PATCHED__ = true;
        (window as any).__BG_GUNSLINGER_ATLAS_FAIL_COUNT__ = 0;
        (window as any).Image = FailFirstGunslingerAtlasImage;
    });

    const handArea = page.locator('[data-testid="hand-area"]');
    await injectHeroHandScreenshotScene(page, {
        heroId: 'gunslinger',
        opponentId: 'monk',
        handCardIds: [
            'upgrade-fan-the-hammer-2',
            'upgrade-take-cover-2',
            'upgrade-deadeye-2',
            'card-wanted',
            'card-spin-the-chamber',
            'card-high-noon',
        ],
    });
    await page.waitForFunction((handCardIds) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const handIds = state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [];
        return state?.core?.selectedCharacters?.['0'] === 'gunslinger'
            && handIds.length === handCardIds.length
            && handCardIds.every((cardId: string, index: number) => handIds[index] === cardId);
    }, [
        'upgrade-fan-the-hammer-2',
        'upgrade-take-cover-2',
        'upgrade-deadeye-2',
        'card-wanted',
        'card-spin-the-chamber',
        'card-high-noon',
    ], { timeout: 10000, polling: 200 });
    await expect(handArea.locator('[data-card-id]')).toHaveCount(6, { timeout: 10000 });
    await waitForHandCardsFlipped(page, 6);
    await waitForHandCardFrontFacesReady(page, 6);

    const failCount = await page.evaluate(() => (window as any).__BG_GUNSLINGER_ATLAS_FAIL_COUNT__ ?? 0);
    expect(failCount).toBe(1);

    await saveLocatorEvidenceScreenshot(
        handArea,
        testInfo,
        '13-gunslinger-hand-area-auto-retry-after-fail',
        '13-gunslinger-hand-area-auto-retry-after-fail.png',
    );
});

test('bonus die right tray should ignore backdrop click and settle only on ordinary confirm', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['watch-out'],
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            currentRollContext: {
                id: 'roll:offensive:0:1',
                kind: 'offensive',
                ownerPlayerId: '0',
                targetPlayerId: '1',
                phase: 'offensiveRoll',
                dice: [1, 2, 3, 4, 5].map((value, index) => ({
                    id: index,
                    definitionId: 'moon_elf-dice',
                    value,
                    symbol: null,
                    symbols: [],
                    isKept: false,
                    ownerId: '0',
                })),
                status: 'settling',
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
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'lunar-eclipse',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.rollConfirmed === true
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'watch-out');
    }, { timeout: 10000 });

    const watchOutCard = page.locator('[data-card-id="watch-out"]').first();
    await watchOutCard.waitFor({ state: 'visible', timeout: 10000 });
    await dragHandCardToPlay(page, 'watch-out');

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());

    await page.waitForTimeout(250);
    await page.mouse.click(40, 40);
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.core?.pendingBonusDiceSettlement ?? null;
    }, { timeout: 5000 }).not.toBeNull();

    await settleCurrentBonusDice(page, () => game.getState(), {});

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
            currentRollKind: state?.core?.currentRollContext?.kind ?? null,
            currentRollStatus: state?.core?.currentRollContext?.status ?? null,
            replayOnly: state?.core?.currentRollContext?.display?.replayOnly ?? null,
            settlementStage: state?.core?.pendingAttack?.settlementStage ?? null,
            bonusDiceResolved: state?.core?.pendingAttack?.bonusDiceResolved ?? false,
        };
    }, { timeout: 10000 }).toMatchObject({
        pendingBonusDiceSettlement: null,
        currentRollKind: 'offensive',
        replayOnly: false,
        settlementStage: 'readyToResolve',
        bonusDiceResolved: true,
    });

    await expect(page.getByRole('button', { name: '结算攻击' })).toBeVisible({ timeout: 10000 });

    await game.screenshot('04-bonus-die-right-tray-backdrop-ignored-then-confirm', testInfo);
});

test('bonus die right tray should settle on ordinary confirm in display mode', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);
    await clearEvidenceScreenshotsForTest(testInfo);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['watch-out'],
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'lunar-eclipse',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'watch-out');
    }, { timeout: 10000 });

    const watchOutCard = page.locator('[data-card-id="watch-out"]').first();
    await watchOutCard.waitFor({ state: 'visible', timeout: 10000 });
    await dragHandCardToPlay(page, 'watch-out');

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
    await savePageEvidenceScreenshot(
        page,
        testInfo,
        'bonus-die-right-tray-should-confirm-in-display-mode',
        '05-bonus-die-right-tray-visible-before-confirm.png',
    );

    await page.waitForTimeout(250);
    await settleCurrentBonusDice(page, () => game.getState(), {});

    await savePageEvidenceScreenshot(
        page,
        testInfo,
        'bonus-die-right-tray-should-confirm-in-display-mode',
        '06-bonus-die-right-tray-after-confirm.png',
    );
});

test('opponent display-only bonus settlement should keep central bonus dice presentation absent', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await waitForDiceThroneHarness(page, 40000);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
            hand: ['watch-out'],
        },
        currentPlayer: '0',
        phase: 'main1',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
        },
    });
    await expect(page.locator('[data-testid="hand-area"]')).toBeVisible({ timeout: 40000 });

    const baseState = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness?.state?.get?.() ?? null;
    });
    if (!baseState) {
        throw new Error('TestHarness state not ready');
    }
    const nextState = cloneJson(baseState);

    const cardTimestamp = 4800;
    const bonusTimestamp = 5000;
    const bonusDice = [
        { index: 0, value: 1, face: 'bow', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 1 } },
        { index: 1, value: 2, face: 'bow', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 2 } },
    ];

    nextState.core = {
        ...(nextState.core ?? {}),
        activePlayerId: '0',
        pendingBonusDiceSettlement: {
            id: 'watch-out',
            sourceAbilityId: 'watch-out',
            attackerId: '1',
            targetId: '0',
            dice: bonusDice,
            rerollCostTokenId: 'cp',
            rerollCostAmount: 1,
            rerollCount: 0,
            maxRerollCount: 1,
            rerollEffectKey: 'bonusDie.effect.watchOut.bow',
            readyToSettle: false,
            displayOnly: true,
        },
    };

    const baseEntries = (nextState.sys?.eventStream?.entries ?? []) as Array<{ id: number }>;
    const baseMaxId = baseEntries.reduce((max, entry) => Math.max(max, entry.id ?? 0), 0);
    const eventEntries = [
        {
            id: baseMaxId + 1,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'watch-out',
                },
                timestamp: cardTimestamp,
            },
        },
        {
            id: baseMaxId + 2,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '1',
                    targetPlayerId: '0',
                    value: 1,
                    face: 'bow',
                    effectKey: 'bonusDie.effect.watchOut.bow',
                    effectParams: { value: 1, index: 0 },
                },
                timestamp: bonusTimestamp,
            },
        },
        {
            id: baseMaxId + 3,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '1',
                    targetPlayerId: '0',
                    value: 2,
                    face: 'bow',
                    effectKey: 'bonusDie.effect.watchOut.bow',
                    effectParams: { value: 2, index: 1 },
                },
                timestamp: bonusTimestamp + 1,
            },
        },
        {
            id: baseMaxId + 4,
            event: {
                type: 'BONUS_DICE_REROLL_REQUESTED',
                payload: {
                    settlement: {
                        id: 'watch-out',
                        sourceAbilityId: 'watch-out',
                        attackerId: '1',
                        targetId: '0',
                        dice: bonusDice,
                        rerollCostTokenId: 'cp',
                        rerollCostAmount: 1,
                        rerollCount: 0,
                        maxRerollCount: 1,
                        rerollEffectKey: 'bonusDie.effect.watchOut.bow',
                        readyToSettle: false,
                        displayOnly: true,
                    },
                },
                timestamp: bonusTimestamp,
            },
        },
    ];

    await page.evaluate((state) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.set) {
            throw new Error('TestHarness state not ready');
        }
        harness.state.set(state);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, nextState);

    await page.waitForTimeout(200);

    await page.evaluate((entries) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness?.state?.set || !state) {
            throw new Error('TestHarness state not ready');
        }
        harness.state.set({
            ...state,
            sys: {
                ...state.sys,
                eventStream: {
                    ...state.sys?.eventStream,
                    entries: [...(state.sys?.eventStream?.entries ?? []), ...entries],
                },
            },
        });
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    }, eventEntries);
    await ensureDebugPanelClosed(page);

    const cardSpotlight = page.locator('[data-testid="card-spotlight-overlay"]');
    await expect(cardSpotlight).toBeVisible({ timeout: 5000 });
    await expectNoCentralBonusDicePresentation(page);
    await page.waitForTimeout(3600);
    await expect(cardSpotlight).toBeVisible({ timeout: 1000 });
    await expect(cardSpotlight.getByRole('button', { name: /关闭特写|Close Spotlight|Close/i })).toBeVisible({ timeout: 1000 });

    await saveLocatorEvidenceScreenshot(
        cardSpotlight,
        testInfo,
        'opponent-display-only-bonus-settlement-no-duplicate-overlay',
        '01-opponent-card-spotlight-without-central-dice.png',
    );
    await page.waitForTimeout(600);

    const visibleBonusOverlayCount = await page
        .locator('[data-testid="bonus-die-overlay"]')
        .evaluateAll((nodes) => nodes.filter((node) => {
            const element = node as HTMLElement;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && rect.width > 0
                && rect.height > 0;
        }).length);
    expect(visibleBonusOverlayCount).toBe(0);

    await savePageEvidenceScreenshot(
        page,
        testInfo,
        'opponent-display-only-bonus-settlement-no-duplicate-overlay',
        '02-opponent-no-duplicate-bonus-overlay.png',
    );
});

test('crit bonus damage should not show attack-modifier badge', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: {
                CP: 3,
                HP: 11,
            },
            tokens: {
                crit: 0,
                accuracy: 0,
                protect: 0,
                retribution: 0,
                blessing_of_divinity: 0,
                tithes_upgraded: 0,
            },
        },
        player1: {
            resources: {
                CP: 1,
                HP: 26,
            },
        },
        currentPlayer: '0',
        phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'paladin', '1': 'moon_elf' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 4, isKept: false },
                { id: 1, value: 5, isKept: false },
                { id: 2, value: 2, isKept: false },
                { id: 3, value: 2, isKept: false },
                { id: 4, value: 3, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'holy-strike-2-small',
                damageResolved: false,
                resolvedDamage: 0,
                preDefenseResolved: true,
                offensiveRollEndTokenResolved: true,
                bonusDamage: 4,
                attackModifierBonusDamage: 0,
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'defensiveRoll'
            && state?.core?.pendingAttack?.bonusDamage === 4
            && state?.core?.pendingAttack?.attackModifierBonusDamage === 0;
    }, { timeout: 10000 });

    await page.waitForTimeout(1000);

    const badge = page.locator('[data-testid="attack-modifier-bonus-badge"]');
    await expect(badge).toHaveCount(0);

    const uiState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return {
            phase: state?.sys?.phase,
            bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
            attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? null,
            badgeCount: document.querySelectorAll('[data-testid="attack-modifier-bonus-badge"]').length,
        };
    });

    expect(uiState.phase).toBe('defensiveRoll');
    expect(uiState.bonusDamage).toBe(4);
    expect(uiState.attackModifierBonusDamage).toBe(0);
    expect(uiState.badgeCount).toBe(0);

    await game.screenshot('06-crit-no-attack-modifier-badge', testInfo);
});

test('attack modifier should show the correct timing prompt after invalid play', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectPyromancerAttackModifierScene(page, { sourceAbilityId: null });
    await waitForPyromancerAttackModifierScene(page, { sourceAbilityId: null });

    await dragHandCardToPlay(page, 'card-red-hot');

    await page.waitForFunction(() => {
        const reject = (window as any).__BG_LAST_COMMAND_REJECTED__;
        return reject?.error === 'attackModifierRequiresSelectedAttack';
    }, { timeout: 10000, polling: 200 });

    const timingPrompt = page.getByText(/attackModifierRequiresSelectedAttack|select an attack ability before playing this attack modifier|请先选择一个攻击技能，再打出此攻击修正牌/i).first();
    await expect(timingPrompt).toBeVisible({ timeout: 5000 });

    const rejectState = await page.evaluate(() => ({
        reject: (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null,
        hand: (window as any).__BG_TEST_HARNESS__?.state?.get()?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
    }));

    expect(rejectState.reject).toMatchObject({
        gameId: 'dicethrone',
        error: 'attackModifierRequiresSelectedAttack',
        commandType: 'PLAY_CARD',
    });
    expect(rejectState.hand).toContain('card-red-hot');

    await game.screenshot('07-attack-modifier-timing-prompt', testInfo);
});

test('selected attack should show visible attack-modifier ui above the dice tray', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectPyromancerAttackModifierScene(page, { sourceAbilityId: 'meteor' });
    await waitForPyromancerAttackModifierScene(page, { sourceAbilityId: 'meteor' });
    await dragHandCardToPlay(page, 'card-red-hot');

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.core?.pendingAttack?.attackModifierBonusDamage === 2;
    }, { timeout: 10000, polling: 200 });

    const activeBadge = page.locator('[data-testid="active-modifier-badge"]');
    const diceTray = page.locator('[data-tutorial-id="dice-tray"]');

    await expect(activeBadge).toBeVisible({ timeout: 5000 });
    await expect(diceTray).toBeVisible({ timeout: 5000 });
    await expect(activeBadge).toContainText('+2', { timeout: 5000 });
    await expect(page.locator('[data-testid="attack-modifier-bonus-badge"]')).toHaveCount(0);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    await expectElementInsideViewport(activeBadge, 'active modifier badge', viewport!.width, viewport!.height);

    const [badgeBox, diceTrayBox] = await Promise.all([
        activeBadge.boundingBox(),
        diceTray.boundingBox(),
    ]);
    expect(badgeBox).not.toBeNull();
    expect(diceTrayBox).not.toBeNull();
    const badgeCenterX = badgeBox!.x + badgeBox!.width / 2;
    const diceTrayCenterX = diceTrayBox!.x + diceTrayBox!.width / 2;
    const centerDelta = Math.abs(badgeCenterX - diceTrayCenterX);
    expect(centerDelta, `攻击修正徽章应与骰盘列水平对齐，当前中心偏差 ${centerDelta.toFixed(2)}px`).toBeLessThanOrEqual(2);

    await game.screenshot('08-attack-modifier-ui-visible', testInfo);

    // 旋转状态截图：放开投掷限制并触发一次投掷动画
    const coreState = await readCoreState(page);
    await applyCoreStateDirect(page, {
        ...coreState,
        rollConfirmed: false,
        rollCount: 0,
    });
    await ensureDebugPanelClosed(page);

    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    await expect(rollButton).toBeVisible({ timeout: 5000 });
    await rollButton.click();
    await page.locator('[data-testid="dice-2d"].animate-pulse').first().waitFor({ state: 'visible', timeout: 5000 });
    await game.screenshot('08-attack-modifier-ui-rolling', testInfo);

    await activeBadge.hover();
    await expect(page.getByText(/modifierActive\.tooltip|must be played after selecting an attack ability|attack modifier|已激活的攻击修正牌|攻击修正牌/i).first()).toBeVisible({
        timeout: 5000,
    });
});

test.skip('samurai righteousness should resolve a visible bonus-die branch against monk', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectSamuraiAttackModifierScene(page, {
        cardId: 'card-righteousness',
        defenderCharacter: 'monk',
        sourceAbilityId: 'katana-slice-3',
    });
    await waitForSamuraiAttackModifierScene(page, {
        cardId: 'card-righteousness',
        defenderCharacter: 'monk',
        sourceAbilityId: 'katana-slice-3',
    });

    await page.evaluate(() => {
        (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([1]);
    });
    await dragHandCardToPlay(page, 'card-righteousness');

    // 攻击修正徽章应在打出卡牌后出现（效果提示，不代表必须延迟到关闭特写才生效）
    const activeBadgeEarly = page.locator('[data-testid="active-modifier-badge"]').first();
    await expect(activeBadgeEarly).toBeVisible({ timeout: 5000 });
    await game.screenshot('09-samurai-righteousness-badge-after-play', testInfo);

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'card-righteousness' });
    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });
    await game.screenshot('09-samurai-righteousness-bonus-die-right-tray', testInfo);

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.core?.pendingAttack?.sourceAbilityId === 'katana-slice-3'
            && state?.core?.pendingAttack?.bonusDamage === 2
            && state?.core?.pendingAttack?.attackModifierBonusDamage === 2;
    }, { timeout: 10000, polling: 200 });

    const activeBadge = page.locator('[data-testid="active-modifier-badge"]');
    await expect(activeBadge).toBeVisible({ timeout: 5000 });
    await expect(activeBadge).toContainText('+2', { timeout: 5000 });

    const stateAfterPlay = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
        return {
            hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            eventTypes: entries.slice(-6).map((entry: any) => entry.event?.type),
            effectKey: latestBonusDieEvent?.event?.payload?.effectKey ?? null,
            shame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
        };
    });

    expect(stateAfterPlay.hand).not.toContain('card-righteousness');
    expect(stateAfterPlay.eventTypes).toContain('CARD_PLAYED');
    expect(stateAfterPlay.eventTypes).toContain('BONUS_DIE_ROLLED');
    expect(stateAfterPlay.effectKey).toBe('bonusDie.effect.samuraiRighteousnessKatana');
    expect(stateAfterPlay.shame).toBe(0);

    await game.screenshot('09-samurai-righteousness-vs-monk', testInfo);
});

test.skip('samurai zanshin should show 5-die settlement and mixed samurai effects against paladin', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectSamuraiAttackModifierScene(page, {
        cardId: 'card-zanshin',
        defenderCharacter: 'paladin',
        sourceAbilityId: 'katana-slice-3',
        diceValues: [1, 4, 6, 6, 2],
    });
    await waitForSamuraiAttackModifierScene(page, {
        cardId: 'card-zanshin',
        defenderCharacter: 'paladin',
        sourceAbilityId: 'katana-slice-3',
    });

    await dragHandCardToPlay(page, 'card-zanshin');

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'card-zanshin' });

    await page.waitForFunction(() => {
        const settlement = (window as any).__BG_TEST_HARNESS__?.state?.get()?.core?.pendingBonusDiceSettlement;
        return settlement?.displayOnly === true && settlement?.dice?.length === 5;
    }, { timeout: 10000, polling: 200 });

    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(5, { timeout: 5000 });

    const activeBadge = page.locator('[data-testid="active-modifier-badge"]');
    await expect(activeBadge).toBeVisible({ timeout: 5000 });
    await expect(activeBadge).toContainText('+2', { timeout: 5000 });

    const stateAfterPlay = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        return {
            hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            lastEventTypes: entries.slice(-10).map((entry: any) => entry.event?.type),
            bonusDieEventCount: entries.filter((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED').length,
            settlement: state?.core?.pendingBonusDiceSettlement
                ? {
                    diceCount: state.core.pendingBonusDiceSettlement.dice?.length ?? 0,
                    displayOnly: state.core.pendingBonusDiceSettlement.displayOnly,
                }
                : null,
            attackBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
            totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
            paladinShame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
            samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
        };
    });

    expect(stateAfterPlay.hand).not.toContain('card-zanshin');
    expect(stateAfterPlay.lastEventTypes).toContain('CARD_PLAYED');
    expect(stateAfterPlay.lastEventTypes).toContain('BONUS_DIE_ROLLED');
    expect(stateAfterPlay.bonusDieEventCount).toBeGreaterThanOrEqual(5);
    expect(stateAfterPlay.settlement).toEqual({ diceCount: 5, displayOnly: true });
    expect(stateAfterPlay.attackBonusDamage).toBe(2);
    expect(stateAfterPlay.totalBonusDamage).toBe(2);
    expect(stateAfterPlay.paladinShame).toBe(1);
    // 真相源（tip.webp）标注反击（samurai_retribution）堆叠上限为 1；即使掷出 2 个旭日，授予也应被 clamp
    expect(stateAfterPlay.samuraiRetribution).toBe(1);

    await game.screenshot('10-samurai-zanshin-vs-paladin', testInfo);
});

test('pyromancer pyro blast II should show and close a two-dice display-only bonus settlement', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectPyromancerPyroBlast2DisplayScene(page);
    await waitForPyromancerPyroBlast2DisplayScene(page);

    await page.evaluate(() => {
        (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([1, 6]);
        (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
    });

    await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: 'pyro-blast' });
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            commandRejected: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        };
    }, { timeout: 5000 }).toMatchObject({
        sourceAbilityId: 'pyro-blast',
        commandRejected: null,
    });

    await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingBonusDiceSettlement?.displayOnly === true
            && state?.core?.pendingBonusDiceSettlement?.dice?.length === 2
            && state?.core?.pendingBonusDiceSettlement?.sourceAbilityId === 'pyro-blast';
    }, { timeout: 10000, polling: 200 });

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'pyro-blast' });
    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(2, { timeout: 5000 });
    await game.screenshot('11-pyromancer-pyro-blast-2-display-right-tray', testInfo);
    await savePageEvidenceScreenshot(
        page,
        testInfo,
        'pyromancer-pyro-blast-2-display-page',
        '11-pyromancer-pyro-blast-2-display-right-tray-page.png',
    );

    await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'pyro-blast' });
    await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [1, 6] });
    await game.screenshot('11-pyromancer-pyro-blast-2-display-confirmed-review', testInfo);

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
            commandRejected: await page.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null),
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'main2',
        pendingBonusDiceSettlement: null,
        commandRejected: null,
    });
    await game.screenshot('11-pyromancer-pyro-blast-2-display-settled', testInfo);
});

test('samurai righteousness should resolve a valid branch against monk', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectSamuraiAttackModifierScene(page, {
        cardId: 'card-righteousness',
        defenderCharacter: 'monk',
        sourceAbilityId: 'katana-slice-3',
        diceValues: [1],
    });
    await waitForSamuraiAttackModifierScene(page, {
        cardId: 'card-righteousness',
        defenderCharacter: 'monk',
        sourceAbilityId: 'katana-slice-3',
    });

    await page.evaluate(() => {
        (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([1]);
    });
    await dragHandCardToPlay(page, 'card-righteousness');
    await closeCardSpotlightByRealClickIfVisible(page);

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'card-righteousness' });
    await page.waitForTimeout(250);
    await expect(getRightTrayDiceTray(page)).toBeVisible({ timeout: 1000 });
    await game.screenshot('09-samurai-righteousness-bonus-die-right-tray', testInfo);

    // 攻击修正徽章应在打出卡牌后出现（效果提示）
    const activeBadgeEarly = page.locator('[data-testid="active-modifier-badge"]').first();
    await expect(activeBadgeEarly).toBeVisible({ timeout: 5000 });
    await game.screenshot('09-samurai-righteousness-badge-after-play', testInfo);

    // 成功证据以“业务状态 + 最终效果文案”为准，避免依赖短暂的 animate-pulse 视觉态。
    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
        return state?.core?.pendingAttack?.sourceAbilityId === 'katana-slice-3'
            && state?.core?.players?.['0']?.hand?.every((card: any) => card.id !== 'card-righteousness')
            && latestBonusDieEvent?.event?.payload?.effectKey === 'bonusDie.effect.samuraiRighteousnessKatana';
    }, { timeout: 10000, polling: 200 });

    const stateAfterPlay = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
        return {
            hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            eventTypes: entries.slice(-6).map((entry: any) => entry.event?.type),
            effectKey: latestBonusDieEvent?.event?.payload?.effectKey ?? null,
            shame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
            samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
            attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
            totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
        };
    });

    expect(stateAfterPlay.hand).not.toContain('card-righteousness');
    expect(stateAfterPlay.eventTypes).toContain('CARD_PLAYED');
    expect(stateAfterPlay.eventTypes).toContain('BONUS_DIE_ROLLED');
    expect(stateAfterPlay.effectKey).toBe('bonusDie.effect.samuraiRighteousnessKatana');

    const activeBadge = page.locator('[data-testid="active-modifier-badge"]');
    await expect(activeBadge).toBeVisible({ timeout: 5000 });
    await expect(activeBadge).toContainText(/攻击修正\s*\+2|Attack Modifier\s*\+2/i, { timeout: 5000 });
    expect(stateAfterPlay.attackModifierBonusDamage).toBe(2);
    expect(stateAfterPlay.totalBonusDamage).toBe(2);
    expect(stateAfterPlay.shame).toBe(0);
    expect(stateAfterPlay.samuraiRetribution).toBe(0);

    await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'card-righteousness' });
    await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [1] });
    await game.screenshot('09-samurai-righteousness-bonus-die-confirmed-review', testInfo);
    await game.screenshot('09-samurai-righteousness-settled', testInfo);

    await game.screenshot('09-samurai-righteousness-vs-monk', testInfo);
});

test('online samurai righteousness bonus dice should remain in the right tray until ordinary confirm', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, 'online setup unavailable in current environment');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup;

    try {
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'samurai');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForTestHarness(hostPage, 10000);
        await waitForTestHarness(guestPage, 10000);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        const matchState = await readMatchStateFromDebugPanel(hostPage);
        const injectedState = cloneJson(matchState);
        const samuraiCard = SAMURAI_CARDS.find((card) => card.id === 'card-righteousness');
        if (!samuraiCard) {
            throw new Error('card-righteousness not found');
        }

        injectedState.sys = {
            ...(injectedState.sys ?? {}),
            phase: 'offensiveRoll',
            interaction: {
                current: undefined,
                queue: [],
            },
            responseWindow: {
                current: undefined,
            },
        };
        injectedState.core = {
            ...(injectedState.core ?? {}),
            activePlayerId: '1',
            hostStarted: true,
            selectedCharacters: {
                ...(injectedState.core?.selectedCharacters ?? {}),
                '0': 'monk',
                '1': 'samurai',
            },
            readyPlayers: {
                ...(injectedState.core?.readyPlayers ?? {}),
                '0': true,
                '1': true,
            },
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false, playerId: '1' },
                { id: 1, value: 1, isKept: false, playerId: '1' },
                { id: 2, value: 1, isKept: false, playerId: '1' },
                { id: 3, value: 4, isKept: false, playerId: '1' },
                { id: 4, value: 4, isKept: false, playerId: '1' },
            ],
            players: {
                ...(injectedState.core?.players ?? {}),
                '0': {
                    ...(injectedState.core?.players?.['0'] ?? {}),
                    resources: {
                        ...(injectedState.core?.players?.['0']?.resources ?? {}),
                        CP: 2,
                        HP: 50,
                    },
                },
                '1': {
                    ...(injectedState.core?.players?.['1'] ?? {}),
                    hand: [cloneJson(samuraiCard)],
                    discard: [],
                    resources: {
                        ...(injectedState.core?.players?.['1']?.resources ?? {}),
                        CP: 2,
                        HP: 50,
                    },
                },
            },
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                isDefendable: true,
                sourceAbilityId: 'katana-slice-3',
                damage: 6,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
                preDefenseResolved: false,
                offensiveRollEndTokenResolved: false,
            },
            pendingBonusDiceSettlement: undefined,
        };

        await applyFullStateDirect(hostPage, injectedState);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'offensiveRoll'
                && state?.core?.activePlayerId === '1'
                && state?.core?.selectedCharacters?.['1'] === 'samurai'
                && state?.core?.players?.['1']?.hand?.[0]?.id === 'card-righteousness'
                && state?.core?.pendingAttack?.sourceAbilityId === 'katana-slice-3';
        }, { timeout: 15000, polling: 200 });

        await guestPage.evaluate(() => {
            (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([1]);
            (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
        });
        await waitForHandCardVisualReady(guestPage, 'card-righteousness');

        const righteousnessCard = guestPage.locator('[data-testid="hand-area"] [data-card-id="card-righteousness"]').first();
        await expect(righteousnessCard).toBeVisible({ timeout: 10000 });
        await dragHandCardToPlay(guestPage, 'card-righteousness');
        await closeCardSpotlightByRealClickIfVisible(guestPage);

        await expectRightTrayBonusDiceConfirmation(guestPage, async () => (
            await guestPage.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.())
        ), { sourceAbilityId: 'card-righteousness' });
        await expect(guestPage.getByTestId('dicethrone-2d-dice-tray').getByTestId('dice-2d')).toHaveCount(2);
        await savePageEvidenceScreenshot(
            guestPage,
            testInfo,
            'online-samurai-righteousness-right-tray-before-confirm',
            '11-online-samurai-righteousness-right-tray-before-confirm.png',
        );

        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.pendingBonusDiceSettlement?.attackerId === '1'
                && state?.core?.pendingBonusDiceSettlement?.displayOnly === true;
        }, { timeout: 10000, polling: 200 });

        await settleCurrentBonusDice(guestPage, async () => (
            await guestPage.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.())
        ), { sourceAbilityId: 'card-righteousness' });

        await expect.poll(async () => {
            const state = await guestPage.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.());
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            interactionKind: null,
            pendingBonusDiceSettlement: null,
        });

        await savePageEvidenceScreenshot(
            guestPage,
            testInfo,
            'online-samurai-righteousness-right-tray-after-confirm',
            '12-online-samurai-righteousness-right-tray-after-confirm.png',
        );
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});

test('samurai zanshin should settle 5 bonus dice and synchronize effects against paladin', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectSamuraiAttackModifierScene(page, {
        cardId: 'card-zanshin',
        defenderCharacter: 'paladin',
        sourceAbilityId: 'katana-slice-3',
    });
    await waitForSamuraiAttackModifierScene(page, {
        cardId: 'card-zanshin',
        defenderCharacter: 'paladin',
        sourceAbilityId: 'katana-slice-3',
    });

    await page.evaluate(() => {
        (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([1, 4, 6, 6, 1]);
    });
    await dragHandCardToPlay(page, 'card-zanshin');

    // 攻击修正徽章应在打出卡牌后出现（效果提示）
    const activeBadgeEarly = page.locator('[data-testid="active-modifier-badge"]').first();
    await expect(activeBadgeEarly).toBeVisible({ timeout: 5000 });
    await game.screenshot('10-samurai-zanshin-badge-after-play', testInfo);

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'card-zanshin' });

    await page.waitForFunction(() => {
        const settlement = (window as any).__BG_TEST_HARNESS__?.state?.get()?.core?.pendingBonusDiceSettlement;
        return settlement?.displayOnly === true && settlement?.dice?.length === 5;
    }, { timeout: 10000, polling: 200 });

    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(5, { timeout: 5000 });
    await game.screenshot('10-samurai-zanshin-bonus-die-right-tray', testInfo);

    const stateAfterPlay = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const settlementDice = state?.core?.pendingBonusDiceSettlement?.dice ?? [];
        const faceCounts = settlementDice.reduce((acc: Record<string, number>, die: any) => {
            const face = die?.face ?? 'unknown';
            acc[face] = (acc[face] ?? 0) + 1;
            return acc;
        }, {});
        return {
            hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            lastEventTypes: entries.slice(-10).map((entry: any) => entry.event?.type),
            bonusDieEventCount: entries.filter((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED').length,
            settlement: state?.core?.pendingBonusDiceSettlement
                ? {
                    diceCount: state.core.pendingBonusDiceSettlement.dice?.length ?? 0,
                    displayOnly: state.core.pendingBonusDiceSettlement.displayOnly,
                    diceFaces: settlementDice.map((die: any) => die.face ?? null),
                }
                : null,
            faceCounts,
            attackBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
            totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
            paladinShame: state?.core?.players?.['1']?.tokens?.shame ?? 0,
            samuraiRetribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
        };
    });

    expect(stateAfterPlay.hand).not.toContain('card-zanshin');
    expect(stateAfterPlay.lastEventTypes).toContain('CARD_PLAYED');
    expect(stateAfterPlay.lastEventTypes).toContain('BONUS_DIE_ROLLED');
    expect(stateAfterPlay.bonusDieEventCount).toBeGreaterThanOrEqual(5);
    expect(stateAfterPlay.settlement?.diceCount).toBe(5);
    expect(stateAfterPlay.settlement?.displayOnly).toBe(true);
    expect(stateAfterPlay.settlement?.diceFaces).toEqual(['katana', 'helm', 'rising_sun', 'rising_sun', 'katana']);

    const katanaCount = stateAfterPlay.faceCounts.katana ?? 0;
    const helmCount = stateAfterPlay.faceCounts.helm ?? 0;
    const risingSunCount = stateAfterPlay.faceCounts.rising_sun ?? 0;

    expect(katanaCount).toBe(2);
    expect(helmCount).toBe(1);
    expect(risingSunCount).toBe(2);
    expect(stateAfterPlay.attackBonusDamage).toBe(2);
    expect(stateAfterPlay.totalBonusDamage).toBe(2);
    expect(stateAfterPlay.paladinShame).toBe(1);
    // 真相源（tip.webp）标注反击（samurai_retribution）堆叠上限为 1；即使掷出 2 个旭日，授予也应被 clamp
    expect(stateAfterPlay.samuraiRetribution).toBe(1);

    const activeBadge = page.locator('[data-testid="active-modifier-badge"]');
    await expect(activeBadge).toBeVisible({ timeout: 5000 });
    await expect(activeBadge).toContainText(/攻击修正\s*\+2|Attack Modifier\s*\+2/i, { timeout: 5000 });

    // displayOnly 奖励骰：通过右侧骰盘普通确认收口，旧特写关闭按钮不再是正式入口。
    await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'card-zanshin' });
    await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [1, 4, 6, 6, 1] });
    await game.screenshot('10-samurai-zanshin-bonus-die-confirmed-review', testInfo);
    await game.screenshot('10-samurai-zanshin-settled', testInfo);

    await page.waitForTimeout(400);
    await game.screenshot('10-samurai-zanshin-vs-paladin', testInfo);
});

test('samurai honor token should accumulate to +3 after two real clicks', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectSamuraiTokenResponseScene(page, {
        mode: 'honor',
        incomingDamage: 4,
    });
    await waitForSamuraiTokenResponseScene(page, { mode: 'honor' });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const attackerTitle = page.getByText(/响应（攻击方）|attacker/i).first();
    const honorLabel = page.getByText(/^荣誉$|^Honor$/).first();
    const useButton = page.getByRole('button', { name: /^(使用|Use|Use Token)(?: x\d+)?$/i }).first();

    await expect(attackerTitle).toBeVisible({ timeout: 5000 });
    await expect(honorLabel).toBeVisible({ timeout: 5000 });
    await expect(useButton).toBeVisible({ timeout: 5000 });
    await game.screenshot('17-samurai-honor-before-first-use', testInfo);

    await useButton.click();
    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingDamage?.currentDamage === 5
            && state?.core?.pendingDamage?.tokenUsageTotals?.honor === 1
            && state?.core?.players?.['0']?.tokens?.honor === 1;
    }, undefined, { timeout: 10000, polling: 200 });

    await expect(attackerTitle).toBeVisible({ timeout: 5000 });
    await game.screenshot('18-samurai-honor-after-first-use', testInfo);

    await useButton.click();
    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.players?.['1']?.resources?.hp === 43;
    }, undefined, { timeout: 10000, polling: 200 });

    const finalState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const entries = state?.sys?.eventStream?.entries ?? [];
        return {
            pendingDamage: state?.core?.pendingDamage ?? null,
            honor: state?.core?.players?.['0']?.tokens?.honor ?? 0,
            opponentHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            lastEventTypes: entries.slice(-8).map((entry: any) => entry.event?.type),
        };
    });

    expect(finalState.pendingDamage).toBeNull();
    // 真相源（tip.webp）标注荣誉（honor）堆叠上限为 2；本用例两次点击合计消耗 2 点荣誉后应清零
    expect(finalState.honor).toBe(0);
    expect(finalState.opponentHp).toBe(43);
    expect(finalState.lastEventTypes.filter(type => type === 'TOKEN_USED')).toHaveLength(2);
    expect(finalState.lastEventTypes).toContain('TOKEN_RESPONSE_CLOSED');
    await expect(useButton).toBeHidden({ timeout: 5000 });
    await game.screenshot('19-samurai-honor-finalized-after-second-use', testInfo);
});

test('gunslinger loaded token should open single-die spotlight after real choice click', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectGunslingerLoadedChoiceScene(page);
    await waitForGunslingerLoadedChoiceScene(page);

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const loadedLabel = page.getByText(/^装填$|^Loaded$/i).first();
    await expect(loadedLabel).toBeVisible({ timeout: 5000 });
    await game.screenshot('20-gunslinger-loaded-choice-before-use', testInfo);

    await loadedLabel.locator('..').click();
    await page.waitForTimeout(800);
    await game.screenshot('21-gunslinger-loaded-after-choice-click', testInfo);

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });

    const stateAfterUse = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        return {
            loaded: state?.core?.players?.['0']?.tokens?.loaded ?? 0,
            hasChoice: Boolean(state?.sys?.interaction?.current),
            phase: state?.sys?.phase ?? null,
            settlement: settlement
                ? {
                    id: settlement.id,
                    diceCount: settlement.dice?.length ?? 0,
                    displayOnly: settlement.displayOnly ?? false,
                    rerollCostTokenId: settlement.rerollCostTokenId ?? null,
                    dieValue: settlement.dice?.[0]?.value ?? null,
                    effectKey: settlement.dice?.[0]?.effectKey ?? null,
                }
                : null,
        };
    });

    await game.screenshot('21-gunslinger-loaded-after-choice-click', testInfo);

    expect(stateAfterUse.loaded).toBe(0);
    expect(stateAfterUse.hasChoice).toBe(false);
    expect(stateAfterUse.phase).toBe('defensiveRoll');
    expect(stateAfterUse.settlement?.diceCount).toBe(1);
    expect(stateAfterUse.settlement?.displayOnly).toBe(true);
    expect(stateAfterUse.settlement?.rerollCostTokenId).toBe('');
    expect(stateAfterUse.settlement?.dieValue).toBe(1);
    expect(stateAfterUse.settlement?.effectKey).toBe('bonusDie.effect.gunslingerLoadedDie');

    await game.screenshot('22-gunslinger-loaded-single-die-right-tray', testInfo);
});

test('gunslinger quick draw II should make loaded spotlight rerollable after real choice click', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectGunslingerLoadedChoiceScene(page, { quickDrawUpgraded: true });
    await waitForGunslingerLoadedChoiceScene(page);

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const loadedLabel = page.getByText(/^装填$|^Loaded$/i).first();
    await expect(loadedLabel).toBeVisible({ timeout: 5000 });
    await game.screenshot('23-gunslinger-quick-draw-2-loaded-choice-before-use', testInfo);

    await loadedLabel.locator('..').click();

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });

    const stateAfterUse = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        return {
            loaded: state?.core?.players?.['0']?.tokens?.loaded ?? 0,
            quickDrawLevel: state?.core?.players?.['0']?.abilityLevels?.['quick-draw'] ?? null,
            settlement: settlement
                ? {
                    diceCount: settlement.dice?.length ?? 0,
                    displayOnly: settlement.displayOnly ?? false,
                    rerollCostTokenId: settlement.rerollCostTokenId ?? null,
                    rerollCostAmount: settlement.rerollCostAmount ?? null,
                    maxRerollCount: settlement.maxRerollCount ?? null,
                    dieValue: settlement.dice?.[0]?.value ?? null,
                    effectKey: settlement.dice?.[0]?.effectKey ?? null,
                }
                : null,
        };
    });

    expect(stateAfterUse.loaded).toBe(0);
    expect(stateAfterUse.quickDrawLevel).toBe(2);
    expect(stateAfterUse.settlement?.diceCount).toBe(1);
    expect(stateAfterUse.settlement?.displayOnly).toBe(false);
    expect(stateAfterUse.settlement?.rerollCostTokenId).toBe('loaded');
    expect(stateAfterUse.settlement?.rerollCostAmount).toBe(0);
    expect(stateAfterUse.settlement?.maxRerollCount).toBe(1);
    expect(stateAfterUse.settlement?.dieValue).toBe(1);
    expect(stateAfterUse.settlement?.effectKey).toBe('bonusDie.effect.gunslingerLoadedDie');

    await game.screenshot('24-gunslinger-quick-draw-2-loaded-rerollable-right-tray', testInfo);
});

test('gunslinger fill em with lead should make sourced loaded spotlight rerollable', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectGunslingerLoadedChoiceScene(page, { sourceAbilityId: 'fill-em-with-lead' });
    await waitForGunslingerLoadedChoiceScene(page, { sourceAbilityId: 'fill-em-with-lead' });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const loadedLabel = page.getByText(/^装填$|^Loaded$/i).first();
    await expect(loadedLabel).toBeVisible({ timeout: 5000 });
    await game.screenshot('25-gunslinger-fill-em-with-lead-loaded-choice-before-use', testInfo);

    await loadedLabel.locator('..').click();

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(1, { timeout: 5000 });

    const stateAfterUse = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        return {
            loaded: state?.core?.players?.['0']?.tokens?.loaded ?? 0,
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            settlement: settlement
                ? {
                    diceCount: settlement.dice?.length ?? 0,
                    displayOnly: settlement.displayOnly ?? false,
                    rerollCostTokenId: settlement.rerollCostTokenId ?? null,
                    rerollCostAmount: settlement.rerollCostAmount ?? null,
                    maxRerollCount: settlement.maxRerollCount ?? null,
                    dieValue: settlement.dice?.[0]?.value ?? null,
                    effectKey: settlement.dice?.[0]?.effectKey ?? null,
                }
                : null,
        };
    });

    expect(stateAfterUse.loaded).toBe(0);
    expect(stateAfterUse.sourceAbilityId).toBe('fill-em-with-lead');
    expect(stateAfterUse.settlement?.diceCount).toBe(1);
    expect(stateAfterUse.settlement?.displayOnly).toBe(false);
    expect(stateAfterUse.settlement?.rerollCostTokenId).toBe('loaded');
    expect(stateAfterUse.settlement?.rerollCostAmount).toBe(0);
    expect(stateAfterUse.settlement?.maxRerollCount).toBe(1);
    expect(stateAfterUse.settlement?.dieValue).toBe(1);
    expect(stateAfterUse.settlement?.effectKey).toBe('bonusDie.effect.gunslingerLoadedDie');

    await game.screenshot('26-gunslinger-fill-em-with-lead-loaded-rerollable-right-tray', testInfo);
});

test('gunslinger spin the chamber should grant loaded from real hand play', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectGunslingerHandCardScene(page, { cardId: 'card-spin-the-chamber', phase: 'main1' });
    await waitForGunslingerHandCardScene(page, { cardId: 'card-spin-the-chamber', phase: 'main1' });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);
    await waitForHandCardVisualReady(page, 'card-spin-the-chamber');

    await game.screenshot('27-gunslinger-spin-the-chamber-before-play', testInfo);
    await dragHandCardToPlay(page, 'card-spin-the-chamber');

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return (state?.core?.players?.['0']?.tokens?.loaded ?? 0) === 1
            && !(state?.core?.players?.['0']?.hand ?? []).some((card: any) => card.id === 'card-spin-the-chamber')
            && (state?.core?.players?.['0']?.discard ?? []).some((card: any) => card.id === 'card-spin-the-chamber');
    }, { timeout: 10000, polling: 200 });

    const stateAfterPlay = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
            loaded: state?.core?.players?.['0']?.tokens?.loaded ?? 0,
            handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
            discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
        };
    });

    expect(stateAfterPlay.loaded).toBe(1);
    expect(stateAfterPlay.handIds).not.toContain('card-spin-the-chamber');
    expect(stateAfterPlay.discardIds).toContain('card-spin-the-chamber');
    await game.screenshot('28-gunslinger-spin-the-chamber-after-play-loaded', testInfo);
});

test('gunslinger eat my lead should roll five bonus dice from real hand play', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectGunslingerHandCardScene(page, {
        cardId: 'card-eat-my-lead',
        phase: 'offensiveRoll',
        diceValues: [1, 1, 1, 1, 1],
    });
    await waitForGunslingerHandCardScene(page, { cardId: 'card-eat-my-lead', phase: 'offensiveRoll' });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);
    await waitForHandCardVisualReady(page, 'card-eat-my-lead');

    await game.screenshot('29-gunslinger-eat-my-lead-before-play', testInfo);
    await dragHandCardToPlay(page, 'card-eat-my-lead');

    await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
    await expect(getRightTrayDiceTray(page).getByTestId('dice-2d')).toHaveCount(5, { timeout: 5000 });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        return settlement?.displayOnly === true
            && settlement?.dice?.length === 5
            && (state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0) === 5
            && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 1;
    }, { timeout: 15000, polling: 200 });

    await game.screenshot('30-gunslinger-eat-my-lead-bonus-dice-right-tray', testInfo);

    const stateAfterPlay = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
            handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
            discardIds: (state?.core?.players?.['0']?.discard ?? []).map((card: any) => card.id),
            settlement: state?.core?.pendingBonusDiceSettlement
                ? {
                    diceCount: state.core.pendingBonusDiceSettlement.dice?.length ?? 0,
                    displayOnly: state.core.pendingBonusDiceSettlement.displayOnly,
                    diceValues: state.core.pendingBonusDiceSettlement.dice?.map((die: any) => die.value ?? null) ?? [],
                }
                : null,
            attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
            totalBonusDamage: state?.core?.pendingAttack?.bonusDamage ?? 0,
            knockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
        };
    });

    expect(stateAfterPlay.handIds).not.toContain('card-eat-my-lead');
    expect(stateAfterPlay.discardIds).toContain('card-eat-my-lead');
    expect(stateAfterPlay.settlement?.diceCount).toBe(5);
    expect(stateAfterPlay.settlement?.displayOnly).toBe(true);
    expect(stateAfterPlay.settlement?.diceValues).toEqual([1, 1, 1, 1, 1]);
    expect(stateAfterPlay.attackModifierBonusDamage).toBe(5);
    expect(stateAfterPlay.totalBonusDamage).toBe(5);
    expect(stateAfterPlay.knockdown).toBe(1);

    await settleCurrentBonusDice(page, () => game.getState(), {});
    await expectRightTrayBonusDiceReadOnlyReview(page, { expectedValues: [1, 1, 1, 1, 1] });
    await game.screenshot('31-gunslinger-eat-my-lead-after-closeout', testInfo);
});

test('samurai retribution token should retaliate through real click flow', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await waitForTestHarness(page, 40000);
    await injectSamuraiTokenResponseScene(page, {
        mode: 'samurai-retribution',
        incomingDamage: 5,
        rollValues: [1],
    });
    await waitForSamuraiTokenResponseScene(page, { mode: 'samurai-retribution' });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const defenderTitle = page.getByText(/响应（防御方）|defender/i).first();
    const retributionLabel = page.getByText(/^反击$|^Back Strike$|^Retribution$/).first();
    const useButton = page.getByRole('button', { name: /^(使用|Use|Use Token)(?: x\d+)?$/i }).first();

    await expect(defenderTitle).toBeVisible({ timeout: 5000 });
    await expect(retributionLabel).toBeVisible({ timeout: 5000 });
    await expect(useButton).toBeVisible({ timeout: 5000 });
    await game.screenshot('20-samurai-retribution-before-use', testInfo);

    await useButton.click();
    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.players?.['0']?.resources?.hp === 45
            && state?.core?.players?.['1']?.resources?.hp === 49;
    }, undefined, { timeout: 10000, polling: 200 });

    const finalState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const latestBackStrike = [...entries]
            .reverse()
            .find((entry: any) => entry.event?.payload?.effectKey === 'bonusDie.effect.samuraiBackStrikeDie');
        return {
            pendingDamage: state?.core?.pendingDamage ?? null,
            samuraiHp: state?.core?.players?.['0']?.resources?.hp ?? null,
            attackerHp: state?.core?.players?.['1']?.resources?.hp ?? null,
            retribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
            lastEventTypes: entries.slice(-10).map((entry: any) => entry.event?.type),
            backStrikeRoll: latestBackStrike?.event?.payload?.value ?? null,
        };
    });

    expect(finalState.pendingDamage).toBeNull();
    expect(finalState.retribution).toBe(0);
    expect(finalState.samuraiHp).toBe(45);
    expect(finalState.attackerHp).toBe(49);
    expect(finalState.backStrikeRoll).toBe(1);
    expect(finalState.lastEventTypes).toContain('BONUS_DIE_ROLLED');
    expect(finalState.lastEventTypes).toContain('DAMAGE_DEALT');
    await expect(useButton).toBeHidden({ timeout: 5000 });
    await game.screenshot('21-samurai-retribution-after-retaliation', testInfo);
});

test('online ninja knife fan should not open samurai retribution response window on direct damage', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, 'online setup unavailable in current environment');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup;

    try {
        await selectCharacter(hostPage, 'samurai');
        await selectCharacter(guestPage, 'ninja');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForTestHarness(hostPage, 10000);
        await waitForTestHarness(guestPage, 10000);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        const matchState = await readMatchStateFromDebugPanel(hostPage);
        const injectedState = cloneJson(matchState);
        const knifeFanCard = NINJA_CARDS.find((card) => card.id === 'ninja-card-knife-fan');
        if (!knifeFanCard) {
            throw new Error('ninja-card-knife-fan not found');
        }

        injectedState.sys = {
            ...(injectedState.sys ?? {}),
            phase: 'main1',
            interaction: {
                current: undefined,
                queue: [],
            },
            responseWindow: {
                current: undefined,
            },
        };
        injectedState.core = {
            ...(injectedState.core ?? {}),
            activePlayerId: '1',
            hostStarted: true,
            selectedCharacters: {
                ...(injectedState.core?.selectedCharacters ?? {}),
                '0': 'samurai',
                '1': 'ninja',
            },
            readyPlayers: {
                ...(injectedState.core?.readyPlayers ?? {}),
                '0': true,
                '1': true,
            },
            rollCount: 0,
            rollConfirmed: false,
            players: {
                ...(injectedState.core?.players ?? {}),
                '0': {
                    ...(injectedState.core?.players?.['0'] ?? {}),
                    characterId: 'samurai',
                    hand: [],
                    discard: [],
                    resources: {
                        ...(injectedState.core?.players?.['0']?.resources ?? {}),
                        CP: 2,
                        HP: 50,
                    },
                    tokens: {
                        ...(injectedState.core?.players?.['0']?.tokens ?? {}),
                        samurai_retribution: 1,
                    },
                },
                '1': {
                    ...(injectedState.core?.players?.['1'] ?? {}),
                    characterId: 'ninja',
                    hand: [cloneJson(knifeFanCard)],
                    discard: [],
                    resources: {
                        ...(injectedState.core?.players?.['1']?.resources ?? {}),
                        CP: 3,
                        HP: 50,
                    },
                },
            },
            pendingAttack: null,
            pendingDamage: undefined,
            pendingBonusDiceSettlement: undefined,
        };

        await applyFullStateDirect(hostPage, injectedState);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'main1'
                && state?.core?.activePlayerId === '1'
                && state?.core?.selectedCharacters?.['0'] === 'samurai'
                && state?.core?.selectedCharacters?.['1'] === 'ninja'
                && state?.core?.players?.['0']?.tokens?.samurai_retribution === 1
                && state?.core?.players?.['1']?.hand?.[0]?.id === 'ninja-card-knife-fan';
        }, { timeout: 15000, polling: 200 });

        await waitForHandCardVisualReady(guestPage, 'ninja-card-knife-fan');
        await savePageEvidenceScreenshot(
            guestPage,
            testInfo,
            'online-ninja-knife-fan-before-play',
            '32-online-ninja-knife-fan-before-play.png',
        );

        await dragHandCardToPlay(guestPage, 'ninja-card-knife-fan');
        await closeCardSpotlightByRealClickIfVisible(guestPage);

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestDamageEvent = [...entries]
                .reverse()
                .find((entry: any) => entry?.event?.type === 'DAMAGE_DEALT');
            return state?.core?.players?.['0']?.resources?.hp === 49
                && state?.core?.players?.['0']?.tokens?.samurai_retribution === 1
                && !state?.core?.pendingDamage
                && !state?.sys?.responseWindow?.current
                && !state?.sys?.interaction?.current
                && latestDamageEvent?.event?.payload?.damageScope === 'direct';
        }, { timeout: 10000, polling: 200 });

        const hostFinalState = await hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestDamageEvent = [...entries]
                .reverse()
                .find((entry: any) => entry?.event?.type === 'DAMAGE_DEALT');
            return {
                samuraiHp: state?.core?.players?.['0']?.resources?.hp ?? null,
                retribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
                pendingDamage: state?.core?.pendingDamage ?? null,
                responseWindowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                lastDamageScope: latestDamageEvent?.event?.payload?.damageScope ?? null,
                lastDamageTargetId: latestDamageEvent?.event?.payload?.targetId ?? null,
                lastEventTypes: entries.slice(-8).map((entry: any) => entry?.event?.type ?? null),
            };
        });
        const guestFinalState = await guestPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                ninjaCp: state?.core?.players?.['1']?.resources?.cp ?? state?.core?.players?.['1']?.resources?.CP ?? null,
                handIds: (state?.core?.players?.['1']?.hand ?? []).map((card: any) => card.id),
                discardIds: (state?.core?.players?.['1']?.discard ?? []).map((card: any) => card.id),
            };
        });

        expect(hostFinalState.samuraiHp).toBe(49);
        expect(hostFinalState.retribution).toBe(1);
        expect(hostFinalState.pendingDamage).toBeNull();
        expect(hostFinalState.responseWindowType).toBeNull();
        expect(hostFinalState.interactionKind).toBeNull();
        expect(hostFinalState.lastDamageScope).toBe('direct');
        expect(hostFinalState.lastDamageTargetId).toBe('0');
        expect(hostFinalState.lastEventTypes).toContain('CARD_PLAYED');
        expect(hostFinalState.lastEventTypes).toContain('DAMAGE_DEALT');

        expect(guestFinalState.ninjaCp).toBe(0);
        expect(guestFinalState.handIds).not.toContain('ninja-card-knife-fan');
        expect(guestFinalState.discardIds).toContain('ninja-card-knife-fan');

        await hostPage.waitForTimeout(1000);
        await expect(hostPage.getByTestId('dicethrone-token-response-inline')).toHaveCount(0);
        await savePageEvidenceScreenshot(
            hostPage,
            testInfo,
            'online-samurai-no-back-strike-on-direct-damage',
            '33-online-samurai-no-back-strike-on-direct-damage.png',
        );
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});

test('me too copy mode should allow locked source and target dice', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['card-me-too', 'card-me-too'],
            resources: {
                cp: 3,
                hp: 1,
            },
        },
        player1: {
            resources: {
                cp: 2,
                hp: 16,
            },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'paladin' },
            hostStarted: true,
            rollCount: 3,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            pendingAttack: null,
            dice: [
                { id: 0, value: 6, isKept: true },
                { id: 1, value: 5, isKept: true },
                { id: 2, value: 4, isKept: false },
                { id: 3, value: 2, isKept: false },
                { id: 4, value: 3, isKept: false },
            ],
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.players?.['0']?.hand?.filter((card: any) => card.id === 'card-me-too').length === 2
            && state?.core?.dice?.[0]?.isKept === true
            && state?.core?.dice?.[1]?.isKept === true;
    }, { timeout: 10000 });

    const dice = page.locator('[data-testid="die"]');
    await expect(dice).toHaveCount(5);
    const dieButtons = Array.from({ length: 5 }, (_, index) => page.locator(`[data-testid="die-button-${index}"]`));

    const firstCopyCard = page.locator('[data-card-id="card-me-too"]').first();
    await expect(firstCopyCard).toHaveAttribute('data-is-flipped', 'true');
    await expect(firstCopyCard).toHaveAttribute('data-can-drag', 'true');
    await firstCopyCard.click({ force: true });

    await page.waitForFunction(() => {
        const interaction = (window as any).__BG_TEST_HARNESS__?.state?.get()?.sys?.interaction?.current;
        return interaction?.data?.meta?.dtType === 'modifyDie'
            && interaction?.data?.meta?.dieModifyConfig?.mode === 'copy';
    }, { timeout: 5000 });

    await dieButtons[0].click();
    await expect(dieButtons[0]).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
    await expect(dieButtons[0]).toHaveAttribute('data-display-value', '6');

    await dieButtons[3].click();

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.core?.dice?.[3]?.value === 6
            && state?.core?.players?.['0']?.hand?.filter((card: any) => card.id === 'card-me-too').length === 1;
    }, { timeout: 5000 });

    const secondCopyCard = page.locator('[data-card-id="card-me-too"]').first();
    await expect(secondCopyCard).toHaveAttribute('data-is-flipped', 'true');
    await expect(secondCopyCard).toHaveAttribute('data-can-drag', 'true');
    await secondCopyCard.click({ force: true });

    await page.waitForFunction(() => {
        const interaction = (window as any).__BG_TEST_HARNESS__?.state?.get()?.sys?.interaction?.current;
        return interaction?.data?.meta?.dtType === 'modifyDie'
            && interaction?.data?.meta?.dieModifyConfig?.mode === 'copy';
    }, { timeout: 5000 });

    await dieButtons[4].click();
    await expect(dieButtons[4]).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
    await expect(dieButtons[4]).toHaveAttribute('data-display-value', '3');

    await dieButtons[1].click();

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.core?.dice?.[1]?.value === 3
            && state?.core?.players?.['0']?.hand?.filter((card: any) => card.id === 'card-me-too').length === 0;
    }, { timeout: 5000 });

    const finalState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return {
            diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
            keptFlags: (state?.core?.dice ?? []).map((die: any) => die.isKept),
            handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
        };
    });

    expect(finalState.diceValues).toEqual([6, 3, 4, 6, 3]);
    expect(finalState.keptFlags).toEqual([true, true, false, false, false]);
    expect(finalState.handIds).not.toContain('card-me-too');

    await game.screenshot('07-me-too-locked-dice-copy', testInfo);
});

test('opponent lucky card should only show card spotlight for viewer', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, 'online setup unavailable in current environment');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup;

    try {
        await selectCharacter(hostPage, 'moon_elf');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForTestHarness(hostPage, 10000);
        await waitForTestHarness(guestPage, 10000);
        await advanceToOffensiveRoll(hostPage);

        const coreState = await readCoreState(hostPage) as Record<string, any>;
        const luckyCard = BARBARIAN_CARDS.find(card => card.id === 'card-lucky');
        if (!luckyCard) {
            throw new Error('闂備礁鎼悧婊勭濠靛洨鐝舵慨妞诲亾鐎?card-lucky');
        }

        const injectedCore = JSON.parse(JSON.stringify(coreState));
        injectedCore.activePlayerId = '1';
        injectedCore.rollCount = 1;
        injectedCore.rollConfirmed = true;
        injectedCore.dice = [
            { id: 0, value: 1, isKept: false, playerId: '1' },
            { id: 1, value: 2, isKept: false, playerId: '1' },
            { id: 2, value: 3, isKept: false, playerId: '1' },
            { id: 3, value: 4, isKept: false, playerId: '1' },
            { id: 4, value: 5, isKept: false, playerId: '1' },
        ];
        injectedCore.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            isDefendable: true,
            damage: 5,
            bonusDamage: 0,
        };
        injectedCore.pendingBonusDiceSettlement = undefined;
        injectedCore.players['0'].resources.CP = 2;
        injectedCore.players['0'].resources.HP = 50;
        injectedCore.players['1'].resources.CP = 3;
        injectedCore.players['1'].resources.HP = 40;
        injectedCore.players['1'].hand = [JSON.parse(JSON.stringify(luckyCard))];

        await applyCoreStateDirect(hostPage, injectedCore);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.phase === 'offensiveRoll'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-lucky');
        }, { timeout: 15000 });

        await hostPage.screenshot({
            path: testInfo.outputPath('04-p0-before-p1-play-lucky.png'),
            fullPage: false,
        });

        const luckyCardInHand = guestPage.locator('[data-card-id="card-lucky"]').first();
        await expect(luckyCardInHand).toBeVisible({ timeout: 10000 });
        await dragHandCardToPlay(guestPage, 'card-lucky');

        const hostCardSpotlight = hostPage.locator('[data-testid="card-spotlight-overlay"]');
        await expect(hostCardSpotlight).toBeVisible({ timeout: 15000 });
        await expectNoCentralBonusDicePresentation(hostPage);

        await hostPage.waitForTimeout(1200);

        const visibleBonusOverlayCount = await hostPage
            .locator('[data-testid="bonus-die-overlay"]')
            .evaluateAll((nodes) => nodes.filter((node) => {
                const element = node as HTMLElement;
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && rect.width > 0
                    && rect.height > 0;
            }).length);
        expect(visibleBonusOverlayCount).toBe(0);

        const overlayState = await hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return {
                lastEventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-8).map((entry: any) => entry.event?.type),
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement
                    ? {
                        id: state.core.pendingBonusDiceSettlement.id,
                        attackerId: state.core.pendingBonusDiceSettlement.attackerId,
                        diceCount: state.core.pendingBonusDiceSettlement.dice?.length ?? 0,
                        displayOnly: state.core.pendingBonusDiceSettlement.displayOnly,
                    }
                    : null,
            };
        });

        expect(overlayState.lastEventTypes).toContain('CARD_PLAYED');
        expect(overlayState.lastEventTypes.filter((type) => type === 'BONUS_DIE_ROLLED')).toHaveLength(4);
        expect(overlayState.lastEventTypes).not.toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(overlayState.pendingBonusDiceSettlement).toBeNull();

        await hostPage.screenshot({
            path: testInfo.outputPath('05-p0-after-p1-play-lucky-no-duplicate-overlay.png'),
            fullPage: false,
        });
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});

test('opponent common-card spotlight should match actual effect for samurai and gunslinger', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);

    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, 'online setup unavailable in current environment');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup;

    try {
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'samurai');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForTestHarness(hostPage, 10000);
        await waitForTestHarness(guestPage, 10000);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        const hostSpotlight = hostPage.locator('[data-testid="card-spotlight-overlay"]');

        const applySceneAndPlay = async (options: {
            actorCharacter: 'samurai' | 'gunslinger';
            actorCardId: 'card-boss-generous' | 'card-next-time';
            actorCp: number;
            expectedCp: number;
            expectedShield: number;
            responseScene?: {
                pendingDamage: number;
                responseWindowType: 'afterAttackResolved';
            };
            overlayName: string;
            overlayFilename: string;
            stateName: string;
            stateFilename: string;
        }) => {
            const actorCards = options.actorCharacter === 'samurai' ? SAMURAI_CARDS : GUNSLINGER_CARDS;
            const expectedPreviewRef = actorCards.find((card) => card.id === options.actorCardId)?.previewRef;
            if (!expectedPreviewRef || expectedPreviewRef.type !== 'atlas') {
                throw new Error(`Missing atlas previewRef for ${options.actorCharacter}:${options.actorCardId}`);
            }

            const matchState = await readMatchStateFromDebugPanel(hostPage);
            const injectedState = buildOnlineCommonCardSceneState(matchState, {
                actorCharacter: options.actorCharacter,
                actorCardId: options.actorCardId,
                actorCp: options.actorCp,
                responseScene: options.responseScene,
            });

            await applyFullStateDirect(hostPage, injectedState);
            await ensureDebugPanelClosed(hostPage);
            await ensureDebugPanelClosed(guestPage);

            await guestPage.waitForFunction(({ actorCharacter, actorCardId, actorCp, isResponseScene, expectedWindowId }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const responseWindow = state?.sys?.responseWindow?.current;
                return state?.core?.activePlayerId === (isResponseScene ? '0' : '1')
                    && state?.core?.selectedCharacters?.['1'] === actorCharacter
                    && state?.core?.players?.['1']?.resources?.cp === actorCp
                    && state?.core?.players?.['1']?.hand?.length === 1
                    && state?.core?.players?.['1']?.hand?.[0]?.id === actorCardId
                    && (isResponseScene
                        ? responseWindow?.id === expectedWindowId
                            && responseWindow?.windowType === 'afterAttackResolved'
                            && state?.core?.pendingDamage?.id === `common-card-${actorCardId}-pending-damage`
                        : !responseWindow);
            }, {
                actorCharacter: options.actorCharacter,
                actorCardId: options.actorCardId,
                actorCp: options.actorCp,
                isResponseScene: !!options.responseScene,
                expectedWindowId: `common-card-${options.actorCardId}-response-window`,
            }, { timeout: 15000, polling: 200 });

            await guestPage.evaluate(() => {
                (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
            });
            await waitForHandCardVisualReady(guestPage, options.actorCardId);

            const cardInHand = guestPage.locator(`[data-testid="hand-area"] [data-card-id="${options.actorCardId}"]`).first();
            await expect(cardInHand).toBeVisible({ timeout: 10000 });
            await cardInHand.hover();
            await guestPage.waitForTimeout(150);
            await dragHandCardToPlay(guestPage, options.actorCardId);

            const firstClickState = await guestPage.evaluate(({ actorCardId }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                const handIds = state?.core?.players?.['1']?.hand?.map((card: any) => card.id) ?? [];
                return {
                    reject: (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null,
                    played: entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED' && entry.event?.payload?.cardId === actorCardId),
                    stillInHand: handIds.includes(actorCardId),
                };
            }, {
                actorCardId: options.actorCardId,
            });

            if (!firstClickState.played && !firstClickState.reject && firstClickState.stillInHand) {
                await guestPage.waitForTimeout(200);
                await dragHandCardToPlay(guestPage, options.actorCardId);
            }

            await guestPage.waitForFunction(({ actorCardId }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const reject = (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null;
                const entries = state?.sys?.eventStream?.entries ?? [];
                const handIds = state?.core?.players?.['1']?.hand?.map((card: any) => card.id) ?? [];
                return (reject?.commandType === 'PLAY_CARD')
                    || (!handIds.includes(actorCardId)
                    && entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED' && entry.event?.payload?.cardId === actorCardId));
            }, {
                actorCardId: options.actorCardId,
            }, { timeout: 10000, polling: 200 });

            const guestPlayState = await guestPage.evaluate(({ actorCardId }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                const handIds = state?.core?.players?.['1']?.hand?.map((card: any) => card.id) ?? [];
                return {
                    reject: (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null,
                    played: entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED' && entry.event?.payload?.cardId === actorCardId),
                    handIds,
                };
            }, {
                actorCardId: options.actorCardId,
            });

            expect(guestPlayState.reject).toBeNull();
            expect(guestPlayState.played).toBe(true);

            await hostPage.waitForFunction(({ actorCardId }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                return entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED' && entry.event?.payload?.cardId === actorCardId);
            }, {
                actorCardId: options.actorCardId,
            }, { timeout: 15000, polling: 200 });

            await expect(hostSpotlight).toBeVisible({ timeout: 5000 });
            const hostCardPlayedEvent = await hostPage.evaluate(({ actorCardId }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                const event = [...entries].reverse()
                    .find((entry: any) => entry.event?.type === 'CARD_PLAYED'
                        && entry.event?.payload?.cardId === actorCardId);
                return event?.event?.payload ?? null;
            }, {
                actorCardId: options.actorCardId,
            });
            expect(hostCardPlayedEvent?.previewRef).toEqual(expectedPreviewRef);

            const spotlightCardFrame = hostSpotlight.locator('[data-card-atlas-frame="true"]').first();
            await expect(spotlightCardFrame).toBeVisible({ timeout: 5000 });
            await expect(spotlightCardFrame).toHaveAttribute('data-card-atlas-id', expectedPreviewRef.atlasId);
            await expect(spotlightCardFrame).toHaveAttribute('data-card-atlas-index', String(expectedPreviewRef.index));
            await hostPage.waitForFunction(() => {
                const frame = document.querySelector('[data-testid="card-spotlight-overlay"] [data-card-atlas-frame="true"]');
                if (!(frame instanceof HTMLElement)) return false;
                const atlasImg = frame.querySelector('[data-card-atlas-img="true"]');
                return !frame.classList.contains('atlas-shimmer')
                    && (atlasImg instanceof HTMLImageElement || getComputedStyle(frame).backgroundImage !== 'none');
            }, undefined, { timeout: 10000, polling: 200 });

            await hostPage.waitForTimeout(250);
            await expectCardSpotlightClearOfCriticalAreas(hostPage);
            await savePageEvidenceScreenshot(
                hostPage,
                testInfo,
                options.overlayName,
                options.overlayFilename,
            );

            await guestPage.waitForFunction(({ actorCardId, expectedCp, expectedShield }) => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                const shields = state?.core?.players?.['1']?.damageShields ?? [];
                const discardIds = state?.core?.players?.['1']?.discard?.map((card: any) => card.id) ?? [];
                const handIds = state?.core?.players?.['1']?.hand?.map((card: any) => card.id) ?? [];
                const shieldTotal = shields.reduce((sum: number, shield: any) => sum + (shield?.value ?? 0), 0);
                return !handIds.includes(actorCardId)
                    && discardIds.includes(actorCardId)
                    && (state?.core?.players?.['1']?.resources?.cp ?? 0) === expectedCp
                    && shieldTotal === expectedShield
                    && entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED');
            }, {
                actorCardId: options.actorCardId,
                expectedCp: options.expectedCp,
                expectedShield: options.expectedShield,
            }, { timeout: 15000, polling: 200 });

            const finalState = await guestPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                const shields = state?.core?.players?.['1']?.damageShields ?? [];
                return {
                    handIds: state?.core?.players?.['1']?.hand?.map((card: any) => card.id) ?? [],
                    discardIds: state?.core?.players?.['1']?.discard?.map((card: any) => card.id) ?? [],
                    cp: state?.core?.players?.['1']?.resources?.cp ?? 0,
                    shieldTotal: shields.reduce((sum: number, shield: any) => sum + (shield?.value ?? 0), 0),
                    lastEventTypes: entries.slice(-6).map((entry: any) => entry.event?.type),
                };
            });

            expect(finalState.handIds).not.toContain(options.actorCardId);
            expect(finalState.discardIds).toContain(options.actorCardId);
            expect(finalState.cp).toBe(options.expectedCp);
            expect(finalState.shieldTotal).toBe(options.expectedShield);
            expect(finalState.lastEventTypes).toContain('CARD_PLAYED');

            await hostPage.waitForTimeout(3600);
            await expect(hostSpotlight).toBeVisible({ timeout: 1000 });
            await expect(hostSpotlight.getByRole('button', { name: /关闭特写|Close Spotlight|Close/i })).toBeVisible({ timeout: 1000 });
            await hostSpotlight.getByRole('button', { name: /关闭特写|Close Spotlight|Close/i }).click();
            await expect(hostSpotlight).toBeHidden({ timeout: 5000 });
            await guestPage.waitForTimeout(500);
            await savePageEvidenceScreenshot(
                guestPage,
                testInfo,
                options.stateName,
                options.stateFilename,
            );
        };

        await applySceneAndPlay({
            actorCharacter: 'samurai',
            actorCardId: 'card-boss-generous',
            actorCp: 1,
            expectedCp: 3,
            expectedShield: 0,
            overlayName: '20-samurai-boss-generous-spotlight',
            overlayFilename: '20-samurai-boss-generous-spotlight.png',
            stateName: '21-samurai-boss-generous-state',
            stateFilename: '21-samurai-boss-generous-state.png',
        });

        await applySceneAndPlay({
            actorCharacter: 'gunslinger',
            actorCardId: 'card-next-time',
            actorCp: 2,
            expectedCp: 1,
            expectedShield: 6,
            responseScene: {
                pendingDamage: 6,
                responseWindowType: 'afterAttackResolved',
            },
            overlayName: '30-gunslinger-next-time-spotlight',
            overlayFilename: '30-gunslinger-next-time-spotlight.png',
            stateName: '31-gunslinger-next-time-state',
            stateFilename: '31-gunslinger-next-time-state.png',
        });
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});

test('mobile narrow viewport should keep magnify entries visible and clickable', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await setChineseLocale(page.context());
    await page.setViewportSize({ width: 812, height: 375 });
    await page.addInitScript((query: string) => {
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = ((media: string) => {
            if (media !== query) {
                return originalMatchMedia(media);
            }

            return {
                matches: true,
                media,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => true,
            } as MediaQueryList;
        }) as typeof window.matchMedia;
    }, '(pointer: coarse)');

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
            discard: ['card-play-six'],
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'samurai', '1': 'gunslinger' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await page.waitForFunction(
        () => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 812
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'offensiveRoll'
                && (state?.core?.players?.['0']?.discard?.length ?? 0) === 1;
        },
        { timeout: 10000, polling: 200 },
    );
    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const playerBoardMagnifyButton = page.locator('[data-testid="player-board-magnify-button"]');
    const playerBoardSurface = page.locator('[data-testid="player-board-surface"]');
    const playerBoardAbilitySlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]').first();
    const tipBoardSurface = page.locator('[data-testid="tip-board-surface"]');
    const discardPileInspectButton = page.locator('[data-testid="discard-pile-inspect-button"]');
    const autoResponseToggle = page.locator('[data-testid="auto-response-toggle"]');
    const boardMagnifyOverlay = page.locator('[data-testid="board-magnify-overlay"]');
    const diceFaces = page.getByTestId('dice-2d');
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
    const handArea = page.locator('[data-testid="hand-area"]');
    const handCards = handArea.locator('[data-card-id]');
    const firstHandCard = handCards.first();

    await expect(playerBoardMagnifyButton).toHaveCSS('opacity', '1');
    await expect(discardPileInspectButton).toHaveCSS('opacity', '1');
    await expectMinBoundingBox(playerBoardMagnifyButton, 'player board magnify button', 18, 18);
    await expectMinBoundingBox(discardPileInspectButton, 'discard pile inspect button', 14, 14);
    await expectMaxBoundingBox(playerBoardMagnifyButton, 'player board magnify button', 24, 24);
    await expectMaxBoundingBox(discardPileInspectButton, 'discard pile inspect button', 18, 18);
    await expectMaxBoundingBox(autoResponseToggle, 'auto response toggle', 88, 26);
    await expectMaxBoundingBox(rollButton, 'roll button', 44, 24);
    await expectMaxBoundingBox(confirmButton, 'confirm button', 44, 24);
    await expect(diceFaces).toHaveCount(5, { timeout: 5000 });
    await expectNoHorizontalOverflow(page);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    await expect(handArea).toBeVisible({ timeout: 5000 });
    await expect(handCards).toHaveCount(4, { timeout: 5000 });
    await expect(firstHandCard).toBeVisible({ timeout: 5000 });
    await expectElementInsideViewport(playerBoardMagnifyButton, 'player board magnify button', viewport!.width, viewport!.height);
    await expectElementInsideViewport(discardPileInspectButton, 'discard pile inspect button', viewport!.width, viewport!.height);
    await expectElementInsideViewport(rollButton, 'roll button', viewport!.width, viewport!.height);
    await expectElementInsideViewport(confirmButton, 'confirm button', viewport!.width, viewport!.height);
    await expectMinBoundingBox(handArea, 'mobile hand area', 260, 120);
    await expectMinBoundingBox(firstHandCard, 'mobile first hand card', 70, 110);
    await expectElementInsideViewport(firstHandCard, 'mobile first hand card', viewport!.width, viewport!.height);
    await expect(playerBoardSurface).toBeVisible({ timeout: 5000 });
    await expect(playerBoardAbilitySlot).toBeVisible({ timeout: 5000 });
    await expect(tipBoardSurface).toBeVisible({ timeout: 5000 });
    await expectCombinedHorizontalCenter(
        [playerBoardSurface, tipBoardSurface],
        'mobile center board cluster',
        viewport!.width,
        12,
    );

    await game.screenshot('10-mobile-main-board-state', testInfo);

    await playerBoardMagnifyButton.click();
    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    let overlayCloseButton = boardMagnifyOverlay.getByRole('button', { name: /关闭预览|Close Preview/i }).first();
    await expect(overlayCloseButton).toBeVisible({ timeout: 5000 });
    await game.screenshot('11-mobile-player-board-surface-magnify-open', testInfo);
    await boardMagnifyOverlay.click({ position: { x: 10, y: 10 } });
    await expect(boardMagnifyOverlay).toBeHidden({ timeout: 5000 });

    await playerBoardAbilitySlot.click();
    await page.waitForTimeout(300);
    await expect(boardMagnifyOverlay).toBeHidden();
    const confirmRollToast = page.getByText('请先确认投掷结果');
    await expect(confirmRollToast).toBeVisible({ timeout: 2000 });
    await expect(confirmRollToast).toBeHidden({ timeout: 6000 });

    await tipBoardSurface.click({ position: { x: 28, y: 80 } });
    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    overlayCloseButton = boardMagnifyOverlay.getByRole('button', { name: /关闭预览|Close Preview/i }).first();
    await expect(overlayCloseButton).toBeVisible({ timeout: 5000 });
    await game.screenshot('12-mobile-tip-board-surface-magnify-open', testInfo);
    await boardMagnifyOverlay.click({ position: { x: 10, y: 10 } });
    await expect(boardMagnifyOverlay).toBeHidden({ timeout: 5000 });

    await playerBoardMagnifyButton.click();
    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    overlayCloseButton = boardMagnifyOverlay.getByRole('button', { name: /关闭预览|Close Preview/i }).first();
    await expect(overlayCloseButton).toBeVisible({ timeout: 5000 });
    const magnifiedBoardFrame = overlayCloseButton.locator('xpath=following-sibling::div[1]');
    await expect(magnifiedBoardFrame).toBeVisible({ timeout: 5000 });
    const magnifiedBoardImage = boardMagnifyOverlay.locator('img[alt="Preview"]').first();
    await game.screenshot('13-mobile-player-board-button-magnify-open', testInfo);
    const magnifiedBoardImageCount = await magnifiedBoardImage.count();
    if (magnifiedBoardImageCount > 0) {
        const naturalSize = await magnifiedBoardImage.evaluate((node) => ({
            width: (node as HTMLImageElement).naturalWidth,
            height: (node as HTMLImageElement).naturalHeight,
        }));
        if (naturalSize.width > 0 && naturalSize.height > 0) {
            expect(naturalSize.width).toBe(2048);
            expect(naturalSize.height).toBe(1248);
        }
    }
    const magnifiedBoardBox = await magnifiedBoardFrame.boundingBox();
    expect(magnifiedBoardBox, 'magnified samurai board frame should expose bounding box').not.toBeNull();
    const renderedRatio = magnifiedBoardBox!.width / magnifiedBoardBox!.height;
    expect(Math.abs(renderedRatio - SAMURAI_PLAYER_BOARD_ASPECT_RATIO)).toBeLessThan(0.06);

    await boardMagnifyOverlay.click({ position: { x: 10, y: 10 } });
    await expect(boardMagnifyOverlay).toBeHidden({ timeout: 5000 });

    await discardPileInspectButton.click();
    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    await expect(overlayCloseButton).toBeVisible({ timeout: 5000 });
    const discardPreviewFrame = overlayCloseButton.locator('xpath=following-sibling::div[1]');
    await expect(discardPreviewFrame).toBeVisible({ timeout: 5000 });
    const multiCardStrip = boardMagnifyOverlay.getByTestId('dt-multi-card-magnify-strip');
    await expect(multiCardStrip).toBeVisible({ timeout: 5000 });
    const multiCardMetrics = await multiCardStrip.evaluate((strip) => {
        const stripRect = strip.getBoundingClientRect();
        const clipParentRect = strip.parentElement?.getBoundingClientRect();
        const cards = Array.from(strip.querySelectorAll('[data-card-atlas-frame="true"]')).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                bottom: rect.bottom,
            };
        });
        return {
            strip: { width: stripRect.width, height: stripRect.height, top: stripRect.top, bottom: stripRect.bottom },
            clipParent: clipParentRect
                ? { width: clipParentRect.width, height: clipParentRect.height, top: clipParentRect.top, bottom: clipParentRect.bottom }
                : null,
            cards,
        };
    });
    expect(multiCardMetrics.clipParent, 'multi-card preview should have a clipping parent').not.toBeNull();
    expect(multiCardMetrics.cards.length, 'discard preview should render at least one card').toBeGreaterThan(0);
    expect(multiCardMetrics.strip.height).toBeLessThanOrEqual(multiCardMetrics.clipParent!.height + 2);
    for (const [index, card] of multiCardMetrics.cards.entries()) {
        expect(card.height, `multi-card preview card ${index} height should fit inside strip`).toBeLessThanOrEqual(multiCardMetrics.strip.height + 2);
        expect(card.top, `multi-card preview card ${index} top should stay inside strip`).toBeGreaterThanOrEqual(multiCardMetrics.strip.top - 2);
        expect(card.bottom, `multi-card preview card ${index} bottom should stay inside strip`).toBeLessThanOrEqual(multiCardMetrics.strip.bottom + 2);
        expect(card.width / card.height, `multi-card preview card ${index} ratio should stay card-shaped`).toBeCloseTo(0.61, 1);
    }
    await game.screenshot('14-mobile-discard-pile-inspect-open', testInfo);
});

test('desktop v2 player board should stay within normal gameplay width', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await setChineseLocale(page.context());
    await page.setViewportSize({ width: 1365, height: 768 });

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 3, HP: 50 },
            discard: ['card-play-six'],
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'samurai', '1': 'gunslinger' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await page.waitForFunction(
        () => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 1365
                && state?.sys?.phase === 'offensiveRoll'
                && state?.core?.selectedCharacters?.['0'] === 'samurai'
                && state?.core?.selectedCharacters?.['1'] === 'gunslinger'
                && (state?.core?.players?.['0']?.discard?.length ?? 0) === 1;
        },
        { timeout: 10000, polling: 200 },
    );
    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const playerBoardSurface = page.locator('[data-testid="player-board-surface"]');
    const tipBoardSurface = page.locator('[data-testid="tip-board-surface"]');
    const playerBoardMagnifyButton = page.locator('[data-testid="player-board-magnify-button"]');
    const viewport = page.viewportSize();

    expect(viewport).not.toBeNull();
    await expect(playerBoardSurface).toBeVisible({ timeout: 5000 });
    await expect(tipBoardSurface).toBeVisible({ timeout: 5000 });
    await expect(playerBoardMagnifyButton).toBeVisible({ timeout: 5000 });
    await expectNoHorizontalOverflow(page);
    await expectElementInsideViewport(playerBoardSurface, 'desktop player board surface', viewport!.width, viewport!.height);
    await expectElementInsideViewport(tipBoardSurface, 'desktop tip board surface', viewport!.width, viewport!.height);
    await expectMinViewportWidthRatio(playerBoardSurface, 'desktop samurai player board surface', viewport!.width, 0.495);
    await expectMaxViewportWidthRatio(playerBoardSurface, 'desktop samurai player board surface', viewport!.width, 0.515);

    const [playerBoardBox, tipBoardBox] = await Promise.all([
        playerBoardSurface.boundingBox(),
        tipBoardSurface.boundingBox(),
    ]);
    expect(playerBoardBox, 'desktop player board should expose bounding box').not.toBeNull();
    expect(tipBoardBox, 'desktop tip board should expose bounding box').not.toBeNull();
    const boardGapPx = tipBoardBox!.x - (playerBoardBox!.x + playerBoardBox!.width);
    expect(boardGapPx, 'desktop v2 player board should keep a visible gap before tip board').toBeGreaterThan(0);
    expect(boardGapPx, 'desktop v2 player board and tip board should only keep a tight gap').toBeLessThanOrEqual(8);

    await game.screenshot('15-desktop-v2-board-layout', testInfo);
});

test('mobile long press hand card should open magnify without playing card', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await page.setViewportSize({ width: 812, height: 375 });
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['watch-out'],
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'watch-out');
    }, { timeout: 10000, polling: 200 });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const handCard = page.locator('[data-testid="hand-area"] [data-card-id="watch-out"]').first();
    const boardMagnifyOverlay = page.locator('[data-testid="board-magnify-overlay"]');

    await expect(handCard).toBeVisible({ timeout: 5000 });
    await expect(handCard).toHaveAttribute('data-is-flipped', 'true');

    const box = await handCard.boundingBox();
    expect(box, 'hand card should provide touch coordinates').not.toBeNull();
    const clientX = box!.x + box!.width / 2;
    const clientY = box!.y + box!.height / 2;

    await handCard.dispatchEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX,
        clientY,
    });
    await page.waitForTimeout(520);
    await handCard.dispatchEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX,
        clientY,
    });

    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    const magnifiedCardFrame = boardMagnifyOverlay
        .locator('[data-card-atlas-frame="true"][data-card-atlas-id="dicethrone:moon_elf-cards"][data-card-atlas-index="3"]')
        .first();
    await expect(magnifiedCardFrame).toBeVisible({ timeout: 5000 });
    const magnifiedCardMetrics = await magnifiedCardFrame.evaluate((node) => {
        const frameRect = node.getBoundingClientRect();
        const clipParentRect = node.parentElement?.getBoundingClientRect();
        return {
            frame: { width: frameRect.width, height: frameRect.height },
            clipParent: clipParentRect ? { width: clipParentRect.width, height: clipParentRect.height } : null,
        };
    });
    expect(magnifiedCardMetrics.clipParent, 'magnified hand card should have a clipping parent').not.toBeNull();
    expect(magnifiedCardMetrics.frame.height).toBeLessThanOrEqual(magnifiedCardMetrics.clipParent!.height + 2);
    expect(magnifiedCardMetrics.frame.width).toBeLessThanOrEqual(magnifiedCardMetrics.clipParent!.width + 2);
    expect(magnifiedCardMetrics.frame.width / magnifiedCardMetrics.frame.height).toBeCloseTo(0.61, 1);
    await game.screenshot('13-mobile-hand-long-press-magnify-open', testInfo);

    const stateAfterLongPress = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
        };
    });
    expect(stateAfterLongPress.handIds).toContain('watch-out');
});

test('mobile player board image should survive one view switch without remount blanking', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await setChineseLocale(page.context());
    await page.setViewportSize({ width: 812, height: 375 });
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 3, HP: 50 },
            discard: ['card-play-six'],
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'samurai', '1': 'gunslinger' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return window.innerWidth === 812
            && state?.sys?.phase === 'offensiveRoll'
            && state?.core?.selectedCharacters?.['0'] === 'samurai'
            && state?.core?.selectedCharacters?.['1'] === 'gunslinger';
    }, { timeout: 10000, polling: 200 });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const board = page.getByTestId('player-board-surface').first();
    const boardImage = page.getByTestId('player-board-image').first();
    const opponentHeader = page.getByTestId('dt-top-header-1').first();

    await expect(board).toHaveAttribute('data-character-id', 'samurai', { timeout: 5000 });
    await expect(board).toBeVisible({ timeout: 5000 });
    await expect(boardImage).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => boardImage.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(boardImage).toHaveAttribute('data-debug-current-src', /samurai/);

    await game.screenshot('16-mobile-board-view-switch-before', testInfo);

    await opponentHeader.click();
    await expect(board).toHaveAttribute('data-character-id', 'gunslinger', { timeout: 10000 });
    await expect(board).toBeVisible({ timeout: 5000 });
    await expect(boardImage).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => boardImage.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(boardImage).toHaveAttribute('data-debug-current-src', /gunslinger/);

    await game.screenshot('17-mobile-board-view-switch-after', testInfo);

    await opponentHeader.click();
    await expect(board).toHaveAttribute('data-character-id', 'samurai', { timeout: 10000 });
    await expect(board).toBeVisible({ timeout: 5000 });
    await expect(boardImage).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => boardImage.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(boardImage).toHaveAttribute('data-debug-current-src', /samurai/);

    await game.screenshot('18-mobile-board-view-switch-restored', testInfo);
});

test.describe('枪手 The Law 多目标交互', () => {
    test('should allow confirming after selecting only one target', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await injectGunslingerTheLawInteractionScene(page);
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.interaction?.current?.data?.sourceCardId === 'the-law'
                && state?.core?.players?.['2']?.nickname === '圣骑士-B';
        }, { timeout: 10000, polling: 200 });

        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).last();
        const targetOne = page.getByTestId('dt-player-target-1');
        const targetTwo = page.getByTestId('dt-player-target-2');

        await expect(targetOne).toBeVisible({ timeout: 5000 });
        await expect(targetTwo).toBeVisible({ timeout: 5000 });
        await expect(confirmButton).toBeDisabled();

        await targetOne.click();
        await expect(confirmButton).toBeEnabled();
        await game.screenshot('14-the-law-single-target-selected', testInfo);

        await confirmButton.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current;
        }, { timeout: 10000, polling: 200 });

        const stateAfter = await game.getState();
        expect(stateAfter.sys?.interaction?.current ?? null).toBeNull();
        expect(stateAfter.core.players['1'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['1'].statusEffects.knockdown).toBe(1);
        expect(stateAfter.core.players['2'].tokens.bounty ?? 0).toBe(0);
        expect(stateAfter.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        await game.screenshot('14-the-law-single-target-resolved', testInfo);
    });

    test('should resolve two selected targets in one confirmation', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await injectGunslingerTheLawInteractionScene(page);
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.interaction?.current?.data?.sourceCardId === 'the-law'
                && state?.core?.players?.['2']?.nickname === '圣骑士-B';
        }, { timeout: 10000, polling: 200 });

        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).last();
        const targetOne = page.getByTestId('dt-player-target-1');
        const targetTwo = page.getByTestId('dt-player-target-2');

        await targetOne.click();
        await targetTwo.click();
        await expect(confirmButton).toBeEnabled();
        await game.screenshot('15-the-law-two-targets-selected', testInfo);

        await confirmButton.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && state?.core?.players?.['1']?.tokens?.bounty === 1
                && state?.core?.players?.['2']?.tokens?.bounty === 1;
        }, { timeout: 10000, polling: 200 });

        const stateAfter = await game.getState();
        expect(stateAfter.sys?.interaction?.current ?? null).toBeNull();
        expect(stateAfter.core.players['1'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['2'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['1'].statusEffects.knockdown).toBe(1);
        expect(stateAfter.core.players['2'].statusEffects.knockdown).toBe(1);
        await game.screenshot('16-the-law-two-targets-resolved', testInfo);
    });
});

test.describe('枪手 The Law 升级变体真实触发', () => {
    test('should resolve immediately in 1v1 after selecting the upgraded variant', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);
        await injectGunslingerTheLawPlayScene(page, { multiplayer: false });
        await waitForGunslingerTheLawPlayScene(page, { multiplayer: false });

        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        await game.screenshot('22-the-law-variant-1v1-before-select', testInfo);

        await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: 'the-law' });
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && state?.core?.players?.['0']?.upgradeCardByAbilityId?.deadeye?.cardId === 'upgrade-deadeye-2'
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        const stateAfter = await game.getState();
        expect(stateAfter.sys?.interaction?.current ?? null).toBeNull();
        expect(stateAfter.core.players['0'].upgradeCardByAbilityId.deadeye?.cardId).toBe('upgrade-deadeye-2');
        expect(stateAfter.core.players['0'].tokens.evasive).toBe(1);
        expect(stateAfter.core.players['1'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['1'].statusEffects.knockdown).toBe(1);
        await game.screenshot('23-the-law-variant-1v1-after-resolve', testInfo);
    });

    test('should open multi-target interaction after selecting the upgraded variant in 3-player scene', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);
        await injectGunslingerTheLawPlayScene(page, { multiplayer: true });
        await waitForGunslingerTheLawPlayScene(page, { multiplayer: true });

        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).last();
        const targetOne = page.getByTestId('dt-player-target-1');
        const targetTwo = page.getByTestId('dt-player-target-2');

        await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: 'the-law' });
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.interaction?.current?.data?.sourceCardId === 'the-law'
                && state?.core?.players?.['0']?.upgradeCardByAbilityId?.deadeye?.cardId === 'upgrade-deadeye-2'
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(targetOne).toBeVisible({ timeout: 5000 });
        await expect(targetTwo).toBeVisible({ timeout: 5000 });
        await expect(confirmButton).toBeDisabled();

        await targetOne.click();
        await targetTwo.click();
        await expect(confirmButton).toBeEnabled();
        await game.screenshot('24-the-law-variant-3p-selected-targets', testInfo);

        await confirmButton.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['2']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 1
                && (state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        const stateAfter = await game.getState();
        expect(stateAfter.sys?.interaction?.current ?? null).toBeNull();
        expect(stateAfter.core.players['0'].upgradeCardByAbilityId.deadeye?.cardId).toBe('upgrade-deadeye-2');
        expect(stateAfter.core.players['0'].tokens.evasive).toBe(1);
        expect(stateAfter.core.players['1'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['2'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['1'].statusEffects.knockdown).toBe(1);
        expect(stateAfter.core.players['2'].statusEffects.knockdown).toBe(1);
        await game.screenshot('25-the-law-variant-3p-resolved', testInfo);
    });
});

test.describe('枪手 Mark the Target 升级变体真实触发', () => {
    test('should open target selection and apply bounty after selecting upgraded take cover variant', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);
        await injectGunslingerMarkTheTargetPlayScene(page);
        await waitForGunslingerMarkTheTargetPlayScene(page);

        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        await game.screenshot('32-mark-the-target-before-select', testInfo);

        await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: 'mark-the-target' });
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await page.waitForFunction(() => {
            const interaction = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
            return interaction?.data?.sourceCardId === 'mark-the-target'
                || interaction?.data?.resolveCustomActionId === 'gunslinger-card-mark-the-target-resolve';
        }, { timeout: 10000, polling: 200 });

        const targetOne = page.getByTestId('dt-player-target-1');
        const targetTwo = page.getByTestId('dt-player-target-2');
        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).last();

        await expect(targetOne).toBeVisible({ timeout: 5000 });
        await expect(targetTwo).toBeVisible({ timeout: 5000 });
        await expect(confirmButton).toBeDisabled();

        await targetOne.click();
        await expect(confirmButton).toBeEnabled();
        await game.screenshot('33-mark-the-target-selected-target', testInfo);

        await confirmButton.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 2
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['2']?.tokens?.bounty ?? 0) === 0;
        }, { timeout: 10000, polling: 200 });

        const stateAfter = await game.getState();
        expect(stateAfter.sys?.interaction?.current ?? null).toBeNull();
        expect(stateAfter.core.players['0'].tokens.evasive).toBe(2);
        expect(stateAfter.core.players['1'].tokens.bounty).toBe(1);
        expect(stateAfter.core.players['2'].tokens.bounty ?? 0).toBe(0);
        await game.screenshot('34-mark-the-target-resolved', testInfo);
    });
});
