import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Task } from '../domain/types';
import { wouldCycle } from '../domain/types';
import { duplicateTask, setTaskRelation, updateTask, withoutRelation, type Relation } from '../domain/taskRelations';
import { Card, IntervalField, NumberField, btnDanger, btnGhost, inputCls } from './fields';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function TasksView() {
  const { tasks, setTasks, people, settings } = useStore();
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusId || !nameInput.current) return;
    nameInput.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    nameInput.current.focus();
    nameInput.current.select();
    setFocusId(null);
  }, [focusId, tasks]);
  const update = (id: string, patch: Partial<Task>) => setTasks(updateTask(tasks, id, patch));
  const add = () =>
    setTasks([
      ...tasks,
      {
        id: crypto.randomUUID(),
        name: `Tâche ${tasks.length + 1}`,
        duration: 60,
        preferredPersonIds: [],
        dependsOn: [],
        linkedTo: [],
        chainSamePerson: false,
      },
    ]);
  const duplicate = (t: Task) => {
    const i = tasks.findIndex((x) => x.id === t.id);
    const copy = duplicateTask(t, crypto.randomUUID());
    setTasks([...tasks.slice(0, i + 1), copy, ...tasks.slice(i + 1)]);
    setFocusId(copy.id);
  };
  const relationOf = (t: Task, o: Task): Relation =>
    t.linkedTo.includes(o.id) ? 'linked'
    : t.dependsOn.includes(o.id) ? 'follows' : o.dependsOn.includes(t.id) ? 'followed' : 'none';
  const setRelation = (t: Task, o: Task, rel: Relation) => setTasks(setTaskRelation(tasks, t, o, rel));
  const remove = (id: string) =>
    setTasks(tasks.filter((t) => t.id !== id).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => d !== id), linkedTo: t.linkedTo.filter((d) => d !== id) })));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tâches</h2>
        <button className={btnGhost} onClick={add}>+ Ajouter une tâche</button>
      </div>
      {tasks.length === 0 && <p className="text-slate-500">Aucune tâche.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((t) => {
          const targetId = selectedTargets[t.id] ?? t.linkedTo[0] ?? t.dependsOn[0] ?? tasks.find((o) => o.dependsOn.includes(t.id))?.id ?? '';
          const target = tasks.find((o) => o.id === targetId && o.id !== t.id);
          const base = target ? withoutRelation(tasks, t, target) : tasks;
          return (
          <Card key={t.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Nom de la tâche"
                ref={focusId === t.id ? nameInput : undefined}
                className={`${inputCls} flex-1 font-medium`}
                value={t.name}
                onChange={(e) => update(t.id, { name: e.target.value })}
              />
              <label className="flex items-center gap-1 text-sm">
                <NumberField
                  label="Durée en minutes"
                  className={`${inputCls} w-20`}
                  value={t.duration}
                  onChange={(duration) => update(t.id, { duration })}
                />
                min
              </label>
              <button className={btnGhost} onClick={() => duplicate(t)}>Dupliquer</button>
              <button className={btnDanger} onClick={() => remove(t.id)}>Supprimer</button>
            </div>

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!t.window}
                  onChange={(e) =>
                    update(t.id, { window: e.target.checked ? { start: 9 * 60, end: 17 * 60 } : undefined })
                  }
                />
                Plage horaire imposée (contrainte dure)
              </label>
              {t.window && (
                <IntervalField label="Plage imposée" value={t.window} days={settings.horizonDays} onChange={(window) => update(t.id, { window })} />
              )}
            </fieldset>

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!t.preferredWindow}
                  onChange={(e) =>
                    update(t.id, { preferredWindow: e.target.checked ? { start: 9 * 60, end: 12 * 60 } : undefined })
                  }
                />
                Plage horaire préférée (souple)
              </label>
              {t.preferredWindow && (
                <IntervalField
                  label="Plage préférée"
                  value={t.preferredWindow}
                  days={settings.horizonDays}
                  onChange={(preferredWindow) => update(t.id, { preferredWindow })}
                />
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">Personnes préférées</legend>
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={t.preferredPersonIds.includes(p.id)}
                      onChange={() => update(t.id, { preferredPersonIds: toggle(t.preferredPersonIds, p.id) })}
                    />
                    <span style={{ color: p.color }}>●</span> {p.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">Relation avec une tâche</legend>
              <p className="mb-2 text-xs text-slate-500">
                Une seule tâche liée pour la même personne ; les dépendances restent indépendantes.
                Choisissez une tâche pour consulter ou modifier sa relation.
              </p>
              {(t.linkedTo.length > 0 || t.dependsOn.length > 0 || tasks.some((o) => o.dependsOn.includes(t.id))) && (
                <p className="mb-2 text-xs text-slate-600">
                  {[
                    ...t.linkedTo.map((id) => `Liée : ${tasks.find((o) => o.id === id)?.name ?? id}`),
                    ...t.dependsOn.map((id) => `Suit : ${tasks.find((o) => o.id === id)?.name ?? id}`),
                    ...tasks.filter((o) => o.dependsOn.includes(t.id)).map((o) => `Suivie par : ${o.name}`),
                  ].join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <select aria-label={`Tâche à lier à ${t.name}`} className={inputCls} value={target?.id ?? ''}
                  onChange={(e) => setSelectedTargets({ ...selectedTargets, [t.id]: e.target.value })}>
                  <option value="">Choisir une tâche</option>
                  {tasks.filter((o) => o.id !== t.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {target && <select aria-label={`Relation avec ${target.name}`} className={inputCls}
                  value={relationOf(t, target)} onChange={(e) => setRelation(t, target, e.target.value as Relation)}>
                  <option value="none">Aucune relation</option>
                  <option value="linked" disabled={target.linkedTo.some((id) => id !== t.id)}>
                    Liée (même personne, ordre libre)
                  </option>
                  <option value="follows" disabled={wouldCycle(base, t.id, target.id)}>Doit suivre</option>
                  <option value="followed" disabled={wouldCycle(base, target.id, t.id)}>Doit être suivie par</option>
                </select>}
              </div>
              {t.linkedTo.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  Marge minimale entre les tâches liées
                  <NumberField label={`Marge pour ${t.name} en minutes`} className={`${inputCls} w-20`}
                    min={0} value={t.linkGap ?? 0} onChange={(linkGap) => update(t.id, { linkGap })} /> min
                </label>
              )}
              {t.dependsOn.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={t.chainSamePerson}
                    onChange={(e) => update(t.id, { chainSamePerson: e.target.checked })}
                  />
                  Enchaîner avec la même personne
                </label>
              )}
            </fieldset>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
