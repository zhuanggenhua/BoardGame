import React from 'react';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    canonical?: string;
    noIndex?: boolean;
}

/**
 * SEO 组件 - 利用 React 19 的自动 Hoisting 功能
 * 可以在组件树的任何地方使用，React 会自动将其移动到 <head>
 */
export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    ogType = 'website',
    canonical,
    noIndex = false,
}) => {
    const siteName = '易桌游';
    const siteTitle = `${siteName} - 桌游教学与联机平台`;
    const fullTitle = title ? `${title} | ${siteName}` : siteTitle;

    return (
        <>
            <title>{fullTitle}</title>
            {description && <meta name="description" content={description} />}
            {keywords && <meta name="keywords" content={keywords} />}
            <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
            <meta name="googlebot" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />

            {/* Open Graph 元信息 */}
            <meta property="og:title" content={ogTitle || fullTitle} />
            {ogDescription && <meta property="og:description" content={ogDescription} />}
            {ogImage && <meta property="og:image" content={ogImage} />}
            <meta property="og:type" content={ogType} />
            <meta property="og:locale" content="zh_CN" />

            {/* Twitter 元信息 */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={ogTitle || fullTitle} />
            {ogDescription && <meta name="twitter:description" content={ogDescription} />}

            {/* 规范链接 */}
            {canonical && <link rel="canonical" href={canonical} />}
        </>
    );
};
