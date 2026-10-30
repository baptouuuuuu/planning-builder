import type { Assignment, Interval, Person, Problem, SolveResult, Task, Unscheduled } from '../domain/types';
import { formatAbs } from '../domain/types';
import { createRng } from './rng';
import { fitsAvailability, fitsWindow, softPenalty, validate } from './validate';

export interface SolveOptions {
  seed: number;
  /** Créneaux verrouillés: conservés tels quels. */
  locked?: Assignment[];
  restarts?: number;
  improveIterations?: number;
  step?: number;
}

interface Ctx {
  tasks: Map<string, Task>;
  people: Person[];
  successors: Map<string, string[]>;
  placed: Map<string, Assignment>;
  step: number;
}

const END = (c: Ctx, a: Assignment) => a.start + c.tasks.get(a.taskId)!.duration;

function busyOf(c: Ctx, personId: string, ignoreTask?: string): Interval[] {
  const res: Interval[] = [];
  for (const a of c.placed.values())
    if (a.personId === personId && a.taskId !== ignoreTask) res.push({ start: a.start, end: END(c, a) });
  return res.sort((x, y) => x.start - y.start);
}

/** Vérifie les contraintes dures pour placer `task` chez `person` à `start`. */
function feasible(c: Ctx, task: Task, person: Person, start: number, busy: Interval[]): boolean {
  const end = start + task.duration;
  if (!fitsAvailability(person, start, end) || !fitsWindow(task, start, end)) return false;
  if (busy.some((b) => b.start < end && start < b.end)) return false;
  for (const depId of task.dependsOn) {
    const d = c.placed.get(depId);
    if (!d) return false;
    if (END(c, d) > start) return false;
    if (task.chainSamePerson && d.personId !== person.id) return false;
  }
  for (const sId of c.successors.get(task.id) ?? []) {
    const s = c.placed.get(sId);
    if (!s) continue;
    if (s.start < end) return false;
    if (c.tasks.get(sId)!.chainSamePerson && s.personId !== person.id) return false;
  }
  return true;
}

function candidateStarts(c: Ctx, task: Task, person: Person, busy: Interval[]): number[] {
  let lb = task.window?.start ?? -Infinity;
  for (const depId of task.dependsOn) {
    const d = c.placed.get(depId);
    if (d) lb = Math.max(lb, END(c, d));
  }
  const set = new Set<number>();
  for (const av of person.availability) {
    const from = Math.max(av.start, lb);
    const to = av.end - task.duration;
    if (from > to) continue;
    set.add(from);
    set.add(to);
    for (let t = Math.ceil(from / c.step) * c.step; t <= to; t += c.step) set.add(t);
    for (const b of busy) {
      if (b.end >= from && b.end <= to) set.add(b.end);
      if (b.start - task.duration >= from && b.start - task.duration <= to) set.add(b.start - task.duration);
    }
    const pw = task.preferredWindow;
    if (pw) for (const t of [pw.start, pw.end - task.duration]) if (t >= from && t <= to) set.add(t);
  }
  return [...set];
}

function bestSlot(
  c: Ctx,
  task: Task,
  rng: () => number,
  noise: number,
  ignoreSelf = false,
): { personId: string; start: number; cost: number } | null {
  let best: { personId: string; start: number; cost: number } | null = null;
  for (const person of c.people) {
    const busy = busyOf(c, person.id, ignoreSelf ? task.id : undefined);
    for (const start of candidateStarts(c, task, person, busy)) {
      if (!feasible(c, task, person, start, busy)) continue;
      // Les préférences dominent; l'heure de début sert de départage (au plus tôt).
      const cost = softPenalty(task, person.id, start) + start / 1440 + rng() * noise;
      if (!best || cost < best.cost) best = { personId: person.id, start, cost };
    }
  }
  return best;
}

function topoOrder(tasks: Task[], rng: () => number, jitter: number): { order: Task[]; cyclic: Set<string> } {
  const ids = new Set(tasks.map((t) => t.id));
  const indeg = new Map(tasks.map((t) => [t.id, t.dependsOn.filter((d) => ids.has(d)).length]));
  const done = new Set<string>();
  const order: Task[] = [];
  const priority = (t: Task) =>
    (t.window ? t.window.end - t.duration : 1e9) / 1440 - t.duration / 60 + rng() * jitter;
  while (order.length < tasks.length) {
    const ready = tasks.filter((t) => !done.has(t.id) && indeg.get(t.id) === 0);
    if (ready.length === 0) break;
    ready.sort((a, b) => priority(a) - priority(b));
    const t = ready[0]!;
    done.add(t.id);
    order.push(t);
    for (const o of tasks) if (o.dependsOn.includes(t.id)) indeg.set(o.id, (indeg.get(o.id) ?? 0) - 1);
  }
  const cyclic = new Set(tasks.filter((t) => !done.has(t.id)).map((t) => t.id));
  return { order, cyclic };
}

function totalPenalty(c: Ctx): number {
  let p = 0;
  for (const a of c.placed.values()) p += softPenalty(c.tasks.get(a.taskId)!, a.personId, a.start);
  return p;
}

function attempt(problem: Problem, opts: SolveOptions, rng: () => number, jitter: number) {
  const tasks = new Map(problem.tasks.map((t) => [t.id, t]));
  const successors = new Map<string, string[]>();
  for (const t of problem.tasks)
    for (const d of t.dependsOn) successors.set(d, [...(successors.get(d) ?? []), t.id]);
  const c: Ctx = { tasks, people: problem.people, successors, placed: new Map(), step: opts.step ?? 15 };
  const unscheduled: Unscheduled[] = [];

  const lockedIds = new Set<string>();
  for (const l of opts.locked ?? []) {
    if (!tasks.has(l.taskId) || !problem.people.some((p) => p.id === l.personId)) continue;
    c.placed.set(l.taskId, { ...l, locked: true });
    lockedIds.add(l.taskId);
  }

  const free = problem.tasks.filter((t) => !lockedIds.has(t.id));
  const { order, cyclic } = topoOrder(free, rng, jitter);
  for (const id of cyclic)
    unscheduled.push({ taskId: id, code: 'cycle', reason: 'Dépendance circulaire.' });

  const failed = new Set<string>(cyclic);
  for (const task of order) {
    const missing = task.dependsOn.find((d) => !c.placed.has(d));
    if (missing) {
      const name = tasks.get(missing)?.name ?? missing;
      unscheduled.push({
        taskId: task.id,
        code: 'dependency-unscheduled',
        reason: `Dépend de « ${name} » qui n'est pas planifiée.`,
      });
      failed.add(task.id);
      continue;
    }
    const slot = bestSlot(c, task, rng, jitter ? 5 : 0);
    if (slot) c.placed.set(task.id, { taskId: task.id, personId: slot.personId, start: slot.start, locked: false });
    else {
      failed.add(task.id);
      unscheduled.push(diagnose(problem, task));
    }
  }

  // Amélioration locale: relocaliser les tâches non verrouillées si le coût baisse.
  const iterations = opts.improveIterations ?? 200;
  const movable = [...c.placed.values()].filter((a) => !a.locked).map((a) => a.taskId);
  for (let i = 0; i < iterations && movable.length > 0; i++) {
    const id = movable[Math.floor(rng() * movable.length)]!;
    const cur = c.placed.get(id)!;
    const task = tasks.get(id)!;
    const curCost = softPenalty(task, cur.personId, cur.start);
    c.placed.delete(id);
    const slot = bestSlot(c, task, rng, 3);
    if (slot && softPenalty(task, slot.personId, slot.start) < curCost)
      c.placed.set(id, { taskId: id, personId: slot.personId, start: slot.start, locked: false });
    else c.placed.set(id, cur);
  }

  const penalty = totalPenalty(c);
  return { c, unscheduled, penalty };
}

function diagnose(problem: Problem, task: Task): Unscheduled {
  const base = { taskId: task.id };
  if (problem.people.length === 0)
    return { ...base, code: 'no-person', reason: "Aucune personne dans l'équipe." };
  const maxAvail = Math.max(
    0,
    ...problem.people.flatMap((p) => p.availability.map((a) => a.end - a.start)),
  );
  if (task.duration > maxAvail)
    return { ...base, code: 'too-long', reason: `Durée (${task.duration} min) supérieure à toute disponibilité.` };
  if (task.window) {
    const usable = problem.people.some((p) =>
      p.availability.some(
        (a) => Math.max(a.start, task.window!.start) + task.duration <= Math.min(a.end, task.window!.end),
      ),
    );
    if (!usable)
      return {
        ...base,
        code: 'no-slot',
        reason: `Personne n'est disponible dans la plage ${formatAbs(task.window.start, problem.settings.startDate)} – ${formatAbs(task.window.end, problem.settings.startDate)}.`,
      };
  }
  return {
    ...base,
    code: 'no-slot',
    reason: 'Aucun créneau libre compatible (disponibilités, chevauchements, dépendances ou créneaux verrouillés).',
  };
}

/** Heuristique gloutonne + amélioration locale, avec redémarrages seedés. */
export function solve(problem: Problem, options: SolveOptions): SolveResult {
  const restarts = options.restarts ?? 12;
  const rng = createRng(options.seed);
  const total = problem.tasks.length;
  let best: ReturnType<typeof attempt> | null = null;
  let bestScore = -Infinity;
  for (let r = 0; r < restarts; r++) {
    // Le redémarrage 0 est quasi déterministe (jitter faible) mais reste dépendant de la seed.
    const res = attempt(problem, options, rng, r === 0 ? 0.5 : 2 + r / 2);
    const score = res.c.placed.size * 100 - res.penalty;
    if (score > bestScore) {
      best = res;
      bestScore = score;
    }
  }
  const { c, unscheduled, penalty } = best!;
  const assignments = problem.tasks.flatMap((t) => (c.placed.has(t.id) ? [c.placed.get(t.id)!] : []));

  // Les créneaux verrouillés invalides sont signalés sans être supprimés.
  const conflicts = validate(problem, assignments);
  return {
    assignments,
    unscheduled,
    conflicts,
    score: assignments.length * 100 - penalty,
    maxScore: total * 100,
    penalty,
    seed: options.seed,
  };
}
