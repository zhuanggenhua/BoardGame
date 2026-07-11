import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';

async function dragHandCardToPlay(page: any, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });

    const box = await handCard.boundingBox();
    if (!box) throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);

    const startX = box.x + (box.width / 2);
    const startY = box.y + (box.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function setupUnexpectedInteraction(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['card-unexpected'],
            resources: { CP: 10, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'cursed_pirate', '1': 'monk' },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 6, isKept: false },
                { id: 1, value: 6, isKept: false },
                { id: 2, value: 6, isKept: false },
                { id: 3, value: 5, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await game.waitForPhase('offensiveRoll', 10000);
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-unexpected'),
            diceCount: state?.core?.dice?.length ?? 0,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'offensiveRoll',
        activePlayerId: '0',
        hasCard: true,
        diceCount: 5,
    });
}

async function savePersistentEvidenceScreenshot(page: any, filename: string): Promise<string> {
    const evidenceDir = path.join(process.cwd(), 'test-results', 'evidence-screenshots', '_shared');
    await mkdir(evidenceDir, { recursive: true });
    const screenshotPath = path.join(evidenceDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    return screenshotPath;
}

test.describe('DiceThrone 意不意外交互', () => {
    test('咒缚海盗三个 6 应能用意不意外一次补成五个 6', async ({ page, game }) => {
        await setupUnexpectedInteraction(game);

        const unexpectedCard = page
            .locator('[data-card-id="card-unexpected"], [data-card-key^="card-unexpected-"]')
            .first();
        await expect(unexpectedCard).toBeVisible({ timeout: 5000 });
        await dragHandCardToPlay(page, 'card-unexpected');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                kind: interaction?.kind ?? null,
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
                mode: meta?.dieModifyConfig?.mode ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            kind: 'multistep-choice',
            dtType: 'modifyDie',
            selectCount: 2,
            mode: 'any',
        });

        await savePersistentEvidenceScreenshot(
            page,
            '王权骰铸-咒缚海盗-意不意外-双骰修改前.png',
        );

        const plusButtons = page.getByRole('button', { name: '+' });
        await expect(plusButtons).toHaveCount(5);
        await plusButtons.nth(3).click();
        await plusButtons.nth(4).click();
        await page.getByRole('button', { name: /确认|Confirm/i }).click();

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state?.core?.players?.['0'];
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-8);
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
                handIds: (player0?.hand ?? []).map((card: any) => card.id),
                discardIds: (player0?.discard ?? []).map((card: any) => card.id),
                eventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
            diceValues: [6, 6, 6, 6, 6],
            handIds: [],
        });

        const state = await game.getState();
        const player0 = state?.core?.players?.['0'];
        const lastEventTypes = (state?.sys?.eventStream?.entries ?? [])
            .slice(-8)
            .map((entry: any) => entry.event?.type);

        await savePersistentEvidenceScreenshot(
            page,
            '王权骰铸-咒缚海盗-意不意外-五个6确认后.png',
        );

        expect((state?.core?.dice ?? []).map((die: any) => die.value)).toEqual([6, 6, 6, 6, 6]);
        expect((player0?.hand ?? []).map((card: any) => card.id)).not.toContain('card-unexpected');
        expect((player0?.discard ?? []).map((card: any) => card.id)).toContain('card-unexpected');
        expect(lastEventTypes).toContain('CARD_PLAYED');
        expect(lastEventTypes).toContain('DIE_MODIFIED');
    });
});
