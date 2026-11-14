import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { attachPageDiagnostics, assertNoFatalFrontendErrors, initContext } from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun, type EvidenceScreenshotIndexEntry } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, startSourceSession } from '../framework/sourceIdentity';
import type { MatchState } from '../../src/engine/types';
import { buildFateAiLegalActions } from '../../src/games/fate-domination/ai';
import { resolveFateMovement } from '../../src/games/fate-domination/domain/movement';
import { fateAttackManaCost } from '../../src/games/fate-domination/domain/attackSelection';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';

type State = MatchState<FateDominationCore>;
const chainId = 'fate-natural-online-golden';

test.use({ viewport: { width: 1600, height: 900 }, actionTimeout: 15000, trace: 'retain-on-failure' });

test('真实在线房自选御主从者与正式电脑对局至圣杯战争结局', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(540000);
    await initContext(context);
    const release = await startSourceSession(context, baseURL!);
    const diagnostics = attachPageDiagnostics(page);
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const browserContextId = randomUUID();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click({ timeout: 45000 });
    await page.getByTestId('game-details-open-create-room').first().click({ timeout: 25000 });
    const room = page.getByTestId('create-room-modal').last();
    await room.getByRole('button', { name: '3人', exact: true }).click();
    await room.getByRole('button', { name: /^加入 AI/ }).click();
    await room.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/, { timeout: 45000 });
    const matchId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
    expect(matchId).toBeTruthy();
    const read = async () => await getMatchState(matchId, page) as State;
    const primary = page.getByTestId('fate-domination-primary-action');
    const board = page.getByTestId('fate-domination-board');
    const result = page.getByRole('region', { name: '圣杯战争结果' });
    const snapshot = async () => {
        const { core, sys } = await read();
        return {
            authoritative: {
                matchId,
                round: core.round, phase: core.phase, current: core.currentPlayerId, gameOver: Boolean(sys.gameover),
                master: core.players['0'].masterId, servant: core.players['0'].servantId,
                hand: core.players['0'].hand.map(card => card.id), mana: core.players['0'].mana,
                location: core.players['0'].locationId, seals: core.players['0'].commandSpells,
                staged: core.players['0'].selectedAttackIds, attacks: core.players['0'].activeAttackIds,
                interaction: sys.interaction.current?.playerId ?? null,
            },
            visible: {
                url: page.url(),
                phase: await page.evaluate(() => document.querySelector('.fd-runtime-round')?.textContent ?? null),
                gameOver: await result.isVisible(),
                draftCount: await board.locator('[data-card-zone="staged"],[data-card-zone="staged-skill"]').count(),
            },
        };
    };
    type Snapshot = Awaited<ReturnType<typeof snapshot>>;
    type Assertion = { name: string; actual: unknown; expected: unknown };
    const steps: { id: string; action: string; before: Snapshot; after: Snapshot; assertions: Assertion[] }[] = [];
    const shots: (EvidenceScreenshotIndexEntry & { sha256: string })[] = [];
    let previous: Snapshot;
    const mark = async (id: string, action: string, assertions: Assertion[], shot?: [string, NonNullable<EvidenceScreenshotIndexEntry['uiChange']>]) => {
        assertions.forEach(assertion => expect(assertion.actual, assertion.name).toEqual(assertion.expected));
        const after = await snapshot();
        steps.push({ id, action, before: previous ?? after, after, assertions });
        previous = after;
        if (!shot) return;
        // 只等待当前可见素材完成解码。之后仍逐图检查是否有空白、占位或裁切。
        await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('img')).every(img => {
            const rect = img.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
                && rect.left < innerWidth && rect.top < innerHeight && img.checkVisibility();
            return !visible || img.loading === 'lazy' || img.complete;
        }), undefined, { timeout: 12000 });
        if (id !== 'opponent-cards') await page.mouse.move(12, 12);
        const file = String(shots.length + 1).padStart(2, '0') + '-' + shot[0] + '.png';
        await page.screenshot({ path: path.join(run.stagingDir, file), animations: 'disabled' });
        const sha256 = createHash('sha256').update(await readFile(path.join(run.stagingDir, file))).digest('hex');
        const viewport = page.viewportSize()!;
        shots.push({
            path: path.relative(process.cwd(), path.join(run.stableDir, file)).replace(/\\/g, '/'),
            chainId, chainStep: shots.length + 1, stage: '独特界面态', role: 'main-flow',
            viewport: 'desktop', viewportSize: `${viewport.width}x${viewport.height}`, description: shot[0],
            uiStateId: id, uiChange: shot[1], uiChangeReason: shot[0], behaviorStepId: id, sha256,
        });
    };
    const clickPrimary = async () => {
        await expect(primary).toBeEnabled();
        await primary.click();
    };
    const check = (name: string, actual: unknown, expected: unknown = true) => ({ name, actual, expected });
    try {
        await expect(page.getByRole('tab', { name: '御主', exact: true })).toBeVisible({ timeout: 45000 });
        const initial = await read();
        await mark('initial', '从正式在线房间进入选角并读取游戏服状态', [
            check('未选角色时不能确认', await primary.isDisabled()),
            check('初始未部署', initial.core.playerIds.every(id => !initial.core.players[id].locationId)),
        ], ['开局御主候选与原卡', 'layout']);
        await page.setViewportSize({ width: 1366, height: 768 });
        const master = page.getByTestId('fate-setup-master-m_tokiomi');
        await master.click();
        await expect(page.locator('[data-reference-kind="item"]')).toHaveCount(4);
        await mark('master', '选择远坂时臣，显示其真实追加攻击与道具资料', [
            check('选中时臣', await master.getAttribute('aria-pressed'), 'true'),
            check('确认前权威御主不变', (await read()).core.players['0'].masterId, initial.core.players['0'].masterId),
        ], ['御主关联攻击与道具', 'interaction-mode']);
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.getByTestId('fate-setup-master-m_waver').click();
        await page.getByRole('button', { name: '从者', exact: true }).click();
        await mark('servant', '换选韦伯后，主动进入从者候选', [
            check('从者仍待选择', await primary.isDisabled()),
            check('从者候选已显示', await page.getByRole('tab', { name: '从者', exact: true }).getAttribute('aria-selected'), 'true'),
        ], ['切换到从者并保留御主', 'interaction-mode']);
        await page.getByTestId('fate-setup-servant-servant-rider').click();
        await mark('paired', '选择伊斯坎达尔，查看其技能牌并准备提交组合', [
            check('双方选定后可确认', await primary.isEnabled()),
            check('从者仍未提交', (await read()).core.players['0'].servantId, initial.core.players['0'].servantId),
        ], ['御主从者组合待确认', 'interaction-mode']);
        await clickPrimary();
        await expect.poll(async () => {
            const { core } = await read();
            return [core.players['0'].masterId, core.players['0'].servantId, core.players['0'].hand.length];
        }).toEqual(['m_waver', 'servant-rider', 3]);

        const rounds = new Set<number>();
        const seen = new Set<string>();
        let iterations = 0;
        while (iterations++ < 220) {
            await expect.poll(async () => {
                const { core, sys } = await read();
                return Boolean(sys.gameover || (sys.interaction.current?.playerId ?? core.currentPlayerId) === '0');
            }, { timeout: 45000 }).toBe(true);
            const state = await read();
            const { core, sys } = state;
            const actor = core.players['0'];
            if (!rounds.has(core.round)) console.log('[Fate golden] 第', core.round, '轮', core.phase);
            rounds.add(core.round);
            if (sys.gameover) break;
            if (sys.interaction.current) {
                const dialog = page.getByRole('dialog', { name: '战后恢复令咒' });
                await dialog.getByRole('button', { name: '不恢复', exact: true }).click();
                if (!seen.has('post-battle')) {
                    await mark('post-battle', '选择保留现有令咒，等待确认', [check('选择属于当前真人', sys.interaction.current.playerId, '0')], ['战后选择等待确认', 'panel']);
                    seen.add('post-battle');
                }
                await dialog.getByRole('button', { name: '确认选择', exact: true }).click();
                continue;
            }
            if (core.phase === 'outpost' && !actor.locationId) {
                const deploy = page.getByTestId('fate-domination-location-workshop');
                const target = await deploy.isVisible() ? deploy : board.locator('button[data-fate-destination]:enabled').first();
                if (!seen.has('deploy')) {
                    const canvas = page.getByTestId('fate-pixi-map-canvas');
                    const canvasHost = page.getByTestId('fate-pixi-map-canvas-host');
                    const projection = board.locator('.fd-runtime-map-overlay');
                    await expect(canvasHost).toHaveAttribute('data-map-resource-status', 'ready');
                    const bounds = (await canvas.boundingBox())!;
                    await page.mouse.move(bounds.width * .53, bounds.height * .38);
                    await page.mouse.wheel(0, 2400);
                    await expect(board.locator('.fd-runtime-camera-controls span')).toHaveText('25%');
                    await page.mouse.move(bounds.width * .34, bounds.height * .45);
                    await page.mouse.down();
                    await page.mouse.move(bounds.width - 3, 7, { steps: 12 });
                    await page.mouse.up();
                    await expect.poll(async () => projection.evaluate((node) => {
                        const map = node.getBoundingClientRect();
                        return Math.min(map.bottom, innerHeight) - Math.max(map.top, 0);
                    })).toBeGreaterThanOrEqual(95);
                    await page.getByRole('button', { name: '复位', exact: true }).click();
                    await expect(board.locator('.fd-runtime-camera-controls span')).not.toHaveText('25%');
                    await mark('deployment-targets', '确认组合、起手牌入手，电脑完成准备后显示合法部署点', [
                        check('御主从者确认', [actor.masterId, actor.servantId], ['m_waver', 'servant-rider']),
                        check('尚未部署', Boolean(actor.locationId), false),
                        check('起手牌', actor.hand.length, 3),
                    ], ['前哨合法部署点与起手牌', 'target-highlight']);
                }
                const destination = await target.getAttribute('data-fate-destination');
                await target.click();
                await expect.poll(async () => (await read()).core.players['0'].locationId).toBe(destination);
                if (!seen.has('deploy')) {
                    const ability = page.getByRole('button', { name: '发动战略部署' });
                    await expect(ability).toBeEnabled();
                    await mark('deployed', '点击地图点位完成部署，御主能力出现在角色旁', [check('实际部署地点', (await read()).core.players['0'].locationId, destination)], ['部署完成与御主能力', 'layout']);
                    await ability.click();
                    await expect.poll(async () => (await read()).core.players['0'].hand.length).toBe(actor.hand.length + 2);
                    seen.add('deploy');
                }
                await clickPrimary();
                continue;
            }
            if (core.phase === 'action' && !actor.normalAttackPlayed) {
                if (!seen.has('move') && actor.locationId === 'workshop' && resolveFateMovement(core, '0', 'miyama').valid) {
                    await page.getByRole('button', { name: '从魔术工房开始常规移动' }).click();
                    await mark('move', '点击本人棋子，地图显示可移动目的地', [check('未选目的地前位置不变', (await read()).core.players['0'].locationId, 'workshop')], ['行动阶段选择移动目标', 'target-highlight']);
                    await page.getByTestId('fate-domination-location-miyama').click();
                    await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('miyama');
                    await mark('moved', '点击合法目标直接移动', [check('按规则实付移动费用', (await read()).core.players['0'].mana, actor.mana - resolveFateMovement(core, '0', 'miyama').cost!)]);
                    seen.add('move');
                    continue;
                }
                if (!seen.has('seal')) {
                    await page.getByRole('button', { name: '使用令咒', exact: true }).click();
                    await page.getByRole('button', { name: '恢复魔力', exact: false }).click();
                    await mark('seal', '选择恢复魔力，等待令咒确认', [check('确认前令咒数量不变', (await read()).core.players['0'].commandSpells, actor.commandSpells)], ['令咒恢复魔力待确认', 'panel']);
                    await page.getByRole('button', { name: '确认使用' }).click();
                    await expect.poll(async () => (await read()).core.players['0'].commandSpells).toBe(actor.commandSpells - 1);
                    seen.add('seal');
                    continue;
                }
                const actions = buildFateAiLegalActions({ state, playerId: '0' }).filter(action => action.commands[0].type === 'CONFIRM_ATTACK');
                const hand = new Set(actor.hand.map(card => card.id));
                const choices = actions.map(action => action.commands[0].payload as { cardIds: string[]; faceDownIds: string[] })
                    .filter(pair => pair.cardIds.every(id => hand.has(id)));
                const costOf = (pair: typeof choices[number]) => pair.cardIds.reduce((sum, id) =>
                    sum + (fateAttackManaCost(actor, id, pair.faceDownIds.includes(id)) ?? 0), 0);
                const pair = choices.find(choice => choice.faceDownIds.length === 1 && costOf(choice) > 0)
                    ?? choices.find(choice => choice.faceDownIds.length === 1) ?? choices[0];
                if (pair) {
                    const select = async (id: string) => {
                        const mode = page.getByRole('button', { name: '暗置选牌', exact: true });
                        if ((await mode.getAttribute('aria-pressed') === 'true') !== pair.faceDownIds.includes(id)) await mode.click();
                        await board.locator('[data-card-zone="hand"][data-card-id="' + id + '"]').click();
                    };
                    for (const id of pair.cardIds) await select(id);
                    if (!seen.has('attack')) {
                        const mana = board.getByTestId('fate-self-mana');
                        const cost = costOf(pair);
                        await expect(mana.locator('b')).toHaveText(String(actor.mana - cost));
                        await mark('draft', '真人选出两张攻击牌并检查合计威力', [
                            check('暂存两张', (await snapshot()).visible.draftCount, 2),
                            check('权威暂存为空', (await read()).core.players['0'].selectedAttackIds, []),
                            check('确认前魔力未扣', (await read()).core.players['0'].mana, actor.mana),
                            check('预计剩余魔力已显示', await mana.locator('b').textContent(), String(actor.mana - cost)),
                        ], ['两张攻击草稿与合计威力', 'interaction-mode']);
                        const withdrawn = pair.cardIds.find(id => !pair.faceDownIds.includes(id)) ?? pair.cardIds[0];
                        await board.locator('[data-card-zone="staged"][data-card-id="' + withdrawn + '"]').click();
                        await expect.poll(async () => (await snapshot()).visible.draftCount).toBe(1);
                        await expect(mana.locator('b')).toHaveText(String(actor.mana - cost + (fateAttackManaCost(actor, withdrawn, pair.faceDownIds.includes(withdrawn)) ?? 0)));
                        await select(withdrawn);
                    }
                    await clickPrimary();
                    await expect.poll(async () => (await read()).core.players['0'].normalAttackPlayed).toBe(true);
                    if (!seen.has('attack')) {
                        await mark('confirmed-attack', '撤回后重新选牌并确认正式攻击', [
                            check('两张攻击已提交', [...(await read()).core.players['0'].activeAttackIds].sort(), [...pair.cardIds].sort()),
                        ], ['确认攻击后的出牌区', 'interaction-mode']);
                        seen.add('attack');
                    }
                    continue;
                }
            }
            if (core.phase === 'battle' && core.battleResolution?.step === 'locations' && !seen.has('battle')) {
                await mark('battle', '行动交接给正式电脑玩家并进入战斗地点结算', [
                    check('电脑至少一方实际出牌', core.playerIds.filter(id => id !== '0').some(id => core.players[id].normalAttackPlayed)),
                    check('可结算地点', await primary.isEnabled()),
                ], ['战斗阶段按地点结算', 'interaction-mode']);
                const opponent = board.locator('.fd-runtime-player-rail .fd-runtime-avatar').first();
                await opponent.hover();
                const row = board.locator('.fd-runtime-opponent-cards');
                await expect(row.locator('.fd-runtime-public-cards').first().locator('button, .fd-hidden-played-card').first()).toBeVisible();
                await row.hover();
                await mark('opponent-cards', '悬浮对手头像，指针移入公开出牌单排', [
                    check('对手公开出牌可检视', await row.isVisible()),
                    check('威力仍在头像旁一级显示', await board.locator('.fd-seat-power').first().isVisible()),
                ], ['对手公开出牌与一级威力', 'interaction-mode']);
                await page.mouse.move(12, 12);
                seen.add('battle');
            }
            await clickPrimary();
        }
        const { core, sys } = await read();
        await expect(result).toBeVisible();
        expect(core.round).toBeGreaterThan(1);
        expect(['deploy', 'seal', 'attack', 'battle'].every(id => seen.has(id))).toBe(true);
        await mark('terminal', '同一局自然推进到正式胜负结算', [
            check('正式终局阶段', core.phase, 'complete'), check('引擎记录终局', Boolean(sys.gameover)),
            check('领域与引擎结果相同', core.gameResult, sys.gameover),
            check('terminal-gameover', Boolean(sys.gameover) && await result.isVisible()),
        ], ['圣杯战争正式终局', 'panel']);
        await assertNoFatalFrontendErrors([{ label: 'Fate 在线正式对局', diagnostics }]);
        const identity = await captureEvidenceSourceIdentity(page, 'fate-domination');
        await writeFile(path.join(run.stagingDir, 'behavior-trace.json'), JSON.stringify({
            gameId: 'fate-domination', evidenceCategory: 'golden', chainId, sourceRun: run.runId, ...identity, browserContextId, matchId,
            status: 'PASS', visualStatus: 'pending', fixtureBoundary: { kind: 'natural-flow', injections: [] },
            outcome: '一名真人通过正式在线房间 UI 自选角色，与两名正式 AI 自然对局至服务器终局',
            coverage: { actions: [...seen], rounds: [...rounds], deferred: ['真人多端', '骑乘专属响应', '所有角色与效果分支'] },
            steps, terminalStepId: 'terminal',
            uiStates: shots.map(shot => ({ id: shot.uiStateId, stepId: shot.behaviorStepId, change: shot.uiChange, viewport: shot.viewport, viewportSize: shot.viewportSize, sha256: shot.sha256 })),
        }, null, 2));
        await promoteEvidenceScreenshotRun(run, {
            gameId: 'fate-domination', evidenceCategory: 'golden', capturePolicy: 'distinct-ui-state',
            media: shots.map(({ sha256: _sha256, ...shot }) => ({ ...shot, sourceRevision: identity.sourceRevision })),
        });
        console.log('[Fate golden] 证据目录', run.stableDir);
    } finally {
        await testInfo.attach('自然对局步骤', { body: JSON.stringify(steps, null, 2), contentType: 'application/json' });
        await release();
    }
});
