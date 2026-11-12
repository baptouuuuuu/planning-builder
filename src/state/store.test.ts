import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import type { Person, Task } from '../domain/types';

const initialState = useStore.getState();
afterEach(() => useStore.setState(initialState, true));

describe('déplacement manuel', () => {
  it('refuse une personne exclue de la sous-tâche', () => {
    const people: Person[] = ['a', 'b'].map((id) => ({
      id, name: id, color: '#000000', availability: [{ start: 540, end: 720 }],
    }));
    const task: Task = { id: 't', name: 'T', subtasks: [{
      id: 's', name: 'S', duration: 60, preferredPersonIds: [], possiblePersonIds: ['a'],
      dependsOn: [], linkedTo: [], chainSamePerson: false,
    }] };
    useStore.setState({
      people, tasks: [task], settings: { horizonDays: 1, dayStart: 480, dayEnd: 1080 },
      assignments: [{ taskId: 's', personId: 'a', start: 540, locked: false }], result: null, past: [], future: [],
    });
    expect(useStore.getState().moveAssignment('s', 'b', 600)).toBe(false);
    expect(useStore.getState().assignments[0]?.personId).toBe('a');
    expect(useStore.getState().moveAssignment('s', 'a', 600)).toBe(true);
  });

  it('rejette un créneau invalide et conserve le verrouillage et l’historique pour un créneau valide', () => {
    const person: Person = { id: 'p', name: 'P', color: '#000000', availability: [{ start: 540, end: 720 }] };
    const task: Task = { id: 't', name: 'T', subtasks: [{
      id: 's', name: 'S', duration: 60, preferredPersonIds: [], dependsOn: [], linkedTo: [], chainSamePerson: false,
    }] };
    useStore.setState({
      people: [person], tasks: [task], settings: { horizonDays: 1, dayStart: 480, dayEnd: 1080 },
      assignments: [{ taskId: 's', personId: 'p', start: 540, locked: true }], result: null, past: [], future: [],
    });
    expect(useStore.getState().moveAssignment('s', 'p', 700)).toBe(false);
    expect(useStore.getState().past).toHaveLength(0);
    expect(useStore.getState().moveAssignment('s', 'p', 600)).toBe(true);
    expect(useStore.getState().assignments[0]).toMatchObject({ start: 600, locked: true });
    useStore.getState().undo();
    expect(useStore.getState().assignments[0]).toMatchObject({ start: 540, locked: true });
    useStore.getState().redo();
    expect(useStore.getState().assignments[0]).toMatchObject({ start: 600, locked: true });
  });
});
