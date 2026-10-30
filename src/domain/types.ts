/** Toutes les dates sont des minutes absolues: jour * 1440 + minute du jour. */
export const DAY = 1440;

export interface Interval {
  start: number;
  end: number;
}

export interface Person {
  id: string;
  name: string;
  color: string;
  /** Disponibilités en minutes absolues. */
  availability: Interval[];
}

export interface Task {
  id: string;
  name: string;
  duration: number;
  /** Contrainte dure: la tâche doit tenir entièrement dans cette plage. */
  window?: Interval;
  /** Préférence souple de plage horaire. */
  preferredWindow?: Interval;
  /** Préférence souple de personnes. */
  preferredPersonIds: string[];
  /** Tâches qui doivent être terminées avant le début de celle-ci. */
  dependsOn: string[];
  /** Si vrai, même personne que les tâches dont elle dépend (enchaînement). */
  chainSamePerson: boolean;
}

export interface Assignment {
  taskId: string;
  personId: string;
  start: number;
  locked: boolean;
}

export interface Settings {
  horizonDays: number;
  /** Plage affichée sur la timeline (minutes du jour). */
  dayStart: number;
  dayEnd: number;
}

export interface Problem {
  people: Person[];
  tasks: Task[];
  settings: Settings;
}

export type ReasonCode =
  | 'no-person'
  | 'no-slot'
  | 'dependency-unscheduled'
  | 'cycle'
  | 'too-long'
  | 'locked-invalid';

export interface Unscheduled {
  taskId: string;
  code: ReasonCode;
  reason: string;
}

export interface Conflict {
  taskId: string;
  message: string;
}

export interface SolveResult {
  assignments: Assignment[];
  unscheduled: Unscheduled[];
  conflicts: Conflict[];
  /** Score brut: 100 par tâche planifiée moins les pénalités de préférences. */
  score: number;
  maxScore: number;
  /** Pénalité cumulée des contraintes souples. */
  penalty: number;
  seed: number;
}

export const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatTime(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}

export function formatAbs(t: number): string {
  const d = Math.floor(t / DAY);
  return `${DAY_NAMES[d % 7] ?? '?'} ${formatTime(t - d * DAY)}`;
}

export function parseTime(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
