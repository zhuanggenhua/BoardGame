import fs from 'node:fs';
import path from 'node:path';
import { PALADIN_CARDS } from '../../../src/games/dicethrone/heroes/paladin/cards';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const localOut=path.resolve('evidence/圣骑士卡图错配/20261015T142510Z');
const locale=JSON.parse(fs.readFileSync('public/locales/zh-CN/game-dicethrone.json','utf8'));
const cards=PALADIN_CARDS.map(card=>({id:card.id,index:card.previewRef?.type==='atlas'?card.previewRef.index:null,
 name:locale.cards[card.id]?.name,description:locale.cards[card.id]?.description,
 cpCost:card.cpCost,type:card.type,timing:card.timing,effects:card.effects,
 previewRef:card.previewRef}));
fs.writeFileSync(path.join(localOut,'runtime-cards.json'),JSON.stringify(cards,null,2));
console.log(JSON.stringify(cards.map(({id,index,name,cpCost})=>({id,index,name,cpCost})),null,2));
