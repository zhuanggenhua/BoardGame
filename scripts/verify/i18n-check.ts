import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import { I18N_NAMESPACES, SUPPORTED_LANGUAGES } from '../../src/lib/i18n/types';
import { HEROES_DATA } from '../../src/games/dicethrone/heroes';
import { COMMON_CARDS } from '../../src/games/dicethrone/domain/commonCards';
import { CHARACTER_DATA_MAP } from '../../src/games/dicethrone/domain/characters';
import { DICETHRONE_CHARACTER_CATALOG } from '../../src/games/dicethrone/domain/core-types';
import { SHARED_TOKENS } from '../../src/games/dicethrone/domain/sharedTokens';
import type { AbilityDef } from '../../src/games/dicethrone/domain/combat';
import type { TriggerCondition } from '../../src/games/dicethrone/domain/combat/conditions';

type LocaleNamespace = Record<string, unknown>;

type LocalesByLanguage = Record<string, Record<string, LocaleNamespace>>;

type I18nReference = {
    key: string;
    namespaces: string[];
    file: string;
    line: number;
    source: string;
    patternSegments?: Array<string | null>;
};

type I18nWarning = {
    type:
        | 'dynamic-namespace'
        | 'ambiguous-namespace'
        | 'unknown-namespace'
        | 'dynamic-key'
        | 'exists-namespace-mismatch'
        | 'deprecated-dicethrone-hero-key'
        | 'raw-validation-error'
        | 'raw-simple-choice-title'
        | 'raw-simple-choice-option-label'
        | 'raw-prompt-option-label'
        | 'raw-create-skip-label'
        | 'raw-dicethrone-contract-text';
    key: string;
    file: string;
    line: number;
    source: string;
    detail?: string;
};

type MissingTranslation = {
    namespaces: string[];
    key: string;
    languages: string[];
    refs: I18nReference[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const LOCALES_DIR = path.join(ROOT_DIR, 'public', 'locales');

const DEFAULT_NAMESPACE = 'common';
const SCAN_DIRS = ['src', 'apps'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIRS = new Set([
    '.git',
    '.agent',
    '.codex',
    '.devin',
    '.windsurf',
    '.claude',
    'node_modules',
    'dist',
    'build',
    'public',
    'docs',
    'design-system',
    'openspec',
    'e2e',
    'test',
    '__tests__',
    'scripts',
    'uploads',
    'coverage',
    'evidence',
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isAsciiOnly = (value: string): boolean => (
    Array.from(value).every((char) => char.charCodeAt(0) <= 0x7f)
);

export const parseNamespaceLiteral = (value: string): string[] => {
    const trimmed = value.trim();
    const namespaces: string[] = [];
    const regex = /['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(trimmed)) !== null) {
        namespaces.push(match[1]);
    }
    return namespaces;
};

const parseNamespaceArgument = (argument: string): { namespaces: string[]; dynamic: boolean; fromArray: boolean } => {
    const trimmed = argument.trim();
    if (!trimmed) {
        return { namespaces: [DEFAULT_NAMESPACE], dynamic: false, fromArray: false };
    }
    const firstMatch = trimmed.match(/^([\s\S]*?]|['"][^'"]+['"])/);
    if (!firstMatch) {
        return { namespaces: [], dynamic: true, fromArray: false };
    }
    const token = firstMatch[1];
    const namespaces = parseNamespaceLiteral(token);
    if (namespaces.length === 0) {
        return { namespaces: [], dynamic: true, fromArray: token.startsWith('[') };
    }
    let dynamic = false;
    if (token.startsWith('[')) {
        const cleaned = token
            .replace(/['"][^'"]*['"]/g, '')
            .replace(/[\s,[\]]/g, '');
        if (cleaned.length > 0) {
            dynamic = true;
        }
    }
    return { namespaces, dynamic, fromArray: token.startsWith('[') };
};

const getLineNumber = (content: string, index: number): number => {
    if (index <= 0) return 1;
    return content.slice(0, index).split('\n').length;
};

const hasKeyPathSegments = (cursor: unknown, segments: string[]): boolean => {
    if (segments.length === 0) {
        return true;
    }
    if (!isPlainObject(cursor)) {
        return false;
    }

    const remainingKey = segments.join('.');
    if (remainingKey in cursor) {
        return true;
    }

    const [segment, ...rest] = segments;
    if (!(segment in cursor)) {
        return false;
    }

    return hasKeyPathSegments(cursor[segment], rest);
};

const hasKeyPath = (namespaceData: LocaleNamespace, keyPath: string): boolean => {
    if (!keyPath) return false;
    return hasKeyPathSegments(namespaceData, keyPath.split('.'));
};

const collectPatternMatches = (
    namespaceData: LocaleNamespace,
    patternSegments: Array<string | null>,
    prefix: string[] = [],
): string[] => {
    const visit = (cursor: unknown, index: number, currentPrefix: string[]): string[] => {
        if (index >= patternSegments.length) {
            return [currentPrefix.join('.')];
        }

        const segment = patternSegments[index];
        if (!isPlainObject(cursor)) {
            return [];
        }

        if (segment === null) {
            return Object.entries(cursor).flatMap(([key, value]) => visit(value, index + 1, [...currentPrefix, key]));
        }

        if (!(segment in cursor)) {
            return [];
        }

        return visit(cursor[segment], index + 1, [...currentPrefix, segment]);
    };

    return visit(namespaceData, 0, prefix);
};

const loadLocales = (): { locales: LocalesByLanguage; namespaceFiles: string[] } => {
    const locales: LocalesByLanguage = {};
    const namespaceFiles = new Set<string>();

    for (const language of SUPPORTED_LANGUAGES) {
        const langDir = path.join(LOCALES_DIR, language);
        if (!fs.existsSync(langDir)) continue;
        const files = fs.readdirSync(langDir).filter((file) => file.endsWith('.json'));
        const namespaces: Record<string, LocaleNamespace> = {};
        for (const file of files) {
            const ns = path.basename(file, '.json');
            namespaceFiles.add(ns);
            const filePath = path.join(langDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            namespaces[ns] = JSON.parse(content) as LocaleNamespace;
        }
        locales[language] = namespaces;
    }

    return { locales, namespaceFiles: Array.from(namespaceFiles) };
};

const findNsOverride = (snippet: string): string[] => {
    const match = snippet.match(/\bns\s*:\s*(\[[^\]]*\]|['"][^'"]+['"])/);
    if (!match) return [];
    return parseNamespaceLiteral(match[1]);
};

const escapeRegExp = (value: string): string => (
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

const parseI18nKey = (rawKey: string, knownNamespaces: Set<string>): { namespace?: string; key: string } => {
    const delimiterIndex = rawKey.indexOf(':');
    if (delimiterIndex <= 0) return { key: rawKey };
    const possibleNamespace = rawKey.slice(0, delimiterIndex);
    if (!knownNamespaces.has(possibleNamespace)) return { key: rawKey };
    return { namespace: possibleNamespace, key: rawKey.slice(delimiterIndex + 1) };
};

type AliasInfo = {
    namespaces: Set<string>;
    dynamic: boolean;
    fromArray: boolean;
};

const extractAliasName = (bindings: string): string | null => {
    const aliasMatch = bindings.match(/\bt\s*(?::\s*([A-Za-z_$][\w$]*))?/);
    if (!aliasMatch) return null;
    return aliasMatch[1] ?? 't';
};

const addAliasInfo = (map: Map<string, AliasInfo>, alias: string, namespace: string, dynamic: boolean, fromArray: boolean) => {
    const info = map.get(alias) ?? { namespaces: new Set<string>(), dynamic: false, fromArray: false };
    if (namespace) info.namespaces.add(namespace);
    info.dynamic = info.dynamic || dynamic;
    info.fromArray = info.fromArray || fromArray;
    map.set(alias, info);
};

const buildAliasMap = (content: string, defaultNamespace: string): Map<string, AliasInfo> => {
    const aliasMap = new Map<string, AliasInfo>();
    const destructureRegex = /\b(const|let|var)\s+\{([\s\S]*?)\}\s*=\s*useTranslation\s*\(([\s\S]*?)\)/g;
    let match: RegExpExecArray | null;
    while ((match = destructureRegex.exec(content)) !== null) {
        const bindings = match[2];
        const argument = match[3];
        const aliasName = extractAliasName(bindings);
        if (!aliasName) continue;
        const { namespaces, dynamic, fromArray } = parseNamespaceArgument(argument || '');
        for (const ns of namespaces) {
            addAliasInfo(aliasMap, aliasName, ns, dynamic, fromArray);
        }
    }

    const serverI18nRegex = /\bconst\s+\{([\s\S]*?)\}\s*=\s*createServerI18n\s*\(/g;
    while ((match = serverI18nRegex.exec(content)) !== null) {
        const bindings = match[1];
        const aliasName = extractAliasName(bindings);
        if (aliasName) {
            addAliasInfo(aliasMap, aliasName, 'server', false, false);
        }
    }

    const serverAliasRegex = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*tServer\b/g;
    while ((match = serverAliasRegex.exec(content)) !== null) {
        addAliasInfo(aliasMap, match[1], 'server', false, false);
    }

    const serverAliasDirectRegex = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*tServer\b/g;
    while ((match = serverAliasDirectRegex.exec(content)) !== null) {
        addAliasInfo(aliasMap, match[1], 'server', false, false);
    }

    if (aliasMap.size === 0 && content.includes('useTranslation')) {
        const fallbackMatch = content.match(/useTranslation\s*\(([\s\S]*?)\)/);
        const argument = fallbackMatch?.[1] ?? '';
        const { namespaces, dynamic, fromArray } = parseNamespaceArgument(argument);
        for (const ns of namespaces) {
            addAliasInfo(aliasMap, 't', ns || defaultNamespace, dynamic, fromArray);
        }
    }

    return aliasMap;
};

const parseStringLiteral = (quote: string, value: string): { value: string; dynamic: boolean } => {
    if (quote === '`' && value.includes('${')) {
        return { value, dynamic: true };
    }
    return { value, dynamic: false };
};

const parseTemplateLiteralPatterns = (
    rawValue: string,
    content: string,
    filePath: string,
    position: number,
    knownNamespaces: Set<string>,
): ResolvedIdentifierPattern[] => {
    if (!rawValue.includes('${')) {
        return [];
    }

    const parsed = parseI18nKey(rawValue, knownNamespaces);
    const keyPath = parsed.key;
    const placeholderRegex = /\$\{[^}]+\}/g;
    let placeholderMatch: RegExpExecArray | null;
    while ((placeholderMatch = placeholderRegex.exec(keyPath)) !== null) {
        const before = placeholderMatch.index > 0 ? keyPath[placeholderMatch.index - 1] : '';
        const afterIndex = placeholderMatch.index + placeholderMatch[0].length;
        const after = afterIndex < keyPath.length ? keyPath[afterIndex] : '';
        if ((before && before !== '.') || (after && after !== '.')) {
            return [];
        }
    }

    const segments = splitTemplatePathSegments(keyPath);
    const placeholderOnlyRegex = /^\$\{([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\}$/;
    let variants: Array<Array<string | null>> = [[]];

    for (const segment of segments) {
        const match = segment.match(placeholderOnlyRegex);
        if (!match) {
            if (segment.includes('${')) {
                return [];
            }
            variants = variants.map((variant) => [...variant, segment]);
            continue;
        }

        const resolvedKeys = resolveTemplatePlaceholderKeys(
            match[1],
            content,
            filePath,
            position,
            knownNamespaces,
        );

        if (resolvedKeys.length > 0) {
            const nextVariants: Array<Array<string | null>> = [];
            for (const variant of variants) {
                for (const key of resolvedKeys) {
                    nextVariants.push([...variant, key.includes('.') ? null : key]);
                }
            }
            variants = nextVariants;
            continue;
        }

        variants = variants.map((variant) => [...variant, null]);
    }

    return variants
        .filter((patternSegments) => {
            if (patternSegments.length === 0 || patternSegments[0] === null) {
                return false;
            }
            const normalized = patternSegments.map((segment) => segment ?? '*').join('.');
            return !normalized.startsWith('.') && !normalized.endsWith('.') && !normalized.includes('..');
        })
        .map((patternSegments) => ({
            namespace: parsed.namespace,
            key: patternSegments.map((segment) => segment ?? '*').join('.'),
            patternSegments,
        }));
};

const looksLikeHumanReadableValidationError = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!isAsciiOnly(trimmed)) return false;
    return trimmed.includes(' ') || /[:!]/.test(trimmed);
};

const detectValidationFailHelperNames = (content: string): string[] => {
    const helperNames = new Set<string>();
    const helperPatterns = [
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*([A-Za-z_$][\w$]*)[\s\S]{0,100}?\)\s*(?::[\s\S]{0,100})?=>\s*(?:\(\s*)?\{\s*(?:valid\s*:\s*false\s*,\s*error\s*:\s*\2|error\s*:\s*\2\s*,\s*valid\s*:\s*false)\s*\}(?:\s*\))?/g,
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*([A-Za-z_$][\w$]*)[\s\S]{0,100}?\)\s*(?::[\s\S]{0,100})?=>\s*\{\s*return\s*\{\s*(?:valid\s*:\s*false\s*,\s*error\s*:\s*\2|error\s*:\s*\2\s*,\s*valid\s*:\s*false)\s*\}\s*;?\s*\}/g,
        /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)[\s\S]{0,100}?\)\s*(?::[\s\S]{0,100})?\{\s*return\s*\{\s*(?:valid\s*:\s*false\s*,\s*error\s*:\s*\2|error\s*:\s*\2\s*,\s*valid\s*:\s*false)\s*\}\s*;?\s*\}/g,
    ];

    for (const pattern of helperPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            helperNames.add(match[1]);
        }
    }

    return Array.from(helperNames);
};

const extractLiteralKeysFromExpression = (expression: string): { keys: string[]; dynamic: boolean } => {
    const trimmed = expression.trim();
    if (/^getDiceThroneCharacterNameKey\s*\(/.test(trimmed)) {
        return {
            keys: DICETHRONE_CHARACTER_CATALOG
                .map((character) => character.nameKey)
                .filter((key): key is string => typeof key === 'string' && key.length > 0),
            dynamic: false,
        };
    }
    if (trimmed.includes('`') && trimmed.includes('${')) {
        return { keys: [], dynamic: true };
    }
    if (trimmed.includes('+')) {
        return { keys: [], dynamic: true };
    }
    const keys: string[] = [];
    const regex = /['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(trimmed)) !== null) {
        const before = trimmed.slice(Math.max(0, match.index - 6), match.index);
        if (/(===|!==|==|!=)\s*$/.test(before)) {
            continue;
        }
        if (/\bcase\s*$/.test(before)) {
            continue;
        }
        keys.push(match[1]);
    }
    if (keys.length === 0) {
        return { keys: [], dynamic: true };
    }
    return { keys, dynamic: false };
};

type ResolvedIdentifierPattern = {
    namespace?: string;
    key: string;
    patternSegments: Array<string | null>;
};

type ResolvedIdentifierKeys = {
    keys: string[];
    dynamic: boolean;
    patterns?: ResolvedIdentifierPattern[];
};

const readDelimitedExpression = (
    content: string,
    startIndex: number,
    terminator: string,
): string => {
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let angleDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;

    for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        const prev = i > 0 ? content[i - 1] : '';

        if (inSingleQuote) {
            if (char === '\'' && prev !== '\\') inSingleQuote = false;
            continue;
        }
        if (inDoubleQuote) {
            if (char === '"' && prev !== '\\') inDoubleQuote = false;
            continue;
        }
        if (inTemplate) {
            if (char === '`' && prev !== '\\') inTemplate = false;
            continue;
        }

        if (char === '\'') {
            inSingleQuote = true;
            continue;
        }
        if (char === '"') {
            inDoubleQuote = true;
            continue;
        }
        if (char === '`') {
            inTemplate = true;
            continue;
        }

        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (char === '(') parenDepth++;
        else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (char === '<') angleDepth++;
        else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);

        if (
            char === terminator
            && braceDepth === 0
            && bracketDepth === 0
            && parenDepth === 0
            && angleDepth === 0
        ) {
            return content.slice(startIndex, i).trim();
        }
    }

    return content.slice(startIndex).trim();
};

const splitTopLevelUnion = (typeExpression: string): string[] => {
    const parts: string[] = [];
    let start = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let angleDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;

    for (let i = 0; i < typeExpression.length; i++) {
        const char = typeExpression[i];
        const prev = i > 0 ? typeExpression[i - 1] : '';

        if (inSingleQuote) {
            if (char === '\'' && prev !== '\\') inSingleQuote = false;
            continue;
        }
        if (inDoubleQuote) {
            if (char === '"' && prev !== '\\') inDoubleQuote = false;
            continue;
        }
        if (inTemplate) {
            if (char === '`' && prev !== '\\') inTemplate = false;
            continue;
        }

        if (char === '\'') {
            inSingleQuote = true;
            continue;
        }
        if (char === '"') {
            inDoubleQuote = true;
            continue;
        }
        if (char === '`') {
            inTemplate = true;
            continue;
        }

        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (char === '(') parenDepth++;
        else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (char === '<') angleDepth++;
        else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);

        if (
            char === '|'
            && braceDepth === 0
            && bracketDepth === 0
            && parenDepth === 0
            && angleDepth === 0
        ) {
            const part = typeExpression.slice(start, i).trim();
            if (part) parts.push(part);
            start = i + 1;
        }
    }

    const tail = typeExpression.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
};

const collectStringLiteralUnionValues = (typeExpression: string): string[] => {
    const parts = splitTopLevelUnion(typeExpression);
    if (parts.length === 0) return [];
    const values: string[] = [];

    for (const part of parts) {
        const match = part.match(/^['"]([^'"]+)['"]$/);
        if (!match) {
            return [];
        }
        values.push(match[1]);
    }

    return Array.from(new Set(values));
};

const extractBraceBlock = (content: string, openBraceIndex: number): string | null => {
    let depth = 0;
    for (let i = openBraceIndex; i < content.length; i++) {
        const char = content[i];
        if (char === '{') depth++;
        else if (char === '}') {
            depth--;
            if (depth === 0) {
                return content.slice(openBraceIndex + 1, i);
            }
        }
    }
    return null;
};

const extractPropertyTypeFromObjectBody = (body: string, propertyName: string): string | null => {
    const propertyRegex = new RegExp(`\\b${escapeRegExp(propertyName)}\\??\\s*:`, 'g');
    let match: RegExpExecArray | null;
    while ((match = propertyRegex.exec(body)) !== null) {
        const typeExpression = readDelimitedExpression(body, match.index + match[0].length, ';');
        if (typeExpression) {
            return typeExpression;
        }
    }
    return null;
};

const normalizeTypeReference = (typeExpression: string): string | null => {
    const trimmed = typeExpression.trim().replace(/^\(([\s\S]+)\)$/, '$1').trim();
    if (!trimmed) return null;
    if (trimmed.includes('{') || trimmed.includes('|') || trimmed.includes('&') || trimmed.includes('[')) {
        return null;
    }
    const withoutGenerics = trimmed.replace(/<[\s\S]*>$/, '').trim();
    const match = withoutGenerics.match(/^(?:import\([^)]*\)\.)?([A-Za-z_$][\w$]*)$/);
    return match?.[1] ?? null;
};

const findRelativeImportSource = (content: string, typeName: string): string | null => {
    const importRegex = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
        const bindings = match[1]
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        for (const binding of bindings) {
            const aliasMatch = binding.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
            if (!aliasMatch) continue;
            const importedName = aliasMatch[1];
            const localName = aliasMatch[2] ?? importedName;
            if (localName === typeName) {
                return match[2];
            }
        }
    }
    return null;
};

const resolveRelativeTypeFile = (currentFilePath: string, importSource: string): string | null => {
    if (!importSource.startsWith('.')) {
        return null;
    }

    const candidateBase = path.resolve(path.dirname(currentFilePath), importSource);
    const candidates = [
        candidateBase,
        `${candidateBase}.ts`,
        `${candidateBase}.tsx`,
        `${candidateBase}.js`,
        `${candidateBase}.jsx`,
        path.join(candidateBase, 'index.ts'),
        path.join(candidateBase, 'index.tsx'),
        path.join(candidateBase, 'index.js'),
        path.join(candidateBase, 'index.jsx'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }

    return null;
};

const resolveTypeDeclarationExpression = (
    content: string,
    typeName: string,
): string | null => {
    const interfaceRegex = new RegExp(`(?:export\\s+)?interface\\s+${escapeRegExp(typeName)}\\s*\\{`, 'g');
    const interfaceMatch = interfaceRegex.exec(content);
    if (interfaceMatch) {
        const openBraceIndex = content.indexOf('{', interfaceMatch.index);
        const body = openBraceIndex >= 0 ? extractBraceBlock(content, openBraceIndex) : null;
        if (body !== null) {
            return `{${body}}`;
        }
    }

    const typeRegex = new RegExp(`(?:export\\s+)?type\\s+${escapeRegExp(typeName)}\\s*=`, 'g');
    const typeMatch = typeRegex.exec(content);
    if (typeMatch) {
        return readDelimitedExpression(content, typeMatch.index + typeMatch[0].length, ';');
    }

    return null;
};

const resolveNamedTypeExpression = (
    content: string,
    filePath: string,
    typeName: string,
): { content: string; filePath: string; expression: string } | null => {
    const localDeclaration = resolveTypeDeclarationExpression(content, typeName);
    if (localDeclaration) {
        return { content, filePath, expression: localDeclaration };
    }

    const importSource = findRelativeImportSource(content, typeName);
    if (!importSource) {
        return null;
    }

    const resolvedFile = resolveRelativeTypeFile(filePath, importSource);
    if (!resolvedFile) {
        return null;
    }

    const importedContent = fs.readFileSync(resolvedFile, 'utf-8');
    const importedDeclaration = resolveTypeDeclarationExpression(importedContent, typeName);
    if (!importedDeclaration) {
        return null;
    }

    return { content: importedContent, filePath: resolvedFile, expression: importedDeclaration };
};

const collectCandidateTypeExpressionsForIdentifier = (
    content: string,
    filePath: string,
    identifier: string,
    position: number,
): string[] => {
    const expressions: string[] = [];
    const seen = new Set<string>();

    const pushExpression = (expression: string | null) => {
        const trimmed = expression?.trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        expressions.push(trimmed);
    };

    const variableRegex = new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(identifier)}\\s*:\\s*`, 'g');
    let variableMatch: RegExpExecArray | null;
    while ((variableMatch = variableRegex.exec(content)) !== null) {
        if (variableMatch.index > position) break;
        pushExpression(readDelimitedExpression(content, variableMatch.index + variableMatch[0].length, '='));
    }

    const propertyRegex = new RegExp(`\\b${escapeRegExp(identifier)}\\??\\s*:`, 'g');
    let propertyMatch: RegExpExecArray | null;
    while ((propertyMatch = propertyRegex.exec(content)) !== null) {
        if (propertyMatch.index > position) break;
        pushExpression(readDelimitedExpression(content, propertyMatch.index + propertyMatch[0].length, ';'));
    }

    const destructuredParamRegex = /\{([\s\S]{0,500}?)\}\s*:\s*([A-Za-z_$][\w$]*)/g;
    let destructuredParamMatch: RegExpExecArray | null;
    while ((destructuredParamMatch = destructuredParamRegex.exec(content)) !== null) {
        if (destructuredParamMatch.index > position) break;

        const bindingSource = destructuredParamMatch[1];
        const paramTypeName = destructuredParamMatch[2];
        const bindingRegex = /(?:^|,)\s*([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?/g;
        let bindingMatch: RegExpExecArray | null;
        let propertyName: string | null = null;

        while ((bindingMatch = bindingRegex.exec(bindingSource)) !== null) {
            const sourceName = bindingMatch[1];
            const localName = bindingMatch[2] ?? sourceName;
            if (localName === identifier) {
                propertyName = sourceName;
                break;
            }
        }

        if (!propertyName) {
            continue;
        }

        const resolvedType = resolveNamedTypeExpression(content, filePath, paramTypeName);
        if (!resolvedType || !resolvedType.expression.startsWith('{')) {
            continue;
        }

        const body = extractBraceBlock(resolvedType.expression, resolvedType.expression.indexOf('{'));
        if (body === null) {
            continue;
        }

        pushExpression(extractPropertyTypeFromObjectBody(body, propertyName));
    }

    return expressions;
};

const resolveTypeLiteralValues = (
    content: string,
    filePath: string,
    typeExpression: string,
    propertyPath: string[],
    visited: Set<string>,
): string[] => {
    const unionParts = splitTopLevelUnion(typeExpression)
        .map((part) => part.trim())
        .filter((part) => part !== 'null' && part !== 'undefined');

    if (unionParts.length === 0) {
        return [];
    }

    if (propertyPath.length === 0) {
        const directValues = collectStringLiteralUnionValues(unionParts.join(' | '));
        if (directValues.length > 0) {
            return directValues;
        }
    }

    const values = new Set<string>();

    for (const part of unionParts) {
        if (!part) continue;

        if (propertyPath.length > 0 && part.startsWith('{')) {
            const body = extractBraceBlock(part, part.indexOf('{'));
            if (body === null) continue;
            const propertyType = extractPropertyTypeFromObjectBody(body, propertyPath[0]);
            if (!propertyType) continue;
            for (const value of resolveTypeLiteralValues(content, filePath, propertyType, propertyPath.slice(1), visited)) {
                values.add(value);
            }
            continue;
        }

        const typeName = normalizeTypeReference(part);
        if (!typeName) {
            continue;
        }

        const visitKey = `${filePath}:${typeName}:${propertyPath.join('.')}`;
        if (visited.has(visitKey)) {
            continue;
        }
        visited.add(visitKey);

        const resolvedType = resolveNamedTypeExpression(content, filePath, typeName);
        if (!resolvedType) {
            continue;
        }

        for (const value of resolveTypeLiteralValues(
            resolvedType.content,
            resolvedType.filePath,
            resolvedType.expression,
            propertyPath,
            visited,
        )) {
            values.add(value);
        }
    }

    return Array.from(values);
};

const resolveMemberExpressionKeys = (
    content: string,
    filePath: string,
    expression: string,
    position: number,
): string[] => {
    const parts = expression.split('.').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
        return [];
    }

    const [rootIdentifier, ...propertyPath] = parts;
    const candidateTypes = collectCandidateTypeExpressionsForIdentifier(content, filePath, rootIdentifier, position);
    if (candidateTypes.length === 0) {
        return [];
    }

    const values = new Set<string>();
    for (const typeExpression of candidateTypes) {
        for (const value of resolveTypeLiteralValues(content, filePath, typeExpression, propertyPath, new Set<string>())) {
            values.add(value);
        }
    }

    return Array.from(values);
};

const resolveTemplatePlaceholderKeys = (
    placeholderExpression: string,
    content: string,
    filePath: string,
    position: number,
    knownNamespaces: Set<string>,
): string[] => {
    if (placeholderExpression.includes('.')) {
        return resolveMemberExpressionKeys(content, filePath, placeholderExpression, position);
    }

    const resolved = resolveIdentifierKeys(content, filePath, placeholderExpression, position, knownNamespaces);
    return resolved.keys.filter((key) => !key.includes('.'));
};

const splitTemplatePathSegments = (value: string): string[] => {
    const segments: string[] = [];
    let current = '';
    let placeholderDepth = 0;

    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        const nextChar = i + 1 < value.length ? value[i + 1] : '';

        if (char === '$' && nextChar === '{') {
            placeholderDepth++;
            current += '${';
            i++;
            continue;
        }

        if (char === '}' && placeholderDepth > 0) {
            placeholderDepth--;
            current += char;
            continue;
        }

        if (char === '.' && placeholderDepth === 0) {
            segments.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    segments.push(current);
    return segments;
};

const extractIdentifierExpression = (content: string, identifier: string, position: number): string | null => {
    const regex = new RegExp(`\\b(?:const|let|var)\\s+${identifier}\\s*=\\s*([\\s\\S]*?);`, 'g');
    let match: RegExpExecArray | null;
    let expression: string | null = null;
    while ((match = regex.exec(content)) !== null) {
        if (match.index > position) break;
        expression = match[1];
    }
    return expression;
};

const parseTemplateLiteralPatternsFromExpression = (
    expression: string,
    content: string,
    filePath: string,
    position: number,
    knownNamespaces: Set<string>,
): ResolvedIdentifierPattern[] => {
    const trimmed = expression.trim();
    const templateMatch = trimmed.match(/^`([\s\S]*)`$/);
    if (!templateMatch) return [];

    const rawValue = templateMatch[1];
    if (!rawValue.includes('${')) return [];

    const segments = splitTemplatePathSegments(rawValue);
    const placeholderOnlyRegex = /^\$\{([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\}$/;
    let variants: Array<Array<string | null>> = [[]];

    for (const segment of segments) {
        const placeholderMatch = segment.match(placeholderOnlyRegex);
        if (!placeholderMatch) {
            if (segment.includes('${')) {
                return [];
            }
            variants = variants.map((variant) => [...variant, segment]);
            continue;
        }

        const resolvedKeys = resolveTemplatePlaceholderKeys(
            placeholderMatch[1],
            content,
            filePath,
            position,
            knownNamespaces,
        );
        if (resolvedKeys.length > 0) {
            const nextVariants: Array<Array<string | null>> = [];
            for (const variant of variants) {
                for (const key of resolvedKeys) {
                    if (key.includes('.')) {
                        nextVariants.push([...variant, null]);
                    } else {
                        nextVariants.push([...variant, key]);
                    }
                }
            }
            variants = nextVariants;
            continue;
        }

        variants = variants.map((variant) => [...variant, null]);
    }

    return variants
        .filter((patternSegments) => patternSegments.length > 0 && patternSegments[0] !== null)
        .map((patternSegments) => {
            const normalizedKey = patternSegments.map((segment) => segment ?? '*').join('.');
            const parsed = parseI18nKey(normalizedKey, knownNamespaces);
            return {
                namespace: parsed.namespace,
                key: parsed.key,
                patternSegments,
            };
        });
};

const resolveIdentifierKeys = (
    content: string,
    filePath: string,
    identifier: string,
    position: number,
    knownNamespaces: Set<string>,
): ResolvedIdentifierKeys => {
    const expression = extractIdentifierExpression(content, identifier, position);
    if (!expression) {
        return { keys: [], dynamic: true };
    }

    const patterns = parseTemplateLiteralPatternsFromExpression(expression, content, filePath, position, knownNamespaces);
    if (patterns.length > 0) {
        return { keys: [], dynamic: false, patterns };
    }

    const literalResult = extractLiteralKeysFromExpression(expression);
    return { keys: literalResult.keys, dynamic: literalResult.dynamic };
};

const findCallEnd = (content: string, startIndex: number): number => {
    let depth = 0;
    for (let i = startIndex; i < content.length; i++) {
        const c = content[i];
        if (c === '(') depth++;
        else if (c === ')') {
            if (depth === 0) return i + 1;
            depth--;
        }
    }
    return Math.min(startIndex + 200, content.length);
};

const splitTopLevelCallArguments = (
    content: string,
    openParenIndex: number,
): Array<{ expression: string; start: number }> => {
    const args: Array<{ expression: string; start: number }> = [];
    let start = openParenIndex + 1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let angleDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;

    const pushArg = (end: number) => {
        const expression = content.slice(start, end).trim();
        if (expression) {
            args.push({ expression, start });
        }
    };

    for (let i = openParenIndex + 1; i < content.length; i++) {
        const char = content[i];
        const prev = i > 0 ? content[i - 1] : '';

        if (inSingleQuote) {
            if (char === '\'' && prev !== '\\') inSingleQuote = false;
            continue;
        }
        if (inDoubleQuote) {
            if (char === '"' && prev !== '\\') inDoubleQuote = false;
            continue;
        }
        if (inTemplate) {
            if (char === '`' && prev !== '\\') inTemplate = false;
            continue;
        }

        if (char === '\'') {
            inSingleQuote = true;
            continue;
        }
        if (char === '"') {
            inDoubleQuote = true;
            continue;
        }
        if (char === '`') {
            inTemplate = true;
            continue;
        }

        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (char === '(') parenDepth++;
        else if (char === ')') {
            if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0 && angleDepth === 0) {
                pushArg(i);
                return args;
            }
            parenDepth = Math.max(0, parenDepth - 1);
        } else if (char === '<') angleDepth++;
        else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);

        if (
            char === ','
            && braceDepth === 0
            && bracketDepth === 0
            && parenDepth === 0
            && angleDepth === 0
        ) {
            pushArg(i);
            start = i + 1;
        }
    }

    return args;
};

const parseStandaloneStringLiteral = (expression: string): { value: string; dynamic: boolean } | null => {
    const match = expression.trim().match(/^(['"`])((?:\\.|(?!\1)[\s\S])*)\1$/);
    if (!match) return null;
    return parseStringLiteral(match[1], match[2]);
};

const hasObjectLiteralTitleKey = (expression: string | undefined): boolean => {
    if (!expression) return false;
    const trimmed = expression.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    return /\btitleKey\s*:/.test(trimmed);
};

const findNearestObjectLiteral = (expression: string, position: number): string | null => {
    const openBraceIndex = expression.lastIndexOf('{', position);
    if (openBraceIndex < 0) return null;

    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;

    for (let i = openBraceIndex; i < expression.length; i++) {
        const char = expression[i];
        const prev = i > 0 ? expression[i - 1] : '';

        if (inSingleQuote) {
            if (char === '\'' && prev !== '\\') inSingleQuote = false;
            continue;
        }
        if (inDoubleQuote) {
            if (char === '"' && prev !== '\\') inDoubleQuote = false;
            continue;
        }
        if (inTemplate) {
            if (char === '`' && prev !== '\\') inTemplate = false;
            continue;
        }

        if (char === '\'') {
            inSingleQuote = true;
            continue;
        }
        if (char === '"') {
            inDoubleQuote = true;
            continue;
        }
        if (char === '`') {
            inTemplate = true;
            continue;
        }

        if (char === '{') depth++;
        else if (char === '}') {
            depth--;
            if (depth === 0) {
                return expression.slice(openBraceIndex, i + 1);
            }
        }
    }

    return expression.slice(openBraceIndex);
};

const objectLiteralHasProperty = (
    expression: string,
    propertyPosition: number,
    propertyName: string,
): boolean => {
    const objectLiteral = findNearestObjectLiteral(expression, propertyPosition);
    if (!objectLiteral) return false;
    return new RegExp(`\\b${escapeRegExp(propertyName)}\\s*:`).test(objectLiteral);
};

export const collectReferencesFromContent = (
    content: string,
    filePath: string,
    options: { defaultNamespace: string; knownNamespaces: Set<string> }
): { references: I18nReference[]; warnings: I18nWarning[] } => {
    const { defaultNamespace, knownNamespaces } = options;
    const references: I18nReference[] = [];
    const warnings: I18nWarning[] = [];
    const aliasMap = buildAliasMap(content, defaultNamespace);

    const addWarning = (warning: I18nWarning) => {
        warnings.push(warning);
    };

    const pushReference = (
        key: string,
        namespaces: string[],
        line: number,
        source: string,
        patternSegments?: Array<string | null>,
    ) => {
        const resolvedNamespaces = namespaces.filter((ns) => !!ns);
        if (resolvedNamespaces.length === 0) return;
        const known = resolvedNamespaces.filter((ns) => {
            if (!knownNamespaces.has(ns)) {
                addWarning({
                    type: 'unknown-namespace',
                    key,
                    file: filePath,
                    line,
                    source,
                    detail: `命名空间不存在: ${ns}`,
                });
                return false;
            }
            return true;
        });
        if (known.length === 0) return;
        references.push({
            key,
            namespaces: known,
            file: filePath,
            line,
            source,
            patternSegments,
        });
    };

    const resolveAliasNamespaces = (alias: string, line: number, source: string): string[] => {
        const info = aliasMap.get(alias);
        if (!info) return [defaultNamespace];
        const namespaces = Array.from(info.namespaces);
        if (info.dynamic && namespaces.length === 0) {
            addWarning({
                type: 'dynamic-namespace',
                key: '',
                file: filePath,
                line,
                source,
                detail: 'useTranslation 命名空间为动态值',
            });
            return [];
        }
        if (namespaces.length > 1 && !info.fromArray) {
            addWarning({
                type: 'ambiguous-namespace',
                key: '',
                file: filePath,
                line,
                source,
                detail: `同一别名绑定多个命名空间: ${namespaces.join(', ')}`,
            });
            return [];
        }
        return namespaces.length ? namespaces : [defaultNamespace];
    };

    const evaluateExistsGuard = (
        context: string,
        identifier: string,
        expectedNamespaces: string[],
    ): { hasGuard: boolean; compatible: boolean; detail?: string } => {
        const escapedIdentifier = escapeRegExp(identifier);
        const guardRegex = new RegExp(`i18n\\.exists\\s*\\(\\s*${escapedIdentifier}\\b[\\s\\S]{0,220}?\\)`, 'g');
        const matches = Array.from(context.matchAll(guardRegex)).map((item) => item[0]);
        if (matches.length === 0) {
            return { hasGuard: false, compatible: false };
        }

        const parsedNamespaces: string[] = [];
        let hasDynamicNamespace = false;
        for (const guardCall of matches) {
            const overrideNamespaces = findNsOverride(guardCall);
            const hasNsProp = /\bns\s*:/.test(guardCall);
            if (hasNsProp && overrideNamespaces.length === 0) {
                hasDynamicNamespace = true;
            }
            const namespaces = overrideNamespaces.length > 0 ? overrideNamespaces : [defaultNamespace];
            parsedNamespaces.push(...namespaces);
            if (expectedNamespaces.some((namespace) => namespaces.includes(namespace))) {
                return { hasGuard: true, compatible: true };
            }
        }

        const uniqueParsedNamespaces = Array.from(new Set(parsedNamespaces));
        const expectedText = expectedNamespaces.length > 0 ? expectedNamespaces.join(', ') : '(unknown)';
        const actualText = uniqueParsedNamespaces.length > 0 ? uniqueParsedNamespaces.join(', ') : '(none)';
        const dynamicText = hasDynamicNamespace ? '；exists 的 ns 为动态值' : '';
        return {
            hasGuard: true,
            compatible: false,
            detail: `i18n.exists 命名空间与 t() 不一致：expected=${expectedText}，actual=${actualText}${dynamicText}`,
        };
    };

    for (const aliasName of aliasMap.keys()) {
        const regex = new RegExp("\\b" + aliasName + "\\s*\\(\\s*(['\"`])((?:\\\\.|(?!\\1).)*)\\1", 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            const quote = match[1];
            const literal = parseStringLiteral(quote, match[2]);
            const line = getLineNumber(content, match.index);
            const source = `${aliasName}(${literal.value})`;
            if (literal.dynamic) {
                const parsedPatterns = quote === '`'
                    ? parseTemplateLiteralPatterns(literal.value, content, filePath, match.index, knownNamespaces)
                    : [];
                if (parsedPatterns.length > 0) {
                    const callEnd = findCallEnd(content, match.index + match[0].length);
                    const snippet = content.slice(match.index, callEnd);
                    const overrideNamespaces = findNsOverride(snippet);
                    for (const parsedPattern of parsedPatterns) {
                        const namespaces = parsedPattern.namespace
                            ? [parsedPattern.namespace]
                            : (overrideNamespaces.length ? overrideNamespaces : resolveAliasNamespaces(aliasName, line, source));
                        if (!namespaces.length) continue;
                        pushReference(
                            parsedPattern.key,
                            namespaces,
                            line,
                            source,
                            parsedPattern.patternSegments,
                        );
                    }
                    continue;
                }
                addWarning({ type: 'dynamic-key', key: literal.value, file: filePath, line, source });
                continue;
            }
            const callEnd = findCallEnd(content, match.index + match[0].length);
            const snippet = content.slice(match.index, callEnd);
            const overrideNamespaces = findNsOverride(snippet);
            const parsed = parseI18nKey(literal.value, knownNamespaces);
            const namespaces = parsed.namespace
                ? [parsed.namespace]
                : (overrideNamespaces.length ? overrideNamespaces : resolveAliasNamespaces(aliasName, line, source));
            if (!namespaces.length) continue;
            pushReference(parsed.key, namespaces, line, source);
        }
    }

    // 处理 t(variable) 形式的调用
    for (const aliasName of aliasMap.keys()) {
        const variableRegex = new RegExp("\\b" + aliasName + "\\s*\\(\\s*([A-Za-z_$][\\w$]*)(?:\\s*[,)])", 'g');
        let match: RegExpExecArray | null;
        while ((match = variableRegex.exec(content)) !== null) {
            const identifier = match[1];
            const line = getLineNumber(content, match.index);
            const source = `${aliasName}(${identifier})`;

            const contextStart = Math.max(0, match.index - 300);
            const context = content.slice(contextStart, match.index + 300);
            const expectedNamespaces = resolveAliasNamespaces(aliasName, line, source);
            const existsGuard = evaluateExistsGuard(context, identifier, expectedNamespaces);
            if (existsGuard.hasGuard && existsGuard.compatible) {
                continue;
            }
            if (existsGuard.hasGuard && expectedNamespaces.length > 0) {
                addWarning({
                    type: 'exists-namespace-mismatch',
                    key: identifier,
                    file: filePath,
                    line,
                    source,
                    detail: existsGuard.detail,
                });
            }
            
            // 尝试解析变量值
            const resolved = resolveIdentifierKeys(content, filePath, identifier, match.index, knownNamespaces);

            if (resolved.patterns && resolved.patterns.length > 0) {
                const callEnd = findCallEnd(content, match.index + match[0].length);
                const snippet = content.slice(match.index, callEnd);
                const overrideNamespaces = findNsOverride(snippet);

                for (const pattern of resolved.patterns) {
                    const namespaces = pattern.namespace
                        ? [pattern.namespace]
                        : (overrideNamespaces.length ? overrideNamespaces : resolveAliasNamespaces(aliasName, line, source));
                    if (!namespaces.length) continue;
                    pushReference(pattern.key, namespaces, line, source, pattern.patternSegments);
                }
                continue;
            }

            if (resolved.dynamic || resolved.keys.length === 0) {
                addWarning({ 
                    type: 'dynamic-key', 
                    key: identifier, 
                    file: filePath, 
                    line, 
                    source,
                    detail: `变量 ${identifier} 的值无法静态解析` 
                });
                continue;
            }
            
            // 解析成功，检查所有可能的 key
            const callEnd = findCallEnd(content, match.index + match[0].length);
            const snippet = content.slice(match.index, callEnd);
            const overrideNamespaces = findNsOverride(snippet);
            
            for (const keyValue of resolved.keys) {
                const parsed = parseI18nKey(keyValue, knownNamespaces);
                const namespaces = parsed.namespace
                    ? [parsed.namespace]
                    : (overrideNamespaces.length ? overrideNamespaces : resolveAliasNamespaces(aliasName, line, source));
                if (!namespaces.length) continue;
                pushReference(parsed.key, namespaces, line, source);
            }
        }
    }

    const i18nCallRegex = /\bi18n\.(t|exists)\s*\(\s*(['"`])((?:\\.|(?!\2).)*)\2/g;
    let i18nMatch: RegExpExecArray | null;
    while ((i18nMatch = i18nCallRegex.exec(content)) !== null) {
        const literal = parseStringLiteral(i18nMatch[2], i18nMatch[3]);
        const line = getLineNumber(content, i18nMatch.index);
        const source = `i18n.${i18nMatch[1]}(${literal.value})`;
        if (literal.dynamic) {
            const parsedPatterns = i18nMatch[2] === '`'
                ? parseTemplateLiteralPatterns(literal.value, content, filePath, i18nMatch.index, knownNamespaces)
                : [];
            if (parsedPatterns.length > 0) {
                const callEnd = findCallEnd(content, i18nMatch.index + i18nMatch[0].length);
                const snippet = content.slice(i18nMatch.index, callEnd);
                const overrideNamespaces = findNsOverride(snippet);
                for (const parsedPattern of parsedPatterns) {
                    const namespaces = parsedPattern.namespace
                        ? [parsedPattern.namespace]
                        : (overrideNamespaces.length ? overrideNamespaces : [defaultNamespace]);
                    pushReference(
                        parsedPattern.key,
                        namespaces,
                        line,
                        source,
                        parsedPattern.patternSegments,
                    );
                }
                continue;
            }
            addWarning({ type: 'dynamic-key', key: literal.value, file: filePath, line, source });
            continue;
        }
        const callEnd = findCallEnd(content, i18nMatch.index + i18nMatch[0].length);
        const snippet = content.slice(i18nMatch.index, callEnd);
        const overrideNamespaces = findNsOverride(snippet);
        const parsed = parseI18nKey(literal.value, knownNamespaces);
        const namespaces = parsed.namespace
            ? [parsed.namespace]
            : (overrideNamespaces.length ? overrideNamespaces : [defaultNamespace]);
        pushReference(parsed.key, namespaces, line, source);
    }

    const toastRegex = /toast\.\w+\s*\(\s*\{[\s\S]*?kind\s*:\s*['"]i18n['"][\s\S]*?\}\s*[,)\n]/g;
    let toastMatch: RegExpExecArray | null;
    while ((toastMatch = toastRegex.exec(content)) !== null) {
        const contextStart = Math.max(0, toastMatch.index - 300);
        const context = content.slice(contextStart, toastMatch.index + 300);
        const snippet = content.slice(toastMatch.index, toastMatch.index + 300);
        const line = getLineNumber(content, toastMatch.index);
        const source = 'toast.i18n';
        const keyMatch = snippet.match(/\bkey\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/);
        const keyIdentifierMatch = snippet.match(/\bkey\s*:\s*([A-Za-z_$][\w$]*)/);
        const keyShorthandMatch = snippet.match(/\bkey\b\s*(?=[,}])/);
        const keyIdentifierName = keyIdentifierMatch?.[1] ?? (keyShorthandMatch ? 'key' : null);
        const overrideNamespaces = findNsOverride(snippet);
        const expectedNamespaces = overrideNamespaces.length > 0 ? overrideNamespaces : [defaultNamespace];
        const existsGuard = keyIdentifierName
            ? evaluateExistsGuard(context, keyIdentifierName, expectedNamespaces)
            : { hasGuard: false, compatible: false, detail: undefined };
        if (existsGuard.hasGuard && !existsGuard.compatible) {
            addWarning({
                type: 'exists-namespace-mismatch',
                key: keyIdentifierName ?? '',
                file: filePath,
                line,
                source,
                detail: existsGuard.detail,
            });
        }
        let keyValues: string[] = [];
        let keyDynamic = false;
        if (keyMatch) {
            const literal = parseStringLiteral(keyMatch[1], keyMatch[2]);
            keyDynamic = literal.dynamic;
            keyValues = literal.dynamic ? [] : [literal.value];
        } else if (keyIdentifierName) {
            const resolved = resolveIdentifierKeys(content, filePath, keyIdentifierName, toastMatch.index, knownNamespaces);
            keyDynamic = resolved.dynamic;
            keyValues = resolved.keys;
            if (resolved.patterns && resolved.patterns.length > 0) {
                keyDynamic = false;
                keyValues = [];
                const overrideNamespaces = findNsOverride(snippet);
                for (const pattern of resolved.patterns) {
                    const namespaces = pattern.namespace
                        ? [pattern.namespace]
                        : (overrideNamespaces.length ? overrideNamespaces : [defaultNamespace]);
                    pushReference(pattern.key, namespaces, line, source, pattern.patternSegments);
                }
                continue;
            }
        } else {
            keyDynamic = true;
        }

        if (keyDynamic || keyValues.length === 0) {
            if (existsGuard.hasGuard && existsGuard.compatible) {
                continue;
            }
            addWarning({ type: 'dynamic-key', key: keyValues[0] ?? '', file: filePath, line, source, detail: 'Toast i18n key 不是字符串字面量' });
            continue;
        }

        if (overrideNamespaces.length === 0 && /\bns\s*:\s*/.test(snippet)) {
            if (existsGuard.hasGuard && existsGuard.compatible) {
                continue;
            }
            addWarning({ type: 'dynamic-namespace', key: keyValues[0], file: filePath, line, source, detail: 'Toast i18n ns 不是字符串字面量' });
            continue;
        }
        for (const keyValue of keyValues) {
            const parsed = parseI18nKey(keyValue, knownNamespaces);
            const namespaces = parsed.namespace
                ? [parsed.namespace]
                : (overrideNamespaces.length ? overrideNamespaces : [defaultNamespace]);
            pushReference(parsed.key, namespaces, line, source);
        }
    }

    const transRegex = /<Trans[^>]*>/g;
    let transMatch: RegExpExecArray | null;
    while ((transMatch = transRegex.exec(content)) !== null) {
        const snippet = transMatch[0];
        const keyMatch = snippet.match(/i18nKey\s*=\s*(?:\{)?(['"`])([^'"`]+)\1(?:\})?/);
        if (!keyMatch) continue;
        const literal = parseStringLiteral(keyMatch[1], keyMatch[2]);
        const line = getLineNumber(content, transMatch.index);
        const source = '<Trans>'; 
        if (literal.dynamic) {
            addWarning({ type: 'dynamic-key', key: literal.value, file: filePath, line, source });
            continue;
        }
        const nsMatch = snippet.match(/\bns\s*=\s*(?:\{)?(['"`])([^'"`]+)\1(?:\})?/);
        const overrideNamespaces = nsMatch ? [nsMatch[2]] : [];
        const parsed = parseI18nKey(literal.value, knownNamespaces);
        const namespaces = parsed.namespace
            ? [parsed.namespace]
            : (overrideNamespaces.length ? overrideNamespaces : [defaultNamespace]);
        pushReference(parsed.key, namespaces, line, source);
    }

    const tServerRegex = /\btServer\s*\(\s*[^,]+,\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
    let tServerMatch: RegExpExecArray | null;
    while ((tServerMatch = tServerRegex.exec(content)) !== null) {
        const literal = parseStringLiteral(tServerMatch[1], tServerMatch[2]);
        const line = getLineNumber(content, tServerMatch.index);
        const source = 'tServer';
        if (literal.dynamic) {
            addWarning({ type: 'dynamic-key', key: literal.value, file: filePath, line, source });
            continue;
        }
        const parsed = parseI18nKey(literal.value, knownNamespaces);
        const namespaces = parsed.namespace ? [parsed.namespace] : ['server'];
        pushReference(parsed.key, namespaces, line, source);
    }

    const validationErrorRegex = /return\s*\{\s*valid\s*:\s*false[\s\S]{0,160}?error\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
    let validationErrorMatch: RegExpExecArray | null;
    while ((validationErrorMatch = validationErrorRegex.exec(content)) !== null) {
        const literal = parseStringLiteral(validationErrorMatch[1], validationErrorMatch[2]);
        if (literal.dynamic || !looksLikeHumanReadableValidationError(literal.value)) {
            continue;
        }
        const line = getLineNumber(content, validationErrorMatch.index);
        addWarning({
            type: 'raw-validation-error',
            key: literal.value,
            file: filePath,
            line,
            source: 'validation.error',
            detail: '命令校验直接返回了自然语言 error 文案，请改用稳定错误码',
        });
    }

    const simpleChoiceRegex = /\bcreateSimpleChoice\s*\(/g;
    const rawPromptOptionLabelIndices = new Set<number>();
    let simpleChoiceMatch: RegExpExecArray | null;
    while ((simpleChoiceMatch = simpleChoiceRegex.exec(content)) !== null) {
        const openParenIndex = simpleChoiceMatch.index + simpleChoiceMatch[0].length - 1;
        const args = splitTopLevelCallArguments(content, openParenIndex);
        const titleArg = args[2];
        if (!titleArg) continue;

        const literal = parseStandaloneStringLiteral(titleArg.expression);
        const configArg = args[4]?.expression;
        if (
            literal
            && !literal.dynamic
            && looksLikeHumanReadableValidationError(literal.value)
        ) {
            const hasTitleKey = hasObjectLiteralTitleKey(configArg);
            addWarning({
                type: 'raw-simple-choice-title',
                key: literal.value,
                file: filePath,
                line: getLineNumber(content, titleArg.start),
                source: 'createSimpleChoice.title',
                detail: hasTitleKey
                    ? 'createSimpleChoice 标题仍保留英文可见 fallback；即使已写 titleKey，泄露时前台仍会直接露英文，请改成中文兜底或移除可见英文'
                    : 'createSimpleChoice 标题直接使用了英文可见文案，请补 titleKey 并同步 locales',
            });
        }

        const optionsArg = args[3];
        if (optionsArg) {
            const optionLabelRegex = /\blabel\s*:\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
            let optionLabelMatch: RegExpExecArray | null;
            while ((optionLabelMatch = optionLabelRegex.exec(optionsArg.expression)) !== null) {
                const labelLiteral = parseStringLiteral(optionLabelMatch[1], optionLabelMatch[2]);
                if (labelLiteral.dynamic || !looksLikeHumanReadableValidationError(labelLiteral.value)) {
                    continue;
                }
                if (objectLiteralHasProperty(optionsArg.expression, optionLabelMatch.index, 'labelKey')) {
                    continue;
                }

                rawPromptOptionLabelIndices.add(optionsArg.start + optionLabelMatch.index);
                addWarning({
                    type: 'raw-simple-choice-option-label',
                    key: labelLiteral.value,
                    file: filePath,
                    line: getLineNumber(content, optionsArg.start + optionLabelMatch.index),
                    source: 'createSimpleChoice.option.label',
                    detail: 'createSimpleChoice 内联选项 label 直接使用了英文可见文案，请补 labelKey 并同步 locales',
                });
            }
        }
    }

    const promptOptionLabelRegex = /\blabel\s*:\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
    let promptOptionLabelMatch: RegExpExecArray | null;
    while ((promptOptionLabelMatch = promptOptionLabelRegex.exec(content)) !== null) {
        if (rawPromptOptionLabelIndices.has(promptOptionLabelMatch.index)) {
            continue;
        }

        const labelLiteral = parseStringLiteral(promptOptionLabelMatch[1], promptOptionLabelMatch[2]);
        if (labelLiteral.dynamic || !looksLikeHumanReadableValidationError(labelLiteral.value)) {
            continue;
        }

        const objectLiteral = findNearestObjectLiteral(content, promptOptionLabelMatch.index);
        if (!objectLiteral) continue;
        if (/\blabelKey\s*:/.test(objectLiteral)) continue;
        const looksLikePromptOption = /\bdisplayMode\s*:/.test(objectLiteral)
            || (/\bid\s*:/.test(objectLiteral) && /\bvalue\s*:/.test(objectLiteral));
        if (!looksLikePromptOption) {
            continue;
        }

        addWarning({
            type: 'raw-prompt-option-label',
            key: labelLiteral.value,
            file: filePath,
            line: getLineNumber(content, promptOptionLabelMatch.index),
            source: 'PromptOption.label',
            detail: 'PromptOption label 直接使用了英文可见文案，请补 labelKey 并同步 locales',
        });
    }

    const skipOptionRegex = /\bcreateSkipOption\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
    let skipOptionMatch: RegExpExecArray | null;
    while ((skipOptionMatch = skipOptionRegex.exec(content)) !== null) {
        const literal = parseStringLiteral(skipOptionMatch[1], skipOptionMatch[2]);
        if (literal.dynamic || !looksLikeHumanReadableValidationError(literal.value)) {
            continue;
        }

        addWarning({
            type: 'raw-create-skip-label',
            key: literal.value,
            file: filePath,
            line: getLineNumber(content, skipOptionMatch.index),
            source: 'createSkipOption.label',
            detail: 'createSkipOption 直接使用了英文可见文案，请用带 labelKey 的 PromptOption 或补统一 helper',
        });
    }

    // 检测本文件内 fail-helper('error_code') 调用并注册 error.<code> 引用
    const validationFailHelperNames = detectValidationFailHelperNames(content);
    for (const helperName of validationFailHelperNames) {
        const escapedHelperName = helperName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const helperCallRegex = new RegExp(`\\b${escapedHelperName}\\s*\\(\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1\\s*\\)`, 'g');
        let helperCallMatch: RegExpExecArray | null;
        while ((helperCallMatch = helperCallRegex.exec(content)) !== null) {
            const literal = parseStringLiteral(helperCallMatch[1], helperCallMatch[2]);
            if (literal.dynamic || !/^[A-Za-z0-9_.-]+$/.test(literal.value)) continue;
            const line = getLineNumber(content, helperCallMatch.index);
            const gameId = getGameIdFromPath(filePath);
            const namespaces: string[] = [];
            if (gameId) {
                const gameNs = `game-${gameId}`;
                if (knownNamespaces.has(gameNs)) namespaces.push(gameNs);
            }
            if (knownNamespaces.has('game')) namespaces.push('game');
            if (namespaces.length > 0) {
                pushReference(`error.${literal.value}`, namespaces, line, `${helperName}()`);
            }
        }
    }

    if (normalizeFilePath(filePath).includes('src/games/dicethrone/')) {
        for (const ref of references) {
            if (!ref.namespaces.includes('game-dicethrone')) continue;
            if (ref.key !== 'hero.*' && !ref.key.startsWith('hero.')) continue;
            addWarning({
                type: 'deprecated-dicethrone-hero-key',
                key: ref.key,
                file: ref.file,
                line: ref.line,
                source: ref.source,
                detail: 'DiceThrone 英雄名已迁移到 characters.* / getDiceThroneCharacterNameKey()，禁止继续使用 hero.*',
            });
        }
    }

    return { references, warnings };
};

const normalizeFilePath = (filePath: string): string => filePath.replace(/\\/g, '/');

const getManifestGameId = (filePath: string): string | null => {
    const normalized = normalizeFilePath(filePath);
    const match = normalized.match(/\/src\/games\/([^/]+)\/manifest\.[jt]sx?$/);
    return match?.[1] ?? null;
};

const getTutorialGameId = (filePath: string): string | null => {
    const normalized = normalizeFilePath(filePath);
    const match = normalized.match(/\/src\/games\/([^/]+)\/tutorial\.[jt]sx?$/);
    return match?.[1] ?? null;
};

const getGameIdFromPath = (filePath: string): string | null => {
    const normalized = normalizeFilePath(filePath);
    const match = normalized.match(/\/src\/games\/([^/]+)\//);
    return match?.[1] ?? null;
};

const looksLikeI18nKey = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/\s/.test(trimmed)) return false;
    if (!isAsciiOnly(trimmed)) return false;
    return /[.:]/.test(trimmed);
};

const isI18nPropertyName = (propertyName: string): boolean => (
    /(?:^|[A-Z])(title|label|description|players|name|message|hint|effect)Key$/.test(propertyName)
);

const inferStaticNamespacesForFile = (
    content: string,
    filePath: string,
    knownNamespaces: Set<string>,
): string[] => {
    const namespaces = new Set<string>();
    const aliasMap = buildAliasMap(content, DEFAULT_NAMESPACE);

    for (const info of aliasMap.values()) {
        if (info.dynamic) continue;
        for (const namespace of info.namespaces) {
            if (knownNamespaces.has(namespace)) {
                namespaces.add(namespace);
            }
        }
    }

    const gameId = getGameIdFromPath(filePath);
    if (gameId) {
        const gameNamespace = `game-${gameId}`;
        if (knownNamespaces.has(gameNamespace)) {
            namespaces.add(gameNamespace);
        }
    }

    return Array.from(namespaces);
};

const createManifestReference = (
    filePath: string,
    line: number,
    source: string,
    key: string,
    namespace: string,
): I18nReference => ({
    key,
    namespaces: [namespace],
    file: filePath,
    line,
    source,
});

const collectDiceThroneTriggerFaceIds = (trigger: TriggerCondition | undefined): string[] => {
    if (!trigger) return [];
    if (trigger.type === 'diceSet') {
        return Object.keys(trigger.faces);
    }
    if (trigger.type === 'allSymbolsPresent') {
        return trigger.symbols;
    }
    if (trigger.type === 'composite') {
        return trigger.conditions.flatMap((condition) =>
            collectDiceThroneTriggerFaceIds(condition as TriggerCondition),
        );
    }
    return [];
};

export const collectDiceThroneAbilityChoiceFaceLabelReferences = (
    heroesData: Record<string, { abilities: AbilityDef[] }> = HEROES_DATA,
): I18nReference[] => {
    const refsByKey = new Map<string, I18nReference>();

    for (const [heroId, hero] of Object.entries(heroesData)) {
        for (const ability of hero.abilities) {
            const triggers = [
                ability.trigger,
                ...(ability.variants ?? []).map((variant) => variant.trigger),
            ];

            for (const trigger of triggers) {
                for (const faceId of collectDiceThroneTriggerFaceIds(trigger)) {
                    const key = `abilityChoice.faceLabel.${faceId}`;
                    if (refsByKey.has(key)) continue;
                    refsByKey.set(key, {
                        key,
                        namespaces: ['game-dicethrone'],
                        file: normalizeFilePath(path.join(ROOT_DIR, 'src', 'games', 'dicethrone', 'heroes', heroId)),
                        line: 1,
                        source: `dicethrone.abilityChoice.faceLabel:${heroId}`,
                    });
                }
            }
        }
    }

    return Array.from(refsByKey.values());
};

const DICETHRONE_ROOT_DIR = path.join(ROOT_DIR, 'src', 'games', 'dicethrone');
const DICETHRONE_GAME_NAMESPACE = 'game-dicethrone';
const DICETHRONE_CONTRACT_KNOWN_NAMESPACES = new Set<string>([
    ...I18N_NAMESPACES,
    DICETHRONE_GAME_NAMESPACE,
]);

const normalizeContractStringValues = (value: unknown): string[] => {
    if (typeof value === 'string') {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }
    return [];
};

const pushDiceThroneContractValue = (
    references: I18nReference[],
    _warnings: I18nWarning[],
    file: string,
    source: string,
    _field: string,
    rawValue: unknown,
) => {
    for (const value of normalizeContractStringValues(rawValue)) {
        if (!looksLikeI18nKey(value)) {
            continue;
        }
        const parsed = parseI18nKey(value, DICETHRONE_CONTRACT_KNOWN_NAMESPACES);
        references.push({
            key: parsed.key,
            namespaces: [parsed.namespace ?? DICETHRONE_GAME_NAMESPACE],
            file,
            line: 1,
            source,
        });
    }
};

const collectDiceThroneEffectContractValues = (
    references: I18nReference[],
    warnings: I18nWarning[],
    file: string,
    source: string,
    effects: Array<{ description?: unknown; action?: Record<string, unknown> }> | undefined,
) => {
    for (const [effectIndex, effect] of (effects ?? []).entries()) {
        pushDiceThroneContractValue(
            references,
            warnings,
            file,
            `${source}.effect[${effectIndex}]`,
            'effect.description',
            effect.description,
        );
    }
};

export const collectDiceThroneDataContractReferences = (): { references: I18nReference[]; warnings: I18nWarning[] } => {
    const references: I18nReference[] = [];
    const warnings: I18nWarning[] = [];
    const coreTypesFile = normalizeFilePath(path.join(DICETHRONE_ROOT_DIR, 'domain', 'core-types.ts'));
    const sharedTokensFile = normalizeFilePath(path.join(DICETHRONE_ROOT_DIR, 'domain', 'sharedTokens.ts'));
    const commonCardsFile = normalizeFilePath(path.join(DICETHRONE_ROOT_DIR, 'domain', 'commonCards.ts'));

    for (const character of DICETHRONE_CHARACTER_CATALOG) {
        pushDiceThroneContractValue(
            references,
            warnings,
            coreTypesFile,
            `dicethrone.characterCatalog:${character.id}`,
            'character.nameKey',
            character.nameKey,
        );

        for (const [badgeIndex, badge] of (character.badges ?? []).entries()) {
            pushDiceThroneContractValue(
                references,
                warnings,
                coreTypesFile,
                `dicethrone.characterCatalog:${character.id}.badge[${badgeIndex}]`,
                'badge.labelKey',
                badge.labelKey,
            );
        }
    }

    for (const token of SHARED_TOKENS) {
        pushDiceThroneContractValue(
            references,
            warnings,
            sharedTokensFile,
            `dicethrone.sharedToken:${token.id}`,
            'token.name',
            token.name,
        );
        pushDiceThroneContractValue(
            references,
            warnings,
            sharedTokensFile,
            `dicethrone.sharedToken:${token.id}`,
            'token.description',
            token.description,
        );
    }

    for (const [heroId, hero] of Object.entries(HEROES_DATA)) {
        const heroFile = normalizeFilePath(path.join(DICETHRONE_ROOT_DIR, 'heroes', heroId));

        for (const ability of hero.abilities) {
            pushDiceThroneContractValue(
                references,
                warnings,
                heroFile,
                `dicethrone.ability:${heroId}:${ability.id}`,
                'ability.name',
                ability.name,
            );
            pushDiceThroneContractValue(
                references,
                warnings,
                heroFile,
                `dicethrone.ability:${heroId}:${ability.id}`,
                'ability.description',
                ability.description,
            );
            collectDiceThroneEffectContractValues(
                references,
                warnings,
                heroFile,
                `dicethrone.ability:${heroId}:${ability.id}`,
                ability.effects as Array<{ description?: unknown; action?: Record<string, unknown> }> | undefined,
            );

            for (const variant of ability.variants ?? []) {
                pushDiceThroneContractValue(
                    references,
                    warnings,
                    heroFile,
                    `dicethrone.abilityVariant:${heroId}:${variant.id}`,
                    'variant.name',
                    variant.name,
                );
                pushDiceThroneContractValue(
                    references,
                    warnings,
                    heroFile,
                    `dicethrone.abilityVariant:${heroId}:${variant.id}`,
                    'variant.description',
                    (variant as { description?: unknown }).description,
                );
                collectDiceThroneEffectContractValues(
                    references,
                    warnings,
                    heroFile,
                    `dicethrone.abilityVariant:${heroId}:${variant.id}`,
                    variant.effects as Array<{ description?: unknown; action?: Record<string, unknown> }> | undefined,
                );
            }
        }

        for (const card of hero.cards) {
            pushDiceThroneContractValue(
                references,
                warnings,
                heroFile,
                `dicethrone.card:${heroId}:${card.id}`,
                'card.name',
                card.name,
            );
            pushDiceThroneContractValue(
                references,
                warnings,
                heroFile,
                `dicethrone.card:${heroId}:${card.id}`,
                'card.description',
                card.description,
            );
            collectDiceThroneEffectContractValues(
                references,
                warnings,
                heroFile,
                `dicethrone.card:${heroId}:${card.id}`,
                card.effects as Array<{ description?: unknown; action?: Record<string, unknown> }> | undefined,
            );
        }
    }

    for (const card of COMMON_CARDS) {
        pushDiceThroneContractValue(
            references,
            warnings,
            commonCardsFile,
            `dicethrone.commonCard:${card.id}`,
            'card.name',
            card.name,
        );
        pushDiceThroneContractValue(
            references,
            warnings,
            commonCardsFile,
            `dicethrone.commonCard:${card.id}`,
            'card.description',
            card.description,
        );
        collectDiceThroneEffectContractValues(
            references,
            warnings,
            commonCardsFile,
            `dicethrone.commonCard:${card.id}`,
            card.effects as Array<{ description?: unknown; action?: Record<string, unknown> }> | undefined,
        );
    }

    for (const [characterId, data] of Object.entries(CHARACTER_DATA_MAP)) {
        const file = normalizeFilePath(path.join(DICETHRONE_ROOT_DIR, 'heroes', characterId));

        for (const token of data.tokens ?? []) {
            pushDiceThroneContractValue(
                references,
                warnings,
                file,
                `dicethrone.token:${characterId}:${token.id}`,
                'token.name',
                token.name,
            );
            pushDiceThroneContractValue(
                references,
                warnings,
                file,
                `dicethrone.token:${characterId}:${token.id}`,
                'token.description',
                token.description,
            );
        }

        for (const passive of data.passiveAbilities ?? []) {
            pushDiceThroneContractValue(
                references,
                warnings,
                file,
                `dicethrone.passive:${characterId}:${passive.id}`,
                'passive.nameKey',
                passive.nameKey,
            );

            for (const [actionIndex, action] of passive.actions.entries()) {
                pushDiceThroneContractValue(
                    references,
                    warnings,
                    file,
                    `dicethrone.passive:${characterId}:${passive.id}.action[${actionIndex}]`,
                    'passive.action.labelKey',
                    action.labelKey,
                );
                pushDiceThroneContractValue(
                    references,
                    warnings,
                    file,
                    `dicethrone.passive:${characterId}:${passive.id}.action[${actionIndex}]`,
                    'passive.action.descriptionKey',
                    action.descriptionKey,
                );
            }
        }
    }
    return { references, warnings };
};

const shouldAuditDiceThroneRawContractFile = (filePath: string): boolean => {
    const normalized = normalizeFilePath(filePath);
    return normalized.includes('/src/games/dicethrone/heroes/')
        || normalized.endsWith('/src/games/dicethrone/domain/commonCards.ts')
        || normalized.endsWith('/src/games/dicethrone/domain/sharedTokens.ts')
        || normalized.endsWith('/src/games/dicethrone/domain/reducer.ts')
        || normalized.endsWith('/src/games/dicethrone/ui/TokenResponseModal.tsx');
};

export const collectDiceThroneRawContractWarningsFromContent = (
    content: string,
    filePath: string,
): I18nWarning[] => {
    if (!shouldAuditDiceThroneRawContractFile(filePath)) {
        return [];
    }

    const warnings: I18nWarning[] = [];
    const literalPropertyRegex = /\b(name|description|label|sourceName)\s*:\s*(['"`])([\s\S]*?)\2/g;
    let match: RegExpExecArray | null;

    while ((match = literalPropertyRegex.exec(content)) !== null) {
        const property = match[1];
        const quote = match[2];
        const rawValue = match[3].trim();

        if (quote === '`' && rawValue.includes('${')) {
            continue;
        }
        if (!rawValue || looksLikeI18nKey(rawValue)) {
            continue;
        }

        warnings.push({
            type: 'raw-dicethrone-contract-text',
            key: rawValue,
            file: filePath,
            line: getLineNumber(content, match.index),
            source: `${property}`,
            detail: `DiceThrone 合同字段 ${property} 直接使用了可见文案，请改为 i18n key`,
        });
    }

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const helperDescriptionIndexResolvers: Record<string, (args: readonly ts.Expression[]) => number[]> = {
        damage: () => [1],
        heal: () => [1],
        drawCards: () => [1],
        custom: () => [1],
        customEffect: () => [2],
        inflictStatus: () => [2],
        grantStatus: () => [1],
        grantSelfStatus: () => [2],
        grantToken: (args) => {
            const indexes: number[] = [];
            if (args.length > 1 && ts.isNumericLiteral(args[0])) {
                indexes.push(1);
            }
            if (args.length > 3) {
                indexes.push(3);
            }
            return indexes;
        },
    };

    const getRawStringLiteral = (node: ts.Expression): string | null => {
        if (ts.isStringLiteralLike(node)) {
            return node.text.trim();
        }
        if (ts.isNoSubstitutionTemplateLiteral(node)) {
            return node.text.trim();
        }
        return null;
    };

    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            const helperName = node.expression.text;
            const resolveIndexes = helperDescriptionIndexResolvers[helperName];
            if (resolveIndexes) {
                for (const argIndex of resolveIndexes(node.arguments)) {
                    const arg = node.arguments[argIndex];
                    if (!arg) {
                        continue;
                    }

                    const rawValue = getRawStringLiteral(arg);
                    if (!rawValue || looksLikeI18nKey(rawValue)) {
                        continue;
                    }

                    warnings.push({
                        type: 'raw-dicethrone-contract-text',
                        key: rawValue,
                        file: filePath,
                        line: getLineNumber(content, arg.getStart(sourceFile)),
                        source: `${helperName}.arg${argIndex}`,
                        detail: `DiceThrone helper ${helperName} 的说明参数直接使用了可见文案，请改为 i18n key`,
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return warnings;
};

export const collectManifestReferencesFromContent = (
    content: string,
    filePath: string,
    knownNamespaces: Set<string>,
): I18nReference[] => {
    const gameId = getManifestGameId(filePath);
    if (!gameId) return [];

    const references: I18nReference[] = [];
    const manifestNamespace = `game-${gameId}`;
    const pushManifestRef = (rawKey: string, namespace: string, index: number, source: string) => {
        if (!knownNamespaces.has(namespace)) return;
        references.push(createManifestReference(
            filePath,
            getLineNumber(content, index),
            source,
            rawKey,
            namespace,
        ));
    };

    const topLevelKeyPatterns = [
        { property: 'titleKey', namespace: 'lobby' },
        { property: 'descriptionKey', namespace: 'lobby' },
        { property: 'playersKey', namespace: 'lobby' },
    ] as const;

    for (const { property, namespace } of topLevelKeyPatterns) {
        const regex = new RegExp(`\\b${property}\\s*:\\s*['"]([^'"]+)['"]`, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            pushManifestRef(match[1], namespace, match.index, `manifest.${property}`);
        }
    }

    const setupPrefix = `games.${gameId}.setup.`;
    const labelKeyRegex = /\blabelKey\s*:\s*['"]([^'"]+)['"]/g;
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = labelKeyRegex.exec(content)) !== null) {
        const rawKey = labelMatch[1];
        if (!rawKey.startsWith(setupPrefix)) {
            continue;
        }
        pushManifestRef(
            rawKey.slice(`games.${gameId}.`.length),
            manifestNamespace,
            labelMatch.index,
            'manifest.setup.labelKey',
        );
    }

    return references;
};

export const collectTutorialReferencesFromContent = (
    content: string,
    filePath: string,
    knownNamespaces: Set<string>,
): I18nReference[] => {
    const gameId = getTutorialGameId(filePath);
    if (!gameId) return [];

    const references: I18nReference[] = [];
    const defaultNamespace = `game-${gameId}`;
    const contentKeyRegex = /\bcontent\s*:\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = contentKeyRegex.exec(content)) !== null) {
        const rawKey = match[1];
        const parsed = parseI18nKey(rawKey, knownNamespaces);
        const namespace = parsed.namespace ?? defaultNamespace;
        if (!knownNamespaces.has(namespace)) continue;
        if (!parsed.key) continue;
        references.push(createManifestReference(
            filePath,
            getLineNumber(content, match.index),
            'tutorial.content',
            parsed.key,
            namespace,
        ));
    }

    return references;
};

export const collectStaticKeyReferencesFromContent = (
    content: string,
    filePath: string,
    knownNamespaces: Set<string>,
): I18nReference[] => {
    const normalizedPath = normalizeFilePath(filePath);
    const manifestGameId = getManifestGameId(filePath);
    if (manifestGameId) {
        return [];
    }

    const inferredNamespaces = inferStaticNamespacesForFile(content, filePath, knownNamespaces);
    if (inferredNamespaces.length === 0) {
        return [];
    }

    const references: I18nReference[] = [];
    const seen = new Set<string>();
    const propertyRegex = /\b([A-Za-z_$][\w$]*Key)\s*:\s*(['"`])((?:\\.|(?!\2).)*)\2/g;
    let match: RegExpExecArray | null;

    while ((match = propertyRegex.exec(content)) !== null) {
        const propertyName = match[1];
        if (!isI18nPropertyName(propertyName)) {
            continue;
        }
        const literal = parseStringLiteral(match[2], match[3]);
        if (literal.dynamic || !looksLikeI18nKey(literal.value)) {
            continue;
        }

        const parsed = parseI18nKey(literal.value, knownNamespaces);
        const namespaces = parsed.namespace
            ? [parsed.namespace]
            : inferredNamespaces;

        for (const namespace of namespaces) {
            if (!knownNamespaces.has(namespace)) continue;
            const dedupeKey = `${propertyName}:${namespace}:${parsed.key}:${match.index}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            references.push(createManifestReference(
                normalizedPath,
                getLineNumber(content, match.index),
                `static.${propertyName}`,
                parsed.key,
                namespace,
            ));
        }
    }

    return references;
};

const scanFilePaths = (rootDir: string): string[] => {
    const results: string[] = [];
    const visit = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (IGNORED_DIRS.has(entry.name)) continue;
                visit(fullPath);
            } else if (entry.isFile()) {
                if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
                    results.push(fullPath);
                }
            }
        }
    };

    for (const dir of SCAN_DIRS) {
        const target = path.join(rootDir, dir);
        if (fs.existsSync(target)) visit(target);
    }

    return results;
};

const formatRefs = (refs: I18nReference[]): string => (
    refs.map((ref) => `${ref.file}:${ref.line}`).join(', ')
);

const getReferenceConcreteKeys = (
    ref: I18nReference,
    locales: LocalesByLanguage,
    language: string,
): string[] => {
    const patternSegments = ref.patternSegments;
    if (!patternSegments) {
        return ref.namespaces
            .filter((namespace) => {
                const localeData = locales[language]?.[namespace];
                return Boolean(localeData) && hasKeyPath(localeData, ref.key);
            })
            .map((namespace) => `${namespace}:${ref.key}`);
    }

    return ref.namespaces.flatMap((namespace) => {
        const localeData = locales[language]?.[namespace];
        if (!localeData) {
            return [];
        }
        return collectPatternMatches(localeData, patternSegments).map((key) => `${namespace}:${key}`);
    });
};

export const collectMissingTranslations = (
    references: I18nReference[],
    locales: LocalesByLanguage,
    languages: readonly string[] = SUPPORTED_LANGUAGES,
): MissingTranslation[] => {
    const missingMap = new Map<string, MissingTranslation>();
    for (const ref of references) {
        if (!ref.patternSegments) {
            const missingLanguages = languages.filter((lang) => {
                const hasAny = ref.namespaces.some((namespace) => {
                    const localeData = locales[lang]?.[namespace];
                    if (!localeData) return false;
                    return hasKeyPath(localeData, ref.key);
                });
                return !hasAny;
            });
            if (missingLanguages.length === 0) continue;
            const namespacesKey = ref.namespaces.slice().sort().join(',');
            const id = `${namespacesKey}:${ref.key}`;
            const existing = missingMap.get(id);
            if (existing) {
                existing.languages = Array.from(new Set([...existing.languages, ...missingLanguages]));
                existing.refs.push(ref);
                continue;
            }
            missingMap.set(id, {
                namespaces: ref.namespaces.slice().sort(),
                key: ref.key,
                languages: missingLanguages,
                refs: [ref],
            });
            continue;
        }

        const concreteKeysByLanguage = new Map<string, Set<string>>();
        for (const language of languages) {
            concreteKeysByLanguage.set(language, new Set(getReferenceConcreteKeys(ref, locales, language)));
        }

        const allConcreteKeys = new Set<string>();
        for (const keys of concreteKeysByLanguage.values()) {
            for (const key of keys) {
                allConcreteKeys.add(key);
            }
        }

        if (allConcreteKeys.size === 0) {
            const namespacesKey = ref.namespaces.slice().sort().join(',');
            const id = `${namespacesKey}:${ref.key}`;
            const existing = missingMap.get(id);
            if (existing) {
                existing.languages = Array.from(new Set([...existing.languages, ...languages]));
                existing.refs.push(ref);
            } else {
                missingMap.set(id, {
                    namespaces: ref.namespaces.slice().sort(),
                    key: ref.key,
                    languages: [...languages],
                    refs: [ref],
                });
            }
            continue;
        }

        for (const concreteKey of allConcreteKeys) {
            const [namespace, ...keyParts] = concreteKey.split(':');
            const key = keyParts.join(':');
            const missingLanguages = languages.filter((language) => !concreteKeysByLanguage.get(language)?.has(concreteKey));
            if (missingLanguages.length === 0) continue;
            const id = `${namespace}:${key}`;
            const existing = missingMap.get(id);
            if (existing) {
                existing.languages = Array.from(new Set([...existing.languages, ...missingLanguages]));
                existing.refs.push(ref);
                continue;
            }
            missingMap.set(id, {
                namespaces: [namespace],
                key,
                languages: missingLanguages,
                refs: [ref],
            });
        }
    }

    return Array.from(missingMap.values());
};

const dedupeWarnings = (warnings: I18nWarning[]): I18nWarning[] => {
    const seen = new Set<string>();
    const deduped: I18nWarning[] = [];

    for (const warning of warnings) {
        const id = [
            warning.type,
            warning.file,
            warning.line,
            warning.source,
            warning.key,
            warning.detail ?? '',
        ].join('|');
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        deduped.push(warning);
    }

    return deduped;
};

const formatRawDiceThroneContractWarnings = (warnings: I18nWarning[]): string[] => {
    const grouped = new Map<string, Array<{ line: number; source: string }>>();

    for (const warning of warnings) {
        const entries = grouped.get(warning.file) ?? [];
        entries.push({ line: warning.line, source: warning.source });
        grouped.set(warning.file, entries);
    }

    return Array.from(grouped.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, entries]) => {
            const fieldLocations = Array.from(new Set(entries.map((entry) => `${entry.line} ${entry.source}`)))
                .sort((a, b) => {
                    const [lineA, sourceA] = a.split(' ', 2);
                    const [lineB, sourceB] = b.split(' ', 2);
                    const numeric = Number(lineA) - Number(lineB);
                    return numeric !== 0 ? numeric : sourceA.localeCompare(sourceB);
                });
            return `- raw-dicethrone-contract-text ${file} (${fieldLocations.length} field(s)): ${fieldLocations.join(', ')}`;
        });
};

const main = () => {
    const { locales, namespaceFiles } = loadLocales();
    const knownNamespaces = new Set([...namespaceFiles, ...I18N_NAMESPACES]);
    const files = scanFilePaths(ROOT_DIR);

    const references: I18nReference[] = [];
    const warnings: I18nWarning[] = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const result = collectReferencesFromContent(content, file, { defaultNamespace: DEFAULT_NAMESPACE, knownNamespaces });
        references.push(...result.references);
        references.push(...collectManifestReferencesFromContent(content, file, knownNamespaces));
        references.push(...collectTutorialReferencesFromContent(content, file, knownNamespaces));
        references.push(...collectStaticKeyReferencesFromContent(content, file, knownNamespaces));
        warnings.push(...result.warnings);
        warnings.push(...collectDiceThroneRawContractWarningsFromContent(content, file));
    }

    references.push(...collectDiceThroneAbilityChoiceFaceLabelReferences());
    const diceThroneContract = collectDiceThroneDataContractReferences();
    references.push(...diceThroneContract.references);
    warnings.push(...diceThroneContract.warnings);

    const missing = collectMissingTranslations(references, locales);
    const dedupedWarnings = dedupeWarnings(warnings);
    const blockingWarningTypes = new Set<I18nWarning['type']>([
        'deprecated-dicethrone-hero-key',
        'raw-validation-error',
        'raw-dicethrone-contract-text',
    ]);
    const blockingWarnings = dedupedWarnings.filter((warning) => blockingWarningTypes.has(warning.type));

    if (missing.length === 0 && dedupedWarnings.length === 0) {
        console.log('i18n-check: no missing keys detected.');
        return;
    }

    if (missing.length) {
        console.log(`i18n-check: missing ${missing.length} key(s).`);
        for (const item of missing) {
            console.log(`- [${item.namespaces.join('|')}] ${item.key} (missing: ${item.languages.join(', ')})`);
            console.log(`  refs: ${formatRefs(item.refs)}`);
        }
    }

    if (dedupedWarnings.length) {
        console.log(`\nWarnings (${dedupedWarnings.length}):`);
        const rawDiceThroneWarnings = dedupedWarnings.filter((warning) => warning.type === 'raw-dicethrone-contract-text');
        const otherWarnings = dedupedWarnings.filter((warning) => warning.type !== 'raw-dicethrone-contract-text');

        for (const line of formatRawDiceThroneContractWarnings(rawDiceThroneWarnings)) {
            console.log(line);
        }

        for (const warning of otherWarnings) {
            console.log(`- ${warning.type} ${warning.file}:${warning.line} ${warning.source} ${warning.detail ?? ''}`);
        }
    }

    if (missing.length > 0 || blockingWarnings.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main();
}
