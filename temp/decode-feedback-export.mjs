import fs from 'node:fs';
const b64 = fs.readFileSync('temp/all-feedbacks.b64', 'ascii').trim();
const raw = Buffer.from(b64, 'base64').toString('utf8');
const start = raw.indexOf('[');
const end = raw.lastIndexOf(']');
if (start === -1 || end === -1 || end < start) {
  throw new Error('Cannot locate JSON array in export payload');
}
const json = raw.slice(start, end + 1);
JSON.parse(json);
fs.writeFileSync('temp/all-feedbacks.json', json, 'utf8');
console.log(`cleaned ${json.length} chars`);