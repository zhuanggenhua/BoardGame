import { readFileSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_BASE_URL = 'https://boardgame-betrayal-local-verification.blushbison1024.chatgpt.site';
export const ACCEPTANCE_ROUTE = '/play/betrayal/local';

const isLoopbackHost = (hostname) => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '[::1]'
);

export function resolveTargetUrl(baseUrl = DEFAULT_BASE_URL) {
  const raw = typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL;
  let target;
  try {
    target = new URL(raw);
  } catch {
    throw new Error('BASE_URL must be an absolute HTTP(S) URL');
  }

  if (target.username || target.password) {
    throw new Error('BASE_URL must not contain credentials');
  }
  if (target.search || target.hash) {
    throw new Error('BASE_URL must not contain a query or fragment');
  }
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && isLoopbackHost(target.hostname))) {
    throw new Error('BASE_URL must use HTTPS except for loopback development URLs');
  }

  const basePath = target.pathname.replace(/\/+$/, '');
  target.pathname = basePath.endsWith(ACCEPTANCE_ROUTE)
    ? basePath
    : `${basePath}${ACCEPTANCE_ROUTE}`;
  return target;
}

export function loadExpectedBundleManifest(manifestPath, { cwd = process.cwd() } = {}) {
  if (typeof manifestPath !== 'string' || !manifestPath.trim()) {
    throw new Error('EXPECTED_BUNDLE_MANIFEST_PATH is required for build identity verification');
  }

  const resolvedPath = path.resolve(cwd, manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read expected bundle manifest: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (manifest?.schemaVersion !== 1) {
    throw new Error('Expected bundle manifest schemaVersion must be 1');
  }

  const siteVersion = typeof manifest.siteVersion === 'number' && Number.isSafeInteger(manifest.siteVersion)
    ? String(manifest.siteVersion)
    : typeof manifest.siteVersion === 'string'
      ? manifest.siteVersion.trim()
    : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(siteVersion)) {
    throw new Error('Expected bundle manifest must contain a valid published Sites version');
  }

  if (!Array.isArray(manifest.bundles) || manifest.bundles.length === 0) {
    throw new Error('Expected bundle manifest must contain at least one bundle');
  }

  const seenFilenames = new Set();
  const bundles = manifest.bundles.map((bundle) => {
    const filename = typeof bundle?.filename === 'string' ? bundle.filename.trim() : '';
    if (!filename || filename !== path.posix.basename(filename) || filename !== path.win32.basename(filename) || !/\.m?js$/i.test(filename)) {
      throw new Error('Expected bundle filenames must be JavaScript basenames');
    }
    if (seenFilenames.has(filename)) {
      throw new Error(`Expected bundle manifest contains duplicate bundle filename: ${filename}`);
    }
    seenFilenames.add(filename);

    const sha256 = typeof bundle?.sha256 === 'string' ? bundle.sha256.trim().toLowerCase() : '';
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`Expected bundle manifest has an invalid SHA-256 for ${filename}`);
    }
    return { filename, sha256 };
  });

  return { schemaVersion: 1, siteVersion, bundles };
}

export function assertPublishedBundleIdentity(manifest, observedBundles) {
  const siteVersion = typeof manifest?.siteVersion === 'number' && Number.isSafeInteger(manifest.siteVersion)
    ? String(manifest.siteVersion)
    : typeof manifest?.siteVersion === 'string'
      ? manifest.siteVersion.trim()
      : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(siteVersion)) {
    throw new Error('Expected bundle manifest must contain a valid published Sites version');
  }

  const expectedBundles = manifest.bundles;
  if (!Array.isArray(expectedBundles) || expectedBundles.length === 0) {
    throw new Error('Expected bundle manifest must contain at least one bundle');
  }

  const observedByName = new Map((Array.isArray(observedBundles) ? observedBundles : []).map((bundle) => [bundle.filename, bundle]));
  for (const expected of expectedBundles) {
    const observed = observedByName.get(expected.filename);
    if (!observed || observed.status !== 200) {
      throw new Error(`Expected bundle was not served successfully: ${expected.filename}`);
    }
    if (observed.sha256 !== expected.sha256) {
      throw new Error(`Bundle SHA-256 mismatch for ${expected.filename}: expected ${expected.sha256}, got ${observed.sha256}`);
    }
  }

  return { siteVersion, verifiedBundleNames: expectedBundles.map((bundle) => bundle.filename) };
}
