import React from 'react';
import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';
import type { PendingDamage, HeroState, TokenResponsePhase } from '../domain/types';
import type { TokenDef } from '../domain/tokenTypes';
import clsx from 'clsx';
import { type StatusAtlases, TOKEN_META, getStatusEffectIconNode } from './statusEffects';
import { TOKEN_IDS } from '../domain/ids';

interface TokenResponseModalProps {
    /** 待处理的伤害 */
    pendingDamage: PendingDamage;
    /** 当前响应阶段 */
    responsePhase: TokenResponsePhase;
    /** 响应玩家状态 */
    responderState: HeroState;
    /** 当前阶段可用的 Token 列表（由领域层过滤，UI 直接渲染） */
    usableTokens: TokenDef[];
    /** 使用 Token（通用接口） */
    onUseToken: (tokenId: string, amount: number) => void;
    /** 跳过响应 */
    onSkip: () => void;
    /** 语言 */
    locale?: string;
    /** 最近一次闪避投骰结果（用于展示） */
    lastEvasionRoll?: { value: number; success: boolean };
    /** 状态图标图集 */
    statusIconAtlas?: StatusAtlases | null;
}

/**
 * 获取 Token 的效果类型分类
 */
function getTokenCategory(tokenDef: TokenDef): 'boost' | 'reduce' | 'reflect' | 'undefendable' | 'evasive' | 'unknown' {
    const effectType = tokenDef.activeUse?.effect.type;
    
    // 闪避类
    if (effectType === 'rollToNegate') return 'evasive';
    
    // 根据 tokenId 判断特殊效果
    if (tokenDef.id === TOKEN_IDS.RETRIBUTION) return 'reflect';
    if (tokenDef.id === TOKEN_IDS.ACCURACY) return 'undefendable';
    if (tokenDef.id === TOKEN_IDS.PROTECT) return 'reduce';
    if (tokenDef.id === TOKEN_IDS.CRIT) return 'boost';
    
    // 通用判断
    if (effectType === 'modifyDamageDealt') return 'boost';
    if (effectType === 'modifyDamageReceived') return 'reduce';
    
    return 'unknown';
}

/**
 * 计算 Token 使用后的效果预览
 */
function getTokenEffectPreview(
    tokenDef: TokenDef,
    currentDamage: number,
    amount: number = 1
): { damageChange: number; description: string; canUse: boolean } {
    const category = getTokenCategory(tokenDef);
    
    switch (category) {
        case 'boost': {
            // 暴击：+4 伤害，需要当前伤害≥5
            if (tokenDef.id === TOKEN_IDS.CRIT) {
                const canUse = currentDamage >= 5;
                return {
                    damageChange: canUse ? 4 : 0,
                    description: canUse ? '+4 伤害' : '需要伤害≥5',
                    canUse,
                };
            }
            // 太极等通用加伤
            const value = tokenDef.activeUse?.effect.value ?? 1;
            return {
                damageChange: Math.abs(value) * amount,
                description: `+${Math.abs(value) * amount} 伤害`,
                canUse: true,
            };
        }
        
        case 'reduce': {
            // 守护：伤害减半（向上取整）
            if (tokenDef.id === TOKEN_IDS.PROTECT) {
                const reduction = Math.ceil(currentDamage / 2);
                return {
                    damageChange: -reduction,
                    description: `伤害减半 (-${reduction})`,
                    canUse: true,
                };
            }
            // 太极等通用减伤
            const value = tokenDef.activeUse?.effect.value ?? -1;
            return {
                damageChange: value * amount,
                description: `${value * amount} 伤害`,
                canUse: true,
            };
        }
        
        case 'reflect': {
            // 神罚：反弹伤害的一半（向上取整），不减少自己受到的伤害
            const reflectAmount = Math.ceil(currentDamage / 2);
            return {
                damageChange: 0, // 不减伤
                description: `反弹 ${reflectAmount} 伤害给对手`,
                canUse: true,
            };
        }
        
        case 'undefendable': {
            // 精准：使攻击不可防御
            return {
                damageChange: 0,
                description: '使攻击不可防御',
                canUse: true,
            };
        }
        
        case 'evasive': {
            return {
                damageChange: 0,
                description: '掷骰 1-2 完全闪避',
                canUse: true,
            };
        }
        
        default:
            return {
                damageChange: 0,
                description: '未知效果',
                canUse: false,
            };
    }
}

/**
 * Token 响应弹窗
 * - 攻击阶段：攻击方可消耗 Token 增加伤害或使攻击不可防御
 * - 防御阶段：防御方可消耗 Token 减少伤害、反弹伤害或尝试闪避
 *
 * usableTokens 由领域层 getUsableTokensForTiming 提供，UI 不再自行过滤
 */
export const TokenResponseModal: React.FC<TokenResponseModalProps> = ({
    pendingDamage,
    responsePhase,
    responderState,
    usableTokens,
    onUseToken,
    onSkip,
    locale,
    lastEvasionRoll,
    statusIconAtlas,
}) => {
    const { t } = useTranslation('game-dicethrone');

    const isAttackerPhase = responsePhase === 'attackerBoost';
    const isDefenderPhase = responsePhase === 'defenderMitigation';

    // 按效果类型分组 token
    const boostTokens = usableTokens.filter(def => {
        const cat = getTokenCategory(def);
        return cat === 'boost' || cat === 'undefendable';
    });
    const defenseTokens = usableTokens.filter(def => {
        const cat = getTokenCategory(def);
        return cat === 'reduce' || cat === 'reflect';
    });
    const evasiveTokens = usableTokens.filter(def => getTokenCategory(def) === 'evasive');

    // 检查是否有任何可用操作
    const hasAnyAction = usableTokens.length > 0 && !pendingDamage.isFullyEvaded;
    const hadAnyActionRef = React.useRef<boolean>(hasAnyAction);

    React.useEffect(() => {
        const hadAnyAction = hadAnyActionRef.current;
        if (hadAnyAction && !hasAnyAction) {
            const timer = setTimeout(() => onSkip(), 150);
            return () => clearTimeout(timer);
        }
        hadAnyActionRef.current = hasAnyAction;
        return;
    }, [hasAnyAction, onSkip, pendingDamage.id, responsePhase]);

    const isOpen = Boolean(pendingDamage && responsePhase);

    // 辅助函数：渲染 Token 图标
    const renderTokenIcon = (tokenId: string) => {
        const meta = TOKEN_META[tokenId];
        if (meta && statusIconAtlas) {
            return (
                <div className="w-8 h-8 flex-shrink-0">
                    {getStatusEffectIconNode(meta, locale, 'normal', statusIconAtlas)}
                </div>
            );
        }
        // 无精灵图时不显示图标
        return null;
    };

    // 渲染单个 Token 卡片
    const renderTokenCard = (tokenDef: TokenDef, borderColor: string) => {
        const tokenCount = responderState.tokens[tokenDef.id] ?? 0;
        if (tokenCount <= 0) return null;

        const preview = getTokenEffectPreview(tokenDef, pendingDamage.currentDamage);
        const category = getTokenCategory(tokenDef);
        
        // 暴击需要伤害≥5才能使用
        const isDisabled = !preview.canUse;

        return (
            <div 
                key={tokenDef.id}
                className={clsx(
                    "bg-slate-800/40 rounded-xl p-4 border",
                    borderColor,
                    isDisabled && "opacity-50"
                )}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {renderTokenIcon(tokenDef.id)}
                        <span className="font-bold text-white">
                            {t(`tokens.${tokenDef.id}.name`)}
                        </span>
                        <span className="text-xs text-slate-400">
                            ({tokenCount} {t('tokenResponse.available')})
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <span className={clsx(
                            "text-sm",
                            category === 'boost' && "text-red-300",
                            category === 'reduce' && "text-blue-300",
                            category === 'reflect' && "text-purple-300",
                            category === 'undefendable' && "text-amber-300",
                            category === 'evasive' && "text-cyan-300",
                            isDisabled && "text-slate-500"
                        )}>
                            {preview.description}
                        </span>
                        {/* 暴击门控条件提示 */}
                        {tokenDef.id === TOKEN_IDS.CRIT && !preview.canUse && (
                            <div className="text-xs text-red-400 mt-1">
                                当前伤害 {pendingDamage.currentDamage}，需要 ≥5
                            </div>
                        )}
                    </div>
                    <GameButton
                        size="sm"
                        variant={category === 'evasive' ? 'glass' : 'primary'}
                        onClick={() => onUseToken(tokenDef.id, 1)}
                        disabled={isDisabled}
                        className={clsx(
                            "ml-4",
                            category === 'evasive' && "border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-100"
                        )}
                    >
                        {t('tokenResponse.useToken')}
                    </GameButton>
                </div>
            </div>
        );
    };

    return (
        <GameModal
            isOpen={isOpen}
            title={isAttackerPhase ? t('tokenResponse.attackerTitle') : t('tokenResponse.defenderTitle')}
            width="lg"
            closeOnBackdrop={false}
        >
            <div className="flex flex-col gap-6 w-full">
                {/* 描述 */}
                <p className="text-sm sm:text-base text-slate-400 text-center">
                    {isAttackerPhase
                        ? t('tokenResponse.attackerDesc')
                        : t('tokenResponse.defenderDesc')}
                </p>

                {/* 伤害信息 (Damage Preview) */}
                <div className="flex justify-center items-center gap-8 py-4 bg-slate-950/40 rounded-xl border border-white/5">
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            {t('tokenResponse.originalDamage')}
                        </div>
                        <div className="text-3xl font-black text-slate-400">
                            {pendingDamage.originalDamage}
                        </div>
                    </div>
                    <div className="text-2xl text-slate-600">→</div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            {t('tokenResponse.currentDamage')}
                        </div>
                        <div className={clsx("text-3xl font-black", {
                            'text-green-400': pendingDamage.isFullyEvaded,
                            'text-blue-400': !pendingDamage.isFullyEvaded && pendingDamage.currentDamage < pendingDamage.originalDamage,
                            'text-red-400': !pendingDamage.isFullyEvaded && pendingDamage.currentDamage > pendingDamage.originalDamage,
                            'text-white': !pendingDamage.isFullyEvaded && pendingDamage.currentDamage === pendingDamage.originalDamage,
                        })}>
                            {pendingDamage.isFullyEvaded ? t('tokenResponse.evaded') : pendingDamage.currentDamage}
                        </div>
                    </div>
                </div>

                {/* 闪避结果展示 */}
                {lastEvasionRoll && (
                    <div className={clsx("text-center py-2 rounded-lg border",
                        lastEvasionRoll.success
                            ? 'bg-green-900/30 border-green-500/30'
                            : 'bg-red-900/30 border-red-500/30'
                    )}>
                        <span className="font-bold">
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
                <div className="flex flex-col gap-3">
                    {/* 攻击方：加伤/不可防御 Token */}
                    {isAttackerPhase && boostTokens.map(tokenDef => 
                        renderTokenCard(tokenDef, "border-red-500/20")
                    )}

                    {/* 防御方：减伤/反弹 Token */}
                    {isDefenderPhase && defenseTokens.map(tokenDef => 
                        renderTokenCard(tokenDef, 
                            getTokenCategory(tokenDef) === 'reflect' 
                                ? "border-purple-500/20" 
                                : "border-blue-500/20"
                        )
                    )}

                    {/* 防御方：闪避 Token */}
                    {isDefenderPhase && !pendingDamage.isFullyEvaded && evasiveTokens.map(tokenDef => 
                        renderTokenCard(tokenDef, "border-cyan-500/20")
                    )}

                    {/* 无可用 Token 提示 */}
                    {!hasAnyAction && (
                        <div className="text-center py-4 text-slate-500 font-medium">
                            {t('tokenResponse.noTokens')}
                        </div>
                    )}
                </div>

                {/* 跳过按钮 */}
                <GameButton
                    onClick={onSkip}
                    variant="secondary"
                    fullWidth
                    className="mt-2"
                >
                    {pendingDamage.isFullyEvaded
                        ? t('tokenResponse.confirm')
                        : t('tokenResponse.skip')}
                </GameButton>
            </div>
        </GameModal>
    );
};
