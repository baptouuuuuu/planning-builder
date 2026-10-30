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
  /** Tâches liées (relation symétrique, sans ordre): faites par la même personne. */
  linkedTo: string[];
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
  /** Date réelle (AAAA-MM-JJ) du jour 0. Sans date, les jours sont des Lun…Dim génériques. */
  startDate?: string;
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

/** Heure « HH:MM », suffixée de « +N » au-delà de minuit. */
export function formatTime(minutes: number): string {
  const extra = Math.floor(minutes / DAY);
  const m = minutes - extra * DAY;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}${extra > 0 ? ` +${extra}` : ''}`;
}

/** Libellé du jour d (0 = premier jour), avec la date réelle si `startDate` est défini. */
export function dayLabel(d: number, startDate?: string): string {
  const base = startDate ? new Date(`${startDate}T00:00:00Z`) : null;
  if (!base || Number.isNaN(base.getTime())) return `${DAY_NAMES[d % 7] ?? '?'}${d >= 7 ? ` +${Math.floor(d / 7)}` : ''}`;
  const date = new Date(base.getTime() + d * DAY * 60000);
  const wd = DAY_NAMES[(date.getUTCDay() + 6) % 7];
  return `${wd} ${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

export function formatAbs(t: number, startDate?: string): string {
  const d = Math.floor(t / DAY);
  return `${dayLabel(d, startDate)} ${formatTime(t - d * DAY)}`;
}

/** Vrai si faire dépendre `taskId` de `depId` créerait une boucle. */
export function wouldCycle(tasks: Task[], taskId: string, depId: string): boolean {
  if (taskId === depId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [depId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.dependsOn ?? []));
  }
  return false;
}

export function parseTime(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
