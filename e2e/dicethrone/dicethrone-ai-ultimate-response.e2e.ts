import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import type { MatchState } from '../../src/engine/types';
import type { DiceThroneCore } from '../../src/games/dicethrone/types';
import {
    dispatchDiceThroneCommand,
    readDiceThroneHarnessState,
    waitForDiceThronePhase,
} from '../helpers/dicethrone';
import { DICETHRONE_CARD_ATLAS_IDS } from '../../src/games/dicethrone/domain/ids';

type DiceThroneMatchState = MatchState<DiceThroneCore>;

const OPEN_TIMEOUT_MS = 180000;
const TEST_TIMEOUT_MS = 120000;

async function changeFirstDieFromSixToFive(page: Page): Promise<void> {
    const dieButton = page.getByTestId('die-button-0').first();
    await expect(dieButton).toBeVisible({ timeout: 10000 });
    await expect(dieButton).toHaveAttribute('data-display-value', '6');

    const decrementButton = page.getByTestId('die-adjust-decrement-0').first();
    await expect(decrementButton).toBeVisible({ timeout: 10000 });
    await decrementButton.click();
    await expect(dieButton).toHaveAttribute('data-display-value', '5');

    const confirmModifyButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
    await expect(confirmModifyButton).toBeEnabled({ timeout: 10000 });
    await confirmModifyButton.click();
}

async function readSurpriseCardFaceState(page: Page) {
    return page.evaluate(() => {
        const handCard = document.querySelector<HTMLElement>('[data-testid="hand-area"] [data-card-id="card-surprise"]');
        if (!handCard) throw new Error('响应手牌 card-surprise 缺失');
        const visual = handCard.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? handCard;
        const frontFace = handCard.querySelector<HTMLElement>('[data-card-face="front"]');
        const atlasFrame = frontFace?.querySelector<HTMLElement>('[data-card-atlas-frame="true"]') ?? null;
        const atlasImg = atlasFrame?.querySelector<HTMLImageElement>('[data-card-atlas-img="true"]') ?? null;
        const visualRect = visual.getBoundingClientRect();
        const frameRect = atlasFrame?.getBoundingClientRect() ?? null;
        const visibleTop = Math.max(0, visualRect.top);
        const visibleBottom = Math.min(window.innerHeight, visualRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        return {
            flipped: handCard.dataset.isFlipped ?? null,
            atlasId: atlasFrame?.dataset.cardAtlasId ?? null,
            atlasIndex: atlasFrame?.dataset.cardAtlasIndex ?? null,
            imgComplete: atlasImg?.complete ?? false,
            naturalWidth: atlasImg?.naturalWidth ?? 0,
            naturalHeight: atlasImg?.naturalHeight ?? 0,
            visualTop: visualRect.top,
            visualBottom: visualRect.bottom,
            visualHeight: visualRect.height,
            visibleHeight,
            visibleHeightRatio: visualRect.height > 0 ? visibleHeight / visualRect.height : 0,
            frameWidth: frameRect?.width ?? 0,
            frameHeight: frameRect?.height ?? 0,
            viewportHeight: window.innerHeight,
        };
    });
}

async function expectSurpriseCardFaceVisible(page: Page): Promise<void> {
    await expect.poll(async () => {
        const state = await readSurpriseCardFaceState(page);
        return {
            flipped: state.flipped,
            atlasId: state.atlasId,
            atlasIndex: state.atlasIndex,
            imgReady: state.imgComplete && state.naturalWidth > 0 && state.naturalHeight > 0,
            frameReady: state.frameWidth > 0 && state.frameHeight > 0,
        };
    }, { timeout: 10000 }).toEqual({
        flipped: 'true',
        atlasId: DICETHRONE_CARD_ATLAS_IDS.CURSED_PIRATE,
        atlasIndex: '10',
        imgReady: true,
        frameReady: true,
    });

    const state = await readSurpriseCardFaceState(page);
    expect(state.visibleHeightRatio, '响应卡牌面必须完整显示，不能只证明元素存在').toBeGreaterThanOrEqual(0.98);
    expect(state.visualTop, '响应卡牌顶部不能被视口裁掉').toBeGreaterThanOrEqual(0);
    expect(state.visualBottom, '响应卡牌底部不能被视口裁掉').toBeLessThanOrEqual(state.viewportHeight);
}

test.describe('DiceThrone AI 终极招式发动前响应', () => {
    test('真人响应提示更显眼且可跳过并关闭响应窗口', async ({ page, game }, testInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', { playerID: '1', disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 10, HP: 50 },
            },
            player1: {
                hand: ['card-surprise'],
                resources: { CP: 10, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'zhanshujia', '1': 'cursed_pirate' },
                seatControllers: {
                    '0': { type: 'local-ai', difficulty: 'expert' },
                    '1': { type: 'human' },
                },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 6, isKept: false },
                    { id: 1, value: 6, isKept: false },
                    { id: 2, value: 6, isKept: false },
                    { id: 3, value: 6, isKept: false },
                    { id: 4, value: 6, isKept: false },
                ],
            },
            sys: {
                phase: 'offensiveRoll',
                currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
        });

        await waitForDiceThronePhase(page, 'offensiveRoll');
        await dispatchDiceThroneCommand(page, {
            type: 'SELECT_ABILITY',
            playerId: '0',
            payload: { abilityId: 'high-ground' },
        });

        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
            const responseWindow = state.sys.responseWindow?.current;
            return {
                windowType: responseWindow?.windowType ?? null,
                responderQueue: responseWindow?.responderQueue ?? [],
                sourceAbilityId: state.core.pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
            sourceAbilityId: 'high-ground',
        });

        const responseHint = page.getByTestId('dicethrone-response-window-hint');
        const responseHintPanel = page.getByTestId('dicethrone-response-window-hint-panel');
        const responsePassButton = page.getByTestId('dicethrone-response-pass-button');
        const diceTray = page.getByTestId('dicethrone-2d-dice-tray');
        const attackShowcase = page.getByTestId('attack-showcase-overlay');
        const continueButton = attackShowcase.getByRole('button', { name: /^(继续|Continue)$/i });
        await expect(continueButton).toBeVisible({ timeout: 10000 });
        await continueButton.click();
        await expect(attackShowcase).toBeHidden({ timeout: 10000 });
        await expect(responseHint).toBeVisible({ timeout: 10000 });
        await expect(responseHintPanel).toBeVisible({ timeout: 10000 });
        await expect(responsePassButton).toBeEnabled({ timeout: 10000 });
        const responseHandCard = page.locator('[data-testid="hand-area"] [data-card-id="card-surprise"]').first();
        const responseHandArea = page.getByTestId('hand-area');
        await expect(responseHandCard).toBeVisible({ timeout: 10000 });
        await expect(responseHandArea).toBeVisible({ timeout: 10000 });
        await expectSurpriseCardFaceVisible(page);
        await expect(diceTray).toBeVisible({ timeout: 10000 });
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(5);
        await expect.poll(async () => diceTray.getByTestId('dice-2d').evaluateAll((dice) => (
            dice.every((die) => die.getAttribute('data-sprite-ready') === 'true')
        ))).toBe(true);
        await expect(diceTray.locator('canvas')).toHaveCount(0);

        const responseBaseLayout = await page.evaluate(() => {
            const hint = document.querySelector<HTMLElement>('[data-testid="dicethrone-response-window-hint"]');
            const panel = document.querySelector<HTMLElement>('[data-testid="dicethrone-response-window-hint-panel"]');
            const handCard = document.querySelector<HTMLElement>('[data-testid="hand-area"] [data-card-id="card-surprise"]');
            if (!hint || !panel || !handCard) throw new Error('响应提示或可响应手牌缺失');
            const panelRect = panel.getBoundingClientRect();
            const handCardVisual = handCard.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? handCard;
            const handCardRect = handCardVisual.getBoundingClientRect();
            const diceTray = document.querySelector<HTMLElement>('[data-testid="dicethrone-2d-dice-tray"]');
            const diceTrayRect = diceTray?.getBoundingClientRect() ?? null;
            return {
                panelBottom: panelRect.bottom,
                panelTop: panelRect.top,
                panelRight: panelRect.right,
                panelLeft: panelRect.left,
                panelCenterX: panelRect.left + panelRect.width / 2,
                handCardTop: handCardRect.top,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                bottomInset: window.innerHeight - panelRect.bottom,
                hintPosition: getComputedStyle(hint).position,
                hintAnchor: hint.dataset.anchor ?? null,
                hintPlacement: hint.dataset.placement ?? null,
                overlapsDiceTray: Boolean(diceTrayRect
                    && panelRect.right > diceTrayRect.left
                    && panelRect.left < diceTrayRect.right
                    && panelRect.bottom > diceTrayRect.top
                    && panelRect.top < diceTrayRect.bottom),
            };
        });
        expect(responseBaseLayout.hintPosition).toBe('fixed');
        expect(responseBaseLayout.hintAnchor).toBe('viewport');
        expect(responseBaseLayout.hintPlacement).toBe('fixed-hand-lift-slot');
        expect(Math.abs(responseBaseLayout.panelCenterX - responseBaseLayout.viewportWidth / 2)).toBeLessThan(4);
        expect(responseBaseLayout.overlapsDiceTray, '响应提示不能进入右侧骰盘或遮挡骰子').toBe(false);
        expect(responseBaseLayout.panelBottom, '响应条应靠近手牌抬起区，不能回到牌桌正中央').toBeGreaterThan(responseBaseLayout.viewportHeight * 0.50);
        expect(responseBaseLayout.bottomInset).toBeGreaterThan(128);
        await game.screenshot('01-真人响应固定在手牌抬起区上方', testInfo);

        await responseHandCard.hover();
        await page.waitForTimeout(520);

        const responseVisual = await responseHintPanel.evaluate((panel) => {
            const hint = document.querySelector<HTMLElement>('[data-testid="dicethrone-response-window-hint"]');
            if (!hint) throw new Error('响应提示外层缺失');
            const hintStyle = getComputedStyle(panel);
            const panelRect = panel.getBoundingClientRect();
            const orbit = document.querySelector('[data-testid="dicethrone-response-orbit"]');
            const orbitTrack = document.querySelector('[data-testid="dicethrone-response-orbit-track"]');
            if (!(orbit instanceof HTMLElement) || !(orbitTrack instanceof HTMLElement)) {
                throw new Error('响应提示边沿流光层缺失');
            }
            const orbitStyle = getComputedStyle(orbit);
            const orbitTrackStyle = getComputedStyle(orbitTrack);
            const passButton = panel.querySelector('[data-testid="dicethrone-response-pass-button"]');
            if (!(passButton instanceof HTMLButtonElement)) {
                throw new Error('响应提示中的跳过按钮缺失');
            }
            const buttonStyle = getComputedStyle(passButton);
            const hoveredHandCard = document.querySelector<HTMLElement>('[data-testid="hand-area"] [data-card-id="card-surprise"]');
            if (!hoveredHandCard) throw new Error('可响应手牌缺失');
            const hoveredHandCardVisual = hoveredHandCard.querySelector<HTMLElement>('[data-testid="hand-card-visual"]') ?? hoveredHandCard;
            const hoveredHandCardRect = hoveredHandCardVisual.getBoundingClientRect();
            const diceTray = document.querySelector<HTMLElement>('[data-testid="dicethrone-2d-dice-tray"]');
            const diceTrayRect = diceTray?.getBoundingClientRect() ?? null;
            return {
                panelBorderWidth: Number.parseFloat(hintStyle.borderTopWidth),
                panelShadow: hintStyle.boxShadow,
                panelBackgroundImage: hintStyle.backgroundImage,
                orbitOverflow: orbitStyle.overflow,
                orbitFilter: orbitStyle.filter,
                orbitAnimationName: orbitTrackStyle.animationName,
                orbitBackgroundImage: orbitTrackStyle.backgroundImage,
                panelBorderRadius: Number.parseFloat(hintStyle.borderTopLeftRadius),
                panelHeight: panelRect.height,
                panelRectLeft: panelRect.left,
                panelRectRight: panelRect.right,
                panelRectTop: panelRect.top,
                panelRectBottom: panelRect.bottom,
                hintPosition: getComputedStyle(hint).position,
                hintAnchor: hint.dataset.anchor ?? null,
                hintPlacement: hint.dataset.placement ?? null,
                hoveredHandCardTop: hoveredHandCardRect.top,
                overlapsDiceTray: Boolean(diceTrayRect
                    && panelRect.right > diceTrayRect.left
                    && panelRect.left < diceTrayRect.right
                    && panelRect.bottom > diceTrayRect.top
                    && panelRect.top < diceTrayRect.bottom),
                buttonBorderWidth: Number.parseFloat(buttonStyle.borderTopWidth),
                buttonShadow: buttonStyle.boxShadow,
                buttonBorderRadius: Number.parseFloat(buttonStyle.borderTopLeftRadius),
                buttonHeight: passButton.getBoundingClientRect().height,
                buttonBackgroundImage: buttonStyle.backgroundImage,
            };
        });
        expect(responseVisual).toMatchObject({
            buttonBorderWidth: 2,
            panelBackgroundImage: 'none',
            buttonBackgroundImage: 'none',
        });
        expect(responseVisual.panelBorderWidth).toBeGreaterThanOrEqual(1);
        expect(responseVisual.panelBorderWidth).toBeLessThanOrEqual(2);
        expect(responseVisual.panelShadow).toBe('none');
        expect(responseVisual.orbitOverflow).toBe('hidden');
        expect(responseVisual.orbitFilter).toBe('none');
        expect(responseVisual.orbitAnimationName).toBe('dicethrone-response-border-orbit');
        expect(responseVisual.orbitBackgroundImage).toContain('conic-gradient');
        expect(responseVisual.buttonShadow).toBe('none');
        expect(responseVisual.panelBorderRadius).toBeGreaterThanOrEqual(responseVisual.panelHeight / 2);
        expect(responseVisual.hintPosition).toBe('fixed');
        expect(responseVisual.hintAnchor).toBe('viewport');
        expect(responseVisual.hintPlacement).toBe('fixed-hand-lift-slot');
        expect(responseVisual.hoveredHandCardTop).toBeLessThan(responseBaseLayout.handCardTop - 20);
        expect(responseVisual.overlapsDiceTray, '悬浮手牌后响应提示仍不能进入右侧骰盘').toBe(false);
        expect(Math.abs(responseVisual.panelRectTop - responseBaseLayout.panelTop)).toBeLessThan(2);
        expect(Math.abs(responseVisual.panelRectBottom - responseBaseLayout.panelBottom)).toBeLessThan(2);
        expect(responseVisual.buttonBorderRadius).toBeGreaterThanOrEqual(8);
        expect(responseVisual.buttonHeight).toBeGreaterThanOrEqual(44);

        const diceTrayVisual = await diceTray.evaluate((tray) => {
            const trayStyle = getComputedStyle(tray);
            return {
                borderWidth: Number.parseFloat(trayStyle.borderTopWidth),
                boxShadow: trayStyle.boxShadow,
                backgroundImage: trayStyle.backgroundImage,
            };
        });
        expect(diceTrayVisual).toMatchObject({ borderWidth: 2, backgroundImage: 'none' });
        expect(diceTrayVisual.boxShadow).not.toBe('none');
        await game.screenshot('02-悬浮手牌时响应提示位置不漂移', testInfo);

        await responsePassButton.evaluate((button) => {
            const w = window as typeof window & { __DT_RESPONSE_PASS_POINTERDOWN_HIT__?: number };
            w.__DT_RESPONSE_PASS_POINTERDOWN_HIT__ = 0;
            button.addEventListener('pointerdown', () => {
                w.__DT_RESPONSE_PASS_POINTERDOWN_HIT__ = (w.__DT_RESPONSE_PASS_POINTERDOWN_HIT__ ?? 0) + 1;
            }, { once: true });
        });
        await responsePassButton.hover();
        await page.waitForTimeout(220);
        await expect.poll(async () => responsePassButton.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return target instanceof HTMLElement ? target.dataset.testid ?? target.tagName : null;
        })).toBe('dicethrone-response-pass-button');
        await responsePassButton.click();
        await expect.poll(async () => page.evaluate(() => (window as typeof window & { __DT_RESPONSE_PASS_POINTERDOWN_HIT__?: number }).__DT_RESPONSE_PASS_POINTERDOWN_HIT__ ?? 0))
            .toBe(1);
        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
            return state.sys.responseWindow?.current ?? null;
        }, { timeout: 10000 }).toBeNull();
        await expect(responseHint).toBeHidden({ timeout: 10000 });
        await game.screenshot('03-真人跳过响应后提示关闭', testInfo);
    });

    test('AI 选中制胜高地后，真人应能用惊不惊喜改骰取消终极招式', async ({ page, game }, testInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', { playerID: '1', disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 10, HP: 50 },
            },
            player1: {
                hand: ['card-surprise'],
                resources: { CP: 10, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'zhanshujia', '1': 'cursed_pirate' },
                seatControllers: {
                    '0': { type: 'local-ai', difficulty: 'expert' },
                    '1': { type: 'human' },
                },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 6, isKept: false },
                    { id: 1, value: 6, isKept: false },
                    { id: 2, value: 6, isKept: false },
                    { id: 3, value: 6, isKept: false },
                    { id: 4, value: 6, isKept: false },
                ],
            },
            sys: {
                phase: 'offensiveRoll',
                currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
        });

        await waitForDiceThronePhase(page, 'offensiveRoll');

        await dispatchDiceThroneCommand(page, {
            type: 'SELECT_ABILITY',
            playerId: '0',
            payload: { abilityId: 'high-ground' },
        });

        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
            const responseWindow = state.sys.responseWindow?.current;
            return {
                windowType: responseWindow?.windowType ?? null,
                responderQueue: responseWindow?.responderQueue ?? [],
                attackerId: state.core.pendingAttack?.attackerId ?? null,
                defenderId: state.core.pendingAttack?.defenderId ?? null,
                sourceAbilityId: state.core.pendingAttack?.sourceAbilityId ?? null,
                isUltimate: state.core.pendingAttack?.isUltimate ?? false,
                rollConfirmed: state.core.rollConfirmed,
            };
        }, { timeout: 10000 }).toEqual({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'high-ground',
            isUltimate: true,
            rollConfirmed: true,
        });

        const attackShowcase = page.getByTestId('attack-showcase-overlay');
        const continueButton = attackShowcase.getByRole('button', { name: /^(继续|Continue)$/i });
        await expect(continueButton).toBeVisible({ timeout: 10000 });
        await continueButton.click();
        await expect(attackShowcase).toBeHidden({ timeout: 10000 });

        await game.screenshot('01-AI选中制胜高地后-真人发动前响应窗口', testInfo);

        const surpriseCard = page.locator('[data-testid="hand-area"] [data-card-id="card-surprise"]').first();
        await expect(surpriseCard).toBeVisible({ timeout: 10000 });
        await expect(surpriseCard).toHaveAttribute('data-is-flipped', 'true', { timeout: 15000 });
        await expect(surpriseCard).toHaveAttribute('data-can-drag', 'true', { timeout: 15000 });
        await expectSurpriseCardFaceVisible(page);

        await dispatchDiceThroneCommand(page, {
            type: 'PLAY_CARD',
            playerId: '1',
            payload: { cardId: 'card-surprise' },
        });

        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
            const interaction = state.sys.interaction?.current;
            return {
                kind: interaction?.kind ?? null,
                dtType: interaction?.data?.meta?.dtType ?? null,
                sourceId: interaction?.data?.sourceId ?? null,
                diceOwnerId: interaction?.data?.meta?.diceOwnerId ?? null,
                allowedDieIds: interaction?.data?.allowedDieIds ?? [],
                hasSurpriseInHand: state.core.players['1'].hand.some(card => card.id === 'card-surprise'),
                attackStillPending: Boolean(state.core.pendingAttack),
            };
        }, { timeout: 10000 }).toMatchObject({
            kind: 'multistep-choice',
            dtType: 'modifyDie',
            sourceId: 'card-surprise',
            diceOwnerId: null,
            allowedDieIds: expect.arrayContaining([0, 1, 2, 3, 4]),
            hasSurpriseInHand: false,
            attackStillPending: true,
        });

        await changeFirstDieFromSixToFive(page);

        await expect.poll(async () => {
            const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
            const eventTypes = state.sys.eventStream?.entries.map(entry => entry.event.type) ?? [];
            return {
                diceValues: state.core.dice.map(die => die.value),
                pendingAttack: state.core.pendingAttack ?? null,
                rollConfirmed: state.core.rollConfirmed,
                responseWindow: state.sys.responseWindow?.current ?? null,
                interaction: state.sys.interaction?.current ?? null,
                handIds: state.core.players['1'].hand.map(card => card.id),
                discardIds: state.core.players['1'].discard.map(card => card.id),
                hasReselectionEvent: eventTypes.includes('ABILITY_RESELECTION_REQUIRED'),
            };
        }, { timeout: 10000 }).toEqual({
            diceValues: [5, 6, 6, 6, 6],
            pendingAttack: null,
            rollConfirmed: false,
            responseWindow: null,
            interaction: null,
            handIds: [],
            discardIds: ['card-surprise'],
            hasReselectionEvent: true,
        });

        await game.screenshot('02-真人惊不惊喜改骰后-制胜高地被取消', testInfo);
    });
});
