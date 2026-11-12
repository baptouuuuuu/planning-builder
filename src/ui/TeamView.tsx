import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Interval, Person } from '../domain/types';
import { DAY, dayLabel, formatTime } from '../domain/types';
import { Card, IntervalField, btnDanger, btnGhost, inputCls } from './fields';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16'];

export function TeamView() {
  const { people, setPeople, settings } = useStore();
  const update = (id: string, patch: Partial<Person>) =>
    setPeople(people.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const [focusId, setFocusId] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusId || !nameInput.current) return;
    nameInput.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    nameInput.current.focus();
    nameInput.current.select();
    setFocusId(null);
  }, [focusId, people]);
  const add = () => {
    const id = crypto.randomUUID();
    setPeople([
      ...people,
      {
        id,
        name: `Personne ${people.length + 1}`,
        color: COLORS[people.length % COLORS.length]!,
        availability: [{ start: 9 * 60, end: 17 * 60 }],
      },
    ]);
    setFocusId(id);
  };
  const duplicate = (p: Person) => {
    const i = people.findIndex((x) => x.id === p.id);
    const copy: Person = {
      ...p,
      id: crypto.randomUUID(),
      name: `${p.name} (copie)`,
      availability: p.availability.map((a) => ({ ...a })),
    };
    setPeople([...people.slice(0, i + 1), copy, ...people.slice(i + 1)]);
    setFocusId(copy.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Équipe</h2>
        <button className={btnGhost} onClick={add}>+ Ajouter une personne</button>
      </div>
      {people.length === 0 && <p className="text-slate-500">Aucune personne. Ajoutez-en ou chargez l'exemple.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {people.map((p) => (
          <Card key={p.id}>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="color"
                aria-label={`Couleur de ${p.name}`}
                value={p.color}
                onChange={(e) => update(p.id, { color: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded"
              />
              <input
                aria-label="Nom"
                ref={focusId === p.id ? nameInput : undefined}
                className={`${inputCls} flex-1 font-medium`}
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
              />
              <button className={btnGhost} onClick={() => duplicate(p)}>Dupliquer</button>
              <button className={btnDanger} onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>
                Supprimer
              </button>
            </div>
            <h3 className="mb-2 text-sm font-medium text-slate-600">Disponibilités</h3>
            <AvailabilitySummary
              color={p.color}
              availability={p.availability}
              startDate={settings.startDate}
              dayStart={settings.dayStart}
              dayEnd={settings.dayEnd}
            />
            <ul className="space-y-2">
              {p.availability.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <IntervalField
                    label={`Disponibilité ${i + 1}`}
                    value={a}
                    days={settings.horizonDays}
                    onChange={(v) => update(p.id, { availability: p.availability.map((x, j) => (j === i ? v : x)) })}
                  />
                  <button
                    className={btnDanger}
                    aria-label="Supprimer la plage"
                    onClick={() => update(p.id, { availability: p.availability.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              className={`${btnGhost} mt-3`}
              onClick={() => {
                const last = p.availability[p.availability.length - 1];
                const day = last ? Math.floor(last.start / 1440) : 0;
                update(p.id, { availability: [...p.availability, { start: day * 1440 + 540, end: day * 1440 + 1020 }] });
              }}
            >
              + Plage
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Résumé visuel par jour des plages de disponibilité. */
function AvailabilitySummary({ color, availability, startDate, dayStart, dayEnd }: {
  color: string;
  availability: Interval[];
  startDate?: string;
  dayStart: number;
  dayEnd: number;
}) {
  const byDay = new Map<number, Interval[]>();
  for (const a of [...availability].sort((x, y) => x.start - y.start)) {
    const d = Math.floor(a.start / DAY);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }
  if (byDay.size === 0) return <p className="mb-3 text-sm text-slate-500">Aucune disponibilité.</p>;
  const span = Math.max(1, dayEnd - dayStart);
  const pct = (m: number) => Math.min(100, Math.max(0, ((m - dayStart) / span) * 100));
  const total = availability.reduce((s, a) => s + Math.max(0, a.end - a.start), 0);
  return (
    <div className="mb-3 space-y-1 rounded-lg bg-slate-50 p-2 text-xs">
      {[...byDay.entries()].sort((x, y) => x[0] - y[0]).map(([d, list]) => (
        <div key={d} className="flex items-center gap-2">
          <span className="w-16 shrink-0 font-medium text-slate-600">{dayLabel(d, startDate)}</span>
          <div className="relative h-3 flex-1 rounded bg-slate-200">
            {list.map((a, i) => (
              <div
                key={i}
                className="absolute top-0 h-3 rounded"
                style={{
                  background: color,
                  left: `${pct(a.start - d * DAY)}%`,
                  width: `${Math.max(1, pct(a.end - d * DAY) - pct(a.start - d * DAY))}%`,
                }}
              />
            ))}
          </div>
          <span className="w-40 shrink-0 text-right text-slate-600">
            {list.map((a) => `${formatTime(a.start - d * DAY)}–${formatTime(a.end - d * DAY)}`).join(', ')}
          </span>
        </div>
      ))}
      <div className="text-right text-slate-500">Total : {Math.round((total / 60) * 10) / 10} h</div>
    </div>
  );
}
