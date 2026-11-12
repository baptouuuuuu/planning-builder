import { useState } from 'react';
import { DAY, dayLabel, formatAbs, formatTime, scheduledTasks } from '../domain/types';
import { useStore } from '../state/store';

export function Timeline() {
  const { people, tasks, assignments, settings, toggleLock } = useStore();
  const [zoom, setZoom] = useState(1);
  const taskMap = new Map(scheduledTasks(tasks).map((t) => [t.id, t]));
  const { dayStart, dayEnd, startDate } = settings;
  const span = Math.max(60, dayEnd - dayStart);
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - dayStart) / span) * 100))}%`;
  const hours: number[] = [];
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hours.push(m);

  if (people.length === 0) return <p className="text-slate-500">Ajoutez des personnes pour voir le planning.</p>;

  return (
    <div className="min-w-0 space-y-6">
      <label className="flex items-center gap-2 text-sm">
        Zoom vertical
        <input aria-label="Niveau de zoom" type="range" min="0.5" max="2.5" step="0.25"
          value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        <span>{Math.round(zoom * 100)} %</span>
      </label>
      {Array.from({ length: settings.horizonDays }, (_, d) => {
        const base = d * DAY;
        const end = (a: { taskId: string; start: number }) => a.start + (taskMap.get(a.taskId)?.duration ?? 0);
        // Une tâche qui dépasse minuit apparaît aussi sur le jour suivant, dans la plage affichée.
        const placed = assignments.filter((a) => a.start < base + dayEnd && end(a) > base + dayStart);
        const startsToday = placed.filter((a) => a.start >= base && a.start < base + DAY).length;
        return (
          <section key={d} aria-label={`Jour ${dayLabel(d, startDate)}`}>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">
              {dayLabel(d, startDate)} · {startsToday} tâche(s)
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {people.map((p) => (
                <div key={p.id} className="w-56 shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-medium">
                    <span style={{ color: p.color }}>●</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="py-3 pr-2">
                    <div className="relative ml-14" style={{ height: span * 64 / 60 * zoom }}>
                      {p.availability
                        .filter((a) => a.end > base + dayStart && a.start < base + dayEnd)
                        .map((a, i) => (
                          <div
                            key={i}
                            className="absolute inset-x-0 bg-emerald-50"
                            style={{
                              top: pct(a.start - base),
                              height: `calc(${pct(a.end - base)} - ${pct(a.start - base)})`,
                            }}
                          />
                        ))}
                      {hours.map((m) => (
                        <div key={m} className="absolute inset-x-0 border-t border-slate-200" style={{ top: pct(m) }}>
                          <span className="absolute right-full top-0 w-12 -translate-y-1/2 pr-2 text-right text-xs text-slate-500">
                            {formatTime(m)}
                          </span>
                        </div>
                      ))}
                      {placed
                        .filter((a) => a.personId === p.id)
                        .map((a) => {
                          const t = taskMap.get(a.taskId);
                          if (!t) return null;
                          const s = a.start - base;
                          return (
                            <button
                              key={a.taskId}
                              onClick={() => toggleLock(a.taskId)}
                              aria-pressed={a.locked}
                              title={`${t.name} · ${formatAbs(a.start, startDate)} → ${formatTime(a.start + t.duration - Math.floor(a.start / DAY) * DAY)} · ${
                                a.locked ? 'verrouillé (cliquer pour déverrouiller)' : 'cliquer pour verrouiller'
                              }`}
                              className={`absolute inset-x-1 overflow-hidden rounded-md px-2 text-left text-xs font-medium text-white shadow ${
                                a.locked ? 'ring-2 ring-white' : ''
                              }`}
                              style={{
                                top: pct(s),
                                height: `calc(${pct(s + t.duration)} - ${pct(s)})`,
                                backgroundColor: p.color,
                              }}
                            >
                              {a.locked ? '🔒 ' : ''}
                              {t.name}
                              <br />
                              <span className="opacity-80">
                                {s < dayStart ? '(suite)' : formatTime(s)} → {formatTime(s + t.duration)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
