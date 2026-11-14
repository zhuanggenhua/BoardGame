import type { ButtonHTMLAttributes } from 'react';

export function DetailsPrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type="button" className="w-full py-3 bg-parchment-base-text hover:bg-parchment-brown text-parchment-card-bg font-bold rounded-[4px] shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm uppercase tracking-widest" {...props} />;
}
