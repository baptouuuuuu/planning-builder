import type { Task } from './types';

export type Relation = 'none' | 'linked' | 'follows' | 'followed';

/** Les anciens liens multiples sont conservés par paires selon l'ordre des tâches. */
export function normalizeLinks(tasks: Task[]): { tasks: Task[]; changes: string[] } {
  const result = tasks.map((t) => ({ ...t, linkedTo: [] as string[] }));
  const byId = new Map(result.map((t) => [t.id, t]));
  const used = new Set<string>();
  const seen = new Set<string>();
  const changes: string[] = [];
  const sameWindow = (a: Task['window'], b: Task['window']) =>
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

export function updateTask(tasks: Task[], id: string, patch: Partial<Task>): Task[] {
  const task = tasks.find((t) => t.id === id);
  const shared: Partial<Task> = {};
  if ('window' in patch) shared.window = patch.window;
  if ('preferredWindow' in patch) shared.preferredWindow = patch.preferredWindow;
  if ('linkGap' in patch) shared.linkGap = patch.linkGap;
  return tasks.map((t) => t.id === id ? { ...t, ...patch }
    : task?.linkedTo.includes(t.id) ? { ...t, ...shared } : t);
}

export function withoutRelation(tasks: Task[], t: Task, o: Task): Task[] {
  return tasks.map((x) =>
    x.id === t.id ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== o.id), linkedTo: x.linkedTo.filter((d) => d !== o.id) }
    : x.id === o.id ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== t.id), linkedTo: x.linkedTo.filter((d) => d !== t.id) }
    : x,
  );
}

export function setTaskRelation(tasks: Task[], t: Task, o: Task, rel: Relation): Task[] {
  return withoutRelation(tasks, t, o).map((x) => {
    if (rel === 'linked') {
      if (x.id === t.id) return { ...x, linkedTo: [o.id], linkGap: 0, window: o.window, preferredWindow: o.preferredWindow };
      if (x.id === o.id) return { ...x, linkedTo: [t.id], linkGap: 0 };
      if (t.linkedTo.includes(x.id)) return { ...x, linkedTo: x.linkedTo.filter((id) => id !== t.id) };
    }
    if (rel === 'follows' && x.id === t.id) return { ...x, dependsOn: [...x.dependsOn, o.id] };
    if (rel === 'followed' && x.id === o.id) return { ...x, dependsOn: [...x.dependsOn, t.id] };
    return x;
  });
}

export function duplicateTask(t: Task, id: string): Task {
  return {
    ...t,
    id,
    name: `${t.name} (copie)`,
    preferredPersonIds: [...t.preferredPersonIds],
    dependsOn: [...t.dependsOn],
    linkedTo: [],
    linkGap: 0,
  };
}
