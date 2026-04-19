import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { I18N_NAMESPACES, SUPPORTED_LANGUAGES } from '../../src/lib/i18n/types';

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
    type: 'dynamic-namespace' | 'ambiguous-namespace' | 'unknown-namespace' | 'dynamic-key' | 'exists-namespace-mismatch' | 'raw-validation-error';
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

const hasKeyPath = (namespaceData: LocaleNamespace, keyPath: string): boolean => {
    if (!keyPath) return false;
    const segments = keyPath.split('.');
    let cursor: unknown = namespaceData;
    for (const segment of segments) {
        if (!isPlainObject(cursor) || !(segment in cursor)) {
            return false;
        }
        cursor = cursor[segment];
    }
    return true;
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

const parseTemplateLiteralPattern = (
    rawValue: string,
    knownNamespaces: Set<string>,
): { namespace?: string; key: string; patternSegments: Array<string | null> } | null => {
    if (!rawValue.includes('${')) {
        return null;
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
            return null;
        }
    }

    const normalized = keyPath.replace(placeholderRegex, '*');
    if (normalized.startsWith('.') || normalized.endsWith('.') || normalized.includes('..')) {
        return null;
    }

    const patternSegments = normalized.split('.').map((segment) => {
        if (segment === '*') return null;
        return segment;
    });

    if (patternSegments.length === 0 || patternSegments.every((segment) => segment === null) || patternSegments[0] === null) {
        return null;
    }

    return {
        namespace: parsed.namespace,
        key: patternSegments.map((segment) => segment ?? '*').join('.'),
        patternSegments,
    };
};

const looksLikeHumanReadableValidationError = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!isAsciiOnly(trimmed)) return false;
    return trimmed.includes(' ') || /[:!]/.test(trimmed);
};

const extractLiteralKeysFromExpression = (expression: string): { keys: string[]; dynamic: boolean } => {
    const trimmed = expression.trim();
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
    position: number,
    knownNamespaces: Set<string>,
): ResolvedIdentifierPattern[] => {
    const trimmed = expression.trim();
    const templateMatch = trimmed.match(/^`([\s\S]*)`$/);
    if (!templateMatch) return [];

    const rawValue = templateMatch[1];
    if (!rawValue.includes('${')) return [];

    const segments = rawValue.split('.');
    const placeholderOnlyRegex = /^\$\{([A-Za-z_$][\w$]*)\}$/;
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

        const nestedIdentifier = placeholderMatch[1];
        const resolved = resolveIdentifierKeys(content, nestedIdentifier, position, knownNamespaces);
        if (resolved.keys.length > 0) {
            const nextVariants: Array<Array<string | null>> = [];
            for (const variant of variants) {
                for (const key of resolved.keys) {
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
    identifier: string,
    position: number,
    knownNamespaces: Set<string>,
): ResolvedIdentifierKeys => {
    const expression = extractIdentifierExpression(content, identifier, position);
    if (!expression) {
        return { keys: [], dynamic: true };
    }

    const patterns = parseTemplateLiteralPatternsFromExpression(expression, content, position, knownNamespaces);
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
                const parsedPattern = quote === '`'
                    ? parseTemplateLiteralPattern(literal.value, knownNamespaces)
                    : null;
                if (parsedPattern) {
                    const callEnd = findCallEnd(content, match.index + match[0].length);
                    const snippet = content.slice(match.index, callEnd);
                    const overrideNamespaces = findNsOverride(snippet);
                    const namespaces = parsedPattern.namespace
                        ? [parsedPattern.namespace]
                        : (overrideNamespaces.length ? overrideNamespaces : resolveAliasNamespaces(aliasName, line, source));
                    if (namespaces.length) {
                        pushReference(
                            parsedPattern.key,
                            namespaces,
                            line,
                            source,
                            parsedPattern.patternSegments,
                        );
                        continue;
                    }
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
            const resolved = resolveIdentifierKeys(content, identifier, match.index, knownNamespaces);

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
            const parsedPattern = i18nMatch[2] === '`'
                ? parseTemplateLiteralPattern(literal.value, knownNamespaces)
                : null;
            if (parsedPattern) {
                const callEnd = findCallEnd(content, i18nMatch.index + i18nMatch[0].length);
                const snippet = content.slice(i18nMatch.index, callEnd);
                const overrideNamespaces = findNsOverride(snippet);
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
            const resolved = resolveIdentifierKeys(content, keyIdentifierName, toastMatch.index, knownNamespaces);
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
    /(?:^|[A-Z])(title|label|description|players|name|message|hint)Key$/.test(propertyName)
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
    }

    const missingMap = new Map<string, MissingTranslation>();
    for (const ref of references) {
        if (!ref.patternSegments) {
            const missingLanguages = SUPPORTED_LANGUAGES.filter((lang) => {
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
        for (const language of SUPPORTED_LANGUAGES) {
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
                existing.languages = Array.from(new Set([...existing.languages, ...SUPPORTED_LANGUAGES]));
                existing.refs.push(ref);
            } else {
                missingMap.set(id, {
                    namespaces: ref.namespaces.slice().sort(),
                    key: ref.key,
                    languages: [...SUPPORTED_LANGUAGES],
                    refs: [ref],
                });
            }
            continue;
        }

        for (const concreteKey of allConcreteKeys) {
            const [namespace, ...keyParts] = concreteKey.split(':');
            const key = keyParts.join(':');
            const missingLanguages = SUPPORTED_LANGUAGES.filter((language) => !concreteKeysByLanguage.get(language)?.has(concreteKey));
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

    const missing = Array.from(missingMap.values());
    const blockingWarningTypes = new Set<I18nWarning['type']>([
        'raw-validation-error',
    ]);
    const blockingWarnings = warnings.filter((warning) => blockingWarningTypes.has(warning.type));

    if (missing.length === 0 && warnings.length === 0) {
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

    if (warnings.length) {
        console.log(`\nWarnings (${warnings.length}):`);
        for (const warning of warnings) {
            console.log(`- ${warning.type} ${warning.file}:${warning.line} ${warning.source} ${warning.detail ?? ''}`);
        }
    }

    if (missing.length > 0 || blockingWarnings.length > 0) {
        process.exitCode = 1;
    }
};

main();
