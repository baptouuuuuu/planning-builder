import { useLayoutEffect, useRef, useState } from 'react';
import { DAY, dayLabel, formatAbs, formatTime, pad } from '../domain/types';
import { useStore } from '../state/store';

export function Timeline() {
  const { people, tasks, assignments, settings, toggleLock } = useStore();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const { dayStart, dayEnd, startDate } = settings;
  const span = Math.max(60, dayEnd - dayStart);
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - dayStart) / span) * 100))}%`;
  const [zoom, setZoom] = useState(1);
  const changeZoom = (z: number) => setZoom(Math.min(12, Math.max(1, Math.round(z * 100) / 100)));
  // Pincement à deux doigts : le point entre les doigts reste ancré pendant le zoom.
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const anchor = useRef<{ el: HTMLElement; x: number; ratio: number } | null>(null);
  const dist = (t: React.TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { dist: dist(e.touches), zoom };
  };
  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 2 || !pinch.current) return;
    const el = e.currentTarget;
    const nz = Math.min(12, Math.max(1, (pinch.current.zoom * dist(e.touches)) / pinch.current.dist));
    if (nz === zoom) return;
    const cx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - el.getBoundingClientRect().left;
    anchor.current = { el, x: cx, ratio: nz / zoom };
    setZoom(nz);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null;
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    a.el.scrollLeft = (a.el.scrollLeft + a.x) * a.ratio - a.x;
    anchor.current = null;
  }, [zoom]);
  // Plus on zoome, plus les repères sont fins.
  const tick = zoom >= 5 ? 5 : zoom >= 3 ? 15 : zoom >= 1.7 ? 30 : 60;
  const hours: number[] = [];
  for (let m = Math.ceil(dayStart / tick) * tick; m <= dayEnd; m += tick) hours.push(m);
  const label = (m: number) => (tick >= 60 ? `${pad(Math.floor(m / 60) % 24)}h` : formatTime(m % DAY));

  if (people.length === 0) return <p className="text-slate-500">Ajoutez des personnes pour voir le planning.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">Zoom</span>
        <span className="text-xs text-slate-500 md:hidden">(pincez le planning)</span>
        <button className="rounded border px-2" aria-label="Dézoomer" onClick={() => changeZoom(zoom / 1.5)} disabled={zoom <= 1}>−</button>
        <input
          type="range" min={1} max={12} step={0.25} value={zoom} aria-label="Niveau de zoom"
          onChange={(e) => changeZoom(Number(e.target.value))}
        />
        <button className="rounded border px-2" aria-label="Zoomer" onClick={() => changeZoom(zoom * 1.5)} disabled={zoom >= 12}>+</button>
        <button className="rounded border px-2" onClick={() => changeZoom(1)} disabled={zoom === 1}>Réinitialiser</button>
        <span className="text-slate-500">×{Math.round(zoom * 10) / 10}</span>
      </div>
      {Array.from({ length: settings.horizonDays }, (_, d) => {
        const base = d * DAY;
        const end = (a: { taskId: string; start: number }) => a.start + (taskMap.get(a.taskId)?.duration ?? 0);
        // Une tâche qui dépasse minuit apparaît aussi sur le jour suivant, dans la plage affichée.
        const placed = assignments.filter((a) => a.start < base + dayEnd && end(a) > base + dayStart);
        const startsToday = placed.filter((a) => a.start >= base && a.start < base + DAY).length;
        return (
          <section key={d} aria-label={`Jour ${dayLabel(d, startDate)}`}>
            <h3 className="mb-1 text-sm font-semibold text-slate-600">
              {dayLabel(d, startDate)} · {startsToday} tâche(s)
            </h3>
            <div
              className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ touchAction: 'pan-x pan-y', overscrollBehavior: 'contain' }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              onWheel={(e) => {
                if (e.ctrlKey) changeZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
              }}
            >
              <div style={{ minWidth: 640 * zoom }}>
                <div className="relative ml-28 h-6 border-b border-slate-200 text-xs text-slate-500">
                  {hours.map((m) => (
                    <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>
                      {label(m)}
                    </span>
                  ))}
                </div>
                {people.map((p) => (
                  <div key={p.id} className="flex border-b border-slate-100 last:border-0">
                    <div className="sticky left-0 z-10 flex w-28 shrink-0 items-center gap-1 bg-white px-2 text-sm font-medium">
                      <span style={{ color: p.color }}>●</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="relative h-14 flex-1">
                      {hours.map((m) => (
                        <div key={m} className="absolute inset-y-0 border-l border-slate-100" style={{ left: pct(m) }} />
                      ))}
                      {p.availability
                        .filter((a) => a.end > base + dayStart && a.start < base + dayEnd)
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
                              title={`${t.name} · ${formatAbs(a.start, startDate)} → ${formatTime(a.start + t.duration - Math.floor(a.start / DAY) * DAY)} · ${
                                a.locked ? 'verrouillé (cliquer pour déverrouiller)' : 'cliquer pour verrouiller'
                              }`}
                              className={`absolute inset-y-1 overflow-hidden rounded-md px-1 text-left text-xs font-medium text-white shadow ${
                                a.locked ? 'ring-2 ring-white' : ''
                              }`}
                              style={{
                                left: pct(s),
                                width: `calc(${pct(s + t.duration)} - ${pct(s)})`,
                                backgroundColor: p.color,
                                minWidth: 4,
                              }}
                            >
                              {a.locked ? '🔒 ' : ''}
                              {t.name}
                              <br />
                              <span className="opacity-80">
                                {s < 0 ? '(suite)' : formatTime(s)} → {formatTime((s + t.duration) % DAY)}
                              </span>
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
