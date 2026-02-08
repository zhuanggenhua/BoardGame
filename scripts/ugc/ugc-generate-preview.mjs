import fs from 'node:fs';
import path from 'node:path';

const draftPath = path.resolve('docs/ugc/doudizhu-preview.ugc.json');
const outPath = path.resolve('uploads/ugc/local-draft/doudizhu-preview/domain.js');

const data = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
const rulesCode = String(data.rulesCode || '');

const schemaDefaults = {};
if (Array.isArray(data.schemas)) {
    for (const schema of data.schemas) {
        const id = schema?.id;
        const defaultId = schema?.defaultRenderComponentId;
        if (id && typeof defaultId === 'string' && defaultId.trim()) {
            schemaDefaults[id] = defaultId.trim();
        }
    }
}

const previewConfig = {
    layout: data.layout || [],
    renderComponents: data.renderComponents || [],
    instances: data.instances || {},
    layoutGroups: data.layoutGroups || [],
    ...(Object.keys(schemaDefaults).length ? { schemaDefaults } : {}),
};

const previewConfigJson = JSON.stringify(previewConfig, null, 2);

const wrapper = [
    '',
    '',
    '// === builder preview config injected for runtime view ===',
    `const builderPreviewConfig = ${previewConfigJson};`,
    'const __attachBuilderPreviewConfig = (state) => {',
    '  if (!state || typeof state !== "object") return state;',
    '  const publicZones = (state.publicZones && typeof state.publicZones === "object") ? state.publicZones : {};',
    '  return { ...state, publicZones: { ...publicZones, builderPreviewConfig } };',
    '};',
    'const __baseSetup = domain.setup;',
    'const __baseReduce = domain.reduce;',
    'if (typeof __baseSetup === "function") {',
    '  domain.setup = (playerIds, random) => __attachBuilderPreviewConfig(__baseSetup(playerIds, random));',
    '}',
    'if (typeof __baseReduce === "function") {',
    '  domain.reduce = (state, event) => __attachBuilderPreviewConfig(__baseReduce(state, event));',
    '}',
    '',
].join('\n');

const output = `${rulesCode}${wrapper}`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output, 'utf8');

console.log(`[UGC] domain.js written: ${outPath}`);
