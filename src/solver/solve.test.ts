import { describe, expect, it } from 'vitest';
import { solve } from './solve';
import { validate } from './validate';
import type { Person, Problem, Subtask, Task } from '../domain/types';

const H = 60;
const person = (id: string, ...av: [number, number][]): Person => ({
  id,
  name: id,
  color: '#000',
  availability: av.map(([s, e]) => ({ start: s, end: e })),
});
const task = (
  id: string,
  duration: number,
  extra: Partial<Subtask> & Pick<Partial<Task>, 'window'> = {},
): Task => {
  const { window, ...subtask } = extra;
  return {
    id: `parent:${id}`,
    name: id,
    window,
    subtasks: [{
      id,
      name: id,
      duration,
      preferredPersonIds: [],
      dependsOn: [],
      linkedTo: [],
      chainSamePerson: false,
      ...subtask,
    }],
  };
};
const mk = (people: Person[], tasks: Task[]): Problem => ({
  people,
  tasks,
  settings: { horizonDays: 1, dayStart: 480, dayEnd: 1080 },
});

describe('solver', () => {
  it('plans simple tasks without conflicts', () => {
    const p = mk([person('a', [8 * H, 12 * H])], [task('t1', 60), task('t2', 90), task('t3', 30)]);
    const r = solve(p, { seed: 1 });
    expect(r.assignments).toHaveLength(3);
    expect(r.unscheduled).toHaveLength(0);
    expect(validate(p, r.assignments)).toHaveLength(0);
  });

  it('respecte l’ordre affiché et son changement', () => {
    const first = task('t1', 60).subtasks[0]!;
    const second = task('t2', 60).subtasks[0]!;
    const p = mk(
      [person('a', [8 * H, 18 * H]), person('b', [8 * H, 18 * H])],
      [{ id: 'group', name: 'Group', ordered: true, subtasks: [first, second] }],
    );
    const check = (problem: Problem, before: string, after: string) => {
      const r = solve(problem, { seed: 1 });
      expect(r.assignments).toHaveLength(2);
      expect(r.assignments.find((a) => a.taskId === after)!.start)
        .toBeGreaterThanOrEqual(r.assignments.find((a) => a.taskId === before)!.start + 60);
      expect(validate(problem, r.assignments)).toEqual([]);
    };
    check(p, 't1', 't2');
    check({ ...p, tasks: [{ ...p.tasks[0]!, subtasks: [second, first] }] }, 't2', 't1');
  });

  it('ne contraint pas les sous-tâches sans ordre et ignore les anciens liens externes', () => {
    const first = task('t1', 60, { dependsOn: ['external'], linkedTo: ['external'] }).subtasks[0]!;
    const second = task('t2', 60, { dependsOn: ['t1'] }).subtasks[0]!;
    const p = mk([person('a', [0, 120]), person('b', [0, 120])], [
      { id: 'group', name: 'Group', ordered: false, subtasks: [first, second] },
      task('external', 60, { dependsOn: ['t1'], linkedTo: ['t1'] }),
    ]);
    const locked = [
      { taskId: 't1', personId: 'a', start: 60, locked: true },
      { taskId: 't2', personId: 'b', start: 0, locked: true },
      { taskId: 'external', personId: 'a', start: 0, locked: true },
    ];
    expect(solve(p, { seed: 1, locked }).conflicts).toEqual([]);
    expect(validate({ ...p, tasks: [{ ...p.tasks[0]!, ordered: true }, p.tasks[1]!] }, locked)
      .some((conflict) => conflict.taskId === 't2')).toBe(true);
  });

  it('signale un créneau verrouillé dont la sous-tâche précédente est absente', () => {
    const p = mk([person('a', [0, 60])], [{
      id: 'group', name: 'Group', ordered: true,
      subtasks: [task('t1', 60).subtasks[0]!, task('t2', 60).subtasks[0]!],
    }]);
    const result = solve(p, { seed: 1, locked: [{ taskId: 't2', personId: 'a', start: 0, locked: true }] });
    expect(result.unscheduled.map((u) => u.taskId)).toContain('t1');
    expect(result.conflicts.some((conflict) => conflict.taskId === 't2'
      && conflict.message.includes("n'est pas planifiée"))).toBe(true);
  });

  it('respects minute-precise windows', () => {
    const p = mk([person('a', [8 * H, 18 * H])], [task('t', 20, { window: { start: 10 * H + 7, end: 10 * H + 27 } })]);
    const r = solve(p, { seed: 3 });
    expect(r.assignments[0]?.start).toBe(10 * H + 7);
  });

  it('prefers the preferred person', () => {
    const p = mk(
      [person('a', [8 * H, 18 * H]), person('b', [8 * H, 18 * H])],
      [task('t', 60, { preferredPersonIds: ['b'] })],
    );
    expect(solve(p, { seed: 5 }).assignments[0]?.personId).toBe('b');
  });

  it('respecte les personnes possibles même si une autre est préférée et signale les verrouillages incompatibles', () => {
    const p = mk([person('a', [0, 120]), person('b', [0, 120])], [
      task('t', 60, { possiblePersonIds: ['a'], preferredPersonIds: ['b'] }),
    ]);
    const result = solve(p, { seed: 1 });
    expect(result.assignments[0]?.personId).toBe('a');
    expect(result.penalty).toBe(solve(mk(p.people, [task('t', 60, { possiblePersonIds: ['a'] })]), { seed: 1 }).penalty);
    const locked = [{ taskId: 't', personId: 'b', start: 0, locked: true }];
    expect(solve(p, { seed: 1, locked }).conflicts[0]?.message).toContain('ne peut pas');
    const none = mk(p.people, [task('t', 60, { possiblePersonIds: [] })]);
    expect(solve(none, { seed: 1 }).unscheduled[0]?.code).toBe('no-person');
    expect(solve(mk(p.people, [task('t', 60)]), { seed: 1 }).assignments).toHaveLength(1);
  });

  it('is reproducible per seed and varies across seeds', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task(`t${i}`, 45));
    const p = mk([person('a', [8 * H, 18 * H]), person('b', [8 * H, 18 * H])], tasks);
    const key = (seed: number) => JSON.stringify(solve(p, { seed }).assignments);
    expect(key(7)).toBe(key(7));
    const variants = new Set(Array.from({ length: 8 }, (_, s) => key(s)));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('keeps locked slots and plans around them', () => {
    const p = mk([person('a', [8 * H, 12 * H])], [task('t1', 120), task('t2', 120)]);
    const locked = [{ taskId: 't1', personId: 'a', start: 9 * H, locked: true }];
    const r = solve(p, { seed: 2, locked });
    expect(r.assignments.find((a) => a.taskId === 't1')?.start).toBe(9 * H);
    expect(validate(p, r.assignments)).toHaveLength(0);
  });

  it('returns a maximal partial solution when impossible', () => {
    const p = mk([person('a', [8 * H, 10 * H])], [task('t1', 60), task('t2', 60), task('t3', 60)]);
    const r = solve(p, { seed: 1 });
    expect(r.assignments).toHaveLength(2);
    expect(r.unscheduled).toHaveLength(1);
    expect(r.unscheduled[0]?.reason).toBeTruthy();
    expect(validate(p, r.assignments)).toHaveLength(0);
  });

  it('reports impossible windows, long tasks and cascading dependencies', () => {
    const p = mk(
      [person('a', [8 * H, 10 * H])],
      [
        task('long', 300),
        { ...task('win', 30, { window: { start: 14 * H, end: 15 * H } }), ordered: true,
          subtasks: [task('win', 30).subtasks[0]!, task('child', 30).subtasks[0]!] },
      ],
    );
    const r = solve(p, { seed: 1 });
    const code = (id: string) => r.unscheduled.find((u) => u.taskId === id)?.code;
    expect(r.assignments).toHaveLength(0);
    expect(code('long')).toBe('too-long');
    expect(code('win')).toBe('no-slot');
    expect(code('child')).toBe('dependency-unscheduled');
  });

  it('handles an empty team', () => {
    const r = solve(mk([], [task('t', 30)]), { seed: 1 });
    expect(r.unscheduled[0]?.code).toBe('no-person');
  });
});

describe('équilibrage', () => {
  it('répartit la charge', () => {
    const ppl = [person('a', [0, 600]), person('b', [0, 600])];
    const r = solve(mk(ppl, [task('1', 60), task('2', 60), task('3', 60), task('4', 60)]), { seed: 1 });
    expect(r.assignments.filter((a) => a.personId === 'a')).toHaveLength(2);
  });
});

describe('compact', () => {
  it('rapproche les sous-tâches d\'un groupe compact', () => {
    const sub = (id: string): Subtask => ({
      id, name: id, duration: H, preferredPersonIds: [], dependsOn: [], linkedTo: [], chainSamePerson: false,
    });
    const problem: Problem = {
      people: [person('a', [0, 10 * H], [20 * H, 30 * H])],
      tasks: [{ id: 'g', name: 'g', compact: true, subtasks: [sub('s1'), sub('s2')] }],
      settings: { horizonDays: 2, dayStart: 0, dayEnd: 1440 },
    };
    const { assignments } = solve(problem, { seed: 1 });
    const [x, y] = assignments.map((a) => a.start).sort((p, q) => p - q);
    expect(y! - x!).toBe(H);
  });
});
