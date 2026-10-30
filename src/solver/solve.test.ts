import { describe, expect, it } from 'vitest';
import { solve } from './solve';
import { validate } from './validate';
import type { Person, Problem, Task } from '../domain/types';

const H = 60;
const person = (id: string, ...av: [number, number][]): Person => ({
  id,
  name: id,
  color: '#000',
  availability: av.map(([s, e]) => ({ start: s, end: e })),
});
const task = (id: string, duration: number, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  duration,
  preferredPersonIds: [],
  dependsOn: [],
  chainSamePerson: false,
  ...extra,
});
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

  it('honors dependencies and same-person chaining', () => {
    const p = mk(
      [person('a', [8 * H, 18 * H]), person('b', [8 * H, 18 * H])],
      [task('t1', 60), task('t2', 60, { dependsOn: ['t1'], chainSamePerson: true })],
    );
    for (let seed = 0; seed < 10; seed++) {
      const r = solve(p, { seed });
      const a1 = r.assignments.find((a) => a.taskId === 't1')!;
      const a2 = r.assignments.find((a) => a.taskId === 't2')!;
      expect(a2.start).toBeGreaterThanOrEqual(a1.start + 60);
      expect(a2.personId).toBe(a1.personId);
    }
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

  it('reports impossible windows, long tasks, cycles and cascading dependencies', () => {
    const p = mk(
      [person('a', [8 * H, 10 * H])],
      [
        task('long', 300),
        task('win', 30, { window: { start: 14 * H, end: 15 * H } }),
        task('child', 30, { dependsOn: ['win'] }),
        task('c1', 10, { dependsOn: ['c2'] }),
        task('c2', 10, { dependsOn: ['c1'] }),
      ],
    );
    const r = solve(p, { seed: 1 });
    const code = (id: string) => r.unscheduled.find((u) => u.taskId === id)?.code;
    expect(r.assignments).toHaveLength(0);
    expect(code('long')).toBe('too-long');
    expect(code('win')).toBe('no-slot');
    expect(code('child')).toBe('dependency-unscheduled');
    expect(code('c1')).toBe('cycle');
  });

  it('handles an empty team', () => {
    const r = solve(mk([], [task('t', 30)]), { seed: 1 });
    expect(r.unscheduled[0]?.code).toBe('no-person');
  });
});
