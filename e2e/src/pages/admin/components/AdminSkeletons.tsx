import Skeleton from '../../../components/common/feedback/Skeleton';

type AdminListPageSkeletonProps = {
    rows?: number;
    showFilter?: boolean;
    showPrimaryAction?: boolean;
};

export function AdminCardListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }, (_, index) => (
                <div
                    key={`admin-list-skeleton-${index}`}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Skeleton className="h-6 w-52 rounded-lg" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full rounded-lg" />
                                <Skeleton className="h-4 w-[92%] rounded-lg" />
                                <Skeleton className="h-4 w-[76%] rounded-lg" />
                            </div>
                            <Skeleton className="h-3 w-40 rounded-lg" />
                        </div>
                        <div className="flex shrink-0 items-center gap-2 self-start">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <Skeleton className="h-9 w-9 rounded-lg" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function AdminListPageSkeleton({
    rows = 4,
    showFilter = true,
    showPrimaryAction = true,
}: AdminListPageSkeletonProps) {
    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="mx-auto max-w-[1200px] space-y-6 pb-10">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-3">
                        <Skeleton className="h-9 w-44 rounded-xl" />
                        <Skeleton className="h-4 w-80 max-w-[70vw] rounded-lg" />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {showFilter ? <Skeleton className="h-11 w-44 rounded-xl" /> : null}
                        {showPrimaryAction ? <Skeleton className="h-11 w-32 rounded-xl" /> : null}
                    </div>
                </div>

                <AdminCardListSkeleton rows={rows} />
            </div>
        </div>
    );
}

export function AdminDetailPageSkeleton() {
    return (
        <div className="flex h-full flex-col overflow-hidden bg-zinc-50/30">
            <div className="z-10 flex-none border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
                <div className="mx-auto flex max-w-[1400px] items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-6 w-40 rounded-lg" />
                            <Skeleton className="h-4 w-72 max-w-[65vw] rounded-lg" />
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                </div>
            </div>

            <div className="h-full overflow-y-auto p-6">
                <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                            <div className="grid gap-4 md:grid-cols-2">
                                {Array.from({ length: 6 }, (_, index) => (
                                    <div key={`admin-detail-meta-${index}`} className="space-y-2">
                                        <Skeleton className="h-3 w-20 rounded-lg" />
                                        <Skeleton className="h-5 w-full rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <Skeleton className="h-6 w-36 rounded-lg" />
                                <Skeleton className="h-8 w-20 rounded-lg" />
                            </div>
                            <div className="space-y-3">
                                {Array.from({ length: 4 }, (_, index) => (
                                    <div key={`admin-detail-row-${index}`} className="grid grid-cols-[84px_minmax(0,1fr)_120px_88px] items-center gap-3">
                                        <Skeleton className="h-8 w-full rounded-lg" />
                                        <Skeleton className="h-4 w-full rounded-lg" />
                                        <Skeleton className="h-4 w-24 rounded-lg" />
                                        <Skeleton className="h-4 w-20 rounded-lg justify-self-end" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                            <Skeleton className="mb-4 h-6 w-28 rounded-lg" />
                            <div className="space-y-3">
                                {Array.from({ length: 3 }, (_, index) => (
                                    <div key={`admin-detail-side-${index}`} className="space-y-2">
                                        <Skeleton className="h-4 w-24 rounded-lg" />
                                        <Skeleton className="h-10 w-full rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AdminShellSkeleton() {
    return (
        <div className="h-screen w-full overflow-hidden bg-zinc-50 font-sans text-zinc-900 flex">
            <aside className="z-20 flex w-72 flex-shrink-0 flex-col bg-zinc-950 text-zinc-400 shadow-xl">
                <div className="flex-shrink-0 p-6">
                    <div className="flex items-center gap-3 px-2">
                        <Skeleton className="h-8 w-8 rounded-lg bg-indigo-500/30" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(129,140,248,0.45),transparent)]" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28 rounded-lg bg-zinc-800" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                            <Skeleton className="h-3 w-24 rounded-lg bg-zinc-900" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)]" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-3 overflow-hidden px-4 py-4">
                    {Array.from({ length: 7 }, (_, index) => (
                        <div key={`admin-shell-nav-${index}`} className="flex items-center gap-3 rounded-xl px-4 py-3">
                            <Skeleton className="h-5 w-5 rounded-md bg-zinc-800" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                            <Skeleton className="h-4 w-24 rounded-lg bg-zinc-800" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                        </div>
                    ))}
                </div>

                <div className="mt-auto p-4">
                    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-4">
                        <div className="mb-4 flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24 rounded-lg bg-zinc-800" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                                <Skeleton className="h-3 w-16 rounded-lg bg-zinc-900" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)]" />
                            </div>
                        </div>
                        <Skeleton className="h-9 w-full rounded-lg bg-zinc-800" shimmerClassName="bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
                    </div>
                </div>
            </aside>

            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50">
                <AdminListPageSkeleton rows={3} />
            </main>
        </div>
    );
}
