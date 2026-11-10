// 离线候选校验：与正式游戏入口、线上性能验收分开。
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {chromium} = require('playwright');

const out = __dirname;
const root = path.resolve(out, '../../..');
const sources = JSON.parse(fs.readFileSync(path.join(out,'sources.json'),'utf8'));
const full = JSON.parse(fs.readFileSync(path.join(out,'full-results.json'),'utf8'));
const preprocessed = process.argv[2] === 'preprocess';
const extra = preprocessed ? JSON.parse(fs.readFileSync(path.join(out,'preprocess-full-results.json'),'utf8')) : [];
const atlas = JSON.parse(fs.readFileSync(path.join(root,'src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json'),'utf8'));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function chunks(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii',0,4)!=='RIFF' || bytes.toString('ascii',8,12)!=='WEBP') throw new Error('不是 WebP');
  const result=[];
  for(let offset=12;offset+8<=bytes.length;){
    const type=bytes.toString('ascii',offset,offset+4);
    const size=bytes.readUInt32LE(offset+4);
    result.push(type);
    offset+=8+size+(size%2);
  }
  return result;
}

async function run(){
  const entries=[];
  const selectedDir=path.join(out,preprocessed?'selected-preprocessed':'selected','compressed');
  fs.mkdirSync(selectedDir,{recursive:true});
  for(const [name,source] of Object.entries(sources)){
    for(const key of ['source','baseline']){
      if(digest(source[key].path)!==source[key].sha256) throw new Error(`实验期间文件变化: ${name}/${key}`);
    }
    const rawCandidate = preprocessed ? extra.find(r=>r.asset===name) : null;
    const candidate=preprocessed ? rawCandidate && {...rawCandidate,sha256:digest(rawCandidate.file),config:{id:'edge-protected-09-text-q75'}} : full.records.find(r=>r.asset===name&&r.config.id==='text-q75');
    if(!candidate) throw new Error(`缺候选: ${name}`);
    const dest=path.join(selectedDir,`${name}.webp`);
    fs.copyFileSync(candidate.file,dest);
    if(digest(dest)!==candidate.sha256)throw new Error('候选复制 hash 不一致');
    entries.push({name,kind:'baseline',path:source.baseline.path,expected:source.baseline});
    entries.push({name,kind:'selected',path:dest,expected:source.source,config:candidate.config});
  }
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end('<!doctype html><title>Offline WebP decode verification</title>');
      return;
    }
    const match=/^\/asset\/(\d+)\.webp$/.exec(req.url||'');
    const entry=match&&entries[Number(match[1])];
    if(!entry){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'image/webp','Content-Length':fs.statSync(entry.path).size,'Cache-Control':'no-store'});
    fs.createReadStream(entry.path).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    const reports=[];
    for(let i=0;i<entries.length;i++){
      const entry=entries[i];
      const page=await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const result=await page.evaluate(async({url,frames})=>{
        const image=new Image();
        const start=performance.now();
        image.src=url;
        await image.decode();
        const decodeMs=performance.now()-start;
        const canvas=document.createElement('canvas');
        const context=canvas.getContext('2d',{willReadFrequently:true});
        const frameResults=[];
        for(const frame of frames){
          canvas.width=frame.width;canvas.height=frame.height;
          context.drawImage(image,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);
          const pixels=context.getImageData(0,0,frame.width,frame.height).data;
          let opaque=0, nonblack=0;
          for(let j=0;j<pixels.length;j+=4){
            if(pixels[j+3]>0)opaque++;
            if(pixels[j]+pixels[j+1]+pixels[j+2]>20&&pixels[j+3]>0)nonblack++;
          }
          frameResults.push({opaque,nonblack});
        }
        canvas.width=canvas.height=1;
        return {width:image.naturalWidth,height:image.naturalHeight,decodeAndLocalFetchMs:Math.round(decodeMs),frames:frameResults};
      },{url:`http://127.0.0.1:${server.address().port}/asset/${i}.webp`,frames:entry.name==='ability-cards'?atlas.frames:[]});
      await page.close();
      if(result.width!==entry.expected.width||result.height!==entry.expected.height)throw new Error('浏览器解码尺寸变化');
      if(result.frames.some(f=>!f.opaque||!f.nonblack))throw new Error('浏览器裁片出现空帧');
      reports.push({name:entry.name,kind:entry.kind,bytes:fs.statSync(entry.path).size,sha256:digest(entry.path),chunks:chunks(entry.path),...result});
      console.log(entry.name,entry.kind,result.width,result.height,`${result.frames.length} frames decoded`,result.decodeAndLocalFetchMs+' ms');
    }
    const report={browser:browser.version(),scope:'本机 Chromium 离线解码与 Canvas 裁片；未验证 Safari/iOS/Android 真机或游戏入口性能',formalSourcesUnchanged:true,reports};
    fs.writeFileSync(path.join(out,preprocessed?'browser-verification-preprocessed.json':'browser-verification.json'),JSON.stringify(report,null,2));
    const selection=Object.keys(sources).map(name=>{
      const row=reports.find(r=>r.name===name&&r.kind==='selected');
      return {name,file:path.join(selectedDir,`${name}.webp`),bytes:row.bytes,sha256:row.sha256,baselineBytes:sources[name].baseline.bytes,
        options:{quality:75,effort:6,preset:'text',smartSubsample:true,alphaQuality:100},preprocess:preprocessed?'edge-protected-gaussian-sigma09':null,width:row.width,height:row.height};
    });
    const before=selection.reduce((n,r)=>n+r.baselineBytes,0),after=selection.reduce((n,r)=>n+r.bytes,0);
    fs.writeFileSync(path.join(out,preprocessed?'selection-preprocessed.json':'selection.json'),JSON.stringify({selection,baselineBytes:before,selectedBytes:after,savedPercent:100*(1-after/before)},null,2));
    console.log(JSON.stringify({baselineBytes:before,selectedBytes:after,savedPercent:100*(1-after/before)}));
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
