import type { Assignment, Conflict, Interval, Person, Problem, ScheduledTask as Task } from '../domain/types';
import { formatAbs, scheduledTasks } from '../domain/types';

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function fitsAvailability(person: Person, start: number, end: number): boolean {
  return person.availability.some((a) => a.start <= start && end <= a.end);
}

export function fitsWindow(task: Task, start: number, end: number): boolean {
  return !task.window || (task.window.start <= start && end <= task.window.end);
}

export function isPossiblePerson(task: Task, personId: string): boolean {
  return task.possiblePersonIds === undefined || task.possiblePersonIds.includes(personId);
}

/** Vérifie toutes les contraintes dures d'un jeu d'affectations. */
export function validate(problem: Problem, assignments: Assignment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const taskMap = new Map(scheduledTasks(problem.tasks).map((t) => [t.id, t]));
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
    if (!isPossiblePerson(task, person.id))
      conflicts.push({ taskId: task.id, message: `${person.name} ne peut pas effectuer cette tâche.` });
    if (!fitsAvailability(person, a.start, end))
      conflicts.push({ taskId: task.id, message: `${person.name} n'est pas disponible à ${formatAbs(a.start, problem.settings.startDate)}.` });
    if (!fitsWindow(task, a.start, end))
      conflicts.push({ taskId: task.id, message: 'Hors de la plage horaire imposée.' });
    for (const depId of task.dependsOn) {
      const dep = byTask.get(depId);
      const depTask = taskMap.get(depId);
      if (!dep && depTask)
        conflicts.push({ taskId: task.id, message: `La sous-tâche précédente « ${depTask.name} » n'est pas planifiée.` });
      else if (dep && depTask && dep.start + depTask.duration > a.start)
        conflicts.push({ taskId: task.id, message: `Commence avant la fin de « ${depTask.name} ».` });
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
export function softPenalty(task: Task, personId: string): number {
  const preferred = task.preferredPersonIds.filter((id) => isPossiblePerson(task, id));
  return preferred.length > 0 && !preferred.includes(personId) ? 30 : 0;
}
