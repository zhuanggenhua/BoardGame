// 一次性编码实验：只写当前 evidence，不替代项目正式压缩入口。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const out = __dirname;
const sources = JSON.parse(fs.readFileSync(path.join(out, 'sources.json'), 'utf8'));
sharp.cache(false);
sharp.concurrency(2);

const configs = [
  ...[95, 90, 85, 82, 80, 75, 70, 65].map(quality => ({id: `default-q${quality}`, quality})),
  ...[85, 80, 75].map(quality => ({id: `sharp-yuv-q${quality}`, quality, smartSubsample: true})),
  ...[85, 80, 75].map(quality => ({id: `text-q${quality}`, quality, smartSubsample: true, preset: 'text'})),
  {id: 'drawing-q80', quality: 80, smartSubsample: true, preset: 'drawing'},
  {id: 'auto-filter-q80', quality: 80, smartSubsample: true, smartDeblock: true},
  {id: 'near-lossless-q60', quality: 60, nearLossless: true},
  {id: 'lossless', quality: 100, lossless: true},
];

async function run() {
  const phase = process.argv[2] || 'pilot';
  const chosen = new Set(process.argv.slice(3));
  const selected = chosen.size ? configs.filter(c => chosen.has(c.id)) : configs;
  if (chosen.size && selected.length !== chosen.size) throw new Error('未知编码配置');
  let inputEntries;
  if (phase === 'pilot') {
    const sample = path.join(out, 'sample-source.png');
    if (!fs.existsSync(sample)) {
      const cards = await Promise.all([0, 12, 32].map(i => sharp(path.join(out, `source-card-${i}.png`)).png().toBuffer()));
      const board = await sharp(sources['player-board'].source.path).extract({left:40, top:600, width:736, height:1178}).png().toBuffer();
      const tip = await sharp(sources.tip.source.path).extract({left:0, top:0, width:736, height:1178}).png().toBuffer();
      await sharp({create:{width:736*5, height:1178, channels:4, background:{r:0,g:0,b:0,alpha:0}}})
        .composite([...cards, board, tip].map((input,i)=>({input,left:i*736,top:0}))).png().toFile(sample);
    }
    inputEntries = [['sample', sample]];
  } else if (phase === 'full') {
    inputEntries = Object.entries(sources).map(([name, value])=>[name,value.source.path]);
  } else throw new Error('阶段只能是 pilot 或 full');
  const target = path.join(out, phase);
  fs.mkdirSync(target, {recursive:true});
  const tasks = inputEntries.flatMap(([name,input]) => selected.map(config=>({name,input,config})));
  const reportPath = path.join(out, `${phase}-results.json`);
  const records = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath,'utf8')).records : [];
  async function worker() {
    while (tasks.length) {
      const {name,input,config} = tasks.shift();
      const dest = path.join(target, `${name}--${config.id}.webp`);
      const existing = records.find(x=>x.asset===name && x.config.id===config.id);
      if (existing && fs.existsSync(dest)) continue;
      const {id,...options}=config;
      const start = performance.now();
      const result = await sharp(input).webp({effort:6, alphaQuality:100, ...options}).toFile(dest);
      const record = {asset:name, config, file:dest, bytes:result.size, width:result.width, height:result.height,
        encodeMs:Math.round(performance.now()-start), sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')};
      const idx=records.findIndex(x=>x.asset===name && x.config.id===config.id);
      if(idx>=0) records[idx]=record; else records.push(record);
      fs.writeFileSync(reportPath, JSON.stringify({phase,versions:sharp.versions,records},null,2));
      console.log(`${phase} ${name} ${id}: ${result.size} bytes, ${record.encodeMs} ms`);
    }
  }
  await Promise.all([worker(),worker()]);
  console.log(`Results: ${reportPath}`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
