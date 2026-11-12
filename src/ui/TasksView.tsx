import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Subtask, Task } from '../domain/types';
import { scheduledTasks, wouldCycle } from '../domain/types';
import { duplicateTask, setTaskRelation, updateTask, withoutRelation, type Relation } from '../domain/taskRelations';
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
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const subtasks = tasks.flatMap((task) => task.subtasks);
  const names = new Map(scheduledTasks(tasks).map((task) => [task.id, task.name]));

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
    replaceSubtasks(updateTask(subtasks, id, patch));
  const updateGroup = (id: string, patch: Partial<Task>) =>
    setTasks(tasks.map((task) => {
      if (task.id !== id) return task;
      const name = patch.name;
      const subtasks = name === undefined ? task.subtasks : task.subtasks.map((subtask) =>
        subtask.name === task.name ? { ...subtask, name } : subtask,
      );
      return { ...task, ...patch, subtasks };
    }));
  const add = () => {
    const id = crypto.randomUUID();
    setTasks([...tasks, { id, name: `Tâche ${tasks.length + 1}`, subtasks: [makeSubtask(id, `Tâche ${tasks.length + 1}`)] }]);
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
  const relationOf = (task: Subtask, target: Subtask): Relation =>
    task.linkedTo.includes(target.id) ? 'linked'
    : task.dependsOn.includes(target.id) ? 'follows'
    : target.dependsOn.includes(task.id) ? 'followed' : 'none';
  const setRelation = (task: Subtask, target: Subtask, relation: Relation) =>
    replaceSubtasks(setTaskRelation(subtasks, task, target, relation));

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

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!task.preferredWindow}
                  onChange={(e) => updateGroup(task.id, {
                    preferredWindow: e.target.checked ? { start: 9 * 60, end: 12 * 60 } : undefined,
                  })}
                />
                Plage horaire préférée (souple)
              </label>
              {task.preferredWindow && (
                <IntervalField label="Plage préférée" value={task.preferredWindow} days={settings.horizonDays}
                  onChange={(preferredWindow) => updateGroup(task.id, { preferredWindow })} />
              )}
            </fieldset>

            <div className="space-y-3 border-t border-slate-200 pt-3">
              {task.subtasks.map((subtask) => {
                const targetId = selectedTargets[subtask.id] ?? subtask.linkedTo[0] ?? subtask.dependsOn[0]
                  ?? subtasks.find((other) => other.dependsOn.includes(subtask.id))?.id ?? '';
                const target = subtasks.find((other) => other.id === targetId && other.id !== subtask.id);
                const base = target ? withoutRelation(subtasks, subtask, target) : subtasks;
                return (
                  <section key={subtask.id} className="space-y-3 rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label="Nom de la sous-tâche"
                        ref={focusId === subtask.id ? nameInput : undefined}
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

                    <fieldset>
                      <legend className="mb-1 text-sm font-medium">Relation avec une tâche</legend>
                      <p className="mb-2 text-xs text-slate-500">
                        Une seule tâche liée pour la même personne ; les dépendances restent indépendantes.
                      </p>
                      {(subtask.linkedTo.length > 0 || subtask.dependsOn.length > 0
                        || subtasks.some((other) => other.dependsOn.includes(subtask.id))) && (
                        <p className="mb-2 text-xs text-slate-600">
                          {[
                            ...subtask.linkedTo.map((id) => `Liée : ${names.get(id) ?? id}`),
                            ...subtask.dependsOn.map((id) => `Suit : ${names.get(id) ?? id}`),
                            ...subtasks.filter((other) => other.dependsOn.includes(subtask.id))
                              .map((other) => `Suivie par : ${names.get(other.id) ?? other.id}`),
                          ].join(' · ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <select aria-label={`Tâche à lier à ${subtask.name}`} className={inputCls}
                          value={target?.id ?? ''}
                          onChange={(e) => setSelectedTargets({ ...selectedTargets, [subtask.id]: e.target.value })}>
                          <option value="">Choisir une tâche</option>
                          {subtasks.filter((other) => other.id !== subtask.id)
                            .map((other) => <option key={other.id} value={other.id}>{names.get(other.id) ?? other.name}</option>)}
                        </select>
                        {target && (
                          <select aria-label={`Relation avec ${names.get(target.id) ?? target.name}`} className={inputCls}
                            value={relationOf(subtask, target)}
                            onChange={(e) => setRelation(subtask, target, e.target.value as Relation)}>
                            <option value="none">Aucune relation</option>
                            <option value="linked" disabled={target.linkedTo.some((id) => id !== subtask.id)}>
                              Liée (même personne, ordre libre)
                            </option>
                            <option value="follows" disabled={wouldCycle(base, subtask.id, target.id)}>Doit suivre</option>
                            <option value="followed" disabled={wouldCycle(base, target.id, subtask.id)}>Doit être suivie par</option>
                          </select>
                        )}
                      </div>
                      {subtask.linkedTo.length > 0 && (
                        <label className="mt-2 flex items-center gap-2 text-sm">
                          Marge minimale entre les tâches liées
                          <NumberField label={`Marge pour ${subtask.name} en minutes`} className={`${inputCls} w-20`}
                            min={0} value={subtask.linkGap ?? 0}
                            onChange={(linkGap) => updateSubtask(subtask.id, { linkGap })} /> min
                        </label>
                      )}
                      {subtask.dependsOn.length > 0 && (
                        <label className="mt-2 flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={subtask.chainSamePerson}
                            onChange={(e) => updateSubtask(subtask.id, { chainSamePerson: e.target.checked })} />
                          Enchaîner avec la même personne
                        </label>
                      )}
                    </fieldset>
                  </section>
                );
              })}
              <button className={btnGhost} onClick={() => addSubtask(task)}>+ Ajouter une sous-tâche</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
