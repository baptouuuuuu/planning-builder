import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Subtask, Task } from '../domain/types';
import { duplicateTask } from '../domain/taskRelations';
import { Card, IntervalField, NumberField, btnDanger, btnGhost, inputCls } from './fields';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function makeSubtask(id: string, name: string): Subtask {
  return {
    id,
    name,
    duration: 60,
    preferredPersonIds: [],
    dependsOn: [],
    linkedTo: [],
    chainSamePerson: false,
  };
}

export function TasksView() {
  const { tasks, setTasks, people, settings } = useStore();
  const [focusId, setFocusId] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const subtasks = tasks.flatMap((task) => task.subtasks);

  useEffect(() => {
    if (!focusId || !nameInput.current) return;
    nameInput.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    nameInput.current.focus();
    nameInput.current.select();
    setFocusId(null);
  }, [focusId, tasks]);

  const replaceSubtasks = (next: Subtask[]) => {
    const byId = new Map(next.map((subtask) => [subtask.id, subtask]));
    setTasks(tasks.map((task) => ({
      ...task,
      subtasks: task.subtasks.flatMap((subtask) => {
        const updated = byId.get(subtask.id);
        return updated ? [updated] : [];
      }),
    })).filter((task) => task.subtasks.length > 0));
  };
  const updateSubtask = (id: string, patch: Partial<Subtask>) =>
    replaceSubtasks(subtasks.map((subtask) => subtask.id === id ? { ...subtask, ...patch } : subtask));
  const updateGroup = (id: string, patch: Partial<Task>) =>
    setTasks(tasks.map((task) => {
      if (task.id !== id) return task;
      const name = patch.name;
      const subtasks = name === undefined ? task.subtasks : task.subtasks.map((subtask) =>
        subtask.name === task.name ? { ...subtask, name } : subtask,
      );
      return { ...task, ...patch, subtasks: patch.subtasks ?? subtasks };
    }));
  const add = () => {
    const id = crypto.randomUUID();
    const name = `Tâche ${tasks.length + 1}`;
    setTasks([...tasks, { id, name, subtasks: [makeSubtask(crypto.randomUUID(), name)] }]);
    setFocusId(id);
  };
  const duplicate = (task: Task) => {
    const i = tasks.findIndex((x) => x.id === task.id);
    const copy = duplicateTask(task, crypto.randomUUID(), () => crypto.randomUUID());
    setTasks([...tasks.slice(0, i + 1), copy, ...tasks.slice(i + 1)]);
    setFocusId(copy.id);
  };
  const addSubtask = (task: Task) => {
    const id = crypto.randomUUID();
    updateGroup(task.id, { subtasks: [...task.subtasks, makeSubtask(id, `Sous-tâche ${task.subtasks.length + 1}`)] });
    setFocusId(id);
  };
  const moveSubtask = (task: Task, index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= task.subtasks.length) return;
    const reordered = [...task.subtasks];
    [reordered[index], reordered[destination]] = [reordered[destination]!, reordered[index]!];
    updateGroup(task.id, { subtasks: reordered });
  };
  const removeSubtask = (id: string) => {
    const remaining = subtasks
      .filter((subtask) => subtask.id !== id)
      .map((subtask) => ({
        ...subtask,
        dependsOn: subtask.dependsOn.filter((target) => target !== id),
        linkedTo: subtask.linkedTo.filter((target) => target !== id),
      }));
    replaceSubtasks(remaining);
  };
  const removeGroup = (task: Task) => {
    const removed = new Set(task.subtasks.map((subtask) => subtask.id));
    const remaining = subtasks.filter((subtask) => !removed.has(subtask.id)).map((subtask) => ({
      ...subtask,
      dependsOn: subtask.dependsOn.filter((target) => !removed.has(target)),
      linkedTo: subtask.linkedTo.filter((target) => !removed.has(target)),
    }));
    const byId = new Map(remaining.map((subtask) => [subtask.id, subtask]));
    setTasks(tasks.filter((item) => item.id !== task.id).map((item) => ({
      ...item,
      subtasks: item.subtasks.flatMap((subtask) => {
        const updated = byId.get(subtask.id);
        return updated ? [updated] : [];
      }),
    })));
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tâches</h2>
        <button className={btnGhost} onClick={add}>+ Ajouter une tâche</button>
      </div>
      {tasks.length === 0 && <p className="text-slate-500">Aucune tâche.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((task) => (
          <Card key={task.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Nom de la tâche"
                ref={focusId === task.id ? nameInput : undefined}
                className={`${inputCls} flex-1 font-medium`}
                value={task.name}
                onChange={(e) => updateGroup(task.id, { name: e.target.value })}
              />
              <button className={btnGhost} onClick={() => duplicate(task)}>Dupliquer</button>
              <button className={btnDanger} onClick={() => removeGroup(task)}>Supprimer</button>
            </div>

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!task.window}
                  onChange={(e) => updateGroup(task.id, {
                    window: e.target.checked ? { start: 9 * 60, end: 17 * 60 } : undefined,
                  })}
                />
                Plage horaire imposée (contrainte dure)
              </label>
              {task.window && (
                <IntervalField label="Plage imposée" value={task.window} days={settings.horizonDays}
                  onChange={(window) => updateGroup(task.id, { window })} />
              )}
            </fieldset>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!task.ordered}
                onChange={(e) => updateGroup(task.id, { ordered: e.target.checked })} />
              Respecter l'ordre affiché des sous-tâches
            </label>

            {task.subtasks.length > 1 && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={!!task.compact}
                  onChange={(e) => updateGroup(task.id, { compact: e.target.checked })} />
                Sous-tâches proches dans le temps (préférence)
              </label>
            )}

            <div className="space-y-3 border-t border-slate-200 pt-3">
              {task.subtasks.map((subtask, index) => (
                  <section key={subtask.id} className="space-y-3 rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <button className={btnGhost} aria-label={`Monter ${subtask.name}`}
                        disabled={index === 0} onClick={() => moveSubtask(task, index, -1)}>↑</button>
                      <button className={btnGhost} aria-label={`Descendre ${subtask.name}`}
                        disabled={index === task.subtasks.length - 1} onClick={() => moveSubtask(task, index, 1)}>↓</button>
                      <input
                        aria-label="Nom de la sous-tâche"
                        ref={focusId === subtask.id && focusId !== task.id ? nameInput : undefined}
                        className={`${inputCls} flex-1 font-medium`}
                        value={subtask.name}
                        onChange={(e) => updateSubtask(subtask.id, { name: e.target.value })}
                      />
                      <label className="flex items-center gap-1 text-sm">
                        <NumberField label="Durée en minutes" className={`${inputCls} w-20`}
                          value={subtask.duration} onChange={(duration) => updateSubtask(subtask.id, { duration })} />
                        min
                      </label>
                      <button className={btnDanger} aria-label={`Supprimer ${subtask.name}`}
                        onClick={() => removeSubtask(subtask.id)}>×</button>
                    </div>

                    <fieldset>
                      <legend className="mb-1 text-sm font-medium">Personnes préférées</legend>
                      <div className="flex flex-wrap gap-2">
                        {people.map((person) => (
                          <label key={person.id} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-sm">
                            <input type="checkbox" checked={subtask.preferredPersonIds.includes(person.id)}
                              onChange={() => updateSubtask(subtask.id, {
                                preferredPersonIds: toggle(subtask.preferredPersonIds, person.id),
                              })} />
                            <span style={{ color: person.color }}>●</span> {person.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                  </section>
              ))}
              <button className={btnGhost} onClick={() => addSubtask(task)}>+ Ajouter une sous-tâche</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
