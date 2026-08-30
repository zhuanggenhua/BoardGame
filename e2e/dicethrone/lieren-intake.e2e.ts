/**
 * DiceThrone 女猎手真实入口证据。
 *
 * 范围：真实在线双玩家选角、开局、玩家板、手牌、妮拉伙伴状态和流血状态图标。
 * 提示卡和其他 DiceThrone 英雄一样在选角与对局运行时可见。
 * 妮拉实现由本轮用户直接授权；候选设计稿仍不作为验收通过依据。
 */

import type { Browser, Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import type { DiceThroneCore, PendingDamage } from '../../src/games/dicethrone/domain/types';
import { buildDiceThroneTokenResponseChoiceCandidates } from '../../src/games/dicethrone/domain/timingOpportunities';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const LIEREN_SLOT_ABILITIES = {
    fist: 'wild-force',
    chi: 'savage-force',
    sky: 'life-revival',
    lotus: 'beast-instinct',
    combo: 'brutal-strike',
    lightning: 'beast-force',
    calm: 'hunt-ambush',
    meditate: 'kindred-bond',
    ultimate: 'jungle-fury',
} as const;

const asRecord = (value: unknown): JsonRecord => (
    value && typeof value === 'object' ? value as JsonRecord : {}
);

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const waitForDamageFxToSettle = async (page: Page): Promise<void> => {
    await expect(page.getByTestId('flying-effect-damage')).toHaveCount(0, { timeout: 5000 });
    await page.waitForTimeout(2500);
};

const waitForImage = async (page: Page, testId: string): Promise<void> => {
    const image = page.getByTestId(testId);
    await expect(image).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => image.evaluate((node) => ({
        complete: (node as HTMLImageElement).complete,
        naturalWidth: (node as HTMLImageElement).naturalWidth,
    }))).toEqual({ complete: true, naturalWidth: expect.any(Number) });
    const naturalWidth = await image.evaluate((node) => (node as HTMLImageElement).naturalWidth);
    expect(naturalWidth, `${testId} 应加载正式图片`).toBeGreaterThan(0);
};

const boxesOverlap = (
    first: { x: number; y: number; width: number; height: number },
    second: { x: number; y: number; width: number; height: number },
): boolean => (
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
);

const NYRA_DAMAGE_SLIDER_NAME = '妮拉承伤';
const NYRA_E2E_DAMAGE = 8;
const NYRA_E2E_COMPANION_HP = 5;
const NYRA_E2E_BOND_ALLOCATION = 6;

const setNyraDamageAllocation = async (page: Page, amount: number): Promise<void> => {
    const slider = page.getByRole('slider', { name: NYRA_DAMAGE_SLIDER_NAME });
    const sliderBox = await slider.boundingBox();
    expect(sliderBox, '妮拉承伤滑块必须有真实可拖动区域').not.toBeNull();
    const maxValue = Number(await slider.getAttribute('max'));
    expect(maxValue, '妮拉承伤滑块必须声明最大伤害值').toBeGreaterThan(0);
    const targetRatio = Math.max(0, Math.min(1, amount / maxValue));
    const startX = sliderBox!.x + 2;
    const targetX = sliderBox!.x + Math.max(2, Math.min(sliderBox!.width - 2, sliderBox!.width * targetRatio));
    const centerY = sliderBox!.y + sliderBox!.height / 2;

    await page.mouse.move(startX, centerY);
    await page.mouse.down();
    await page.mouse.move(targetX, centerY, { steps: 12 });
    await page.mouse.up();
    await expect(slider).toHaveValue(String(amount));
};

const getHostPlayer = async (matchId: string, page: Page): Promise<JsonRecord> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const players = asRecord(core.players);
    return asRecord(players['0']);
};

const expectHostHp = async (matchId: string, page: Page, expectedHp: number): Promise<void> => {
    await expect.poll(async () => {
        const host = await getHostPlayer(matchId, page);
        return Number(asRecord(host.resources)[RESOURCE_IDS.HP] ?? Number.NaN);
    }, { timeout: 10000 }).toBe(expectedHp);
};

const expectNyraDamageChoiceContract = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const sys = asRecord(root.sys);
    const interaction = asRecord(asRecord(sys.interaction).current);
    const contract = asRecord(asRecord(interaction.data).choiceRequestContract);
    const candidates = Array.isArray(contract.candidates) ? contract.candidates : [];
    const commandPayloads = candidates
        .flatMap(candidate => {
            const commands = asRecord(candidate).commands;
            return Array.isArray(commands) ? commands : [];
        })
        .filter(command => asRecord(command).type === 'USE_TOKEN')
        .map(command => asRecord(asRecord(command).payload));

    expect(interaction.kind).toBe('dt:token-response');
    expect(contract.requestId).toBe('dicethrone:token-response:e2e-nyra-damage-response:beforeDamageReceived:0');
    expect(commandPayloads).toEqual(expect.arrayContaining([
        expect.objectContaining({ tokenId: TOKEN_IDS.NYRA_REDIRECT, amount: NYRA_E2E_DAMAGE, pendingDamageId: 'e2e-nyra-damage-response' }),
        expect.objectContaining({ tokenId: TOKEN_IDS.NYRAS_BOND, amount: 1, pendingDamageId: 'e2e-nyra-damage-response' }),
        expect.objectContaining({ tokenId: TOKEN_IDS.NYRAS_BOND, amount: NYRA_E2E_BOND_ALLOCATION, pendingDamageId: 'e2e-nyra-damage-response' }),
        expect.objectContaining({ tokenId: TOKEN_IDS.NYRAS_BOND, amount: NYRA_E2E_DAMAGE - 1, pendingDamageId: 'e2e-nyra-damage-response' }),
    ]));
    expect(commandPayloads.some(payload => (
        payload.tokenId === TOKEN_IDS.NYRAS_BOND
        && payload.amount === NYRA_E2E_DAMAGE
    ))).toBe(false);
};

const expectUsableNyraControl = async (page: Page): Promise<void> => {
    const allocateButton = page.getByTestId('nyra-allocate-damage-button');
    const slider = page.getByRole('slider', { name: NYRA_DAMAGE_SLIDER_NAME });
    const dock = page.getByTestId('nyra-damage-response-dock');
    const leftSidebar = page.getByTestId('left-sidebar');
    const statusTokens = page.locator('[data-tutorial-id="status-tokens"]');
    const statsPanel = page.getByTestId('dt-player-stats-panel');
    const drawDeck = page.locator('[data-tutorial-id="draw-deck"]');
    const handCards = page.locator('[data-testid="hand-area"] [data-card-id]');

    await expect(page.getByTestId('nyra-take-damage-button')).toHaveCount(0);
    const [allocateBox, sliderBox, dockBox, sidebarBox, statusBox, deckBox] = await Promise.all([
        allocateButton.boundingBox(),
        slider.boundingBox(),
        dock.boundingBox(),
        leftSidebar.boundingBox(),
        statusTokens.boundingBox(),
        drawDeck.boundingBox(),
    ]);
    expect(allocateBox, '确认分配按钮必须有可点击矩形').not.toBeNull();
    expect(sliderBox, '妮拉承伤滑杆必须有可拖动矩形').not.toBeNull();
    expect(dockBox, '妮拉响应弹窗必须是玩家能读的居中大弹窗').not.toBeNull();
    expect(sidebarBox, '左侧玩家 HUD 必须有可见矩形').not.toBeNull();
    expect(statusBox, '状态图标区必须有可见矩形').not.toBeNull();
    expect(deckBox, '牌堆必须有可见矩形').not.toBeNull();
    await expect(handCards.first()).toBeVisible({ timeout: 10000 });
    expect(dockBox!.width, '妮拉响应弹窗必须是正式可读大弹窗，不能退回左栏小窄条').toBeGreaterThanOrEqual(360);
    expect(allocateBox!.height, '确认分配按钮必须足够高，不能小到难点').toBeGreaterThanOrEqual(48);
    expect(allocateBox!.width, '确认分配按钮必须足够宽，不能小到难读').toBeGreaterThanOrEqual(280);
    expect(sliderBox!.width, '妮拉承伤滑杆必须足够宽，不能小到难拖').toBeGreaterThanOrEqual(280);
    const viewport = page.viewportSize();
    expect(viewport, 'E2E 必须有固定视口以验证弹窗居中').not.toBeNull();
    const dockCenterX = dockBox!.x + dockBox!.width / 2;
    const dockCenterY = dockBox!.y + dockBox!.height / 2;
    expect(Math.abs(dockCenterX - viewport!.width / 2), `妮拉响应弹窗必须水平居中 ${JSON.stringify({ dockBox, viewport })}`).toBeLessThanOrEqual(12);
    expect(Math.abs(dockCenterY - viewport!.height / 2), `妮拉响应弹窗必须垂直居中 ${JSON.stringify({ dockBox, viewport })}`).toBeLessThanOrEqual(12);
    expect(
        boxesOverlap(dockBox!, statusBox!),
        `妮拉响应弹窗不得压住状态 / Token 图标区 ${JSON.stringify({ dockBox, statusBox })}`,
    ).toBe(false);
    expect(
        boxesOverlap(dockBox!, deckBox!),
        `妮拉响应弹窗不得压住牌堆 ${JSON.stringify({ dockBox, deckBox })}`,
    ).toBe(false);
    const resourceBoxes = await statsPanel.locator('[data-dicethrone-resource]').evaluateAll((nodes) => (
        nodes
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
    ));
    for (const resourceBox of resourceBoxes) {
        expect(
            boxesOverlap(dockBox!, resourceBox),
            `妮拉响应弹窗不得压住生命 / CP 条 ${JSON.stringify({ dockBox, resourceBox })}`,
        ).toBe(false);
    }
    const handCardBoxes = await handCards.evaluateAll((nodes) => (
        nodes
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
    ));
    for (const handCardBox of handCardBoxes) {
        expect(
            boxesOverlap(dockBox!, handCardBox),
            `妮拉响应弹窗不得压住手牌卡片本体 ${JSON.stringify({ dockBox, handCardBox })}`,
        ).toBe(false);
    }

    const fontSizes = await page.getByTestId('nyra-damage-response-dock').evaluate((panel) => {
        const buttons = Array.from(panel.querySelectorAll('button'));
        return buttons.map((button) => Number.parseFloat(window.getComputedStyle(button).fontSize));
    });
    expect(Math.min(...fontSizes), '妮拉响应按钮字号不能低于 15px').toBeGreaterThanOrEqual(15);
};

const expectNyraInsidePlayerBoardImage = async (page: Page): Promise<void> => {
    const leftSidebar = page.getByTestId('left-sidebar');
    const anchor = page.getByTestId('nyra-player-panel-anchor');
    const board = page.getByTestId('player-board-surface');
    const nyraPanel = page.getByTestId('nyra-companion-panel');
    const statusTokens = page.locator('[data-tutorial-id="status-tokens"]');
    const statsPanel = page.getByTestId('dt-player-stats-panel');
    const drawDeck = page.locator('[data-tutorial-id="draw-deck"]');
    const turnOrderPanel = page.getByTestId('turn-order-panel');

    await expect(anchor).toBeVisible({ timeout: 10000 });
    await expect(anchor).toHaveAttribute('data-player-panel-slot', 'player-board-image-top-left-blank');
    await expect(anchor.getByTestId('nyra-companion-panel')).toBeVisible({ timeout: 10000 });
    await expect(board.getByTestId('nyra-companion-panel')).toBeVisible({ timeout: 10000 });
    await expect(leftSidebar.getByTestId('nyra-companion-panel')).toHaveCount(0);
    await expect(statusTokens.getByTestId('nyra-companion-panel')).toHaveCount(0);

    const [boardContainsNyra, sidebarContainsNyra, statsContainsNyra] = await Promise.all([
        board.evaluate((boardNode) => (
            Boolean(boardNode.querySelector('[data-testid="nyra-companion-panel"]'))
        )),
        leftSidebar.evaluate((sidebarNode) => (
            Boolean(sidebarNode.querySelector('[data-testid="nyra-companion-panel"]'))
        )),
        statsPanel.evaluate((statsNode) => (
            Boolean(statsNode.querySelector('[data-testid="nyra-player-panel-anchor"]'))
        )),
    ]);
    expect(boardContainsNyra, '妮拉面板必须挂在中间玩家板图片内部，而不是左侧 HUD').toBe(true);
    expect(sidebarContainsNyra, '左侧 HUD 不得再承载妮拉面板').toBe(false);
    expect(statsContainsNyra, '妮拉面板不得再挂进生命 / CP 统计行，否则会挤压资源条').toBe(false);

    const sidebarBox = await leftSidebar.boundingBox();
    const anchorBox = await anchor.boundingBox();
    const nyraBox = await nyraPanel.boundingBox();
    const statusBox = await statusTokens.boundingBox();
    const statsBox = await statsPanel.boundingBox();
    const deckBox = await drawDeck.boundingBox();
    const turnOrderBox = await turnOrderPanel.boundingBox();
    const boardBox = await board.boundingBox();
    const abilitySlotBoxes = await board.locator('[data-ability-slot]').evaluateAll((nodes) => (
        nodes
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
    ));
    expect(sidebarBox, '左侧玩家 HUD 必须有可见矩形').not.toBeNull();
    expect(anchorBox, '妮拉图片内锚点必须有可见矩形').not.toBeNull();
    expect(nyraBox, '妮拉面板必须有可见矩形').not.toBeNull();
    expect(statusBox, '状态图标区必须有可见矩形').not.toBeNull();
    expect(statsBox, '生命与 CP 面板必须有可见矩形').not.toBeNull();
    expect(deckBox, '牌堆必须有可见矩形').not.toBeNull();
    expect(turnOrderBox, '回合顺序面板必须有可见矩形').not.toBeNull();
    expect(boardBox, '中间玩家板必须有可见矩形').not.toBeNull();

    const epsilon = 1;
    expect(nyraBox!.x).toBeGreaterThanOrEqual(boardBox!.x - epsilon);
    expect(nyraBox!.y).toBeGreaterThanOrEqual(boardBox!.y - epsilon);
    expect(nyraBox!.x + nyraBox!.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width + epsilon);
    expect(nyraBox!.y + nyraBox!.height).toBeLessThanOrEqual(boardBox!.y + boardBox!.height + epsilon);
    expect(nyraBox!.x - boardBox!.x, '妮拉状态应贴在玩家板图片左上角空白带内，不得漂到中央虎图或左侧 HUD').toBeLessThan(boardBox!.width * 0.20);
    expect(nyraBox!.y - boardBox!.y, '妮拉状态应落在玩家板图片顶部空白，不得跑到 Buff / 血条区').toBeLessThan(boardBox!.height * 0.12);
    expect(nyraBox!.width, '妮拉状态必须充分利用玩家板左上空白带，不能再缩成过小角标').toBeGreaterThanOrEqual(boardBox!.width * 0.29);
    expect(nyraBox!.width, '妮拉状态仍必须保持在左上空白带内，不能压住技能牌或虎头主体').toBeLessThanOrEqual(boardBox!.width * 0.34);
    expect(nyraBox!.height, '妮拉状态必须清楚可读，不能再缩成过小角标').toBeGreaterThanOrEqual(boardBox!.height * 0.14);
    expect(nyraBox!.height, '妮拉状态仍必须停留在顶部空白带内，不能压住技能牌').toBeLessThanOrEqual(boardBox!.height * 0.19);

    const topLeftAbilitySlotBoxes = abilitySlotBoxes
        .filter((slotBox) => slotBox.x < boardBox!.x + boardBox!.width * 0.36)
        .sort((a, b) => a.y - b.y);
    expect(topLeftAbilitySlotBoxes.length, '女猎手左上技能牌槽必须可用于衡量玩家板左上空白带').toBeGreaterThan(0);
    const topLeftBlankBottom = Math.min(...topLeftAbilitySlotBoxes.map((slotBox) => slotBox.y));
    expect(
        nyraBox!.y + nyraBox!.height,
        '妮拉状态必须利用技能牌上方空白带，但底部不得压到左上技能牌槽',
    ).toBeLessThanOrEqual(topLeftBlankBottom - 4);
    for (const slotBox of abilitySlotBoxes) {
        expect(
            boxesOverlap(nyraBox!, slotBox),
            `妮拉状态不得遮挡玩家板技能牌槽位 ${JSON.stringify({ nyraBox, slotBox })}`,
        ).toBe(false);
    }
    expect(boxesOverlap(nyraBox!, statusBox!), '妮拉面板不得压住或挤进状态图标区').toBe(false);
    expect(boxesOverlap(nyraBox!, deckBox!), '妮拉面板不得压住牌堆').toBe(false);
    expect(
        boxesOverlap(nyraBox!, turnOrderBox!),
        `妮拉面板不得压住回合顺序 ${JSON.stringify({ nyraBox, turnOrderBox, statusBox, statsBox, deckBox })}`,
    ).toBe(false);

    const protectedIconBoxes = await statusTokens.locator('[data-status-id], [data-token-id]').evaluateAll((nodes) => (
        nodes
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
    ));
    for (const iconBox of protectedIconBoxes) {
        expect(
            boxesOverlap(nyraBox!, iconBox),
            `妮拉状态不得遮挡真实状态 / Token 图标 ${JSON.stringify({ nyraBox, iconBox })}`,
        ).toBe(false);
    }

    const resourceBoxes = await statsPanel.locator('[data-dicethrone-resource]').evaluateAll((nodes) => (
        nodes
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
    ));
    for (const resourceBox of resourceBoxes) {
        expect(resourceBox.width, '生命 / CP 条必须保持完整宽度，妮拉不得再占用资源条行宽').toBeGreaterThanOrEqual(160);
        expect(
            boxesOverlap(nyraBox!, resourceBox),
            `妮拉面板不得遮挡生命 / CP 条 ${JSON.stringify({ nyraBox, resourceBox })}`,
        ).toBe(false);
    }
};

const setupLierenMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await selectCharacter(match.hostPage, 'lieren');
    await selectCharacter(match.guestPage, 'monk');
    return match;
};

const injectLierenBleedStatus = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecord(core.players);
    const host = asRecord(players['0']);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(players);
    const phase = typeof core.phase === 'string'
        ? core.phase
        : typeof sys.phase === 'string'
            ? sys.phase
            : 'main';
    nextRoot.core = {
        ...core,
        phase,
        players: {
            ...players,
            '0': {
                ...host,
                statusEffects: {
                    ...asRecord(host.statusEffects),
                    [STATUS_IDS.BLEED]: 1,
                },
            },
        },
    };
    nextRoot.sys = {
        ...sys,
        phase,
        turnOrder,
        currentPlayerIndex: typeof sys.currentPlayerIndex === 'number' ? sys.currentPlayerIndex : 0,
    };
    await injectMatchState(matchId, next as never, page);
};

const injectNyraDamageResponse = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecord(core.players);
    const host = asRecord(players['0']);
    const companion = asRecord(host.companion);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);

    const pendingDamage: PendingDamage = {
        id: 'e2e-nyra-damage-response',
        sourcePlayerId: '1',
        targetPlayerId: '0',
        originalDamage: NYRA_E2E_DAMAGE,
        currentDamage: NYRA_E2E_DAMAGE,
        sourceAbilityId: 'e2e-nyra-hit',
        responseType: 'beforeDamageReceived',
        responderId: '0',
        isFullyEvaded: false,
    };
    const nextCore = {
        ...core,
        players: {
            ...players,
            '0': {
                ...host,
                companion: { ...companion, hp: NYRA_E2E_COMPANION_HP, maxHp: 7 },
                resources: { ...asRecord(host.resources), [RESOURCE_IDS.HP]: 50 },
                tokens: { ...asRecord(host.tokens), [TOKEN_IDS.NYRAS_BOND]: 1 },
            },
        },
        pendingAttack: {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'e2e-nyra-hit',
            isDefendable: true,
            damage: NYRA_E2E_DAMAGE,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
            preDefenseResolved: true,
            offensiveRollEndTokenResolved: true,
        },
        pendingDamage,
    } as unknown as DiceThroneCore;
    const resolutionFrameId = `dicethrone:token-response-frame:${pendingDamage.id}`;
    const choiceRequestContract = {
        requestId: `dicethrone:token-response:${pendingDamage.id}:${pendingDamage.responseType}:${pendingDamage.responderId}`,
        playerId: pendingDamage.responderId,
        kind: 'choose-option',
        sourceId: 'dicethrone_token_response',
        candidates: buildDiceThroneTokenResponseChoiceCandidates(nextCore, pendingDamage),
        selection: { min: 1, max: 1 },
        resolution: { type: 'candidate-commands' },
        metadata: {
            pendingDamageId: pendingDamage.id,
            resolutionFrameId,
            sourcePlayerId: pendingDamage.sourcePlayerId,
            targetPlayerId: pendingDamage.targetPlayerId,
            responderId: pendingDamage.responderId,
            responseType: pendingDamage.responseType,
            sourceAbilityId: pendingDamage.sourceAbilityId,
            originalDamage: pendingDamage.originalDamage,
            currentDamage: pendingDamage.currentDamage,
            priority: 70,
        },
    };

    nextRoot.core = nextCore;
    nextRoot.sys = {
        ...sys,
        interaction: {
            ...asRecord(sys.interaction),
            current: {
                id: `dt-token-response-${pendingDamage.id}`,
                kind: 'dt:token-response',
                playerId: pendingDamage.responderId,
                resolutionFrameId,
                data: { choiceRequestContract },
            },
            queue: [],
        },
    };
    await injectMatchState(matchId, next as never, page);
};

test.describe('DiceThrone 女猎手真实入口', () => {
    test('真实在线双玩家应完成女猎手选角初始化、显示提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupLierenMatch(browser, baseURL);

        try {
            await expect(match.hostPage.locator('[data-character-id="lieren"]')).toContainText(/P1/i);
            await expect(match.guestPage.locator('[data-character-id="monk"]')).toContainText(/P2/i);
            await waitForImage(match.hostPage, 'character-selection-player-board-image');
            await expect(match.hostPage.getByTestId('character-selection-player-board-image'))
                .toHaveAttribute('data-debug-current-src', /dicethrone\/images\/lieren\/compressed\/player-board\.webp/i);
            await expect(match.hostPage.getByTestId('tip-board-image')).toBeVisible();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-选角-女猎手与武僧-角色板');

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
            await expect(hostBoard).toHaveAttribute('data-character-id', 'lieren', { timeout: 10000 });
            for (const [slotId, abilityId] of Object.entries(LIEREN_SLOT_ABILITIES)) {
                await expect(hostBoard.locator(`[data-ability-slot="${slotId}"]`).first())
                    .toHaveAttribute('data-base-ability-id', abilityId);
            }
            await waitForImage(match.hostPage, 'player-board-image');
            await expect(match.hostPage.getByTestId('player-board-image'))
                .toHaveAttribute('data-debug-current-src', /dicethrone\/images\/lieren\/compressed\/player-board\.webp/i);
            const nyraPanel = match.hostPage.getByTestId('nyra-companion-panel');
            await expect(nyraPanel).toBeVisible({ timeout: 10000 });
            await expect(nyraPanel).toContainText('7/7');
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 10000 });
            await expect(match.hostPage.getByTestId('tip-board-image')).toBeVisible();

            await injectLierenBleedStatus(match.matchId, match.hostPage);
            const statusTokens = match.hostPage.locator('[data-tutorial-id="status-tokens"]');
            await expect(statusTokens).toBeVisible({ timeout: 10000 });
            await expect(statusTokens.locator(`[data-status-id="${STATUS_IDS.BLEED}"]`)).toBeVisible({ timeout: 10000 });
            await expectNyraInsidePlayerBoardImage(match.hostPage);

            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-牌桌-妮拉在玩家板图片左上空白');
            await injectNyraDamageResponse(match.matchId, match.hostPage);
            await expectNyraDamageChoiceContract(match.matchId, match.hostPage);
            await expectHostHp(match.matchId, match.hostPage, 50);
            await expect(match.hostPage.getByTestId('token-response-modal')).toHaveCount(0);
            await expect(nyraPanel).toBeVisible({ timeout: 10000 });
            await expect(nyraPanel).toContainText(String(NYRA_E2E_DAMAGE));
            await expect(match.hostPage.getByRole('slider', { name: NYRA_DAMAGE_SLIDER_NAME })).toHaveValue('0');
            await expect(match.hostPage.getByRole('button', { name: '确认分配' })).toBeVisible();
            await expect(match.hostPage.getByRole('button', { name: '转移伤害' })).toHaveCount(0);
            await expect(match.hostPage.getByText('不分派：女猎手承受 8 点伤害。')).toBeVisible();
            await expectNyraInsidePlayerBoardImage(match.hostPage);
            await expectUsableNyraControl(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-8点伤害响应-默认0不分派-单确认弹窗');

            await match.hostPage.getByRole('button', { name: '确认分配' }).click();
            await expect(match.hostPage.getByRole('button', { name: '确认分配' })).toHaveCount(0);
            await expect(nyraPanel).toContainText('5/7', { timeout: 10000 });
            await expect(match.hostPage.getByTestId('nyra-bond-state')).toContainText('1/1');
            await expectHostHp(match.matchId, match.hostPage, 42);
            await expectNyraInsidePlayerBoardImage(match.hostPage);
            await waitForDamageFxToSettle(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-8点默认0确认后-女猎手承受全部伤害');

            await injectNyraDamageResponse(match.matchId, match.hostPage);
            await expectNyraDamageChoiceContract(match.matchId, match.hostPage);
            await expectHostHp(match.matchId, match.hostPage, 50);
            await expect(nyraPanel).toContainText('5/7', { timeout: 10000 });
            await expect(match.hostPage.getByRole('button', { name: '确认分配' })).toBeVisible({ timeout: 10000 });
            await setNyraDamageAllocation(match.hostPage, NYRA_E2E_DAMAGE);
            await expect(match.hostPage.getByText('全转移：妮拉承受 8 点伤害，不消耗羁绊。')).toBeVisible();
            await match.hostPage.getByRole('button', { name: '确认分配' }).click();
            await expect(match.hostPage.getByRole('slider', { name: NYRA_DAMAGE_SLIDER_NAME })).toHaveCount(0, { timeout: 10000 });
            await expect(nyraPanel).toContainText('0/7', { timeout: 10000 });
            await expect(match.hostPage.getByTestId('nyra-bond-state')).toContainText('1/1');
            await expectHostHp(match.matchId, match.hostPage, 50);
            await expectNyraInsidePlayerBoardImage(match.hostPage);
            await waitForDamageFxToSettle(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-8点拉满确认后-妮拉承受全部伤害不耗羁绊');

            await injectNyraDamageResponse(match.matchId, match.hostPage);
            await expectNyraDamageChoiceContract(match.matchId, match.hostPage);
            await expectHostHp(match.matchId, match.hostPage, 50);
            await expect(nyraPanel).toContainText('5/7', { timeout: 10000 });
            await expect(match.hostPage.getByRole('button', { name: '确认分配' })).toBeVisible({ timeout: 10000 });
            await setNyraDamageAllocation(match.hostPage, NYRA_E2E_BOND_ALLOCATION);
            await expect(match.hostPage.getByText('消耗 1 个羁绊：妮拉承受 6 点，女猎手承受 2 点。')).toBeVisible();
            await match.hostPage.getByRole('button', { name: '确认分配' }).click();
            await expect(match.hostPage.getByRole('slider', { name: NYRA_DAMAGE_SLIDER_NAME })).toHaveCount(0, { timeout: 10000 });
            await expect(nyraPanel).toContainText('0/7', { timeout: 10000 });
            await expect(match.hostPage.getByTestId('nyra-bond-state')).toContainText('0/1');
            await expectHostHp(match.matchId, match.hostPage, 48);
            await expectNyraInsidePlayerBoardImage(match.hostPage);
            await waitForDamageFxToSettle(match.hostPage);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06-8点羁绊分配6点确认后-女猎手承受2点');

            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', 'monk', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '07-牌桌-对手视角已进入');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
