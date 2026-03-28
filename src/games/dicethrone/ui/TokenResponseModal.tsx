import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';
import type { PendingDamage, HeroState, TokenResponsePhase } from '../domain/types';
import { getTokenEffectValue, getTokenUseOptions, type TokenDef } from '../domain/tokenTypes';
import { type StatusAtlases, TOKEN_META, getStatusEffectIconNode } from './statusEffects';
import { TOKEN_IDS } from '../domain/ids';

interface TokenResponseModalProps {
    pendingDamage: PendingDamage;
    responsePhase: TokenResponsePhase;
    responderState: HeroState;
    usableTokens: TokenDef[];
    onUseToken: (tokenId: string, amount: number) => void;
    onSkip: () => void;
    locale?: string;
    lastEvasionRoll?: { value: number; success: boolean };
    statusIconAtlas?: StatusAtlases | null;
    tokenUsableOverrides?: Record<string, number>;
}

function getTokenCategory(
    tokenDef: TokenDef,
    responsePhase?: TokenResponsePhase,
): 'boost' | 'reduce' | 'reflect' | 'undefendable' | 'evasive' | 'unknown' {
    const effectType = tokenDef.activeUse?.effect.type;

    if (effectType === 'rollToNegate') return 'evasive';

    if (tokenDef.id === TOKEN_IDS.RETRIBUTION) return 'reflect';
    if (tokenDef.id === TOKEN_IDS.ACCURACY) return 'undefendable';
    if (tokenDef.id === TOKEN_IDS.PROTECT) return 'reduce';
    if (tokenDef.id === TOKEN_IDS.CRIT) return 'boost';

    if (effectType === 'modifyDamageDealt') return 'boost';
    if (effectType === 'modifyDamageReceived') {
        const timings = tokenDef.activeUse?.timing ?? [];
        if (responsePhase === 'attackerBoost' && timings.includes('beforeDamageDealt')) {
            return 'boost';
        }
        return 'reduce';
    }

    return 'unknown';
}

function getTokenEffectPreview(
    tokenDef: TokenDef,
    currentDamage: number,
    amount = 1,
    responsePhase?: TokenResponsePhase,
): { damageChange: number; description: string; canUse: boolean } {
    const category = getTokenCategory(tokenDef, responsePhase);

    switch (category) {
        case 'boost': {
            if (tokenDef.id === TOKEN_IDS.CRIT) {
                const canUse = currentDamage >= 5;
                return {
                    damageChange: canUse ? 4 : 0,
                    description: canUse ? '+4 伤害' : '需要伤害 >= 5',
                    canUse,
                };
            }

            const totalModifier = Math.abs(getTokenEffectValue(tokenDef.activeUse?.effect, amount, 1));
            return {
                damageChange: totalModifier,
                description: `+${totalModifier} 伤害`,
                canUse: true,
            };
        }

        case 'reduce': {
            if (tokenDef.id === TOKEN_IDS.PROTECT) {
                const reduction = Math.ceil(currentDamage / 2);
                return {
                    damageChange: -reduction,
                    description: `伤害减半 (-${reduction})`,
                    canUse: true,
                };
            }

            const totalModifier = getTokenEffectValue(tokenDef.activeUse?.effect, amount, -1);
            return {
                damageChange: totalModifier,
                description: `${totalModifier} 伤害`,
                canUse: true,
            };
        }

        case 'reflect': {
            const reflectAmount = Math.ceil(currentDamage / 2);
            return {
                damageChange: 0,
                description: `反弹 ${reflectAmount} 伤害给对手`,
                canUse: true,
            };
        }

        case 'undefendable':
            return {
                damageChange: 0,
                description: '使攻击不可防御',
                canUse: true,
            };

        case 'evasive':
            return {
                damageChange: 0,
                description: '掷骰 1-2 完全闪避',
                canUse: true,
            };

        default:
            return {
                damageChange: 0,
                description: '未知效果',
                canUse: false,
            };
    }
}

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
    tokenUsableOverrides,
}) => {
    const { t } = useTranslation('game-dicethrone');

    const isAttackerPhase = responsePhase === 'attackerBoost';
    const isDefenderPhase = responsePhase === 'defenderMitigation';

    const boostTokens = usableTokens.filter(def => {
        const category = getTokenCategory(def, responsePhase);
        return category === 'boost' || category === 'undefendable';
    });
    const defenseTokens = usableTokens.filter(def => {
        const category = getTokenCategory(def, responsePhase);
        return category === 'reduce' || category === 'reflect';
    });
    const evasiveTokens = usableTokens.filter(def => getTokenCategory(def, responsePhase) === 'evasive');

    const hasAnyAction = usableTokens.length > 0 && !pendingDamage.isFullyEvaded;
    const hadAnyActionRef = React.useRef(hasAnyAction);

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

    const renderTokenIcon = (tokenId: string) => {
        const meta = TOKEN_META[tokenId];
        if (meta && statusIconAtlas) {
            return (
                <div className="w-8 h-8 flex-shrink-0">
                    {getStatusEffectIconNode(meta, locale, 'normal', statusIconAtlas)}
                </div>
            );
        }
        return null;
    };

    const renderTokenCard = (tokenDef: TokenDef, borderColor: string) => {
        const actualTokenCount = tokenUsableOverrides?.[tokenDef.id] ?? (responderState.tokens[tokenDef.id] ?? 0);
        if (actualTokenCount <= 0) return null;

        const useOptions = getTokenUseOptions(tokenDef, actualTokenCount);
        if (useOptions.length <= 0) return null;

        const useAmount = useOptions[0] ?? 1;
        const preview = getTokenEffectPreview(tokenDef, pendingDamage.currentDamage, useAmount, responsePhase);
        const category = getTokenCategory(tokenDef, responsePhase);
        const isDisabled = !preview.canUse;

        return (
            <div
                key={tokenDef.id}
                className={clsx(
                    'bg-slate-800/40 rounded-xl p-4 border',
                    borderColor,
                    isDisabled && 'opacity-50',
                )}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {renderTokenIcon(tokenDef.id)}
                        <span className="font-bold text-white">
                            {t(`tokens.${tokenDef.id}.name`)}
                        </span>
                        <span className="text-xs text-slate-400">
                            ({actualTokenCount} {t('tokenResponse.available')})
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <span
                            className={clsx(
                                'text-sm',
                                category === 'boost' && 'text-red-300',
                                category === 'reduce' && 'text-blue-300',
                                category === 'reflect' && 'text-purple-300',
                                category === 'undefendable' && 'text-amber-300',
                                category === 'evasive' && 'text-cyan-300',
                                isDisabled && 'text-slate-500',
                            )}
                        >
                            {preview.description}
                        </span>
                        {tokenDef.id === TOKEN_IDS.CRIT && !preview.canUse && (
                            <div className="text-xs text-red-400 mt-1">
                                当前伤害 {pendingDamage.currentDamage}，需要 &gt;= 5
                            </div>
                        )}
                    </div>
                    <GameButton
                        size="sm"
                        variant={category === 'evasive' ? 'glass' : 'primary'}
                        onClick={() => onUseToken(tokenDef.id, useAmount)}
                        disabled={isDisabled}
                        className={clsx(
                            'ml-4',
                            category === 'evasive' && 'border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-100',
                        )}
                    >
                        {useAmount > 1 ? `${t('tokenResponse.useToken')} x${useAmount}` : t('tokenResponse.useToken')}
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
                <p className="text-sm sm:text-base text-slate-400 text-center">
                    {isAttackerPhase ? t('tokenResponse.attackerDesc') : t('tokenResponse.defenderDesc')}
                </p>

                <div className="flex justify-center items-center gap-8 py-4 bg-slate-950/40 rounded-xl border border-white/5">
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            {t('tokenResponse.originalDamage')}
                        </div>
                        <div className="text-3xl font-black text-slate-400">
                            {pendingDamage.originalDamage}
                        </div>
                    </div>
                    <div className="text-2xl text-slate-600">-&gt;</div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            {t('tokenResponse.currentDamage')}
                        </div>
                        <div
                            className={clsx('text-3xl font-black', {
                                'text-green-400': pendingDamage.isFullyEvaded,
                                'text-blue-400':
                                    !pendingDamage.isFullyEvaded && pendingDamage.currentDamage < pendingDamage.originalDamage,
                                'text-red-400':
                                    !pendingDamage.isFullyEvaded && pendingDamage.currentDamage > pendingDamage.originalDamage,
                                'text-white':
                                    !pendingDamage.isFullyEvaded && pendingDamage.currentDamage === pendingDamage.originalDamage,
                            })}
                        >
                            {pendingDamage.isFullyEvaded ? t('tokenResponse.evaded') : pendingDamage.currentDamage}
                        </div>
                    </div>
                </div>

                {lastEvasionRoll && (
                    <div
                        className={clsx(
                            'text-center py-2 rounded-lg border',
                            lastEvasionRoll.success
                                ? 'bg-green-900/30 border-green-500/30'
                                : 'bg-red-900/30 border-red-500/30',
                        )}
                    >
                        <span className="font-bold">
                            {t('tokenResponse.evasionRoll')}: {lastEvasionRoll.value}
                            {' - '}
                            {lastEvasionRoll.success ? (
                                <span className="text-green-400">{t('tokenResponse.evasionSuccess')}</span>
                            ) : (
                                <span className="text-red-400">{t('tokenResponse.evasionFailed')}</span>
                            )}
                        </span>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {isAttackerPhase && boostTokens.map(tokenDef => renderTokenCard(tokenDef, 'border-red-500/20'))}

                    {isDefenderPhase &&
                        defenseTokens.map(tokenDef =>
                            renderTokenCard(
                                tokenDef,
                                getTokenCategory(tokenDef, responsePhase) === 'reflect'
                                    ? 'border-purple-500/20'
                                    : 'border-blue-500/20',
                            ),
                        )}

                    {isDefenderPhase &&
                        !pendingDamage.isFullyEvaded &&
                        evasiveTokens.map(tokenDef => renderTokenCard(tokenDef, 'border-cyan-500/20'))}

                    {!hasAnyAction && (
                        <div className="text-center py-4 text-slate-500 font-medium">
                            {t('tokenResponse.noTokens')}
                        </div>
                    )}
                </div>

                <GameButton
                    onClick={onSkip}
                    variant="secondary"
                    fullWidth
                    className="mt-2"
                >
                    {pendingDamage.isFullyEvaded ? t('tokenResponse.confirm') : t('tokenResponse.skip')}
                </GameButton>
            </div>
        </GameModal>
    );
};
