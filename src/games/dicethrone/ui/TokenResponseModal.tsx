import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import type { PendingDamage, HeroState, TokenResponsePhase } from '../domain/types';
import type { TokenDef } from '../../../systems/TokenSystem';

interface TokenResponseModalProps {
    /** 待处理的伤害 */
    pendingDamage: PendingDamage;
    /** 当前响应阶段 */
    responsePhase: TokenResponsePhase;
    /** 响应玩家状态 */
    responderState: HeroState;
    /** Token 定义列表（动态驱动 UI） */
    tokenDefinitions: TokenDef[];
    /** 使用 Token（通用接口） */
    onUseToken: (tokenId: string, amount: number) => void;
    /** 跳过响应 */
    onSkip: () => void;
    /** 语言 */
    locale?: string;
    /** 最近一次闪避投骰结果（用于展示） */
    lastEvasionRoll?: { value: number; success: boolean };
}

/**
 * Token 响应弹窗
 * - 攻击阶段：攻击方可消耗太极增加伤害
 * - 防御阶段：防御方可消耗太极减少伤害，或消耗闪避尝试完全躲避
 */
export const TokenResponseModal: React.FC<TokenResponseModalProps> = ({
    pendingDamage,
    responsePhase,
    responderState,
    tokenDefinitions,
    onUseToken,
    onSkip,
    locale: _locale,
    lastEvasionRoll,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [boostAmount, setBoostAmount] = React.useState(1);

    // 从定义中动态获取可用 Token（根据 usableTiming）
    const boostToken = tokenDefinitions.find(def => 
        def.usableTiming?.includes('beforeDamageDealt') && def.usableTiming?.includes('beforeDamageReceived')
    );
    const evasiveToken = tokenDefinitions.find(def => 
        def.useEffect?.type === 'rollToNegate'
    );

    const boostCount = boostToken ? (responderState.tokens[boostToken.id] ?? 0) : 0;
    const evasiveCount = evasiveToken ? (responderState.tokens[evasiveToken.id] ?? 0) : 0;

    const isAttackerPhase = responsePhase === 'attackerBoost';
    const isDefenderPhase = responsePhase === 'defenderMitigation';

    // 攻击方只能用增益 Token 加伤
    const canUseBoost = boostToken && boostCount > 0;
    // 防御方可用增益 Token 减伤或闪避
    const canUseEvasive = isDefenderPhase && evasiveToken && evasiveCount > 0 && !pendingDamage.isFullyEvaded;

    // 最大增益使用量：攻击方无上限，防御方最多减到0伤害
    const maxBoostAmount = isAttackerPhase 
        ? boostCount 
        : Math.min(boostCount, pendingDamage.currentDamage);

    // 预览伤害
    const previewDamage = isAttackerPhase
        ? pendingDamage.currentDamage + boostAmount
        : Math.max(0, pendingDamage.currentDamage - boostAmount);

    const handleBoostChange = (delta: number) => {
        setBoostAmount(prev => Math.max(1, Math.min(maxBoostAmount, prev + delta)));
    };

    const handleUseBoost = () => {
        if (boostToken) {
            onUseToken(boostToken.id, boostAmount);
        }
        setBoostAmount(1); // 重置选择
    };

    return (
        <ModalBase
            closeOnBackdrop={false}
            overlayClassName="z-[1100] bg-black/70"
            containerClassName="z-[1101]"
        >
            <div className="bg-slate-900/95 border border-amber-500/40 backdrop-blur-xl p-[2vw] rounded-[1.6vw] shadow-2xl w-[36vw] flex flex-col gap-[1.5vw] pointer-events-auto">
                {/* 标题 */}
                <div className="text-center">
                    <h3 className="text-[1.3vw] font-black text-white mb-[0.5vw]">
                        {isAttackerPhase 
                            ? t('tokenResponse.attackerTitle') 
                            : t('tokenResponse.defenderTitle')}
                    </h3>
                    <p className="text-[0.9vw] text-slate-400">
                        {isAttackerPhase
                            ? t('tokenResponse.attackerDesc')
                            : t('tokenResponse.defenderDesc')}
                    </p>
                </div>

                {/* 伤害信息 */}
                <div className="flex justify-center items-center gap-[2vw] py-[1vw] bg-slate-800/50 rounded-xl">
                    <div className="text-center">
                        <div className="text-[0.7vw] text-slate-500 uppercase tracking-wider mb-[0.2vw]">
                            {t('tokenResponse.originalDamage')}
                        </div>
                        <div className="text-[1.6vw] font-black text-slate-400">
                            {pendingDamage.originalDamage}
                        </div>
                    </div>
                    <div className="text-[1.5vw] text-slate-600">→</div>
                    <div className="text-center">
                        <div className="text-[0.7vw] text-slate-500 uppercase tracking-wider mb-[0.2vw]">
                            {t('tokenResponse.currentDamage')}
                        </div>
                        <div className={`text-[1.6vw] font-black ${
                            pendingDamage.isFullyEvaded 
                                ? 'text-green-400' 
                                : pendingDamage.currentDamage < pendingDamage.originalDamage 
                                    ? 'text-blue-400' 
                                    : pendingDamage.currentDamage > pendingDamage.originalDamage
                                        ? 'text-red-400'
                                        : 'text-white'
                        }`}>
                            {pendingDamage.isFullyEvaded ? t('tokenResponse.evaded') : pendingDamage.currentDamage}
                        </div>
                    </div>
                </div>

                {/* 闪避结果展示 */}
                {lastEvasionRoll && (
                    <div className={`text-center py-[0.8vw] rounded-lg ${
                        lastEvasionRoll.success 
                            ? 'bg-green-900/50 border border-green-500/40' 
                            : 'bg-red-900/50 border border-red-500/40'
                    }`}>
                        <span className="text-[1vw] font-bold">
                            {t('tokenResponse.evasionRoll')}: 🎲 {lastEvasionRoll.value}
                            {' - '}
                            {lastEvasionRoll.success 
                                ? <span className="text-green-400">{t('tokenResponse.evasionSuccess')}</span>
                                : <span className="text-red-400">{t('tokenResponse.evasionFailed')}</span>
                            }
                        </span>
                    </div>
                )}

                {/* Token 使用区域 */}
                <div className="flex flex-col gap-[1vw]">
                    {/* 增益 Token（伤害加成/减免） */}
                    {canUseBoost && boostToken && maxBoostAmount > 0 && (
                        <div className="bg-slate-800/80 rounded-xl p-[1vw] border border-purple-500/30">
                            <div className="flex items-center justify-between mb-[0.8vw]">
                                <div className="flex items-center gap-[0.5vw]">
                                    <span className="text-[1.3vw]">{boostToken.icon}</span>
                                    <span className="text-[0.9vw] font-bold text-white">
                                        {t(`tokens.${boostToken.id}.name`)}
                                    </span>
                                    <span className="text-[0.75vw] text-slate-400">
                                        ({boostCount} {t('tokenResponse.available')})
                                    </span>
                                </div>
                                <div className="text-[0.75vw] text-slate-400">
                                    {isAttackerPhase 
                                        ? t('tokenResponse.taijiBoostHint')
                                        : t('tokenResponse.taijiReduceHint')}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-[0.8vw]">
                                    <button
                                        onClick={() => handleBoostChange(-1)}
                                        disabled={boostAmount <= 1}
                                        className="w-[2vw] h-[2vw] rounded-lg bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-[1vw] transition-colors"
                                    >
                                        -
                                    </button>
                                    <span className="text-[1.2vw] font-black text-white w-[2vw] text-center">
                                        {boostAmount}
                                    </span>
                                    <button
                                        onClick={() => handleBoostChange(1)}
                                        disabled={boostAmount >= maxBoostAmount}
                                        className="w-[2vw] h-[2vw] rounded-lg bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-[1vw] transition-colors"
                                    >
                                        +
                                    </button>
                                    <span className="text-[0.75vw] text-slate-500 ml-[0.5vw]">
                                        → {isAttackerPhase ? '+' : '-'}{boostAmount} {t('tokenResponse.damage')}
                                        {' = '}
                                        <span className={isAttackerPhase ? 'text-red-400' : 'text-blue-400'}>
                                            {previewDamage}
                                        </span>
                                    </span>
                                </div>
                                <button
                                    onClick={handleUseBoost}
                                    className="px-[1.2vw] py-[0.5vw] rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[0.85vw] transition-all shadow-lg"
                                >
                                    {t('tokenResponse.useTaiji')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 闪避 Token */}
                    {canUseEvasive && evasiveToken && (
                        <div className="bg-slate-800/80 rounded-xl p-[1vw] border border-cyan-500/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-[0.5vw]">
                                    <span className="text-[1.3vw]">{evasiveToken.icon}</span>
                                    <span className="text-[0.9vw] font-bold text-white">
                                        {t(`tokens.${evasiveToken.id}.name`)}
                                    </span>
                                    <span className="text-[0.75vw] text-slate-400">
                                        ({evasiveCount} {t('tokenResponse.available')})
                                    </span>
                                </div>
                                <div className="text-[0.75vw] text-slate-400">
                                    {t('tokenResponse.evasiveHint')}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-[0.8vw]">
                                <span className="text-[0.75vw] text-cyan-300">
                                    {t('tokenResponse.evasiveDesc')}
                                </span>
                                <button
                                    onClick={() => onUseToken(evasiveToken.id, 1)}
                                    className="px-[1.2vw] py-[0.5vw] rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[0.85vw] transition-all shadow-lg"
                                >
                                    {t('tokenResponse.useEvasive')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 无可用 Token 提示 */}
                    {!canUseBoost && !canUseEvasive && (
                        <div className="text-center py-[1vw] text-slate-500 text-[0.9vw]">
                            {t('tokenResponse.noTokens')}
                        </div>
                    )}
                </div>

                {/* 跳过按钮 */}
                <button
                    onClick={onSkip}
                    className="w-full py-[0.8vw] rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-[0.9vw] transition-colors border border-slate-600"
                >
                    {pendingDamage.isFullyEvaded 
                        ? t('tokenResponse.confirm')
                        : t('tokenResponse.skip')}
                </button>
            </div>
        </ModalBase>
    );
};
