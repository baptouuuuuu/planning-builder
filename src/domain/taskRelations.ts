import type { ScheduledTask, Subtask, Task } from './types';

export type Relation = 'none' | 'linked' | 'follows' | 'followed';

/** Les anciens liens multiples sont conservés par paires selon l'ordre des tâches. */
export function normalizeLinks(tasks: ScheduledTask[]): { tasks: ScheduledTask[]; changes: string[] } {
  const result = tasks.map((t) => ({ ...t, linkedTo: [] as string[] }));
  const byId = new Map(result.map((t) => [t.id, t]));
  const used = new Set<string>();
  const seen = new Set<string>();
  const changes: string[] = [];
  const sameWindow = (a: ScheduledTask['window'], b: ScheduledTask['window']) =>
    a?.start === b?.start && a?.end === b?.end;

  for (const original of tasks) {
    for (const id of original.linkedTo ?? []) {
      const key = [original.id, id].sort().join('\0');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = byId.get(original.id)!;
      const b = byId.get(id);
      if (!b || a.id === b.id || used.has(a.id) || used.has(b.id)) {
        changes.push(`Lien supprimé : ${a.name} / ${b?.name ?? id}.`);
        continue;
      }
      used.add(a.id);
      used.add(b.id);
      a.linkedTo = [b.id];
      b.linkedTo = [a.id];
      const other = tasks.find((t) => t.id === id)!;
      if (!(other.linkedTo ?? []).includes(a.id))
        changes.push(`Lien réciproque rétabli : ${a.name} / ${b.name}.`);
      if (!sameWindow(a.window, b.window) || !sameWindow(a.preferredWindow, b.preferredWindow))
        changes.push(`Plages de ${a.name} alignées sur celles de ${b.name}.`);
      a.window = b.window;
      a.preferredWindow = b.preferredWindow;
      const gap = Math.max(a.linkGap ?? 0, b.linkGap ?? 0);
      if ((a.linkGap ?? 0) !== (b.linkGap ?? 0))
        changes.push(`Marge harmonisée pour ${a.name} / ${b.name} : ${gap} min.`);
      a.linkGap = gap;
      b.linkGap = gap;
    }
  }
  return { tasks: result, changes };
}

export function updateTask(tasks: Subtask[], id: string, patch: Partial<Subtask>): Subtask[] {
  const task = tasks.find((t) => t.id === id);
  const shared: Partial<Subtask> = {};
  if ('linkGap' in patch) shared.linkGap = patch.linkGap;
  return tasks.map((t) => t.id === id ? { ...t, ...patch }
    : task?.linkedTo.includes(t.id) ? { ...t, ...shared } : t);
}

export function withoutRelation(tasks: Subtask[], t: Subtask, o: Subtask): Subtask[] {
  return tasks.map((x) =>
    x.id === t.id ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== o.id), linkedTo: x.linkedTo.filter((d) => d !== o.id) }
    : x.id === o.id ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== t.id), linkedTo: x.linkedTo.filter((d) => d !== t.id) }
    : x,
  );
}

export function setTaskRelation(tasks: Subtask[], t: Subtask, o: Subtask, rel: Relation): Subtask[] {
  return withoutRelation(tasks, t, o).map((x) => {
    if (rel === 'linked') {
      if (x.id === t.id) return { ...x, linkedTo: [o.id], linkGap: 0 };
      if (x.id === o.id) return { ...x, linkedTo: [t.id], linkGap: 0 };
      if (t.linkedTo.includes(x.id)) return { ...x, linkedTo: x.linkedTo.filter((id) => id !== t.id) };
    }
    if (rel === 'follows' && x.id === t.id) return { ...x, dependsOn: [...x.dependsOn, o.id] };
    if (rel === 'followed' && x.id === o.id) return { ...x, dependsOn: [...x.dependsOn, t.id] };
    return x;
  });
}

export function duplicateTask(t: Task, id: string, newId: () => string): Task {
  const ids = new Map(t.subtasks.map((s) => [s.id, newId()]));
  return {
    ...t,
    id,
    name: `${t.name} (copie)`,
    subtasks: t.subtasks.map((s) => ({
      ...s, id: ids.get(s.id)!, preferredPersonIds: [...s.preferredPersonIds],
      dependsOn: s.dependsOn.flatMap((dep) => ids.has(dep) ? [ids.get(dep)!] : []),
      linkedTo: s.linkedTo.flatMap((link) => ids.has(link) ? [ids.get(link)!] : []),
    })),
  };
}

/** Préserve les identifiants des affectations et les relations entre anciennes tâches. */
export function migrateLegacyTasks(legacy: ScheduledTask[]): { tasks: Task[]; changes: string[] } {
  const normalized = normalizeLinks(legacy);
  const byId = new Map(normalized.tasks.map((t) => [t.id, t]));
  const used = new Set<string>();
  const tasks: Task[] = [];
  for (const t of normalized.tasks) {
    if (used.has(t.id)) continue;
    const linked = t.linkedTo.map((id) => byId.get(id)).filter((x): x is ScheduledTask => !!x && !used.has(x.id));
    const group = [t, ...linked];
    group.forEach((s) => used.add(s.id));
    tasks.push({
      id: `parent:${t.id}`, name: t.name, window: t.window, preferredWindow: t.preferredWindow,
      subtasks: group.map(({ window: _window, preferredWindow: _preferredWindow, ...subtask }) => subtask),
    });
  }
  return { tasks, changes: ['Les anciennes tâches sont devenues des sous-tâches ; leurs affectations ont été conservées.', ...normalized.changes] };
}
