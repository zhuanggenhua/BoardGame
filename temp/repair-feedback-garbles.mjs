import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:/Users/zhuagenbao/GameNotes/不烂/BoardGame反馈导出-2026-04-04T04-52-08-844Z';
const jsonPath = path.join(dir, 'feedbacks.json');
const arr = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const replacements = new Map([
  ['�?挡住', '被手牌挡住'],
  ['检查一�?,', '检查一下'],
  ['直接触发消灭�?,', '直接触发消灭'],
  ['效果没有加额�?,', '效果没有加额外次数'],
  ['木乃伊和大幅同时结算会被吃掉大幅的计分后移动', '木乃伊与大副同时结算时，会吃掉大副计分后的移动'],
]);

function repairText(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  out = out.replace(/\uFFFD/g, '');
  out = out.replace(/\?挡住/g, '挡住');
  return out;
}

let changed = 0;
for (const item of arr) {
  const before = item.content;
  item.content = repairText(item.content);
  if (item.content !== before) changed++;
}

const outPath = path.join(dir, 'feedbacks.repaired.json');
fs.writeFileSync(outPath, JSON.stringify(arr, null, 2), 'utf8');
const report = arr.filter(x => JSON.stringify(x).includes('�')).map(x => ({_id:x._id, gameName:x.gameName, status:x.status, content:x.content}));
fs.writeFileSync(path.join(dir, 'feedbacks.repaired.remaining-garbles.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('changed=' + changed);
console.log('remaining=' + report.length);
console.log(outPath);
