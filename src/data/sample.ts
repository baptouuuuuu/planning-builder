import type { Person, Settings, Task } from '../domain/types';

const H = 60;
const DAY = 1440;
const slot = (day: number, from: number, to: number) => ({ start: day * DAY + from * H, end: day * DAY + to * H });
const week = (from: number, to: number, days = [0, 1, 2, 3, 4]) => days.map((d) => slot(d, from, to));

export const samplePeople: Person[] = [
  { id: 'p-alice', name: 'Alice', color: '#6366f1', availability: week(8, 17) },
  { id: 'p-bob', name: 'Bob', color: '#10b981', availability: week(10, 18) },
  { id: 'p-chloe', name: 'Chloé', color: '#f59e0b', availability: week(8, 12, [0, 2, 4]) },
  { id: 'p-dan', name: 'Dan', color: '#ef4444', availability: week(13, 19, [1, 2, 3]) },
];

const t = (id: string, name: string, duration: number, extra: Partial<Task> = {}): Task => ({
  id,
  name,
  duration,
  preferredPersonIds: [],
  dependsOn: [],
  chainSamePerson: false,
  ...extra,
});

export const sampleTasks: Task[] = [
  t('t-kickoff', 'Réunion de lancement', 60, {
    window: { start: 0 * DAY + 9 * H, end: 0 * DAY + 12 * H },
    preferredPersonIds: ['p-alice'],
  }),
  t('t-spec', 'Rédaction des spécifications', 180, { dependsOn: ['t-kickoff'], preferredPersonIds: ['p-alice', 'p-chloe'] }),
  t('t-design', 'Maquettes', 150, { dependsOn: ['t-spec'], preferredPersonIds: ['p-chloe'] }),
  t('t-dev', 'Développement', 240, { dependsOn: ['t-design'], preferredPersonIds: ['p-bob'], chainSamePerson: false }),
  t('t-review', 'Revue de code', 60, { dependsOn: ['t-dev'], preferredPersonIds: ['p-alice'] }),
  t('t-test', 'Tests', 120, { dependsOn: ['t-dev'], preferredPersonIds: ['p-dan'] }),
  t('t-fix', 'Corrections', 90, { dependsOn: ['t-test'], chainSamePerson: false, preferredPersonIds: ['p-bob'] }),
  t('t-demo', 'Démo client', 45, {
    window: { start: 4 * DAY + 14 * H + 30, end: 4 * DAY + 16 * H },
    dependsOn: ['t-fix'],
    preferredPersonIds: ['p-alice'],
  }),
  t('t-support', 'Permanence support', 90, { preferredWindow: slot(1, 14, 17) }),
  t('t-impossible', 'Atelier dimanche (impossible)', 60, { window: slot(6, 9, 11) }),
];

export const sampleSettings: Settings = { horizonDays: 5, dayStart: 8 * H, dayEnd: 19 * H };
