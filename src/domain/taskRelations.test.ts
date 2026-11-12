import { describe, expect, it } from 'vitest';
import type { ScheduledTask, Subtask } from './types';
import { duplicateTask, migrateLegacyTasks, normalizeLinks, setTaskRelation, updateTask } from './taskRelations';

const task = (id: string, extra: Partial<Subtask> = {}): Subtask => ({
  id, name: id, duration: 60, preferredPersonIds: [], dependsOn: [], linkedTo: [], chainSamePerson: false, ...extra,
});
const legacyTask = (id: string, extra: Partial<ScheduledTask> = {}): ScheduledTask => ({
  ...task(id),
  ...extra,
});

describe('relations entre tâches', () => {
  it('remplace le lien précédent, synchronise sa marge et ne duplique pas les liens externes', () => {
    const a = task('a');
    const b = task('b');
    const c = task('c');
    const first = setTaskRelation([a, b, c], a, b, 'linked');
    const next = setTaskRelation(first, first[0]!, first[2]!, 'linked');
    expect(next.map((t) => t.linkedTo)).toEqual([['c'], [], ['a']]);
    const updated = updateTask(next, 'a', { linkGap: 7 });
    expect(updated[2]?.linkGap).toBe(7);
    const copy = duplicateTask({ id: 'group', name: 'Group', subtasks: [updated[0]!] }, 'copy', () => 'copy-a');
    expect(copy.subtasks[0]?.linkedTo).toEqual([]);
  });

  it('migre les anciens liens multiples et plages différentes sans modifier les dépendances', () => {
    const a = legacyTask('a', { linkedTo: ['b', 'c'], dependsOn: ['c'], window: { start: 0, end: 100 } });
    const b = legacyTask('b', { linkedTo: ['a'], preferredWindow: { start: 10, end: 90 } });
    const c = legacyTask('c', { linkedTo: ['a'] });
    const migrated = normalizeLinks([a, b, c]);
    expect(migrated.tasks.map((t) => t.linkedTo)).toEqual([['b'], ['a'], []]);
    expect(migrated.tasks[0]?.dependsOn).toEqual(['c']);
    expect(migrated.tasks[0]?.window).toBeUndefined();
    expect(migrated.tasks[0]?.preferredWindow).toEqual(b.preferredWindow);
    expect(migrated.changes).toHaveLength(2);
    expect(normalizeLinks(migrated.tasks).changes).toEqual([]);
    expect(a.linkedTo).toEqual(['b', 'c']);
  });

  it('répare les liens asymétriques et supprime les références invalides', () => {
    const migrated = normalizeLinks([
      legacyTask('a', { linkedTo: ['b', 'missing', 'a'] }),
      legacyTask('b', { linkGap: 5 }),
    ]);
    expect(migrated.tasks.map((t) => t.linkedTo)).toEqual([['b'], ['a']]);
    expect(migrated.tasks.map((t) => t.linkGap)).toEqual([5, 5]);
    expect(migrated.changes).toHaveLength(4);
  });

  it('convertit les anciennes tâches en groupes tout en gardant les identifiants planifiés', () => {
    const a = legacyTask('a', { linkedTo: ['b'], window: { start: 5, end: 100 } });
    const b = legacyTask('b', {
      linkedTo: ['a'],
      dependsOn: ['a'],
      window: { start: 5, end: 100 },
    });
    const migrated = migrateLegacyTasks([a, b]);
    expect(migrated.tasks).toHaveLength(1);
    expect(migrated.tasks[0]?.subtasks.map((subtask) => subtask.id)).toEqual(['a', 'b']);
    expect(migrated.tasks[0]?.subtasks[1]?.dependsOn).toEqual(['a']);
    expect(migrated.tasks[0]?.window).toEqual({ start: 5, end: 100 });
  });
});
