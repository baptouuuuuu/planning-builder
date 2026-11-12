import type { Task } from './types';

export type Relation = 'none' | 'linked' | 'follows' | 'followed';

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
