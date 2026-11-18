import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { defaultAvailability } from '../domain/types';
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

describe('import JSON', () => {
  it('importe le format exporté et remplace les données courantes', () => {
    useStore.setState({
      ...initialState,
      people: [],
      tasks: [],
      assignments: [],
    });
    const data = {
      version: 2,
      people: [{ id: 'p', name: 'Alice', color: '#123456', availability: [{ start: 540, end: 1020 }] }],
      tasks: [],
      settings: { horizonDays: 1, dayStart: 480, dayEnd: 1080 },
      assignments: [],
      seed: 42,
    };

    useStore.getState().importJson(JSON.stringify(data));

    expect(useStore.getState()).toMatchObject({
      people: data.people,
      tasks: [],
      settings: data.settings,
      assignments: [],
      seed: 42,
      result: null,
    });
  });

  describe('disponibilités par défaut', () => {
    it('reprend la plage globale sur chaque jour planifié', () => {
      expect(defaultAvailability({ horizonDays: 3, dayStart: 510, dayEnd: 1050 })).toEqual([
        { start: 510, end: 1050 },
        { start: 1950, end: 2490 },
        { start: 3390, end: 3930 },
      ]);
    });
  });

  describe("jeu d'exemple", () => {
    it('charge deux personnes et planifie les deux sous-tâches sur une journée de quatre heures', () => {
      useStore.getState().loadSample();
      const { people, tasks, settings, assignments, result } = useStore.getState();

      expect(people).toHaveLength(2);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.name).toBe('Tache 1');
      expect(tasks[0]?.subtasks.map((task) => task.name)).toEqual(['Sous Tache 1', 'Sous Tache 2']);
      expect(settings).toMatchObject({ horizonDays: 1, dayStart: 8 * 60, dayEnd: 12 * 60 });
      expect(assignments).toHaveLength(2);
      expect(assignments.every((assignment) =>
        assignment.start >= settings.dayStart && assignment.start + 60 <= settings.dayEnd)).toBe(true);
      expect(result?.unscheduled).toEqual([]);
    });
  });

  it('refuse un JSON invalide ou un document qui ne respecte pas le format exporté', () => {
    const before = useStore.getState().people;
    expect(() => useStore.getState().importJson('{')).toThrow('JSON valide');
    expect(() => useStore.getState().importJson(JSON.stringify({ version: 1 }))).toThrow('format JSON exporté');
    expect(useStore.getState().people).toBe(before);
  });
});
