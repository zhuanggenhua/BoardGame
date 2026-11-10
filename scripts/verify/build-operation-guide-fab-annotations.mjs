import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const rootDir = process.cwd();
const suppliedSourceDir = process.argv[2];
const sourceDir = suppliedSourceDir ? path.resolve(suppliedSourceDir) : path.join(
  rootDir,
  'test-results',
  'evidence-screenshots',
  '_shared',
  'operation-guide-dicethrone-source-real-screenshots-20260913',
);
const outputDir = process.env.BG_GUIDE_ANNOTATION_OUTPUT_DIR
  ? path.resolve(process.env.BG_GUIDE_ANNOTATION_OUTPUT_DIR)
  : path.join(rootDir, 'public', 'images', 'operation-guide');
const auditPath = path.join(sourceDir, 'operation-guide-annotation-audit.json');

const fabRuns = [
  {
    source: 'source-home-web-dicethrone-expanded-fab.png',
    output: 'home-web-fab-annotated.png',
    rects: 'home-web-dicethrone-fab-rects.json',
    style: 'desktop',
    labels: [
      ['feedback', '反馈'],
      ['about', '关于'],
      ['download-app', '下载APP'],
      ['fullscreen', '全屏'],
      ['display-theme', '日夜'],
      ['settings', '设置'],
    ],
  },
  {
    source: 'source-home-app-dicethrone-expanded-fab.png',
    output: 'home-app-fab-annotated.png',
    rects: 'home-app-dicethrone-fab-rects.json',
    style: 'mobile',
    labels: [
      ['feedback', '反馈'],
      ['about', '关于'],
      ['check-update', '检查更新'],
      ['fullscreen', '全屏'],
      ['display-theme', '日夜'],
      ['settings', '设置'],
    ],
  },
  {
    source: 'source-game-dicethrone-expanded-fab.png',
    output: 'game-fab-annotated.png',
    rects: 'game-dicethrone-fab-rects.json',
    style: 'desktop',
    labels: [
      ['feedback', '反馈'],
      ['fullscreen', '全屏'],
      ['display-theme', '日夜'],
      ['undo-idle', '撤回'],
      ['action-log', '日志'],
      ['settings', '设置'],
      ['exit', '离开'],
    ],
  },
];
// 只有显式传入应用界面仿真来源时才生成应用图；网页图不能冒充应用图。
const useAppEmulation = process.argv.includes('--native-app-emulated');
const selectedRuns = suppliedSourceDir ? fabRuns.slice(0, useAppEmulation ? 2 : 1).map(run => ({
  ...run,
  source: `guide-source-${run.style === 'mobile' ? 'mobile-app-emulated' : 'desktop-web'}.png`,
  rects: `guide-source-${run.style === 'mobile' ? 'mobile-app-emulated' : 'desktop-web'}.json`,
})) : fabRuns;

const styles = {
  desktop: {
    labelLeft: 1510,
    labelHeight: 46,
    labelMinWidth: 118,
    labelPaddingX: 30,
    fontSize: 30,
    charWidth: 28,
    minArrowLength: 116,
    targetGap: 20,
    arrowTailGap: 14,
    arrowStrokeWidth: 12,
    arrowHeadLength: 42,
    arrowHeadHalfHeight: 27,
    labelRadius: 13,
    labelStrokeWidth: 3,
  },
  mobile: {
    labelLeft: 24,
    labelHeight: 38,
    labelMinWidth: 102,
    labelPaddingX: 22,
    fontSize: 21,
    charWidth: 20,
    minArrowLength: 94,
    targetGap: 12,
    arrowTailGap: 10,
    arrowStrokeWidth: 8,
    arrowHeadLength: 29,
    arrowHeadHalfHeight: 19,
    labelRadius: 11,
    labelStrokeWidth: 2,
  },
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const intersects = (a, b, padding = 0) => (
  a.left < b.right + padding
  && a.right > b.left - padding
  && a.top < b.bottom + padding
  && a.bottom > b.top - padding
);

const labelWidthFor = (text, style) => Math.max(
  style.labelMinWidth,
  Array.from(text).length * style.charWidth + style.labelPaddingX * 2,
);

const annotationFor = ({ id, text, rect, width, height, style }) => {
  const labelWidth = labelWidthFor(text, style);
  const maxLeft = rect.left - style.minArrowLength - labelWidth;
  const belowTarget = id === 'about' && suppliedSourceDir;
  const left = belowTarget
    ? clamp(rect.centerX - labelWidth / 2, 16, width - labelWidth - 16)
    : clamp(Math.min(style.labelLeft, maxLeft), 16, Math.max(16, width - labelWidth - 16));
  const top = belowTarget ? rect.bottom + 76
    : clamp(rect.centerY - style.labelHeight / 2, 14, height - style.labelHeight - 14);
  const labelRect = {
    left,
    top,
    right: left + labelWidth,
    bottom: top + style.labelHeight,
    width: labelWidth,
    height: style.labelHeight,
    centerX: left + labelWidth / 2,
    centerY: top + style.labelHeight / 2,
  };

  const lineFrom = {
    x: belowTarget ? rect.centerX : labelRect.right + style.arrowTailGap,
    y: belowTarget ? labelRect.top - style.arrowTailGap : rect.centerY,
  };
  const lineTo = {
    x: belowTarget ? rect.centerX : rect.left - style.targetGap,
    y: belowTarget ? rect.bottom + style.targetGap : rect.centerY,
  };
  const arrowHead = [
    { x: lineTo.x, y: lineTo.y },
    { x: lineTo.x - (belowTarget ? style.arrowHeadHalfHeight : style.arrowHeadLength), y: lineTo.y + (belowTarget ? style.arrowHeadLength : -style.arrowHeadHalfHeight) },
    { x: lineTo.x + (belowTarget ? style.arrowHeadHalfHeight : -style.arrowHeadLength), y: lineTo.y + (belowTarget ? style.arrowHeadLength : style.arrowHeadHalfHeight) },
  ];

  return { id, text, targetRect: rect, labelRect, lineFrom, lineTo, arrowHead, belowTarget };
};

// 新入口中设置面板与快捷球同时展开，图例放在原截图外，避免遮住面板。
const legendAnnotationFor = ({ id, text, rect, width, height, style }) => {
  const labelWidth = labelWidthFor(text, style);
  const left = width + 12;
  const top = clamp(rect.centerY - style.labelHeight / 2, 12, height - style.labelHeight - 12);
  const labelRect = {
    left, top, right: left + labelWidth, bottom: top + style.labelHeight,
    width: labelWidth, height: style.labelHeight,
    centerX: left + labelWidth / 2, centerY: top + style.labelHeight / 2,
  };
  const about = id === 'about';
  const lineFrom = { x: left - 5, y: labelRect.centerY };
  const lineTo = about
    ? { x: rect.centerX, y: rect.top - 2 }
    : { x: rect.right + 4, y: rect.centerY };
  const head = about ? 7 : Math.min(16, style.arrowHeadLength);
  const half = about ? 5 : Math.min(10, style.arrowHeadHalfHeight);
  const arrowHead = about
    ? [lineTo, { x: lineTo.x - half, y: lineTo.y - head }, { x: lineTo.x + half, y: lineTo.y - head }]
    : [lineTo, { x: lineTo.x + head, y: lineTo.y - half }, { x: lineTo.x + head, y: lineTo.y + half }];
  const points = about
    ? [lineFrom, { x: width + 5, y: 5 }, { x: rect.centerX, y: 5 }, { x: rect.centerX, y: lineTo.y - head / 2 }]
    : [lineFrom, { x: lineTo.x + head / 2, y: lineTo.y }];
  return { id, text, targetRect: rect, labelRect, lineFrom, lineTo, arrowHead, points, legend: true };
};

const renderLegendAnnotation = (annotation, style) => {
  const points = annotation.points.map(point => `${point.x},${point.y}`).join(' ');
  const arrow = annotation.arrowHead.map(point => `${point.x},${point.y}`).join(' ');
  return `
    <g filter="url(#labelShadow)">
      <rect x="${annotation.labelRect.left}" y="${annotation.labelRect.top}" width="${annotation.labelRect.width}" height="${annotation.labelRect.height}" rx="${style.labelRadius}" fill="rgba(44,26,12,.94)" stroke="#fff0bb" stroke-width="${style.labelStrokeWidth}"/>
      <text x="${annotation.labelRect.centerX}" y="${annotation.labelRect.centerY}" text-anchor="middle" dominant-baseline="middle" font-family="Microsoft YaHei, SimHei, Arial, sans-serif" font-size="${style.fontSize}" font-weight="900" fill="#fff7d1">${escapeXml(annotation.text)}</text>
    </g>
    <polyline points="${points}" fill="none" stroke="#2d1704" stroke-width="${annotation.id === 'about' ? 5 : 8}" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${points}" fill="none" stroke="#ffe45c" stroke-width="${annotation.id === 'about' ? 3 : 5}" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="${arrow}" fill="#ffe45c" stroke="#2d1704" stroke-width="2" stroke-linejoin="round"/>
  `;
};

const renderAnnotation = (annotation, style) => {
  const arrowPoints = annotation.arrowHead.map((point) => `${point.x},${point.y}`).join(' ');
  const lineEndX = annotation.belowTarget ? annotation.lineTo.x : annotation.lineTo.x - style.arrowHeadLength * 0.55;
  const lineEndY = annotation.belowTarget ? annotation.lineTo.y + style.arrowHeadLength * 0.55 : annotation.lineTo.y;
  const textY = annotation.labelRect.centerY + style.fontSize * 0.03;
  return `
    <g filter="url(#labelShadow)">
      <rect
        x="${annotation.labelRect.left}"
        y="${annotation.labelRect.top}"
        width="${annotation.labelRect.width}"
        height="${annotation.labelRect.height}"
        rx="${style.labelRadius}"
        fill="rgba(44, 26, 12, 0.94)"
        stroke="#fff0bb"
        stroke-width="${style.labelStrokeWidth}"
      />
      <text
        x="${annotation.labelRect.centerX}"
        y="${textY}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Microsoft YaHei, SimHei, Arial, sans-serif"
        font-size="${style.fontSize}"
        font-weight="900"
        fill="#fff7d1"
      >${escapeXml(annotation.text)}</text>
    </g>
    <g>
      <line
        x1="${annotation.lineFrom.x}"
        y1="${annotation.lineFrom.y}"
        x2="${lineEndX}"
        y2="${lineEndY}"
        stroke="rgba(38, 20, 5, 0.86)"
        stroke-width="${style.arrowStrokeWidth + 9}"
        stroke-linecap="round"
      />
      <polygon
        points="${arrowPoints}"
        fill="rgba(38, 20, 5, 0.86)"
        transform="translate(-2 2)"
      />
      <line
        x1="${annotation.lineFrom.x}"
        y1="${annotation.lineFrom.y}"
        x2="${lineEndX}"
        y2="${lineEndY}"
        stroke="#ffe45c"
        stroke-width="${style.arrowStrokeWidth}"
        stroke-linecap="round"
      />
      <polygon
        points="${arrowPoints}"
        fill="#ffe45c"
        stroke="#2d1704"
        stroke-width="${Math.max(2, Math.round(style.arrowStrokeWidth / 3))}"
        stroke-linejoin="round"
      />
    </g>
  `;
};

const buildOverlay = (width, height, annotations, style) => Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="labelShadow" x="-25%" y="-60%" width="150%" height="220%">
        <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
    ${annotations.map((annotation) => annotation.legend ? renderLegendAnnotation(annotation, style) : renderAnnotation(annotation, style)).join('\n')}
  </svg>
`);

const updateAudit = async (newResults) => {
  let previous = { results: [] };
  try {
    previous = await readJson(auditPath);
  } catch {
    previous = { results: [] };
  }

  const replacedOutputs = new Set(newResults.map((result) => path.normalize(result.output)));
  const preservedResults = Array.isArray(previous.results)
    ? previous.results.filter((result) => !replacedOutputs.has(path.normalize(result.output)))
    : [];
  const nextAudit = {
    generatedAt: new Date().toISOString(),
    note: 'DiceThrone real screenshots with large pointer arrows for FAB labels; no circles; labels and arrows avoid target controls.',
    sourceDir,
    outputDir,
    results: [...preservedResults, ...newResults],
  };

  await fs.writeFile(auditPath, `${JSON.stringify(nextAudit, null, 2)}\n`, 'utf8');
};

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const results = [];

  for (const run of selectedRuns) {
    const sourcePath = path.join(sourceDir, run.source);
    const outputPath = path.join(outputDir, run.output);
    const rectData = await readJson(path.join(sourceDir, run.rects));
    if (suppliedSourceDir && run.style === 'mobile' && rectData.nativeAppInterfaceEmulated !== true) {
      throw new Error(`Mobile app screenshot must explicitly identify emulation: ${run.rects}`);
    }
    const metadata = await sharp(sourcePath).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (!width || !height) {
      throw new Error(`Cannot read image size: ${sourcePath}`);
    }

    const rectById = new Map(rectData.fabButtons.map((button) => [button.id, button.rect]));
    const style = styles[run.style];
    const legendWidth = suppliedSourceDir ? (run.style === 'mobile' ? 150 : 240) : 0;
    const annotations = run.labels.map(([id, text]) => {
      const rect = rectById.get(id);
      if (!rect) {
        throw new Error(`Missing FAB rect "${id}" for ${run.rects}`);
      }
      const buildAnnotation = suppliedSourceDir ? legendAnnotationFor : annotationFor;
      return buildAnnotation({ id, text, rect, width, height, style });
    });
    const overlay = buildOverlay(width + legendWidth, height, annotations, style);

    await sharp(sourcePath)
      .extend({ right: legendWidth, background: '#f3ead4' })
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    let panelPixelsPreserved;
    if (suppliedSourceDir && rectData.settingsPanelRect) {
      const panel = rectData.settingsPanelRect;
      const left = Math.max(0, Math.ceil(panel.x));
      const top = Math.max(0, Math.ceil(panel.y));
      const right = Math.min(width, Math.floor(panel.x + panel.width));
      const bottom = Math.min(height, Math.floor(panel.y + panel.height));
      if (right <= left || bottom <= top) throw new Error('Settings panel has no visible pixels');
      const region = { left, top, width: right - left, height: bottom - top };
      const originalPixels = await sharp(sourcePath).extract(region).ensureAlpha().raw().toBuffer();
      const annotatedPixels = await sharp(outputPath).extract(region).ensureAlpha().raw().toBuffer();
      panelPixelsPreserved = originalPixels.equals(annotatedPixels);
      if (!panelPixelsPreserved) throw new Error(`Annotations cover settings panel: ${run.output}`);
    } else if (suppliedSourceDir) {
      throw new Error(`Missing settings panel geometry: ${run.rects}`);
    }

    const collisions = annotations.flatMap((annotation) => (
      annotations
        .filter((other) => other !== annotation)
        .filter((other) => intersects(annotation.labelRect, other.labelRect, 4))
        .map((other) => ({
          type: 'label-label',
          label: annotation.text,
          other: other.text,
        }))
    )).concat(
      annotations
        .filter((annotation) => rectData.fabButtons.some((button) => intersects(annotation.labelRect, button.rect, 8)))
        .map((annotation) => ({
          type: 'label-target',
          label: annotation.text,
        })),
    ).concat(
      annotations
        .filter((annotation) => annotation.legend ? false : annotation.belowTarget
          ? annotation.lineTo.y <= annotation.targetRect.bottom
          : annotation.lineTo.x >= annotation.targetRect.left)
        .map((annotation) => ({
          type: 'arrow-enters-target',
          label: annotation.text,
        })),
    ).concat(
      annotations
        .filter((annotation) => annotation.legend && (annotation.labelRect.left < width
          || annotation.labelRect.right > width + legendWidth
          || (annotation.id === 'about'
            ? annotation.lineTo.y >= annotation.targetRect.top
            : annotation.lineTo.x <= annotation.targetRect.right)))
        .map((annotation) => ({ type: 'legend-or-arrow-over-target', label: annotation.text })),
    );

    results.push({
      source: sourcePath,
      output: outputPath,
      sourceSha256: createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex'),
      coordinatesSource: path.join(sourceDir, run.rects),
      coordinatesSha256: createHash('sha256').update(await fs.readFile(path.join(sourceDir, run.rects))).digest('hex'),
      outputSha256: createHash('sha256').update(await fs.readFile(outputPath)).digest('hex'),
      sourceRevision: rectData.sourceRevision,
      nativeAppInterfaceEmulated: rectData.nativeAppInterfaceEmulated ?? false,
      width,
      height,
      outputWidth: width + legendWidth,
      annotationStyle: suppliedSourceDir ? 'external-legend' : 'large-arrow',
      panelPixelsPreserved,
      labels: annotations.map((annotation) => ({
        text: annotation.text,
        targetId: annotation.id,
        labelRect: annotation.labelRect,
        lineFrom: annotation.lineFrom,
        lineTo: annotation.lineTo,
        arrowHead: annotation.arrowHead,
      })),
      collisionCheck: {
        targetCount: annotations.length,
        collisions,
      },
    });

    if (collisions.length > 0) {
      throw new Error(`Annotation collisions in ${run.output}: ${JSON.stringify(collisions)}`);
    }
  }

  await updateAudit(results);
  console.log(JSON.stringify({
    generated: results.map((result) => result.output),
    auditPath,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
