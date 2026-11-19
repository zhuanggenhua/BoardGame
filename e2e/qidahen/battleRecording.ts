import { appendFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { BattleCaptureDiagnosticsError, createBattleCaptureDiagnostics, type CaptureMode } from './battleCaptureDiagnostics';
import { countNewResultInk } from './battleFramePixels';

type Bounds = { left: number; top: number; width: number; height: number };
type State = { regionTipVisible: boolean; at: number; phase: string | null; state: string | null; text: string; activeUnits: Array<{ side: string | null; pieceId: string }>; armyFaces: Array<{ id: string | null; face: string | null; imageReady: boolean; hiddenBack: boolean }>; labels: Array<{ id: string | null; text: string; color: string; fill: string; font: string; visibility: string; opacity: string; left: number; top: number; width: number; height: number }>; surfaces: Array<{ id: string | null; background: string; borderWidths: string[] }>; layout?: { panel: Bounds | null; regions: Bounds[]; objects: Bounds[]; diceAreas: Bounds[] }; dice: Array<{ type: string | null; settled: string | null; ready: string | null; failure: string | null }> };

/** 只观察正式页面：连续采集实际视口，按墙钟间隔编码，不注入或重演投掷。 */
export async function beginBattleRecording(page: Page, directory: string, flow: 'natural-flow' | 'representative-state' = 'natural-flow') {
    // 仅诊断时采集同一真实页面的 CPU 栈，不更改截图缓存或战斗流程。
    const cpuProfiler = process.env.QIDAHEN_BATTLE_CPU_PROFILE === 'true' ? await page.context().newCDPSession(page) : undefined;
    if (cpuProfiler) {
        await cpuProfiler.send('Profiler.enable');
        await cpuProfiler.send('Profiler.setSamplingInterval', { interval: 1000 });
        await cpuProfiler.send('Profiler.start');
    }
    const requestedDiagnostics = process.env.QIDAHEN_BATTLE_CAPTURE_DIAGNOSTICS;
    if (requestedDiagnostics && requestedDiagnostics !== 'sync' && requestedDiagnostics !== 'queued') throw new Error('Invalid battle capture diagnostics mode');
    const diagnosticMode = requestedDiagnostics as CaptureMode | undefined;
    const participants = await page.evaluate(() => {
        const core = (window as any).__BG_TEST_HARNESS__.state.get().core;
        const battle = core.pendingTargetAction ?? core.postBattleSelection;
        if (!battle) throw new Error('Recording must begin at a real engagement');
        const defender = battle.defenderFactionId ?? battle.originalController;
        const attackerPieceIds: string[] = battle.selectedPieceIds ?? battle.forceCommitments?.flatMap((force: any) => force.selectedSpecialPieceIds ?? []) ?? [];
        const attackerKinds: Record<string, string> = Object.fromEntries(core.pieces.filter((piece: any) => attackerPieceIds.includes(piece.id))
            .map((piece: any) => [piece.id, piece.troopKind]));
        return { attacker: core.factions[battle.attackerFactionId].name,
            defender: defender === 'neutral' ? battle.defenderLabel ?? battle.originalControlLabel : core.factions[defender].name,
            attackerPieceIds, attackerKinds };
    });
    const frameDirectory = resolve(tmpdir(), 'BoardGame-qidahen-annual-20261030', basename(dirname(directory)), basename(directory), 'battle-frames');
    mkdirSync(frameDirectory, { recursive: true });
    const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
    await page.evaluate(() => {
        const states: State[] = [];
        const sample = () => {
            const panel = document.querySelector<HTMLElement>('[data-testid="qidahen-battle-roll-sequence"]');
            const next: State = { regionTipVisible: document.querySelector('[data-testid="qidahen-map-region-tip"]') != null, at: Date.now() / 1000, phase: panel?.getAttribute('data-battle-roll-phase') ?? null,
                state: panel?.getAttribute('data-battle-roll-state') ?? null, text: panel?.innerText ?? '', armyFaces: [],
                activeUnits: [...(panel?.querySelectorAll('[data-qidahen-arena-active="true"]') ?? [])].flatMap(node =>
                    (node.getAttribute('data-piece-ids') ?? '').split(' ').filter(Boolean)
                        .map(pieceId => ({ side: node.getAttribute('data-qidahen-arena-unit'), pieceId }))),
                labels: [...(panel?.querySelectorAll<HTMLElement>('[data-qidahen-battle-label]') ?? [])].map(element => {
                    const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
                    return { id: element.getAttribute('data-qidahen-battle-label'), text: element.innerText, color: style.color,
                        fill: style.webkitTextFillColor, font: style.font, visibility: style.visibility, opacity: style.opacity,
                        left: rect.left, top: rect.top, width: rect.width, height: rect.height };
                }),
                surfaces: panel ? [panel, ...panel.querySelectorAll('[data-testid^="qidahen-battle-side-"], [data-testid^="qidahen-battle-dice-"]')].map(element => {
                    const style = getComputedStyle(element);
                    return { id: element.getAttribute('data-testid'), background: style.backgroundColor,
                        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth] };
                }) : [],
                dice: [...(panel?.querySelectorAll('[data-dice-physics-source][data-die-type]') ?? [])].map(die => ({
                    type: die.getAttribute('data-die-type'), settled: die.getAttribute('data-dice-settled'),
                    ready: die.getAttribute('data-dice-engine-ready'), failure: die.getAttribute('data-dice-engine-failure'),
                })) };
            const toRect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
            const overlay = document.querySelector('[data-testid="qidahen-battle-roll-overlay"]');
            const regions = [...(panel?.querySelectorAll('[data-testid^="qidahen-battle-side-"]') ?? [])];
            const roster = [...(panel?.querySelectorAll('[data-qidahen-arena-unit]') ?? [])];
            next.armyFaces = roster.flatMap(node => {
                const image = node.querySelector('img');
                const bounds = image?.getBoundingClientRect();
                return (node.getAttribute('data-piece-ids') ?? '').split(' ').filter(Boolean).map(id => ({
                    id, face: 'front', imageReady: Boolean(image?.complete && image.naturalWidth > 0 && bounds && bounds.width > 0 && bounds.height > 0
                        && getComputedStyle(image).visibility !== 'hidden' && getComputedStyle(image).display !== 'none'), hiddenBack: false,
                }));
            });
            const diceAreas = Array.from(panel?.querySelectorAll('[data-dice-physics-source]') ?? [], toRect);
            next.layout = { panel: overlay ? toRect(overlay) : null, regions: regions.map(toRect), objects: roster.map(toRect), diceAreas };
            const previous = states.at(-1);
            if (!previous || JSON.stringify({ ...previous, at: 0 }) !== JSON.stringify({ ...next, at: 0 })) states.push(next);
        };
        const observer = new MutationObserver(sample);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true,
            attributeFilter: ['data-battle-roll-phase', 'data-battle-roll-state', 'data-dice-settled', 'data-dice-engine-ready', 'data-dice-engine-failure'] });
        sample();
        (window as unknown as { __annualBattleObservation: { states: State[]; observer: MutationObserver } }).__annualBattleObservation = { states, observer };
    });
    const batchDiagnostic = process.env.QIDAHEN_BATCH_CLONE_DIAGNOSTIC === 'true'
        ? await (await import('./feedbackBatchedCloneDiagnostic')).startBatchedCloneDiagnostic(page, directory)
        : undefined;
    // 独立录制诊断：关闭本模块的 CDP screencast，交由 Playwright 原生视频记录真实页面。
    // 此路径明确失败退出，绝不能替代完整链或原采集合同的验收结果。
    if (process.env.QIDAHEN_DESKTOP_VIDEO_DIAGNOSTIC === 'true') {
        const needle = `QidahenBattleDiagnostic-${process.pid}`;
        const previousTitle = await page.title();
        await page.evaluate(title => { document.title = title; }, needle);
        writeFileSync(resolve(directory, 'battle-desktop-title.json'), JSON.stringify({ previousTitle, requestedTitle: needle, actualTitle: await page.title(), workerPid: process.pid }));
        const child = spawn('python', [resolve('e2e/qidahen/desktopBattleCapture.py'), needle, directory, String(process.pid)], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let errorText = '';
        child.stderr?.on('data', data => { errorText += String(data); });
        let exitCode: number | null | undefined;
        const done = new Promise<void>((resolveDone, reject) => {
            child.once('error', reject);
            child.once('exit', code => { exitCode = code; resolveDone(); });
        });
        const ready = resolve(directory, 'battle-desktop-ready.json');
        await expect.poll(() => existsSync(ready) || exitCode !== undefined, { timeout: 15_000 }).toBe(true);
        if (!existsSync(ready)) { await done; throw new Error(`Desktop recording could not start: ${errorText}`); }
        return async () => {
            await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveCount(0);
            writeFileSync(resolve(directory, 'battle-desktop-stop'), 'stop');
            await done;
            if (exitCode !== 0) throw new Error(`Desktop recording failed: ${exitCode} ${errorText}`);
            throw new Error('Desktop window video diagnostic completed; inspect raw recording (not acceptance)');
        };
    }
    if (process.env.QIDAHEN_NATIVE_VIDEO_DIAGNOSTIC === 'true') {
        // 截图仅用于交叉检查真实 damage 状态；该调用可能触发额外合成，不能证明视频连续性。
        const damageCapture = page.waitForSelector('[data-battle-roll-phase="infantry"][data-battle-roll-state="damage"]', { timeout: 30_000 })
            .then(() => page.screenshot({ path: resolve(directory, 'battle-native-infantry-damage-diagnostic.png'), fullPage: false }))
            .then(() => null, error => String(error));
        return async () => {
        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveCount(0);
        const damageCaptureError = await damageCapture;
        const states = await page.evaluate(() => {
            const record = (window as unknown as { __annualBattleObservation: { states: State[]; observer: MutationObserver } }).__annualBattleObservation;
            record.observer.disconnect();
            return record.states;
        });
        writeFileSync(resolve(directory, 'battle-native-video-diagnostic.json'), JSON.stringify({ flow, states, damageCaptureError, screenshotMayTriggerComposite: true, verdict: 'DIAGNOSTIC_ONLY', reason: 'Playwright native video cross-check; not an E2E acceptance' }, null, 2));
        throw new Error('Native video diagnostic completed; inspect the retained Playwright recording (not acceptance)');
        };
    }
    if (diagnosticMode) await page.evaluate(() => {
        const record = { frames: [] as number[], active: true };
        const tick = (timestamp: number) => {
            if (!record.active) return;
            record.frames.push(performance.timeOrigin + timestamp);
            requestAnimationFrame(tick);
        };
        (window as any).__annualBattleRafDiagnostics = record;
        requestAnimationFrame(tick);
    });
    type Frame = { path: string; at: number; startedAt: number; endedAt: number; source: 'screencast' };
    const screencastFrames: Frame[] = [];
    const streamSession = await page.context().newCDPSession(page);
    const traceSession = diagnosticMode === 'queued' ? await page.context().newCDPSession(page) : undefined;
    if (traceSession) {
        await traceSession.send('Tracing.start', { transferMode: 'ReturnAsStream',
            categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8,blink.console' });
        await page.evaluate(() => console.timeStamp(`QIDAHEN_BATTLE_CLOCK_${Date.now()}`));
    }
    // 收到真实合成帧后先确认、再有界排队写盘，避免同步磁盘写入阻塞下一帧。
    const captureSink = createBattleCaptureDiagnostics({
        mode: diagnosticMode ?? 'queued',
        pathForIndex: index => resolve(frameDirectory, `stream-${String(index).padStart(5, '0')}.jpg`),
        ack: sessionId => streamSession.send('Page.screencastFrameAck', { sessionId }),
    });
    streamSession.on('Page.screencastFrame', event => captureSink.receive(event));
    await streamSession.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 });
    // 只用一条带时间戳的合成流。并发全屏截图会卡住合成器，遗漏正在投掷的实帧。
    await expect.poll(() => captureSink.frames.length).toBeGreaterThan(0);
    return async () => {
        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveCount(0);
        if (batchDiagnostic) await batchDiagnostic();
        if (cpuProfiler) {
            const { profile } = await cpuProfiler.send('Profiler.stop');
            writeFileSync(resolve(directory, 'battle-cpu-diagnostic.cpuprofile'), JSON.stringify(profile));
            await cpuProfiler.detach();
        }
        const exitAt = await page.evaluate(() => {
            const record = (window as unknown as { __annualBattleObservation: { states: State[] } }).__annualBattleObservation;
            return record.states.at(-1)!.at;
        });
        await expect.poll(() => captureSink.frames.at(-1)!.at, { timeout: 10_000, message: 'actual composed viewport after dice exit must be captured' }).toBeGreaterThanOrEqual(exitAt);
        await streamSession.send('Page.stopScreencast');
        if (traceSession) {
            await page.evaluate(() => console.timeStamp(`QIDAHEN_BATTLE_END_${Date.now()}`));
            const complete = new Promise<{ stream?: string }>(resolve => traceSession.once('Tracing.tracingComplete', resolve));
            await traceSession.send('Tracing.end');
            const { stream } = await complete;
            if (!stream) throw new Error('Chrome trace stream missing');
            const tracePath = resolve(directory, 'battle-chrome-trace.json');
            writeFileSync(tracePath, '');
            for (;;) {
                const chunk = await traceSession.send('IO.read', { handle: stream });
                appendFileSync(tracePath, chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data);
                if (chunk.eof) break;
            }
            await traceSession.send('IO.close', { handle: stream });
            await traceSession.detach();
        }
        {
            let capture: Awaited<ReturnType<typeof captureSink.finish>>;
            let diagnosticFailure: BattleCaptureDiagnosticsError | undefined;
            try { capture = await captureSink.finish(); }
            catch (error) {
                if (!(error instanceof BattleCaptureDiagnosticsError)) throw error;
                diagnosticFailure = error;
                capture = error.report;
            }
            screencastFrames.push(...capture.frames);
            if (diagnosticMode) {
                const raf = await page.evaluate(() => {
                    const record = (window as any).__annualBattleRafDiagnostics as { frames: number[]; active: boolean };
                    record.active = false;
                    return record.frames;
                });
                writeFileSync(resolve(directory, 'battle-capture-diagnostics.json'), JSON.stringify({ ...capture, raf, failure: diagnosticFailure?.message, rafTimebase: 'UTC milliseconds (page performance time origin + RAF timestamp)' }, null, 2));
            }
            if (diagnosticFailure) throw diagnosticFailure;
        }
        await streamSession.detach();
        const states = await page.evaluate(() => {
            const record = (window as unknown as { __annualBattleObservation: { states: State[]; observer: MutationObserver } }).__annualBattleObservation;
            record.observer.disconnect(); return record.states;
        });
        // 录像和关键帧统一使用同一条带时间戳的真实合成器流。
        const frames = [...screencastFrames].sort((a, b) => a.at - b.at);
        const captureMethod = 'Timestamped same-page compositor stream, with no concurrent full-page screenshot capture';
        expect(frames.every((frame, index) => frame.source === 'screencast' && (index === 0 || frame.at > frames[index - 1].at)), 'video frames use a single strictly ordered timestamped source').toBe(true);
        writeFileSync(resolve(directory, 'battle-recording.json'), JSON.stringify({ frames, states, screencastFrames, timebase: 'UTC seconds; compositor timestamps', captureMethod, flow }, null, 2));
        const video = resolve(directory, 'battle-real-time.webm');
        const encodeOriginalFrames = () => {
            const list = resolve(frameDirectory, 'frames.txt');
            writeFileSync(list, frames.map((frame, index) => `file '${frame.path.replaceAll('\\', '/')}'\noption framerate 1000${index + 1 < frames.length ? '\nduration ' + (frames[index + 1].at - frame.at) : ''}`).join('\n'));
            execFileSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-fps_mode', 'passthrough', '-enc_time_base', '1:1000', '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', video], { stdio: 'ignore', timeout: 90_000 });
        };
        // 诊断运行即使阶段断言失败，也保留同次真实帧编码的视频供私有排查。
        if (diagnosticMode) encodeOriginalFrames();
        expect(frames.length).toBeGreaterThan(15);
        expect(states.flatMap(state => state.dice).filter(die => die.failure)).toEqual([]);
        expect(states.filter(state => state.phase != null && state.regionTipVisible), 'map hover information must leave before battle playback').toEqual([]);
        if (participants.attackerPieceIds.length) {
            for (const phase of ['artillery', 'cavalry', 'infantry']) {
                const expected = participants.attackerPieceIds.filter(id => participants.attackerKinds[id] === phase);
                if (!expected.length) continue;
                const rolling = states.filter(state => state.phase === phase && state.state === 'rolling');
                for (const state of rolling) {
                    const highlighted = state.activeUnits.filter(unit => unit.side === 'attacker').map(unit => unit.pieceId);
                    expect(expected.every(id => highlighted.includes(id)), `${phase}: committed units are highlighted in the attacker row`).toBe(true);
                    expect(highlighted.every(id => !participants.attackerKinds[id] || participants.attackerKinds[id] === phase), `${phase}: other troops remain inactive`).toBe(true);
                }
            }
        }
        const pictures: Array<{ id: string; path: string }> = [];
        const selectedFrames: Array<{ id: string; sourceFrameIndex: number; sourceFramePath: string; captureStartedAt: number; captureEndedAt: number; windowStart: number; windowEnd: number }> = [];
        for (const phase of ['artillery', 'cavalry', 'infantry']) {
            for (const state of ['rolling', 'damage']) {
                const moment = states.find(item => item.phase === phase && item.state === state &&
                    item.dice.length > 0 && item.dice.every(die => die.ready === 'true' && die.settled === (state === 'damage' ? 'true' : 'false')));
                expect(moment, `${phase} ${state} actual physics observation`).toBeDefined();
                const beforeArmies = states.find(item => item.armyFaces.length > 0)!.armyFaces;
                for (const army of beforeArmies) {
                    const visibleArmy = moment!.armyFaces.find(item => item.id === army.id);
                    expect(visibleArmy?.face,
                        'each pre-battle unit remains revealed while dice are rolling').toBe('front');
                    expect(visibleArmy?.imageReady, 'actual front image is loaded, rather than only a front attribute').toBe(true);
                    expect(visibleArmy?.hiddenBack, 'revealed battle units have no hidden-back surface').toBe(false);
                }
                for (const side of ['attacker', 'defender'] as const) {
                    const label = moment!.labels.find(item => item.id === side);
                    if (!label) continue;
                    expect(label.text, 'visible dice role names the actual faction').toContain(participants[side]);
                    const damage = moment!.labels.find(item => item.id === `${side}-damage`);
                    if (state === 'damage' && damage) expect(damage.text, 'visible damage names its recipient').toContain(participants[side === 'attacker' ? 'defender' : 'attacker']);
                }
                for (const label of moment!.labels.filter(label => state === 'damage' || !label.id?.match(/total|damage/))) {
                    expect(label.visibility).toBe('visible');
                    expect(label.opacity).toBe('1');
                    expect(label.color).toBe('rgb(255, 243, 220)');
                    expect(label.fill).toBe(label.color);
                    expect(label.width > 0 && label.height > 0, `${label.id} has actual text bounds`).toBe(true);
                }
                const layout = moment!.layout!;
                const panel = layout.panel!;
                expect(panel, 'actual battle arena bounds').toBeTruthy();
                expect(layout.regions, 'stable attacker and defender sides').toHaveLength(2);
                expect(layout.objects.length, 'both groups show genuine deployed units').toBeGreaterThanOrEqual(2);
                for (const object of layout.objects) {
                    expect(object.left >= panel.left && object.top >= panel.top && object.left + object.width <= panel.left + panel.width
                        && object.top + object.height <= panel.top + panel.height, 'unit faces stay within the arena').toBe(true);
                    for (const dice of layout.diceAreas) expect(object.top + object.height - 1 <= dice.top, 'dice render below the unit row').toBe(true);
                }
                const end = states.find(item => item.at > moment!.at && (item.phase !== phase || item.state !== state || item.dice.length === 0 || item.dice.some(die => die.ready !== 'true' || die.settled !== (state === 'damage' ? 'true' : 'false'))));
                expect(end, phase + ' ' + state + ' phase boundary').toBeDefined();
                // 只用真实阶段/物理状态界限，不再以额外毫秒门槛丢弃已经完整位于该状态的实帧。
                const candidates = frames.filter(item => item.startedAt >= moment!.at && item.endedAt < end!.at);
                expect(candidates.length, phase + ' ' + state + ' painted frame inside its phase').toBeGreaterThan(0);
                if (state === 'rolling') {
                    expect(candidates.length, phase + ' requires multiple real rolling frames').toBeGreaterThanOrEqual(4);
                    const gaps = [candidates[0].at - moment!.at,
                        ...candidates.slice(1).map((frame, index) => frame.at - candidates[index].at),
                        end!.at - candidates[candidates.length - 1].at];
                    expect(Math.max(...gaps), phase + ' rolling capture must not omit a long stretch').toBeLessThanOrEqual(0.5);
                }
                let frame = candidates[Math.floor(candidates.length / 2)];
                if (state === 'damage') {
                    // 静止结果可能只有一帧。比较同阶段滚动帧与结果文字区域的真实像素，拒绝只更新 DOM 的旧画面。
                    const rolling = states.find(item => item.phase === phase && item.state === 'rolling' && item.dice.length > 0);
                    const baseline = frames.find(item => rolling && item.at >= rolling.at && item.at < moment!.at);
                    expect(baseline, phase + ' rolling baseline for result pixels').toBeDefined();
                    const resultLabels = moment!.labels.filter(label => /-(total|damage)$/.test(label.id ?? '') && label.visibility === 'visible');
                    expect(resultLabels.length, phase + ' visible result labels').toBeGreaterThan(0);
                    const viewport = page.viewportSize()!;
                    const crop = (file: string, label: typeof resultLabels[number]) => {
                        const left = Math.max(0, Math.floor(label.left)), top = Math.max(0, Math.floor(label.top));
                        const width = Math.min(viewport.width - left, Math.ceil(label.width));
                        const height = Math.min(viewport.height - top, Math.ceil(label.height));
                        if (width <= 0 || height <= 0) throw new Error(`Result label outside viewport: ${label.id}`);
                        return execFileSync(ffmpeg, ['-v', 'error', '-threads', '1', '-i', file, '-vf', `format=rgb24,crop=${width}:${height}:${left}:${top}`,
                            '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: width * height * 3 + 1024 });
                    };
                    const baselinePixels = resultLabels.map(label => crop(baseline!.path, label));
                    const painted = candidates.slice().reverse().find(candidate => resultLabels.every((label, index) =>
                        countNewResultInk(crop(candidate.path, label), baselinePixels[index]) >= 10));
                    expect(painted, phase + ' result labels must have actual new visible pixels').toBeDefined();
                    frame = painted!;
                }
                const path = resolve(directory, `battle-${phase}-${state}.jpg`);
                copyFileSync(frame!.path, path); pictures.push({ id: `battle-${phase}-${state}`, path });
                selectedFrames.push({ id: `battle-${phase}-${state}`, sourceFrameIndex: frames.indexOf(frame!), sourceFramePath: frame!.path, captureStartedAt: frame!.startedAt, captureEndedAt: frame!.endedAt, windowStart: moment!.at, windowEnd: end!.at });
            }
        }
        writeFileSync(resolve(directory, 'battle-recording.json'), JSON.stringify({ frames, states, screencastFrames, selectedFrames, timebase: 'UTC seconds; compositor timestamps', captureMethod, flow }, null, 2));
        if (!diagnosticMode) encodeOriginalFrames();
        return { pictures, video, frameCount: frames.length, durationSeconds: frames.at(-1)!.at - frames[0].at };
    };
}
