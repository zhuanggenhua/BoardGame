import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

type State = { regionTipVisible: boolean; at: number; phase: string | null; state: string | null; text: string; layout?: { panel: { left: number; top: number; width: number; height: number } | null; regions: Array<{ left: number; top: number; width: number; height: number }> }; dice: Array<{ type: string | null; settled: string | null; ready: string | null; failure: string | null }> };

/** 只观察正式页面：连续采集实际视口，按墙钟间隔编码，不注入或重演投掷。 */
export async function beginBattleRecording(page: Page, directory: string) {
    const frameDirectory = resolve(tmpdir(), 'BoardGame-qidahen-annual-20261030', basename(dirname(directory)), basename(directory), 'battle-frames');
    mkdirSync(frameDirectory, { recursive: true });
    const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
    await page.evaluate(() => {
        const states: State[] = [];
        const sample = () => {
            const panel = document.querySelector<HTMLElement>('[data-testid="qidahen-battle-roll-sequence"]');
            const next: State = { regionTipVisible: document.querySelector('[data-testid="qidahen-map-region-tip"]') != null, at: Date.now() / 1000, phase: panel?.getAttribute('data-battle-roll-phase') ?? null,
                state: panel?.getAttribute('data-battle-roll-state') ?? null, text: panel?.innerText ?? '',
                dice: [...(panel?.querySelectorAll('[data-dice-physics-source][data-die-type]') ?? [])].map(die => ({
                    type: die.getAttribute('data-die-type'), settled: die.getAttribute('data-dice-settled'),
                    ready: die.getAttribute('data-dice-engine-ready'), failure: die.getAttribute('data-dice-engine-failure'),
                })) };
            const toRect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
            const overlay = document.querySelector('[data-testid="qidahen-battle-roll-overlay"]');
            next.layout = { panel: overlay ? toRect(overlay) : null, regions: [...document.querySelectorAll('[data-qidahen-battle-region-space]')].map(toRect) };
            const previous = states.at(-1);
            if (!previous || JSON.stringify({ ...previous, at: 0 }) !== JSON.stringify({ ...next, at: 0 })) states.push(next);
        };
        const observer = new MutationObserver(sample);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true,
            attributeFilter: ['data-battle-roll-phase', 'data-battle-roll-state', 'data-dice-settled', 'data-dice-engine-ready', 'data-dice-engine-failure'] });
        sample();
        (window as unknown as { __annualBattleObservation: { states: State[]; observer: MutationObserver } }).__annualBattleObservation = { states, observer };
    });
    const frames: Array<{ path: string; at: number; startedAt: number; endedAt: number }> = [];
    const session = await page.context().newCDPSession(page);
    let capturing = true;
    let captureFailure: unknown;
    page.once('close', () => { capturing = false; });
    // 直接读取同页实际合成视口。stream已被逐帧证实漏结果层；不混入再延长静态帧。
    // 不走Playwright截图的字体等待，每次仍保留真实起止时间，跨阶段采集不能作关键帧。
    const captureLoop = (async () => {
        while (capturing) {
            const startedAt = Date.now() / 1000;
            const pixels = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, fromSurface: true });
            const endedAt = Date.now() / 1000;
            const path = resolve(frameDirectory, `${String(frames.length).padStart(5, '0')}.jpg`);
            writeFileSync(path, Buffer.from(pixels.data, 'base64'));
            frames.push({ path, at: (startedAt + endedAt) / 2, startedAt, endedAt });
            const remaining = Math.max(0, 60 - (Date.now() / 1000 - startedAt) * 1000);
            if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
        }
    })().catch(error => { captureFailure = error; });
    await expect.poll(() => frames.length).toBeGreaterThan(0);
    return async () => {
        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveCount(0);
        const exitAt = await page.evaluate(() => {
            const record = (window as unknown as { __annualBattleObservation: { states: State[] } }).__annualBattleObservation;
            return record.states.at(-1)!.at;
        });
        await expect.poll(() => frames.at(-1)!.startedAt, { timeout: 10_000, message: 'actual composed viewport after dice exit must be captured' }).toBeGreaterThanOrEqual(exitAt);
        capturing = false;
        await captureLoop;
        await session.detach();
        if (captureFailure) throw captureFailure;
        const states = await page.evaluate(() => {
            const record = (window as unknown as { __annualBattleObservation: { states: State[]; observer: MutationObserver } }).__annualBattleObservation;
            record.observer.disconnect(); return record.states;
        });
        writeFileSync(resolve(directory, 'battle-recording.json'), JSON.stringify({ frames, states, timebase: 'UTC seconds; actual composed viewport capture interval midpoints', captureMethod: 'Continuous same-page Page.captureScreenshot sampling; every recorded frame is an actual composed viewport at real elapsed time', flow: 'natural-flow' }, null, 2));
        expect(frames.length).toBeGreaterThan(15);
        expect(states.flatMap(state => state.dice).filter(die => die.failure)).toEqual([]);
        expect(states.filter(state => state.phase != null && state.regionTipVisible), 'map hover information must leave before battle playback').toEqual([]);
        const pictures: Array<{ id: string; path: string }> = [];
        const selectedFrames: Array<{ id: string; sourceFrameIndex: number; sourceFramePath: string; captureStartedAt: number; captureEndedAt: number; windowStart: number; windowEnd: number }> = [];
        for (const phase of ['artillery', 'cavalry', 'infantry']) {
            for (const state of ['rolling', 'damage']) {
                const moment = states.find(item => item.phase === phase && item.state === state &&
                    item.dice.length > 0 && item.dice.every(die => die.ready === 'true' && die.settled === (state === 'damage' ? 'true' : 'false')));
                expect(moment, `${phase} ${state} actual physics observation`).toBeDefined();
                const panel = moment!.layout?.panel;
                expect(panel, 'actual battle panel bounds').toBeTruthy();
                expect(moment!.layout?.regions.length, 'both complete battle regions must be projected').toBeGreaterThanOrEqual(2);
                for (const region of moment!.layout!.regions) {
                    expect(region.left >= 0 && region.top >= 0 && region.left + region.width <= page.viewportSize()!.width && region.top + region.height <= page.viewportSize()!.height, 'whole battle territory remains inside screen').toBe(true);
                    expect(region.left < panel!.left + panel!.width && region.left + region.width > panel!.left && region.top < panel!.top + panel!.height && region.top + region.height > panel!.top, 'dice panel cannot cover either territory').toBe(false);
                }
                const end = states.find(item => item.at > moment!.at && (item.phase !== phase || item.state !== state || item.dice.length === 0 || item.dice.some(die => die.ready !== 'true' || die.settled !== (state === 'damage' ? 'true' : 'false'))));
                expect(end, phase + ' ' + state + ' phase boundary').toBeDefined();
                // 只用真实阶段/物理状态界限，不再以额外毫秒门槛丢弃已经完整位于该状态的实帧。
                const candidates = frames.filter(item => item.startedAt >= moment!.at && item.endedAt < end!.at);
                expect(candidates.length, phase + ' ' + state + ' painted frame inside its phase').toBeGreaterThan(0);
                const frame = candidates[state === 'damage' ? candidates.length - 1 : Math.floor(candidates.length / 2)];
                const path = resolve(directory, `battle-${phase}-${state}.jpg`);
                copyFileSync(frame!.path, path); pictures.push({ id: `battle-${phase}-${state}`, path });
                selectedFrames.push({ id: `battle-${phase}-${state}`, sourceFrameIndex: frames.indexOf(frame!), sourceFramePath: frame!.path, captureStartedAt: frame!.startedAt, captureEndedAt: frame!.endedAt, windowStart: moment!.at, windowEnd: end!.at });
            }
        }
        writeFileSync(resolve(directory, 'battle-recording.json'), JSON.stringify({ frames, states, selectedFrames, timebase: 'UTC seconds; actual capture intervals retained, timeline uses interval midpoints', captureMethod: 'Continuous same-page actual composed viewport sampling; selected source frame indices disambiguate byte-identical static result frames', flow: 'natural-flow' }, null, 2));
        const list = resolve(frameDirectory, 'frames.txt');
        writeFileSync(list, frames.map((frame, index) => `file '${frame.path.replaceAll('\\', '/')}'\noption framerate 1000${index + 1 < frames.length ? '\nduration ' + (frames[index + 1].at - frame.at) : ''}`).join('\n'));
        const video = resolve(directory, 'battle-real-time.webm');
        execFileSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-fps_mode', 'passthrough', '-enc_time_base', '1:1000', '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', video], { stdio: 'ignore', timeout: 90_000 });
        return { pictures, video, frameCount: frames.length, durationSeconds: frames.at(-1)!.at - frames[0].at };
    };
}
