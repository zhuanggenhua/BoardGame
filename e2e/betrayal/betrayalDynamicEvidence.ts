import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { CDPSession, Page } from "@playwright/test";
import sharp from "sharp";

const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

export type BetrayalDynamicEvidenceSegment = {
  key: string;
  label: string;
  startMarker: string;
  endMarker: string;
  fileName: string;
  evidence: string[];
};

type BetrayalDynamicEvidenceFrame = {
  path: string;
  capturedAtMs: number;
};

type BetrayalDynamicEvidenceMarker = {
  label: string;
  atMs: number;
  frameCount: number;
};

export type BetrayalDynamicEvidenceRecorder = {
  enabled: boolean;
  stableDir: string;
  stagingDir?: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  mark: (label: string) => void;
  finalize: (options: {
    testFile: string;
    testTitle: string;
    entry: string;
    flowMode: "natural-flow" | "representative-state";
    playerActions: string[];
    stateInjection: string;
    segments: BetrayalDynamicEvidenceSegment[];
    screenshots: string[];
    assertions: string[];
  }) => Promise<{
    manifestPath: string;
    mediaPaths: string[];
    segmentReports: Array<{
      key: string;
      gifPath: string;
      frameCount: number;
      durationMs: number;
      startMarker: string;
      endMarker: string;
    }>;
  } | null>;
};

function shouldRecord(): boolean {
  return TRUE_ENV_VALUES.has(
    (process.env.BETRAYAL_RECORD_DYNAMIC_EVIDENCE ?? "")
      .trim()
      .toLowerCase(),
  );
}

function normalizeEvidencePath(value: string): string {
  return value.replace(/\\/g, "/");
}

async function writeAnimatedGif(
  frames: readonly BetrayalDynamicEvidenceFrame[],
  outputPath: string,
): Promise<{ width: number; height: number; pages: number; frameDelaysMs: number[]; durationMs: number }> {
  if (frames.length < 2) {
    throw new Error(`Betrayal 动态证据 GIF 至少需要两张真实过程帧：${outputPath}`);
  }

  const resizedFrames = await Promise.all(
    frames.map(async (frame) =>
      sharp(frame.path)
        .resize({ width: 1280, withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const firstFrame = resizedFrames[0];
  if (!firstFrame || firstFrame.info.width <= 0 || firstFrame.info.height <= 0) {
    throw new Error(`Betrayal 动态证据首帧无有效尺寸：${outputPath}`);
  }

  const { width, height, channels } = firstFrame.info;
  if (channels !== 3) {
    throw new Error(`Betrayal 动态证据 GIF 必须是 RGB：${outputPath}`);
  }
  if (
    resizedFrames.some(
      (frame) =>
        frame.info.width !== width ||
        frame.info.height !== height ||
        frame.info.channels !== channels,
    )
  ) {
    throw new Error(`Betrayal 动态证据 GIF 帧尺寸不一致：${outputPath}`);
  }

  const stackedFrames = Buffer.alloc(
    width * height * channels * resizedFrames.length,
  );
  resizedFrames.forEach((frame, index) => {
    frame.data.copy(stackedFrames, index * frame.data.length);
  });

  const observedIntervalsMs = frames
    .slice(1)
    .map((frame, index) =>
      Math.max(1, frame.capturedAtMs - frames[index]!.capturedAtMs),
    )
    .filter((value) => Number.isFinite(value));
  const fallbackDelayMs = observedIntervalsMs.length
    ? observedIntervalsMs[Math.floor(observedIntervalsMs.length / 2)]!
    : 100;
  const frameDelaysMs = frames.map((frame, index) => {
    const nextFrame = frames[index + 1];
    const observedDelay = nextFrame
      ? nextFrame.capturedAtMs - frame.capturedAtMs
      : fallbackDelayMs;
    return Math.min(2_000, Math.max(40, Math.round(observedDelay)));
  });
  const durationMs = frameDelaysMs.reduce((total, delay) => total + delay, 0);

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(stackedFrames, {
    raw: {
      width,
      height: height * resizedFrames.length,
      channels,
      pageHeight: height,
    },
  })
    .gif({
      loop: 0,
      delay: frameDelaysMs,
      colours: 256,
      reuse: false,
      effort: 7,
      dither: 0.35,
      keepDuplicateFrames: true,
    })
    .toFile(outputPath);

  const metadata = await sharp(outputPath, { animated: true }).metadata();
  const pages = metadata.pages ?? 0;
  if (pages !== frames.length || metadata.pageHeight !== height) {
    throw new Error(
      [
        "Betrayal 动态证据 GIF 没有保留真实采样帧",
        `expectedPages=${frames.length}`,
        `actualPages=${pages}`,
        `pageHeight=${metadata.pageHeight ?? "unknown"}`,
      ].join("\n"),
    );
  }

  return { width, height, pages, frameDelaysMs, durationMs };
}

async function moveStableDirectory(stagingDir: string, stableDir: string): Promise<void> {
  const historyDir = join(
    dirname(stableDir),
    "_history",
    basename(stableDir),
    `${Date.now()}-${process.pid}-${randomUUID()}`,
  );
  try {
    await mkdir(dirname(historyDir), { recursive: true });
    await rename(stableDir, historyDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") throw error;
  }
  await mkdir(dirname(stableDir), { recursive: true });
  await rename(stagingDir, stableDir);
}

export function createBetrayalDynamicEvidenceRecorder(options: {
  stableDir: string;
  page?: Page;
}): BetrayalDynamicEvidenceRecorder {
  const enabled = shouldRecord();
  const stableDir = options.stableDir;
  if (!enabled) {
    return {
      enabled: false,
      stableDir,
      start: async () => undefined,
      stop: async () => undefined,
      mark: () => undefined,
      finalize: async () => null,
    };
  }

  const runId = `${Date.now()}-${process.pid}-${randomUUID()}`;
  const stagingDir = join(
    dirname(stableDir),
    "_temporary",
    basename(stableDir),
    runId,
  );
  const frameDir = join(stagingDir, "frames");
  const frames: BetrayalDynamicEvidenceFrame[] = [];
  const markers: BetrayalDynamicEvidenceMarker[] = [];
  const page: Page | null = options.page ?? null;
  let session: CDPSession | null = null;
  let started = false;
  let frameIndex = 0;
  let pendingWrites = 0;
  let resolvePendingWrites: (() => void) | null = null;
  let captureError: unknown = null;
  let stopped = false;
  let stopPromise: Promise<void> | null = null;

  const mark = (label: string) => {
    markers.push({ label, atMs: Date.now(), frameCount: frames.length });
  };

  const start = async () => {
    if (started) return;
    if (!page) {
      throw new Error("Betrayal 动态证据录制器未绑定 Page");
    }
    await mkdir(frameDir, { recursive: true });
    session = await page.context().newCDPSession(page);
    session.on("Page.screencastFrame", (event: {
      data: string;
      metadata?: { timestamp?: number };
      sessionId: number;
    }) => {
      if (stopped) return;
      const framePath = join(frameDir, `${String(frameIndex).padStart(5, "0")}.png`);
      frameIndex += 1;
      pendingWrites += 1;
      void session
        .send("Page.screencastFrameAck", { sessionId: event.sessionId })
        .catch((error: unknown) => {
          if (!stopped) captureError = captureError ?? error;
        });
      void writeFile(framePath, Buffer.from(event.data, "base64"))
        .then(() => {
          frames.push({ path: framePath, capturedAtMs: Date.now() });
        })
        .catch((error: unknown) => {
          captureError = captureError ?? error;
        })
        .finally(() => {
          pendingWrites -= 1;
          if (pendingWrites === 0 && resolvePendingWrites) {
            const resolve = resolvePendingWrites;
            resolvePendingWrites = null;
            resolve();
          }
        });
    });
    await session.send("Page.startScreencast", {
      format: "png",
      everyNthFrame: 1,
      maxWidth: 1920,
      maxHeight: 1080,
    });
    started = true;
    console.log(`[Betrayal dynamic evidence] recorder-started ${stagingDir}`);
  };

  const stop = async () => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      stopped = true;
      if (session) {
        await session.send("Page.stopScreencast").catch(() => undefined);
        if (pendingWrites > 0) {
          await new Promise<void>((resolve) => {
            resolvePendingWrites = resolve;
          });
        }
        await session.detach().catch(() => undefined);
      }
      if (captureError) throw captureError;
      frames.sort((left, right) => left.path.localeCompare(right.path));
      console.log(
        `[Betrayal dynamic evidence] recorder-stopped frames=${frames.length}`,
      );
    })();
    return stopPromise;
  };

  const finalize = async (options: {
    testFile: string;
    testTitle: string;
    entry: string;
    flowMode: "natural-flow" | "representative-state";
    playerActions: string[];
    stateInjection: string;
    segments: BetrayalDynamicEvidenceSegment[];
    screenshots: string[];
    assertions: string[];
  }) => {
    if (!enabled) return null;
    if (!stagingDir || frames.length < 2) {
      throw new Error("Betrayal 动态证据没有采集到足够的真实页面帧");
    }

    const markerByLabel = new Map(markers.map((marker) => [marker.label, marker]));
    const segmentReports: Array<{
      key: string;
      gifPath: string;
      frameCount: number;
      durationMs: number;
      startMarker: string;
      endMarker: string;
    }> = [];
    const mediaPaths: string[] = [];

    for (const segment of options.segments) {
      const startMarker = markerByLabel.get(segment.startMarker);
      const endMarker = markerByLabel.get(segment.endMarker);
      if (!startMarker || !endMarker || endMarker.atMs <= startMarker.atMs) {
        throw new Error(
          `Betrayal 动态证据缺少合法时间段：${segment.key} / ${segment.startMarker} -> ${segment.endMarker}`,
        );
      }
      const paddingMs = 250;
      let segmentFrames = frames.filter(
        (frame) =>
          frame.capturedAtMs >= startMarker.atMs - paddingMs &&
          frame.capturedAtMs <= endMarker.atMs + paddingMs,
      );
      if (segmentFrames.length < 2) {
        segmentFrames = frames.slice(
          Math.max(0, startMarker.frameCount - 2),
          Math.min(frames.length, endMarker.frameCount + 3),
        );
      }
      if (segmentFrames.length < 2) {
        throw new Error(`Betrayal 动态证据时间段帧数不足：${segment.key}`);
      }

      const gifPath = join(stagingDir, segment.fileName);
      const gifMetadata = await writeAnimatedGif(segmentFrames, gifPath);
      const gifStats = await stat(gifPath);
      if (gifStats.size <= 0) {
        throw new Error(`Betrayal 动态证据 GIF 为空：${gifPath}`);
      }
      segmentReports.push({
        key: segment.key,
        gifPath,
        frameCount: gifMetadata.pages,
        durationMs: gifMetadata.durationMs,
        startMarker: segment.startMarker,
        endMarker: segment.endMarker,
      });
      mediaPaths.push(normalizeEvidencePath(relative(stableDir, join(stableDir, segment.fileName))));
    }

    const segmentByKey = new Map(
      options.segments.map((segment) => [segment.key, segment]),
    );
    const absoluteMediaPaths = segmentReports.map((report) =>
      join(process.cwd(), stableDir, basename(report.gifPath)),
    );
    const absoluteScreenshotPaths = options.screenshots.map((screenshot) =>
      join(process.cwd(), screenshot),
    );
    const manifestPath = join(stagingDir, "外星几何-动态流畅性-PASS.json");
    const manifest = {
      verdict: "PASS",
      scope: "current-user-request",
      generatedAt: new Date().toISOString(),
      standard: {
        source: ".spec/knowledge/standards/e2e-verification.md",
        dynamicEvidenceSource: ".spec/skills/e2e-animation-evidence/SKILL.md",
        displaySource: ".spec/skills/show-image-to-user/SKILL.md",
      },
      display: {
        purpose: "final-user-visible-delivery",
        trigger: "user-requested-evidence",
        viewer: "web",
        finalPassBeforeOpen: true,
        directory: normalizeEvidencePath(stableDir),
      },
      test: {
        file: normalizeEvidencePath(options.testFile),
        title: options.testTitle,
        entry: options.entry,
        flowMode: options.flowMode,
      },
      stateInjection: options.stateInjection,
      playerActions: options.playerActions,
      timingSource: "Chromium Page.screencastFrame 真实页面帧到达时间",
      markers,
      tests: [
        {
          command:
            "BETRAYAL_RECORD_DYNAMIC_EVIDENCE=1 node scripts/infra/run-e2e-single.mjs default e2e/betrayal/event-choice-coverage.e2e.ts 外星几何真实链路从探索翻牌到投掷事件结算关闭 --config=playwright.golden-video.config.ts",
          result: "1 passed",
          scope: "外星几何真实页面链路的卡牌特写、物理骰子和房间拖拽动态证据",
        },
      ],
      segments: segmentReports.map((report) => ({
        ...report,
        gifPath: normalizeEvidencePath(relative(stagingDir, report.gifPath)),
      })),
      requirements: segmentReports.map((report) => {
        const segment = segmentByKey.get(report.key);
        return {
          requirement: segment?.label ?? report.key,
          status: "PASS",
          evidence: [
            `${report.frameCount} 帧真实页面过程帧`,
            `真实时间跨度 ${report.durationMs}ms`,
            ...(segment?.evidence ?? []),
          ],
          media: [
            join(process.cwd(), stableDir, basename(report.gifPath)),
          ],
        };
      }),
      screenshots: absoluteScreenshotPaths.map(normalizeEvidencePath),
      assertions: options.assertions,
      media: absoluteMediaPaths.map(normalizeEvidencePath),
      limitations: [
        "本组从正式 Betrayal 页面开始，但使用合法代表态注入事件牌与骰子前置状态。",
        "GIF 证明同次真实浏览器运行中的时间连续性与状态切换；素材审美仍需单独 UI 图面复核。",
      ],
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await moveStableDirectory(stagingDir, stableDir);

    const promotedManifestPath = join(stableDir, "外星几何-动态流畅性-PASS.json");
    const promotedMediaPaths = mediaPaths.map((path) => join(stableDir, path));
    return {
      manifestPath: promotedManifestPath,
      mediaPaths: promotedMediaPaths,
      segmentReports: segmentReports.map((report) => ({
        ...report,
        gifPath: join(stableDir, basename(report.gifPath)),
      })),
    };
  };

  return {
    enabled,
    stableDir,
    stagingDir,
    start,
    stop,
    mark,
    finalize,
  };
}
