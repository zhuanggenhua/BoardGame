import Markdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import guide from '../../public/developers/external-room-sdk.md?raw';

export default function ExternalRoomSdkGuidePage() {
    const { t } = useTranslation('lobby');

    return <main className="min-h-dvh bg-neutral-50 font-sans text-neutral-950">
        <div className="mx-auto max-w-4xl px-5 pb-16 pt-6 sm:px-10">
            <Link to="/?section=upload" className="mb-6 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4">
                <span aria-hidden="true">←</span>{t('platform.upload')}
            </Link>
            <article lang="zh-CN" className="min-w-0 break-words leading-relaxed
                [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-bold sm:[&_h1]:text-3xl
                [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:font-bold
                [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold
                [&_h4]:mb-2 [&_h4]:font-bold
                [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1
                [&_pre]:mb-4 [&_pre]:whitespace-pre-wrap [&_pre]:bg-neutral-200/70 [&_pre]:p-4
                [&_code]:text-sm [&_p_code]:bg-neutral-200/70 [&_li_code]:bg-neutral-200/70
                [&_a]:underline [&_a]:underline-offset-4">
                <Markdown skipHtml>{guide}</Markdown>
            </article>
        </div>
    </main>;
}
