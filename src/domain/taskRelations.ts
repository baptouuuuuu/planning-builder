import type { ScheduledTask, Task } from './types';

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
      id: `parent:${t.id}`, name: t.name, window: t.window,
      subtasks: group.map(({ window: _window, preferredWindow: _preferredWindow, ...subtask }) => subtask),
    });
  }
  return { tasks, changes: ['Les anciennes tâches sont devenues des sous-tâches ; leurs affectations ont été conservées.', ...normalized.changes] };
}

/** Convertit les anciennes relations explicites vers l'ordre d'affichage, si équivalent. */
export function migrateTaskOrdering(tasks: Task[]): { tasks: Task[]; changes: string[] } {
  const changes: string[] = [];
  const migrated = tasks.map((task) => {
    const old = task as Task & { preferredWindow?: ScheduledTask['preferredWindow'] };
    const hasRelations = task.subtasks.some((s) => s.dependsOn.length || s.linkedTo.length || s.chainSamePerson || s.linkGap);
    const ordered = task.ordered ?? (task.subtasks.length > 1 && task.subtasks.every((s, i) =>
      i === 0 ? s.dependsOn.length === 0
        : s.dependsOn.length === 1 && s.dependsOn[0] === task.subtasks[i - 1]!.id));
    if (hasRelations || old.preferredWindow) {
      changes.push(`Relations et plage préférée de « ${task.name} » supprimées ou adaptées au nouvel ordre des sous-tâches.`);
    }
    const { preferredWindow: _preferredWindow, ...rest } = old;
    return {
      ...rest, ordered,
      subtasks: task.subtasks.map((s) => ({
        ...s, dependsOn: [], linkedTo: [], linkGap: undefined, chainSamePerson: false,
      })),
    };
  });
  return { tasks: migrated, changes };
}
