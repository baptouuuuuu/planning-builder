import { useState } from 'react';
import { DAY, dayLabel, formatTime, parseTime } from '../domain/types';
import { useStore } from '../state/store';
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

/** Sélecteur jour (daté si une date de début est définie) + heure (précision à la minute). */
export function MinuteField({ label, value, days, onChange }: MinuteProps) {
  const startDate = useStore((s) => s.settings.startDate);
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
            {dayLabel(d, startDate)}
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

interface EndProps {
  label: string;
  /** Jour de référence (« +0 » = ce jour). */
  baseDay: number;
  value: number;
  onChange: (v: number) => void;
}

/** Heure + décalage de jours (« +1 » = jour suivant) relatif à `baseDay`. */
export function OffsetTimeField({ label, baseDay, value, onChange }: EndProps) {
  const day = Math.floor(value / DAY);
  const offset = Math.max(0, day - baseDay);
  const min = value - day * DAY;
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label={`${label} - heure`}
        type="time"
        step={60}
        className={inputCls}
        value={formatTime(min)}
        onChange={(e) => e.target.value && onChange((baseDay + offset) * DAY + parseTime(e.target.value))}
      />
      <select
        aria-label={`${label} - jour suivant`}
        className={inputCls}
        value={offset}
        onChange={(e) => onChange((baseDay + Number(e.target.value)) * DAY + min)}
      >
        {Array.from({ length: Math.max(4, offset + 1) }, (_, o) => (
          <option key={o} value={o}>
            {o === 0 ? 'même jour' : `+${o}`}
          </option>
        ))}
      </select>
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
  const startDay = Math.floor(value.start / DAY);
  const endOffset = Math.max(0, Math.floor(value.end / DAY) - startDay);
  const endMin = value.end - Math.floor(value.end / DAY) * DAY;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <MinuteField
        label={`${label} début`}
        value={value.start}
        days={days}
        onChange={(start) => onChange({ start, end: (Math.floor(start / DAY) + endOffset) * DAY + endMin })}
      />
      <span aria-hidden>→</span>
      <OffsetTimeField label={`${label} fin`} baseDay={startDay} value={value.end} onChange={(end) => onChange({ ...value, end })} />
    </span>
  );
}

interface NumberProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  className?: string;
  onChange: (v: number) => void;
}

/** Champ numérique qui autorise un champ vide pendant la saisie. */
export function NumberField({ label, value, min = 1, max, className, onChange }: NumberProps) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
  return (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={label}
      className={className}
      value={text ?? value}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n);
      }}
      onBlur={() => {
        if (text !== null && text !== '') onChange(clamp(Number(text) || min));
        setText(null);
      }}
    />
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}
