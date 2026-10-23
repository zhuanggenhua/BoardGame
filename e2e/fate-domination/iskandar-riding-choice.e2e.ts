import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
    createEvidenceScreenshotRun,
    getEvidenceScreenshotPathInDirectory,
    promoteEvidenceScreenshotRun,
} from '../framework/evidenceScreenshots';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, initContext } from '../helpers/common';
import { FATE_ATTACK_BY_ID } from '../../src/games/fate-domination/data';
import { canPlayAttack } from '../../src/games/fate-domination/domain/movement';
import { fateRidingCandidates } from '../../src/games/fate-domination/domain/ridingChoice';

test.use({
    viewport: { width: 1920, height: 1080 },
    launchOptions: process.env.PW_BROWSER_EXECUTABLE ? {
        executablePath: process.env.PW_BROWSER_EXECUTABLE,
        chromiumSandbox: true,
    } : { chromiumSandbox: true },
});

const GAME_ID = 'fate-domination';
const EVIDENCE_CATEGORY = 'independent' as const;
const OUTPUT_DIR = path.resolve('test-results/evidence-screenshots/fate-domination/iskandar-riding-choice');
const SOURCE_FILES = [
    'e2e/fate-domination/iskandar-riding-choice.e2e.ts',
    'src/games/fate-domination/Board.tsx',
    'src/games/fate-domination/ui/FateHandSurface.tsx',
    'src/games/fate-domination/domain/ridingChoice.ts',
    'src/games/fate-domination/domain/reducer.ts',
    'src/games/fate-domination/domain/abilityRegistry.ts',
    'src/games/fate-domination/domain/index.ts',
    'src/games/fate-domination/game.ts',
    'src/games/fate-domination/data/cards.ts',
    'src/games/fate-domination/data/identities.ts',
    'src/games/fate-domination/data/cardArtwork.ts',
    'src/games/fate-domination/ui/hand-surface.css',
    'public/assets/i18n/zh-CN/fate-domination/assets-manifest.json',
];

type Snapshot = {
    visible: Record<string, unknown>;
    authoritative: Record<string, unknown>;
};
type TraceStep = {
    id: string;
    action: string;
    before: Snapshot;
    after: Snapshot;
    assertions: Array<{ name: string; actual: unknown; expected: unknown }>;
};
type HarnessState = {
    core: any;
    sys: any;
};
type TestHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => HarnessState;
            patch?: (patch: unknown) => Promise<void>;
            isRegistered?: () => boolean;
        };
        command?: {
            dispatch?: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void>;
            isRegistered?: () => boolean;
        };
    };
};

function sourceRevision(): string {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const digest = createHash('sha256');
    for (const file of [...SOURCE_FILES].sort()) {
        digest.update(file);
        digest.update('\0');
        digest.update(readFileSync(path.resolve(file)));
        digest.update('\0');
    }
    return `${revision}+tree-sha256:${digest.digest('hex')}`;
}

async function readState(page: Page): Promise<HarnessState> {
    return page.evaluate(() => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.state?.get) throw new Error('Fate TestHarness state 未注册');
        return harness.state.get();
    });
}

async function dispatch(page: Page, type: string, playerId: string, payload: Record<string, unknown> = {}) {
    await page.evaluate(async command => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) throw new Error('Fate TestHarness command 未注册');
        await harness.command.dispatch(command);
    }, { type, playerId, payload });
}

async function patchOwnMana(page: Page, mana: number) {
    await page.evaluate(async value => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.state?.patch) throw new Error('Fate TestHarness state.patch 未注册');
        await harness.state.patch({ core: { players: { '0': { mana: value } } } });
    }, mana);
}

/** Arrange one official strength card into the hand as a legal, deterministic scenario fixture. */
async function ensureDefinitionInHandScenario(page: Page, definitionId: string) {
    return page.evaluate(async requestedDefinitionId => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.state?.get || !harness.state.patch) throw new Error('Fate TestHarness state 未注册');
        const player = harness.state.get().core.players['0'];
        if (player.hand.some((card: any) => card.definitionId === requestedDefinitionId)) {
            return { moved: false, cardId: player.hand.find((card: any) => card.definitionId === requestedDefinitionId).id };
        }
        const deckIndex = player.deck.findIndex((card: any) => card.definitionId === requestedDefinitionId);
        const handIndex = player.hand.findIndex((card: any) => card.definitionId !== requestedDefinitionId);
        if (deckIndex < 0 || handIndex < 0) throw new Error(`合法场景牌区中无法找到可置入手牌的 ${requestedDefinitionId}`);
        const hand = [...player.hand];
        const deck = [...player.deck];
        const inserted = deck[deckIndex];
        const returned = hand[handIndex];
        hand[handIndex] = inserted;
        deck[deckIndex] = returned;
        const allIds = [...hand, ...deck].map((card: any) => card.id);
        if (new Set(allIds).size !== allIds.length) throw new Error('场景牌区夹具产生重复卡牌实例');
        await harness.state.patch({ core: { players: { '0': { hand, deck } } } });
        return { moved: true, cardId: inserted.id, returnedCardId: returned.id, deckIndex };
    }, definitionId);
}

/** Keep all official card instances while ensuring the max-selection fixture has a fourth legal option. */
async function ensureRidingCandidateCountScenario(page: Page, minimum: number) {
    const state = await readState(page);
    const player = state.core.players['0'];
    const hand = [...player.hand];
    const deck = [...player.deck];
    const isCandidate = (card: any) => {
        const definition = FATE_ATTACK_BY_ID[card.definitionId];
        return Boolean(definition && definition.basePower <= 3 && canPlayAttack(state.core, '0', definition).valid);
    };
    const insertedCardIds: string[] = [];
    let projectedCore = state.core;
    let candidateCount = fateRidingCandidates(projectedCore, '0').length;
    while (candidateCount < minimum) {
        const deckIndex = deck.findIndex(isCandidate);
        const handIndex = hand.findIndex(card => !isCandidate(card));
        if (deckIndex < 0 || handIndex < 0) {
            throw new Error(`固定骑乘场景无法凑足 ${minimum} 个合法选项：已有 ${candidateCount} 个，手牌 ${hand.map((card: any) => card.definitionId).join(',')}，牌库 ${deck.map((card: any) => card.definitionId).join(',')}`);
        }
        const incoming = deck[deckIndex];
        const outgoing = hand[handIndex];
        hand[handIndex] = incoming;
        deck[deckIndex] = outgoing;
        insertedCardIds.push(incoming.id);
        projectedCore = { ...state.core, players: { ...state.core.players, '0': { ...player, hand, deck } } };
        candidateCount = fateRidingCandidates(projectedCore, '0').length;
    }
    const allIds = [...hand, ...deck].map((card: any) => card.id);
    if (new Set(allIds).size !== allIds.length) throw new Error('三张上限场景夹具产生重复卡牌实例');
    if (insertedCardIds.length) {
        await page.evaluate(async zones => {
            const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
            if (!harness?.state?.patch) throw new Error('Fate TestHarness state.patch 未注册');
            await harness.state.patch({ core: { players: { '0': zones } } });
        }, { hand, deck });
    }
    const updated = await readState(page);
    const confirmedCount = fateRidingCandidates(updated.core, '0').length;
    if (confirmedCount < minimum) throw new Error(`固定牌区夹具补入 ${insertedCardIds.join(',')} 后仅有 ${confirmedCount} 个合法骑乘选项`);
    return { insertedCardIds, candidateCount: confirmedCount, handCount: hand.length, deckCount: deck.length };
}

async function waitForState(page: Page, predicate: (state: HarnessState) => boolean, message: string) {
    await expect.poll(async () => predicate(await readState(page)), { message, timeout: 15000 }).toBe(true);
}

async function mouseClickAriaDisabledCard(page: Page, cardId: string) {
    const card = page.locator(`[data-card-id="${cardId}"]`);
    const box = await card.boundingBox();
    if (!box) throw new Error(`不可选手牌 ${cardId} 不在真实手牌 UI 中`);
    // These controls use aria-disabled so the app can explain eligibility. Send a real
    // browser pointer click; Playwright's locator.click() intentionally refuses aria-disabled.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function snapshot(page: Page): Promise<Snapshot> {
    const state = await readState(page);
    const player = state.core.players['0'];
    const visible = await page.evaluate(() => {
        const choice = document.querySelector('[data-testid="fate-riding-controls"]');
        const confirm = document.querySelector<HTMLButtonElement>('[data-testid="fate-riding-confirm"]');
        const selectedCards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-card-id][aria-pressed="true"]'))
            .map(card => card.dataset.cardId ?? '')
            .filter(Boolean);
        return {
            phaseText: document.querySelector('.fd-runtime-round')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            ridingCostPreview: document.querySelector('[data-testid="fate-riding-controls"] .fd-riding-status')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            ridingCostAccessibleLabel: document.querySelector('[data-testid="fate-riding-controls"] .fd-riding-status')?.getAttribute('aria-label') ?? '',
            choiceVisible: Boolean(choice),
            selectedCards,
            confirmText: confirm?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            confirmDisabled: confirm?.disabled ?? null,
            currentPrimary: document.querySelector('[data-testid="fate-domination-primary-action"]')?.getAttribute('aria-label') ?? '',
        };
    });
    const activeRidingFrames = (state.sys.resolution?.frames ?? [])
        .filter((frame: any) => frame.kind === 'fate:riding-choice')
        .map((frame: any) => ({ id: frame.id, phase: frame.phase }));
    return {
        visible,
        authoritative: {
            phase: state.core.phase,
            currentPlayerId: state.core.currentPlayerId,
            round: state.core.round,
            mana: player.mana,
            handIds: player.hand.map((card: any) => card.id),
            activeAttackIds: [...player.activeAttackIds],
            selectedAttackIds: [...player.selectedAttackIds],
            activeSkills: [...player.activeSkills],
            normalAttackPlayed: player.normalAttackPlayed,
            usedAbilityIds: [...player.usedAbilityIds],
            interactionId: state.sys.interaction.current?.id ?? null,
            interactionSourceId: state.sys.interaction.current?.data?.sourceId ?? null,
            activeFrameId: state.sys.resolution?.activeFrameId ?? null,
            activeRidingFrames,
            opponentHandDetailsRecorded: false,
        },
    };
}

function step(id: string, action: string, before: Snapshot, after: Snapshot, assertions: TraceStep['assertions']): TraceStep {
    return { id, action, before, after, assertions };
}

function assertion(name: string, actual: unknown, expected: unknown) {
    expect(actual, `trace assertion: ${name}`).toEqual(expected);
    return { name, actual, expected };
}

async function prepareRidingAction(page: Page, baseURL: string | undefined, seed: string, scenarioDefinitionId?: string) {
    await page.goto(`${baseURL ?? ''}/play/fate-domination?players=3&playerID=0&seed=${encodeURIComponent(seed)}&disableLocalAiAutomation=true`, {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.() === true && harness?.command?.isRegistered?.() === true;
    }, undefined, { timeout: 20000 });
    await expect(page.getByTestId('fate-domination-board')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('region', { name: '选择御主与从者' })).toBeVisible();
    const identitySetup = page.getByRole('region', { name: '选择御主与从者' });
    await identitySetup.locator('select').nth(0).selectOption('m_waver');
    await identitySetup.locator('select').nth(1).selectOption('servant-rider');
    await page.getByTestId('fate-domination-primary-action').click();
    await waitForState(page, state => state.core.phase === 'preparation' && state.core.currentPlayerId === '1', '等待韦伯完成准备后转到下一席');

    // Other seats only complete entry setup. The Rider interaction and its results below stay on the visible UI path.
    await dispatch(page, 'ADVANCE_PHASE', '1');
    await waitForState(page, state => state.core.currentPlayerId === '2' && state.core.phase === 'preparation', '等待第二席完成准备');
    await dispatch(page, 'ADVANCE_PHASE', '2');
    await waitForState(page, state => state.core.currentPlayerId === '0' && state.core.phase === 'outpost', '等待前哨阶段开始');

    await page.getByTestId('fate-domination-location-workshop').click();
    await waitForState(page, state => state.core.players['0'].locationId === 'workshop', '等待韦伯部署工房');
    await page.getByRole('button', { name: /查看玩家\s*1详情/ }).click();
    await expect(page.getByRole('dialog', { name: '韦伯·维尔维特详情' })).toBeVisible();
    const handBeforeMasterAbility = (await readState(page)).core.players['0'].hand.length;
    await page.getByRole('button', { name: '发动战略部署' }).click();
    await waitForState(page, state => state.core.players['0'].hand.length >= handBeforeMasterAbility + 2, '等待战略部署抽取两张手牌');
    await page.getByTestId('fate-domination-primary-action').click();
    await waitForState(page, state => state.core.phase === 'outpost' && state.core.currentPlayerId === '1', '等待韦伯结束前哨阶段');
    await dispatch(page, 'DEPLOY_MASTER', '1', { locationId: 'workshop' });
    await dispatch(page, 'ADVANCE_PHASE', '1');
    await waitForState(page, state => state.core.phase === 'outpost' && state.core.currentPlayerId === '2', '等待第二席完成前哨阶段');
    await dispatch(page, 'DEPLOY_MASTER', '2', { locationId: 'workshop' });
    await dispatch(page, 'ADVANCE_PHASE', '2');
    await waitForState(page, state => state.core.phase === 'action' && state.core.currentPlayerId === '0', '等待本人行动阶段');

    await page.getByRole('button', { name: '使用令咒' }).click();
    await expect(page.getByRole('dialog', { name: '使用令咒' })).toBeVisible();
    await page.getByRole('button', { name: '恢复魔力' }).click();
    await page.getByRole('button', { name: '确认使用' }).click();
    await waitForState(page, state => state.core.players['0'].mana >= 8, '以实际令咒恢复魔力后满足常规技能攻击需求');

    if (scenarioDefinitionId) await ensureDefinitionInHandScenario(page, scenarioDefinitionId);
    const beforeAttack = await readState(page);
    const riderSkillId = beforeAttack.core.players['0'].skills.find((skill: any) => skill.id.split(':')[0] === 'sc_iskandar_1')?.id;
    const partner = beforeAttack.core.players['0'].hand.find((card: any) => card.definitionId === 'cardB2');
    if (!riderSkillId || !partner) throw new Error(`种子 ${seed} 未提供骑乘与力量基础攻击组合`);
    await page.getByRole('button', { name: '选择 骑乘' }).click();
    await page.locator(`[data-card-id="${partner.id}"]`).click();
    await expect(page.getByTestId('fate-domination-primary-action')).toHaveAttribute('aria-label', '确认攻击');
    await page.getByTestId('fate-domination-primary-action').click();
    await waitForState(page, state => state.core.players['0'].normalAttackPlayed
        && state.core.players['0'].activeSkills.includes(riderSkillId)
        && state.core.players['0'].hand.some((card: any) => card.id === beforeAttack.core.players['0'].deck[0]?.id),
    '等待常规攻击结算及骑乘同批基础攻击抽牌');
    const settled = await readState(page);
    if (settled.core.players['0'].deck.length !== beforeAttack.core.players['0'].deck.length - 1) {
        throw new Error('常规攻击后没有从真实牌库顶抽一张牌');
    }
    const riderActive = page.getByRole('button', { name: '发动 骑乘' });
    await expect(riderActive).toBeVisible();
    await expect(riderActive).not.toHaveAttribute('aria-disabled', 'true');
    return { riderSkillId, partnerId: partner.id };
}

async function openRidingChoice(page: Page) {
    await page.getByRole('button', { name: '发动 骑乘' }).click();
    await expect(page.getByTestId('fate-riding-controls')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fate-riding-confirm')).toBeVisible();
    return readState(page);
}

async function captureUniqueState(page: Page, testInfo: TestInfo, name: string) {
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const imagePath = getEvidenceScreenshotPathInDirectory(run.stagingDir, `${name}.png`, { requireChineseName: true });
    await mkdir(path.dirname(imagePath), { recursive: true });
    await page.screenshot({ path: imagePath, fullPage: false, animations: 'disabled' });
    // Promotion happens in writeBehaviorEvidence after the trace records the final source id.
    return { run, imagePath };
}

async function finalizeCapturedEvidence(
    testInfo: TestInfo,
    captured: Awaited<ReturnType<typeof captureUniqueState>>,
    chainId: string,
    steps: TraceStep[],
    stateId: string,
    behaviorStepId: string,
    requirement: string,
    outcome: string,
) {
    const revision = sourceRevision();
    const screenshotSha = createHash('sha256').update(readFileSync(captured.imagePath)).digest('hex');
    const promotedImagePath = path.join(captured.run.stableDir, path.basename(captured.imagePath));
    const uiStates = [{ id: stateId, stepId: behaviorStepId, change: 'interaction-mode', viewport: 'desktop', sha256: screenshotSha }];
    const trace = {
        gameId: GAME_ID,
        evidenceCategory: EVIDENCE_CATEGORY,
        chainId,
        sourceRun: captured.run.runId,
        sourceRevision: revision,
        status: 'PASS',
        outcome,
        steps,
        uiStates,
    };
    const traceDir = path.join(OUTPUT_DIR, 'behavior');
    await mkdir(traceDir, { recursive: true });
    const tracePath = path.join(traceDir, `${chainId}.json`);
    await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
    await promoteEvidenceScreenshotRun(captured.run, {
        gameId: GAME_ID,
        evidenceCategory: EVIDENCE_CATEGORY,
        capturePolicy: 'distinct-ui-state',
        media: [{
            path: path.relative(process.cwd(), promotedImagePath).replace(/\\/g, '/'),
            chainId,
            chainStep: '01',
            stage: '独特界面态',
            role: 'main-flow',
            viewport: 'desktop',
            transition: '玩家在正式手牌上开启并操作骑乘选择',
            description: stateId === 'riding-three-selected'
                ? '三张手牌已选满且其余候选牌不可再选'
                : stateId === 'riding-one-selected'
                    ? '一张手牌被选中并显示批次实付魔力'
                        : '行动阶段手牌进入骑乘选牌模式',
            uiStateId: stateId,
            uiChange: 'interaction-mode',
            uiChangeReason: stateId === 'riding-three-selected'
                ? '玩家已选满三张，余下候选牌不再接受选择'
                : stateId === 'riding-one-selected'
                    ? '手牌本体呈现已选中牌及本批实际费用'
                        : '行动阶段激活骑乘后，手牌切换为专用多选模式',
            behaviorStepId,
            sourceRevision: revision,
            requirements: [requirement],
        }],
    });
    return { runId: captured.run.runId, revision, tracePath, screenshotPath: path.relative(process.cwd(), promotedImagePath).replace(/\\/g, '/'), screenshotSha };
}

async function finalizeBehaviorOnlyEvidence(
    chainId: string,
    steps: TraceStep[],
    outcome: string,
) {
    const revision = sourceRevision();
    const runId = `${Date.now()}-${process.pid}-${randomUUID()}`;
    const trace = {
        gameId: GAME_ID,
        evidenceCategory: EVIDENCE_CATEGORY,
        chainId,
        sourceRun: runId,
        sourceRevision: revision,
        status: 'PASS',
        outcome,
        steps,
        uiStates: [],
    };
    const traceDir = path.join(OUTPUT_DIR, 'behavior');
    await mkdir(traceDir, { recursive: true });
    const tracePath = path.join(traceDir, `${chainId}.json`);
    await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
    return { runId, revision, tracePath };
}

test.describe('伊斯坎达尔骑乘独立交互链', () => {
    test('骑乘选择取消后可重开并确认零张', async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(180000);
        await initContext(context, { skipImageGate: false });
        const diagnostics = attachPageDiagnostics(page, 'fate-riding-zero-cancel');
        await prepareRidingAction(page, baseURL, 'iskandar-riding-ui-0');
        const beforeOpen = await snapshot(page);
        await openRidingChoice(page);
        const openState = await snapshot(page);
        expect(openState.authoritative.interactionSourceId).toBe('fate:riding-choice');
        const captured = await captureUniqueState(page, testInfo, '骑乘选择打开');
        const steps: TraceStep[] = [step('open-choice', '在已激活的骑乘技能上点击发动', beforeOpen, openState, [assertion('choice-visible', openState.visible.choiceVisible, true), assertion('riding-interaction-open', openState.authoritative.interactionSourceId, 'fate:riding-choice')])];

        const candidateId = openState.authoritative.handIds && (await readState(page)).sys.interaction.current.data.options.find((option: any) => option.id.includes('Surveil'))?.id;
        if (typeof candidateId !== 'string') throw new Error('种子1没有费用手牌 Surveil');
        const beforeStage = await snapshot(page);
        await page.locator(`[data-card-id="${candidateId}"]`).click();
        await expect(page.locator(`[data-card-id="${candidateId}"]`)).toHaveAttribute('aria-pressed', 'true');
        const staged = await snapshot(page);
        expect(staged.visible.selectedCards).toContain(candidateId);
        steps.push(step('stage-card-before-cancel', '暂选 Surveil 以验证取消会撤销未提交选择', beforeStage, staged, [
            assertion('candidate-staged-before-cancel', staged.visible.selectedCards, [candidateId]),
            assertion('mana-still-unpaid', staged.authoritative.mana, beforeStage.authoritative.mana),
            assertion('ability-still-unused', staged.authoritative.usedAbilityIds, beforeStage.authoritative.usedAbilityIds),
            assertion('card-not-committed', staged.authoritative.activeAttackIds, beforeStage.authoritative.activeAttackIds),
        ]));
        const beforeCancel = staged;
        await page.getByTestId('fate-riding-cancel').click();
        await expect(page.getByTestId('fate-riding-controls')).toHaveCount(0);
        const afterCancel = await snapshot(page);
        expect(afterCancel.authoritative.usedAbilityIds).toEqual(beforeCancel.authoritative.usedAbilityIds);
        expect(afterCancel.authoritative.mana).toBe(beforeCancel.authoritative.mana);
        expect(afterCancel.authoritative.activeAttackIds).toEqual(beforeCancel.authoritative.activeAttackIds);
        expect(afterCancel.authoritative.activeFrameId).toBeNull();
        steps.push(step('cancel-choice', '暂选一张后点击取消骑乘', beforeCancel, afterCancel, [
            assertion('cancel-clears-interaction', afterCancel.visible.choiceVisible, false),
            assertion('cancel-clears-selection', afterCancel.visible.selectedCards, []),
            assertion('cancel-preserves-mana', afterCancel.authoritative.mana, beforeCancel.authoritative.mana),
            assertion('cancel-preserves-used-abilities', afterCancel.authoritative.usedAbilityIds, beforeCancel.authoritative.usedAbilityIds),
            assertion('cancel-preserves-committed-attacks', afterCancel.authoritative.activeAttackIds, beforeCancel.authoritative.activeAttackIds),
            assertion('cancel-clears-frame', afterCancel.authoritative.activeFrameId, null),
        ]));

        await openRidingChoice(page);
        const reopened = await snapshot(page);
        expect(reopened.visible.selectedCards).toEqual([]);
        steps.push(step('reopen-choice', '再次发动骑乘检查事务选择清空', afterCancel, reopened, [
            assertion('reopened-selection-is-empty', reopened.visible.selectedCards, []),
            assertion('reopened-choice-visible', reopened.visible.choiceVisible, true),
        ]));
        const beforeConfirm = await snapshot(page);
        await page.getByTestId('fate-riding-confirm').click();
        await expect(page.getByTestId('fate-riding-controls')).toHaveCount(0);
        const afterConfirm = await snapshot(page);
        const ridingSkillId = beforeConfirm.authoritative.activeSkills.find((id: string) => id.startsWith('sc_iskandar_1:'));
        expect(typeof ridingSkillId).toBe('string');
        const ridingUsageKey = `${ridingSkillId}:action`;
        expect(afterConfirm.authoritative.activeAttackIds).toEqual(beforeConfirm.authoritative.activeAttackIds);
        expect(afterConfirm.authoritative.mana).toBe(beforeConfirm.authoritative.mana);
        expect(afterConfirm.authoritative.usedAbilityIds.filter((id: string) => id === ridingUsageKey)).toHaveLength(1);
        expect(afterConfirm.authoritative.phase).toBe('action');
        expect(afterConfirm.authoritative.currentPlayerId).toBe('0');
        expect(afterConfirm.authoritative.normalAttackPlayed).toBe(true);
        expect(afterConfirm.authoritative.activeRidingFrames).toEqual([]);
        expect(afterConfirm.visible.currentPrimary).toContain('结束行动');
        const useAgain = page.getByRole('button', { name: '发动 骑乘' });
        await expect(useAgain).toHaveAttribute('aria-disabled', 'true');
        steps.push(step('confirm-zero', '点击确认打出零张并检查行动仍开放', beforeConfirm, afterConfirm, [
            assertion('zero-cards-committed', afterConfirm.authoritative.activeAttackIds.length - beforeConfirm.authoritative.activeAttackIds.length, 0),
            assertion('ability-used-once', afterConfirm.authoritative.usedAbilityIds.filter((id: string) => id === ridingUsageKey).length, 1),
            assertion('action-remains-open', `${afterConfirm.authoritative.phase}:${afterConfirm.authoritative.currentPlayerId}`, 'action:0'),
            assertion('no-riding-frame-remains', afterConfirm.authoritative.activeRidingFrames, []),
        ]));
        await finalizeCapturedEvidence(testInfo, captured, 'iskandar-riding-zero-cancel', steps, 'riding-open', 'open-choice', '骑乘确认零张', '取消仅关闭暂存事务；重开后零张确认正式使用一次骑乘，行动阶段继续且没有残留交互。');
        await assertNoFatalFrontendErrors([{ label: 'fate-riding-zero-cancel', diagnostics }]);
    });

    test('骑乘单张按印刷魔耗结算且不结束行动', async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(180000);
        await initContext(context, { skipImageGate: false });
        const diagnostics = attachPageDiagnostics(page, 'fate-riding-one-card');
        await prepareRidingAction(page, baseURL, 'iskandar-riding-ui-0');
        const beforeOpen = await snapshot(page);
        await openRidingChoice(page);
        const state = await readState(page);
        const opened = await snapshot(page);
        const candidates = state.sys.interaction.current.data.options.map((option: any) => option.id);
        const highPowerIds = state.core.players['0'].hand.filter((card: any) => (FATE_ATTACK_BY_ID[card.definitionId]?.basePower ?? 99) > 3).map((card: any) => card.id);
        expect(highPowerIds.length).toBeGreaterThan(0);
        const highPowerObservations = [] as Array<{ id: string; ariaDisabled: string | null; selected: boolean }>;
        for (const id of highPowerIds) {
            const card = page.locator(`[data-card-id="${id}"]`);
            await expect(card).toHaveAttribute('aria-disabled', 'true');
            await mouseClickAriaDisabledCard(page, id);
            await expect(card).not.toHaveAttribute('aria-pressed', 'true');
            highPowerObservations.push({
                id,
                ariaDisabled: await card.getAttribute('aria-disabled'),
                selected: (await card.getAttribute('aria-pressed')) === 'true',
            });
        }
        const afterEligibilityChecks = await snapshot(page);
        expect(afterEligibilityChecks.visible.selectedCards).toEqual([]);
        const paidId = state.core.players['0'].hand.find((card: any) => card.definitionId === 'cardSurveil')?.id;
        if (!paidId || !candidates.includes(paidId)) throw new Error('种子1没有可选的 Surveil 费用牌');
        const printedCost = FATE_ATTACK_BY_ID.cardSurveil.manaCost;
        const beforeSelect = await snapshot(page);
        await page.locator(`[data-card-id="${paidId}"]`).click();
        await expect(page.locator(`[data-card-id="${paidId}"]`)).toHaveAttribute('aria-pressed', 'true');
        const selected = await snapshot(page);
        expect(selected.visible.confirmText).toContain('1');
        const captured = await captureUniqueState(page, testInfo, '骑乘单张费用牌');
        const beforeCommit = await snapshot(page);
        await page.getByTestId('fate-riding-confirm').click();
        await expect(page.getByTestId('fate-riding-controls')).toHaveCount(0);
        await waitForState(page, value => value.core.players['0'].activeAttackIds.includes(paidId), '等待骑乘单张正式打出');
        const committed = await snapshot(page);
        expect(committed.authoritative.mana).toBe(beforeCommit.authoritative.mana - printedCost);
        expect(committed.authoritative.normalAttackPlayed).toBe(true);
        expect(committed.authoritative.phase).toBe('action');
        expect(committed.authoritative.currentPlayerId).toBe('0');
        expect(committed.authoritative.activeRidingFrames).toEqual([]);
        expect(committed.visible.currentPrimary).toContain('结束行动');
        const expectedRidingCostPreview = `已选 1/3 · 实付 ${printedCost}/${beforeSelect.authoritative.mana} 魔力`;
        const expectedRidingCostAccessibleLabel = `坐骑召唤 · 已选 1 张（最多 3 张）· 实付 ${printedCost} / ${beforeSelect.authoritative.mana} 魔力 · 本次选牌固定明置`;
        const expectedHighPowerObservations = highPowerIds.map((id: string) => ({ id, ariaDisabled: 'true', selected: false }));
        const steps = [
            step('open-choice', '发动骑乘并检查高威力牌不能选', beforeOpen, afterEligibilityChecks, [
                assertion('choice-visible', afterEligibilityChecks.visible.choiceVisible, true),
                assertion('riding-interaction-open', opened.authoritative.interactionSourceId, 'fate:riding-choice'),
                assertion('high-power-candidates-remain-disabled', highPowerObservations, expectedHighPowerObservations),
                assertion('eligibility-check-leaves-empty-selection', afterEligibilityChecks.visible.selectedCards, []),
            ]),
            step('select-paid-card', '从本人手牌点击一张印刷费用牌', beforeSelect, selected, [
                assertion('one-card-selected', selected.visible.selectedCards.length, 1),
                assertion('visible-printed-cost-preview', selected.visible.ridingCostPreview, expectedRidingCostPreview),
                assertion('printed-cost-preview-accessible-label', selected.visible.ridingCostAccessibleLabel, expectedRidingCostAccessibleLabel),
                assertion('confirm-button-count', selected.visible.confirmText, '确认打出（1）'),
            ]),
            step('confirm-paid-card', '确认后按印刷魔耗支付并明置打出', beforeCommit, committed, [
                assertion('exact-printed-cost-paid', beforeCommit.authoritative.mana - committed.authoritative.mana, printedCost),
                assertion('card-committed', committed.authoritative.activeAttackIds.includes(paidId), true),
                assertion('action-remains-open', `${committed.authoritative.phase}:${committed.authoritative.currentPlayerId}`, 'action:0'),
                assertion('no-riding-frame-remains', committed.authoritative.activeRidingFrames, []),
            ]),
        ];
        await finalizeCapturedEvidence(testInfo, captured, 'iskandar-riding-one-card', steps, 'riding-one-selected', 'select-paid-card', '骑乘一张费用牌', '高威力候选保持不可选；确认单张 Surveil 后扣除其印刷魔耗并明置打出，行动阶段与常规攻击额度不变。');
        await assertNoFatalFrontendErrors([{ label: 'fate-riding-one-card', diagnostics }]);
    });

    test('骑乘三张上限：固定合法牌区场景拒绝第四张（不代表自然抽牌流程）', async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(180000);
        await initContext(context, { skipImageGate: false });
        const diagnostics = attachPageDiagnostics(page, 'fate-riding-three-limit');
        await prepareRidingAction(page, baseURL, 'iskandar-riding-ui-23', 'cardB2');
        const scenarioCard = await ensureDefinitionInHandScenario(page, 'cardB2');
        const candidateFixture = await ensureRidingCandidateCountScenario(page, 4);
        testInfo.annotations.push({ type: 'scenario-fixture', description: `合法固定牌区：先用官方 cardB2 完成常规骑乘搭档攻击；骑乘上限前保证 ${scenarioCard.cardId} 和 ${candidateFixture.insertedCardIds.join(',') || '现有合法选项'} 在手牌并至少有 4 个可选目标。仅在手牌与牌库间交换正式牌实例，维持牌表、实例唯一和各区数量，不主张该组合由自然抽牌产生。` });
        await waitForState(page, state => state.core.players['0'].hand.some((card: any) => card.id === scenarioCard.cardId), '等待合法骑乘场景牌进入手牌');
        const beforeOpen = await snapshot(page);
        await openRidingChoice(page);
        const open = await snapshot(page);
        const before = await readState(page);
        const optionIds: string[] = before.sys.interaction.current.data.options.map((option: any) => option.id);
        expect(optionIds.length).toBeGreaterThanOrEqual(4);
        const selectedIds = optionIds.slice(0, 3);
        for (const id of selectedIds) {
            await page.locator(`[data-card-id="${id}"]`).click();
        }
        await expect(page.locator('[data-card-id][aria-pressed="true"]')).toHaveCount(3);
        const fourth = page.locator(`[data-card-id="${optionIds[3]}"]`);
        await expect(fourth).toHaveAttribute('aria-disabled', 'true');
        const full = await snapshot(page);
        const captured = await captureUniqueState(page, testInfo, '骑乘三张已选满');
        await mouseClickAriaDisabledCard(page, optionIds[3]);
        await expect(page.locator('[data-card-id][aria-pressed="true"]')).toHaveCount(3);
        const afterFourthAttempt = await snapshot(page);
        expect(afterFourthAttempt.visible.selectedCards).toEqual(full.visible.selectedCards);
        const beforeCommit = await snapshot(page);
        const cost = selectedIds.reduce((sum, id) => {
            const card = before.core.players['0'].hand.find((candidate: any) => candidate.id === id);
            return sum + (card ? FATE_ATTACK_BY_ID[card.definitionId]?.manaCost ?? 0 : 0);
        }, 0);
        await page.getByTestId('fate-riding-confirm').click();
        await waitForState(page, state => selectedIds.every(id => state.core.players['0'].activeAttackIds.includes(id)), '等待三张骑乘牌结算');
        const committed = await snapshot(page);
        expect(committed.authoritative.mana).toBe(beforeCommit.authoritative.mana - cost);
        expect(committed.authoritative.activeAttackIds.filter((id: string) => selectedIds.includes(id))).toHaveLength(3);
        expect(committed.authoritative.normalAttackPlayed).toBe(true);
        expect(committed.authoritative.phase).toBe('action');
        expect(committed.authoritative.currentPlayerId).toBe('0');
        expect(committed.authoritative.activeRidingFrames).toEqual([]);
        const steps = [
            step('open-choice', '在本人手牌区打开骑乘选择', beforeOpen, open, [
                assertion('four-or-more-candidates', optionIds.length >= 4, true),
                assertion('choice-visible', open.visible.choiceVisible, true),
                assertion('riding-interaction-open', open.authoritative.interactionSourceId, 'fate:riding-choice'),
            ]),
            step('select-three-cards', '依次点击三张合法低威力候选牌', open, full, [
                assertion('three-cards-selected', full.visible.selectedCards.length, 3),
                assertion('selected-candidate-ids', [...full.visible.selectedCards].sort(), [...selectedIds].sort()),
                assertion('fourth-disabled', await fourth.getAttribute('aria-disabled'), 'true'),
            ]),
            step('attempt-fourth-card', '达到三张上限后尝试选择第四张', full, afterFourthAttempt, [
                assertion('selection-stays-at-three', afterFourthAttempt.visible.selectedCards.length, 3),
                assertion('selection-does-not-change', afterFourthAttempt.visible.selectedCards, full.visible.selectedCards),
                assertion('fourth-stays-disabled', await fourth.getAttribute('aria-disabled'), 'true'),
                assertion('mana-does-not-change-before-confirm', afterFourthAttempt.authoritative.mana, full.authoritative.mana),
            ]),
            step('confirm-three-cards', '确认三张并按印刷费用结算', beforeCommit, committed, [
                assertion('exact-batch-cost-paid', beforeCommit.authoritative.mana - committed.authoritative.mana, cost),
                assertion('three-cards-committed', committed.authoritative.activeAttackIds.filter((id: string) => selectedIds.includes(id)).length, 3),
                assertion('action-remains-open', `${committed.authoritative.phase}:${committed.authoritative.currentPlayerId}`, 'action:0'),
                assertion('no-riding-frame-remains', committed.authoritative.activeRidingFrames, []),
            ]),
        ];
        await finalizeCapturedEvidence(testInfo, captured, 'iskandar-riding-three-limit', steps, 'riding-three-selected', 'select-three-cards', '骑乘三张上限', '正式手牌里三张合法牌可选；达到上限后第四张不能加入，确认仅结算三张并扣除实际印刷费用。');
        await assertNoFatalFrontendErrors([{ label: 'fate-riding-three-limit', diagnostics }]);
    });

    test('骑乘魔力不足时拒绝费用牌且取消不消费能力', async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(180000);
        await initContext(context, { skipImageGate: false });
        const diagnostics = attachPageDiagnostics(page, 'fate-riding-unaffordable');
        await prepareRidingAction(page, baseURL, 'iskandar-riding-ui-0');
        const beforeInjection = await snapshot(page);
        await patchOwnMana(page, 0);
        await waitForState(page, state => state.core.players['0'].mana === 0, '仅在常规攻击已结算后构造本人低魔力代表态');
        const beforeOpen = await snapshot(page);
        await openRidingChoice(page);
        const open = await readState(page);
        const openSnapshot = await snapshot(page);
        const paidId = open.core.players['0'].hand.find((card: any) => card.definitionId === 'cardSurveil')?.id;
        if (!paidId) throw new Error('种子1没有 Surveil 费用牌');
        const candidate = page.locator(`[data-card-id="${paidId}"]`);
        await expect(candidate).toHaveAttribute('aria-disabled', 'true');
        const beforeAttempt = await snapshot(page);
        await mouseClickAriaDisabledCard(page, paidId);
        await expect(candidate).not.toHaveAttribute('aria-pressed', 'true');
        const afterAttempt = await snapshot(page);
        expect(afterAttempt.authoritative.mana).toBe(0);
        expect(afterAttempt.authoritative.activeAttackIds).toEqual(beforeOpen.authoritative.activeAttackIds);
        const beforeCancel = afterAttempt;
        await page.getByTestId('fate-riding-cancel').click();
        await expect(page.getByTestId('fate-riding-controls')).toHaveCount(0);
        const afterCancel = await snapshot(page);
        expect(afterCancel.authoritative.usedAbilityIds).toEqual(beforeInjection.authoritative.usedAbilityIds);
        expect(afterCancel.authoritative.mana).toBe(0);
        expect(afterCancel.authoritative.activeAttackIds).toEqual(beforeInjection.authoritative.activeAttackIds);
        const steps = [
            step('settle-low-resource-precondition', '常规攻击结算后用测试注入置零本人魔力', beforeInjection, beforeOpen, [
                assertion('mana-injected-to-zero', beforeOpen.authoritative.mana, 0),
            ]),
            step('open-low-resource-choice', '在低魔力状态打开骑乘选牌', beforeOpen, openSnapshot, [
                assertion('choice-visible', openSnapshot.visible.choiceVisible, true),
                assertion('riding-interaction-open', openSnapshot.authoritative.interactionSourceId, 'fate:riding-choice'),
                assertion('own-mana-zero', openSnapshot.authoritative.mana, 0),
            ]),
            step('reject-unaffordable-card', '点击费用高于当前魔力的牌', beforeAttempt, afterAttempt, [
                assertion('candidate-disabled', await candidate.getAttribute('aria-disabled'), 'true'),
                assertion('card-not-selected', afterAttempt.visible.selectedCards.includes(paidId), false),
                assertion('mana-not-changed', afterAttempt.authoritative.mana, beforeAttempt.authoritative.mana),
                assertion('active-attacks-not-changed', afterAttempt.authoritative.activeAttackIds, beforeAttempt.authoritative.activeAttackIds),
                assertion('ability-not-consumed-before-confirm', afterAttempt.authoritative.usedAbilityIds, beforeAttempt.authoritative.usedAbilityIds),
            ]),
            step('cancel-unaffordable-choice', '取消低资源选择事务', beforeCancel, afterCancel, [
                assertion('cancel-does-not-consume-ability', afterCancel.authoritative.usedAbilityIds, beforeInjection.authoritative.usedAbilityIds),
                assertion('cancel-preserves-zero-mana', afterCancel.authoritative.mana, 0),
                assertion('cancel-clears-choice', afterCancel.visible.choiceVisible, false),
                assertion('cancel-clears-frame', afterCancel.authoritative.activeFrameId, null),
            ]),
        ];
        await finalizeBehaviorOnlyEvidence('iskandar-riding-unaffordable', steps, '在已结算攻击后的低魔力代表态中，费用牌的 aria-disabled 阻止选择；尝试不改牌区或魔力，取消后骑乘仍未消费。');
        await assertNoFatalFrontendErrors([{ label: 'fate-riding-unaffordable', diagnostics }]);
    });
});
