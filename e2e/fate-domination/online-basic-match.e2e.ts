import {chooseFateIdentity} from './identitySelection';
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {expect, test} from '@playwright/test';
import {initContext, getGameServerBaseURL, joinMatchViaAPI, seedMatchCredentials, attachPageDiagnostics, assertNoFatalFrontendErrors} from '../helpers/common';
import {getMatchState} from '../helpers/state-injection';
import {createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory, promoteEvidenceScreenshotRun, type EvidenceScreenshotIndexEntry} from '../framework/evidenceScreenshots';
import {GameTransportClient} from '../../src/engine/transport/client';
import {FateDominationDomain, type FateDominationCore, type LocationId} from '../../src/games/fate-domination/domain';
import {resolveFateMovement} from '../../src/games/fate-domination/domain/movement';
import type {MatchState} from '../../src/engine/types';

type State = MatchState<FateDominationCore>;
type Snapshot = {visible: Record<string, unknown>; authoritative: Record<string, unknown>};
type Step = {id: string; action: string; before: Snapshot; after: Snapshot; assertions: Array<{name: string; actual: unknown; expected: unknown}>};
type UIChange = NonNullable<EvidenceScreenshotIndexEntry['uiChange']>;
const CHAIN = 'fate-online-natural-basic-match';
const choosePair = (state: State, playerId: string) => {
    const player = state.core.players[playerId];
    for (let a = 0; a < player.hand.length; a++) for (let b = a + 1; b < player.hand.length; b++) for (const mask of [0, 1, 2, 3]) {
        const cardIds = [player.hand[a].id, player.hand[b].id];
        const payload = {cardIds, faceDownIds: cardIds.filter((_, i) => Boolean(mask & (1 << i))), round: state.core.round};
        if (FateDominationDomain.validate(state, {type: 'CONFIRM_ATTACK', playerId, payload}).valid) return payload;
    }
};
const destinationFor = (state: State, playerId: string) => (state.core.round === 1 ? ['workshop', 'miyama', 'shinto'] : ['miyama', 'shinto', 'workshop']).find(locationId =>
    FateDominationDomain.validate(state, {type: 'DEPLOY_MASTER', playerId, payload: {locationId: locationId as LocationId}}).valid)!;

test.use({actionTimeout: 15000, trace: 'retain-on-failure', viewport: {width: 1920, height: 1080}});

test('真实联网自然基础对局：浏览器主视角及两名正式传输客户端，多轮至终局（无中途注入）', async ({page, context}, testInfo) => {
    test.setTimeout(1200000);
    await initContext(context, {skipImageGate: false});
    const diagnostics = attachPageDiagnostics(page);
    const peers: Record<string, GameTransportClient> = {};
    const peerErrors: string[] = [];
    const steps: Step[] = [];
    const shots: Array<{path: string; id: string; stepId: string; description: string; change: UIChange}> = [];
    const run = await createEvidenceScreenshotRun(testInfo, {requireChineseName: true});
    const digest = createHash('sha256');
    const files = readdirSync('src/games/fate-domination', {recursive: true}).map(String).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => path.join('src/games/fate-domination', file));
    for (const file of [...files, 'e2e/fate-domination/online-basic-match.e2e.ts', 'public/assets/i18n/zh-CN/fate-domination/assets-manifest.json'].sort()) digest.update(file).update('\0').update(readFileSync(file)).update('\0');
    const sourceRevision = `${execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim()}+tree-sha256:${digest.digest('hex')}`;
    let matchId = '';
    let postBattleChoices = 0;
    let capturedPostBattle = false;
    let usedMovement = false;
    let usedSeal = false;
    let usedMaster = false;
    let firstDraft = true;
    const rounds = new Set<number>();
    try {
        const guestId = `fate-network-${Date.now()}`;
        const response = await page.request.post(`${getGameServerBaseURL()}/games/fate-domination/create`, {data: {numPlayers: 3, setupData: {guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest'}}});
        expect(response.ok()).toBe(true);
        const created = await response.json();
        matchId = created.matchID;
        expect(matchId).toBeTruthy();
        const credentials: string[] = [];
        for (let index = 0; index < 3; index++) credentials.push(index === 0 && created.ownerCredentials ? created.ownerCredentials
            : await joinMatchViaAPI(page, 'fate-domination', matchId, String(index), `Fate-P${index}`, index === 0 ? guestId : `${guestId}-${index}`));
        await seedMatchCredentials(context, 'fate-domination', matchId, '0', credentials[0]);
        for (const id of ['1', '2']) {
            peers[id] = new GameTransportClient({server: getGameServerBaseURL(), matchID: matchId, playerID: id, credentials: credentials[Number(id)], onError: error => peerErrors.push(`${id}:${error}`)});
            peers[id].connect();
        }
        await expect.poll(() => Object.values(peers).every(client => client.isConnected && client.latestState), {timeout: 30000}).toBe(true);
        // 复用本轮真实入座凭证，避免每次轮询都跨浏览器重新读取同一份凭证。
        const read = async () => await getMatchState(matchId, undefined, {playerId: '0', credentials: credentials[0]}) as State;
        const snapshot = async (): Promise<Snapshot> => {
            const [state, visible, gameOverVisible] = await Promise.all([read(), page.evaluate(() => {
                return {url: location.href,
                    primaryLabel: document.querySelector('[data-testid="fate-domination-primary-action"]')?.getAttribute('aria-label') ?? null,
                    dialogCount: document.querySelectorAll('[role="dialog"]').length,
                    stagedCards: document.querySelectorAll('[data-card-zone="staged"], [data-card-zone="staged-skill"]').length};
            }), page.getByRole('region', {name: '圣杯战争结果'}).isVisible()]);
            return {authoritative: {round: state.core.round, phase: state.core.phase, currentPlayerId: state.core.currentPlayerId,
                players: Object.fromEntries(state.core.playerIds.map(id => [id, {mana: state.core.players[id].mana, commandSpells: state.core.players[id].commandSpells,
                    locationId: state.core.players[id].locationId, normalAttackPlayed: state.core.players[id].normalAttackPlayed,
                    selectedAttackIds: state.core.players[id].selectedAttackIds, activeAttackIds: state.core.players[id].activeAttackIds, eliminated: state.core.players[id].eliminated}])),
                gameOver: Boolean(state.sys.gameover)}, visible: {...visible, gameOver: gameOverVisible}};
        };
        const record = async (action: string, fn: () => Promise<void>, assertion = 'completed-real-input') => {
            const before = await snapshot();
            await fn();
            const after = await snapshot();
            const item = {id: `step-${String(steps.length + 1).padStart(3, '0')}`, action, before, after, assertions: [{name: assertion, actual: true, expected: true}]};
            steps.push(item);
            if(steps.length % 20 === 0) console.log(`[Fate online] 已完成 ${steps.length} 个实际输入步骤`);
            return item.id;
        };
        const capture = async (description: string, change: UIChange = 'interaction-mode') => {
            const file = getEvidenceScreenshotPathInDirectory(run.stagingDir, `${description}.jpg`, {requireChineseName: true});
            await mkdir(path.dirname(file), {recursive: true});
            await page.mouse.move(8, 8);
            await page.screenshot({path: file, fullPage: false, animations: 'disabled'});
            shots.push({path: file, id: `ui-${shots.length + 1}`, stepId: steps.at(-1)!.id, description, change});
        };
        const sendPeer = async (id: string, type: string, payload: object = {}) => {
            const before = JSON.stringify((await read()).core);
            const version = peers[id].lastReceivedStateID;
            await record(`测试玩家${Number(id) + 1}通过正式网络提交${type}`, async () => {
                expect(peers[id].sendCommand(type, payload)).toBe(true);
                await expect.poll(() => peers[id].lastReceivedStateID, {timeout: 15000}).toBeGreaterThan(version);
                await expect.poll(async () => JSON.stringify((await read()).core), {timeout: 15000}).not.toBe(before);
            }, 'peer-command-accepted');
        };
        const clickPrimary = async () => {
            const before = JSON.stringify((await read()).core);
            await record('主视角点击当前阶段推进或确认', async () => {
                const button = page.getByTestId('fate-domination-primary-action');
                await expect(button).toBeEnabled();
                await button.click();
                await expect.poll(async () => JSON.stringify((await read()).core), {timeout: 15000}).not.toBe(before);
            }, 'primary-changes-authoritative-core');
        };
        await page.goto(`/play/fate-domination/match/${matchId}?playerID=0`, {waitUntil: 'domcontentloaded'});
        await expect(page.getByTestId('fate-domination-board')).toBeVisible({timeout: 45000});
        await record('真实浏览器选择韦伯与伊斯坎达尔', async () => {
            const setup = page.getByRole('region', {name: '选择御主与从者'});
            await chooseFateIdentity(page,'master','m_waver');
            await expect.poll(async () => (await read()).core.players['0'].masterId).toBe('m_waver');
            await chooseFateIdentity(page,'servant','servant-rider');
            await expect.poll(async () => (await read()).core.players['0'].servantId).toBe('servant-rider');
        });
        await capture('主视角真实联网选角准备', 'panel');
        await clickPrimary();
        await sendPeer('1', 'ADVANCE_PHASE'); await sendPeer('2', 'ADVANCE_PHASE');
        await capture('三名真实客户端准备完成', 'layout');
        while (!(await read()).sys.gameover && steps.length < 450) {
            const state = await read(); const core = state.core;
            if (!rounds.has(core.round)) console.log(`[Fate online] 第 ${core.round} 轮 ${core.phase}`);
            rounds.add(core.round);
            const choice = state.sys.interaction.current;
            if (choice) {
                if (choice.playerId === '0') {
                    await record('主视角选择战后恢复令咒但尚未确认', async () => {
                        const dialog = page.getByRole('dialog', {name: '战后恢复令咒'});
                        await expect(dialog).toBeVisible();
                        await dialog.getByRole('button', {name: /恢复.*令咒/}).first().click();
                    });
                    if(!capturedPostBattle){await capture('战后恢复令咒等待确认', 'panel');capturedPostBattle=true;}
                    await record('主视角确认战后恢复令咒', async () => {
                        const dialog = page.getByRole('dialog', {name: '战后恢复令咒'});
                        await dialog.getByRole('button', {name: '确认选择', exact: true}).click();
                        await expect.poll(async () => (await read()).sys.interaction.current?.id).not.toBe(choice.id);
                    });
                } else {
                    const option = (choice.data as {options: Array<{id: string; disabled?: boolean}>}).options.find(item => !item.disabled)!;
                    const version = peers[choice.playerId].lastReceivedStateID;
                    await record('测试玩家通过真实网络确认战后选择', async () => {
                        expect(peers[choice.playerId].sendCommand('SYS_INTERACTION_RESPOND', {interactionId: choice.id, optionId: option.id})).toBe(true);
                        await expect.poll(() => peers[choice.playerId].lastReceivedStateID).toBeGreaterThan(version);
                        await expect.poll(async () => (await read()).sys.interaction.current?.id).not.toBe(choice.id);
                    });
                }
                postBattleChoices++; continue;
            }
            const id = core.currentPlayerId; const actor = core.players[id];
            if (id !== '0') {
                if (core.phase === 'outpost' && !actor.locationId) await sendPeer(id, 'DEPLOY_MASTER', {locationId: destinationFor(state, id)});
                else if (core.phase === 'action' && !actor.normalAttackPlayed && choosePair(state, id)) await sendPeer(id, 'CONFIRM_ATTACK', choosePair(state, id));
                else if (core.phase === 'battle' && core.battleResolution?.step === 'locations') await sendPeer(id, 'RESOLVE_LOCATION', {locationId: core.battleResolution.locationIds.find(location => !core.resolvedLocations.includes(location))});
                else await sendPeer(id, core.phase === 'action' ? 'PASS_ACTION' : 'ADVANCE_PHASE');
                continue;
            }
            if (core.phase === 'outpost' && !actor.locationId) {
                const destination = destinationFor(state, id);
                await record('主视角在印刷地图上部署', async () => {
                    await page.getByTestId(`fate-domination-location-${destination}`).click();
                    expect((await read()).core.players[id].locationId).toBeNull();
                    await clickPrimary();
                    await expect.poll(async () => (await read()).core.players[id].locationId).toBe(destination);
                });
                if (!usedMaster) {
                    await record('牌桌御主能力入口可用', async () => {await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', {name: '发动战略部署'})).toBeEnabled();});
                    await capture('御主能力位于本人角色旁', 'panel');
                    const oldHand = (await read()).core.players[id].hand.length;
                    await record('主视角实际发动战略部署', async () => {await page.getByRole('button', {name: '发动战略部署'}).click(); await expect.poll(async () => (await read()).core.players[id].hand.length).toBe(oldHand + 2);});
                    usedMaster = true;
                }
                await clickPrimary(); continue;
            }
            if (core.phase === 'action' && !actor.normalAttackPlayed) {
                if (!usedMovement && actor.locationId === 'workshop' && resolveFateMovement(core, id, 'miyama').valid) {
                    const cost = resolveFateMovement(core, id, 'miyama').cost!;
                    const start = page.getByRole('button', {name: '从魔术工房开始常规移动'});
                    await record('主视角选择常规移动目标但尚未提交', async () => {await start.click(); await page.getByTestId('fate-domination-location-miyama').click(); expect((await read()).core.players[id].locationId).toBe('workshop');});
                    await capture('常规移动目标等待确认', 'target-highlight');
                    await record('主视角取消移动且资源不变', async () => {await page.getByRole('button', {name: '取消移动', exact: true}).click(); expect((await read()).core.players[id].mana).toBe(actor.mana);});
                    await start.click(); await page.getByTestId('fate-domination-location-miyama').click(); await clickPrimary();
                    expect((await read()).core.players[id].mana).toBe(actor.mana - cost);
                    await capture('常规移动确认并按费用结算', 'layout');
                    await record('选择令咒移动目的地', async () => {await page.getByRole('button', {name: '使用令咒', exact: true}).click(); await page.getByRole('button', {name: '令咒移动', exact: false}).click(); await page.getByTestId('fate-domination-location-workshop').click();});
                    await capture('令咒移动等待确认', 'target-highlight');
                    const seal = (await read()).core.players[id]; await clickPrimary();
                    expect((await read()).core.players[id].commandSpells).toBe(seal.commandSpells - 1); expect((await read()).core.players[id].mana).toBe(seal.mana);
                    usedMovement = true; continue;
                }
                if (!usedSeal) {
                    await record('令咒恢复魔力选择待确认', async () => {await page.getByRole('button', {name: '使用令咒', exact: true}).click(); await page.getByRole('button', {name: '恢复魔力', exact: false}).click();});
                    await capture('令咒恢复魔力等待确认', 'panel');
                    const seal = (await read()).core.players[id];
                    await record('主视角确认消耗令咒', async () => {await page.getByRole('button', {name: '确认使用'}).click(); await expect.poll(async () => (await read()).core.players[id].commandSpells).toBe(seal.commandSpells - 1);});
                    usedSeal = true; continue;
                }
                const pair = choosePair(state, id);
                if (pair) {
                    await record('主视角选择两张客户端草稿', async () => {
                        for (const cardId of pair.cardIds) {const mode = page.getByRole('button', {name: '暗置选牌', exact: true}); if ((await mode.getAttribute('aria-pressed') === 'true') !== pair.faceDownIds.includes(cardId)) await mode.click(); await page.locator(`[data-card-id="${cardId}"][data-card-zone="hand"]`).click();}
                        expect((await read()).core.players[id].selectedAttackIds).toEqual([]); expect((await read()).core.players[id].mana).toBe(actor.mana);
                    }, 'draft-does-not-change-authoritative-selection');
                    if (firstDraft) {
                        await capture('真实联网两张草稿尚未提交');
                        await record('主视角撤回一张草稿', async () => {await page.locator(`[data-card-id="${pair.cardIds[0]}"][data-card-zone="staged"]`).click(); expect((await read()).core.players[id].selectedAttackIds).toEqual([]);});
                        await capture('草稿撤回后权威状态保持不变');
                        const mode = page.getByRole('button', {name: '暗置选牌', exact: true}); if ((await mode.getAttribute('aria-pressed') === 'true') !== pair.faceDownIds.includes(pair.cardIds[0])) await mode.click();
                        await page.locator(`[data-card-id="${pair.cardIds[0]}"][data-card-zone="hand"]`).click();
                    }
                    await clickPrimary(); await expect.poll(async () => (await read()).core.players[id].normalAttackPlayed).toBe(true);
                    if (firstDraft) {await capture('原子确认后正式攻击生效'); firstDraft = false;}
                    continue;
                }
            }
            const phase = core.phase; await clickPrimary();
            if (core.round === 1 && (await read()).core.phase !== phase) await capture(`首轮${phase === 'battle' ? '战斗' : phase === 'action' ? '行动' : '前哨'}阶段推进`, 'layout');
        }
        const final = await read();
        expect(final.core.phase).toBe('complete'); expect(final.core.round).toBeGreaterThanOrEqual(2); expect(final.core.round).toBeLessThanOrEqual(11);
        expect(final.sys.gameover).toEqual(final.core.gameResult); expect(rounds.size).toBe(final.core.round); expect(usedMovement).toBe(true);
        await expect(page.getByRole('region', {name: '圣杯战争结果'})).toBeVisible();
        for (const client of Object.values(peers)) await expect.poll(() => (client.latestState as State).sys.gameover).toEqual(final.sys.gameover);
        const terminal = await snapshot();
        expect(Boolean(final.sys.gameover) && terminal.visible.gameOver === true, '正式终局必须同时满足权威结果与浏览器可见').toBe(true);
        steps.push({id: 'terminal', action: '主视角与两名网络玩家收到同一权威终局', before: steps.at(-1)!.after, after: terminal, assertions: [{name: 'terminal-gameover', actual: Boolean(final.sys.gameover) && terminal.visible.gameOver === true, expected: true}]});
        await capture('真实联网多轮对局正式终局', 'panel');
        expect(peerErrors).toEqual([]); assertNoFatalFrontendErrors([{label: 'Fate-main-browser', diagnostics}]);
        const uiStates = shots.map(shot => ({id: shot.id, stepId: shot.stepId, change: shot.change, viewport: 'desktop', sha256: createHash('sha256').update(readFileSync(shot.path)).digest('hex')}));
        const evidence = {gameId: 'fate-domination', evidenceCategory: 'golden', chainId: CHAIN, sourceRun: run.runId, sourceRevision, browserContextId: `${matchId}:player-0-browser`,
            status: 'PASS', outcome: '真人主视角浏览器与两名正式网络客户端从选角自然推进多轮至共同终局，无中途状态注入；两名测试玩家只提交正式合法命令，不代表策略AI。',
            matchId, covered: {rounds: [...rounds], postBattleChoices, capturedPostBattle, eliminated: final.core.playerIds.filter(id => final.core.players[id].eliminated)}, steps, terminalStepId: 'terminal', uiStates};
        await writeFile(path.join(run.stagingDir, 'online-basic-match.trace.json'), JSON.stringify(evidence, null, 2));
        await promoteEvidenceScreenshotRun(run, {gameId: 'fate-domination', evidenceCategory: 'golden', capturePolicy: 'distinct-ui-state', media: shots.map((shot, index) => ({
            path: path.relative(process.cwd(), path.join(run.stableDir, path.basename(shot.path))).replace(/\\/g, '/'), chainId: CHAIN, chainStep: String(index + 1).padStart(2, '0'),
            stage: '独特界面态', role: 'main-flow', viewport: 'desktop', transition: shot.description, description: shot.description, uiStateId: shot.id, uiChange: shot.change,
            uiChangeReason: shot.description, behaviorStepId: shot.stepId, sourceRevision, requirements: ['真实联网主视角从选角自然推进多轮至终局', '草稿与移动选择仅在确认后提交权威状态', '御主能力和令咒通过正式界面操作'],
        }))});
    } finally {
        await writeFile(testInfo.outputPath('联网采集账本.json'), JSON.stringify({matchId, steps, shots, postBattleChoices}, null, 2));
        Object.values(peers).forEach(client => client.disconnect());
    }
});
