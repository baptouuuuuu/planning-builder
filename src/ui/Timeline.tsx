import { useEffect, useRef, useState } from 'react';
import { DAY, dayLabel, formatAbs, formatTime, scheduledTasks } from '../domain/types';
import { validStarts } from '../solver/placement';
import { useStore } from '../state/store';

export function Timeline() {
  const { people, tasks, assignments, settings, toggleLock, moveAssignment } = useStore();
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ personId: string; start: number } | null>(null);
  const [message, setMessage] = useState('');
  const drag = useRef<{
    taskId: string; x: number; y: number; pointerX: number; pointerY: number; moved: boolean;
    offsetX: number; offsetY: number; startOffsetY: number; width: number; height: number;
    name: string; color: string;
  } | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; width: number; height: number; name: string; color: string } | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const press = useRef<{ taskId: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('button, input, select, textarea, a, label, [role="button"]')) return;
      setSelectedId(null);
      setCandidate(null);
      setMessage('');
    };
    document.addEventListener('click', clickOutside);
    return () => document.removeEventListener('click', clickOutside);
  }, []);
  useEffect(() => () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
  }, []);
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
  const dropAt = (x: number, y: number, startOffsetY: number) => {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-timeline-column]');
    if (!column) return null;
    const rect = column.getBoundingClientRect();
    const day = Number(column.dataset.day);
    const personId = column.dataset.personId;
    if (!personId || y < rect.top || y > rect.bottom) return null;
    return { personId, start: Math.round(day * DAY + settings.dayStart + (y - startOffsetY - rect.top) / rect.height * span) };
  };
  const stopDrag = () => {
    drag.current = null;
    setPreview(null);
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
  };
  const updateDrag = () => {
    const current = drag.current;
    if (!current?.moved) return;
    setPreview({
      x: current.pointerX - current.offsetX, y: current.pointerY - current.offsetY,
      width: current.width, height: current.height, name: current.name, color: current.color,
    });
    const target = dropAt(current.pointerX, current.pointerY, current.startOffsetY);
    if (target && target.start >= 0) setCandidate(target);
  };
  const autoScroll = () => {
    const current = drag.current;
    if (!current?.moved) { scrollFrame.current = null; return; }
    const edge = 60;
    const speed = (position: number, start: number, end: number) =>
      position < start + edge ? -Math.min(18, (start + edge - position) / 3)
        : position > end - edge ? Math.min(18, (position - end + edge) / 3) : 0;
    const verticalScroller = timelineRef.current?.closest('main');
    if (verticalScroller) {
      const rect = verticalScroller.getBoundingClientRect();
      verticalScroller.scrollTop += speed(current.pointerY, rect.top, rect.bottom);
    } else {
      window.scrollBy(0, speed(current.pointerY, 0, window.innerHeight));
    }
    const scroller = document.elementFromPoint(current.pointerX, current.pointerY)?.closest<HTMLElement>('.overflow-x-auto');
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      scroller.scrollLeft += speed(current.pointerX, rect.left, rect.right);
    }
    updateDrag();
    scrollFrame.current = requestAnimationFrame(autoScroll);
  };
  const applyMove = (taskId: string, target: { personId: string; start: number } | null) => {
    if (target && moveAssignment(taskId, target.personId, target.start)) {
      setCandidate(target);
      setMessage('');
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
      {message && <p role="status" className="text-sm text-red-600">{message}</p>}
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
                                if (press.current?.taskId === a.taskId && press.current.moved) { press.current = null; return; }
                                press.current = null;
                                select(a.taskId);
                              }}
                              onDoubleClick={() => toggleLock(a.taskId)}
                              onPointerDown={(event) => {
                                suppressClick.current = false;
                                if (event.button !== 0) return;
                                press.current = { taskId: a.taskId, x: event.clientX, y: event.clientY, moved: false };
                                if (selectedId !== a.taskId) return;
                                const rect = event.currentTarget.getBoundingClientRect();
                                const column = event.currentTarget.parentElement!.getBoundingClientRect();
                                const offsetY = event.clientY - rect.top;
                                drag.current = {
                                  taskId: a.taskId, x: event.clientX, y: event.clientY,
                                  pointerX: event.clientX, pointerY: event.clientY, moved: false,
                                  offsetX: event.clientX - rect.left, offsetY,
                                  startOffsetY: offsetY + Math.max(0, dayStart - s) * column.height / span,
                                  width: rect.width, height: rect.height, name: t.name, color: p.color,
                                };
                                event.currentTarget.setPointerCapture(event.pointerId);
                              }}
                              onPointerMove={(event) => {
                                const pending = press.current;
                                if (pending?.taskId === a.taskId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 5)
                                  pending.moved = true;
                                const current = drag.current;
                                if (!current || current.taskId !== a.taskId) return;
                                current.pointerX = event.clientX;
                                current.pointerY = event.clientY;
                                if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5) {
                                  current.moved = true;
                                  scrollFrame.current = requestAnimationFrame(autoScroll);
                                }
                                if (current.moved) {
                                  updateDrag();
                                }
                              }}
                              onPointerUp={(event) => {
                                const current = drag.current;
                                if (!current || current.taskId !== a.taskId) return;
                                if (current.moved) {
                                  suppressClick.current = true;
                                  applyMove(a.taskId, dropAt(event.clientX, event.clientY, current.startOffsetY));
                                }
                                stopDrag();
                              }}
                              onPointerCancel={() => { press.current = null; stopDrag(); }}
                              aria-pressed={selectedId === a.taskId}
                              title={`${t.name} · ${formatAbs(a.start, startDate)} → ${formatTime(a.start + t.duration - Math.floor(a.start / DAY) * DAY)} · ${
                                a.locked ? 'verrouillé · double-clic pour déverrouiller' : 'cliquer pour sélectionner · double-clic pour verrouiller'
                              }`}
                              className={`absolute inset-x-1 z-20 cursor-grab overflow-hidden rounded-md px-2 text-left text-xs font-medium text-white shadow active:cursor-grabbing ${
                                selectedId === a.taskId ? 'ring-2 ring-indigo-600' : a.locked ? 'ring-2 ring-white' : ''
                              }`}
                              style={{
                                touchAction: selectedId === a.taskId ? 'none' : 'pan-x pan-y',
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
                        {preview && (
                          <div aria-hidden="true" className="pointer-events-none fixed z-50 overflow-hidden rounded-md px-2 text-xs font-medium text-white opacity-90 shadow-lg"
                            style={{ left: preview.x, top: preview.y, width: preview.width, height: preview.height, backgroundColor: preview.color }}>
                            {preview.name}
                          </div>
                        )}
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
