import type { Assignment, Conflict, Interval, Person, Problem, Task } from '../domain/types';
import { formatAbs } from '../domain/types';

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function fitsAvailability(person: Person, start: number, end: number): boolean {
  return person.availability.some((a) => a.start <= start && end <= a.end);
}

export function fitsWindow(task: Task, start: number, end: number): boolean {
  return !task.window || (task.window.start <= start && end <= task.window.end);
}

/** Vérifie toutes les contraintes dures d'un jeu d'affectations. */
export function validate(problem: Problem, assignments: Assignment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const taskMap = new Map(problem.tasks.map((t) => [t.id, t]));
  const personMap = new Map(problem.people.map((p) => [p.id, p]));
  const byTask = new Map(assignments.map((a) => [a.taskId, a]));

  for (const a of assignments) {
    const task = taskMap.get(a.taskId);
    const person = personMap.get(a.personId);
    if (!task || !person) {
      conflicts.push({ taskId: a.taskId, message: 'Tâche ou personne introuvable.' });
      continue;
    }
    const end = a.start + task.duration;
    if (!fitsAvailability(person, a.start, end))
      conflicts.push({ taskId: task.id, message: `${person.name} n'est pas disponible à ${formatAbs(a.start, problem.settings.startDate)}.` });
    if (!fitsWindow(task, a.start, end))
      conflicts.push({ taskId: task.id, message: 'Hors de la plage horaire imposée.' });
    for (const depId of task.dependsOn) {
      const dep = byTask.get(depId);
      const depTask = taskMap.get(depId);
      if (dep && depTask && dep.start + depTask.duration > a.start)
        conflicts.push({ taskId: task.id, message: `Commence avant la fin de « ${depTask.name} ».` });
      if (dep && task.chainSamePerson && dep.personId !== a.personId)
        conflicts.push({ taskId: task.id, message: `Doit être faite par la même personne que « ${depTask?.name} ».` });
    }
    for (const lId of task.linkedTo ?? []) {
      const l = byTask.get(lId);
      if (l && l.personId !== a.personId && task.id < lId)
        conflicts.push({ taskId: task.id, message: `Doit être faite par la même personne que « ${taskMap.get(lId)?.name} » (liées).` });
    }
  }
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i]!;
      const b = assignments[j]!;
      const ta = taskMap.get(a.taskId);
      const tb = taskMap.get(b.taskId);
      if (!ta || !tb || a.personId !== b.personId) continue;
      if (overlaps({ start: a.start, end: a.start + ta.duration }, { start: b.start, end: b.start + tb.duration }))
        conflicts.push({ taskId: b.taskId, message: `Chevauche « ${ta.name} » pour la même personne.` });
    }
  }
  return conflicts;
}

/** Pénalité des contraintes souples pour une affectation. */
export function softPenalty(task: Task, personId: string, start: number): number {
  let p = 0;
  if (task.preferredPersonIds.length > 0 && !task.preferredPersonIds.includes(personId)) p += 30;
  const pw = task.preferredWindow;
  if (pw) {
    const end = start + task.duration;
    const outside = Math.max(0, pw.start - start) + Math.max(0, end - pw.end);
    if (outside > 0) p += 10 + Math.min(30, Math.ceil(outside / 15));
  }
  return p;
}
