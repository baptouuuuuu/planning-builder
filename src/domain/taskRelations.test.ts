import { describe, expect, it } from 'vitest';
import type { Task } from './types';
import { duplicateTask, normalizeLinks, setTaskRelation, updateTask } from './taskRelations';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, name: id, duration: 60, preferredPersonIds: [], dependsOn: [], linkedTo: [], chainSamePerson: false, ...extra,
});

describe('relations entre tâches', () => {
  it('copie les plages de la tâche choisie puis synchronise les modifications dans les deux sens', () => {
    const a = task('a', { window: { start: 10, end: 100 } });
    const b = task('b', { preferredWindow: { start: 20, end: 80 } });
    let tasks = setTaskRelation([a, b], a, b, 'linked');
    expect(tasks[0]?.window).toBeUndefined();
    expect(tasks[0]?.preferredWindow).toEqual(b.preferredWindow);
    tasks = updateTask(tasks, 'a', { window: { start: 30, end: 90 }, linkGap: 7 });
    expect(tasks[1]?.window).toEqual({ start: 30, end: 90 });
    expect(tasks[1]?.linkGap).toBe(7);
    tasks = updateTask(tasks, 'b', { preferredWindow: undefined });
    expect(tasks[0]?.preferredWindow).toBeUndefined();
  });

  it('remplace le lien précédent sans conserver de lien dans la copie', () => {
    const a = task('a');
    const b = task('b');
    const c = task('c');
    const first = setTaskRelation([a, b, c], a, b, 'linked');
    const next = setTaskRelation(first, first[0]!, first[2]!, 'linked');
    expect(next.map((t) => t.linkedTo)).toEqual([['c'], [], ['a']]);
    expect(duplicateTask(next[0]!, 'copy').linkedTo).toEqual([]);
  });

  it('migre les anciens liens multiples et plages différentes sans modifier les dépendances', () => {
    const a = task('a', { linkedTo: ['b', 'c'], dependsOn: ['c'], window: { start: 0, end: 100 } });
    const b = task('b', { linkedTo: ['a'], preferredWindow: { start: 10, end: 90 } });
    const c = task('c', { linkedTo: ['a'] });
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
      task('a', { linkedTo: ['b', 'missing', 'a'] }),
      task('b', { linkGap: 5 }),
    ]);
    expect(migrated.tasks.map((t) => t.linkedTo)).toEqual([['b'], ['a']]);
    expect(migrated.tasks.map((t) => t.linkGap)).toEqual([5, 5]);
    expect(migrated.changes).toHaveLength(4);
  });
});
