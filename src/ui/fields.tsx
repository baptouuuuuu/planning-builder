import { DAY, DAY_NAMES, formatTime, parseTime } from '../domain/types';
import type { Interval } from '../domain/types';

export const inputCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500';
export const btnCls =
  'inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
export const btnPrimary = `${btnCls} bg-indigo-600 text-white hover:bg-indigo-700`;
export const btnGhost = `${btnCls} border border-slate-300 bg-white hover:bg-slate-100`;
export const btnDanger = `${btnCls} text-red-600 hover:bg-red-50`;

interface MinuteProps {
  label: string;
  value: number;
  days: number;
  onChange: (v: number) => void;
}

/** Sélecteur jour + heure (précision à la minute). */
export function MinuteField({ label, value, days, onChange }: MinuteProps) {
  const day = Math.floor(value / DAY);
  const min = value - day * DAY;
  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label={`${label} - jour`}
        className={inputCls}
        value={day}
        onChange={(e) => onChange(Number(e.target.value) * DAY + min)}
      >
        {Array.from({ length: Math.max(days, day + 1) }, (_, d) => (
          <option key={d} value={d}>
            {DAY_NAMES[d % 7]}
            {d >= 7 ? ` +${Math.floor(d / 7)}` : ''}
          </option>
        ))}
      </select>
      <input
        aria-label={`${label} - heure`}
        type="time"
        step={60}
        className={inputCls}
        value={formatTime(min)}
        onChange={(e) => e.target.value && onChange(day * DAY + parseTime(e.target.value))}
      />
    </span>
  );
}

interface IntervalProps {
  label: string;
  value: Interval;
  days: number;
  onChange: (v: Interval) => void;
}

export function IntervalField({ label, value, days, onChange }: IntervalProps) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <MinuteField label={`${label} début`} value={value.start} days={days} onChange={(start) => onChange({ ...value, start })} />
      <span aria-hidden>→</span>
      <MinuteField label={`${label} fin`} value={value.end} days={days} onChange={(end) => onChange({ ...value, end })} />
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}
