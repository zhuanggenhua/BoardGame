import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

async function saveEvidenceScreenshot(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string): Promise<void> {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
}

test('反馈 69c903：AI 计分交互前中后可读视觉回放', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 120000, polling: 200 },
    );

    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '1',
        phase: 'scoreBases',
        bases: [
            {
                defId: 'base_the_jungle',
                minions: [
                    { uid: 'ai-b0-king-rex', defId: 'dino_king_rex', owner: '1', controller: '1' },
                    { uid: 'human-b0-invader', defId: 'alien_invader', owner: '0', controller: '0' },
                ],
            },
            {
                defId: 'base_ninja_dojo',
                minions: [
                    { uid: 'ai-b1-king-rex', defId: 'dino_king_rex', owner: '1', controller: '1' },
                    { uid: 'human-b1-shinobi', defId: 'ninja_shinobi', owner: '0', controller: '0' },
                ],
            },
            {
                defId: 'base_pirate_cove',
                minions: [
                    { uid: 'ai-b2-king-rex', defId: 'dino_king_rex', owner: '1', controller: '1' },
                    { uid: 'human-b2-invader', defId: 'alien_invader', owner: '0', controller: '0' },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 8,
                scoringEligibleBaseIndices: [0, 1, 2],
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', difficulty: 'expert' },
                },
                players: {
                    '0': { id: '0', vp: 2, factions: ['ninjas', 'aliens'], hand: [], deck: [], discard: [] },
                    '1': { id: '1', vp: 3, factions: ['dinosaurs', 'wizards'], hand: [], deck: [], discard: [] },
                },
            },
        },
    });

    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.state.patch({
            core: {
                phase: 'scoreBases',
                currentPlayerIndex: 1,
                scoringEligibleBaseIndices: [0, 1, 2],
            },
            sys: {
                phase: 'scoreBases',
                turnOrder: ['0', '1'],
                currentPlayerIndex: 1,
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: null, history: [] },
            },
        });
    });
    await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.().sys?.phase)).toBe('scoreBases');
    await saveEvidenceScreenshot(page, testInfo, '01-前态-AI三基地计分锁定');

    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.state.patch({
            core: {
                phase: 'scoreBases',
                currentPlayerIndex: 0,
                scoringEligibleBaseIndices: [0, 1, 2],
            },
            sys: {
                phase: 'scoreBases',
                currentPlayerIndex: 0,
                interaction: {
                    current: {
                        id: 'feedback-69c903-visual-replay',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '选择先计分的基地',
                            sourceId: 'multi_base_scoring',
                            targetType: 'base',
                            aiPlayerId: '1',
                            options: [
                                { id: 'base-0', label: '丛林基地', value: { baseIndex: 0, baseDefId: 'base_the_jungle' }, displayMode: 'card' },
                                { id: 'base-1', label: '忍者道场', value: { baseIndex: 1, baseDefId: 'base_ninja_dojo' }, displayMode: 'card' },
                                { id: 'base-2', label: '海盗湾', value: { baseIndex: 2, baseDefId: 'base_pirate_cove' }, displayMode: 'card' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        });
    });
    await expect(page.getByText('选择先计分的基地')).toBeVisible();
    await saveEvidenceScreenshot(page, testInfo, '02-中态-AI选择先计分基地');

    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.state.patch({
            core: { phase: 'playCards', currentPlayerIndex: 0 },
            sys: {
                phase: 'playCards',
                currentPlayerIndex: 0,
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: null, history: [] },
                eventStream: {
                    entries: [{ id: 1, event: { type: 'SYS_INTERACTION_RESOLVED', payload: { interactionId: 'feedback-69c903-visual-replay', playerId: '1', optionId: 'base-0', sourceId: 'multi_base_scoring' }, timestamp: Date.now() } }],
                    nextId: 2,
                },
            },
        });
    });
    await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.().sys?.phase)).toBe('playCards');
    await expect(page.getByText('选择先计分的基地')).toHaveCount(0);
    await saveEvidenceScreenshot(page, testInfo, '03-后态-AI计分交互收口');
});
