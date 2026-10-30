import { create } from 'zustand';
import type { Assignment, Person, Problem, Settings, SolveResult, Task } from '../domain/types';
import { solve } from '../solver/solve';
import { validate } from '../solver/validate';
import { samplePeople, sampleSettings, sampleTasks } from '../data/sample';

/** État versionné par l'historique (annuler / rétablir). */
export interface Snapshot {
  people: Person[];
  tasks: Task[];
  settings: Settings;
  assignments: Assignment[];
  result: SolveResult | null;
  seed: number;
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
  clearUnlocked: () => void;
  undo: () => void;
  redo: () => void;
  loadSample: () => void;
  reset: () => void;
  exportJson: () => string;
}

const KEY = 'planning-builder:v1';
const HISTORY_LIMIT = 100;

const sampleSnapshot = (): Snapshot => ({
  people: samplePeople,
  tasks: sampleTasks,
  settings: sampleSettings,
  assignments: [],
  result: null,
  seed: 1,
});

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
});

function load(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Snapshot;
      if (Array.isArray(parsed.people) && Array.isArray(parsed.tasks))
        return { ...parsed, tasks: parsed.tasks.map((t) => ({ ...t, linkedTo: t.linkedTo ?? [] })) };
    }
  } catch {
    /* données corrompues: on repart de l'exemple */
  }
  return sampleSnapshot();
}

const problemOf = (s: Snapshot): Problem => ({ people: s.people, tasks: s.tasks, settings: s.settings });

/** Retire les affectations devenues orphelines après une modification des données. */
function sanitize(s: Snapshot): Snapshot {
  const tasks = new Set(s.tasks.map((t) => t.id));
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

export const useStore = create<State>((set, get) => {
  const commit = (next: Snapshot) => {
    const cur = pick(get());
    set({ ...next, past: [...get().past, cur].slice(-HISTORY_LIMIT), future: [] });
  };
  return {
    ...load(),
    past: [],
    future: [],
    setPeople: (people) => commit(sanitize({ ...pick(get()), people })),
    setTasks: (tasks) => commit(sanitize({ ...pick(get()), tasks })),
    setSettings: (settings) => commit({ ...pick(get()), settings }),
    generate: () => commit(run(pick(get()), get().seed)),
    regenerate: () => commit(run(pick(get()), Math.floor(Math.random() * 2 ** 31))),
    toggleLock: (taskId) => {
      const s = pick(get());
      const assignments = s.assignments.map((a) => (a.taskId === taskId ? { ...a, locked: !a.locked } : a));
      const next = { ...s, assignments };
      if (s.result) next.result = { ...s.result, assignments, conflicts: validate(problemOf(s), assignments) };
      commit(next);
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
    exportJson: () => {
      const s = get();
      return JSON.stringify(
        { version: 1, people: s.people, tasks: s.tasks, settings: s.settings, assignments: s.assignments, seed: s.seed },
        null,
        2,
      );
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
