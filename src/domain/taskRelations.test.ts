import { describe, expect, it } from 'vitest';
import type { ScheduledTask, Subtask } from './types';
import { duplicateTask, migrateLegacyTasks, migrateTaskOrdering, normalizeLinks } from './taskRelations';

const task = (id: string, extra: Partial<Subtask> = {}): Subtask => ({
  id, name: id, duration: 60, preferredPersonIds: [], dependsOn: [], linkedTo: [], chainSamePerson: false, ...extra,
});
const legacyTask = (id: string, extra: Partial<ScheduledTask> = {}): ScheduledTask => ({
  ...task(id),
  ...extra,
});

describe('relations entre tâches', () => {
  it('migre les relations et les préférences horaires en conservant uniquement un ordre équivalent', () => {
    const group = {
      id: 'group', name: 'Group', preferredWindow: { start: 1, end: 100 },
      subtasks: [task('a', { linkedTo: ['external'] }), task('b', { dependsOn: ['a'], chainSamePerson: true })],
    };
    const other = { id: 'other', name: 'Other', subtasks: [task('external', { dependsOn: ['b'] })] };
    const migrated = migrateTaskOrdering([group, other]);
    expect(migrated.tasks[0]?.ordered).toBe(true);
    expect(migrated.tasks[1]?.ordered).toBe(false);
    expect(migrated.tasks.flatMap((t) => t.subtasks).every((s) =>
      s.dependsOn.length === 0 && s.linkedTo.length === 0 && !s.chainSamePerson)).toBe(true);
    expect(migrated.tasks[0]).not.toHaveProperty('preferredWindow');
    expect(migrated.changes).toHaveLength(2);
    expect(migrateTaskOrdering(migrated.tasks).changes).toEqual([]);
  });

  it('duplique l’ordre et les identifiants des sous-tâches', () => {
    let id = 0;
    const copy = duplicateTask({ id: 'group', name: 'Group', ordered: true, subtasks: [task('a'), task('b')] },
      'copy', () => `copy-${id++}`);
    expect(copy.ordered).toBe(true);
    expect(copy.subtasks.map((s) => s.id)).toEqual(['copy-0', 'copy-1']);
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
