import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import { waitForTestHarness } from '../helpers/common';
import { applyCoreStateDirect, readCoreState } from '../helpers/dicethrone';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';

const OPEN_TIMEOUT_MS = 180000;

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.jpg`,
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, fullPage: false, timeout: 20000 }));
    return path;
}

/** 直接把本地 TestHarness 的 sys.phase 切到目标阶段（不派发事件，避免触发自动推进/结算）。 */
async function setSysPhase(page: Page, phase: string): Promise<void> {
    await page.evaluate((targetPhase) => {
        const harness = (window as Window & { __BG_TEST_HARNESS__?: { state: { get: () => any; set: (s: any) => void } } }).__BG_TEST_HARNESS__;
        if (!harness) throw new Error('TestHarness not available');
        const current = harness.state.get();
        harness.state.set({
            ...current,
            sys: { ...(current.sys ?? {}), phase: targetPhase },
        });
    }, phase);
    await page.waitForTimeout(300);
}

test.describe('Artificer 纳米机器人维持阶段触发证据', () => {
    test('维持阶段纳米机器人已建造时引爆按钮应可见可用且能引爆', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);

        // 1. 注入 main1（安全阶段，避免 upkeep 被自动推进）：artificer vs monk
        //    给 player0 注入 NANOBOT token（表示已建造）+ 2 Synth（引爆消耗）；
        //    给 player1 注入 2 层 NANOBOMB（引爆目标）。
        //    注意：setupScene 用 initHeroState 初始化，artificerBotState[NANOBOT].built 默认为 false。
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 5, HP: 50 },
                tokens: { [TOKEN_IDS.NANOBOT]: 1, [TOKEN_IDS.SYNTH]: 2 },
            },
            player1: {
                resources: { CP: 5, HP: 50 },
                statusEffects: { [STATUS_IDS.NANOBOMB]: 2 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'artificer', '1': 'monk' },
                hostStarted: true,
            },
        });

        // 2. 场景注入：把 artificerBotState[NANOBOT].built 标为 true，
        //    反映"纳米机器人已通过 build 命令建造完成"的真实游玩状态。
        const core = await readCoreState(page);
        const player0 = core.players?.['0'];
        if (!player0) throw new Error('player0 未初始化');
        await applyCoreStateDirect(page, {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...player0,
                    artificerBotState: {
                        ...player0.artificerBotState,
                        [TOKEN_IDS.NANOBOT]: {
                            built: true,
                            upgraded: false,
                            activationsUsedThisTurn: 0,
                        },
                    },
                },
            },
        });
        await page.waitForTimeout(300);

        // 3. 切到维持阶段（直接写 sys.phase，不派发事件，避免自动推进跳过 upkeep）
        await setSysPhase(page, 'upkeep');

        // 4. 截图：维持阶段前态——引爆按钮应可见
        const beforePath = await shot(page, testInfo, '维持阶段-纳米机器人引爆按钮可见');

        // 5. 断言引爆按钮存在且标记为可用
        const detonateBtn = page.getByTestId('passive-action-artificer-workshop-0');
        await expect(detonateBtn).toBeVisible({ timeout: 15000 });
        await expect(detonateBtn).toHaveAttribute('data-passive-action-usable', 'true');

        // 5a. 元素级高分辨率截图：直接看引爆按钮本身的视觉高亮
        const btnElementPath = getEvidenceScreenshotPath(testInfo, '引爆按钮元素级视觉', {
            filename: '引爆按钮元素级视觉.png',
            requireChineseName: true,
            format: 'png',
        });
        await mkdir(dirname(btnElementPath), { recursive: true });
        await detonateBtn.screenshot({ path: btnElementPath });

        // 5b. 读取 computed style，确认可用高亮（emerald 翠绿）是否真正生效
        const computed = await detonateBtn.evaluate((el: HTMLElement) => {
            const cs = window.getComputedStyle(el);
            const classList = Array.from(el.classList);
            return {
                borderColor: cs.borderColor,
                backgroundColor: cs.backgroundColor,
                boxShadow: cs.boxShadow,
                color: cs.color,
                classList,
            };
        });
        console.log('引爆按钮 computed style:', JSON.stringify(computed));

        // 记录引爆前对手血量与纳米爆蛋层数（DiceThrone 资源字段为小写 hp，兼容大写回退）
        const readHp = (p: any): number => p?.resources?.hp ?? p?.resources?.HP ?? 20;
        const coreBefore = await readCoreState(page);
        const hpBefore = readHp(coreBefore.players?.['1']);
        const nanobombBefore = coreBefore.players?.['1']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0;
        expect(nanobombBefore, '引爆前对手身上应有 2 层纳米爆蛋').toBe(2);

        // 6. 点击引爆按钮（真实 UI 动作）
        await detonateBtn.click();
        await page.waitForTimeout(800);

        // 7. 截图：引爆后态——纳米爆蛋应清零、对手扣血
        const afterPath = await shot(page, testInfo, '引爆成功-纳米爆蛋清零对手扣血');

        // 8. 断言引爆效果
        const coreAfter = await readCoreState(page);
        const nanobombAfter = coreAfter.players?.['1']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0;
        const hpAfter = readHp(coreAfter.players?.['1']);
        expect(nanobombAfter, '引爆后对手纳米爆蛋应清零').toBe(0);
        expect(hpAfter, `引爆应造成伤害（${hpBefore} → 扣 3）`).toBeLessThan(hpBefore);

        // 输出截图路径供证据引用
        console.log('证据截图-前态:', beforePath);
        console.log('证据截图-后态:', afterPath);
    });
});
