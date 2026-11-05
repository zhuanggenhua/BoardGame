import type {CardPreviewRef} from '../../../core';
export const SEAL_ATLAS = 'fate-command-seals';
const SEAL_FRAMES: Record<string,number> = {m_shinji:7,m_shirou_emiya:8,m_iliya:2,m_sakura:6,m_kirei:3,m_kiritsugu:4,m_rin:5};
const INDIVIDUAL_SEALS = new Set(['m_kariya','m_ryuunosuke','m_tokiomi','m_waver','m_kayneth']);
export function fateCommandSealPreview(masterId:string): CardPreviewRef | null {
 if (masterId in SEAL_FRAMES) return {type:'atlas',atlasId:SEAL_ATLAS,index:SEAL_FRAMES[masterId]};
 if (INDIVIDUAL_SEALS.has(masterId)) return {type:'image',src:`fate-domination/seals/command-seal-${masterId}`};
 return null;
}
const TOKEN_ALIASES: Record<string,string> = {
 m_shirou_emiya:'token-emiya-shirou',m_shinji:'token-matou-shinji',m_kirei:'token-kotomine-kirei',m_rin:'token-tohsaka-rin',
};
export function fateTokenAsset(masterId:string) {
 return `fate-domination/tokens/${TOKEN_ALIASES[masterId] ?? masterId}`;
}
