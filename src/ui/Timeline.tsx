import { useEffect, useRef, useState } from 'react';
import { DAY, dayLabel, formatAbs, formatTime, scheduledTasks } from '../domain/types';
import { validStarts } from '../solver/placement';
import { useStore } from '../state/store';
import { btnGhost, btnPrimary, MinuteField } from './fields';

export function Timeline() {
  const { people, tasks, assignments, settings, toggleLock, moveAssignment } = useStore();
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [candidate, setCandidate] = useState<{ personId: string; start: number } | null>(null);
  const [message, setMessage] = useState('');
  const drag = useRef<{ taskId: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = timelineRef.current;
    if (!element) return;
    const clamp = (value: number) => Math.max(0.5, Math.min(2.5, value));
    let pinchDistance: number | null = null;
    const distance = (touches: TouchList) =>
      Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const wheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || event.shiftKey) return;
      event.preventDefault();
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * element.clientHeight : event.deltaY;
      setZoom((current) => clamp(current * Math.exp(-delta * 0.001)));
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pinchDistance = distance(event.touches);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinchDistance === null) return;
      event.preventDefault();
      const next = distance(event.touches);
      const ratio = pinchDistance > 0 ? next / pinchDistance : 1;
      setZoom((current) => clamp(current * ratio));
      pinchDistance = next;
    };
    const touchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchDistance = null;
    };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('touchstart', touchStart, { passive: true });
    element.addEventListener('touchmove', touchMove, { passive: false });
    element.addEventListener('touchend', touchEnd);
    element.addEventListener('touchcancel', touchEnd);
    return () => {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('touchstart', touchStart);
      element.removeEventListener('touchmove', touchMove);
      element.removeEventListener('touchend', touchEnd);
      element.removeEventListener('touchcancel', touchEnd);
    };
  }, [people.length > 0]);
  const taskMap = new Map(scheduledTasks(tasks).map((t) => [t.id, t]));
  const selected = assignments.find((a) => a.taskId === selectedId);
  const selectedTask = selected && taskMap.get(selected.taskId);
  const problem = { people, tasks, settings };
  const candidateValid = !!selected && !!candidate && validStarts(problem, assignments, selected.taskId, candidate.personId)
    .some((r) => r.start <= candidate.start && candidate.start <= r.end);
  const select = (taskId: string) => {
    const assignment = assignments.find((a) => a.taskId === taskId);
    if (!assignment) return;
    setSelectedId(taskId);
    setCandidate({ personId: assignment.personId, start: assignment.start });
    setMessage('');
  };
  const dropAt = (x: number, y: number) => {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-timeline-column]');
    if (!column) return null;
    const rect = column.getBoundingClientRect();
    const day = Number(column.dataset.day);
    const personId = column.dataset.personId;
    if (!personId || y < rect.top || y > rect.bottom) return null;
    return { personId, start: Math.round(day * DAY + settings.dayStart + (y - rect.top) / rect.height * span) };
  };
  const applyMove = (taskId: string, target: { personId: string; start: number } | null) => {
    if (target && moveAssignment(taskId, target.personId, target.start)) {
      setCandidate(target);
      setMessage('Créneau déplacé.');
    } else {
      setMessage('Déplacement impossible : choisissez une zone verte compatible avec les contraintes.');
    }
  };
  const { dayStart, dayEnd, startDate } = settings;
  const span = Math.max(60, dayEnd - dayStart);
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - dayStart) / span) * 100))}%`;
  const hours: number[] = [];
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hours.push(m);

  if (people.length === 0) return <p className="text-slate-500">Ajoutez des personnes pour voir le planning.</p>;

  return (
    <div ref={timelineRef} className="min-w-0 space-y-6" style={{ touchAction: 'pan-x pan-y' }}>
      {showDetails && selected && selectedTask && candidate && (
        <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Tâche sélectionnée</p>
              <p className="font-semibold text-slate-900">{selectedTask.name}</p>
            </div>
            <button className={btnGhost} onClick={() => toggleLock(selected.taskId)}>
              {selected.locked ? '🔒 Déverrouiller' : '🔓 Verrouiller'}
            </button>
            <button className={btnGhost} onClick={() => { setSelectedId(null); setShowDetails(false); setMessage(''); }}>Fermer</button>
          </div>
          <p className="text-sm text-slate-600">Déposez le pointeur dans une zone verte pour choisir le début. Vous pouvez aussi saisir un créneau précis.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Personne</span>
              <select aria-label="Personne pour le déplacement" className="rounded-md border border-slate-300 bg-white px-2 py-1.5" value={candidate.personId}
                onChange={(e) => { setCandidate({ ...candidate, personId: e.target.value }); setMessage(''); }}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="space-y-1 text-sm">
              <span className="block font-medium">Début</span>
              <MinuteField label="Début du déplacement" value={candidate.start} days={settings.horizonDays}
                onChange={(start) => { setCandidate({ ...candidate, start }); setMessage(''); }} />
            </div>
            <button className={btnPrimary} disabled={!candidateValid} onClick={() => applyMove(selected.taskId, candidate)}>Déplacer</button>
          </div>
          <p role="status" className="text-sm text-indigo-800">{message || (candidateValid ? 'Créneau compatible avec les contraintes.' : 'Créneau incompatible avec les contraintes.')}</p>
        </div>
      )}
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
                    <div className="relative ml-14" data-timeline-column data-day={d} data-person-id={p.id} style={{ height: span * 64 / 60 * zoom }}>
                      {!selected && p.availability
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
                      {selected && validStarts(problem, assignments, selected.taskId, p.id)
                        .filter((r) => r.end >= base + dayStart && r.start < base + dayEnd)
                        .map((r, i) => (
                          <div key={i} aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 rounded border border-emerald-500 bg-emerald-400/40"
                            style={{ top: pct(r.start - base), height: `max(3px, calc(${pct(r.end + 1 - base)} - ${pct(r.start - base)}))` }} />
                        ))}
                      {selected && candidate && candidate.personId === p.id && candidate.start >= base + dayStart && candidate.start < base + dayEnd && (
                        <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 z-30 border-t-2 ${candidateValid ? 'border-emerald-700' : 'border-red-600'}`}
                          style={{ top: pct(candidate.start - base) }}>
                          <span className={`absolute right-0 -translate-y-full rounded px-1 text-xs font-semibold text-white ${candidateValid ? 'bg-emerald-700' : 'bg-red-600'}`}>
                            {formatTime(candidate.start - base)}
                          </span>
                        </div>
                      )}
                      {placed
                        .filter((a) => a.personId === p.id)
                        .map((a) => {
                          const t = taskMap.get(a.taskId);
                          if (!t) return null;
                          const s = a.start - base;
                          return (
                            <button
                              key={a.taskId}
                              onClick={() => {
                                if (suppressClick.current) { suppressClick.current = false; return; }
                                select(a.taskId);
                                setShowDetails(true);
                              }}
                              onPointerDown={(event) => {
                                if (event.button !== 0) return;
                                suppressClick.current = false;
                                select(a.taskId);
                                drag.current = { taskId: a.taskId, x: event.clientX, y: event.clientY, moved: false };
                                event.currentTarget.setPointerCapture(event.pointerId);
                              }}
                              onPointerMove={(event) => {
                                const current = drag.current;
                                if (!current || current.taskId !== a.taskId) return;
                                if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5) current.moved = true;
                                if (current.moved) {
                                  const target = dropAt(event.clientX, event.clientY);
                                  if (target && target.start >= 0) setCandidate(target);
                                }
                              }}
                              onPointerUp={(event) => {
                                const current = drag.current;
                                if (!current || current.taskId !== a.taskId) return;
                                drag.current = null;
                                if (current.moved) {
                                  suppressClick.current = true;
                                  applyMove(a.taskId, dropAt(event.clientX, event.clientY));
                                  setShowDetails(true);
                                }
                              }}
                              onPointerCancel={() => { drag.current = null; }}
                              aria-pressed={selectedId === a.taskId}
                              title={`${t.name} · ${formatAbs(a.start, startDate)} → ${formatTime(a.start + t.duration - Math.floor(a.start / DAY) * DAY)} · ${
                                a.locked ? 'verrouillé' : 'cliquer pour sélectionner ou glisser pour déplacer'
                              }`}
                              className={`absolute inset-x-1 z-20 cursor-grab overflow-hidden rounded-md px-2 text-left text-xs font-medium text-white shadow active:cursor-grabbing ${
                                selectedId === a.taskId ? 'ring-2 ring-indigo-600' : a.locked ? 'ring-2 ring-white' : ''
                              }`}
                              style={{
                                touchAction: 'none',
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
