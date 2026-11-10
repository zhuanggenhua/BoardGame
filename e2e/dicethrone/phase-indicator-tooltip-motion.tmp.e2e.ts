import fs from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { test, expect } from '../framework';

type CapturedFrame = { path: string; capturedAtMs: number };

async function captureTooltipGif(page: any, outputDir: string, outputPath: string) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const frames: CapturedFrame[] = [];
  let frameIndex = 0;
  let pendingWrites = 0;
  let resolvePending: (() => void) | null = null;
  let stopped = false;
  let captureError: unknown = null;
  const cdp = await page.context().newCDPSession(page);

  cdp.on('Page.screencastFrame', (event: { data: string; metadata?: { timestamp?: number }; sessionId: number }) => {
    if (stopped) return;
    const framePath = join(outputDir, `${String(frameIndex).padStart(4, '0')}.jpg`);
    frameIndex += 1;
    pendingWrites += 1;
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch((error: unknown) => {
      captureError = captureError ?? error;
    });
    void fs.promises.writeFile(framePath, Buffer.from(event.data, 'base64'))
      .then(() => frames.push({
        path: framePath,
        capturedAtMs: typeof event.metadata?.timestamp === 'number'
          ? Math.round(event.metadata.timestamp * 1000)
          : Date.now(),
      }))
      .catch((error: unknown) => {
        captureError = captureError ?? error;
      })
      .finally(() => {
        pendingWrites -= 1;
        if (pendingWrites === 0 && resolvePending) {
          const resolve = resolvePending;
          resolvePending = null;
          resolve();
        }
      });
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 70,
    everyNthFrame: 1,
    maxWidth: 1280,
    maxHeight: 720,
  });

  return {
    stop: async () => {
      stopped = true;
      await cdp.send('Page.stopScreencast');
      if (pendingWrites > 0) {
        await new Promise<void>((resolve) => {
          resolvePending = resolve;
        });
      }
      await cdp.detach().catch(() => undefined);
      if (captureError) throw captureError;
      const orderedFrames = frames.sort((left, right) => left.path.localeCompare(right.path));
      if (orderedFrames.length < 4) throw new Error(`阶段说明 tip GIF 帧数不足: ${orderedFrames.length}`);

      const decoded = await Promise.all(orderedFrames.map((frame) => (
        sharp(frame.path)
          .resize({ width: 1280, withoutEnlargement: true })
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
      )));
      const first = decoded[0]!;
      const { width, height, channels } = first.info;
      const stacked = Buffer.alloc(width * height * channels * decoded.length);
      decoded.forEach((frame, index) => frame.data.copy(stacked, index * frame.data.length));
      const fallbackDelay = 100;
      const delays = orderedFrames.map((frame, index) => {
        const next = orderedFrames[index + 1];
        const observed = next ? next.capturedAtMs - frame.capturedAtMs : fallbackDelay;
        return Math.min(2_000, Math.max(40, Math.round(observed)));
      });

      await sharp(stacked, {
        raw: { width, height: height * decoded.length, channels, pageHeight: height },
      }).gif({
        loop: 0,
        delay: delays,
        colours: 256,
        reuse: false,
        effort: 7,
        dither: 0.35,
        keepDuplicateFrames: true,
      }).toFile(outputPath);

      return {
        frameCount: orderedFrames.length,
        durationMs: delays.reduce((total, delay) => total + delay, 0),
        delays,
      };
    },
  };
}

test('阶段说明 tip hover 动效 GIF 诊断', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await game.openTestGame('dicethrone');
  await game.setupScene({
    gameId: 'dicethrone',
    currentPlayer: '0',
    phase: 'main1',
    player0: { resources: { CP: 3, HP: 50 } },
    player1: { resources: { CP: 3, HP: 50 } },
    extra: {
      selectedCharacters: { '0': 'monk', '1': 'barbarian' },
      hostStarted: true,
    },
    sys: {
      phase: 'main1',
      currentPlayerIndex: 0,
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  });

  await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 15000 });
  const phaseItem = page
    .locator('[data-testid="dt-phase-indicator"] [data-dt-phase-item="true"]')
    .filter({ hasText: '3. 主要阶段（1）' })
    .first();
  await expect(phaseItem).toBeVisible({ timeout: 5000 });

  const stagingDir = join(process.cwd(), 'evidence', 'dicethrone', 'phase-indicator-tooltip-motion-20261011', '_temporary');
  const frameDir = join(stagingDir, 'frames');
  const gifPath = join(stagingDir, 'phase-indicator-tooltip-hover.gif');
  const recorder = await captureTooltipGif(page, frameDir, gifPath);

  await page.waitForTimeout(250);
  await phaseItem.hover();
  const samples: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 12; index += 1) {
    samples.push(await page.evaluate(() => {
      const tip = document.querySelector<HTMLElement>('[data-testid="info-tooltip"]');
      if (!tip) return { present: false };
      const rect = tip.getBoundingClientRect();
      const style = getComputedStyle(tip);
      return {
        present: true,
        rect: {
          left: Math.round(rect.left * 10) / 10,
          top: Math.round(rect.top * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        },
        visibility: style.visibility,
        opacity: style.opacity,
        transform: style.transform,
        transitionProperty: style.transitionProperty,
        animationName: style.animationName,
      };
    }));
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(900);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  const recording = await recorder.stop();
  const metrics = await page.evaluate(() => {
    const tip = document.querySelector<HTMLElement>('[data-testid="info-tooltip"]');
    if (!tip) return null;
    const style = getComputedStyle(tip);
    return {
      className: tip.className,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      transform: style.transform,
      opacity: style.opacity,
    };
  });
  console.log('PHASE_TOOLTIP_GIF', JSON.stringify({ gifPath, recording, metrics, samples, outputDir: testInfo.outputDir }));
  expect(recording.frameCount).toBeGreaterThanOrEqual(4);
  expect(recording.durationMs).toBeGreaterThan(400);
});
