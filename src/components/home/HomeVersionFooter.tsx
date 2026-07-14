import { useCallback, useEffect, useMemo, useState } from 'react';
import packageJson from '../../../package.json';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    readAndroidLiveUpdateActivityState,
    readAndroidLiveUpdateConfig,
    readAndroidLiveUpdateSnapshot,
    requestAndroidLiveUpdateCheck,
    subscribeAndroidLiveUpdateActivityState,
    type AndroidLiveUpdateSnapshot,
} from '../../lib/mobile/androidLiveUpdates';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';

const toShortVersionLabel = (version: string) => version.replace(/^v/i, '').split('-')[0] || version.replace(/^v/i, '');

type HomeVersionFooterTheme = 'classic' | 'book';
type HomeVersionFooterAlign = 'left' | 'right';

type HomeVersionFooterProps = {
    align?: HomeVersionFooterAlign;
    compact?: boolean;
    positionClassName?: string;
    positionMode?: 'fixed' | 'absolute';
    testId?: string;
    theme?: HomeVersionFooterTheme;
};

const FOOTER_THEME_CLASS_MAP: Record<HomeVersionFooterTheme, {
    baseText: string;
    mutedText: string;
    subduedText: string;
    disabledText: string;
    disabledIcon: string;
    idleIcon: string;
    mismatchText: string;
    mismatchSecondary: string;
    activeText: string;
    activeIcon: string;
    mismatchIcon: string;
}> = {
    classic: {
        baseText: 'text-parchment-light-text/80',
        mutedText: 'text-parchment-light-text/60',
        subduedText: 'text-parchment-light-text/55',
        disabledText: 'text-parchment-light-text/70',
        disabledIcon: 'text-parchment-light-text/30',
        idleIcon: 'text-parchment-light-text/60',
        mismatchText: 'text-red-800',
        mismatchSecondary: 'text-red-700/90',
        activeText: 'text-amber-800',
        activeIcon: 'text-amber-700',
        mismatchIcon: 'text-red-700',
    },
    book: {
        baseText: 'text-[#eadfce]/82 [text-shadow:0_1px_2px_rgba(20,12,8,0.45)]',
        mutedText: 'text-[#d8c8b4]/72',
        subduedText: 'text-[#cfbaa2]/64',
        disabledText: 'text-[#cfbaa2]/78',
        disabledIcon: 'text-[#c4b19a]/40',
        idleIcon: 'text-[#d8c8b4]/58',
        mismatchText: 'text-[#d45347]',
        mismatchSecondary: 'text-[#c76055]',
        activeText: 'text-[#f6d38f]',
        activeIcon: 'text-[#f2c36d]',
        mismatchIcon: 'text-[#d45347]',
    },
};

export function HomeVersionFooter({
    align = 'right',
    compact = false,
    positionClassName = 'right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
    positionMode = 'fixed',
    testId = 'home-version-footer',
    theme = 'classic',
}: HomeVersionFooterProps) {
    const { t } = useTranslation('lobby');
    const isNativeAndroid = isNativeAndroidRuntime();
    const otaConfig = readAndroidLiveUpdateConfig(import.meta.env);
    const otaEnabledForCurrentShell = isNativeAndroid && otaConfig.enabled;
    const [otaSnapshot, setOtaSnapshot] = useState<AndroidLiveUpdateSnapshot | null>(null);
    const [isVersionExpanded, setIsVersionExpanded] = useState(false);
    const [otaActivityState, setOtaActivityState] = useState(() => readAndroidLiveUpdateActivityState());

    const refreshOtaSnapshot = useCallback(() => {
        if (!isNativeAndroid) {
            return;
        }

        let cancelled = false;
        void readAndroidLiveUpdateSnapshot({ includeManifest: true })
            .then((snapshot) => {
                if (!cancelled) {
                    setOtaSnapshot(snapshot);
                }
            })
            .catch((error) => {
                console.warn('[HomeVersionFooter] 读取 OTA 快照失败', error);
                if (!cancelled) {
                    setOtaSnapshot({
                        enabled: false,
                        manifestUrl: '',
                        channel: 'stable',
                        nativeAndroid: true,
                        updaterLoaded: false,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isNativeAndroid]);

    useEffect(() => {
        if (!isNativeAndroid) {
            return;
        }

        return refreshOtaSnapshot();
    }, [isNativeAndroid, refreshOtaSnapshot]);

    useEffect(() => {
        if (!isNativeAndroid) {
            return;
        }

        return subscribeAndroidLiveUpdateActivityState((state) => {
            setOtaActivityState(state);
        });
    }, [isNativeAndroid]);

    const currentInternalBundleVersion = otaSnapshot?.currentBundleVersion?.trim() || null;
    const activeBundleVersion = useMemo(() => {
        const displayVersion = otaSnapshot?.currentDisplayVersion?.trim();
        return displayVersion || packageJson.version;
    }, [otaSnapshot?.currentDisplayVersion]);
    const shouldShowNativeAppVersion = isNativeAndroid;
    const homeVersionLabel = useMemo(
        () => isVersionExpanded ? activeBundleVersion.replace(/^v/i, '') : toShortVersionLabel(activeBundleVersion),
        [activeBundleVersion, isVersionExpanded],
    );
    const nativeAppVersion = otaSnapshot?.nativeVersion?.trim() || packageJson.version;
    const appVersionLabel = useMemo(
        () => isVersionExpanded ? nativeAppVersion.replace(/^v/i, '') : toShortVersionLabel(nativeAppVersion),
        [isVersionExpanded, nativeAppVersion],
    );
    const latestManifestVersion = otaSnapshot?.manifestVersion?.trim() || null;
    const latestDisplayVersion = otaSnapshot?.manifestDisplayVersion?.trim()
        || otaSnapshot?.manifestProductVersion?.trim()
        || null;
    const latestManifestVersionLabel = useMemo(
        () => latestDisplayVersion
            ? (isVersionExpanded ? latestDisplayVersion.replace(/^v/i, '') : toShortVersionLabel(latestDisplayVersion))
            : null,
        [isVersionExpanded, latestDisplayVersion],
    );
    const otaVersionMismatch = otaEnabledForCurrentShell
        && Boolean(latestManifestVersion)
        && latestManifestVersion !== currentInternalBundleVersion;
    const isImmediateOtaActive = otaEnabledForCurrentShell && otaActivityState.active;

    const handleVersionFooterClick = () => {
        if (shouldShowNativeAppVersion) {
            if (!otaEnabledForCurrentShell) {
                return;
            }
            if (otaActivityState.active) {
                return;
            }
            requestAndroidLiveUpdateCheck({
                interactive: true,
                applyMode: 'immediate',
                initialImmediatePhase: otaVersionMismatch ? 'downloading' : 'checking',
            });
            return;
        }

        setIsVersionExpanded((expanded) => !expanded);
    };

    const nativeVersionTitle = useMemo(() => {
        if (!shouldShowNativeAppVersion) {
            return [
                t('ota.footer.currentVersionTitle', { version: activeBundleVersion.replace(/^v/i, '') }),
                t(isVersionExpanded ? 'ota.footer.clickToCollapse' : 'ota.footer.clickToExpand'),
            ].join('\n');
        }

        const lines = [
            t('ota.footer.currentBundleTitle', { version: activeBundleVersion.replace(/^v/i, '') }),
            t('ota.footer.currentAppShellTitle', { version: nativeAppVersion.replace(/^v/i, '') }),
        ];
        if (latestDisplayVersion) {
            lines.push(t('ota.footer.latestOtaTitle', { version: latestDisplayVersion.replace(/^v/i, '') }));
        }
        lines.push(
            !otaEnabledForCurrentShell
                ? t('ota.footer.statusDisabled')
                : isImmediateOtaActive
                    ? t('ota.footer.statusCheckingAndApplying')
                    : otaVersionMismatch
                        ? t('ota.footer.statusMismatchUpdateNow')
                        : t('ota.footer.statusCheckNow'),
        );
        return lines.join('\n');
    }, [
        activeBundleVersion,
        isImmediateOtaActive,
        isVersionExpanded,
        latestDisplayVersion,
        nativeAppVersion,
        otaEnabledForCurrentShell,
        otaVersionMismatch,
        shouldShowNativeAppVersion,
        t,
    ]);

    const themeClasses = FOOTER_THEME_CLASS_MAP[theme];
    const iconColorClassName = !shouldShowNativeAppVersion
        ? ''
        : !otaEnabledForCurrentShell
            ? themeClasses.disabledIcon
            : isImmediateOtaActive
                ? themeClasses.activeIcon
                : otaVersionMismatch
                    ? themeClasses.mismatchIcon
                    : themeClasses.idleIcon;
    const statusTextClassName = otaEnabledForCurrentShell && otaVersionMismatch
        ? (isImmediateOtaActive ? themeClasses.activeText : themeClasses.mismatchText)
        : isImmediateOtaActive
            ? themeClasses.activeText
            : otaEnabledForCurrentShell
                ? themeClasses.subduedText
                : themeClasses.disabledText;
    const primaryTextClassName = shouldShowNativeAppVersion
        ? (
            otaEnabledForCurrentShell && otaVersionMismatch
                ? (isImmediateOtaActive ? themeClasses.activeText : themeClasses.mismatchText)
                : isImmediateOtaActive
                    ? themeClasses.activeText
                    : themeClasses.baseText
        )
        : themeClasses.baseText;

    return (
        <button
            type="button"
            data-testid={testId}
            onClick={handleVersionFooterClick}
            className={`${positionMode} z-30 max-w-[min(72vw,20rem)] select-none text-[0.7rem] leading-none tracking-[0.08em] ${align === 'left' ? 'text-left' : 'text-right'} ${compact ? 'whitespace-nowrap' : ''} cursor-pointer md:text-[0.78rem] ${positionClassName}`}
            aria-label={shouldShowNativeAppVersion
                ? otaEnabledForCurrentShell
                    ? otaVersionMismatch
                        ? t('ota.footer.ariaBundleAndAppMismatch', {
                            bundleVersion: homeVersionLabel,
                            appVersion: appVersionLabel,
                            latestVersion: latestManifestVersionLabel ?? t('ota.forceUpdate.progressPending'),
                        })
                        : t('ota.footer.ariaBundleAndApp', {
                            bundleVersion: homeVersionLabel,
                            appVersion: appVersionLabel,
                        })
                    : t('ota.footer.ariaBundleAndAppDisabled', {
                        bundleVersion: homeVersionLabel,
                        appVersion: appVersionLabel,
                    })
                : t('ota.footer.ariaVersion', { version: homeVersionLabel })}
            title={nativeVersionTitle}
        >
            <span className={`inline-flex max-w-full items-center gap-1 break-all ${align === 'left' ? 'justify-start' : 'justify-end'} ${primaryTextClassName}`}>
                {shouldShowNativeAppVersion && (
                    <RefreshCw size={11} className={`shrink-0 ${isImmediateOtaActive ? 'animate-spin' : ''} ${iconColorClassName}`} />
                )}
                <span>{shouldShowNativeAppVersion && !compact ? t('ota.footer.bundleLabel', { version: homeVersionLabel }) : homeVersionLabel}</span>
            </span>
            {!compact && shouldShowNativeAppVersion && (
                <span className={`mt-1 block text-[0.58rem] tracking-[0.04em] md:text-[0.64rem] ${themeClasses.mutedText}`}>
                    {t('ota.footer.appLabel', { version: appVersionLabel })}
                </span>
            )}
            {!compact && shouldShowNativeAppVersion && latestManifestVersionLabel && (
                <span className={`mt-1 block text-[0.58rem] tracking-[0.04em] md:text-[0.64rem] ${otaEnabledForCurrentShell && otaVersionMismatch ? themeClasses.mismatchSecondary : themeClasses.subduedText}`}>
                    {t('ota.footer.latestLabel', { version: latestManifestVersionLabel })}
                </span>
            )}
            {!compact && !otaEnabledForCurrentShell && shouldShowNativeAppVersion && (
                <span className={`mt-1 block text-[0.58rem] font-bold tracking-[0.04em] md:text-[0.64rem] ${themeClasses.disabledText}`}>
                    {t('ota.footer.disabledLabel')}
                </span>
            )}
            {!compact && shouldShowNativeAppVersion && (
                <span className={`mt-1 block text-[0.58rem] font-bold tracking-[0.04em] md:text-[0.64rem] ${statusTextClassName}`}>
                    {otaEnabledForCurrentShell
                        ? otaVersionMismatch
                            ? (isImmediateOtaActive ? t('ota.footer.updatingNow') : t('ota.footer.mismatchUpdateNow'))
                            : (isImmediateOtaActive ? t('ota.footer.checkingNow') : t('ota.footer.checkNow'))
                        : t('ota.footer.disabledLabel')}
                </span>
            )}
        </button>
    );
}
