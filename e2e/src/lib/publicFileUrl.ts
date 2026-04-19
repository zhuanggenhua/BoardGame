const VERSION_PARAM = 'v';
const HASHED_PUBLIC_PREFIXES = ['fonts/', 'logos/', 'game-data/'] as const;
const EXCLUDED_PUBLIC_FILES = new Set([
    'game-data/summonerwars.layout.json',
]);

let publicFileHashes: Record<string, string> =
    typeof __PUBLIC_FILE_HASHES__ !== 'undefined' ? __PUBLIC_FILE_HASHES__ : {};

const normalizePublicPath = (value: string) => {
    const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
    if (EXCLUDED_PUBLIC_FILES.has(normalized)) {
        return null;
    }
    return HASHED_PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ? normalized : null;
};

const splitUrlParts = (value: string) => {
    const hashIndex = value.indexOf('#');
    const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
    const queryIndex = withoutHash.indexOf('?');
    return {
        path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
        query: queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '',
        hash,
    };
};

const isHttpUrl = (value: string) => value.startsWith('http://') || value.startsWith('https://');

export const setPublicFileHashesForTesting = (value?: Record<string, string>) => {
    publicFileHashes = value ?? {};
};

export const versionedPublicFileUrl = (value: string) => {
    if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
        return value;
    }

    const { path, query, hash } = splitUrlParts(value);
    let normalizedPath: string | null;

    if (isHttpUrl(path)) {
        try {
            normalizedPath = normalizePublicPath(new URL(path).pathname);
        } catch {
            return value;
        }
    } else {
        normalizedPath = normalizePublicPath(path);
    }

    if (!normalizedPath) {
        return value;
    }

    const version = publicFileHashes[normalizedPath];
    if (!version) {
        return value;
    }

    const params = new URLSearchParams(query);
    params.set(VERSION_PARAM, version);
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}${hash}` : `${path}${hash}`;
};
