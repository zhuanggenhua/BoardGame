#!/usr/bin/env node
// Static AST guard. This parses source; it does not compile or execute game code.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { moduleCounterWrites } = require('./architecture-determinism.cjs');

const root = path.resolve(__dirname, '../..');
const src = path.join(root, 'src');
const gameDir = path.join(src, 'games');
const boundaries = ['engine', 'components/game/framework'];
const configPath = path.join(root, 'tsconfig.app.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (parsed.errors.length) {
    throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
}

function inside(file, directory) {
    const relative = path.relative(directory, file);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function* sources(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (!['node_modules', '__tests__', '__mocks__'].includes(entry.name)) yield* sources(file);
        } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
            yield file;
        }
    }
}

function moduleSpecifier(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        return node.moduleReference.expression;
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) return node.argument.literal;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) return node.arguments[0];
    return undefined;
}

let violations = 0;
const violationsByRule = {};
function report(rule, file, line, detail) {
    violations += 1;
    violationsByRule[rule] = (violationsByRule[rule] ?? 0) + 1;
    console.error(`[${rule}] ${path.relative(root, file).replace(/\\/g, '/')}:${line}: ${detail}`);
}
const sourceCache = new Map();
function readSource(file) {
    if (!sourceCache.has(file)) sourceCache.set(file, ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true));
    return sourceCache.get(file);
}
function resolve(name, file) {
    const resolved = ts.resolveModuleName(name, file, parsed.options, ts.sys).resolvedModule;
    if (resolved && !resolved.isExternalLibraryImport) return path.resolve(resolved.resolvedFileName);
    const candidate = name.startsWith('@/') ? path.join(src, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : undefined;
    if (!candidate) return undefined;
    return [candidate, ...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(suffix => candidate + suffix)]
        .find(target => fs.existsSync(target) && fs.statSync(target).isFile());
}
function references(source, runtimeOnly) {
    const result = [];
    const visit = node => {
        if (runtimeOnly) {
            if (ts.isImportTypeNode(node)) return;
            if ((ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) || (ts.isExportDeclaration(node) && node.isTypeOnly)) return;
        }
        const literal = moduleSpecifier(node);
        if (literal && ts.isStringLiteralLike(literal)) result.push({ name: literal.text,
            line: source.getLineAndCharacterOfPosition(literal.getStart(source)).line + 1 });
        ts.forEachChild(node, visit);
    };
    visit(source);
    return result;
}
function walkRuntime(entries, onReference) {
    const seen = new Set(), queue = entries.map(file => ({ file, trail: [path.relative(root, file).replace(/\\/g, '/')] }));
    while (queue.length) {
        const {file, trail} = queue.shift();
        if (seen.has(file) || !/\.[cm]?[jt]sx?$/.test(file)) continue;
        seen.add(file);
        for (const ref of references(readSource(file), true)) {
            const target = resolve(ref.name, file);
            onReference(file, ref, target, trail);
            if (target && inside(target, src) && !seen.has(target)) queue.push({file: target, trail: [...trail, path.relative(root,target).replace(/\\/g,'/')]});
        }
    }
    return seen;
}

for (const boundary of boundaries) {
    for (const file of sources(path.join(src, boundary))) {
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node) {
            const specifier = moduleSpecifier(node);
            if (specifier && ts.isStringLiteralLike(specifier)) {
                const name = specifier.text;
                const resolved = ts.resolveModuleName(name, file, parsed.options, ts.sys).resolvedModule?.resolvedFileName;
                const candidate = resolved ?? (name.startsWith('@/')
                    ? path.join(src, name.slice(2))
                    : name.startsWith('.') ? path.resolve(path.dirname(file), name) : undefined);
                if (candidate && inside(candidate, gameDir)) {
                    const { line } = source.getLineAndCharacterOfPosition(specifier.getStart(source));
                    report('shared-game-dependency', file, line + 1, name);
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
}
// Runtime reachability includes aliases, barrels, bare imports and literal dynamic imports.
const sharedEntries = boundaries.flatMap(boundary => [...sources(path.join(src, boundary))]);
walkRuntime(sharedEntries, (file, ref, target, trail) => {
    if (target && inside(target, gameDir)) report('shared-transitive-game', file, ref.line, [...trail, ref.name].join(' -> '));
});
const serverEntry = path.join(gameDir, 'manifest.server.generated.ts');
const serverFiles = walkRuntime([serverEntry], (file, ref, target, trail) => {
    const clientPackage = /^(react(?:\/|$)|react-dom(?:\/|$)|react-router(?:-dom)?(?:\/|$)|framer-motion(?:\/|$))/.test(ref.name);
    const relative = target ? path.relative(src,target).replace(/\\/g,'/') : '';
    if (clientPackage || /(?:^|\/)ui\//.test(relative) || /^components\//.test(relative)
        || /^games\/[^/]+\/(?:client\.[jt]s|Board\.[jt]sx)$/.test(relative)) {
        report('server-client-runtime', file, ref.line, [...trail, ref.name].join(' -> '));
    }
});

for (const file of sources(gameDir)) {
    const relative = path.relative(gameDir,file).replace(/\\/g,'/');
    if (!/^[^/]+\/(?:domain|abilities)\//.test(relative)) continue;
    const source = readSource(file);
    for (const node of moduleCounterWrites(source)) report('domain-global-counter', file,
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        'Execution identities must come from persisted match state, not a module counter');
    for (const ref of references(source, true)) {
        const target=resolve(ref.name,file);
        if (target && /(?:^|\/)ui\//.test(path.relative(gameDir,target).replace(/\\/g,'/'))) report('domain-ui-runtime',file,ref.line,ref.name);
    }
    const visit = node => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
            && ['Date.now','Math.random'].includes(node.expression.getText(source))) {
            report('domain-determinism',file,source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,node.expression.getText(source));
        }
        ts.forEachChild(node,visit);
    };visit(source);
}

for (const entry of fs.readdirSync(gameDir,{withFileTypes:true}).filter(item=>item.isDirectory())) {
    const directory=path.join(gameDir,entry.name), manifest=path.join(directory,'manifest.ts');
    if (!fs.existsSync(manifest)) continue; // manifest.draft.ts does not enter formal registration.
    const client=path.join(directory,'client.ts'), board=path.join(directory,'Board.tsx');
    if (fs.existsSync(client) && (!fs.existsSync(board) || !references(readSource(board),true).some(ref=>resolve(ref.name,board)===client))) {
        report('client-registration-entry',board,1,'Board must import its client registration entry');
    }
    const domain=path.join(directory,'domain','index.ts');
    if (!fs.existsSync(domain)) { report('state-persistence-contract',manifest,1,'formal game requires domain/index.ts'); continue; }
    let declares=false;
    const visit=node=>{
        if (ts.isObjectLiteralExpression(node)) {
            const hasGameId=node.properties.some(property=>property.name?.getText() === 'gameId'
                && ts.isPropertyAssignment(property) && ((!ts.isStringLiteralLike(property.initializer)) || property.initializer.text===entry.name));
            if (hasGameId && node.properties.some(property=>property.name?.getText()==='statePersistence')) declares=true;
            if (hasGameId && node.properties.some(property=>property.name?.getText()==='prepareEventBatch')
                && node.properties.some(property=>['postProcessSystemEvents','interceptEvent'].includes(property.name?.getText()))) {
                report('event-batch-single-owner',domain,readSource(domain).getLineAndCharacterOfPosition(node.getStart()).line+1,
                    'prepareEventBatch cannot be combined with legacy postProcessSystemEvents/interceptEvent');
            }
        }
        ts.forEachChild(node,visit);
    };visit(readSource(domain));
    if (!declares) report('state-persistence-contract',domain,1,'DomainCore must declare version, validation and supported migrations');
}

// Descriptor transport data must not regain executable callbacks.
const interactionFile=path.join(src,'engine/systems/InteractionSystem.ts');
for (const declaration of readSource(interactionFile).statements) {
    if (!ts.isInterfaceDeclaration(declaration)||declaration.name.text!=='MultistepChoiceData') continue;
    const visit=node=>{
        if(ts.isFunctionTypeNode(node)||ts.isMethodSignature(node)) report('descriptor-runtime-function',interactionFile,
            readSource(interactionFile).getLineAndCharacterOfPosition(node.getStart()).line+1,'Move callbacks to multistepChoiceRuntime.ts');
        ts.forEachChild(node,visit);
    };visit(declaration);
}
console.log(JSON.stringify({check:'architecture', serverModules:serverFiles.size, violations, rules:violationsByRule}));
process.exitCode=violations?1:0;
