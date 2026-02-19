import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';
import { TOKEN_META, getStatusEffectIconNode } from './statusEffects';
import type { StatusAtlases } from './statusEffects';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { UI_Z_INDEX } from '../../../core';
import { resolveI18nList } from './utils';

interface ChoiceOption {
    id: string;
    label: string;
    statusId?: string;
    tokenId?: string;
    customId?: string;
    value?: number;
}

/** slider 配置（从领域层透传） */
interface SliderConfig {
    /** 确认按钮文案 i18n key，支持 {{count}} 插值 */
    confirmLabelKey: string;
    /** 滑动条下方提示文案 i18n key，支持 {{value}} 插值 */
    hintKey?: string;
    /** 跳过按钮文案 i18n key（可选，默认用 skip option 的 labelKey） */
    skipLabelKey?: string;
}

interface ChoiceData {
    title: string;
    options: ChoiceOption[];
    /**
     * slider 模式配置。存在时渲染滑动条而非按钮列表。
     * 约定：options[0] = 确认选项（value=max），options[last] = 跳过选项（value=0）
     */
    slider?: SliderConfig;
}

export const ChoiceModal = ({
    choice,
    canResolve,
    onResolve,
    onResolveWithValue,
    locale,
    statusIconAtlas,
}: {
    choice: ChoiceData | null | undefined;
    canResolve: boolean;
    /** 按钮模式：选择 optionId */
    onResolve: (optionId: string) => void;
    /** slider 模式：选择 optionId + 自定义 mergedValue */
    onResolveWithValue?: (optionId: string, mergedValue: unknown) => void;
    locale?: string;
    statusIconAtlas?: StatusAtlases | null;
}) => {
    const { t } = useTranslation('game-dicethrone');
    // 防御性检查：如果 choice 存在但 options 为空，不显示模态框
    const hasValidOptions = choice && choice.options && choice.options.length > 0;
    const isOpen = !!hasValidOptions;
    const isSlider = !!choice?.slider;

    // slider 约定：第一个 option = 确认（value=max），最后一个 = 跳过（value=0）
    const confirmOption = isSlider ? choice!.options[0] : undefined;
    const skipOption = isSlider && choice!.options.length > 1 ? choice!.options[choice!.options.length - 1] : undefined;
    const maxValue = confirmOption?.value ?? 1;

    const resolveOptionLabel = (label: string) => {
        if (label.startsWith('choices.option-')) {
            const index = Number(label.replace('choices.option-', ''));
            if (!Number.isNaN(index)) {
                return t('choices.option', { index: index + 1 });
            }
        }
        return t(label);
    };

    const handleSliderConfirm = (selectedValue: number) => {
        if (!confirmOption || !onResolveWithValue) return;
        const mergedValue = {
            value: selectedValue,
            customId: confirmOption.customId,
            tokenId: confirmOption.tokenId,
        };
        onResolveWithValue(confirmOption.id, mergedValue);
    };

    const handleSliderSkip = () => {
        if (skipOption) {
            onResolve(skipOption.id);
        }
    };

    const skipLabel = choice?.slider?.skipLabelKey
        ? t(choice.slider.skipLabelKey)
        : skipOption ? resolveOptionLabel(skipOption.label) : '';

    return (
        <GameModal
            isOpen={isOpen}
            title={t('choices.title')}
            width="md"
            closeOnBackdrop={false}
        >
            <div className="flex flex-col gap-6 w-full items-center">
                {choice && (
                    <p className="text-lg text-slate-200 font-medium">
                        {t(choice.title)}
                    </p>
                )}

                {isSlider && confirmOption ? (
                    maxValue === 1 ? (
                        <div className="flex gap-4">
                            <GameButton
                                onClick={() => handleSliderConfirm(1)}
                                disabled={!canResolve}
                                variant="primary"
                                className="min-w-[140px]"
                            >
                                {t(choice!.slider!.confirmLabelKey, { count: 1 })}
                            </GameButton>
                            {skipOption && (
                                <GameButton
                                    onClick={handleSliderSkip}
                                    disabled={!canResolve}
                                    variant="secondary"
                                    className="min-w-[100px]"
                                >
                                    {skipLabel}
                                </GameButton>
                            )}
                        </div>
                    ) : (
                        <SliderChoice
                            key={choice?.title}
                            min={1}
                            max={maxValue}
                            canResolve={canResolve}
                            onConfirm={handleSliderConfirm}
                            onSkip={skipOption ? handleSliderSkip : undefined}
                            confirmLabelKey={choice!.slider!.confirmLabelKey}
                            hintKey={choice!.slider!.hintKey}
                            skipLabel={skipLabel}
                            confirmOption={confirmOption}
                            locale={locale}
                            statusIconAtlas={statusIconAtlas}
                            t={t}
                        />
                    )
                ) : (
                    (() => {
                        // 检测是否所有选项都是 token 类型（排除 __cancel__）
                        const nonCancelOptions = choice?.options.filter(o => o.id !== '__cancel__') ?? [];
                        const isTokenChoice = nonCancelOptions.length > 0 && nonCancelOptions.every(o => o.tokenId);
                        const cancelOption = choice?.options.find(o => o.id === '__cancel__');

                        if (isTokenChoice) {
                            // Token 图标模式：渲染可点击的 token 图标 + 悬浮 tooltip
                            return (
                                <div className="flex flex-col items-center gap-4 w-full">
                                    <div className="flex gap-6 justify-center">
                                        {nonCancelOptions.map(option => (
                                            <TokenChoiceIcon
                                                key={option.id}
                                                option={option}
                                                canResolve={canResolve}
                                                onResolve={onResolve}
                                                locale={locale}
                                                statusIconAtlas={statusIconAtlas}
                                                t={t}
                                            />
                                        ))}
                                    </div>
                                    {cancelOption && (
                                        <GameButton
                                            onClick={() => onResolve(cancelOption.id)}
                                            disabled={!canResolve}
                                            variant="secondary"
                                            className="min-w-[100px]"
                                        >
                                            {resolveOptionLabel(cancelOption.label)}
                                        </GameButton>
                                    )}
                                </div>
                            );
                        }

                        // 默认按钮模式
                        return (
                            <div className="flex flex-wrap gap-4 w-full justify-center">
                                {choice?.options.map(option => {
                                    const isCancelOption = option.id === '__cancel__';
                                    return (
                                        <GameButton
                                            key={option.id}
                                            onClick={() => onResolve(option.id)}
                                            disabled={!canResolve}
                                            variant={isCancelOption ? 'secondary' : canResolve ? 'primary' : 'secondary'}
                                            className="min-w-[120px]"
                                        >
                                            {resolveOptionLabel(option.label)}
                                        </GameButton>
                                    );
                                })}
                            </div>
                        );
                    })()
                )}
            </div>
        </GameModal>
    );
};

/** 可点击的 Token 图标选项（带悬浮 tooltip） */
const TokenChoiceIcon = ({
    option,
    canResolve,
    onResolve,
    locale,
    statusIconAtlas,
    t,
}: {
    option: ChoiceOption;
    canResolve: boolean;
    onResolve: (optionId: string) => void;
    locale?: string;
    statusIconAtlas?: StatusAtlases | null;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const tokenId = option.tokenId!;
    const meta = TOKEN_META[tokenId] || { color: 'from-gray-500 to-gray-600' };

    // 检查精灵图是否存在
    let hasSprite = false;
    if (statusIconAtlas && meta.frameId) {
        if (meta.atlasId && statusIconAtlas[meta.atlasId]) {
            hasSprite = Boolean(statusIconAtlas[meta.atlasId].frames[meta.frameId]);
        } else {
            hasSprite = Object.values(statusIconAtlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }

    const name = t(`tokens.${tokenId}.name`);
    const description = resolveI18nList(
        t(`tokens.${tokenId}.description`, { returnObjects: true })
    );

    return (
        <div
            className="relative flex flex-col items-center gap-2 cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => canResolve && onResolve(option.id)}
        >
            <div
                className={`
                    w-16 h-16 rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent'
                        : `bg-gradient-to-br ${meta.color ?? 'from-gray-500 to-gray-600'} border border-white/30`}
                    transition-all duration-200
                    ${canResolve ? 'hover:scale-110 hover:ring-2 hover:ring-amber-400 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
                    shadow-lg
                `}
            >
                {getStatusEffectIconNode(meta, locale, 'choice', statusIconAtlas)}
            </div>
            <span className={`text-sm font-medium ${canResolve ? 'text-slate-200' : 'text-slate-500'}`}>
                {name}
            </span>
            <InfoTooltip
                title={name}
                content={description}
                isVisible={isHovered}
                position="bottom"
                zIndex={UI_Z_INDEX.modalTooltip}
            />
        </div>
    );
};

/** 通用 slider 选择子组件（state 内置，通过 key 重置） */
const SliderChoice = ({
    min,
    max,
    canResolve,
    onConfirm,
    onSkip,
    confirmLabelKey,
    hintKey,
    skipLabel,
    confirmOption,
    locale,
    statusIconAtlas,
    t,
}: {
    min: number;
    max: number;
    canResolve: boolean;
    onConfirm: (value: number) => void;
    onSkip?: () => void;
    confirmLabelKey: string;
    hintKey?: string;
    skipLabel?: string;
    confirmOption: ChoiceOption;
    locale?: string;
    statusIconAtlas?: StatusAtlases | null;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) => {
    const [value, setValue] = useState(1);
    const meta = (confirmOption.tokenId ? TOKEN_META[confirmOption.tokenId] : undefined)
        || { color: 'from-slate-500 to-slate-600' };
    const iconNode = getStatusEffectIconNode(meta, locale, 'choice', statusIconAtlas);

    return (
        <div className="flex flex-col gap-5 w-full items-center">
            {/* 当前选择值显示 */}
            <div className="flex items-center gap-3">
                <span className="w-8 h-8 inline-flex items-center justify-center rounded-full overflow-hidden border border-white/30 bg-black/30">
                    {iconNode}
                </span>
                <span className="text-3xl font-bold text-amber-300 tabular-nums min-w-[2ch] text-center">
                    {value}
                </span>
                <span className="text-slate-400 text-sm">/ {max}</span>
            </div>

            {/* 滑动条 */}
            <div className="w-full px-4">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    disabled={!canResolve}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer
                        bg-slate-700
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-6
                        [&::-webkit-slider-thumb]:h-6
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-amber-400
                        [&::-webkit-slider-thumb]:border-2
                        [&::-webkit-slider-thumb]:border-amber-600
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:w-6
                        [&::-moz-range-thumb]:h-6
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-amber-400
                        [&::-moz-range-thumb]:border-2
                        [&::-moz-range-thumb]:border-amber-600
                        [&::-moz-range-thumb]:cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t('choices.sliderLabel')}
                />
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>{min}</span>
                    <span>{max}</span>
                </div>
            </div>

            {/* 提示文案（由领域层配置） */}
            {hintKey && (
                <p className="text-sm text-slate-400">
                    {t(hintKey, { value })}
                </p>
            )}

            {/* 确认/跳过按钮 */}
            <div className="flex gap-4">
                <GameButton
                    onClick={() => onConfirm(value)}
                    disabled={!canResolve}
                    variant="primary"
                    className="min-w-[140px]"
                >
                    {t(confirmLabelKey, { count: value })}
                </GameButton>
                {onSkip && skipLabel && (
                    <GameButton
                        onClick={onSkip}
                        disabled={!canResolve}
                        variant="secondary"
                        className="min-w-[100px]"
                    >
                        {skipLabel}
                    </GameButton>
                )}
            </div>
        </div>
    );
};