import { DAY, DAY_NAMES, formatAbs, formatTime } from '../domain/types';
import { useStore } from '../state/store';

export function Timeline() {
  const { people, tasks, assignments, settings, toggleLock } = useStore();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const { dayStart, dayEnd } = settings;
  const span = Math.max(60, dayEnd - dayStart);
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - dayStart) / span) * 100))}%`;
  const hours: number[] = [];
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hours.push(m);

  if (people.length === 0) return <p className="text-slate-500">Ajoutez des personnes pour voir le planning.</p>;

  return (
    <div className="space-y-6">
      {Array.from({ length: settings.horizonDays }, (_, d) => {
        const base = d * DAY;
        const placed = assignments.filter((a) => a.start >= base && a.start < base + DAY);
        return (
          <section key={d} aria-label={`Jour ${DAY_NAMES[d % 7]}`}>
            <h3 className="mb-1 text-sm font-semibold text-slate-600">
              {DAY_NAMES[d % 7]} {d >= 7 ? `(+${Math.floor(d / 7)})` : ''} · {placed.length} tâche(s)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="min-w-[640px]">
                <div className="relative ml-28 h-6 border-b border-slate-200 text-xs text-slate-500">
                  {hours.map((m) => (
                    <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>
                      {formatTime(m).slice(0, 2)}h
                    </span>
                  ))}
                </div>
                {people.map((p) => (
                  <div key={p.id} className="flex border-b border-slate-100 last:border-0">
                    <div className="flex w-28 shrink-0 items-center gap-1 px-2 text-sm font-medium">
                      <span style={{ color: p.color }}>●</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="relative h-14 flex-1">
                      {hours.map((m) => (
                        <div key={m} className="absolute inset-y-0 border-l border-slate-100" style={{ left: pct(m) }} />
                      ))}
                      {p.availability
                        .filter((a) => a.end > base && a.start < base + DAY)
                        .map((a, i) => (
                          <div
                            key={i}
                            className="absolute inset-y-0 bg-emerald-50"
                            style={{
                              left: pct(Math.max(a.start - base, dayStart)),
                              width: `calc(${pct(Math.min(a.end - base, dayEnd))} - ${pct(Math.max(a.start - base, dayStart))})`,
                            }}
                          />
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
                              title={`${t.name} · ${formatAbs(a.start)} → ${formatTime((a.start + t.duration) % DAY)} · ${
                                a.locked ? 'verrouillé (cliquer pour déverrouiller)' : 'cliquer pour verrouiller'
                              }`}
                              className={`absolute inset-y-1 overflow-hidden rounded-md px-1 text-left text-xs font-medium text-white shadow ${
                                a.locked ? 'ring-2 ring-slate-900' : ''
                              }`}
                              style={{
                                left: pct(s),
                                width: `calc(${pct(s + t.duration)} - ${pct(s)})`,
                                backgroundColor: p.color,
                                minWidth: 24,
                              }}
                            >
                              {a.locked ? '🔒 ' : ''}
                              {t.name}
                              <br />
                              <span className="opacity-80">{formatTime(s)}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
