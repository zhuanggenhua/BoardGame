/*
 * 修复一次错误的字符串替换：把 STATUS_IDS.KNOCKDOWN / DICETHRONE_COMMANDS.* 错误注入到了字符串字面量/对象 key 中。
 *
 * 目标：先把代码恢复到“纯字符串 id”的正确状态，然后再用更安全的方式逐步引入常量表。
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..', 'src', 'games', 'dicethrone');

const targets = new Set([
  'Board.tsx',
  'game.ts',
  path.join('domain', 'commands.ts'),
  path.join('domain', 'effects.ts'),
  path.join('domain', 'execute.ts'),
  path.join('domain', 'index.ts'),
  path.join('domain', 'types.ts'),
  path.join('monk', 'abilities.ts'),
  path.join('monk', 'cards.ts'),
  path.join('monk', 'statusEffects.ts'),
  path.join('ui', 'statusEffects.tsx'),
  path.join('ui', 'LeftSidebar.tsx'),
  path.join('__tests__', 'flow.test.ts'),
  path.join('ui', 'ConfirmRemoveKnockdownModal.tsx'),
  path.join('ui', 'BoardOverlays.tsx'),
]);

const exts = new Set(['.ts', '.tsx']);

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
}

const reps = [
  // Undo the previous incorrect replacement that injected constant names into string literals
  ['"STATUS_IDS.KNOCKDOWN"', '"knockdown"'],
  ["'STATUS_IDS.KNOCKDOWN'", "'knockdown'"],
  ['STATUS_IDS.KNOCKDOWNStacks', 'knockdownStacks'],
  ['no_STATUS_IDS.KNOCKDOWN', 'no_knockdown'],

  // Restore quoted command type
  ['"DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN"', '"PAY_TO_REMOVE_KNOCKDOWN"'],
  ["'DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN'", "'PAY_TO_REMOVE_KNOCKDOWN'"],
  ['DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN', 'PAY_TO_REMOVE_KNOCKDOWN'],

  // Fix TS generic strings
  ["Command<'DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN'>", "Command<'PAY_TO_REMOVE_KNOCKDOWN'>"],

  // Switch/case restore
  ["case 'DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN':", "case 'PAY_TO_REMOVE_KNOCKDOWN':"],
  ['[DiceThrone] DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN', '[DiceThrone] PAY_TO_REMOVE_KNOCKDOWN'],

  // JSX key
  ['confirm-remove-STATUS_IDS.KNOCKDOWN', 'confirm-remove-knockdown'],

  // clickable arrays/compares
  ["effectId === 'STATUS_IDS.KNOCKDOWN'", "effectId === 'knockdown'"],
  ["['STATUS_IDS.KNOCKDOWN']", "['knockdown']"],

  // object keys in tests expectations
  ['statusEffects: { STATUS_IDS.KNOCKDOWN:', 'statusEffects: { knockdown:'],
  ['statusEffects.STATUS_IDS.KNOCKDOWN', 'statusEffects.knockdown'],

  // statusEffects map access
  ["statusEffects['STATUS_IDS.KNOCKDOWN']", "statusEffects['knockdown']"],
  ["statusEffects?.['STATUS_IDS.KNOCKDOWN']", "statusEffects?.['knockdown']"],
  ['.statusEffects.STATUS_IDS.KNOCKDOWN', '.statusEffects.knockdown'],

  // misc literals
  ["{ id: 'STATUS_IDS.KNOCKDOWN'", "{ id: 'knockdown'"],
  ["id: 'STATUS_IDS.KNOCKDOWN'", "id: 'knockdown'"],
  ["statusId: 'STATUS_IDS.KNOCKDOWN'", "statusId: 'knockdown'"],
  ["payload: { statusId: 'STATUS_IDS.KNOCKDOWN'", "payload: { statusId: 'knockdown'"],
  ["payload: { targetId, statusId: 'STATUS_IDS.KNOCKDOWN'", "payload: { targetId, statusId: 'knockdown'"],
  ["inflictStatus('STATUS_IDS.KNOCKDOWN'", "inflictStatus('knockdown'"],
  ["name: statusEffectText('STATUS_IDS.KNOCKDOWN'", "name: statusEffectText('knockdown'"],
  ["description: statusEffectText('STATUS_IDS.KNOCKDOWN'", "description: statusEffectText('knockdown'"],
  ["export type MonkStatusEffectId = 'STATUS_IDS.KNOCKDOWN'", "export type MonkStatusEffectId = 'knockdown'"],
];

const files = [];
walk(root, files);
const chosen = files.filter((f) => targets.has(path.relative(root, f)));

let changed = 0;
for (const file of chosen) {
  const orig = fs.readFileSync(file, 'utf8');
  let next = orig;
  for (const [a, b] of reps) next = next.split(a).join(b);
  if (next !== orig) {
    fs.writeFileSync(file, next, 'utf8');
    console.log('fixed', path.relative(process.cwd(), file));
    changed++;
  }
}

console.log('done fixedFiles=' + changed);
