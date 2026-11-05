import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {expect, test} from '@playwright/test';
import {createSeededRandom, executePipeline} from '../../src/engine';
import type {Command, MatchState} from '../../src/engine/types';
import {GameTransportClient} from '../../src/engine/transport/client';
import {FateDominationDomain, type FateDominationCore} from '../../src/games/fate-domination/domain';
import {FATE_EVENTS, FATE_SITUATIONS} from '../../src/games/fate-domination/data';
import {engineConfig} from '../../src/games/fate-domination/game';
import {initContext, getGameServerBaseURL, joinMatchViaAPI, seedMatchCredentials, attachPageDiagnostics, assertNoFatalFrontendErrors} from '../helpers/common';
import {getMatchState, injectMatchState} from '../helpers/state-injection';
import {createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory, promoteEvidenceScreenshotRun} from '../framework/evidenceScreenshots';

type State = MatchState<FateDominationCore>;
const ids = ['0', '1', '2'];
const CAPTURE_STEPS = new Set((process.env.FATE_POST_BATTLE_CAPTURE_STEPS ?? '').split(',').filter(Boolean));

/** 与领域测试相同的中文E12代表态；选择事务和frame由正式pipeline生成。 */
function pendingPostBattle(round: number, initial: State) {
    const random = createSeededRandom('post-battle-choice');
    let state: State = structuredClone(initial);
    const selected = executePipeline({domain: FateDominationDomain, systems: engineConfig.systems}, state, {type: 'SELECT_MASTER', playerId: '2', payload: {masterId: 'm_waver'}}, random, ids);
    expect(selected.success).toBe(true); state = selected.state;
    state.core.phase = 'battle'; state.core.round = round;
    state.core.situation = FATE_SITUATIONS.find(card => card.id === (round === 10 ? 'sit12' : 'sit13'))!;
    state.core.situationDeck = []; state.core.situationDeckCount = 0;
    state.core.initialAttackHandDealtPlayerIds = [...ids];
    state.core.pendingChoice = {kind: null};
    for (const player of Object.values(state.core.players)) {
        player.eliminated = round === 11 && player.id === '2';
        player.locationId = player.eliminated ? null : player.id === '2' ? 'workshop' : 'miyama'; player.deploymentSlot = player.id === '2' && !player.eliminated ? 0 : null;
        player.hand = player.deck.splice(0, 3);
        player.commandSpells = 2; player.mana = 0;
        player.victoryPoints = player.id === '0' ? 50 : player.id === '1' ? 20 : 0;
    }
    const objective = FATE_EVENTS.find(card => card.id === 'fuyuki_E12')!;
    const extras = FATE_EVENTS.filter(card => ['fuyuki_E3', 'fuyuki_E4'].includes(card.id)).slice(0, round === 10 ? 1 : 2);
    state.core.currentEvents = {miyama: [objective, ...extras], shinto: [FATE_EVENTS.find(card => card.id === 'fuyuki_E5')!]};
    const displayed = [...state.core.currentEvents.miyama, ...state.core.currentEvents.shinto];
    state.core.eventDeck = FATE_EVENTS.filter(card => !displayed.some(item => item.id === card.id));
    state.core.eventDiscard = []; state.core.eventDeckCount = state.core.eventDeck.length; state.core.eventDiscardCount = 0;
    state.core.miyamaEvent = objective;
    state.core.battlefield.miyama = {...state.core.battlefield.miyama, playerIds: ['0', '1'], eventCards: state.core.currentEvents.miyama};
    state.core.battlefield.shinto = {...state.core.battlefield.shinto, playerIds: [], eventCards: state.core.currentEvents.shinto};
    state.core.battlefield.workshop.playerIds = round === 10 ? ['2'] : [];
    expect(new Set([...displayed, ...state.core.eventDeck].map(card => card.id)).size).toBe(FATE_EVENTS.length);
    const apply = (command: Command) => {
        const result = executePipeline({domain: FateDominationDomain, systems: engineConfig.systems}, state, command, random, ids);
        expect(result.success, `${command.type}: ${result.error ?? ''}`).toBe(true); state = result.state;
    };
    for (const playerId of ids.filter(id => !state.core.players[id].eliminated)) apply({type: 'ADVANCE_PHASE', playerId, payload: {}});
    for (const locationId of ['miyama', 'shinto', 'recon']) apply({type: 'RESOLVE_LOCATION', playerId: state.core.currentPlayerId, payload: {locationId}});
    expect(state.sys.interaction.current?.playerId).toBe('0');
    expect(state.sys.gameover).toBeUndefined();
    // 测试注入API的通用schema仍要求这两个字段；Fate运行时顺位只消费core。
    Object.assign(state.sys, {turnOrder: [...state.core.turnOrder], currentPlayerIndex: state.core.currentTurnIndex});
    return state;
}

test.use({viewport: {width: 1366, height: 768}, actionTimeout: 15000});
for (const round of [10, 11]) test(`真实联网战后选择先收口再${round === 10 ? '淘汰' : '终局'}（合法pipeline代表态）`, async ({page, context}, testInfo) => {
    test.setTimeout(180000);
    await initContext(context, {skipImageGate: false});
    const diagnostics = attachPageDiagnostics(page);
    const run = await createEvidenceScreenshotRun(testInfo, {requireChineseName: true});
    const chainId = `fate-online-post-battle-${round}${CAPTURE_STEPS.size ? '-targeted-recapture' : ''}`;
    const digest = createHash('sha256');
    for (const file of readdirSync('src/games/fate-domination', {recursive: true}).map(String).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => path.join('src/games/fate-domination', file)).concat('e2e/fate-domination/online-post-battle.e2e.ts').sort()) digest.update(file).update('\0').update(readFileSync(file)).update('\0');
    const sourceRevision = `${execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim()}+tree-sha256:${digest.digest('hex')}`;
    const guestId = `fate-post-${Date.now()}`;
    const response = await page.request.post(`${getGameServerBaseURL()}/games/fate-domination/create`, {data: {numPlayers: 3, setupData: {guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest'}}});
    expect(response.ok()).toBe(true);
    const created = await response.json(); const matchId = created.matchID as string;
    const credential = created.ownerCredentials ?? await joinMatchViaAPI(page, 'fate-domination', matchId, '0', '战后主视角', guestId);
    const peerCredential = await joinMatchViaAPI(page, 'fate-domination', matchId, '1', '战后第二席', `${guestId}-peer`);
    const observerCredential = await joinMatchViaAPI(page, 'fate-domination', matchId, '2', '淘汰观察席', `${guestId}-observer`);
    const access = {playerId: '0', credentials: credential};
    await seedMatchCredentials(context, 'fate-domination', matchId, '0', credential);
    // 只在浏览器和网络观察者连接前注入，后续一律正式UI/网络命令。
    await injectMatchState(matchId, pendingPostBattle(round, await getMatchState(matchId, undefined, access) as State), undefined, access);
    const errors: string[] = [];
    const peer = new GameTransportClient({server: getGameServerBaseURL(), matchID: matchId, playerID: '1', credentials: peerCredential, onError: error => errors.push(error)});
    const steps: Array<Record<string, unknown>> = [];
    const shots: Array<{path: string; stepId: string; name: string}> = [];
    const read = async () => await getMatchState(matchId, undefined, access) as State;
    const snapshot = async () => {
        const [state, visible, gameOverVisible] = await Promise.all([read(), page.evaluate(() => ({url: location.href,
            choiceVisible: Boolean(document.querySelector('[role="dialog"][aria-label="战后恢复令咒"]')),
            eliminatedLabels: Array.from(document.querySelectorAll('.fd-eliminated-status')).map(element => element.textContent)})), page.getByRole('region', {name: '圣杯战争结果'}).isVisible()]);
        return {visible: {...visible, gameOver: gameOverVisible}, authoritative: {round: state.core.round, phase: state.core.phase, gameOver: Boolean(state.sys.gameover), interactionId: state.sys.interaction.current?.id ?? null,
            interactionPlayer: state.sys.interaction.current?.playerId ?? null, seals: state.core.players['0'].commandSpells, thirdEliminated: state.core.players['2'].eliminated}};
    };
    const record = async (id: string, action: string, fn: () => Promise<void>) => {
        const before = await snapshot(); await fn(); const after = await snapshot();
        steps.push({id, action, before, after, assertions: [{name: id, actual: true, expected: true}]});
    };
    const capture = async (name: string, stepId: string) => {
        if (CAPTURE_STEPS.size && !CAPTURE_STEPS.has(stepId)) return;
        const file = getEvidenceScreenshotPathInDirectory(run.stagingDir, `${name}.jpg`, {requireChineseName: true});
        await page.screenshot({path: file, fullPage: false, animations: 'disabled'}); shots.push({path: file, name, stepId});
    };
    try {
        peer.connect(); await expect.poll(() => peer.isConnected && peer.latestState).toBeTruthy();
        await record('open-choice', '从正式联网页面进入预置的战后选择起点', async () => {
            await page.goto(`/play/fate-domination/match/${matchId}?playerID=0`, {waitUntil: 'domcontentloaded'});
            const dialog = page.getByRole('dialog', {name: '战后恢复令咒'}); await expect(dialog).toBeVisible({timeout: 45000});
            await dialog.getByRole('button', {name: /恢复.*令咒/}).first().click();
            expect((await read()).core.players['0'].commandSpells).toBe(2); expect((await read()).sys.gameover).toBeUndefined();
            await expect(page.getByTestId('fate-domination-primary-action')).toBeDisabled();
        });
        await capture('战后恢复令咒等待本人确认', 'open-choice');
        await record('confirm-own-choice', '主视角实际确认恢复令咒，仍等待下一席', async () => {
            await page.getByRole('dialog', {name: '战后恢复令咒'}).getByRole('button', {name: '确认选择', exact: true}).click();
            await expect.poll(async () => (await read()).sys.interaction.current?.playerId).toBe('1');
            const state = await read(); expect(state.core.players['0'].commandSpells).toBe(3); expect(state.core.players['2'].eliminated).toBe(round === 11); expect(state.sys.gameover).toBeUndefined();
            await expect(page.getByTestId('fate-domination-primary-action')).toBeDisabled();
        });
        await capture('本人完成选择后仍等待第二席', 'confirm-own-choice');
        await record('complete-peer-choice', '第二席经正式传输确认放弃，最后选择完成才进入淘汰或终局', async () => {
            const choice = (await read()).sys.interaction.current!;
            await expect.poll(() => (peer.latestState as State).sys.interaction.current?.id).toBe(choice.id);
            expect(peer.sendCommand('SYS_INTERACTION_RESPOND', {interactionId: choice.id, optionId: 'decline'})).toBe(true);
            await expect.poll(async () => (await read()).sys.interaction.current).toBeUndefined();
            const state = await read(); expect(state.core.players['1'].commandSpells).toBe(2);
            if (round === 10) {
                expect(state.core.round).toBe(11); expect(state.core.players['2'].eliminated).toBe(true); expect(state.sys.gameover).toBeUndefined();
                await expect(page.locator('.fd-runtime-player-rail [aria-description="已淘汰"] > .fd-avatar-elimination')).toBeVisible();
            } else {
                expect(state.core.phase).toBe('complete'); expect(state.sys.gameover).toEqual(state.core.gameResult);
                await expect(page.getByRole('region', {name: '圣杯战争结果'})).toBeVisible();
            }
        });
        await capture(round === 10 ? '全部战后选择后才显示淘汰状态' : '全部战后选择后才显示正式终局', 'complete-peer-choice');
        if (round === 10) {
            await record('inspect-eliminated', '从淘汰席位打开详情核对状态', async () => {
                await page.getByRole('button', {name: '查看淘汰观察席详情'}).click();
                await expect(page.getByRole('dialog').getByText('已淘汰', {exact: true})).toBeVisible();
            });
            await capture('淘汰玩家详情明确显示已淘汰', 'inspect-eliminated');
            await record('observe-eliminated', '用该席真实凭证进入淘汰后的本人观战视角', async () => {
                await seedMatchCredentials(context, 'fate-domination', matchId, '2', observerCredential);
                await page.goto(`/play/fate-domination/match/${matchId}?playerID=2`, {waitUntil: 'domcontentloaded'});
                await expect(page.getByLabel('本人席位').locator('[aria-description="已淘汰，观战中"] .fd-avatar-elimination')).toBeVisible();
                await expect(page.getByTestId('fate-domination-primary-action')).toBeDisabled();
                await expect(page.getByRole('button', {name: '使用令咒', exact: true})).toBeDisabled();
                await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', {timeout: 45000});
                await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
            });
            await capture('淘汰本人进入观战且不能继续行动', 'observe-eliminated');
        }
        expect(errors).toEqual([]); assertNoFatalFrontendErrors([{label: chainId, diagnostics}]);
        if (CAPTURE_STEPS.size) expect(shots.map(shot => shot.stepId).sort()).toEqual([...CAPTURE_STEPS].sort());
        const trace = {gameId: 'fate-domination', evidenceCategory: 'independent', chainId, sourceRun: run.runId, sourceRevision, status: 'PASS',
            outcome: '中文事件战后选择经真实浏览器和正式网络第二席完成；选择前不提前清场、淘汰或终局，最后一项响应后才收口。',
            fixtureBoundary: {kind: 'pipeline-generated-post-battle-representative-fixture', injectedBeforeBrowserConnection: true, naturalFlowClaim: false, round, history: '分数、资源和无地利的在场起点为代表态前提；未声称此前十轮自然形成。高潮局势、地点限制、初始手牌和事件区域守恒显式构造，第三席为无士郎免淘汰能力的韦伯；第十一轮起点第三席已在上一轮淘汰。'}, steps,
            uiStates: shots.map(shot => ({id: `${chainId}-${shot.stepId}`, stepId: shot.stepId, change: 'panel', viewport: 'desktop', sha256: createHash('sha256').update(readFileSync(shot.path)).digest('hex')}))};
        await writeFile(path.join(run.stagingDir, `${chainId}.trace.json`), JSON.stringify(trace, null, 2));
        await promoteEvidenceScreenshotRun(run, {gameId: 'fate-domination', evidenceCategory: 'independent', capturePolicy: 'distinct-ui-state', media: shots.map((shot, index) => ({
            path: path.relative(process.cwd(), path.join(run.stableDir, path.basename(shot.path))).replace(/\\/g, '/'), chainId, chainStep: String(index + 1).padStart(2, '0'), stage: '独特界面态', role: 'main-flow', viewport: 'desktop',
            transition: shot.name, description: shot.name, uiStateId: `${chainId}-${shot.stepId}`, uiChange: 'panel', uiChangeReason: shot.name, behaviorStepId: shot.stepId, sourceRevision,
            requirements: [round === 10 ? '战后选择全部完成后才按中文规则淘汰并显示淘汰状态' : '末轮战后选择全部完成后才设置系统终局并展示结果'],
        }))});
    } finally {peer.disconnect();}
});
