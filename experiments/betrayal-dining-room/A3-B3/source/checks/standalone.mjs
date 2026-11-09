import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('dist/index.html','utf8');
const license=readFileSync('licenses/THREE-LICENSE.txt','utf8');
writeFileSync('dist/THREE-LICENSE.txt',license);
const jsPath=html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1];
const cssPath=html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
assert(jsPath&&cssPath,'Built entry must contain one script and stylesheet');
const js=readFileSync(`dist/${jsPath.replace(/^\.\//,'')}`,'utf8');
const css=readFileSync(`dist/${cssPath.replace(/^\.\//,'')}`,'utf8');
// All dependencies are bundled. Textures and models are generated in memory.
assert(!/(?:from|import)\s*["'][.\/]/.test(js),'No relative runtime imports');
const standalone=html.replace('<head>',()=>`<head><!-- Third-party runtime license:\n${license}\n-->`)
  .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/,()=>`<script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script>`)
  .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/,()=>`<style>${css}</style>`);
assert(!/<(?:script|link)[^>]+(?:src|href)=/.test(standalone));
writeFileSync('dist/dining-room-A3-B3-standalone.html',standalone);
console.log(`Self-contained preview: ${Buffer.byteLength(standalone)} bytes. Browser execution remains unverified.`);
