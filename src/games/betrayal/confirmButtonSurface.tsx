import React from "react";

export const BETRAYAL_CONFIRM_BUTTON_CLASS =
  "inline-flex min-h-[42px] items-center justify-center whitespace-nowrap border border-[#d6b56d] bg-[#d6b56d] px-4 py-2 text-[12px] font-bold tracking-[0.10em] text-[#19140d] transition hover:bg-[#f0d28a] disabled:cursor-not-allowed disabled:border-[rgba(214,181,109,0.32)] disabled:bg-[rgba(214,181,109,0.18)] disabled:text-[rgba(243,224,166,0.48)]";

export const BETRAYAL_SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-[42px] items-center justify-center whitespace-nowrap border border-[rgba(211,179,109,0.42)] bg-[rgba(18,15,10,0.58)] px-4 py-2 text-[12px] font-bold tracking-[0.10em] text-[#d6c498] transition hover:border-[rgba(211,179,109,0.68)] hover:text-[#f0dfad] disabled:cursor-not-allowed disabled:border-[rgba(123,106,74,0.24)] disabled:text-[#7a6a4a]";

export function BetrayalConfirmButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${BETRAYAL_CONFIRM_BUTTON_CLASS} ${className}`.trim()}
    />
  );
}

export function BetrayalSecondaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${BETRAYAL_SECONDARY_BUTTON_CLASS} ${className}`.trim()}
    />
  );
}
