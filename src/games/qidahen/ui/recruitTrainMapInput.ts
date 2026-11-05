import { getQidahenWheelRecruitTrainChoices } from '../domain/wheelRecruitTrain';
import type { QidahenCore, QidahenWheelRecruitTrainChoice } from '../domain/types';

/** 将正式候选投影到同一地图实体；不按地区替玩家挑一支部队。 */
export function getQidahenRecruitTrainMapInput(core: QidahenCore) {
    const choices = getQidahenWheelRecruitTrainChoices(core);
    const recruits = choices.filter(choice => choice.kind === 'recruit-target');
    const training = choices.filter(choice => choice.kind === 'training-target');
    const byToken = new Map<string, QidahenWheelRecruitTrainChoice>();
    for (const token of core.mapTokens) {
        if (token.type !== 'army') continue;
        const exact = token.pieceId && training.find(choice => choice.pieceId === token.pieceId);
        if (exact) { byToken.set(token.id, exact); continue; }
        if (token.pieceId) continue;
        // 无独立兵种栈的普通部队仍有各自地图兵牌；按同一位置的可见兵牌顺序对应泛化实体。
        const location = token.location === 'city' ? 'generic-city' : 'generic-field';
        const tokens = core.mapTokens.filter(item => item.type === 'army' && !item.pieceId && item.regionId === token.regionId && item.location === token.location);
        const candidates = training.filter(choice => choice.regionId === token.regionId && choice.location === location);
        const choice = candidates[tokens.findIndex(item => item.id === token.id)];
        if (choice) byToken.set(token.id, choice);
    }
    return {
        targeting: recruits.length > 0 || training.length > 0,
        regionIds: [...new Set((recruits.length ? recruits : training).flatMap(choice => choice.regionId ? [choice.regionId] : []))],
        pieceIds: training.flatMap(choice => choice.pieceId ? [choice.pieceId] : []),
        tokenIds: [...byToken.keys()],
        levelsByToken: new Map([...byToken].flatMap(([id, choice]) => choice.level == null ? [] : [[id, choice.level] as const])),
        choiceFor(regionId: string, tokenId?: string) {
            return tokenId && byToken.has(tokenId) ? byToken.get(tokenId) : recruits.find(choice => choice.regionId === regionId);
        },
    };
}
