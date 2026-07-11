import { createHash } from 'node:crypto';

export const isActiveRootKey = (key) => (
    /^official\/(?:.+\/)?assets-manifest\.json$/.test(key)
    || /official\/(?:app-updates|native-app-updates)\/[^/]+\/[^/]+\/latest\.json$/.test(key)
    || /official\/mobile-packages\/[^/]+\/[^/]+\/(?:games|shared)\/[^/]+\.json$/.test(key)
);

const hasSafePathSegments = (value) => {
    const segments = value.split('/');
    return segments.length > 0
        && segments.every((segment) => segment && segment !== '.' && segment !== '..');
};

const normalizeOfficialObjectKey = (value) => {
    if (typeof value !== 'string') return '';
    const candidate = value.replace(/^\/+/, '');
    if (!candidate.startsWith('official/') || candidate.endsWith('/')) return '';
    return hasSafePathSegments(candidate) ? candidate : '';
};

const normalizeOfficialPrefix = (value) => {
    if (typeof value !== 'string' || !value.startsWith('official/') || !value.endsWith('/')) {
        return '';
    }
    const withoutTrailingSlash = value.slice(0, -1);
    return hasSafePathSegments(withoutTrailingSlash) ? value : '';
};

const normalizeRelativeAssetPath = (value) => {
    if (typeof value !== 'string'
        || value.length === 0
        || value.trim() !== value
        || value.startsWith('/')
        || value.includes('\\')
        || /^[A-Za-z]:/.test(value)
        || /^[a-z][a-z0-9+.-]*:/i.test(value)
        || !hasSafePathSegments(value)) {
        return '';
    }
    return value;
};

const appendReference = (output, candidate) => {
    if (candidate && !output.includes(candidate)) {
        output.push(candidate);
    }
};

const extractDirectReference = (value) => {
    if (typeof value !== 'string') return '';
    if (/^https?:\/\//i.test(value)) {
        try {
            const url = new URL(value);
            const marker = url.pathname.indexOf('/official/');
            if (marker >= 0) {
                return normalizeOfficialObjectKey(decodeURIComponent(url.pathname.slice(marker + 1)));
            }
        } catch {
            return '';
        }
        return '';
    }
    return normalizeOfficialObjectKey(value);
};

const extractFileIndexReferences = (value, output) => {
    if (!Array.isArray(value?.files)) return;
    for (const entry of value.files) {
        const relativePath = normalizeRelativeAssetPath(entry?.path);
        if (relativePath) {
            appendReference(output, `official/${relativePath}`);
        }
    }
};

const extractAssetManifestReferences = (value, output) => {
    if (!value
        || typeof value !== 'object'
        || Array.isArray(value)
        || value.manifestVersion !== 1
        || value.scope !== 'official'
        || !value.files
        || Array.isArray(value.files)
        || typeof value.files !== 'object') {
        return;
    }

    const basePrefix = normalizeOfficialPrefix(value.basePrefix);
    if (!basePrefix) return;

    for (const [logicalPath, definition] of Object.entries(value.files)) {
        const safeLogicalPath = normalizeRelativeAssetPath(logicalPath);
        if (!safeLogicalPath || !definition?.variants || typeof definition.variants !== 'object') {
            continue;
        }
        for (const extension of Object.keys(definition.variants)) {
            const safeExtension = extension.replace(/^\./, '');
            if (!/^[a-z0-9]+$/i.test(safeExtension)) continue;
            appendReference(output, `${basePrefix}${safeLogicalPath}.${safeExtension}`);
        }
    }
};

export const extractAssetReferences = (value, output = []) => {
    if (typeof value === 'string') {
        appendReference(output, extractDirectReference(value));
        return output;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            extractAssetReferences(item, output);
        }
        return output;
    }

    if (value && typeof value === 'object') {
        extractFileIndexReferences(value, output);
        extractAssetManifestReferences(value, output);
        for (const item of Object.values(value)) {
            extractAssetReferences(item, output);
        }
    }
    return output;
};

export const resolveActiveAssetSet = async ({ objects, readJson }) => {
    const roots = [...objects.keys()].filter(isActiveRootKey).sort();
    const active = new Set();
    const unresolved = new Set();
    const queue = [...roots];

    while (queue.length > 0) {
        const key = queue.shift();
        if (!key || active.has(key)) continue;
        if (!objects.has(key)) {
            unresolved.add(key);
            continue;
        }

        active.add(key);
        if (!key.endsWith('.json')) continue;

        const parsed = await readJson(key);
        for (const reference of extractAssetReferences(parsed)) {
            if (!active.has(reference)) {
                queue.push(reference);
            }
        }
    }

    return {
        active,
        roots,
        unresolved,
    };
};

export const createActiveFingerprint = (active, objects) => {
    const hash = createHash('sha256');
    for (const key of [...active].sort()) {
        const metadata = objects.get(key);
        hash.update(`${key}\0${metadata.size}\0${metadata.modTime}\n`);
    }
    return hash.digest('hex');
};
