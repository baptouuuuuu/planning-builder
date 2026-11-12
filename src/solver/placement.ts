import { DAY, scheduledTasks } from '../domain/types';
import type { Assignment, Interval, Problem } from '../domain/types';

/** Intervalles inclusifs des minutes de début possibles pour une affectation. */
export function validStarts(problem: Problem, assignments: Assignment[], taskId: string, personId: string): Interval[] {
  const tasks = scheduledTasks(problem.tasks);
  const task = tasks.find((t) => t.id === taskId);
  const person = problem.people.find((p) => p.id === personId);
  if (!task || !person || task.duration <= 0) return [];

  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const placed = new Map(assignments.map((a) => [a.taskId, a]));
  let earliest = Math.max(0, task.window?.start ?? 0);
  let latest = Math.min(problem.settings.horizonDays * DAY - 1, (task.window?.end ?? Infinity) - task.duration);
  for (const id of task.dependsOn) {
    const dependency = placed.get(id);
    const dependencyTask = byTask.get(id);
    if (!dependency || !dependencyTask) return [];
    earliest = Math.max(earliest, dependency.start + dependencyTask.duration);
  }
  for (const successor of tasks.filter((t) => t.dependsOn.includes(taskId))) {
    const assignment = placed.get(successor.id);
    if (assignment) latest = Math.min(latest, assignment.start - task.duration);
  }

  let ranges = person.availability
    .map((a) => ({ start: Math.max(a.start, earliest), end: Math.min(a.end - task.duration, latest) }))
    .filter((a) => a.start <= a.end);
  for (const assignment of assignments) {
    if (assignment.taskId === taskId || assignment.personId !== personId) continue;
    const other = byTask.get(assignment.taskId);
    if (!other) continue;
    // Deux tâches peuvent se toucher, mais ne peuvent pas se chevaucher.
    const from = assignment.start - task.duration + 1;
    const to = assignment.start + other.duration - 1;
    ranges = ranges.flatMap((range) => {
      if (to < range.start || from > range.end) return [range];
      return [
        { start: range.start, end: Math.min(range.end, from - 1) },
        { start: Math.max(range.start, to + 1), end: range.end },
      ].filter((r) => r.start <= r.end);
    });
  }
  return ranges.sort((a, b) => a.start - b.start);
}
