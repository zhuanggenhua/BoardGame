import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertPublishedBundleIdentity,
  loadExpectedBundleManifest,
  resolveTargetUrl,
} from './betrayal-public-local-acceptance-config.mjs';

const bundleManifest = {
  schemaVersion: 1,
  siteVersion: 92,
  bundles: [
    { filename: 'game-SA52CLMn.js', sha256: '108d242315bc673f6563a0b94b058712b840f36399b11dfa6fd7030de902f3e6' },
    { filename: 'Board-DqCzzzrQ.js', sha256: 'a28b35c8490cbebbc6630f6f72f1577bf67d122f6b8f392101736d4179d04be2' },
    { filename: 'PixiMapSceneHost--TAUnX1s.js', sha256: '4620e0c3e041e3afd1bbae5554b841a44c5fe5697843c3de6d544aa800a73553' },
  ],
};

test('public acceptance can target an explicitly supplied site base URL', () => {
  assert.equal(
    resolveTargetUrl('https://candidate.example/').href,
    'https://candidate.example/play/betrayal/local',
  );
  assert.equal(
    resolveTargetUrl('https://candidate.example/play/betrayal/local').href,
    'https://candidate.example/play/betrayal/local',
  );
  assert.equal(
    resolveTargetUrl(undefined).href,
    'https://boardgame-betrayal-local-verification.blushbison1024.chatgpt.site/play/betrayal/local',
  );
});

test('public acceptance rejects unsafe or ambiguous site base URLs', () => {
  assert.throws(() => resolveTargetUrl('http://public.example'), /HTTPS/);
  assert.throws(() => resolveTargetUrl('https://user:pass@candidate.example'), /credentials/);
  assert.throws(() => resolveTargetUrl('https://candidate.example/?seed=old'), /query|fragment/);
});

test('public acceptance reads a published Sites version and exact bundle manifest', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'betrayal-acceptance-config-'));
  try {
    const manifestPath = path.join(directory, 'expected-bundles.json');
    writeFileSync(manifestPath, JSON.stringify(bundleManifest), 'utf8');

    assert.deepEqual(loadExpectedBundleManifest(manifestPath), {
      ...bundleManifest,
      siteVersion: String(bundleManifest.siteVersion),
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('public acceptance requires a Sites version and complete unambiguous bundle identity data', () => {
  assert.throws(
    () => loadExpectedBundleManifest(),
    /EXPECTED_BUNDLE_MANIFEST_PATH is required/,
  );
  const directory = mkdtempSync(path.join(os.tmpdir(), 'betrayal-acceptance-config-'));
  const manifestPath = path.join(directory, 'expected-bundles.json');
  try {
    writeFileSync(manifestPath, JSON.stringify({ ...bundleManifest, siteVersion: '' }), 'utf8');
    assert.throws(() => loadExpectedBundleManifest(manifestPath), /published Sites version/);

    writeFileSync(manifestPath, JSON.stringify({ ...bundleManifest, bundles: [] }), 'utf8');
    assert.throws(() => loadExpectedBundleManifest(manifestPath), /at least one bundle/);

    writeFileSync(manifestPath, JSON.stringify({
      ...bundleManifest,
      bundles: [bundleManifest.bundles[0], { ...bundleManifest.bundles[0] }],
    }), 'utf8');
    assert.throws(() => loadExpectedBundleManifest(manifestPath), /duplicate bundle filename/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('public acceptance verifies exact bundles without requiring a runtime page SHA', () => {
  const observedBundles = bundleManifest.bundles.map((bundle) => ({ ...bundle, status: 200 }));
  assert.deepEqual(
    assertPublishedBundleIdentity(bundleManifest, observedBundles),
    { siteVersion: '92', verifiedBundleNames: bundleManifest.bundles.map((bundle) => bundle.filename) },
  );

  const wrongBuildBundles = observedBundles.map((bundle) => ({ ...bundle }));
  wrongBuildBundles[1].sha256 = 'f'.repeat(64);
  assert.throws(
    () => assertPublishedBundleIdentity(bundleManifest, wrongBuildBundles),
    /SHA-256 mismatch.*Board-DqCzzzrQ\.js/,
  );
  assert.throws(
    () => assertPublishedBundleIdentity(bundleManifest, observedBundles.slice(1)),
    /not served successfully.*game-SA52CLMn\.js/,
  );
});
