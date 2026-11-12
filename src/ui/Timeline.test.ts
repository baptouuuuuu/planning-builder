import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, type Task } from '../domain/types';
import { useStore } from '../state/store';
import { Timeline } from './Timeline';

vi.mock('../state/store', async (importOriginal) => {
  const { useStore } = await importOriginal<typeof import('../state/store')>();
  return { useStore: Object.assign(() => useStore.getState(), { getState: useStore.getState, setState: useStore.setState }) };
});

const initialState = useStore.getState();

afterEach(() => useStore.setState(initialState, true));

describe('Timeline', () => {
  it('affiche verticalement la suite des tâches et les disponibilités sans commandes de zoom', () => {
    const task: Task = {
      id: 'task',
      name: 'Intervention',
      duration: 90,
      preferredPersonIds: [],
      dependsOn: [],
      linkedTo: [],
      chainSamePerson: false,
    };
    useStore.setState({
      people: [{ id: 'person', name: 'Alice', color: '#123456', availability: [{ start: DAY, end: DAY + 90 }] }],
      tasks: [task],
      assignments: [{ taskId: task.id, personId: 'person', start: DAY - 30, locked: false }],
      settings: { horizonDays: 2, dayStart: 0, dayEnd: 120 },
    });

    const html = renderToStaticMarkup(createElement(Timeline));
    expect(html.match(/title="Intervention/g)).toHaveLength(1);
    expect(html).toContain('(suite) → 01:00');
    expect(html).toContain('top:0%;height:calc(50% - 0%)');
    expect(html).toContain('top:0%;height:calc(75% - 0%)');
    expect(html).not.toContain('Niveau de zoom');
    expect(html).not.toContain('overflow-auto');

    useStore.getState().toggleLock(task.id);
    expect(renderToStaticMarkup(createElement(Timeline))).toContain('aria-pressed="true"');
  });
});
