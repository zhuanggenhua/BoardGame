import { test, expect } from '../framework';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

const SMASHUP_TEST_QUERY = {
    p0: 'geeks,dragons',
    p1: 'aliens,pirates',
    skipFactionSelect: true,
} as const;

type PromptCardOption = {
    id: string;
    label: string;
    value: { defId: string };
    displayMode: 'card';
};

const CARD_LIBRARY: PromptCardOption[] = [
    { id: 'card-0', label: '收集者', value: { defId: 'alien_collector' }, displayMode: 'card' },
    { id: 'card-1', label: '急速闪电', value: { defId: 'wizard_zap' }, displayMode: 'card' },
    { id: 'card-2', label: '大副', value: { defId: 'pirate_first_mate' }, displayMode: 'card' },
    { id: 'card-3', label: '禁卡表', value: { defId: 'geeks_banned_list' }, displayMode: 'card' },
    { id: 'card-4', label: '菲丽希亚', value: { defId: 'geeks_felicia_day' }, displayMode: 'card' },
    { id: 'card-5', label: '恶棍', value: { defId: 'bear_cavalry' }, displayMode: 'card' },
    { id: 'card-6', label: '机器人阿尔法', value: { defId: 'robot_microbot_alpha' }, displayMode: 'card' },
    { id: 'card-7', label: '忍者侍从', value: { defId: 'ninja_apprentice' }, displayMode: 'card' },
    { id: 'card-8', label: '大脚怪', value: { defId: 'trickster_leprechaun' }, displayMode: 'card' },
    { id: 'card-9', label: '行尸', value: { defId: 'zombie_walker' }, displayMode: 'card' },
];

async function openPromptScene(game: any, page: any): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_TEST_QUERY, 90000);
    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['geeks', 'dragons'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['aliens', 'pirates'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        bases: [
            { defId: 'base_dragons_lair', minions: [] },
            { defId: 'base_converted_cave', minions: [] },
            { defId: 'base_tabletop', minions: [] },
        ],
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await hideSmashUpDebugPanelForEvidence(page);
}

async function injectCardPrompt(page: any, count: number): Promise<string> {
    const sourceId = `e2e_prompt_card_count_${count}`;
    const options = CARD_LIBRARY.slice(0, count);

    await page.evaluate(({ promptSourceId, promptOptions }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.patch) {
            throw new Error('TestHarness patch API 不可用');
        }

        harness.state.patch({
            sys: {
                phase: 'playCards',
                interaction: {
                    queue: [],
                    current: {
                        id: promptSourceId,
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: `E2E 验收：${promptOptions.length} 张卡牌选择`,
                            sourceId: promptSourceId,
                            targetType: 'generic',
                            options: promptOptions,
                        },
                    },
                },
            },
        });
    }, { promptSourceId: sourceId, promptOptions: options });

    return sourceId;
}

test.describe('大杀四方 - PromptOverlay 搜索框阈值截图', () => {
    test('1 张卡牌选择不应显示搜索框', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await openPromptScene(game, page);
        const sourceId = await injectCardPrompt(page, 1);
        await game.waitForInteraction(sourceId, 10000);
        const cardOptions = page.locator('[data-option-id][data-testid^="prompt-card-"]');

        await expect(page.getByText('E2E 验收：1 张卡牌选择')).toBeVisible({ timeout: 10000 });
        await expect(cardOptions).toHaveCount(1);
        await expect(page.getByTestId('prompt-card-grid')).toBeVisible();
        await expect(page.getByTestId('prompt-card-search-input')).toHaveCount(0);

        await game.screenshot('prompt-card-count-1', testInfo);
    });

    test('5 张卡牌选择单排放得下时不应显示搜索框', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await openPromptScene(game, page);
        const sourceId = await injectCardPrompt(page, 5);
        await game.waitForInteraction(sourceId, 10000);
        const cardOptions = page.locator('[data-option-id][data-testid^="prompt-card-"]');

        await expect(page.getByText('E2E 验收：5 张卡牌选择')).toBeVisible({ timeout: 10000 });
        await expect(cardOptions).toHaveCount(5);
        await expect(page.getByTestId('prompt-card-grid')).toBeVisible();
        await expect(page.getByTestId('prompt-card-search-input')).toHaveCount(0);

        await game.screenshot('prompt-card-count-5', testInfo);
    });

    test('10 张卡牌选择超出单排容量时应显示搜索框', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await openPromptScene(game, page);
        const sourceId = await injectCardPrompt(page, 10);
        await game.waitForInteraction(sourceId, 10000);
        const cardOptions = page.locator('[data-option-id][data-testid^="prompt-card-"]');

        await expect(page.getByText('E2E 验收：10 张卡牌选择')).toBeVisible({ timeout: 10000 });
        await expect(cardOptions).toHaveCount(10);
        await expect(page.getByTestId('prompt-card-grid')).toBeVisible();
        await expect(page.getByTestId('prompt-card-search-input')).toBeVisible();
        await expect(page.getByText('显示 10 / 10')).toBeVisible();

        await game.screenshot('prompt-card-count-10', testInfo);
    });
});
