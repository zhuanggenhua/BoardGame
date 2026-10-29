import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { getFrontendSourceHash, sourceIdentityMatches } from '../../scripts/infra/e2e-source-identity.mjs';
import { findRuntimeById } from '../../scripts/infra/e2e-runtime-registry.js';
import {
    createEvidenceScreenshotRun,
    promoteEvidenceScreenshotRun,
    type EvidenceScreenshotIndexEntry,
    type EvidenceScreenshotRun,
} from '../framework/evidenceScreenshots';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray, settleCurrentBonusDice, waitForDiceThroneVisualIdle } from './bonus-dice-flow';
import {
    ensureGameServerAvailable,
    resetMatchStorage,
    setChineseLocale,
    waitForHomeGameList,
} from '../helpers/common';
import { DOCTOR_STRANGE_FACE, DOCTOR_STRANGE_TOKEN } from '../../src/games/dicethrone/heroes/doctor_strange/constants';
import { DOCTOR_STRANGE_CARDS } from '../../src/games/dicethrone/heroes/doctor_strange/cards';
import { DICETHRONE_CHARACTER_CATALOG } from '../../src/games/dicethrone/domain/core-types';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';

const DICE_THRONE_PREPARE_RANDOM = {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (_faces: number) => 1,
    range: (min: number, _max: number) => min,
};

const PREPARE_SPELL_ID = 'spell-fangs-of-farallah';
const HAND_CARD_ID = 'card-strange-see-the-future';
const DOCTOR_STRANGE_E2E_SOURCE_REVISION = createHash('sha256')
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest('hex');
const CRIMSON_BANDS_SPELL_ID = 'spell-crimson-bands-of-cyttorak';

function assertCurrentEvidenceSourceIdentity(): { sourceRevision: string; e2eSourceRevision: string } {
    const runtimeId = process.env.PW_MANAGED_RUNTIME_ID;
    const runtime = runtimeId ? findRuntimeById(runtimeId) : undefined;
    if (!runtime?.frontendSourceHash) throw new Error('证据必须绑定当前托管运行时的前端源码身份');

    const sourceRevision = getFrontendSourceHash();
    expect(runtime.frontendSourceHash).toBe(sourceRevision);
    expect(sourceIdentityMatches(runtime.sourceIdentity)).toBe(true);

    const e2eSourceRevision = createHash('sha256')
        .update(readFileSync(fileURLToPath(import.meta.url)))
        .digest('hex');
    expect(e2eSourceRevision).toBe(DOCTOR_STRANGE_E2E_SOURCE_REVISION);
    return { sourceRevision, e2eSourceRevision };
}

type TestCard = { id: string };
type TestPlayer = {
    characterId?: string;
    preparedSpells?: TestCard[];
    hand?: TestCard[];
    deck?: TestCard[];
    discard?: TestCard[];
    tokens?: Record<string, number>;
    statusEffects?: Record<string, number>;
    crimsonBandsReceivedTurn?: number;
    crimsonBandsActiveTurn?: number;
    resources?: { cp?: number; CP?: number; hp?: number; HP?: number };
};
type TestGameState = {
    core?: {
        players?: Record<string, TestPlayer>;
        dice?: { id?: number; value?: number; ownerId?: string; symbol?: string }[];
        phase?: string;
        currentPlayerId?: string;
        round?: number;
        turnNumber?: number;
        rollCount?: number;
        pendingAttack?: {
            attackerId?: string; defenderId?: string; sourceAbilityId?: string;
            bonusDamage?: number; settlementStage?: string; damageResolved?: boolean;
        } | null;
        pendingBonusDiceSettlement?: {
            sourceAbilityId?: string;
            dice?: { value?: number; face?: string }[];
            displayOnly?: boolean;
        } | null;
    };
    sys?: {
        phase?: string;
        resolution?: { frames?: { kind?: string }[] };
        interaction?: {
            current?: {
                kind?: string;
                playerId?: string;
                data?: {
                    sourceId?: string;
                    allowedDieIds?: number[];
                    meta?: {
                        dtType?: string;
                        selectCount?: number;
                        diceOwnerId?: string;
                        targetOpponentDice?: boolean;
                    };
                };
            } | null;
        };
    };
};

type EvidenceGameReader = { getState: () => Promise<TestGameState | null | undefined> };
type EvidenceSnapshot = {
    visible: Record<string, unknown>;
    authoritative: Record<string, unknown>;
};
type EvidenceTraceStep = {
    id: string;
    action: string;
    before: EvidenceSnapshot;
    after: EvidenceSnapshot;
    assertions: { name: string; actual: unknown; expected: unknown }[];
};
type EvidenceTraceRecorder = {
    previous: EvidenceSnapshot | null;
    steps: EvidenceTraceStep[];
};

const newEvidenceTraceRecorder = (): EvidenceTraceRecorder => ({ previous: null, steps: [] });

async function readEvidenceSnapshot(page: Page, game?: EvidenceGameReader): Promise<EvidenceSnapshot> {
    const visible = await page.evaluate(() => {
        const readText = (element: Element | null) => element?.textContent?.trim() ?? null;
        const boardHeroIds = Array.from(document.querySelectorAll('[data-testid="player-board-surface"]'))
            .map(element => element.getAttribute('data-character-id'));
        const selectedAbilityIds = Array.from(document.querySelectorAll('[data-ability-slot][data-is-selected="true"]'))
            .map(element => element.getAttribute('data-available-ability-id'));
        const preparedSpellIds = Array.from(document.querySelectorAll('[data-prepared-spell-card]'))
            .map(element => element.getAttribute('data-prepared-spell-card'));
        const choiceLabels = Array.from(document.querySelectorAll(
            '#modal-root [data-choice-custom-id="doctor-strange-choice"], #modal-root [data-testid^="dt-hand-card-option-"], #modal-root [data-testid^="dt-deck-card-option-"], #modal-root [data-testid^="dt-discard-card-option-"], #modal-root [data-testid^="dt-preparedSpells-card-option-"], #modal-root [data-testid^="dt-player-target-"], #modal-root [data-testid^="dt-status-effect-"]',
        )).map(element => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.getAttribute('data-testid') ?? '');
        const choiceIds = Array.from(document.querySelectorAll(
            '#modal-root [data-choice-custom-id="doctor-strange-choice"], #modal-root [data-testid^="dt-hand-card-option-"], #modal-root [data-testid^="dt-deck-card-option-"], #modal-root [data-testid^="dt-discard-card-option-"], #modal-root [data-testid^="dt-preparedSpells-card-option-"], #modal-root [data-testid^="dt-player-target-"], #modal-root [data-testid^="dt-status-effect-"]',
        )).map(element => element.getAttribute('data-testid') ?? '');
        const selectedChoiceIds = Array.from(document.querySelectorAll('#modal-root [data-selected="true"]'))
            .map(element => element.getAttribute('data-testid') ?? '')
            .filter(Boolean);
        const modalButtonLabels = Array.from(document.querySelectorAll('#modal-root button'))
            .map(element => element.textContent?.trim() ?? '')
            .filter(Boolean);
        const diceInteractionHintText = readText(document.querySelector('[data-testid="dice-interaction-hint"]'));
        const modal = document.querySelector('#modal-root');
        const phaseControl = document.querySelector('[data-tutorial-id="advance-phase-button"]');
        const headingTexts = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map(element => element.textContent?.trim() ?? '')
            .filter(Boolean);
        const selectableHeroIds = Array.from(document.querySelectorAll('[data-character-id]'))
            .map(element => element.getAttribute('data-character-id'))
            .filter((value): value is string => Boolean(value));
        const selectionCards = Array.from(
            document.querySelectorAll('[data-testid="character-selection-overlay"] [data-character-id]'),
        );
        const selectedHeroIds = selectionCards
            .filter(element => /\bP[1-4]\b/.test(element.textContent ?? ''))
            .map(element => element.getAttribute('data-character-id'))
            .filter((value): value is string => Boolean(value));
        const doctorStrangeImplementationBadgeVisible = Boolean(
            document.querySelector('[data-testid="character-badge-doctor_strange-implementation_in_progress"]'),
        );
        const spotlight = document.querySelector('[data-testid="spotlight-container-root"]');
        const visibleTooltipTitles = Array.from(document.querySelectorAll('[data-testid="info-tooltip"]'))
            .filter(element => getComputedStyle(element).visibility === 'visible')
            .map(element => element.querySelector('[data-testid="info-tooltip-title"]')?.textContent?.trim() ?? '')
            .filter(Boolean);
        const tokenIds = Array.from(document.querySelectorAll('[data-testid^="dt-player-0-token-"]'))
            .map(element => element.getAttribute('data-token-id'))
            .filter((value): value is string => Boolean(value));
        const dice = Array.from(document.querySelectorAll('[data-testid^="die-button-"]')).map(element => ({
            id: element.getAttribute('data-testid')?.replace('die-button-', '') ?? null,
            ownerId: element.getAttribute('data-owner-id'),
            value: element.getAttribute('data-display-value'),
            selected: element.getAttribute('data-selected') === 'true',
            clickable: element.getAttribute('data-clickable') === 'true',
        }));
        return {
            boardHeroIds,
            selectedAbilityIds,
            preparedSpellIds,
            choiceLabels,
            choiceIds,
            selectedChoiceIds,
            modalButtonLabels,
            diceInteractionHintText,
            modalText: readText(modal),
            phaseControlText: readText(phaseControl),
            headingTexts,
            selectableHeroIds,
            selectedHeroIds,
            doctorStrangeImplementationBadgeVisible,
            spotlightVisible: Boolean(spotlight && getComputedStyle(spotlight).display !== 'none'),
            visibleTooltipTitles,
            tokenIds,
            dice,
        };
    });
    const state = game ? await game.getState() : null;
    const players = Object.fromEntries(Object.entries(state?.core?.players ?? {}).map(([playerId, player]) => [playerId, {
        characterId: player.characterId ?? null,
        resources: {
            hp: player.resources?.hp ?? player.resources?.HP ?? null,
            cp: player.resources?.cp ?? player.resources?.CP ?? null,
        },
        tokens: player.tokens ?? {},
        statusEffects: player.statusEffects ?? {},
        crimsonBandsReceivedTurn: player.crimsonBandsReceivedTurn ?? null,
        crimsonBandsActiveTurn: player.crimsonBandsActiveTurn ?? null,
        preparedSpellIds: player.preparedSpells?.map(card => card.id) ?? [],
        handCount: player.hand?.length ?? 0,
        handIds: player.hand?.map(card => card.id) ?? [],
        deckCount: player.deck?.length ?? 0,
        discardCount: player.discard?.length ?? 0,
        discardIds: player.discard?.map(card => card.id) ?? [],
    }]));
    return {
        visible,
        authoritative: {
            phase: state?.sys?.phase ?? state?.core?.phase ?? null,
            currentPlayerId: state?.core?.currentPlayerId ?? null,
            round: state?.core?.round ?? null,
            turnNumber: state?.core?.turnNumber ?? null,
            rollCount: state?.core?.rollCount ?? null,
            diceSymbols: state?.core?.dice?.map(die => die.symbol ?? null) ?? [],
            dice: state?.core?.dice?.map(die => ({
                id: die.id ?? null,
                value: die.value ?? null,
                ownerId: die.ownerId ?? null,
            })) ?? [],
            interaction: state?.sys?.interaction?.current ? {
                kind: state.sys.interaction.current.kind ?? null,
                playerId: state.sys.interaction.current.playerId ?? null,
                sourceId: state.sys.interaction.current.data?.sourceId ?? null,
                dtType: state.sys.interaction.current.data?.meta?.dtType ?? null,
                selectCount: state.sys.interaction.current.data?.meta?.selectCount ?? null,
                diceOwnerId: state.sys.interaction.current.data?.meta?.diceOwnerId ?? null,
                targetOpponentDice: state.sys.interaction.current.data?.meta?.targetOpponentDice ?? null,
                allowedDieIds: state.sys.interaction.current.data?.allowedDieIds ?? [],
            } : null,
            players,
            pendingAttack: state?.core?.pendingAttack ? {
                attackerId: state.core.pendingAttack.attackerId ?? null,
                defenderId: state.core.pendingAttack.defenderId ?? null,
                sourceAbilityId: state.core.pendingAttack.sourceAbilityId ?? null,
                bonusDamage: state.core.pendingAttack.bonusDamage ?? 0,
                settlementStage: state.core.pendingAttack.settlementStage ?? null,
                damageResolved: state.core.pendingAttack.damageResolved ?? false,
            } : null,
            pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ? {
                sourceAbilityId: state.core.pendingBonusDiceSettlement.sourceAbilityId ?? null,
                dice: state.core.pendingBonusDiceSettlement.dice?.map(die => ({ value: die.value ?? null, face: die.face ?? null })) ?? [],
                displayOnly: state.core.pendingBonusDiceSettlement.displayOnly ?? null,
            } : null,
            resolutionFrameKinds: state?.sys?.resolution?.frames?.map(frame => frame.kind ?? null) ?? [],
            doctorStrangeSetupOptionStatus: DICETHRONE_CHARACTER_CATALOG.find(character => character.id === 'doctor_strange')?.setupOptionStatus ?? null,
        },
    };
}

async function captureTracedState(
    page: Page,
    game: EvidenceGameReader | undefined,
    run: EvidenceScreenshotRun,
    recorder: EvidenceTraceRecorder,
    name: string,
    behaviorStepId: string,
    action: string,
    assertionName: string,
    readActual: (snapshot: EvidenceSnapshot) => unknown,
    expected: unknown,
): Promise<string> {
    const before = recorder.previous ?? await readEvidenceSnapshot(page, game);
    const path = await captureState(page, run, name);
    const after = await readEvidenceSnapshot(page, game);
    const actual = readActual(after);
    expect(actual, `${behaviorStepId}: ${assertionName}`).toEqual(expected);
    recorder.steps.push({
        id: behaviorStepId,
        action,
        before,
        after,
        assertions: [{ name: assertionName, actual, expected }],
    });
    recorder.previous = after;
    return path;
}

async function promoteTracedEvidenceScreenshotRun(
    run: EvidenceScreenshotRun,
    media: EvidenceScreenshotIndexEntry[],
    recorder: EvidenceTraceRecorder,
    requirement: string,
    outcome: string,
): Promise<void> {
    expect(media[0]?.chainId, '行为证据链必须包含媒体').toBeTruthy();
    const { sourceRevision, e2eSourceRevision } = assertCurrentEvidenceSourceIdentity();
    const enrichedMedia = media.map(entry => ({
        ...entry,
        uiChange: entry.uiChange ?? (entry.stage === '前态' || entry.stage === '后态' ? 'layout' : 'interaction-mode'),
        uiChangeReason: entry.uiChangeReason ?? entry.transition ?? entry.description,
        behaviorStepId: entry.behaviorStepId ?? entry.uiStateId ?? entry.chainId,
        sourceRevision,
        e2eSourceRevision,
        requirements: [requirement],
        viewport: entry.viewport ?? 'desktop',
    }));
    const interactionMedia = enrichedMedia.filter(entry => (
        entry.stage === '中态' || entry.stage === '独特界面态'
    ));
    expect(interactionMedia.length, '用户验收索引只包含新交互状态截图').toBeGreaterThan(0);
    const stepIds = new Set(recorder.steps.map(step => step.id));
    for (const entry of interactionMedia) {
        expect(stepIds.has(entry.behaviorStepId!), `行为链缺少截图步骤 ${entry.behaviorStepId}`).toBe(true);
    }
    const mediaByChain = new Map<string, typeof enrichedMedia>();
    for (const entry of interactionMedia) {
        const chain = mediaByChain.get(entry.chainId) ?? [];
        chain.push(entry);
        mediaByChain.set(entry.chainId, chain);
    }
    for (const [chainId, chainMedia] of mediaByChain) {
        const chainStepIds = new Set(chainMedia.map(entry => entry.behaviorStepId!));
        const trace = {
            gameId: 'dicethrone',
            evidenceCategory: 'independent',
            chainId,
            sourceRun: run.runId,
            sourceRevision,
            e2eSourceRevision,
            status: 'PASS',
            outcome,
            steps: recorder.steps.filter(step => chainStepIds.has(step.id)),
            uiStates: chainMedia.map(entry => ({
                id: entry.uiStateId!,
                stepId: entry.behaviorStepId!,
                change: entry.uiChange!,
                viewport: entry.viewport!,
                sha256: createHash('sha256').update(readFileSync(join(run.stagingDir, entry.path))).digest('hex'),
            })),
        };
        await writeFile(join(run.stagingDir, `${chainId}.trace.json`), `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
    }
    await promoteEvidenceScreenshotRun(run, {
        gameId: 'dicethrone', evidenceCategory: 'independent', capturePolicy: 'distinct-ui-state', media: interactionMedia,
    });
}

async function openOnlineSelection(page: Page, beforeRoomCreate?: () => Promise<void>): Promise<void> {
    await setChineseLocale(page.context());
    await resetMatchStorage(page.context(), '__doctor_strange_selection_storage_reset');
    if (!await ensureGameServerAvailable(page)) test.skip(true, 'Game server unavailable for online tests.');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHomeGameList(page);
    const gameCard = page.getByRole('button', { name: /Dice Throne|王权骰铸/i });
    await expect(gameCard).toBeVisible();
    await gameCard.click();
    await page.getByTestId('game-details-open-create-room').first().click();
    await expect(page.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible();
    await beforeRoomCreate?.();
    await page.getByRole('button', { name: /Confirm|确认/i }).click();
    await expect(page).toHaveURL(/\/play\/dicethrone\/match\//, { timeout: 15000 });
    const hostUrl = new URL(page.url());
    if (!hostUrl.searchParams.get('playerID')) {
        hostUrl.searchParams.set('playerID', '0');
        await page.goto(hostUrl.toString(), { waitUntil: 'domcontentloaded' });
    }
    await expect(page.locator('[data-testid="character-selection-overlay"]')).toBeVisible({ timeout: 15000 });
}

async function captureState(page: Page, run: EvidenceScreenshotRun, name: string): Promise<string> {
    assertCurrentEvidenceSourceIdentity();
    const filename = `${name}.png`;
    const path = join(run.stagingDir, filename);
    await mkdir(dirname(path), { recursive: true });
    // 等真实有限入场动画结束，避免把透明过渡帧当成可阅读的选择态。
    await page.waitForFunction(() => document.getAnimations().every(animation => (
        animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity
    )), undefined, { timeout: 10000 });
    await page.screenshot({ path, fullPage: false, timeout: 20000 });
    assertCurrentEvidenceSourceIdentity();
    return filename;
}

async function assertCardPoolInteractionFitsViewport(page: Page): Promise<void> {
    const layout = await page.evaluate(() => {
        const rect = (selector: string) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
        };
        const contains = (outer: NonNullable<ReturnType<typeof rect>>, inner: NonNullable<ReturnType<typeof rect>>) => (
            inner.left >= outer.left - 1 && inner.top >= outer.top - 1
            && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1
        );
        const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const panel = rect('[data-testid="dt-card-pool-panel"]');
        const surface = rect('[data-testid="dt-card-pool-surface"]');
        const title = rect('[data-testid="dt-card-pool-title"]');
        const selection = rect('[data-testid="dt-card-pool-selection"]');
        const selectedPreview = rect('[data-testid^="dt-card-choice-preview-"]');
        const selectedMarker = rect('[data-testid^="dt-card-choice-selected-"]');
        const cardPoolBackdrop = rect('[data-testid="dt-card-pool-backdrop"]');
        const handArea = rect('[data-testid="hand-area"]');
        const panelElement = document.querySelector('[data-testid="dt-card-pool-panel"]');
        const surfaceElement = document.querySelector('[data-testid="dt-card-pool-surface"]');
        const selectionElement = document.querySelector<HTMLElement>('[data-testid="dt-card-pool-selection"]');
        const selectionClipRect = selection && selectionElement ? {
            left: selection.left + selectionElement.clientLeft,
            top: selection.top + selectionElement.clientTop,
            right: selection.left + selectionElement.clientLeft + selectionElement.clientWidth,
            bottom: selection.top + selectionElement.clientTop + selectionElement.clientHeight,
        } : null;
        const optionRects = Array.from(document.querySelectorAll('[data-testid^="dt-discard-card-option-"]'))
            .map(element => {
                const box = element.getBoundingClientRect();
                return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
            });
        const handRects = Array.from(document.querySelectorAll('[data-testid="hand-area"] [data-testid="hand-card-visual"]'))
            .map(element => {
                const box = element.getBoundingClientRect();
                return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
            });
        const visibleRectSelectors = [
            '[data-testid="dt-card-pool-panel"]',
            '[data-testid="dt-card-pool-surface"]',
            '[data-testid="dt-card-pool-title"]',
            '[data-testid="dt-card-pool-selection"]',
            '[data-testid="dt-card-pool-actions"]',
            '[data-testid="dt-interaction-confirm"]',
        ];
        const requiredRects = visibleRectSelectors.map(rect);
        return {
            viewport,
            panel,
            surface,
            title,
            requiredRects,
            selection,
            selectionClipRect,
            selectedPreview,
            selectedMarker,
            cardPoolBackdrop,
            handArea,
            optionRects,
            handRects,
            panelContainsSurface: Boolean(panel && surface && contains(panel, surface)),
            surfaceContainsTitle: Boolean(surface && title && contains(surface, title)),
            surfaceContainsSelection: Boolean(surface && selection && contains(surface, selection)),
            surfaceContainsActions: Boolean(surface && rect('[data-testid="dt-card-pool-actions"]')
                && contains(surface, rect('[data-testid="dt-card-pool-actions"]')!)),
            actionsContainButtons: Boolean(rect('[data-testid="dt-card-pool-actions"]')
                && rect('[data-testid="dt-interaction-confirm"]')
                && contains(rect('[data-testid="dt-card-pool-actions"]')!, rect('[data-testid="dt-interaction-confirm"]')!)),
            selectionContainsPreview: Boolean(selection && selectedPreview && contains(selection, selectedPreview)),
            selectionContainsMarker: Boolean(selection && selectedMarker && contains(selection, selectedMarker)),
            selectionClipContainsPreview: Boolean(selectionClipRect && selectedPreview && contains(selectionClipRect, selectedPreview)),
            selectionClipContainsMarker: Boolean(selectionClipRect && selectedMarker && contains(selectionClipRect, selectedMarker)),
            viewportContainsMarker: Boolean(selectedMarker && contains(viewport, selectedMarker)),
            viewportContainsPanel: Boolean(panel && contains(viewport, panel)),
            viewportContainsOptions: optionRects.length > 0 && optionRects.every(option => contains(viewport, option)),
            viewportContainsHand: handRects.length > 0 && handRects.every(card => contains(viewport, card)),
            backdropStopsBeforeHand: Boolean(cardPoolBackdrop && handArea
                && cardPoolBackdrop.bottom <= handArea.top + 1),
            panelClientHeight: panelElement instanceof HTMLElement ? panelElement.clientHeight : null,
            surfaceClientHeight: surfaceElement instanceof HTMLElement ? surfaceElement.clientHeight : null,
        };
    });

    expect(layout.requiredRects.every(box => box && box.left >= -1 && box.top >= -1
        && box.right <= layout.viewport.right + 1 && box.bottom <= layout.viewport.bottom + 1),
    `卡池标题、选中卡、操作按钮需完整留在视口内：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.viewportContainsPanel, `卡池整体上下边界必须留在视口内：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.panelContainsSurface && layout.surfaceContainsTitle && layout.surfaceContainsSelection
        && layout.surfaceContainsActions && layout.actionsContainButtons,
    `卡池标题、列表、按钮必须位于可视面板范围内：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.selectionContainsPreview, `选中卡面不能被卡池滚动窗口裁掉：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.selectionContainsMarker, `选中标记不能被卡池滚动窗口裁掉：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.selectionClipContainsPreview, `选中卡面必须完整留在卡池当前可视滚动区域：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.selectionClipContainsMarker, `选中标记必须完整留在卡池当前可视滚动区域：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.viewportContainsMarker, `选中标记不能被视口裁掉：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.viewportContainsOptions, `卡牌候选不能被视口裁掉：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.viewportContainsHand, `底部手牌不能被视口裁掉：${JSON.stringify(layout)}`).toBe(true);
    expect(layout.backdropStopsBeforeHand, `卡池遮罩必须在手牌区域上方结束，不能压暗或模糊手牌：${JSON.stringify(layout)}`).toBe(true);
}

async function dismissCardSpotlights(page: Page): Promise<void> {
    const root = page.getByTestId('spotlight-container-root');
    const card = page.getByTestId('card-spotlight-overlay');
    if (!await root.isVisible().catch(() => false)) {
        await clearHandCardHover(page);
        return;
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
        if (!await root.isVisible().catch(() => false)) {
            await page.waitForTimeout(350);
            if (!await root.isVisible().catch(() => false)) return;
            continue;
        }
        const activeItemId = await card.getAttribute('data-spotlight-item-id').catch(() => null);
        const backdropPoint = await page.evaluate(() => {
            const rootElement = document.querySelector('[data-testid="spotlight-container-root"]');
            const cardElement = rootElement?.querySelector('[data-testid="card-spotlight-overlay"]');
            if (!rootElement) return null;
            const cardRect = cardElement?.getBoundingClientRect();
            const candidates = [
                [24, 24], [24, window.innerHeight - 24], [window.innerWidth - 24, 24],
                [window.innerWidth - 24, window.innerHeight - 24],
                [window.innerWidth / 2, 24], [window.innerWidth / 2, window.innerHeight - 24],
                [24, window.innerHeight / 2], [window.innerWidth - 24, window.innerHeight / 2],
            ];
            for (const [x, y] of candidates) {
                if (cardRect && x >= cardRect.left && x <= cardRect.right && y >= cardRect.top && y <= cardRect.bottom) continue;
                const hit = document.elementFromPoint(x, y);
                if (hit?.closest('[data-testid="spotlight-container-root"]') === rootElement
                    && !hit.closest('[data-testid="card-spotlight-overlay"]')) return { x, y };
            }
            return null;
        });
        expect(backdropPoint, '卡牌特写应暴露可真实点击的背景区域').not.toBeNull();
        await page.mouse.click(backdropPoint!.x, backdropPoint!.y);
        await expect.poll(async () => {
            if (!await root.isVisible().catch(() => false)) return 'closed';
            return await card.getAttribute('data-spotlight-item-id').catch(() => 'transitioning');
        }, { timeout: 3000 }).not.toBe(activeItemId);
        await page.waitForTimeout(350);
    }
    await expect.poll(async () => {
        if (await root.isVisible().catch(() => false)) return false;
        await page.waitForTimeout(350);
        return !await root.isVisible().catch(() => false);
    }, { timeout: 5000 }).toBe(true);
    await clearHandCardHover(page);
}

async function clearHandCardHover(page: Page): Promise<void> {
    await page.mouse.move(1, 1);
    await expect(page.locator('[data-card-key]:hover')).toHaveCount(0);
    await page.waitForTimeout(300);
}

async function clickAbilitySlot(page: Page, slotId: string, abilityId: string): Promise<void> {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-available-ability-id', abilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    await expect(slot).toBeVisible();
    const hitTest = await slot.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
            x: Math.round(x), y: Math.round(y),
            slotId: element.getAttribute('data-ability-slot'),
            hitTag: hit?.tagName ?? null,
            hitTestId: hit?.getAttribute('data-testid') ?? null,
            hitSlotId: hit?.closest('[data-ability-slot]')?.getAttribute('data-ability-slot') ?? null,
        };
    });
    expect(hitTest.hitSlotId, `${slotId}技能槽中心点命中结果: ${JSON.stringify(hitTest)}`).toBe(slotId);
    await slot.click({ timeout: 10000 });
}

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const box = await card.boundingBox();
    expect(box, `应找到 ${cardId} 的手牌拖放区域`).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height * 0.78;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, Math.max(24, startY - 240), { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function runAwarenessPrepareFlow(
    page: Page,
    game: { openTestGame: (gameId: string, query?: Record<string, string | number | boolean>) => Promise<void>; setupScene: (config: Record<string, unknown>) => Promise<void>; getState: () => Promise<TestGameState | null | undefined> },
    evidenceRun: EvidenceScreenshotRun,
    viewport: { width: number; height: number },
    screenshotPrefix: string,
): Promise<{ media: EvidenceScreenshotIndexEntry[]; trace: EvidenceTraceRecorder }> {
    const viewportName = viewport.width < 1000 ? 'mobile' : 'desktop';
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    await page.setViewportSize(viewport);
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);

    const excludedIds = new Set(['spell-flames-of-faltine', PREPARE_SPELL_ID, HAND_CARD_ID]);
    const remainingDeck = DOCTOR_STRANGE_CARDS.filter(card => !excludedIds.has(card.id)).map(card => card.id);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: [HAND_CARD_ID],
            deck: remainingDeck,
            discard: [PREPARE_SPELL_ID],
            resources: { CP: 3, HP: 50 },
        },
        player1: { resources: { CP: 3, HP: 50 } },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'doctor_strange', '1': 'monk' },
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: true,
            dice: [3, 3, 3, 3, 1].map((value, id) => ({ id, value, isKept: true })),
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            hero: state?.core?.players?.['0']?.characterId,
            dieSymbols: state?.core?.dice?.map(die => die.symbol),
            prepared: state?.core?.players?.['0']?.preparedSpells?.map(card => card.id),
            handHasSource: state?.core?.players?.['0']?.hand?.some(card => card.id === HAND_CARD_ID),
            discardHasTarget: state?.core?.players?.['0']?.discard?.some(card => card.id === PREPARE_SPELL_ID),
            opponentCp: state?.core?.players?.['1']?.resources?.cp,
        };
    }, { timeout: 10000 }).toMatchObject({
        hero: 'doctor_strange',
        dieSymbols: [DOCTOR_STRANGE_FACE.BOOK, DOCTOR_STRANGE_FACE.BOOK, DOCTOR_STRANGE_FACE.BOOK, DOCTOR_STRANGE_FACE.BOOK, DOCTOR_STRANGE_FACE.MANDALA],
        prepared: ['spell-flames-of-faltine'],
        handHasSource: true,
        discardHasTarget: true,
        opponentCp: 3,
    });

    await expect(page.locator('[data-prepared-spell-zone="public"]')).toBeVisible();
    await expect(page.locator('[data-prepared-spell-card="spell-flames-of-faltine"]')).toBeVisible();
    await dismissCardSpotlights(page);
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="player-board-surface"]').first())
        .toHaveAttribute('data-character-id', 'doctor_strange');
    await expect(page.locator('[data-testid="player-board-surface"] [data-ability-slot="chi"]').first())
        .toHaveAttribute('data-available-ability-id', 'strange-cosmic-awareness');
    const awarenessSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="chi"]').first();
    await clickAbilitySlot(page, 'chi', 'strange-cosmic-awareness');
    await expect(awarenessSlot).toHaveAttribute('data-is-selected', 'true');
    await expect(page.getByTestId('dt-ability-selected-check-chi')).toBeVisible();
    await page.waitForTimeout(300);
    const selectedHandCard = page.locator(
        `[data-testid="hand-area"] [data-card-id="${HAND_CARD_ID}"] [data-testid="hand-card-visual"]`,
    );
    const selectedHandCardBounds = await selectedHandCard.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
    });
    expect(selectedHandCardBounds.top).toBeGreaterThanOrEqual(-1);
    expect(selectedHandCardBounds.left).toBeGreaterThanOrEqual(-1);
    expect(selectedHandCardBounds.right).toBeLessThanOrEqual(selectedHandCardBounds.viewportWidth + 1);
    expect(selectedHandCardBounds.bottom,
        `技能待结算时手牌需留出视口底边距：${JSON.stringify(selectedHandCardBounds)}`,
    ).toBeLessThanOrEqual(selectedHandCardBounds.viewportHeight - (viewport.width < 1000 ? 18 : 20));
    const selectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, `${screenshotPrefix}-宇宙感知已选待结算`,
        'internal-setup-select-awareness', '真实鼠标选择宇宙感知技能槽',
        '宇宙感知进入待结算状态',
        snapshot => (snapshot.visible.selectedAbilityIds as (string | null)[]).includes('strange-cosmic-awareness'),
        true,
    );
    media.push({
        path: selectedScreenshot, chainId: `奇异博士选择宇宙感知技能-${viewportName}`, chainStep: '技能已选待结算', stage: '中态',
        uiStateId: `doctor-strange-${viewportName}-awareness-selected`,
        behaviorStepId: 'internal-setup-select-awareness',
        description: '真实鼠标选择宇宙感知；技能待结算，法术效果尚未触发。',
        role: 'main-flow', viewport: viewportName, transition: '选择满足四本魔法书骰面的宇宙感知。',
    });
    const advance = page.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advance).toContainText('结算攻击');
    await advance.click();
    const spellOption = page.getByTestId(`dt-discard-card-option-${PREPARE_SPELL_ID}`);
    await expect(spellOption).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await expect(page.getByText('从弃牌堆选择1个法术并准备', { exact: true })).toBeVisible();
    await page.waitForTimeout(300);
    const handCardGeometry = await page.locator('[data-testid="hand-area"] [data-testid="hand-card-visual"]')
        .evaluateAll(cards => ({
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            cards: cards.map(card => {
                const rect = card.getBoundingClientRect();
                return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
            }),
        }));
    expect(handCardGeometry.cards.length).toBeGreaterThan(0);
    expect(handCardGeometry.cards.every(rect => rect.top >= -1
        && rect.left >= -1
        && rect.right <= handCardGeometry.viewportWidth + 1
        && rect.bottom <= handCardGeometry.viewportHeight - (viewport.width < 1000 ? 18 : 20))).toBe(true);
    if (viewport.width < 1000) {
        const geometry = await spellOption.evaluate(element => {
            const scrollViewport = element.closest('.overflow-y-auto');
            const optionRect = element.getBoundingClientRect();
            const viewportRect = scrollViewport?.getBoundingClientRect();
            return {
                optionWidth: optionRect.width,
                optionBottom: optionRect.bottom,
                visibleBottom: Math.min(viewportRect?.bottom ?? window.innerHeight, window.innerHeight),
            };
        });
        expect(geometry.optionWidth).toBeLessThanOrEqual(130);
        expect(geometry.optionBottom).toBeLessThanOrEqual(geometry.visibleBottom + 1);
    }
    await expect(page.getByTestId(`dt-discard-card-option-${PREPARE_SPELL_ID}`)).toBeVisible();
    const choiceScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, `${screenshotPrefix}-弃牌准备选择态`,
        'internal-setup-choose-spell-from-discard', '提交技能结算并显示弃牌法术候选',
        '弃牌法术候选可见',
        snapshot => (snapshot.visible.choiceLabels as string[]).some(label => label.includes('法瑞拉之牙')),
        true,
    );
    media.push({
        path: choiceScreenshot, chainId: `宇宙感知从弃牌堆选择法术-${viewportName}`, chainStep: '法术候选', stage: '中态',
        uiStateId: `doctor-strange-${viewportName}-spell-choice`,
        behaviorStepId: 'internal-setup-choose-spell-from-discard',
        description: '内部初始化场景；真实鼠标命中技能槽后显示弃牌准备选择。',
        role: 'main-flow', viewport: viewportName, transition: '玩家点击宇宙感知并打开法术选择',
    });
    await spellOption.click();
    await page.waitForTimeout(250);
    await expect(page.getByTestId('board-magnify-overlay')).toHaveCount(0);
    const selectedCardBounds = await spellOption.evaluate(element => {
        const preview = element.querySelector('[data-testid^="dt-card-choice-preview-"]');
        const viewport = element.closest('[data-testid="dt-card-pool-selection"]');
        const previewRect = preview?.getBoundingClientRect();
        const viewportRect = viewport?.getBoundingClientRect();
        return {
            previewTop: previewRect?.top ?? Number.NaN,
            previewBottom: previewRect?.bottom ?? Number.NaN,
            viewportTop: viewportRect?.top ?? Number.NaN,
            viewportBottom: viewportRect?.bottom ?? Number.NaN,
        };
    });
    expect(selectedCardBounds.previewTop).toBeGreaterThanOrEqual(selectedCardBounds.viewportTop);
    expect(selectedCardBounds.previewBottom).toBeLessThanOrEqual(selectedCardBounds.viewportBottom);
    await assertCardPoolInteractionFitsViewport(page);
    const selectedHandGeometry = await page.locator('[data-testid="hand-area"] [data-testid="hand-card-visual"]')
        .evaluateAll(cards => ({
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            cards: cards.map(card => {
                const rect = card.getBoundingClientRect();
                return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
            }),
        }));
    expect(selectedHandGeometry.cards.length).toBeGreaterThan(0);
    expect(selectedHandGeometry.cards.every(rect => rect.top >= -1
        && rect.left >= -1
        && rect.right <= selectedHandGeometry.viewportWidth + 1
        && rect.bottom <= selectedHandGeometry.viewportHeight - (viewport.width < 1000 ? 18 : 20))).toBe(true);
    const selectedSpellScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, `${screenshotPrefix}-法术卡已选待确认`,
        'internal-setup-select-spell-card', '从弃牌法术候选区选中法瑞拉之牙但暂不提交',
        '候选卡高亮且确认按钮可用',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes(`dt-discard-card-option-${PREPARE_SPELL_ID}`),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    media.push({
        path: selectedSpellScreenshot, chainId: `宇宙感知从弃牌堆选择法术-${viewportName}`, chainStep: '已选待确认', stage: '中态',
        uiStateId: `doctor-strange-${viewportName}-spell-choice-selected`,
        behaviorStepId: 'internal-setup-select-spell-card',
        description: '选中弃牌区的法瑞拉之牙后显示选中态，仍需通过现有确认按钮提交。',
        role: 'main-flow', viewport: viewportName, transition: '在弃牌候选卡池点击法术卡。',
    });
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await spellOption.click();
    await expect(spellOption).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeDisabled();
    await spellOption.click();
    await expect(page.getByTestId('dt-interaction-confirm')).toBeEnabled();
    await page.getByTestId('dt-interaction-confirm').click();

    const targetChoice = page.getByTestId('dt-player-target-1');
    await expect(targetChoice).toBeVisible();
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await expect(page.getByText('选择失去1点施法值的对手', { exact: true })).toBeVisible();
    await expect.poll(async () => (await game.getState())?.core?.players?.['1']?.resources?.cp).toBe(3);
    const targetScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, `${screenshotPrefix}-法术准备目标选择态`,
        'internal-setup-select-opponent-cp-target', '选择法瑞拉之牙并显示目标选择',
        '目标玩家数量',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        1,
    );
    media.push({
        path: targetScreenshot, chainId: `法瑞拉之牙选择施法值目标-${viewportName}`, chainStep: '目标候选', stage: '中态',
        uiStateId: `doctor-strange-${viewportName}-spell-prepare-target-choice`,
        behaviorStepId: 'internal-setup-select-opponent-cp-target',
        description: '标题说明目标效果为失去1点施法值，候选只包含合法对手。',
        role: 'main-flow', viewport: viewportName, transition: '点击法术卡并选择受影响的对手。',
    });
    await targetChoice.click();
    const selectedTargetScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, `${screenshotPrefix}-目标玩家已选待确认`,
        'internal-setup-select-target-player', '从现有玩家卡片交互选中对手但暂不提交',
        '目标玩家高亮且确认按钮可用',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-player-target-1'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    media.push({
        path: selectedTargetScreenshot, chainId: `法瑞拉之牙选择施法值目标-${viewportName}`, chainStep: '目标已选待确认', stage: '中态',
        uiStateId: `doctor-strange-${viewportName}-spell-target-selected`,
        behaviorStepId: 'internal-setup-select-target-player',
        description: '选中失去施法值的对手后保留待确认态。',
        role: 'main-flow', viewport: viewportName, transition: '在现有玩家选择面选中对手。',
    });
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await targetChoice.click();
    await expect(targetChoice).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeDisabled();
    await targetChoice.click();
    await expect(page.getByTestId('dt-interaction-confirm')).toBeEnabled();
    await page.getByTestId('dt-interaction-confirm').click();

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            prepared: state?.core?.players?.['0']?.preparedSpells?.map(card => card.id),
            dejaVu: state?.core?.players?.['0']?.tokens?.['deja-vu'] ?? 0,
            premonition: state?.core?.players?.['0']?.tokens?.premonition ?? 0,
            opponentCp: state?.core?.players?.['1']?.resources?.cp,
            discardHasTarget: state?.core?.players?.['0']?.discard?.some(card => card.id === PREPARE_SPELL_ID),
        };
    }, { timeout: 10000 }).toMatchObject({
        prepared: ['spell-flames-of-faltine', PREPARE_SPELL_ID],
        dejaVu: 1,
        premonition: 2,
        opponentCp: 2,
        discardHasTarget: false,
    });
    await expect(page.locator(`[data-prepared-spell-card="${PREPARE_SPELL_ID}"]`)).toBeVisible();
    await page.waitForTimeout(1000);
    return { media, trace };
}

test.describe('Dice Throne 奇异博士独立交互验收（内部初始化）', () => {
    test.describe.configure({ timeout: 90_000 });

    test('桌面牌桌以真实鼠标选择宇宙感知并从弃牌准备法术', async ({ page, game }, testInfo) => {
        const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const result = await runAwarenessPrepareFlow(page, game, evidenceRun, { width: 1440, height: 900 }, '桌面');
        await promoteTracedEvidenceScreenshotRun(evidenceRun, result.media, result.trace,
            '桌面宇宙感知与法术选择交互', '索引只展示技能选择、弃牌法术候选与选中待确认，以及法瑞拉之牙的玩家选择界面。');
    });

    test('手机横屏牌桌以真实鼠标选择宇宙感知并从弃牌准备法术', async ({ page, game }, testInfo) => {
        const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const result = await runAwarenessPrepareFlow(page, game, evidenceRun, { width: 812, height: 375 }, '手机横屏');
        await promoteTracedEvidenceScreenshotRun(evidenceRun, result.media, result.trace,
            '手机横屏宇宙感知与法术选择交互', '索引只展示技能选择、弃牌法术候选与选中待确认，以及法瑞拉之牙的玩家选择界面。');
    });
});

test('桌面牌桌以真实状态选择器移除奇异博士法术指定的状态', async ({ page, game }, testInfo) => {
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const removalSpellId = 'spell-winds-of-watoomb';
    await page.setViewportSize({ width: 1440, height: 900 });
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);
    const excludedIds = new Set(['spell-flames-of-faltine', removalSpellId, HAND_CARD_ID]);
    const remainingDeck = DOCTOR_STRANGE_CARDS.filter(card => !excludedIds.has(card.id)).map(card => card.id);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: [HAND_CARD_ID], deck: remainingDeck, discard: [removalSpellId],
            resources: { CP: 3, HP: 50 },
        },
        player1: { statusEffects: { dazzle: 1, blinded: 1 }, resources: { CP: 3, HP: 50 } },
        currentPlayer: '0', phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'doctor_strange', '1': 'monk' },
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            hostStarted: true, rollCount: 1, rollLimit: 3, rollConfirmed: true,
            dice: [3, 3, 3, 3, 1].map((value, id) => ({ id, value, isKept: true })),
        },
    });
    const awarenessSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="chi"]').first();
    await expect(awarenessSlot).toHaveAttribute('data-available-ability-id', 'strange-cosmic-awareness');
    await expect.poll(async () => (await game.getState())?.core?.dice?.map(die => die.symbol), { timeout: 10000 })
        .toEqual(Array(4).fill(DOCTOR_STRANGE_FACE.BOOK).concat(DOCTOR_STRANGE_FACE.MANDALA));
    await dismissCardSpotlights(page);
    await clickAbilitySlot(page, 'chi', 'strange-cosmic-awareness');
    await expect(awarenessSlot).toHaveAttribute('data-is-selected', 'true');
    const selectedAbilityScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '法术移除状态-宇宙感知已选',
        'remove-status-select-awareness', '选择宇宙感知且尚未结算法术效果',
        '宇宙感知技能槽已选中',
        snapshot => (snapshot.visible.selectedAbilityIds as (string | null)[]).includes('strange-cosmic-awareness'),
        true,
    );
    media.push({
        path: selectedAbilityScreenshot, chainId: '奇异博士选择宇宙感知技能', chainStep: '技能已选待结算', stage: '中态',
        uiStateId: 'doctor-strange-remove-status-awareness-selected',
        behaviorStepId: 'remove-status-select-awareness',
        description: '真实鼠标选择宇宙感知，确认技能尚未结算。',
        role: 'main-flow', viewport: 'desktop', transition: '选择满足四本魔法书骰面的宇宙感知。',
    });
    const advance = page.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advance).toContainText('结算攻击');
    await advance.click();

    const spellOption = page.getByTestId(`dt-discard-card-option-${removalSpellId}`);
    await expect.poll(async () => (await game.getState())?.core?.players?.['0']?.deck?.length, { timeout: 15000 }).toBe(28);
    await expect(spellOption).toBeVisible({ timeout: 10000 });
    const cardCandidatesScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '瓦图姆之风-弃牌法术候选',
        'remove-status-prepare-card-candidates', '真实使用宇宙感知打开弃牌法术选择',
        '候选池只显示授权准备的弃牌法术',
        snapshot => ({
            count: (snapshot.visible.choiceLabels as string[]).length,
            removalSpellVisible: (snapshot.visible.choiceIds as string[]).includes(`dt-discard-card-option-${removalSpellId}`),
        }),
        { count: 1, removalSpellVisible: true },
    );
    await spellOption.click();
    const cardSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '瓦图姆之风-法术卡已选待确认',
        'remove-status-prepare-card-selected', '选中弃牌区的瓦图姆之风并等待确认',
        '法术卡选中且确认按钮可用',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes(`dt-discard-card-option-${removalSpellId}`),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    await page.getByTestId('dt-interaction-confirm').click();

    const statusCandidates = page.locator('#modal-root [data-testid^="dt-status-effect-"]');
    await expect(statusCandidates).toHaveCount(2, { timeout: 10000 });
    await expect(page.getByText('选择要移除的状态', { exact: true })).toBeVisible();
    const statusOwner = page.locator('#modal-root [data-testid^="dt-status-owner-"]');
    await expect(statusOwner).toHaveCount(1);
    await expect(page.locator('#modal-root [data-testid^="dt-player-target-"]')).toHaveCount(0);
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    const statusCandidatesScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '瓦图姆之风-状态效果候选',
        'remove-status-candidate-effects', '准备瓦图姆之风后显示规则给出的状态候选',
        '本人和对手现存的两个状态均可选择',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        2,
    );
    await page.getByTestId('dt-status-effect-1-dazzle').click();
    await expect(statusOwner).toBeVisible();
    await expect(page.locator('#modal-root [data-testid^="dt-player-target-"]')).toHaveCount(0);
    await expect(page.getByTestId('dt-status-effect-1-dazzle')).toHaveAttribute('data-selected', 'true');
    await page.mouse.move(720, 310);
    await page.waitForTimeout(300);
    const statusSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '瓦图姆之风-状态已选待确认',
        'remove-status-opponent-effect-selected', '直接点击 P2 的眩目状态图标；一次指定持有人和状态，等待确认',
        '状态图标选中但效果仍未结算',
        snapshot => {
            const players = snapshot.authoritative.players as Record<string, {
                statusEffects: Record<string, number>;
                preparedSpellIds: string[];
            }>;
            return {
                selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-status-effect-1-dazzle'),
                confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
                opponentDazzleUnchanged: players['1']?.statusEffects?.dazzle === 1,
                opponentBlindedUnchanged: players['1']?.statusEffects?.blinded === 1,
                spellPrepared: players['0']?.preparedSpellIds?.includes(removalSpellId) === true,
            };
        },
        {
            selected: true,
            confirmVisible: true,
            opponentDazzleUnchanged: true,
            opponentBlindedUnchanged: true,
            spellPrepared: true,
        },
    );
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await page.getByTestId('dt-status-effect-1-dazzle').click();
    await expect(page.getByTestId('dt-status-effect-1-dazzle')).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('dt-interaction-confirm')).toHaveText('跳过');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeEnabled();
    await page.setViewportSize({ width: 812, height: 375 });
    await page.mouse.move(406, 180);
    await expect(page.getByText('选择要移除的状态', { exact: true })).toBeVisible();
    await expect(page.locator('#modal-root [data-testid^="dt-player-target-"]')).toHaveCount(0);
    const mobileStatusGeometry = async () => page.locator('#modal-root [data-testid^="dt-status-effect-"]')
        .evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
                viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
        }));
    const mobileStatusCandidateGeometry = await mobileStatusGeometry();
    expect(mobileStatusCandidateGeometry).toHaveLength(2);
    expect(mobileStatusCandidateGeometry.every(rect => rect.width > 0 && rect.height > 0
        && rect.left >= -1 && rect.top >= -1
        && rect.right <= rect.viewportWidth + 1 && rect.bottom <= rect.viewportHeight + 1)).toBe(true);
    const mobileStatusCandidatesScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '瓦图姆之风-横屏-状态效果候选',
        'remove-status-mobile-candidate-effects', '缩窄到横屏手机后仍可直接选择状态图标',
        '两个状态候选和持有人均完整可见，且没有玩家目标选择步骤',
        snapshot => ({
            candidateCount: (snapshot.visible.choiceLabels as string[]).length,
            skipVisible: (snapshot.visible.modalButtonLabels as string[]).includes('跳过'),
        }),
        { candidateCount: 2, skipVisible: true },
    );
    await page.getByTestId('dt-status-effect-1-dazzle').click();
    await expect(page.getByTestId('dt-status-effect-1-dazzle')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeEnabled();
    await expect(page.locator('#modal-root [data-testid^="dt-player-target-"]')).toHaveCount(0);
    const mobileStatusSelectedGeometry = await mobileStatusGeometry();
    const mobileConfirmBounds = await page.getByTestId('dt-interaction-confirm').boundingBox();
    expect(mobileStatusSelectedGeometry).toHaveLength(2);
    expect(mobileStatusSelectedGeometry.every(rect => rect.width > 0 && rect.height > 0
        && rect.left >= -1 && rect.top >= -1
        && rect.right <= rect.viewportWidth + 1 && rect.bottom <= rect.viewportHeight + 1)).toBe(true);
    expect(mobileConfirmBounds).toBeTruthy();
    expect(mobileConfirmBounds!.x).toBeGreaterThanOrEqual(-1);
    expect(mobileConfirmBounds!.y).toBeGreaterThanOrEqual(-1);
    expect(mobileConfirmBounds!.x + mobileConfirmBounds!.width).toBeLessThanOrEqual(813);
    expect(mobileConfirmBounds!.y + mobileConfirmBounds!.height).toBeLessThanOrEqual(376);
    const mobileStatusSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '瓦图姆之风-横屏-状态已选待确认',
        'remove-status-mobile-selected-effect', '横屏手机直接选中对手的眩目状态并暂不提交',
        '状态图标显示选中反馈，确认可用，状态仍未移除',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-status-effect-1-dazzle'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
            opponentDazzleUnchanged: (snapshot.authoritative.players as Record<string, { statusEffects: Record<string, number> }> )['1']?.statusEffects?.dazzle === 1,
        }),
        { selected: true, confirmVisible: true, opponentDazzleUnchanged: true },
    );
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await page.getByTestId('dt-interaction-confirm').click();
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            ownBlinded: state?.core?.players?.['0']?.statusEffects?.blinded ?? 0,
            opponentDazzle: state?.core?.players?.['1']?.statusEffects?.dazzle ?? 0,
            opponentBlinded: state?.core?.players?.['1']?.statusEffects?.blinded ?? 0,
            prepared: state?.core?.players?.['0']?.preparedSpells?.some(card => card.id === removalSpellId) ?? false,
        };
    }, { timeout: 10000 }).toEqual({ ownBlinded: 0, opponentDazzle: 0, opponentBlinded: 1, prepared: true });
    media.push(
        { path: cardCandidatesScreenshot, chainId: '奇异博士从弃牌堆选择法术', chainStep: '法术候选', stage: '中态', uiStateId: 'doctor-strange-remove-status-card-candidates',
            behaviorStepId: 'remove-status-prepare-card-candidates', description: '宇宙感知的弃牌准备候选只显示瓦图姆之风。',
            role: 'main-flow', viewport: 'desktop', transition: '推进宇宙感知的法术准备选择。' },
        { path: cardSelectedScreenshot, chainId: '奇异博士从弃牌堆选择法术', chainStep: '法术已选待确认', stage: '中态', uiStateId: 'doctor-strange-remove-status-card-selected',
            behaviorStepId: 'remove-status-prepare-card-selected', description: '选中瓦图姆之风后由确认按钮提交卡牌选择。',
            role: 'main-flow', viewport: 'desktop', transition: '点击弃牌区的瓦图姆之风。' },
        { path: statusCandidatesScreenshot, chainId: '瓦图姆之风直接选择状态效果', chainStep: '状态候选', stage: '中态', uiStateId: 'doctor-strange-remove-status-candidates',
            behaviorStepId: 'remove-status-candidate-effects', description: '瓦图姆之风已准备后的状态候选；每个图标都可直接点击，玩家卡只标出持有人。',
            role: 'main-flow', viewport: 'desktop', transition: '选状态图标，玩家只作为状态持有人标识。' },
        { path: statusSelectedScreenshot, chainId: '瓦图姆之风直接选择状态效果', chainStep: '状态已选待确认', stage: '中态', uiStateId: 'doctor-strange-remove-status-selected',
            behaviorStepId: 'remove-status-opponent-effect-selected', description: '直接选中二号玩家的眩目图标；状态仍未移除，等待确认。',
            role: 'main-flow', viewport: 'desktop', transition: '直接点击目标状态图标，一次确定持有人和效果。' },
    );
    media.push(
        { path: mobileStatusCandidatesScreenshot, chainId: '瓦图姆之风直接选择状态效果-横屏', chainStep: '状态候选', stage: '中态', uiStateId: 'doctor-strange-remove-status-mobile-candidates',
            behaviorStepId: 'remove-status-mobile-candidate-effects', description: '横屏手机上直接从两个状态图标中选择；没有先选玩家的步骤。',
            role: 'main-flow', viewport: 'mobile', transition: '桌面候选态的同一交互切换到横屏手机视口。' },
        { path: mobileStatusSelectedScreenshot, chainId: '瓦图姆之风直接选择状态效果-横屏', chainStep: '状态已选待确认', stage: '中态', uiStateId: 'doctor-strange-remove-status-mobile-selected',
            behaviorStepId: 'remove-status-mobile-selected-effect', description: '横屏手机上直接选中眩目状态；确认可见，状态尚未移除。',
            role: 'main-flow', viewport: 'mobile', transition: '点击眩目状态图标，一次锁定状态和持有人。' },
    );
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '奇异博士复用法术卡池和状态选择器', '索引仅含法术卡池、状态候选与选中待确认界面；状态选择一步直达，确认结算另由运行时断言覆盖。');
});

test('四人组队中奇异博士队友真实打出值得拥有并重掷当前投掷者的骰子', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const chainId = '奇异博士队友使用值得拥有重掷队友骰子';
    await page.setViewportSize({ width: 1440, height: 900 });
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        // The card is owned by teammate 2, while the current roller (player 0)
        // owns the reroll decision and must see/operate this interaction.
        playerID: '0', disableLocalAiAutomation: true,
        seat0: 'human', seat1: 'human', seat2: 'human', seat3: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: { resources: { CP: 3, HP: 50 } },
        player1: { resources: { CP: 3, HP: 50 } },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            seatControllers: {
                '0': { type: 'human' }, '1': { type: 'human' },
                '2': { type: 'human' }, '3': { type: 'human' },
            },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: [1, 2, 3, 4, 5].map((value, id) => ({
                id, value, isKept: false, ownerId: '0', definitionId: 'monk-dice',
            })),
        },
    });

    const worthyCard = DOCTOR_STRANGE_CARDS.find(card => card.id === 'card-worthy-of-me');
    if (!worthyCard) throw new Error('奇异博士牌组缺少 card-worthy-of-me');
    const strangePlayer = initHeroState('2', 'doctor_strange', DICE_THRONE_PREPARE_RANDOM);
    strangePlayer.hand = [structuredClone(worthyCard)];
    strangePlayer.deck = strangePlayer.deck.filter(card => card.id !== worthyCard.id);
    strangePlayer.discard = [];
    Object.assign(strangePlayer.resources, { CP: 1, cp: 1, HP: 50, hp: 50 });
    const fourthPlayer = initHeroState('3', 'treant', DICE_THRONE_PREPARE_RANDOM);
    fourthPlayer.hand = [];
    fourthPlayer.deck = [];
    fourthPlayer.discard = [];
    Object.assign(fourthPlayer.resources, { CP: 3, cp: 3, HP: 50, hp: 50 });
    await page.evaluate(({ nextStrangePlayer, nextFourthPlayer }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { get?: () => unknown; set?: (state: unknown) => void | Promise<void> };
            };
        }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state || typeof state !== 'object' || !harness?.state?.set) throw new Error('TestHarness state 不可用');
        const stateRecord = state as Record<string, unknown>;
        const core = stateRecord.core;
        if (!core || typeof core !== 'object') throw new Error('TestHarness Dice Throne core 不可用');
        const coreRecord = core as Record<string, unknown>;
        const players = coreRecord.players;
        if (!players || typeof players !== 'object') throw new Error('TestHarness 玩家集合不可用');
        return harness.state.set({
            ...stateRecord,
            core: {
                ...coreRecord,
                players: { ...(players as Record<string, unknown>), '2': nextStrangePlayer, '3': nextFourthPlayer },
                selectedCharacters: {
                    ...((coreRecord.selectedCharacters as Record<string, unknown> | undefined) ?? {}),
                    '0': 'monk', '1': 'barbarian', '2': 'doctor_strange', '3': 'treant',
                },
                readyPlayers: { ...((coreRecord.readyPlayers as Record<string, unknown> | undefined) ?? {}), '0': true, '1': true, '2': true, '3': true },
                seatControllers: {
                    ...((coreRecord.seatControllers as Record<string, unknown> | undefined) ?? {}),
                    '0': { type: 'human' }, '1': { type: 'human' },
                    '2': { type: 'human' }, '3': { type: 'human' },
                },
                seatingOrder: ['0', '1', '2', '3'],
                teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
                teamHealth: { A: 50, B: 50 },
                activePlayerId: '0',
                currentPlayerId: '0',
            },
        });
    }, { nextStrangePlayer: strangePlayer, nextFourthPlayer: fourthPlayer });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase,
            playerIds: Object.keys(state?.core?.players ?? {}).sort(),
            teams: state?.core?.teamIdByPlayerId,
            strangeHero: state?.core?.players?.['2']?.characterId,
            strangeHand: state?.core?.players?.['2']?.hand?.map(card => card.id),
            dice: state?.core?.dice?.map(die => die.value),
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'offensiveRoll',
        playerIds: ['0', '1', '2', '3'],
        teams: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
        strangeHero: 'doctor_strange',
        strangeHand: ['card-worthy-of-me'],
        dice: [1, 2, 3, 4, 5],
    });
    await dismissCardSpotlights(page);
    await page.evaluate(async () => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { command?: { dispatch?: (command: unknown) => Promise<unknown> } };
        }).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) throw new Error('TestHarness command dispatch 不可用');
        await harness.command.dispatch({
            type: 'PLAY_CARD',
            playerId: '2',
            payload: { cardId: 'card-worthy-of-me' },
        });
    });
    await expect.poll(async () => {
        const interaction = (await game.getState())?.sys?.interaction?.current;
        return {
            kind: interaction?.kind,
            playerId: interaction?.playerId,
            sourceId: interaction?.data?.sourceId,
            dtType: interaction?.data?.meta?.dtType,
            diceOwnerId: interaction?.data?.meta?.diceOwnerId,
            targetOpponentDice: interaction?.data?.meta?.targetOpponentDice,
            selectCount: interaction?.data?.meta?.selectCount,
        };
    }, { timeout: 10000 }).toEqual({
        kind: 'multistep-choice', playerId: '0', sourceId: 'card-worthy-of-me',
        dtType: 'selectDie', diceOwnerId: '0', targetOpponentDice: false, selectCount: 2,
    });
    const diceTray = getRightTrayDiceTray(page);
    const firstRollerDie = diceTray.getByTestId('die-button-0').first();
    const secondRollerDie = diceTray.getByTestId('die-button-1').first();
    await expect(firstRollerDie).toHaveAttribute('data-owner-id', '0');
    await expect(secondRollerDie).toHaveAttribute('data-owner-id', '0');
    await expect(firstRollerDie).toHaveAttribute('data-clickable', 'true');
    await expect(secondRollerDie).toHaveAttribute('data-clickable', 'true');
    await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择骰子');
    const diceHintAnchor = page.getByTestId('dice-interaction-hint-anchor');
    await expect(diceHintAnchor).toHaveAttribute('data-placement', 'left-center');
    const diceHintBounds = await diceHintAnchor.boundingBox();
    expect(diceHintBounds).not.toBeNull();
    expect(Math.abs(diceHintBounds!.y + diceHintBounds!.height / 2 - 450)).toBeLessThanOrEqual(32);
    expect(diceHintBounds!.x).toBeGreaterThanOrEqual(0);
    expect(diceHintBounds!.x).toBeLessThan(360);
    expect(diceHintBounds!.x + diceHintBounds!.width).toBeLessThanOrEqual(1441);
    const targetScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '值得拥有-投掷者骰区目标态',
        'worthy-teammate-dice-targets', '队友出牌后由当前投掷者查看自己的骰区',
        '交互归当前投掷者，且其骰子可点击',
        snapshot => {
            const interaction = snapshot.authoritative.interaction as Record<string, unknown>;
            const dice = snapshot.visible.dice as { id: string | null; ownerId: string | null; clickable: boolean }[];
            return {
                interaction,
                rollerDiceClickable: dice.filter(die => die.ownerId === '0' && die.clickable).map(die => die.id).includes('0'),
                allyHintText: snapshot.visible.diceInteractionHintText,
            };
        },
        {
            interaction: {
                kind: 'multistep-choice', playerId: '0', sourceId: 'card-worthy-of-me',
                dtType: 'selectDie', selectCount: 2, diceOwnerId: '0', targetOpponentDice: false,
                allowedDieIds: [0, 1, 2, 3, 4],
            },
            rollerDiceClickable: true,
            allyHintText: '选择骰子（0/2）',
        },
    );
    media.push({
        path: targetScreenshot, chainId: '值得拥有选择投掷者骰子', chainStep: '骰子候选', stage: '中态',
        uiStateId: 'doctor-strange-worthy-teammate-targets', uiChange: 'interaction-mode',
        uiChangeReason: '队友牌出牌后进入骰子选择，玩家可在当前投掷者的实际骰区选择。',
        behaviorStepId: 'worthy-teammate-dice-targets',
        description: '当前投掷者0拥有交互并在自己的骰区选择骰子。',
        role: 'main-flow', viewport: 'desktop', transition: '奇异博士队友真实打出该牌并进入骰子选择。',
    });

    await firstRollerDie.click();
    await expect(page.getByTestId('dice-interaction-hint')).toHaveText('选择骰子（1/2）');
    const oneRerollScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '值得拥有-同骰已选一次',
        'worthy-teammate-dice-selected-once', '真实鼠标首次选择当前投掷者的一颗骰子',
        '同一颗骰子出现选中态且仍可再次选择',
        snapshot => ({
            selected: (snapshot.visible.dice as { id: string | null; selected: boolean }[])
                .some(die => die.id === '0' && die.selected),
            hint: snapshot.visible.diceInteractionHintText,
        }),
        { selected: true, hint: '选择骰子（1/2）' },
    );
    media.push({
        path: oneRerollScreenshot, chainId: '值得拥有选择投掷者骰子', chainStep: '已选1/2', stage: '中态',
        uiStateId: 'doctor-strange-worthy-teammate-die-selected-once',
        behaviorStepId: 'worthy-teammate-dice-selected-once',
        description: '当前投掷者选中一颗骰子后显示1/2进度；该骰仍是可再次点击的合法目标。',
        role: 'main-flow', viewport: 'desktop', transition: '第一次选中同一骰子。',
    });
    await expect(firstRollerDie).toHaveAttribute('data-clickable', 'true');
    await firstRollerDie.click();
    await expect(page.getByTestId('dice-interaction-hint')).toHaveText('完成');
    await expect(firstRollerDie).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('dice-interaction-hint')).toHaveText('完成');
    const selectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '值得拥有-投掷者同骰重选两次',
        'worthy-teammate-dice-selected', '真实鼠标连续选择当前投掷者的同一颗骰子两次',
        '同一颗骰子计入两次重掷预算并进入待确认状态',
        snapshot => {
            const dice = snapshot.visible.dice as { id: string | null; ownerId: string | null; selected: boolean }[];
            return dice.some(die => die.id === '0' && die.ownerId === '0' && die.selected);
        },
        true,
    );
    media.push({
        path: selectedScreenshot, chainId: '值得拥有选择投掷者骰子', chainStep: '已选2/2待确认', stage: '中态',
        uiStateId: 'doctor-strange-worthy-teammate-selected-dice', uiChange: 'target-highlight',
        uiChangeReason: '真实鼠标连续点击后同一颗合法骰子显示选中态且进度达到2/2。',
        behaviorStepId: 'worthy-teammate-dice-selected',
        description: '同一颗骰子来自当前投掷者0，连续选择两次达到规则预算。',
        role: 'main-flow', viewport: 'desktop', transition: '将同一颗骰子重掷两次。',
    });

    await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
    await page.evaluate(() => window.__BG_TEST_HARNESS__?.dice.setValues([6, 5]));
    await expect(page.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            dice: state?.core?.dice?.map(die => die.value),
            interaction: state?.sys?.interaction?.current ?? null,
            strangeHand: state?.core?.players?.['2']?.hand?.map(card => card.id),
            strangeDiscard: state?.core?.players?.['2']?.discard?.map(card => card.id),
        };
    }, { timeout: 10000 }).toEqual({
            dice: [5, 2, 3, 4, 5], interaction: null,
        strangeHand: [], strangeDiscard: ['card-worthy-of-me'],
    });
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '奇异博士队友可以真实打出值得拥有并重掷当前投掷者骰子',
        '截图只展示骰子候选与选择进度；骰面变化和卡牌去向由同用例断言验证。');
});

test('桌面牌桌以真实鼠标消耗即视感并重开进攻投掷阶段', async ({ page, game }, testInfo) => {
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const chainId = '奇异博士即视感重开阶段';
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: { deck: DOCTOR_STRANGE_CARDS.filter(card => card.id !== 'spell-flames-of-faltine').map(card => card.id),
            resources: { CP: 3, HP: 50 },
            tokens: { [DOCTOR_STRANGE_TOKEN.DEJA_VU]: 1 }, statusEffects: { blinded: 1, dazzle: 1 } },
        player1: { resources: { CP: 3, HP: 50 } },
        currentPlayer: '0', phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true,
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            rollCount: 3, rollLimit: 3, rollConfirmed: true,
            dice: [1, 2, 3, 4, 5].map((value, id) => ({ id, value, isKept: true })),
        },
    });

    const token = page.getByTestId('dt-player-0-token-deja-vu');
    await expect(token).toBeVisible();
    await dismissCardSpotlights(page);
    await page.waitForTimeout(2500);
    const beforeScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '即视感使用前-桌面',
        'deja-vu-ready-after-rolls', '进入本人进攻投掷次数已用尽的牌桌状态',
        '即视感仍可用且异常状态仍在',
        snapshot => {
            const player = (snapshot.authoritative.players as Record<string, { tokens: Record<string, number>; statusEffects: Record<string, number> }>)['0'];
            return {
                rollCount: snapshot.authoritative.rollCount,
                dejaVu: player?.tokens[DOCTOR_STRANGE_TOKEN.DEJA_VU] ?? 0,
                blinded: player?.statusEffects.blinded ?? 0,
                dazzle: player?.statusEffects.dazzle ?? 0,
            };
        },
        { rollCount: 3, dejaVu: 1, blinded: 1, dazzle: 1 },
    );
    media.push({
        path: beforeScreenshot, chainId, chainStep: media.length + 1, stage: '前态',
        uiStateId: 'doctor-strange-deja-vu-ready', behaviorStepId: 'deja-vu-ready-after-rolls',
        description: '内部初始化场景；本回合投掷次数用尽，状态与即视感仍可见。',
        role: 'main-flow', viewport: 'desktop', transition: '关闭初始手牌特写并进入已投尽的本人进攻投掷阶段。',
    });
    await token.hover();
    await page.waitForTimeout(250);
    await expect.poll(async () => {
        const tooltip = await page.getByTestId('info-tooltip').filter({ hasText: '即视感' }).boundingBox();
        const group = await page.locator('[data-tutorial-id="status-tokens"]').first().boundingBox();
        return Boolean(tooltip && group && tooltip.y + tooltip.height <= group.y);
    }).toBe(true);
    const hoverScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '即视感悬停说明态-桌面',
        'deja-vu-token-hover', '鼠标悬停即视感标记查看其操作说明',
        '悬停后显示即视感说明',
        snapshot => (snapshot.visible.visibleTooltipTitles as string[]).includes('即视感'),
        true,
    );
    media.push({
        path: hoverScreenshot, chainId: '即视感状态悬停查看说明', chainStep: '状态说明悬停', stage: '中态',
        uiStateId: 'doctor-strange-deja-vu-token-hover', behaviorStepId: 'deja-vu-token-hover',
        uiChange: 'target-highlight', uiChangeReason: '悬停时可操作的状态标记放大并显示说明。',
        description: '鼠标悬停即视感标记后，标记高亮并显示操作说明。',
        role: 'main-flow', viewport: 'desktop', transition: '玩家将鼠标移到可用的即视感状态标记。',
    });
    await token.click();
    await expect.poll(async () => {
        const state = await game.getState();
        const player = state?.core?.players?.['0'];
        return {
            phase: state?.sys?.phase,
            rollCount: state?.core?.rollCount,
            dejaVu: player?.tokens?.[DOCTOR_STRANGE_TOKEN.DEJA_VU] ?? 0,
            blinded: player?.statusEffects?.blinded ?? 0,
            dazzle: player?.statusEffects?.dazzle ?? 0,
        };
    }, { timeout: 10000 }).toEqual({ phase: 'offensiveRoll', rollCount: 0, dejaVu: 0, blinded: 0, dazzle: 0 });
    await page.waitForTimeout(1500);
    const afterScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '即视感重开后-桌面',
        'deja-vu-restarted-rolls', '点击即视感并完成投掷阶段重开',
        '状态消耗、投掷归零且阶段异常状态清除',
        snapshot => {
            const player = (snapshot.authoritative.players as Record<string, { tokens: Record<string, number>; statusEffects: Record<string, number> }>)['0'];
            return {
                phase: snapshot.authoritative.phase,
                rollCount: snapshot.authoritative.rollCount,
                dejaVu: player?.tokens[DOCTOR_STRANGE_TOKEN.DEJA_VU] ?? 0,
                blinded: player?.statusEffects.blinded ?? 0,
                dazzle: player?.statusEffects.dazzle ?? 0,
            };
        },
        { phase: 'offensiveRoll', rollCount: 0, dejaVu: 0, blinded: 0, dazzle: 0 },
    );
    media.push({
        path: afterScreenshot, chainId, chainStep: media.length + 1, stage: '后态',
        uiStateId: 'doctor-strange-deja-vu-restarted', behaviorStepId: 'deja-vu-restarted-rolls',
        description: '真实鼠标点击即视感后，状态标记消耗、投掷计数归零且旧阶段效果清理。',
        role: 'main-flow', viewport: 'desktop', transition: '点击即视感状态重开进攻投掷阶段。',
    });
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '即视感状态操作说明交互', '截图只展示状态标记的悬停说明；点击后的阶段与状态变化由同用例断言验证。');
});

test('桌面牌桌使用3层预感替代收入并将本次抽牌放回牌库底', async ({ page, game }, testInfo) => {
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', { playerID: '0' });
    trace.previous = await readEvidenceSnapshot(page, game);
    const excludedIds = new Set(['spell-flames-of-faltine', HAND_CARD_ID]);
    const remainingDeck = DOCTOR_STRANGE_CARDS.filter(card => !excludedIds.has(card.id)).map(card => card.id);
    const drawnIds = remainingDeck.slice(0, 3);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: { hand: [HAND_CARD_ID], deck: remainingDeck, tokens: { [DOCTOR_STRANGE_TOKEN.PREMONITION]: 3 }, resources: { CP: 3, HP: 50 } },
        player1: { resources: { CP: 3, HP: 50 } }, currentPlayer: '0', phase: 'upkeep',
        extra: { selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true, turnNumber: 2 },
    });

    const advance = page.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advance).toBeEnabled();
    await advance.click();
    const threeDrawChoice = page.getByRole('button', { name: '花费3预感：抽3张牌' });
    await expect(threeDrawChoice).toBeVisible({ timeout: 10000 });
    const incomeOptionsScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '收入阶段替代选项-桌面',
        'income-replacement-choice', '推进到收入阶段并显示预感替代选项',
        '收入选项包含花费3层预感抽3张牌',
        snapshot => (snapshot.visible.modalButtonLabels as string[]).some(label => label.includes('花费3预感')),
        true,
    );
    await threeDrawChoice.click();
    const drawnCardChoices = page.locator('#modal-root [data-testid^="dt-hand-card-option-"]');
    await expect(drawnCardChoices).toHaveCount(3, { timeout: 10000 });
    const cardChoiceScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '本次抽牌返还选择-桌面',
        'income-return-drawn-card', '支付3层预感并从本次抽到的牌中选择返还对象',
        '只显示本次抽到的三张牌',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        3,
    );
    await drawnCardChoices.first().click();
    const selectedDrawnCardScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '本次抽牌已选待确认-桌面',
        'income-return-drawn-card-selected', '选中本次抽到的卡牌但暂不提交返还对象',
        '选中卡牌高亮且确认按钮可用',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).length,
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: 1, confirmVisible: true },
    );
    await page.getByTestId('dt-interaction-confirm').click();
    const bottomChoice = page.getByRole('button', { name: '牌库底', exact: true });
    await expect(bottomChoice).toBeVisible();
    const returnPositionScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '选择牌库底-桌面',
        'income-return-position', '选择一张本次抽牌并显示返还位置',
        '牌库顶和牌库底均可选择',
        snapshot => {
            const labels = snapshot.visible.modalButtonLabels as string[];
            return { top: labels.includes('牌库顶'), bottom: labels.includes('牌库底') };
        },
        { top: true, bottom: true },
    );
    await bottomChoice.click();

    await expect.poll(async () => {
        const state = await game.getState();
        const player = state?.core?.players?.['0'];
        return {
            premonition: player?.tokens?.[DOCTOR_STRANGE_TOKEN.PREMONITION] ?? 0,
            returnedCard: player?.deck?.at(-1)?.id,
            returnedFromThisDraw: drawnIds.includes(player?.deck?.at(-1)?.id ?? ''),
            returnedStillInHand: player?.hand?.some(card => card.id === player?.deck?.at(-1)?.id),
            handCount: player?.hand?.length,
        };
    }, { timeout: 10000 }).toMatchObject({ premonition: 0, returnedCard: expect.stringMatching(/^card-|^spell-/), returnedFromThisDraw: true, returnedStillInHand: false, handCount: 3 });
    const settledScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '预感收入结算后-桌面',
        'income-returned-to-bottom', '选择牌库底并完成收入替代结算',
        '预感扣减且其余抽牌保留在手牌',
        snapshot => {
            const player = (snapshot.authoritative.players as Record<string, { tokens: Record<string, number>; handCount: number }>)['0'];
            return { premonition: player?.tokens.premonition ?? 0, handCount: player?.handCount };
        },
        { premonition: 0, handCount: 3 },
    );
    media.push(
        { path: incomeOptionsScreenshot, chainId: '预感替代收入选项', chainStep: '收入选项候选', stage: '独特界面态',
            uiStateId: 'doctor-strange-income-options', behaviorStepId: 'income-replacement-choice',
            description: '真实主要阶段推进到收入阶段后显示正常收入与预感替代选项。', role: 'main-flow', viewport: 'desktop', transition: '玩家结束维护阶段进入收入阶段。' },
        { path: cardChoiceScreenshot, chainId: '本次抽牌返还对象选择', chainStep: '本次抽牌候选', stage: '中态',
            uiStateId: 'doctor-strange-income-drawn-cards', behaviorStepId: 'income-return-drawn-card',
            description: '选择花费3层预感抽3张后，只显示本次抽到的卡牌供返还。', role: 'main-flow', viewport: 'desktop', transition: '选择花费3层预感抽取3张牌。' },
        { path: selectedDrawnCardScreenshot, chainId: '本次抽牌返还对象选择', chainStep: '卡牌已选待确认', stage: '中态',
            uiStateId: 'doctor-strange-income-drawn-card-selected', behaviorStepId: 'income-return-drawn-card-selected',
            description: '选中本次抽到的一张牌后，通过确认按钮提交返还选择。', role: 'main-flow', viewport: 'desktop', transition: '从本次抽牌候选中点击一张牌。' },
        { path: returnPositionScreenshot, chainId: '本次抽牌返还位置选择', chainStep: '牌库位置候选', stage: '中态',
            uiStateId: 'doctor-strange-income-return-position', behaviorStepId: 'income-return-position',
            description: '选择本次抽到的牌后，显示返还牌库顶或牌库底选项。', role: 'main-flow', viewport: 'desktop', transition: '选择一张本次抽牌作为返还对象。' },
        { path: settledScreenshot, chainId: '本次抽牌返还结算', chainStep: '返还结果', stage: '后态',
            uiStateId: 'doctor-strange-income-settled', behaviorStepId: 'income-returned-to-bottom',
            description: '结算后预感消耗3、其余两张留手牌且一张回到牌库底。', role: 'main-flow', viewport: 'desktop', transition: '选择牌库底并完成收入替代。' },
    );
    expect(drawnIds).toHaveLength(3);
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '预感替代收入选项与卡牌选择交互', '索引只展示收入选项、抽牌候选、卡牌选中和返还位置选择；返还结果由同用例断言验证。');
});

test('桌面牌桌以全知之眼从顶五准备两张不同法术并重排其余卡牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90_000);
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const chainId = '奇异博士全知之眼顶五法术流程';
    await page.setViewportSize({ width: 1440, height: 900 });
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);
    const chosenSpellIds = ['spell-bolts-of-balthakk', 'spell-fangs-of-farallah'];
    const excludedIds = new Set(['spell-flames-of-faltine', ...chosenSpellIds]);
    const deck = [
        ...chosenSpellIds,
        ...DOCTOR_STRANGE_CARDS.filter(card => !excludedIds.has(card.id)).map(card => card.id),
    ];
    await game.setupScene({
        gameId: 'dicethrone',
        player0: { deck, resources: { CP: 3, HP: 50 } }, player1: { resources: { CP: 3, HP: 50 } },
        currentPlayer: '0', phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true,
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            rollCount: 1, rollLimit: 3, rollConfirmed: true,
            dice: [6, 6, 6, 6, 6].map((value, id) => ({ id, value, isKept: true })),
        },
    });

    await expect(page.locator('[data-prepared-spell-card="spell-flames-of-faltine"]')).toBeVisible();
    await dismissCardSpotlights(page);
    await page.waitForTimeout(1000);
    const attackReadyScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼攻击前-桌面',
        'ultimate-five-amulet-ready', '初始化五颗护身符均为成功结果的进攻状态',
        '奇异博士和五颗护身符骰面可见',
        snapshot => ({
            heroVisible: (snapshot.visible.boardHeroIds as (string | null)[]).includes('doctor_strange'),
            diceSymbols: snapshot.authoritative.diceSymbols,
        }),
        { heroVisible: true, diceSymbols: Array(5).fill(DOCTOR_STRANGE_FACE.AMULET) },
    );
    const attackReadyStep = media.length + 1;
    const ultimateSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="ultimate"]').first();
    await clickAbilitySlot(page, 'ultimate', 'strange-all-seeing-eye');
    await expect(ultimateSlot).toHaveAttribute('data-is-selected', 'true');
    const abilitySelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼已选待结算-桌面',
        'ultimate-select-before-resolution', '真实鼠标选择全知之眼技能槽',
        '全知之眼进入待结算状态',
        snapshot => (snapshot.visible.selectedAbilityIds as (string | null)[]).includes('strange-all-seeing-eye'),
        true,
    );
    const advance = page.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advance).toContainText('结算攻击');
    await advance.click();
    const firstSpell = page.getByTestId('dt-deck-card-option-spell-bolts-of-balthakk');
    await expect(firstSpell).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('从牌库顶5张中选择至多2个法术', { exact: true })).toBeVisible();
    await expect(page.getByTestId('dt-card-pool-selection')).toHaveAttribute('data-card-pool-kind', 'deck');
    const firstChoiceScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼顶五法术选择-桌面',
        'ultimate-prepare-top-five', '结算全知之眼并显示顶五法术候选',
        '顶五中显示两张法术候选和跳过操作',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        2,
    );
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await firstSpell.click();
    await expect(firstSpell).toHaveAttribute('data-selection-focus', 'selected');
    await expect(page.getByTestId('dt-deck-card-option-spell-fangs-of-farallah')).toHaveAttribute('data-selection-focus', 'deemphasized');
    await expect(page.getByTestId('dt-card-choice-selected-spell-bolts-of-balthakk')).toBeVisible();
    const firstSpellSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼首张法术已选-桌面',
        'ultimate-first-top-five-spell-selected', '选中顶五中的第一张法术并等待确认',
        '首张法术卡已高亮且可确认',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-deck-card-option-spell-bolts-of-balthakk'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    await firstSpell.click();
    await expect(page.getByTestId('dt-card-choice-selected-spell-bolts-of-balthakk')).toHaveCount(0);
    await expect(page.getByTestId('dt-interaction-confirm')).toHaveText('跳过');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeEnabled();
    await expect(firstSpell).toHaveAttribute('data-selection-focus', 'available');
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await firstSpell.click();
    await expect(page.getByTestId('dt-interaction-confirm')).toHaveText('确认');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeEnabled();
    await page.getByTestId('dt-interaction-confirm').click();
    const secondSpell = page.getByTestId('dt-deck-card-option-spell-fangs-of-farallah');
    await expect(secondSpell).toBeVisible({ timeout: 10000 });
    await secondSpell.click();
    const secondSpellSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼次张法术已选-桌面',
        'ultimate-second-top-five-spell-selected', '选中顶五中的第二张法术并等待确认',
        '次张法术卡已高亮且可确认',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-deck-card-option-spell-fangs-of-farallah'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    await page.getByTestId('dt-interaction-confirm').click();
    const prepareTarget = page.getByTestId('dt-player-target-1');
    await expect(prepareTarget).toBeVisible({ timeout: 10000 });
    const prepareTargetScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼法术准备目标选择-桌面',
        'ultimate-prepare-spell-target', '选择两张不同法术并显示目标选择',
        '法术目标选项数量',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        1,
    );
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await prepareTarget.click();
    const targetPlayerSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼目标玩家已选-桌面',
        'ultimate-prepare-target-selected', '选中法瑞拉之牙的对手目标并等待确认',
        '目标玩家高亮且确认按钮可用',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-player-target-1'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    await prepareTarget.click();
    await expect(page.getByTestId('dt-player-target-1')).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('dt-interaction-confirm')).toBeDisabled();
    await expect(page.getByTestId('dt-interaction-clear')).toHaveCount(0);
    await prepareTarget.click();
    await page.getByTestId('dt-interaction-confirm').click();

    const reorderChoices = page.locator('#modal-root [data-testid^="dt-deck-card-option-"]');
    await expect(reorderChoices).toHaveCount(3, { timeout: 10000 });
    const reorderScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼重排剩余三张-桌面',
        'ultimate-order-remaining-cards', '完成法术目标选择并显示剩余三张的重排顺序',
        '待重排卡牌数量',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        3,
    );
    let reorderSelectedScreenshot: string | undefined;
    for (let index = 0; index < 3; index += 1) {
        const firstRemaining = page.locator('#modal-root [data-testid^="dt-deck-card-option-"]').first();
        await expect(firstRemaining).toBeVisible();
        await firstRemaining.click();
        if (index === 0) {
            reorderSelectedScreenshot = await captureTracedState(
                page, game, evidenceRun, trace, '全知之眼重排首张已选-桌面',
                'ultimate-first-reorder-card-selected', '选中牌库顶五剩余卡中的第一张并等待确认',
                '重排卡牌已高亮且可确认',
                snapshot => ({
                    selected: (snapshot.visible.selectedChoiceIds as string[]).length,
                    confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
                }),
                { selected: 1, confirmVisible: true },
            );
        }
        await page.getByTestId('dt-interaction-confirm').click();
    }

    // 重排完成后，法术帧会自动续接到施法选择；此时进攻按钮应保持禁用。
    const castSkip = page.getByRole('button', { name: '跳过', exact: true });
    await expect(castSkip).toBeVisible({ timeout: 10000 });
    await waitForDiceThroneVisualIdle(page);
    await page.waitForTimeout(500);
    const castScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼攻击后施法选择-桌面',
        'ultimate-post-damage-cast-choice', '完成剩余卡牌排序并进入攻击后的施法选择',
        '施法选择中的跳过按钮可见',
        snapshot => (snapshot.visible.modalButtonLabels as string[]).includes('跳过'),
        true,
    );
    const castSpell = page.getByTestId('dt-preparedSpells-card-option-spell-fangs-of-farallah');
    await expect(castSpell).toBeVisible({ timeout: 10000 });
    await castSpell.click();
    await waitForDiceThroneVisualIdle(page);
    const castSpellSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼准备区法术已选-桌面',
        'ultimate-prepared-spell-selected', '选中准备区的法瑞拉之牙施放并等待确认',
        '准备区法术高亮且可确认',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-preparedSpells-card-option-spell-fangs-of-farallah'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    await page.getByTestId('dt-interaction-confirm').click();
    await expect(page.getByRole('button', { name: '跳过', exact: true })).toBeVisible({ timeout: 10000 });
    const secondCastChoiceScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼下一次施放选择-桌面',
        'ultimate-second-cast-choice', '完成第一次施放后显示剩余准备法术与跳过操作',
        '剩余准备法术候选和跳过操作可见',
        snapshot => ({
            candidates: (snapshot.visible.choiceLabels as string[]).length,
            skipVisible: (snapshot.visible.modalButtonLabels as string[]).includes('跳过'),
        }),
        { candidates: 2, skipVisible: true },
    );
    await castSkip.click();
    await expect.poll(async () => {
        const state = await game.getState();
        const player = state?.core?.players?.['0'];
        return {
            opponentHp: state?.core?.players?.['1']?.resources?.hp,
            prepared: player?.preparedSpells?.map(card => card.id),
            discard: player?.discard?.map(card => card.id) ?? [],
            pendingAttack: state?.core?.pendingAttack,
            hasStrangeFrame: Boolean(state?.sys?.resolution?.frames?.some((frame: { kind?: string }) => frame.kind === 'dicethrone:doctor-strange-spell')),
        };
    }, { timeout: 15000 }).toMatchObject({
        opponentHp: 37,
        prepared: expect.arrayContaining(['spell-flames-of-faltine', 'spell-bolts-of-balthakk']),
        discard: expect.arrayContaining(['spell-fangs-of-farallah']),
        pendingAttack: null,
        hasStrangeFrame: false,
    });
    const damageFx = page.getByTestId('flying-effect-damage');
    if (await damageFx.count()) await expect(damageFx).toHaveCount(0, { timeout: 8000 });
    await page.waitForTimeout(500);
    const settledScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '全知之眼攻击结算-桌面',
        'ultimate-attack-settled', '跳过施法并完成终极攻击结算',
        '攻击伤害已结算、法术准备区保留三张且攻击事务收口',
        snapshot => {
            const players = snapshot.authoritative.players as Record<string, { resources: { hp: number | null }; preparedSpellIds: string[]; discardIds: string[] }>;
            return {
                opponentHp: players['1']?.resources.hp,
                prepared: ['spell-flames-of-faltine', 'spell-bolts-of-balthakk'].every(id => players['0']?.preparedSpellIds.includes(id)),
                discardedCastSpell: players['0']?.discardIds.includes('spell-fangs-of-farallah'),
                pendingAttack: snapshot.authoritative.pendingAttack,
            };
        },
        { opponentHp: 37, prepared: true, discardedCastSpell: true, pendingAttack: null },
    );
    media.push(
        { path: attackReadyScreenshot, chainId, chainStep: attackReadyStep, stage: '前态', uiStateId: 'doctor-strange-ultimate-ready',
            behaviorStepId: 'ultimate-five-amulet-ready', description: '内部初始化场景；五颗护身符满足全知之眼终极技能。',
            role: 'main-flow', viewport: 'desktop', transition: '达到终极技能骰面条件。' },
        { path: abilitySelectedScreenshot, chainId: '全知之眼技能选择', chainStep: '技能已选待结算', stage: '中态', uiStateId: 'doctor-strange-ultimate-selected',
            behaviorStepId: 'ultimate-select-before-resolution', description: '真实鼠标选择全知之眼后，等待玩家提交攻击结算。',
            role: 'main-flow', viewport: 'desktop', transition: '点击全知之眼技能槽。' },
        { path: firstChoiceScreenshot, chainId: '全知之眼顶五法术选择', chainStep: '法术候选', stage: '中态', uiStateId: 'doctor-strange-ultimate-top-five-choice',
            behaviorStepId: 'ultimate-prepare-top-five', description: '真实鼠标触发终极技能后，顶五中法术以卡图供选择准备。',
            role: 'main-flow', viewport: 'desktop', transition: '推进按钮提交攻击结算。' },
        { path: firstSpellSelectedScreenshot, chainId: '全知之眼顶五法术选择', chainStep: '第一张法术已选待确认', stage: '中态', uiStateId: 'doctor-strange-ultimate-top-five-first-selected',
            behaviorStepId: 'ultimate-first-top-five-spell-selected', description: '第一张顶五法术卡片选中后显示提交确认状态。',
            role: 'main-flow', viewport: 'desktop', transition: '从顶五候选中选中博萨特之雷。' },
        { path: secondSpellSelectedScreenshot, chainId: '全知之眼顶五法术选择', chainStep: '第二张法术已选待确认', stage: '中态', uiStateId: 'doctor-strange-ultimate-top-five-second-selected',
            behaviorStepId: 'ultimate-second-top-five-spell-selected', description: '第二张顶五法术卡片选中后显示提交确认状态。',
            role: 'main-flow', viewport: 'desktop', transition: '从剩余顶五候选中选中法瑞拉之牙。' },
        { path: prepareTargetScreenshot, chainId: '法瑞拉之牙目标玩家选择', chainStep: '目标候选', stage: '中态', uiStateId: 'doctor-strange-ultimate-prepare-target',
            behaviorStepId: 'ultimate-prepare-spell-target', description: '准备法瑞拉之牙后，选择其效果影响的对手。',
            role: 'main-flow', viewport: 'desktop', transition: '依次准备博萨特之雷和法瑞拉之牙。' },
        { path: targetPlayerSelectedScreenshot, chainId: '法瑞拉之牙目标玩家选择', chainStep: '对手已选待确认', stage: '中态', uiStateId: 'doctor-strange-ultimate-target-selected',
            behaviorStepId: 'ultimate-prepare-target-selected', description: '目标玩家卡片选中后保留待确认态。',
            role: 'main-flow', viewport: 'desktop', transition: '在玩家选择面选中对手。' },
        { path: reorderScreenshot, chainId: '全知之眼剩余卡牌重排', chainStep: '剩余卡牌候选', stage: '中态', uiStateId: 'doctor-strange-ultimate-reorder',
            behaviorStepId: 'ultimate-order-remaining-cards', description: '准备两张不同法术后，玩家选择顶五中剩余三张的顺序。',
            role: 'main-flow', viewport: 'desktop', transition: '选择法瑞拉之牙的目标并完成准备效果。' },
        { path: reorderSelectedScreenshot!, chainId: '全知之眼剩余卡牌重排', chainStep: '首张已选待确认', stage: '中态', uiStateId: 'doctor-strange-ultimate-reorder-card-selected',
            behaviorStepId: 'ultimate-first-reorder-card-selected', description: '选中剩余卡牌后由现有确认按钮逐张提交排序。',
            role: 'main-flow', viewport: 'desktop', transition: '选择下一张牌库顶卡。' },
        { path: castScreenshot, chainId: '全知之眼攻击后选择法术', chainStep: '施放候选', stage: '中态', uiStateId: 'doctor-strange-ultimate-post-damage-cast',
            behaviorStepId: 'ultimate-post-damage-cast-choice', description: '终极攻击结算后显示至多两张不同法术的施放选择。',
            role: 'main-flow', viewport: 'desktop', transition: '完成顶五剩余卡牌排序。' },
        { path: castSpellSelectedScreenshot, chainId: '全知之眼攻击后选择法术', chainStep: '法术已选待确认', stage: '中态', uiStateId: 'doctor-strange-ultimate-prepared-spell-selected',
            behaviorStepId: 'ultimate-prepared-spell-selected', description: '从公开准备区选中法瑞拉之牙并等待确认施放。',
            role: 'main-flow', viewport: 'desktop', transition: '在准备法术候选面选中法瑞拉之牙。' },
        { path: secondCastChoiceScreenshot, chainId: '全知之眼攻击后选择法术', chainStep: '下一次施放候选', stage: '中态', uiStateId: 'doctor-strange-ultimate-second-cast-choice',
            behaviorStepId: 'ultimate-second-cast-choice', description: '第一张法术施放后，剩余候选继续显示并允许跳过。',
            role: 'main-flow', viewport: 'desktop', transition: '确认施放法瑞拉之牙。' },
        { path: settledScreenshot, chainId, chainStep: attackReadyStep + 12, stage: '后态', uiStateId: 'doctor-strange-ultimate-settled',
            behaviorStepId: 'ultimate-attack-settled', description: '一次法术施放后跳过剩余施放，攻击与法术帧均收口。',
            role: 'main-flow', viewport: 'desktop', transition: '跳过剩余施放并等待攻击收口。' },
    );
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '全知之眼法术和目标选择交互', '索引按法术候选、玩家目标、重排和攻击后施法分组；攻击与法术结算由同用例断言验证。');
});

test('桌面牌桌以真实鼠标选择星际侵入并确认奖励骰', async ({ page, game }, testInfo) => {
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const chainId = '奇异博士星际侵入奖励骰结算';
    await page.setViewportSize({ width: 1440, height: 900 });
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            deck: DOCTOR_STRANGE_CARDS.filter(card => card.id !== 'spell-flames-of-faltine').map(card => card.id),
            resources: { CP: 3, HP: 50 },
        },
        player1: { resources: { CP: 3, HP: 50 } },
        currentPlayer: '0', phase: 'offensiveRoll', randomQueue: [0, 0.4],
        extra: {
            selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true,
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
            rollCount: 1, rollLimit: 3, rollConfirmed: true,
            dice: [1, 3, 5, 6, 1].map((value, id) => ({ id, value, isKept: true })),
        },
    });
    await dismissCardSpotlights(page);
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.core?.dice?.map(die => die.symbol);
    }, { timeout: 10000 }).toEqual([
        DOCTOR_STRANGE_FACE.MANDALA, DOCTOR_STRANGE_FACE.BOOK, DOCTOR_STRANGE_FACE.CLOAK,
        DOCTOR_STRANGE_FACE.AMULET, DOCTOR_STRANGE_FACE.MANDALA,
    ]);
    const readyScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '星际侵入前-桌面',
        'astral-incursion-ready', '进入包含四种必要骰面且第五骰为曼荼罗的攻击状态',
        '四种星际侵入触发骰面均就位',
        snapshot => snapshot.authoritative.diceSymbols,
        [DOCTOR_STRANGE_FACE.MANDALA, DOCTOR_STRANGE_FACE.BOOK, DOCTOR_STRANGE_FACE.CLOAK,
            DOCTOR_STRANGE_FACE.AMULET, DOCTOR_STRANGE_FACE.MANDALA],
    );
    const slot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="lotus"]').first();
    await clickAbilitySlot(page, 'lotus', 'strange-astral-incursion');
    await expect(slot).toHaveAttribute('data-is-selected', 'true');
    const selectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '星际侵入已选-桌面',
        'astral-incursion-selected', '真实鼠标选择星际侵入技能槽',
        '星际侵入技能已进入待结算状态',
        snapshot => (snapshot.visible.selectedAbilityIds as (string | null)[]).includes('strange-astral-incursion'), true,
    );
    const advance = page.locator('[data-tutorial-id="advance-phase-button"]');
    await expect(advance).toContainText('结算攻击');
    await advance.click();
    await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), {
        sourceAbilityId: 'strange-astral-incursion', expectedOwnerId: '0',
    });
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.core?.pendingBonusDiceSettlement?.dice?.map(die => ({ value: die.value, face: die.face })) ?? null;
    }, { timeout: 10000 }).toEqual([
        { value: 1, face: DOCTOR_STRANGE_FACE.MANDALA },
        { value: 3, face: DOCTOR_STRANGE_FACE.BOOK },
    ]);
    const bonusDiceScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '星际侵入奖励骰待确认-桌面',
        'astral-bonus-dice-pending', '提交技能结算并等待右侧奖励骰普通确认',
        '两颗奖励骰及骰主待确认结算可见',
        snapshot => snapshot.authoritative.pendingBonusDiceSettlement,
        {
            sourceAbilityId: 'strange-astral-incursion',
            dice: [
                { value: 1, face: DOCTOR_STRANGE_FACE.MANDALA },
                { value: 3, face: DOCTOR_STRANGE_FACE.BOOK },
            ],
            displayOnly: true,
        },
    );
    await settleCurrentBonusDice(page, () => game.getState(), { sourceAbilityId: 'strange-astral-incursion' });
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
            pendingAttack: state?.core?.pendingAttack ? {
                attackerId: state.core.pendingAttack.attackerId,
                defenderId: state.core.pendingAttack.defenderId,
                sourceAbilityId: state.core.pendingAttack.sourceAbilityId,
                bonusDamage: state.core.pendingAttack.bonusDamage,
                settlementStage: state.core.pendingAttack.settlementStage,
                damageResolved: state.core.pendingAttack.damageResolved,
            } : null,
            opponentHp: state?.core?.players?.['1']?.resources?.hp,
            premonition: state?.core?.players?.['0']?.tokens?.[DOCTOR_STRANGE_TOKEN.PREMONITION] ?? 0,
        };
    }, { timeout: 15000 }).toMatchObject({
        pendingBonusDiceSettlement: null,
        pendingAttack: {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'strange-astral-incursion',
            bonusDamage: 3, settlementStage: 'preDamage', damageResolved: false,
        },
        opponentHp: 50, premonition: 1,
    });
    await waitForDiceThroneVisualIdle(page);
    const confirmedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '星际侵入奖励骰确认-桌面',
        'astral-bonus-dice-confirmed', '真实点击右侧确认奖励骰；攻击仍处于防御/伤害前阶段',
        '奖励骰加伤与预感已确认，主攻击尚待防御和伤害结算',
        snapshot => {
            const players = snapshot.authoritative.players as Record<string, { resources: { hp: number | null }; tokens: Record<string, number> }>;
            return {
                pendingBonusDiceSettlement: snapshot.authoritative.pendingBonusDiceSettlement,
                pendingAttack: snapshot.authoritative.pendingAttack,
                opponentHp: players['1']?.resources.hp,
                premonition: players['0']?.tokens[DOCTOR_STRANGE_TOKEN.PREMONITION] ?? 0,
            };
        },
        {
            pendingBonusDiceSettlement: null,
            pendingAttack: {
                attackerId: '0', defenderId: '1', sourceAbilityId: 'strange-astral-incursion',
                bonusDamage: 3, settlementStage: 'preDamage', damageResolved: false,
            },
            opponentHp: 50, premonition: 1,
        },
    );
    media.push(
        { path: readyScreenshot, chainId, chainStep: 1, stage: '前态', uiStateId: 'doctor-strange-astral-ready',
            behaviorStepId: 'astral-incursion-ready', description: '桌面牌桌展示星际侵入所需四种骰面与第五颗曼荼罗骰。',
            role: 'main-flow', viewport: 'desktop', transition: '满足星际侵入的骰面组合。' },
        { path: selectedScreenshot, chainId: '星际侵入技能选择', chainStep: '技能已选待结算', stage: '中态', uiStateId: 'doctor-strange-astral-selected',
            behaviorStepId: 'astral-incursion-selected', description: '真实鼠标选择星际侵入后，等待玩家提交攻击结算。',
            role: 'main-flow', viewport: 'desktop', transition: '点击星际侵入技能槽。' },
        { path: bonusDiceScreenshot, chainId: '星际侵入奖励骰确认', chainStep: '奖励骰待确认', stage: '中态', uiStateId: 'doctor-strange-astral-bonus-dice',
            behaviorStepId: 'astral-bonus-dice-pending', description: '星际侵入生成两颗右侧奖励骰，玩家可见骰面并等待普通确认。',
            role: 'main-flow', viewport: 'desktop', transition: '提交星际侵入攻击并生成奖励骰。' },
        { path: confirmedScreenshot, chainId, chainStep: 4, stage: '后态', uiStateId: 'doctor-strange-astral-bonus-confirmed',
            behaviorStepId: 'astral-bonus-dice-confirmed', description: '确认奖励骰后记录三点攻击加伤与一点预感；当前攻击进入伤害前阶段。',
            role: 'main-flow', viewport: 'desktop', transition: '普通确认右侧奖励骰。' },
    );
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '星际侵入技能与奖励骰交互', '索引展示技能待结算和奖励骰待确认界面；伤害前状态由同用例断言验证。');
});

test('桌面牌桌真实打出法术并将深红系带施加到对手', async ({ page, game }, testInfo) => {
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const chainId = '奇异博士深红系带真实施加';
    await page.setViewportSize({ width: 1440, height: 900 });
    await setChineseLocale(page.context());
    await game.openTestGame('dicethrone', {
        playerID: '0', disableLocalAiAutomation: true, seat0: 'human', seat1: 'human',
    });
    trace.previous = await readEvidenceSnapshot(page, game);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: [CRIMSON_BANDS_SPELL_ID],
            deck: DOCTOR_STRANGE_CARDS.filter(card => card.id !== CRIMSON_BANDS_SPELL_ID).map(card => card.id),
            resources: { CP: 3, HP: 50 },
        },
        player1: { resources: { CP: 3, HP: 50 } },
        currentPlayer: '0', phase: 'main1',
        extra: {
            selectedCharacters: { '0': 'doctor_strange', '1': 'monk' }, hostStarted: true,
            seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
        },
    });
    await dismissCardSpotlights(page);
    await expect(page.locator(`[data-card-id="${CRIMSON_BANDS_SPELL_ID}"]`)).toBeVisible();
    const readyScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '深红系带手牌-桌面',
        'crimson-bands-spell-in-hand', '进入奇异博士主阶段并展示深红系带法术手牌',
        '深红系带法术处于可操作手牌中',
        snapshot => ({ phase: snapshot.authoritative.phase, handCount: (snapshot.authoritative.players as Record<string, { handCount: number }>)['0']?.handCount }),
        { phase: 'main1', handCount: 1 },
    );
    await dragHandCardToPlay(page, CRIMSON_BANDS_SPELL_ID);
    const targetChoice = page.getByTestId('dt-player-target-1');
    await expect(targetChoice).toBeVisible({ timeout: 10000 });
    const targetScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '深红系带目标选择-桌面',
        'crimson-bands-select-opponent', '真实鼠标打出法术并显示对手目标选项',
        '深红系带的合法目标为对手',
        snapshot => (snapshot.visible.choiceLabels as string[]).length,
        1,
    );
    await targetChoice.click();
    const targetSelectedScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '深红系带对手已选待确认-桌面',
        'crimson-bands-opponent-selected', '选中深红系带目标玩家但暂不提交',
        '对手卡片已选中且确认按钮可用',
        snapshot => ({
            selected: (snapshot.visible.selectedChoiceIds as string[]).includes('dt-player-target-1'),
            confirmVisible: (snapshot.visible.modalButtonLabels as string[]).includes('确认'),
        }),
        { selected: true, confirmVisible: true },
    );
    await page.getByTestId('dt-interaction-confirm').click();
    await expect(page.getByTestId('dt-player-1-status-crimson-bands')).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
        const state = await game.getState();
        const target = state?.core?.players?.['1'];
        return {
            status: target?.statusEffects?.[DOCTOR_STRANGE_TOKEN.CRIMSON_BANDS] ?? 0,
            receivedTurn: target?.crimsonBandsReceivedTurn ?? null,
            turnNumber: state?.core?.turnNumber ?? null,
            sourceCardStillInHand: state?.core?.players?.['0']?.hand?.some(card => card.id === CRIMSON_BANDS_SPELL_ID) ?? false,
        };
    }, { timeout: 15000 }).toMatchObject({ status: 1, receivedTurn: 1, turnNumber: 1, sourceCardStillInHand: false });
    const settledScreenshot = await captureTracedState(
        page, game, evidenceRun, trace, '深红系带已施加-桌面',
        'crimson-bands-status-granted', '确认对手目标并完成状态施加',
        '对手获得深红系带且本回合不提前激活',
        snapshot => {
            const players = snapshot.authoritative.players as Record<string, {
                statusEffects: Record<string, number>; crimsonBandsReceivedTurn: number | null;
            }>;
            return {
                status: players['1']?.statusEffects[DOCTOR_STRANGE_TOKEN.CRIMSON_BANDS] ?? 0,
                receivedTurn: players['1']?.crimsonBandsReceivedTurn,
                turnNumber: snapshot.authoritative.turnNumber,
            };
        },
        { status: 1, receivedTurn: 1, turnNumber: 1 },
    );
    media.push(
        { path: readyScreenshot, chainId, chainStep: 1, stage: '前态', uiStateId: 'doctor-strange-crimson-bands-hand',
            behaviorStepId: 'crimson-bands-spell-in-hand', description: '主阶段手牌中显示可打出的深红系带法术。',
            role: 'main-flow', viewport: 'desktop', transition: '进入奇异博士主阶段。' },
        { path: targetScreenshot, chainId: '深红系带选择目标玩家', chainStep: '对手目标候选', stage: '中态', uiStateId: 'doctor-strange-crimson-bands-target',
            behaviorStepId: 'crimson-bands-select-opponent', description: '真实打出法术后显示深红系带的对手目标选择。',
            role: 'main-flow', viewport: 'desktop', transition: '点击手牌中的深红系带法术。' },
        { path: targetSelectedScreenshot, chainId: '深红系带选择目标玩家', chainStep: '对手已选待确认', stage: '中态', uiStateId: 'doctor-strange-crimson-bands-target-selected',
            behaviorStepId: 'crimson-bands-opponent-selected', description: '对手卡片已选中，状态仍未施加，等待确认。',
            role: 'main-flow', viewport: 'desktop', transition: '在现有玩家选择面点击对手卡片。' },
        { path: settledScreenshot, chainId, chainStep: 3, stage: '后态', uiStateId: 'doctor-strange-crimson-bands-granted',
            behaviorStepId: 'crimson-bands-status-granted', description: '对手状态区显示深红系带；权威状态记录获得回合以延迟本回合激活。',
            role: 'main-flow', viewport: 'desktop', transition: '选择对手并完成法术效果。' },
    );
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '深红系带法术玩家选择交互', '索引只展示现有玩家选择面中的目标候选和选中待确认界面；状态施加结果由同用例断言验证。');
});

test('真实双人联机可选奇异博士并进入牌桌', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media: EvidenceScreenshotIndexEntry[] = [];
    const trace = newEvidenceTraceRecorder();
    const chainId = '奇异博士真实双人选角与开局';
    await page.setViewportSize({ width: 1440, height: 900 });
    trace.previous = await readEvidenceSnapshot(page);
    await openOnlineSelection(page, async () => {
        const roomModalScreenshot = await captureTracedState(
            page, undefined, evidenceRun, trace, '真实创建房间-待确认',
            'online-room-create-confirmation', '从 Dice Throne 入口打开真实创建房间确认',
            '创建房间标题可见',
            snapshot => (snapshot.visible.headingTexts as string[]).some(text => /Create Room|创建房间/i.test(text)),
            true,
        );
        media.push({
            path: roomModalScreenshot, chainId, chainStep: 1, stage: '前态',
            uiStateId: 'doctor-strange-online-room-confirmation',
            behaviorStepId: 'online-room-create-confirmation',
            description: '玩家从王权骰铸入口打开创建房间确认界面。',
            role: 'main-flow', viewport: 'desktop', transition: '在游戏详情中选择创建房间。',
        });
    });
    const doctorStrangeCard = page.locator('[data-testid="character-selection-overlay"] [data-character-id="doctor_strange"]');
    await expect(doctorStrangeCard).toBeVisible();
    await expect(page.getByTestId('character-badge-doctor_strange-implementation_in_progress')).toBeVisible();
    await expect(page.locator('[data-character-id="monk"]')).toBeVisible();
    const desktopScreenshot = await captureTracedState(
        page, undefined, evidenceRun, trace, '真实选角入口-奇异博士可选-桌面',
        'online-room-created-selection-visible', '确认创建房间并进入桌面选角界面',
        '真实选角目录显示可选奇异博士及实施中徽标',
        snapshot => ({
            doctorStrangeVisible: (snapshot.visible.selectableHeroIds as string[]).includes('doctor_strange'),
            implementationBadgeVisible: snapshot.visible.doctorStrangeImplementationBadgeVisible,
            setupOptionStatus: snapshot.authoritative.doctorStrangeSetupOptionStatus,
        }),
        { doctorStrangeVisible: true, implementationBadgeVisible: true, setupOptionStatus: 'in_progress' },
    );
    media.push({
        path: desktopScreenshot, chainId: '奇异博士在线角色选择界面', chainStep: '桌面角色候选', stage: '中态',
        uiStateId: 'doctor-strange-available-desktop-selection',
        behaviorStepId: 'online-room-created-selection-visible',
        description: '真实选角页展示可选奇异博士及实施中徽标。',
        role: 'main-flow', viewport: 'desktop', transition: '创建联机房间并显示真实角色选择界面',
    });

    await page.setViewportSize({ width: 812, height: 375 });
    await expect(doctorStrangeCard).toBeVisible();
    await expect(page.getByTestId('character-badge-doctor_strange-implementation_in_progress')).toBeVisible();
    const mobileScreenshot = await captureTracedState(
        page, undefined, evidenceRun, trace, '真实选角入口-奇异博士可选-窄屏',
        'online-selection-mobile-viewport', '将同一真实联机选角页切换到手机横屏尺寸',
        '窄屏选角仍显示奇异博士及实施中徽标',
        snapshot => ({
            doctorStrangeVisible: (snapshot.visible.selectableHeroIds as string[]).includes('doctor_strange'),
            implementationBadgeVisible: snapshot.visible.doctorStrangeImplementationBadgeVisible,
            setupOptionStatus: snapshot.authoritative.doctorStrangeSetupOptionStatus,
        }),
        { doctorStrangeVisible: true, implementationBadgeVisible: true, setupOptionStatus: 'in_progress' },
    );
    media.push({
        path: mobileScreenshot, chainId: '奇异博士在线角色选择界面', chainStep: '手机横屏角色候选', stage: '独特界面态',
        uiStateId: 'doctor-strange-available-mobile-selection',
        uiChange: 'layout', uiChangeReason: '同一真实选角页切换到 812×375 窄屏。',
        behaviorStepId: 'online-selection-mobile-viewport',
        description: '手机横屏真实选角页显示奇异博士及实施中徽标。',
        role: 'main-flow', viewport: 'mobile', transition: '切换同一选角入口为手机横屏视口',
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    const browser = page.context().browser();
    if (!browser) throw new Error('当前 E2E 上下文无法创建 guest 浏览器上下文。');
    const hostUrl = new URL(page.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) throw new Error('无法从真实房间地址取得 matchId。');
    const guestContext = await browser.newContext();
    try {
        await setChineseLocale(guestContext);
        await resetMatchStorage(guestContext, '__doctor_strange_online_guest_storage_reset');
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`${hostUrl.origin}/play/dicethrone/match/${matchId}?join=true`, {
            waitUntil: 'domcontentloaded', timeout: 20000,
        });
        await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });
        await expect(guestPage.locator('[data-testid="character-selection-overlay"]')).toBeVisible({ timeout: 15000 });

        await doctorStrangeCard.click();
        await expect(doctorStrangeCard).toContainText(/P1/);
        const doctorSelectedScreenshot = await captureTracedState(
            page, undefined, evidenceRun, trace, '房主真实选择奇异博士',
            'host-selects-doctor-strange', '房主以真实鼠标选择奇异博士',
            '房主选中奇异博士',
            snapshot => (snapshot.visible.selectedHeroIds as string[]).includes('doctor_strange'),
            true,
        );
        media.push({
            path: doctorSelectedScreenshot, chainId: '房主选择奇异博士', chainStep: '角色已选', stage: '中态',
            uiStateId: 'doctor-strange-selected-by-host', behaviorStepId: 'host-selects-doctor-strange',
            description: '房主选中奇异博士，卡面显示房主选择标记。',
            role: 'main-flow', viewport: 'desktop', transition: '房主点击奇异博士角色卡。',
        });

        const guestMonkCard = guestPage.locator('[data-testid="character-selection-overlay"] [data-character-id="monk"]');
        await guestMonkCard.click();
        await expect(guestMonkCard).toContainText(/P2/);
        await guestPage.getByRole('button', { name: /准备|Ready/i }).click();
        await expect(page.getByRole('button', { name: /开始游戏|Press Start/i })).toBeEnabled({ timeout: 15000 });
        const readyScreenshot = await captureTracedState(
            page, undefined, evidenceRun, trace, '双方选角并由客人准备',
            'guest-selects-monk-and-ready', '客人选择武僧并提交准备',
            '双方真人角色选择可用且房主可开始',
            snapshot => ({
                doctorStrangeSelected: (snapshot.visible.selectedHeroIds as string[]).includes('doctor_strange'),
                setupOptionStatus: snapshot.authoritative.doctorStrangeSetupOptionStatus,
            }),
            { doctorStrangeSelected: true, setupOptionStatus: 'in_progress' },
        );
        media.push({
            path: readyScreenshot, chainId: '双方选角并准备', chainStep: '双方角色就绪', stage: '中态',
            uiStateId: 'doctor-strange-opponent-ready', behaviorStepId: 'guest-selects-monk-and-ready',
            description: '客人选中武僧并准备，房主看到可开始状态。',
            role: 'main-flow', viewport: 'desktop', transition: '客人完成选角并提交准备。',
        });

        await page.getByRole('button', { name: /开始游戏|Press Start/i }).click();
        await expect(page.getByText(/选择你的英雄|Choose your hero|Select Your Hero/i)).not.toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/回合|Turn/i)).toBeVisible({ timeout: 20000 });
        await expect(page.locator('[data-testid="player-board-surface"][data-character-id="doctor_strange"]')).toBeVisible({ timeout: 20000 });
        const hostBoardScreenshot = await captureTracedState(
            page, undefined, evidenceRun, trace, '房主视角进入双人牌桌',
            'host-sees-doctor-strange-board', '房主开始对局并查看自己的奇异博士玩家板',
            '房主牌桌显示其选择的奇异博士玩家板',
            snapshot => ({
                doctorStrangeBoardVisible: (snapshot.visible.boardHeroIds as (string | null)[]).includes('doctor_strange'),
                setupOptionStatus: snapshot.authoritative.doctorStrangeSetupOptionStatus,
            }),
            { doctorStrangeBoardVisible: true, setupOptionStatus: 'in_progress' },
        );
        media.push({
            path: hostBoardScreenshot, chainId, chainStep: 6, stage: '后态',
            uiStateId: 'doctor-strange-live-board-host', behaviorStepId: 'host-sees-doctor-strange-board',
            description: '真实房主牌桌显示自己选择的奇异博士玩家板。',
            role: 'main-flow', viewport: 'desktop', transition: '房主开始双人对局。',
        });

        await expect(guestPage.getByText(/选择你的英雄|Choose your hero|Select Your Hero/i)).not.toBeVisible({ timeout: 20000 });
        await expect(guestPage.getByText(/回合|Turn/i)).toBeVisible({ timeout: 20000 });
        await expect(guestPage.locator('[data-testid="player-board-surface"][data-character-id="monk"]')).toBeVisible({ timeout: 20000 });
        const guestBoardScreenshot = await captureTracedState(
            guestPage, undefined, evidenceRun, trace, '客人视角进入双人牌桌',
            'guest-sees-monk-board', '客人同步进入同一双人牌桌并查看自己的武僧玩家板',
            '客人牌桌显示其选择的武僧玩家板',
            snapshot => ({
                monkBoardVisible: (snapshot.visible.boardHeroIds as (string | null)[]).includes('monk'),
                setupOptionStatus: snapshot.authoritative.doctorStrangeSetupOptionStatus,
            }),
            { monkBoardVisible: true, setupOptionStatus: 'in_progress' },
        );
        media.push({
            path: guestBoardScreenshot, chainId, chainStep: 7, stage: '后态',
            uiStateId: 'doctor-strange-live-board-guest', behaviorStepId: 'guest-sees-monk-board',
            description: '真实客人同步显示自己选择的武僧玩家板。',
            role: 'main-flow', viewport: 'desktop', transition: '客人同步进入同一双人牌桌。',
        });
    } finally {
        await guestContext.close();
    }
    await promoteTracedEvidenceScreenshotRun(evidenceRun, media, trace,
        '奇异博士真实玩家选择界面', '索引只展示桌面/手机选角候选、奇异博士已选和双方准备界面；牌桌对局画面不纳入这组新交互验收图。');
});
