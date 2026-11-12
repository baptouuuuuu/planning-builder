import { describe, expect, it } from 'vitest';
import { DAY, type Assignment, type Problem, type Subtask } from '../domain/types';
import { validStarts } from './placement';

const subtask = (id: string, duration: number): Subtask => ({
  id, name: id, duration, preferredPersonIds: [], dependsOn: [], linkedTo: [], chainSamePerson: false,
});

describe('validStarts', () => {
  const problem: Problem = {
    settings: { horizonDays: 2, dayStart: 0, dayEnd: DAY },
    people: [
      { id: 'alice', name: 'Alice', color: '#000000', availability: [{ start: 480, end: 1020 }] },
      { id: 'bob', name: 'Bob', color: '#000000', availability: [{ start: 500, end: 900 }] },
    ],
    tasks: [
      { id: 'group', name: 'Groupe', ordered: true, window: { start: 540, end: 900 },
        subtasks: [subtask('first', 60), subtask('middle', 60), subtask('last', 60)] },
      { id: 'other', name: 'Autre', subtasks: [subtask('busy', 60)] },
    ],
  };
  const assignments: Assignment[] = [
    { taskId: 'first', personId: 'alice', start: 540, locked: false },
    { taskId: 'middle', personId: 'alice', start: 600, locked: true },
    { taskId: 'last', personId: 'bob', start: 840, locked: false },
    { taskId: 'busy', personId: 'bob', start: 660, locked: false },
  ];

  it('combine plage imposée, prédécesseur, successeur et chevauchements sans compter la tâche déplacée', () => {
    expect(validStarts(problem, assignments, 'middle', 'bob')).toEqual([
      { start: 600, end: 600 }, { start: 720, end: 780 },
    ]);
    expect(validStarts(problem, assignments, 'middle', 'alice')).toEqual([{ start: 600, end: 780 }]);
  });

  it('refuse une dépendance non planifiée et les personnes inconnues', () => {
    expect(validStarts(problem, assignments.filter((a) => a.taskId !== 'first'), 'middle', 'alice')).toEqual([]);
    expect(validStarts(problem, assignments, 'middle', 'missing')).toEqual([]);
  });

  it('refuse les personnes exclues, y compris si la liste est vide', () => {
    const restricted: Problem = {
      ...problem,
      tasks: problem.tasks.map((task) => ({
        ...task, subtasks: task.subtasks.map((subtask) => subtask.id === 'middle'
          ? { ...subtask, possiblePersonIds: ['alice'] } : subtask),
      })),
    };
    expect(validStarts(restricted, assignments, 'middle', 'bob')).toEqual([]);
    expect(validStarts(restricted, assignments, 'middle', 'alice')).not.toEqual([]);
    restricted.tasks[0]!.subtasks[1]!.possiblePersonIds = [];
    expect(validStarts(restricted, assignments, 'middle', 'alice')).toEqual([]);
  });

  it('accepte les disponibilités de nuit et limite les débuts à l’horizon', () => {
    const overnight: Problem = {
      ...problem,
      settings: { ...problem.settings, horizonDays: 1 },
      people: [{ ...problem.people[0]!, availability: [{ start: DAY - 30, end: DAY + 90 }] }],
      tasks: [{ id: 'night', name: 'Nuit', subtasks: [subtask('night-task', 60)] }],
    };
    expect(validStarts(overnight, [], 'night-task', 'alice')).toEqual([{ start: DAY - 30, end: DAY - 1 }]);
  });
});
