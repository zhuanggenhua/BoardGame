import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Copy the real CLI into a disposable project. The only viewer is a harmless
// stub, so even the red regression test cannot launch a user's browser.
function fixture(t) {
 const root = mkdtempSync(path.join(tmpdir(), 'viewer-dry-run-'));
 t.after(() => rmSync(root, { recursive: true, force: true }));
 mkdirSync(path.join(root, 'scripts/verify'), {recursive:true});
 mkdirSync(path.join(root, '.tools/e2e-image-viewer'), {recursive:true});
 mkdirSync(path.join(root, 'evidence'));
 for (const name of ['open-verified-image.mjs','e2e-image-index-contract.mjs']) {
   copyFileSync(new URL(name, import.meta.url), path.join(root,'scripts/verify',name));
 }
 writeFileSync(path.join(root,'.tools/e2e-image-viewer/server.mjs'), `import fs from 'node:fs'; fs.writeFileSync('viewer-invoked.json', JSON.stringify(process.argv.slice(2))); console.log('OPENED_BROWSER=true');`);
 writeFileSync(path.join(root,'evidence/a.png'), 'fixture');
 return {root, marker:path.join(root,'viewer-invoked.json'), run:args=>spawnSync(process.execPath,[path.join(root,'scripts/verify/open-verified-image.mjs'),...args],{cwd:root,encoding:'utf8'})};
}
for (const extras of [[],['--no-open'],['--reopen']]) {
 test(`directory dry-run never invokes viewer (${extras.join(' ') || 'default'})`, t=>{
  const f=fixture(t);const result=f.run(['--dir','evidence','--dry-run',...extras]);
  assert.equal(existsSync(f.marker),false,'dry-run must not even register or start a viewer');
  assert.equal(result.status,1);
  assert.match(result.stderr,/--dry-run.*--pass-manifest/);
 });
}
test('media-path dry-run remains side-effect free',t=>{
 const f=fixture(t);const result=f.run(['--path','evidence/a.png','--dry-run']);
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/DRY_RUN=true/);assert.equal(existsSync(f.marker),false);
});
test('explicit directory no-open still forwards no-open to existing viewer entry',t=>{
 const f=fixture(t);const result=f.run(['--dir','evidence','--no-open']);
 assert.equal(result.status,0,result.stderr);assert.ok(JSON.parse(readFileSync(f.marker,'utf8')).includes('--no-open'));
});
