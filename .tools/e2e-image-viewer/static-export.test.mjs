import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportStaticViewer } from './static-export.mjs';

test('公开导出复用原版画布文件、原始媒体和目录身份，不发布本机路径', () => {
 const temp=mkdtempSync(path.join(os.tmpdir(),'viewer-export-'));
 try {
  const image=path.join(temp,'原图.png');writeFileSync(image,Buffer.from([1,2,3]));
  const webDir=path.resolve('.tools/e2e-image-viewer/web');
  const result=exportStaticViewer({outputDirectory:path.join(temp,'out'),webDirectory:webDir,
   publicBaseUrl:'https://example.test/evidence/one/',viewerUrl:'http://127.0.0.1:4867/?key=registered-key',
   listing:{directory:'/private/source',directoryTitle:'当前工作稿',items:[{relativePath:'原图.png',absolutePath:image,url:'/media?key=abc',kind:'image',displayTitle:'确认后回到牌桌',description:'',size:3}]}});
  assert.equal(result.viewerUrl,'https://example.test/evidence/one/?key=registered-key');
  assert.equal(readFileSync(path.join(temp,'out/app.js'),'utf8'),readFileSync(path.join(webDir,'app.js'),'utf8'));
  assert.equal(readFileSync(path.join(temp,'out/styles.css'),'utf8'),readFileSync(path.join(webDir,'styles.css'),'utf8'));
  const html=readFileSync(path.join(temp,'out/index.html'),'utf8');
  assert.ok(html.includes('id="viewport"')&&html.includes('id="indexPanel"')&&html.includes('id="imageDetail"'));
  assert.ok(html.includes('name="e2e-viewer-list"'));
  const raw=readFileSync(path.join(temp,'out/viewer-data.json'),'utf8');assert.ok(!raw.includes('/private/')&&!raw.includes(temp));
  const listing=JSON.parse(raw);assert.equal(listing.directory,'registered-key');
  assert.deepEqual(readFileSync(path.join(temp,'out/media/原图.png')),Buffer.from([1,2,3]));
 } finally {rmSync(temp,{recursive:true,force:true});}
});
