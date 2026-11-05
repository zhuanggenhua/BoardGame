import type { QidahenCore, QidahenFactionId } from './types';
import type { QidahenCharacterJudgementTask } from './turnResolutionTypes';

export type QidahenCharacterOutcome = 'none' | 'down' | 'remove' | 'party-conflict' | QidahenFactionId;
const factions = ['ming', 'mongol', 'jin'] as const;
const donglin = new Set(['ming-xiong-tingbi', 'ming-sun-chengzong', 'ming-sun-yuanhua', 'ming-yuan-chonghuan']);

export function getQidahenCharacterJudgementOutcome(core: QidahenCore, task: QidahenCharacterJudgementTask, rawRoll: number): { outcome: QidahenCharacterOutcome; roll: number } {
    const active = factions.flatMap(id => core.factions[id].characters.filter(character => character.inPlay));
    const lindan = active.find(character => character.id === 'mongol-lindan-hutuktu');
    const dais = core.factions[task.factionId].characters.some(character => character.id === 'jin-daisan' && character.inPlay);
    const protectedFromLindan = dais && lindan?.faction !== task.factionId;
    const roll = lindan && task.characterId !== lindan.id && !protectedFromLindan ? rawRoll - 1 : rawRoll;
    const has = (id: string) => active.some(character => character.id === id);
    let outcome: QidahenCharacterOutcome = 'none';
    switch (task.characterId) {
        case 'ming-xiong-tingbi': outcome = roll === 1 ? 'remove' : roll <= 4 || roll <= 6 && active.some(character => character.id !== task.characterId) ? 'down' : 'none'; break;
        case 'ming-sun-chengzong': outcome = roll === 1 ? 'down' : roll <= 3 ? 'party-conflict' : roll <= 8 && has('ming-wei-zhongxian') ? 'down' : 'none'; break;
        case 'ming-sun-yuanhua': outcome = roll === 1 ? 'jin' : roll <= 5 ? 'down' : 'none'; break;
        case 'ming-mao-wenlong': {
            const occupier = core.regions.find(region => !region.isLogicalRegion && region.id === 'city-region-22')?.controller;
            if (roll >= 1 && roll <= 4) {
                if (!occupier || occupier === 'neutral' || occupier === task.factionId) throw new Error('Rule source does not specify Mao Wenlong defection without a Dongjiang occupier');
                outcome = occupier;
            } else outcome = roll >= 5 && roll <= 8 ? 'down' : 'none';
            break;
        }
        case 'ming-yang-gao': outcome = roll === 1 ? 'jin' : roll === 2 ? 'mongol' : 'none'; break;
        case 'ming-wei-zhongxian': outcome = roll === 1 || roll >= 2 && roll <= 5 && has('ming-sun-chengzong') ? 'remove' : 'none'; break;
        case 'ming-gao-di': outcome = roll === 1 || roll >= 2 && roll <= 5 && active.some(character => donglin.has(character.id)) ? 'down' : 'none'; break;
        case 'ming-wang-huazhen': outcome = roll === 1 ? 'down' : roll >= 2 && roll <= 5 && active.some(character => donglin.has(character.id)) ? 'remove' : 'none'; break;
        case 'mongol-lindan-hutuktu': outcome = roll === 1 ? 'remove' : roll >= 2 && roll <= 4 ? 'down' : 'none'; break;
        case 'mongol-oba-taiji': outcome = roll <= 2 ? 'jin' : roll <= 5 ? 'down' : 'none'; break;
        case 'mongol-qisai-noyan': outcome = roll <= 1 ? 'jin' : roll <= 4 ? 'down' : 'none'; break;
        case 'mongol-gunchu-ketuji': outcome = roll <= 1 ? 'jin' : roll <= 5 ? 'down' : 'none'; break;
        case 'jin-eidu': outcome = roll === 1 ? 'mongol' : roll === 2 ? 'remove' : 'none'; break;
        case 'jin-fan-wencheng': outcome = roll >= 1 && roll <= 2 ? 'down' : 'none'; break;
        case 'jin-amin':
            if (roll === 3 || roll === 9 || roll === 10) throw new Error('Amin printed judgement overlaps at 3 and omits 9/10; authoritative errata required');
            outcome = roll >= 1 && roll <= 2 ? 'ming' : roll >= 4 && roll <= 6 ? 'down' : 'none'; break;
        case 'jin-manggultai': outcome = roll === 1 ? 'remove' : roll >= 2 && roll <= 3 ? 'mongol' : roll >= 4 && roll <= 6 ? 'down' : 'none'; break;
        case 'jin-yanguli': outcome = roll >= 1 && roll <= 2 ? 'remove' : roll >= 3 && roll <= 6 ? 'down' : 'none'; break;
        default: throw new Error(`Character ${task.characterId} has no judgement table`);
    }
    if (roll === 0 && !['mongol-oba-taiji', 'mongol-qisai-noyan', 'mongol-gunchu-ketuji'].includes(task.characterId)) throw new Error(`Rule source does not specify modified zero for ${task.characterId}`);
    return { outcome, roll };
}

export function applyQidahenCharacterJudgement(core: QidahenCore, task: QidahenCharacterJudgementTask, outcome: QidahenCharacterOutcome): QidahenCore {
    const character = core.factions[task.factionId].characters.find(item => item.id === task.characterId && item.inPlay);
    if (!character) return core;
    const after = { ...character, defeatMarkers: task.reason === 'defeat-marker' ? Math.max(0, character.defeatMarkers - 1) : character.defeatMarkers };
    if (outcome !== 'none') Object.assign(after, { inPlay: false, defeatMarkers: 0, removedFromGame: outcome === 'remove' });
    const transfer = factions.includes(outcome as QidahenFactionId) ? outcome as QidahenFactionId : null;
    let nextFactions = { ...core.factions, [task.factionId]: { ...core.factions[task.factionId], characters: core.factions[task.factionId].characters.flatMap(item => item.id !== character.id ? [item] : transfer && transfer !== task.factionId ? [] : [after]) } };
    if (transfer && transfer !== task.factionId) nextFactions = { ...nextFactions, [transfer]: { ...nextFactions[transfer], characters: [...nextFactions[transfer].characters.filter(item => item.id !== character.id), { ...after, faction: transfer }] } };
    return { ...core, factions: nextFactions };
}

export function buildQidahenCharacterJudgementTasks(core: QidahenCore): QidahenCharacterJudgementTask[] {
    const active = factions.flatMap(id => core.factions[id].characters.filter(character => character.inPlay));
    const extra: QidahenCharacterJudgementTask[] = [];
    for (const character of active) {
        let attempts = character.id === 'ming-wei-zhongxian' ? 1 : 0;
        if (character.id === 'ming-sun-yuanhua' && core.factions[character.faction].characters.some(item => item.id === 'ming-wei-zhongxian' && item.inPlay)) attempts = 2;
        if (character.id === 'ming-mao-wenlong') {
            const controller = core.regions.find(region => region.id === 'city-region-22')?.controller;
            attempts = controller && controller !== 'neutral' && controller !== character.faction ? 1 : 0;
        }
        for (let index = 0; index < attempts; index += 1) extra.push({ factionId: character.faction, characterId: character.id, reason: 'extra' });
    }
    extra.sort((left, right) => Number(right.characterId === 'ming-wei-zhongxian') - Number(left.characterId === 'ming-wei-zhongxian'));
    return [...extra, ...active.flatMap(character => character.number === 'X' ? [] : Array.from({ length: character.defeatMarkers }, (): QidahenCharacterJudgementTask => ({ factionId: character.faction, characterId: character.id, reason: 'defeat-marker' })))];
}

export function isQidahenCharacterJudgementTaskActive(core: QidahenCore, task: QidahenCharacterJudgementTask): boolean {
    const character = core.factions[task.factionId].characters.find(item => item.id === task.characterId && item.inPlay);
    if (!character || character.number === 'X') return false;
    if (task.reason === 'defeat-marker') return character.defeatMarkers > 0;
    if (task.characterId === 'ming-sun-yuanhua') return core.factions[task.factionId].characters.some(item => item.id === 'ming-wei-zhongxian' && item.inPlay);
    return true;
}
