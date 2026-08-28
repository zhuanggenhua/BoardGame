import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotDir,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import type { GameTestContext } from '../framework';
import { dragDiceThroneHandCardToPlay } from '../helpers/dicethrone';
import { ALL_TOKEN_DEFINITIONS } from '../../src/games/dicethrone/domain/characters';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import '../../src/games/dicethrone/domain';

type JsonRecord = Record<string, any>;

const CARD_ID = 'card-tianshi-divine-arbitration';

const CHOICE_STEPS = {
    dazzle: {
        customId: 'tianshi-divine-arbitration-dazzle',
        title: '神圣裁决：选择一名玩家获得眩光',
    },
    flight: {
        customId: 'tianshi-divine-arbitration-flight',
        title: '神圣裁决：选择一名玩家获得 2 个飞行',
    },
    purify: {
        customId: 'tianshi-divine-arbitration-purify',
        title: '神圣裁决：选择一名玩家获得净化',
    },
} as const;

async function saveStepScreenshot(
    page: Page,
    testInfo: TestInfo,
    name: string,
): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path,
        fullPage: false,
    }));
    console.log(`[E2E-SCREENSHOT] ${path}`);
    return path;
}

async function readChoiceTrace(game: GameTestContext): Promise<JsonRecord> {
    const state = await game.getState();
    const current = state?.sys?.interaction?.current;
    const options = Array.isArray(current?.data?.options) ? current.data.options : [];
    const eventEntries = state?.sys?.eventStream?.entries ?? [];
    const divineEvents = eventEntries
        .map((entry: JsonRecord) => entry?.event ?? entry)
        .filter((event: JsonRecord) => {
            const payload = JSON.stringify(event?.payload ?? {});
            return payload.includes(CARD_ID)
                || payload.includes('divine-arbitration')
                || payload.includes(TOKEN_IDS.DIVINE_ARRIVAL)
                || payload.includes(STATUS_IDS.DAZZLE)
                || payload.includes(TOKEN_IDS.FLIGHT)
                || payload.includes(TOKEN_IDS.PURIFY);
        })
        .map((event: JsonRecord) => ({
            type: event.type,
            sourceCommandType: event.sourceCommandType ?? null,
            payload: event.payload ?? null,
        }));

    return {
        phase: state?.sys?.phase ?? null,
        activePlayerId: state?.core?.activePlayerId ?? null,
        interaction: current ? {
            id: current.id ?? null,
            kind: current.kind ?? null,
            playerId: current.playerId ?? null,
            sourceId: current.sourceId ?? current.data?.sourceId ?? null,
            title: current.data?.title ?? current.data?.titleKey ?? null,
            options: options.map((option: JsonRecord) => ({
                id: option.id ?? null,
                label: option.label ?? option.labelKey ?? null,
                labelParams: option.labelParams ?? null,
                targetPlayerId: option.value?.targetPlayerId ?? option.targetPlayerId ?? null,
                customId: option.value?.customId ?? option.customId ?? null,
                value: option.value?.value ?? option.value ?? null,
                tokenGrantConfig: option.value?.tokenGrantConfig ?? option.tokenGrantConfig ?? null,
                statusGrantConfig: option.value?.statusGrantConfig ?? option.statusGrantConfig ?? null,
            })),
        } : null,
        players: {
            '0': {
                characterId: state?.core?.players?.['0']?.characterId ?? null,
                resources: state?.core?.players?.['0']?.resources ?? {},
                tokens: state?.core?.players?.['0']?.tokens ?? {},
                statusEffects: state?.core?.players?.['0']?.statusEffects ?? {},
            },
            '1': {
                characterId: state?.core?.players?.['1']?.characterId ?? null,
                resources: state?.core?.players?.['1']?.resources ?? {},
                tokens: state?.core?.players?.['1']?.tokens ?? {},
                statusEffects: state?.core?.players?.['1']?.statusEffects ?? {},
            },
        },
        divineEvents,
    };
}

async function expectCurrentChoice(
    page: Page,
    game: GameTestContext,
    step: (typeof CHOICE_STEPS)[keyof typeof CHOICE_STEPS],
): Promise<JsonRecord> {
    try {
        await expect(page.locator('#modal-root')).toContainText(step.title, { timeout: 10000 });
    } catch (error) {
        console.log(`[E2E-CHOICE-MISSING] ${JSON.stringify(await readChoiceTrace(game), null, 2)}`);
        throw error;
    }
    const choiceButtons = page.locator(`#modal-root button[data-choice-custom-id="${step.customId}"]`);
    await expect(choiceButtons).toHaveCount(2, { timeout: 10000 });
    await expect(choiceButtons.nth(0)).toHaveText(/^月精灵$/);
    await expect(choiceButtons.nth(1)).toHaveText(/^炽天使$/);

    const trace = await readChoiceTrace(game);
    expect(trace.interaction).toMatchObject({
        playerId: '1',
        options: [
            expect.objectContaining({
                id: 'option-0',
                label: 'choices.tianshi.player',
                labelParams: { player: 'characters.moon_elf' },
                targetPlayerId: '0',
                customId: step.customId,
            }),
            expect.objectContaining({
                id: 'option-1',
                label: 'choices.tianshi.player',
                labelParams: { player: 'characters.tianshi' },
                targetPlayerId: '1',
                customId: step.customId,
            }),
        ],
    });
    return trace;
}

async function clickChoiceOption(page: Page, customId: string, optionId: 'option-0' | 'option-1'): Promise<void> {
    const button = page.locator(`#modal-root button[data-choice-custom-id="${customId}"][data-option-id="${optionId}"]`);
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();
}

async function closeCardPreviewIfVisible(page: Page): Promise<void> {
    const closePreviewButton = page.getByRole('button', { name: /关闭预览|Close Preview/i }).last();
    if (!await closePreviewButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
    }
    await closePreviewButton.click();
    await expect(closePreviewButton).toBeHidden({ timeout: 5000 });
}

test.describe('DiceThrone 线上反馈 6a8f2efa 神圣裁决目标选择诊断', () => {
    test('玩家 1 视角应显示月精灵 / 炽天使按钮并验证目标落点', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('dicethrone', {
            playerID: '1',
            disableLocalAiAutomation: true,
            seat0: 'human',
            seat1: 'human',
            playerName0: '游客7587',
            playerName1: '游客7864',
        });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { [RESOURCE_IDS.CP]: 1, [RESOURCE_IDS.HP]: 40 },
                tokens: {},
            },
            player1: {
                hand: [CARD_ID],
                resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 48 },
                tokens: { [TOKEN_IDS.DIVINE_ARRIVAL]: 1 },
            },
            currentPlayer: '1',
            phase: 'main1',
            sys: {
                phase: 'main1',
                currentPlayerIndex: 1,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'tianshi' },
                hostStarted: true,
                activePlayerId: '1',
                currentPlayer: '1',
                currentPlayerIndex: 1,
                rollCount: 1,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                },
            },
        });

        await game.waitForPhase('main1', 10000);
        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-tianshi-divine-arbitration"]').first())
            .toBeVisible({ timeout: 10000 });

        const screenshots: string[] = [];
        const traces: JsonRecord[] = [];

        await dragDiceThroneHandCardToPlay(page, CARD_ID);
        await expect.poll(async () => {
            const state = await game.getState();
            const player1 = state?.core?.players?.['1'];
            return {
                handIds: player1?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: player1?.discard?.map((card: JsonRecord) => card.id) ?? [],
                cp: player1?.resources?.[RESOURCE_IDS.CP] ?? null,
                divineArrival: player1?.tokens?.[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: [CARD_ID],
            cp: 6,
            divineArrival: 2,
        });
        await closeCardPreviewIfVisible(page);
        console.log(`[E2E-AFTER-PLAY] ${JSON.stringify(await readChoiceTrace(game), null, 2)}`);

        traces.push({ step: '01-眩光选择前', trace: await expectCurrentChoice(page, game, CHOICE_STEPS.dazzle) });
        screenshots.push(await saveStepScreenshot(page, testInfo, '01-玩家1视角-神圣裁决眩光选择-按钮显示月精灵和炽天使'));

        await clickChoiceOption(page, CHOICE_STEPS.dazzle.customId, 'option-1');
        await expect.poll(async () => (await game.getState())?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0, { timeout: 10000 })
            .toBe(1);
        traces.push({ step: '02-飞行选择前', selectedBefore: '炽天使', trace: await expectCurrentChoice(page, game, CHOICE_STEPS.flight) });
        screenshots.push(await saveStepScreenshot(page, testInfo, '02-选择炽天使后-眩光落到自己-飞行仍显示角色名'));

        await clickChoiceOption(page, CHOICE_STEPS.flight.customId, 'option-0');
        await expect.poll(async () => (await game.getState())?.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0, { timeout: 10000 })
            .toBe(2);
        traces.push({ step: '03-净化选择前', selectedBefore: '月精灵', trace: await expectCurrentChoice(page, game, CHOICE_STEPS.purify) });
        screenshots.push(await saveStepScreenshot(page, testInfo, '03-选择月精灵后-飞行落到对手-净化仍显示角色名'));

        await clickChoiceOption(page, CHOICE_STEPS.purify.customId, 'option-0');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interaction: state?.sys?.interaction?.current ?? null,
                player0Flight: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.FLIGHT] ?? 0,
                player0Purify: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.PURIFY] ?? 0,
                player1Dazzle: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.DAZZLE] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            interaction: null,
            player0Flight: 2,
            player0Purify: 1,
            player1Dazzle: 1,
        });
        traces.push({ step: '04-三次选择后', selectedBefore: '月精灵', trace: await readChoiceTrace(game) });
        screenshots.push(await saveStepScreenshot(page, testInfo, '04-三次选择后-眩光在自己-飞行净化在对手'));

        const tracePath = join(getEvidenceScreenshotDir(testInfo), '神圣裁决目标选择轨迹.json');
        await mkdir(dirname(tracePath), { recursive: true });
        await writeFile(tracePath, JSON.stringify({ screenshots, traces }, null, 2), 'utf8');
        console.log(`[E2E-TRACE] ${tracePath}`);
    });
});
