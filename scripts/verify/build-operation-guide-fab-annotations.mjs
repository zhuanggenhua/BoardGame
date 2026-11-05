import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const sourceDir = path.join(
  rootDir,
  'test-results',
  'evidence-screenshots',
  '_shared',
  'operation-guide-dicethrone-source-real-screenshots-20260913',
);
const outputDir = path.join(rootDir, 'public', 'images', 'operation-guide');
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
  const left = clamp(Math.min(style.labelLeft, maxLeft), 16, Math.max(16, width - labelWidth - 16));
  const top = clamp(rect.centerY - style.labelHeight / 2, 14, height - style.labelHeight - 14);
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
    x: labelRect.right + style.arrowTailGap,
    y: rect.centerY,
  };
  const lineTo = {
    x: rect.left - style.targetGap,
    y: rect.centerY,
  };
  const arrowHead = [
    { x: lineTo.x, y: lineTo.y },
    { x: lineTo.x - style.arrowHeadLength, y: lineTo.y - style.arrowHeadHalfHeight },
    { x: lineTo.x - style.arrowHeadLength, y: lineTo.y + style.arrowHeadHalfHeight },
  ];

  return { id, text, targetRect: rect, labelRect, lineFrom, lineTo, arrowHead };
};

const renderAnnotation = (annotation, style) => {
  const arrowPoints = annotation.arrowHead.map((point) => `${point.x},${point.y}`).join(' ');
  const lineEndX = annotation.lineTo.x - style.arrowHeadLength * 0.55;
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
        y2="${annotation.lineTo.y}"
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
        y2="${annotation.lineTo.y}"
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
    ${annotations.map((annotation) => renderAnnotation(annotation, style)).join('\n')}
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

  for (const run of fabRuns) {
    const sourcePath = path.join(sourceDir, run.source);
    const outputPath = path.join(outputDir, run.output);
    const rectData = await readJson(path.join(sourceDir, run.rects));
    const metadata = await sharp(sourcePath).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (!width || !height) {
      throw new Error(`Cannot read image size: ${sourcePath}`);
    }

    const rectById = new Map(rectData.fabButtons.map((button) => [button.id, button.rect]));
    const style = styles[run.style];
    const annotations = run.labels.map(([id, text]) => {
      const rect = rectById.get(id);
      if (!rect) {
        throw new Error(`Missing FAB rect "${id}" for ${run.rects}`);
      }
      return annotationFor({ id, text, rect, width, height, style });
    });
    const overlay = buildOverlay(width, height, annotations, style);

    await sharp(sourcePath)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

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
        .filter((annotation) => annotation.lineTo.x >= annotation.targetRect.left)
        .map((annotation) => ({
          type: 'arrow-enters-target',
          label: annotation.text,
        })),
    );

    results.push({
      source: sourcePath,
      output: outputPath,
      width,
      height,
      annotationStyle: 'large-arrow',
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
