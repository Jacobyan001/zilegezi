import type { ReactNode } from 'react';

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-sm font-bold shadow-block ${className}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  children,
  onClose,
  closable = true,
}: {
  children: ReactNode;
  onClose?: () => void;
  closable?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={closable ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-md animate-dropInCenter rounded-t-[28px] bg-paper p-5 shadow-block-lg sm:rounded-[28px]">
        {closable && onClose && (
          <button
            onClick={onClose}
            aria-label="关闭"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-paperdeep text-lg font-bold text-ink/60 active:scale-90"
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-paperdeep p-1">
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl font-bold shadow-block active:translate-y-0.5 disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="min-w-[3.5rem] text-center font-kid text-lg">
        {value}
        {suffix ? <span className="ml-0.5 text-sm text-ink/60">{suffix}</span> : null}
      </span>
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl font-bold shadow-block active:translate-y-0.5 disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-3.5 text-left shadow-block"
    >
      <span>
        <span className="block font-kid text-base">{label}</span>
        {desc && <span className="mt-0.5 block text-xs text-ink/55">{desc}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-jade' : 'bg-ink/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
