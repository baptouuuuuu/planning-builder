import { create } from 'zustand';
import type { Assignment, Person, Problem, ScheduledTask, Settings, SolveResult, Task } from '../domain/types';
import { solve } from '../solver/solve';
import { validate } from '../solver/validate';
import { validStarts } from '../solver/placement';
import { samplePeople, sampleSettings, sampleTasks } from '../data/sample';
import { migrateLegacyTasks, migrateTaskOrdering } from '../domain/taskRelations';

/** État versionné par l'historique (annuler / rétablir). */
export interface Snapshot {
  people: Person[];
  tasks: Task[];
  settings: Settings;
  assignments: Assignment[];
  result: SolveResult | null;
  seed: number;
  migrationNotice?: string[];
}

interface State extends Snapshot {
  past: Snapshot[];
  future: Snapshot[];
  setPeople: (people: Person[]) => void;
  setTasks: (tasks: Task[]) => void;
  setSettings: (settings: Settings) => void;
  generate: () => void;
  regenerate: () => void;
  toggleLock: (taskId: string) => void;
  moveAssignment: (taskId: string, personId: string, start: number) => boolean;
  clearUnlocked: () => void;
  undo: () => void;
  redo: () => void;
  loadSample: () => void;
  reset: () => void;
  exportJson: () => string;
  importJson: (json: string) => void;
  dismissMigrationNotice: () => void;
}

const KEY = 'planning-builder:v1';
const HISTORY_LIMIT = 100;

const emptySnapshot = (): Snapshot => ({
  people: [],
  tasks: [],
  settings: { horizonDays: 5, dayStart: 480, dayEnd: 1080 },
  assignments: [],
  result: null,
  seed: 1,
});

const pick = (s: Snapshot): Snapshot => ({
  people: s.people,
  tasks: s.tasks,
  settings: s.settings,
  assignments: s.assignments,
  result: s.result,
  seed: s.seed,
  migrationNotice: s.migrationNotice,
});

function load(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Snapshot;
      if (Array.isArray(parsed.people) && Array.isArray(parsed.tasks)) {
        const legacy = parsed.tasks.some((task) => !Array.isArray(task.subtasks));
        const grouped = legacy
          ? migrateLegacyTasks(parsed.tasks as unknown as ScheduledTask[])
          : { tasks: parsed.tasks, changes: [] as string[] };
        const ordering = migrateTaskOrdering(grouped.tasks);
        const normalized = { tasks: ordering.tasks, changes: [...grouped.changes, ...ordering.changes] };
        if (normalized.changes.length) {
          try {
            if (!localStorage.getItem(`${KEY}:avant-ordre`)) localStorage.setItem(`${KEY}:avant-ordre`, raw);
          } catch (error) {
            console.error('Impossible de sauvegarder les données avant migration des liens.', error);
          }
        }
        return {
          ...parsed,
          tasks: normalized.tasks,
          result: normalized.changes.length ? null : parsed.result,
          migrationNotice: [...(parsed.migrationNotice ?? []), ...normalized.changes],
        };
      }
    }
  } catch {
    /* données corrompues: on repart de l'exemple */
  }
  return sampleSnapshot();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInterval(value: unknown): value is { start: number; end: number } {
  return isRecord(value) && Number.isFinite(value.start) && Number.isFinite(value.end);
}

function isSubtask(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Number.isFinite(value.duration) &&
    Array.isArray(value.preferredPersonIds) && value.preferredPersonIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.dependsOn) && value.dependsOn.every((id) => typeof id === 'string') &&
    Array.isArray(value.linkedTo) && value.linkedTo.every((id) => typeof id === 'string') &&
    typeof value.chainSamePerson === 'boolean' &&
    (value.possiblePersonIds === undefined ||
      (Array.isArray(value.possiblePersonIds) && value.possiblePersonIds.every((id) => typeof id === 'string'))) &&
    (value.linkGap === undefined || Number.isFinite(value.linkGap));
}

function isExport(value: unknown): value is {
  version: 2;
  people: Person[];
  tasks: Task[];
  settings: Settings;
  assignments: Assignment[];
  seed: number;
} {
  if (!isRecord(value) || value.version !== 2 ||
    !Array.isArray(value.people) || !Array.isArray(value.tasks) ||
    !Array.isArray(value.assignments) || !Number.isFinite(value.seed) ||
    !isRecord(value.settings)) return false;
  const { settings } = value;
  return Number.isInteger(settings.horizonDays) && (settings.horizonDays as number) >= 1 &&
    (settings.horizonDays as number) <= 14 &&
    Number.isFinite(settings.dayStart) && Number.isFinite(settings.dayEnd) &&
    (settings.startDate === undefined || typeof settings.startDate === 'string') &&
    value.people.every((person) =>
      isRecord(person) && typeof person.id === 'string' && typeof person.name === 'string' &&
      typeof person.color === 'string' && Array.isArray(person.availability) &&
      person.availability.every(isInterval)) &&
    value.tasks.every((task) =>
      isRecord(task) && typeof task.id === 'string' && typeof task.name === 'string' &&
      Array.isArray(task.subtasks) && task.subtasks.every(isSubtask) &&
      (task.window === undefined || isInterval(task.window)) &&
      (task.ordered === undefined || typeof task.ordered === 'boolean') &&
      (task.compact === undefined || typeof task.compact === 'boolean')) &&
    value.assignments.every((assignment) =>
      isRecord(assignment) && typeof assignment.taskId === 'string' &&
      typeof assignment.personId === 'string' && Number.isFinite(assignment.start) &&
      typeof assignment.locked === 'boolean');
}

const problemOf = (s: Snapshot): Problem => ({ people: s.people, tasks: s.tasks, settings: s.settings });

/** Retire les affectations devenues orphelines après une modification des données. */
function sanitize(s: Snapshot): Snapshot {
  const tasks = new Set(s.tasks.flatMap((t) => t.subtasks.map((subtask) => subtask.id)));
  const people = new Set(s.people.map((p) => p.id));
  const assignments = s.assignments.filter((a) => tasks.has(a.taskId) && people.has(a.personId));
  return { ...s, assignments };
}

/** Lance le solveur en conservant les créneaux verrouillés. */
function run(s: Snapshot, seed: number): Snapshot {
  const locked = s.assignments.filter((a) => a.locked);
  const result = solve(problemOf(s), { seed, locked });
  return { ...s, seed, assignments: result.assignments, result };
}

const sampleSnapshot = (): Snapshot => {
  const seed = Math.floor(Math.random() * 2 ** 31);
  return run({
    people: samplePeople,
    tasks: sampleTasks,
    settings: sampleSettings,
    assignments: [],
    result: null,
    seed,
  }, seed);
};

export const useStore = create<State>((set, get) => {
  const commit = (next: Snapshot) => {
    const cur = pick(get());
    set({ ...next, past: [...get().past, cur].slice(-HISTORY_LIMIT), future: [] });
  };
  return {
    ...load(),
    past: [],
    future: [],
    setPeople: (people) => commit(sanitize({ ...pick(get()), people, result: null })),
    setTasks: (tasks) => commit(sanitize({ ...pick(get()), tasks, result: null })),
    setSettings: (settings) => commit({ ...pick(get()), settings, result: null }),
    generate: () => commit(run(pick(get()), get().seed)),
    regenerate: () => commit(run(pick(get()), Math.floor(Math.random() * 2 ** 31))),
    toggleLock: (taskId) => {
      const s = pick(get());
      const assignments = s.assignments.map((a) => (a.taskId === taskId ? { ...a, locked: !a.locked } : a));
      const next = { ...s, assignments };
      if (s.result) next.result = { ...s.result, assignments, conflicts: validate(problemOf(s), assignments) };
      commit(next);
    },
    moveAssignment: (taskId, personId, start) => {
      const s = pick(get());
      const current = s.assignments.find((a) => a.taskId === taskId);
      if (!current || !Number.isInteger(start) ||
        !validStarts(problemOf(s), s.assignments, taskId, personId).some((r) => r.start <= start && start <= r.end)) return false;
      if (current.personId === personId && current.start === start) return true;
      const assignments = s.assignments.map((a) => a.taskId === taskId ? { ...a, personId, start } : a);
      commit({ ...s, assignments, result: null });
      return true;
    },
    clearUnlocked: () => {
      const s = pick(get());
      commit({ ...s, assignments: s.assignments.filter((a) => a.locked), result: null });
    },
    undo: () => {
      const { past, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ ...prev, past: past.slice(0, -1), future: [pick(get()), ...future] });
    },
    redo: () => {
      const { past, future } = get();
      const nxt = future[0];
      if (!nxt) return;
      set({ ...nxt, past: [...past, pick(get())], future: future.slice(1) });
    },
    loadSample: () => commit(sampleSnapshot()),
    reset: () => commit(emptySnapshot()),
    dismissMigrationNotice: () => set({ migrationNotice: undefined }),
    exportJson: () => {
      const s = get();
      return JSON.stringify(
        { version: 2, people: s.people, tasks: s.tasks, settings: s.settings, assignments: s.assignments, seed: s.seed },
        null,
        2,
      );
    },
    importJson: (json) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('Le fichier sélectionné ne contient pas un JSON valide.');
      }
      if (!isExport(parsed)) {
        throw new Error("Le fichier ne correspond pas au format JSON exporté par l'application.");
      }
      commit(sanitize({
        people: parsed.people,
        tasks: parsed.tasks,
        settings: parsed.settings,
        assignments: parsed.assignments,
        result: null,
        seed: parsed.seed,
        migrationNotice: undefined,
      }));
    },
  };
});

useStore.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(pick(s)));
  } catch {
    /* quota ou mode privé: ignoré */
  }
});
