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
import { fateAttackManaCost, resolveFateAttack } from '../../src/games/fate-domination/domain/attackSelection';
import { fateRidingCandidates } from '../../src/games/fate-domination/domain/ridingChoice';
import { validate } from '../../src/games/fate-domination/domain/commands';
import { sampleFateMapMotion } from './mapContinuityEvidence';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';

type State = MatchState<FateDominationCore>;
const chainId = 'fate-natural-online-golden';
const requiredScreens = {
    initial: '开局御主候选',
    master: '御主关联攻击和道具',
    servant: '独立从者选择',
    paired: '身份组合待确认',
    'deployment-targets': '按可用点位部署',
    deployed: '部署后出现御主能力',
    'master-draw': '战略部署支付魔力并抽牌',
    'investigation-target': '调查选择目标玩家',
    'investigation-hand': '调查查看并选择目标手牌',
    'investigation-resolved': '调查放回牌库顶后',
    move: '常规移动高亮合法地点',
    seal: '令咒效果确认',
    'inspection-closed-control-hidden': '鼠标离开放大对象，关闭叉号隐藏',
    'inspection-close-hover': '鼠标悬浮放大对象，关闭叉号可见',
    draft: '常规混选与正费用魔力预览',
    'confirmed-attack': '确认后已出牌与游戏服扣费',
    'riding-choice': '骑乘选择多张手牌',
    'riding-resolved': '骑乘确认后的追加出牌',
    'effect-move-target': '急行发动后选择移动地点',
    'effect-move-resolved': '急行移动后的战场',
    'chariot-target': '神威车轮选择所在地点事件',
    'chariot-offered': '神威车轮抽出两张事件',
    'chariot-resolved': '神威车轮替换事件完成',
    'chariot-handoff': '交出行动后的新都战场',
    battle: '战斗阶段按地点结算',
    'opponent-cards': '悬浮头像查看对手已打出牌',
    terminal: '同一在线房间的正式终局',
};

const screenshotNotes: Partial<Record<string, string>> = {
    deployed: '御主卡原文：战略部署—前哨阶段：你能支付1魔力来抽2张牌。来源：中文电子规则书，韦伯·维尔维特卡图。',
    'investigation-target': '御主卡原文：调查—前哨阶段：查看一位玩家的手牌。你可选择其中一张牌放于其拥有者的牌库顶部，若如此，下回合你不可进行【调查】。来源：中文电子规则书，韦伯·维尔维特卡图。',
    seal: '规则原文：通常每名玩家在游戏开始时拥有3枚令咒；每枚令咒在每局游戏中都可以使用一次，以在深山町或新都进行移动、或是获得4点法力值、或是获得2点合计威力以及获胜后获得2点战果点数。来源：中文电子规则书《前情提要与内容物介绍》令咒一节。',
    'chariot-target': '卡面原文：【真名解放】行动阶段：将你所在地点的一张事件牌弃置，然后抽2张新的事件牌。将其中1张作为新的事件牌，另一张洗回牌堆。来源：中文电子规则书，伊斯坎达尔「神威车轮」卡图。',
    'effect-move-target': '急行卡面原文：行动阶段：无视交战状态，沿箭头移动至下一地点。来源：中文基本攻击牌图集第 14 格。',
    'riding-choice': '卡牌原文：打出时：若此牌与一张基础攻击一同打出，抽一张牌。坐骑召唤-行动阶段：打出至多3张基本威力为3或更低的手牌。来源：中文电子规则书，伊斯坎达尔「骑乘」卡图。',
};

test.use({ viewport: { width: 1600, height: 900 }, actionTimeout: 15000, trace: 'retain-on-failure' });

test('真实在线房自选御主从者与正式电脑对局至圣杯战争结局', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(540000);
    await initContext(context);
    const release = await startSourceSession(context, baseURL!);
    const diagnostics = attachPageDiagnostics(page);
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const captureContract = JSON.stringify({
        version: 1, gameId: 'fate-domination', evidenceCategory: 'golden', reviewFile: 'visual-review.json',
        reviewerKind: 'primary-agent',
        requiredStates: Object.entries(requiredScreens).map(([uiStateId, reason]) => ({ chainId, uiStateId, reason, viewport: 'desktop' })),
    }, null, 2);
    await writeFile(path.join(run.stagingDir, 'capture-contract.json'), captureContract);
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
        if (!['opponent-cards', 'inspection-close-hover'].includes(id)) await page.mouse.move(12, 12);
        const file = String(shots.length + 1).padStart(2, '0') + '-' + shot[0] + '.png';
        await page.screenshot({ path: path.join(run.stagingDir, file), animations: 'disabled' });
        const sha256 = createHash('sha256').update(await readFile(path.join(run.stagingDir, file))).digest('hex');
        const viewport = page.viewportSize()!;
        const note = screenshotNotes[id];
        shots.push({
            path: path.relative(process.cwd(), path.join(run.stableDir, file)).replace(/\\/g, '/'),
            chainId, chainStep: shots.length + 1, stage: '独特界面态', role: 'main-flow', transition: action,
            viewport: 'desktop', viewportSize: `${viewport.width}x${viewport.height}`,
            description: `图片表达：${action}`,
            effectReference: note,
            uiStateId: id, uiChange: shot[1], uiChangeReason: shot[0], behaviorStepId: id, requirements: [shot[0]], sha256,
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
        const motionFrameCounts: Record<string, number> = {};
        let chariotOriginalZoom: string | null = null;
        let chariotOriginalTransform: string | undefined;
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
                const workshop = page.getByTestId('fate-domination-location-workshop');
                const shinto = page.getByTestId('fate-domination-location-shinto');
                const preferred = seen.has('riding') && !seen.has('chariot') && await shinto.isVisible() ? shinto : workshop;
                const target = await preferred.isVisible() ? preferred : board.locator('button[data-fate-destination]:enabled').first();
                if (!seen.has('deploy')) {
                    const canvas = page.getByTestId('fate-pixi-map-canvas');
                    const canvasHost = page.getByTestId('fate-pixi-map-canvas-host');
                    const projection = board.locator('.fd-runtime-map-overlay');
                    await expect(canvasHost).toHaveAttribute('data-map-resource-status', 'ready');
                    const bounds = (await canvas.boundingBox())!;
                    motionFrameCounts.drag = await sampleFateMapMotion(page, path.join(run.stagingDir, 'map-drag-frames.json'), async () => {
                        await page.mouse.move(bounds.width * .53, bounds.height * .38);
                        await page.mouse.wheel(0, 2400);
                        await expect(board.locator('.fd-runtime-camera-controls span')).toHaveText('25%');
                        const beforeDrag = await projection.evaluate(node => getComputedStyle(node).transform);
                        await page.mouse.move(bounds.width * .34, bounds.height * .45);
                        await page.mouse.down();
                        await page.mouse.move(bounds.width - 3, 7, { steps: 22 });
                        await page.mouse.up();
                        await expect.poll(() => projection.evaluate(node => getComputedStyle(node).transform)).not.toBe(beforeDrag);
                        await expect.poll(() => projection.evaluate((node) => {
                            const map = node.getBoundingClientRect();
                            const width = Math.min(map.right, innerWidth) - Math.max(map.left, 0);
                            const height = Math.min(map.bottom, innerHeight) - Math.max(map.top, 0);
                            return Math.min(width / Math.min(map.width, innerWidth), height / Math.min(map.height, innerHeight));
                        })).toBeGreaterThanOrEqual(.84);
                        await page.getByRole('button', { name: '复位', exact: true }).click();
                        await expect(board.locator('.fd-runtime-camera-controls span')).not.toHaveText('25%');
                        await expect.poll(() => projection.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(bounds.height * .82);
                    });
                    const openDeployments = board.locator('button.fd-runtime-deployment-slot:not(:disabled)');
                    await expect.poll(() => openDeployments.evaluateAll(nodes => nodes.every(node => {
                        const rect = node.getBoundingClientRect();
                        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === node;
                    }))).toBe(true);
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
                    const beforeAbility=(await read()).core.players['0'];
                    await ability.click();
                    await expect.poll(async () => (await read()).core.players['0'].hand.length).toBe(actor.hand.length + 2);
                    const afterAbility=(await read()).core.players['0'];
                    await mark('master-draw','点击战略部署支付魔力并抽两张牌',[check('手牌增加两张',afterAbility.hand.length,beforeAbility.hand.length+2),check('支付一魔力',afterAbility.mana,beforeAbility.mana-1)],['战略部署支付魔力并抽牌','layout']);
                    await page.getByRole('button',{name:'发动调查',exact:true}).click();
                    const investigationTarget=board.locator('[data-tutorial-id="fate-player-1"] .fd-runtime-avatar');
                    await expect(investigationTarget).toHaveClass(/is-investigation-target/);
                    await mark('investigation-target','进入调查，描边标出可查看手牌的玩家',[check('选择目标前对手手牌未改变',(await read()).core.players['1'].hand.length,core.players['1'].hand.length),check('调查提示只出现一次',await board.getByText('选择要调查的玩家',{exact:true}).count(),1),check('等待选人时不显示阶段按钮',await primary.count(),0)],['调查选择目标玩家','target-highlight']);
                    await investigationTarget.click();
                    const inquiry=page.getByTestId('fate-investigation-choice');await expect(inquiry).toBeVisible();
                    const viewed=(await read()).sys.interaction.current!.data as {fateContext:{offered:Array<{id:string}>}};
                    expect(viewed.fateContext.offered.length).toBeGreaterThan(0);
                    await mark('investigation-hand','选中目标后展示该玩家的手牌',[check('查看期间目标手牌未移动',(await read()).core.players['1'].hand.length,core.players['1'].hand.length),check('查看期间不显示阶段按钮',await primary.count(),0)],['调查查看并选择目标手牌','interaction-mode']);
                    const chosenId=viewed.fateContext.offered[0].id;
                    await inquiry.locator('.fd-investigation-card > button:first-child').first().click();
                    await expect.poll(async()=>(await read()).core.players['1'].deck[0]?.id).toBe(chosenId);
                    const inquiryDone=await read();
                    await mark('investigation-resolved','将选中的牌放回其拥有者牌库顶',[check('牌库顶为所选牌',inquiryDone.core.players['1'].deck[0]?.id,chosenId),check('下一回合不能调查',inquiryDone.core.players['0'].investigationBlockedRound,core.round+1)],['调查放回牌库顶后','layout']);
                    seen.add('investigation');
                    seen.add('deploy');
                } else if (!seen.has('riding')) {
                    const ability = page.getByRole('button', {name: '发动战略部署', exact: true});
                    if (await ability.isEnabled()) {
                        const beforeDraw = (await read()).core.players['0'];
                        if (beforeDraw.hand.length < 5 && beforeDraw.deck.length + beforeDraw.discard.length >= 2) {
                            await ability.click();
                            await expect.poll(async () => (await read()).core.players['0'].hand.length).toBe(beforeDraw.hand.length + 2);
                        }
                    }
                }
                await clickPrimary();
                continue;
            }
            if (core.phase === 'action' && !actor.normalAttackPlayed) {
                if ((!seen.has('move') || !seen.has('chariot')) && actor.locationId === 'workshop' && resolveFateMovement(core, '0', 'miyama').valid) {
                    await page.getByRole('button', { name: '从魔术工房开始常规移动' }).click();
                    if(!seen.has('move'))await mark('move', '点击本人棋子，地图显示可移动目的地', [check('未选目的地前位置不变', (await read()).core.players['0'].locationId, 'workshop')], ['行动阶段选择移动目标', 'target-highlight']);
                    await page.getByTestId('fate-domination-location-miyama').click();
                    await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('miyama');
                    await mark(`moved-round-${core.round}`, '点击合法目标直接移动', [check('按规则实付移动费用', (await read()).core.players['0'].mana, actor.mana - resolveFateMovement(core, '0', 'miyama').cost!)]);
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
                const choices = actions.map(action => action.commands[0].payload as { cardIds: string[]; faceDownIds: string[] });
                const costOf = (pair: typeof choices[number]) => pair.cardIds.reduce((sum, id) =>
                    sum + (fateAttackManaCost(actor, id, pair.faceDownIds.includes(id)) ?? 0), 0);
                const mixesHandAndSkill = (choice: typeof choices[number]) => choice.cardIds.some(id => hand.has(id)) && choice.cardIds.some(id => !hand.has(id));
                const ridingId = actor.skills.find(skill => skill.id.startsWith('sc_iskandar_1:'))?.id;
                const chariotId = actor.skills.find(skill => skill.id.startsWith('sc_iskandar_2:'))?.id;
                const rushId = actor.hand.find(card => card.definitionId === 'cardSurveil')?.id;
                const ridingPairs = (!seen.has('attack') || !seen.has('riding')) && ridingId ? choices.filter(choice => choice.cardIds.includes(ridingId)
                    && choice.faceDownIds.length === 1 && mixesHandAndSkill(choice) && costOf(choice) > 0) : [];
                const huntingChariot = seen.has('riding') && !seen.has('chariot') && actor.locationId === 'shinto';
                const chariotPair = huntingChariot && chariotId ? choices.find(choice => choice.cardIds.includes(chariotId) && choice.cardIds.some(id => hand.has(id))) : undefined;
                if (huntingChariot && !chariotPair && actor.mana < 8 && validate(state, { type: 'USE_COMMAND_SPELL', playerId: '0', payload: { effect: 'mana' } }).valid) {
                    await page.getByRole('button', { name: '使用令咒', exact: true }).click();
                    await page.getByRole('button', { name: /恢复魔力/ }).click();
                    await page.getByRole('button', { name: '确认使用' }).click();
                    await expect.poll(async () => (await read()).core.players['0'].commandSpells).toBe(actor.commandSpells - 1);
                    continue;
                }
                // 保留骑乘可追加的低威力牌，优先以不能骑乘的高威力牌搭配骑乘。
                const pair = (ridingPairs.find(choice => choice.faceDownIds.some(id => (resolveFateAttack(actor, id)?.definition.basePower ?? 0) > 3)) ?? ridingPairs[0])
                    ?? chariotPair
                    ?? (seen.has('riding') && !seen.has('chariot') && chariotId && rushId && actor.locationId==='miyama' ? choices.find(choice=>choice.cardIds.includes(chariotId) && choice.cardIds.includes(rushId) && !choice.faceDownIds.includes(rushId)) : undefined)
                    ?? (!seen.has('effect-move') && rushId ? choices.find(choice => choice.cardIds.includes(rushId) && !choice.faceDownIds.includes(rushId)) : undefined)
                    ?? choices.find(choice => choice.faceDownIds.length === 1) ?? choices[0];
                if (pair) {
                    const card = (id: string, staged = false) => hand.has(id)
                        ? board.locator(`[data-card-zone="${staged ? 'staged' : 'hand'}"][data-card-id="${id}"]`)
                        : board.locator(`[data-card-zone="${staged ? 'staged-skill' : 'skill'}"][data-focus-card="skill-0-${id}"]`);
                    if (!seen.has('inspection')) {
                        const inspectable = board.locator('[data-card-zone="hand"]').last();
                        await inspectable.click({ button: 'right' });
                        const close = page.getByTestId('fate-inspection-close');
                        await page.mouse.move(12, 12);
                        await expect(close).toHaveCSS('opacity', '0');
                        await mark('inspection-closed-control-hidden', '右击攻击牌打开检视，鼠标移出卡面', [
                            check('关闭叉号隐藏', await close.evaluate(node => getComputedStyle(node).opacity), '0'),
                        ], ['放大卡牌移开鼠标隐藏叉号', 'panel']);
                        await page.getByTestId('fate-runtime-inspection').hover();
                        await expect(close).toHaveCSS('opacity', '1');
                        await mark('inspection-close-hover', '移入放大牌面，显示关闭按钮', [
                            check('关闭叉号出现', await close.evaluate(node => getComputedStyle(node).opacity), '1'),
                        ], ['悬浮放大卡牌显示关闭叉号', 'interaction-mode']);
                        await close.click();
                        await expect(close).toHaveCount(0);
                        seen.add('inspection');
                    }
                    const select = async (id: string) => {
                        const mode = page.getByRole('button', { name: '暗置选牌', exact: true });
                        if ((await mode.getAttribute('aria-pressed') === 'true') !== pair.faceDownIds.includes(id)) await mode.click();
                        const candidate = card(id);
                        await candidate.click({ position: { x: 12, y: 70 } });
                    };
                    for (const id of pair.cardIds) await select(id);
                    const cost = costOf(pair);
                    const capturePaidAttack = !seen.has('attack') && cost > 0 && mixesHandAndSkill(pair) && pair.faceDownIds.length === 1;
                    if (capturePaidAttack) {
                        const mana = board.getByTestId('fate-self-mana');
                        await expect(mana.locator('b')).toHaveText(String(actor.mana - cost));
                        await expect(primary).toHaveText('确认攻击');
                        await expect(primary).toHaveCSS('border-top-left-radius', '3px');
                        await mark('draft', '真人选出两张攻击牌并检查合计威力', [
                            check('暂存两张', (await snapshot()).visible.draftCount, 2),
                            check('权威暂存为空', (await read()).core.players['0'].selectedAttackIds, []),
                            check('确认前魔力未扣', (await read()).core.players['0'].mana, actor.mana),
                            check('预计剩余魔力已显示', await mana.locator('b').textContent(), String(actor.mana - cost)),
                        ], ['两张攻击草稿与合计威力', 'interaction-mode']);
                        const withdrawn = pair.cardIds.find(id => !pair.faceDownIds.includes(id)) ?? pair.cardIds[0];
                        await card(withdrawn, true).click();
                        await expect.poll(async () => (await snapshot()).visible.draftCount).toBe(1);
                        await expect(mana.locator('b')).toHaveText(String(actor.mana - cost + (fateAttackManaCost(actor, withdrawn, pair.faceDownIds.includes(withdrawn)) ?? 0)));
                        await select(withdrawn);
                    }
                    await clickPrimary();
                    await expect.poll(async () => (await read()).core.players['0'].normalAttackPlayed).toBe(true);
                    if (capturePaidAttack) {
                        const paid = (await read()).core.players['0'];
                        await mark('confirmed-attack', '撤回后重新选牌并确认正式攻击', [
                            check('两张攻击已提交', [...paid.activeAttackIds, ...paid.activeSkills].sort(), [...pair.cardIds].sort()),
                            check('服务端实付符合预览', paid.mana, actor.mana - cost),
                        ], ['确认攻击后的出牌区', 'interaction-mode']);
                        seen.add('attack');
                    }
                    continue;
                }
            }
            if (core.phase==='action' && actor.normalAttackPlayed && actor.locationId==='shinto' && !seen.has('chariot') && seen.has('riding')) {
                const chariot=page.getByRole('button',{name:'发动 神威车轮',exact:true});
                if(await chariot.isVisible() && await chariot.getAttribute('aria-disabled')==='false'){
                    chariotOriginalZoom=await board.locator('.fd-runtime-camera-controls span').textContent();
                    const mapOverlay = board.locator('.fd-runtime-map-overlay');
                    chariotOriginalTransform = await mapOverlay.evaluate(node => getComputedStyle(node).transform);
                    await chariot.click();
                    const target=page.locator('.fd-runtime-map-card-hit.is-chariot-target').first();
                    await expect(target).toBeVisible();
                    await mark('chariot-target','点击已打出的神威车轮并选择所在地点的事件',[check('选择前事件尚未弃置',(await read()).core.currentEvents[actor.locationId as 'miyama'|'shinto'].length,core.currentEvents[actor.locationId as 'miyama'|'shinto'].length)],['神威车轮选择所在地点事件','target-highlight']);
                    await target.click();
                    const choice=page.getByTestId('fate-chariot-choice');await expect(choice).toBeVisible();
                    const candidates=choice.getByRole('button',{name:/^选择事件 /});
                    await expect(candidates).toHaveCount(2);
                    const phaseAction=page.getByTestId('fate-domination-primary-action');
                    await expect(phaseAction).toHaveCount(0);
                    await mark('chariot-offered','弃置目标事件后抽出两张，选择一张放入战场',[check('等待一张事件选择',await candidates.count(),2),check('选牌时隐藏推进操作',await phaseAction.count(),0)],['神威车轮抽出两张事件','panel']);
                    const context=(await read()).sys.interaction.current!.data as {fateContext:{offered:Array<{id:string}>}};
                    const selectedId=context.fateContext.offered[0].id, returnedId=context.fateContext.offered[1].id;
                    await candidates.first().click();
                    await expect.poll(async()=> (await read()).core.currentEvents[actor.locationId as 'miyama'|'shinto'].some(card=>card.id===selectedId)).toBe(true);
                    const finished=await read();
                    await expect.poll(() => mapOverlay.evaluate(node => getComputedStyle(node).transform)).toBe(chariotOriginalTransform);
                    await mark('chariot-resolved','选择事件后另一张洗回事件牌堆',[check('选择事件已放置',finished.core.currentEvents[actor.locationId as 'miyama'|'shinto'].some(card=>card.id===selectedId)),check('另一张回到事件牌堆',finished.core.eventDeck.some(card=>card.id===returnedId))],['神威车轮替换事件完成','layout']);
                    seen.add('chariot');continue;
                }
            }
            if (core.phase === 'action' && actor.normalAttackPlayed && !seen.has('riding')) {
                const riding = page.getByRole('button', { name: '发动 骑乘', exact: true });
                const candidates = fateRidingCandidates(core, '0').map(candidate => ({ id: candidate.id, cost: fateAttackManaCost(actor, candidate.id) ?? Infinity }))
                    .sort((a, b) => a.cost - b.cost || Number(actor.hand.find(card => card.id === b.id)?.definitionId === 'cardSurveil')
                        - Number(actor.hand.find(card => card.id === a.id)?.definitionId === 'cardSurveil'));
                // 一张合法手牌也能发动骑乘，但此场需要自然出现多选；机会不足时留待之后的回合。
                if (candidates.length >= 2 && candidates[0].cost + candidates[1].cost <= actor.mana
                    && await riding.isVisible() && await riding.getAttribute('aria-disabled') !== 'true') {
                    const chosen: string[] = [];
                    let cost = 0;
                    for (const candidate of candidates) {
                        if (chosen.length < 3 && cost + candidate.cost <= actor.mana) {
                            chosen.push(candidate.id);
                            cost += candidate.cost;
                        }
                    }
                    expect(chosen.length, '自然手牌应提供至少两张骑乘候选').toBeGreaterThanOrEqual(2);
                    await riding.click();
                    await expect(board.locator('[data-riding-choice="true"]')).toBeVisible();
                    for (const id of chosen) {
                        const card = board.locator(`[data-card-zone="hand"][data-card-id="${id}"]`);
                        await card.click({ position: { x: 12, y: 70 } });
                        await expect(card).toHaveAttribute('aria-pressed', 'true');
                    }
                    await mark('riding-choice', '发动骑乘并选择追加攻击牌', [
                        check('选择期间服务端魔力未扣', (await read()).core.players['0'].mana, actor.mana),
                        check('骑乘选择数量', chosen.length >= 2 && chosen.length <= 3),
                    ], ['骑乘选择多张手牌', 'interaction-mode']);
                    await primary.click();
                    await expect.poll(async () => (await read()).core.players['0'].mana).toBe(actor.mana - cost);
                    const afterRide = (await read()).core.players['0'];
                    await mark('riding-resolved', '确认骑乘追加攻击并结算费用', [
                        check('骑乘追加牌已打出', chosen.every(id => afterRide.activeAttackIds.includes(id))),
                        check('骑乘实付魔力', afterRide.mana, actor.mana - cost),
                        check('骑乘后仍是本人行动', (await read()).core.currentPlayerId, '0'),
                    ], ['骑乘确认后的追加出牌', 'interaction-mode']);
                    seen.add('riding');
                    continue;
                }
            }
            const hasChariotActive=actor.activeSkills.some(id=>id.startsWith('sc_iskandar_2:'));
            if (core.phase === 'action' && actor.normalAttackPlayed && (!seen.has('effect-move') || (!seen.has('chariot') && actor.locationId==='miyama' && hasChariotActive)) && seen.has('riding')) {
                const rush = actor.hand.find(card => card.definitionId === 'cardSurveil' && actor.activeAttackIds.includes(card.id));
                const destinations = (['workshop','miyama','shinto','recon'] as const).filter(locationId => rush && validate(state, {type:'PLAY_SKILL',playerId:'0',payload:{skillId:rush.id,targetLocationId:locationId}}).valid);
                if (rush && destinations.length) {
                    const source = board.locator(`[data-card-zone="active"][data-card-id="${rush.id}"]`);
                    await expect(source).toHaveClass(/is-available/);
                    await source.hover({position:{x:10,y:70}});
                    await source.click();
                    const destination = destinations[0];
                    if (destination === 'shinto' && core.currentEvents.shinto.length > 0) {
                        const shintoEventCards = page.locator('.fd-runtime-map-overlay button[data-fate-shinto-event]');
                        await expect(shintoEventCards).toHaveCount(core.currentEvents.shinto.length);
                    }
                    await expect(page.getByTestId(`fate-domination-location-${destination}`)).toBeVisible();
                    if(!seen.has('effect-move'))await mark('effect-move-target', '点击已打出的急行，选择亮起的下一地点', [check('选地点前位置不变',(await read()).core.players['0'].locationId,actor.locationId)], ['急行发动后选择移动地点','target-highlight']);
                    await page.getByTestId(`fate-domination-location-${destination}`).click();
                    await expect.poll(async () => (await read()).core.players['0'].locationId).toBe(destination);
                    const movedPawn = board.getByRole('button', {name:`玩家1位于${core.battlefield[destination].label}`,exact:true});
                    await expect.poll(() => movedPawn.evaluate(node => {
                        const rect=node.getBoundingClientRect();
                        const top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
                        return Boolean(top && !top.closest('.fd-runtime-hand-grid'));
                    }), {message:'急行移动后的角色不能被出牌区遮挡'}).toBe(true);
                    const firstEffectMove = !seen.has('effect-move');
                    await mark(firstEffectMove ? 'effect-move-resolved' : `effect-move-resolved-round-${core.round}`, '点击目标地点结算急行移动', [check('移动后的地点',(await read()).core.players['0'].locationId,destination)], firstEffectMove ? ['急行移动后的战场','layout'] : undefined);
                    seen.add('effect-move');
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
                    check('头像旁可见威力', await board.locator('.fd-seat-power').first().isVisible()),
                ], ['悬浮头像查看对手已打出牌', 'interaction-mode']);
                await page.mouse.move(12, 12);
                seen.add('battle');
            }
            if(core.phase==='action' && actor.normalAttackPlayed && seen.has('chariot') && !seen.has('chariot-handoff')){
                expect(chariotOriginalZoom).not.toBeNull();
                await clickPrimary();
                await expect.poll(async()=>{const next=(await read()).core;return next.round!==core.round || next.phase!=='action' || next.currentPlayerId!=='0';},{timeout:15000}).toBe(true);
                const zoom=board.locator('.fd-runtime-camera-controls span');
                await expect(zoom).toHaveText(chariotOriginalZoom!);
                await mark('chariot-handoff','交出行动后，替换后的新都事件延续到下一阶段',[check('缩放与发动前一致',await zoom.textContent(),chariotOriginalZoom)],['交出行动后的新都战场','layout']);
                seen.add('chariot-handoff');continue;
            }
            if (core.phase === 'action' && actor.normalAttackPlayed && !motionFrameCounts.handoff) {
                motionFrameCounts.handoff = await sampleFateMapMotion(page, path.join(run.stagingDir, 'map-handoff-frames.json'), async () => {
                    await clickPrimary();
                    await expect.poll(async () => {
                        const next = (await read()).core;
                        return next.round !== core.round || next.phase !== core.phase || next.currentPlayerId !== '0';
                    }, { timeout: 15000 }).toBe(true);
                    // 收入浏览器呈现交接后的时间，不能在服务器接受命令的同一刻停止。
                    await page.waitForTimeout(950);
                });
                continue;
            }
            await clickPrimary();
        }
        const { core, sys } = await read();
        await expect(result).toBeVisible();
        expect(core.round).toBeGreaterThan(1);
        const requiredInteractions = ['deploy', 'investigation', 'move', 'seal', 'inspection', 'attack', 'riding', 'effect-move', 'chariot', 'chariot-handoff', 'battle'];
        expect(requiredInteractions.filter(id => !seen.has(id)), '此局自然流程未触发的交互').toEqual([]);
        expect(motionFrameCounts.handoff).toBeGreaterThanOrEqual(6);
        await mark('terminal', '同一局自然推进到正式胜负结算', [
            check('正式终局阶段', core.phase, 'complete'), check('引擎记录终局', Boolean(sys.gameover)),
            check('领域与引擎结果相同', core.gameResult, sys.gameover),
            check('terminal-gameover', Boolean(sys.gameover) && await result.isVisible()),
        ], ['圣杯战争正式终局', 'panel']);
        await assertNoFatalFrontendErrors([{ label: 'Fate 在线正式对局', diagnostics }]);
        expect(new Set(steps.map(step => step.id)).size, '行为证据的动作编号必须唯一').toBe(steps.length);
        const identity = await captureEvidenceSourceIdentity(page, 'fate-domination');
        await writeFile(path.join(run.stagingDir, 'behavior-trace.json'), JSON.stringify({
            gameId: 'fate-domination', evidenceCategory: 'golden', chainId, sourceRun: run.runId, ...identity, browserContextId, matchId,
            status: 'PASS', visualStatus: 'pending', fixtureBoundary: { kind: 'natural-flow', injections: [] },
            captureContract: { sha256: createHash('sha256').update(captureContract).digest('hex') },
            motionFrameCounts,
            outcome: '一名真人通过正式在线房间 UI 自选角色，与两名正式 AI 自然对局至服务器终局',
            coverage: { actions: [...seen], rounds: [...rounds], deferred: ['真人多端', '骑乘第四张拒绝', '所有角色与效果分支'] },
            steps, terminalStepId: 'terminal',
            uiStates: shots.map(shot => ({ id: shot.uiStateId, stepId: shot.behaviorStepId, change: shot.uiChange, viewport: shot.viewport, viewportSize: shot.viewportSize, sha256: shot.sha256 })),
        }, null, 2));
        await promoteEvidenceScreenshotRun(run, {
            version: 2, gameId: 'fate-domination', evidenceCategory: 'golden', capturePolicy: 'distinct-ui-state',
            media: shots.map(({ sha256: _sha256, ...shot }) => ({ ...shot, sourceRevision: identity.sourceRevision })),
        });
        console.log('[Fate golden] 证据目录', run.stableDir);
    } finally {
        await testInfo.attach('自然对局步骤', { body: JSON.stringify(steps, null, 2), contentType: 'application/json' });
        await release();
    }
});
