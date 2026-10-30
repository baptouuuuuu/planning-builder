import type { Assignment, Person, Settings, Task } from './types';
import { DAY, dayLabel, formatTime } from './types';

/** Résumé texte: par jour, puis par personne, une ligne par tâche. */
export function exportPlanningText(
  people: Person[],
  tasks: Task[],
  assignments: Assignment[],
  settings: Settings,
): string {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const lines: string[] = [];
  for (let d = 0; d < settings.horizonDays; d++) {
    const base = d * DAY;
    const dayLines: string[] = [];
    for (const p of people) {
      const mine = assignments
        .filter((a) => a.personId === p.id && a.start >= base && a.start < base + DAY && taskMap.has(a.taskId))
        .sort((a, b) => a.start - b.start);
      if (mine.length === 0) continue;
      dayLines.push(`${p.name} :`);
      for (const a of mine) {
        const t = taskMap.get(a.taskId)!;
        dayLines.push(`- ${formatTime(a.start - base)} - ${formatTime(a.start + t.duration - base)} : ${t.name} (${t.duration} min)`);
      }
    }
    if (dayLines.length === 0) continue;
    if (lines.length) lines.push('');
    lines.push(`${dayLabel(d, settings.startDate)}`, ...dayLines);
  }
  return lines.join('\n');
}
