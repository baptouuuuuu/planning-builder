import { defaultAvailability, type Person, type Task, type Settings } from '../domain/types';

export const sampleSettings: Settings = { horizonDays: 1, dayStart: 8 * 60, dayEnd: 12 * 60 };

export const samplePeople: Person[] = [
  { id: 'p-alice', name: 'Alice', color: '#6366f1', availability: defaultAvailability(sampleSettings) },
  { id: 'p-bob', name: 'Bob', color: '#10b981', availability: defaultAvailability(sampleSettings) },
];

const subtask = (id: string, name: string): Task['subtasks'][number] => ({
  id,
  name,
  duration: 60,
  preferredPersonIds: [],
  dependsOn: [],
  linkedTo: [],
  chainSamePerson: false,
});

export const sampleTasks: Task[] = [{
  id: 'task-1',
  name: 'Tache 1',
  subtasks: [
    subtask('subtask-1', 'Sous Tache 1'),
    subtask('subtask-2', 'Sous Tache 2'),
  ],
}];
